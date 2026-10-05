"""Tests for measured stage latencies (Task C7)."""

from __future__ import annotations

import time

from app.rag import vector_store
from app.services import report_service
from app.services.job_service import job_broker
from tests.conftest import make_user, sample_pdf


def _events(jid: str) -> list[dict]:
    return list(job_broker._jobs[jid]["events"])


def _stage_event(jid: str, stage_name: str) -> dict:
    for e in _events(jid):
        if e.get("stage") == stage_name:
            return e
    raise AssertionError(f"Stage {stage_name} not found in events for job {jid}")


def _parse_latency_ms(latency_str: str) -> int:
    assert latency_str.endswith(" ms"), f"Latency does not end with ' ms': {latency_str!r}"
    return int(latency_str[:-3])


def test_graphed_latency_is_measured(monkeypatch):
    orig_graph_payload = report_service._graph_payload

    def _slow_graph_payload(*args, **kwargs):
        time.sleep(0.030)
        return orig_graph_payload(*args, **kwargs)

    monkeypatch.setattr(report_service, "_graph_payload", _slow_graph_payload)

    user = make_user("Timing Persona Graphed")
    jid = "job_test_graphed_timing"
    res = report_service.process_upload(
        user["id"],
        "synthetic_panel_2025-01-15.pdf",
        sample_pdf("synthetic_panel_2025-01-15.pdf"),
        job_id=jid,
    )
    assert res["status"] == "ready", res.get("error_message")

    graphed_evt = _stage_event(jid, "graphed")
    lat = _parse_latency_ms(graphed_evt["latency"])
    assert lat >= 30, f"Expected graphed latency >= 30 ms, got {lat} ms"


def test_embedding_and_indexing_are_timed_separately(monkeypatch):
    orig_embed_texts = vector_store.embedder.embed_texts

    def _slow_embed_texts(*args, **kwargs):
        time.sleep(0.060)
        return orig_embed_texts(*args, **kwargs)

    monkeypatch.setattr(vector_store.embedder, "embed_texts", _slow_embed_texts)

    user = make_user("Timing Persona Separate")
    jid = "job_test_embed_index_timing"
    res = report_service.process_upload(
        user["id"],
        "synthetic_panel_2025-01-15.pdf",
        sample_pdf("synthetic_panel_2025-01-15.pdf"),
        job_id=jid,
    )
    assert res["status"] == "ready", res.get("error_message")

    embedded_evt = _stage_event(jid, "embedded")
    indexed_evt = _stage_event(jid, "indexed")

    assert embedded_evt["latency"].endswith(" ms")
    assert indexed_evt["latency"].endswith(" ms")

    embed_lat = _parse_latency_ms(embedded_evt["latency"])
    idx_lat = _parse_latency_ms(indexed_evt["latency"])

    assert embed_lat >= 60, f"Expected embedded latency >= 60 ms, got {embed_lat} ms"
    assert idx_lat < embed_lat, f"Expected indexed latency ({idx_lat} ms) < embedded latency ({embed_lat} ms)"
