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


def process_upload(user_id: str, filename: str, data: bytes, job_id: str | None = None) -> dict:
    """Run the full ingestion pipeline for one uploaded file."""
    import time
    from app.services import user_service
    from app.services.job_service import job_broker

    t_start = time.perf_counter()
    jid = job_broker.get_or_create_job(job_id) if job_id else None

    if jid:
        job_broker.publish_event(
            jid,
            stage="retrieval",
            description=f"Received upload request for '{filename}' ({len(data):,} bytes)",
            sub_description=f"User privacy namespace: {user_id}",
        )

    # Consent gate (plan Section 15.2): uploads are refused until the
    # persona has accepted the data-use statement.
    if not user_service.has_consent(user_id):
        if jid:
            job_broker.publish_error(jid, "This persona has not accepted the data-use statement yet.")
        raise HTTPException(
            status_code=403,
            detail="This persona has not accepted the data-use statement yet.",
        )

    record = uploader.store_upload(user_id, filename, data)
    report_id = record["id"]

    t_rec = time.perf_counter()
    lat_rec = max(5, int((t_rec - t_start) * 1000))
    if jid:
        job_broker.publish_event(
            jid,
            stage="received",
            description=f"Stored raw immutable upload and verified SHA-256 digest ({len(data):,} bytes)",
            sub_description=f"Hash: {record['file_hash'][:16]}... (version {record['version']})",
            latency_ms=lat_rec,
        )

    timeline_service.add_event(user_id, "report_uploaded", {
        "report_id": report_id,
        "filename": filename,
        "version": record["version"],
        "duplicate_of_previous": record["duplicate_of_previous"],
    })

    try:
        # --- Stage: extracting (pure, no DB writes yet) ----------------------
        uploader.set_status(report_id, "extracting")
        t_ext_start = time.perf_counter()

        report = uploader.get_report(report_id)
        pages = extractor.extract_report(report)

        # --- Report date capture (plan Section 6 req 4) ----------------------
        report_date = extractor.parse_report_date(pages)
        if report_date:
            uploader.set_report_date(report_id, report_date)
            report = uploader.get_report(report_id)  # refresh for chunk metadata

        t_ext_end = time.perf_counter()
        lat_ext = max(5, int((t_ext_end - t_ext_start) * 1000))
        if jid:
            job_broker.publish_event(
                jid,
                stage="extracted",
                description=f"Extracted {len(pages)} page{'s' if len(pages) != 1 else ''} and layout text layers",
                sub_description=f"Report date: {report_date or 'Undated'}",
                latency_ms=lat_ext,
            )

        # --- Stage: chunking + single-transaction persistence ----------------
        uploader.set_status(report_id, "indexing")
        t_chunk_start = time.perf_counter()

        total_chunks = 0
        with get_db() as db:
            extractor.persist_pages(db, report_id, pages)
            for page in pages:
                chunks = chunker.chunk_page(page, report)
                chunker.persist_chunks(db, chunks, report, page)
                total_chunks += len(chunks)

        if total_chunks == 0:
            raise ValueError("No text could be extracted from any page of this report.")

        t_chunk_end = time.perf_counter()
        lat_chunk = max(5, int((t_chunk_end - t_chunk_start) * 1000))
        if jid:
            job_broker.publish_event(
                jid,
                stage="chunked",
                description=f"Chunked into {total_chunks} semantic sections (target 200, max 800 chars)",
                sub_description="Preserved character spans and section headings",
                latency_ms=lat_chunk,
            )

        t_idx_start = time.perf_counter()
        with get_db() as db:
            rows = db.execute(
                "SELECT * FROM report_chunks WHERE report_id = ?", (report_id,)
            ).fetchall()
        indexed = vector_store.index_chunks([dict(row) for row in rows])
        t_idx_end = time.perf_counter()
        lat_idx = max(5, int((t_idx_end - t_idx_start) * 1000))

        if jid:
            job_broker.publish_event(
                jid,
                stage="embedded",
                description=f"Generated {indexed} dense vector embeddings via all-MiniLM-L6-v2",
                sub_description="384-dimensional dense vectors, batch_size=32",
                latency_ms=max(10, lat_idx // 2),
            )
            job_broker.publish_event(
                jid,
                stage="indexed",
                description="Indexed chunks in persistent ChromaDB collection and SQLite",
                sub_description=f"User privacy namespace: {user_id}",
                latency_ms=max(10, lat_idx // 2),
            )

        # --- Stage: graphed & ready --------------------------------------------
        uploader.set_status(report_id, "ready", page_count=len(pages))
        timeline_service.add_event(user_id, "report_indexed", {
            "report_id": report_id,
            "pages": len(pages),
            "chunks": indexed,
            "report_date": report_date,
        })

        if jid:
            job_broker.publish_event(
                jid,
                stage="graphed",
                description="Integrated report topology into personal knowledge graph",
                sub_description="Nodes and provenance relations mapped",
                latency_ms=10,
            )

        t_total = int((time.perf_counter() - t_start) * 1000)
        res_payload = {
            "id": report_id,
            "status": "ready",
            "page_count": len(pages),
            "chunk_count": indexed,
            "error_message": None,
            "file_hash": record["file_hash"],
            "job_id": jid,
        }

        if jid:
            job_broker.complete_job(
                jid,
                description=f"Ingestion complete: {len(pages)} pages, {indexed} chunks indexed ({t_total} ms)",
                latency_ms=t_total,
                metadata={"report": res_payload, "report_id": report_id, "pages": len(pages), "chunks": indexed},
            )
            job_broker.set_job_result(jid, res_payload)

        return res_payload

    except Exception as exc:
        _cleanup_failed_report(report_id)
        uploader.set_status(report_id, "failed", error_message=str(exc))
        timeline_service.add_event(user_id, "processing_failed", {
            "report_id": report_id,
            "stage": "ingestion",
            "error": str(exc)[:300],
        })
        fail_payload = {
            "id": report_id,
            "status": "failed",
            "page_count": 0,
            "chunk_count": 0,
            "error_message": str(exc),
            "file_hash": record["file_hash"] if "record" in locals() else None,
            "job_id": jid,
        }
        if jid:
            job_broker.fail_job(jid, f"Ingestion failed: {str(exc)}")
            job_broker.set_job_result(jid, fail_payload)
        return fail_payload


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
            "SELECT r.id, r.user_id, r.original_filename, r.file_hash, r.report_date, "
            "r.upload_time, r.version, r.status, r.page_count, r.error_message, "
            "(SELECT COUNT(*) FROM report_chunks rc WHERE rc.report_id = r.id) AS chunk_count "
            "FROM reports r WHERE r.user_id = ? ORDER BY r.upload_time DESC",
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


def compare_reports(
    user_id: str,
    baseline_id: str | None = None,
    followup_id: str | None = None,
) -> dict:
    """Compare extracted laboratory values between two reports for a user."""
    from app.services import user_service
    user_service.user_exists(user_id)

    from app.graph.extractor import extract_entities_from_chunk, CANONICAL_TESTS

    with get_db() as db:
        reports = db.execute(
            "SELECT id, original_filename, report_date, upload_time "
            "FROM reports WHERE user_id = ? ORDER BY upload_time ASC",
            (user_id,),
        ).fetchall()

    if not reports:
        return {
            "baseline_report_id": None,
            "followup_report_id": None,
            "baseline_filename": None,
            "followup_filename": None,
            "baseline_date": None,
            "followup_date": None,
            "rows": [],
            "summary": {
                "improved": 0,
                "declined": 0,
                "stable": 0,
                "unavailable": 0,
                "total": 0,
            },
        }

    rep_map = {r["id"]: dict(r) for r in reports}

    # If IDs not specified, pick earliest as baseline and latest as followup
    if not baseline_id or baseline_id not in rep_map:
        baseline_id = reports[0]["id"]
    if not followup_id or followup_id not in rep_map:
        followup_id = reports[-1]["id"] if len(reports) > 1 else reports[0]["id"]

    base_rep = rep_map[baseline_id]
    fol_rep = rep_map[followup_id]

    def _extract_report_ents(rep_id: str, default_date: str) -> dict[str, dict]:
        with get_db() as db:
            c_rows = db.execute(
                "SELECT id, report_id, page_number, text FROM report_chunks WHERE report_id = ?",
                (rep_id,),
            ).fetchall()
        ents_by_test = {}
        for c in c_rows:
            extracted = extract_entities_from_chunk(
                chunk_text=c["text"],
                chunk_id=c["id"],
                report_id=c["report_id"],
                page_number=c["page_number"],
                date=default_date,
            )
            for ent in extracted:
                if ent["test_name"] not in ents_by_test:
                    ents_by_test[ent["test_name"]] = ent
        return ents_by_test

    base_date = base_rep.get("report_date") or base_rep["upload_time"].split("T")[0]
    fol_date = fol_rep.get("report_date") or fol_rep["upload_time"].split("T")[0]

    base_ents = _extract_report_ents(baseline_id, base_date)
    fol_ents = _extract_report_ents(followup_id, fol_date)

    all_test_names = []
    for ct in CANONICAL_TESTS:
        if ct["name"] in base_ents or ct["name"] in fol_ents:
            all_test_names.append(ct["name"])
    for name in list(base_ents.keys()) + list(fol_ents.keys()):
        if name not in all_test_names:
            all_test_names.append(name)

    rows = []
    improved_count = 0
    declined_count = 0
    stable_count = 0
    unavail_count = 0

    lower_is_better = {
        "hba1c", "fasting glucose", "glucose, fasting", "total cholesterol",
        "ldl cholesterol", "triglycerides", "creatinine"
    }

    for t_name in all_test_names:
        b_ent = base_ents.get(t_name)
        f_ent = fol_ents.get(t_name)

        unit = (f_ent or b_ent or {}).get("unit", "")
        category = (f_ent or b_ent or {}).get("category", "General")
        page_num = (f_ent or b_ent or {}).get("page_number", 1)
        citation = f"p. {page_num}"

        if b_ent is not None and f_ent is not None:
            b_val = b_ent["value"]
            f_val = f_ent["value"]
            delta = round(f_val - b_val, 2)

            is_lower_better = any(lib in t_name.lower() for lib in lower_is_better)

            if delta == 0:
                delta_type = "improving"
                delta_label = "0.0 stable"
                status = "stable"
                stable_count += 1
            elif is_lower_better:
                if delta < 0:
                    delta_type = "improving"
                    delta_label = f"{delta:+.1f} improving"
                    status = "improved"
                    improved_count += 1
                else:
                    delta_type = "increase"
                    delta_label = f"{delta:+.1f} increase"
                    status = "declined"
                    declined_count += 1
            else:
                if delta > 0:
                    delta_type = "improving"
                    delta_label = f"{delta:+.1f} improving"
                    status = "improved"
                    improved_count += 1
                else:
                    delta_type = "decrease"
                    delta_label = f"{delta:+.1f} slight decrease"
                    status = "declined"
                    declined_count += 1

            rows.append({
                "test": t_name,
                "category": category,
                "unit": unit,
                "baseline": str(b_val),
                "followup": str(f_val),
                "delta_type": delta_type,
                "delta_label": delta_label,
                "status": status,
                "citation": citation,
            })
        elif f_ent is not None:
            f_val = f_ent["value"]
            rows.append({
                "test": t_name,
                "category": category,
                "unit": unit,
                "baseline": "—",
                "followup": str(f_val),
                "delta_type": "new",
                "delta_label": "new result",
                "status": "improved",
                "citation": citation,
            })
            improved_count += 1
        else:
            b_val = b_ent["value"]
            rows.append({
                "test": t_name,
                "category": category,
                "unit": unit,
                "baseline": str(b_val),
                "followup": "—",
                "delta_type": "stable",
                "delta_label": "unavailable",
                "status": "unavailable",
                "citation": citation,
            })
            unavail_count += 1

    return {
        "baseline_report_id": base_rep["id"],
        "followup_report_id": fol_rep["id"],
        "baseline_filename": base_rep["original_filename"],
        "followup_filename": fol_rep["original_filename"],
        "baseline_date": base_date,
        "followup_date": fol_date,
        "rows": rows,
        "summary": {
            "improved": improved_count,
            "declined": declined_count,
            "stable": stable_count,
            "unavailable": unavail_count,
            "total": len(rows),
        },
    }
