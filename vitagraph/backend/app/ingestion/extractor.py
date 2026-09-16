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

# A page with fewer than this many extracted characters is scan-suspect per US-16.
SCAN_SUSPECT_PAGE_CHARS = 400

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


def _has_full_page_image(page) -> bool:
    """Check if page contains a full-page or substantial image (>40% of page area)."""
    try:
        page_area = page.rect.width * page.rect.height
        if page_area <= 0:
            return False
        images = page.get_images()
        if not images:
            return False
        for img_info in images:
            xref = img_info[0]
            for r in page.get_image_rects(xref):
                if (r.width * r.height) >= 0.40 * page_area:
                    return True
    except Exception:
        pass
    return False


def _is_scan_suspect(page, raw_text: str) -> bool:
    """Page is scan-suspect if text_chars < 400 OR full-page image present (US-16)."""
    if len(raw_text.strip()) < SCAN_SUSPECT_PAGE_CHARS:
        return True
    return _has_full_page_image(page)


def _extract_and_normalize_tables(page) -> list[str]:
    """Find tables on page and normalize rows to single-line 'Name value unit range flag' (US-16)."""
    normalized: list[str] = []
    try:
        tabs = page.find_tables()
        if tabs and tabs.tables:
            for tab in tabs.tables:
                extracted = tab.extract()
                if not extracted or len(extracted) < 2:
                    continue
                # Skip header row, process data rows
                for row in extracted[1:]:
                    cells = [
                        str(c).strip().replace("\n", " ")
                        for c in row
                        if c is not None and str(c).strip()
                    ]
                    if not cells:
                        continue
                    line = " ".join(cells)
                    if any(ch.isdigit() for ch in line) and len(line) >= 4:
                        normalized.append(line)
    except Exception:
        pass
    return normalized


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
    """Extract every page of a stored report with scan detection and table normalization (US-16)."""
    report_id = report["id"]
    doc = fitz.open(report["stored_path"])
    pages: list[dict] = []

    try:
        for page_number, page in enumerate(doc, start=1):
            page_id = f"pg_{uuid.uuid4().hex[:12]}"
            raw_text = _normalize_whitespace(page.get_text("text"))
            note = None

            # Table extraction and normalization per US-16
            table_rows = _extract_and_normalize_tables(page)
            if table_rows:
                table_block = "\n" + "\n".join(table_rows)
                if not any(row in raw_text for row in table_rows):
                    raw_text = (raw_text + "\n\nTable Measurements:\n" + table_block).strip()

            # Scan detection per US-16 (text_chars < 400 OR full-page image present)
            if not _is_scan_suspect(page, raw_text):
                method, quality = "native", "good"
            else:
                # Scan-suspect page: trigger OCR engine hierarchy (Tesseract -> RapidOCR -> uncertain)
                ocr_result = ocr_fallback.ocr_page(doc, page_number - 1)
                if ocr_result.ok:
                    ocr_text = _normalize_whitespace(ocr_result.text)
                    if len(ocr_text) > len(raw_text) or len(raw_text) < SCAN_SUSPECT_PAGE_CHARS:
                        raw_text = ocr_text
                    method = ocr_result.method
                    quality = "uncertain" if ocr_result.low_confidence else "good"
                    note = ocr_result.note
                else:
                    # Neither engine available or OCR failed completely
                    method = (
                        ocr_result.method
                        if ocr_result.method in ("ocr-tesseract", "ocr-rapid")
                        else "native"
                        if raw_text
                        else "uncertain"
                    )
                    quality = "uncertain"
                    note = ocr_result.note or "Scan-suspect page could not be OCR-processed; marked uncertain."

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
