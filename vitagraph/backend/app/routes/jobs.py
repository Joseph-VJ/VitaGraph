"""Jobs router providing Server-Sent Events (SSE) streaming for plan Section 12."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.services.job_service import job_broker

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/{job_id}/events")
async def stream_job_events(job_id: str) -> StreamingResponse:
    """Stream real-time pipeline events (SSE) for a specific job."""
    return StreamingResponse(
        job_broker.event_generator(job_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{job_id}")
def get_job_status(job_id: str) -> dict:
    """Get the current status and recorded events for a job."""
    job = job_broker.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job["id"],
        "status": job["status"],
        "events": job["events"],
        "event_count": len(job["events"]),
        "result": job.get("result"),
        "error": job.get("error"),
    }


@router.get("/{job_id}/result")
def get_job_result(job_id: str) -> dict:
    """Get the computation result of a completed job."""
    job = job_broker.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job["id"],
        "status": job["status"],
        "result": job.get("result"),
        "error": job.get("error"),
    }


@router.post("")
def create_job() -> dict:
    """Explicitly allocate a job ID before starting an operation."""
    jid = job_broker.get_or_create_job()
    return {"job_id": jid, "status": "running"}
