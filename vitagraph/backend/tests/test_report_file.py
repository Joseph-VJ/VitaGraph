"""Download the original uploaded file: GET /api/reports/{report_id}/file."""

from __future__ import annotations

import hashlib

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.services import report_service
from tests.conftest import make_user, sample_pdf

client = TestClient(app)

JAN = "synthetic_panel_2025-01-15.pdf"


@pytest.fixture(scope="module")
def stored() -> dict:
    user = make_user("Original file persona")
    result = report_service.process_upload(user["id"], JAN, sample_pdf(JAN))
    assert result["status"] == "ready"
    return {"uid": user["id"], "rid": result["id"]}


def _get(report_id: str, user_id: str | None):
    params = {} if user_id is None else {"user_id": user_id}
    return client.get(f"/api/reports/{report_id}/file", params=params)


def test_the_download_is_the_original_file_byte_for_byte(stored):
    res = _get(stored["rid"], stored["uid"])
    assert res.status_code == 200
    assert res.content == sample_pdf(JAN)
    with get_db() as db:
        file_hash = db.execute("SELECT file_hash FROM reports WHERE id = ?", (stored["rid"],)).fetchone()["file_hash"]
    assert hashlib.sha256(res.content).hexdigest() == file_hash
    assert res.headers["content-type"].startswith("application/pdf")


def test_the_download_is_an_attachment_named_like_the_upload(stored):
    disposition = _get(stored["rid"], stored["uid"]).headers["content-disposition"]
    assert disposition.startswith("attachment")
    assert JAN in disposition


def test_a_file_name_with_non_ascii_letters_is_sent_safely():
    user = make_user("Original file unicode persona")
    result = report_service.process_upload(user["id"], "résumé panel.pdf", sample_pdf(JAN))
    assert result["status"] == "ready"
    res = _get(result["id"], user["id"])
    assert res.status_code == 200 and res.content == sample_pdf(JAN)
    disposition = res.headers["content-disposition"]
    assert disposition.startswith("attachment") and "r%C3%A9sum%C3%A9" in disposition
    assert "\n" not in disposition and "\r" not in disposition


def test_another_persona_gets_404_and_no_bytes(stored):
    other = make_user("Original file other persona")
    res = _get(stored["rid"], other["id"])
    assert res.status_code == 404
    assert b"%PDF" not in res.content


def test_unknown_report_and_unknown_persona_are_404(stored):
    assert _get("rpt_does_not_exist", stored["uid"]).status_code == 404
    assert _get(stored["rid"], "usr_does_not_exist").status_code == 404


def test_the_persona_is_required(stored):
    assert _get(stored["rid"], None).status_code == 422


def test_a_missing_stored_file_is_a_plain_404():
    user = make_user("Original file missing persona")
    result = report_service.process_upload(user["id"], JAN, sample_pdf(JAN))
    with get_db() as db:
        name = db.execute("SELECT stored_filename FROM reports WHERE id = ?", (result["id"],)).fetchone()["stored_filename"]
    (settings.uploads_dir / user["id"] / name).unlink()
    res = _get(result["id"], user["id"])
    assert res.status_code == 404
    assert res.json()["detail"] == "The original file is no longer stored."


def test_a_stored_name_that_points_outside_the_persona_folder_is_never_served(stored):
    secret = settings.uploads_dir / "outside_the_persona_folder.txt"
    secret.write_text("not yours", encoding="utf-8")
    try:
        with get_db() as db:
            original = db.execute("SELECT stored_filename FROM reports WHERE id = ?", (stored["rid"],)).fetchone()["stored_filename"]
            db.execute("UPDATE reports SET stored_filename = ? WHERE id = ?", ("../outside_the_persona_folder.txt", stored["rid"]))
        res = _get(stored["rid"], stored["uid"])
        assert res.status_code == 404 and b"not yours" not in res.content
    finally:
        with get_db() as db:
            db.execute("UPDATE reports SET stored_filename = ? WHERE id = ?", (original, stored["rid"]))
        secret.unlink()
    assert _get(stored["rid"], stored["uid"]).status_code == 200
