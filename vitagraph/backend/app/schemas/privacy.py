"""Privacy Shield request and response shapes."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

Scope = Literal["persona", "tools"]


class PreviewIn(BaseModel):
    user_id: str
    text: str


class PreviewSpan(BaseModel):
    type: str
    placeholder: str
    start: int
    end: int


class PreviewOut(BaseModel):
    masked: str
    spans: list[PreviewSpan]
    counts: dict[str, int]


class TermIn(BaseModel):
    user_id: str
    term: str


class TermOut(BaseModel):
    id: str
    term: str
    created_at: str


class ChainIn(BaseModel):
    user_id: str = ""
    scope: Scope = "persona"


class SummaryOut(BaseModel):
    covered: bool
    calls: int
    removed_total: int
    chars_sent: int
    by_type: dict[str, int]
    last_call_at: str | None


class LedgerRowOut(BaseModel):
    id: str
    seq: int
    purpose: str
    created_at: str
    chars_original: int
    chars_sent: int
    removed_total: int
    removed_by_type: dict[str, int]
    prev_hash: str
    row_hash: str


class LedgerRowFullOut(LedgerRowOut):
    sent_text: str


class VerifyOut(BaseModel):
    ok: bool
    checked: int
    broken_at_seq: int | None
    message: str


class TamperOut(BaseModel):
    changed_seq: int
    detected_at_seq: int | None
    detected: bool
    checked: int
