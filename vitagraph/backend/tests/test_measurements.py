"""GET /api/reports/{id}/measurements: real values, printed reference ranges, exact spans."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services import measurement_service, report_service
from tests.conftest import make_user, sample_pdf

client = TestClient(app)


def _report():
    user = make_user("Measurement Test User")
    res = report_service.process_upload(user["id"], "jan.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    assert res["status"] == "ready"
    return user, res["id"]


def test_measurements_have_values_ranges_and_exact_spans():
    _, rid = _report()
    res = client.get(f"/api/reports/{rid}/measurements")
    assert res.status_code == 200
    rows = res.json()
    assert rows, "the synthetic panel must yield measurements"

    pages = {p["page_number"]: p["extracted_text"] for p in client.get(f"/api/reports/{rid}/pages").json()}
    exact = [r for r in rows if r["span_exact"]]
    assert exact, "at least one value must be located exactly"
    for r in exact:
        snippet = pages[r["page_number"]][r["char_start"]:r["char_end"]]
        assert float(snippet.replace(",", "")) == r["value"], (r["test_name"], snippet)

    names = [r["test_name"].lower() for r in rows]
    assert len(names) == len(set(names)), "one row per test"
    with_range = [r for r in rows if r["range_low"] is not None and r["range_high"] is not None]
    for r in with_range:
        assert r["range_low"] < r["range_high"]
        assert r["reference_range"]


def test_measurements_unknown_report_is_404():
    res = client.get("/api/reports/rpt_does_not_exist/measurements")
    assert res.status_code == 404


def test_parse_range_variants():
    assert measurement_service.parse_range("13.0 - 17.0 g/dL") == (13.0, 17.0)
    assert measurement_service.parse_range("4,000 \u2013 11,000") == (4000.0, 11000.0)
    assert measurement_service.parse_range("< 200 mg/dL") == (None, 200.0)
    assert measurement_service.parse_range("> 40") == (40.0, None)
    assert measurement_service.parse_range(None) == (None, None)
    assert measurement_service.parse_range("see note") == (None, None)
