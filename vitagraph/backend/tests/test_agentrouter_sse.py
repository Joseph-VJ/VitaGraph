"""AgentRouter AI Gateway integration & SSE streaming tests.

Verifies:
1. AgentRouter client configuration and environment variables.
2. Tool execution (search_chroma, query_networkx_graph).
3. SSE stream sequence (thinking -> tool_call -> tool_result -> text_delta -> completed).
4. Error resilience: structured event: error emission on gateway failure.
"""

from __future__ import annotations

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services import llm_service
from app.services.job_service import job_broker
from tests.conftest import make_user, sample_pdf
from app.services import report_service

client = TestClient(app)


def _prepare_user_with_report():
    user = make_user("AgentRouter Test User")
    report_service.process_upload(
        user["id"],
        "jan.pdf",
        sample_pdf("synthetic_panel_2025-01-15.pdf"),
    )
    return user


def test_agentrouter_config_and_client_init(monkeypatch):
    """Test 1: Verify AgentRouter client reads effective base_url, api_key, and model."""
    monkeypatch.setattr(settings, "agentrouter_api_key", "sk-agentrouter-test-key-12345")
    monkeypatch.setattr(settings, "agentrouter_base_url", "https://agentrouter.org/v1")
    monkeypatch.setattr(settings, "agentrouter_model", "claude-3-5-sonnet-latest")

    assert settings.effective_api_key == "sk-agentrouter-test-key-12345"
    assert settings.effective_base_url == "https://agentrouter.org/v1"
    assert settings.effective_model == "claude-3-5-sonnet-latest"

    oai_client = llm_service.get_client()
    assert str(oai_client.base_url).rstrip("/") == "https://agentrouter.org/v1"
    assert oai_client.api_key == "sk-agentrouter-test-key-12345"


def test_agentrouter_tool_execution():
    """Test 2: Verify search_chroma and query_networkx_graph tools return structured payloads."""
    user = _prepare_user_with_report()
    uid = user["id"]

    # 1. Test search_chroma
    res_chroma = llm_service.execute_tool("search_chroma", {"query": "Hemoglobin", "top_k": 3}, uid)
    assert "evidence" in res_chroma
    assert len(res_chroma["evidence"]) > 0
    assert any("Hemoglobin" in e["snippet"] for e in res_chroma["evidence"])

    # 2. Test query_networkx_graph
    res_graph = llm_service.execute_tool("query_networkx_graph", {"concept": "Hemoglobin"}, uid)
    assert "nodes" in res_graph
    assert "edges" in res_graph


def test_agentrouter_sse_streaming_sequence(monkeypatch):
    """Test 3: Verify SSE stream emits thinking -> tool_call -> tool_result -> text_delta -> completed."""
    monkeypatch.setattr(settings, "allow_api", True)
    monkeypatch.setattr(settings, "agentrouter_api_key", "sk-test-valid")

    user = _prepare_user_with_report()
    uid = user["id"]

    # Create mock streaming chunks simulating:
    # 1) Thinking block
    # 2) Tool call to search_chroma
    # 3) Tool result returned
    # 4) Synthesis text_delta
    class MockDelta:
        def __init__(self, content=None, reasoning_content=None, tool_calls=None):
            self.content = content
            self.reasoning_content = reasoning_content
            self.tool_calls = tool_calls

    class MockChoice:
        def __init__(self, delta):
            self.delta = delta

    class MockChunk:
        def __init__(self, delta):
            self.choices = [MockChoice(delta)]

    class MockFunction:
        def __init__(self, name, arguments):
            self.name = name
            self.arguments = arguments

    class MockToolCall:
        def __init__(self, index, id, name, arguments):
            self.index = index
            self.id = id
            self.function = MockFunction(name, arguments)

    # First call: thinking + tool call
    async def mock_stream_1(*args, **kwargs):
        yield MockChunk(MockDelta(reasoning_content="Let me search the user's reports for Hemoglobin levels."))
        yield MockChunk(MockDelta(tool_calls=[MockToolCall(0, "call_123", "search_chroma", '{"query": "Hemoglobin"}')]))

    # Second call: final text synthesis
    async def mock_stream_2(*args, **kwargs):
        yield MockChunk(MockDelta(reasoning_content="Now synthesizing the 4-part grounded answer."))
        yield MockChunk(MockDelta(content="SUMMARY:\nYour Hemoglobin in January was 14.1 g/dL.\n\nEVIDENCE:\nPage 1.\n\nLIMITATIONS:\nNo causal inferences.\n\nSAFETY:\nConsult physician."))

    call_count = 0

    async def fake_call_agentrouter(client, messages, model, tools=None):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return mock_stream_1()
        return mock_stream_2()

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call_agentrouter)

    async def _collect():
        events = []
        async for event_type, payload in llm_service.stream_agent_rag(
            user_id=uid,
            question="What was my hemoglobin level?",
        ):
            events.append((event_type, payload))
        return events

    events = asyncio.run(_collect())
    event_types = [e[0] for e in events]

    assert "thinking" in event_types
    assert "tool_call" in event_types
    assert "tool_result" in event_types
    assert "text_delta" in event_types
    assert "completed" in event_types

    # Verify tool_call payload
    tc_event = next(e[1] for e in events if e[0] == "tool_call")
    assert tc_event["tool"] == "search_chroma"
    assert tc_event["arguments"] == {"query": "Hemoglobin"}

    # Verify tool_result payload
    tr_event = next(e[1] for e in events if e[0] == "tool_result")
    assert tr_event["tool"] == "search_chroma"
    assert "evidence" in tr_event["result"]

    # Verify completed event payload
    completed_event = next(e[1] for e in events if e[0] == "completed")
    assert completed_event["status"] == "answered"
    assert "14.1 g/dL" in completed_event["summary_text"]


def test_questions_stream_endpoint_sse_headers(monkeypatch):
    """Test 4: Verify POST /api/questions/stream returns text/event-stream with distinct event: headers."""
    user = _prepare_user_with_report()
    uid = user["id"]
    job_id = "test_q_stream_sse_job"

    res = client.post(
        "/api/questions/stream",
        json={
            "user_id": uid,
            "text": "What was my hemoglobin level?",
            "job_id": job_id,
        },
    )
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    assert res.headers["cache-control"] == "no-cache"

    content = res.text
    assert ": connected to pipeline stream" in content


def test_agentrouter_error_resilience_emits_error_event(monkeypatch):
    """Test 5: Verify that when AgentRouter fails, a structured error event is emitted."""
    monkeypatch.setattr(settings, "allow_api", True)
    monkeypatch.setattr(settings, "agentrouter_api_key", "sk-test-fail")

    async def fail_call(*args, **kwargs):
        raise Exception("AgentRouter gateway timeout 504")

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fail_call)

    async def _collect():
        events = []
        async for event_type, payload in llm_service.stream_agent_rag(
            user_id="any_user",
            question="What were my lab results?",
        ):
            events.append((event_type, payload))
        return events

    events = asyncio.run(_collect())
    assert len(events) == 1
    assert events[0][0] == "error"
    assert "504" in events[0][1]["message"]
    assert events[0][1]["status"] == "error"
