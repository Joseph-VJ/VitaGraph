"""Chat schemas: a multi-turn conversation with the assistant about one person's reports."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    user_id: str
    # The whole conversation so far, oldest first. The last turn must be the user's new message.
    messages: list[ChatTurn] = Field(min_length=1, max_length=60)
    job_id: str | None = None
    # Restrict retrieval to one report ("chat with this PDF").
    report_id: str | None = None
    # rag_ai: the assistant may call tools and write freely. rag_only: evidence is quoted, no AI call.
    mode: Literal["rag_ai", "rag_only"] = "rag_ai"
