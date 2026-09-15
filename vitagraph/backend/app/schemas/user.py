"""User / persona schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    display_label: str = Field(min_length=1, max_length=80,
                               description="Synthetic persona label, never a real person's data")


class UserOut(BaseModel):
    id: str
    display_label: str
    created_at: str
    status: str
    consent_accepted: bool
