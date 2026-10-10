"""The serialized graph is cached per persona and rebuilt as soon as that persona's data changes."""

from __future__ import annotations

import threading

from fastapi.testclient import TestClient

from app.graph import builder
from app.main import app
from app.services import report_service, user_service
from tests.conftest import make_user, sample_pdf

client = TestClient(app)


def _count_serializations(monkeypatch) -> list[int]:
    calls: list[int] = []
    real = builder.serialize_graph

    def counting(g):
        calls.append(len(g))
        return real(g)

    monkeypatch.setattr(builder, "serialize_graph", counting)
    return calls


def test_second_request_is_served_from_the_cache_and_equal(monkeypatch):
    uid = make_user("Graph Cache Persona")["id"]
    report_service.process_upload(uid, "synthetic_panel_2025-01-15.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    builder.forget_user_graph(uid)
    calls = _count_serializations(monkeypatch)

    first = client.get(f"/api/graph/{uid}")
    second = client.get(f"/api/graph/{uid}")

    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert len(calls) == 1, "the graph was serialized more than once for unchanged data"


def test_new_report_invalidates_the_cache(monkeypatch):
    uid = make_user("Graph Cache Invalidate Persona")["id"]
    report_service.process_upload(uid, "synthetic_panel_2025-01-15.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    builder.forget_user_graph(uid)
    before = client.get(f"/api/graph/{uid}").json()

    report_service.process_upload(uid, "synthetic_panel_2025-06-20.pdf", sample_pdf("synthetic_panel_2025-06-20.pdf"))
    after = client.get(f"/api/graph/{uid}").json()

    assert after["metrics"]["total_nodes"] > before["metrics"]["total_nodes"]
    assert any(n["type"] == "report" and "2025-06-20" in n["label"] for n in after["nodes"])


def test_cache_is_per_persona(monkeypatch):
    a = make_user("Graph Cache A")["id"]
    b = make_user("Graph Cache B")["id"]
    report_service.process_upload(a, "synthetic_panel_2025-01-15.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    builder.forget_user_graph(a)
    builder.forget_user_graph(b)

    graph_a = client.get(f"/api/graph/{a}").json()
    graph_b = client.get(f"/api/graph/{b}").json()

    assert graph_a["metrics"]["total_nodes"] > 0
    assert graph_b["metrics"]["total_nodes"] == 0


def test_deleting_a_persona_drops_its_cached_graph():
    uid = make_user("Graph Cache Delete Persona")["id"]
    report_service.process_upload(uid, "synthetic_panel_2025-01-15.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    client.get(f"/api/graph/{uid}")
    assert uid in builder._serialized_cache

    user_service.delete_user(uid)

    assert uid not in builder._serialized_cache


def test_parallel_first_requests_compute_once(monkeypatch):
    uid = make_user("Graph Cache Parallel Persona")["id"]
    report_service.process_upload(uid, "synthetic_panel_2025-01-15.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    builder.forget_user_graph(uid)
    calls = _count_serializations(monkeypatch)

    results: list[dict] = []

    def fetch() -> None:
        results.append(builder.serialize_user_graph(uid))

    threads = [threading.Thread(target=fetch) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(results) == 4
    assert len(calls) == 1, "parallel first requests should share one computation"


def test_cached_result_is_not_poisoned_by_callers():
    uid = make_user("Graph Cache Copy Persona")["id"]
    report_service.process_upload(uid, "synthetic_panel_2025-01-15.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    builder.forget_user_graph(uid)

    first = builder.serialize_user_graph(uid)
    first["active_concepts"] = ["added by a caller"]
    second = builder.serialize_user_graph(uid)

    assert "active_concepts" not in second
