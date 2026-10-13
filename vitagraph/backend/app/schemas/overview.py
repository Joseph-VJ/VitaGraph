"""My Data overview schemas: one read-only summary of everything a persona has added and asked."""

from __future__ import annotations

from pydantic import BaseModel, Field


class OverviewPersona(BaseModel):
    id: str
    display_label: str
    created_at: str
    consent_accepted: bool


class OverviewTotals(BaseModel):
    reports: int
    reports_ready: int
    pages: int
    chunks: int
    chats: int
    questions: int
    saved_reports: int
    ai_messages_sent: int
    details_hidden: int


class OverviewReport(BaseModel):
    id: str
    original_filename: str
    file_hash: str
    report_date: str | None
    upload_time: str
    version: int
    status: str  # received|extracting|indexing|ready|failed
    error_message: str | None
    page_count: int | None
    chunk_count: int
    pages_typed: int      # extraction_method native
    pages_scanned: int    # extraction_method ocr
    pages_failed: int     # extraction_method failed
    pages_weak: int       # quality is neither good nor failed
    chat_ids: list[str] = Field(default_factory=list)


class OverviewReportUsed(BaseModel):
    id: str
    filename: str | None
    deleted: bool


class OverviewChat(BaseModel):
    id: str
    title: str | None
    created_at: str
    updated_at: str
    message_count: int
    questions: int
    answered: int
    refused: int
    first_question: str | None
    reports_used: list[OverviewReportUsed] = Field(default_factory=list)


class OverviewSavedReport(BaseModel):
    id: str
    title: str
    created_at: str
    conversation_id: str | None


class OverviewActivity(BaseModel):
    id: str
    timestamp: str
    kind: str
    text: str
    report_id: str | None = None
    conversation_id: str | None = None


class OverviewOut(BaseModel):
    persona: OverviewPersona
    allow_api: bool
    totals: OverviewTotals
    reports: list[OverviewReport]
    chats: list[OverviewChat]
    saved_reports: list[OverviewSavedReport]
    activity: list[OverviewActivity]
