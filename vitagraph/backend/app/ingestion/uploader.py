"""Upload validation, raw preservation, and immutable report versions.

The original file is never modified or overwritten (plan Section 6): each
upload is stored under the user's namespace with a unique stored name, and
re-uploads of the same content create a clearly marked new version.
"""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from app.core.config import settings
from app.core.database import get_db
from app.utils.files import sha256_bytes, validate_upload


def store_upload(user_id: str, filename: str, data: bytes) -> dict:
    """Validate and preserve the raw file, returning the new report row.

    Statuses follow the plan: received -> extracting -> indexing -> ready |
    failed. This stage creates the record in 'received' state only.
    """
    validate_upload(filename, len(data))
    file_hash = sha256_bytes(data)

    report_id = f"rpt_{uuid.uuid4().hex[:12]}"
    stored_filename = f"{report_id}_v1_{Path(filename).name}"
    user_dir = settings.uploads_dir / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    (user_dir / stored_filename).write_bytes(data)

    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with get_db() as db:
        # Version is per source document (plan Section 6 duplicate policy):
        # the first upload of this exact content is v1; every re-upload of
        # the same content becomes the next clearly-marked version of it.
        duplicates = db.execute(
            "SELECT COUNT(*) AS c FROM reports WHERE user_id = ? AND file_hash = ?",
            (user_id, file_hash),
        ).fetchone()["c"]
        version = duplicates + 1

        db.execute(
            """INSERT INTO reports
               (id, user_id, original_filename, stored_filename, file_hash,
                report_date, upload_time, version, status, page_count, error_message)
               VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'received', NULL, NULL)""",
            (report_id, user_id, filename, stored_filename, file_hash, now, version),
        )

    return {
        "id": report_id,
        "user_id": user_id,
        "original_filename": filename,
        "file_hash": file_hash,
        "stored_path": str(user_dir / stored_filename),
        "version": version,
        "duplicate_of_previous": version > 1,
    }


def get_report(report_id: str) -> dict:
    with get_db() as db:
        row = db.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
    if row is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Report not found.")
    report = dict(row)
    report["stored_path"] = str(settings.uploads_dir / report["user_id"] / report["stored_filename"])
    return report


def set_status(report_id: str, status: str,
               page_count: int | None = None, error_message: str | None = None) -> None:
    with get_db() as db:
        if page_count is not None:
            db.execute(
                "UPDATE reports SET status = ?, page_count = ?, error_message = ? WHERE id = ?",
                (status, page_count, error_message, report_id),
            )
        else:
            db.execute(
                "UPDATE reports SET status = ?, error_message = ? WHERE id = ?",
                (status, error_message, report_id),
            )


def set_report_date(report_id: str, report_date: str) -> None:
    """Record the report date parsed from the document (plan Section 6)."""
    with get_db() as db:
        db.execute(
            "UPDATE reports SET report_date = ? WHERE id = ?",
            (report_date, report_id),
        )


def delete_user_files(user_id: str) -> None:
    user_dir = settings.uploads_dir / user_id
    if user_dir.exists():
        shutil.rmtree(user_dir)
