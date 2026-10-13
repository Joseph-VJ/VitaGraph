"""The redactor masks identifiers and nothing the analysis needs."""

from __future__ import annotations

import pytest

from app.privacy.redactor import PLACEHOLDER_RE, Vault, learn_labelled, redact_text

JAN = (
    "Riverdale Diagnostics - Synthetic Demo Laboratory\nPatient: Demo Persona A\nCollection Date: 15 January 2025\n"
    "Report ID: SYN-2025-0115-A\nNote: This is a synthetic report generated for an academic project.\n"
    "All values are fictional.\nComprehensive Health Panel\nHemoglobin\nResult: 13.8 g/dL\n"
    "Reference range: 12.0 - 15.5 g/dL\nVitamin D, 25-Hydroxy\nResult: 18 ng/mL\nReference range: 30 - 100 ng/mL\n"
    "Flag: LOW\nCholesterol, Total\nResult: 224 mg/dL\nReference range: < 200 mg/dL\nFlag: HIGH\n"
    "LDL Cholesterol\nResult: 148 mg/dL\nReference range: < 100 mg/dL\nFlag: HIGH\nHDL Cholesterol\n"
    "Result: 44 mg/dL\nReference range: > 40 mg/dL\nFasting Glucose\nResult: 96 mg/dL\n"
    "Reference range: 70 - 99 mg/dL\nThyroid Stimulating Hormone (TSH)\nResult: 2.4 uIU/mL\n"
    "Reference range: 0.4 - 4.0 uIU/mL\nGeneral Notes\nThe patient reported occasional fatigue during afternoon "
    "hours in the\ncovering note. No medication list was provided with this panel.\n"
)
JUN_HEAD = (
    "Riverdale Diagnostics - Synthetic Demo Laboratory\nPatient: Demo Persona A\nCollection Date: 20 June 2025\n"
    "Report ID: SYN-2025-0620-A\n"
)
SCAN = (
    "SYNTHETIC TEST DATA - FOR VITAGRAPH OCR TESTING - NOT REAL\nThis PDF contains only an image (no embedded text) "
    "to force OCR path. Report ID: VITATEST-2024-1201-SCAN-004 Page 1\n"
)


def mask(text: str, vault: Vault | None = None, custom=()):
    return redact_text(text, vault or Vault(), custom)


# ----------------------------------------------------------------- every type


@pytest.mark.parametrize(
    ("text", "original", "type_"),
    [
        ("Patient: Kiruthika R", "Kiruthika R", "PERSON"),
        ("Patient Name: Kiruthika R", "Kiruthika R", "PERSON"),
        ("Patient's Name: Kiruthika R", "Kiruthika R", "PERSON"),
        ("Name of the Patient: Kiruthika R", "Kiruthika R", "PERSON"),
        ("Pt. Name: Kiruthika R", "Kiruthika R", "PERSON"),
        ("Name: Kiruthika R", "Kiruthika R", "PERSON"),
        ("Guardian: Ravi Kumar", "Ravi Kumar", "PERSON"),
        ("Father's Name: Ravi Kumar", "Ravi Kumar", "PERSON"),
        ("Husband's Name: Ravi Kumar", "Ravi Kumar", "PERSON"),
        ("Spouse Name: Meena Kumar", "Meena Kumar", "PERSON"),
        ("my name is Kiruthika R", "Kiruthika R", "PERSON"),
        ("Ref. By: Dr. Anand Rao", "Dr. Anand Rao", "DOCTOR"),
        ("Referred By: Anand Rao", "Anand Rao", "DOCTOR"),
        ("Referring Doctor: Anand Rao", "Anand Rao", "DOCTOR"),
        ("Consultant: Anand Rao", "Anand Rao", "DOCTOR"),
        ("Physician: Anand Rao", "Anand Rao", "DOCTOR"),
        ("Please ask Dr. Anand Rao about it", "Anand Rao", "DOCTOR"),
        ("Patient ID: P-12345", "P-12345", "ID"),
        ("UHID: U998877", "U998877", "ID"),
        ("MRN: 55-77", "55-77", "ID"),
        ("Medical Record No.: MR-001", "MR-001", "ID"),
        ("Report ID: SYN-2025-0115-A", "SYN-2025-0115-A", "ID"),
        ("Sample ID: S-77", "S-77", "ID"),
        ("Specimen ID: SP-1", "SP-1", "ID"),
        ("Lab No: L-22", "L-22", "ID"),
        ("Accession Number: ACC-9", "ACC-9", "ID"),
        ("Registration No: R-1", "R-1", "ID"),
        ("Reg. No: R-2", "R-2", "ID"),
        ("Bill No: B-3", "B-3", "ID"),
        ("Barcode: 123456789", "123456789", "ID"),
        ("Insurance ID: INS-1", "INS-1", "ID"),
        ("Policy No: POL-2", "POL-2", "ID"),
        ("Date of Birth: 12/05/1990", "12/05/1990", "DOB"),
        ("DOB: 12 May 1990", "12 May 1990", "DOB"),
        ("D.O.B: 12-05-1990", "12-05-1990", "DOB"),
        ("Phone: 98765 43210", "98765 43210", "PHONE"),
        ("Mobile: 9876543210", "9876543210", "PHONE"),
        ("Mob.: +91 98765 43210", "+91 98765 43210", "PHONE"),
        ("Contact: 044-2345678", "044-2345678", "PHONE"),
        ("Tel: 044-2345678", "044-2345678", "PHONE"),
        ("Call me on 98765 43210 today", "98765 43210", "PHONE"),
        ("Call +44 20 7946 0958 today", "+44 20 7946 0958", "PHONE"),
        ("Email: kiruthika@example.com", "kiruthika@example.com", "EMAIL"),
        ("E-mail: kiruthika@example.com", "kiruthika@example.com", "EMAIL"),
        ("write to kiruthika@example.com now", "kiruthika@example.com", "EMAIL"),
        ("Address: 12 MG Road, Chennai", "12 MG Road, Chennai", "ADDRESS"),
        ("Addr.: 12 MG Road", "12 MG Road", "ADDRESS"),
        ("Aadhaar: 2345 6789 0123", "2345 6789 0123", "GOV_ID"),
        ("My number 2345-6789-0123 is private", "2345-6789-0123", "GOV_ID"),
        ("PAN: ABCDE1234F", "ABCDE1234F", "GOV_ID"),
        ("the card ABCDE1234F was used", "ABCDE1234F", "GOV_ID"),
        ("Passport: K1234567", "K1234567", "GOV_ID"),
        ("ABHA: 12-3456-7890-1234", "12-3456-7890-1234", "GOV_ID"),
    ],
)
def test_each_identifier_type_is_masked(text, original, type_):
    result = mask(text)
    assert original not in result.masked
    assert result.counts.get(type_, 0) >= 1
    assert any(s["type"] == type_ for s in result.spans)
    span = next(s for s in result.spans if s["type"] == type_)
    assert text[span["start"]:span["end"]] in original or original in text[span["start"]:span["end"]]
    assert PLACEHOLDER_RE.search(result.masked)


def test_spans_are_offsets_into_the_original_text():
    text = "Patient: Kiruthika R\nPhone: 98765 43210"
    result = mask(text)
    assert [text[s["start"]:s["end"]] for s in result.spans] == ["Kiruthika R", "98765 43210"]
    assert result.masked == "Patient: [PERSON_1]\nPhone: [PHONE_1]"
    assert result.counts == {"PERSON": 1, "PHONE": 1}


# ------------------------------------------------------------ must not mask


@pytest.mark.parametrize(
    "text",
    [
        "The patient reported fatigue",
        "Patient-reported outcome: improved",
        "Test Name: Hemoglobin",
        "Lab test name: Hemoglobin",
        "Hemoglobin 13.8 g/dL",
        "Reference range: 0.4 - 4.0 uIU/mL",
        "Platelets 250000 per microlitre",
        "Result: 410 pg/mL Flag: HIGH",
        "Collection Date: 15 January 2025",
        "Riverdale Diagnostics - Synthetic Demo Laboratory",
        "Age: 40 Sex: Female",
        "Note: This is a synthetic report generated for an academic project.",
        "Comprehensive Health Panel",
    ],
)
def test_ordinary_report_text_is_untouched(text):
    result = mask(text)
    assert result.masked == text
    assert result.spans == [] and result.counts == {}


def test_a_long_value_is_ignored():
    text = "Patient: " + "A" * 81
    assert mask(text).masked == text
    assert mask("Patient: " + "A" * 80).masked == "Patient: [PERSON_1]"


def test_empty_values_are_ignored():
    for text in ("Patient: N/A", "Phone: -", "Address:", "Report ID: none"):
        assert mask(text).masked == text


def test_patient_id_is_an_id_and_not_a_person():
    result = mask("Patient ID: X-42")
    assert result.masked == "Patient ID: [ID_1]"


def test_name_only_counts_at_the_start_of_a_line():
    assert mask("Test Name: Hemoglobin").masked == "Test Name: Hemoglobin"
    assert mask("  Name: Asha K").masked == "  Name: [PERSON_1]"
    assert mask("Header\nName: Asha K").masked == "Header\nName: [PERSON_1]"


def test_the_value_stops_at_the_next_field():
    assert mask("Patient: Asha K   Age: 40").masked == "Patient: [PERSON_1]   Age: 40"
    assert mask("Patient: Asha K Age: 40 Sex: F").masked == "Patient: [PERSON_1] Age: 40 Sex: F"
    assert mask("Patient: Asha K | Phone: 9876543210").masked == "Patient: [PERSON_1] | Phone: [PHONE_1]"
    assert mask("Patient: Asha K\tAge: 40").masked == "Patient: [PERSON_1]\tAge: 40"


def test_already_masked_text_is_not_masked_again():
    text = "Patient: [PERSON_1] Phone: [PHONE_1]"
    assert mask(text).masked == text


# --------------------------------------------------------- the sample reports


def test_january_report_hides_the_name_and_report_id_but_keeps_every_lab_fact():
    result = mask(JAN)
    assert "Demo Persona A" not in result.masked and "SYN-2025-0115-A" not in result.masked
    assert "Patient: [PERSON_1]" in result.masked and "Report ID: [ID_1]" in result.masked
    for fact in ("13.8 g/dL", "12.0 - 15.5 g/dL", "18 ng/mL", "Flag: LOW", "224 mg/dL", "Flag: HIGH", "148 mg/dL",
                 "44 mg/dL", "96 mg/dL", "2.4 uIU/mL", "0.4 - 4.0 uIU/mL", "15 January 2025",
                 "Riverdale Diagnostics", "fatigue"):
        assert fact in result.masked
    assert result.counts == {"PERSON": 1, "ID": 1}


def test_two_reports_of_one_person_share_one_placeholder():
    vault = Vault()
    first = mask(JAN, vault)
    second = mask(JUN_HEAD, vault)
    assert "Patient: [PERSON_1]" in second.masked
    assert "Report ID: [ID_2]" in second.masked
    assert "SYN-2025-0620-A" not in second.masked and first.masked != second.masked


def test_scanned_report_id_is_one_token():
    result = mask(SCAN)
    assert "VITATEST-2024-1201-SCAN-004" not in result.masked
    assert "[ID_1] Page 1" in result.masked


# ------------------------------------------------------------ learned terms


def test_a_learned_name_is_masked_in_a_file_name_and_in_plain_sentences():
    vault = Vault()
    mask("Patient: Demo Persona A", vault)
    result = mask("Uploaded demo persona a report.pdf and Demo Persona A asked a question", vault)
    assert "demo persona" not in result.masked.lower()
    assert result.masked.count("[PERSON_1]") == 2
    assert result.counts == {"PERSON": 2}


def test_learn_labelled_prepares_the_vault_for_later_text():
    vault = Vault()
    learn_labelled(JAN, vault)
    assert vault.original_of("[PERSON_1]") == "Demo Persona A"
    assert vault.original_of("[ID_1]") == "SYN-2025-0115-A"
    assert mask("Hello Demo Persona A, ref SYN-2025-0115-A", vault).masked == "Hello [PERSON_1], ref [ID_1]"


def test_two_pass_learning_masks_a_name_that_appears_before_its_label():
    vault = Vault()
    texts = ["Question about Asha K", "Patient: Asha K"]
    for t in texts:
        learn_labelled(t, vault)
    assert mask(texts[0], vault).masked == "Question about [PERSON_1]"


def test_short_values_are_not_turned_into_known_terms():
    vault = Vault()
    mask("Patient: Al", vault)
    assert mask("Alpha and Al and Hb", vault).masked == "Alpha and Al and Hb"


def test_custom_terms_are_masked_with_word_boundaries_and_any_case():
    result = mask("Apollo Hospital, apollo and Apollonia", custom=["Apollo"])
    assert result.masked == "[CUSTOM_1] Hospital, [CUSTOM_1] and Apollonia"
    assert result.counts == {"CUSTOM": 2}


def test_custom_term_with_spaces_matches_flexible_whitespace():
    result = mask("seen at Sri  Ram Clinic today", custom=["Sri Ram Clinic"])
    assert "[CUSTOM_1]" in result.masked and "Sri" not in result.masked


# ---------------------------------------------------------------- overlaps


def test_the_earliest_and_longest_span_wins():
    # The phone pattern would also match inside the labelled value; one span must come out.
    result = mask("Phone: +91 98765 43210")
    assert result.masked == "Phone: [PHONE_1]"
    assert len(result.spans) == 1


def test_spans_never_overlap():
    result = mask(JAN + JUN_HEAD + "Phone: 9876543210 Email: a@b.co", custom=["Riverdale"])
    last = 0
    for span in result.spans:
        assert span["start"] >= last
        last = span["end"]


def test_numbers_are_numbered_per_type_in_order_of_discovery():
    result = mask("Patient: Asha K\nRef. By: Dr. Rao\nPhone: 9876543210\nMobile: 9123456780")
    assert result.masked == "Patient: [PERSON_1]\nRef. By: [DOCTOR_1]\nPhone: [PHONE_1]\nMobile: [PHONE_2]"


# ------------------------------------------------------------------ vault


def test_vault_round_trips_and_copies():
    vault = Vault()
    placeholder = vault.placeholder_for("PERSON", "Asha K")
    assert placeholder == "[PERSON_1]"
    assert vault.placeholder_for("PERSON", "asha  k") == placeholder  # case and spacing do not matter
    assert vault.original_of(placeholder) == "Asha K"
    assert vault.original_of("[PERSON_9]") is None
    clone = vault.copy()
    clone.placeholder_for("PERSON", "Someone Else")
    assert len(vault) == 1 and len(clone) == 2


def test_vault_keeps_at_most_500_entries():
    vault = Vault()
    for i in range(520):
        vault.placeholder_for("ID", f"ID-{i:04d}")
    assert len(vault) == 500


def test_values_inside_json_end_at_the_quote_or_the_escaped_newline():
    result = mask('{"snippet": "Patient: Demo Persona A\nReport ID: SYN-1\nHb 13.8"}')
    assert result.masked == '{"snippet": "Patient: [PERSON_1]\nReport ID: [ID_1]\nHb 13.8"}'
    assert mask('{"s": "Patient: Asha K"}').masked == '{"s": "Patient: [PERSON_1]"}'
