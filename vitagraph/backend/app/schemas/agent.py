from __future__ import annotations

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
