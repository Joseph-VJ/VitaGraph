"""Persona routes — thin HTTP layer, logic in services."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.user import UserCreate, UserOut
from app.services import user_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate) -> dict:
    return user_service.create_user(payload.display_label)


@router.get("", response_model=list[UserOut])
def list_users() -> list[dict]:
    return user_service.list_users()


@router.post("/{user_id}/consent", response_model=UserOut)
def accept_consent(user_id: str) -> dict:
    """Record acceptance of the data-use statement (plan Section 15.2)."""
    return user_service.accept_consent(user_id)


@router.delete("/{user_id}")
def delete_user(user_id: str) -> dict:
    return user_service.delete_user(user_id)
