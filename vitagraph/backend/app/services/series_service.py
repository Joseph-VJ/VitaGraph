"""Time-series service for knowledge graph test measurements across reports.

Provides the series endpoint dataset for persona health records, mapping tests
and their measured values, units, reference ranges, flags, and text spans across
chronologically ordered reports.
"""

from __future__ import annotations

from typing import Any

from app.core.database import get_db
from app.services import measurement_service
from app.services.node_summary import _date_key, _page, _range_from_text

# Module-level cache for report measurements: (report_id, chunk_count) -> list[dict]
_MEASUREMENTS_CACHE: dict[tuple[str, int], list[dict[str, Any]]] = {}


def clear_cache() -> None:
    """Clear the module-level measurements cache (used in testing)."""
    _MEASUREMENTS_CACHE.clear()


def _get_report_measurements(
    report_id: str,
    chunk_count: int | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    """Retrieve and cache measurements for a report, augmenting missing ranges from page text."""
    if chunk_count is None or status is None:
        with get_db() as db:
            row = db.execute(
                """
                SELECT status,
                       (SELECT COUNT(*) FROM report_chunks c WHERE c.report_id = reports.id) AS chunk_count
                FROM reports WHERE id = ?
                """,
                (report_id,),
            ).fetchone()
            if row:
                status = row["status"]
                chunk_count = row["chunk_count"]
            else:
                status = "ready"
                chunk_count = 0

    status_norm = (status or "").lower()

    # Never cache a report whose ingestion is not finished: contribute no points until ready
    if status_norm not in ("ready", "indexed", "failed"):
        return []

    cache_key = (report_id, chunk_count or 0)
    if cache_key in _MEASUREMENTS_CACHE:
        return _MEASUREMENTS_CACHE[cache_key]

    # A failed report is cached (it will not change) and yields no points
    if status_norm == "failed":
        _MEASUREMENTS_CACHE[cache_key] = []
        return []

    raw_measurements = measurement_service.list_report_measurements(report_id)
    processed: list[dict[str, Any]] = []

    for m in raw_measurements:
        range_text = m.get("reference_range")
        if not range_text:
            page_text, _, _ = _page(report_id, m["page_number"])
            range_text = _range_from_text(page_text, m.get("char_end", 0))

        if range_text:
            low, high = measurement_service.parse_range(range_text)
        else:
            range_text = None
            low, high = None, None

        processed.append({
            "test_name": m["test_name"],
            "category": m.get("category") or "General",
            "value": float(m["value"]),
            "unit": m.get("unit") or "",
            "flag": (m.get("flag") or "NORMAL").upper(),
            "range_text": range_text,
            "range_low": low,
            "range_high": high,
            "page_number": m["page_number"],
            "chunk_id": m.get("chunk_id"),
            "char_start": m.get("char_start"),
            "char_end": m.get("char_end"),
        })

    # Evict any older cache entry for this report_id (e.g. from previous chunk count)
    for k in list(_MEASUREMENTS_CACHE.keys()):
        if isinstance(k, tuple) and k[0] == report_id and k != cache_key:
            _MEASUREMENTS_CACHE.pop(k, None)

    _MEASUREMENTS_CACHE[cache_key] = processed
    return processed


def get_series(user_id: str) -> dict[str, Any]:
    """Build the series data structure for all reports and tests of a user."""
    with get_db() as db:
        # Drop cache entries for reports that no longer exist in the database
        all_report_rows = db.execute("SELECT id FROM reports").fetchall()
        existing_report_ids = {r["id"] for r in all_report_rows}
        for cached_key in list(_MEASUREMENTS_CACHE.keys()):
            cached_rid = cached_key[0] if isinstance(cached_key, tuple) else cached_key
            if cached_rid not in existing_report_ids:
                _MEASUREMENTS_CACHE.pop(cached_key, None)

        rows = db.execute(
            """
            SELECT r.id, r.original_filename, r.report_date, r.upload_time, r.status,
                   (SELECT COUNT(*) FROM report_chunks c WHERE c.report_id = r.id) AS chunk_count
            FROM reports r
            WHERE r.user_id = ?
            """,
            (user_id,),
        ).fetchall()

    if not rows:
        return {"reports": [], "tests": []}

    # Chronological sort: dated reports in time order, undated last; ties by upload_time
    sorted_reports = sorted(
        rows,
        key=lambda r: (_date_key(r["report_date"]), r["upload_time"] or ""),
    )

    reports_out: list[dict[str, Any]] = []
    report_order_map: dict[str, tuple[int, str | None]] = {}

    for idx, r in enumerate(sorted_reports):
        d_raw = r["report_date"]
        is_unknown = not d_raw or not str(d_raw).strip() or str(d_raw).strip().lower() == "unknown date"
        date_str = None if is_unknown else str(d_raw).strip()
        k = _date_key(d_raw)
        date_iso = k[1] if k[0] == 0 else None

        reports_out.append({
            "report_id": r["id"],
            "filename": r["original_filename"],
            "date": date_str,
            "date_iso": date_iso,
            "order": idx,
        })
        report_order_map[r["id"]] = (idx, date_str)

    # Group tests across reports (case-insensitive merge of names)
    tests_map: dict[str, dict[str, Any]] = {}

    for r in sorted_reports:
        r_id = r["id"]
        order, date_str = report_order_map[r_id]
        meas_list = _get_report_measurements(r_id, chunk_count=r["chunk_count"], status=r["status"])

        for m in meas_list:
            name = m["test_name"]
            node_id = f"test_{name.replace(' ', '_')}"
            key = node_id

            if key not in tests_map:
                tests_map[key] = {
                    "node_id": node_id,
                    "name": name,
                    "unit": m["unit"],
                    "category": m["category"],
                    "points": [],
                }
            elif not tests_map[key]["unit"] and m["unit"]:
                tests_map[key]["unit"] = m["unit"]

            tests_map[key]["points"].append({
                "report_id": r_id,
                "order": order,
                "date": date_str,
                "value": m["value"],
                "flag": m["flag"],
                "range_text": m["range_text"],
                "range_low": m["range_low"],
                "range_high": m["range_high"],
                "page_number": m["page_number"],
                "chunk_id": m["chunk_id"],
                "char_start": m["char_start"],
                "char_end": m["char_end"],
            })

    tests_out = list(tests_map.values())
    tests_out.sort(key=lambda t: t["name"].lower())

    for t in tests_out:
        t["points"].sort(key=lambda p: p["order"])

    return {
        "reports": reports_out,
        "tests": tests_out,
    }
