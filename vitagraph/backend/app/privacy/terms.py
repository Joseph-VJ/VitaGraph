"""The persona's "Always hide these words" list."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.database import get_db

MIN_TERM_CHARS = 2
MAX_TERM_CHARS = 80


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def list_terms(user_id: str) -> list[dict]:
    with get_db() as db:
        rows = db.execute(
            "SELECT id, term, created_at FROM privacy_terms WHERE user_id = ? ORDER BY created_at DESC, term ASC",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def terms_for(user_id: str) -> list[str]:
    """The plain words, for the redactor."""
    if not user_id:
        return []
    with get_db() as db:
        rows = db.execute("SELECT term FROM privacy_terms WHERE user_id = ?", (user_id,)).fetchall()
    return [r["term"] for r in rows]


def add_term(user_id: str, term: str) -> dict:
    term = " ".join((term or "").split())
    if len(term) < MIN_TERM_CHARS:
        raise HTTPException(status_code=422, detail=f"A word needs at least {MIN_TERM_CHARS} characters.")
    if len(term) > MAX_TERM_CHARS:
        raise HTTPException(status_code=422, detail=f"A word can have at most {MAX_TERM_CHARS} characters.")
    if any(existing["term"].casefold() == term.casefold() for existing in list_terms(user_id)):
        raise HTTPException(status_code=409, detail="That word is already in the list.")
    row = {"id": f"term_{uuid.uuid4().hex[:12]}", "term": term, "created_at": _now()}
    try:
        with get_db() as db:
            db.execute(
                "INSERT INTO privacy_terms (id, user_id, term, created_at) VALUES (?, ?, ?, ?)",
                (row["id"], user_id, row["term"], row["created_at"]),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="That word is already in the list.")
    return row


def delete_term(user_id: str, term_id: str) -> dict:
    with get_db() as db:
        cur = db.execute("DELETE FROM privacy_terms WHERE id = ? AND user_id = ?", (term_id, user_id))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Word not found.")
    return {"deleted": term_id}
