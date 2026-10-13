"""Charts drawn from the person's own stored values: spec checks, case-insensitive names, inert SVG, red for out-of-range."""

from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import chart_service, report_service, series_service
from tests.conftest import make_user, sample_pdf

client = TestClient(app)
RED = "#ec3013"


@pytest.fixture(scope="module")
def owner():
    series_service.clear_cache()
    user = make_user("Chart owner")
    jan = report_service.process_upload(user["id"], "jan.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    jun = report_service.process_upload(user["id"], "jun.pdf", sample_pdf("synthetic_panel_2025-06-20.pdf"))
    scan = report_service.process_upload(
        user["id"], "scan.pdf", sample_pdf("VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf")
    )
    return {"user_id": user["id"], "jan": jan["id"], "jun": jun["id"], "scan": scan["id"]}


@pytest.fixture(scope="module")
def other():
    user = make_user("Chart other")
    june = report_service.process_upload(user["id"], "theirs.pdf", sample_pdf("synthetic_panel_2025-06-20.pdf"))
    return {"user_id": user["id"], "jun": june["id"]}


def chart(user_id, spec):
    return client.post("/api/agent/chart", json={"user_id": user_id, "spec": spec})


def assert_inert(svg: str) -> None:
    lowered = svg.lower()
    assert svg.startswith("<svg") and svg.endswith("</svg>")
    assert "<script" not in lowered and "<foreignobject" not in lowered and "<style" not in lowered
    assert not re.search(r"\son[a-z]+\s*=", lowered), "event attribute"
    assert "href" not in lowered and "<a " not in lowered and "<image" not in lowered and "url(" not in lowered
    assert "javascript:" not in lowered
    # the only URL allowed is the SVG namespace itself
    assert [m for m in re.findall(r"https?://[^\"' <]+", svg) if m != "http://www.w3.org/2000/svg"] == []
    assert 'viewBox="0 0 720 ' in svg and 'role="img"' in svg and "<title>" in svg
    assert 'font-family="Archivo, Arial, sans-serif"' in svg


# ------------------------------------------------------------------ the three kinds


def test_trend_for_one_test_returns_the_payload_and_a_clean_svg(owner):
    res = chart(owner["user_id"], {"kind": "trend", "tests": ["Hemoglobin"]})
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["kind"] == "trend" and data["title"] == "Hemoglobin over time"
    assert_inert(data["svg"])
    (series,) = data["series"]
    assert series["test"] == "Hemoglobin" and series["unit"] == "g/dL"
    jan, jun = series["points"]
    assert (jan["value"], jan["label"], jan["date_iso"], jan["report_id"]) == (13.8, "Jan 2025", "2025-01-15", owner["jan"])
    assert (jun["value"], jun["label"], jun["date_iso"], jun["report_id"]) == (14.1, "Jun 2025", "2025-06-20", owner["jun"])
    assert jan["flag"] == "NORMAL" and (jan["range_low"], jan["range_high"]) == (12.0, 15.5)
    for key in ("page_number", "chunk_id", "char_start", "char_end"):
        assert jan[key] is not None
    assert "13.8 g/dL" in data["svg"] and "14.1 g/dL" in data["svg"]
    assert "Jan 2025" in data["svg"] and "Jun 2025" in data["svg"]
    assert RED not in data["svg"]  # everything inside the range: no red
    assert data["notes"] == []


def test_trend_puts_undated_reports_last_and_up_to_four_tests_get_a_panel_each(owner):
    data = chart(owner["user_id"], {"kind": "trend", "tests": ["Vitamin D", "Total Cholesterol", "Hemoglobin", "TSH"]}).json()
    assert [s["test"] for s in data["series"]] == ["Vitamin D", "Total Cholesterol", "Hemoglobin", "TSH"]
    vit_d = data["series"][0]["points"]
    assert [p["label"] for p in vit_d] == ["Jan 2025", "Jun 2025", "Undated"]
    assert vit_d[-1]["date_iso"] is None and vit_d[-1]["report_id"] == owner["scan"]
    assert data["svg"].count("Printed range") >= 3


def test_out_of_range_values_are_red_with_a_direction_marker(owner):
    data = chart(owner["user_id"], {"kind": "trend", "tests": ["LDL Cholesterol"]}).json()
    svg = data["svg"]
    assert RED in svg and "<polygon" in svg  # red square and the triangle
    assert [p["flag"] for p in data["series"][0]["points"]] == ["HIGH", "HIGH"]
    low = chart(owner["user_id"], {"kind": "trend", "tests": ["Vitamin D"]}).json()
    assert low["series"][0]["points"][0]["flag"] == "LOW" and RED in low["svg"]
    # a value inside its range is ink, never red
    inside = chart(owner["user_id"], {"kind": "compare", "tests": ["Hemoglobin"]}).json()
    assert RED not in inside["svg"]


def test_compare_defaults_to_the_first_and_latest_dated_report(owner):
    res = chart(owner["user_id"], {"kind": "compare", "tests": ["LDL Cholesterol", "HDL Cholesterol"]})
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["kind"] == "compare"
    assert [s["test"] for s in data["series"]] == ["LDL Cholesterol", "HDL Cholesterol"]
    for s in data["series"]:
        assert [p["report_id"] for p in s["points"]] == [owner["jan"], owner["jun"]]
    assert_inert(data["svg"])
    assert "<rect" in data["svg"] and "148 mg/dL" in data["svg"] and "51 mg/dL" in data["svg"]


def test_compare_with_chosen_reports_and_the_rules_for_them(owner):
    ok = chart(owner["user_id"], {"kind": "compare", "tests": ["Total Cholesterol"], "reports": [owner["jun"], owner["scan"], owner["jan"]]})
    assert ok.status_code == 200, ok.text
    labels = [p["label"] for p in ok.json()["series"][0]["points"]]
    assert labels == ["Jan 2025", "Jun 2025", "Undated"]
    assert chart(owner["user_id"], {"kind": "compare", "tests": ["Hemoglobin"], "reports": [owner["jan"]]}).status_code == 422
    assert chart(owner["user_id"], {"kind": "compare", "tests": ["Hemoglobin"], "reports": [owner["jan"], "rpt_nope"]}).status_code == 422
    seven = [owner["jan"]] + [f"rpt_{i}" for i in range(6)]
    assert chart(owner["user_id"], {"kind": "compare", "tests": ["Hemoglobin"], "reports": seven}).status_code == 422


def test_compare_needs_two_reports_with_the_test(owner):
    res = chart(owner["user_id"], {"kind": "compare", "tests": ["Vitamin B12"]})
    assert res.status_code == 422 and "nothing to compare" in res.json()["detail"]


def test_values_of_one_report_against_its_printed_range(owner):
    res = chart(owner["user_id"], {"kind": "values", "report_id": owner["jan"], "title": "Everything in January"})
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["kind"] == "values" and data["title"] == "Everything in January"
    names = {s["test"] for s in data["series"]}
    assert {"Hemoglobin", "Vitamin D", "LDL Cholesterol", "TSH"} <= names
    assert all(len(s["points"]) == 1 and s["points"][0]["report_id"] == owner["jan"] for s in data["series"])
    assert_inert(data["svg"])
    assert RED in data["svg"] and "13.8 g/dL" in data["svg"] and "Everything in January" in data["svg"]
    assert chart(owner["user_id"], {"kind": "values", "report_id": "rpt_missing"}).status_code == 422


# -------------------------------------------------------------- names and validation


@pytest.mark.parametrize("name", ["hemoglobin", "HEMOGLOBIN", " hemo globin ", "Hemo_globin"])
def test_test_names_match_case_spaces_and_underscores_insensitively(owner, name):
    data = chart(owner["user_id"], {"kind": "trend", "tests": [name]}).json()
    assert data["series"][0]["test"] == "Hemoglobin"


def test_names_with_underscores_and_a_unique_start_resolve(owner):
    assert chart(owner["user_id"], {"kind": "trend", "tests": ["ldl_cholesterol"]}).json()["series"][0]["test"] == "LDL Cholesterol"
    assert chart(owner["user_id"], {"kind": "trend", "tests": ["LDL"]}).json()["series"][0]["test"] == "LDL Cholesterol"
    # "Vitamin" starts two different tests, so it is not guessed
    assert chart(owner["user_id"], {"kind": "trend", "tests": ["Vitamin"]}).status_code == 422


def test_an_unknown_test_is_a_plain_sentence(owner):
    res = chart(owner["user_id"], {"kind": "trend", "tests": ["Vitamin K"]})
    assert res.status_code == 422
    assert res.json() == {"detail": "There are no Vitamin K values in your reports."}


@pytest.mark.parametrize(
    "spec, fragment",
    [
        ({"kind": "trend", "tests": ["Hemoglobin"], "values": [13.8, 14.1]}, "must not contain values"),
        ({"kind": "trend", "tests": ["Hemoglobin"], "data": {"a": 1}}, "must not contain values"),
        ({"kind": "trend", "tests": ["Hemoglobin", 14]}, "must not contain numbers"),
        ({"kind": "trend", "tests": ["Hemoglobin"], "title": 7}, "must not contain numbers"),
        ({"kind": "trend", "tests": ["Hemoglobin"], "colour": "red"}, "do not know"),
        ({"kind": "pie", "tests": ["Hemoglobin"]}, "trend, compare or values"),
        ({"tests": ["Hemoglobin"]}, "trend, compare or values"),
        ({"kind": "trend"}, "at least 1 test"),
        ({"kind": "trend", "tests": []}, "at least 1 test"),
        ({"kind": "trend", "tests": "Hemoglobin"}, "list of names"),
        ({"kind": "trend", "tests": ["a", "b", "c", "d", "e"]}, "at most 4 tests"),
        ({"kind": "trend", "tests": ["Hemoglobin"], "title": "x" * 121}, "120"),
        ({"kind": "trend", "tests": ["Hemoglobin"], "reports": ["a", "b"]}, "all your reports"),
        ({"kind": "values"}, "report_id"),
        ({"kind": "values", "report_id": "rpt_x", "tests": ["Hemoglobin"]}, "only a report_id"),
        ({"kind": "compare", "tests": ["Hemoglobin"], "report_id": "rpt_x"}, "does not take a report_id"),
        (["not", "an", "object"], "JSON object"),
        (None, "JSON object"),
    ],
)
def test_bad_specs_are_refused_with_a_plain_sentence(owner, spec, fragment):
    res = chart(owner["user_id"], spec)
    assert res.status_code == 422, res.text
    detail = res.json()["detail"]
    assert isinstance(detail, str) and fragment in detail


def test_a_title_of_exactly_120_characters_is_fine(owner):
    assert chart(owner["user_id"], {"kind": "trend", "tests": ["Hemoglobin"], "title": "x" * 120}).status_code == 200


def test_a_title_with_markup_is_escaped_in_the_svg(owner):
    nasty = '<script>alert(1)</script>"><img onerror=x>'
    data = chart(owner["user_id"], {"kind": "trend", "tests": ["Hemoglobin"], "title": nasty}).json()
    assert "<script>" not in data["svg"] and "<img" not in data["svg"]
    assert "&lt;script&gt;" in data["svg"]


# --------------------------------------------------------------------------- people


def test_a_chart_only_uses_the_callers_own_reports(owner, other):
    mine = chart(owner["user_id"], {"kind": "trend", "tests": ["Hemoglobin"]}).json()
    theirs = chart(other["user_id"], {"kind": "trend", "tests": ["Hemoglobin"]}).json()
    assert len(mine["series"][0]["points"]) == 2
    assert [p["report_id"] for p in theirs["series"][0]["points"]] == [other["jun"]]
    assert owner["jan"] not in theirs["svg"] and theirs["series"][0]["points"][0]["value"] == 14.1
    # one point only: no trend yet, and it says so
    assert any("no trend yet" in note for note in theirs["notes"])


def test_another_persons_report_and_tests_are_not_reachable(owner, other):
    assert chart(other["user_id"], {"kind": "values", "report_id": owner["jan"]}).status_code == 422
    assert chart(other["user_id"], {"kind": "compare", "tests": ["Hemoglobin"], "reports": [other["jun"], owner["jan"]]}).status_code == 422
    # the scanned report has HbA1c and Weight, which "other" never uploaded
    assert chart(other["user_id"], {"kind": "trend", "tests": ["Weight"]}).json() == {"detail": "There are no Weight values in your reports."}


def test_a_person_without_values_gets_a_plain_sentence():
    empty = make_user("Chart empty")
    res = chart(empty["id"], {"kind": "trend", "tests": ["Hemoglobin"]})
    assert res.status_code == 422 and "no lab values" in res.json()["detail"]


def test_an_unknown_person_is_404():
    assert chart("usr_nobody_123", {"kind": "trend", "tests": ["Hemoglobin"]}).status_code == 404


def test_labels_add_the_day_when_two_reports_share_a_month():
    labels = chart_service._labels_for(
        [
            {"report_id": "a", "date_iso": "2025-01-03"},
            {"report_id": "b", "date_iso": "2025-01-20"},
            {"report_id": "c", "date_iso": None},
            {"report_id": "d", "date_iso": None},
        ]
    )
    assert labels == {"a": "3 Jan 2025", "b": "20 Jan 2025", "c": "Undated", "d": "Undated (2)"}
