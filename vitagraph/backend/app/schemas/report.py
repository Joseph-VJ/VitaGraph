"""Report schemas: upload results, listings, and page-level provenance."""

from __future__ import annotations

from pydantic import BaseModel


class ReportOut(BaseModel):
    id: str
    user_id: str
    original_filename: str
    file_hash: str
    report_date: str | None
    upload_time: str
    version: int
    status: str          # received|extracting|indexing|ready|failed
    page_count: int | None
    error_message: str | None


class PageOut(BaseModel):
    page_number: int
    extraction_method: str   # native|ocr|failed
    text_length: int
    quality: str             # good|sparse|uncertain|failed
    extracted_text: str


class ReportStatusOut(BaseModel):
    id: str
    status: str
    page_count: int | None
    chunk_count: int
    error_message: str | None


class TrendPoint(BaseModel):
    date: str
    value: float
    flag: str = "NORMAL"
    report_id: str | None = None
    page_number: int | None = None


class TrendOut(BaseModel):
    test_name: str
    unit: str
    points: list[TrendPoint]
    trend_direction: str  # improving | stable | declining | single_reading
    start_value: float | None = None
    latest_value: float | None = None
