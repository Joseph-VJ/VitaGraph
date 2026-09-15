"""Knowledge Graph endpoints — whole graph and question-conditioned subgraphs."""

from __future__ import annotations

from fastapi import APIRouter

from app.graph.builder import build_user_graph, get_question_subgraph, serialize_graph
from app.schemas.graph import GraphResponse, SubgraphRequest
from app.services import user_service

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/{user_id}", response_model=GraphResponse)
def get_user_graph(user_id: str) -> dict:
    """Retrieve the full knowledge graph and topological analytics for a user."""
    user_service.user_exists(user_id)
    g, _ = build_user_graph(user_id)
    res = serialize_graph(g)
    res["active_concepts"] = []
    return res


@router.post("/subgraph", response_model=GraphResponse)
def get_subgraph(req: SubgraphRequest) -> dict:
    """Retrieve the question-conditioned active subnetwork for retrieved chunk IDs."""
    user_service.user_exists(req.user_id)
    return get_question_subgraph(req.user_id, req.chunk_ids)
