"""Question routes — the RAG entry point."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.question import AnswerOut, QuestionCreate
from app.services import question_service, user_service

router = APIRouter(prefix="/api/questions", tags=["questions"])


@router.post("", response_model=AnswerOut)
def ask_question(payload: QuestionCreate) -> dict:
    user_service.user_exists(payload.user_id)
    return question_service.ask(payload.user_id, payload.text, job_id=payload.job_id)
