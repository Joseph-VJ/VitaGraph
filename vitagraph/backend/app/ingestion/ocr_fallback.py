"""OCR fallback for scanned pages (plan Section 7 & US-16).

Dual-engine OCR: Tesseract runs if available, else rapidocr-onnxruntime
(pip package with zero system binary requirement). If neither engine is
available, returns unavailable result marked uncertain — never silent.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class OcrResult:
    ok: bool
    text: str = ""
    low_confidence: bool = False
    note: str | None = None
    method: str = "ocr"
    # Real detection boxes, normalised to 0..1 of the rendered page: {x0,y0,x1,y1,text,conf}
    boxes: list[dict] = field(default_factory=list)


def _tesseract_available() -> bool:
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def _rapidocr_available() -> bool:
    try:
        from rapidocr_onnxruntime import RapidOCR  # noqa: F401
        return True
    except Exception:
        return False


def ocr_page(doc, page_index: int) -> OcrResult:
    """Render one page to an image and OCR it via Tesseract or RapidOCR. Never raises."""
    # 1. Try Tesseract if available
    if _tesseract_available():
        try:
            import pytesseract
            from PIL import Image

            pixmap = doc[page_index].get_pixmap(dpi=200)
            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)

            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            confidences = [float(c) for c in data["conf"] if str(c) not in ("-1", "")]
            mean_confidence = sum(confidences) / len(confidences) if confidences else 0.0

            text = pytesseract.image_to_string(image)
            boxes = []
            for i, word in enumerate(data["text"]):
                conf = float(data["conf"][i]) if str(data["conf"][i]) not in ("-1", "") else -1.0
                if not str(word).strip() or conf < 0:
                    continue
                x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
                boxes.append({
                    "x0": round(x / image.width, 4), "y0": round(y / image.height, 4),
                    "x1": round((x + w) / image.width, 4), "y1": round((y + h) / image.height, 4),
                    "text": str(word), "conf": round(conf, 1),
                })
            low_confidence = mean_confidence < 60 or len(text.strip()) < 40
            return OcrResult(
                ok=True,
                text=text,
                low_confidence=low_confidence,
                method="ocr-tesseract",
                boxes=boxes,
                note=f"Tesseract OCR mean confidence {mean_confidence:.0f}%."
                if low_confidence else None,
            )
        except Exception as exc:
            pass  # Fall through to RapidOCR

    # 2. Try RapidOCR (ONNX Runtime, pip-installed, no external system binary)
    if _rapidocr_available():
        try:
            import numpy as np
            from rapidocr_onnxruntime import RapidOCR

            pixmap = doc[page_index].get_pixmap(dpi=200)
            img = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
                (pixmap.height, pixmap.width, pixmap.n)
            )
            if pixmap.n == 4:
                img = img[:, :, :3]

            ocr = RapidOCR()
            result, _ = ocr(img)
            if result:
                lines = [line[1] for line in result if len(line) > 1 and line[1]]
                text = "\n".join(lines)
                scores = [float(line[2]) for line in result if len(line) > 2]
                mean_conf = (sum(scores) / len(scores) * 100) if scores else 0.0
                low_confidence = mean_conf < 60 or len(text.strip()) < 40
                boxes = []
                for line in result:
                    if len(line) < 3 or not line[1]:
                        continue
                    xs = [pt[0] for pt in line[0]]
                    ys = [pt[1] for pt in line[0]]
                    boxes.append({
                        "x0": round(min(xs) / pixmap.width, 4), "y0": round(min(ys) / pixmap.height, 4),
                        "x1": round(max(xs) / pixmap.width, 4), "y1": round(max(ys) / pixmap.height, 4),
                        "text": str(line[1]), "conf": round(float(line[2]) * 100, 1),
                    })
                return OcrResult(
                    ok=True,
                    text=text,
                    low_confidence=low_confidence,
                    method="ocr-rapid",
                    boxes=boxes,
                    note=f"RapidOCR confidence {mean_conf:.0f}%."
                    if low_confidence
                    else f"RapidOCR extracted ({mean_conf:.0f}% confidence)",
                )
            else:
                return OcrResult(
                    ok=False,
                    method="ocr-rapid",
                    low_confidence=True,
                    note="RapidOCR executed but found no text in image layer.",
                )
        except Exception as exc:
            return OcrResult(ok=False, method="ocr-rapid", note=f"RapidOCR attempted but failed: {exc}")

    # 3. Neither engine available: report uncertain state honestly
    return OcrResult(
        ok=False,
        text="",
        low_confidence=True,
        method="uncertain",
        note="OCR unavailable on this machine (neither Tesseract nor RapidOCR installed); "
             "page preserved with uncertain extraction status.",
    )

