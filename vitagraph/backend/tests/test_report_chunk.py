"""Tests for GET /api/reports/{report_id}/chunks/{chunk_id}."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app
from app.services import report_service
from tests.conftest import make_user, sample_pdf

client = TestClient(app)


def test_chunk_route_returns_the_stored_passage():
    user = make_user("Chunk user")
    res = report_service.process_upload(
        user["id"],
        "synthetic_panel_2025-01-15.pdf",
        sample_pdf("synthetic_panel_2025-01-15.pdf"),
    )
    assert res["status"] == "ready", res["error_message"]
    report_id = res["id"]

    with get_db() as db:
        row = db.execute(
            "SELECT id, text, char_start, char_end, page_number FROM report_chunks WHERE report_id = ? ORDER BY sequence LIMIT 1",
            (report_id,),
        ).fetchone()
    assert row is not None
    chunk_id = row["id"]

    resp = client.get(f"/api/reports/{report_id}/chunks/{chunk_id}?user_id={user['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["chunk_id"] == chunk_id
    assert data["report_id"] == report_id
    assert data["text"] == row["text"]
    assert data["char_end"] > data["char_start"]
    assert data["page_number"] >= 1


def test_chunk_route_refuses_a_chunk_of_another_report():
    user = make_user("Multi report user")
    res_a = report_service.process_upload(
        user["id"],
        "synthetic_panel_2025-01-15.pdf",
        sample_pdf("synthetic_panel_2025-01-15.pdf"),
    )
    res_b = report_service.process_upload(
        user["id"],
        "synthetic_panel_2025-06-20.pdf",
        sample_pdf("synthetic_panel_2025-06-20.pdf"),
    )
    assert res_a["status"] == "ready"
    assert res_b["status"] == "ready"
    report_id_a = res_a["id"]
    report_id_b = res_b["id"]

    with get_db() as db:
        row_b = db.execute(
            "SELECT id FROM report_chunks WHERE report_id = ? ORDER BY sequence LIMIT 1",
            (report_id_b,),
        ).fetchone()
    assert row_b is not None
    chunk_id_b = row_b["id"]

    # Asking for report A with a chunk ID of report B returns 404
    resp = client.get(f"/api/reports/{report_id_a}/chunks/{chunk_id_b}?user_id={user['id']}")
    assert resp.status_code == 404


def test_chunk_route_refuses_another_persona():
    user_a = make_user("Persona A")
    user_b = make_user("Persona B")
    res_a = report_service.process_upload(
        user_a["id"],
        "synthetic_panel_2025-01-15.pdf",
        sample_pdf("synthetic_panel_2025-01-15.pdf"),
    )
    assert res_a["status"] == "ready"
    report_id_a = res_a["id"]

    with get_db() as db:
        row_a = db.execute(
            "SELECT id FROM report_chunks WHERE report_id = ? ORDER BY sequence LIMIT 1",
            (report_id_a,),
        ).fetchone()
    assert row_a is not None
    chunk_id_a = row_a["id"]

    # Persona B asking for persona A's chunk with B's own user_id returns 404
    resp_b = client.get(f"/api/reports/{report_id_a}/chunks/{chunk_id_a}?user_id={user_b['id']}")
    assert resp_b.status_code == 404

    # A request without user_id returns 422
    resp_no_user = client.get(f"/api/reports/{report_id_a}/chunks/{chunk_id_a}")
    assert resp_no_user.status_code == 422
