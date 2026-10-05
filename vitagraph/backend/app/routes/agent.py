"""AI Agent route: one conversation turn streamed over SSE (same envelope as /api/chat/stream)."""

from __future__ import annotations

import asyncio
import json
import time
from typing import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.agent.pool import RuntimePool, get_pool
from app.schemas.agent import AgentRequest
from app.services import agent_service, user_service

router = APIRouter(prefix="/api/agent", tags=["agent"])

KEEPALIVE_SECONDS = 15.0


def _frame(index: int, event_type: str, payload: dict, *, last: bool) -> str:
    event = {
        "index": f"{index:02d}",
        "stage": "done" if last else "generation",
        "description": payload.get("delta") or payload.get("thinking") or payload.get("message") or event_type,
        "subDescription": "",
        "latency": "",
        "timestamp": time.time(),
        "metadata": payload,
        "event_type": event_type,
        "event": event_type,
    }
    return f"event: {event_type}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"


async def _sse_stream(events: AsyncIterator[tuple[str, dict]]) -> AsyncIterator[str]:
    """Turn (event_type, payload) tuples into SSE frames; keep the connection alive while the agent is silent."""
    index = 0
    pending: asyncio.Future | None = None
    try:
        yield ": connected to agent stream\n\n"
        pending = asyncio.ensure_future(events.__anext__())
        while True:
            done, _ = await asyncio.wait({pending}, timeout=KEEPALIVE_SECONDS)
            if not done:
                yield ": keep-alive\n\n"
                continue
            try:
                event_type, payload = pending.result()
            except StopAsyncIteration:
                pending = None
                return
            index += 1
            last = event_type in ("done", "error")
            yield _frame(index, "completed" if event_type == "done" else event_type, payload, last=last)
            if last:
                pending = None
                return
            pending = asyncio.ensure_future(events.__anext__())
    finally:
        if pending is not None:
            if not pending.done():
                pending.cancel()
            await asyncio.wait({pending})
        await events.aclose()


@router.post("/stream")
async def agent_stream(payload: AgentRequest, pool: RuntimePool = Depends(get_pool)) -> StreamingResponse:
    """Send the conversation so far; receive status, thinking, step, tool_call, tool_result, text_delta, stats, completed, error."""
    user_service.user_exists(payload.user_id)
    turns = [t.model_dump() for t in payload.messages]
    events = agent_service.stream_agent(
        payload.user_id, turns, pool=pool, conversation_id=payload.conversation_id, report_id=payload.report_id,
    )
    return StreamingResponse(
        _sse_stream(events),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
