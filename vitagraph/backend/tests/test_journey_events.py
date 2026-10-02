"""Upload journey: real per-page, OCR-box, chunk/embedding/graph payloads and page render."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services import report_service
from app.services.job_service import job_broker
from tests.conftest import make_user, sample_pdf

client = TestClient(app)


def _events(jid: str) -> list[dict]:
    return list(job_broker._jobs[jid]["events"])


def _upload(name: str, jid: str) -> dict:
    user = make_user("Journey persona")
    res = report_service.process_upload(user["id"], name, sample_pdf(name), job_id=jid)
    assert res["status"] == "ready", res["error_message"]
    return res


def test_stage_events_carry_real_payloads():
    jid = "journey_native"
    res = _upload("synthetic_panel_2025-01-15.pdf", jid)
    evts = _events(jid)
    by_stage = {}
    for e in evts:
        by_stage.setdefault(e["stage"], []).append(e)

    rec = by_stage["received"][0]["metadata"]
    assert len(rec["file_hash"]) == 64 and rec["size_bytes"] > 0 and rec["version"] >= 1

    pages = [e for e in evts if e.get("event_type") == "page_extracted"]
    assert len(pages) == res["page_count"]
    assert [p["metadata"]["page_number"] for p in pages] == list(range(1, res["page_count"] + 1))
    # per-page events arrive before the Extracted stage event
    assert evts.index(pages[-1]) < evts.index(by_stage["extracted"][0])
    ext = by_stage["extracted"][0]["metadata"]
    assert ext["page_count"] == res["page_count"]
    assert ext["total_chars"] == sum(p["chars"] for p in ext["pages"])

    ch = by_stage["chunked"][0]["metadata"]
    assert ch["total_chunks"] == res["chunk_count"]
    first = ch["chunks"][0]
    assert first["char_end"] > first["char_start"] and first["preview"]

    emb = by_stage["embedded"][0]["metadata"]
    assert emb["dim"] == 384 and emb["count"] == res["chunk_count"]
    assert len(emb["samples"][0]["values"]) == 8

    idx = by_stage["indexed"][0]["metadata"]
    assert idx["metric"] == "cosine" and idx["indexed"] == res["chunk_count"]

    gr = by_stage["graphed"][0]["metadata"]
    assert gr["total_nodes"] > 0 and gr["total_edges"] > 0 and gr["nodes"]


def test_ocr_page_emits_real_detection_boxes():
    jid = "journey_ocr"
    _upload("VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf", jid)
    pages = [e["metadata"] for e in _events(jid) if e.get("event_type") == "page_extracted"]
    ocr_pages = [p for p in pages if p["method"].startswith("ocr")]
    assert ocr_pages, "scanned sample must go through OCR"
    boxes = ocr_pages[0]["ocr_boxes"]
    assert boxes
    for b in boxes:
        assert 0.0 <= b["x0"] < b["x1"] <= 1.0 and 0.0 <= b["y0"] < b["y1"] <= 1.0
        assert b["text"]


def test_page_image_endpoint_serves_png():
    user = make_user("Render persona")
    res = report_service.process_upload(
        user["id"], "p.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    r = client.get(f"/api/reports/{res['id']}/pages/1/image")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert r.content[:8] == b"\x89PNG\r\n\x1a\n"
    assert client.get(f"/api/reports/{res['id']}/pages/999/image").status_code == 404
    assert client.get("/api/reports/rpt_missing/pages/1/image").status_code == 404


def test_corrupted_upload_fails_without_leaking_server_paths():
    user = make_user("Corrupt persona")
    res = report_service.process_upload(user["id"], "bad.pdf", b"not a pdf at all", job_id="journey_bad")
    assert res["status"] == "failed"
    msg = res["error_message"]
    assert msg and "\\" not in msg and "/data/" not in msg and "uploads" not in msg
    evts = _events("journey_bad")
    assert evts[-1]["stage"] == "done" and "uploads" not in evts[-1]["description"]


def test_report_scoped_retrieval_never_returns_other_reports():
    from app.rag import retriever

    user = make_user("Scope persona")
    a = report_service.process_upload(user["id"], "a.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    b = report_service.process_upload(user["id"], "b.pdf", sample_pdf("synthetic_panel_2025-06-20.pdf"))
    assert a["status"] == b["status"] == "ready"

    only_a = retriever.retrieve(user["id"], "Hemoglobin", top_k=10, report_id=a["id"])
    only_b = retriever.retrieve(user["id"], "Hemoglobin", top_k=10, report_id=b["id"])
    assert only_a and only_b
    assert {h["metadata"]["report_id"] for h in only_a} == {a["id"]}
    assert {h["metadata"]["report_id"] for h in only_b} == {b["id"]}


def test_stream_rag_only_mode_does_not_call_the_ai():
    user = make_user("RagOnly persona")
    res = report_service.process_upload(user["id"], "a.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    r = client.post("/api/questions/stream", json={
        "user_id": user["id"], "text": "What was my hemoglobin level?",
        "job_id": "rag_only_1", "report_id": res["id"], "mode": "rag_only",
    })
    assert r.status_code == 200
    body = r.text
    assert "event: thinking" not in body and "event: tool_call" not in body
    out = client.get("/api/jobs/rag_only_1/result").json()["result"]
    assert out["status"] == "answered" and out["ai_service_status"] == "not_used"
    assert out["evidence"] and {e["report_id"] for e in out["evidence"]} == {res["id"]}
