"""AI Agent route: one conversation turn streamed over SSE (same envelope as /api/chat/stream)."""

from __future__ import annotations

import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from starlette.concurrency import run_in_threadpool

from typing import AsyncIterator

from app.agent.pool import RuntimePool, get_pool
from app.agent.runs import RunBusy, get_registry, single_error_stream
from app.core.config import settings
from app.core.sse import KEEPALIVE_SECONDS, frame, sse_stream
from app.schemas.agent import (
    AgentRequest,
    AgentWarmRequest,
    ConversationOut,
    ConversationPatch,
    ConversationSummaryOut,
    ReportCreate,
    ReportOut,
    ReportSummaryOut,
    RunOut,
)
from app.services import agent_service, conversation_service, report_artifacts, report_render, user_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agent", tags=["agent"])

# Backward compatibility aliases for existing tests
_frame = frame


def _sse_stream(events: AsyncIterator[tuple[str, dict]]) -> AsyncIterator[str]:
    import app.routes.agent as _self
    timeout = getattr(_self, "KEEPALIVE_SECONDS", KEEPALIVE_SECONDS)
    return sse_stream(events, keepalive_seconds=timeout)


_SSE_HEADERS = {"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}


def _keepalive() -> float:
    import app.routes.agent as _self
    return getattr(_self, "KEEPALIVE_SECONDS", KEEPALIVE_SECONDS)


@router.post("/stream")
async def agent_stream(payload: AgentRequest, pool: RuntimePool = Depends(get_pool)) -> StreamingResponse:
    """Send the conversation so far; receive run, status, thinking, step, tool_call, tool_result, text_delta, stats, completed, error.

    The answer is written by a background run that keeps going if this connection closes; this response only follows it.
    """
    user_service.user_exists(payload.user_id)
    turns = [t.model_dump() for t in payload.messages]
    conversation_id = payload.conversation_id or f"conv_{uuid.uuid4().hex[:12]}"
    valid = turns[-1].get("role") == "user"  # otherwise the service ends the stream with its own error
    registry = get_registry()

    def source():
        return agent_service.stream_agent(
            payload.user_id, turns, pool=pool, conversation_id=conversation_id,
            report_id=payload.report_id, pre_started=valid,
        )

    try:
        run = await registry.start(
            payload.user_id, conversation_id, str(turns[-1].get("content", "")) if valid else None, source
        )
    except RunBusy as busy:
        return StreamingResponse(single_error_stream(str(busy)), media_type="text/event-stream", headers=_SSE_HEADERS)
    return StreamingResponse(
        registry.subscribe(run, 0, _keepalive()), media_type="text/event-stream", headers=_SSE_HEADERS
    )


@router.get("/runs/active", response_model=list[RunOut])
def active_runs(user_id: str) -> list[dict]:
    """The answers this person has being written right now (finished ones are not listed)."""
    user_service.user_exists(user_id)
    return [
        {"conversation_id": r.conversation_id, "question": r.question, "started_at": r.started_at, "status": "running"}
        for r in get_registry().active(user_id)
    ]


@router.get("/runs/{conversation_id}/events")
async def run_events(conversation_id: str, user_id: str, after: int = Query(default=0, ge=0)) -> StreamingResponse:
    """Re-attach to a run: replay the frames after `after`, then follow it live until it ends."""
    user_service.user_exists(user_id)
    registry = get_registry()
    run = registry.get(user_id, conversation_id)
    if run is None:
        raise HTTPException(status_code=404, detail="No answer is being written for this chat")
    return StreamingResponse(
        registry.subscribe(run, after, _keepalive()), media_type="text/event-stream", headers=_SSE_HEADERS
    )


@router.post("/runs/{conversation_id}/stop")
async def stop_run(conversation_id: str, user_id: str) -> dict[str, bool]:
    """Stop a running answer; the turn is saved as 'stopped' with what was written so far."""
    user_service.user_exists(user_id)
    registry = get_registry()
    if registry.belongs_to_someone_else(user_id, conversation_id):
        raise HTTPException(status_code=404, detail="No answer is being written for this chat")
    return {"stopped": await registry.stop(user_id, conversation_id)}


@router.post("/warm")
async def warm_agent(payload: AgentWarmRequest, pool: RuntimePool = Depends(get_pool)) -> dict[str, str]:
    """Start this person's agent in the background so their first question does not wait for it."""
    user_service.user_exists(payload.user_id)
    if not (settings.allow_api and settings.effective_api_key):
        return {"status": "off"}  # nothing to warm: answers are composed locally

    async def _run() -> None:
        try:
            await pool.warm(payload.user_id)
        except Exception as exc:  # a failed warm-up only means the first question starts the agent itself
            logger.info("Agent warm-up skipped: %s", exc)

    asyncio.ensure_future(_run())
    return {"status": "warming"}


@router.get("/conversations", response_model=list[ConversationSummaryOut])
def list_conversations(user_id: str) -> list[ConversationSummaryOut]:
    """List a user's conversations: pinned first, then newest first."""
    user_service.user_exists(user_id)
    return conversation_service.list_conversations(user_id, get_registry().running_ids(user_id))


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: str, user_id: str) -> ConversationOut:
    """Retrieve one conversation with all its turns."""
    user_service.user_exists(user_id)
    return conversation_service.get_conversation(user_id, conversation_id)


@router.patch("/conversations/{conversation_id}", response_model=ConversationSummaryOut)
def update_conversation(conversation_id: str, user_id: str, payload: ConversationPatch) -> dict:
    """Rename and/or pin a conversation."""
    user_service.user_exists(user_id)
    if payload.title is None and payload.pinned is None:
        raise HTTPException(status_code=422, detail="Send a new title or a pinned value.")
    return conversation_service.update_conversation(
        user_id, conversation_id, title=payload.title, pinned=payload.pinned,
        running_ids=get_registry().running_ids(user_id),
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user_id: str) -> dict[str, str]:
    """Delete a conversation, its messages and artifacts (an answer still being written is stopped first)."""
    user_service.user_exists(user_id)
    await get_registry().stop(user_id, conversation_id)
    return conversation_service.delete_conversation(user_id, conversation_id)


@router.post("/reports", response_model=ReportOut)
async def create_report(payload: ReportCreate) -> dict:
    """Render an agent-written Markdown report to HTML and PDF with the app's template, and save it."""
    user_service.user_exists(payload.user_id)
    # CPU work (PDF layout): keep it off the event loop so streams and health checks stay responsive.
    return await run_in_threadpool(
        report_artifacts.create,
        payload.user_id,
        payload.conversation_id,
        payload.title,
        payload.markdown,
        [r.model_dump() for r in payload.refs],
    )


@router.get("/reports", response_model=list[ReportSummaryOut])
def list_reports(user_id: str) -> list[dict]:
    user_service.user_exists(user_id)
    return report_artifacts.list_reports(user_id)


@router.get("/reports/{report_id}", response_model=ReportOut)
def get_report(report_id: str, user_id: str) -> dict:
    user_service.user_exists(user_id)
    return report_artifacts.get(user_id, report_id)


@router.get("/reports/{report_id}/pdf")
def download_report_pdf(report_id: str, user_id: str) -> Response:
    user_service.user_exists(user_id)
    title, pdf = report_artifacts.get_pdf(user_id, report_id)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{report_render.slug(title)}.pdf"'},
    )


@router.delete("/reports/{report_id}")
def delete_report(report_id: str, user_id: str) -> dict[str, str]:
    user_service.user_exists(user_id)
    report_artifacts.delete(user_id, report_id)
    return {"deleted": report_id}
