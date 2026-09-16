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
    chunk_count: int | None = 0


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
    file_hash: str | None = None
    job_id: str | None = None


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


class ComparisonRow(BaseModel):
    test: str
    category: str = "General"
    unit: str
    baseline: str | float | None = None
    followup: str | float | None = None
    delta_type: str = "stable"  # improving | decrease | increase | new | stable
    delta_label: str = "0.0 stable"
    status: str = "stable"      # improved | declined | stable | unavailable
    citation: str = "p. 1"


class ComparisonSummary(BaseModel):
    improved: int = 0
    declined: int = 0
    stable: int = 0
    unavailable: int = 0
    total: int = 0


class ComparisonOut(BaseModel):
    baseline_report_id: str | None = None
    followup_report_id: str | None = None
    baseline_filename: str | None = None
    followup_filename: str | None = None
    baseline_date: str | None = None
    followup_date: str | None = None
    rows: list[ComparisonRow]
    summary: ComparisonSummary
