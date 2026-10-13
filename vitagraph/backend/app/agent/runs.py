"""Agent runs that outlive the browser.

An answer is produced by a background asyncio task owned by this per-process registry. HTTP responses only
SUBSCRIBE to a run: they replay the frames buffered so far and then follow the live ones. If the browser goes
away (page change, closed tab, lost connection) the run keeps going, finishes and is saved. Only an explicit
stop() cancels it. A finished run stays in memory for ten minutes so a returning page can still replay it.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Callable

from app.core.sse import KEEPALIVE_SECONDS, frame
from app.services import conversation_service
from app.services.agent_service import BUSY_MESSAGE, _TurnRecorder

logger = logging.getLogger(__name__)

KEEP_FINISHED_SECONDS = 600.0
STOP_WAIT_SECONDS = 15.0
CONNECTED = ": connected to agent stream\n\n"
KEEPALIVE = ": keep-alive\n\n"

EventSource = Callable[[], AsyncIterator[tuple[str, dict]]]


class RunBusy(Exception):
    """This person already has an answer being written."""


@dataclass
class Frame:
    index: int
    text: str
    last: bool = False


@dataclass
class Run:
    user_id: str
    conversation_id: str
    question: str
    started_at: int  # epoch ms
    persisted_start: bool  # the conversation row and the question were written at start
    frames: list[Frame] = field(default_factory=list)
    subscribers: set[asyncio.Queue] = field(default_factory=set)
    recorder: _TurnRecorder = field(default_factory=_TurnRecorder)
    partial: str = ""  # text of the model call in progress (the answer so far)
    finished: bool = False
    status: str = "running"  # running | done | error | stopped
    finished_at: float | None = None
    finalizing: bool = False
    task: asyncio.Task | None = None

    @property
    def running(self) -> bool:
        return not self.finished


def single_error_stream(message: str) -> AsyncIterator[str]:
    """A stream that holds just one terminal error frame (used when no run could be started)."""

    async def _gen() -> AsyncIterator[str]:
        yield CONNECTED
        yield frame(1, "error", {"status": "error", "message": message, "diagnostic": ""}, last=True)

    return _gen()


class RunRegistry:
    def __init__(self) -> None:
        self._runs: dict[str, Run] = {}

    # ---- lookup -------------------------------------------------------------------------------------

    def _purge(self) -> None:
        now = time.monotonic()
        for cid, run in list(self._runs.items()):
            if run.finished and run.finished_at is not None and now - run.finished_at > KEEP_FINISHED_SECONDS:
                del self._runs[cid]

    def _settle(self, run: Run) -> None:
        """A task that ended without finishing the run (for example its event loop was closed) is not running."""
        if not run.finished and run.task is not None and run.task.done():
            self._mark_finished(run, "stopped")

    def get(self, user_id: str, conversation_id: str) -> Run | None:
        """The run for this conversation if it belongs to this person (running or recently finished)."""
        self._purge()
        run = self._runs.get(conversation_id)
        if run is None or run.user_id != user_id:
            return None
        self._settle(run)
        return run

    def belongs_to_someone_else(self, user_id: str, conversation_id: str) -> bool:
        run = self._runs.get(conversation_id)
        return run is not None and run.user_id != user_id

    def active(self, user_id: str) -> list[Run]:
        self._purge()
        out: list[Run] = []
        for run in self._runs.values():
            self._settle(run)
            if run.user_id == user_id and run.running:
                out.append(run)
        return sorted(out, key=lambda r: r.started_at)

    def running_ids(self, user_id: str) -> set[str]:
        return {r.conversation_id for r in self.active(user_id)}

    def any_running(self) -> bool:
        """True while any person's answer is still being written."""
        self._purge()
        for run in self._runs.values():
            self._settle(run)
            if run.running:
                return True
        return False


    # ---- start / stop -------------------------------------------------------------------------------

    async def start(
        self,
        user_id: str,
        conversation_id: str,
        question: str | None,
        event_source_factory: EventSource,
    ) -> Run:
        """Begin a run. With a question, the conversation and the question are written to the database now.

        Raises RunBusy when this person already has a run going (nothing is written then).
        """
        if self.active(user_id):
            raise RunBusy(BUSY_MESSAGE)
        if question is not None:
            # Raises 404 when the conversation belongs to someone else.
            await asyncio.to_thread(conversation_service.begin_turn, user_id, conversation_id, question)
        # begin_turn awaited: another request may have started a run meanwhile, check once more.
        if self.active(user_id):
            raise RunBusy(BUSY_MESSAGE)
        run = Run(
            user_id=user_id,
            conversation_id=conversation_id,
            question=question or "",
            started_at=int(time.time() * 1000),
            persisted_start=question is not None,
        )
        self._runs[conversation_id] = run
        self._emit(run, "run", {"conversation_id": conversation_id, "started_at": run.started_at})
        run.task = asyncio.ensure_future(self._drive(run, event_source_factory))
        return run

    async def stop(self, user_id: str, conversation_id: str) -> bool:
        """Cancel a running answer and save the turn as 'stopped'. False when nothing was running."""
        run = self.get(user_id, conversation_id)
        if run is None or run.finished:
            return False
        task = run.task
        if task is not None and not task.done():
            task.cancel()
            await asyncio.wait({task}, timeout=STOP_WAIT_SECONDS)
        if not run.finished:
            await self._finish_stopped(run)  # the task never got to run its own cleanup
        return True

    async def shutdown(self) -> None:
        """Server is closing: stop every running answer (each is saved as stopped)."""
        tasks = []
        for run in list(self._runs.values()):
            if run.running and run.task is not None and not run.task.done():
                run.task.cancel()
                tasks.append(run.task)
        if tasks:
            await asyncio.wait(tasks, timeout=STOP_WAIT_SECONDS)
        for run in list(self._runs.values()):
            if run.running:
                await self._finish_stopped(run)

    # ---- the background task ------------------------------------------------------------------------

    async def _drive(self, run: Run, factory: EventSource) -> None:
        gen: AsyncIterator[tuple[str, dict]] | None = None
        try:
            gen = factory()
            async for ev_type, payload in gen:
                self._track(run, ev_type, payload)
                if ev_type == "error":
                    await self._save_ended(run, "error", str(payload.get("message") or "The answer could not be finished."))
                self._emit(run, ev_type, payload)
                if run.finished:
                    break
            if not run.finished:
                message = "The AI Agent stopped without an answer."
                await self._save_ended(run, "error", message)
                self._emit(run, "error", {"status": "error", "message": message, "diagnostic": ""})
        except asyncio.CancelledError:
            await self._finish_stopped(run)
        except Exception as exc:
            logger.exception("Agent run failed")
            if not run.finished:
                message = "The AI Agent could not finish this answer."
                await self._save_ended(run, "error", message)
                self._emit(run, "error", {"status": "error", "message": message, "diagnostic": type(exc).__name__})
        finally:
            if gen is not None:
                with contextlib.suppress(BaseException):
                    await gen.aclose()
            if not run.finished:  # never leave subscribers waiting
                self._mark_finished(run, "error")

    @staticmethod
    def _track(run: Run, ev_type: str, payload: dict[str, Any]) -> None:
        run.recorder.observe(ev_type, payload)
        if ev_type == "text_delta":
            run.partial += str(payload.get("delta", ""))
        elif ev_type == "tool_call" or (
            ev_type == "model" and payload.get("phase") == "end" and payload.get("tool_calls")
        ):
            run.partial = ""  # text before a tool call is narration, not the answer

    async def _save_ended(self, run: Run, status: str, message: str) -> None:
        """Store the assistant message of a turn that ended in 'error' or 'stopped'."""
        if not run.persisted_start:
            return
        partial = run.partial.strip()
        final = {
            "summary_text": partial or message,
            "status": status,
            "ai_status": status,
            "evidence": [],
            "safety_passed": True,
        }
        await asyncio.to_thread(
            conversation_service.finish_turn,
            run.user_id,
            run.conversation_id,
            final,
            run.recorder.trajectory,
            run.recorder.stats,
        )

    async def _finish_stopped(self, run: Run) -> None:
        if run.finished or run.finalizing:
            return
        run.finalizing = True
        with contextlib.suppress(Exception):
            await self._save_ended(run, "stopped", "Stopped.")
        self._emit(run, "error", {"status": "stopped", "message": "Stopped.", "diagnostic": ""})

    # ---- frames -------------------------------------------------------------------------------------

    def _emit(self, run: Run, ev_type: str, payload: dict[str, Any]) -> None:
        """Number a frame, buffer it and hand it to every subscriber. 'done' and 'error' end the run."""
        last = ev_type in ("done", "error")
        out = Frame(
            index=len(run.frames) + 1,
            text=frame(len(run.frames) + 1, "completed" if ev_type == "done" else ev_type, payload, last=last),
            last=last,
        )
        run.frames.append(out)
        for queue in list(run.subscribers):
            queue.put_nowait(out)
        if last:
            if ev_type == "done":
                status = "done"
            else:
                status = "stopped" if payload.get("status") == "stopped" else "error"
            self._mark_finished(run, status)

    @staticmethod
    def _mark_finished(run: Run, status: str) -> None:
        if run.finished:
            return
        run.finished = True
        run.status = status
        run.finished_at = time.monotonic()
        for queue in list(run.subscribers):
            queue.put_nowait(None)  # wakes a subscriber that has no terminal frame to read

    # ---- subscribing --------------------------------------------------------------------------------

    async def subscribe(
        self, run: Run, after: int = 0, keepalive_seconds: float = KEEPALIVE_SECONDS
    ) -> AsyncIterator[str]:
        """SSE text for a run: frames with index > after, then live ones until the terminal frame."""
        yield CONNECTED
        queue: asyncio.Queue = asyncio.Queue()
        backlog = [f for f in run.frames if f.index > after]
        run.subscribers.add(queue)  # no await between the snapshot and this line, so no frame is missed
        try:
            for f in backlog:
                yield f.text
                if f.last:
                    return
            if run.finished:
                return
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=keepalive_seconds)
                except asyncio.TimeoutError:
                    yield KEEPALIVE
                    continue
                if item is None:
                    return
                if item.index <= after or item.index <= (backlog[-1].index if backlog else 0):
                    continue  # already replayed from the backlog
                yield item.text
                if item.last:
                    return
        finally:
            run.subscribers.discard(queue)


_registry: RunRegistry | None = None


def get_registry() -> RunRegistry:
    global _registry
    if _registry is None:
        _registry = RunRegistry()
    return _registry


def reset_registry() -> RunRegistry:
    """Forget every run (tests use this between event loops)."""
    global _registry
    _registry = RunRegistry()
    return _registry
