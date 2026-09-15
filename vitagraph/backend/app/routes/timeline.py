"""Timeline routes - the internal persona timeline and AI-call audit."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.timeline import TimelineEventOut
from app.services import timeline_service, user_service

router = APIRouter(prefix="/api/timeline", tags=["timeline"])


@router.get("/{user_id}", response_model=list[TimelineEventOut])
def get_timeline(user_id: str) -> list[dict]:
    user_service.user_exists(user_id)
    return timeline_service.list_events(user_id)


@router.get("/{user_id}/ai-calls")
def get_ai_calls(user_id: str) -> list[dict]:
    """Audit record of every AI generation attempt for this user."""
    user_service.user_exists(user_id)
    return timeline_service.list_ai_calls(user_id)
