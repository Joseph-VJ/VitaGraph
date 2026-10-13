"""Tamper-evident ledger of everything sent to the AI service.

Each persona has its own hash chain (persona "" is the shared "Tools" chain), so deleting one persona never breaks
another. A row's hash covers the previous row's hash, so changing or removing any earlier row is detected when the
chain is walked again. No original identifier is ever written here: ``sent_text`` is the masked text.
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.core.database import get_db

logger = logging.getLogger(__name__)

GENESIS = "0" * 64
_lock = threading.Lock()

_HASHED_FIELDS = (
    "id", "user_id", "seq", "purpose", "created_at", "chars_original", "chars_sent", "removed_total",
    "removed_by_type", "sent_text",
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def row_hash(prev_hash: str, row: dict[str, Any]) -> str:
    canonical = json.dumps(
        {k: row[k] for k in _HASHED_FIELDS}, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    )
    return hashlib.sha256((prev_hash + "\n" + canonical).encode("utf-8")).hexdigest()


def record(
    user_id: str,
    purpose: str,
    chars_original: int,
    chars_sent: int,
    removed_total: int,
    removed_by_type: dict[str, int],
    sent_text: str,
) -> str | None:
    """Append one row to the persona's chain. Never raises into the model call: failures are logged."""
    try:
        with _lock, get_db() as db:
            last = db.execute(
                "SELECT seq, row_hash FROM privacy_ledger WHERE user_id = ? ORDER BY seq DESC LIMIT 1",
                (user_id,),
            ).fetchone()
            seq = (last["seq"] + 1) if last else 1
            prev = last["row_hash"] if last else GENESIS
            row = {
                "id": f"led_{uuid.uuid4().hex[:16]}",
                "user_id": user_id,
                "seq": seq,
                "purpose": purpose,
                "created_at": _now(),
                "chars_original": int(chars_original),
                "chars_sent": int(chars_sent),
                "removed_total": int(removed_total),
                "removed_by_type": json.dumps(removed_by_type, sort_keys=True),
                "sent_text": sent_text,
            }
            digest = row_hash(prev, row)
            db.execute(
                "INSERT INTO privacy_ledger (id, user_id, seq, purpose, created_at, chars_original, chars_sent, "
                "removed_total, removed_by_type, sent_text, prev_hash, row_hash) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (row["id"], user_id, seq, purpose, row["created_at"], row["chars_original"], row["chars_sent"],
                 row["removed_total"], row["removed_by_type"], sent_text, prev, digest),
            )
            return row["id"]
    except Exception:
        logger.exception("Could not write the privacy ledger row")
        return None


def _public(row: dict[str, Any], with_text: bool) -> dict[str, Any]:
    out = {
        "id": row["id"],
        "seq": row["seq"],
        "purpose": row["purpose"],
        "created_at": row["created_at"],
        "chars_original": row["chars_original"],
        "chars_sent": row["chars_sent"],
        "removed_total": row["removed_total"],
        "removed_by_type": json.loads(row["removed_by_type"] or "{}"),
        "prev_hash": row["prev_hash"],
        "row_hash": row["row_hash"],
    }
    if with_text:
        out["sent_text"] = row["sent_text"]
    return out


def list_rows(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Newest first, without ``sent_text``."""
    limit = max(1, min(int(limit), 200))
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM privacy_ledger WHERE user_id = ? ORDER BY seq DESC LIMIT ?", (user_id, limit)
        ).fetchall()
    return [_public(dict(r), with_text=False) for r in rows]


def get_row(user_id: str, row_id: str) -> dict[str, Any]:
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM privacy_ledger WHERE user_id = ? AND id = ?", (user_id, row_id)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Record not found.")
    return _public(dict(row), with_text=True)


def summary(user_id: str) -> dict[str, Any]:
    by_type: dict[str, int] = {}
    with get_db() as db:
        agg = db.execute(
            "SELECT COUNT(*) AS calls, COALESCE(SUM(removed_total), 0) AS removed, COALESCE(SUM(chars_sent), 0) AS chars, "
            "MAX(created_at) AS last_at FROM privacy_ledger WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        for r in db.execute("SELECT removed_by_type FROM privacy_ledger WHERE user_id = ?", (user_id,)).fetchall():
            for key, count in json.loads(r["removed_by_type"] or "{}").items():
                by_type[key] = by_type.get(key, 0) + int(count)
    return {
        "calls": agg["calls"],
        "removed_total": agg["removed"],
        "chars_sent": agg["chars"],
        "by_type": by_type,
        "last_call_at": agg["last_at"],
    }


def _all_rows(user_id: str) -> list[dict[str, Any]]:
    with get_db() as db:
        return [dict(r) for r in db.execute(
            "SELECT * FROM privacy_ledger WHERE user_id = ? ORDER BY seq ASC", (user_id,)
        ).fetchall()]


def _check(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Walk rows in order. The first row whose link or hash does not match is where the chain breaks."""
    expected_prev = GENESIS
    for index, row in enumerate(rows):
        if row["prev_hash"] != expected_prev or row_hash(row["prev_hash"], row) != row["row_hash"]:
            return {"ok": False, "checked": index + 1, "broken_at_seq": row["seq"],
                    "message": f"Record {row['seq']} was changed after it was written."}
        expected_prev = row["row_hash"]
    count = len(rows)
    message = "No records yet." if count == 0 else f"All {count} records checked. The chain is intact."
    return {"ok": True, "checked": count, "broken_at_seq": None, "message": message}


def verify_chain(user_id: str) -> dict[str, Any]:
    return _check(_all_rows(user_id))


def tamper_test(user_id: str) -> dict[str, Any]:
    """Change one character in a copy of the rows and show that verification catches it. Writes nothing."""
    rows = _all_rows(user_id)
    if not rows:
        raise HTTPException(status_code=409, detail="Nothing to test yet.")
    target = rows[len(rows) // 2]
    text = target["sent_text"]
    target["sent_text"] = ("X" if text[:1] != "X" else "Y") + text[1:] if text else "x"
    result = _check(rows)
    return {
        "changed_seq": target["seq"],
        "detected_at_seq": result["broken_at_seq"],
        "detected": (not result["ok"]) and result["broken_at_seq"] == target["seq"],
        "checked": len(rows),
    }
