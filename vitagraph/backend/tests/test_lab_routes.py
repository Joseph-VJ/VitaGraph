"""RAG Lab routes: validation, busy/AI-off conflicts, active run, cancel, SSE replay, saved runs."""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.lab import gold, metrics, runner
from app.main import app


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c
    runner._active = None


def _sse_events(client: TestClient, run_id: str) -> list[dict]:
    out = []
    with client.stream("GET", f"/api/lab/runs/{run_id}/events") as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        for line in resp.iter_lines():
            if line.startswith("data: "):
                out.append(json.loads(line[6:]))
    return out


def _fake_execute(monkeypatch, *, hold: bool):
    """Replace the real run with a small stand-in so the route behaviour can be tested without ingesting."""

    async def fake(run):
        try:
            run.emit("setup", {"phase": "start", "run_id": run.id})
            if hold:
                await asyncio.sleep(60)
            run.emit("scorecard", {k: None for k in metrics.SCORECARD_KEYS})
            run.status = "finished"
        except asyncio.CancelledError:
            run.status = "stopped"
        finally:
            run.emit("run_finished", {"run_id": run.id, "ms": 1, "status": run.status})
            run.close()
            runner._active = None

    monkeypatch.setattr(runner, "_execute", fake)


def test_gold_route_lists_questions_and_files(client):
    data = client.get("/api/lab/gold").json()
    assert [q["id"] for q in data["questions"]] == [q["id"] for q in gold.questions()]
    assert {f["name"] for f in data["files"]} == set(gold.file_names())
    first = data["questions"][0]
    assert first["expect"] == "answer" and first["files"] == ["synthetic_panel_2025-01-15.pdf"]


@pytest.mark.parametrize("body", [
    {"mode": "turbo", "chunk_size": 200},
    {"mode": "quick", "chunk_size": 100},
    {"mode": "quick", "chunk_size": 610},
    {"mode": "quick", "chunk_size": 205},
    {"mode": "quick", "chunk_size": 200, "top_k": 0},
    {"mode": "quick", "chunk_size": 200, "top_k": 11},
])
def test_start_validates_the_body(client, body):
    assert client.post("/api/lab/runs", json=body).status_code == 422


def test_full_mode_with_ai_off_is_409(client, monkeypatch):
    monkeypatch.setattr(settings, "allow_api", False)
    resp = client.post("/api/lab/runs", json={"mode": "full", "chunk_size": 200})
    assert resp.status_code == 409 and "AI switched on" in resp.json()["detail"]
    assert client.get("/api/lab/active").json() == {"run_id": None}


def test_start_active_busy_and_cancel(client, monkeypatch):
    _fake_execute(monkeypatch, hold=True)
    resp = client.post("/api/lab/runs", json={"mode": "quick", "chunk_size": 200})
    assert resp.status_code == 202
    run_id = resp.json()["run_id"]
    assert client.get("/api/lab/active").json() == {"run_id": run_id}

    busy = client.post("/api/lab/runs", json={"mode": "quick", "chunk_size": 300})
    assert busy.status_code == 409 and "already running" in busy.json()["detail"]

    assert client.post(f"/api/lab/runs/{run_id}/cancel").json() == {"cancelled": True}
    events = _sse_events(client, run_id)  # follows until the run ends
    assert events[-1]["event_type"] == "run_finished" and events[-1]["metadata"]["status"] == "stopped"
    assert client.get("/api/lab/active").json() == {"run_id": None}
    assert client.post(f"/api/lab/runs/{run_id}/cancel").json() == {"cancelled": False}


def test_late_subscriber_replays_a_finished_run(client, monkeypatch):
    _fake_execute(monkeypatch, hold=False)
    run_id = client.post("/api/lab/runs", json={"mode": "quick", "chunk_size": 200, "top_k": 3}).json()["run_id"]
    first = _sse_events(client, run_id)
    second = _sse_events(client, run_id)
    assert [e["event_type"] for e in first] == ["setup", "scorecard", "run_finished"]
    assert [e["event_type"] for e in second] == [e["event_type"] for e in first]
    assert set(first[1]["metadata"]) == set(metrics.SCORECARD_KEYS)
    assert first[0]["event"] == "setup"  # same envelope as the other SSE routes


def test_unknown_run_is_404(client):
    assert client.get("/api/lab/runs/lab_nope/events").status_code == 404
    assert client.post("/api/lab/runs/lab_nope/cancel").status_code == 404
    assert client.get("/api/lab/runs/lab_nope").status_code == 404


def test_saved_runs_list_and_detail(client):
    runner._save_run(runner.LabRun("quick", 250, 4), "finished",
                     {k: None for k in metrics.SCORECARD_KEYS}, [{"id": "q01", "pass": True}], 1234)
    rows = client.get("/api/lab/runs?limit=3").json()
    assert 1 <= len(rows) <= 3
    row = next(r for r in rows if r["chunk_size"] == 250)
    assert set(row) == {"id", "created_at", "mode", "chunk_size", "top_k", "status", "duration_ms", "scorecard"}
    assert row["top_k"] == 4 and row["duration_ms"] == 1234
    detail = client.get(f"/api/lab/runs/{row['id']}").json()
    assert detail["results"] == [{"id": "q01", "pass": True}]
    assert set(detail["scorecard"]) == set(metrics.SCORECARD_KEYS)


def test_lab_persona_never_appears_in_the_users_route(client):
    from app.services import user_service

    lab = user_service.create_user("RAG Lab run (temporary)")
    user_service.mark_lab(lab["id"])
    try:
        assert lab["id"] not in [u["id"] for u in client.get("/api/users").json()]
    finally:
        user_service.delete_user(lab["id"])
