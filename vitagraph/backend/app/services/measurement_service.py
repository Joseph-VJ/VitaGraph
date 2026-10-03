"""Per-report measurements with the report's own reference ranges and exact character spans.

Values come from the same extractor that feeds the knowledge graph, so the Library, the graph and
the answers always agree. Nothing is typed in: the reference range is the text printed in the
report, and the character span points into the stored page text so a UI can highlight the exact
characters the value was read from.
"""

from __future__ import annotations

import re

from fastapi import HTTPException

from app.core.database import get_db
from app.graph import extractor

_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")
_RANGE = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*[-–—]\s*(\d[\d,]*(?:\.\d+)?)")
_UPPER_ONLY = re.compile(r"(?:<|≤|up to|below)\s*=?\s*(\d[\d,]*(?:\.\d+)?)", re.IGNORECASE)
_LOWER_ONLY = re.compile(r"(?:>|≥|above)\s*=?\s*(\d[\d,]*(?:\.\d+)?)", re.IGNORECASE)


def _to_float(token: str) -> float | None:
    try:
        return float(token.replace(",", ""))
    except ValueError:
        return None


def parse_range(reference_range: str | None) -> tuple[float | None, float | None]:
    """Return (low, high) numbers from a printed reference range, or (None, None)."""
    if not reference_range:
        return None, None
    m = _RANGE.search(reference_range)
    if m:
        return _to_float(m.group(1)), _to_float(m.group(2))
    m = _UPPER_ONLY.search(reference_range)
    if m:
        return None, _to_float(m.group(1))
    m = _LOWER_ONLY.search(reference_range)
    if m:
        return _to_float(m.group(1)), None
    return None, None


def _locate(page_text: str, chunk_start: int, chunk_end: int, value: float, test_name: str) -> tuple[int, int, bool]:
    """Find the character span of `value` inside the chunk's part of the page text.

    Prefers a number that sits right after the test name. Falls back to the chunk span itself
    (span_exact False) when the number cannot be pinned down, never to a made-up position.
    """
    lo = max(0, chunk_start)
    hi = min(len(page_text), chunk_end + 1)
    window = page_text[lo:hi]
    first_word = (re.split(r"[\s,(]+", test_name.strip().lower()) or [""])[0]
    best: tuple[int, int] | None = None
    for m in _NUMBER.finditer(window):
        if _to_float(m.group(0)) != value:
            continue
        before = window[max(0, m.start() - 90): m.start()].lower()
        if first_word and first_word in before:
            return lo + m.start(), lo + m.end(), True
        if best is None:
            best = (lo + m.start(), lo + m.end())
    if best is not None:
        return best[0], best[1], True
    return lo, hi, False


def list_report_measurements(report_id: str) -> list[dict]:
    """One row per test found in the report (first occurrence in page order)."""
    with get_db() as db:
        report = db.execute("SELECT id, report_date FROM reports WHERE id = ?", (report_id,)).fetchone()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found.")
        pages = {
            r["page_number"]: r["extracted_text"]
            for r in db.execute(
                "SELECT page_number, extracted_text FROM report_pages WHERE report_id = ?", (report_id,)
            ).fetchall()
        }
        chunks = db.execute(
            "SELECT id, page_number, text, char_start, char_end FROM report_chunks "
            "WHERE report_id = ? ORDER BY page_number, sequence",
            (report_id,),
        ).fetchall()

    seen: set[str] = set()
    out: list[dict] = []
    for chunk in chunks:
        entities = extractor.extract_entities_from_chunk(
            chunk["text"],
            chunk_id=chunk["id"],
            report_id=report_id,
            page_number=chunk["page_number"],
            date=report["report_date"],
        )
        for ent in entities:
            name = ent["test_name"]
            if name.lower() in seen:
                continue
            seen.add(name.lower())
            page_text = pages.get(chunk["page_number"], "")
            start, end, exact = _locate(page_text, chunk["char_start"], chunk["char_end"], ent["value"], name)
            low, high = parse_range(ent.get("reference_range"))
            out.append({
                "test_name": name,
                "category": ent.get("category") or "General",
                "value": ent["value"],
                "unit": ent.get("unit") or "",
                "reference_range": ent.get("reference_range"),
                "range_low": low,
                "range_high": high,
                "flag": ent.get("flag") or "NORMAL",
                "page_number": chunk["page_number"],
                "chunk_id": chunk["id"],
                "char_start": start,
                "char_end": end,
                "span_exact": exact,
            })
    return out
