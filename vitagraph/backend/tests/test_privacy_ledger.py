"""The ledger is a per-persona hash chain: edits are caught, deletes stay local, tamper tests write nothing."""

from __future__ import annotations

import threading

import pytest
from fastapi import HTTPException

from app.core.database import get_db
from app.privacy import ledger, terms
from tests.conftest import make_user


def add_rows(user_id: str, count: int, text: str = "## Person\nhello [PERSON_1]") -> list[str]:
    return [ledger.record(user_id, "agent", 100 + i, 90 + i, 1, {"PERSON": 1}, f"{text} {i}") for i in range(count)]


def fresh_user() -> str:
    return make_user("ledger test")["id"]


def snapshot(user_id: str) -> list[tuple]:
    with get_db() as db:
        return [tuple(r) for r in db.execute(
            "SELECT id, seq, sent_text, prev_hash, row_hash FROM privacy_ledger WHERE user_id = ? ORDER BY seq",
            (user_id,),
        ).fetchall()]


def test_a_chain_of_five_rows_verifies():
    uid = fresh_user()
    ids = add_rows(uid, 5)
    assert all(ids)
    result = ledger.verify_chain(uid)
    assert result == {"ok": True, "checked": 5, "broken_at_seq": None,
                      "message": "All 5 records checked. The chain is intact."}
    rows = snapshot(uid)
    assert rows[0][3] == "0" * 64
    assert all(rows[i][3] == rows[i - 1][4] for i in range(1, 5))


def test_an_empty_chain_verifies_with_nothing_to_check():
    result = ledger.verify_chain(fresh_user())
    assert result["ok"] and result["checked"] == 0


@pytest.mark.parametrize("column", ["sent_text", "chars_sent", "prev_hash"])
def test_editing_a_row_is_caught_at_that_row(column):
    uid = fresh_user()
    add_rows(uid, 5)
    value = "'tampered'" if column != "chars_sent" else "1"
    with get_db() as db:
        db.execute(f"UPDATE privacy_ledger SET {column} = {value} WHERE user_id = ? AND seq = 3", (uid,))
    result = ledger.verify_chain(uid)
    assert result["ok"] is False
    assert result["broken_at_seq"] == 3
    assert "Record 3" in result["message"]


def test_removing_a_middle_row_is_caught():
    uid = fresh_user()
    add_rows(uid, 5)
    with get_db() as db:
        db.execute("DELETE FROM privacy_ledger WHERE user_id = ? AND seq = 2", (uid,))
    result = ledger.verify_chain(uid)
    assert result["ok"] is False and result["broken_at_seq"] == 3


def test_removing_the_first_row_is_caught():
    uid = fresh_user()
    add_rows(uid, 3)
    with get_db() as db:
        db.execute("DELETE FROM privacy_ledger WHERE user_id = ? AND seq = 1", (uid,))
    assert ledger.verify_chain(uid)["broken_at_seq"] == 2


def test_each_persona_has_its_own_chain_and_deleting_one_leaves_the_other_intact():
    a, b = fresh_user(), fresh_user()
    add_rows(a, 3)
    add_rows(b, 3)
    assert [r[1] for r in snapshot(b)] == [1, 2, 3]
    with get_db() as db:
        db.execute("DELETE FROM privacy_ledger WHERE user_id = ?", (a,))
    assert ledger.verify_chain(b)["ok"]
    assert ledger.verify_chain(a)["checked"] == 0


def test_tamper_test_detects_and_leaves_the_database_untouched():
    uid = fresh_user()
    add_rows(uid, 6)
    before = snapshot(uid)
    result = ledger.tamper_test(uid)
    assert result == {"changed_seq": 4, "detected_at_seq": 4, "detected": True, "checked": 6}
    assert snapshot(uid) == before
    assert ledger.verify_chain(uid)["ok"]


def test_tamper_test_with_one_row_and_with_none():
    uid = fresh_user()
    with pytest.raises(HTTPException) as err:
        ledger.tamper_test(uid)
    assert err.value.status_code == 409 and "Nothing to test yet" in err.value.detail
    add_rows(uid, 1)
    assert ledger.tamper_test(uid)["detected"] is True


def test_concurrent_records_never_fork_the_chain():
    uid = fresh_user()
    threads = [threading.Thread(target=add_rows, args=(uid, 1)) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert [r[1] for r in snapshot(uid)] == list(range(1, 9))
    assert ledger.verify_chain(uid)["ok"]


def test_list_rows_is_newest_first_and_leaves_out_the_text():
    uid = fresh_user()
    add_rows(uid, 3)
    rows = ledger.list_rows(uid, limit=2)
    assert [r["seq"] for r in rows] == [3, 2]
    assert "sent_text" not in rows[0]
    full = ledger.get_row(uid, rows[0]["id"])
    assert full["sent_text"].endswith("2") and full["removed_by_type"] == {"PERSON": 1}


def test_a_row_of_another_persona_is_not_found():
    a, b = fresh_user(), fresh_user()
    row_id = add_rows(a, 1)[0]
    with pytest.raises(HTTPException) as err:
        ledger.get_row(b, row_id)
    assert err.value.status_code == 404


def test_summary_adds_up():
    uid = fresh_user()
    assert ledger.summary(uid)["calls"] == 0 and ledger.summary(uid)["last_call_at"] is None
    add_rows(uid, 3)
    summary = ledger.summary(uid)
    assert summary["calls"] == 3 and summary["removed_total"] == 3
    assert summary["chars_sent"] == 90 + 91 + 92 and summary["by_type"] == {"PERSON": 3}
    assert summary["last_call_at"]


def test_record_never_raises_into_the_model_call(monkeypatch):
    def broken():
        raise RuntimeError("database is gone")

    monkeypatch.setattr(ledger, "get_db", broken)
    assert ledger.record("x", "agent", 1, 1, 0, {}, "text") is None


# ------------------------------------------------------------------- terms


def test_terms_are_added_listed_and_removed_per_persona():
    a, b = fresh_user(), fresh_user()
    row = terms.add_term(a, "  Apollo   Hospital ")
    assert row["term"] == "Apollo Hospital"
    assert [t["term"] for t in terms.list_terms(a)] == ["Apollo Hospital"]
    assert terms.list_terms(b) == [] and terms.terms_for(a) == ["Apollo Hospital"]
    with pytest.raises(HTTPException) as err:
        terms.delete_term(b, row["id"])
    assert err.value.status_code == 404
    assert terms.delete_term(a, row["id"]) == {"deleted": row["id"]}
    assert terms.list_terms(a) == []


@pytest.mark.parametrize(("term", "status"), [("", 422), (" a ", 422), ("x" * 81, 422)])
def test_term_length_limits(term, status):
    with pytest.raises(HTTPException) as err:
        terms.add_term(fresh_user(), term)
    assert err.value.status_code == status


def test_duplicate_terms_conflict_ignoring_case():
    uid = fresh_user()
    terms.add_term(uid, "Apollo")
    with pytest.raises(HTTPException) as err:
        terms.add_term(uid, "apollo")
    assert err.value.status_code == 409
