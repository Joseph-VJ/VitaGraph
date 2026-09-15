"""Medical observation entity extractor for health report chunks.

Parses unstructured and semi-structured laboratory report chunks to extract
canonical test names, quantitative values, measurement units, reference ranges,
diagnostic flags (NORMAL, LOW, HIGH), dates, and medical panel categories.
"""

from __future__ import annotations

import re
from typing import Any

# Canonical medical tests dictionary with aliases, standard categories, and default units
CANONICAL_TESTS = [
    {
        "name": "Hemoglobin",
        "category": "Complete Blood Count",
        "aliases": ["hemoglobin", r"\bhb\b", r"\bhgb\b"],
        "default_unit": "g/dL",
    },
    {
        "name": "Vitamin D",
        "category": "Vitamins",
        "aliases": ["vitamin d, 25-hydroxy", "vitamin d", r"\bvit d\b", "25-hydroxy", "25-oh vitamin d"],
        "default_unit": "ng/mL",
    },
    {
        "name": "Total Cholesterol",
        "category": "Lipid Profile",
        "aliases": ["cholesterol, total", "total cholesterol", "serum cholesterol"],
        "default_unit": "mg/dL",
    },
    {
        "name": "LDL Cholesterol",
        "category": "Lipid Profile",
        "aliases": ["ldl cholesterol", r"\bldl\b", "ldl-c"],
        "default_unit": "mg/dL",
    },
    {
        "name": "HDL Cholesterol",
        "category": "Lipid Profile",
        "aliases": ["hdl cholesterol", r"\bhdl\b", "hdl-c"],
        "default_unit": "mg/dL",
    },
    {
        "name": "Triglycerides",
        "category": "Lipid Profile",
        "aliases": ["triglycerides", "serum triglycerides"],
        "default_unit": "mg/dL",
    },
    {
        "name": "Fasting Glucose",
        "category": "Metabolic Panel",
        "aliases": ["fasting glucose", "fasting blood sugar", "glucose, fasting", r"\bfbs\b", "blood glucose"],
        "default_unit": "mg/dL",
    },
    {
        "name": "TSH",
        "category": "Thyroid Panel",
        "aliases": ["thyroid stimulating hormone (tsh)", "thyroid stimulating hormone", r"\btsh\b"],
        "default_unit": "uIU/mL",
    },
    {
        "name": "WBC",
        "category": "Complete Blood Count",
        "aliases": ["white blood cell", r"\bwbc\b", "total leucocyte count", r"\btlc\b"],
        "default_unit": "k/uL",
    },
    {
        "name": "Platelets",
        "category": "Complete Blood Count",
        "aliases": ["platelet count", "platelets"],
        "default_unit": "k/uL",
    },
    {
        "name": "HbA1c",
        "category": "Metabolic Panel",
        "aliases": ["hba1c", "glycated hemoglobin", r"\ba1c\b"],
        "default_unit": "%",
    },
    {
        "name": "Creatinine",
        "category": "Metabolic Panel",
        "aliases": ["serum creatinine", "creatinine"],
        "default_unit": "mg/dL",
    },
    {
        "name": "Vitamin B12",
        "category": "Vitamins",
        "aliases": ["vitamin b12", r"\bb12\b", "cyanocobalamin"],
        "default_unit": "pg/mL",
    },
]

# Regex patterns for parsing laboratory report formats
_RESULT_PATTERN = re.compile(
    r"(?:Result|Value|Observed|Finding)[ \t]*:[ \t]*([0-9]+(?:\.[0-9]+)?)(?:[ \t]+([a-zA-Z/%μuIU]+(?:[ \t]+[a-zA-Z/%]+)?))?",
    re.IGNORECASE,
)
_RANGE_PATTERN = re.compile(
    r"(?:Reference\s*range|Normal\s*range|Reference|Biological\s*Ref\s*Interval)[ \t]*:[ \t]*([^\n\r]+)",
    re.IGNORECASE,
)
_FLAG_PATTERN = re.compile(
    r"(?:Flag|Status|Interpretation)[ \t]*:[ \t]*(LOW|HIGH|NORMAL|ABNORMAL|CRITICAL)",
    re.IGNORECASE,
)

# Inline pattern: e.g. "Hemoglobin: 14.0 g/dL" or "Fasting Glucose 94 mg/dL"
_INLINE_MEASUREMENT_PATTERN = re.compile(
    r"([0-9]+(?:\.[0-9]+)?)[ \t]*([a-zA-Z/%μuIU]+(?:/[a-zA-Z]+)?)",
    re.IGNORECASE,
)


def extract_entities_from_chunk(
    chunk_text: str,
    chunk_id: str = "",
    report_id: str = "",
    page_number: int = 1,
    date: str | None = None,
) -> list[dict[str, Any]]:
    """Extract medical observation entities from a single text chunk."""
    entities: list[dict[str, Any]] = []
    text_lower = chunk_text.lower()

    # Search for canonical tests
    for test_def in CANONICAL_TESTS:
        matched_alias = False
        matched_start = -1

        for alias in test_def["aliases"]:
            if alias.startswith(r"\b"):
                m = re.search(alias, text_lower)
                if m:
                    matched_alias = True
                    matched_start = m.start()
                    break
            else:
                pos = text_lower.find(alias)
                if pos != -1:
                    matched_alias = True
                    matched_start = pos
                    break

        if not matched_alias:
            continue

        # Found a test mention! Scope the search to this test's block (up to next double newline)
        next_boundary = re.search(r"\n\s*\n", chunk_text[matched_start:])
        if next_boundary and next_boundary.start() > 10:
            sub = chunk_text[matched_start : matched_start + next_boundary.start()]
        else:
            sub = chunk_text[matched_start : matched_start + 250]

        result_match = _RESULT_PATTERN.search(sub)
        range_match = _RANGE_PATTERN.search(sub)
        flag_match = _FLAG_PATTERN.search(sub)

        value: float | None = None
        unit: str = test_def["default_unit"]
        ref_range: str | None = None
        flag: str = "NORMAL"

        if result_match:
            try:
                value = float(result_match.group(1))
            except (ValueError, TypeError):
                value = None
            if result_match.group(2):
                unit = result_match.group(2).strip()

        # If no "Result:" keyword, inspect inline numbers following the test name
        if value is None and matched_start != -1:
            sub = chunk_text[matched_start : matched_start + 120]
            inline_match = _INLINE_MEASUREMENT_PATTERN.search(sub)
            if inline_match:
                try:
                    value = float(inline_match.group(1))
                    if inline_match.group(2):
                        u_str = inline_match.group(2).strip()
                        if any(c in u_str.lower() for c in ["g", "l", "m", "u", "%", "k"]):
                            unit = u_str
                except (ValueError, TypeError):
                    value = None

        if range_match:
            ref_range = range_match.group(1).strip()

        if flag_match:
            flag = flag_match.group(1).upper()
        elif ref_range and value is not None:
            flag = _infer_flag(value, ref_range)

        if value is not None:
            snippet = chunk_text.strip()
            if len(snippet) > 160:
                snippet = snippet[:157] + "..."

            entities.append({
                "test_name": test_def["name"],
                "category": test_def["category"],
                "value": value,
                "unit": unit,
                "reference_range": ref_range,
                "flag": flag,
                "chunk_id": chunk_id,
                "report_id": report_id,
                "page_number": page_number,
                "date": date or "Unknown",
                "evidence_snippet": snippet,
            })

    return entities


def _infer_flag(value: float, ref_range: str) -> str:
    """Infer NORMAL, LOW, or HIGH based on numeric bounds in reference range."""
    # Pattern: "12.0 - 15.5 g/dL" or "< 200 mg/dL" or "> 40 mg/dL"
    bound_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*-\s*([0-9]+(?:\.[0-9]+)?)", ref_range)
    if bound_match:
        try:
            low = float(bound_match.group(1))
            high = float(bound_match.group(2))
            if value < low:
                return "LOW"
            if value > high:
                return "HIGH"
            return "NORMAL"
        except ValueError:
            pass

    lt_match = re.search(r"<\s*([0-9]+(?:\.[0-9]+)?)", ref_range)
    if lt_match:
        try:
            limit = float(lt_match.group(1))
            return "HIGH" if value >= limit else "NORMAL"
        except ValueError:
            pass

    gt_match = re.search(r">\s*([0-9]+(?:\.[0-9]+)?)", ref_range)
    if gt_match:
        try:
            limit = float(gt_match.group(1))
            return "LOW" if value < limit else "NORMAL"
        except ValueError:
            pass

    return "NORMAL"
