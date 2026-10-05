"""AI Agent service orchestrating safety gates, pool runtime turns, event mapping, and persistence."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import uuid
from typing import Any, AsyncGenerator

from app.agent.lockdown import LockdownViolation
from app.agent.mapper import EventMapper
from app.agent.pool import PoolFull
from app.agent.runtime import RuntimeBusy, RuntimeStartError
from app.core.config import settings
from app.core.database import get_db
from app.generation import safety
from app.services import chat_service, question_service
from app.services.chat_service import MAX_TURN_CHARS, _clean_history, _diagnostic_phrase

logger = logging.getLogger(__name__)


def _redact(text: str) -> str:
    key = settings.effective_api_key
    if key and len(key) >= 8 and key in text:
        return text.replace(key, "***")
    return text


def _get_report_hint(user_id: str, report_id: str | None) -> tuple[str, str] | None:
    if not report_id:
        return None
    try:
        with get_db() as db:
            row = db.execute(
                "SELECT original_filename FROM reports WHERE id = ? AND user_id = ?",
                (report_id, user_id),
            ).fetchone()
        if row and row["original_filename"]:
            return (row["original_filename"], report_id)
    except Exception as exc:
        logger.warning("Report scope lookup failed: %s", exc)
    return None


def build_prompt(
    history_turns: list[dict], cleaned: str, report_hint: tuple[str, str] | None = None
) -> str:
    """Build the prompt sent to the harness."""
    history = _clean_history(history_turns)
    if not history and not report_hint:
        return cleaned

    parts: list[str] = []
    if history:
        parts.append(
            "Earlier in this conversation (context only; the person's reports can only be read through your tools):"
        )
        for turn in history:
            role = "User" if turn.get("role") == "user" else "Assistant"
            parts.append(f"{role}: {turn.get('content', '')}")
        parts.append("")

    if report_hint:
        filename, rep_id = report_hint
        parts.append(
            f"[Scope: the person is asking about the report {filename} (report_id {rep_id}). "
            "Pass that report_id to search_reports and get_measurements.]"
        )
        parts.append("")

    parts.append("Current message from the person:")
    parts.append(cleaned)
    return "\n".join(parts)


def _persist_turn(
    user_id: str, turns: list[dict], final: dict[str, Any], conversation_id: str
) -> str | None:
    try:
        question_id = f"qst_{uuid.uuid4().hex[:12]}"
        status = final.get("status", "answered")
        if status not in ("answered", "refused", "insufficient_evidence"):
            status = "answered"
        ai_status = final.get("ai_status", "ok")
        if status == "answered" and not final.get("safety_passed", True):
            ai_status = "flagged"

        hits = [
            {
                "chunk_id": c.get("chunk_id", ""),
                "document": c.get("snippet", ""),
                "score": c.get("score", 0.0),
                "report_filename": c.get("report_filename", ""),
                "report_date": c.get("report_date"),
                "metadata": {
                    "report_id": c.get("report_id", ""),
                    "page_number": c.get("page_number", 1),
                    "char_start": c.get("char_start"),
                    "char_end": c.get("char_end"),
                },
            }
            for c in final.get("evidence", [])
            if isinstance(c, dict)
        ]

        question_service._record_ai_call(
            user_id,
            question_id,
            question_id,
            f"agent_{uuid.uuid4().hex[:8]}",
            ai_status,
            ai_status == "ok",
            final.get("safety_note"),
        )
        question_service._persist(
            user_id=user_id,
            question_id=question_id,
            question_text=str(turns[-1].get("content", "")),
            classification=final.get("classification", "educational"),
            status=status,
            summary_text=final.get("summary_text", ""),
            evidence=hits,
            limitations_text="",
            ai_service_status=ai_status,
            safety_note=final.get("safety_note"),
            job_id=None,
        )
        return question_id
    except Exception:
        logger.exception("Failed to persist turn")
        return None


async def stream_agent(
    user_id: str,
    turns: list[dict],
    *,
    pool: Any,
    conversation_id: str | None = None,
    report_id: str | None = None,
) -> AsyncGenerator[tuple[str, dict], None]:
    """Stream one agent turn yielding (event_type, payload) tuples."""
    # 1. Validation
    if not turns or turns[-1].get("role") != "user":
        yield (
            "error",
            {
                "status": "error",
                "message": "The last message must come from the user.",
                "diagnostic": "",
            },
        )
        return

    # 2. Context setup
    question = str(turns[-1].get("content", ""))[:MAX_TURN_CHARS]
    classification = safety.classify_question(question)
    conv_id = conversation_id or f"conv_{uuid.uuid4().hex[:12]}"
    mapper: EventMapper | None = None

    def completed(status: str, summary: str, **extra: Any) -> dict:
        ev = mapper.evidence if mapper is not None else []
        return {
            "status": status,
            "summary_text": summary,
            "classification": classification,
            "evidence": ev,
            "evidence_count": len(ev),
            "safety_passed": extra.get("safety_passed", True),
            "safety_note": extra.get("safety_note", None),
            "ai_status": extra.get("ai_status", "ok"),
            "session_title": extra.get("session_title", None),
            "conversation_id": conv_id,
        }

    # 3. Gate (a): clinical boundary refusal
    if safety.needs_boundary_response(classification):
        yield ("text_delta", {"delta": safety.BOUNDARY_RESPONSE})
        final = completed("refused", safety.BOUNDARY_RESPONSE, safety_passed=True, ai_status="not_used")
        yield ("completed", final)
        qid = await asyncio.to_thread(_persist_turn, user_id, turns, final, conv_id)
        yield (
            "done",
            {
                "status": "refused",
                "ai_status": "not_used",
                "evidence_count": 0,
                "question_id": qid,
                "conversation_id": conv_id,
                "session_title": None,
            },
        )
        return

    # 4. Gate (b): prompt injection sanitization
    cleaned, _ = safety.sanitize_question_for_retrieval(question)
    if not cleaned.strip():
        refusal_text = (
            "That message only contained instruction-like text addressed to the system, "
            "which VitaGraph treats as data. Please ask a question about your reports."
        )
        yield ("text_delta", {"delta": refusal_text})
        final = completed("refused", refusal_text, safety_passed=True, ai_status="not_used")
        yield ("completed", final)
        qid = await asyncio.to_thread(_persist_turn, user_id, turns, final, conv_id)
        yield (
            "done",
            {
                "status": "refused",
                "ai_status": "not_used",
                "evidence_count": 0,
                "question_id": qid,
                "conversation_id": conv_id,
                "session_title": None,
            },
        )
        return

    # 5. Gate (d): AI off / offline fallback
    use_ai = settings.allow_api and bool(settings.effective_api_key)
    if not use_ai:
        final_offline: dict[str, Any] | None = None
        async for ev_type, payload in chat_service.stream_chat(
            user_id, turns, report_id=report_id, mode="rag_only"
        ):
            if ev_type == "completed":
                final_offline = payload
                final_offline["conversation_id"] = conv_id
                final_offline.setdefault("session_title", None)
                yield (ev_type, final_offline)
            elif ev_type == "error":
                yield (ev_type, payload)
                return
            else:
                yield (ev_type, payload)

        if final_offline is None:
            yield (
                "error",
                {
                    "status": "error",
                    "message": "The assistant could not finish: offline composition failed.",
                    "diagnostic": "",
                },
            )
            return

        qid = await asyncio.to_thread(_persist_turn, user_id, turns, final_offline, conv_id)
        yield (
            "done",
            {
                "status": final_offline.get("status", "answered"),
                "ai_status": final_offline.get("ai_status", "not_used"),
                "evidence_count": len(final_offline.get("evidence", [])),
                "question_id": qid,
                "conversation_id": conv_id,
                "session_title": final_offline.get("session_title"),
            },
        )
        return

    # 6. AI path setup
    yield ("status", {"phase": "starting", "message": "Starting the AI Agent"})
    n_user_turns = sum(1 for t in turns if t.get("role") == "user")
    session_id = f"{conv_id}-t{n_user_turns}-{uuid.uuid4().hex[:6]}"
    report_hint = _get_report_hint(user_id, report_id)
    prompt = build_prompt(turns[:-1], cleaned, report_hint)

    # 7. EventMapper and streaming loop
    mapper = EventMapper(redact=_redact)
    agen = pool.stream_turn(user_id, session_id, prompt)
    turn_started = False
    try:
        async for msg in agen:
            turn_started = True
            for ev in mapper.feed(msg):
                yield ev
            if mapper.outcome is not None:
                break
    except RuntimeBusy:
        yield (
            "error",
            {
                "status": "error",
                "message": "The AI Agent is still answering your previous message. Wait for it to finish or press Stop.",
                "diagnostic": "",
            },
        )
        return
    except PoolFull:
        yield (
            "error",
            {
                "status": "error",
                "message": "The AI Agent is busy with other people right now. Please try again in a moment.",
                "diagnostic": "",
            },
        )
        return
    except RuntimeStartError as exc:
        yield (
            "error",
            {
                "status": "error",
                "message": "The AI Agent could not start.",
                "diagnostic": _redact(str(exc))[:300],
            },
        )
        return
    except LockdownViolation as exc:
        if mapper.outcome != "error":
            yield (
                "error",
                {
                    "status": "error",
                    "message": "The AI Agent was stopped by a safety check.",
                    "diagnostic": _redact(str(exc))[:300],
                },
            )
        return
    except (asyncio.CancelledError, GeneratorExit):
        if turn_started:
            with contextlib.suppress(Exception):
                await asyncio.shield(pool.cancel(user_id))
        raise
    except Exception as exc:
        logger.exception("Agent stream failed")
        yield (
            "error",
            {
                "status": "error",
                "message": "The AI Agent could not finish this answer.",
                "diagnostic": _redact(str(exc))[:300],
            },
        )
        return
    finally:
        with contextlib.suppress(Exception):
            await agen.aclose()

    # 8. Post-stream checks
    if mapper.outcome == "error":
        return
    if mapper.outcome is None:
        yield (
            "error",
            {
                "status": "error",
                "message": "The AI Agent stopped without an answer.",
                "diagnostic": "",
            },
        )
        return

    text = mapper.answer_text.strip()
    if not text:
        yield (
            "error",
            {
                "status": "error",
                "message": "The AI Agent returned no answer.",
                "diagnostic": "Empty completion.",
            },
        )
        return

    phrase = _diagnostic_phrase(text)
    yield ("stats", mapper.stats())
    final_ai = completed(
        "answered",
        text,
        ai_status="ok",
        safety_passed=(phrase is None),
        safety_note=(f"Safety check: answer contains diagnostic phrasing ('{phrase}')." if phrase else None),
        session_title=mapper.title,
    )
    yield ("completed", final_ai)

    # 9. Persistence
    qid = await asyncio.to_thread(_persist_turn, user_id, turns, final_ai, conv_id)
    yield (
        "done",
        {
            "status": final_ai["status"],
            "ai_status": final_ai.get("ai_status", "ok"),
            "evidence_count": len(final_ai.get("evidence", [])),
            "question_id": qid,
            "conversation_id": conv_id,
            "session_title": final_ai.get("session_title"),
        },
    )
