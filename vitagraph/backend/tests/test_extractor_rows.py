"""Generic rows must stay on one line: no line break in a name, no range that eats the next row."""

from __future__ import annotations

from app.graph.extractor import extract_entities_from_chunk


def _by_name(text: str) -> dict[str, dict]:
    ents = extract_entities_from_chunk(text, chunk_id="c1", report_id="r1", page_number=1, date="2024-11-01")
    return {e["test_name"]: e for e in ents}


def test_a_test_name_never_contains_a_line_break():
    by = _by_name("Cholesterol, Total\nResult 198 mg/dL\n\nTSH\nResult 2.1 uIU/mL\n")
    assert set(by) == {"Total Cholesterol", "TSH"}


def test_a_reference_range_does_not_swallow_the_next_row():
    by = _by_name("Serum Glucose: 94 mg/dL 70 - 99\nWeight: 82 kg Height: 172 cm BMI: 27.7\n")
    assert by["Serum Glucose"]["reference_range"] == "70 - 99"
    assert by["Weight"]["value"] == 82.0


def test_the_words_result_and_value_are_labels_not_tests():
    by = _by_name("Result: 5.1 mg/dL\nValue: 3 mg/dL\n")
    assert by == {}


def test_bullet_rows_keep_their_own_range_and_flag():
    by = _by_name("- Sodium: 140 mmol/L 135 - 145\n- Potassium: 5.9 mmol/L 3.5 - 5.1\n")
    assert by["Sodium"]["reference_range"] == "135 - 145"
    assert by["Potassium"]["value"] == 5.9
    assert by["Potassium"]["reference_range"] == "3.5 - 5.1"
    assert by["Potassium"]["flag"] == "HIGH"
