"""Request bodies for the RAG Lab routes."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class LabRunRequest(BaseModel):
    mode: Literal["quick", "full"] = "quick"
    chunk_size: int = Field(default=200, ge=120, le=600)
    top_k: int | None = Field(default=None, ge=1, le=10)

    @field_validator("chunk_size")
    @classmethod
    def _step_of_ten(cls, value: int) -> int:
        if value % 10 != 0:
            raise ValueError("chunk_size must be a multiple of 10")
        return value
