from __future__ import annotations
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.chat import ChatTurn


class AgentRequest(BaseModel):
    user_id: str
    # The whole conversation so far, oldest first. The last turn must be the user's new message.
    messages: list[ChatTurn] = Field(min_length=1, max_length=60)
    # Groups the turns of one conversation; the server makes one when absent.
    conversation_id: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,64}$")
    # Restrict the agent to one report ("ask about this report").
    report_id: str | None = None


class ConversationSummaryOut(BaseModel):
    id: str
    title: str | None = None
    updated_at: str
    message_count: int


class ConversationMessageOut(BaseModel):
    seq: int
    role: str
    content: str
    status: str | None = None
    ai_status: str | None = None
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    trajectory: list[dict[str, Any]] = Field(default_factory=list)
    stats: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class ConversationOut(BaseModel):
    id: str
    title: str | None = None
    messages: list[ConversationMessageOut]
