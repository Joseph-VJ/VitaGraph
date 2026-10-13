"""Chart route: draws a chart from the person's own stored values (the agent sends only a small spec, never numbers)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.services import chart_service, user_service

router = APIRouter(prefix="/api/agent", tags=["agent"])


class ChartRequest(BaseModel):
    user_id: str
    # Checked by chart_service so a bad spec always comes back as one plain sentence in `detail`.
    spec: Any = None


@router.post("/chart")
async def make_chart(payload: ChartRequest) -> dict:
    user_service.user_exists(payload.user_id)
    try:
        return await run_in_threadpool(chart_service.build_chart, payload.user_id, payload.spec)
    except chart_service.ChartError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
