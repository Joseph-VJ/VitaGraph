"""Runtime pool managing per-persona AgentRuntime instances.

Features:
- One warm runtime per persona (lazy initialization).
- Enforces start-up safety check (verify_lockdown_async) once per persona.
- Reaps idle runtimes and evicts least-recently-used idle runtimes at capacity.
- Refuses concurrent turns on the same persona with RuntimeBusy.
- Provides clean cancellation and persona directory deletion.
- Registered with atexit for process cleanup on shutdown.
"""

from __future__ import annotations

import asyncio
import atexit
import logging
import re
import shutil
import threading
import time
from dataclasses import dataclass
from typing import Any, AsyncIterator, Callable

from app.agent.profile import PersonaProfile, agent_root, profile_for
from app.agent.runtime import AgentRuntime, RuntimeBusy
from app.core.config import settings

logger = logging.getLogger(__name__)

_PERSONA_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _validate_persona_id(persona_id: str) -> None:
    """Validate that persona_id conforms to the required regex."""
    if not persona_id or not _PERSONA_ID_RE.match(persona_id):
        raise ValueError(f"Invalid persona ID: {persona_id!r}")


class PoolFull(RuntimeError):
    """Raised when the pool is at capacity and all runtimes are busy."""


@dataclass
class _PoolEntry:
    persona_id: str
    runtime: AgentRuntime
    running: bool
    last_used: float


def _default_runtime_factory(profile: PersonaProfile) -> AgentRuntime:
    """Default factory building AgentRuntime with settings credentials."""
    return AgentRuntime(
        profile,
        api_key=settings.effective_api_key or None,
        base_url=settings.effective_base_url,
        model=settings.effective_model,
    )


async def _default_verify(persona_id: str) -> list[str]:
    """Default safety verification using verify_lockdown_async."""
    from app.agent.lockdown import verify_lockdown_async

    return await verify_lockdown_async(persona_id)


class RuntimePool:
    """Pool of per-persona AgentRuntime worker instances."""

    def __init__(
        self,
        *,
        max_runtimes: int = 5,
        idle_seconds: float = 600.0,
        runtime_factory: Callable[[PersonaProfile], AgentRuntime] | None = None,
        verify: Callable[[str], Any] | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_runtimes = max_runtimes
        self.idle_seconds = idle_seconds
        self.clock = clock
        self._runtime_factory = runtime_factory
        self._verify = verify

        self._entries: dict[str, _PoolEntry] = {}
        self._pool_lock = asyncio.Lock()
        self._persona_locks: dict[str, asyncio.Lock] = {}
        self._verified_personas: set[str] = set()

        atexit.register(self.close_all_sync)

    async def _get_persona_lock(self, persona_id: str) -> asyncio.Lock:
        async with self._pool_lock:
            if persona_id not in self._persona_locks:
                self._persona_locks[persona_id] = asyncio.Lock()
            return self._persona_locks[persona_id]

    async def stream_turn(
        self, persona_id: str, session_id: str, text: str
    ) -> AsyncIterator[dict]:
        """Stream a turn for the given persona, lazily acquiring the runtime."""
        _validate_persona_id(persona_id)

        p_lock = await self._get_persona_lock(persona_id)
        async with p_lock:
            # Check if this persona is already executing a turn
            async with self._pool_lock:
                existing = self._entries.get(persona_id)
                if existing is not None and existing.running:
                    raise RuntimeBusy(f"Persona '{persona_id}' is already running a turn.")

            # Perform lockdown check if not verified yet
            if persona_id not in self._verified_personas:
                verify_fn = self._verify or _default_verify
                await verify_fn(persona_id)
                self._verified_personas.add(persona_id)

            rt_to_close: AgentRuntime | None = None

            async with self._pool_lock:
                entry = self._entries.get(persona_id)
                if entry is not None and entry.running:
                    raise RuntimeBusy(f"Persona '{persona_id}' is already running a turn.")

                if entry is None or not entry.runtime.is_alive:
                    # Check capacity
                    if len(self._entries) >= self.max_runtimes:
                        idle_candidates = [
                            e for e in self._entries.values() if not e.running and e.persona_id != persona_id
                        ]
                        if not idle_candidates:
                            raise PoolFull("All runtimes in the pool are currently busy.")
                        # Evict least recently used (lowest last_used timestamp)
                        victim = min(idle_candidates, key=lambda e: e.last_used)
                        del self._entries[victim.persona_id]
                        rt_to_close = victim.runtime

                    prof = profile_for(persona_id)
                    factory = self._runtime_factory or _default_runtime_factory
                    rt = factory(prof)
                    entry = _PoolEntry(
                        persona_id=persona_id,
                        runtime=rt,
                        running=True,
                        last_used=self.clock(),
                    )
                    self._entries[persona_id] = entry
                else:
                    entry.running = True
                    entry.last_used = self.clock()

            # Close evicted runtime outside the lock
            if rt_to_close is not None:
                if hasattr(rt_to_close, "aclose"):
                    await rt_to_close.aclose()
                else:
                    await asyncio.to_thread(rt_to_close.close)

            # Ensure the worker is started
            if not entry.runtime.is_alive:
                if hasattr(entry.runtime, "astart"):
                    await entry.runtime.astart()
                else:
                    await asyncio.to_thread(entry.runtime.start)

        # Stream messages from runtime
        try:
            async for msg in entry.runtime.stream_turn(session_id, text):
                mtype = msg.get("type")
                if mtype in ("result", "run_error"):
                    async with self._pool_lock:
                        entry.running = False
                        entry.last_used = self.clock()
                yield msg
        finally:
            async with self._pool_lock:
                entry.running = False
                entry.last_used = self.clock()

    async def reap_idle(self) -> None:
        """Close idle runtimes older than idle_seconds."""
        now = self.clock()
        to_close: list[AgentRuntime] = []

        async with self._pool_lock:
            for pid, entry in list(self._entries.items()):
                if not entry.running and (now - entry.last_used) > self.idle_seconds:
                    del self._entries[pid]
                    to_close.append(entry.runtime)

        for rt in to_close:
            if hasattr(rt, "aclose"):
                await rt.aclose()
            else:
                await asyncio.to_thread(rt.close)

    async def cancel(self, persona_id: str) -> None:
        """Cancel and kill the runtime for a persona, dropping the pool entry."""
        _validate_persona_id(persona_id)
        async with self._pool_lock:
            entry = self._entries.pop(persona_id, None)

        if entry is not None:
            if hasattr(entry.runtime, "acancel"):
                await entry.runtime.acancel()
            else:
                await asyncio.to_thread(entry.runtime.cancel)

    async def forget_persona(self, persona_id: str) -> None:
        """Cancel the persona runtime and delete its folder safely."""
        _validate_persona_id(persona_id)
        await self.cancel(persona_id)

        root = agent_root().resolve()
        persona_dir = (agent_root() / persona_id).resolve()

        try:
            persona_dir.relative_to(root)
        except ValueError:
            raise ValueError(f"Path traversal detected: {persona_id!r} resolves outside agent root")

        if persona_dir == root:
            raise ValueError("Cannot delete agent root directory")

        if persona_dir.exists():
            shutil.rmtree(persona_dir, ignore_errors=False)

    async def close_all(self) -> None:
        """Close all runtimes asynchronously."""
        async with self._pool_lock:
            entries = list(self._entries.values())
            self._entries.clear()

        for entry in entries:
            if hasattr(entry.runtime, "aclose"):
                await entry.runtime.aclose()
            else:
                await asyncio.to_thread(entry.runtime.close)

    def close_all_sync(self) -> None:
        """Synchronous process exit cleanup hook for atexit."""
        entries = list(self._entries.values())
        self._entries.clear()
        for entry in entries:
            try:
                entry.runtime.kill()
            except Exception:
                pass

    def snapshot(self) -> list[dict[str, Any]]:
        """Return a snapshot of active runtimes in the pool."""
        now = self.clock()
        res = []
        for pid, entry in self._entries.items():
            idle = 0.0 if entry.running else max(0.0, now - entry.last_used)
            res.append({
                "persona_id": pid,
                "pid": entry.runtime.pid,
                "idle_seconds": round(idle, 2),
                "running": entry.running,
            })
        return res


_pool_singleton: RuntimePool | None = None
_singleton_lock = threading.Lock()


def get_pool() -> RuntimePool:
    """Return the lazily created module-level RuntimePool singleton."""
    global _pool_singleton
    with _singleton_lock:
        if _pool_singleton is None:
            _pool_singleton = RuntimePool()
        return _pool_singleton
