"""Question classification, boundary responses, and answer-safety rules.

Implements plan Section 10: classify every question before retrieval, refuse
diagnosis / medication / triage requests with a boundary response, and
provide the mandatory safety text attached to every answer.
"""

from __future__ import annotations

import re

CATEGORIES = ("educational", "administrative", "unsupported", "urgent", "out_of_bounds")

SAFETY_TEXT = (
    "VitaGraph is an educational report-organization tool. It does not "
    "diagnose, treat, or replace professional medical advice. Please consult "
    "a qualified healthcare professional for personal interpretation or any "
    "concerning symptoms."
)

BOUNDARY_RESPONSE = (
    "This request falls outside VitaGraph's boundary. VitaGraph is an "
    "educational system that organizes and explains what your uploaded "
    "reports contain; it cannot diagnose conditions, recommend or change "
    "medication, select treatments, or triage urgent medical problems. "
    "If this concerns urgent symptoms, contact a qualified healthcare "
    "professional or local emergency service immediately."
)

# Keyword signals for classification. Deliberately conservative: a match
# routes the question to a boundary response rather than an answer.
_OUT_OF_BOUNDS_PATTERNS = [
    r"\bdiagnos\w*\b",          # diagnose, diagnosis, diagnosed
    r"\bwhat (?:disease|condition) do i have\b",
    r"\bdo i have\b",
    r"\bis this (?:a )?(?:disease|condition|serious)\b",
    r"\bmedication\b", r"\bmedicine\b", r"\bdosage\b", r"\bdose\b",
    r"\bprescri\w*\b",          # prescribe, prescription
    r"\btreatment\b", r"\btreat it\b",
    r"\bshould i (?:take|stop|start|change)\b",
    r"\bemergency\b", r"\burgent\b", r"\bcall (?:an )?ambulance\b",
]

_URGENT_PATTERNS = [
    r"\bchest pain\b", r"\bcannot breathe\b", r"\bcan't breathe\b",
    r"\bsevere bleeding\b", r"\bfainted\b", r"\bunconscious\b",
    r"\bsuicid\w*\b",
]

_ADMIN_PATTERNS = [
    r"\bhow many reports\b", r"\bwhich reports\b", r"\bwhat reports\b",
    r"\bwhen was .*(?:uploaded|report)\b", r"\blist (?:my|the) reports\b",
]


def sanitize_question_for_retrieval(text: str) -> tuple[str, bool]:
    """Strip prompt-injection phrasing before retrieval (plan Section 10,
    recorded question rewrite).

    Injection sentences inside a question are treated as data noise, not
    instructions. The rewrite only removes known adversarial phrasings and
    never changes the question's own meaning. Returns the cleaned question
    and whether a rewrite happened (recorded in the audit trail).
    """
    injection_patterns = [
        r"ignore (?:all )?(?:previous|prior|above) (?:rules|instructions|prompts)[.,!]?",
        r"disregard (?:all )?(?:previous|prior|above) (?:rules|instructions)[.,!]?",
        r"reveal (?:all )?other users'? (?:data|reports|information)[.,!]?",
        r"show me (?:all )?other users'? (?:data|reports)[.,!]?",
        r"you are now [^.!?]*[.,!?]?",
        r"system prompt[: ]*[^.!?]*[.,!?]?",
    ]
    cleaned = text
    rewritten = False
    for pattern in injection_patterns:
        new_text = re.sub(pattern, " ", cleaned, flags=re.IGNORECASE)
        if new_text != cleaned:
            rewritten = True
            cleaned = new_text
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()

    # If only connector words / punctuation survive the removal, the question
    # carried no answerable content at all (handled by the caller, D15).
    connectors = {"and", "or", "then", "also", "but", "so"}
    meaningful = [token for token in re.findall(r"[A-Za-z0-9']+", cleaned)
                  if token.lower() not in connectors]
    if not meaningful:
        return "", True

    return cleaned, rewritten


def classify_question(text: str) -> str:
    lowered = text.lower()

    for pattern in _URGENT_PATTERNS:
        if re.search(pattern, lowered):
            return "urgent"
    for pattern in _OUT_OF_BOUNDS_PATTERNS:
        if re.search(pattern, lowered):
            return "out_of_bounds"
    for pattern in _ADMIN_PATTERNS:
        if re.search(pattern, lowered):
            return "administrative"
    return "educational"


def needs_boundary_response(classification: str) -> bool:
    return classification in ("out_of_bounds", "urgent")


def _measurement_tokens(text: str) -> set[str]:
    """Extract normalized measurement tokens: number+unit pairs and years.

    Normalization strips the space between value and unit so '18 ng/mL' and
    '18ng/mL' compare equal. Bare numbers (list markers, counts, sequence
    numbers) are deliberately not extracted — they are structural text, not
    health values.
    """
    tokens = set()
    for number, unit in re.findall(r"(\d+(?:\.\d+)?)\s*([a-zA-Z%][a-zA-Z/%]*)", text):
        tokens.add(f"{number}{unit.lower()}")
    for year in re.findall(r"\b(?:19|20)\d{2}\b", text):
        tokens.add(year)
    return tokens


def check_answer_safety(answer_text: str, evidence_snippets: list[str]) -> tuple[bool, str | None]:
    """Post-generation check on composed answers (plan Section 10 step 11).

    Fails if a composed answer asserts diagnostic language or invents a
    measurement (number+unit) or date that appears in none of the evidence
    snippets. Returns the failure reason so it can be persisted with the
    answer for audit.
    """
    lowered = answer_text.lower()

    diagnostic_assertions = [
        "you have", "you are suffering from", "this means you have",
        "you are diagnosed", "confirms that you have",
    ]
    for phrase in diagnostic_assertions:
        if phrase in lowered:
            return False, f"Safety check: answer contains diagnostic phrasing ('{phrase}')."

    allowed = set()
    for snippet in evidence_snippets:
        allowed |= _measurement_tokens(snippet)

    for token in _measurement_tokens(answer_text) - allowed:
        return False, (
            f"Safety check: measurement '{token}' does not appear in any evidence snippet."
        )

    return True, None
