"""Tests for the locked-down agent profile, prompt, and startup lockdown check."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest
import yaml

from app.core.config import settings

BACKEND_DIR = Path(__file__).resolve().parent.parent


def test_the_profile_folders_are_inside_the_agent_data_root_and_the_persona_id_is_checked(tmp_path):
    """Verify profile_for creates home, ws, patches folders under agent root and validates persona IDs."""
    from app.agent.profile import profile_for

    prof = profile_for("usr_abc123")
    expected_root = settings.data_dir / "agent" / "usr_abc123"
    assert prof.home == expected_root / "home"
    assert prof.workspace == expected_root / "ws"
    assert (expected_root / "patches").is_dir()
    assert prof.home.is_dir()
    assert prof.workspace.is_dir()

    invalid_ids = ["", "../x", "usr a", "usr/x", "a" * 200]
    for bad_id in invalid_ids:
        with pytest.raises(ValueError):
            profile_for(bad_id)


def test_the_lock_patch_disables_both_shells_and_restates_the_sandbox_row():
    """Verify lock.patch.yml disables pwsh/bash and restates sandbox-policy in read-only mode."""
    from app.agent.profile import lock_patch_text

    ws_path = Path(r"C:\test\agent\ws").resolve()
    patch_str = lock_patch_text(ws_path)
    data = yaml.safe_load(patch_str)

    # Must be list of patch entries
    assert isinstance(data, list)
    rows_by_id = {item.get("id"): item for item in data if isinstance(item, dict) and "id" in item}

    # persistent-pwsh and persistent-bash disabled
    assert rows_by_id.get("persistent-pwsh", {}).get("disabled") is True
    assert rows_by_id.get("persistent-bash", {}).get("disabled") is True

    # sandbox-policy restated as read-only with literal absolute path
    sb = rows_by_id.get("sandbox-policy", {})
    assert sb.get("name") == "@deepseek-ai/dsh-sandbox-policy"
    cfg = sb.get("config", {})
    assert cfg.get("mode") == "read-only"
    assert cfg.get("workspaceRoot") == str(ws_path)
    assert "process.cwd()" not in patch_str


def test_the_mcp_patch_sets_the_persona_explicitly_and_contains_no_secret():
    """Verify mcp.patch.yml sets explicit env variables with persona, DB paths, and no secrets."""
    from app.agent.profile import mcp_patch_text

    patch_str = mcp_patch_text("usr_target123", sys.executable, ["-m", "app.agent.mcp_server"], str(BACKEND_DIR))
    data = yaml.safe_load(patch_str)

    assert isinstance(data, list)
    insert_entry = next((item for item in data if "- insert:" in yaml.dump(item) or "insert" in item), data[0])
    row = insert_entry.get("insert", insert_entry)
    if isinstance(row, list):
        row = row[0]

    assert row.get("name") == "@deepseek-ai/dsh-mcp-client"
    cfg = row.get("config", {})
    assert cfg.get("serverName") == "vitagraph"
    assert cfg.get("transport") == "stdio"
    assert cfg.get("cwd") == str(BACKEND_DIR)

    env = cfg.get("env", {})
    assert env.get("VITAGRAPH_USER_ID") == "usr_target123"
    assert env.get("DATA_DIR") == str(settings.data_dir)
    assert env.get("UPLOADS_DIR") == str(settings.uploads_dir)
    assert env.get("DB_PATH") == str(settings.db_path)
    assert env.get("CHROMA_DIR") == str(settings.chroma_dir)

    # Contains no secrets or key tokens
    lower_str = patch_str.lower()
    assert "api_key" not in lower_str
    assert "token" not in lower_str
    if settings.effective_api_key:
        assert settings.effective_api_key not in patch_str


def test_the_prompt_patch_replaces_the_system_prompt():
    """Verify prompt.patch.yml targets system-prompt and personaPrefix with AGENT_SYSTEM_PROMPT."""
    from app.agent.profile import prompt_patch_text
    from app.agent.prompt import AGENT_SYSTEM_PROMPT

    patch_str = prompt_patch_text(AGENT_SYSTEM_PROMPT)
    data = yaml.safe_load(patch_str)
    assert isinstance(data, list)

    row = data[0]
    assert row.get("id") == "system-prompt" or row.get("name") == "@deepseek-ai/dsh-system-prompt"
    cfg = row.get("config", {})
    assert cfg.get("personaPrefix") == AGENT_SYSTEM_PROMPT


def test_the_agent_prompt_keeps_every_boundary_of_the_chat_prompt():
    """Verify AGENT_SYSTEM_PROMPT keeps all clinical boundaries and mentions tools, not shells."""
    from app.agent.prompt import AGENT_SYSTEM_PROMPT

    for required in [
        "Never diagnose",
        "Never recommend",
        "urgent",
        "General information (not from your reports):",
        "[1]",
        "list_reports",
        "search_reports",
        "get_measurements",
        "graph_lookup",
    ]:
        assert required in AGENT_SYSTEM_PROMPT, f"Missing required substring: {required}"

    lower_prompt = AGENT_SYSTEM_PROMPT.lower()
    for forbidden in ["shell", "bash", "powershell", "file system"]:
        assert forbidden not in lower_prompt, f"Forbidden word found in prompt: {forbidden}"


def test_the_child_environment_is_minimal():
    """Verify child_environment strips ambient variables and allows only an explicit safe list."""
    from app.agent.profile import child_environment

    orig_env = dict(os.environ)
    try:
        os.environ["VITAGRAPH_USER_ID"] = "ambient_user"
        os.environ["AG2_CANARY"] = "leak"
        os.environ["DEEPSEEK_API_KEY"] = "sk-canary"
        os.environ["AGENTROUTER_API_KEY"] = "sk-canary2"

        env = child_environment()
        for forbidden in ["VITAGRAPH_USER_ID", "AG2_CANARY", "DEEPSEEK_API_KEY", "AGENTROUTER_API_KEY"]:
            assert forbidden not in env

        allowed_keys = {
            "PATH", "PATHEXT", "SystemRoot", "SYSTEMROOT", "WINDIR", "COMSPEC",
            "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOME",
            "PYTHONIOENCODING",
        }
        for k in env:
            assert k in allowed_keys or k.upper() in allowed_keys, f"Disallowed environment variable: {k}"
    finally:
        os.environ.clear()
        os.environ.update(orig_env)


def test_lockdown_check_accepts_exactly_the_four_tools_and_refuses_anything_else():
    """Verify assert_locked_down accepts only the four tools and raises LockdownViolation otherwise."""
    from app.agent.lockdown import LockdownViolation, assert_locked_down

    valid_tools = [
        "mcp__vitagraph__get_measurements",
        "mcp__vitagraph__graph_lookup",
        "mcp__vitagraph__list_reports",
        "mcp__vitagraph__search_reports",
    ]
    # Passes without raising
    assert_locked_down(valid_tools)

    # Extra tool (e.g. pwsh)
    with pytest.raises(LockdownViolation):
        assert_locked_down(valid_tools + ["pwsh"])

    # Missing tool
    with pytest.raises(LockdownViolation):
        assert_locked_down(valid_tools[:3])

    # Empty list
    with pytest.raises(LockdownViolation):
        assert_locked_down([])


# Note: Takes about 10-15s as it starts a real dsh runtime with probe against dead URL
def test_a_real_runtime_is_locked_down_and_the_persona_cannot_be_overridden(tmp_path):
    """Verify real dsh runtime offers exactly the 4 tools, isolates persona, and leaks no keys."""
    from app.agent.lockdown import verify_lockdown
    from app.agent.profile import profile_for

    echo_server_path = str(BACKEND_DIR / "tests" / "fixtures" / "echo_mcp_server.py")
    out_json = str(tmp_path / "echo_env.json")

    prof = profile_for(
        "usr_test_ag2",
        mcp_command=sys.executable,
        mcp_args=[echo_server_path, out_json],
        fast_fail=True,
    )

    orig_env = dict(os.environ)
    try:
        os.environ["VITAGRAPH_USER_ID"] = "ambient_user"
        os.environ["AG2_CANARY"] = "leak"
        os.environ["DEEPSEEK_API_KEY"] = "sk-canary"
        os.environ["AGENTROUTER_API_KEY"] = "sk-canary2"

        canary_key = "AG2-CANARY-KEY-123456"
        tool_names = verify_lockdown("usr_test_ag2", profile=prof, api_key=canary_key)

        expected_tools = [
            "mcp__vitagraph__get_measurements",
            "mcp__vitagraph__graph_lookup",
            "mcp__vitagraph__list_reports",
            "mcp__vitagraph__search_reports",
        ]
        assert tool_names == expected_tools

        # Verify output file written by echo_mcp_server
        assert os.path.exists(out_json), "Echo MCP server did not write output JSON"
        with open(out_json, "r", encoding="utf-8") as f:
            dumped = json.load(f)

        assert dumped.get("persona") == "usr_test_ag2", f"Persona leaked! Got {dumped.get('persona')}"
        assert dumped.get("canary") is None, f"Canary leaked! Got {dumped.get('canary')}"
        assert dumped.get("deepseek_key") is None, f"Deepseek key leaked! Got {dumped.get('deepseek_key')}"
        assert dumped.get("agentrouter_key") is None, f"Agentrouter key leaked! Got {dumped.get('agentrouter_key')}"

        # Key hygiene: canary_key must not be anywhere under home or patches folders
        for root, _, files in os.walk(prof.home):
            for file in files:
                fpath = Path(root) / file
                content = fpath.read_text(encoding="utf-8", errors="ignore")
                assert canary_key not in content, f"Canary key found in home file: {fpath}"

        patches_dir = prof.home.parent / "patches"
        for root, _, files in os.walk(patches_dir):
            for file in files:
                fpath = Path(root) / file
                content = fpath.read_text(encoding="utf-8", errors="ignore")
                assert canary_key not in content, f"Canary key found in patch file: {fpath}"

    finally:
        os.environ.clear()
        os.environ.update(orig_env)