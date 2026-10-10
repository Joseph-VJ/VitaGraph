"""Tool routes: stateless helpers that do not touch a persona's data (currently image OCR)."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.core.sse import sse_stream
from app.ingestion import ocr_image
from app.services import graph_ai

router = APIRouter(prefix="/api/tools", tags=["tools"])

MAX_IMAGE_BYTES = 15 * 1024 * 1024


@router.get("/ocr/status")
def ocr_status() -> dict:
    ok = ocr_image.engine_available()
    return {"available": ok, "engine": "rapidocr" if ok else None, "max_bytes": MAX_IMAGE_BYTES}


@router.post("/ocr")
async def ocr_image_route(file: UploadFile = File(...)) -> dict:
    """Read the text in one image. The image is processed in memory and never stored."""
    data = await file.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="The file is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is larger than 15 MB.")
    try:
        # CPU-bound: keep it off the event loop so health checks and streams stay responsive.
        return await run_in_threadpool(ocr_image.read_image, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class GraphTextRequest(BaseModel):
    text: str


@router.post("/graph")
async def text_to_graph(payload: GraphTextRequest) -> dict:
    """Build a graph from pasted text with the AI model. Nothing is stored; every item is checked against the text."""
    try:
        return await graph_ai.build_graph(payload.text)
    except graph_ai.GraphAIError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc


@router.post("/graph/stream")
async def text_to_graph_stream(payload: GraphTextRequest) -> StreamingResponse:
    """The same graph, streamed over SSE: each entity and relation is sent the moment the model writes it and has
    passed the quote check. The gates run before the stream opens, so a refusal is a plain HTTP error."""
    try:
        text = graph_ai.check_input(payload.text)
    except graph_ai.GraphAIError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc
    return StreamingResponse(
        sse_stream(graph_ai.stream_graph(text)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
