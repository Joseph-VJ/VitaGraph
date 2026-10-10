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


class NodeSummaryRequest(BaseModel):
    user_id: str
    node_id: str
    refresh: bool = False  # "Write again": ignore the cache


class SeriesReportItem(BaseModel):
    report_id: str
    filename: str
    date: str | None = None
    date_iso: str | None = None
    order: int


class SeriesPointItem(BaseModel):
    report_id: str
    order: int
    date: str | None = None
    value: float
    flag: str = "NORMAL"
    range_text: str | None = None
    range_low: float | None = None
    range_high: float | None = None
    page_number: int
    chunk_id: str | None = None
    char_start: int | None = None
    char_end: int | None = None


class SeriesTestItem(BaseModel):
    node_id: str
    name: str
    unit: str = ""
    category: str = "General"
    points: list[SeriesPointItem] = Field(default_factory=list)


class SeriesOut(BaseModel):
    reports: list[SeriesReportItem] = Field(default_factory=list)
    tests: list[SeriesTestItem] = Field(default_factory=list)

