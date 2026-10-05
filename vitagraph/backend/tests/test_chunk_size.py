"""Tests for configurable chunk_size in report upload and chunking."""

from __future__ import annotations

import io
from fastapi.testclient import TestClient

from app.main import app
from app.services import report_service
from tests.conftest import make_user, sample_pdf

client = TestClient(app)


def test_chunk_size_default_unchanged():
    user1 = make_user("Default Chunker 1")
    user2 = make_user("Default Chunker 2")
    pdf_bytes = sample_pdf("synthetic_panel_2025-06-20.pdf")

    res_default = report_service.process_upload(user1["id"], "panel.pdf", pdf_bytes)
    res_explicit_none = report_service.process_upload(user2["id"], "panel.pdf", pdf_bytes, chunk_size=None)

    assert res_default["status"] == "ready"
    assert res_explicit_none["status"] == "ready"
    assert res_default["chunk_count"] == res_explicit_none["chunk_count"]


def test_smaller_chunk_size_gives_at_least_as_many_chunks():
    user_small = make_user("Small Chunk Persona")
    user_large = make_user("Large Chunk Persona")
    pdf_bytes = sample_pdf("synthetic_panel_2025-06-20.pdf")

    res_small = report_service.process_upload(user_small["id"], "small.pdf", pdf_bytes, chunk_size=120)
    res_large = report_service.process_upload(user_large["id"], "large.pdf", pdf_bytes, chunk_size=600)

    assert res_small["status"] == "ready"
    assert res_large["status"] == "ready"
    assert res_small["chunk_count"] >= res_large["chunk_count"]


def test_chunk_size_outside_bounds_refused():
    user = make_user("Bounds Check Persona")
    pdf_bytes = sample_pdf("synthetic_panel_2025-06-20.pdf")

    # Too small: 110 < 120
    resp_low = client.post(
        "/api/reports/upload",
        data={"user_id": user["id"], "chunk_size": 110, "background": "false"},
        files={"file": ("panel.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert resp_low.status_code == 422

    # Too large: 650 > 600
    resp_high = client.post(
        "/api/reports/upload",
        data={"user_id": user["id"], "chunk_size": 650, "background": "false"},
        files={"file": ("panel.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert resp_high.status_code == 422
