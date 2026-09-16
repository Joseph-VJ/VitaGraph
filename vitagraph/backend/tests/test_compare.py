"""Test report comparison and chunk_count in listings (US-10)."""

from __future__ import annotations

from app.services import report_service
from tests.conftest import make_user, sample_pdf


def test_list_reports_includes_chunk_count():
    user = make_user("Chunk count persona")
    report_service.process_upload(
        user["id"], "panel_jan.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf")
    )
    reports = report_service.list_reports(user["id"])
    assert len(reports) == 1
    assert reports[0]["chunk_count"] > 0
    assert reports[0]["page_count"] > 0


def test_compare_reports_diff_rows():
    user = make_user("Compare persona")
    r1 = report_service.process_upload(
        user["id"], "jan.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf")
    )
    r2 = report_service.process_upload(
        user["id"], "jun.pdf", sample_pdf("synthetic_panel_2025-06-20.pdf")
    )

    comp = report_service.compare_reports(user["id"], baseline_id=r1["id"], followup_id=r2["id"])
    assert comp["baseline_report_id"] == r1["id"]
    assert comp["followup_report_id"] == r2["id"]
    assert len(comp["rows"]) > 0

    # Hemoglobin was 13.8 in Jan and 14.1 in Jun
    hemo_row = next((r for r in comp["rows"] if r["test"] == "Hemoglobin"), None)
    assert hemo_row is not None
    assert hemo_row["baseline"] == "13.8"
    assert hemo_row["followup"] == "14.1"
    assert hemo_row["status"] == "improved"

    # Verify summary counts
    summary = comp["summary"]
    assert summary["total"] == len(comp["rows"])
    assert summary["improved"] + summary["declined"] + summary["stable"] + summary["unavailable"] == summary["total"]
