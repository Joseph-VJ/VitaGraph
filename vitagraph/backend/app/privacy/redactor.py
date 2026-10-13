"""Pure masking of personal identifiers in free text.

Placeholders look like ``[PERSON_1]`` and are numbered per persona (per ``Vault``) in order of discovery.
Only identifiers are masked. Test names, values, units, reference ranges, flags, collection dates, lab name,
age and sex are never touched, because the analysis compares reports over time and needs them.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable

TYPES = ("PERSON", "DOCTOR", "ID", "DOB", "PHONE", "EMAIL", "ADDRESS", "GOV_ID", "CUSTOM")

# Matches every placeholder this module can produce.
PLACEHOLDER_RE = re.compile(r"\[(PERSON|DOCTOR|ID|DOB|PHONE|EMAIL|ADDRESS|GOV_ID|CUSTOM)_(\d{1,4})\]")

MAX_VAULT_ENTRIES = 500
MAX_VALUE_CHARS = 80
# Types whose learned values are masked wherever they appear later in any text for the same persona.
_KNOWN_TERM_TYPES = frozenset({"PERSON", "DOCTOR", "ID", "CUSTOM"})
_MIN_TERM_CHARS = 3

_APOS = r"['’]"
_NO = r"(?:[ \t]*(?:No\.?|Number))?"

# Labels per type; the value follows the label and a colon. Only a colon counts as a label separator.
_LABELS: dict[str, list[str]] = {
    "PERSON": [
        rf"Patient(?:{_APOS}s)?[ \t]+Name",
        r"Name[ \t]+of[ \t]+(?:the[ \t]+)?Patient",
        r"Pt\.?[ \t]*Name",
        r"Patient",
        r"Guardian",
        rf"(?:Father|Mother|Husband|Wife)(?:{_APOS}s)?[ \t]+Name",
        rf"Spouse(?:{_APOS}s)?[ \t]+Name",
    ],
    "DOCTOR": [
        r"Ref\.?[ \t]*By",
        r"Referred[ \t]+By",
        r"Referring[ \t]+(?:Doctor|Physician)",
        r"Consultant",
        r"Doctor",
        r"Physician",
    ],
    "ID": [
        r"Patient[ \t]+ID",
        r"UHID",
        r"MRN",
        r"Medical[ \t]+Record[ \t]+(?:No\.?|Number)",
        r"Report[ \t]+ID",
        r"Sample[ \t]+ID",
        r"Specimen[ \t]+ID",
        r"Lab[ \t]+(?:No\.?|ID)",
        r"Accession[ \t]+(?:No\.?|Number)",
        r"Registration[ \t]+No\.?",
        r"Reg\.?[ \t]*No\.?",
        r"Bill[ \t]+No\.?",
        r"Barcode",
        r"Insurance[ \t]+ID",
        r"Policy[ \t]+No\.?",
    ],
    "DOB": [r"Date[ \t]+of[ \t]+Birth", r"D\.?O\.?B\.?"],
    "PHONE": [rf"Phone{_NO}", rf"Mobile{_NO}", r"Mob\.?", rf"Contact{_NO}", r"Tel\.?"],
    "EMAIL": [r"E-?mail(?:[ \t]*(?:ID|Address))?"],
    "ADDRESS": [r"Address", r"Addr\."],
    "GOV_ID": [
        rf"Aadhaar{_NO}(?:[ \t]*Card)?",
        rf"Aadhar{_NO}(?:[ \t]*Card)?",
        rf"PAN{_NO}(?:[ \t]*Card)?",
        rf"Passport{_NO}",
        r"ABHA(?:[ \t]*(?:ID|No\.?|Number))?",
    ],
}

# Words that end a value when they are followed by a colon (the next field on the same line).
_EXTRA_STOPS = [r"Age/Sex", r"Age", r"Sex", r"Gender", r"Date", r"Collected", r"Reported", r"Received", r"Time", r"Location"]


def _build_label_re() -> re.Pattern[str]:
    groups = [f"(?P<{t}>" + "|".join(pats) + ")" for t, pats in _LABELS.items()]
    # "Name" alone counts only at the start of a line ("Test Name:" must stay untouched).
    line_start = r"^[ \t]*(?P<PERSON_LS>Name)"
    return re.compile(
        r"(?:(?<!\w)(?:" + "|".join(groups) + r")|" + line_start + r")[ \t]*:[ \t]*",
        re.IGNORECASE | re.MULTILINE,
    )


def _build_stop_re() -> re.Pattern[str]:
    alts = [p for pats in _LABELS.values() for p in pats] + _EXTRA_STOPS
    return re.compile(r"(?<!\w)(?:" + "|".join(alts) + r")[ \t]*:", re.IGNORECASE)


_LABEL_RE = _build_label_re()
_STOP_RE = _build_stop_re()
# A value also ends at a quote or a backslash, so text inside JSON ("...A\nReport ID: ...") is cut cleanly.
_CUT_RE = re.compile(r'\n|\t|\||[ ]{2,}|"|\\')

_NAME_WORD = r"[A-Z][A-Za-z'’-]*"
_MY_NAME_RE = re.compile(rf"(?i:my[ \t]+name[ \t]+is)[ \t]+({_NAME_WORD}(?:[ \t]+{_NAME_WORD}){{0,2}})")
_DOCTOR_RE = re.compile(rf"\bDr\b\.?[ \t]*({_NAME_WORD}(?:[ \t]+{_NAME_WORD}){{0,2}})")

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE_IN_RE = re.compile(r"(?<![\d.])(?:\+91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)")
_PHONE_INTL_RE = re.compile(r"(?<![\w+])\+\d{1,3}(?:[\s-]?\d){7,12}(?!\d)")
_AADHAAR_RE = re.compile(r"(?<!\d)[2-9]\d{3}[\s-]\d{4}[\s-]\d{4}(?!\d)")
_PAN_RE = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")

_EMPTY_VALUES = {"", "-", "--", "na", "n/a", "nil", "none", "null", "not available", "not provided", "unknown"}


class Vault:
    """The identifiers learned for one persona. Memory only, never written to disk."""

    def __init__(self) -> None:
        self._by_key: dict[tuple[str, str], str] = {}
        self._by_placeholder: dict[str, tuple[str, str]] = {}
        self._counts: dict[str, int] = {}

    def __len__(self) -> int:
        return len(self._by_placeholder)

    def __bool__(self) -> bool:  # an empty vault is still a vault (`vault or Vault()` must not replace it)
        return True

    @staticmethod
    def _norm(original: str) -> str:
        return " ".join(original.split()).casefold()

    def placeholder_for(self, type_: str, original: str) -> str:
        original = " ".join(original.split())
        key = (type_, self._norm(original))
        existing = self._by_key.get(key)
        if existing is not None:
            return existing
        number = self._counts.get(type_, 0) + 1
        self._counts[type_] = number
        placeholder = f"[{type_}_{min(number, 9999)}]"
        if len(self._by_placeholder) < MAX_VAULT_ENTRIES:
            self._by_key[key] = placeholder
            self._by_placeholder[placeholder] = (type_, original)
        return placeholder

    def original_of(self, placeholder: str) -> str | None:
        entry = self._by_placeholder.get(placeholder)
        return entry[1] if entry else None

    def known_terms(self) -> list[tuple[str, str]]:
        """(original, type) pairs that are masked wherever they appear, longest first."""
        terms = [(orig, t) for (t, orig) in self._by_placeholder.values()
                 if t in _KNOWN_TERM_TYPES and len(orig) >= _MIN_TERM_CHARS]
        terms.sort(key=lambda pair: (-len(pair[0]), pair[0].casefold()))
        return terms

    def copy(self) -> "Vault":
        clone = Vault()
        clone._by_key = dict(self._by_key)
        clone._by_placeholder = dict(self._by_placeholder)
        clone._counts = dict(self._counts)
        return clone


@dataclass
class RedactResult:
    masked: str
    spans: list[dict] = field(default_factory=list)
    counts: dict[str, int] = field(default_factory=dict)


@dataclass
class _Cand:
    start: int
    end: int
    type: str
    original: str


def _usable(value: str) -> bool:
    if not value or len(value) > MAX_VALUE_CHARS:
        return False
    if value.strip().casefold() in _EMPTY_VALUES:
        return False
    if not re.search(r"[A-Za-z0-9]", value):
        return False
    if PLACEHOLDER_RE.fullmatch(value.strip()):
        return False
    return True


def _labelled(text: str) -> list[_Cand]:
    found: list[_Cand] = []
    for m in _LABEL_RE.finditer(text):
        type_ = m.lastgroup or ""
        # lastgroup is the outermost named group that matched; the inner group names are the types.
        for t in (*_LABELS, "PERSON_LS"):
            if m.group(t) is not None:
                type_ = "PERSON" if t == "PERSON_LS" else t
                break
        start = m.end()
        rest = text[start:]
        cut = _CUT_RE.search(rest)
        value = rest[: cut.start()] if cut else rest
        stop = _STOP_RE.search(value)
        if stop:
            value = value[: stop.start()]
        stripped = value.rstrip(" ,;:")
        if type_ == "ID" and stripped:
            stripped = stripped.split()[0].rstrip(",;:")  # an identifier is one token; "... Page 1" is not part of it
        if not _usable(stripped):
            continue
        found.append(_Cand(start, start + len(stripped), type_, stripped))
    return found


def _name_patterns(text: str) -> list[_Cand]:
    found: list[_Cand] = []
    for rx, type_ in ((_MY_NAME_RE, "PERSON"), (_DOCTOR_RE, "DOCTOR")):
        for m in rx.finditer(text):
            value = m.group(1)
            if _usable(value):
                found.append(_Cand(m.start(1), m.end(1), type_, value))
    return found


def _patterns(text: str) -> list[_Cand]:
    found: list[_Cand] = []
    for rx, type_ in ((_EMAIL_RE, "EMAIL"), (_PHONE_IN_RE, "PHONE"), (_PHONE_INTL_RE, "PHONE"),
                      (_AADHAAR_RE, "GOV_ID"), (_PAN_RE, "GOV_ID")):
        for m in rx.finditer(text):
            found.append(_Cand(m.start(), m.end(), type_, m.group(0)))
    return found


def _known_term_matches(text: str, terms: list[tuple[str, str]]) -> list[_Cand]:
    if not terms:
        return []
    by_norm: dict[str, str] = {}
    for orig, type_ in terms:
        by_norm.setdefault(Vault._norm(orig), type_)
    pattern = "|".join(r"\s+".join(re.escape(part) for part in orig.split()) for orig, _ in terms)
    rx = re.compile(r"(?<!\w)(?:" + pattern + r")(?!\w)", re.IGNORECASE)
    found: list[_Cand] = []
    for m in rx.finditer(text):
        type_ = by_norm.get(Vault._norm(m.group(0)))
        if type_:
            found.append(_Cand(m.start(), m.end(), type_, m.group(0)))
    return found


def learn_labelled(text: str, vault: Vault) -> None:
    """Pass 1: remember the values of labelled fields (and 'Dr. X' / 'my name is X') so later text is masked too."""
    for cand in _labelled(text) + _name_patterns(text):
        vault.placeholder_for(cand.type, cand.original)


def redact_text(text: str, vault: Vault, custom_terms: Iterable[str] = ()) -> RedactResult:
    """Mask the identifiers in ``text``. The vault is updated with every new identifier found."""
    if not text:
        return RedactResult(masked=text or "")
    learned = _labelled(text) + _name_patterns(text)
    for cand in learned:
        vault.placeholder_for(cand.type, cand.original)
    cands = learned + _patterns(text)
    terms = list(vault.known_terms())
    seen = {Vault._norm(o) for o, _ in terms}
    for raw in custom_terms:
        term = " ".join(str(raw).split())
        if len(term) >= 2 and Vault._norm(term) not in seen:
            terms.append((term, "CUSTOM"))
            seen.add(Vault._norm(term))
    terms.sort(key=lambda pair: -len(pair[0]))
    cands += _known_term_matches(text, terms)

    # Text that is already a placeholder is never masked again.
    protected = [(m.start(), m.end()) for m in PLACEHOLDER_RE.finditer(text)]
    cands = [c for c in cands if not any(c.start < pe and c.end > ps for ps, pe in protected)]

    cands.sort(key=lambda c: (c.start, -(c.end - c.start)))
    chosen: list[_Cand] = []
    last_end = 0
    for cand in cands:
        if cand.start >= last_end and cand.end > cand.start:
            chosen.append(cand)
            last_end = cand.end

    out: list[str] = []
    spans: list[dict] = []
    counts: dict[str, int] = {}
    pos = 0
    for cand in chosen:
        placeholder = vault.placeholder_for(cand.type, text[cand.start:cand.end])
        out.append(text[pos:cand.start])
        out.append(placeholder)
        spans.append({"type": cand.type, "placeholder": placeholder, "start": cand.start, "end": cand.end})
        counts[cand.type] = counts.get(cand.type, 0) + 1
        pos = cand.end
    out.append(text[pos:])
    return RedactResult(masked="".join(out), spans=spans, counts=counts)
