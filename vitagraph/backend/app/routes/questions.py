"""Question routes — the RAG entry point supporting standard answers and AgentRouter SSE streaming."""

from __future__ import annotations

import asyncio
import uuid
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.question import AnswerOut, QuestionCreate
from app.services import question_service, user_service
from app.services.job_service import job_broker

router = APIRouter(prefix="/api/questions", tags=["questions"])


@router.post("", response_model=AnswerOut)
async def ask_question(payload: QuestionCreate, background: bool = False) -> dict:
    """Submit a question for processing. Supports synchronous execution or background streaming."""
    user_service.user_exists(payload.user_id)
    jid = job_broker.get_or_create_job(payload.job_id)

    if payload.background or background:
        # Launch non-blocking background streaming task
        asyncio.create_task(question_service.ask_stream_task(payload.user_id, payload.text, jid))
        return {
            "question_id": f"qst_{uuid.uuid4().hex[:12]}",
            "job_id": jid,
            "classification": "general",
            "status": "processing",
            "summary_text": "",
            "evidence": [],
            "limitations_text": "",
            "safety_text": "",
            "ai_service_status": "ok",
            "safety_status": "passed",
        }
    return question_service.ask(payload.user_id, payload.text, job_id=jid)


@router.post("/stream")
async def stream_question(payload: QuestionCreate) -> StreamingResponse:
    """Stream real-time question generation over SSE.

    Emits typed Server-Sent Events:
    - event: thinking (internal reasoning / chain-of-thought)
    - event: tool_call (search_chroma or query_networkx_graph invocation)
    - event: tool_result (payload returned from tool execution)
    - event: text_delta (incremental 4-part answer text)
    - event: completed (terminal finalized answer state)
    - event: error (structured diagnostic failure reason)
    """
    user_service.user_exists(payload.user_id)
    jid = job_broker.get_or_create_job(payload.job_id)

    # Launch streaming task asynchronously
    asyncio.create_task(question_service.ask_stream_task(payload.user_id, payload.text, jid))

    return StreamingResponse(
        job_broker.event_generator(jid),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
