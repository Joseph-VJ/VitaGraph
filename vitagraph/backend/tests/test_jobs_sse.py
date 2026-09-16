"""Unit and integration tests for plan Section 12 SSE Job Stream."""

from __future__ import annotations

import json
from fastapi.testclient import TestClient

from app.main import app
from app.services.job_service import job_broker


client = TestClient(app)


def test_job_sse_stream_format():
    """Test that /api/jobs/{id}/events returns text/event-stream with proper SSE format."""
    job_id = "test_sse_format"
    job_broker.get_or_create_job(job_id)

    # Publish an event before streaming
    job_broker.publish_event(
        job_id,
        stage="retrieval",
        description="Retrieving relevant chunks",
        sub_description="top_k=20",
        latency_ms=45,
    )
    job_broker.complete_job(job_id, description="Done test")

    # Stream the events
    response = client.get(f"/api/jobs/{job_id}/events")
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert response.headers["cache-control"] == "no-cache"

    content = response.text
    assert ": connected to pipeline stream" in content
    assert "data: " in content

    # Parse streamed lines
    lines = [line for line in content.split("\n") if line.startswith("data: ")]
    assert len(lines) >= 2

    evt1 = json.loads(lines[0][6:])
    assert evt1["stage"] == "retrieval"
    assert evt1["description"] == "Retrieving relevant chunks"
    assert "45 ms" in evt1["latency"]

    evt2 = json.loads(lines[1][6:])
    assert evt2["stage"] == "done"


from tests.conftest import make_user


def test_question_flow_emits_real_sse_events():
    """Test that asking a question through /api/questions populates real plan Section 12 events."""
    user = make_user("SSE Flow Persona")
    uid = user["id"]
    job_id = "test_q_flow_job"

    res = client.post(
        "/api/questions",
        json={
            "user_id": uid,
            "text": "What was my hemoglobin level?",
            "job_id": job_id,
        },
    )
    assert res.status_code == 200
    ans = res.json()
    assert ans["job_id"] == job_id
    assert ans["status"] in ("answered", "insufficient_evidence")

    # Check the recorded job status and event stages
    status_res = client.get(f"/api/jobs/{job_id}")
    assert status_res.status_code == 200
    job_data = status_res.json()
    assert job_data["status"] == "completed"

    stages = [evt["stage"] for evt in job_data["events"]]
    # Must contain real plan Section 12 stages
    assert "retrieval" in stages
    assert "done" in stages
    if ans["status"] == "answered":
        assert "reranking" in stages
        assert "graph" in stages
        assert "generation" in stages
        assert "safety" in stages
        assert "citation" in stages


def test_boundary_question_refusal_emits_safety_sse():
    """Test that boundary question refusal emits safety gate event and terminal done."""
    user = make_user("Boundary Test Persona")
    uid = user["id"]
    job_id = "test_q_refuse_job"

    res = client.post(
        "/api/questions",
        json={
            "user_id": uid,
            "text": "Should I stop taking my metformin immediately?",
            "job_id": job_id,
        },
    )
    assert res.status_code == 200
    ans = res.json()
    assert ans["status"] == "refused"

    status_res = client.get(f"/api/jobs/{job_id}")
    assert status_res.status_code == 200
    job_data = status_res.json()
    assert job_data["status"] == "completed"

    stages = [evt["stage"] for evt in job_data["events"]]
    assert "safety" in stages
    assert "done" in stages
