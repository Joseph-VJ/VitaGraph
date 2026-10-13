"""Agent runs that outlive the browser: background run, re-attach, stop, active list, busy, error turns."""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

import app.routes.agent as agent_route
from app.agent.pool import get_pool
from app.agent.runs import get_registry, reset_registry
from app.agent.runtime import RuntimeStartError
from app.main import app
from app.schemas.agent import AgentRequest
from app.services import agent_service, conversation_service
from tests.conftest import make_user
from tests.test_agent_service import FakePool, _enable_ai, notif, result_msg

BUSY = "The AI Agent is still answering your previous message. Wait for it to finish or press Stop."


@pytest.fixture(autouse=True)
def _fresh_registry():
    reset_registry()
    yield
    reset_registry()


class GatePool:
    """Plays its messages, but waits for `gate` before message number `gate_after` (a slow answer)."""

    def __init__(self, messages, gate_after):
        self.messages = messages
        self.gate_after = gate_after
        self.gate = asyncio.Event()
        self.cancelled: list[str] = []
        self.calls = 0

    async def stream_turn(self, persona_id, session_id, text):
        self.calls += 1
        for i, msg in enumerate(self.messages):
            if i == self.gate_after:
                await self.gate.wait()
            yield msg

    async def cancel(self, persona_id):
        self.cancelled.append(persona_id)


def _answer_messages(text="Hemoglobin is normal."):
    return [
        notif("turn/start", {"turn": 1}),
        notif("step/start", {"turn": 1, "step": 1}),
        notif("assistant/message", {
            "turn": 1, "step": 1,
            "message": {"id": "m1", "role": "assistant", "content": [{"type": "text", "text": text}]},
        }),
        notif("step/end", {"turn": 1, "step": 1}),
        notif("turn/end", {"turn": 1}),
        result_msg(text),
    ]


def _request(user_id, question, conv):
    return AgentRequest(user_id=user_id, messages=[{"role": "user", "content": question}], conversation_id=conv)


def _parse(text: str) -> list[tuple[str, dict]]:
    out = []
    for block in text.strip().split("\n\n"):
        lines = block.strip().split("\n")
        ev = next((l for l in lines if l.startswith("event: ")), None)
        data = next((l for l in lines if l.startswith("data: ")), None)
        if ev and data:
            out.append((ev[len("event: "):], json.loads(data[len("data: "):])))
    return out


async def _drain(body_iterator) -> list[str]:
    return [chunk async for chunk in body_iterator]


async def _until(predicate, timeout=5.0):
    async def _poll():
        while not predicate():
            await asyncio.sleep(0.01)

    await asyncio.wait_for(_poll(), timeout)


def _conversation(user_id, conv):
    return conversation_service.get_conversation(user_id, conv)


def test_the_first_frame_after_connected_is_the_run_event(monkeypatch):
    _enable_ai(monkeypatch)
    user = make_user("Runs First Frame")
    pool = FakePool(_answer_messages())

    async def scenario():
        resp = await agent_route.agent_stream(_request(user["id"], "Check my hb", "conv_runs_first"), pool)
        return await _drain(resp.body_iterator)

    chunks = asyncio.run(scenario())
    assert chunks[0] == ": connected to agent stream\n\n"
    frames = _parse("".join(chunks))
    assert frames[0][0] == "run"
    assert frames[0][1]["index"] == "01"
    meta = frames[0][1]["metadata"]
    assert meta["conversation_id"] == "conv_runs_first"
    assert isinstance(meta["started_at"], int) and meta["started_at"] > 1_600_000_000_000
    assert frames[-1][1]["stage"] == "done"
    assert [int(d["index"]) for _, d in frames] == list(range(1, len(frames) + 1))


def test_the_run_continues_and_is_saved_after_the_client_disconnects(monkeypatch):
    _enable_ai(monkeypatch)
    user = make_user("Runs Survive Disconnect")
    uid, conv = user["id"], "conv_runs_survive"
    pool = GatePool(_answer_messages("The value is fine."), gate_after=3)

    async def scenario():
        resp = await agent_route.agent_stream(_request(uid, "Check my hb", conv), pool)
        body = resp.body_iterator
        assert await body.__anext__() == ": connected to agent stream\n\n"
        assert (await body.__anext__()).startswith("event: run")
        await body.aclose()  # the browser goes away
        run = get_registry().get(uid, conv)
        assert run is not None and run.running
        assert not pool.cancelled  # a disconnect never cancels the runtime
        # The question is already in History while the answer is being written.
        early = _conversation(uid, conv)
        assert [m["role"] for m in early["messages"]] == ["user"]
        pool.gate.set()
        await asyncio.wait_for(asyncio.shield(run.task), 5)
        return run

    run = asyncio.run(scenario())
    assert run.status == "done"
    assert pool.cancelled == []
    saved = _conversation(uid, conv)
    assert [m["role"] for m in saved["messages"]] == ["user", "assistant"]
    assert saved["messages"][1]["status"] == "answered"
    assert saved["messages"][1]["content"] == "The value is fine."


def test_a_second_subscriber_can_follow_the_same_run(monkeypatch):
    _enable_ai(monkeypatch)
    user = make_user("Runs Two Followers")
    uid, conv = user["id"], "conv_runs_two"
    pool = GatePool(_answer_messages(), gate_after=3)

    async def scenario():
        reg = get_registry()
        resp = await agent_route.agent_stream(_request(uid, "Check my hb", conv), pool)
        first = asyncio.ensure_future(_drain(resp.body_iterator))
        await asyncio.sleep(0.05)
        second = asyncio.ensure_future(_drain(reg.subscribe(reg.get(uid, conv), 0, 15)))
        await asyncio.sleep(0.05)
        pool.gate.set()
        return await first, await second

    a, b = asyncio.run(scenario())
    assert [d["index"] for _, d in _parse("".join(a))] == [d["index"] for _, d in _parse("".join(b))]
    assert _parse("".join(b))[-1][1]["stage"] == "done"


def test_re_attaching_replays_only_the_frames_after_the_given_index(monkeypatch):
    _enable_ai(monkeypatch)
    user = make_user("Runs Reattach")
    uid, conv = user["id"], "conv_runs_reattach"
    pool = FakePool(_answer_messages())
    app.dependency_overrides[get_pool] = lambda: pool
    try:
        with TestClient(app) as c:
            res = c.post(
                "/api/agent/stream",
                json={"user_id": uid, "conversation_id": conv, "messages": [{"role": "user", "content": "Check my hb"}]},
            )
            full = _parse(res.text)
            assert len(full) > 3
            replay = c.get(f"/api/agent/runs/{conv}/events", params={"user_id": uid, "after": 3})
            assert replay.status_code == 200
            assert replay.text.startswith(": connected to agent stream")
            frames = _parse(replay.text)
            assert [int(d["index"]) for _, d in frames] == list(range(4, len(full) + 1))
            assert frames[-1][1]["stage"] == "done"
            # after=0 (default) replays everything, including the run frame
            everything = _parse(c.get(f"/api/agent/runs/{conv}/events", params={"user_id": uid}).text)
            assert everything[0][0] == "run" and len(everything) == len(full)
            # nothing past the end: only the connected comment
            assert _parse(c.get(f"/api/agent/runs/{conv}/events", params={"user_id": uid, "after": len(full)}).text) == []
    finally:
        app.dependency_overrides.pop(get_pool, None)


def test_a_follower_joining_midway_gets_buffered_frames_then_live_ones(monkeypatch):
    _enable_ai(monkeypatch)
    user = make_user("Runs Midway")
    uid, conv = user["id"], "conv_runs_midway"
    pool = GatePool(_answer_messages(), gate_after=3)

    async def scenario():
        reg = get_registry()
        resp = await agent_route.agent_stream(_request(uid, "Check my hb", conv), pool)
        await resp.body_iterator.aclose()
        run = reg.get(uid, conv)
        await _until(lambda: len(run.frames) >= 4)  # the buffer holds what was said before the gate
        buffered = len(run.frames)
        follower = asyncio.ensure_future(_drain(reg.subscribe(run, 2, 15)))
        await asyncio.sleep(0.05)
        pool.gate.set()
        return buffered, await follower

    buffered, chunks = asyncio.run(scenario())
    indexes = [int(d["index"]) for _, d in _parse("".join(chunks))]
    assert indexes[0] == 3
    assert indexes == list(range(3, indexes[-1] + 1))
    assert indexes[-1] > buffered  # live frames followed the replay


def test_stop_saves_the_partial_answer_as_stopped_and_sends_a_stopped_frame(monkeypatch):
    _enable_ai(monkeypatch)
    user = make_user("Runs Stop")
    uid, conv = user["id"], "conv_runs_stop"
    pool = GatePool(_answer_messages("Hemoglobin is 13.2 g/dL so far"), gate_after=3)

    async def scenario():
        reg = get_registry()
        resp = await agent_route.agent_stream(_request(uid, "Check my hb", conv), pool)
        follower = asyncio.ensure_future(_drain(resp.body_iterator))
        run = reg.get(uid, conv)
        await _until(lambda: run.partial.startswith("Hemoglobin"))
        stopped = await agent_route.stop_run(conv, uid)
        again = await agent_route.stop_run(conv, uid)
        return stopped, again, await follower, run

    stopped, again, chunks, run = asyncio.run(scenario())
    assert stopped == {"stopped": True}
    assert again == {"stopped": False}
    assert pool.cancelled == [uid]  # the persona runtime was cancelled as before
    last_event, last = _parse("".join(chunks))[-1]
    assert last_event == "error"
    assert last["stage"] == "done"
    assert last["metadata"]["status"] == "stopped"
    assert last["metadata"]["message"] == "Stopped."
    assert run.status == "stopped"
    saved = _conversation(uid, conv)
    assert [m["role"] for m in saved["messages"]] == ["user", "assistant"]
    assert saved["messages"][1]["status"] == "stopped"
    assert saved["messages"][1]["content"] == "Hemoglobin is 13.2 g/dL so far"
    # A stopped turn is not an answered question: the Timeline of questions is untouched.
    from app.core.database import get_db

    with get_db() as db:
        n = db.execute("SELECT COUNT(*) AS c FROM questions WHERE user_id = ?", (uid,)).fetchone()["c"]
    assert n == 0


def test_active_runs_lists_only_running_answers_of_that_person(monkeypatch):
    _enable_ai(monkeypatch)
    user = make_user("Runs Active")
    other = make_user("Runs Active Other")
    uid, conv = user["id"], "conv_runs_active"
    pool = GatePool(_answer_messages(), gate_after=3)

    async def scenario():
        assert agent_route.active_runs(uid) == []
        resp = await agent_route.agent_stream(_request(uid, "Check my hb", conv), pool)
        await resp.body_iterator.aclose()
        listed = agent_route.active_runs(uid)
        elsewhere = agent_route.active_runs(other["id"])
        listing = agent_route.list_conversations(uid)
        pool.gate.set()
        run = get_registry().get(uid, conv)
        await asyncio.wait_for(asyncio.shield(run.task), 5)
        return listed, elsewhere, listing, agent_route.active_runs(uid), agent_route.list_conversations(uid)

    listed, elsewhere, listing, after, listing_after = asyncio.run(scenario())
    assert len(listed) == 1
    assert listed[0]["conversation_id"] == conv
    assert listed[0]["question"] == "Check my hb"
    assert listed[0]["status"] == "running"
    assert listed[0]["started_at"] > 1_600_000_000_000
    assert elsewhere == []
    assert [c for c in listing if c["id"] == conv][0]["running"] is True
    assert after == []  # finished runs are kept for re-attach but not listed
    assert [c for c in listing_after if c["id"] == conv][0]["running"] is False


def test_another_persona_gets_404_for_the_run(monkeypatch):
    _enable_ai(monkeypatch)
    owner = make_user("Runs Owner")
    stranger = make_user("Runs Stranger")
    uid, conv = owner["id"], "conv_runs_owner"
    pool = GatePool(_answer_messages(), gate_after=3)
    app.dependency_overrides[get_pool] = lambda: pool

    async def start_it():
        resp = await agent_route.agent_stream(_request(uid, "Check my hb", conv), pool)
        await resp.body_iterator.aclose()

    # The run must live on the same loop the client uses, so start it through the client portal.
    try:
        with TestClient(app) as c:
            c.portal.call(start_it)
            res = c.get(f"/api/agent/runs/{conv}/events", params={"user_id": stranger["id"]})
            assert res.status_code == 404
            res = c.post(f"/api/agent/runs/{conv}/stop", params={"user_id": stranger["id"]})
            assert res.status_code == 404
            assert c.get("/api/agent/runs/conv_nope/events", params={"user_id": uid}).status_code == 404
            assert c.post("/api/agent/runs/conv_nope/stop", params={"user_id": uid}).json() == {"stopped": False}
            # still running for its owner
            assert [r["conversation_id"] for r in c.get("/api/agent/runs/active", params={"user_id": uid}).json()] == [conv]
            assert c.get("/api/agent/runs/active", params={"user_id": stranger["id"]}).json() == []
            c.portal.call(pool.gate.set)
            assert c.get(f"/api/agent/runs/{conv}/events", params={"user_id": uid, "after": 99}).status_code == 200
            # the stranger could not stop it; the owner can read it to its end
            end = c.get(f"/api/agent/runs/{conv}/events", params={"user_id": uid, "after": 0})
            assert _parse(end.text)[-1][1]["stage"] == "done"
    finally:
        app.dependency_overrides.pop(get_pool, None)


def test_a_second_stream_while_one_is_running_gets_the_busy_error(monkeypatch):
    _enable_ai(monkeypatch)
    user = make_user("Runs Busy")
    uid = user["id"]
    pool = GatePool(_answer_messages(), gate_after=3)

    async def scenario():
        first = await agent_route.agent_stream(_request(uid, "First question", "conv_runs_busy1"), pool)
        await first.body_iterator.aclose()
        second = await agent_route.agent_stream(_request(uid, "Second question", "conv_runs_busy2"), pool)
        chunks = await _drain(second.body_iterator)
        running_after = get_registry().running_ids(uid)
        pool.gate.set()
        run = get_registry().get(uid, "conv_runs_busy1")
        await asyncio.wait_for(asyncio.shield(run.task), 5)
        return chunks, running_after

    chunks, running_after = asyncio.run(scenario())
    frames = _parse("".join(chunks))
    assert len(frames) == 1
    assert frames[0][0] == "error"
    assert frames[0][1]["metadata"]["message"] == BUSY
    assert frames[0][1]["stage"] == "done"
    assert running_after == {"conv_runs_busy1"}
    assert pool.calls == 1
    ids = [c["id"] for c in conversation_service.list_conversations(uid)]
    assert ids == ["conv_runs_busy1"]  # the refused question did not create a chat


def test_a_failed_turn_is_saved_as_an_error_turn(monkeypatch):
    _enable_ai(monkeypatch)
    user = make_user("Runs Error Turn")
    uid, conv = user["id"], "conv_runs_error"
    pool = FakePool(raises=RuntimeStartError("Process died"))

    async def scenario():
        resp = await agent_route.agent_stream(_request(uid, "Check my hb", conv), pool)
        return await _drain(resp.body_iterator)

    chunks = asyncio.run(scenario())
    last = _parse("".join(chunks))[-1]
    assert last[0] == "error" and last[1]["stage"] == "done"
    saved = _conversation(uid, conv)
    assert [m["role"] for m in saved["messages"]] == ["user", "assistant"]
    assert saved["messages"][1]["status"] == "error"
    assert saved["messages"][1]["content"] == "The AI Agent could not start."
    listed = conversation_service.list_conversations(uid)
    assert [c for c in listed if c["id"] == conv][0]["turns"] == 1


def test_an_unsafe_answer_keeps_safety_passed_false(monkeypatch):
    _enable_ai(monkeypatch)
    user = make_user("Runs Unsafe")
    uid, conv = user["id"], "conv_runs_unsafe"
    pool = FakePool(_answer_messages("Your results mean you have anemia."))

    async def scenario():
        resp = await agent_route.agent_stream(_request(uid, "Check my blood test", conv), pool)
        await _drain(resp.body_iterator)

    asyncio.run(scenario())
    msgs = _conversation(uid, conv)["messages"]
    assert msgs[0]["safety_passed"] is True and msgs[0]["safety_note"] is None
    assert msgs[1]["status"] == "answered"
    assert msgs[1]["safety_passed"] is False
    assert "you have" in msgs[1]["safety_note"]

    with TestClient(app) as c:
        body = c.get(f"/api/agent/conversations/{conv}", params={"user_id": uid}).json()
    assert body["messages"][1]["safety_passed"] is False
    assert "you have" in body["messages"][1]["safety_note"]


def test_a_refusal_runs_through_the_registry_and_is_saved_once():
    user = make_user("Runs Refusal")
    uid, conv = user["id"], "conv_runs_refusal"

    async def scenario():
        resp = await agent_route.agent_stream(_request(uid, "Do I have diabetes? Please diagnose me.", conv), FakePool())
        return await _drain(resp.body_iterator)

    frames = _parse("".join(asyncio.run(scenario())))
    assert [e for e, _ in frames] == ["run", "text_delta", "completed", "completed"]
    msgs = _conversation(uid, conv)["messages"]
    assert [(m["role"], m["status"]) for m in msgs] == [("user", None), ("assistant", "refused")]


def test_a_conversation_id_that_belongs_to_someone_else_is_refused():
    owner = make_user("Runs Conv Owner")
    stranger = make_user("Runs Conv Stranger")
    conv = "conv_runs_hijack"

    async def scenario():
        resp = await agent_route.agent_stream(_request(owner["id"], "Do I have diabetes? Please diagnose me.", conv), FakePool())
        await _drain(resp.body_iterator)
        with pytest.raises(Exception) as err:
            await agent_route.agent_stream(_request(stranger["id"], "hello", conv), FakePool())
        return err.value

    exc = asyncio.run(scenario())
    assert getattr(exc, "status_code", None) == 404
    assert len(_conversation(owner["id"], conv)["messages"]) == 2


def test_finished_runs_are_forgotten_after_ten_minutes(monkeypatch):
    _enable_ai(monkeypatch)
    import app.agent.runs as runs_mod

    user = make_user("Runs Forget")
    uid, conv = user["id"], "conv_runs_forget"

    async def scenario():
        resp = await agent_route.agent_stream(_request(uid, "Do I have diabetes? Please diagnose me.", conv), FakePool())
        await _drain(resp.body_iterator)
        reg = get_registry()
        assert reg.get(uid, conv) is not None
        reg._runs[conv].finished_at -= runs_mod.KEEP_FINISHED_SECONDS + 1
        assert reg.get(uid, conv) is None

    asyncio.run(scenario())


def test_the_lifespan_stops_running_answers_and_saves_them(monkeypatch):
    _enable_ai(monkeypatch)
    user = make_user("Runs Shutdown")
    uid, conv = user["id"], "conv_runs_shutdown"
    pool = GatePool(_answer_messages("Half an answer"), gate_after=3)

    async def start_it():
        resp = await agent_route.agent_stream(_request(uid, "Check my hb", conv), pool)
        await resp.body_iterator.aclose()
        await _until(lambda: get_registry().get(uid, conv).partial.startswith("Half"))

    with TestClient(app) as c:
        c.portal.call(start_it)
    saved = _conversation(uid, conv)["messages"]
    assert saved[-1]["status"] == "stopped"
    assert saved[-1]["content"] == "Half an answer"
    assert pool.cancelled == [uid]
