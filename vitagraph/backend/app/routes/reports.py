"""Report routes — upload, listing, status, and page provenance."""

from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.schemas.report import PageOut, ReportOut, ReportStatusOut, TrendOut
from app.services import report_service, user_service

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/upload", response_model=ReportStatusOut, status_code=201)
async def upload_report(
    user_id: str = Form(...),
    file: UploadFile = File(...),
    job_id: str | None = Form(None),
) -> dict:
    user_service.user_exists(user_id)
    # Reject an oversized declared size before reading the body into memory.
    from app.core.config import settings

    declared_size = getattr(file, "size", None)
    if declared_size is not None and declared_size > settings.max_upload_mb * 1024 * 1024:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=400,
            detail=f"File exceeds the {settings.max_upload_mb} MB upload limit.",
        )
    data = await file.read()
    return report_service.process_upload(user_id, file.filename or "upload.pdf", data, job_id=job_id)


@router.get("", response_model=list[ReportOut])
def list_reports(user_id: str) -> list[dict]:
    user_service.user_exists(user_id)
    return report_service.list_reports(user_id)


@router.get("/{report_id}/status", response_model=ReportStatusOut)
def report_status(report_id: str) -> dict:
    return report_service.get_status(report_id)


@router.get("/{report_id}/pages", response_model=list[PageOut])
def report_pages(report_id: str) -> list[dict]:
    return report_service.get_pages(report_id)


@router.get("/{user_id}/trends", response_model=TrendOut)
def report_trends(user_id: str, test: str = "Hemoglobin") -> dict:
    """Return longitudinal trend data for a lab test across all reports of a user."""
    user_service.user_exists(user_id)
    return report_service.get_user_trends(user_id, test_name=test)
