"""Tests for the one-click demo cohort endpoint (US-19)."""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_load_demo_cohort_creates_persona_and_builds_rich_graph():
    """Verify POST /api/demo/cohort ingests both synthetic panels and yields >= 25 nodes."""
    res = client.post("/api/demo/cohort")
    assert res.status_code == 201
    data = res.json()

    assert "user_id" in data
    assert "demo data" in data["display_label"]
    assert data["reports_ingested"] == 2
    assert len(data["report_ids"]) == 2
    assert data["nodes"] >= 25
    assert data["edges"] >= 25

    # Verify graph endpoint returns the same node count for this demo user
    uid = data["user_id"]
    graph_res = client.get(f"/api/graph/{uid}")
    assert graph_res.status_code == 200
    graph_data = graph_res.json()
    assert len(graph_data["nodes"]) == data["nodes"]
    assert len(graph_data["nodes"]) >= 25
