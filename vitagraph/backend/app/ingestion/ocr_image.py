"""Image OCR for the Image to Text tool.

RapidOCR (ONNX, CPU, no model download beyond the pip package) is the engine. It returns every
line with a confidence and a bounding box, which the UI shows as-is; nothing is rewritten or
"corrected", because a changed digit in a lab value is worse than a visible low-confidence line.
Images are processed in memory and never stored.
"""

from __future__ import annotations

import io
import threading
import time

MAX_SIDE_PX = 2600          # larger images are scaled down before recognition
_lock = threading.Lock()    # one recognition at a time; ONNX sessions are shared
_engine = None


def engine_available() -> bool:
    try:
        import rapidocr_onnxruntime  # noqa: F401
        return True
    except Exception:
        return False


def _get_engine():
    global _engine
    if _engine is None:
        from rapidocr_onnxruntime import RapidOCR
        _engine = RapidOCR()
    return _engine


def read_image(data: bytes) -> dict:
    """Recognise text in an image. Raises ValueError for unreadable images, RuntimeError if no engine."""
    if not engine_available():
        raise RuntimeError("No OCR engine is installed on this machine (rapidocr-onnxruntime).")

    try:
        import numpy as np
        from PIL import Image

        img = Image.open(io.BytesIO(data))
        img.load()
        img = img.convert("RGB")
    except Exception as exc:
        raise ValueError("That file is not an image this tool can read (use PNG or JPG).") from exc

    scale = max(img.width, img.height) / MAX_SIDE_PX
    if scale > 1:
        img = img.resize((max(1, round(img.width / scale)), max(1, round(img.height / scale))))
    width, height = img.size
    array = np.array(img)

    started = time.perf_counter()
    with _lock:
        result, _ = _get_engine()(array)
    elapsed_ms = int((time.perf_counter() - started) * 1000)

    lines: list[dict] = []
    for item in result or []:
        if len(item) < 3 or not str(item[1]).strip():
            continue
        xs = [pt[0] for pt in item[0]]
        ys = [pt[1] for pt in item[0]]
        lines.append({
            "text": str(item[1]),
            "confidence": round(float(item[2]) * 100, 1),
            "box": {
                "x0": round(min(xs) / width, 4), "y0": round(min(ys) / height, 4),
                "x1": round(max(xs) / width, 4), "y1": round(max(ys) / height, 4),
            },
        })

    mean_conf = round(sum(l["confidence"] for l in lines) / len(lines), 1) if lines else 0.0
    return {
        "engine": "rapidocr",
        "width": width,
        "height": height,
        "elapsed_ms": elapsed_ms,
        "mean_confidence": mean_conf,
        "text": "\n".join(l["text"] for l in lines),
        "lines": lines,
    }
