"""POST /api/tools/ocr: real RapidOCR recognition, honest errors, nothing stored."""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont

from app.ingestion import ocr_image
from app.main import app

client = TestClient(app)

pytestmark = pytest.mark.skipif(not ocr_image.engine_available(), reason="rapidocr not installed")


def _png(text: str) -> bytes:
    img = Image.new("RGB", (900, 160), "white")
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=56)
    draw.text((30, 40), text, fill="black", font=font)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_ocr_status_reports_engine():
    res = client.get("/api/tools/ocr/status")
    assert res.status_code == 200
    assert res.json()["available"] is True


def test_ocr_reads_text_with_confidence_and_boxes():
    res = client.post("/api/tools/ocr", files={"file": ("scan.png", _png("Hemoglobin 13.8 g/dL"), "image/png")})
    assert res.status_code == 200
    body = res.json()
    assert body["engine"] == "rapidocr"
    assert "13.8" in body["text"]
    assert body["lines"], "each recognised line is returned"
    line = body["lines"][0]
    assert 0 <= line["confidence"] <= 100
    box = line["box"]
    assert 0 <= box["x0"] < box["x1"] <= 1 and 0 <= box["y0"] < box["y1"] <= 1
    assert body["mean_confidence"] > 0


def test_ocr_rejects_non_images_and_empty_files():
    bad = client.post("/api/tools/ocr", files={"file": ("x.png", b"not an image", "image/png")})
    assert bad.status_code == 400
    empty = client.post("/api/tools/ocr", files={"file": ("x.png", b"", "image/png")})
    assert empty.status_code == 400
