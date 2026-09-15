"""Schemas for Knowledge Graph nodes, edges, analytics, and subgraph queries."""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    id: str
    label: str
    type: str  # report | test | measurement | chunk | category
    color: str
    r: float = 12.0
    betweenness: float = 0.0
    community: int = 0
    active: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str = "CONNECTED_TO"


class GraphMetrics(BaseModel):
    total_nodes: int
    total_edges: int
    communities_count: int
    modularity: float
    density: float


class GraphResponse(BaseModel):
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    metrics: GraphMetrics
    active_concepts: list[str] = Field(default_factory=list)


class SubgraphRequest(BaseModel):
    user_id: str
    chunk_ids: list[str]
