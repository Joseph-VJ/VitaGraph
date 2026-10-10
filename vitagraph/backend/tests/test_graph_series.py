"""Tests for GET /api/graph/{user_id}/series endpoint and series_service."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app
from app.services import report_service, series_service
from tests.conftest import make_user, sample_pdf

client = TestClient(app)


def test_series_two_sample_pdfs_order_and_hemoglobin_ranges():
    """(a) Two sample PDFs: reports in order Jan then Jun, Hemoglobin points 13.8 then 14.1
    with range_text '12.0 - 15.5 g/dL' for BOTH (the June one extracted from text)."""
    series_service.clear_cache()
    u = make_user("Series Two PDF Persona")
    uid = u["id"]

    r1 = report_service.process_upload(uid, "synthetic_panel_2025-01-15.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    r2 = report_service.process_upload(uid, "synthetic_panel_2025-06-20.pdf", sample_pdf("synthetic_panel_2025-06-20.pdf"))

    res = client.get(f"/api/graph/{uid}/series")
    assert res.status_code == 200
    data = res.json()

    # Reports in order Jan (0) then Jun (1)
    reports = data["reports"]
    assert len(reports) == 2
    assert reports[0]["report_id"] == r1["id"]
    assert reports[0]["order"] == 0
    assert reports[0]["date"] == "15 January 2025"
    assert reports[0]["date_iso"] == "2025-01-15"

    assert reports[1]["report_id"] == r2["id"]
    assert reports[1]["order"] == 1
    assert reports[1]["date"] == "20 June 2025"
    assert reports[1]["date_iso"] == "2025-06-20"

    # Hemoglobin test
    hb_test = next((t for t in data["tests"] if t["node_id"] == "test_Hemoglobin"), None)
    assert hb_test is not None
    assert hb_test["name"] == "Hemoglobin"
    assert hb_test["unit"] == "g/dL"
    assert len(hb_test["points"]) == 2

    # Point 1 (Jan 2025)
    p0 = hb_test["points"][0]
    assert p0["report_id"] == r1["id"]
    assert p0["order"] == 0
    assert p0["value"] == 13.8
    assert p0["date"] == "15 January 2025"
    assert p0["range_text"] == "12.0 - 15.5 g/dL"
    assert p0["range_low"] == 12.0
    assert p0["range_high"] == 15.5

    # Point 2 (Jun 2025) - range extracted from page text
    p1 = hb_test["points"][1]
    assert p1["report_id"] == r2["id"]
    assert p1["order"] == 1
    assert p1["value"] == 14.1
    assert p1["date"] == "20 June 2025"
    assert p1["range_text"] == "12.0 - 15.5 g/dL"
    assert p1["range_low"] == 12.0
    assert p1["range_high"] == 15.5


def test_series_scanned_sample_is_undated_and_comes_last():
    """(b) The scanned sample is undated and comes LAST."""
    series_service.clear_cache()
    u = make_user("Series Scanned Persona")
    uid = u["id"]

    r_dated = report_service.process_upload(uid, "synthetic_panel_2025-01-15.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    r_scan = report_service.process_upload(uid, "VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf", sample_pdf("VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf"))

    res = client.get(f"/api/graph/{uid}/series")
    assert res.status_code == 200
    data = res.json()

    reports = data["reports"]
    assert len(reports) == 2
    assert reports[0]["report_id"] == r_dated["id"]
    assert reports[0]["order"] == 0
    assert reports[0]["date"] == "15 January 2025"

    assert reports[1]["report_id"] == r_scan["id"]
    assert reports[1]["order"] == 1
    assert reports[1]["date"] is None
    assert reports[1]["date_iso"] is None


def test_series_value_without_printed_range_has_null_range_fields():
    """(c) A value without a printed range has null range fields."""
    series_service.clear_cache()
    u = make_user("Series No Range Persona")
    uid = u["id"]

    report_service.process_upload(uid, "VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf", sample_pdf("VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf"))

    res = client.get(f"/api/graph/{uid}/series")
    assert res.status_code == 200
    data = res.json()

    # Weight measurement has no printed range in the scanned report
    weight_test = next((t for t in data["tests"] if "weight" in t["name"].lower()), None)
    assert weight_test is not None
    assert len(weight_test["points"]) >= 1
    pt = weight_test["points"][0]
    assert pt["range_text"] is None
    assert pt["range_low"] is None
    assert pt["range_high"] is None


def test_series_node_id_equals_test_node_in_graph():
    """(d) node_id of every test equals the id of a test node in GET /api/graph/{uid}."""
    series_service.clear_cache()
    u = make_user("Series Graph Matching Persona")
    uid = u["id"]

    report_service.process_upload(uid, "synthetic_panel_2025-01-15.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    report_service.process_upload(uid, "synthetic_panel_2025-06-20.pdf", sample_pdf("synthetic_panel_2025-06-20.pdf"))

    series_res = client.get(f"/api/graph/{uid}/series")
    assert series_res.status_code == 200
    series_data = series_res.json()

    graph_res = client.get(f"/api/graph/{uid}")
    assert graph_res.status_code == 200
    graph_data = graph_res.json()

    graph_test_node_ids = {n["id"] for n in graph_data["nodes"] if n.get("type") == "test"}

    for t in series_data["tests"]:
        assert t["node_id"] in graph_test_node_ids, f"{t['node_id']} not in graph test nodes {graph_test_node_ids}"


def test_series_isolation_between_personas():
    """(e) Another persona's data never appears."""
    series_service.clear_cache()
    u1 = make_user("Persona 1")
    u2 = make_user("Persona 2")

    r1 = report_service.process_upload(u1["id"], "synthetic_panel_2025-01-15.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    r2 = report_service.process_upload(u2["id"], "synthetic_panel_2025-06-20.pdf", sample_pdf("synthetic_panel_2025-06-20.pdf"))

    res1 = client.get(f"/api/graph/{u1['id']}/series").json()
    res2 = client.get(f"/api/graph/{u2['id']}/series").json()

    r1_ids = {r["report_id"] for r in res1["reports"]}
    r2_ids = {r["report_id"] for r in res2["reports"]}

    assert r1["id"] in r1_ids and r2["id"] not in r1_ids
    assert r2["id"] in r2_ids and r1["id"] not in r2_ids


def test_series_unknown_user_404_and_empty_persona():
    """(f) Unknown user 404; empty persona returns empty lists."""
    res_404 = client.get("/api/graph/usr_doesnotexist/series")
    assert res_404.status_code == 404

    u_empty = make_user("Empty Persona")
    res_empty = client.get(f"/api/graph/{u_empty['id']}/series")
    assert res_empty.status_code == 200
    assert res_empty.json() == {"reports": [], "tests": []}


def test_series_cache_returns_same_content():
    """(g) The cache returns the same content on a second call."""
    series_service.clear_cache()
    u = make_user("Cache Test Persona")
    uid = u["id"]

    report_service.process_upload(uid, "synthetic_panel_2025-01-15.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))

    res_first = client.get(f"/api/graph/{uid}/series").json()
    res_second = client.get(f"/api/graph/{uid}/series").json()

    assert res_first == res_second


def test_series_chronological_reorder_after_report_date_update():
    """(h) After UPDATE reports SET report_date = ... to 02 October 2025 and 20 June 2025
    the order is June then October."""
    series_service.clear_cache()
    u = make_user("Date Update Persona")
    uid = u["id"]

    r1 = report_service.process_upload(uid, "synthetic_panel_2025-01-15.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    r2 = report_service.process_upload(uid, "synthetic_panel_2025-06-20.pdf", sample_pdf("synthetic_panel_2025-06-20.pdf"))

    # Update r1 to 02 October 2025 and r2 to 20 June 2025
    with get_db() as db:
        db.execute("UPDATE reports SET report_date = ? WHERE id = ?", ("02 October 2025", r1["id"]))
        db.execute("UPDATE reports SET report_date = ? WHERE id = ?", ("20 June 2025", r2["id"]))

    res = client.get(f"/api/graph/{uid}/series")
    assert res.status_code == 200
    data = res.json()

    reports = data["reports"]
    assert len(reports) == 2
    # Order should now be June (r2) then October (r1)
    assert reports[0]["report_id"] == r2["id"]
    assert reports[0]["order"] == 0
    assert reports[0]["date"] == "20 June 2025"
    assert reports[0]["date_iso"] == "2025-06-20"

    assert reports[1]["report_id"] == r1["id"]
    assert reports[1]["order"] == 1
    assert reports[1]["date"] == "02 October 2025"
    assert reports[1]["date_iso"] == "2025-10-02"

    # In tests, points for Hemoglobin should also follow June (order 0) then October (order 1)
    hb_test = next((t for t in data["tests"] if t["node_id"] == "test_Hemoglobin"), None)
    assert hb_test is not None
    assert len(hb_test["points"]) == 2
    assert hb_test["points"][0]["report_id"] == r2["id"]
    assert hb_test["points"][0]["order"] == 0
    assert hb_test["points"][0]["date"] == "20 June 2025"
    assert hb_test["points"][1]["report_id"] == r1["id"]
    assert hb_test["points"][1]["order"] == 1
    assert hb_test["points"][1]["date"] == "02 October 2025"


def test_series_indexing_not_cached_then_ready_and_chunk_refresh():
    """(1) a report row with status 'indexing' and no chunks is listed but gives no points
    and is NOT cached; after chunks and 'ready' status are inserted, the next call returns its points;
    (2) the same report cached while ready is returned unchanged on a second call;
    (3) adding chunks to a cached report changes the key and refreshes it."""
    series_service.clear_cache()
    u = make_user("Cache Lifecycle Persona")
    uid = u["id"]
    report_id = "rpt_cache_lifecycle_1"

    # Insert report row with status 'indexing' and no chunks
    with get_db() as db:
        db.execute(
            """
            INSERT INTO reports (id, user_id, original_filename, stored_filename, file_hash,
                                report_date, upload_time, version, status, page_count, error_message)
            VALUES (?, ?, 'report_indexing.pdf', 'stored.pdf', 'fakehash1',
                    '15 January 2025', '2025-01-15T10:00:00Z', 1, 'indexing', 1, NULL)
            """,
            (report_id, uid),
        )

    # 1. Call while indexing: listed in reports, no points, NOT cached
    res1 = client.get(f"/api/graph/{uid}/series")
    assert res1.status_code == 200
    data1 = res1.json()
    assert len(data1["reports"]) == 1
    assert data1["reports"][0]["report_id"] == report_id
    assert data1["reports"][0]["date"] == "15 January 2025"
    assert len(data1["tests"]) == 0
    # Verify NOT in cache
    assert not any(k[0] == report_id for k in series_service._MEASUREMENTS_CACHE.keys())

    # After chunks and 'ready' status are inserted, the next call returns its points
    chunk_text_1 = "Hemoglobin: 14.1 g/dL (Reference Range: 12.0 - 15.5 g/dL)"
    with get_db() as db:
        db.execute(
            """
            INSERT INTO report_pages (id, report_id, page_number, extracted_text, extraction_method, text_length, quality)
            VALUES (?, ?, 1, ?, 'native', ?, 'good')
            """,
            ("page_c1", report_id, chunk_text_1, len(chunk_text_1)),
        )
        db.execute(
            """
            INSERT INTO report_chunks (id, user_id, report_id, page_id, page_number, sequence, text, char_start, char_end, section, metadata)
            VALUES (?, ?, ?, 'page_c1', 1, 0, ?, 0, ?, 'CBC', '{}')
            """,
            ("chk_c1", uid, report_id, chunk_text_1, len(chunk_text_1)),
        )
        db.execute("UPDATE reports SET status = 'ready' WHERE id = ?", (report_id,))

    res2 = client.get(f"/api/graph/{uid}/series")
    assert res2.status_code == 200
    data2 = res2.json()
    assert len(data2["reports"]) == 1
    hb2 = next((t for t in data2["tests"] if t["node_id"] == "test_Hemoglobin"), None)
    assert hb2 is not None
    assert len(hb2["points"]) == 1
    assert hb2["points"][0]["value"] == 14.1
    # Verify it is now cached under (report_id, 1)
    assert (report_id, 1) in series_service._MEASUREMENTS_CACHE

    # (2) The same report cached while ready is returned unchanged on a second call
    res3 = client.get(f"/api/graph/{uid}/series")
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3 == data2

    # (3) Adding chunks to a cached report changes the key and refreshes it
    chunk_text_2 = "Glucose: 95 mg/dL (Reference Range: 70 - 99 mg/dL)"
    with get_db() as db:
        db.execute(
            """
            INSERT INTO report_chunks (id, user_id, report_id, page_id, page_number, sequence, text, char_start, char_end, section, metadata)
            VALUES (?, ?, ?, 'page_c1', 1, 1, ?, 0, ?, 'Metabolic', '{}')
            """,
            ("chk_c2", uid, report_id, chunk_text_2, len(chunk_text_2)),
        )

    res4 = client.get(f"/api/graph/{uid}/series")
    assert res4.status_code == 200
    data4 = res4.json()
    test_names = {t["name"] for t in data4["tests"]}
    assert "Hemoglobin" in test_names
    assert "Glucose" in test_names
    assert (report_id, 2) in series_service._MEASUREMENTS_CACHE


def test_series_failed_report_is_cached():
    """Verify that a failed report is cached and yields no points."""
    series_service.clear_cache()
    u = make_user("Failed Report Persona")
    uid = u["id"]
    report_id = "rpt_failed_1"

    with get_db() as db:
        db.execute(
            """
            INSERT INTO reports (id, user_id, original_filename, stored_filename, file_hash,
                                report_date, upload_time, version, status, page_count, error_message)
            VALUES (?, ?, 'bad.pdf', 'bad.pdf', 'hashfail',
                    '01 January 2025', '2025-01-01T00:00:00Z', 1, 'failed', 0, 'corrupt file')
            """,
            (report_id, uid),
        )

    res = client.get(f"/api/graph/{uid}/series")
    assert res.status_code == 200
    data = res.json()
    assert len(data["reports"]) == 1
    assert len(data["tests"]) == 0
    assert (report_id, 0) in series_service._MEASUREMENTS_CACHE

