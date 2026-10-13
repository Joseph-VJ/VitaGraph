"""Where on the page image does a passage sit?

Given a report page and a character span of that page's stored text (`report_pages.extracted_text`), find the boxes on
the rendered page image (`GET /api/reports/{id}/pages/{n}/image`: the whole page, no crop) that cover those characters.

- Text-layer pages: the PDF's own words (PyMuPDF `get_text("words")`) are lined up with the stored text, in reading
  order, so every character range maps to real word boxes; one box per printed line. If that fails, the span's lines
  are searched on the page (`search_for`).
- Scanned pages: the OCR engine's boxes. They are not stored at ingestion, so the page is read again on first use and
  the boxes are kept in memory.
- Nothing found: no boxes and method "none". A wrong box is worse than no box.

Rectangles are returned normalised 0..1 of the page image (top-left origin), so they line up at any zoom.
"""

from __future__ import annotations

import re
import threading
from typing import Any

from fastapi import HTTPException

from app.core.database import get_db
from app.ingestion import ocr_fallback, uploader

MAX_SPAN_CHARS = 4000
MAX_RECTS = 40
_WORD_WINDOW = 400

_ocr_cache: dict[tuple[str, int], list[dict[str, Any]]] = {}
_ocr_lock = threading.Lock()
_OCR_CACHE_LIMIT = 64


def clear_cache() -> None:
    with _ocr_lock:
        _ocr_cache.clear()


def _none() -> dict[str, Any]:
    return {"rects": [], "method": "none"}


def _page_row(report_id: str, page_number: int) -> dict[str, Any]:
    with get_db() as db:
        row = db.execute(
            "SELECT extracted_text, extraction_method FROM report_pages WHERE report_id = ? AND page_number = ?",
            (report_id, page_number),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Page not found.")
    return dict(row)


def _norm_rect(x0: float, y0: float, x1: float, y1: float, width: float, height: float) -> dict[str, float]:
    def clamp(v: float) -> float:
        return round(min(max(v, 0.0), 1.0), 4)

    return {"x0": clamp(x0 / width), "y0": clamp(y0 / height), "x1": clamp(x1 / width), "y1": clamp(y1 / height)}


# ---------------------------------------------------------------- text-layer pages


def _align_words(text: str, words: list[tuple]) -> list[tuple[int, int, tuple]]:
    """Line the PDF's words up with the stored text. Returns (char_start, char_end, word) for every word found."""
    placed: list[tuple[int, int, tuple]] = []
    cursor = 0
    for word in words:
        token = word[4]
        if not token or not token.strip():
            continue
        token = token.strip()
        idx = text.find(token, cursor, cursor + _WORD_WINDOW)
        if idx < 0:
            continue
        placed.append((idx, idx + len(token), word))
        cursor = idx + len(token)
    return placed


def _line_rects(words: list[tuple]) -> list[tuple[float, float, float, float]]:
    """One rectangle per printed line (block, line) from the words that fall in the span."""
    lines: dict[tuple[int, int], list[float]] = {}
    for w in words:
        key = (w[5], w[6])
        box = lines.get(key)
        if box is None:
            lines[key] = [w[0], w[1], w[2], w[3]]
        else:
            box[0], box[1] = min(box[0], w[0]), min(box[1], w[1])
            box[2], box[3] = max(box[2], w[2]), max(box[3], w[3])
    return [tuple(v) for v in lines.values()]  # type: ignore[misc]


def _text_layer(page, text: str, start: int, end: int) -> list[dict[str, float]]:
    import pymupdf

    matrix = page.rotation_matrix
    rotated = page.rotation != 0
    width, height = page.rect.width, page.rect.height
    if width <= 0 or height <= 0:
        return []

    def to_page(rect) -> tuple[float, float, float, float]:
        r = pymupdf.Rect(rect)
        if rotated:
            r = (r * matrix).normalize()
        return (r.x0 - page.rect.x0, r.y0 - page.rect.y0, r.x1 - page.rect.x0, r.y1 - page.rect.y0)

    words = page.get_text("words")
    inside = [w for a, b, w in _align_words(text, words) if a < end and b > start]
    boxes = [to_page(r) for r in _line_rects(inside)]

    if not boxes:
        # Fallback: look the span's own lines up on the page (e.g. text that was added from a normalised table).
        for raw_line in text[start:end].splitlines()[:8]:
            needle = " ".join(raw_line.split())[:200]
            if len(needle) < 3:
                continue
            for hit in page.search_for(needle)[:6]:
                boxes.append(to_page(hit))
    return [_norm_rect(*b, width, height) for b in boxes[:MAX_RECTS]]


# ------------------------------------------------------------------- scanned pages


def _ocr_boxes(report: dict[str, Any], page_number: int) -> list[dict[str, Any]]:
    import pymupdf

    key = (report["id"], page_number)
    with _ocr_lock:
        cached = _ocr_cache.get(key)
    if cached is not None:
        return cached
    try:
        doc = pymupdf.open(report["stored_path"])
    except Exception:
        return []
    try:
        result = ocr_fallback.ocr_page(doc, page_number - 1)
    finally:
        doc.close()
    boxes = list(result.boxes) if result.ok else []
    with _ocr_lock:
        if len(_ocr_cache) >= _OCR_CACHE_LIMIT:
            _ocr_cache.pop(next(iter(_ocr_cache)))
        _ocr_cache[key] = boxes
    return boxes


def _ocr_rects(boxes: list[dict[str, Any]], text: str, start: int, end: int) -> list[dict[str, float]]:
    """Match each OCR box's text to the stored text in order; keep the boxes (or the part of a line box) inside the span."""
    rects: list[dict[str, float]] = []
    cursor = 0
    for box in boxes:
        tokens = str(box.get("text", "")).split()
        if not tokens:
            continue
        pattern = re.compile(r"\s+".join(re.escape(t) for t in tokens))
        found = pattern.search(text, cursor)
        if found is None:
            continue
        a, b = found.start(), found.end()
        cursor = b
        if a >= end or b <= start:
            continue
        x0, y0, x1, y1 = float(box["x0"]), float(box["y0"]), float(box["x1"]), float(box["y1"])
        if len(tokens) > 1 and b > a:
            # A whole line was one box: narrow it to the characters asked for, by their share of the line.
            f0 = max(start - a, 0) / (b - a)
            f1 = min(end - a, b - a) / (b - a)
            span = x1 - x0
            pad = 0.004
            x0, x1 = x0 + f0 * span - (pad if f0 > 0 else 0), x0 + f1 * span + (pad if f1 < 1 else 0)
        rects.append({"x0": round(max(x0, 0), 4), "y0": round(max(y0, 0), 4), "x1": round(min(x1, 1), 4), "y1": round(min(y1, 1), 4)})
    return rects[:MAX_RECTS]


# -------------------------------------------------------------------------- entry


def highlight(report_id: str, page_number: int, char_start: int | None, char_end: int | None) -> dict[str, Any]:
    """Boxes (0..1 of the page image) for text[char_start:char_end] of one page. 404 when the report or page is unknown."""
    import pymupdf

    report = uploader.get_report(report_id)  # 404 if unknown
    row = _page_row(report_id, page_number)
    text: str = row["extracted_text"] or ""
    if char_start is None or char_end is None:
        return _none()
    start = max(0, int(char_start))
    end = min(len(text), int(char_end), start + MAX_SPAN_CHARS)
    if start >= end or not text[start:end].strip():
        return _none()

    method = str(row["extraction_method"] or "")
    if method.startswith("ocr"):
        rects = _ocr_rects(_ocr_boxes(report, page_number), text, start, end)
        return {"rects": rects, "method": "ocr"} if rects else _none()

    try:
        doc = pymupdf.open(report["stored_path"])
    except Exception:
        return _none()
    try:
        if page_number < 1 or page_number > len(doc):
            raise HTTPException(status_code=404, detail="Page not found.")
        rects = _text_layer(doc[page_number - 1], text, start, end)
    finally:
        doc.close()
    return {"rects": rects, "method": "text"} if rects else _none()
