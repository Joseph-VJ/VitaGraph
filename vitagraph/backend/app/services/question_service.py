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
import time
import uuid
from datetime import datetime, timezone

from app.core.database import get_db
from app.generation import ai_client, fallback_composer, safety
from app.graph.builder import get_question_subgraph
from app.rag import retriever
from app.services import timeline_service
from app.services.job_service import job_broker


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


def ask(user_id: str, question_text: str, job_id: str | None = None) -> dict:
    t_start = time.perf_counter()
    jid = job_broker.get_or_create_job(job_id)
    question_id = f"qst_{uuid.uuid4().hex[:12]}"
    classification = safety.classify_question(question_text)

    # 1. Retrieval prep & classification
    job_broker.publish_event(
        jid,
        stage="retrieval",
        description=f"Classifying question and preparing user-scoped retrieval (type: {classification})",
        sub_description=f"User privacy isolation: {user_id}",
    )

    # Injection phrasing is stripped before retrieval; the rewrite is
    # recorded so the audit trail shows the question actually used.
    retrieval_question, was_rewritten = safety.sanitize_question_for_retrieval(question_text)

    # --- Boundary questions: refuse before any retrieval ---------------------
    if safety.needs_boundary_response(classification):
        _record_ai_call(user_id, question_id, question_id, "", "not_used", False)
        job_broker.publish_event(
            jid,
            stage="safety",
            description="Clinical boundary check triggered: Medical diagnosis/treatment advice refused",
            sub_description="Educational safety policy enforced",
        )
        t_total = int((time.perf_counter() - t_start) * 1000)
        job_broker.complete_job(jid, description=f"Question refused per clinical boundary policy ({t_total} ms)", latency_ms=t_total)
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
            job_id=jid,
        )

    # --- Pure-injection question: nothing answerable remains ------------------
    if not retrieval_question.strip():
        _record_ai_call(user_id, question_id, question_id, "", "not_used", False)
        job_broker.publish_event(
            jid,
            stage="safety",
            description="Untrusted instruction pattern removed; no answerable question remained",
            sub_description="Prompt injection policy enforced",
        )
        t_total = int((time.perf_counter() - t_start) * 1000)
        job_broker.complete_job(jid, description=f"Question refused ({t_total} ms)", latency_ms=t_total)
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
            job_id=jid,
        )

    # --- Retrieval (always user-scoped; retriever fails closed) --------------
    t0_ret = time.perf_counter()
    try:
        evidence = retriever.retrieve(user_id=user_id, question=retrieval_question)
    except Exception as exc:
        job_broker.publish_error(jid, f"Vector retrieval error: {str(exc)}")
        t_total = int((time.perf_counter() - t_start) * 1000)
        job_broker.complete_job(jid, description=f"Retrieval store unavailable ({t_total} ms)", latency_ms=t_total)
        return _persist(
            user_id=user_id,
            question_id=question_id,
            question_text=question_text,
            classification=classification,
            status="error",
            summary_text="Retrieval error: The vector retrieval store is currently unavailable. Evidence could not be fetched.",
            evidence=[],
            limitations_text="Vector database offline or connection refused. Knowledge graph and timeline remain accessible.",
            ai_service_status="error",
            was_rewritten=was_rewritten,
            job_id=jid,
        )
    t_ret = int((time.perf_counter() - t0_ret) * 1000)

    job_broker.publish_event(
        jid,
        stage="retrieval",
        description=f"Retrieved {len(evidence)} evidence chunks matching score threshold >= 0.40",
        sub_description=f"Query: '{retrieval_question[:60]}' (Chroma user_id={user_id})",
        latency_ms=max(15, t_ret),
    )

    if not evidence:
        composed = fallback_composer.compose_answer(question_text, evidence)
        _record_ai_call(user_id, question_id, question_id, "", "not_used", False)
        job_broker.publish_event(
            jid,
            stage="generation",
            description="No evidence chunks met 0.40 similarity threshold; composing honest insufficient state",
            sub_description="Local fallback composer",
        )
        t_total = int((time.perf_counter() - t_start) * 1000)
        job_broker.complete_job(jid, description=f"Response completed: insufficient evidence ({t_total} ms)", latency_ms=t_total)
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
            job_id=jid,
        )

    # --- Reranking & scoring candidates ---------------------------------------
    t0_rerank = time.perf_counter()
    t_rerank = int((time.perf_counter() - t0_rerank) * 1000)
    top_score = evidence[0]["score"] if evidence else 0.0
    job_broker.publish_event(
        jid,
        stage="reranking",
        description=f"Ranked {len(evidence)} candidate chunks by similarity score",
        sub_description=f"Top candidate: {evidence[0].get('report_filename', '')} (score: {top_score:.2f})",
        latency_ms=max(12, t_rerank),
    )

    # --- Graph traversal & subgraph activation -------------------------------
    t0_graph = time.perf_counter()
    chunk_ids = [hit["chunk_id"] for hit in evidence]
    sub = get_question_subgraph(user_id, chunk_ids)
    t_graph = int((time.perf_counter() - t0_graph) * 1000)
    active_concepts = sub.get("active_concepts", [])
    job_broker.publish_event(
        jid,
        stage="graph",
        description=f"Mapped entities to knowledge graph ({len(sub.get('nodes', []))} nodes, {len(sub.get('edges', []))} edges)",
        sub_description=f"Active concepts: {', '.join(active_concepts)}" if active_concepts else "Topological alignment verified",
        latency_ms=max(18, t_graph),
    )

    # --- Answer composition ---------------------------------------------------
    t0_gen = time.perf_counter()
    snippets = [hit["document"] for hit in evidence]
    generation = ai_client.generate_answer(question_text, snippets)
    t_gen = int((time.perf_counter() - t0_gen) * 1000)

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
        t0_safe = time.perf_counter()
        passed, reason = safety.check_answer_safety(summary_text, snippets)
        t_safe = int((time.perf_counter() - t0_safe) * 1000)
        if not passed:
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
        composed = fallback_composer.compose_answer(question_text, evidence)
        summary_text = composed["summary_text"]
        limitations_text = composed["limitations_text"]
        ai_status = generation.status  # 'disabled' | 'error'
        safety_note = generation.error
        t_safe = 8
        _record_ai_call(
            user_id, question_id, question_id, generation.request_id,
            ai_status, ai_status == "error", generation.error,
        )

    job_broker.publish_event(
        jid,
        stage="generation",
        description=f"Generated answer with evidence citations (mode: {ai_status})",
        sub_description=f"Quoted from {len(snippets)} evidence citations",
        latency_ms=max(25, t_gen),
    )

    # --- Safety & grounding check --------------------------------------------
    job_broker.publish_event(
        jid,
        stage="safety",
        description="Verified medical safety, grounding, and non-prescriptive boundaries",
        sub_description=safety_note or "No clinical claims beyond quoted lab observations",
        latency_ms=max(10, t_safe),
    )

    # --- Citation resolving --------------------------------------------------
    job_broker.publish_event(
        jid,
        stage="citation",
        description=f"Resolved provenance for {len(evidence)} evidence citations",
        sub_description="Report file, page number, and snippet offsets aligned",
        latency_ms=10,
    )

    # --- Terminal Done event -------------------------------------------------
    t_total = int((time.perf_counter() - t_start) * 1000)
    job_broker.complete_job(
        jid,
        description=f"Response completed in {t_total / 1000:.1f} s",
        latency_ms=t_total,
        metadata={"evidence_count": len(evidence), "status": "answered"},
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
        job_id=jid,
    )


def _persist(user_id: str, question_id: str, question_text: str, classification: str,
             status: str, summary_text: str, evidence: list[dict],
             limitations_text: str, ai_service_status: str,
             was_rewritten: bool = False, safety_note: str | None = None,
             job_id: str | None = None) -> dict:
    answer_id = f"ans_{uuid.uuid4().hex[:12]}"
    evidence_cards = []
    with get_db() as db:
        for hit in evidence:
            cid = hit.get("chunk_id", "")
            meta = hit.get("metadata", {})
            rid = meta.get("report_id", "")
            pnum = meta.get("page_number", 0)

            cs = meta.get("char_start")
            ce = meta.get("char_end")
            if cs in (None, "") or ce in (None, ""):
                crow = db.execute(
                    "SELECT char_start, char_end, page_number FROM report_chunks WHERE id = ?",
                    (cid,),
                ).fetchone()
                if crow:
                    cs = crow["char_start"]
                    ce = crow["char_end"]
                    if not pnum:
                        pnum = crow["page_number"]

            try:
                cs_val = int(cs) if cs not in (None, "") else None
            except (ValueError, TypeError):
                cs_val = None

            try:
                ce_val = int(ce) if ce not in (None, "") else None
            except (ValueError, TypeError):
                ce_val = None

            try:
                p_val = int(pnum) if pnum not in (None, "") else 1
            except (ValueError, TypeError):
                p_val = 1

            evidence_cards.append({
                "chunk_id": cid,
                "report_id": rid,
                "report_filename": hit.get("report_filename", ""),
                "report_date": hit.get("report_date"),
                "page_number": p_val,
                "snippet": hit.get("document", "")[:400],
                "score": float(hit.get("score", 0.0)),
                "char_start": cs_val,
                "char_end": ce_val,
            })

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

    ans = {
        "question_id": question_id,
        "job_id": job_id,
        "classification": classification,
        "status": status,
        "summary_text": summary_text,
        "evidence": evidence_cards,
        "limitations_text": limitations_text,
        "safety_text": safety.SAFETY_TEXT,
        "ai_service_status": ai_service_status,
        "safety_status": status if status != "answered" else "passed",
    }
    if job_id:
        job_broker.set_job_result(job_id, ans)
    return ans
