from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.core.database import get_db

logger = logging.getLogger(__name__)


def record_turn(
    user_id: str,
    conversation_id: str,
    question: str,
    final: dict[str, Any],
    trajectory: list[dict[str, Any]],
    stats: dict[str, Any],
) -> None:
    """Store one agent turn (user question and assistant response) with trajectory and stats."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        title = final.get("session_title") or question[:80]

        with get_db() as db:
            # 1. Create conversation if missing
            row = db.execute(
                "SELECT id, title FROM agent_conversations WHERE id = ?",
                (conversation_id,),
            ).fetchone()
            if not row:
                db.execute(
                    """INSERT INTO agent_conversations (id, user_id, title, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?)""",
                    (conversation_id, user_id, title, now, now),
                )
            elif final.get("session_title") and not row["title"]:
                db.execute(
                    "UPDATE agent_conversations SET title = ?, updated_at = ? WHERE id = ?",
                    (final["session_title"], now, conversation_id),
                )
            else:
                db.execute(
                    "UPDATE agent_conversations SET updated_at = ? WHERE id = ?",
                    (now, conversation_id),
                )

            # 2. Get next sequence number
            seq_row = db.execute(
                "SELECT COALESCE(MAX(seq), 0) AS max_seq FROM agent_messages WHERE conversation_id = ?",
                (conversation_id,),
            ).fetchone()
            next_seq = (seq_row["max_seq"] or 0) + 1

            # 3. User message
            user_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
            db.execute(
                """INSERT INTO agent_messages (
                    id, conversation_id, user_id, seq, role, content, status, ai_status,
                    evidence_json, trajectory_json, stats_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    user_msg_id,
                    conversation_id,
                    user_id,
                    next_seq,
                    "user",
                    question,
                    None,
                    None,
                    None,
                    None,
                    None,
                    now,
                ),
            )

            # 4. Assistant message
            asst_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
            evidence_json = json.dumps(final.get("evidence", []), ensure_ascii=False)
            trajectory_json = json.dumps(trajectory, ensure_ascii=False)
            stats_json = json.dumps(stats, ensure_ascii=False)
            db.execute(
                """INSERT INTO agent_messages (
                    id, conversation_id, user_id, seq, role, content, status, ai_status,
                    evidence_json, trajectory_json, stats_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    asst_msg_id,
                    conversation_id,
                    user_id,
                    next_seq + 1,
                    "assistant",
                    final.get("summary_text", ""),
                    final.get("status"),
                    final.get("ai_status"),
                    evidence_json,
                    trajectory_json,
                    stats_json,
                    now,
                ),
            )
    except Exception:
        logger.exception("Failed to record agent turn in conversation %s", conversation_id)


def list_conversations(user_id: str) -> list[dict[str, Any]]:
    """List a user's conversations, newest first, with message count."""
    with get_db() as db:
        rows = db.execute(
            """SELECT c.id, c.title, c.updated_at, COUNT(m.id) AS message_count
               FROM agent_conversations c
               LEFT JOIN agent_messages m ON c.id = m.conversation_id
               WHERE c.user_id = ?
               GROUP BY c.id
               ORDER BY c.updated_at DESC""",
            (user_id,),
        ).fetchall()
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "updated_at": r["updated_at"],
                "message_count": r["message_count"],
            }
            for r in rows
        ]


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
