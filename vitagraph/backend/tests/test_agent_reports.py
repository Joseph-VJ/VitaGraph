"""Saved reports: Markdown in, safe HTML and a real PDF out, evidence read from the database, per-person isolation."""

from __future__ import annotations

import pymupdf
import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app
from app.services import report_render, report_service
from tests.conftest import make_user, sample_pdf

client = TestClient(app)

MARKDOWN = """# Hemoglobin check

Your hemoglobin is **14.1 g/dL** [1], inside the printed range.

## Values
| Test | Value | Flag |
|---|---|---|
| Hemoglobin | 14.1 g/dL | In range |

- **Note:** values come from the cited passage.
"""


@pytest.fixture(scope="module")
def owner():
    user = make_user("Report owner")
    report = report_service.process_upload(user["id"], "jan.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    with get_db() as db:
        chunk = db.execute(
            "SELECT id, text, char_start, char_end, page_number FROM report_chunks WHERE report_id = ? ORDER BY sequence LIMIT 1",
            (report["id"],),
        ).fetchone()
    return {"user_id": user["id"], "report_id": report["id"], "chunk": dict(chunk)}


def body(owner, **over):
    payload = {
        "user_id": owner["user_id"],
        "title": "Fallback title",
        "markdown": MARKDOWN,
        "refs": [{"ref": 1, "chunk_id": owner["chunk"]["id"], "report_id": owner["report_id"]}],
    }
    payload.update(over)
    return payload


# ------------------------------------------------------------------ rendering


def test_the_html_uses_the_heading_as_title_and_has_a_strict_policy():
    html = report_render.render_html("ignored", MARKDOWN, [])
    assert "<title>Hemoglobin check</title>" in html
    assert html.count("<h1>") == 1  # the leading heading became the title, not a second heading
    assert "Content-Security-Policy" in html and "default-src 'none'" in html
    assert "<table>" in html and "<strong>14.1 g/dL</strong>" in html
    assert "not a diagnosis" in html


def test_model_html_scripts_images_and_links_are_shown_as_text_never_run():
    nasty = (
        "# T\n\n<script>alert(1)</script> <img src=x onerror=alert(2)> <iframe src=//evil></iframe>\n\n"
        "[click](javascript:alert(3)) [site](https://evil.example) ![pic](https://evil.example/p.png) <https://evil.example>\n"
    )
    body_html = report_render.render_html("T", nasty, []).split("<body>")[1]
    for forbidden in ("<script", "<img", "<iframe", "<a ", "href="):
        assert forbidden not in body_html, forbidden
    assert "&lt;script&gt;" in body_html


def test_a_title_with_markup_is_escaped():
    html = report_render.render_html('x"><script>alert(1)</script>', "text only", [])
    assert "<script>alert(1)</script>" not in html and "&lt;script&gt;" in html


def test_an_oversized_report_is_refused():
    with pytest.raises(ValueError):
        report_render.render_html("T", "x" * (report_render.MAX_MARKDOWN_CHARS + 1), [])


def test_the_pdf_is_a_real_a4_document_with_the_text():
    html = report_render.render_html("T", MARKDOWN, [])
    pdf = report_render.render_pdf(html)
    assert pdf.startswith(b"%PDF")
    doc = pymupdf.open(stream=pdf, filetype="pdf")
    text = "".join(p.get_text() for p in doc)
    assert (round(doc[0].rect.width), round(doc[0].rect.height)) == (595, 842)
    assert "Hemoglobin check" in text and "14.1 g/dL" in text and "educational tool" in text.lower()


def test_a_long_report_flows_onto_more_pages():
    long_md = "# Long\n\n" + "\n\n".join(f"Paragraph {i} " + "word " * 60 for i in range(60))
    doc = pymupdf.open(stream=report_render.render_pdf(report_render.render_html("L", long_md, [])), filetype="pdf")
    assert len(doc) >= 3


# -------------------------------------------------------------------- routes


def test_creating_a_report_saves_html_and_pdf_with_evidence_from_the_database(owner):
    res = client.post("/api/agent/reports", json=body(owner))
    assert res.status_code == 200, res.text
    saved = res.json()
    assert saved["title"] == "Hemoglobin check" and saved["id"].startswith("art_")
    chunk = owner["chunk"]
    assert f"characters {chunk['char_start']}-{chunk['char_end']}" in saved["html"]
    assert "jan.pdf" in saved["html"]

    pdf = client.get(f"/api/agent/reports/{saved['id']}/pdf", params={"user_id": owner["user_id"]})
    assert pdf.status_code == 200 and pdf.headers["content-type"] == "application/pdf"
    assert pdf.headers["content-disposition"] == 'attachment; filename="hemoglobin-check.pdf"'
    assert pdf.content.startswith(b"%PDF")
    text = "".join(p.get_text() for p in pymupdf.open(stream=pdf.content, filetype="pdf"))
    assert "Evidence" in text and "jan.pdf" in text

    assert client.get(f"/api/agent/reports/{saved['id']}", params={"user_id": owner["user_id"]}).json()["html"] == saved["html"]
    assert saved["id"] in [r["id"] for r in client.get("/api/agent/reports", params={"user_id": owner["user_id"]}).json()]


def test_evidence_that_is_not_the_callers_own_passage_is_left_out(owner):
    stranger = make_user("Report stranger")
    forged = body(owner, user_id=stranger["id"])  # the stranger cites the owner's passage
    saved = client.post("/api/agent/reports", json=forged).json()
    assert "jan.pdf" not in saved["html"] and "<h2>Evidence</h2>" not in saved["html"]
    invented = body(owner, refs=[{"ref": 1, "chunk_id": "chk_does_not_exist", "report_id": owner["report_id"]}])
    assert "<h2>Evidence</h2>" not in client.post("/api/agent/reports", json=invented).json()["html"]


def test_one_person_can_never_read_download_or_delete_anothers_report(owner):
    saved = client.post("/api/agent/reports", json=body(owner)).json()
    other = make_user("Report other")
    for method, url in (("get", f"/api/agent/reports/{saved['id']}"), ("get", f"/api/agent/reports/{saved['id']}/pdf"), ("delete", f"/api/agent/reports/{saved['id']}")):
        assert getattr(client, method)(url, params={"user_id": other["id"]}).status_code == 404
    assert saved["id"] not in [r["id"] for r in client.get("/api/agent/reports", params={"user_id": other["id"]}).json()]
    assert client.get(f"/api/agent/reports/{saved['id']}", params={"user_id": owner["user_id"]}).status_code == 200


def test_deleting_a_report_removes_it(owner):
    saved = client.post("/api/agent/reports", json=body(owner)).json()
    assert client.delete(f"/api/agent/reports/{saved['id']}", params={"user_id": owner["user_id"]}).json() == {"deleted": saved["id"]}
    assert client.get(f"/api/agent/reports/{saved['id']}", params={"user_id": owner["user_id"]}).status_code == 404


def test_bad_input_is_refused(owner):
    assert client.post("/api/agent/reports", json=body(owner, markdown="")).status_code == 422
    assert client.post("/api/agent/reports", json=body(owner, markdown="x" * 30001)).status_code == 422
    assert client.post("/api/agent/reports", json=body(owner, title="")).status_code == 422
    assert client.post("/api/agent/reports", json=body(owner, conversation_id="../x")).status_code == 422
    assert client.post("/api/agent/reports", json=body(owner, user_id="usr_nobody_123")).status_code == 404


def test_removing_a_persona_removes_its_saved_reports(owner):
    person = make_user("Report goner")
    saved = client.post("/api/agent/reports", json=body(owner, user_id=person["id"], refs=[])).json()
    assert client.delete(f"/api/users/{person['id']}").status_code in (200, 204)
    with get_db() as db:
        assert db.execute("SELECT COUNT(*) AS n FROM agent_artifacts WHERE id = ?", (saved["id"],)).fetchone()["n"] == 0
