"""My Data route: one read-only summary of everything a persona has added and asked."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.overview import OverviewOut
from app.services import overview_service

router = APIRouter(prefix="/api/overview", tags=["overview"])


@router.get("/{user_id}", response_model=OverviewOut)
def get_overview(user_id: str) -> dict:
    """Reports with their page and passage counts, chats with the reports they used, AI reports and a plain activity feed."""
    return overview_service.get_overview(user_id)
