"""Persona management: create, list, consent, and delete-with-cascade.

Deletion removes the user's derived records (reports, pages, chunks,
questions, answers, timeline events, raw files, and vector entries) per the
plan's data policy. No deletion event is written afterwards — it would be
removed with the user's own timeline anyway — so deletion is recorded only
through the row's absence.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.database import get_db
from app.ingestion import uploader
from app.rag import vector_store
from app.services import timeline_service

# Version of the data-use statement users accept (audit trail, plan §15.2).
CONSENT_STATEMENT_VERSION = "consent-v1"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _with_consent(user: dict) -> dict:
    user["consent_accepted"] = has_consent(user["id"])
    return user


def create_user(display_label: str) -> dict:
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    with get_db() as db:
        db.execute(
            "INSERT INTO users (id, display_label, created_at, status) VALUES (?, ?, ?, 'active')",
            (user_id, display_label.strip(), _now()),
        )
    timeline_service.add_event(user_id, "persona_created",
                               {"display_label": display_label.strip()})
    return _with_consent(get_user(user_id))


def list_users() -> list[dict]:
    with get_db() as db:
        rows = db.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
        return [_with_consent(dict(row)) for row in rows]


def get_user(user_id: str) -> dict:
    with get_db() as db:
        row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return dict(row)


def user_exists(user_id: str) -> None:
    """Raise 404 if the user does not exist. Called by every data route."""
    get_user(user_id)


def accept_consent(user_id: str) -> dict:
    """Record the persona's acceptance of the data-use statement (§15.2).

    Acceptance is stored as a history event with the statement version, not
    as profile data.
    """
    get_user(user_id)
    if not has_consent(user_id):
        timeline_service.add_event(user_id, "consent_accepted", {
            "statement_version": CONSENT_STATEMENT_VERSION,
        })
    return _with_consent(get_user(user_id))


def has_consent(user_id: str) -> bool:
    with get_db() as db:
        row = db.execute(
            "SELECT COUNT(*) AS c FROM history_events "
            "WHERE user_id = ? AND event_type = 'consent_accepted'",
            (user_id,),
        ).fetchone()
    return row["c"] > 0


def delete_user(user_id: str) -> dict:
    """Delete a persona and every derived record.

    Order: vector entries (outside SQLite) first, then raw files, then all
    dependent rows in foreign-key-respecting order.
    """
    get_user(user_id)

    vector_store.delete_user_chunks(user_id)
    uploader.delete_user_files(user_id)

    with get_db() as db:
        db.execute("DELETE FROM report_chunks WHERE user_id = ?", (user_id,))
        db.execute(
            """DELETE FROM report_pages WHERE report_id IN
               (SELECT id FROM reports WHERE user_id = ?)""",
            (user_id,),
        )
        db.execute("DELETE FROM reports WHERE user_id = ?", (user_id,))
        db.execute(
            "DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE user_id = ?)",
            (user_id,),
        )
        db.execute("DELETE FROM questions WHERE user_id = ?", (user_id,))
        db.execute("DELETE FROM history_events WHERE user_id = ?", (user_id,))
        db.execute("DELETE FROM users WHERE id = ?", (user_id,))

    return {"deleted": user_id,
            "records": "reports, pages, chunks, questions, answers, timeline, vectors, raw files"}
