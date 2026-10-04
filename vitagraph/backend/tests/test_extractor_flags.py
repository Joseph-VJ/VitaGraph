"""Extractor must not attach a flag or a reference range that belongs to somewhere else."""

from __future__ import annotations

from app.graph.extractor import extract_entities_from_chunk


def _by_name(text: str) -> dict[str, dict]:
    ents = extract_entities_from_chunk(text, chunk_id="c1", report_id="r1", page_number=1, date="2024-11-01")
    return {e["test_name"]: e for e in ents}


def test_flag_word_on_the_next_line_is_not_attached_to_earlier_tests():
    by = _by_name("Lab Values:\n- HbA1c: 5.8 %\n- Total Cholesterol: 224 mg/dL\n- Vitamin D: 18 ng/mL -low\n")
    assert by["Vitamin D"]["flag"] == "LOW"          # the flag printed on its own line still counts
    assert by["HbA1c"]["flag"] == "NORMAL"
    assert by["Total Cholesterol"]["flag"] == "NORMAL"


def test_labelled_flag_on_a_following_line_still_counts():
    by = _by_name("Hemoglobin\nResult: 9.1 g/dL\nReference range: 13.0 - 17.0\nFlag: LOW\n")
    assert by["Hemoglobin"]["flag"] == "LOW"
    assert by["Hemoglobin"]["reference_range"] == "13.0 - 17.0"


def test_reference_range_must_contain_a_number():
    by = _by_name("Weight: 82 kg Height: 172 cm BMI: 27.7\n")
    assert by["Weight"]["value"] == 82.0
    assert by["Weight"]["reference_range"] is None


def test_a_real_inline_range_is_kept():
    # Not a canonical test, so it goes through the generic row pattern that Edit C touches.
    by = _by_name("Serum Glucose: 94 mg/dL 70 - 99\n")
    assert by["Serum Glucose"]["value"] == 94.0
    assert by["Serum Glucose"]["reference_range"] == "70 - 99"
