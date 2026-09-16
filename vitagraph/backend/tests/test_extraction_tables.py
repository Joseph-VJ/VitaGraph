"""Tests for scan detection, dual-engine OCR fallback, table normalization,
and generic measurement fallback (plan Section 7 & US-16)."""

from __future__ import annotations

import pymupdf as fitz
import pytest

from app.graph.extractor import extract_entities_from_chunk
from app.ingestion.extractor import _is_scan_suspect, _extract_and_normalize_tables
from app.ingestion import ocr_fallback
from app.services import report_service
from tests.conftest import make_user, sample_pdf


def test_scan_suspect_detection():
    """Pages with < 400 chars or full-page images must be marked scan-suspect."""
    doc = fitz.open()
    # 1. Sparse page with 50 chars
    p1 = doc.new_page()
    assert _is_scan_suspect(p1, "Short snippet of text under 400 characters.") is True

    # 2. Dense page with 500 chars, no image
    p2 = doc.new_page()
    dense_text = "Clinical observation panel " * 30
    assert len(dense_text) > 400
    assert _is_scan_suspect(p2, dense_text) is False
    doc.close()


def test_ocr_fallback_engine_hierarchy():
    """OCR fallback returns valid OcrResult with ocr-tesseract or ocr-rapid method."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Test OCR Engine Execution")

    result = ocr_fallback.ocr_page(doc, 0)
    assert isinstance(result, ocr_fallback.OcrResult)
    assert result.method in ("ocr-tesseract", "ocr-rapid", "uncertain")
    if result.ok:
        assert result.method in ("ocr-tesseract", "ocr-rapid")
    doc.close()


def test_generic_measurement_fallback():
    """Table rows or structured lines for non-canonical tests extract as measurements."""
    chunk = (
        "Chemistry Panel Results:\n"
        "- Serum Albumin: 4.2 g/dL 3.5 - 5.0 NORMAL\n"
        "- Serum Bilirubin: 1.1 mg/dL 0.2 - 1.2 NORMAL\n"
        "- Alkaline Phosphatase: 145 U/L 44 - 147 HIGH\n"
    )
    entities = extract_entities_from_chunk(chunk, chunk_id="chk_test_1")
    assert len(entities) >= 2
    names = {e["test_name"] for e in entities}
    assert any("Albumin" in n for n in names)
    assert any("Bilirubin" in n for n in names)

    albumin = next(e for e in entities if "Albumin" in e["test_name"])
    assert albumin["value"] == 4.2
    assert albumin["unit"] == "g/dL"
    assert albumin["flag"] == "NORMAL"


def test_scanned_pdf_upload_yields_at_least_three_entities():
    """Uploading VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf must run OCR
    and extract >= 3 entities (or honest uncertain state if no engine)."""
    user = make_user("Scanned OCR Persona")
    pdf_bytes = sample_pdf("VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf")

    result = report_service.process_upload(
        user["id"],
        "VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf",
        pdf_bytes,
    )
    assert result["status"] == "ready"

    pages = report_service.get_pages(result["id"])
    assert len(pages) == 1
    page = pages[0]

    # Extraction method must be recorded as OCR engine (or honest uncertain)
    assert page["extraction_method"] in ("ocr-rapid", "ocr-tesseract", "uncertain")

    if page["extraction_method"] in ("ocr-rapid", "ocr-tesseract"):
        # Extracted text must capture real scanned document content
        assert page["text_length"] > 300

        # Entities extracted from the report chunks must be >= 3
        from app.core.database import get_db
        with get_db() as db:
            chunks = db.execute(
                "SELECT id, text FROM report_chunks WHERE report_id = ?",
                (result["id"],),
            ).fetchall()
            all_entities = []
            for ch in chunks:
                all_entities.extend(extract_entities_from_chunk(ch["text"], chunk_id=ch["id"]))

        assert len(all_entities) >= 3, f"Expected >= 3 entities, got {len(all_entities)}: {all_entities}"
        extracted_names = {e["test_name"] for e in all_entities}
        # Check that core biomarkers in Report4 were extracted
        assert "HbA1c" in extracted_names or "Total Cholesterol" in extracted_names or "Vitamin D" in extracted_names
    else:
        # If neither OCR engine was available, quality must be honest uncertain
        assert page["quality"] == "uncertain"
