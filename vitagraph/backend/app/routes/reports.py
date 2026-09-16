"""Report routes — upload, listing, status, and page provenance."""

from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.schemas.report import ComparisonOut, PageOut, ReportOut, ReportStatusOut, TrendOut
from app.services import report_service, user_service

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/compare", response_model=ComparisonOut)
def compare_reports(
    user_id: str,
    baseline_id: str | None = None,
    followup_id: str | None = None,
) -> dict:
    """Compare extracted lab values between two reports for a user."""
    user_service.user_exists(user_id)
    return report_service.compare_reports(user_id, baseline_id=baseline_id, followup_id=followup_id)


@router.post("/upload", response_model=ReportStatusOut, status_code=201)
async def upload_report(
    user_id: str = Form(...),
    file: UploadFile = File(...),
    job_id: str | None = Form(None),
    background: bool = Form(True),
) -> dict:
    user_service.user_exists(user_id)
    if not user_service.has_consent(user_id):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=403,
            detail="This persona has not accepted the data-use statement yet.",
        )
    from app.core.config import settings

    declared_size = getattr(file, "size", None)
    if declared_size is not None and declared_size > settings.max_upload_mb * 1024 * 1024:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=400,
            detail=f"File exceeds the {settings.max_upload_mb} MB upload limit.",
        )
    data = await file.read()
    filename = file.filename or "upload.pdf"

    from app.services.job_service import job_broker
    jid = job_broker.get_or_create_job(job_id)

    if background:
        import asyncio
        asyncio.create_task(asyncio.to_thread(report_service.process_upload, user_id, filename, data, jid))
        return {
            "id": jid,
            "status": "received",
            "page_count": None,
            "chunk_count": 0,
            "error_message": None,
            "file_hash": None,
            "job_id": jid,
        }
    return report_service.process_upload(user_id, filename, data, job_id=jid)


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
