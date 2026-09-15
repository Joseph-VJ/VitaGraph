"""Section-aware chunking with mandatory metadata (plan Section 8).

Policy (frozen before evaluation, calibrated on the synthetic set):
line-level chunking where a chunk boundary occurs at
  - blank lines (paragraph/section gaps),
  - heading-like lines (e.g. "Comprehensive Health Panel", "General Notes"),
  - completed lab entries (a Result/Reference-range/Flag line finishes a test),
  - or the target size, whichever comes first.
Every chunk records the metadata needed for user isolation, citation
display, and reproducibility, plus exact character offsets into the page.
"""

from __future__ import annotations

import re
import uuid

CHUNK_TARGET_CHARS = 200
# Ceiling stays inside the frozen embedding model's 256-word-piece limit
# (~800 chars of English) so dense pages are never silently truncated.
CHUNK_MAX_CHARS = 800

# A line that completes one lab-test entry (name -> result -> range -> flag).
_COMPLETE_ENTRY = re.compile(r"^(?:result|reference range|flag)\s*:", re.IGNORECASE)

# Word-boundary heading hints. "reference" is deliberately excluded: a
# "Reference range:" line is an entry COMPLETER, not a section heading —
# treating it as a heading splits a test name from its own range.
_HEADING_HINTS = ("results", "summary", "panel", "profile", "tests",
                  "report", "patient", "specimen", "notes", "interpretation")


def _looks_like_heading(line: str) -> bool:
    """Heading = short line, few words (or colon-terminated), containing a
    hint word as a whole word. Prose lines that merely mention a hint word
    (e.g. "This is a note about tests") do not qualify."""
    stripped = line.strip().rstrip(":")
    if not stripped or len(stripped) > 60:
        return False
    words = stripped.split()
    if len(words) > 6:
        return False
    if not (line.strip().endswith(":") or len(words) <= 4):
        return False
    lowered = stripped.lower()
    return any(re.search(rf"\b{hint}\b", lowered) for hint in _HEADING_HINTS)


def chunk_page(page: dict, report: dict) -> list[dict]:
    """Split one page's text into metadata-rich chunks.

    char_start / char_end map each chunk back to the exact extracted page
    text span so evidence can always be located.
    """
    text = page["text"]
    if not text:
        return []

    chunks: list[dict] = []
    buffer: list[tuple[int, int, str]] = []   # (start_offset, end_offset, line)

    def flush() -> None:
        if not buffer:
            return
        chunk_text = "\n".join(b[2].rstrip() for b in buffer).strip()
        if chunk_text:
            chunks.append({
                "chunk_id": f"chk_{uuid.uuid4().hex[:12]}",
                "text": chunk_text,
                "char_start": buffer[0][0],
                "char_end": buffer[-1][1],
                "section": current_section,
            })
        buffer.clear()

    current_section = "page"
    offset = 0
    for line in text.split("\n"):
        line_start, line_end = offset, offset + len(line)
        offset = line_end + 1  # account for the consumed newline

        if not line.strip():          # blank line: paragraph/section gap
            flush()
            continue

        if _looks_like_heading(line) and buffer:
            flush()
            current_section = line.strip().rstrip(":")
            buffer.append((line_start, line_end, line))
            continue

        buffer.append((line_start, line_end, line))

        buffered_len = sum(len(b[2]) for b in buffer)
        if _COMPLETE_ENTRY.match(line.strip()) and buffered_len >= 60:
            flush()                   # complete lab entry: natural boundary
        elif buffered_len >= CHUNK_TARGET_CHARS:
            flush()

    flush()

    # Hard ceiling: split any oversized chunk on line boundaries.
    bounded: list[dict] = []
    for chunk in chunks:
        if len(chunk["text"]) <= CHUNK_MAX_CHARS:
            bounded.append(chunk)
            continue
        lines = chunk["text"].split("\n")
        piece: list[str] = []
        piece_len = 0
        offset = chunk["char_start"]
        for line in lines:
            if piece_len + len(line) > CHUNK_MAX_CHARS and piece:
                piece_text = "\n".join(piece).strip()
                bounded.append({
                    "chunk_id": f"chk_{uuid.uuid4().hex[:12]}",
                    "text": piece_text,
                    "char_start": offset,
                    "char_end": offset + piece_len,
                    "section": chunk["section"],
                })
                offset += piece_len + 1
                piece, piece_len = [], 0
            piece.append(line)
            piece_len += len(line) + 1
        if piece:
            piece_text = "\n".join(piece).strip()
            bounded.append({
                "chunk_id": f"chk_{uuid.uuid4().hex[:12]}",
                "text": piece_text,
                "char_start": offset,
                "char_end": chunk["char_end"],
                "section": chunk["section"],
            })
    return bounded


def persist_chunks(db, chunks: list[dict], report: dict, page: dict) -> None:
    """Write chunk rows (with the full metadata contract) using the caller's
    open transaction. text_hash supports duplicate detection (plan Section 8)."""
    import hashlib
    import json

    for sequence, chunk in enumerate(chunks, start=1):
        metadata = {
            "user_id": report["user_id"],
            "report_id": report["id"],
            "report_version": report["version"],
            "report_filename": report["original_filename"],
            "report_date": report.get("report_date"),
            "page_number": page["page_number"],
            "section": chunk["section"],
            "extraction_method": page["method"],
            "page_text_length": page["text_length"],
            "char_start": chunk["char_start"],
            "char_end": chunk["char_end"],
            "sequence": sequence,
            "text_hash": hashlib.sha256(chunk["text"].encode("utf-8")).hexdigest(),
        }
        db.execute(
            """INSERT INTO report_chunks
               (id, user_id, report_id, page_id, page_number, sequence,
                text, char_start, char_end, section, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (chunk["chunk_id"], report["user_id"], report["id"],
             page["page_id"], page["page_number"], sequence,
             chunk["text"], chunk["char_start"], chunk["char_end"],
             chunk["section"], json.dumps(metadata)),
        )
