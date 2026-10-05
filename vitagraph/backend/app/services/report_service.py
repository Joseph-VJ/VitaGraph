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

import re

from fastapi import HTTPException

from app.core.database import get_db
from app.ingestion import chunker, extractor, uploader
from app.rag import vector_store
from app.services import timeline_service


def process_upload(user_id: str, filename: str, data: bytes, job_id: str | None = None, chunk_size: int | None = None) -> dict:
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
            metadata={
                "filename": filename,
                "file_hash": record["file_hash"],
                "size_bytes": len(data),
                "version": record["version"],
                "duplicate_of_previous": bool(record["duplicate_of_previous"]),
            },
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

        def _on_page(page: dict, total: int) -> None:
            if not jid:
                return
            job_broker.publish_event(
                jid,
                stage="extracting",
                description=f"Page {page['page_number']}/{total} extracted ({page['method']})",
                sub_description=page.get("note") or "",
                metadata={
                    "page_number": page["page_number"],
                    "total_pages": total,
                    "method": page["method"],
                    "quality": page["quality"],
                    "chars": page["text_length"],
                    "note": page.get("note"),
                    "ocr_boxes": page.get("ocr_boxes") or [],
                    "text_preview": page["text"][:240],
                },
                event_type="page_extracted",
            )

        pages = extractor.extract_report(report, on_page=_on_page)

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
                metadata={
                    "page_count": len(pages),
                    "total_chars": sum(p["text_length"] for p in pages),
                    "report_date": report_date,
                    "pages": [
                        {"page_number": p["page_number"], "method": p["method"],
                         "quality": p["quality"], "chars": p["text_length"]}
                        for p in pages
                    ],
                },
            )

        # --- Stage: chunking + single-transaction persistence ----------------
        uploader.set_status(report_id, "indexing")
        t_chunk_start = time.perf_counter()

        total_chunks = 0
        with get_db() as db:
            extractor.persist_pages(db, report_id, pages)
            for page in pages:
                chunks = chunker.chunk_page(page, report, target_chars=chunk_size)
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
                metadata=_chunk_payload(report_id, total_chunks),
            )

        t_idx_start = time.perf_counter()
        t_embed_end = t_idx_start

        def _on_embedded():
            nonlocal t_embed_end
            t_embed_end = time.perf_counter()

        with get_db() as db:
            rows = db.execute(
                "SELECT * FROM report_chunks WHERE report_id = ?", (report_id,)
            ).fetchall()
        chunk_rows = [dict(row) for row in rows]
        indexed = vector_store.index_chunks(chunk_rows, on_embedded=_on_embedded)
        t_idx_end = time.perf_counter()
        lat_embed = max(1, int((t_embed_end - t_idx_start) * 1000))
        lat_idx = max(1, int((t_idx_end - t_embed_end) * 1000))

        if jid:
            job_broker.publish_event(
                jid,
                stage="embedded",
                description=f"Generated {indexed} dense vector embeddings via all-MiniLM-L6-v2",
                sub_description="384-dimensional dense vectors, batch_size=32",
                latency_ms=lat_embed,
                metadata=_embedded_payload(chunk_rows, indexed),
            )
            job_broker.publish_event(
                jid,
                stage="indexed",
                description="Indexed chunks in persistent ChromaDB collection and SQLite",
                sub_description=f"User privacy namespace: {user_id}",
                latency_ms=lat_idx,
                metadata={
                    "indexed": indexed,
                    "collection_total": _safe_collection_count(),
                    "metric": "cosine",
                    "index": "hnsw",
                    "ready_for_search": True,
                },
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
            t_graph_start = time.perf_counter()
            graph_meta = _graph_payload(user_id, report_id)
            lat_graph = max(1, int((time.perf_counter() - t_graph_start) * 1000))
            job_broker.publish_event(
                jid,
                stage="graphed",
                description="Integrated report topology into personal knowledge graph",
                sub_description="Nodes and provenance relations mapped",
                latency_ms=lat_graph,
                metadata=graph_meta,
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
        public_error = _public_error(exc)
        _cleanup_failed_report(report_id)
        uploader.set_status(report_id, "failed", error_message=public_error)
        timeline_service.add_event(user_id, "processing_failed", {
            "report_id": report_id,
            "stage": "ingestion",
            "error": public_error[:300],
        })
        fail_payload = {
            "id": report_id,
            "status": "failed",
            "page_count": 0,
            "chunk_count": 0,
            "error_message": public_error,
            "file_hash": record["file_hash"] if "record" in locals() else None,
            "job_id": jid,
        }
        if jid:
            job_broker.fail_job(jid, f"Ingestion failed: {public_error}")
            job_broker.set_job_result(jid, fail_payload)
        return fail_payload


_ABS_PATH_RE = re.compile(r"""(?:[A-Za-z]:[\\/]|/)(?:[^\s'"]+[\\/])+[^\s'"]*""")


def _public_error(exc: Exception) -> str:
    """Client-safe failure reason: never leaks server filesystem paths."""
    msg = str(exc)
    low = msg.lower()
    if "failed to open file" in low or "filedataerror" in low or "cannot open broken document" in low:
        return "The file could not be read as a PDF (it may be corrupted or not a PDF)."
    return _ABS_PATH_RE.sub("<file>", msg)


def _chunk_payload(report_id: str, total_chunks: int, limit: int = 12) -> dict:
    with get_db() as db:
        rows = db.execute(
            "SELECT id, page_number, sequence, text, char_start, char_end, section "
            "FROM report_chunks WHERE report_id = ? ORDER BY page_number, sequence LIMIT ?",
            (report_id, limit),
        ).fetchall()
    return {
        "total_chunks": total_chunks,
        "shown": len(rows),
        "chunks": [
            {
                "chunk_id": r["id"],
                "page_number": r["page_number"],
                "char_start": r["char_start"],
                "char_end": r["char_end"],
                "section": r["section"],
                "chars": len(r["text"]),
                "preview": r["text"][:160],
            }
            for r in rows
        ],
    }


def _embedded_payload(chunk_rows: list[dict], indexed: int) -> dict:
    from app.rag import embedder

    ids = [r["id"] for r in chunk_rows[:3]]
    try:
        samples = vector_store.sample_embeddings(ids, n_values=8)
    except Exception:
        samples = []
    return {
        "count": indexed,
        "model": "all-MiniLM-L6-v2",
        "model_version": embedder.model_version(),
        "dim": samples[0]["dim"] if samples else 384,
        "samples": samples,
    }


def _safe_collection_count() -> int | None:
    try:
        return vector_store.collection_count()
    except Exception:
        return None


def _graph_payload(user_id: str, report_id: str, label_limit: int = 40) -> dict:
    """Real counts and labels from the user's graph after this report was integrated."""
    try:
        from app.graph import builder

        graph, _ = builder.build_user_graph(user_id)
        metrics = builder.serialize_graph(graph)["metrics"]
        labels = []
        for node_id, data in graph.nodes(data=True):
            if len(labels) >= label_limit:
                break
            labels.append({
                "id": node_id,
                "label": data.get("label") or data.get("name") or str(node_id),
                "type": data.get("type") or data.get("category") or "node",
                "report_id": data.get("report_id"),
            })
        return {
            "total_nodes": metrics["total_nodes"],
            "total_edges": metrics["total_edges"],
            "communities": metrics["communities_count"],
            "nodes": labels,
        }
    except Exception as exc:  # real failure is reported, never faked
        return {"error": f"Graph build failed: {exc}"}


def _cleanup_failed_report(report_id: str) -> None:
    """Remove partial rows and vectors for a failed ingestion attempt."""
    try:
        vector_store.delete_report_chunks(report_id)
        with get_db() as db:
            db.execute("DELETE FROM report_chunks WHERE report_id = ?", (report_id,))
            db.execute("DELETE FROM report_pages WHERE report_id = ?", (report_id,))
    except Exception:
        pass  # cleanup is best-effort; the failed status is already recorded


def render_page_png(report_id: str, page_number: int, dpi: int = 110) -> bytes:
    """Render a page of the stored PDF to PNG bytes (404 when the report/page does not exist)."""
    import pymupdf

    report = uploader.get_report(report_id)
    try:
        doc = pymupdf.open(report["stored_path"])
    except Exception:
        raise HTTPException(status_code=404, detail="Stored file is not available.")
    try:
        if page_number < 1 or page_number > len(doc):
            raise HTTPException(status_code=404, detail="Page not found.")
        return doc[page_number - 1].get_pixmap(dpi=dpi).tobytes("png")
    finally:
        doc.close()


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


def assert_report_owner(report_id: str, user_id: str) -> dict:
    report = uploader.get_report(report_id)
    if report.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Report not found.")
    return report


def get_chunk(report_id: str, chunk_id: str) -> dict:
    uploader.get_report(report_id)  # 404 if unknown
    with get_db() as db:
        row = db.execute(
            "SELECT id, report_id, page_number, sequence, section, char_start, char_end, text "
            "FROM report_chunks WHERE id = ? AND report_id = ?",
            (chunk_id, report_id),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Chunk not found in this report.")
    d = dict(row)
    d["chunk_id"] = d.pop("id")
    return d


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
