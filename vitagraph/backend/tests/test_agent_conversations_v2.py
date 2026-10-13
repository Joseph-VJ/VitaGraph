"""Conversation list/detail additions: pinned, running, turns, safety fields, PATCH, migration."""

from __future__ import annotations

import sqlite3
import time

import pytest
from fastapi.testclient import TestClient

from app.core import database
from app.main import app
from app.services import agent_service, conversation_service
from tests.conftest import make_user
from tests.test_agent_service import FakePool, _collect

client = TestClient(app)

REFUSED_Q = "Do I have diabetes? Please diagnose me."


def _ask(uid: str, conv: str, question: str = REFUSED_Q) -> None:
    """Store one finished turn (a refusal needs no model)."""
    _collect(uid, [{"role": "user", "content": question}], pool=FakePool(), conversation_id=conv)


def _list(uid: str) -> list[dict]:
    res = client.get("/api/agent/conversations", params={"user_id": uid})
    assert res.status_code == 200
    return res.json()


def test_turns_counts_questions_not_messages():
    user = make_user("V2 Turns")
    uid = user["id"]
    _ask(uid, "conv_v2_turns")
    _ask(uid, "conv_v2_turns", "Please diagnose me again, do I have cancer?")
    item = [c for c in _list(uid) if c["id"] == "conv_v2_turns"][0]
    assert item["message_count"] == 4
    assert item["turns"] == 2
    assert item["pinned"] is False
    assert item["running"] is False


def test_the_conversation_detail_carries_the_safety_fields():
    user = make_user("V2 Safety Fields")
    _ask(user["id"], "conv_v2_safety")
    body = client.get("/api/agent/conversations/conv_v2_safety", params={"user_id": user["id"]}).json()
    for msg in body["messages"]:
        assert msg["safety_passed"] is True
        assert msg["safety_note"] is None


def test_safety_passed_false_is_stored_and_read_back():
    user = make_user("V2 Unsafe Store")
    uid = user["id"]
    conversation_service.begin_turn(uid, "conv_v2_unsafe", "Check my blood test")
    ok = conversation_service.finish_turn(
        uid,
        "conv_v2_unsafe",
        {
            "summary_text": "Your results mean you have anemia.",
            "status": "answered",
            "ai_status": "ok",
            "evidence": [],
            "safety_passed": False,
            "safety_note": "Safety check: answer contains diagnostic phrasing ('you have').",
        },
        [],
        {},
    )
    assert ok is True
    msgs = conversation_service.get_conversation(uid, "conv_v2_unsafe")["messages"]
    assert msgs[1]["safety_passed"] is False
    assert msgs[1]["safety_note"].startswith("Safety check")


def test_finishing_a_turn_twice_writes_one_answer():
    user = make_user("V2 Finish Twice")
    uid = user["id"]
    conversation_service.begin_turn(uid, "conv_v2_twice", "A question")
    final = {"summary_text": "First", "status": "answered", "ai_status": "ok", "evidence": []}
    assert conversation_service.finish_turn(uid, "conv_v2_twice", final, [], {}) is True
    assert conversation_service.finish_turn(uid, "conv_v2_twice", final, [], {}) is False
    assert len(conversation_service.get_conversation(uid, "conv_v2_twice")["messages"]) == 2


def test_finishing_a_turn_for_a_deleted_conversation_writes_nothing():
    user = make_user("V2 Deleted Mid Run")
    uid = user["id"]
    conversation_service.begin_turn(uid, "conv_v2_gone", "A question")
    conversation_service.delete_conversation(uid, "conv_v2_gone")
    final = {"summary_text": "Late", "status": "answered", "ai_status": "ok", "evidence": []}
    assert conversation_service.finish_turn(uid, "conv_v2_gone", final, [], {}) is False
    from app.core.database import get_db

    with get_db() as db:
        left = db.execute("SELECT COUNT(*) AS c FROM agent_messages WHERE conversation_id = 'conv_v2_gone'").fetchone()["c"]
    assert left == 0


def test_patch_renames_and_pins_and_returns_the_summary():
    user = make_user("V2 Patch")
    uid = user["id"]
    _ask(uid, "conv_v2_patch")
    res = client.patch("/api/agent/conversations/conv_v2_patch", params={"user_id": uid}, json={"title": "  My lipid questions  "})
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == "conv_v2_patch"
    assert body["title"] == "My lipid questions"
    assert body["pinned"] is False
    assert body["turns"] == 1

    res = client.patch("/api/agent/conversations/conv_v2_patch", params={"user_id": uid}, json={"pinned": True})
    assert res.status_code == 200 and res.json()["pinned"] is True
    assert res.json()["title"] == "My lipid questions"  # untouched fields stay

    detail = client.get("/api/agent/conversations/conv_v2_patch", params={"user_id": uid}).json()
    assert detail["title"] == "My lipid questions"


@pytest.mark.parametrize("body", [{"title": ""}, {"title": "   "}, {"title": "x" * 121}, {}])
def test_patch_rejects_bad_input(body):
    user = make_user("V2 Patch Bad")
    uid = user["id"]
    conv = f"conv_v2_pb_{uid[-8:]}"
    _ask(uid, conv)
    res = client.patch(f"/api/agent/conversations/{conv}", params={"user_id": uid}, json=body)
    assert res.status_code == 422
    assert client.get(f"/api/agent/conversations/{conv}", params={"user_id": uid}).json()["title"] == REFUSED_Q


def test_patch_accepts_a_120_character_title():
    user = make_user("V2 Patch Long")
    uid = user["id"]
    _ask(uid, "conv_v2_patchlong")
    res = client.patch("/api/agent/conversations/conv_v2_patchlong", params={"user_id": uid}, json={"title": "t" * 120})
    assert res.status_code == 200 and len(res.json()["title"]) == 120


def test_patch_on_another_persons_chat_is_404_and_changes_nothing():
    owner = make_user("V2 Patch Owner")
    stranger = make_user("V2 Patch Stranger")
    _ask(owner["id"], "conv_v2_patchown")
    res = client.patch(
        "/api/agent/conversations/conv_v2_patchown", params={"user_id": stranger["id"]}, json={"title": "Stolen", "pinned": True}
    )
    assert res.status_code == 404
    item = [c for c in _list(owner["id"]) if c["id"] == "conv_v2_patchown"][0]
    assert item["title"] == REFUSED_Q and item["pinned"] is False
    assert client.patch("/api/agent/conversations/conv_nope", params={"user_id": owner["id"]}, json={"pinned": True}).status_code == 404


def test_the_list_is_ordered_pinned_first_then_newest_first():
    user = make_user("V2 Order")
    uid = user["id"]
    for name in ("conv_v2_o1", "conv_v2_o2", "conv_v2_o3"):
        _ask(uid, name)
        time.sleep(0.01)  # updated_at has microsecond resolution; keep the order unambiguous
    assert [c["id"] for c in _list(uid)] == ["conv_v2_o3", "conv_v2_o2", "conv_v2_o1"]

    client.patch("/api/agent/conversations/conv_v2_o1", params={"user_id": uid}, json={"pinned": True})
    assert [c["id"] for c in _list(uid)] == ["conv_v2_o1", "conv_v2_o3", "conv_v2_o2"]

    client.patch("/api/agent/conversations/conv_v2_o2", params={"user_id": uid}, json={"pinned": True})
    assert [c["id"] for c in _list(uid)] == ["conv_v2_o2", "conv_v2_o1", "conv_v2_o3"]  # pinned: newest first

    # a new answer moves an unpinned chat to the top of the unpinned ones, pinned stay above
    time.sleep(0.01)
    _ask(uid, "conv_v2_o3", "Another diagnose me question: do I have asthma?")
    assert [c["id"] for c in _list(uid)] == ["conv_v2_o2", "conv_v2_o1", "conv_v2_o3"]

    client.patch("/api/agent/conversations/conv_v2_o1", params={"user_id": uid}, json={"pinned": False})
    assert [c["id"] for c in _list(uid)] == ["conv_v2_o2", "conv_v2_o3", "conv_v2_o1"]


def test_another_persona_never_sees_my_conversations_in_the_list():
    a = make_user("V2 List A")
    b = make_user("V2 List B")
    _ask(a["id"], "conv_v2_lista")
    assert _list(b["id"]) == []


def _old_database() -> sqlite3.Connection:
    """The agent tables as they were before this change (no pinned / safety columns)."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE agent_conversations (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE agent_messages (
            id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, user_id TEXT NOT NULL, seq INTEGER NOT NULL,
            role TEXT NOT NULL, content TEXT NOT NULL, status TEXT, ai_status TEXT,
            evidence_json TEXT, trajectory_json TEXT, stats_json TEXT, created_at TEXT NOT NULL
        );
        INSERT INTO agent_conversations VALUES ('c1', 'u1', 'Old chat', 't', 't');
        INSERT INTO agent_messages (id, conversation_id, user_id, seq, role, content, created_at)
            VALUES ('m1', 'c1', 'u1', 1, 'user', 'Old question', 't');
        """
    )
    return conn


def _columns(conn: sqlite3.Connection, table: str) -> dict[str, sqlite3.Row]:
    return {r["name"]: r for r in conn.execute(f"PRAGMA table_info({table})")}


def test_the_migration_adds_the_new_columns_to_an_old_database_and_is_idempotent():
    conn = _old_database()
    database._migrate(conn)
    database._migrate(conn)  # a second start must not fail or duplicate anything
    conn.commit()

    msg_cols = _columns(conn, "agent_messages")
    assert "safety_passed" in msg_cols and "safety_note" in msg_cols
    assert msg_cols["safety_passed"]["notnull"] == 1 and msg_cols["safety_passed"]["dflt_value"] == "1"
    conv_cols = _columns(conn, "agent_conversations")
    assert "pinned" in conv_cols and conv_cols["pinned"]["dflt_value"] == "0"

    # old rows get the defaults
    assert conn.execute("SELECT safety_passed, safety_note FROM agent_messages WHERE id = 'm1'").fetchone()[:] == (1, None)
    assert conn.execute("SELECT pinned FROM agent_conversations WHERE id = 'c1'").fetchone()[0] == 0


def test_the_full_schema_can_be_applied_twice_on_the_live_database():
    database.init_db()
    database.init_db()
    with database.get_db() as db:
        names = {r["name"] for r in db.execute("PRAGMA table_info(agent_messages)")}
        assert {"safety_passed", "safety_note"} <= names
        assert "pinned" in {r["name"] for r in db.execute("PRAGMA table_info(agent_conversations)")}


def test_unfinished_questions_are_closed_as_stopped_after_a_restart():
    user = make_user("V2 Orphan")
    uid = user["id"]
    conversation_service.begin_turn(uid, "conv_v2_orphan", "A question with no answer")
    closed = conversation_service.close_unfinished_turns()
    assert closed >= 1
    msgs = conversation_service.get_conversation(uid, "conv_v2_orphan")["messages"]
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    assert msgs[1]["status"] == "stopped"
    assert conversation_service.close_unfinished_turns() == 0


def test_deleting_a_persona_removes_its_conversations_and_messages():
    from app.core.database import get_db
    from app.services import user_service

    user = make_user("V2 Persona Delete")
    uid = user["id"]
    _ask(uid, "conv_v2_pdel")
    client.patch("/api/agent/conversations/conv_v2_pdel", params={"user_id": uid}, json={"pinned": True})
    user_service.delete_user(uid)
    with get_db() as db:
        assert db.execute("SELECT COUNT(*) AS c FROM agent_conversations WHERE user_id = ?", (uid,)).fetchone()["c"] == 0
        assert db.execute("SELECT COUNT(*) AS c FROM agent_messages WHERE user_id = ?", (uid,)).fetchone()["c"] == 0
