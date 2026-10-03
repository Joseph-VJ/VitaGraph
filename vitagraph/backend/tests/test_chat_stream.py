"""Multi-turn chat: conversation memory, tool loop, hard gates, evidence-only mode, SSE endpoint."""

from __future__ import annotations

import asyncio

import httpx
from fastapi.testclient import TestClient
from openai import BadRequestError, RateLimitError

from app.core.config import settings
from app.main import app
from app.services import chat_service, llm_service, report_service
from tests.conftest import make_user, sample_pdf

client = TestClient(app)


class _Delta:
    def __init__(self, content=None, reasoning_content=None, tool_calls=None):
        self.content = content
        self.reasoning_content = reasoning_content
        self.tool_calls = tool_calls


class _Chunk:
    def __init__(self, delta):
        self.choices = [type("C", (), {"delta": delta})()]


class _Fn:
    def __init__(self, name, arguments):
        self.name = name
        self.arguments = arguments


class _ToolCall:
    def __init__(self, index, id_, name, arguments):
        self.index = index
        self.id = id_
        self.function = _Fn(name, arguments)


def _persona_with_report():
    user = make_user("Chat Test User")
    report_service.process_upload(user["id"], "jan.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    return user


def _enable_ai(monkeypatch):
    monkeypatch.setattr(settings, "allow_api", True)
    monkeypatch.setattr(settings, "agentrouter_api_key", "sk-test-valid")


def _collect(user_id, turns, **kw):
    async def run():
        return [e async for e in chat_service.stream_chat(user_id, turns, **kw)]
    return asyncio.run(run())


def test_history_is_sent_and_tools_loop_produces_numbered_citations(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()
    seen: list[list[dict]] = []
    calls = {"n": 0}

    async def fake_call(client_, messages, model, tools=None):
        seen.append([dict(m) for m in messages])
        calls["n"] += 1

        async def first():
            yield _Chunk(_Delta(reasoning_content="I should look up hemoglobin."))
            yield _Chunk(_Delta(content="Let me check your reports. "))
            yield _Chunk(_Delta(tool_calls=[_ToolCall(0, "call_1", "search_chroma", '{"query": "Hemoglobin"}')]))

        async def second():
            yield _Chunk(_Delta(content="Your hemoglobin is shown in the January panel [1]."))

        return first() if calls["n"] == 1 else second()

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call)
    turns = [
        {"role": "user", "content": "Hi"},
        {"role": "assistant", "content": "Hello! Ask me about your reports."},
        {"role": "user", "content": "What was my hemoglobin?"},
    ]
    events = _collect(user["id"], turns)
    kinds = [k for k, _ in events]

    assert kinds[0] == "thinking"
    assert "tool_call" in kinds and "tool_result" in kinds
    assert kinds[-1] == "completed"
    assert calls["n"] == 2, "one tool round then the final answer"

    first_messages = seen[0]
    assert first_messages[0]["role"] == "system"
    assert [m["content"] for m in first_messages[1:-1]] == ["Hi", "Hello! Ask me about your reports."]
    assert first_messages[-1] == {"role": "user", "content": "What was my hemoglobin?"}
    assert any(m["role"] == "tool" for m in seen[1]), "tool result is fed back to the model"

    done = events[-1][1]
    assert done["status"] == "answered" and done["safety_passed"] is True
    assert done["summary_text"].startswith("Let me check your reports.")
    assert done["evidence"], "citations come from real retrieved passages"
    first = done["evidence"][0]
    assert first["ref"] == 1 and first["char_start"] is not None and first["report_filename"]


def test_boundary_question_is_refused_without_calling_the_model(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()

    async def must_not_run(*a, **k):
        raise AssertionError("model must not be called for a refused question")

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", must_not_run)
    events = _collect(user["id"], [{"role": "user", "content": "Should I stop taking metformin based on my results?"}])
    assert events[-1][0] == "completed"
    assert events[-1][1]["status"] == "refused"
    assert events[0][0] == "text_delta"


def test_evidence_only_mode_quotes_reports_and_never_calls_the_model(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()

    async def must_not_run(*a, **k):
        raise AssertionError("model must not be called in rag_only mode")

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", must_not_run)
    events = _collect(user["id"], [{"role": "user", "content": "What was my hemoglobin?"}], mode="rag_only")
    kinds = [k for k, _ in events]
    assert kinds[:2] == ["tool_call", "tool_result"]
    done = events[-1][1]
    assert done["status"] == "answered" and done["ai_status"] == "not_used"
    assert done["evidence"]


def test_diagnostic_phrasing_is_flagged(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()

    async def fake_call(client_, messages, model, tools=None):
        async def s():
            yield _Chunk(_Delta(content="This confirms that you have anemia."))
        return s()

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call)
    events = _collect(user["id"], [{"role": "user", "content": "Explain my hemoglobin"}])
    done = events[-1][1]
    assert done["safety_passed"] is False and "diagnostic" in done["safety_note"]


def test_model_fallback_moves_to_next_model_before_any_text(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()
    used: list[str] = []

    async def fake_call(client_, messages, model, tools=None):
        used.append(model)
        if len(used) == 1:
            req = httpx.Request("POST", "http://gateway/v1/chat/completions")
            raise RateLimitError("slow down", response=httpx.Response(429, request=req), body=None)

        async def s():
            yield _Chunk(_Delta(content="Hello there."))
        return s()

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call)
    events = _collect(user["id"], [{"role": "user", "content": "Hi"}])
    kinds = [k for k, _ in events]
    assert "model_fallback" in kinds and kinds[-1] == "completed"
    assert len(used) == 2 and used[0] != used[1]


def test_random_content_block_is_retried_on_the_same_model(monkeypatch):
    _enable_ai(monkeypatch)
    monkeypatch.setattr(asyncio, "sleep", lambda *_a, **_k: _noop())
    user = _persona_with_report()
    used: list[str] = []

    async def fake_call(client_, messages, model, tools=None):
        used.append(model)
        if len(used) == 1:
            req = httpx.Request("POST", "http://gateway/v1/chat/completions")
            raise BadRequestError("content-blocked (request id: x)", response=httpx.Response(400, request=req), body=None)

        async def s():
            yield _Chunk(_Delta(content="Here you go."))
        return s()

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call)
    events = _collect(user["id"], [{"role": "user", "content": "Explain my hemoglobin"}])
    kinds = [k for k, _ in events]
    assert kinds[-1] == "completed" and "model_fallback" not in kinds
    assert used[0] == used[1], "second try uses the same model"


async def _noop():
    return None


def test_last_turn_must_be_user():
    events = _collect("any", [{"role": "assistant", "content": "Hello"}])
    assert events[0][0] == "error"


def test_chat_endpoint_streams_sse_and_persists_the_turn(monkeypatch):
    user = _persona_with_report()
    res = client.post("/api/chat/stream", json={
        "user_id": user["id"],
        "messages": [{"role": "user", "content": "What was my hemoglobin?"}],
        "mode": "rag_only",
        "job_id": "chat_sse_test_job",
    })
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    body = res.text
    for name in ("event: tool_call", "event: tool_result", "event: text_delta", "event: completed"):
        assert name in body, name
    qs = client.get(f"/api/timeline/{user['id']}").json()
    assert any(e["event_type"] == "question_asked" for e in qs)


def test_chat_request_validation_and_unknown_user():
    bad = client.post("/api/chat/stream", json={"user_id": "usr_nope", "messages": [{"role": "user", "content": "hi"}]})
    assert bad.status_code in (400, 404)
    empty = client.post("/api/chat/stream", json={"user_id": "x", "messages": []})
    assert empty.status_code == 422
