"""RAG Lab runner: grades the real product pipeline on the gold set, live, and cleans up after itself.

One run at a time. Every event is real: each file is really ingested, each question really retrieves (and in full
mode really goes through the AI Agent). The run uses a temporary persona (status 'lab', never listed) that is deleted
in `finally`, together with its reports, chunks, vectors, files and ledger rows, whatever happens.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import HTTPException

from app.agent.pool import get_pool
from app.core.config import settings
from app.core.database import get_db
from app.lab import gold, metrics
from app.rag import retriever
from app.services import agent_service, report_service, user_service

logger = logging.getLogger(__name__)

MAX_RUNS_KEPT = 5
QUESTION_TIMEOUT_S = 150.0
SNIPPET_CHARS = 160
ANSWER_CHARS = 1500
LAB_LABEL = "RAG Lab run (temporary)"


class LabRun:
    def __init__(self, mode: str, chunk_size: int, top_k: int) -> None:
        self.id = f"lab_{uuid.uuid4().hex[:12]}"
        self.mode = mode
        self.chunk_size = chunk_size
        self.top_k = top_k
        self.created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        self.events: list[tuple[str, dict]] = []
        self.done = False
        self.status = "running"  # running | finished | stopped | failed
        self.task: asyncio.Task | None = None
        self.cancel_requested = False
        self.lab_id: str | None = None
        self._subscribers: set[asyncio.Queue] = set()
        self._inflight: list[asyncio.Future] = []

    def emit(self, event_type: str, payload: dict) -> None:
        self.events.append((event_type, payload))
        for queue in self._subscribers:
            queue.put_nowait((event_type, payload))

    def close(self) -> None:
        self.done = True
        for queue in self._subscribers:
            queue.put_nowait(None)


_RUNS: dict[str, LabRun] = {}
_active: LabRun | None = None


def get_run(run_id: str) -> LabRun | None:
    return _RUNS.get(run_id)


def active_run_id() -> str | None:
    return _active.id if _active is not None and not _active.done else None


async def follow(run: LabRun) -> AsyncIterator[tuple[str, dict]]:
    """Replay every event so far, then yield new ones until the run ends. Safe for late or repeated subscribers."""
    queue: asyncio.Queue = asyncio.Queue()
    past = list(run.events)
    finished = run.done
    if not finished:
        run._subscribers.add(queue)  # no await between the snapshot and the subscription: nothing is missed
    try:
        for item in past:
            yield item
        if finished:
            return
        while True:
            item = await queue.get()
            if item is None:
                return
            yield item
    finally:
        run._subscribers.discard(queue)


# --- Start / cancel ------------------------------------------------------------------------------------------

def start_run(mode: str, chunk_size: int, top_k: int) -> LabRun:
    """Validate and start a run. Raises 409 when another run is active or full mode has no AI."""
    global _active
    if _active is not None and not _active.done:
        raise HTTPException(status_code=409, detail="A lab run is already running.")
    if mode == "full" and not (settings.allow_api and settings.effective_api_key):
        raise HTTPException(status_code=409, detail="Full mode needs the AI switched on in Settings.")
    run = LabRun(mode, chunk_size, top_k)
    _RUNS[run.id] = run
    while len(_RUNS) > MAX_RUNS_KEPT:
        oldest = next(iter(_RUNS))
        if _RUNS[oldest] is run or not _RUNS[oldest].done:
            break
        del _RUNS[oldest]
    _active = run
    run.task = asyncio.create_task(_execute(run))
    return run


def cancel_run(run: LabRun) -> bool:
    """Ask a running run to stop. The run cleans up and ends with run_finished (status 'stopped')."""
    if run.done or run.cancel_requested or run.task is None:
        return False
    run.cancel_requested = True
    run.task.cancel()
    return True


# --- Execution -----------------------------------------------------------------------------------------------

async def _blocking(run: LabRun, func, *args):
    """Run blocking work in a thread. If the run is cancelled meanwhile, the thread is still awaited in `finally`
    before the persona is deleted, so cleanup never races with ingestion."""
    future = asyncio.ensure_future(asyncio.to_thread(func, *args))
    run._inflight.append(future)
    return await asyncio.shield(future)


def _create_lab_persona(run: LabRun) -> str:
    """Create the temporary persona and remember it on the run at once, so cleanup finds it even if the run is
    cancelled while this thread is still working."""
    user = user_service.create_user(LAB_LABEL)
    run.lab_id = user["id"]
    user_service.mark_lab(user["id"])
    user_service.accept_consent(user["id"])
    return user["id"]


def _ingest(lab_id: str, name: str, chunk_size: int) -> dict:
    result = report_service.process_upload(lab_id, name, gold.read_sample(name), None, chunk_size)
    if result.get("status") == "failed":
        raise RuntimeError(f"Could not read {name}: {result.get('error_message') or 'unknown error'}")
    return result


def _retrieve(lab_id: str, question: str, top_k: int) -> tuple[list[dict], int]:
    t = time.perf_counter()
    raw = retriever.retrieve(lab_id, question, top_k=top_k)
    ms = int((time.perf_counter() - t) * 1000)
    hits = [
        {
            "file": h.get("report_filename", ""),
            "page": h["metadata"].get("page_number"),
            "score": h["score"],
            "text": h["document"],
        }
        for h in raw
    ]
    return hits, ms


def _lab_chunk_texts(lab_id: str) -> list[str]:
    with get_db() as db:
        return [r["text"] for r in db.execute("SELECT text FROM report_chunks WHERE user_id = ?", (lab_id,))]


def _ledger_texts(lab_id: str) -> list[str]:
    """Everything the privacy shield recorded as sent for this run (empty when the shield recorded nothing)."""
    try:
        with get_db() as db:
            return [r["sent_text"] for r in db.execute("SELECT sent_text FROM privacy_ledger WHERE user_id = ?", (lab_id,))]
    except Exception:
        return []


def _leak_check(lab_id: str, identifiers: list[str], full: bool) -> dict:
    """Mask every chunk of the lab persona with the privacy redactor, as the shield does before sending, and count
    identifiers that are still readable. In full mode the shield's own record of what was sent is checked too."""
    from app.privacy import redactor

    chunks = _lab_chunk_texts(lab_id)
    vault = redactor.Vault()
    for text in chunks:
        redactor.learn_labelled(text, vault)
    masked = [redactor.redact_text(text, vault).masked for text in chunks]
    leaks = metrics.count_leaks(masked, identifiers)
    ledger = _ledger_texts(lab_id) if full else []
    ledger_leaks = metrics.count_leaks(ledger, identifiers)
    return {
        "identifiers": identifiers,
        "chunks_checked": len(chunks),
        "ledger_records_checked": len(ledger),
        "leaks": leaks + ledger_leaks,
        "pass": (leaks + ledger_leaks) == 0,
    }


def _hit_view(rank: int, hit: dict, relevant: bool) -> dict:
    text = " ".join(hit["text"].split())
    return {
        "rank": rank,
        "file": hit["file"],
        "page": hit["page"],
        "score": hit["score"],
        "snippet": text[:SNIPPET_CHARS],
        "relevant": relevant,
    }


async def _ask_agent(lab_id: str, question: str) -> dict:
    """Run one question through the real AI Agent and return what the browser would have seen at the end."""
    completed: dict | None = None
    error: str | None = None
    text_parts: list[str] = []

    async def consume() -> None:
        nonlocal completed, error
        agen = agent_service.stream_agent(lab_id, [{"role": "user", "content": question}], pool=get_pool())
        try:
            async for event_type, payload in agen:
                if event_type == "text_delta":
                    text_parts.append(payload.get("delta", ""))
                elif event_type == "completed":
                    completed = payload
                elif event_type == "error":
                    error = payload.get("message") or "The AI Agent reported an error."
        finally:
            await agen.aclose()

    t = time.perf_counter()
    try:
        await asyncio.wait_for(consume(), timeout=QUESTION_TIMEOUT_S)
    except asyncio.TimeoutError:
        error = "The AI Agent did not answer in time."
    seconds = time.perf_counter() - t
    evidence = (completed or {}).get("evidence") or []
    cited = [
        str(c.get("report_filename") or c.get("filename") or c.get("file") or "")
        for c in evidence
        if isinstance(c, dict)
    ]
    if completed:
        text = completed.get("summary_text") or "".join(text_parts)
        status = completed.get("status", "answered")
    else:
        text, status = "".join(text_parts), "error"
    return {
        "status": status,
        "text": text,
        "cited_files": [c for c in cited if c],
        "safety_passed": bool((completed or {}).get("safety_passed", False)) if completed else False,
        "seconds": round(seconds, 2),
        "error": error,
    }


def _check(name: str, ok: bool, detail: str) -> dict:
    return {"name": name, "pass": bool(ok), "detail": detail}


async def _grade_question(run: LabRun, lab_id: str, spec: dict, index: int, total: int) -> dict:
    full = run.mode == "full"
    expect = spec["expect"]
    run.emit("question_started", {"id": spec["id"], "index": index, "total": total,
                                  "question": spec["question"], "expect": expect})
    checks: list[dict] = []
    result: dict = {"id": spec["id"], "question": spec["question"], "expect": expect,
                    "retrieval": None, "answer": None}

    # Gate: what the product's own safety gates do with this question, no model involved.
    refused = metrics.gate_refused(spec["question"])
    gate_ok = refused == (expect == "refuse")
    result["gate"] = {"refused": refused, "pass": gate_ok}
    checks.append(_check("gate", gate_ok, "Refused" if refused else "Answered"))
    run.emit("gate", {"id": spec["id"], "refused": refused, "expected_refused": expect == "refuse", "pass": gate_ok})

    # Retrieval: the real product retrieval, including its minimum evidence score.
    if expect != "refuse":
        hits, ms = await _blocking(run, _retrieve, lab_id, spec["question"], run.top_k)
        if expect == "answer":
            m = metrics.retrieval_metrics(spec, hits)
            m["ms"] = ms
            result["retrieval"] = m
            checks.append(_check(
                "retrieval", m["hit"],
                "Found: " + (", ".join(m["found_terms"]) or "none") + " · Missing: " + (", ".join(m["missing_terms"]) or "none"),
            ))
            run.emit("retrieval", {
                "id": spec["id"],
                "hits": [_hit_view(i + 1, h, m["relevant_flags"][i]) for i, h in enumerate(hits)],
                "found_terms": m["found_terms"], "missing_terms": m["missing_terms"],
                "first_relevant_rank": m["first_relevant_rank"], "ms": ms, "pass": m["hit"],
            })
        else:
            ok, seen = metrics.not_found_retrieval_ok(spec, hits)
            result["retrieval"] = {"ms": ms, "ok": ok, "seen_forbidden": seen}
            checks.append(_check("retrieval", ok, "Nothing about it in the reports" if ok else "Found: " + ", ".join(seen)))
            run.emit("retrieval", {
                "id": spec["id"],
                "hits": [_hit_view(i + 1, h, False) for i, h in enumerate(hits)],
                "found_terms": seen, "missing_terms": [],
                "first_relevant_rank": None, "ms": ms, "pass": ok,
            })

    # Answer (full mode only): the real AI Agent.
    if full:
        ans = await _ask_agent(lab_id, spec["question"])
        cited_good, cited_total = metrics.cited_file_stats(spec, ans["cited_files"])
        a_refused = ans["status"] == "refused"
        if expect == "refuse":
            correct = a_refused
            detail = "Refused" if a_refused else f"Answered instead ({ans['status']})"
        elif expect == "answer":
            terms_ok, missing = metrics.answer_terms_ok(spec, ans["text"])
            correct = terms_ok and not a_refused and ans["status"] != "error"
            detail = "All expected values present" if correct else (
                "Missing: " + ", ".join(missing) if missing else f"Status {ans['status']}")
        else:
            correct = (not a_refused) and ans["status"] != "error" and metrics.not_found_answer_ok(spec, ans["text"])
            detail = "Admitted the gap" if correct else "Did not clearly say it is not in the reports"
        ans.update(correct=correct, cited_good=cited_good, cited_total=cited_total, refused=a_refused)
        result["answer"] = ans
        checks.append(_check("answer", correct, detail))
        if expect == "answer":
            checks.append(_check("citations", cited_total > 0 and cited_good > 0,
                                 f"{cited_good} of {cited_total} cited passages from the expected files"))
        run.emit("answer", {
            "id": spec["id"], "status": ans["status"], "text": ans["text"][:ANSWER_CHARS],
            "cited_files": sorted(set(ans["cited_files"])), "safety_passed": ans["safety_passed"],
            "seconds": ans["seconds"], "correct": correct,
        })

    result["checks"] = checks
    result["pass"] = all(c["pass"] for c in checks)
    run.emit("question_finished", {"id": spec["id"], "pass": result["pass"], "checks": checks,
                                   "index": index, "total": total})
    return result


async def _cleanup_persona(lab_id: str, full: bool) -> None:
    if full:
        with contextlib.suppress(Exception):
            await get_pool().forget_persona(lab_id)
    try:
        await asyncio.to_thread(user_service.delete_user, lab_id)
    except Exception:
        logger.exception("Could not delete the RAG Lab persona %s", lab_id)


def _save_run(run: LabRun, status: str, scorecard: dict | None, results: list[dict], duration_ms: int) -> None:
    try:
        with get_db() as db:
            db.execute(
                "INSERT INTO lab_runs (id, created_at, mode, chunk_size, top_k, status, scorecard_json, results_json, duration_ms) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (run.id, run.created_at, run.mode, run.chunk_size, run.top_k, status,
                 json.dumps(scorecard) if scorecard else None,
                 json.dumps(results, ensure_ascii=False) if results else None, duration_ms),
            )
    except Exception:
        logger.exception("Could not save lab run %s", run.id)


async def _execute(run: LabRun) -> None:
    global _active
    started = time.perf_counter()
    full = run.mode == "full"
    lab_id: str | None = None
    results: list[dict] = []
    scorecard: dict | None = None
    error_message: str | None = None
    status = "finished"
    try:
        data = gold.load_gold()
        questions = gold.questions()
        files = data["files"]
        run.emit("setup", {"phase": "start", "run_id": run.id, "mode": run.mode, "chunk_size": run.chunk_size,
                           "top_k": run.top_k, "files": len(files), "questions": len(questions)})
        lab_id = await _blocking(run, _create_lab_persona, run)

        for i, f in enumerate(files, start=1):
            t = time.perf_counter()
            res = await _blocking(run, _ingest, lab_id, f["name"], run.chunk_size)
            run.emit("setup", {"phase": "ingest", "file": f["name"], "index": i, "total": len(files),
                               "chunks": res.get("chunk_count", 0), "pages": res.get("page_count", 0),
                               "ms": int((time.perf_counter() - t) * 1000)})

        for i, spec in enumerate(questions, start=1):
            results.append(await _grade_question(run, lab_id, spec, i, len(questions)))

        check = await _blocking(run, _leak_check, lab_id, list(data["identifiers"]), full)
        run.emit("privacy_check", check)
        scorecard = metrics.build_scorecard(
            results, identifier_leaks=check["leaks"],
            duration_ms=int((time.perf_counter() - started) * 1000), full=full)
        if check["leaks"]:
            # A leak is a failure of the run's privacy promise even though no single question owns it.
            logger.warning("RAG Lab run %s found %d identifier leaks", run.id, check["leaks"])
        run.emit("scorecard", scorecard)
    except asyncio.CancelledError:
        status = "stopped"
    except Exception as exc:  # the run reports it and still cleans up
        logger.exception("RAG Lab run %s failed", run.id)
        status = "failed"
        error_message = str(exc) or exc.__class__.__name__
    finally:
        # Never cancelled again from here on: wait for threads still working on the persona, then delete it.
        with contextlib.suppress(BaseException):
            await asyncio.gather(*run._inflight, return_exceptions=True)
        if run.lab_id:
            await _cleanup_persona(run.lab_id, full)
        duration_ms = int((time.perf_counter() - started) * 1000)
        run.status = status
        _save_run(run, status, scorecard, [_public_result(r) for r in results], duration_ms)
        if status == "failed":
            run.emit("error", {"message": f"The lab run could not finish: {error_message}", "diagnostic": ""})
        else:
            run.emit("run_finished", {"run_id": run.id, "ms": duration_ms, "status": status})
        run.close()
        if _active is run:
            _active = None


def _public_result(r: dict) -> dict:
    """The per-question result as it is saved: the pass/fail, the checks and the key numbers, without full chunk text."""
    out = {k: r[k] for k in ("id", "question", "expect", "pass", "checks", "gate")}
    ret = r.get("retrieval")
    if ret:
        out["retrieval"] = {k: v for k, v in ret.items() if k != "relevant_flags"}
    ans = r.get("answer")
    if ans:
        out["answer"] = {**ans, "text": ans["text"][:ANSWER_CHARS]}
    return out


# --- Saved runs and start-up cleanup ----------------------------------------------------------------------

def list_saved_runs(limit: int = 50) -> list[dict]:
    with get_db() as db:
        rows = db.execute("SELECT * FROM lab_runs ORDER BY created_at DESC, rowid DESC LIMIT ?", (limit,)).fetchall()
    return [_row_to_summary(dict(r)) for r in rows]


def get_saved_run(run_id: str) -> dict | None:
    with get_db() as db:
        row = db.execute("SELECT * FROM lab_runs WHERE id = ?", (run_id,)).fetchone()
    if row is None:
        return None
    out = _row_to_summary(dict(row))
    out["results"] = json.loads(row["results_json"]) if row["results_json"] else []
    return out


def _row_to_summary(row: dict) -> dict:
    return {
        "id": row["id"], "created_at": row["created_at"], "mode": row["mode"], "chunk_size": row["chunk_size"],
        "top_k": row["top_k"], "status": row["status"], "duration_ms": row["duration_ms"],
        "scorecard": json.loads(row["scorecard_json"]) if row["scorecard_json"] else None,
    }


def cleanup_leftover_personas() -> int:
    """Delete lab personas a crash may have left behind (start-up). Returns how many were removed."""
    removed = 0
    for lab_id in user_service.lab_user_ids():
        try:
            user_service.delete_user(lab_id)
            removed += 1
        except Exception:
            logger.exception("Could not remove leftover lab persona %s", lab_id)
    return removed
