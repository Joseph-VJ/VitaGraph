"""My Data: one cheap, read-only summary of everything a persona has added and asked.

Only SQL counts and a few small queries run here (no per-report measurement parsing), and every query filters by
user_id. The activity feed is written in plain sentences on the server, so the page needs no event vocabulary.
"""

from __future__ import annotations

import json
from typing import Any

from app.core.config import settings
from app.core.database import get_db
from app.services import user_service

MAX_CHATS = 200
MAX_ACTIVITY = 100
FIRST_QUESTION_CHARS = 200
ERROR_CHARS = 160


def get_overview(user_id: str) -> dict[str, Any]:
    user = user_service.get_user(user_id)  # 404 for an unknown persona
    with get_db() as db:
        report_rows = db.execute(
            "SELECT r.id, r.original_filename, r.file_hash, r.report_date, r.upload_time, r.version, r.status, "
            "r.error_message, r.page_count, "
            "(SELECT COUNT(*) FROM report_chunks rc WHERE rc.report_id = r.id AND rc.user_id = r.user_id) AS chunk_count "
            "FROM reports r WHERE r.user_id = ? ORDER BY r.upload_time DESC, r.rowid DESC",
            (user_id,),
        ).fetchall()
        page_rows = db.execute(
            "SELECT p.report_id AS report_id, "
            "SUM(CASE WHEN p.extraction_method = 'native' THEN 1 ELSE 0 END) AS typed, "
            "SUM(CASE WHEN p.extraction_method = 'ocr' THEN 1 ELSE 0 END) AS scanned, "
            "SUM(CASE WHEN p.extraction_method = 'failed' THEN 1 ELSE 0 END) AS failed, "
            "SUM(CASE WHEN p.quality NOT IN ('good', 'failed') THEN 1 ELSE 0 END) AS weak, "
            "COUNT(*) AS total "
            "FROM report_pages p JOIN reports r ON r.id = p.report_id "
            "WHERE r.user_id = ? GROUP BY p.report_id",
            (user_id,),
        ).fetchall()
        chunk_total = db.execute(
            "SELECT COUNT(*) AS c FROM report_chunks WHERE user_id = ?", (user_id,)
        ).fetchone()["c"]
        conversation_rows = db.execute(
            "SELECT id, title, created_at, updated_at FROM agent_conversations WHERE user_id = ? "
            "ORDER BY updated_at DESC LIMIT ?",
            (user_id, MAX_CHATS),
        ).fetchall()
        chat_total = db.execute(
            "SELECT COUNT(*) AS c FROM agent_conversations WHERE user_id = ?", (user_id,)
        ).fetchone()["c"]
        # The text of assistant answers is not needed here, only who spoke, how it ended and which passages it cited.
        message_rows = db.execute(
            "SELECT conversation_id, seq, role, status, evidence_json, "
            "CASE WHEN role = 'user' THEN content ELSE NULL END AS content "
            "FROM agent_messages WHERE user_id = ? ORDER BY conversation_id, seq",
            (user_id,),
        ).fetchall()
        artifact_rows = db.execute(
            "SELECT id, title, created_at, conversation_id FROM agent_artifacts "
            "WHERE user_id = ? AND kind = 'report' ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        ledger_row = db.execute(
            "SELECT COUNT(*) AS calls, COALESCE(SUM(removed_total), 0) AS hidden "
            "FROM privacy_ledger WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        event_rows = db.execute(
            "SELECT id, event_type, timestamp, payload FROM history_events WHERE user_id = ? "
            "ORDER BY timestamp DESC LIMIT ?",
            (user_id, MAX_ACTIVITY),
        ).fetchall()

    pages_by_report = {r["report_id"]: r for r in page_rows}
    filenames = {r["id"]: r["original_filename"] for r in report_rows}
    chats, question_total = _chats(conversation_rows, message_rows, filenames)

    chats_by_report: dict[str, list[str]] = {}
    for chat in chats:
        for used in chat["reports_used"]:
            if not used["deleted"]:
                chats_by_report.setdefault(used["id"], []).append(chat["id"])

    reports = []
    for row in report_rows:
        pages = pages_by_report.get(row["id"])
        reports.append(
            {
                "id": row["id"],
                "original_filename": row["original_filename"],
                "file_hash": row["file_hash"],
                "report_date": row["report_date"],
                "upload_time": row["upload_time"],
                "version": row["version"],
                "status": row["status"],
                "error_message": row["error_message"],
                "page_count": row["page_count"],
                "chunk_count": row["chunk_count"] or 0,
                "pages_typed": int(pages["typed"]) if pages else 0,
                "pages_scanned": int(pages["scanned"]) if pages else 0,
                "pages_failed": int(pages["failed"]) if pages else 0,
                "pages_weak": int(pages["weak"]) if pages else 0,
                "chat_ids": chats_by_report.get(row["id"], []),
            }
        )

    saved_reports = [dict(r) for r in artifact_rows]
    return {
        "persona": {
            "id": user["id"],
            "display_label": user["display_label"],
            "created_at": user["created_at"],
            "consent_accepted": user_service.has_consent(user_id),
        },
        "allow_api": bool(settings.allow_api),
        "totals": {
            "reports": len(report_rows),
            "reports_ready": sum(1 for r in report_rows if r["status"] == "ready"),
            "pages": sum(int(p["total"]) for p in page_rows),
            "chunks": chunk_total,
            "chats": chat_total,
            "questions": question_total,
            "saved_reports": len(saved_reports),
            "ai_messages_sent": ledger_row["calls"],
            "details_hidden": int(ledger_row["hidden"]),
        },
        "reports": reports,
        "chats": chats,
        "saved_reports": saved_reports,
        "activity": _activity(event_rows, conversation_rows, artifact_rows, filenames),
    }


def _chats(
    conversation_rows: list[Any], message_rows: list[Any], filenames: dict[str, str]
) -> tuple[list[dict[str, Any]], int]:
    """One entry per conversation, newest first, with counts and the reports each one cited; plus all questions asked."""
    wanted = {c["id"] for c in conversation_rows}
    stats: dict[str, dict[str, Any]] = {
        cid: {"messages": 0, "questions": 0, "answered": 0, "refused": 0, "first": None, "cited": {}} for cid in wanted
    }
    question_total = 0
    for msg in message_rows:
        if msg["role"] == "user":
            question_total += 1
        entry = stats.get(msg["conversation_id"])
        if entry is None:
            continue
        entry["messages"] += 1
        if msg["role"] == "user":
            entry["questions"] += 1
            if entry["first"] is None and msg["content"]:
                entry["first"] = str(msg["content"]).strip()[:FIRST_QUESTION_CHARS]
        elif msg["role"] == "assistant":
            if msg["status"] == "answered":
                entry["answered"] += 1
            elif msg["status"] == "refused":
                entry["refused"] += 1
            for card in _evidence_cards(msg["evidence_json"]):
                report_id = card.get("report_id")
                if isinstance(report_id, str) and report_id and report_id not in entry["cited"]:
                    entry["cited"][report_id] = card.get("report_filename") or None

    chats: list[dict[str, Any]] = []
    for conv in conversation_rows:
        entry = stats[conv["id"]]
        used = [
            {
                "id": report_id,
                "filename": filenames.get(report_id) or cited_name,
                "deleted": report_id not in filenames,
            }
            for report_id, cited_name in entry["cited"].items()
        ]
        chats.append(
            {
                "id": conv["id"],
                "title": conv["title"],
                "created_at": conv["created_at"],
                "updated_at": conv["updated_at"],
                "message_count": entry["messages"],
                "questions": entry["questions"],
                "answered": entry["answered"],
                "refused": entry["refused"],
                "first_question": entry["first"],
                "reports_used": used,
            }
        )
    return chats, question_total


def _evidence_cards(raw: Any) -> list[dict[str, Any]]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return []
    return [c for c in data if isinstance(c, dict)] if isinstance(data, list) else []


def _payload(raw: Any) -> dict[str, Any]:
    try:
        data = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _plural(n: Any, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


def _activity(
    event_rows: list[Any], conversation_rows: list[Any], artifact_rows: list[Any], filenames: dict[str, str]
) -> list[dict[str, Any]]:
    """Plain-sentence feed, newest first: history events plus the chats and AI reports (those write no events)."""
    payloads = [(row, _payload(row["payload"])) for row in event_rows]
    # Names of reports that are gone are still known from their upload and delete events.
    names = dict(filenames)
    for row, payload in payloads:
        report_id = payload.get("report_id")
        if isinstance(report_id, str) and payload.get("filename"):
            names.setdefault(report_id, str(payload["filename"]))

    def name_of(report_id: Any) -> str:
        return names.get(report_id) if isinstance(report_id, str) and report_id in names else "A report"

    items: list[dict[str, Any]] = []
    for row, payload in payloads:
        kind = row["event_type"]
        report_id = payload.get("report_id") if isinstance(payload.get("report_id"), str) else None
        if kind == "persona_created":
            text = "This persona was created."
        elif kind == "consent_accepted":
            text = "You accepted the data-use statement."
        elif kind == "report_uploaded":
            version = payload.get("version")
            again = f" again (version {version})" if payload.get("duplicate_of_previous") and version else ""
            text = f"You added {name_of(report_id)}{again}."
        elif kind == "report_indexed":
            text = (
                f"{name_of(report_id)} was read and is ready: "
                f"{_plural(payload.get('pages', 0), 'page', 'pages')}, "
                f"{_plural(payload.get('chunks', 0), 'passage', 'passages')}."
            )
        elif kind == "processing_failed":
            reason = str(payload.get("error") or "").strip()[:ERROR_CHARS]
            text = f"Reading {name_of(report_id)} failed" + (f": {reason}" if reason else ".")
        elif kind == "report_deleted":
            text = f"You deleted {name_of(report_id)}."
        elif kind == "question_asked":
            text = "You asked a question" + (" and it was refused." if payload.get("status") == "refused" else ".")
        elif kind == "answer_generated":
            text = f"An answer was written from {_plural(payload.get('evidence_count', 0), 'passage', 'passages')}."
        else:
            text = str(kind).replace("_", " ").capitalize() + "."
        items.append(
            {
                "id": row["id"],
                "timestamp": row["timestamp"],
                "kind": kind,
                "text": text,
                "report_id": report_id,
                "conversation_id": None,
            }
        )

    for conv in conversation_rows:
        title = (conv["title"] or "").strip()
        items.append(
            {
                "id": f"chat-{conv['id']}",
                "timestamp": conv["created_at"],
                "kind": "chat_started",
                "text": f"You started a chat: {title}" if title else "You started a chat.",
                "report_id": None,
                "conversation_id": conv["id"],
            }
        )
    for art in artifact_rows:
        items.append(
            {
                "id": art["id"],
                "timestamp": art["created_at"],
                "kind": "ai_report_saved",
                "text": f"An AI report was saved: {art['title']}",
                "report_id": None,
                "conversation_id": art["conversation_id"],
            }
        )

    items.sort(key=lambda item: item["timestamp"], reverse=True)
    return items[:MAX_ACTIVITY]
