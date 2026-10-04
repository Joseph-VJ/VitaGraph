"""Startup safety check verifying that the agent runtime is strictly locked down."""

from __future__ import annotations

import hashlib
import os
import uuid
from typing import Any

from app.agent.profile import TOOL_NAMES, PersonaProfile, child_environment, profile_for

_lockdown_cache: dict[str, list[str]] = {}


class LockdownViolation(RuntimeError):
    """Raised when an unapproved tool or configuration violates security lockdown."""


def assert_locked_down(tool_names: list[str]) -> None:
    """Assert that the offered tools match exactly the four allowed VitaGraph tools."""
    expected = sorted(TOOL_NAMES)
    actual = sorted(tool_names)
    if actual != expected:
        raise LockdownViolation(
            f"Lockdown violation: expected tools {expected}, but offered tools were {actual}"
        )


def tool_names_from_events(events: list[dict[str, Any]]) -> list[str]:
    """Extract and sort tool names offered to the model from session events."""
    for event in reversed(events):
        ev_type = event.get("type") or event.get("method") or event.get("name")
        data = event.get("data") if isinstance(event.get("data"), dict) else event
        header = data.get("header") if isinstance(data.get("header"), dict) else {}

        tools = header.get("tools") or data.get("tools") or event.get("tools")
        if tools and (ev_type == "request/header" or "header" in data or "header" in event):
            names = []
            for t in tools:
                if isinstance(t, dict):
                    fn = t.get("function")
                    if isinstance(fn, dict) and "name" in fn:
                        names.append(fn["name"])
                    elif "name" in t:
                        names.append(t["name"])
            if names:
                return sorted(names)
    raise LockdownViolation("No request/header event found with tools in session events.")


def verify_lockdown(
    persona_id: str,
    *,
    profile: PersonaProfile | None = None,
    harness_factory: Any = None,
    api_key: str = "probe-token",
) -> list[str]:
    """Verify that the harness runtime for the persona is strictly locked down.

    Starts the harness against the dead probe URL http://127.0.0.1:9/v1, validates
    that only the four VitaGraph MCP tools are offered in request/header, and closes
    the harness runtime.
    """
    prof = profile or profile_for(persona_id, fast_fail=True)

    hasher = hashlib.sha256()
    for pf in prof.patch_files:
        if pf.exists():
            hasher.update(pf.read_bytes())
    patch_hash = hasher.hexdigest()

    if profile is None and patch_hash in _lockdown_cache:
        return list(_lockdown_cache[patch_hash])

    child_env = child_environment()
    orig_env = dict(os.environ)

    try:
        os.environ.clear()
        os.environ.update(child_env)
        os.environ["DSH_HOME"] = str(prof.home.resolve())

        if harness_factory is not None:
            harness = harness_factory(prof)
        else:
            from deepseek_harness import DeepSeekHarness

            harness = DeepSeekHarness(
                profile="sdk-minimal",
                patches=tuple(str(p.resolve()) for p in prof.patch_files),
                dsh_home=str(prof.home.resolve()),
                cwd=str(prof.workspace.resolve()),
                api_key=api_key,
                base_url="http://127.0.0.1:9/v1",
                env=child_env,
            )
        harness.start()
    finally:
        os.environ.clear()
        os.environ.update(orig_env)

    try:
        session_id = f"probe-{uuid.uuid4().hex[:8]}"
        res = harness.run("hello", session_id=session_id)
        events = getattr(res, "events", []) or []
        tool_names = tool_names_from_events(events)
        assert_locked_down(tool_names)
        if profile is None:
            _lockdown_cache[patch_hash] = list(tool_names)
        return tool_names
    finally:
        harness.close()
