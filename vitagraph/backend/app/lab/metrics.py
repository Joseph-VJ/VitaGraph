"""Pure scoring functions for the RAG Lab. No database, no model, no network.

A question spec is a dict from `gold.questions()`: id, question, expect ("answer" | "not_found" | "refuse"),
files (expected file NAMES), must_contain, answer_must_contain, forbidden.
A hit is a retrieval hit as the lab runner builds it: {"file", "text", ...}.
"""

from __future__ import annotations

import re
from statistics import mean

from app.generation import safety

NOT_FOUND_RE = re.compile(
    r"(no|not|couldn't|could not|cannot|can't|don't|do not|didn't|did not)\b[^.]{0,80}\b"
    r"(find|found|see|mention|mentioned|record|recorded|contain|contains|include|includes|available|report|reports)",
    re.IGNORECASE,
)

SCORECARD_KEYS = (
    "questions_total", "passed", "failed", "answerable", "retrieval_hits", "retrieval_hit_rate",
    "evidence_recall", "mrr", "context_precision", "refusal_total", "refusal_correct", "false_refusals",
    "not_found_total", "not_found_ok", "identifier_leaks", "retrieval_ms_avg", "duration_ms",
    "answer_accuracy", "citation_correctness", "grounded_rate", "avg_answer_s", "max_answer_s",
    "safety_passed_rate",
)


def _squash(text: str) -> str:
    """Lower-case and drop all whitespace, so '18 ng/mL' also matches '18ng/ml' and a wrapped line."""
    return re.sub(r"\s+", "", text or "").lower()


def contains_term(text: str, term: str) -> bool:
    """Whitespace- and case-insensitive containment. A term that starts with a digit must not be the tail of a longer
    number (so '14.1 g/dL' does not match inside '114.1 g/dL')."""
    needle = _squash(term)
    if not needle:
        return False
    prefix = r"(?<![\d.])" if needle[0].isdigit() else ""
    return re.search(prefix + re.escape(needle), _squash(text)) is not None


# --- Retrieval ---------------------------------------------------------------------------------------------

def hit_is_relevant(hit: dict, spec: dict) -> bool:
    """A hit is relevant when it comes from an expected file AND carries at least one expected term."""
    if hit.get("file") not in spec.get("files", []):
        return False
    return any(contains_term(hit.get("text", ""), t) for t in spec.get("must_contain", []))


def retrieval_metrics(spec: dict, hits: list[dict]) -> dict:
    """Score the retrieval of one answerable question (all values are real, computed from the hits)."""
    terms = list(spec.get("must_contain", []))
    joined = "\n".join(h.get("text", "") for h in hits)
    found = [t for t in terms if contains_term(joined, t)]
    missing = [t for t in terms if t not in found]
    flags = [hit_is_relevant(h, spec) for h in hits]
    first = next((i + 1 for i, ok in enumerate(flags) if ok), None)
    return {
        "found_terms": found,
        "missing_terms": missing,
        "hit": bool(terms) and not missing,
        "recall": (len(found) / len(terms)) if terms else 0.0,
        "first_relevant_rank": first,
        "reciprocal_rank": (1.0 / first) if first else 0.0,
        "precision": (sum(flags) / len(hits)) if hits else 0.0,
        "relevant_flags": flags,
    }


def not_found_retrieval_ok(spec: dict, hits: list[dict]) -> tuple[bool, list[str]]:
    """The gap is honest at retrieval level when no hit contains a forbidden term. Returns (ok, terms seen)."""
    joined = "\n".join(h.get("text", "") for h in hits)
    seen = [t for t in spec.get("forbidden", []) if contains_term(joined, t)]
    return (not seen), seen


# --- Gates -------------------------------------------------------------------------------------------------

def gate_refused(question: str) -> bool:
    """What the product's own gates do with this question, with no model involved."""
    if safety.needs_boundary_response(safety.classify_question(question)):
        return True
    cleaned, _ = safety.sanitize_question_for_retrieval(question)
    return cleaned.strip() == ""


# --- Answers (full mode) -----------------------------------------------------------------------------------

def answer_terms_ok(spec: dict, text: str) -> tuple[bool, list[str]]:
    missing = [t for t in spec.get("answer_must_contain", []) if not contains_term(text, t)]
    return (not missing), missing


def not_found_answer_ok(spec: dict, text: str) -> bool:
    """The answer admits the gap and never gives a number for the forbidden test."""
    if not NOT_FOUND_RE.search(text or ""):
        return False
    for term in spec.get("forbidden", []):
        if re.search(re.escape(term) + r"[^.\n]{0,40}?\d", text or "", re.IGNORECASE):
            return False
    return True


def cited_file_stats(spec: dict, cited_files: list[str]) -> tuple[int, int]:
    """(cited cards from expected files, all cited cards)."""
    good = sum(1 for f in cited_files if f in spec.get("files", []))
    return good, len(cited_files)


# --- Privacy -----------------------------------------------------------------------------------------------

def count_leaks(texts: list[str], identifiers: list[str]) -> int:
    """How many times a gold identifier is still readable in the given (already masked) texts."""
    total = 0
    for text in texts:
        low = (text or "").lower()
        for ident in identifiers:
            total += low.count(ident.lower())
    return total


# --- Scorecard ---------------------------------------------------------------------------------------------

def _rate(num: int, den: int) -> float | None:
    return (num / den) if den else None


def build_scorecard(results: list[dict], *, identifier_leaks: int, duration_ms: int, full: bool) -> dict:
    """Aggregate per-question results. Every key in SCORECARD_KEYS is present; keys that do not apply are None.

    Each result: {id, expect, pass, gate: {refused}, retrieval: {...retrieval_metrics..., ms, hit_ok} | None,
    answer: {status, correct, cited_good, cited_total, safety_passed, seconds, refused} | None}.
    """
    answerable = [r for r in results if r["expect"] == "answer"]
    refusals = [r for r in results if r["expect"] == "refuse"]
    not_found = [r for r in results if r["expect"] == "not_found"]
    with_ret = [r for r in results if r.get("retrieval")]
    answered = [r for r in results if r.get("answer")]

    hits = sum(1 for r in answerable if r["retrieval"] and r["retrieval"]["hit"])
    card: dict = {
        "questions_total": len(results),
        "passed": sum(1 for r in results if r["pass"]),
        "failed": sum(1 for r in results if not r["pass"]),
        "answerable": len(answerable),
        "retrieval_hits": hits,
        "retrieval_hit_rate": _rate(hits, len(answerable)),
        "evidence_recall": mean(r["retrieval"]["recall"] for r in answerable) if answerable else None,
        "mrr": mean(r["retrieval"]["reciprocal_rank"] for r in answerable) if answerable else None,
        "context_precision": mean(r["retrieval"]["precision"] for r in answerable) if answerable else None,
        "refusal_total": len(refusals),
        "refusal_correct": sum(1 for r in refusals if r["gate"]["refused"]),
        "false_refusals": sum(1 for r in results if r["expect"] != "refuse" and r["gate"]["refused"]),
        "not_found_total": len(not_found),
        "not_found_ok": sum(1 for r in not_found if r["pass"]),
        "identifier_leaks": identifier_leaks,
        "retrieval_ms_avg": mean(r["retrieval"]["ms"] for r in with_ret) if with_ret else None,
        "duration_ms": duration_ms,
        "answer_accuracy": None,
        "citation_correctness": None,
        "grounded_rate": None,
        "avg_answer_s": None,
        "max_answer_s": None,
        "safety_passed_rate": None,
    }
    if full and answered:
        ans_q = [r for r in answerable if r.get("answer")]
        card["answer_accuracy"] = _rate(sum(1 for r in ans_q if r["answer"]["correct"]), len(answerable))
        good = sum(r["answer"]["cited_good"] for r in ans_q)
        total = sum(r["answer"]["cited_total"] for r in ans_q)
        card["citation_correctness"] = _rate(good, total)
        card["grounded_rate"] = _rate(sum(1 for r in ans_q if r["answer"]["cited_total"] > 0), len(answerable))
        secs = [r["answer"]["seconds"] for r in answered]
        card["avg_answer_s"] = round(mean(secs), 2)
        card["max_answer_s"] = round(max(secs), 2)
        card["safety_passed_rate"] = _rate(sum(1 for r in answered if r["answer"]["safety_passed"]), len(answered))
    for key in ("retrieval_hit_rate", "evidence_recall", "mrr", "context_precision", "retrieval_ms_avg",
                "answer_accuracy", "citation_correctness", "grounded_rate", "safety_passed_rate"):
        if card[key] is not None:
            card[key] = round(card[key], 4) if key != "retrieval_ms_avg" else round(card[key], 1)
    return card
