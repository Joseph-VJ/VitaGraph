"""Knowledge Graph endpoints — whole graph, question-conditioned subgraphs, and node summaries."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from app.core.sse import sse_stream
from app.graph.builder import get_question_subgraph, serialize_user_graph
from app.schemas.graph import GraphResponse, NodeSummaryRequest, SeriesOut, SubgraphRequest
from app.services import node_summary, series_service, user_service

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/{user_id}/series", response_model=SeriesOut)
async def get_user_series(user_id: str) -> dict:
    """Time-series of test measurements across all reports for a user."""
    user_service.user_exists(user_id)
    return await run_in_threadpool(series_service.get_series, user_id)


@router.get("/{user_id}", response_model=GraphResponse)
def get_user_graph(user_id: str) -> dict:
    """Retrieve the full knowledge graph and topological analytics for a user."""
    user_service.user_exists(user_id)
    res = serialize_user_graph(user_id)
    res["active_concepts"] = []
    return res



@router.post("/subgraph", response_model=GraphResponse)
def get_subgraph(req: SubgraphRequest) -> dict:
    """Retrieve the question-conditioned active subnetwork for retrieved chunk IDs."""
    user_service.user_exists(req.user_id)
    return get_question_subgraph(req.user_id, req.chunk_ids)


@router.post("/node-summary")
async def node_summary_stream(req: NodeSummaryRequest) -> StreamingResponse:
    """What one graph node is and what this person's files say about it, streamed over SSE:
    status, sources, text_delta, completed (or error). Every claim cites a passage."""
    user_service.user_exists(req.user_id)
    node = await run_in_threadpool(node_summary.gather, req.user_id, req.node_id)  # 404 before the stream opens
    return StreamingResponse(
        sse_stream(node_summary.stream(node, refresh=req.refresh)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
