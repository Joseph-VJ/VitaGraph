from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Iterable

from fastapi import HTTPException

from app.core.database import get_db

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _next_seq(db, conversation_id: str) -> int:
    seq_row = db.execute(
        "SELECT COALESCE(MAX(seq), 0) AS max_seq FROM agent_messages WHERE conversation_id = ?",
        (conversation_id,),
    ).fetchone()
    return (seq_row["max_seq"] or 0) + 1


def title_from_question(question: str, limit: int = 80) -> str:
    """A chat title from the first question: whole words only, with an ellipsis when it was shortened."""
    text = " ".join(question.split())
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    if " " in cut[limit // 2 :]:
        cut = cut[: cut.rindex(" ")]
    return cut.rstrip(" ,.;:-") + "…"


def begin_turn(user_id: str, conversation_id: str, question: str, *, title: str | None = None) -> None:
    """Write the conversation row (when new) and the user's message, so the chat shows in History at once.

    Raises 404 when the conversation id belongs to another person. Other storage errors are logged.
    """
    try:
        now = _now()
        with get_db() as db:
            row = db.execute(
                "SELECT id, user_id, title FROM agent_conversations WHERE id = ?",
                (conversation_id,),
            ).fetchone()
            if row and row["user_id"] != user_id:
                raise HTTPException(status_code=404, detail="Conversation not found")
            if not row:
                db.execute(
                    """INSERT INTO agent_conversations (id, user_id, title, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?)""",
                    (conversation_id, user_id, title or title_from_question(question), now, now),
                )
            else:
                db.execute("UPDATE agent_conversations SET updated_at = ? WHERE id = ?", (now, conversation_id))
            db.execute(
                """INSERT INTO agent_messages (
                    id, conversation_id, user_id, seq, role, content, status, ai_status,
                    evidence_json, trajectory_json, stats_json, created_at
                ) VALUES (?, ?, ?, ?, 'user', ?, NULL, NULL, NULL, NULL, NULL, ?)""",
                (
                    f"msg_{uuid.uuid4().hex[:12]}",
                    conversation_id,
                    user_id,
                    _next_seq(db, conversation_id),
                    question,
                    now,
                ),
            )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to start agent turn in conversation %s", conversation_id)


def finish_turn(
    user_id: str,
    conversation_id: str,
    final: dict[str, Any],
    trajectory: list[dict[str, Any]],
    stats: dict[str, Any],
) -> bool:
    """Write the assistant message that ends a turn (answered, refused, error, stopped, ...).

    Only writes when the conversation still exists, is this person's, and its last message is a question
    that has no answer yet. That makes a second call for the same turn harmless. Returns True when written.
    """
    try:
        now = _now()
        with get_db() as db:
            conv = db.execute(
                "SELECT user_id FROM agent_conversations WHERE id = ?", (conversation_id,)
            ).fetchone()
            if not conv or conv["user_id"] != user_id:
                return False
            last = db.execute(
                "SELECT role FROM agent_messages WHERE conversation_id = ? ORDER BY seq DESC LIMIT 1",
                (conversation_id,),
            ).fetchone()
            if last is None or last["role"] != "user":
                return False
            db.execute(
                """INSERT INTO agent_messages (
                    id, conversation_id, user_id, seq, role, content, status, ai_status,
                    evidence_json, trajectory_json, stats_json, created_at, safety_passed, safety_note
                ) VALUES (?, ?, ?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    f"msg_{uuid.uuid4().hex[:12]}",
                    conversation_id,
                    user_id,
                    _next_seq(db, conversation_id),
                    final.get("summary_text", "") or "",
                    final.get("status"),
                    final.get("ai_status"),
                    json.dumps(final.get("evidence", []), ensure_ascii=False),
                    json.dumps(trajectory, ensure_ascii=False),
                    json.dumps(stats, ensure_ascii=False),
                    now,
                    1 if final.get("safety_passed", True) else 0,
                    final.get("safety_note"),
                ),
            )
            if final.get("session_title"):
                db.execute(
                    "UPDATE agent_conversations SET updated_at = ?, title = COALESCE(NULLIF(title, ''), ?) WHERE id = ?",
                    (now, final["session_title"], conversation_id),
                )
            else:
                db.execute("UPDATE agent_conversations SET updated_at = ? WHERE id = ?", (now, conversation_id))
        return True
    except Exception:
        logger.exception("Failed to finish agent turn in conversation %s", conversation_id)
        return False


def record_turn(
    user_id: str,
    conversation_id: str,
    question: str,
    final: dict[str, Any],
    trajectory: list[dict[str, Any]],
    stats: dict[str, Any],
) -> None:
    """Store one whole agent turn (question and answer) at once, for callers that did not start it earlier."""
    try:
        begin_turn(user_id, conversation_id, question, title=final.get("session_title"))
    except HTTPException:
        logger.warning("Turn not recorded: conversation %s belongs to someone else", conversation_id)
        return
    finish_turn(user_id, conversation_id, final, trajectory, stats)


def close_unfinished_turns() -> int:
    """After a restart, give every question that never got an answer a 'stopped' reply. Returns how many."""
    closed = 0
    try:
        with get_db() as db:
            rows = db.execute(
                """SELECT c.id, c.user_id FROM agent_conversations c
                   WHERE (SELECT role FROM agent_messages m WHERE m.conversation_id = c.id
                          ORDER BY m.seq DESC LIMIT 1) = 'user'"""
            ).fetchall()
        for r in rows:
            note = "Stopped: the app was closed before this answer was finished."
            final = {"summary_text": note, "status": "stopped", "ai_status": "stopped", "evidence": []}
            if finish_turn(r["user_id"], r["id"], final, [], {}):
                closed += 1
    except Exception:
        logger.exception("Closing unfinished agent turns failed")
    return closed


_SUMMARY_SQL = """SELECT c.id, c.title, c.updated_at, c.pinned,
                         COUNT(m.id) AS message_count,
                         SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) AS turns
                  FROM agent_conversations c
                  LEFT JOIN agent_messages m ON c.id = m.conversation_id
                  WHERE c.user_id = ?{extra}
                  GROUP BY c.id"""


def _summary(r, running_ids: set[str]) -> dict[str, Any]:
    return {
        "id": r["id"],
        "title": r["title"],
        "updated_at": r["updated_at"],
        "message_count": r["message_count"],
        "turns": r["turns"] or 0,
        "pinned": bool(r["pinned"]),
        "running": r["id"] in running_ids,
    }


def list_conversations(user_id: str, running_ids: Iterable[str] = ()) -> list[dict[str, Any]]:
    """List a user's conversations: pinned first, then newest update first."""
    running = set(running_ids)
    with get_db() as db:
        rows = db.execute(
            _SUMMARY_SQL.format(extra="") + " ORDER BY c.pinned DESC, c.updated_at DESC",
            (user_id,),
        ).fetchall()
    return [_summary(r, running) for r in rows]


def update_conversation(
    user_id: str,
    conversation_id: str,
    *,
    title: str | None = None,
    pinned: bool | None = None,
    running_ids: Iterable[str] = (),
) -> dict[str, Any]:
    """Rename and/or pin a conversation and return its summary. Raises 404 for another person's chat."""
    with get_db() as db:
        conv = db.execute(
            "SELECT user_id FROM agent_conversations WHERE id = ?", (conversation_id,)
        ).fetchone()
        if not conv or conv["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if title is not None:
            db.execute("UPDATE agent_conversations SET title = ? WHERE id = ?", (title, conversation_id))
        if pinned is not None:
            db.execute(
                "UPDATE agent_conversations SET pinned = ? WHERE id = ?", (1 if pinned else 0, conversation_id)
            )
        row = db.execute(_SUMMARY_SQL.format(extra=" AND c.id = ?"), (user_id, conversation_id)).fetchone()
    return _summary(row, set(running_ids))


def get_conversation(user_id: str, conversation_id: str) -> dict[str, Any]:
    """Get a conversation and its messages in seq order with decoded JSON fields.

    Raises 404 if the conversation does not exist or belongs to another user.
    """
    with get_db() as db:
        conv = db.execute(
            "SELECT * FROM agent_conversations WHERE id = ?",
            (conversation_id,),
        ).fetchone()
        if not conv or conv["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Conversation not found")

        msg_rows = db.execute(
            "SELECT * FROM agent_messages WHERE conversation_id = ? ORDER BY seq ASC",
            (conversation_id,),
        ).fetchall()

        messages = []
        for r in msg_rows:
            ev = json.loads(r["evidence_json"]) if r["evidence_json"] else []
            tr = json.loads(r["trajectory_json"]) if r["trajectory_json"] else []
            st = json.loads(r["stats_json"]) if r["stats_json"] else {}
            messages.append(
                {
                    "seq": r["seq"],
                    "role": r["role"],
                    "content": r["content"],
                    "status": r["status"],
                    "ai_status": r["ai_status"],
                    "evidence": ev,
                    "trajectory": tr,
                    "stats": st,
                    "safety_passed": bool(r["safety_passed"]),
                    "safety_note": r["safety_note"],
                    "created_at": r["created_at"],
                }
            )

        return {
            "id": conv["id"],
            "title": conv["title"],
            "messages": messages,
        }


def delete_conversation(user_id: str, conversation_id: str) -> dict[str, str]:
    """Delete a conversation, its messages, and its artifacts.

    Raises 404 if the conversation does not exist or belongs to another user.
    """
    with get_db() as db:
        conv = db.execute(
            "SELECT * FROM agent_conversations WHERE id = ?",
            (conversation_id,),
        ).fetchone()
        if not conv or conv["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Conversation not found")

        db.execute("DELETE FROM agent_artifacts WHERE conversation_id = ?", (conversation_id,))
        db.execute("DELETE FROM agent_messages WHERE conversation_id = ?", (conversation_id,))
        db.execute("DELETE FROM agent_conversations WHERE id = ?", (conversation_id,))

    return {"deleted": conversation_id}
