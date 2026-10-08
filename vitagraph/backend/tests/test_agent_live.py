"""The live path: model activity reported while it happens, merged with the harness events."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.agent.mapper import EventMapper
from app.core.config import settings
from app.main import app
from app.services import agent_service, live_bus
from app.services import responses_adapter as adapter
from tests.conftest import make_user
from tests.test_agent_mapper import make_notif
from tests.test_agent_service import _enable_ai, notif, result_msg
from tests.test_responses_adapter import REAL_KEY, TOOL_STREAM, TEXT_STREAM, ok, responses_mode, serve  # noqa: F401


def kinds(events):
    return [e[0] for e in events]


# --------------------------------------------------------------------- bus


def test_the_bus_delivers_to_the_subscriber_and_drops_when_nobody_listens():
    live_bus.publish("usr_nobody", {"kind": "text", "delta": "lost"})  # no subscriber: no error
    queue = live_bus.subscribe("usr_bus")
    live_bus.publish("usr_bus", {"kind": "text", "delta": "kept"})
    live_bus.publish(None, {"kind": "text", "delta": "no persona"})
    assert queue.get_nowait() == {"kind": "text", "delta": "kept"} and queue.empty()
    live_bus.unsubscribe("usr_bus", queue)
    live_bus.publish("usr_bus", {"kind": "text", "delta": "after"})
    assert queue.empty()


# ------------------------------------------------------------------ mapper


def test_live_text_is_streamed_once_and_the_harness_copy_is_not_repeated():
    mapper = EventMapper()
    out = []
    out += mapper.feed_live({"kind": "model_start"})
    out += mapper.feed_live({"kind": "reasoning", "delta": "Checking the report. "})
    out += mapper.feed_live({"kind": "text", "delta": "I'll look "})
    out += mapper.feed_live({"kind": "text", "delta": "that up."})
    out += mapper.feed_live({"kind": "model_end", "ms": 900, "first_ms": 300, "input_tokens": 10, "output_tokens": 5, "tool_calls": 1})
    # the harness reports the same step afterwards
    out += mapper.feed(
        make_notif(
            "assistant/message",
            {"step": 1, "message": {"content": [
                {"type": "reasoning", "text": "Checking the report. "},
                {"type": "text", "text": "I'll look that up."},
            ]}},
        )
    )
    assert "".join(e[1]["delta"] for e in out if e[0] == "text_delta") == "I'll look that up."
    assert "".join(e[1]["thinking"] for e in out if e[0] == "thinking") == "Checking the report. "
    assert [e[1]["phase"] for e in out if e[0] == "model"] == ["start", "end"]
    end = [e[1] for e in out if e[0] == "model" and e[1]["phase"] == "end"][0]
    assert (end["ms"], end["first_ms"], end["tool_calls"]) == (900, 300, 1)


def test_the_final_text_is_the_last_call_without_tools_not_the_narration():
    mapper = EventMapper()
    mapper.feed_live({"kind": "model_start"})
    mapper.feed_live({"kind": "text", "delta": "Searching your reports."})
    mapper.feed_live({"kind": "model_end", "tool_calls": 2})
    mapper.feed_live({"kind": "model_start"})
    out = mapper.feed_live({"kind": "text", "delta": "Your hemoglobin is **14.1 g/dL** [1]."})
    mapper.feed_live({"kind": "model_end", "tool_calls": 0})
    assert mapper.final_text == "Your hemoglobin is **14.1 g/dL** [1]."
    assert out[0][1]["delta"].startswith("\n\n")  # a new call starts a new paragraph in the running text
    assert "Searching your reports." in mapper.answer_text


def test_without_live_events_the_harness_message_still_streams_and_counts_as_the_answer():
    mapper = EventMapper()
    events = mapper.feed(
        make_notif("assistant/message", {"step": 1, "message": {"content": [{"type": "text", "text": "All good."}]}})
    )
    assert kinds(events) == ["text_delta"]
    assert mapper.final_text == "All good."


def test_a_call_that_then_runs_tools_is_marked_even_without_live_events():
    mapper = EventMapper()
    mapper.feed(make_notif("assistant/message", {"step": 1, "message": {"content": [{"type": "text", "text": "Looking."}]}}))
    mapper.feed(make_notif("tool/call", {"step": 1, "callId": "c1", "name": "mcp__vitagraph__search_reports", "arguments": "{}"}))
    mapper.feed(make_notif("assistant/message", {"step": 2, "message": {"content": [{"type": "text", "text": "Done."}]}}))
    assert mapper.final_text == "Done."


def test_a_model_error_is_reported_without_the_key():
    mapper = EventMapper(redact=lambda s: s.replace(REAL_KEY, "***"))
    mapper.feed_live({"kind": "model_start"})
    out = mapper.feed_live({"kind": "model_error", "message": f"bad key {REAL_KEY}"})
    assert out[0][1]["phase"] == "error" and REAL_KEY not in out[0][1]["message"]


# ----------------------------------------------------------- merged service


class LivePool:
    """Pool whose stream publishes live model events between harness messages, like the real route does."""

    def __init__(self, persona: str) -> None:
        self.persona = persona

    async def stream_turn(self, persona_id, session_id, text):
        pub = lambda ev: live_bus.publish(self.persona, ev)  # noqa: E731
        yield notif("turn/start", {})
        yield notif("step/start", {"step": 1})
        pub({"kind": "model_start"})
        await asyncio.sleep(0)
        pub({"kind": "text", "delta": "I'll search."})
        pub({"kind": "model_end", "ms": 50, "first_ms": 10, "tool_calls": 1})
        await asyncio.sleep(0)
        yield notif("assistant/message", {"step": 1, "message": {"content": [
            {"type": "text", "text": "I'll search."},
            {"type": "tool-call", "id": "c1", "name": "mcp__vitagraph__search_reports", "arguments": "{}"},
        ]}})
        yield notif("tool/call", {"step": 1, "callId": "c1", "name": "mcp__vitagraph__search_reports", "arguments": '{"query":"iron"}'})
        yield notif("tool/result", {"step": 1, "message": {"source": {"kind": "tool", "callId": "c1"}, "content": [
            {"type": "tool-result", "toolCallId": "c1", "content": [{"type": "text", "text": '{"evidence": []}'}], "isError": False}]}})
        yield notif("step/end", {"step": 1})
        yield notif("step/start", {"step": 2})
        pub({"kind": "model_start"})
        await asyncio.sleep(0)
        pub({"kind": "text", "delta": "Iron is "})
        pub({"kind": "text", "delta": "fine [1]."})
        pub({"kind": "model_end", "ms": 70, "first_ms": 20, "tool_calls": 0})
        await asyncio.sleep(0)
        yield notif("assistant/message", {"step": 2, "message": {"content": [{"type": "text", "text": "Iron is fine [1]."}]}})
        yield notif("step/end", {"step": 2})
        yield notif("turn/end", {})
        yield result_msg("Iron is fine [1].")

    async def cancel(self, persona_id):
        pass


def test_the_service_streams_model_events_live_and_keeps_only_the_answer_as_the_summary(monkeypatch):
    monkeypatch.setattr(settings, "model_api_format", "responses")
    monkeypatch.setattr(settings, "model_api_key", "sk-x")
    monkeypatch.setattr(settings, "model_api_url", "https://models.example/v1")
    monkeypatch.setattr(settings, "agentrouter_base_url", "https://models.example/v1")
    _enable_ai(monkeypatch)
    user = make_user("Live service")
    turns = [{"role": "user", "content": "How is my iron?"}]

    async def run():
        return [e async for e in agent_service.stream_agent(user["id"], turns, pool=LivePool(user["id"]))]

    events = asyncio.run(run())
    types = kinds(events)
    assert types.index("model") < types.index("text_delta") < types.index("tool_call") < types.index("tool_result")
    assert "".join(e[1]["delta"] for e in events if e[0] == "text_delta").replace("\n", "") == "I'll search.Iron is fine [1]."
    done = [e[1] for e in events if e[0] == "completed"][0]
    assert done["summary_text"] == "Iron is fine [1]."  # narration is not part of the answer
    assert live_bus._subscribers.get(user["id"]) is None  # unsubscribed afterwards

    from app.services import conversation_service

    conv_id = done["conversation_id"]
    stored = conversation_service.get_conversation(user["id"], conv_id)["messages"][-1]["trajectory"]
    order = [t["event"] for t in stored]
    assert order.index("note") < order.index("tool_call") < order.index("tool_result")
    assert [t for t in stored if t["event"] == "note"][0]["text"] == "I'll search."
    assert [t["phase"] for t in stored if t["event"] == "model"] == ["end", "end"]


def test_merged_raises_what_the_harness_stream_raises_and_stops_its_pump():
    async def failing():
        yield {"type": "x"}
        raise RuntimeError("worker died")

    async def run():
        queue: asyncio.Queue = asyncio.Queue()
        seen = []
        with pytest.raises(RuntimeError, match="worker died"):
            async for item in agent_service._merged(failing(), queue):
                seen.append(item)
        return seen

    assert asyncio.run(run()) == [("h", {"type": "x"})]


# ------------------------------------------------------------- loopback route


def test_the_route_reports_the_models_activity_to_the_persona_while_streaming(responses_mode, monkeypatch):
    queue = live_bus.subscribe("usr_shim_live")
    serve(monkeypatch, ok(TOOL_STREAM))
    client = TestClient(app)
    token = adapter.shim_token_for("usr_shim_live")
    response = client.post(
        "/internal/llm/v1/chat/completions",
        json={"model": "m", "messages": [{"role": "user", "content": "hi"}], "stream": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    events = []
    while not queue.empty():
        events.append(queue.get_nowait())
    live_bus.unsubscribe("usr_shim_live", queue)
    assert events[0] == {"kind": "model_start"}
    assert events[-1]["kind"] == "model_end" and events[-1]["tool_calls"] == 1
    assert events[-1]["first_ms"] is not None


def test_text_and_usage_reach_the_persona_and_a_forged_persona_token_is_refused(responses_mode, monkeypatch):
    queue = live_bus.subscribe("usr_shim_text")
    serve(monkeypatch, ok(TEXT_STREAM))
    client = TestClient(app)
    body = {"model": "m", "messages": [{"role": "user", "content": "hi"}], "stream": True}
    forged = client.post("/internal/llm/v1/chat/completions", json=body, headers={"Authorization": "Bearer usr_shim_text.deadbeef"})
    assert forged.status_code == 401 and queue.empty()
    client.post("/internal/llm/v1/chat/completions", json=body, headers={"Authorization": f"Bearer {adapter.shim_token_for('usr_shim_text')}"})
    got = []
    while not queue.empty():
        got.append(queue.get_nowait())
    live_bus.unsubscribe("usr_shim_text", queue)
    assert "".join(e["delta"] for e in got if e["kind"] == "text") == "Hello there"
    assert "".join(e["delta"] for e in got if e["kind"] == "reasoning") == "thinking "
    end = got[-1]
    assert (end["input_tokens"], end["output_tokens"]) == (11, 4)


def test_an_upstream_error_is_reported_to_the_persona(responses_mode, monkeypatch):
    queue = live_bus.subscribe("usr_shim_err")
    serve(monkeypatch, lambda request: httpx.Response(503, json={"error": {"message": "overloaded"}}))
    response = TestClient(app).post(
        "/internal/llm/v1/chat/completions",
        json={"model": "m", "messages": [{"role": "user", "content": "hi"}], "stream": True},
        headers={"Authorization": f"Bearer {adapter.shim_token_for('usr_shim_err')}"},
    )
    assert response.status_code == 503
    first, second = queue.get_nowait(), queue.get_nowait()
    live_bus.unsubscribe("usr_shim_err", queue)
    assert first["kind"] == "model_start" and second["kind"] == "model_error" and "overloaded" in second["message"]
