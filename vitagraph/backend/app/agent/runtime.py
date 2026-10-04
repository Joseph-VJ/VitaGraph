"""AgentRuntime backend client managing the isolated worker process."""

from __future__ import annotations

import asyncio
import collections
import json
import os
import signal
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Any, AsyncIterator

from app.agent.profile import PersonaProfile, child_environment

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
WORKER_SCRIPT = Path(__file__).resolve().parent / "worker.py"


class RuntimeStartError(RuntimeError):
    """Raised when the agent worker process fails to start."""


class RuntimeBusy(RuntimeError):
    """Raised when a new turn is requested while another turn is active."""


class AgentRuntime:
    """Manages an external worker process hosting the DeepSeek Harness runtime."""

    def __init__(
        self,
        profile: PersonaProfile,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str = "deepseek-v4-flash",
        worker_command: list[str] | None = None,
        start_timeout: float = 60.0,
        idle_timeout: float = 180.0,
    ) -> None:
        self.profile = profile
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.worker_command = worker_command
        self.start_timeout = start_timeout
        self.idle_timeout = idle_timeout

        self._proc: subprocess.Popen[str] | None = None
        self._write_lock = threading.Lock()
        self._stderr_lines: collections.deque[str] = collections.deque(maxlen=40)
        self._stderr_thread: threading.Thread | None = None
        self._stdout_thread: threading.Thread | None = None

        self._start_event = threading.Event()
        self._start_error: str | None = None
        self._is_ready = False

        self._is_running = False
        self._active_queue: tuple[asyncio.AbstractEventLoop, asyncio.Queue] | None = None
        self.last_used: float = time.monotonic()

    @property
    def pid(self) -> int | None:
        return self._proc.pid if self._proc else None

    @property
    def is_alive(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def start(self) -> None:
        """Start the worker process with minimal environment and wait for ready."""
        if self.is_alive:
            return

        cmd = self.worker_command or [sys.executable, str(WORKER_SCRIPT)]
        env = child_environment()

        kwargs: dict[str, Any] = {}
        if sys.platform == "win32":
            kwargs["creationflags"] = (
                subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
            )
        else:
            kwargs["start_new_session"] = True

        self._start_event.clear()
        self._start_error = None
        self._is_ready = False

        try:
            self._proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                env=env,
                cwd=str(BACKEND_DIR),
                bufsize=1,
                **kwargs,
            )
        except Exception as exc:
            raise RuntimeStartError(f"Failed to spawn worker process: {exc}") from exc

        self.last_used = time.monotonic()

        # Start background threads to drain stderr and stdout
        self._stderr_thread = threading.Thread(target=self._drain_stderr, daemon=True)
        self._stderr_thread.start()

        self._stdout_thread = threading.Thread(target=self._drain_stdout, daemon=True)
        self._stdout_thread.start()

        # Send start command
        start_req = {
            "cmd": "start",
            "config": {
                "profile": "sdk-minimal",
                "patches": [str(p.resolve()) for p in self.profile.patch_files],
                "dsh_home": str(self.profile.home.resolve()),
                "cwd": str(self.profile.workspace.resolve()),
                "model": self.model,
                "base_url": self.base_url,
                "api_key": self.api_key,
                "initialize_timeout_seconds": self.start_timeout,
            },
        }
        self._send(start_req)

        # Wait for ready or error
        signaled = self._start_event.wait(timeout=self.start_timeout)
        if not signaled or not self._is_ready or not self.is_alive:
            err_msg = self._start_error or ("Startup timed out" if not signaled else "Process exited early")
            self.kill()
            tail = "\n".join(list(self._stderr_lines)[-20:])
            raise RuntimeStartError(f"{err_msg}\n{tail}".strip())

    def _send(self, msg: dict) -> None:
        with self._write_lock:
            if self._proc and self._proc.stdin and self._proc.poll() is None:
                try:
                    line = json.dumps(msg, ensure_ascii=False)
                    self._proc.stdin.write(line + "\n")
                    self._proc.stdin.flush()
                except (OSError, BrokenPipeError):
                    pass

    def _drain_stderr(self) -> None:
        proc = self._proc
        if not proc or not proc.stderr:
            return
        try:
            for raw_line in proc.stderr:
                if self._proc is not proc:
                    return
                self._stderr_lines.append(raw_line.rstrip())
        except Exception:
            pass

    def _drain_stdout(self) -> None:
        proc = self._proc
        if not proc or not proc.stdout:
            return
        try:
            for raw_line in proc.stdout:
                if self._proc is not proc:
                    return
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line)
                except Exception:
                    continue

                if self._proc is not proc:
                    return

                self.last_used = time.monotonic()
                mtype = msg.get("type")

                if not self._is_ready:
                    if mtype == "ready":
                        self._is_ready = True
                        self._start_event.set()
                    elif mtype == "error":
                        self._start_error = msg.get("message", "Start error")
                        self._start_event.set()
                    continue

                if self._proc is proc and self._active_queue is not None:
                    loop, q = self._active_queue
                    loop.call_soon_threadsafe(q.put_nowait, msg)
        except Exception:
            pass
        finally:
            if self._proc is proc:
                if not self._is_ready:
                    self._start_event.set()
                if self._active_queue is not None:
                    loop, q = self._active_queue
                    loop.call_soon_threadsafe(q.put_nowait, {"type": "worker_stopped"})

    async def astart(self) -> None:
        """Start worker process in a worker thread."""
        await asyncio.to_thread(self.start)

    async def acancel(self) -> None:
        """Cancel worker process in a worker thread."""
        await asyncio.to_thread(self.cancel)

    async def aclose(self, timeout: float = 3.0) -> None:
        """Close worker process in a worker thread."""
        await asyncio.to_thread(self.close, timeout)

    async def akill(self) -> None:
        """Kill worker process in a worker thread."""
        await asyncio.to_thread(self.kill)

    async def stream_turn(
        self, session_id: str, text: str, *, run_id: str | None = None
    ) -> AsyncIterator[dict]:
        """Stream a turn from the worker process with live lockdown monitoring."""
        if not self.is_alive:
            await asyncio.to_thread(self.start)

        if self._is_running:
            raise RuntimeBusy("A turn is already active on this runtime.")

        self._is_running = True
        loop = asyncio.get_running_loop()
        q: asyncio.Queue = asyncio.Queue()
        self._active_queue = (loop, q)

        rid = run_id or f"run-{uuid.uuid4().hex[:8]}"
        run_req = {
            "cmd": "run",
            "run_id": rid,
            "session_id": session_id,
            "input": text,
        }
        self._send(run_req)

        finished = False
        try:
            while not finished:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=self.idle_timeout)
                except asyncio.TimeoutError:
                    await self.akill()
                    finished = True
                    self._is_running = False
                    self._active_queue = None
                    yield {
                        "type": "run_error",
                        "run_id": rid,
                        "message": "The agent took too long to answer.",
                    }
                    break

                self.last_used = time.monotonic()
                mtype = msg.get("type")

                if mtype == "worker_stopped":
                    finished = True
                    self._is_running = False
                    yield {"type": "run_error", "message": "The agent runtime stopped."}
                    break

                if mtype in ("result", "run_error"):
                    finished = True
                    self._is_running = False
                    yield msg
                    break

                if mtype == "notification":
                    payload = msg.get("payload") or {}
                    event = payload.get("event") or {}
                    ev_type = event.get("type") or event.get("method") or ""
                    data = event.get("data") if isinstance(event.get("data"), dict) else event

                    if ev_type == "request/header" or "header" in data or "header" in event:
                        from app.agent.lockdown import LockdownViolation, assert_locked_down, tool_names_from_events

                        try:
                            tool_names = tool_names_from_events([event])
                            assert_locked_down(tool_names)
                        except LockdownViolation as lv:
                            await self.akill()
                            # Extract offered tools for the notification before raising
                            tools_found: list[str] = []
                            header = data.get("header") if isinstance(data.get("header"), dict) else {}
                            raw_tools = header.get("tools") or data.get("tools") or []
                            for t in raw_tools:
                                if isinstance(t, dict):
                                    fn = t.get("function")
                                    if isinstance(fn, dict) and "name" in fn:
                                        tools_found.append(fn["name"])
                                    elif "name" in t:
                                        tools_found.append(t["name"])
                            yield {"type": "lockdown_violation", "tools": tools_found}
                            finished = True
                            raise lv

                    yield msg
        finally:
            if self._active_queue is not None and self._active_queue[1] is q:
                self._active_queue = None
                self._is_running = False
            if not finished:
                await self.acancel()

    def cancel(self) -> None:
        """Kill the worker process tree immediately."""
        self.kill()
        if self._active_queue is not None:
            loop, q = self._active_queue
            loop.call_soon_threadsafe(
                q.put_nowait,
                {"type": "run_error", "message": "Turn cancelled by user."},
            )

    def close(self, timeout: float = 3.0) -> None:
        """Send close command and wait for process to terminate, killing if needed."""
        if not self.is_alive:
            return
        self._send({"cmd": "close"})
        if self._proc:
            try:
                self._proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                self.kill()
        self._proc = None

    def kill(self) -> None:
        """Kill the worker process tree and ensure cleanup."""
        proc = self._proc
        if not proc or proc.poll() is not None:
            self._proc = None
            return

        pid = proc.pid
        if sys.platform == "win32":
            try:
                subprocess.run(
                    ["taskkill", "/PID", str(pid), "/T", "/F"],
                    capture_output=True,
                    timeout=5.0,
                )
            except Exception:
                pass
        else:
            try:
                os.killpg(os.getpgid(pid), signal.SIGKILL)
            except Exception:
                pass

        try:
            proc.wait(timeout=1.0)
        except Exception:
            pass
        self._proc = None
