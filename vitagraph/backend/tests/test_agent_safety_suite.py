"""Final safety suite for the agent features (Task F3)."""

from __future__ import annotations

import asyncio
from typing import Any

from mcp.client.session import ClientSession

from tests.conftest import make_user
from tests.test_agent_mcp_server import _run_mcp_session
from tests.test_agent_service import FakePool, _collect


def test_boundary_refusal_in_a_resumed_conversation_starts_no_runtime():
    """Verify that a boundary question in a resumed conversation is refused without starting any runtime."""
    user = make_user("Resumed Safety Persona")
    pool = FakePool()
    turns = [
        {"role": "user", "content": "What was my hemoglobin?"},
        {"role": "assistant", "content": "Your hemoglobin was 14.2 g/dL."},
        {"role": "user", "content": "Do I have diabetes? Please diagnose me."},
    ]

    events = _collect(user["id"], turns, pool=pool, conversation_id="conv_safety")
    assert pool.calls == []

    types = [e[0] for e in events]
    assert types == ["text_delta", "completed", "done"]


def _walk_schema_properties(node: Any) -> list[str]:
    """Recursively collect all property names from a JSON schema structure."""
    props: list[str] = []
    if isinstance(node, dict):
        if "properties" in node and isinstance(node["properties"], dict):
            for prop_name, prop_val in node["properties"].items():
                props.append(prop_name)
                props.extend(_walk_schema_properties(prop_val))
        for key, val in node.items():
            if key != "properties":
                props.extend(_walk_schema_properties(val))
    elif isinstance(node, list):
        for item in node:
            props.extend(_walk_schema_properties(item))
    return props


def test_no_tool_accepts_a_persona_argument_at_any_depth():
    """Walk every input schema of the vitagraph server's tools recursively.

    No property name contains 'user', 'persona', 'patient' or 'owner', ignoring case.
    """
    user = make_user("Safety Tool Schema Persona")

    async def _list(session: ClientSession):
        return await session.list_tools()

    tools_res = asyncio.run(_run_mcp_session(user["id"], _list))
    assert len(tools_res.tools) == 4

    forbidden_tokens = ("user", "persona", "patient", "owner")

    for tool in tools_res.tools:
        schema = getattr(tool, "input_schema", None) or getattr(tool, "inputSchema", {})
        if hasattr(schema, "model_dump"):
            schema = schema.model_dump()
        elif hasattr(schema, "dict"):
            schema = schema.dict()

        properties = _walk_schema_properties(schema)
        for prop in properties:
            lowered = prop.lower()
            for token in forbidden_tokens:
                assert token not in lowered, (
                    f"Tool '{tool.name}' exposes forbidden property '{prop}' (contains '{token}')"
                )
