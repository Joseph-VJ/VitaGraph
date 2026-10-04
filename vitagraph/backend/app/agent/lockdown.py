"""Startup safety check verifying that the agent runtime is strictly locked down."""

from __future__ import annotations

import asyncio
import hashlib
import uuid
from typing import Any

from app.agent.profile import TOOL_NAMES, PersonaProfile, profile_for

_lockdown_cache: dict[str, list[str]] = {}


class LockdownViolation(RuntimeError):
    """Raised when an unapproved tool or configuration violates security lockdown."""


def assert_locked_down(tool_names: list[str]) -> None:
    """Assert that the offered tools match exactly the four allowed VitaGraph tools."""
    expected = sorted(TOOL_NAMES)
    actual = sorted(tool_names)
    if actual != expected:
        raise LockdownViolation(
            f"Lockdown violation: expected tools {expected}, but offered tools were {actual}"
        )


def tool_names_from_events(events: list[dict[str, Any]]) -> list[str]:
    """Extract and sort tool names offered to the model from session events."""
    for event in reversed(events):
        ev_type = event.get("type") or event.get("method") or event.get("name")
        data = event.get("data") if isinstance(event.get("data"), dict) else event
        header = data.get("header") if isinstance(data.get("header"), dict) else {}

        if ev_type == "request/header" or "header" in data or "header" in event:
            tools = header.get("tools") or data.get("tools") or event.get("tools")
            if not tools:
                raise LockdownViolation(
                    "The request/header event offered NO tools; the tool server did not start."
                )

            names = []
            for t in tools:
                if isinstance(t, dict):
                    fn = t.get("function")
                    if isinstance(fn, dict) and "name" in fn:
                        names.append(fn["name"])
                    elif "name" in t:
                        names.append(t["name"])
            if names:
                return sorted(names)

    raise LockdownViolation("No request/header event found with tools in session events.")


async def verify_lockdown_async(
    persona_id: str,
    *,
    profile: PersonaProfile | None = None,
    runtime_factory: Any = None,
    api_key: str = "probe-token",
) -> list[str]:
    """Verify that the harness runtime for the persona is strictly locked down (async)."""
    prof = profile or profile_for(persona_id, fast_fail=True)

    hasher = hashlib.sha256()
    for pf in prof.patch_files:
        if pf.exists():
            hasher.update(pf.read_bytes())
    patch_hash = hasher.hexdigest()

    if profile is None and patch_hash in _lockdown_cache:
        return list(_lockdown_cache[patch_hash])

    if runtime_factory is not None:
        rt = runtime_factory(prof)
    else:
        from app.agent.runtime import AgentRuntime

        rt = AgentRuntime(
            prof,
            base_url="http://127.0.0.1:9/v1",
            api_key=api_key,
        )

    collected_events: list[dict[str, Any]] = []
    try:
        if hasattr(rt, "astart"):
            await rt.astart()
        else:
            await asyncio.to_thread(rt.start)
        session_id = f"probe-{uuid.uuid4().hex[:8]}"
        async for msg in rt.stream_turn(session_id, "hello"):
            if msg.get("type") == "notification":
                payload = msg.get("payload") or {}
                ev = payload.get("event")
                if isinstance(ev, dict):
                    collected_events.append(ev)

        tool_names = tool_names_from_events(collected_events)
        assert_locked_down(tool_names)
        if profile is None:
            _lockdown_cache[patch_hash] = list(tool_names)
        return tool_names
    finally:
        if hasattr(rt, "aclose"):
            await rt.aclose()
        else:
            await asyncio.to_thread(rt.close)


def verify_lockdown(
    persona_id: str,
    *,
    profile: PersonaProfile | None = None,
    runtime_factory: Any = None,
    api_key: str = "probe-token",
) -> list[str]:
    """Synchronous entry point for verify_lockdown_async."""
    return asyncio.run(
        verify_lockdown_async(
            persona_id,
            profile=profile,
            runtime_factory=runtime_factory,
            api_key=api_key,
        )
    )
