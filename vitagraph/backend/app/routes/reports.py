"""Report routes — upload, listing, status, and page provenance."""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Query, Response, UploadFile

from app.schemas.report import ComparisonOut, MeasurementOut, PageOut, ReportOut, ReportStatusOut, TrendOut
from app.services import measurement_service, report_service, user_service

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
    chunk_size: int | None = Form(None),
) -> dict:
    if chunk_size is not None and (chunk_size < 120 or chunk_size > 600):
        raise HTTPException(
            status_code=422,
            detail="chunk_size must be between 120 and 600.",
        )
    user_service.user_exists(user_id)
    if not user_service.has_consent(user_id):
        raise HTTPException(
            status_code=403,
            detail="This persona has not accepted the data-use statement yet.",
        )
    from app.core.config import settings

    declared_size = getattr(file, "size", None)
    if declared_size is not None and declared_size > settings.max_upload_mb * 1024 * 1024:
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
        asyncio.create_task(asyncio.to_thread(report_service.process_upload, user_id, filename, data, jid, chunk_size))
        return {
            "id": jid,
            "status": "received",
            "page_count": None,
            "chunk_count": 0,
            "error_message": None,
            "file_hash": None,
            "job_id": jid,
        }
    return report_service.process_upload(user_id, filename, data, job_id=jid, chunk_size=chunk_size)


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


@router.get("/{report_id}/measurements", response_model=list[MeasurementOut])
def report_measurements(report_id: str) -> list[dict]:
    """Values read from this report with the report's printed reference range and exact character span."""
    return measurement_service.list_report_measurements(report_id)


@router.get("/{report_id}/pages/{page_number}/image")
def report_page_image(report_id: str, page_number: int, dpi: int = Query(110, ge=50, le=200)) -> Response:
    """Render one stored report page to PNG so the UI can show the user's actual page."""
    png = report_service.render_page_png(report_id, page_number, dpi)
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "private, max-age=300"})


@router.get("/{user_id}/trends", response_model=TrendOut)
def report_trends(user_id: str, test: str = "Hemoglobin") -> dict:
    """Return longitudinal trend data for a lab test across all reports of a user."""
    user_service.user_exists(user_id)
    return report_service.get_user_trends(user_id, test_name=test)
