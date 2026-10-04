"""Persona profile management, YAML patch generation, and environment lockdown."""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.config import settings

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

TOOL_NAMES = (
    "mcp__vitagraph__get_measurements",
    "mcp__vitagraph__graph_lookup",
    "mcp__vitagraph__list_reports",
    "mcp__vitagraph__search_reports",
)

SAFE_ENV_ALLOWLIST = {
    "PATH",
    "PATHEXT",
    "SystemRoot",
    "SYSTEMROOT",
    "WINDIR",
    "COMSPEC",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "HOME",
    "PYTHONIOENCODING",
}

_PERSONA_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


@dataclass(frozen=True)
class PersonaProfile:
    persona_id: str
    home: Path
    workspace: Path
    patch_files: tuple[Path, ...]


def agent_root() -> Path:
    """Return the base directory for AI agent data."""
    return settings.data_dir / "agent"


def lock_patch_text(workspace: Path) -> str:
    """Generate YAML patch text that disables shells and restricts workspace to read-only."""
    ws_str = json.dumps(str(workspace.resolve()))
    return (
        "- id: persistent-pwsh\n"
        "  disabled: true\n"
        "- id: persistent-bash\n"
        "  disabled: true\n"
        "- id: sandbox-policy\n"
        "  name: '@deepseek-ai/dsh-sandbox-policy'\n"
        "  config:\n"
        "    mode: read-only\n"
        f"    workspaceRoot: {ws_str}\n"
    )


def mcp_patch_text(
    persona_id: str,
    command: str,
    args: list[str],
    cwd: str,
    env_extra: dict[str, str] | None = None,
) -> str:
    """Generate YAML patch text configuring the VitaGraph MCP tool server."""
    env_dict = {
        "VITAGRAPH_USER_ID": persona_id,
        "DATA_DIR": str(settings.data_dir),
        "UPLOADS_DIR": str(settings.uploads_dir),
        "DB_PATH": str(settings.db_path),
        "CHROMA_DIR": str(settings.chroma_dir),
        "PYTHONIOENCODING": "utf-8",
    }
    if env_extra:
        env_dict.update(env_extra)

    cmd_val = json.dumps(command)
    args_val = json.dumps(args)
    cwd_val = json.dumps(cwd)

    lines = [
        "- insert:",
        "    - id: mcp-vitagraph",
        "      name: '@deepseek-ai/dsh-mcp-client'",
        "      config:",
        "        serverName: vitagraph",
        "        transport: stdio",
        f"        command: {cmd_val}",
        f"        args: {args_val}",
        f"        cwd: {cwd_val}",
        "        env:",
    ]
    for k, v in env_dict.items():
        lines.append(f"          {k}: {json.dumps(v)}")
    return "\n".join(lines) + "\n"


def prompt_patch_text(prompt: str) -> str:
    """Generate YAML patch text configuring the system prompt."""
    prompt_str = json.dumps(prompt)
    return (
        "- id: system-prompt\n"
        "  name: '@deepseek-ai/dsh-system-prompt'\n"
        "  config:\n"
        "    includeHarnessIdentity: false\n"
        "    includeRuntimeContext: false\n"
        f"    personaPrefix: {prompt_str}\n"
    )


def fast_fail_patch_text() -> str:
    """Generate YAML patch text disabling LLM retries for rapid failure in tests."""
    return (
        "- id: llm-retry\n"
        "  disabled: true\n"
    )


def child_environment() -> dict[str, str]:
    """Return a minimal dictionary of environment variables allowed for child processes."""
    minimal = {}
    allowlist_upper = {k.upper() for k in SAFE_ENV_ALLOWLIST}
    for k, v in os.environ.items():
        if k in SAFE_ENV_ALLOWLIST or k.upper() in allowlist_upper:
            minimal[k] = v
    if "PYTHONIOENCODING" not in minimal:
        minimal["PYTHONIOENCODING"] = "utf-8"
    return minimal


def profile_for(
    persona_id: str,
    *,
    mcp_command: str | None = None,
    mcp_args: list[str] | None = None,
    mcp_env_extra: dict[str, str] | None = None,
    fast_fail: bool = False,
) -> PersonaProfile:
    """Create or load the PersonaProfile with verified folders and generated patches."""
    if not persona_id or not _PERSONA_ID_RE.match(persona_id):
        raise ValueError(f"Invalid persona ID: {persona_id!r}")

    root = agent_root() / persona_id
    home = root / "home"
    ws = root / "ws"
    patches = root / "patches"

    home.mkdir(parents=True, exist_ok=True)
    ws.mkdir(parents=True, exist_ok=True)
    patches.mkdir(parents=True, exist_ok=True)

    cmd = mcp_command or sys.executable
    args = mcp_args if mcp_args is not None else ["-m", "app.agent.mcp_server"]
    cwd = str(BACKEND_DIR)

    from app.agent.prompt import AGENT_SYSTEM_PROMPT

    lock_file = patches / "lock.patch.yml"
    mcp_file = patches / "mcp.patch.yml"
    prompt_file = patches / "prompt.patch.yml"

    lock_file.write_text(lock_patch_text(ws), encoding="utf-8")
    mcp_file.write_text(mcp_patch_text(persona_id, cmd, args, cwd, mcp_env_extra), encoding="utf-8")
    prompt_file.write_text(prompt_patch_text(AGENT_SYSTEM_PROMPT), encoding="utf-8")

    patch_list = [lock_file, mcp_file, prompt_file]
    if fast_fail:
        fast_fail_file = patches / "fast-fail.patch.yml"
        fast_fail_file.write_text(fast_fail_patch_text(), encoding="utf-8")
        patch_list.append(fast_fail_file)

    return PersonaProfile(
        persona_id=persona_id,
        home=home,
        workspace=ws,
        patch_files=tuple(patch_list),
    )
