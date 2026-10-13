"""RAG Lab runner: a real quick run on the sample PDFs in the temporary database (loads the embedding model once)."""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.database import get_db
from app.lab import gold, metrics, runner
from app.rag import vector_store
from app.services import user_service

from tests.conftest import make_user


async def _collect(run) -> list[tuple[str, dict]]:
    return [item async for item in runner.follow(run)]


def _lab_rows() -> int:
    with get_db() as db:
        return db.execute("SELECT COUNT(*) AS c FROM users WHERE status = 'lab'").fetchone()["c"]


async def _quick_run_with_observer(chunk_size: int = 200, top_k: int = 5):
    """Start a quick run, poll the persona list while it runs, return (run, events, ids seen by the observer)."""
    run = runner.start_run("quick", chunk_size, top_k)
    seen_lab_in_list = False
    lab_rows_during = 0

    async def observe():
        nonlocal seen_lab_in_list, lab_rows_during
        while not run.done:
            labels = [u["display_label"] for u in await asyncio.to_thread(user_service.list_users)]
            if runner.LAB_LABEL in labels:
                seen_lab_in_list = True
            lab_rows_during = max(lab_rows_during, await asyncio.to_thread(_lab_rows))
            await asyncio.sleep(0.05)

    watcher = asyncio.create_task(observe())
    events = await _collect(run)
    await run.task
    await watcher
    return run, events, seen_lab_in_list, lab_rows_during


@pytest.fixture(scope="module")
def quick():
    keeper = make_user("Lab test bystander")  # a real persona must be untouched by a lab run
    users_before = [u["id"] for u in user_service.list_users()]
    chroma_before = vector_store.collection_count()
    result = asyncio.run(_quick_run_with_observer())
    return {
        "run": result[0], "events": result[1], "seen_in_list": result[2], "lab_rows_during": result[3],
        "users_before": users_before, "chroma_before": chroma_before, "keeper": keeper["id"],
    }


def test_event_order_and_shape(quick):
    types = [t for t, _ in quick["events"]]
    assert types[0] == "setup" and quick["events"][0][1]["phase"] == "start"
    assert types[-1] == "run_finished" and quick["events"][-1][1]["status"] == "finished"
    assert types.index("privacy_check") < types.index("scorecard") < types.index("run_finished")
    ingests = [p for t, p in quick["events"] if t == "setup" and p["phase"] == "ingest"]
    assert [p["file"] for p in ingests] == gold.file_names()
    assert all(p["chunks"] > 0 for p in ingests)
    q_ids = [q["id"] for q in gold.questions()]
    started = [p["id"] for t, p in quick["events"] if t == "question_started"]
    finished = [p["id"] for t, p in quick["events"] if t == "question_finished"]
    assert started == q_ids and finished == q_ids
    for q in gold.questions():
        kinds = [t for t, p in quick["events"] if p.get("id") == q["id"]]
        assert kinds[0] == "question_started" and kinds[-1] == "question_finished"
        assert "gate" in kinds
        assert ("retrieval" in kinds) == (q["expect"] != "refuse")
        assert "answer" not in kinds  # quick mode never calls the AI


def test_scorecard_keys_and_ranges(quick):
    card = next(p for t, p in quick["events"] if t == "scorecard")
    assert set(card) == set(metrics.SCORECARD_KEYS)
    assert card["questions_total"] == len(gold.questions())
    assert card["passed"] + card["failed"] == card["questions_total"]
    for key in ("retrieval_hit_rate", "evidence_recall", "mrr", "context_precision"):
        assert 0.0 <= card[key] <= 1.0
    assert card["retrieval_ms_avg"] > 0 and card["duration_ms"] > 0
    assert card["identifier_leaks"] == 0
    for key in ("answer_accuracy", "citation_correctness", "grounded_rate", "avg_answer_s", "max_answer_s",
                "safety_passed_rate"):
        assert card[key] is None


def test_scorecard_matches_the_saved_run(quick):
    live = next(p for t, p in quick["events"] if t == "scorecard")
    saved = runner.get_saved_run(quick["run"].id)
    assert saved["status"] == "finished" and saved["mode"] == "quick" and saved["chunk_size"] == 200
    assert saved["scorecard"] == live
    assert len(saved["results"]) == len(gold.questions())
    assert any(r["id"] == "q01" and r["checks"] for r in saved["results"])
    assert quick["run"].id in [r["id"] for r in runner.list_saved_runs()]


def test_the_refusal_gates_work_on_the_gold_set(quick):
    gates = {p["id"]: p for t, p in quick["events"] if t == "gate"}
    for q in gold.questions():
        assert gates[q["id"]]["pass"], q["id"]


def test_privacy_check_reports_zero_leaks(quick):
    check = next(p for t, p in quick["events"] if t == "privacy_check")
    assert check["leaks"] == 0 and check["pass"] and check["chunks_checked"] > 0
    assert "Demo Persona A" in check["identifiers"]


def test_lab_persona_is_hidden_while_running_and_gone_afterwards(quick):
    assert quick["lab_rows_during"] == 1  # the persona really existed while the run was going...
    assert not quick["seen_in_list"]  # ...and /api/users never listed it
    assert _lab_rows() == 0
    assert [u["id"] for u in user_service.list_users()] == quick["users_before"]
    assert quick["keeper"] in quick["users_before"]
    assert vector_store.collection_count() == quick["chroma_before"]


def test_late_subscriber_gets_the_whole_run_replayed(quick):
    replay = asyncio.run(_collect(quick["run"]))
    assert replay == quick["events"]


def test_one_row_saved_per_run(quick):
    with get_db() as db:
        n = db.execute("SELECT COUNT(*) AS c FROM lab_runs WHERE id = ?", (quick["run"].id,)).fetchone()["c"]
    assert n == 1


def test_active_run_is_cleared_after_the_run(quick):
    assert runner.active_run_id() is None


def test_full_mode_with_ai_off_is_refused(monkeypatch):
    monkeypatch.setattr(settings, "allow_api", False)

    async def go():
        runner.start_run("full", 200, 5)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(go())
    assert exc.value.status_code == 409 and "AI switched on" in exc.value.detail


def test_a_second_start_while_running_is_refused_and_cancel_cleans_up():
    chroma_before = vector_store.collection_count()
    users_before = [u["id"] for u in user_service.list_users()]

    async def go():
        run = runner.start_run("quick", 200, 5)
        with pytest.raises(HTTPException) as exc:
            runner.start_run("quick", 200, 5)
        assert exc.value.status_code == 409 and "already running" in exc.value.detail
        assert runner.active_run_id() == run.id
        # Wait for real work to be under way (the persona is created and the first file is being read)
        for _ in range(400):
            if _lab_rows() == 1:
                break
            await asyncio.sleep(0.02)
        assert runner.cancel_run(run) is True
        assert runner.cancel_run(run) is False  # a second cancel does nothing
        events = await _collect(run)
        await run.task
        return run, events

    run, events = asyncio.run(go())
    assert events[-1][0] == "run_finished" and events[-1][1]["status"] == "stopped"
    assert "scorecard" not in [t for t, _ in events]
    assert _lab_rows() == 0
    assert [u["id"] for u in user_service.list_users()] == users_before
    assert vector_store.collection_count() == chroma_before
    saved = runner.get_saved_run(run.id)
    assert saved["status"] == "stopped" and saved["scorecard"] is None
    assert runner.active_run_id() is None


def test_a_failing_run_reports_error_and_still_cleans_up(monkeypatch):
    def broken(lab_id, name, chunk_size):
        raise RuntimeError("disk exploded")

    monkeypatch.setattr(runner, "_ingest", broken)

    async def go():
        run = runner.start_run("quick", 200, 5)
        events = await _collect(run)
        await run.task
        return run, events

    run, events = asyncio.run(go())
    assert events[-1][0] == "error" and "disk exploded" in events[-1][1]["message"]
    assert _lab_rows() == 0
    assert runner.get_saved_run(run.id)["status"] == "failed"


def test_full_mode_grades_answers_from_a_fake_agent(monkeypatch):
    monkeypatch.setattr(settings, "allow_api", True)
    monkeypatch.setattr(type(settings), "effective_api_key", property(lambda self: "k"))
    asked: list[str] = []

    async def fake_stream_agent(user_id, turns, *, pool, **_):
        q = turns[-1]["content"]
        asked.append(q)
        if "vitamin D" in q:
            ev = [{"report_filename": "synthetic_panel_2025-01-15.pdf", "chunk_id": "c1"},
                  {"report_filename": "synthetic_panel_2025-06-20.pdf", "chunk_id": "c2"}]
            yield ("completed", {"status": "answered", "summary_text": "Your vitamin D was 18 ng/mL.",
                                 "evidence": ev, "safety_passed": True})
        elif "ferritin" in q:
            yield ("completed", {"status": "answered", "summary_text": "I could not find ferritin in your reports.",
                                 "evidence": [], "safety_passed": True})
        elif "diagnose" in q or "statins" in q or "Ignore all" in q:
            yield ("completed", {"status": "refused", "summary_text": "I cannot help with that.",
                                 "evidence": [], "safety_passed": True})
        else:
            yield ("completed", {"status": "answered", "summary_text": "Something vague.",
                                 "evidence": [], "safety_passed": True})
        yield ("done", {"status": "answered"})

    class FakePool:
        async def forget_persona(self, _):
            return None

    monkeypatch.setattr(runner.agent_service, "stream_agent", fake_stream_agent)
    monkeypatch.setattr(runner, "get_pool", lambda: FakePool())

    async def go():
        run = runner.start_run("full", 300, 5)
        events = await _collect(run)
        await run.task
        return events

    events = asyncio.run(go())
    assert len(asked) == len(gold.questions())  # every question, including refusals, goes through the agent's gates
    answers = {p["id"]: p for t, p in events if t == "answer"}
    assert answers["q01"]["correct"] and answers["q01"]["cited_files"] == [
        "synthetic_panel_2025-01-15.pdf", "synthetic_panel_2025-06-20.pdf"]
    assert answers["q08"]["correct"]  # not-found phrase, no number
    assert answers["q09"]["correct"] and answers["q09"]["status"] == "refused"
    assert not answers["q02"]["correct"]  # the fake gave a vague answer
    card = next(p for t, p in events if t == "scorecard")
    assert card["answer_accuracy"] is not None and card["citation_correctness"] == 0.5
    assert card["avg_answer_s"] is not None and card["safety_passed_rate"] == 1.0
    finished = {p["id"]: p for t, p in events if t == "question_finished"}
    assert not finished["q02"]["pass"]
    assert json.dumps(card)  # serialisable
    assert _lab_rows() == 0


def test_startup_cleanup_removes_leftover_lab_personas():
    leftover = user_service.create_user("RAG Lab run (temporary)")
    user_service.mark_lab(leftover["id"])
    assert leftover["id"] in user_service.lab_user_ids()
    assert runner.cleanup_leftover_personas() >= 1
    assert user_service.lab_user_ids() == []
