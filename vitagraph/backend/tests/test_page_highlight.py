"""Passage highlight: boxes (0..1 of the page image) that sit on the right words of a text-layer page and of a scanned page."""

from __future__ import annotations

import io

import pymupdf
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core.database import get_db
from app.main import app
from app.services import measurement_service, page_highlight, report_service
from tests.conftest import make_user, sample_pdf

client = TestClient(app)


@pytest.fixture(scope="module")
def owner():
    user = make_user("Highlight owner")
    jan = report_service.process_upload(user["id"], "jan.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    return {"user_id": user["id"], "report_id": jan["id"], "path": report_service.uploader.get_report(jan["id"])["stored_path"]}


def get(owner, page=1, start=None, end=None, user_id=None, report_id=None):
    params = {"user_id": user_id or owner["user_id"]}
    if start is not None:
        params["char_start"] = start
    if end is not None:
        params["char_end"] = end
    return client.get(f"/api/reports/{report_id or owner['report_id']}/pages/{page}/highlight", params=params)


def page_text(report_id, page=1):
    with get_db() as db:
        return db.execute(
            "SELECT extracted_text FROM report_pages WHERE report_id = ? AND page_number = ?", (report_id, page)
        ).fetchone()["extracted_text"]


def to_pdf_rect(page, rect):
    return pymupdf.Rect(
        rect["x0"] * page.rect.width, rect["y0"] * page.rect.height, rect["x1"] * page.rect.width, rect["y1"] * page.rect.height
    )


def iou(a: pymupdf.Rect, b: pymupdf.Rect) -> float:
    inter = (a & b).get_area()
    union = a.get_area() + b.get_area() - inter
    return inter / union if union else 0.0


# ------------------------------------------------------------------ text-layer page


def test_a_value_is_boxed_exactly_where_the_pdf_search_finds_it(owner):
    text = page_text(owner["report_id"])
    doc = pymupdf.open(owner["path"])
    page = doc[0]
    checked = 0
    for m in measurement_service.list_report_measurements(owner["report_id"]):
        span = text[m["char_start"]:m["char_end"]]
        res = get(owner, start=m["char_start"], end=m["char_end"]).json()
        assert res["method"] == "text" and len(res["rects"]) == 1, (m["test_name"], res)
        box = to_pdf_rect(page, res["rects"][0])
        hits = page.search_for(span)
        assert any(iou(box, h) > 0.6 for h in hits), (m["test_name"], span, box, hits)
        assert span in page.get_textbox(box + (-1, -1, 1, 1))
        checked += 1
    assert checked >= 6


def test_a_multi_line_passage_gets_one_box_per_printed_line_inside_the_page(owner):
    text = page_text(owner["report_id"])
    start = text.index("Hemoglobin")
    end = text.index("12.0 - 15.5") + len("12.0 - 15.5 g/dL")
    res = get(owner, start=start, end=end).json()
    assert res["method"] == "text" and len(res["rects"]) == 3  # name line, result line, range line
    doc = pymupdf.open(owner["path"])
    page = doc[0]
    seen = ""
    for rect in res["rects"]:
        assert 0 <= rect["x0"] < rect["x1"] <= 1 and 0 <= rect["y0"] < rect["y1"] <= 1
        seen += " " + page.get_textbox(to_pdf_rect(page, rect) + (-1, -1, 1, 1))
    for word in ("Hemoglobin", "Result", "13.8", "g/dL", "Reference", "15.5"):
        assert word in seen
    assert "Vitamin" not in seen
    # top to bottom, in reading order
    ys = [r["y0"] for r in res["rects"]]
    assert ys == sorted(ys)


def test_rects_line_up_with_the_page_image_the_route_returns(owner):
    text = page_text(owner["report_id"])
    start = text.index("13.8")
    rect = get(owner, start=start, end=start + 4).json()["rects"][0]
    png = client.get(f"/api/reports/{owner['report_id']}/pages/1/image", params={"user_id": owner["user_id"], "dpi": 110}).content
    image = Image.open(io.BytesIO(png)).convert("L")
    box = (rect["x0"] * image.width, rect["y0"] * image.height, rect["x1"] * image.width, rect["y1"] * image.height)
    crop = image.crop((int(box[0]), int(box[1]), int(box[2]) + 1, int(box[3]) + 1))
    dark = sum(crop.histogram()[:128])
    assert dark > 20  # there is printed text under the box
    # and the box is tight: a strip just to its right of the last digit's space is mostly blank paper
    gap = image.crop((int(box[2]) + 12, int(box[1]), int(box[2]) + 20, int(box[3])))
    assert sum(gap.histogram()[:128]) < dark


def test_a_span_that_is_not_on_the_page_returns_none(owner):
    for start, end in ((10, 10), (20, 5), (10_000, 10_100)):
        assert get(owner, start=start, end=end).json() == {"rects": [], "method": "none"}
    text = page_text(owner["report_id"])
    blank = get(owner, start=0, end=0)
    assert blank.json()["method"] == "none"
    assert get(owner).json() == {"rects": [], "method": "none"}  # no span asked for
    assert text  # sanity


def test_the_span_end_is_clamped_to_the_page_text(owner):
    text = page_text(owner["report_id"])
    res = get(owner, start=len(text) - 20, end=len(text) + 500).json()
    assert res["method"] == "text" and res["rects"]


def test_an_unknown_page_report_or_person_is_404(owner):
    assert get(owner, page=9, start=0, end=10).status_code == 404
    assert get(owner, report_id="rpt_missing", start=0, end=10).status_code == 404
    assert get(owner, user_id="usr_nobody_123", start=0, end=10).status_code == 404
    assert client.get(f"/api/reports/{owner['report_id']}/pages/1/highlight", params={"char_start": 0, "char_end": 5}).status_code == 422


def test_another_persona_cannot_highlight_my_report(owner):
    stranger = make_user("Highlight stranger")
    res = get(owner, start=0, end=30, user_id=stranger["id"])
    assert res.status_code == 404
    assert client.get(
        f"/api/reports/{owner['report_id']}/pages/1/highlight", params={"user_id": stranger["id"], "char_start": 0, "char_end": 30}
    ).json() == {"detail": "Report not found."}


def test_a_rotated_page_is_boxed_in_the_orientation_of_its_image():
    user = make_user("Highlight rotated")
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 100), "Hemoglobin Result: 13.8 g/dL", fontsize=12)
    page.insert_text((72, 140), "Reference range: 12.0 - 15.5 g/dL", fontsize=12)
    page.insert_text((72, 180), "Collection Date: 15 January 2025", fontsize=12)
    page.insert_text((72, 220), "Comprehensive Health Panel with enough words to be a real text page", fontsize=12)
    for i in range(30):
        page.insert_text((72, 260 + i * 16), f"Line {i} Fasting Glucose Result: {90 + i} mg/dL Reference range: 70 - 99 mg/dL", fontsize=10)
    page.set_rotation(90)
    report = report_service.process_upload(user["id"], "rotated.pdf", doc.tobytes())
    text = page_text(report["id"])
    start = text.index("13.8")
    res = client.get(
        f"/api/reports/{report['id']}/pages/1/highlight",
        params={"user_id": user["id"], "char_start": start, "char_end": start + 4},
    ).json()
    assert res["method"] == "text" and len(res["rects"]) == 1
    stored = pymupdf.open(report_service.uploader.get_report(report["id"])["stored_path"])[0]
    assert stored.rotation == 90
    rect = to_pdf_rect(stored, res["rects"][0])  # in the rotated (displayed) page
    unrotated = (rect * ~stored.rotation_matrix)
    assert "13.8" in stored.get_textbox(unrotated + (-1, -1, 1, 1))
    # the displayed page is landscape, and the box is wider than tall in text terms only after rotation
    assert stored.rect.width > stored.rect.height and rect.height > rect.width


# --------------------------------------------------------------------- scanned page


def test_a_scanned_page_uses_the_ocr_boxes():
    pytest.importorskip("rapidocr_onnxruntime")
    page_highlight.clear_cache()
    user = make_user("Highlight scan")
    report = report_service.process_upload(
        user["id"], "scan.pdf", sample_pdf("VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf")
    )
    with get_db() as db:
        method = db.execute("SELECT extraction_method FROM report_pages WHERE report_id = ?", (report["id"],)).fetchone()[0]
    if not method.startswith("ocr"):
        pytest.skip("OCR engine not available here")
    text = page_text(report["id"])
    start = text.index("Weight")
    end = text.index("kg", start) + 2
    res = client.get(
        f"/api/reports/{report['id']}/pages/1/highlight",
        params={"user_id": user["id"], "char_start": start, "char_end": end},
    ).json()
    assert res["method"] == "ocr" and res["rects"]
    for rect in res["rects"]:
        assert 0 <= rect["x0"] < rect["x1"] <= 1 and 0 <= rect["y0"] < rect["y1"] <= 1
    # the value 82 sits on the "Weight: 82 kg" line, in the upper part of the page
    value = text.index("82", start)
    narrow = client.get(
        f"/api/reports/{report['id']}/pages/1/highlight",
        params={"user_id": user["id"], "char_start": value, "char_end": value + 2},
    ).json()
    assert narrow["method"] == "ocr" and len(narrow["rects"]) == 1
    full = res["rects"][0]
    box = narrow["rects"][0]
    assert box["x1"] - box["x0"] < full["x1"] - full["x0"] + 1e-6
    assert abs(box["y0"] - full["y0"]) < 0.02
    # the same words are read from the page image where the box sits
    png = client.get(f"/api/reports/{report['id']}/pages/1/image", params={"user_id": user["id"], "dpi": 110}).content
    image = Image.open(io.BytesIO(png)).convert("L")
    crop = image.crop(
        (int(box["x0"] * image.width), int(box["y0"] * image.height), int(box["x1"] * image.width) + 1, int(box["y1"] * image.height) + 1)
    )
    assert sum(crop.histogram()[:128]) > 15
