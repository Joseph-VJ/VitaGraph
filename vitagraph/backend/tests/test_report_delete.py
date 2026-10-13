"""Delete one report: DELETE /api/reports/{report_id}. Chats that cited it keep their words."""

from __future__ import annotations

import json
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import get_db
from app.graph import builder
from app.ingestion import uploader
from app.main import app
from app.rag import vector_store
from app.services import conversation_service, report_service, timeline_service
from tests.conftest import make_user, sample_pdf

client = TestClient(app)

JAN = "synthetic_panel_2025-01-15.pdf"
JUN = "synthetic_panel_2025-06-20.pdf"


def _delete(report_id: str, user_id: str | None):
    params = {} if user_id is None else {"user_id": user_id}
    return client.delete(f"/api/reports/{report_id}", params=params)


def _upload(user_id: str, name: str) -> str:
    result = report_service.process_upload(user_id, name, sample_pdf(name))
    assert result["status"] == "ready", result["error_message"]
    return result["id"]


def _count(sql: str, *args) -> int:
    with get_db() as db:
        return db.execute(sql, args).fetchone()[0]


def _vectors(report_id: str) -> int:
    return len(vector_store._collection().get(where={"report_id": {"$eq": report_id}})["ids"])


def _stored_file(report_id: str):
    return uploader.stored_file_path(uploader.get_report(report_id))


def test_delete_removes_the_report_its_text_its_passages_its_vectors_and_its_file():
    uid = make_user("Delete report persona")["id"]
    rid = _upload(uid, JAN)
    chunks = _count("SELECT COUNT(*) FROM report_chunks WHERE report_id = ?", rid)
    assert chunks > 0 and _vectors(rid) == chunks and _stored_file(rid) is not None
    assert f"rep_{rid}" in json.dumps(builder.serialize_user_graph(uid))
    path = _stored_file(rid)

    res = _delete(rid, uid)
    assert res.status_code == 200
    assert res.json() == {"deleted": rid, "filename": JAN, "chunks_removed": chunks}

    assert _count("SELECT COUNT(*) FROM reports WHERE id = ?", rid) == 0
    assert _count("SELECT COUNT(*) FROM report_pages WHERE report_id = ?", rid) == 0
    assert _count("SELECT COUNT(*) FROM report_chunks WHERE report_id = ?", rid) == 0
    assert _vectors(rid) == 0
    assert not path.exists()
    assert report_service.list_reports(uid) == []
    assert client.get("/api/reports", params={"user_id": uid}).json() == []
    assert rid not in json.dumps(builder.serialize_user_graph(uid))


def test_other_reports_of_the_same_persona_are_untouched():
    uid = make_user("Delete one of two persona")["id"]
    jan, jun = _upload(uid, JAN), _upload(uid, JUN)
    jun_chunks = _count("SELECT COUNT(*) FROM report_chunks WHERE report_id = ?", jun)
    jun_pages = _count("SELECT COUNT(*) FROM report_pages WHERE report_id = ?", jun)

    assert _delete(jan, uid).status_code == 200

    assert [r["id"] for r in report_service.list_reports(uid)] == [jun]
    assert _count("SELECT COUNT(*) FROM report_chunks WHERE report_id = ?", jun) == jun_chunks
    assert _count("SELECT COUNT(*) FROM report_pages WHERE report_id = ?", jun) == jun_pages
    assert _vectors(jun) == jun_chunks
    assert _stored_file(jun) is not None
    graph = json.dumps(builder.serialize_user_graph(uid))
    assert f"rep_{jun}" in graph and f"rep_{jan}" not in graph


def test_another_persona_cannot_delete_it():
    owner = make_user("Delete owner persona")["id"]
    other = make_user("Delete other persona")["id"]
    rid = _upload(owner, JAN)
    chunks = _count("SELECT COUNT(*) FROM report_chunks WHERE report_id = ?", rid)

    assert _delete(rid, other).status_code == 404

    assert _count("SELECT COUNT(*) FROM reports WHERE id = ?", rid) == 1
    assert _count("SELECT COUNT(*) FROM report_chunks WHERE report_id = ?", rid) == chunks
    assert _vectors(rid) == chunks and _stored_file(rid) is not None


@pytest.mark.parametrize("status", ["received", "extracting", "indexing"])
def test_a_report_that_is_still_being_read_cannot_be_deleted(status):
    uid = make_user(f"Delete busy persona {status}")["id"]
    rid = _upload(uid, JAN)
    chunks = _count("SELECT COUNT(*) FROM report_chunks WHERE report_id = ?", rid)
    uploader.set_status(rid, status)

    res = _delete(rid, uid)
    assert res.status_code == 409
    assert res.json()["detail"] == "This report is still being read."
    assert _count("SELECT COUNT(*) FROM reports WHERE id = ?", rid) == 1
    assert _vectors(rid) == chunks and _stored_file(rid) is not None

    uploader.set_status(rid, "ready")
    assert _delete(rid, uid).status_code == 200


def test_a_failed_report_can_be_deleted():
    uid = make_user("Delete failed persona")["id"]
    rid = _upload(uid, JAN)
    uploader.set_status(rid, "failed", error_message="The file could not be read.")
    assert _delete(rid, uid).status_code == 200
    assert _count("SELECT COUNT(*) FROM reports WHERE id = ?", rid) == 0


def test_deleting_still_works_when_the_stored_file_is_already_gone():
    uid = make_user("Delete missing file persona")["id"]
    rid = _upload(uid, JAN)
    _stored_file(rid).unlink()
    assert _delete(rid, uid).status_code == 200
    assert _count("SELECT COUNT(*) FROM reports WHERE id = ?", rid) == 0


def test_unknown_report_unknown_persona_missing_persona_and_a_second_delete():
    uid = make_user("Delete errors persona")["id"]
    rid = _upload(uid, JAN)
    assert _delete("rpt_does_not_exist", uid).status_code == 404
    assert _delete(rid, "usr_does_not_exist").status_code == 404
    assert _delete(rid, None).status_code == 422
    assert _delete(rid, uid).status_code == 200
    assert _delete(rid, uid).status_code == 404


def test_the_personas_ai_node_summaries_are_cleared_but_nobody_elses():
    uid = make_user("Delete summaries persona")["id"]
    other = make_user("Delete summaries other persona")["id"]
    rid = _upload(uid, JAN)
    with get_db() as db:
        for owner in (uid, other):
            db.execute(
                "INSERT INTO node_summaries (id, user_id, node_id, evidence_key, text, created_at) "
                "VALUES (?, ?, 'node_1', 'k', 'A summary.', '2026-10-11T10:00:00+00:00')",
                (f"ns_{uuid.uuid4().hex[:10]}", owner),
            )
    assert _delete(rid, uid).status_code == 200
    assert _count("SELECT COUNT(*) FROM node_summaries WHERE user_id = ?", uid) == 0
    assert _count("SELECT COUNT(*) FROM node_summaries WHERE user_id = ?", other) == 1


def test_a_report_deleted_event_is_recorded_and_shows_in_plain_words():
    uid = make_user("Delete event persona")["id"]
    rid = _upload(uid, JAN)
    assert _delete(rid, uid).status_code == 200

    events = [e for e in timeline_service.list_events(uid) if e["event_type"] == "report_deleted"]
    assert len(events) == 1 and events[0]["payload"] == {"report_id": rid, "filename": JAN}

    activity = client.get(f"/api/overview/{uid}").json()["activity"]
    deleted = next(a for a in activity if a["kind"] == "report_deleted")
    assert deleted["text"] == f"You deleted {JAN}." and deleted["report_id"] == rid
    # the earlier "added" and "was read" lines still name the file even though the row is gone
    assert f"You added {JAN}." in [a["text"] for a in activity]


def test_chats_that_cited_the_report_keep_their_words():
    uid = make_user("Delete chats persona")["id"]
    rid = _upload(uid, JAN)
    card = {"chunk_id": "c1", "report_id": rid, "report_filename": JAN, "page_number": 1, "snippet": "Vitamin D 18 ng/mL"}
    conversation_service.record_turn(
        uid,
        "conv_delete_keep",
        "What was my vitamin D?",
        {"summary_text": "It was 18 ng/mL.", "status": "answered", "ai_status": "ok", "evidence": [card]},
        [],
        {},
    )
    assert _delete(rid, uid).status_code == 200

    saved = conversation_service.get_conversation(uid, "conv_delete_keep")
    assert [m["content"] for m in saved["messages"]] == ["What was my vitamin D?", "It was 18 ng/mL."]
    body = client.get(f"/api/overview/{uid}").json()
    assert body["chats"][0]["reports_used"] == [{"id": rid, "filename": JAN, "deleted": True}]
    assert body["reports"] == [] and body["totals"]["reports"] == 0 and body["totals"]["chunks"] == 0


def test_the_file_download_is_gone_after_the_report_is():
    uid = make_user("Delete then download persona")["id"]
    rid = _upload(uid, JAN)
    assert client.get(f"/api/reports/{rid}/file", params={"user_id": uid}).status_code == 200
    assert _delete(rid, uid).status_code == 200
    assert client.get(f"/api/reports/{rid}/file", params={"user_id": uid}).status_code == 404
    assert not any((settings.uploads_dir / uid).glob(f"{rid}*"))
