"""Tests for agent route, SSE framing, keepalive, cancellation, and lifecycle hooks."""

from __future__ import annotations

import asyncio
import json
import pytest
from fastapi.testclient import TestClient

from app.agent.pool import get_pool
from app.agent.runtime import RuntimeStartError
from app.core.config import settings
from app.main import app
from app.services import agent_service
from tests.conftest import make_user
from tests.test_agent_service import FakePool, notif, result_msg

client = TestClient(app)


def test_unknown_persona_gets_404_before_any_stream():
    res = client.post(
        "/api/agent/stream",
        json={"user_id": "usr_nonexistent_person_12345", "messages": [{"role": "user", "content": "hello"}]},
    )
    assert res.status_code == 404


def test_the_stream_uses_the_chat_envelope_and_ends_with_a_done_frame(monkeypatch):
    user = make_user("Agent Route Stream User")
    messages = [
        notif("turn/start", {}),
        notif("step/start", {"step": 1}),
        notif("assistant/message", {"message": {"content": [{"type": "text", "text": "Hemoglobin is normal."}]}}),
        notif("step/end", {"step": 1}),
        notif("turn/end", {}),
        result_msg("Hemoglobin is normal.", finish="stop"),
    ]
    fake_pool = FakePool(messages)
    monkeypatch.setattr(settings, "allow_api", True)
    monkeypatch.setattr(settings, "agentrouter_api_key", "sk-test-valid-key")
    app.dependency_overrides[get_pool] = lambda: fake_pool
    try:
        with client.stream(
            "POST",
            "/api/agent/stream",
            json={"user_id": user["id"], "messages": [{"role": "user", "content": "Check my hb"}]},
        ) as res:
            assert res.status_code == 200
            assert "text/event-stream" in res.headers["content-type"]
            text = res.read().decode("utf-8")

        frames = text.strip().split("\n\n")
        assert frames[0] == ": connected to agent stream"
        data_frames = []
        for f in frames[1:]:
            lines = f.strip().split("\n")
            ev_line = next(l for l in lines if l.startswith("event: "))
            data_line = next(l for l in lines if l.startswith("data: "))
            ev_name = ev_line[len("event: "):]
            data = json.loads(data_line[len("data: "):])
            data_frames.append((ev_name, data))

        assert len(data_frames) >= 1
        for idx, (ev_name, data) in enumerate(data_frames, start=1):
            assert data["index"] == f"{idx:02d}"
            for k in ("index", "stage", "metadata", "event_type", "event"):
                assert k in data, f"missing key {k}"
            if idx == len(data_frames):
                assert data["stage"] == "done"
                assert data["event_type"] == "completed"
                assert data["event"] == "completed"
            else:
                assert data["stage"] == "generation"
    finally:
        app.dependency_overrides.pop(get_pool, None)


def test_a_failure_ends_with_one_error_frame_with_stage_done(monkeypatch):
    user = make_user("Agent Route Failure User")
    fake_pool = FakePool(raises=RuntimeStartError("Process died"))
    monkeypatch.setattr(settings, "allow_api", True)
    monkeypatch.setattr(settings, "agentrouter_api_key", "sk-test-valid-key")
    app.dependency_overrides[get_pool] = lambda: fake_pool
    try:
        with client.stream(
            "POST",
            "/api/agent/stream",
            json={"user_id": user["id"], "messages": [{"role": "user", "content": "Check my hb"}]},
        ) as res:
            assert res.status_code == 200
            text = res.read().decode("utf-8")

        frames = text.strip().split("\n\n")
        assert frames[0] == ": connected to agent stream"
        data_frames = []
        for f in frames[1:]:
            lines = f.strip().split("\n")
            ev_line = next(l for l in lines if l.startswith("event: "))
            data_line = next(l for l in lines if l.startswith("data: "))
            ev_name = ev_line[len("event: "):]
            data = json.loads(data_line[len("data: "):])
            data_frames.append((ev_name, data))

        assert len(data_frames) >= 1
        last_ev, last_data = data_frames[-1]
        assert last_ev == "error"
        assert last_data["stage"] == "done"
        assert last_data["event_type"] == "error"
        assert "could not start" in last_data["metadata"]["message"]
    finally:
        app.dependency_overrides.pop(get_pool, None)


@pytest.mark.anyio
async def test_a_silent_agent_gets_keepalive_comments(monkeypatch):
    import app.routes.agent as agent_route

    monkeypatch.setattr(agent_route, "KEEPALIVE_SECONDS", 0.05)

    async def slow_events():
        await asyncio.sleep(0.3)
        yield ("status", {"phase": "working", "message": "working"})
        yield ("done", {"status": "answered"})

    frames = []
    async for frame in agent_route._sse_stream(slow_events()):
        frames.append(frame)

    assert frames[0] == ": connected to agent stream\n\n"
    keepalives = [f for f in frames if f == ": keep-alive\n\n"]
    assert len(keepalives) >= 2
    first_data_idx = next(i for i, f in enumerate(frames) if f.startswith("event: "))
    first_keepalives = [f for f in frames[:first_data_idx] if f == ": keep-alive\n\n"]
    assert len(first_keepalives) >= 2


@pytest.mark.anyio
async def test_closing_the_sse_generator_cancels_the_inner_stream(monkeypatch):
    import app.routes.agent as agent_route

    user = make_user("Agent Route Cancel User")
    monkeypatch.setattr(settings, "allow_api", True)
    monkeypatch.setattr(settings, "agentrouter_api_key", "sk-test-valid-key")
    fake_pool = FakePool([notif("turn/start", {})], block_after=0)
    turns = [{"role": "user", "content": "What was my hemoglobin?"}]
    events = agent_service.stream_agent(user["id"], turns, pool=fake_pool)
    sse = agent_route._sse_stream(events)

    first = await sse.__anext__()
    assert first == ": connected to agent stream\n\n"
    second = await sse.__anext__()
    assert second.startswith("event: status")
    third = await sse.__anext__()
    assert third.startswith("event: status")

    await sse.aclose()
    assert fake_pool.cancelled == [user["id"]]


def test_deleting_a_persona_forgets_its_agent_runtime_and_folder(monkeypatch):
    import app.routes.users as users_route

    class RecordingPool:
        def __init__(self):
            self.forgotten = []

        async def forget_persona(self, pid: str):
            self.forgotten.append(pid)

    rec_pool = RecordingPool()
    monkeypatch.setattr(users_route, "get_pool", lambda: rec_pool)

    user = make_user("Delete Test Persona")
    uid = user["id"]

    res = client.delete(f"/api/users/{uid}")
    assert res.status_code == 200
    assert rec_pool.forgotten == [uid]

    res404 = client.delete("/api/users/usr_nonexistent_12345")
    assert res404.status_code == 404
    assert rec_pool.forgotten == [uid]


@pytest.mark.anyio
async def test_the_reaper_loop_calls_reap_idle_repeatedly_and_stops_when_cancelled():
    from app.main import _reap_loop

    class ReaperPool:
        def __init__(self):
            self.calls = 0

        async def reap_idle(self):
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("temporary reap error")

    fake = ReaperPool()
    task = asyncio.create_task(_reap_loop(fake, 0.01))
    await asyncio.sleep(0.1)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert fake.calls >= 2


def test_the_lifespan_closes_the_pool_on_shutdown(monkeypatch):
    import app.main as main_mod

    class ShutdownPool:
        def __init__(self):
            self.closed = False

        async def reap_idle(self):
            pass

        async def close_all(self):
            self.closed = True

    fake = ShutdownPool()
    monkeypatch.setattr(main_mod, "get_pool", lambda: fake)

    with TestClient(main_mod.app):
        pass

    assert fake.closed is True
