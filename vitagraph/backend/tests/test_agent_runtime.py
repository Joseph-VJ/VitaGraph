"""Tests for the AgentRuntime worker process management, streaming, and lockdown monitor."""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest
import ctypes

from app.agent.lockdown import LockdownViolation
from app.agent.profile import SAFE_ENV_ALLOWLIST, profile_for
from app.agent.runtime import AgentRuntime, RuntimeBusy, RuntimeStartError
from tests.fixtures import echo_mcp_server, fake_worker

BACKEND_DIR = Path(__file__).resolve().parent.parent
FAKE_WORKER_PATH = str(Path(fake_worker.__file__).resolve())
ECHO_MCP_PATH = str(Path(echo_mcp_server.__file__).resolve())


def is_pid_alive(pid: int | None) -> bool:
    """Check if process ID is alive using standard library ctypes."""
    if pid is None or pid <= 0:
        return False
    try:
        kernel32 = ctypes.windll.kernel32
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if not handle:
            return False
        exit_code = ctypes.c_ulong()
        kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code))
        kernel32.CloseHandle(handle)
        return exit_code.value == 259  # STILL_ACTIVE
    except Exception:
        return False


def test_start_and_close_stop_the_worker_process(tmp_path):
    """Verify AgentRuntime starts a worker process and stops it cleanly on close."""
    prof = profile_for("usr_test_rt1")
    cmd = [sys.executable, FAKE_WORKER_PATH, "--mode", "normal"]
    rt = AgentRuntime(prof, worker_command=cmd)
    rt.start()
    assert rt.is_alive
    pid = rt.pid
    assert pid is not None
    assert is_pid_alive(pid)

    rt.close()
    assert not rt.is_alive
    time.sleep(0.5)
    assert not is_pid_alive(pid)


def test_a_turn_streams_notifications_while_the_run_is_in_progress(tmp_path):
    """Verify notifications stream live before final result and in correct order."""
    prof = profile_for("usr_test_rt2")
    cmd = [sys.executable, FAKE_WORKER_PATH, "--mode", "normal"]
    rt = AgentRuntime(prof, worker_command=cmd)
    rt.start()

    async def _run():
        messages = []
        loop = asyncio.get_running_loop()
        first_notif_time = None
        result_time = None

        async for msg in rt.stream_turn("s-1", "hello"):
            now = loop.time()
            mtype = msg.get("type")
            if mtype == "notification" and first_notif_time is None:
                first_notif_time = now
            elif mtype == "result":
                result_time = now
            messages.append(msg)

        assert first_notif_time is not None
        assert result_time is not None
        # First notification arrives at least 0.2s before the result
        assert (result_time - first_notif_time) >= 0.2

        types = [m.get("type") for m in messages]
        assert types == ["notification", "notification", "notification", "result"]

    try:
        asyncio.run(_run())
    finally:
        rt.close()


def test_a_second_turn_while_one_is_running_is_refused(tmp_path):
    """Verify starting a second turn while one is running raises RuntimeBusy."""
    prof = profile_for("usr_test_rt3")
    cmd = [sys.executable, FAKE_WORKER_PATH, "--mode", "slow"]
    rt = AgentRuntime(prof, worker_command=cmd)
    rt.start()

    async def _run():
        turn1_gen = rt.stream_turn("s-1", "hello")
        # Consume the first event to ensure run has started
        await turn1_gen.__anext__()

        # Second turn should raise RuntimeBusy
        with pytest.raises(RuntimeBusy):
            async for _ in rt.stream_turn("s-1", "second"):
                pass

        await turn1_gen.aclose()

    try:
        asyncio.run(_run())
    finally:
        rt.cancel()


def test_cancel_kills_the_worker_and_ends_the_stream(tmp_path):
    """Verify cancel() terminates the worker process and ends the active stream."""
    prof = profile_for("usr_test_rt4")
    cmd = [sys.executable, FAKE_WORKER_PATH, "--mode", "slow"]
    rt = AgentRuntime(prof, worker_command=cmd)
    rt.start()
    pid = rt.pid

    async def _run():
        messages = []

        async def _consumer():
            async for msg in rt.stream_turn("s-1", "hello"):
                messages.append(msg)

        task = asyncio.create_task(_consumer())
        await asyncio.sleep(0.5)
        rt.cancel()
        await task

        assert any(m.get("type") == "run_error" for m in messages)

    try:
        asyncio.run(_run())
    finally:
        rt.close()

    time.sleep(1.0)
    assert not is_pid_alive(pid)


def test_abandoning_the_stream_kills_the_runtime(tmp_path):
    """Verify breaking or aclosing an active stream kills the worker process within 2s."""
    prof = profile_for("usr_test_rt5")
    cmd = [sys.executable, FAKE_WORKER_PATH, "--mode", "slow"]
    rt = AgentRuntime(prof, worker_command=cmd)
    rt.start()
    pid = rt.pid

    async def _run():
        gen = rt.stream_turn("s-1", "hello")
        await gen.__anext__()
        # Abandon stream
        await gen.aclose()

    asyncio.run(_run())
    time.sleep(1.0)
    assert not is_pid_alive(pid)


def test_a_tool_that_is_not_allowed_kills_the_runtime_and_raises(tmp_path):
    """Verify live lockdown monitor kills worker, yields lockdown_violation, and raises."""
    prof = profile_for("usr_test_rt6")
    cmd = [sys.executable, FAKE_WORKER_PATH, "--mode", "badtools"]
    rt = AgentRuntime(prof, worker_command=cmd)
    rt.start()
    pid = rt.pid

    async def _run():
        messages = []
        with pytest.raises(LockdownViolation):
            async for msg in rt.stream_turn("s-1", "hello"):
                messages.append(msg)

        # Yielded messages include lockdown_violation before exception
        violation_msg = next((m for m in messages if m.get("type") == "lockdown_violation"), None)
        assert violation_msg is not None
        assert "pwsh" in violation_msg.get("tools", [])

    try:
        asyncio.run(_run())
    finally:
        rt.close()

    time.sleep(1.0)
    assert not is_pid_alive(pid)


def test_a_worker_that_crashes_on_start_gives_a_clear_error(tmp_path):
    """Verify worker crashing on start raises RuntimeStartError containing stderr text."""
    prof = profile_for("usr_test_rt7")
    cmd = [sys.executable, FAKE_WORKER_PATH, "--mode", "crash_on_start"]
    rt = AgentRuntime(prof, worker_command=cmd)

    with pytest.raises(RuntimeStartError) as exc_info:
        rt.start()

    assert "boom" in str(exc_info.value)
    assert not rt.is_alive


def test_the_workers_environment_is_minimal_and_the_parent_environment_never_changes(tmp_path):
    """Verify worker receives minimal environment and parent os.environ is never touched."""
    prof = profile_for("usr_test_rt8")
    dump_file = str(tmp_path / "env_dump.json")
    cmd = [sys.executable, FAKE_WORKER_PATH, "--mode", "envdump", "--dump-file", dump_file]

    orig_env = dict(os.environ)
    stop_snapping = threading.Event()
    snapshots: list[dict[str, str]] = []

    def _snapshot_loop():
        while not stop_snapping.is_set():
            snapshots.append(dict(os.environ))
            time.sleep(0.01)

    snap_thread = threading.Thread(target=_snapshot_loop, daemon=True)

    try:
        os.environ["VITAGRAPH_USER_ID"] = "ambient"
        os.environ["AG2_CANARY"] = "leak"
        os.environ["DEEPSEEK_API_KEY"] = "sk-x"

        snap_thread.start()

        rt = AgentRuntime(prof, worker_command=cmd)
        rt.start()
        rt.close()

        stop_snapping.set()
        snap_thread.join(timeout=1.0)

        assert os.path.exists(dump_file)
        with open(dump_file, "r", encoding="utf-8") as f:
            dumped = json.load(f)

        names = set(dumped["names"])
        # Forbidden canaries must not appear
        assert "VITAGRAPH_USER_ID" not in names
        assert "AG2_CANARY" not in names
        assert "DEEPSEEK_API_KEY" not in names

        # Allowed upper names
        allow_upper = {k.upper() for k in SAFE_ENV_ALLOWLIST}
        python_win_extra = {"PYTHONPATH", "PYTHONHOME", "COMSPEC"}
        for name in names:
            assert name.upper() in allow_upper or name.upper() in python_win_extra, f"Unexpected env var in child: {name}"

        # Snapshot check: parent environment never changed
        assert len(snapshots) > 0
        first_snap = snapshots[0]
        for s in snapshots:
            assert s == first_snap, "Parent environment mutated during worker start!"

        assert dict(os.environ) == orig_env | {
            "VITAGRAPH_USER_ID": "ambient",
            "AG2_CANARY": "leak",
            "DEEPSEEK_API_KEY": "sk-x",
        }

    finally:
        stop_snapping.set()
        os.environ.clear()
        os.environ.update(orig_env)


def test_the_api_key_never_appears_in_the_workers_command_line_or_environment(tmp_path):
    """Verify API key is transmitted via pipe only and never in argv, environment, or files."""
    prof = profile_for("usr_test_rt9")
    dump_file = str(tmp_path / "env_dump_key.json")
    cmd = [sys.executable, FAKE_WORKER_PATH, "--mode", "envdump", "--dump-file", dump_file]
    canary_key = "AG2B-CANARY-KEY-987654"

    rt = AgentRuntime(prof, worker_command=cmd, api_key=canary_key)
    rt.start()
    pid = rt.pid

    try:
        # Check command line from OS
        ps_cmd = f"(Get-CimInstance Win32_Process -Filter 'ProcessId = {pid}').CommandLine"
        out = subprocess.check_output(["powershell", "-NoProfile", "-Command", ps_cmd], text=True)
        assert canary_key not in out

        # Check environment dump
        assert os.path.exists(dump_file)
        with open(dump_file, "r", encoding="utf-8") as f:
            dumped = json.load(f)
        assert canary_key not in json.dumps(dumped)

        # Check persona folder files
        persona_root = prof.home.parent
        for root, _, files in os.walk(persona_root):
            for file in files:
                fpath = Path(root) / file
                content = fpath.read_text(encoding="utf-8", errors="ignore")
                assert canary_key not in content, f"Canary key found in file {fpath}"

    finally:
        rt.close()


# Note: Takes about 10-15s against dead URL with fast_fail=False
def test_killing_the_runtime_kills_the_whole_process_tree(tmp_path):
    """Verify cancel() terminates worker, dsh runtime, and echo MCP server subprocesses."""
    out_json = str(tmp_path / "echo_out.json")
    prof = profile_for(
        "usr_test_tree",
        mcp_command=sys.executable,
        mcp_args=[ECHO_MCP_PATH, out_json],
        fast_fail=False,
    )

    rt = AgentRuntime(prof, base_url="http://127.0.0.1:9/v1", api_key="probe-key")
    rt.start()
    worker_pid = rt.pid
    assert worker_pid is not None

    async def _run():
        gen = rt.stream_turn("s-tree", "hello")
        # Let the harness launch and connect to MCP server
        turn_task = asyncio.create_task(gen.__anext__())
        await asyncio.sleep(2.0)

        # Collect descendants
        ps_cmd = (
            f"$pids = @({worker_pid}); "
            f"Get-CimInstance Win32_Process | Where-Object {{ $_.ParentProcessId -eq {worker_pid} }} | "
            f"ForEach-Object {{ $_.ProcessId }}"
        )
        desc_out = subprocess.check_output(["powershell", "-NoProfile", "-Command", ps_cmd], text=True).strip()
        desc_pids = [int(p) for p in desc_out.split() if p.isdigit()]

        echo_pid = None
        if os.path.exists(out_json):
            try:
                with open(out_json, "r", encoding="utf-8") as f:
                    echo_pid = json.load(f).get("pid")
            except Exception:
                pass

        # Cancel the runtime
        rt.cancel()

        try:
            await turn_task
        except Exception:
            pass

        # Verify worker and all descendants are dead within 5s
        deadline = time.time() + 5.0
        while time.time() < deadline:
            all_dead = not is_pid_alive(worker_pid) and all(not is_pid_alive(dp) for dp in desc_pids)
            if echo_pid:
                all_dead = all_dead and not is_pid_alive(echo_pid)
            if all_dead:
                break
            time.sleep(0.2)

        assert not is_pid_alive(worker_pid), f"Worker pid {worker_pid} still alive"
        for dp in desc_pids:
            assert not is_pid_alive(dp), f"Descendant pid {dp} still alive"
        if echo_pid:
            assert not is_pid_alive(echo_pid), f"Echo server pid {echo_pid} still alive"

    try:
        asyncio.run(_run())
    finally:
        rt.close()
