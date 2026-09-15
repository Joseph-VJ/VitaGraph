"""Question-answering orchestration (plan Section 10 request flow).

Order is fixed: classify -> retrieve (user-filtered, fail closed) -> choose
composer -> safety-check -> persist -> respond. Boundary classifications
never reach retrieval; the neutral AI service is contacted only when
allow_api is enabled, and only with the selected evidence snippets.

Every AI attempt is written to the ai_calls audit table with the workflow
id, request id, status, and error so each generation is traceable.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from app.core.database import get_db
from app.generation import ai_client, fallback_composer, safety
from app.rag import retriever
from app.services import timeline_service


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _record_ai_call(
    user_id: str,
    question_id: str,
    workflow_id: str,
    request_id: str,
    status: str,
    used_ai: bool,
    error: str | None = None,
) -> None:
    """Write one row to the ai_calls audit table (never raises)."""
    try:
        with get_db() as db:
            db.execute(
                """INSERT INTO ai_calls
                   (id, question_id, user_id, workflow_id, request_id, status,
                    used_ai, error, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    f"aic_{uuid.uuid4().hex[:12]}",
                    question_id,
                    user_id,
                    workflow_id,
                    request_id or "",
                    status,
                    1 if used_ai else 0,
                    error,
                    _now(),
                ),
            )
    except Exception:
        # Audit logging must never break the answer path.
        pass


def ask(user_id: str, question_text: str) -> dict:
    question_id = f"qst_{uuid.uuid4().hex[:12]}"
    classification = safety.classify_question(question_text)

    # Injection phrasing is stripped before retrieval; the rewrite is
    # recorded so the audit trail shows the question actually used.
    retrieval_question, was_rewritten = safety.sanitize_question_for_retrieval(question_text)

    # --- Boundary questions: refuse before any retrieval ---------------------
    if safety.needs_boundary_response(classification):
        _record_ai_call(user_id, question_id, question_id, "", "not_used", False)
        return _persist(
            user_id=user_id,
            question_id=question_id,
            question_text=question_text,
            classification=classification,
            status="refused",
            summary_text=safety.BOUNDARY_RESPONSE,
            evidence=[],
            limitations_text=(
                "This question type is outside the project boundary, so no "
                "report evidence was retrieved or used."
            ),
            ai_service_status="not_used",
            was_rewritten=was_rewritten,
        )

    # --- Pure-injection question: nothing answerable remains ------------------
    if not retrieval_question.strip():
        _record_ai_call(user_id, question_id, question_id, "", "not_used", False)
        return _persist(
            user_id=user_id,
            question_id=question_id,
            question_text=question_text,
            classification="unsupported",
            status="refused",
            summary_text=(
                "This message contained only instruction-like text addressed "
                "to the system. VitaGraph treats such text as data, never as "
                "instructions, and no answerable question remained in it. "
                "Please ask a question about your uploaded reports."
            ),
            evidence=[],
            limitations_text=(
                "No report evidence was retrieved because no question "
                "content remained after removing untrusted instruction-like text."
            ),
            ai_service_status="not_used",
            was_rewritten=was_rewritten,
        )

    # --- Retrieval (always user-scoped; retriever fails closed) --------------
    evidence = retriever.retrieve(user_id=user_id, question=retrieval_question)

    if not evidence:
        composed = fallback_composer.compose_answer(question_text, evidence)
        _record_ai_call(user_id, question_id, question_id, "", "not_used", False)
        return _persist(
            user_id=user_id,
            question_id=question_id,
            question_text=question_text,
            classification=classification,
            status="insufficient_evidence",
            summary_text=composed["summary_text"],
            evidence=[],
            limitations_text=composed["limitations_text"],
            ai_service_status="not_used",
            was_rewritten=was_rewritten,
        )

    # --- Answer composition ---------------------------------------------------
    snippets = [hit["document"] for hit in evidence]
    generation = ai_client.generate_answer(question_text, snippets)

    safety_note: str | None = None
    if generation.ok:
        summary_text = generation.text
        ai_status = "ok"
        limitations_text = (
            "The answer above was composed from the quoted evidence only. "
            "VitaGraph does not interpret values clinically or draw causal "
            "conclusions."
        )
        # Post-generation safety check on the composed answer.
        passed, reason = safety.check_answer_safety(summary_text, snippets)
        if not passed:
            # Fall back to the local evidence-only composer; never show an
            # answer that failed the safety check. The reason is persisted.
            composed = fallback_composer.compose_answer(question_text, evidence)
            summary_text = composed["summary_text"]
            limitations_text = composed["limitations_text"]
            ai_status = "replaced_by_fallback"
            safety_note = reason
        _record_ai_call(
            user_id, question_id, question_id, generation.request_id,
            ai_status, True, generation.error,
        )
    else:
        # Disabled or failed service: local, evidence-only composition keeps
        # the local core working (plan Section 2.4 failure contract).
        composed = fallback_composer.compose_answer(question_text, evidence)
        summary_text = composed["summary_text"]
        limitations_text = composed["limitations_text"]
        ai_status = generation.status  # 'disabled' | 'error'
        safety_note = generation.error
        # used_ai is True only when a real external call was attempted (error),
        # not when the service is disabled.
        _record_ai_call(
            user_id, question_id, question_id, generation.request_id,
            ai_status, ai_status == "error", generation.error,
        )

    return _persist(
        user_id=user_id,
        question_id=question_id,
        question_text=question_text,
        classification=classification,
        status="answered",
        summary_text=summary_text,
        evidence=evidence,
        limitations_text=limitations_text,
        ai_service_status=ai_status,
        was_rewritten=was_rewritten,
        safety_note=safety_note,
    )


def _persist(user_id: str, question_id: str, question_text: str, classification: str,
             status: str, summary_text: str, evidence: list[dict],
             limitations_text: str, ai_service_status: str,
             was_rewritten: bool = False, safety_note: str | None = None) -> dict:
    answer_id = f"ans_{uuid.uuid4().hex[:12]}"
    evidence_cards = [
        {
            "chunk_id": hit["chunk_id"],
            "report_id": hit["metadata"].get("report_id", ""),
            "report_filename": hit.get("report_filename", ""),
            "report_date": hit.get("report_date"),
            "page_number": hit["metadata"].get("page_number", 0),
            "snippet": hit["document"][:400],
            "score": hit["score"],
        }
        for hit in evidence
    ]

    with get_db() as db:
        db.execute(
            "INSERT INTO questions (id, user_id, text, classification, asked_at, status)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (question_id, user_id, question_text, classification, _now(), status),
        )
        db.execute(
            """INSERT INTO answers
               (id, question_id, user_id, summary_text, limitations_text, safety_text,
                evidence_json, ai_service_status, ai_service_config, safety_status,
                safety_check_note, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (answer_id, question_id, user_id, summary_text, limitations_text,
             safety.SAFETY_TEXT, json.dumps(evidence_cards), ai_service_status,
             ai_client.CONFIG_VERSION, status, safety_note, _now()),
        )

    # Timeline records identifiers and counts, never raw content.
    timeline_service.add_event(user_id, "question_asked", {
        "question_id": question_id,
        "classification": classification,
        "status": status,
        "question_rewritten_for_retrieval": was_rewritten,
    })
    if status == "answered":
        timeline_service.add_event(user_id, "answer_generated", {
            "question_id": question_id,
            "answer_id": answer_id,
            "evidence_count": len(evidence_cards),
            "ai_service_status": ai_service_status,
        })

    return {
        "question_id": question_id,
        "classification": classification,
        "status": status,
        "summary_text": summary_text,
        "evidence": evidence_cards,
        "limitations_text": limitations_text,
        "safety_text": safety.SAFETY_TEXT,
        "ai_service_status": ai_service_status,
        "safety_status": status if status != "answered" else "passed",
    }
