"""Tests for the Knowledge Graph engine (Phase 1).

Covers medical entity extraction, graph construction, topological metrics
(centrality, modularity, communities), question subgraph activation, and
fail-closed user isolation.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.graph.builder import build_user_graph, get_question_subgraph, serialize_graph
from app.graph.extractor import extract_entities_from_chunk
from app.services import report_service
from tests.conftest import make_user, sample_pdf


def test_extract_entities_from_chunk_structured():
    sample_text = """
    Comprehensive Health Panel
    Hemoglobin
    Result: 13.8 g/dL
    Reference range: 12.0 - 15.5 g/dL

    Vitamin D, 25-Hydroxy
    Result: 18 ng/mL
    Reference range: 30 - 100 ng/mL
    Flag: LOW
    """
    entities = extract_entities_from_chunk(sample_text, chunk_id="chk_1", report_id="rep_1", page_number=1)
    assert len(entities) >= 2

    tests_found = {e["test_name"]: e for e in entities}
    assert "Hemoglobin" in tests_found
    assert tests_found["Hemoglobin"]["value"] == 13.8
    assert tests_found["Hemoglobin"]["unit"] == "g/dL"
    assert tests_found["Hemoglobin"]["flag"] == "NORMAL"

    assert "Vitamin D" in tests_found
    assert tests_found["Vitamin D"]["value"] == 18.0
    assert tests_found["Vitamin D"]["flag"] == "LOW"


def test_extract_entities_from_chunk_inline():
    sample_text = "Patient report: Hb 14.1 g/dL, Fasting Glucose 92 mg/dL, Total Cholesterol 198 mg/dL."
    entities = extract_entities_from_chunk(sample_text, chunk_id="chk_2", report_id="rep_2", page_number=1)
    tests_found = {e["test_name"]: e for e in entities}

    assert "Hemoglobin" in tests_found
    assert tests_found["Hemoglobin"]["value"] == 14.1

    assert "Fasting Glucose" in tests_found
    assert tests_found["Fasting Glucose"]["value"] == 92.0

    assert "Total Cholesterol" in tests_found
    assert tests_found["Total Cholesterol"]["value"] == 198.0


def test_build_user_graph_and_subgraph():
    user = make_user("Graph Test Persona")
    uid = user["id"]

    # Ingest a sample report
    pdf_bytes = sample_pdf("synthetic_panel_2025-01-15.pdf")
    status = report_service.process_upload(uid, "test_panel.pdf", pdf_bytes)
    assert status["status"] == "ready"

    # Build graph
    g, entities = build_user_graph(uid)
    assert len(g.nodes()) > 0
    assert len(g.edges()) > 0
    assert len(entities) > 0

    # Test serialization & metrics
    serialized = serialize_graph(g)
    assert len(serialized["nodes"]) == len(g.nodes())
    assert len(serialized["edges"]) == len(g.edges())
    assert serialized["metrics"]["total_nodes"] == len(g.nodes())
    assert serialized["metrics"]["total_edges"] == len(g.edges())
    assert "modularity" in serialized["metrics"]
    assert "density" in serialized["metrics"]

    # Node attributes
    node_types = {n["type"] for n in serialized["nodes"]}
    assert "report" in node_types
    assert "chunk" in node_types
    assert "test" in node_types
    assert "measurement" in node_types

    # Test question subgraph extraction
    chunk_nodes = [n["chunk_id"] for n in serialized["nodes"] if n["type"] == "chunk" and "chunk_id" in n]
    assert len(chunk_nodes) > 0

    sub = get_question_subgraph(uid, [chunk_nodes[0]])
    assert sub["metrics"]["total_nodes"] > 0
    assert len(sub["nodes"]) <= len(serialized["nodes"])


def test_graph_fail_closed_privacy():
    from app.routes.graph import get_user_graph, get_subgraph
    from app.schemas.graph import SubgraphRequest

    # Non-existent user must raise 404
    with pytest.raises(HTTPException) as exc:
        get_user_graph("nonexistent_user_id")
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        get_subgraph(SubgraphRequest(user_id="nonexistent_user_id", chunk_ids=["c1"]))
    assert exc.value.status_code == 404


def test_longitudinal_trend_calculation():
    user = make_user("Trend Test Persona")
    uid = user["id"]

    # Upload first report (Jan 2025: Hb 13.8)
    pdf_1 = sample_pdf("synthetic_panel_2025-01-15.pdf")
    status_1 = report_service.process_upload(uid, "panel_1.pdf", pdf_1)
    assert status_1["status"] == "ready"

    # Upload second report (June 2025: Hb 14.1)
    pdf_2 = sample_pdf("synthetic_panel_2025-06-20.pdf")
    status_2 = report_service.process_upload(uid, "panel_2.pdf", pdf_2)
    assert status_2["status"] == "ready"

    trend = report_service.get_user_trends(uid, test_name="Hemoglobin")
    assert trend["test_name"] == "Hemoglobin"
    assert len(trend["points"]) >= 2
    assert trend["trend_direction"] == "improving"
    assert trend["start_value"] == 13.8
    assert trend["latest_value"] == 14.1
    assert trend["unit"] == "g/dL"
