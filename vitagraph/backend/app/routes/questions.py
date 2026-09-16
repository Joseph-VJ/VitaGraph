"""Question routes — the RAG entry point."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.question import AnswerOut, QuestionCreate
from app.services import question_service, user_service

router = APIRouter(prefix="/api/questions", tags=["questions"])


@router.post("", response_model=AnswerOut)
async def ask_question(payload: QuestionCreate, background: bool = False) -> dict:
    import uuid
    import asyncio
    from app.services.job_service import job_broker

    user_service.user_exists(payload.user_id)
    jid = job_broker.get_or_create_job(payload.job_id)

    if payload.background or background:
        asyncio.create_task(asyncio.to_thread(question_service.ask, payload.user_id, payload.text, jid))
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
