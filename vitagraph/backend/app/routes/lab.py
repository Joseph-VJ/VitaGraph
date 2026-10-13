"""RAG Lab routes: start a self-grading run, follow it live over SSE, stop it, read saved runs."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.sse import sse_stream
from app.lab import gold, runner
from app.schemas.lab import LabRunRequest

router = APIRouter(prefix="/api/lab", tags=["lab"])


@router.get("/gold")
def get_gold() -> dict:
    """The fixed test questions, their expectations and the sample files they use."""
    return gold.public_gold()


@router.post("/runs", status_code=202)
async def start_run(payload: LabRunRequest) -> dict:
    run = runner.start_run(payload.mode, payload.chunk_size, payload.top_k or settings.top_k_results)
    return {"run_id": run.id}


@router.get("/active")
def get_active() -> dict:
    return {"run_id": runner.active_run_id()}


@router.get("/runs")
def list_runs(limit: int = 50) -> list[dict]:
    return runner.list_saved_runs(max(1, min(limit, 200)))


@router.get("/runs/{run_id}/events")
async def run_events(run_id: str) -> StreamingResponse:
    """Replay every event of the run so far, then stream new ones until it ends. Works for a run that already ended."""
    run = runner.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Lab run not found (it may have ended and left memory).")
    return StreamingResponse(
        sse_stream(runner.follow(run)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.post("/runs/{run_id}/cancel")
async def cancel_run(run_id: str) -> dict:
    run = runner.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Lab run not found.")
    return {"cancelled": runner.cancel_run(run)}


@router.get("/runs/{run_id}")
def get_run(run_id: str) -> dict:
    saved = runner.get_saved_run(run_id)
    if saved is None:
        raise HTTPException(status_code=404, detail="Lab run not found.")
    return saved
