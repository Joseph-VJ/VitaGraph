"""Saved reports: the rendered HTML and PDF of an agent-written report, kept per person in `agent_artifacts`."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.core.database import get_db
from app.services import report_render

KIND = "report"
MAX_SAVED_PER_PERSON = 100


def _fingerprint(title: str, markdown: str, refs: list[dict[str, Any]]) -> str:
    """Stored in the `language` column as 'html:<hash>' so saving the same report twice finds the first one.

    The cited passages are part of the identity: the same words with other evidence is a different report.
    """
    cited = sorted((str(r.get("ref")), str(r.get("report_id")), str(r.get("chunk_id"))) for r in refs)
    raw = "\x1f".join([title.strip(), markdown, repr(cited)])
    return "html:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def _existing(user_id: str, fingerprint: str) -> dict[str, Any] | None:
    with get_db() as db:
        row = db.execute(
            """SELECT id, title, created_at, conversation_id, content FROM agent_artifacts
               WHERE user_id = ? AND kind = ? AND language = ? ORDER BY created_at ASC LIMIT 1""",
            (user_id, KIND, fingerprint),
        ).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "title": row["title"],
        "created_at": row["created_at"],
        "conversation_id": row["conversation_id"],
        "html": row["content"],
    }


def create(user_id: str, conversation_id: str | None, title: str, markdown: str, refs: list[dict[str, Any]]) -> dict[str, Any]:
    """Render, store and return a report. The evidence appendix is read from this person's own reports.

    Saving the same title and Markdown again returns the report already saved (no second copy).
    """
    fingerprint = _fingerprint(title, markdown, refs)
    found = _existing(user_id, fingerprint)
    if found is not None:
        return found
    try:
        evidence = report_render.evidence_rows(user_id, refs)
        document = report_render.render_html(title, markdown, evidence, user_id=user_id)
        pdf = report_render.render_pdf(document)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    final_title = report_render.title_and_body(markdown, title)[0]
    artifact_id = f"art_{uuid.uuid4().hex[:12]}"
    created = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute("BEGIN IMMEDIATE")  # one writer at a time, so two simultaneous saves cannot both insert
        again = db.execute(
            "SELECT id FROM agent_artifacts WHERE user_id = ? AND kind = ? AND language = ? LIMIT 1", (user_id, KIND, fingerprint)
        ).fetchone()
        if again is not None:
            return _existing(user_id, fingerprint) or {}
        count = db.execute(
            "SELECT COUNT(*) AS n FROM agent_artifacts WHERE user_id = ? AND kind = ?", (user_id, KIND)
        ).fetchone()["n"]
        if count >= MAX_SAVED_PER_PERSON:
            raise HTTPException(status_code=409, detail="You have saved the most reports allowed. Delete one first.")
        db.execute(
            """INSERT INTO agent_artifacts (id, user_id, conversation_id, kind, title, language, content, data, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (artifact_id, user_id, conversation_id, KIND, final_title, fingerprint, document, pdf, created),
        )
    return {"id": artifact_id, "title": final_title, "created_at": created, "conversation_id": conversation_id, "html": document}


def list_reports(user_id: str) -> list[dict[str, Any]]:
    with get_db() as db:
        rows = db.execute(
            """SELECT id, title, created_at, conversation_id FROM agent_artifacts
               WHERE user_id = ? AND kind = ? ORDER BY created_at DESC""",
            (user_id, KIND),
        ).fetchall()
    return [dict(r) for r in rows]


def _row(user_id: str, artifact_id: str) -> Any:
    with get_db() as db:
        row = db.execute(
            "SELECT id, title, created_at, conversation_id, content, data FROM agent_artifacts "
            "WHERE id = ? AND user_id = ? AND kind = ?",
            (artifact_id, user_id, KIND),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Report not found.")
    return row


def get(user_id: str, artifact_id: str) -> dict[str, Any]:
    row = _row(user_id, artifact_id)
    return {
        "id": row["id"],
        "title": row["title"],
        "created_at": row["created_at"],
        "conversation_id": row["conversation_id"],
        "html": row["content"],
    }


def get_pdf(user_id: str, artifact_id: str) -> tuple[str, bytes]:
    row = _row(user_id, artifact_id)
    return row["title"], bytes(row["data"] or b"")


def delete(user_id: str, artifact_id: str) -> None:
    _row(user_id, artifact_id)
    with get_db() as db:
        db.execute("DELETE FROM agent_artifacts WHERE id = ? AND user_id = ?", (artifact_id, user_id))
