from __future__ import annotations

from app.core.database import get_db, init_db
from app.services import user_service
from tests.conftest import make_user


def test_agent_tables_exist():
    init_db()
    with get_db() as db:
        rows = db.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('agent_conversations', 'agent_messages', 'agent_artifacts')"
        ).fetchall()
        table_names = {r["name"] for r in rows}
    assert table_names == {"agent_conversations", "agent_messages", "agent_artifacts"}


def test_deleting_a_persona_removes_agent_rows_and_ai_calls():
    user = make_user("Persona D1 Delete Test")
    uid = user["id"]

    with get_db() as db:
        # 1. agent_conversations
        db.execute(
            "INSERT INTO agent_conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            ("conv_d1_test", uid, "Test Conversation", "2026-10-05T00:00:00Z", "2026-10-05T00:00:00Z"),
        )
        # 2. agent_messages
        db.execute(
            """INSERT INTO agent_messages (
                id, conversation_id, user_id, seq, role, content, status, ai_status,
                evidence_json, trajectory_json, stats_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "msg_d1_test",
                "conv_d1_test",
                uid,
                1,
                "user",
                "Hello agent",
                "completed",
                "disabled",
                "[]",
                "[]",
                "{}",
                "2026-10-05T00:00:00Z",
            ),
        )
        # 3. agent_artifacts
        db.execute(
            """INSERT INTO agent_artifacts (
                id, user_id, conversation_id, kind, title, language, content, data, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "art_d1_test",
                uid,
                "conv_d1_test",
                "code",
                "test.py",
                "python",
                "print('hello')",
                None,
                "2026-10-05T00:00:00Z",
            ),
        )
        # 4. ai_calls
        db.execute(
            """INSERT INTO ai_calls (
                id, question_id, user_id, workflow_id, request_id, status, used_ai, error, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "aicall_d1_test",
                "q_d1_test",
                uid,
                "wf_d1_test",
                "req_d1_test",
                "ok",
                1,
                None,
                "2026-10-05T00:00:00Z",
            ),
        )

    # Call user_service.delete_user
    res = user_service.delete_user(uid)
    assert res["deleted"] == uid
    assert "agent conversations, artifacts, AI call records" in res["records"]

    # Verify zero rows in all 4 tables
    with get_db() as db:
        c_conv = db.execute("SELECT COUNT(*) as c FROM agent_conversations WHERE user_id = ?", (uid,)).fetchone()["c"]
        c_msg = db.execute("SELECT COUNT(*) as c FROM agent_messages WHERE user_id = ?", (uid,)).fetchone()["c"]
        c_art = db.execute("SELECT COUNT(*) as c FROM agent_artifacts WHERE user_id = ?", (uid,)).fetchone()["c"]
        c_aicall = db.execute("SELECT COUNT(*) as c FROM ai_calls WHERE user_id = ?", (uid,)).fetchone()["c"]

    assert c_conv == 0
    assert c_msg == 0
    assert c_art == 0
    assert c_aicall == 0
