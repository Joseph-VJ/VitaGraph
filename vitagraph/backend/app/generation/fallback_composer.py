"""Offline fallback answer composer (plan Sections 2.3 and 10).

When the neutral AI generation service is disabled or unavailable, answers
are composed locally by structuring the retrieved evidence itself into the
mandatory four-part structure. This composer can only restate what the
reports literally contain — values, units, reference ranges, lab flags,
dates — so the offline mode stays grounded by construction: nothing is
interpreted, merged, or invented.
"""

from __future__ import annotations

import re

_RESULT_LINE = re.compile(r"^Result:\s*(.+?)\s*$", re.IGNORECASE)
_RANGE_LINE = re.compile(r"^Reference range:\s*(.+?)\s*$", re.IGNORECASE)
_FLAG_LINE = re.compile(r"^Flag:\s*(.+?)\s*$", re.IGNORECASE)
_META_LINES = (_RESULT_LINE, _RANGE_LINE, _FLAG_LINE)


def _parse_entries(snippet: str) -> list[dict]:
    """Extract lab entries (name, result, range, flag) from a chunk's lines."""
    lines = [line.strip() for line in snippet.split("\n") if line.strip()]
    entries: list[dict] = []
    for index, line in enumerate(lines):
        result_match = _RESULT_LINE.match(line)
        if not result_match:
            continue
        # The test name is the nearest preceding non-meta line.
        name = ""
        for previous in reversed(lines[:index]):
            if not any(pattern.match(previous) for pattern in _META_LINES):
                name = previous
                break
        range_value, flag = "", ""
        for following in lines[index + 1: index + 4]:
            range_match = _RANGE_LINE.match(following)
            flag_match = _FLAG_LINE.match(following)
            if range_match and not range_value:
                range_value = range_match.group(1)
            if flag_match and not flag:
                flag = flag_match.group(1)
        entries.append({
            "name": name,
            "result": result_match.group(1),
            "range": range_value,
            "flag": flag,
        })
    return entries


def _entry_line(entry: dict, report_label: str) -> str:
    parts = [f"{entry['result']}"]
    if entry["range"]:
        parts.append(f"report range {entry['range']}")
    if entry["flag"]:
        parts.append(f"flagged {entry['flag']} by the lab")
    detail = ", ".join(parts[1:])
    return f"- {entry['name'] or 'Test'}: {parts[0]}" + (f" ({detail})" if detail else "") + \
        f" — {report_label}"


def _report_label(hit: dict) -> str:
    date = hit.get("report_date") or "date unknown"
    page = hit["metadata"].get("page_number", "?")
    return f"{date}, p. {page}"


def compose_answer(question: str, evidence: list[dict]) -> dict:
    """Build the four-part answer from retrieved evidence only."""
    if not evidence:
        return {
            "summary_text": (
                "The uploaded reports do not contain enough information to "
                "address this question. No matching evidence was retrieved, "
                "and VitaGraph does not fill gaps with general medical "
                "knowledge."
            ),
            "limitations_text": (
                "No evidence was found for this question. Consider uploading "
                "the report that covers this topic, or rephrasing the question "
                "using the terms used in the reports."
            ),
            "safety_status": "insufficient_evidence",
        }

    # Collect structured lab entries from every retrieved chunk.
    structured: list[tuple[dict, dict]] = []   # (entry, hit)
    plain_hits: list[dict] = []
    for hit in evidence:
        entries = _parse_entries(hit["document"])
        if entries:
            for entry in entries:
                structured.append((entry, hit))
        else:
            plain_hits.append(hit)

    summary_sections: list[str] = []

    if structured:
        # Group by test name so the same test across reports reads as a
        # factual before/after listing (RAG over ALL previous uploads).
        by_test: dict[str, list[tuple[dict, dict]]] = {}
        for entry, hit in structured:
            by_test.setdefault(entry["name"] or "Test", []).append((entry, hit))

        lines = []
        for name, pairs in by_test.items():
            if len(pairs) > 1:
                changes = "; ".join(
                    f"{entry['result']} ({_report_label(hit)})" for entry, hit in pairs
                )
                first_range = next((e["range"] for e, _ in pairs if e["range"]), "")
                flags = sorted({e["flag"] for e, _ in pairs if e["flag"]})
                note = f", report range {first_range}" if first_range else ""
                if flags:
                    note += f", flagged {'/'.join(flags)} by the lab"
                lines.append(f"- {name}: {changes}{note}")
            else:
                entry, hit = pairs[0]
                lines.append(_entry_line(entry, _report_label(hit)))
        summary_sections.append(
            "The following values were found in your uploaded reports:\n" + "\n".join(lines)
        )

    for hit in plain_hits:
        summary_sections.append(
            f"From {hit.get('report_date') or 'an undated report'}, "
            f"p. {hit['metadata'].get('page_number', '?')}:\n"
            f"\"{hit['document'].strip()}\""
        )

    summary = "\n\n".join(summary_sections)
    summary += (
        "\n\nThis is an offline, evidence-only summary: every value above is "
        "quoted from your reports. Connect a working AI generation service "
        "for a full plain-language explanation of what these tests measure."
    )

    dates = sorted({str(hit.get("report_date")) for hit in evidence if hit.get("report_date")})
    if len(dates) > 1:
        limitation_note = (
            f"Evidence spans multiple report dates ({', '.join(dates)}). "
            "Values from different reports are listed side by side as facts; "
            "VitaGraph does not interpret or judge the changes."
        )
    else:
        limitation_note = (
            "Only direct quotations from your reports are shown. VitaGraph "
            "does not interpret values, compare against clinical thresholds, "
            "or draw medical conclusions."
        )

    return {
        "summary_text": summary,
        "limitations_text": (
            f"{limitation_note} Statements about causes, diagnosis, or "
            "treatment cannot be concluded from this evidence."
        ),
        "safety_status": "passed",
    }
