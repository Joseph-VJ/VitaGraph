"""Responses-API adapter, loopback translation route and settings switch (mocked endpoint only)."""

from __future__ import annotations

import asyncio
import json

import httpx
import openai
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, settings
from app.generation import ai_client
from app.main import app
from app.services import responses_adapter as adapter

REAL_KEY = "sk-real-secret-key-0123456789"
BASE = "https://models.example/v1"


@pytest.fixture
def responses_mode(monkeypatch):
    monkeypatch.setattr(settings, "allow_api", True)
    monkeypatch.setattr(settings, "model_api_key", REAL_KEY)
    monkeypatch.setattr(settings, "model_api_url", BASE)
    monkeypatch.setattr(settings, "model_api_format", "responses")
    monkeypatch.setattr(settings, "agentrouter_api_key", REAL_KEY)
    monkeypatch.setattr(settings, "agentrouter_base_url", BASE)
    monkeypatch.setattr(settings, "agentrouter_model", "test-model")
    monkeypatch.setattr(settings, "model_reasoning_effort", "medium")
    assert settings.api_format == "responses"


def sse(*events: dict) -> bytes:
    return "".join(f"event: {e['type']}\ndata: {json.dumps(e)}\n\n" for e in events).encode()


def serve(monkeypatch, handler):
    """Route every adapter call through a mock transport."""
    original = adapter.open_stream

    def wrapped(*args, **kwargs):
        return original(*args, transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(adapter, "open_stream", wrapped)


def ok(body: bytes):
    return lambda request: httpx.Response(200, content=body, headers={"content-type": "text/event-stream"})


TEXT_STREAM = sse(
    {"type": "response.created", "response": {"id": "r1"}},
    {"type": "response.reasoning_summary_text.delta", "delta": "thinking "},
    {"type": "response.output_text.delta", "delta": "Hello"},
    {"type": "response.output_text.delta", "delta": " there"},
    {
        "type": "response.completed",
        "response": {"usage": {"input_tokens": 11, "output_tokens": 4, "total_tokens": 15}},
    },
)

TOOL_STREAM = sse(
    {
        "type": "response.output_item.added",
        "output_index": 0,
        "item": {"type": "function_call", "id": "fc_1", "call_id": "call_1", "name": "search_reports"},
    },
    {"type": "response.function_call_arguments.delta", "item_id": "fc_1", "output_index": 0, "delta": '{"query":'},
    {"type": "response.function_call_arguments.delta", "item_id": "fc_1", "output_index": 0, "delta": '"iron"}'},
    {"type": "response.completed", "response": {}},
)


async def collect(monkeypatch_unused=None, **kwargs):
    client = adapter.ResponsesClient()
    stream = await client.chat.completions.create(stream=True, **kwargs)
    return [chunk async for chunk in stream]


# ------------------------------------------------------------------ request


def test_request_matches_the_documented_shape(responses_mode):
    body = adapter.build_request(
        [
            {"role": "system", "content": "Be careful."},
            {"role": "user", "content": "What was my iron?"},
            {
                "role": "assistant",
                "content": "Looking.",
                "tool_calls": [{"id": "c1", "type": "function", "function": {"name": "t", "arguments": '{"a":1}'}}],
            },
            {"role": "tool", "tool_call_id": "c1", "content": '{"ok":true}'},
        ],
        model="test-model",
        tools=[{"type": "function", "function": {"name": "t", "description": "d", "parameters": {"type": "object"}}}],
        tool_choice="auto",
    )
    assert body["instructions"] == "Be careful."
    assert body["input"] == [
        {"role": "user", "content": "What was my iron?"},
        {"role": "assistant", "content": "Looking."},
        {"type": "function_call", "call_id": "c1", "name": "t", "arguments": '{"a":1}'},
        {"type": "function_call_output", "call_id": "c1", "output": '{"ok":true}'},
    ]
    assert body["tools"] == [{"type": "function", "name": "t", "description": "d", "parameters": {"type": "object"}}]
    assert body["tool_choice"] == "auto"
    assert body["stream"] is True
    assert (body["temperature"], body["top_p"], body["max_output_tokens"]) == (1.0, 1.0, 50107)
    assert body["reasoning"] == {"effort": "medium", "summary": "auto"}


def test_reasoning_can_be_switched_off(responses_mode, monkeypatch):
    monkeypatch.setattr(settings, "model_reasoning_effort", "")
    assert "reasoning" not in adapter.build_request([{"role": "user", "content": "hi"}], model="m")


def test_the_url_gets_exactly_one_responses_suffix():
    assert adapter.responses_url("https://x/v1") == "https://x/v1/responses"
    assert adapter.responses_url("https://x/v1/responses") == "https://x/v1/responses"


# ------------------------------------------------------------------- stream


def test_text_reasoning_and_usage_become_chat_chunks(responses_mode, monkeypatch):
    seen = {}

    def handler(request: httpx.Request):
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["accept"] = request.headers["accept"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, content=TEXT_STREAM, headers={"content-type": "text/event-stream"})

    serve(monkeypatch, handler)
    chunks = asyncio.run(collect(model="test-model", messages=[{"role": "user", "content": "hi"}]))

    assert seen["url"] == f"{BASE}/responses"
    assert seen["auth"] == f"Bearer {REAL_KEY}"
    assert seen["accept"] == "text/event-stream"
    assert seen["body"]["stream"] is True

    deltas = [c.choices[0].delta for c in chunks if c.choices]
    assert "".join(d.content or "" for d in deltas) == "Hello there"
    assert "".join(getattr(d, "reasoning_content", None) or "" for d in deltas) == "thinking "
    last = chunks[-1]
    assert last.choices[0].finish_reason == "stop"
    assert (last.usage.prompt_tokens, last.usage.completion_tokens, last.usage.total_tokens) == (11, 4, 15)


def test_a_tool_call_streams_name_id_and_arguments(responses_mode, monkeypatch):
    serve(monkeypatch, ok(TOOL_STREAM))
    chunks = asyncio.run(collect(model="test-model", messages=[{"role": "user", "content": "hi"}]))
    calls: dict[int, dict] = {}
    for chunk in chunks:
        for tc in chunk.choices[0].delta.tool_calls or []:
            slot = calls.setdefault(tc.index, {"id": "", "name": "", "args": ""})
            slot["id"] = tc.id or slot["id"]
            slot["name"] += (tc.function.name or "") if tc.function else ""
            slot["args"] += (tc.function.arguments or "") if tc.function else ""
    assert calls == {0: {"id": "call_1", "name": "search_reports", "args": '{"query":"iron"}'}}
    assert chunks[-1].choices[0].finish_reason == "tool_calls"


def test_arguments_that_only_arrive_in_the_done_event_are_not_lost(responses_mode, monkeypatch):
    body = sse(
        {"type": "response.output_item.added", "output_index": 0, "item": {"type": "function_call", "id": "f", "call_id": "c", "name": "t"}},
        {"type": "response.output_item.done", "output_index": 0, "item": {"type": "function_call", "id": "f", "arguments": '{"x":2}'}},
        {"type": "response.completed", "response": {}},
    )
    serve(monkeypatch, ok(body))
    chunks = asyncio.run(collect(model="m", messages=[{"role": "user", "content": "hi"}]))
    args = "".join(
        tc.function.arguments or "" for c in chunks for tc in (c.choices[0].delta.tool_calls or []) if tc.function
    )
    assert args == '{"x":2}'


def test_non_streamed_call_returns_one_completion(responses_mode, monkeypatch):
    serve(monkeypatch, ok(TEXT_STREAM))

    async def run():
        return await adapter.ResponsesClient().chat.completions.create(
            model="m", messages=[{"role": "user", "content": "hi"}], stream=False
        )

    result = asyncio.run(run())
    assert result.choices[0].message.content == "Hello there"
    assert result.usage.total_tokens == 15


def test_a_stream_that_ends_without_a_completed_event_still_finishes(responses_mode, monkeypatch):
    serve(monkeypatch, ok(sse({"type": "response.output_text.delta", "delta": "partial"})))
    chunks = asyncio.run(collect(model="m", messages=[{"role": "user", "content": "hi"}]))
    assert chunks[-1].choices[0].finish_reason == "stop"


def test_a_failure_inside_the_stream_is_raised(responses_mode, monkeypatch):
    serve(monkeypatch, ok(sse({"type": "response.failed", "response": {"error": {"message": "model overloaded"}}})))
    with pytest.raises(adapter.ResponsesStreamError, match="model overloaded"):
        asyncio.run(collect(model="m", messages=[{"role": "user", "content": "hi"}]))


@pytest.mark.parametrize(
    ("status", "error_class"),
    [
        (401, openai.AuthenticationError),
        (403, openai.PermissionDeniedError),
        (404, openai.NotFoundError),
        (429, openai.RateLimitError),
        (503, openai.InternalServerError),
    ],
)
def test_http_errors_become_the_exceptions_the_fallback_code_expects(responses_mode, monkeypatch, status, error_class):
    serve(monkeypatch, lambda request: httpx.Response(status, json={"error": {"message": "nope"}}))
    with pytest.raises(error_class, match="nope"):
        asyncio.run(collect(model="m", messages=[{"role": "user", "content": "hi"}]))


# --------------------------------------------------------- settings / routing


def test_the_key_url_and_model_are_applied_together(monkeypatch):
    for name in ("MODEL_API_KEY", "MODEL_API_URL", "MODEL_NAME", "MODEL_API_FORMAT"):
        monkeypatch.delenv(name, raising=False)
    s = Settings(
        _env_file=None,
        agentrouter_api_key="old-gateway-key",
        model_api_key="new-key",
        model_api_url="https://models.example/v1/responses",
        model_name="the-model",
        model_api_format="responses",
    )
    assert s.effective_api_key == "new-key"
    assert s.effective_base_url == "https://models.example/v1"
    assert s.effective_model == "the-model"
    assert s.model_chain == ["the-model"]
    assert s.api_format == "responses"


def test_without_a_key_the_old_gateway_key_is_never_sent_to_the_new_host(monkeypatch):
    s = Settings(
        _env_file=None,
        agentrouter_api_key="old-gateway-key",
        model_api_url="https://models.example/v1",
        model_name="the-model",
        model_api_format="responses",
    )
    assert s.effective_api_key == "old-gateway-key"
    assert s.effective_base_url == "https://agentrouter.org/v1"
    assert s.api_format == "chat"


def test_get_client_follows_the_format(responses_mode, monkeypatch):
    from app.services import llm_service

    assert isinstance(llm_service.get_client(), adapter.ResponsesClient)
    monkeypatch.setattr(settings, "model_api_format", "chat")
    assert not isinstance(llm_service.get_client(), adapter.ResponsesClient)


# ----------------------------------------------------------------- blocking


def test_generate_answer_reads_the_responses_output(responses_mode, monkeypatch):
    seen = {}

    def handler(request: httpx.Request):
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={"output": [{"type": "reasoning"}, {"type": "message", "content": [{"type": "output_text", "text": " Answer. "}]}]},
        )

    original = adapter.complete_sync
    monkeypatch.setattr(
        adapter, "complete_sync", lambda *a, **k: original(*a, transport=httpx.MockTransport(handler), **k)
    )
    result = ai_client.generate_answer("What was my iron?", ["Iron 80 ug/dL"])
    assert result.ok and result.text == "Answer."
    assert seen["url"] == f"{BASE}/responses"
    assert seen["body"]["stream"] is False
    assert "Iron 80" in json.dumps(seen["body"]["input"])


def test_connection_test_understands_a_responses_url(monkeypatch):
    original = adapter.complete_sync
    monkeypatch.setattr(
        adapter,
        "complete_sync",
        lambda *a, **k: original(
            *a,
            transport=httpx.MockTransport(
                lambda r: httpx.Response(200, json={"output_text": "OK"}) if str(r.url).endswith("/responses") else httpx.Response(404)
            ),
            **k,
        ),
    )
    good, message = ai_client.test_connection(f"{BASE}/responses", "key", "m")
    assert good and "OK" in message
    monkeypatch.setattr(
        adapter, "complete_sync", lambda *a, **k: original(*a, transport=httpx.MockTransport(lambda r: httpx.Response(401)), **k)
    )
    bad, message = ai_client.test_connection(f"{BASE}/responses", "key", "m")
    assert not bad and "401" in message


# ------------------------------------------------------------ loopback route

client = TestClient(app)
AUTH = {"Authorization": f"Bearer {adapter.SHIM_TOKEN}"}
CHAT_BODY = {"model": "m", "messages": [{"role": "user", "content": "hi"}], "stream": True}


def test_the_route_needs_the_process_token(responses_mode):
    assert client.post("/internal/llm/v1/chat/completions", json=CHAT_BODY).status_code == 401
    wrong = {"Authorization": "Bearer nope"}
    assert client.post("/internal/llm/v1/chat/completions", json=CHAT_BODY, headers=wrong).status_code == 401
    assert client.post("/internal/llm/v1/chat/completions", json=CHAT_BODY, headers={"Authorization": f"Bearer {REAL_KEY}"}).status_code == 401


def test_the_route_streams_chat_chunks_and_uses_the_real_key_upstream(responses_mode, monkeypatch):
    seen = {}

    def handler(request: httpx.Request):
        seen["auth"] = request.headers["authorization"]
        return httpx.Response(200, content=TOOL_STREAM, headers={"content-type": "text/event-stream"})

    serve(monkeypatch, handler)
    response = client.post("/internal/llm/v1/chat/completions", json=CHAT_BODY, headers=AUTH)
    assert response.status_code == 200
    assert seen["auth"] == f"Bearer {REAL_KEY}"
    assert REAL_KEY not in response.text
    lines = [l[6:] for l in response.text.splitlines() if l.startswith("data: ")]
    assert lines[-1] == "[DONE]"
    payloads = [json.loads(l) for l in lines[:-1]]
    assert payloads[0]["object"] == "chat.completion.chunk"
    assert payloads[0]["choices"][0]["delta"]["tool_calls"][0]["function"]["name"] == "search_reports"
    assert payloads[-1]["choices"][0]["finish_reason"] == "tool_calls"


def test_the_route_returns_one_json_completion_when_not_streaming(responses_mode, monkeypatch):
    serve(monkeypatch, ok(TEXT_STREAM))
    response = client.post("/internal/llm/v1/chat/completions", json={**CHAT_BODY, "stream": False}, headers=AUTH)
    assert response.json()["choices"][0]["message"]["content"] == "Hello there"


def test_the_route_passes_upstream_errors_through_without_the_key(responses_mode, monkeypatch):
    serve(monkeypatch, lambda request: httpx.Response(429, json={"error": {"message": "slow down"}}))
    response = client.post("/internal/llm/v1/chat/completions", json=CHAT_BODY, headers=AUTH)
    assert response.status_code == 429
    assert "slow down" in response.json()["error"]["message"]
    assert REAL_KEY not in response.text


def test_the_route_is_off_when_no_translation_is_needed(responses_mode, monkeypatch):
    monkeypatch.setattr(settings, "model_api_format", "chat")
    assert client.post("/internal/llm/v1/chat/completions", json=CHAT_BODY, headers=AUTH).status_code == 404


def test_the_agent_worker_gets_the_loopback_route_and_never_the_real_key(responses_mode, monkeypatch):
    from app.agent.pool import _default_runtime_factory
    from app.agent.profile import profile_for

    monkeypatch.setattr(settings, "backend_url", "http://127.0.0.1:8123/")
    runtime = _default_runtime_factory(profile_for("usr_shim"))
    assert runtime.base_url == "http://127.0.0.1:8123/internal/llm/v1"
    assert runtime.api_key == adapter.shim_token_for("usr_shim")
    assert adapter.persona_from_token(runtime.api_key) == (True, "usr_shim")
    assert runtime.api_key != REAL_KEY
    assert runtime.model == "test-model"
