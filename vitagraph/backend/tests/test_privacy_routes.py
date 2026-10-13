"""Privacy Shield HTTP routes."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app
from app.privacy import ledger, shield
from tests.conftest import make_user
from tests.test_responses_adapter import responses_mode  # noqa: F401  (fixture re-used)

client = TestClient(app)
TEXT = "Patient: Kiruthika R\nPhone: 98765 43210\nEmail: kiruthika@example.com\nResult: 13.8 g/dL"


@pytest.fixture
def uid() -> str:
    return make_user("privacy routes")["id"]


def add_rows(user_id: str, count: int = 3) -> list[str]:
    return [ledger.record(user_id, "agent", 50, 40, 1, {"PERSON": 1}, f"## Person\nhello [PERSON_1] {i}") for i in range(count)]


# ----------------------------------------------------------------- summary


def test_summary_of_a_new_persona_is_empty_and_says_whether_the_shield_covers_the_endpoint(uid):
    body = client.get("/api/privacy/summary", params={"user_id": uid}).json()
    assert body == {"covered": False, "calls": 0, "removed_total": 0, "chars_sent": 0, "by_type": {}, "last_call_at": None}


def test_summary_is_covered_in_responses_mode_and_adds_up(uid, responses_mode):
    add_rows(uid, 2)
    body = client.get("/api/privacy/summary", params={"user_id": uid}).json()
    assert body["covered"] is True and body["calls"] == 2 and body["removed_total"] == 2
    assert body["chars_sent"] == 80 and body["by_type"] == {"PERSON": 2} and body["last_call_at"]


def test_unknown_persona_is_404_on_every_persona_route():
    ghost = {"user_id": "usr_nobody"}
    assert client.get("/api/privacy/summary", params=ghost).status_code == 404
    assert client.post("/api/privacy/preview", json={**ghost, "text": "x"}).status_code == 404
    assert client.get("/api/privacy/terms", params=ghost).status_code == 404
    assert client.post("/api/privacy/terms", json={**ghost, "term": "Apollo"}).status_code == 404
    assert client.delete("/api/privacy/terms/t1", params=ghost).status_code == 404
    assert client.get("/api/privacy/ledger", params=ghost).status_code == 404
    assert client.post("/api/privacy/ledger/verify", json=ghost).status_code == 404
    assert client.post("/api/privacy/ledger/tamper-test", json=ghost).status_code == 404


# ----------------------------------------------------------------- preview


def test_preview_masks_and_reports_offsets_in_the_original_text(uid):
    body = client.post("/api/privacy/preview", json={"user_id": uid, "text": TEXT}).json()
    assert body["masked"] == "Patient: [PERSON_1]\nPhone: [PHONE_1]\nEmail: [EMAIL_1]\nResult: 13.8 g/dL"
    assert body["counts"] == {"PERSON": 1, "PHONE": 1, "EMAIL": 1}
    assert [(s["type"], TEXT[s["start"]:s["end"]]) for s in body["spans"]] == [
        ("PERSON", "Kiruthika R"), ("PHONE", "98765 43210"), ("EMAIL", "kiruthika@example.com")]
    assert body["spans"][0]["placeholder"] == "[PERSON_1]"


def test_preview_changes_nothing_and_makes_no_model_call(uid, monkeypatch):
    from app.services import responses_adapter as adapter

    def boom(*a, **k):
        raise AssertionError("the preview must not call the model")

    monkeypatch.setattr(adapter, "open_stream", boom)
    monkeypatch.setattr(adapter, "complete_sync", boom)
    before = len(shield.vault_for(uid))
    client.post("/api/privacy/preview", json={"user_id": uid, "text": TEXT})
    assert len(shield.vault_for(uid)) == before
    assert ledger.list_rows(uid) == []


def test_preview_uses_the_always_hide_words(uid):
    body = client.post("/api/privacy/preview", json={"user_id": uid, "text": "Visit Apollo today"}).json()
    assert body["masked"] == "Visit Apollo today"
    client.post("/api/privacy/terms", json={"user_id": uid, "term": "Apollo"})
    body = client.post("/api/privacy/preview", json={"user_id": uid, "text": "Visit Apollo today"}).json()
    assert body["masked"] == "Visit [CUSTOM_1] today" and body["counts"] == {"CUSTOM": 1}


def test_preview_text_limit_is_20000_characters(uid):
    assert client.post("/api/privacy/preview", json={"user_id": uid, "text": "a" * 20000}).status_code == 200
    too_long = client.post("/api/privacy/preview", json={"user_id": uid, "text": "a" * 20001})
    assert too_long.status_code == 413


def test_preview_learns_the_persona_from_the_stored_reports(uid):
    from tests.conftest import sample_pdf
    from app.services import report_service

    report_service.process_upload(uid, "synthetic_panel_2025-01-15.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    shield.forget(uid)  # a new process would start with an empty vault
    body = client.post("/api/privacy/preview", json={"user_id": uid, "text": "Please explain Demo Persona A and SYN-2025-0115-A"}).json()
    assert body["masked"] == "Please explain [PERSON_1] and [ID_1]"


# ------------------------------------------------------------------- terms


def test_terms_add_list_duplicate_and_delete(uid):
    row = client.post("/api/privacy/terms", json={"user_id": uid, "term": "  Sri Ram   Clinic "})
    assert row.status_code == 200 and row.json()["term"] == "Sri Ram Clinic"
    assert set(row.json()) == {"id", "term", "created_at"}
    assert client.post("/api/privacy/terms", json={"user_id": uid, "term": "sri ram clinic"}).status_code == 409
    assert client.post("/api/privacy/terms", json={"user_id": uid, "term": "  "}).status_code == 422
    assert client.post("/api/privacy/terms", json={"user_id": uid, "term": "x" * 81}).status_code == 422
    listed = client.get("/api/privacy/terms", params={"user_id": uid}).json()
    assert [t["term"] for t in listed] == ["Sri Ram Clinic"]
    other = make_user("someone else")["id"]
    assert client.delete(f"/api/privacy/terms/{row.json()['id']}", params={"user_id": other}).status_code == 404
    assert client.delete(f"/api/privacy/terms/{row.json()['id']}", params={"user_id": uid}).json() == {"deleted": row.json()["id"]}
    assert client.get("/api/privacy/terms", params={"user_id": uid}).json() == []


# ------------------------------------------------------------------ ledger


def test_ledger_lists_newest_first_without_text_and_opens_one_row(uid):
    ids = add_rows(uid, 3)
    rows = client.get("/api/privacy/ledger", params={"user_id": uid}).json()
    assert [r["seq"] for r in rows] == [3, 2, 1] and rows[0]["id"] == ids[2]
    assert "sent_text" not in rows[0]
    assert set(rows[0]) == {"id", "seq", "purpose", "created_at", "chars_original", "chars_sent", "removed_total",
                            "removed_by_type", "prev_hash", "row_hash"}
    one = client.get(f"/api/privacy/ledger/{ids[0]}", params={"user_id": uid}).json()
    assert one["sent_text"].startswith("## Person") and one["removed_by_type"] == {"PERSON": 1}
    assert len(client.get("/api/privacy/ledger", params={"user_id": uid, "limit": 2}).json()) == 2
    assert client.get("/api/privacy/ledger", params={"user_id": uid, "limit": 201}).status_code == 422
    assert client.get("/api/privacy/ledger/led_missing", params={"user_id": uid}).status_code == 404


def test_a_row_of_another_persona_is_not_reachable(uid):
    row_id = add_rows(uid, 1)[0]
    other = make_user("snooper")["id"]
    assert client.get(f"/api/privacy/ledger/{row_id}", params={"user_id": other}).status_code == 404
    assert client.get("/api/privacy/ledger", params={"user_id": other}).json() == []


def test_tools_scope_reads_the_shared_chain_without_a_persona():
    ledger.record("", "text_to_graph", 10, 9, 0, {}, "## Person\nmasked")
    rows = client.get("/api/privacy/ledger", params={"scope": "tools"}).json()
    assert rows and rows[0]["purpose"] in {"text_to_graph", "ask", "connection_test", "other", "agent", "node_summary", "chat"}
    full = client.get(f"/api/privacy/ledger/{rows[0]['id']}", params={"scope": "tools"})
    assert full.status_code == 200 and "sent_text" in full.json()
    assert client.post("/api/privacy/ledger/verify", json={"scope": "tools"}).json()["ok"] is True


def test_verify_says_intact_then_catches_an_edit(uid):
    add_rows(uid, 4)
    ok = client.post("/api/privacy/ledger/verify", json={"user_id": uid, "scope": "persona"}).json()
    assert ok == {"ok": True, "checked": 4, "broken_at_seq": None, "message": "All 4 records checked. The chain is intact."}
    with get_db() as db:
        db.execute("UPDATE privacy_ledger SET sent_text = 'edited' WHERE user_id = ? AND seq = 2", (uid,))
    bad = client.post("/api/privacy/ledger/verify", json={"user_id": uid}).json()
    assert bad["ok"] is False and bad["broken_at_seq"] == 2 and "Record 2" in bad["message"]


def test_tamper_test_needs_rows_then_detects_without_touching_the_database(uid):
    empty = client.post("/api/privacy/ledger/tamper-test", json={"user_id": uid})
    assert empty.status_code == 409 and "Nothing to test yet" in empty.json()["detail"]
    add_rows(uid, 5)
    with get_db() as db:
        before = [tuple(r) for r in db.execute("SELECT * FROM privacy_ledger WHERE user_id = ?", (uid,)).fetchall()]
    body = client.post("/api/privacy/ledger/tamper-test", json={"user_id": uid}).json()
    assert body == {"changed_seq": 3, "detected_at_seq": 3, "detected": True, "checked": 5}
    with get_db() as db:
        after = [tuple(r) for r in db.execute("SELECT * FROM privacy_ledger WHERE user_id = ?", (uid,)).fetchall()]
    assert before == after


def test_bad_scope_is_422(uid):
    assert client.get("/api/privacy/ledger", params={"user_id": uid, "scope": "everyone"}).status_code == 422


# ------------------------------------------------------------------ cascade


def test_deleting_a_persona_removes_its_ledger_and_words_and_leaves_others(uid):
    other = make_user("keeper")["id"]
    add_rows(uid, 2)
    add_rows(other, 2)
    client.post("/api/privacy/terms", json={"user_id": uid, "term": "Apollo"})
    client.post("/api/privacy/terms", json={"user_id": other, "term": "Apollo"})
    shield.vault_for(uid).placeholder_for("PERSON", "Asha K")

    assert client.delete(f"/api/users/{uid}").status_code == 200
    with get_db() as db:
        assert db.execute("SELECT COUNT(*) FROM privacy_ledger WHERE user_id = ?", (uid,)).fetchone()[0] == 0
        assert db.execute("SELECT COUNT(*) FROM privacy_terms WHERE user_id = ?", (uid,)).fetchone()[0] == 0
    assert len(shield.vault_for(uid)) == 0
    assert ledger.verify_chain(other)["ok"] and ledger.verify_chain(other)["checked"] == 2
    assert len(client.get("/api/privacy/terms", params={"user_id": other}).json()) == 1
