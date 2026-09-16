"""Tests for US-17: Graph richness guarantee (plan §11 ontology).

Verifies:
1. Builder emits report + per-page chunk + section + date nodes plus entities.
2. Edges are restricted to: CONTAINS, MENTIONS, HAS_MEASUREMENT, BELONGS_TO, OBSERVED_ON, IN_SECTION.
3. entities == 0 still yields section/chunk/date/Uncertainty structure with >= 6 nodes.
4. Synthetic panel graph yields >= 25 nodes and >= 3 communities.
5. Two different questions produce different active concepts / subgraphs.
"""

from __future__ import annotations

import networkx as nx
import pytest

from app.core.database import get_db
from app.graph.builder import (
    NODE_COLORS,
    _detect_section,
    build_user_graph,
    get_question_subgraph,
    serialize_graph,
)
from app.services import report_service, user_service
from tests.conftest import make_user, sample_pdf


ALLOWED_EDGES = {
    "CONTAINS",
    "MENTIONS",
    "HAS_MEASUREMENT",
    "BELONGS_TO",
    "OBSERVED_ON",
    "IN_SECTION",
}


def test_us17_plan11_ontology_node_and_edge_types():
    user = make_user("US17 Ontology Persona")
    uid = user["id"]

    # Ingest synthetic panel
    pdf_bytes = sample_pdf("synthetic_panel_2025-01-15.pdf")
    status = report_service.process_upload(uid, "panel_jan2025.pdf", pdf_bytes)
    assert status["status"] == "ready"

    g, entities = build_user_graph(uid)
    serialized = serialize_graph(g)

    # 1. Verify node richness: >= 25 nodes
    assert serialized["metrics"]["total_nodes"] >= 25, f"Expected >= 25 nodes, got {len(g.nodes())}"

    # 2. Verify communities count >= 3
    assert serialized["metrics"]["communities_count"] >= 3, f"Expected >= 3 communities, got {serialized['metrics']['communities_count']}"

    # 3. Verify node types include plan §11 types
    node_types = {n["type"] for n in serialized["nodes"]}
    assert "report" in node_types
    assert "chunk" in node_types
    assert "section" in node_types
    assert "date" in node_types
    assert "test" in node_types
    assert "measurement" in node_types
    assert "person" in node_types

    # 4. Verify edges strictly conform to plan §11 allowed relations
    edge_relations = {e["relation"] for e in serialized["edges"]}
    assert edge_relations.issubset(ALLOWED_EDGES), f"Unexpected edges: {edge_relations - ALLOWED_EDGES}"
    assert "CONTAINS" in edge_relations
    assert "MENTIONS" in edge_relations
    assert "HAS_MEASUREMENT" in edge_relations
    assert "OBSERVED_ON" in edge_relations
    assert "IN_SECTION" in edge_relations


def test_us17_zero_entities_uncertainty_structure():
    """When a report has 0 extracted entities, it still guarantees section/chunk/date/Uncertainty structure >= 6 nodes."""
    user = make_user("US17 Zero Entities Persona")
    uid = user["id"]

    # Insert a dummy report, page, and chunk with no parseable biomarker text
    with get_db() as db:
        rep_id = "rpt_zero_ent_001"
        page_id = "pg_zero_ent_001"
        db.execute(
            """INSERT INTO reports (id, user_id, original_filename, stored_filename, file_hash, report_date, upload_time, version, status, page_count)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'ready', 1)""",
            (rep_id, uid, "unparseable_scan.pdf", "unparseable_scan.pdf", "hash_zero_001", "2024-11-15", "2024-11-15T10:00:00Z"),
        )
        db.execute(
            """INSERT INTO report_pages (id, report_id, page_number, extracted_text, extraction_method, text_length, quality)
               VALUES (?, ?, 1, 'Generic footer information without laboratory values or test units.', 'ocr-rapid', 70, 'uncertain')""",
            (page_id, rep_id),
        )
        db.execute(
            """INSERT INTO report_chunks (id, user_id, report_id, page_id, page_number, sequence, text, char_start, char_end, section, metadata)
               VALUES (?, ?, ?, ?, 1, 0, 'Generic footer information without laboratory values or test units.', 0, 70, 'Clinical Findings', '{}')""",
            ("chk_zero_001", uid, rep_id, page_id),
        )

    g, entities = build_user_graph(uid)
    assert len(entities) == 0, "Expected 0 extracted entities for unparseable chunk"

    serialized = serialize_graph(g)
    # Must yield >= 6 nodes: person + report + date + chunk + section + uncertainty
    assert serialized["metrics"]["total_nodes"] >= 6, f"Expected >= 6 nodes, got {serialized['metrics']['total_nodes']}"

    node_types = {n["type"] for n in serialized["nodes"]}
    assert "person" in node_types
    assert "report" in node_types
    assert "chunk" in node_types
    assert "section" in node_types
    assert "date" in node_types
    assert "uncertainty" in node_types

    edge_relations = {e["relation"] for e in serialized["edges"]}
    assert edge_relations.issubset(ALLOWED_EDGES)
    assert "IN_SECTION" in edge_relations
    assert "OBSERVED_ON" in edge_relations


def test_us17_two_questions_different_active_subgraphs():
    """Verify that two distinct clinical questions produce different active concepts and subgraphs."""
    user = make_user("US17 MultiQuestion Persona")
    uid = user["id"]

    # Ingest panel containing both Hemoglobin and Glucose/Cholesterol
    pdf_bytes = sample_pdf("synthetic_panel_2025-01-15.pdf")
    status = report_service.process_upload(uid, "multi_panel.pdf", pdf_bytes)
    assert status["status"] == "ready"

    # Find chunk ids for the report
    with get_db() as db:
        chunks = db.execute("SELECT id, text FROM report_chunks WHERE user_id = ?", (uid,)).fetchall()

    # Find chunk containing Hemoglobin vs chunk containing Cholesterol/Glucose
    hb_chunks = [c["id"] for c in chunks if "hemoglobin" in c["text"].lower()]
    lipid_chunks = [c["id"] for c in chunks if "cholesterol" in c["text"].lower()]

    assert len(hb_chunks) > 0
    assert len(lipid_chunks) > 0

    sub_hb = get_question_subgraph(uid, [hb_chunks[0]])
    sub_lipid = get_question_subgraph(uid, [lipid_chunks[0]])

    assert len(sub_hb["nodes"]) > 0
    assert len(sub_lipid["nodes"]) > 0

    # Concepts should be different
    assert "Hemoglobin" in sub_hb["active_concepts"]
    assert "Hemoglobin" not in sub_lipid["active_concepts"]

    # Active concept sets are distinct
    assert sub_hb["active_concepts"] != sub_lipid["active_concepts"]
