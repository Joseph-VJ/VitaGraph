"""Tests for the VitaGraph Agent Runtime Pool (RuntimePool)."""

from __future__ import annotations

import asyncio
import ctypes
import os
import sys
import time
from pathlib import Path
from typing import Any

import pytest

from app.agent.lockdown import LockdownViolation
from app.agent.profile import profile_for
from app.agent.runtime import AgentRuntime, RuntimeBusy
from app.core.config import settings
from tests.fixtures import fake_worker

BACKEND_DIR = Path(__file__).resolve().parent.parent
FAKE_WORKER_PATH = str(Path(fake_worker.__file__).resolve())


def is_pid_alive(pid: int | None) -> bool:
    """Check if process ID is alive using standard library ctypes (Windows)."""
    if pid is None or pid <= 0:
        return False
    try:
        process = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if not process:
            return False
        exit_code = ctypes.c_ulong()
        ctypes.windll.kernel32.GetExitCodeProcess(process, ctypes.byref(exit_code))
        ctypes.windll.kernel32.CloseHandle(process)
        return exit_code.value == 259  # STILL_ACTIVE
    except Exception:
        return False


@pytest.fixture(autouse=True)
def isolated_agent_data(tmp_path, monkeypatch):
    """Isolate agent root data to tmp_path for every test."""
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    (tmp_path / "agent").mkdir(parents=True, exist_ok=True)
    yield tmp_path


def make_factory(mode="normal", spawned_runtimes=None):
    """Create a runtime_factory using fake_worker in specified mode."""
    def _factory(profile):
        cmd = [sys.executable, FAKE_WORKER_PATH, "--mode", mode]
        rt = AgentRuntime(profile, worker_command=cmd)
        if spawned_runtimes is not None:
            spawned_runtimes.append(rt)
        return rt
    return _factory


async def dummy_verify(persona_id: str) -> list[str]:
    """A mock verify callback that succeeds."""
    return [
        "mcp__vitagraph__get_measurements",
        "mcp__vitagraph__graph_lookup",
        "mcp__vitagraph__list_reports",
        "mcp__vitagraph__search_reports",
    ]


def test_the_first_turn_starts_a_runtime_lazily_and_the_second_reuses_it():
    from app.agent.pool import RuntimePool

    spawned = []
    pool = RuntimePool(runtime_factory=make_factory("normal", spawned), verify=dummy_verify)

    async def _main():
        assert len(spawned) == 0

        # First turn
        async for msg in pool.stream_turn("usr_p1", "s1", "turn 1"):
            if msg.get("type") == "result":
                break

        assert len(spawned) == 1
        first_rt = spawned[0]
        assert first_rt.is_alive
        first_pid = first_rt.pid
        assert is_pid_alive(first_pid)

        # Second turn on same persona
        async for msg in pool.stream_turn("usr_p1", "s2", "turn 2"):
            if msg.get("type") == "result":
                break

        assert len(spawned) == 1
        assert first_rt.pid == first_pid
        assert is_pid_alive(first_pid)

        await pool.close_all()

    asyncio.run(_main())


def test_different_personas_get_different_runtimes():
    from app.agent.pool import RuntimePool

    spawned = []
    pool = RuntimePool(runtime_factory=make_factory("normal", spawned), verify=dummy_verify)

    async def _main():
        async for msg in pool.stream_turn("usr_pa", "s1", "hello A"):
            if msg.get("type") == "result":
                break

        async for msg in pool.stream_turn("usr_pb", "s2", "hello B"):
            if msg.get("type") == "result":
                break

        assert len(spawned) == 2
        pid_a = spawned[0].pid
        pid_b = spawned[1].pid
        assert pid_a != pid_b
        assert is_pid_alive(pid_a)
        assert is_pid_alive(pid_b)

        await pool.close_all()

    asyncio.run(_main())


def test_concurrent_first_turns_of_the_same_persona_start_exactly_one_worker():
    from app.agent.pool import RuntimePool

    spawned = []
    pool = RuntimePool(runtime_factory=make_factory("slow", spawned), verify=dummy_verify)

    async def _main():
        async def _run_turn(sid: str):
            async for msg in pool.stream_turn("usr_p_concurrent", sid, "hello"):
                if msg.get("type") == "result":
                    break

        results = await asyncio.gather(
            _run_turn("s1"),
            _run_turn("s2"),
            return_exceptions=True,
        )

        assert len(spawned) == 1
        # One must succeed or run, the other must be refused with RuntimeBusy
        exceptions = [r for r in results if isinstance(r, Exception)]
        assert any(isinstance(e, RuntimeBusy) for e in exceptions), f"Expected RuntimeBusy in {results}"

        await pool.close_all()

    asyncio.run(_main())


def test_a_second_turn_of_the_same_persona_while_one_runs_is_refused():
    from app.agent.pool import RuntimePool

    spawned = []
    pool = RuntimePool(runtime_factory=make_factory("slow", spawned), verify=dummy_verify)

    async def _main():
        gen1 = pool.stream_turn("usr_busy", "s1", "hello")
        first_msg = await gen1.__anext__()
        assert first_msg.get("type") == "notification"

        # Second turn on same persona must raise RuntimeBusy at first iteration
        gen2 = pool.stream_turn("usr_busy", "s2", "hello again")
        with pytest.raises(RuntimeBusy):
            await gen2.__anext__()

        await gen1.aclose()
        await pool.close_all()

    asyncio.run(_main())


def test_at_capacity_the_least_recently_used_idle_runtime_is_closed():
    from app.agent.pool import PoolFull, RuntimePool

    sim_time = 1000.0

    def mock_clock():
        nonlocal sim_time
        return sim_time

    spawned = []
    pool = RuntimePool(
        max_runtimes=2,
        runtime_factory=make_factory("normal", spawned),
        verify=dummy_verify,
        clock=mock_clock,
    )

    async def _main():
        nonlocal sim_time
        # Persona A runs at t=1000
        sim_time = 1000.0
        async for msg in pool.stream_turn("usr_A", "sA", "msg A"):
            if msg.get("type") == "result":
                break
        pid_a = spawned[0].pid
        assert is_pid_alive(pid_a)

        # Persona B runs at t=1010
        sim_time = 1010.0
        async for msg in pool.stream_turn("usr_B", "sB", "msg B"):
            if msg.get("type") == "result":
                break
        pid_b = spawned[1].pid
        assert is_pid_alive(pid_b)

        # Now capacity 2 is reached, A was used at 1000, B at 1010.
        # Starting Persona C at t=1020 must evict A (least recently used)
        sim_time = 1020.0
        async for msg in pool.stream_turn("usr_C", "sC", "msg C"):
            if msg.get("type") == "result":
                break

        pid_c = spawned[2].pid
        assert is_pid_alive(pid_c)
        assert not is_pid_alive(pid_a), f"Persona A pid {pid_a} should have been closed"
        assert is_pid_alive(pid_b), f"Persona B pid {pid_b} should still be alive"

        # Test PoolFull: if both are running, new persona gets PoolFull
        # Start slow turn on B and C
        gen_b = pool.stream_turn("usr_B", "sB2", "slow")
        await gen_b.__anext__()
        gen_c = pool.stream_turn("usr_C", "sC2", "slow")
        await gen_c.__anext__()

        # Starting D when all are busy raises PoolFull
        gen_d = pool.stream_turn("usr_D", "sD", "msg D")
        with pytest.raises(PoolFull):
            await gen_d.__anext__()

        await gen_b.aclose()
        await gen_c.aclose()
        await pool.close_all()

    asyncio.run(_main())


def test_idle_runtimes_are_reaped():
    from app.agent.pool import RuntimePool

    sim_time = 1000.0

    def mock_clock():
        nonlocal sim_time
        return sim_time

    spawned = []
    pool = RuntimePool(
        idle_seconds=60.0,
        runtime_factory=make_factory("normal", spawned),
        verify=dummy_verify,
        clock=mock_clock,
    )

    async def _main():
        nonlocal sim_time
        sim_time = 1000.0
        async for msg in pool.stream_turn("usr_idle", "s1", "hi"):
            if msg.get("type") == "result":
                break
        pid = spawned[0].pid
        assert is_pid_alive(pid)

        # Advance by 30s: reap should not kill it
        sim_time = 1030.0
        await pool.reap_idle()
        assert is_pid_alive(pid)

        # Advance past 60s (t=1065): reap kills it
        sim_time = 1065.0
        await pool.reap_idle()
        deadline = time.time() + 2.0
        while time.time() < deadline:
            if not is_pid_alive(pid):
                break
            time.sleep(0.1)
        assert not is_pid_alive(pid)

        await pool.close_all()

    asyncio.run(_main())


def test_cancel_kills_the_runtime_and_the_next_turn_starts_a_fresh_one():
    from app.agent.pool import RuntimePool

    spawned = []
    pool = RuntimePool(runtime_factory=make_factory("slow", spawned), verify=dummy_verify)

    async def _main():
        gen = pool.stream_turn("usr_canc", "s1", "slow")
        await gen.__anext__()
        first_pid = spawned[0].pid
        assert is_pid_alive(first_pid)

        await pool.cancel("usr_canc")
        await gen.aclose()

        deadline = time.time() + 2.0
        while time.time() < deadline:
            if not is_pid_alive(first_pid):
                break
            time.sleep(0.1)
        assert not is_pid_alive(first_pid)

        # Next turn starts a new runtime on a new pid
        async for msg in pool.stream_turn("usr_canc", "s2", "new turn"):
            if msg.get("type") == "notification":
                break

        assert len(spawned) == 2
        second_pid = spawned[1].pid
        assert second_pid != first_pid
        assert is_pid_alive(second_pid)

        await pool.close_all()

    asyncio.run(_main())


def test_forget_persona_closes_the_runtime_and_deletes_its_folder(tmp_path):
    from app.agent.pool import RuntimePool

    spawned = []
    pool = RuntimePool(runtime_factory=make_factory("normal", spawned), verify=dummy_verify)

    async def _main():
        # Ensure persona profile directory exists
        prof = profile_for("usr_forget")
        persona_folder = prof.home.parent
        assert persona_folder.exists()

        async for msg in pool.stream_turn("usr_forget", "s1", "hi"):
            if msg.get("type") == "result":
                break

        pid = spawned[0].pid
        assert is_pid_alive(pid)

        await pool.forget_persona("usr_forget")
        assert not is_pid_alive(pid)
        assert not persona_folder.exists()

        # Path traversal check
        outside_file = tmp_path / "survivor.txt"
        outside_file.write_text("survive", encoding="utf-8")
        with pytest.raises(ValueError):
            await pool.forget_persona("../survivor")
        assert outside_file.exists()

        await pool.close_all()

    asyncio.run(_main())


def test_a_persona_whose_lockdown_check_fails_is_never_started():
    from app.agent.pool import RuntimePool

    verify_calls = 0

    async def failing_verify(persona_id: str):
        nonlocal verify_calls
        verify_calls += 1
        raise LockdownViolation("Simulated lockdown failure")

    spawned = []
    pool = RuntimePool(runtime_factory=make_factory("normal", spawned), verify=failing_verify)

    async def _main():
        nonlocal verify_calls
        with pytest.raises(LockdownViolation):
            async for _ in pool.stream_turn("usr_bad_lock", "s1", "hi"):
                pass

        assert verify_calls == 1
        assert len(spawned) == 0
        assert len(pool.snapshot()) == 0

        # Second attempt must call verify again (failure not cached as success)
        with pytest.raises(LockdownViolation):
            async for _ in pool.stream_turn("usr_bad_lock", "s2", "hi"):
                pass
        assert verify_calls == 2
        assert len(spawned) == 0

        await pool.close_all()

    asyncio.run(_main())


def test_the_lockdown_check_runs_once_per_persona_and_is_reused():
    from app.agent.pool import RuntimePool

    verify_calls = 0

    async def counting_verify(persona_id: str):
        nonlocal verify_calls
        verify_calls += 1
        return await dummy_verify(persona_id)

    pool = RuntimePool(runtime_factory=make_factory("normal"), verify=counting_verify)

    async def _main():
        async for msg in pool.stream_turn("usr_reuse", "s1", "turn 1"):
            if msg.get("type") == "result":
                break
        assert verify_calls == 1

        async for msg in pool.stream_turn("usr_reuse", "s2", "turn 2"):
            if msg.get("type") == "result":
                break
        assert verify_calls == 1

        await pool.close_all()

    asyncio.run(_main())


def test_close_all_stops_every_worker():
    from app.agent.pool import RuntimePool

    spawned = []
    pool = RuntimePool(runtime_factory=make_factory("normal", spawned), verify=dummy_verify)

    async def _main():
        async for msg in pool.stream_turn("usr_ca1", "s1", "hi 1"):
            if msg.get("type") == "result":
                break
        async for msg in pool.stream_turn("usr_ca2", "s2", "hi 2"):
            if msg.get("type") == "result":
                break

        pids = [rt.pid for rt in spawned]
        assert all(is_pid_alive(p) for p in pids)

        await pool.close_all()

        deadline = time.time() + 2.0
        while time.time() < deadline:
            if all(not is_pid_alive(p) for p in pids):
                break
            time.sleep(0.1)

        assert all(not is_pid_alive(p) for p in pids)

    asyncio.run(_main())


def test_snapshot_describes_the_pool():
    from app.agent.pool import RuntimePool

    pool = RuntimePool(runtime_factory=make_factory("normal"), verify=dummy_verify)

    async def _main():
        assert pool.snapshot() == []

        async for msg in pool.stream_turn("usr_snap", "s1", "hi"):
            if msg.get("type") == "result":
                break

        snap = pool.snapshot()
        assert len(snap) == 1
        entry = snap[0]
        assert entry["persona_id"] == "usr_snap"
        assert isinstance(entry["pid"], int)
        assert isinstance(entry["idle_seconds"], float)
        assert entry["running"] is False

        await pool.close_all()

    asyncio.run(_main())


def test_a_failed_worker_start_does_not_poison_the_persona():
    from app.agent.pool import RuntimePool
    from app.agent.runtime import RuntimeStartError

    cmd = [sys.executable, FAKE_WORKER_PATH, "--mode", "crash_on_start"]
    factory = lambda prof: AgentRuntime(prof, worker_command=cmd, start_timeout=5.0)
    pool = RuntimePool(runtime_factory=factory, verify=dummy_verify)

    async def _main():
        with pytest.raises(RuntimeStartError):
            async for _ in pool.stream_turn("usr_crash", "s1", "turn 1"):
                pass

        assert pool.snapshot() == []

        # A second attempt raises RuntimeStartError again (NOT RuntimeBusy)
        with pytest.raises(RuntimeStartError):
            async for _ in pool.stream_turn("usr_crash", "s2", "turn 2"):
                pass

        assert pool.snapshot() == []
        await pool.close_all()

    asyncio.run(_main())


def test_the_default_factory_uses_the_configured_credentials_and_starts_nothing(monkeypatch):
    from app.agent.pool import _default_runtime_factory
    from app.core.config import Settings

    monkeypatch.setattr(Settings, "effective_api_key", property(lambda self: "sk-test"))
    monkeypatch.setattr(Settings, "effective_base_url", property(lambda self: "https://test.base.url"))
    monkeypatch.setattr(Settings, "effective_model", property(lambda self: "test-model-42"))

    rt = _default_runtime_factory(profile_for("usr_factory"))
    assert rt.api_key == "sk-test"
    assert rt.base_url == "https://test.base.url"
    assert rt.model == "test-model-42"
    assert rt.pid is None
    assert rt.is_alive is False


def test_get_pool_returns_one_shared_pool(monkeypatch):
    import app.agent.pool

    monkeypatch.setattr(app.agent.pool, "_pool_singleton", None)
    try:
        p1 = app.agent.pool.get_pool()
        p2 = app.agent.pool.get_pool()
        assert p1 is p2
    finally:
        monkeypatch.setattr(app.agent.pool, "_pool_singleton", None)


def test_forget_persona_retries_when_a_file_is_still_locked(monkeypatch):
    import app.agent.pool
    from app.agent.pool import RuntimePool
    from app.agent.profile import agent_root

    monkeypatch.setattr(app.agent.pool, "_RMTREE_RETRY_DELAY", 0.0)
    pool = RuntimePool(runtime_factory=make_factory("normal"), verify=dummy_verify)

    persona_dir = agent_root() / "usr_retry"
    persona_dir.mkdir(parents=True, exist_ok=True)
    test_file = persona_dir / "locked.txt"
    test_file.write_text("locked", encoding="utf-8")

    real_rmtree = app.agent.pool.shutil.rmtree
    call_count = 0

    def mock_rmtree(path, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise PermissionError("Access is denied")
        return real_rmtree(path, *args, **kwargs)

    monkeypatch.setattr(app.agent.pool.shutil, "rmtree", mock_rmtree)

    async def _main():
        await pool.forget_persona("usr_retry")
        assert call_count == 3
        assert not persona_dir.exists()
        await pool.close_all()

    asyncio.run(_main())


def test_forget_persona_gives_up_after_five_attempts(monkeypatch):
    import app.agent.pool
    from app.agent.pool import RuntimePool
    from app.agent.profile import agent_root

    monkeypatch.setattr(app.agent.pool, "_RMTREE_RETRY_DELAY", 0.0)
    pool = RuntimePool(runtime_factory=make_factory("normal"), verify=dummy_verify)

    persona_dir = agent_root() / "usr_giveup"
    persona_dir.mkdir(parents=True, exist_ok=True)

    call_count = 0

    def mock_rmtree(path, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        raise PermissionError("Access is denied permanently")

    monkeypatch.setattr(app.agent.pool.shutil, "rmtree", mock_rmtree)

    async def _main():
        with pytest.raises(PermissionError):
            await pool.forget_persona("usr_giveup")
        assert call_count == 5
        await pool.close_all()

    asyncio.run(_main())


def test_forget_persona_clears_its_verified_flag():
    from app.agent.pool import RuntimePool

    verify_calls = 0

    async def counting_verify(persona_id: str):
        nonlocal verify_calls
        verify_calls += 1
        return await dummy_verify(persona_id)

    pool = RuntimePool(runtime_factory=make_factory("normal"), verify=counting_verify)

    async def _main():
        async for msg in pool.stream_turn("usr_clear_ver", "s1", "turn 1"):
            if msg.get("type") == "result":
                break
        assert verify_calls == 1

        await pool.forget_persona("usr_clear_ver")
        assert "usr_clear_ver" not in pool._verified_personas
        assert "usr_clear_ver" not in pool._persona_locks

        async for msg in pool.stream_turn("usr_clear_ver", "s2", "turn 2"):
            if msg.get("type") == "result":
                break
        assert verify_calls == 2

        await pool.close_all()

    asyncio.run(_main())


def test_a_dead_own_entry_does_not_count_toward_capacity():
    from app.agent.pool import RuntimePool

    spawned = []
    pool = RuntimePool(max_runtimes=2, runtime_factory=make_factory("normal", spawned), verify=dummy_verify)

    async def _main():
        async for msg in pool.stream_turn("usr_A", "s1", "hi"):
            if msg.get("type") == "result":
                break
        async for msg in pool.stream_turn("usr_B", "s1", "hi"):
            if msg.get("type") == "result":
                break

        assert len(spawned) == 2
        pid_A = pool._entries["usr_A"].runtime.pid
        pid_B = pool._entries["usr_B"].runtime.pid

        # Kill A's worker process directly
        pool._entries["usr_A"].runtime.kill()
        assert not pool._entries["usr_A"].runtime.is_alive

        # Run a new turn for A
        async for msg in pool.stream_turn("usr_A", "s2", "hi again"):
            if msg.get("type") == "result":
                break

        # B was NOT evicted
        assert pool._entries["usr_B"].runtime.pid == pid_B
        assert is_pid_alive(pid_B)
        # A has a new pid
        assert pool._entries["usr_A"].runtime.pid != pid_A
        assert is_pid_alive(pool._entries["usr_A"].runtime.pid)

        await pool.close_all()

    asyncio.run(_main())
