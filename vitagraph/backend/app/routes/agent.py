"""AI Agent route: one conversation turn streamed over SSE (same envelope as /api/chat/stream)."""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import Response, StreamingResponse
from starlette.concurrency import run_in_threadpool

from typing import AsyncIterator

from app.agent.pool import RuntimePool, get_pool
from app.core.config import settings
from app.core.sse import KEEPALIVE_SECONDS, frame, sse_stream
from app.schemas.agent import (
    AgentRequest,
    AgentWarmRequest,
    ConversationOut,
    ConversationSummaryOut,
    ReportCreate,
    ReportOut,
    ReportSummaryOut,
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


@router.post("/stream")
async def agent_stream(payload: AgentRequest, pool: RuntimePool = Depends(get_pool)) -> StreamingResponse:
    """Send the conversation so far; receive status, thinking, step, tool_call, tool_result, text_delta, stats, completed, error."""
    user_service.user_exists(payload.user_id)
    turns = [t.model_dump() for t in payload.messages]
    events = agent_service.stream_agent(
        payload.user_id, turns, pool=pool, conversation_id=payload.conversation_id, report_id=payload.report_id,
    )
    return StreamingResponse(
        sse_stream(events),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


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
    """List a user's conversations, newest first."""
    user_service.user_exists(user_id)
    return conversation_service.list_conversations(user_id)


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: str, user_id: str) -> ConversationOut:
    """Retrieve one conversation with all its turns."""
    user_service.user_exists(user_id)
    return conversation_service.get_conversation(user_id, conversation_id)


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, user_id: str) -> dict[str, str]:
    """Delete a conversation, its messages and artifacts."""
    user_service.user_exists(user_id)
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
