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
        "aliases": [
            "vitamin d, 25-hydroxy",
            "vitamin d",
            r"\bvit d\b",
            "25-hydroxy",
            "25-oh vitamin d",
            "vitamind",
            r"vitamin\s*[-–—]?\s*d",
        ],
        "default_unit": "ng/mL",
    },
    {
        "name": "Total Cholesterol",
        "category": "Lipid Profile",
        "aliases": [
            "cholesterol, total",
            "total cholesterol",
            "serum cholesterol",
            r"total\s*[-–—]?\s*cholesterol",
            "total -cholesterol",
        ],
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
        "aliases": ["hba1c", "glycated hemoglobin", r"\ba1c\b", r"\bhba1c\b", "-hba1c"],
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
    r"(?:Flag|Status|Interpretation|[-–—])[ \t]*(LOW|HIGH|NORMAL|ABNORMAL|CRITICAL)",
    re.IGNORECASE,
)

# Inline pattern: e.g. ": 14.0 g/dL" or " 94 mg/dL"
_INLINE_MEASUREMENT_PATTERN = re.compile(
    r"([0-9]+(?:\.[0-9]+)?)[ \t]*([a-zA-Z/%μuIU]+(?:/[a-zA-Z]+)?)",
    re.IGNORECASE,
)

# Generic measurement pattern for table rows and structured lines (US-16)
_GENERIC_ROW_PATTERN = re.compile(
    r"^\s*[-*•]?\s*([A-Za-z][A-Za-z0-9\s,\-_()]{2,32}?)\s*[:=\t\s]\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%μuIU]+(?:/[a-zA-Z]+)?)\b(?:\s*([0-9.<>\s\-–—]+(?:\s*[a-zA-Z/%μuIU]+)?))?(?:\s*[-–—]?\s*(LOW|HIGH|NORMAL|ABNORMAL|CRITICAL|low|high|normal))?",
    re.MULTILINE | re.IGNORECASE,
)


def extract_entities_from_chunk(
    chunk_text: str,
    chunk_id: str = "",
    report_id: str = "",
    page_number: int = 1,
    date: str | None = None,
) -> list[dict[str, Any]]:
    """Extract medical observation entities from a single text chunk with table-aware robustness (US-16)."""
    entities: list[dict[str, Any]] = []
    text_lower = chunk_text.lower()
    extracted_test_names: set[str] = set()

    # 1. Search for canonical tests
    for test_def in CANONICAL_TESTS:
        matched_alias = False
        matched_start = -1
        matched_len = 0

        for alias in test_def["aliases"]:
            if alias.startswith(r"\b") or r"\s*" in alias:
                m = re.search(alias, text_lower)
                if m:
                    matched_alias = True
                    matched_start = m.start()
                    matched_len = m.end() - m.start()
                    break
            else:
                pos = text_lower.find(alias)
                if pos != -1:
                    matched_alias = True
                    matched_start = pos
                    matched_len = len(alias)
                    break

        if not matched_alias:
            continue

        # Found test mention. Scope search to content AFTER the test name
        # to prevent digits in test names (e.g. '1' in 'HbA1c', '12' in 'B12')
        # from being erroneously parsed as the measurement value!
        content_after = chunk_text[matched_start + matched_len :]
        next_boundary = re.search(r"\n\s*\n", content_after)
        if next_boundary and next_boundary.start() > 10:
            sub = content_after[: next_boundary.start()]
        else:
            # Limit scope to current line or immediate block
            sub = content_after[:150]

        result_match = _RESULT_PATTERN.search(sub)
        range_match = _RANGE_PATTERN.search(sub)
        first_line = sub.split("\n")[0]
        flag_match = _FLAG_PATTERN.search(first_line) or _FLAG_PATTERN.search(sub)

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
        if value is None:
            inline_match = _INLINE_MEASUREMENT_PATTERN.search(first_line) or _INLINE_MEASUREMENT_PATTERN.search(sub)
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
        elif re.search(r"\b(low|high|abnormal|critical)\b", first_line, re.IGNORECASE):
            fm = re.search(r"\b(low|high|abnormal|critical)\b", first_line, re.IGNORECASE)
            if fm:
                flag = fm.group(1).upper()

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
            extracted_test_names.add(test_def["name"].lower())

    # 2. Generic measurement fallback for table rows and structured observation lines (US-16)
    for match in _GENERIC_ROW_PATTERN.finditer(chunk_text):
        raw_name = match.group(1).strip().strip("-: ")
        low_name = raw_name.lower()

        # Filter out common non-test header words
        clean_key = re.sub(r"[^a-z0-9]", "", low_name)
        if any(bad in low_name for bad in ("page", "date", "report", "patient", "history", "doctor", "evidence", "provenance", "complaint", "note", "id", "scan", "test data", "after", "repeat")):
            continue
        if any(re.sub(r"[^a-z0-9]", "", canon) == clean_key or re.sub(r"[^a-z0-9]", "", canon) in clean_key for canon in extracted_test_names):
            continue

        try:
            val = float(match.group(2))
        except (ValueError, TypeError):
            continue

        unit = match.group(3).strip()
        ref_r = match.group(4).strip() if match.group(4) else None
        flag_str = match.group(5).upper() if match.group(5) else "NORMAL"
        if ref_r and not match.group(5):
            flag_str = _infer_flag(val, ref_r)

        entities.append({
            "test_name": raw_name.title(),
            "category": "Diagnostic Measurement",
            "value": val,
            "unit": unit,
            "reference_range": ref_r,
            "flag": flag_str,
            "chunk_id": chunk_id,
            "report_id": report_id,
            "page_number": page_number,
            "date": date or "Unknown",
            "evidence_snippet": match.group(0).strip(),
        })
        extracted_test_names.add(low_name)

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
