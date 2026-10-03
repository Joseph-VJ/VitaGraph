"""Chat route: multi-turn conversation streamed over SSE (same event contract as /api/questions/stream)."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatRequest
from app.services import chat_service, user_service
from app.services.job_service import job_broker

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/stream")
async def chat_stream(payload: ChatRequest) -> StreamingResponse:
    """Send the conversation so far; receive thinking, tool_call, tool_result, text_delta, completed, error."""
    user_service.user_exists(payload.user_id)
    jid = job_broker.get_or_create_job(payload.job_id)
    turns = [t.model_dump() for t in payload.messages]
    asyncio.create_task(chat_service.run_chat_task(
        payload.user_id, turns, job_id=jid, report_id=payload.report_id, mode=payload.mode,
    ))
    return StreamingResponse(
        job_broker.event_generator(jid),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
