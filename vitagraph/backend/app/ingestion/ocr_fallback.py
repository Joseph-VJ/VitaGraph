"""OCR fallback for scanned pages (plan Section 7).

OCR runs ONLY on pages whose native extraction was too sparse. If the
Tesseract binary or the pytesseract binding is not installed, the fallback
reports itself unavailable and the page stays 'sparse'/'failed' with a
visible note — the system never pretends OCR succeeded.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class OcrResult:
    ok: bool
    text: str = ""
    low_confidence: bool = False
    note: str | None = None


def _tesseract_available() -> bool:
    try:
        import pytesseract  # noqa: F401
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def ocr_page(doc, page_index: int) -> OcrResult:
    """Render one page to an image and OCR it. Never raises."""
    if not _tesseract_available():
        return OcrResult(
            ok=False,
            note="OCR unavailable on this machine (Tesseract not installed); "
                 "page preserved with sparse/failed extraction status.",
        )
    try:
        import pytesseract
        from PIL import Image

        pixmap = doc[page_index].get_pixmap(dpi=200)
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)

        # Mean word confidence from image_to_data is the primary uncertainty
        # signal; output length is a secondary fallback.
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
        confidences = [float(c) for c in data["conf"] if str(c) not in ("-1", "")]
        mean_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        text = pytesseract.image_to_string(image)
        low_confidence = mean_confidence < 60 or len(text.strip()) < 40
        return OcrResult(
            ok=True,
            text=text,
            low_confidence=low_confidence,
            note=f"OCR mean word confidence {mean_confidence:.0f}%."
            if low_confidence else None,
        )
    except Exception as exc:  # OCR failure must not crash ingestion.
        return OcrResult(ok=False, note=f"OCR attempted but failed: {exc}")
