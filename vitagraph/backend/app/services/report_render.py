"""Turns an agent-written Markdown report into HTML (and a PDF) with the app's own template.

The model never writes HTML. It writes Markdown, which is rendered here with raw HTML, images and links switched OFF (so tags are
shown as text, never run) and a strict Content-Security-Policy in the document. The evidence
appendix is read from the database for the person's own reports, so every quoted passage is real and traceable.
"""

from __future__ import annotations

import html as html_lib
import io
import json
import re
from datetime import datetime, timezone
from typing import Any

from markdown_it import MarkdownIt

from app.services import chart_service, report_service

MAX_MARKDOWN_CHARS = 30000
MAX_CHARTS_PER_REPORT = 6
MAX_CHART_SPEC_CHARS = 2000
MAX_REFS = 30
QUOTE_CHARS = 600

_md = MarkdownIt("commonmark", {"html": False, "linkify": False, "typographer": False}).enable("table").disable(["image", "link", "autolink"])


def _chart_note(text: str) -> str:
    return f'<p class="meta">{_escape(text)}</p>'


def _chart_block(content: str, env: dict[str, Any]) -> str:
    """A ```chart block: the server draws it from the person's own values. A bad spec becomes a short plain note."""
    user_id = env.get("user_id")
    if not user_id:
        return _chart_note("A chart was requested here but could not be drawn.")
    env["charts"] = env.get("charts", 0) + 1
    if env["charts"] > MAX_CHARTS_PER_REPORT:
        return _chart_note(f"Only the first {MAX_CHARTS_PER_REPORT} charts are drawn in a report.")
    if len(content) > MAX_CHART_SPEC_CHARS:
        return _chart_note("This chart could not be drawn.")
    try:
        spec = json.loads(content)
    except ValueError:
        return _chart_note("This chart could not be drawn.")
    try:
        result = chart_service.build_chart(user_id, spec)
    except chart_service.ChartError as exc:
        return _chart_note(f"This chart could not be drawn. {exc}")
    except Exception:
        return _chart_note("This chart could not be drawn.")
    return f'<div class="chart">{result["svg"]}</div>'


_default_fence = _md.renderer.rules["fence"]


def _fence(tokens, idx, options, env):
    info = (tokens[idx].info or "").strip().split(" ")[0].lower()
    if info == "chart":
        return _chart_block(tokens[idx].content, env)
    return _default_fence(tokens, idx, options, env)


_md.renderer.rules["fence"] = _fence

CSS = """
body { font-family: sans-serif; font-size: 10.5pt; line-height: 1.5; color: #201e1d; }
.brand { font-size: 8.5pt; font-weight: bold; letter-spacing: 1pt; color: #ae1800; }
h1 { font-size: 21pt; line-height: 1.15; margin: 4pt 0 2pt 0; }
h2 { font-size: 11pt; margin: 16pt 0 4pt 0; padding-top: 5pt; border-top: 2pt solid #201e1d; }
h3 { font-size: 10.5pt; margin: 10pt 0 2pt 0; }
p { margin: 0 0 7pt 0; }
ul, ol { margin: 0 0 7pt 0; }
li { margin-bottom: 3pt; }
table { border-collapse: collapse; width: 100%; margin: 4pt 0 9pt 0; }
th { text-align: left; font-size: 8.5pt; border-bottom: 2pt solid #201e1d; padding: 3pt 5pt; }
td { border-bottom: 1pt solid #cfcdcd; padding: 3pt 5pt; }
blockquote { margin: 0 0 7pt 0; padding-left: 8pt; border-left: 3pt solid #ec3013; }
code { font-weight: bold; }
.chart { margin: 4pt 0 10pt 0; }
.chart svg { max-width: 100%; height: auto; }
.meta { color: #605d5d; font-size: 9pt; margin: 0 0 10pt 0; }
.quote { color: #605d5d; font-size: 9pt; }
.footer { margin-top: 16pt; padding-top: 6pt; border-top: 1pt solid #cfcdcd; font-size: 8.5pt; color: #605d5d; }
"""

CSP = "default-src 'none'; style-src 'unsafe-inline'"


def _escape(text: str) -> str:
    return html_lib.escape(text, quote=True)


def title_and_body(markdown: str, fallback_title: str) -> tuple[str, str]:
    """Use a leading '# Heading' as the title (and drop it from the body); otherwise the given title."""
    text = markdown.strip()
    match = re.match(r"#[ \t]+(.+?)[ \t]*\n+", text + "\n")
    if match:
        return match.group(1).strip()[:120], text[match.end():]
    return fallback_title.strip()[:120] or "Report", text


def evidence_rows(user_id: str, refs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Real passages for the cited references. Anything that is not this person's own passage is skipped."""
    rows: list[dict[str, Any]] = []
    seen: set[int] = set()
    for item in refs[:MAX_REFS]:
        try:
            ref = int(item["ref"])
            report = report_service.assert_report_owner(str(item["report_id"]), user_id)
            chunk = report_service.get_chunk(report["id"], str(item["chunk_id"]))
        except Exception:
            continue
        if ref in seen:
            continue
        seen.add(ref)
        rows.append(
            {
                "ref": ref,
                "filename": report.get("original_filename") or "report",
                "page": chunk["page_number"],
                "start": chunk["char_start"],
                "end": chunk["char_end"],
                "text": " ".join(str(chunk["text"]).split())[:QUOTE_CHARS],
            }
        )
    return sorted(rows, key=lambda r: r["ref"])


def render_html(
    title: str,
    markdown: str,
    evidence: list[dict[str, Any]],
    *,
    now: datetime | None = None,
    user_id: str | None = None,
) -> str:
    """The finished report as one self-contained HTML document.

    `user_id` lets ```chart blocks be drawn from that person's own values (never from anything the model typed).
    """
    if len(markdown) > MAX_MARKDOWN_CHARS:
        raise ValueError(f"The report is longer than {MAX_MARKDOWN_CHARS} characters.")
    clean_title, body_md = title_and_body(markdown, title)
    body = _md.render(body_md, {"user_id": user_id})
    stamp = (now or datetime.now(timezone.utc)).strftime("%d %B %Y")

    appendix = ""
    if evidence:
        items = "".join(
            f"<li><b>[{row['ref']}]</b> {_escape(row['filename'])}, page {row['page']}, characters {row['start']}-{row['end']}"
            f"<br/><span class=\"quote\">“{_escape(row['text'])}”</span></li>"
            for row in evidence
        )
        appendix = f"<h2>Evidence</h2><ol>{items}</ol>"

    return (
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        f"<meta http-equiv=\"Content-Security-Policy\" content=\"{CSP}\">"
        f"<title>{_escape(clean_title)}</title><style>{CSS}</style></head><body>"
        "<div class=\"brand\">VITAGRAPH &middot; REPORT SUMMARY</div>"
        f"<h1>{_escape(clean_title)}</h1>"
        f"<p class=\"meta\">Prepared {stamp}. An educational summary of your own reports, not a diagnosis.</p>"
        f"{body}{appendix}"
        "<div class=\"footer\">VitaGraph is an educational tool. It does not diagnose, treat or give medical advice. "
        "Check every value against the cited passage and ask a clinician about anything that matters.</div>"
        "</body></html>"
    )


_SVG = re.compile(r"<svg\b.*?</svg>", re.DOTALL)
PDF_CHART_WIDTH_PT = 487  # the A4 text area
PDF_CHART_MAX_HEIGHT_PT = 690


def _svg_to_png(svg: str) -> bytes:
    import pymupdf

    # MuPDF's SVG reader ignores font-family on the root element, so set it on every text node (Helvetica is built in).
    prepared = svg.replace("<text ", '<text font-family="Helvetica" ')
    doc = pymupdf.open(stream=prepared.encode("utf-8"), filetype="svg")
    try:
        return doc[0].get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False).tobytes("png")
    finally:
        doc.close()


def _pdf_width(svg: str) -> int:
    """Width in points: the full text width, or less for a very tall chart so it still fits on one page."""
    found = re.search(r'viewBox="0 0 ([0-9.]+) ([0-9.]+)"', svg)
    if not found:
        return PDF_CHART_WIDTH_PT
    width, height = float(found.group(1)), float(found.group(2))
    return int(min(PDF_CHART_WIDTH_PT, PDF_CHART_MAX_HEIGHT_PT * width / max(height, 1.0)))


def _charts_to_images(document_html: str):
    """Swap each inline chart SVG for a PNG image (the PDF engine cannot draw inline SVG) and return the images as an archive."""
    import pymupdf

    archive = pymupdf.Archive()
    count = 0

    def swap(match: re.Match[str]) -> str:
        nonlocal count
        try:
            png = _svg_to_png(match.group(0))
        except Exception:
            return '<p class="meta">This chart could not be drawn.</p>'
        name = f"chart_{count}.png"
        count += 1
        archive.add(png, name)
        return f'<img src="{name}" width="{_pdf_width(match.group(0))}"/>'

    return _SVG.sub(swap, document_html), archive


def render_pdf(document_html: str) -> bytes:
    """A4 PDF of the same document, drawn with PyMuPDF's HTML engine (simple CSS only)."""
    import pymupdf

    document_html, archive = _charts_to_images(document_html)
    story = pymupdf.Story(html=document_html, user_css=CSS, archive=archive)
    buffer = io.BytesIO()
    writer = pymupdf.DocumentWriter(buffer)
    page = pymupdf.paper_rect("a4")
    area = page + (54, 54, -54, -54)
    more = True
    pages = 0
    while more and pages < 60:
        device = writer.begin_page(page)
        more, _ = story.place(area)
        story.draw(device)
        writer.end_page()
        pages += 1
    writer.close()
    return buffer.getvalue()


def slug(title: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "-", title).strip("-").lower()
    return cleaned[:60] or "report"
