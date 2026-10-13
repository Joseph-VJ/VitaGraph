"""My Data overview: GET /api/overview/{user_id}.

A persona with two real sample reports, two chats (one cites a report, one is refused), two privacy-ledger rows
and one saved AI report. Every number is compared with a direct SQL count, and a second persona must see none of it.
"""

from __future__ import annotations

import json
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app
from app.privacy import ledger
from app.services import conversation_service, report_service, timeline_service
from tests.conftest import make_user, sample_pdf

client = TestClient(app)

JAN = "synthetic_panel_2025-01-15.pdf"
JUN = "synthetic_panel_2025-06-20.pdf"


def _overview(user_id: str) -> dict:
    res = client.get(f"/api/overview/{user_id}")
    assert res.status_code == 200, res.text
    return res.json()


def _scalar(sql: str, *args) -> int:
    with get_db() as db:
        return db.execute(sql, args).fetchone()[0]


def _turn(user_id: str, conversation_id: str, question: str, status: str, evidence: list[dict] | None = None) -> None:
    conversation_service.record_turn(
        user_id,
        conversation_id,
        question,
        {"summary_text": "An answer.", "status": status, "ai_status": "ok", "evidence": evidence or []},
        [],
        {},
    )


def _save_ai_report(user_id: str, conversation_id: str | None, title: str) -> str:
    artifact_id = f"art_{uuid.uuid4().hex[:12]}"
    with get_db() as db:
        db.execute(
            "INSERT INTO agent_artifacts (id, user_id, conversation_id, kind, title, language, content, data, created_at) "
            "VALUES (?, ?, ?, 'report', ?, 'html', '<p>x</p>', NULL, '2026-10-11T10:00:00+00:00')",
            (artifact_id, user_id, conversation_id, title),
        )
    return artifact_id


@pytest.fixture(scope="module")
def world() -> dict:
    user = make_user("Overview persona")
    uid = user["id"]
    jan = report_service.process_upload(uid, JAN, sample_pdf(JAN))
    jun = report_service.process_upload(uid, JUN, sample_pdf(JUN))
    assert jan["status"] == "ready" and jun["status"] == "ready"

    card = {"chunk_id": "c1", "report_id": jan["id"], "report_filename": JAN, "page_number": 1, "snippet": "x"}
    _turn(uid, "conv_overview_a", "What was my vitamin D in January?", "answered", [card, dict(card, chunk_id="c2")])
    _turn(uid, "conv_overview_a", "And my hemoglobin?", "answered", [card])
    _turn(uid, "conv_overview_b", "Should I take statins?", "refused")
    ledger.record(uid, "agent", 100, 80, 3, {"PERSON": 2, "ID": 1}, "## Person\nhi [PERSON_1]")
    ledger.record(uid, "agent", 50, 45, 1, {"PERSON": 1}, "## Person\nhello [PERSON_1]")
    art = _save_ai_report(uid, "conv_overview_a", "My vitamin D summary")
    return {"uid": uid, "jan": jan["id"], "jun": jun["id"], "art": art}


def test_an_unknown_persona_is_404():
    assert client.get("/api/overview/usr_does_not_exist").status_code == 404


def test_a_new_persona_has_an_empty_but_complete_overview():
    user = make_user("Empty overview persona")
    body = _overview(user["id"])
    assert body["persona"]["id"] == user["id"] and body["persona"]["consent_accepted"] is True
    assert body["persona"]["display_label"] == "Empty overview persona"
    assert body["totals"] == {
        "reports": 0, "reports_ready": 0, "pages": 0, "chunks": 0, "chats": 0, "questions": 0,
        "saved_reports": 0, "ai_messages_sent": 0, "details_hidden": 0,
    }
    assert body["reports"] == [] and body["chats"] == [] and body["saved_reports"] == []
    assert isinstance(body["allow_api"], bool)
    # Creating the persona and accepting the statement are the only things that happened.
    assert {a["kind"] for a in body["activity"]} == {"consent_accepted", "persona_created"}


def test_totals_equal_direct_sql_counts(world):
    uid = world["uid"]
    body = _overview(uid)
    totals = body["totals"]
    assert totals["reports"] == _scalar("SELECT COUNT(*) FROM reports WHERE user_id = ?", uid) == 2
    assert totals["reports_ready"] == _scalar("SELECT COUNT(*) FROM reports WHERE user_id = ? AND status = 'ready'", uid)
    assert totals["pages"] == _scalar(
        "SELECT COUNT(*) FROM report_pages WHERE report_id IN (SELECT id FROM reports WHERE user_id = ?)", uid
    )
    assert totals["chunks"] == _scalar("SELECT COUNT(*) FROM report_chunks WHERE user_id = ?", uid) > 0
    assert totals["chats"] == _scalar("SELECT COUNT(*) FROM agent_conversations WHERE user_id = ?", uid) == 2
    assert totals["questions"] == _scalar("SELECT COUNT(*) FROM agent_messages WHERE user_id = ? AND role = 'user'", uid) == 3
    assert totals["saved_reports"] == 1
    assert totals["ai_messages_sent"] == 2
    assert totals["details_hidden"] == 4


def test_each_report_row_has_its_page_and_passage_counts(world):
    uid = world["uid"]
    reports = {r["id"]: r for r in _overview(uid)["reports"]}
    assert set(reports) == {world["jan"], world["jun"]}
    for report_id, row in reports.items():
        assert row["chunk_count"] == _scalar("SELECT COUNT(*) FROM report_chunks WHERE report_id = ?", report_id) > 0
        pages = _scalar("SELECT COUNT(*) FROM report_pages WHERE report_id = ?", report_id)
        assert row["pages_typed"] + row["pages_scanned"] + row["pages_failed"] == pages == row["page_count"]
        assert row["pages_scanned"] == 0 and row["pages_failed"] == 0  # these two samples have a real text layer
        assert row["status"] == "ready" and row["error_message"] is None
        assert len(row["file_hash"]) == 64 and row["version"] == 1
    assert reports[world["jan"]]["original_filename"] == JAN
    # newest upload first
    ordered = [r["id"] for r in _overview(uid)["reports"]]
    assert ordered == [world["jun"], world["jan"]]


def test_scanned_failed_and_weak_pages_are_counted():
    user = make_user("Overview scanned pages persona")
    uid = user["id"]
    report_id = f"rpt_{uuid.uuid4().hex[:12]}"
    with get_db() as db:
        db.execute(
            "INSERT INTO reports (id, user_id, original_filename, stored_filename, file_hash, report_date, upload_time, "
            "version, status, page_count, error_message) VALUES (?, ?, 'scan.pdf', 'scan.pdf', ?, NULL, "
            "'2026-10-11T09:00:00+00:00', 1, 'ready', 4, NULL)",
            (report_id, uid, "a" * 64),
        )
        for number, (method, quality) in enumerate(
            [("native", "good"), ("ocr", "good"), ("ocr", "uncertain"), ("failed", "failed")], start=1
        ):
            db.execute(
                "INSERT INTO report_pages (id, report_id, page_number, extracted_text, extraction_method, text_length, quality) "
                "VALUES (?, ?, ?, 'text', ?, 4, ?)",
                (f"pg_{uuid.uuid4().hex[:10]}", report_id, number, method, quality),
            )
    row = _overview(uid)["reports"][0]
    assert (row["pages_typed"], row["pages_scanned"], row["pages_failed"], row["pages_weak"]) == (1, 2, 1, 1)
    assert row["chunk_count"] == 0 and row["chat_ids"] == []


def test_chats_show_counts_the_first_question_and_the_reports_they_used(world):
    body = _overview(world["uid"])
    chats = {c["id"]: c for c in body["chats"]}
    assert set(chats) == {"conv_overview_a", "conv_overview_b"}

    a = chats["conv_overview_a"]
    assert a["questions"] == 2 and a["answered"] == 2 and a["refused"] == 0 and a["message_count"] == 4
    assert a["first_question"] == "What was my vitamin D in January?"
    assert a["reports_used"] == [{"id": world["jan"], "filename": JAN, "deleted": False}]

    b = chats["conv_overview_b"]
    assert b["questions"] == 1 and b["refused"] == 1 and b["answered"] == 0
    assert b["reports_used"] == []

    # the report knows which chats used it, and the reverse
    jan_row = next(r for r in body["reports"] if r["id"] == world["jan"])
    jun_row = next(r for r in body["reports"] if r["id"] == world["jun"])
    assert jan_row["chat_ids"] == ["conv_overview_a"] and jun_row["chat_ids"] == []
    # newest chat first
    assert [c["id"] for c in body["chats"]] == sorted(chats, key=lambda c: chats[c]["updated_at"], reverse=True)


def test_a_chat_that_cited_a_report_that_is_gone_says_so():
    user = make_user("Overview gone report persona")
    uid = user["id"]
    card = {"chunk_id": "c9", "report_id": "rpt_gone00000001", "report_filename": "old_panel.pdf", "page_number": 1}
    _turn(uid, "conv_overview_gone", "Question?", "answered", [card])
    chat = _overview(uid)["chats"][0]
    assert chat["reports_used"] == [{"id": "rpt_gone00000001", "filename": "old_panel.pdf", "deleted": True}]


def test_saved_ai_reports_are_listed(world):
    saved = _overview(world["uid"])["saved_reports"]
    assert saved == [
        {
            "id": world["art"],
            "title": "My vitamin D summary",
            "created_at": "2026-10-11T10:00:00+00:00",
            "conversation_id": "conv_overview_a",
        }
    ]


def test_activity_is_written_in_plain_sentences_newest_first(world):
    activity = _overview(world["uid"])["activity"]
    texts = [a["text"] for a in activity]
    assert "You accepted the data-use statement." in texts
    assert f"You added {JAN}." in texts and f"You added {JUN}." in texts
    read = [t for t in texts if t.startswith(f"{JAN} was read and is ready: ")]
    assert len(read) == 1 and "page" in read[0] and "passage" in read[0]
    assert "You started a chat: What was my vitamin D in January?" in texts
    assert "An AI report was saved: My vitamin D summary" in texts
    stamps = [a["timestamp"] for a in activity]
    assert stamps == sorted(stamps, reverse=True)
    uploaded = next(a for a in activity if a["text"] == f"You added {JAN}.")
    assert uploaded["report_id"] == world["jan"] and uploaded["kind"] == "report_uploaded"
    chat = next(a for a in activity if a["kind"] == "chat_started" and a["conversation_id"] == "conv_overview_a")
    assert chat["report_id"] is None
    assert len(activity) <= 100


def test_failed_reports_and_asked_questions_have_plain_sentences():
    user = make_user("Overview sentences persona")
    uid = user["id"]
    timeline_service.add_event(uid, "report_uploaded", {"report_id": "rpt_x1", "filename": "broken.pdf", "version": 2, "duplicate_of_previous": True})
    timeline_service.add_event(uid, "processing_failed", {"report_id": "rpt_x1", "stage": "ingestion", "error": "The file could not be read."})
    timeline_service.add_event(uid, "question_asked", {"question_id": "q1", "status": "refused"})
    timeline_service.add_event(uid, "answer_generated", {"question_id": "q2", "evidence_count": 1})
    timeline_service.add_event(uid, "something_new", {})
    texts = {a["kind"]: a["text"] for a in _overview(uid)["activity"]}
    assert texts["report_uploaded"] == "You added broken.pdf again (version 2)."
    assert texts["processing_failed"] == "Reading broken.pdf failed: The file could not be read."
    assert texts["question_asked"] == "You asked a question and it was refused."
    assert texts["answer_generated"] == "An answer was written from 1 passage."
    assert texts["something_new"] == "Something new."


def test_another_persona_never_sees_these_records(world):
    other = make_user("Overview other persona")
    body = _overview(other["id"])
    dump = json.dumps(body)
    for secret in (world["jan"], world["jun"], world["art"], JAN, JUN, "conv_overview_a", "conv_overview_b", world["uid"]):
        assert secret not in dump
    assert body["totals"]["reports"] == 0 and body["totals"]["chats"] == 0 and body["totals"]["ai_messages_sent"] == 0
    # and the first persona's own overview is unchanged by the other one existing
    assert _overview(world["uid"])["totals"]["reports"] == 2
