"""Report ingestion orchestration (plan Sections 6–8 pipeline).

Drives one upload through the real status lifecycle:
    received -> extracting -> indexing -> ready | failed

(The plan's full vocabulary also includes a 'graphing' stage; it arrives
with the Phase-6 knowledge graph and is intentionally absent now.)

Stage order: consent check -> raw storage -> extraction (pure) -> report
date capture -> chunking (pure) -> single-transaction persistence ->
vector indexing -> ready. Pages and chunks are written in ONE transaction,
and a failure removes every partial row for the report, so no orphan
evidence can survive a mid-report crash.
"""

from __future__ import annotations

from fastapi import HTTPException

from app.core.database import get_db
from app.ingestion import chunker, extractor, uploader
from app.rag import vector_store
from app.services import timeline_service


def process_upload(user_id: str, filename: str, data: bytes) -> dict:
    """Run the full ingestion pipeline for one uploaded file."""
    from app.services import user_service

    # Consent gate (plan Section 15.2): uploads are refused until the
    # persona has accepted the data-use statement.
    if not user_service.has_consent(user_id):
        raise HTTPException(
            status_code=403,
            detail="This persona has not accepted the data-use statement yet.",
        )

    record = uploader.store_upload(user_id, filename, data)
    report_id = record["id"]

    timeline_service.add_event(user_id, "report_uploaded", {
        "report_id": report_id,
        "filename": filename,
        "version": record["version"],
        "duplicate_of_previous": record["duplicate_of_previous"],
    })

    try:
        # --- Stage: extracting (pure, no DB writes yet) ----------------------
        uploader.set_status(report_id, "extracting")
        report = uploader.get_report(report_id)
        pages = extractor.extract_report(report)

        # --- Report date capture (plan Section 6 req 4) ----------------------
        report_date = extractor.parse_report_date(pages)
        if report_date:
            uploader.set_report_date(report_id, report_date)
            report = uploader.get_report(report_id)  # refresh for chunk metadata

        # --- Stage: chunking + single-transaction persistence ----------------
        uploader.set_status(report_id, "indexing")
        total_chunks = 0
        with get_db() as db:
            extractor.persist_pages(db, report_id, pages)
            for page in pages:
                chunks = chunker.chunk_page(page, report)
                chunker.persist_chunks(db, chunks, report, page)
                total_chunks += len(chunks)

        if total_chunks == 0:
            raise ValueError("No text could be extracted from any page of this report.")

        with get_db() as db:
            rows = db.execute(
                "SELECT * FROM report_chunks WHERE report_id = ?", (report_id,)
            ).fetchall()
        indexed = vector_store.index_chunks([dict(row) for row in rows])

        # --- Stage: ready ------------------------------------------------------
        uploader.set_status(report_id, "ready", page_count=len(pages))
        timeline_service.add_event(user_id, "report_indexed", {
            "report_id": report_id,
            "pages": len(pages),
            "chunks": indexed,
            "report_date": report_date,
        })

        return {
            "id": report_id,
            "status": "ready",
            "page_count": len(pages),
            "chunk_count": indexed,
            "error_message": None,
        }

    except Exception as exc:
        # Fail visibly AND clean up every partial record of this attempt so
        # no orphan page/chunk rows survive (plan Section 8 failure handling).
        _cleanup_failed_report(report_id)
        uploader.set_status(report_id, "failed", error_message=str(exc))
        timeline_service.add_event(user_id, "processing_failed", {
            "report_id": report_id,
            "stage": "ingestion",
            "error": str(exc)[:300],
        })
        return {
            "id": report_id,
            "status": "failed",
            "page_count": None,
            "chunk_count": 0,
            "error_message": str(exc),
        }


def _cleanup_failed_report(report_id: str) -> None:
    """Remove partial rows and vectors for a failed ingestion attempt."""
    try:
        vector_store.delete_report_chunks(report_id)
        with get_db() as db:
            db.execute("DELETE FROM report_chunks WHERE report_id = ?", (report_id,))
            db.execute("DELETE FROM report_pages WHERE report_id = ?", (report_id,))
    except Exception:
        pass  # cleanup is best-effort; the failed status is already recorded


def list_reports(user_id: str) -> list[dict]:
    with get_db() as db:
        rows = db.execute(
            "SELECT id, user_id, original_filename, file_hash, report_date, "
            "upload_time, version, status, page_count, error_message "
            "FROM reports WHERE user_id = ? ORDER BY upload_time DESC",
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]


def get_status(report_id: str) -> dict:
    report = uploader.get_report(report_id)
    with get_db() as db:
        chunk_count = db.execute(
            "SELECT COUNT(*) AS c FROM report_chunks WHERE report_id = ?", (report_id,)
        ).fetchone()["c"]
    return {
        "id": report["id"],
        "status": report["status"],
        "page_count": report["page_count"],
        "chunk_count": chunk_count,
        "error_message": report["error_message"],
    }


def get_pages(report_id: str) -> list[dict]:
    uploader.get_report(report_id)  # 404 if unknown
    with get_db() as db:
        rows = db.execute(
            "SELECT page_number, extraction_method, text_length, quality, extracted_text "
            "FROM report_pages WHERE report_id = ? ORDER BY page_number",
            (report_id,),
        ).fetchall()
        return [dict(row) for row in rows]


def get_user_trends(user_id: str, test_name: str = "Hemoglobin") -> dict:
    """Extract longitudinal test trend points across all reports for a user."""
    from app.services import user_service
    user_service.user_exists(user_id)

    from app.graph.extractor import extract_entities_from_chunk

    with get_db() as db:
        rows = db.execute(
            "SELECT rc.id, rc.report_id, rc.page_number, rc.text, r.report_date, r.original_filename "
            "FROM report_chunks rc "
            "JOIN reports r ON rc.report_id = r.id "
            "WHERE rc.user_id = ? "
            "ORDER BY r.report_date ASC, r.upload_time ASC",
            (user_id,),
        ).fetchall()

    matches = []
    seen_dates_values = set()

    for row in rows:
        r_dict = dict(row)
        date_str = r_dict.get("report_date") or "Unknown"
        ents = extract_entities_from_chunk(
            chunk_text=r_dict["text"],
            chunk_id=r_dict["id"],
            report_id=r_dict["report_id"],
            page_number=r_dict["page_number"],
            date=date_str,
        )
        for ent in ents:
            if test_name.lower() in ent["test_name"].lower():
                key = (ent["date"], ent["value"])
                if key not in seen_dates_values:
                    seen_dates_values.add(key)
                    matches.append(ent)

    matches.sort(key=lambda m: m["date"])

    trend_dir = "stable"
    start_val = matches[0]["value"] if matches else None
    latest_val = matches[-1]["value"] if matches else None
    unit = matches[0]["unit"] if matches else "g/dL"
    canonical_test = matches[0]["test_name"] if matches else test_name

    if len(matches) > 1 and start_val is not None and latest_val is not None:
        if latest_val > start_val:
            trend_dir = "improving"
        elif latest_val < start_val:
            trend_dir = "declining"
        else:
            trend_dir = "stable"
    elif len(matches) == 1:
        trend_dir = "single_reading"

    return {
        "test_name": canonical_test,
        "unit": unit,
        "points": [
            {
                "date": m["date"],
                "value": m["value"],
                "flag": m["flag"],
                "report_id": m["report_id"],
                "page_number": m["page_number"],
            }
            for m in matches
        ],
        "trend_direction": trend_dir,
        "start_value": start_val,
        "latest_value": latest_val,
    }
