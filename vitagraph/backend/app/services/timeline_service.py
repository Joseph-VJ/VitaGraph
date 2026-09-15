"""Internal persona timeline (plan Section 13).

Timeline entries record identifiers, statuses, and counts — not unnecessary
raw health text.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from app.core.database import get_db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def add_event(user_id: str, event_type: str, payload: dict) -> str:
    event_id = f"evt_{uuid.uuid4().hex[:12]}"
    with get_db() as db:
        db.execute(
            "INSERT INTO history_events (id, user_id, event_type, timestamp, payload)"
            " VALUES (?, ?, ?, ?, ?)",
            (event_id, user_id, event_type, _now(), json.dumps(payload)),
        )
    return event_id


def list_events(user_id: str) -> list[dict]:
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM history_events WHERE user_id = ? ORDER BY timestamp DESC",
            (user_id,),
        ).fetchall()
    events = []
    for row in rows:
        item = dict(row)
        try:
            item["payload"] = json.loads(item["payload"])
        except json.JSONDecodeError:
            item["payload"] = {}
        events.append(item)
    return events


def list_ai_calls(user_id: str) -> list[dict]:
    """Return the AI-call audit rows for a user (newest first)."""
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM ai_calls WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return [dict(row) for row in rows]
