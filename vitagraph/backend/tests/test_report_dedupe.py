"""Saving the same report twice gives one row; ```chart blocks become an SVG in the HTML and an image in the PDF."""

from __future__ import annotations

import pymupdf
import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app
from app.services import report_render, report_service, series_service
from tests.conftest import make_user, sample_pdf

client = TestClient(app)

PLAIN = "# Dedupe check\n\nYour hemoglobin is **14.1 g/dL** [1].\n"
WITH_CHART = (
    "# Hemoglobin over time\n\nIt stayed inside the printed range.\n\n"
    "```chart\n{\"kind\": \"trend\", \"tests\": [\"Hemoglobin\", \"LDL Cholesterol\"]}\n```\n\n"
    "## Limitations\nEducational only.\n"
)


@pytest.fixture(scope="module")
def owner():
    series_service.clear_cache()
    user = make_user("Dedupe owner")
    report_service.process_upload(user["id"], "jan.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    report_service.process_upload(user["id"], "jun.pdf", sample_pdf("synthetic_panel_2025-06-20.pdf"))
    return {"user_id": user["id"]}


def save(user_id, markdown, title="Fallback title", **extra):
    return client.post("/api/agent/reports", json={"user_id": user_id, "title": title, "markdown": markdown, "refs": [], **extra})


def rows(user_id):
    with get_db() as db:
        return db.execute("SELECT id FROM agent_artifacts WHERE user_id = ? AND kind = 'report'", (user_id,)).fetchall()


# --------------------------------------------------------------------- idempotent


def test_the_same_report_saved_twice_is_one_row(owner):
    before = len(rows(owner["user_id"]))
    first = save(owner["user_id"], PLAIN).json()
    second = save(owner["user_id"], PLAIN).json()
    assert first["id"] == second["id"] and first["html"] == second["html"]
    assert second["title"] == "Dedupe check" and second["created_at"] == first["created_at"]
    assert len(rows(owner["user_id"])) == before + 1
    listed = client.get("/api/agent/reports", params={"user_id": owner["user_id"]}).json()
    assert [r["id"] for r in listed].count(first["id"]) == 1


def test_a_different_markdown_or_title_is_a_new_report(owner):
    first = save(owner["user_id"], PLAIN).json()
    other_text = save(owner["user_id"], PLAIN + "\nOne more line.\n").json()
    other_title = save(owner["user_id"], PLAIN, title="Another fallback").json()
    assert len({first["id"], other_text["id"], other_title["id"]}) == 3


def test_the_same_report_from_another_chat_is_still_the_same_row(owner):
    first = save(owner["user_id"], PLAIN + "\nChat A.\n", conversation_id="conv_a").json()
    again = save(owner["user_id"], PLAIN + "\nChat A.\n", conversation_id="conv_b").json()
    assert again["id"] == first["id"]


def test_another_person_saving_the_same_words_gets_their_own_row(owner):
    other = make_user("Dedupe other")
    mine = save(owner["user_id"], PLAIN).json()
    theirs = save(other["id"], PLAIN).json()
    assert theirs["id"] != mine["id"]
    assert client.get(f"/api/agent/reports/{mine['id']}", params={"user_id": other["id"]}).status_code == 404
    assert save(other["id"], PLAIN).json()["id"] == theirs["id"]


def test_after_deleting_the_report_it_can_be_saved_again(owner):
    first = save(owner["user_id"], PLAIN + "\nDelete me.\n").json()
    assert client.delete(f"/api/agent/reports/{first['id']}", params={"user_id": owner["user_id"]}).status_code == 200
    again = save(owner["user_id"], PLAIN + "\nDelete me.\n").json()
    assert again["id"] != first["id"]


# ------------------------------------------------------------------------ charts


def test_a_chart_block_becomes_an_inert_svg_in_the_html(owner):
    saved = save(owner["user_id"], WITH_CHART).json()
    html = saved["html"]
    assert html.count("<svg") == 1 and '<div class="chart">' in html
    body = html.split("<body>")[1]
    assert "```chart" not in body and '"kind"' not in body.replace(html.split("<svg")[1], "")
    assert "<script" not in body and "onclick" not in body and "href" not in body
    assert "Hemoglobin (g/dL)" in html and "LDL Cholesterol (mg/dL)" in html and "148 mg/dL" in html
    assert "#ec3013" in html  # LDL is out of range
    assert "default-src 'none'" in html  # the policy is unchanged
    assert saved["title"] == "Hemoglobin over time"


def test_the_pdf_has_the_chart_as_an_image(owner):
    saved = save(owner["user_id"], WITH_CHART).json()
    pdf = client.get(f"/api/agent/reports/{saved['id']}/pdf", params={"user_id": owner["user_id"]})
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    doc = pymupdf.open(stream=pdf.content, filetype="pdf")
    images = [img for page in doc for img in page.get_images(full=True)]
    assert len(images) >= 1
    infos = [info for page in doc for info in page.get_image_info()]
    assert infos and max(i["bbox"][2] - i["bbox"][0] for i in infos) > 300  # drawn wide, not a speck
    text = "".join(p.get_text() for p in doc)
    assert "Hemoglobin over time" in text and "Limitations" in text and "```" not in text


def test_a_report_without_a_chart_has_no_image(owner):
    saved = save(owner["user_id"], PLAIN + "\nNo chart here.\n").json()
    pdf = client.get(f"/api/agent/reports/{saved['id']}/pdf", params={"user_id": owner["user_id"]}).content
    assert not [img for page in pymupdf.open(stream=pdf, filetype="pdf") for img in page.get_images()]


@pytest.mark.parametrize(
    "block, fragment",
    [
        ('{"kind": "trend", "tests": ["Vitamin K"]}', "There are no Vitamin K values in your reports."),
        ('{"kind": "trend", "tests": ["Hemoglobin"], "values": [1, 2]}', "must not contain values"),
        ("this is not json", "This chart could not be drawn."),
        ('{"kind": "pie"}', "trend, compare or values"),
    ],
)
def test_a_bad_chart_spec_becomes_a_short_note_not_an_error(owner, block, fragment):
    res = save(owner["user_id"], f"# Bad chart\n\nText.\n\n```chart\n{block}\n```\n\nAfter.\n")
    assert res.status_code == 200, res.text
    html = res.json()["html"]
    assert "<svg" not in html and "This chart could not be drawn." in html and fragment in html
    assert "After." in html
    pdf = client.get(f"/api/agent/reports/{res.json()['id']}/pdf", params={"user_id": owner["user_id"]})
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")


def test_charts_use_the_callers_data_only(owner):
    stranger = make_user("Dedupe stranger")  # no reports at all
    res = save(stranger["id"], WITH_CHART)
    assert res.status_code == 200
    html = res.json()["html"]
    assert "<svg" not in html and "no lab values" in html and "14.1" not in html


def test_other_code_blocks_are_unchanged_and_the_chart_count_is_capped(owner):
    md = "# Mixed\n\n```python\nprint(1)\n```\n\n" + "\n".join(
        "```chart\n{\"kind\": \"trend\", \"tests\": [\"Hemoglobin\"]}\n```\n" for _ in range(report_render.MAX_CHARTS_PER_REPORT + 2)
    )
    html = save(owner["user_id"], md).json()["html"]
    assert "<code" in html and "print(1)" in html
    assert html.count("<svg") == report_render.MAX_CHARTS_PER_REPORT
    assert "Only the first" in html


def test_render_html_without_a_person_never_draws_a_chart():
    html = report_render.render_html("T", WITH_CHART, [])
    assert "<svg" not in html and "could not be drawn" in html


def test_a_chart_title_with_markup_is_escaped_in_the_report(owner):
    md = '# T\n\n```chart\n{"kind": "trend", "tests": ["Hemoglobin"], "title": "<script>alert(1)</script>"}\n```\n'
    body = save(owner["user_id"], md).json()["html"].split("<body>")[1]
    assert "<script>" not in body and "&lt;script&gt;" in body


def test_a_very_tall_chart_is_scaled_to_fit_one_pdf_page():
    assert report_render._pdf_width('<svg viewBox="0 0 720 400">') == report_render.PDF_CHART_WIDTH_PT
    narrow = report_render._pdf_width('<svg viewBox="0 0 720 1400">')
    assert narrow < report_render.PDF_CHART_WIDTH_PT and narrow * 1400 / 720 <= report_render.PDF_CHART_MAX_HEIGHT_PT + 1


def test_the_same_words_with_other_evidence_is_a_different_report(owner):
    refs_a = [{"ref": 1, "chunk_id": "chk_a", "report_id": "rpt_a"}]
    one = save(owner["user_id"], PLAIN + "\nEvidence test.\n", refs=refs_a).json()
    same = save(owner["user_id"], PLAIN + "\nEvidence test.\n", refs=refs_a).json()
    other = save(owner["user_id"], PLAIN + "\nEvidence test.\n", refs=[]).json()
    assert one["id"] == same["id"] and other["id"] != one["id"]
