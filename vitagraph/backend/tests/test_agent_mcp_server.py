"""Tests for the VitaGraph MCP tool server for the AI Agent."""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

from app.core.database import get_db
from app.services import report_service
from tests.conftest import make_user, sample_pdf

BACKEND_DIR = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def personas():
    """Create two personas with ingested test reports."""
    user_a = make_user("Persona A")
    rep_a = report_service.process_upload(
        user_a["id"],
        "synthetic_panel_2025-01-15.pdf",
        sample_pdf("synthetic_panel_2025-01-15.pdf"),
    )
    user_b = make_user("Persona B")
    rep_b = report_service.process_upload(
        user_b["id"],
        "synthetic_panel_2025-06-20.pdf",
        sample_pdf("synthetic_panel_2025-06-20.pdf"),
    )
    return {
        "A": {"user_id": user_a["id"], "report_id": rep_a["id"], "filename": "synthetic_panel_2025-01-15.pdf"},
        "B": {"user_id": user_b["id"], "report_id": rep_b["id"], "filename": "synthetic_panel_2025-06-20.pdf"},
    }


async def _run_mcp_session(persona_id: str, action):
    """Start an MCP stdio client connected to app.agent.mcp_server and run action."""
    env = dict(os.environ)
    env["VITAGRAPH_USER_ID"] = persona_id
    params = StdioServerParameters(
        command=sys.executable,
        args=["-m", "app.agent.mcp_server"],
        env=env,
        cwd=str(BACKEND_DIR),
    )
    async with asyncio.timeout(180):
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                return await action(session)


def call_mcp_tool(persona_id: str, tool_name: str, arguments: dict | None = None) -> dict:
    """Helper to invoke a single tool and parse JSON result text."""
    async def _action(session: ClientSession):
        res = await session.call_tool(tool_name, arguments or {})
        text = res.content[0].text if res.content else ""
        return json.loads(text) if text else {}

    return asyncio.run(_run_mcp_session(persona_id, _action))


def test_the_server_offers_exactly_four_tools_without_any_persona_parameter(personas):
    """Verify tool discovery: exactly 4 tools, non-empty docstrings, no persona parameter."""
    async def _list(session: ClientSession):
        return await session.list_tools()

    tools_res = asyncio.run(_run_mcp_session(personas["A"]["user_id"], _list))
    tools = {t.name: t for t in tools_res.tools}
    assert sorted(tools.keys()) == ["get_measurements", "graph_lookup", "list_reports", "search_reports"]

    forbidden_names = {"user_id", "persona", "user", "owner", "id"}
    for name, tool in tools.items():
        assert tool.description and len(tool.description.strip()) > 0
        schema = getattr(tool, "input_schema", None) or getattr(tool, "inputSchema", {})
        if hasattr(schema, "model_dump"):
            schema = schema.model_dump()
        elif hasattr(schema, "dict"):
            schema = schema.dict()
        properties = schema.get("properties", {}) if isinstance(schema, dict) else {}
        for prop in properties:
            assert prop.lower() not in forbidden_names, f"Tool {name} exposes forbidden parameter '{prop}'"


def test_list_reports_returns_only_the_personas_own_reports(personas):
    """Verify list_reports returns only the persona's own ingested reports."""
    res_a = call_mcp_tool(personas["A"]["user_id"], "list_reports")
    reps_a = res_a.get("reports", [])
    assert len(reps_a) == 1
    assert reps_a[0]["report_id"] == personas["A"]["report_id"]
    assert reps_a[0]["filename"] == personas["A"]["filename"]
    assert "report_date" in reps_a[0]
    assert "page_count" in reps_a[0]

    res_b = call_mcp_tool(personas["B"]["user_id"], "list_reports")
    reps_b = res_b.get("reports", [])
    assert len(reps_b) == 1
    assert reps_b[0]["report_id"] == personas["B"]["report_id"]
    assert reps_b[0]["filename"] == personas["B"]["filename"]
    assert "report_date" in reps_b[0]
    assert "page_count" in reps_b[0]


def test_search_returns_numbered_evidence_cards_with_exact_character_offsets(personas):
    """Verify search_reports returns numbered evidence cards with valid spans and stable refs."""
    async def _multi_search(session: ClientSession):
        # First call: also verifies test_the_protocol_survives_the_embedding_model_load
        r1 = await session.call_tool("search_reports", {"query": "Hemoglobin"})
        t1 = json.loads(r1.content[0].text)

        # Second identical call: ref numbers must remain stable per chunk_id
        r2 = await session.call_tool("search_reports", {"query": "Hemoglobin"})
        t2 = json.loads(r2.content[0].text)

        # Third call with new term: refs must continue
        r3 = await session.call_tool("search_reports", {"query": "Glucose"})
        t3 = json.loads(r3.content[0].text)
        return t1, t2, t3

    t1, t2, t3 = asyncio.run(_run_mcp_session(personas["A"]["user_id"], _multi_search))

    evidence1 = t1.get("evidence", [])
    assert len(evidence1) > 0

    required_keys = {
        "ref", "chunk_id", "report_id", "report_filename",
        "report_date", "page_number", "snippet", "score",
        "char_start", "char_end",
    }
    refs1 = [c["ref"] for c in evidence1]
    assert refs1 == list(range(1, len(evidence1) + 1))

    for card in evidence1:
        assert required_keys.issubset(card.keys())
        assert isinstance(card["char_start"], int)
        assert isinstance(card["char_end"], int)
        assert card["char_start"] < card["char_end"]

        with get_db() as db:
            row = db.execute(
                "SELECT extracted_text FROM report_pages WHERE report_id = ? AND page_number = ?",
                (card["report_id"], card["page_number"]),
            ).fetchone()
            assert row is not None, f"Page not found for card {card}"
            page_text = row["extracted_text"]
            span = page_text[card["char_start"]:card["char_end"]].strip()
            snip_prefix = card["snippet"].strip()[:40]
            assert span.startswith(snip_prefix), (
                f"Card span '{span[:40]}' does not match snippet prefix '{snip_prefix}'"
            )

    # Numbering stability: second identical call returns exact same refs
    evidence2 = t2.get("evidence", [])
    map1 = {c["chunk_id"]: c["ref"] for c in evidence1}
    for card in evidence2:
        if card["chunk_id"] in map1:
            assert card["ref"] == map1[card["chunk_id"]]

    # New term continues numbering
    evidence3 = t3.get("evidence", [])
    for card in evidence3:
        if card["chunk_id"] not in map1:
            assert card["ref"] > len(evidence1)


def test_a_persona_can_not_read_another_personas_report(personas):
    """Verify cross-persona access is rejected with exact standard error message."""
    expected_err = {"error": "Report not found for this persona."}

    # Persona A attempts to get measurements of Persona B's report
    res_m = call_mcp_tool(personas["A"]["user_id"], "get_measurements", {"report_id": personas["B"]["report_id"]})
    assert res_m == expected_err

    # Persona A attempts to search with Persona B's report_id filter
    res_s = call_mcp_tool(personas["A"]["user_id"], "search_reports", {
        "query": "Hemoglobin",
        "report_id": personas["B"]["report_id"],
    })
    assert res_s == expected_err

    # Unfiltered search by Persona A must never return Persona B's files
    res_unfiltered = call_mcp_tool(personas["A"]["user_id"], "search_reports", {"query": "Hemoglobin"})
    for card in res_unfiltered.get("evidence", []):
        assert card["report_filename"] == personas["A"]["filename"]


def test_get_measurements_returns_the_values_of_the_report(personas):
    """Verify get_measurements returns lab values from the specified report."""
    res = call_mcp_tool(personas["A"]["user_id"], "get_measurements", {"report_id": personas["A"]["report_id"]})
    assert res.get("report_id") == personas["A"]["report_id"]
    measurements = res.get("measurements", [])
    assert len(measurements) > 0

    hemo = next((m for m in measurements if m.get("test_name") == "Hemoglobin" or m.get("name") == "Hemoglobin"), None)
    assert hemo is not None, f"Hemoglobin measurement missing from {measurements}"
    assert float(hemo["value"]) == 13.8
    assert hemo.get("unit") == "g/dL"


def test_graph_lookup_returns_matching_nodes_for_the_persona(personas):
    """Verify graph_lookup returns matching nodes from the persona's knowledge graph."""
    res = call_mcp_tool(personas["A"]["user_id"], "graph_lookup", {"concept": "Hemoglobin"})
    assert "matched_nodes" in res
    assert res["matched_nodes"] >= 1
    assert "nodes" in res


def test_the_server_refuses_to_start_without_a_valid_persona():
    """Verify server exits with non-zero code, empty stdout, and stderr message if persona is invalid."""
    base_env = dict(os.environ)

    # 1. Variable missing
    env1 = dict(base_env)
    env1.pop("VITAGRAPH_USER_ID", None)
    p1 = subprocess.run(
        [sys.executable, "-m", "app.agent.mcp_server"],
        env=env1,
        cwd=str(BACKEND_DIR),
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert p1.returncode != 0
    assert p1.stdout == ""
    assert len(p1.stderr.strip()) > 0

    # 2. Variable empty
    env2 = dict(base_env)
    env2["VITAGRAPH_USER_ID"] = ""
    p2 = subprocess.run(
        [sys.executable, "-m", "app.agent.mcp_server"],
        env=env2,
        cwd=str(BACKEND_DIR),
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert p2.returncode != 0
    assert p2.stdout == ""
    assert len(p2.stderr.strip()) > 0

    # 3. Variable non-existent persona
    env3 = dict(base_env)
    env3["VITAGRAPH_USER_ID"] = "usr_does_not_exist"
    p3 = subprocess.run(
        [sys.executable, "-m", "app.agent.mcp_server"],
        env=env3,
        cwd=str(BACKEND_DIR),
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert p3.returncode != 0
    assert p3.stdout == ""
    assert len(p3.stderr.strip()) > 0


def test_the_protocol_survives_the_embedding_model_load(personas):
    """Verify protocol integrity survives embedding model initialization on first search."""
    # First search call inside a fresh server session triggers SentenceTransformer load
    res = call_mcp_tool(personas["A"]["user_id"], "search_reports", {"query": "Hemoglobin"})
    assert "evidence" in res
    assert len(res["evidence"]) > 0


def test_reference_numbers_stay_unique_under_parallel_searches(personas):
    """Verify ref numbers remain unique and 1..N continuous under concurrent searches."""
    async def _action(session: ClientSession):
        task1 = session.call_tool("search_reports", {"query": "Hemoglobin", "top_k": 8})
        task2 = session.call_tool("search_reports", {"query": "Glucose", "top_k": 8})
        res1, res2 = await asyncio.gather(task1, task2)

        cards1 = json.loads(res1.content[0].text).get("evidence", [])
        cards2 = json.loads(res2.content[0].text).get("evidence", [])
        all_cards = cards1 + cards2
        assert len(all_cards) > 0

        # All returned ref values for DIFFERENT chunk_ids are different
        # Same chunk_id always has the same ref
        chunk_to_refs: dict[str, int] = {}
        ref_to_chunks: dict[int, str] = {}
        for card in all_cards:
            cid = card["chunk_id"]
            ref = card["ref"]
            if cid in chunk_to_refs:
                assert chunk_to_refs[cid] == ref, f"Chunk {cid} has multiple refs: {chunk_to_refs[cid]} and {ref}"
            else:
                chunk_to_refs[cid] = ref

            if ref in ref_to_chunks:
                assert ref_to_chunks[ref] == cid, f"Ref {ref} assigned to multiple chunks: {ref_to_chunks[ref]} and {cid}"
            else:
                ref_to_chunks[ref] = cid

        # Union of refs is 1..N without gaps
        unique_refs = sorted(set(card["ref"] for card in all_cards))
        assert unique_refs == list(range(1, len(unique_refs) + 1))

    asyncio.run(_run_mcp_session(personas["A"]["user_id"], _action))


def test_format_json_always_returns_valid_json_within_the_limit():
    """Verify _format_json always produces valid JSON <= 12000 chars, with truncated=true when oversized."""
    from app.agent.mcp_server import _format_json

    # (a) A payload with three long lists
    long_list_payload = {
        "list1": [{"item": i, "data": "x" * 200} for i in range(50)],
        "list2": [{"item": i, "data": "y" * 200} for i in range(50)],
        "list3": [{"item": i, "data": "z" * 200} for i in range(50)],
    }
    res_a = _format_json(long_list_payload)
    parsed_a = json.loads(res_a)
    assert len(res_a) <= 12000
    assert parsed_a.get("truncated") is True

    # (b) A payload that is one string of 50,000 characters
    huge_str_payload = {"huge": "a" * 50000}
    res_b = _format_json(huge_str_payload)
    parsed_b = json.loads(res_b)
    assert len(res_b) <= 12000
    assert parsed_b.get("truncated") is True

    # (c) A small payload
    small_payload = {"ok": True, "items": [1, 2, 3]}
    res_c = _format_json(small_payload)
    parsed_c = json.loads(res_c)
    assert len(res_c) <= 12000
    assert parsed_c == small_payload
    assert "truncated" not in parsed_c
