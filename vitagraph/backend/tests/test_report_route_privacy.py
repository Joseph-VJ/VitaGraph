"""Privacy checks for per-report routes: pages, measurements, and page images."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import report_service
from tests.conftest import make_user, sample_pdf

client = TestClient(app)


@pytest.fixture(scope="module")
def personas_and_reports():
    user_a = make_user("Persona A")
    res_a = report_service.process_upload(
        user_a["id"], "panel_a.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf")
    )
    assert res_a["status"] == "ready"

    user_b = make_user("Persona B")
    res_b = report_service.process_upload(
        user_b["id"], "panel_b.pdf", sample_pdf("synthetic_panel_2025-06-20.pdf")
    )
    assert res_b["status"] == "ready"

    return user_a, res_a["id"], user_b, res_b["id"]


def test_pages_refuse_another_persona(personas_and_reports):
    user_a, rpt_a, user_b, _ = personas_and_reports
    # Asking for A's report with B's user_id must return 404
    res = client.get(f"/api/reports/{rpt_a}/pages", params={"user_id": user_b["id"]})
    assert res.status_code == 404


def test_measurements_refuse_another_persona(personas_and_reports):
    user_a, rpt_a, user_b, _ = personas_and_reports
    # Asking for A's measurements with B's user_id must return 404
    res = client.get(f"/api/reports/{rpt_a}/measurements", params={"user_id": user_b["id"]})
    assert res.status_code == 404


def test_page_image_refuses_another_persona(personas_and_reports):
    user_a, rpt_a, user_b, _ = personas_and_reports
    # Asking for A's page 1 image with B's user_id must return 404
    res = client.get(f"/api/reports/{rpt_a}/pages/1/image", params={"user_id": user_b["id"]})
    assert res.status_code == 404


def test_the_owner_still_gets_pages_and_measurements(personas_and_reports):
    user_a, rpt_a, _, _ = personas_and_reports
    # With A's own user_id, pages and measurements return 200
    res_pages = client.get(f"/api/reports/{rpt_a}/pages", params={"user_id": user_a["id"]})
    assert res_pages.status_code == 200
    assert len(res_pages.json()) > 0

    res_meas = client.get(f"/api/reports/{rpt_a}/measurements", params={"user_id": user_a["id"]})
    assert res_meas.status_code == 200
    assert len(res_meas.json()) > 0

    res_img = client.get(f"/api/reports/{rpt_a}/pages/1/image", params={"user_id": user_a["id"]})
    assert res_img.status_code == 200
    assert res_img.headers["content-type"] == "image/png"
