"""The gateway's content filter blocks some ordinary messages; the chat must rephrase and retry, not fail."""

from __future__ import annotations

import httpx
from openai import BadRequestError

from app.core.config import settings
from app.services import llm_service
from tests.test_chat_stream import _Chunk, _Delta, _ToolCall, _collect, _enable_ai, _persona_with_report

QUESTION = "What was my hemoglobin?"


def _blocked() -> BadRequestError:
    req = httpx.Request("POST", "http://gateway/v1/chat/completions")
    return BadRequestError("content-blocked (request id: x)", response=httpx.Response(400, request=req), body=None)


def _last_user(messages: list[dict]) -> str:
    return [m for m in messages if m["role"] == "user"][-1]["content"]


def _answer_stream(text: str):
    async def s():
        yield _Chunk(_Delta(content=text))
    return s()


def test_a_blocked_message_is_retried_rephrased_on_the_same_model(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()
    sent: list[tuple[str, str]] = []

    async def fake_call(client_, messages, model, tools=None):
        text = _last_user(messages)
        sent.append((model, text))
        if text == QUESTION:
            raise _blocked()
        return _answer_stream("Your hemoglobin is in the report.")

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call)
    events = _collect(user["id"], [{"role": "user", "content": QUESTION}])
    kinds = [k for k, _ in events]
    assert kinds[-1] == "completed" and "model_fallback" not in kinds and "error" not in kinds
    assert sent[0][1] == QUESTION
    assert sent[1][1] == "User message: " + QUESTION
    assert sent[0][0] == sent[1][0], "still the same model"


def test_when_every_rephrasing_is_blocked_the_next_model_is_tried(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()
    first = settings.effective_model
    sent: list[str] = []

    async def fake_call(client_, messages, model, tools=None):
        sent.append(model)
        if model == first:
            raise _blocked()
        return _answer_stream("Answer from the backup engine.")

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call)
    events = _collect(user["id"], [{"role": "user", "content": QUESTION}])
    kinds = [k for k, _ in events]
    assert "model_fallback" in kinds and kinds[-1] == "completed"
    assert sent.count(first) == 4, "as typed plus three rephrasings, then the next model"


def test_later_tool_rounds_start_from_the_rephrasing_that_worked(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()
    sent: list[str] = []
    passed = {"n": 0}

    async def fake_call(client_, messages, model, tools=None):
        text = _last_user(messages)
        sent.append(text)
        if text == QUESTION:
            raise _blocked()
        passed["n"] += 1
        if passed["n"] == 1:
            async def first():
                yield _Chunk(_Delta(tool_calls=[_ToolCall(0, "call_1", "search_chroma", '{"query": "Hemoglobin"}')]))
            return first()
        return _answer_stream("Done [1].")

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call)
    events = _collect(user["id"], [{"role": "user", "content": QUESTION}])
    assert events[-1][0] == "completed"
    assert sent.count(QUESTION) == 1, "only the very first attempt used the blocked wording"
    assert len(sent) == 3


def test_other_bad_requests_are_not_retried(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()
    calls: list[int] = []

    async def fake_call(client_, messages, model, tools=None):
        calls.append(1)
        req = httpx.Request("POST", "http://gateway/v1/chat/completions")
        raise BadRequestError("invalid tool schema", response=httpx.Response(400, request=req), body=None)

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call)
    events = _collect(user["id"], [{"role": "user", "content": QUESTION}])
    assert events[-1][0] == "error"
    assert len(calls) == 1


def test_text_before_a_tool_call_is_separated_from_the_answer(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()
    calls = {"n": 0}

    async def fake_call(client_, messages, model, tools=None):
        calls["n"] += 1
        if calls["n"] == 1:
            async def first():
                yield _Chunk(_Delta(content="Let me check your reports."))
                yield _Chunk(_Delta(tool_calls=[_ToolCall(0, "call_1", "search_chroma", '{"query": "Hemoglobin"}')]))
            return first()
        return _answer_stream("Your hemoglobin is listed [1].")

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call)
    events = _collect(user["id"], [{"role": "user", "content": QUESTION}])
    done = events[-1][1]
    assert done["summary_text"] == "Let me check your reports.\n\nYour hemoglobin is listed [1]."
    streamed = "".join(d["delta"] for k, d in events if k == "text_delta")
    assert streamed == done["summary_text"]
