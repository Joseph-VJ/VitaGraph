"""Pre-starting a persona's agent: RuntimePool.warm and POST /api/agent/warm."""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.agent.pool import PoolFull, RuntimePool, get_pool
from app.core.config import settings
from app.main import app
from tests.conftest import make_user
from tests.test_agent_pool import dummy_verify, isolated_agent_data, make_factory  # noqa: F401


def test_warm_starts_the_runtime_once_and_the_first_turn_reuses_it():
    spawned = []
    pool = RuntimePool(runtime_factory=make_factory("normal", spawned), verify=dummy_verify)

    async def _main():
        assert await pool.warm("usr_w1") is True
        assert len(spawned) == 1 and spawned[0].is_alive
        assert await pool.warm("usr_w1") is False  # already running: nothing to do
        async for msg in pool.stream_turn("usr_w1", "s1", "hello"):
            if msg.get("type") == "result":
                break
        assert len(spawned) == 1  # the turn used the warmed runtime
        await pool.close_all()

    asyncio.run(_main())


def test_a_failed_warm_leaves_no_entry_behind_and_the_next_turn_can_still_start():
    spawned = []
    pool = RuntimePool(runtime_factory=make_factory("crash_on_start", spawned), verify=dummy_verify)

    async def _main():
        with pytest.raises(Exception):
            await pool.warm("usr_w2")
        assert pool.snapshot() == []
        await pool.close_all()

    asyncio.run(_main())


def test_warm_evicts_an_idle_runtime_at_capacity_but_never_a_busy_one():
    spawned = []
    pool = RuntimePool(max_runtimes=1, runtime_factory=make_factory("normal", spawned), verify=dummy_verify)

    async def _main():
        assert await pool.warm("usr_a") is True
        assert await pool.warm("usr_b") is True  # usr_a was idle, so it made room
        assert [e["persona_id"] if isinstance(e, dict) else e.persona_id for e in pool.snapshot()] == ["usr_b"]
        pool._entries["usr_b"].running = True
        with pytest.raises(PoolFull):
            await pool.warm("usr_c")
        pool._entries["usr_b"].running = False
        await pool.close_all()

    asyncio.run(_main())


def test_the_warm_route_answers_off_when_no_model_key_is_set(monkeypatch):
    user = make_user("Warm off")
    monkeypatch.setattr(settings, "allow_api", False)
    res = TestClient(app).post("/api/agent/warm", json={"user_id": user["id"]})
    assert res.status_code == 200 and res.json() == {"status": "off"}


def test_the_warm_route_starts_the_pool_in_the_background(monkeypatch):
    user = make_user("Warm on")
    monkeypatch.setattr(settings, "allow_api", True)
    monkeypatch.setattr(settings, "agentrouter_api_key", "sk-test-valid-key")
    warmed: list[str] = []

    class FakePool:
        async def warm(self, persona_id: str) -> bool:
            warmed.append(persona_id)
            return True

    app.dependency_overrides[get_pool] = lambda: FakePool()
    try:
        with TestClient(app) as client:  # the app's event loop stays alive long enough for the task
            res = client.post("/api/agent/warm", json={"user_id": user["id"]})
            assert res.json() == {"status": "warming"}
            client.get("/api/health")
    finally:
        app.dependency_overrides.pop(get_pool, None)
    assert warmed == [user["id"]]


def test_the_warm_route_rejects_an_unknown_persona():
    res = TestClient(app).post("/api/agent/warm", json={"user_id": "usr_nobody_12345"})
    assert res.status_code == 404
