"""Charts drawn from the person's own stored values.

The agent (or a saved report) only names WHAT to draw: a small JSON spec such as
`{"kind": "trend", "tests": ["Hemoglobin"]}`. It never contains numbers. This module checks the spec, finds the
values in the person's own series (`series_service`), and draws a clean, inert SVG:

- no script, no event attributes, no links, no external references, no embedded fonts or images;
- text is escaped, numbers come only from the database, nothing from the model is copied into the markup
  except a trimmed, escaped title and the test names as they are stored.

Plain-sentence `ChartError`s are raised for anything that cannot be drawn; the route turns them into 422.
"""

from __future__ import annotations

import html as html_lib
import math
import re
from typing import Any

from app.services import series_service

WIDTH = 720
MAX_TESTS = 4
MIN_COMPARE_REPORTS = 2
MAX_COMPARE_REPORTS = 6
MAX_TITLE_CHARS = 120
MAX_TREND_POINTS = 10
MAX_VALUE_ROWS = 30
KINDS = ("trend", "compare", "values")

INK = "#201e1d"
GRID = "#cfcdcd"
BAND = "#eae9e9"
MUTED = "#605d5d"
RED = "#ec3013"
PAPER = "#f3f2f2"
FONT = "Archivo, Arial, sans-serif"

_ALLOWED_KEYS = {"kind", "tests", "reports", "report_id", "title"}
_NUMBER_KEYS = {"value", "values", "data", "points", "series", "numbers", "ys", "xs", "x", "y", "range", "ranges"}
_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


class ChartError(ValueError):
    """A chart that cannot be drawn. The message is a plain sentence meant for the person."""


# --------------------------------------------------------------------------- spec


def _contains_number(node: Any) -> bool:
    if isinstance(node, bool):
        return False
    if isinstance(node, (int, float)):
        return True
    if isinstance(node, dict):
        return any(_contains_number(v) for v in node.values())
    if isinstance(node, (list, tuple)):
        return any(_contains_number(v) for v in node)
    return False


def _clean_names(raw: Any, field: str, *, minimum: int, maximum: int, max_len: int) -> list[str]:
    if not isinstance(raw, list) or not all(isinstance(item, str) for item in raw):
        raise ChartError(f"The chart needs a list of names in '{field}'.")
    names: list[str] = []
    seen: set[str] = set()
    for item in raw:
        text = " ".join(item.split())
        if not text:
            continue
        if len(text) > max_len:
            raise ChartError(f"A name in '{field}' is too long.")
        key = _norm(text)
        if key and key not in seen:
            seen.add(key)
            names.append(text)
    if len(names) < minimum:
        noun = "test" if field == "tests" else "report"
        raise ChartError(f"The chart needs at least {minimum} {noun}{'s' if minimum > 1 else ''}.")
    if len(names) > maximum:
        noun = "tests" if field == "tests" else "reports"
        raise ChartError(f"A chart can show at most {maximum} {noun}.")
    return names


def validate_spec(spec: Any) -> dict[str, Any]:
    """Return a clean copy of the spec or raise ChartError. Numbers and unknown fields are refused."""
    if not isinstance(spec, dict):
        raise ChartError("The chart description must be a JSON object.")
    for key in spec:
        if not isinstance(key, str):
            raise ChartError("The chart description has an unreadable field.")
        if key.lower() in _NUMBER_KEYS:
            raise ChartError("A chart description must not contain values. The numbers are looked up from your reports.")
    if _contains_number(spec):
        raise ChartError("A chart description must not contain numbers. The numbers are looked up from your reports.")
    for key in spec:
        if key not in _ALLOWED_KEYS:
            shown = key if len(key) <= 30 else key[:30] + "..."
            raise ChartError(f"The chart description has a field I do not know: '{shown}'.")

    kind = spec.get("kind")
    if kind not in KINDS:
        raise ChartError("The chart kind must be trend, compare or values.")

    title = spec.get("title")
    if title is not None:
        if not isinstance(title, str):
            raise ChartError("The chart title must be text.")
        title = " ".join(title.split())
        if len(title) > MAX_TITLE_CHARS:
            raise ChartError(f"The chart title is longer than {MAX_TITLE_CHARS} characters.")

    clean: dict[str, Any] = {"kind": kind, "title": title or None}
    if kind == "values":
        for key in ("tests", "reports"):
            if key in spec:
                raise ChartError("A chart of one report's values takes only a report_id.")
        report_id = spec.get("report_id")
        if not isinstance(report_id, str) or not report_id.strip() or len(report_id) > 64:
            raise ChartError("A chart of one report's values needs the report_id.")
        clean["report_id"] = report_id.strip()
        return clean

    if "report_id" in spec:
        raise ChartError(f"A {kind} chart does not take a report_id.")
    if "tests" not in spec:
        raise ChartError("The chart needs at least 1 test.")
    clean["tests"] = _clean_names(spec["tests"], "tests", minimum=1, maximum=MAX_TESTS, max_len=80)
    if kind == "trend":
        if "reports" in spec:
            raise ChartError("A trend chart always uses all your reports, so it takes no report list.")
        return clean
    if "reports" in spec and spec["reports"] is not None:
        clean["reports"] = _clean_names(
            spec["reports"], "reports", minimum=MIN_COMPARE_REPORTS, maximum=MAX_COMPARE_REPORTS, max_len=64
        )
    return clean


# ------------------------------------------------------------------------ lookup


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(text).lower())


def _find_test(tests: list[dict[str, Any]], wanted: str) -> dict[str, Any]:
    key = _norm(wanted)
    exact = [t for t in tests if _norm(t["name"]) == key]
    if exact:
        return exact[0]
    if key:
        prefix = [t for t in tests if _norm(t["name"]).startswith(key)]
        if len(prefix) == 1:
            return prefix[0]
    raise ChartError(f"There are no {wanted} values in your reports.")


def _month_label(date_iso: str | None, with_day: bool = False) -> str:
    if not date_iso:
        return "Undated"
    try:
        year, month, day = (int(part) for part in date_iso.split("-"))
        text = f"{_MONTHS[month - 1]} {year}"
        return f"{day} {text}" if with_day else text
    except (ValueError, IndexError):
        return "Undated"


def _labels_for(reports: list[dict[str, Any]]) -> dict[str, str]:
    """Month labels for the reports in play. Two reports in one month get the day too; undated ones are numbered."""
    labels = {r["report_id"]: _month_label(r.get("date_iso")) for r in reports}
    counts: dict[str, int] = {}
    for label in labels.values():
        counts[label] = counts.get(label, 0) + 1
    for r in reports:
        label = labels[r["report_id"]]
        if counts[label] > 1 and r.get("date_iso"):
            labels[r["report_id"]] = _month_label(r["date_iso"], with_day=True)
    seen: dict[str, int] = {}
    for r in reports:
        label = labels[r["report_id"]]
        seen[label] = seen.get(label, 0) + 1
        if seen[label] > 1:
            labels[r["report_id"]] = f"{label} ({seen[label]})"
    return labels


def _status(point: dict[str, Any]) -> str | None:
    """'high', 'low', 'out' (outside the range, direction unknown) or None when the value is inside."""
    value, low, high = point["value"], point.get("range_low"), point.get("range_high")
    if low is not None and value < low:
        return "low"
    if high is not None and value > high:
        return "high"
    flag = str(point.get("flag") or "").upper()
    if flag == "HIGH":
        return "high"
    if flag == "LOW":
        return "low"
    if flag in ("ABNORMAL", "CRITICAL"):
        return "out"
    return None


def _flag_word(status: str | None) -> str:
    return {"high": "HIGH", "low": "LOW", "out": "ABNORMAL"}.get(status or "", "NORMAL")


def _payload_point(point: dict[str, Any], labels: dict[str, str], dates: dict[str, str | None]) -> dict[str, Any]:
    return {
        "report_id": point["report_id"],
        "label": labels.get(point["report_id"], "Undated"),
        "date_iso": dates.get(point["report_id"]),
        "value": point["value"],
        "flag": _flag_word(_status(point)),
        "range_low": point.get("range_low"),
        "range_high": point.get("range_high"),
        "page_number": point.get("page_number"),
        "chunk_id": point.get("chunk_id"),
        "char_start": point.get("char_start"),
        "char_end": point.get("char_end"),
    }


# --------------------------------------------------------------------- svg pieces


def _esc(text: Any) -> str:
    return html_lib.escape(str(text), quote=True)


def _n(value: float) -> str:
    return f"{value:.1f}".rstrip("0").rstrip(".") if abs(value) < 1e6 else f"{value:.0f}"


def _fmt(value: float) -> str:
    """A value as printed in the report: no exponent, no trailing zeros."""
    text = f"{value:.4f}".rstrip("0").rstrip(".")
    return text or "0"


def _clip(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: max(1, limit - 1)].rstrip() + "..."


def _text(x: float, y: float, text: str, *, size: float = 11, weight: int = 400, fill: str = INK, anchor: str = "start") -> str:
    return (
        f'<text x="{_n(x)}" y="{_n(y)}" font-size="{_n(size)}" font-weight="{weight}" fill="{fill}"'
        f'{"" if anchor == "start" else f" text-anchor=\"{anchor}\""}>{_esc(text)}</text>'
    )


def _rect(x: float, y: float, w: float, h: float, fill: str, extra: str = "") -> str:
    return f'<rect x="{_n(x)}" y="{_n(y)}" width="{_n(max(w, 0))}" height="{_n(max(h, 0))}" fill="{fill}"{extra}/>'


def _line(x0: float, y0: float, x1: float, y1: float, stroke: str = GRID, width: float = 1) -> str:
    return (
        f'<line x1="{_n(x0)}" y1="{_n(y0)}" x2="{_n(x1)}" y2="{_n(y1)}" stroke="{stroke}" '
        f'stroke-width="{_n(width)}" shape-rendering="crispEdges"/>'
    )


def _marker(cx: float, cy: float, status: str | None, size: float = 9) -> str:
    """Flat square for a value; red with a direction triangle (up = high, down = low) or a ring when outside the range."""
    half = size / 2
    if status is None:
        return _rect(cx - half, cy - half, size, size, INK)
    parts = [_rect(cx - half, cy - half, size, size, RED)]
    if status == "high":
        parts.append(f'<polygon points="{_n(cx - 5)},{_n(cy - half - 3)} {_n(cx + 5)},{_n(cy - half - 3)} {_n(cx)},{_n(cy - half - 11)}" fill="{RED}"/>')
    elif status == "low":
        parts.append(f'<polygon points="{_n(cx - 5)},{_n(cy + half + 3)} {_n(cx + 5)},{_n(cy + half + 3)} {_n(cx)},{_n(cy + half + 11)}" fill="{RED}"/>')
    else:
        parts.append(_rect(cx - half - 3, cy - half - 3, size + 6, size + 6, "none", f' stroke="{RED}" stroke-width="1.5"'))
    return "".join(parts)


def _nice_step(span: float, target: int = 4) -> float:
    if span <= 0:
        return 1.0
    raw = span / target
    magnitude = 10 ** math.floor(math.log10(raw))
    for factor in (1, 2, 2.5, 5, 10):
        if raw <= factor * magnitude:
            return factor * magnitude
    return 10 * magnitude


def _tick_text(value: float, step: float) -> str:
    decimals = 0 if step >= 1 else min(4, max(0, -int(math.floor(math.log10(step)))) + (1 if step * 10 % 1 else 0))
    return f"{value:.{decimals}f}"


def _axis(lo: float, hi: float, *, from_zero: bool) -> tuple[float, float, float]:
    """A tidy axis (min, max, step) that holds lo..hi."""
    if from_zero:
        lo = min(lo, 0.0)
    if hi <= lo:
        hi = lo + max(abs(lo) * 0.2, 1.0)
    step = _nice_step(hi - lo)
    return math.floor(lo / step + 1e-9) * step, math.ceil(hi / step - 1e-9) * step, step


def _range_label(points: list[dict[str, Any] | None], unit: str) -> str:
    for p in reversed([p for p in points if p]):
        text = (p.get("range_text") or "").strip()
        if text:
            return "Printed range: " + _clip(text, 40)
        low, high = p.get("range_low"), p.get("range_high")
        if low is not None and high is not None:
            return f"Printed range: {_fmt(low)} - {_fmt(high)} {unit}".strip()
        if high is not None:
            return f"Printed range: up to {_fmt(high)} {unit}".strip()
        if low is not None:
            return f"Printed range: from {_fmt(low)} {unit}".strip()
    return "No printed range in these reports"


def _panel(top: float, name: str, unit: str, slots: list[tuple[str, dict[str, Any] | None]], mode: str) -> tuple[str, float]:
    """One small chart for one test. `slots` are (axis label, point or None); mode is 'line' or 'bars'."""
    px0, px1 = 64.0, WIDTH - 28.0
    py0, py1 = top + 38.0, top + 176.0
    parts: list[str] = []
    title = name + (f" ({unit})" if unit else "")
    parts.append(_text(24, top + 16, _clip(title, 48), size=13, weight=600))
    points = [p for _, p in slots if p]
    parts.append(_text(WIDTH - 24, top + 16, _range_label(points, unit), size=10.5, fill=MUTED, anchor="end"))

    values = [p["value"] for p in points]
    vmin, vmax = min(values), max(values)
    span = max(vmax - vmin, abs(vmax) * 0.1, 1e-9)
    lo_axis, hi_axis = vmin, vmax
    for p in points:
        low, high = p.get("range_low"), p.get("range_high")
        if mode == "bars":
            if high is not None and high <= vmax * 1.6:
                hi_axis = max(hi_axis, high)
            if low is not None and low <= vmax * 1.6:
                lo_axis = min(lo_axis, low)
        else:
            if low is not None and vmin - 1.5 * span <= low <= vmax + 1.5 * span:
                lo_axis = min(lo_axis, low)
                hi_axis = max(hi_axis, low)
            if high is not None and vmin - 1.5 * span <= high <= vmax + 1.5 * span:
                hi_axis = max(hi_axis, high)
                lo_axis = min(lo_axis, high)
    pad = (hi_axis - lo_axis) * (0.3 if mode == "line" else 0.28) or max(abs(hi_axis) * 0.2, 1.0)
    if mode == "bars":
        amin, amax, step = _axis(0.0, hi_axis + pad, from_zero=True)
    else:
        amin, amax, step = _axis(lo_axis - pad * 0.6, hi_axis + pad, from_zero=False)
    if mode == "line" and amin < 0 <= vmin:
        amin = 0.0

    def y_of(value: float) -> float:
        return py1 - (min(max(value, amin), amax) - amin) / (amax - amin) * (py1 - py0)

    # grid and y-axis labels
    tick = amin
    guard = 0
    while tick <= amax + step * 1e-6 and guard < 12:
        gy = y_of(tick)
        parts.append(_line(px0, gy, px1, gy))
        parts.append(_text(px0 - 8, gy + 3.5, _tick_text(tick, step), size=10, fill=MUTED, anchor="end"))
        tick += step
        guard += 1

    n = len(slots)
    slot = (px1 - px0) / n
    centers = [px0 + (i + 0.5) * slot for i in range(n)]

    # range bands, one rectangle per run of slots that share the same printed range
    run_start = 0
    while run_start < n:
        point = slots[run_start][1]
        key = (point.get("range_low"), point.get("range_high")) if point else None
        run_end = run_start
        while run_end + 1 < n and (
            (slots[run_end + 1][1].get("range_low"), slots[run_end + 1][1].get("range_high")) if slots[run_end + 1][1] else None
        ) == key:
            run_end += 1
        if key and (key[0] is not None or key[1] is not None):
            band_low = key[0] if key[0] is not None else amin
            band_high = key[1] if key[1] is not None else amax
            y_top, y_bottom = y_of(band_high), y_of(band_low)
            if y_bottom - y_top > 0.5:
                parts.append(_rect(px0 + run_start * slot, y_top, (run_end - run_start + 1) * slot, y_bottom - y_top, BAND, ' shape-rendering="crispEdges"'))
        run_start = run_end + 1
    # grid lines again over the band so they stay visible, then the baseline
    parts.append(_line(px0, py1, px1, py1, INK, 1.5))
    parts.append(_line(px0, py0, px0, py1, GRID))

    # data: the line first (so markers sit on top of it), then one group per value with its own tooltip
    if mode == "line":
        joined = " ".join(f"{_n(centers[i])},{_n(y_of(p['value']))}" for i, (_, p) in enumerate(slots) if p)
        if len(points) > 1:
            parts.append(f'<polyline points="{joined}" fill="none" stroke="{INK}" stroke-width="1.5"/>')
    for i, (label, point) in enumerate(slots):
        cx = centers[i]
        parts.append(_text(cx, py1 + 18, _clip(label, 14), size=10.5, fill=MUTED, anchor="middle"))
        if point is None:
            parts.append(_text(cx, py1 - 8, "no value", size=10, fill=MUTED, anchor="middle"))
            continue
        status = _status(point)
        value = point["value"]
        text = f"{_fmt(value)} {unit}".strip()
        tip = f"{name}: {text}, {label}" + (f" ({_flag_word(status).lower()})" if status else "")
        bits = [f"<title>{_esc(tip)}</title>"]
        if mode == "bars":
            bar_w = min(slot * 0.5, 64)
            top_y = y_of(value)
            bits.append(_rect(cx - bar_w / 2, top_y, bar_w, py1 - top_y, RED if status else INK))
            if status == "high":
                bits.append(f'<polygon points="{_n(cx - 5)},{_n(top_y - 4)} {_n(cx + 5)},{_n(top_y - 4)} {_n(cx)},{_n(top_y - 12)}" fill="{RED}"/>')
            elif status == "low":
                bits.append(f'<polygon points="{_n(cx - 5)},{_n(top_y - 12)} {_n(cx + 5)},{_n(top_y - 12)} {_n(cx)},{_n(top_y - 4)}" fill="{RED}"/>')
            elif status == "out":
                bits.append(_rect(cx - 4, top_y - 13, 8, 8, "none", f' stroke="{RED}" stroke-width="1.5"'))
            label_y = top_y - (18 if status else 7)
        else:
            my = y_of(value)
            bits.append(_marker(cx, my, status))
            label_y = my - (22 if status in ("high", "out") else 11)
        label_y = max(label_y, py0 - 4)
        if slot >= 48 or status or i in (0, n - 1):
            bits.append(_text(cx, label_y, text, size=10.5, weight=600 if status else 400, fill=RED if status else INK, anchor="middle"))
        parts.append("<g>" + "".join(bits) + "</g>")
    return f"<g>{''.join(parts)}</g>", 212.0


def _frame(title: str, subtitle: str, inner: str, height: float, description: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {_n(height)}" width="{WIDTH}" height="{_n(height)}" '
        f'role="img" font-family="{FONT}">'
        f"<title>{_esc(title)}</title><desc>{_esc(description)}</desc>"
        f'{_rect(0, 0, WIDTH, height, PAPER)}'
        f"{_text(24, 30, _clip(title, 70), size=16, weight=800)}"
        f"{_text(24, 48, subtitle, size=10.5, fill=MUTED)}"
        f"{inner}</svg>"
    )


_LEGEND = "Grey band: the range printed in your report. Red: outside that range."


def _line_or_bar_chart(title: str, panels: list[tuple[str, str, list[tuple[str, dict[str, Any] | None]]]], mode: str, description: str) -> str:
    top = 66.0
    inner = ""
    for name, unit, slots in panels:
        svg, height = _panel(top, name, unit, slots, mode)
        inner += svg
        top += height
    return _frame(title, _LEGEND, inner, top + 4, description)


def _values_chart(title: str, rows: list[tuple[str, str, dict[str, Any]]], description: str, extra_note: str = "") -> str:
    """One row per test: a range bar (printed range) with the value marked on it."""
    top = 66.0
    row_h = 40.0
    ax0, ax1 = 250.0, 536.0
    parts: list[str] = []
    for i, (name, unit, p) in enumerate(rows):
        row: list[str] = []
        y = top + i * row_h
        cy = y + 17
        status = _status(p)
        value, low, high = p["value"], p.get("range_low"), p.get("range_high")
        row.append(_text(24, y + 15, _clip(name, 30), size=12, weight=600))
        range_text = (p.get("range_text") or "").strip()
        row.append(_text(24, y + 29, _clip(range_text, 34) if range_text else "No printed range", size=10, fill=MUTED))
        bounds = [value] + [b for b in (low, high) if b is not None]
        lo_v, hi_v = min(bounds), max(bounds)
        pad = (hi_v - lo_v) * 0.18 or max(abs(hi_v) * 0.1, 1.0)
        a, b = lo_v - pad, hi_v + pad

        def x_of(v: float, a=a, b=b) -> float:
            return ax0 + (v - a) / (b - a) * (ax1 - ax0)

        row.append(_line(ax0, cy, ax1, cy, GRID))
        if low is not None or high is not None:
            bx0 = x_of(low) if low is not None else ax0
            bx1 = x_of(high) if high is not None else ax1
            row.append(_rect(bx0, cy - 8, bx1 - bx0, 16, BAND, ' shape-rendering="crispEdges"'))
            for edge in (low, high):
                if edge is not None:
                    row.append(_line(x_of(edge), cy - 8, x_of(edge), cy + 8, MUTED))
        row.append(_marker(x_of(value), cy, status))
        text = f"{_fmt(value)} {unit}".strip()
        row.append(_text(556, cy + 4, text, size=12, weight=600, fill=RED if status else INK))
        if status:
            word = {"high": "High", "low": "Low", "out": "Outside range"}[status]
            row.append(_text(WIDTH - 24, cy + 4, word, size=10.5, weight=600, fill=RED, anchor="end"))
        tip = f"{name}: {text}" + (f" ({_flag_word(status).lower()})" if status else "")
        parts.append("<g><title>" + _esc(tip) + "</title>" + "".join(row) + "</g>")
        parts.append(_line(24, y + row_h - 3, WIDTH - 24, y + row_h - 3))
    height = top + len(rows) * row_h + 8
    return _frame(title, _LEGEND + extra_note, "".join(parts), height, description)


# ------------------------------------------------------------------------- builders


def _unit_of(test: dict[str, Any]) -> str:
    return str(test.get("unit") or "").strip()


def _note_ranges(name: str, points: list[dict[str, Any]], notes: list[str]) -> None:
    ranges = {(p.get("range_low"), p.get("range_high")) for p in points}
    if len(ranges) > 1:
        notes.append(f"The printed range for {name} is not the same in every report; each value is compared with its own report's range.")


def _build_trend(spec: dict[str, Any], series: dict[str, Any]) -> dict[str, Any]:
    labels_all = _labels_for(series["reports"])
    dates = {r["report_id"]: r.get("date_iso") for r in series["reports"]}
    notes: list[str] = []
    out_series: list[dict[str, Any]] = []
    panels: list[tuple[str, str, list[tuple[str, dict[str, Any] | None]]]] = []
    chosen: list[dict[str, Any]] = []
    for wanted in spec["tests"]:
        test = _find_test(series["tests"], wanted)
        if any(t["name"] == test["name"] for t in chosen):
            continue
        chosen.append(test)
    for test in chosen:
        points = list(test["points"])
        if len(points) > MAX_TREND_POINTS:
            notes.append(f"{test['name']}: showing the latest {MAX_TREND_POINTS} of {len(points)} reports.")
            points = points[-MAX_TREND_POINTS:]
        if len(points) == 1:
            notes.append(f"Only one of your reports has {test['name']}, so there is no trend yet.")
        _note_ranges(test["name"], points, notes)
        unit = _unit_of(test)
        panels.append((test["name"], unit, [(labels_all[p["report_id"]], p) for p in points]))
        out_series.append({"test": test["name"], "unit": unit, "points": [_payload_point(p, labels_all, dates) for p in points]})
    names = [t["name"] for t in chosen]
    title = spec.get("title") or (f"{_join_names(names)} over time")
    description = f"Chart of {_join_names(names)} across {max(len(s['points']) for s in out_series)} report(s). " + _describe(out_series)
    svg = _line_or_bar_chart(title, panels, "line", description)
    return {"kind": "trend", "title": title, "svg": svg, "series": out_series, "notes": notes}


def _build_compare(spec: dict[str, Any], series: dict[str, Any]) -> dict[str, Any]:
    reports = series["reports"]
    by_id = {r["report_id"]: r for r in reports}
    chosen_tests: list[dict[str, Any]] = []
    for wanted in spec["tests"]:
        test = _find_test(series["tests"], wanted)
        if all(t["name"] != test["name"] for t in chosen_tests):
            chosen_tests.append(test)
    notes: list[str] = []

    if spec.get("reports"):
        chosen_reports: list[dict[str, Any]] = []
        for rid in spec["reports"]:
            report = by_id.get(rid)
            if report is None:
                raise ChartError("One of the reports in this chart was not found in your reports.")
            if report not in chosen_reports:
                chosen_reports.append(report)
        if len(chosen_reports) < MIN_COMPARE_REPORTS:
            raise ChartError("A comparison needs at least 2 different reports.")
        chosen_reports.sort(key=lambda r: r["order"])
    else:
        have = {p["report_id"] for t in chosen_tests for p in t["points"]}
        dated = [r for r in reports if r.get("date_iso") and r["report_id"] in have]
        if len(dated) >= 2:
            chosen_reports = [dated[0], dated[-1]]
        else:
            pool = [r for r in reports if r["report_id"] in have]
            if len(pool) < 2:
                names = _join_names([t["name"] for t in chosen_tests])
                raise ChartError(f"Only one of your reports has {names}, so there is nothing to compare yet.")
            chosen_reports = [pool[0], pool[-1]]
            notes.append("Some of these reports have no date, so the first and the last one stored are compared.")

    labels = _labels_for(chosen_reports)
    dates = {r["report_id"]: r.get("date_iso") for r in chosen_reports}
    panels: list[tuple[str, str, list[tuple[str, dict[str, Any] | None]]]] = []
    out_series: list[dict[str, Any]] = []
    for test in chosen_tests:
        by_report = {p["report_id"]: p for p in test["points"]}
        slots = [(labels[r["report_id"]], by_report.get(r["report_id"])) for r in chosen_reports]
        found = [p for _, p in slots if p]
        if not found:
            raise ChartError(f"There are no {test['name']} values in the reports you chose.")
        for r in chosen_reports:
            if r["report_id"] not in by_report:
                notes.append(f"{test['name']} has no value in the {labels[r['report_id']]} report.")
        _note_ranges(test["name"], found, notes)
        unit = _unit_of(test)
        panels.append((test["name"], unit, slots))
        out_series.append({"test": test["name"], "unit": unit, "points": [_payload_point(p, labels, dates) for p in found]})
    names = [t["name"] for t in chosen_tests]
    title = spec.get("title") or f"{_join_names(names)}: {_join_names([labels[r['report_id']] for r in chosen_reports])}"
    description = f"Comparison of {_join_names(names)} between {len(chosen_reports)} reports. " + _describe(out_series)
    svg = _line_or_bar_chart(title, panels, "bars", description)
    return {"kind": "compare", "title": title, "svg": svg, "series": out_series, "notes": notes}


def _build_values(spec: dict[str, Any], series: dict[str, Any]) -> dict[str, Any]:
    report = next((r for r in series["reports"] if r["report_id"] == spec["report_id"]), None)
    if report is None:
        raise ChartError("That report was not found in your reports.")
    labels = _labels_for([report])
    dates = {report["report_id"]: report.get("date_iso")}
    rows: list[tuple[str, str, dict[str, Any]]] = []
    for test in series["tests"]:
        for p in test["points"]:
            if p["report_id"] == report["report_id"]:
                rows.append((test["name"], _unit_of(test), p))
                break
    if not rows:
        raise ChartError("There are no values read from that report yet.")
    notes: list[str] = []
    if len(rows) > MAX_VALUE_ROWS:
        notes.append(f"Showing the first {MAX_VALUE_ROWS} of {len(rows)} values.")
        rows = rows[:MAX_VALUE_ROWS]
    title = spec.get("title") or f"Values in {_clip(str(report.get('filename') or 'your report'), 60)}"
    out_series = [
        {"test": name, "unit": unit, "points": [_payload_point(p, labels, dates)]} for name, unit, p in rows
    ]
    description = f"Every value read from one report ({labels[report['report_id']]}) shown against its printed range. " + _describe(out_series)
    svg = _values_chart(title, rows, description)
    return {"kind": "values", "title": title, "svg": svg, "series": out_series, "notes": notes}


def _join_names(names: list[str]) -> str:
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " and " + names[-1]


def _describe(series: list[dict[str, Any]]) -> str:
    bits = []
    for s in series[:12]:
        values = ", ".join(f"{_fmt(p['value'])} {s['unit']}".strip() + f" ({p['label']})" for p in s["points"][:12])
        bits.append(f"{s['test']}: {values}.")
    return " ".join(bits)[:1500]


def build_chart(user_id: str, spec: Any) -> dict[str, Any]:
    """Validate the spec, look the values up for this person only, and draw the chart."""
    clean = validate_spec(spec)
    series = series_service.get_series(user_id)
    if not series["tests"]:
        raise ChartError("There are no lab values in your reports yet.")
    if clean["kind"] == "trend":
        return _build_trend(clean, series)
    if clean["kind"] == "compare":
        return _build_compare(clean, series)
    return _build_values(clean, series)
