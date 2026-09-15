"""Timeline / history-event schemas (internal persona timeline)."""

from __future__ import annotations

from pydantic import BaseModel


class TimelineEventOut(BaseModel):
    id: str
    user_id: str
    event_type: str
    timestamp: str
    payload: dict
