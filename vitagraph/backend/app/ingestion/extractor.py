"""Text extraction with page provenance (plan Section 7).

Native PyMuPDF extraction runs first; per-page quality is measured; only
sparse pages go to the OCR fallback. Native and OCR results are labeled
separately so provenance always shows how each page's text was obtained.

Extraction is a pure function of the stored file: rows are persisted by the
caller in one transaction (plan Section 8 failure handling — no partial
page rows can survive a mid-report crash).

Health-report rule: values, units, decimals, comparison symbols, and
reference ranges are preserved exactly — whitespace is normalized, but the
text itself is never "corrected".
"""

from __future__ import annotations

import re
import uuid

import pymupdf as fitz  # PyMuPDF

from app.ingestion import ocr_fallback

# A page with fewer than this many extracted characters is a candidate for OCR.
SPARSE_PAGE_CHARS = 40

# Header lines that carry the report date (plan Section 6 requirement 4).
_DATE_LINE = re.compile(
    r"^\s*(?:collection\s+date|report\s+date|date)\s*:\s*(.+?)\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def _normalize_whitespace(text: str) -> str:
    """Collapse repeated blank space without touching the text content."""
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_report_date(pages: list[dict]) -> str | None:
    """Return the first date-looking header line across pages, if any.

    The date is kept in its original extracted form (e.g. "15 January 2025")
    so display always matches the source text exactly.
    """
    for page in pages:
        match = _DATE_LINE.search(page["text"])
        if match:
            value = match.group(1).strip()
            if value:
                return value
    return None


def extract_report(report: dict) -> list[dict]:
    """Extract every page of a stored report. Pure — performs no DB writes."""
    report_id = report["id"]
    doc = fitz.open(report["stored_path"])
    pages: list[dict] = []

    try:
        for page_number, page in enumerate(doc, start=1):
            page_id = f"pg_{uuid.uuid4().hex[:12]}"
            raw_text = _normalize_whitespace(page.get_text("text"))
            note = None

            if len(raw_text) >= SPARSE_PAGE_CHARS:
                method, quality = "native", "good"
            else:
                # Sparse page: try the OCR fallback (may be unavailable).
                ocr_result = ocr_fallback.ocr_page(doc, page_number - 1)
                if ocr_result.ok:
                    raw_text = _normalize_whitespace(ocr_result.text)
                    method = "ocr"
                    quality = "uncertain" if ocr_result.low_confidence else "good"
                    note = ocr_result.note
                else:
                    method = "failed" if not raw_text else "native"
                    quality = "failed" if not raw_text else "sparse"
                    note = ocr_result.note

            pages.append({
                "page_id": page_id,
                "report_id": report_id,
                "page_number": page_number,
                "text": raw_text,
                "method": method,
                "quality": quality,
                "text_length": len(raw_text),
                "note": note,
            })
    finally:
        doc.close()

    return pages


def persist_pages(db, report_id: str, pages: list[dict]) -> None:
    """Write page rows using the caller's open transaction."""
    db.executemany(
        """INSERT INTO report_pages
           (id, report_id, page_number, extracted_text,
            extraction_method, text_length, quality)
           VALUES (:page_id, :report_id, :page_number, :text,
                   :method, :text_length, :quality)""",
        pages,
    )
