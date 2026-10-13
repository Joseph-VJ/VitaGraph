"""Every model request is masked on its way out and restored on its way back, and the ledger records it."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.agent.mapper import EventMapper
from app.generation import ai_client
from app.main import app
from app.privacy import ledger, shield
from app.services import agent_service, live_bus
from app.services import responses_adapter as adapter
from tests.conftest import make_user
from tests.test_responses_adapter import ok, responses_mode, sse  # noqa: F401  (fixture re-used)

_REAL_OPEN_STREAM = adapter.open_stream


def serve(monkeypatch, handler):
    """Route every adapter call through a mock transport (safe to call more than once in a test)."""
    monkeypatch.setattr(
        adapter, "open_stream",
        lambda *a, **k: _REAL_OPEN_STREAM(*a, transport=httpx.MockTransport(handler), **k),
    )


@pytest.fixture(autouse=True)
def _fresh_shared_vault():
    shield.forget("")  # the Tools / Ask scope keeps one vault per process; start every test clean
    yield

NAME = "Demo Persona A"
REPORT_ID = "SYN-2025-0115-A"
REPORT = f"Patient: {NAME}\nReport ID: {REPORT_ID}\nHemoglobin Result: 13.8 g/dL"
COMPLETED = {"type": "response.completed", "response": {"usage": {"input_tokens": 5, "output_tokens": 3}}}


def run_stream(user_id: str | None, purpose: str, messages: list[dict], handler, monkeypatch, **extra):
    """One streamed call through the real client, inside a shield scope. Returns all chunks."""
    serve(monkeypatch, handler)

    async def go():
        with shield.scope(user_id, purpose):
            stream = await adapter.ResponsesClient().chat.completions.create(
                model="m", messages=messages, stream=True, **extra
            )
        return [chunk async for chunk in stream]

    return asyncio.run(go())


def capture(events: list[dict], seen: dict):
    def handler(request: httpx.Request):
        seen["raw"] = request.content.decode()
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, content=sse(*events), headers={"content-type": "text/event-stream"})

    return handler


def text_of(chunks) -> str:
    return "".join(c.choices[0].delta.content or "" for c in chunks if c.choices)


# ---------------------------------------------------------------- outbound


def test_the_outbound_body_has_no_identifier_but_keeps_the_lab_facts(responses_mode, monkeypatch):
    uid = make_user("shield out")["id"]
    seen: dict = {}
    messages = [
        {"role": "system", "content": "Be careful."},
        {"role": "user", "content": f"What is in this report?\n{REPORT}"},
    ]
    run_stream(uid, "node_summary", messages, capture([COMPLETED], seen), monkeypatch)

    assert NAME not in seen["raw"] and REPORT_ID not in seen["raw"]
    assert "13.8 g/dL" in seen["raw"]
    assert "[PERSON_1]" in seen["raw"] and "[ID_1]" in seen["raw"]
    assert seen["body"]["instructions"].startswith("Be careful.")
    assert "masked on the person's computer" in seen["body"]["instructions"]
    assert messages[1]["content"].count(NAME) == 1  # the caller's own messages are never changed

    rows = ledger.list_rows(uid)
    assert len(rows) == 1 and rows[0]["purpose"] == "node_summary"
    assert rows[0]["removed_total"] == 2 and rows[0]["removed_by_type"] == {"ID": 1, "PERSON": 1}
    full = ledger.get_row(uid, rows[0]["id"])
    assert NAME not in full["sent_text"] and REPORT_ID not in full["sent_text"]
    assert "## Person" in full["sent_text"] and "[PERSON_1]" in full["sent_text"]
    assert ledger.verify_chain(uid)["ok"]


def test_tool_calls_and_tool_results_are_masked_too(responses_mode, monkeypatch):
    uid = make_user("shield tools")["id"]
    seen: dict = {}
    messages = [
        {"role": "user", "content": f"Hi, {REPORT}"},
        {"role": "assistant", "content": None, "tool_calls": [
            {"id": "c1", "type": "function", "function": {"name": "search_reports", "arguments": json.dumps({"query": NAME})}}]},
        {"role": "tool", "tool_call_id": "c1", "content": json.dumps({"evidence": [{"snippet": f"Patient: {NAME}"}]})},
    ]
    run_stream(uid, "agent", messages, capture([COMPLETED], seen), monkeypatch)
    assert NAME not in seen["raw"] and REPORT_ID not in seen["raw"]
    items = seen["body"]["input"]
    call = next(i for i in items if i.get("type") == "function_call")
    assert json.loads(call["arguments"]) == {"query": "[PERSON_1]"}
    assert "[PERSON_1]" in next(i for i in items if i.get("type") == "function_call_output")["output"]


def test_with_nothing_to_mask_the_body_has_no_extra_system_message(responses_mode, monkeypatch):
    uid = make_user("shield clean")["id"]
    seen: dict = {}
    run_stream(uid, "chat", [{"role": "system", "content": "Be careful."}, {"role": "user", "content": "Hemoglobin 13.8 g/dL?"}],
               capture([COMPLETED], seen), monkeypatch)
    assert seen["body"]["instructions"] == "Be careful."
    row = ledger.list_rows(uid)[0]
    assert row["removed_total"] == 0 and row["purpose"] == "chat"


def test_one_ledger_row_per_call_with_the_right_purpose(responses_mode, monkeypatch):
    uid = make_user("shield rows")["id"]
    for purpose in ("agent", "chat", "node_summary"):
        run_stream(uid, purpose, [{"role": "user", "content": REPORT}], ok(sse(COMPLETED)), monkeypatch)
    rows = ledger.list_rows(uid)
    assert [r["purpose"] for r in rows] == ["node_summary", "chat", "agent"]
    assert ledger.verify_chain(uid) == {"ok": True, "checked": 3, "broken_at_seq": None,
                                         "message": "All 3 records checked. The chain is intact."}


def test_calls_without_a_persona_go_to_the_shared_tools_chain(responses_mode, monkeypatch):
    before = len(ledger.list_rows(""))
    run_stream(None, "text_to_graph", [{"role": "user", "content": "Patient: Tool Person\nmeets Dr. Mehta"}],
               ok(sse(COMPLETED)), monkeypatch)
    rows = ledger.list_rows("")
    assert len(rows) == before + 1 and rows[0]["purpose"] == "text_to_graph" and rows[0]["removed_total"] == 2
    assert "Tool Person" not in ledger.get_row("", rows[0]["id"])["sent_text"]


def test_a_missing_scope_is_recorded_as_other(responses_mode, monkeypatch):
    serve(monkeypatch, ok(sse(COMPLETED)))

    async def go():
        stream = await adapter.ResponsesClient().chat.completions.create(
            model="m", messages=[{"role": "user", "content": "hi"}], stream=True)
        return [c async for c in stream]

    asyncio.run(go())
    assert ledger.list_rows("")[0]["purpose"] == "other"


# ----------------------------------------------------------------- inbound


def test_text_reasoning_and_tool_arguments_come_back_restored(responses_mode, monkeypatch):
    uid = make_user("shield in")["id"]
    events = [
        {"type": "response.reasoning_summary_text.delta", "delta": "About [PERS"},
        {"type": "response.reasoning_summary_text.delta", "delta": "ON_1]. "},
        {"type": "response.output_text.delta", "delta": "Hi [PERSON"},
        {"type": "response.output_text.delta", "delta": "_1], your [ID_"},
        {"type": "response.output_text.delta", "delta": "1] ok [PERSON_9] ["},
        {"type": "response.output_item.added", "output_index": 0,
         "item": {"type": "function_call", "id": "fc", "call_id": "c1", "name": "search_reports"}},
        {"type": "response.function_call_arguments.delta", "item_id": "fc", "output_index": 0, "delta": '{"query": "[PER'},
        {"type": "response.function_call_arguments.delta", "item_id": "fc", "output_index": 0, "delta": 'SON_1]"}'},
        COMPLETED,
    ]
    chunks = run_stream(uid, "agent", [{"role": "user", "content": REPORT}], ok(sse(*events)), monkeypatch)
    assert text_of(chunks) == f"Hi {NAME}, your {REPORT_ID} ok [PERSON_9] ["
    reasoning = "".join(getattr(c.choices[0].delta, "reasoning_content", None) or "" for c in chunks if c.choices)
    assert reasoning == f"About {NAME}. "
    args = "".join(tc.function.arguments or "" for c in chunks if c.choices
                   for tc in (c.choices[0].delta.tool_calls or []) if tc.function)
    assert json.loads(args) == {"query": NAME}
    assert chunks[-1].choices[0].finish_reason == "tool_calls" and chunks[-1].usage.prompt_tokens == 5


def test_a_stream_that_ends_inside_a_placeholder_still_releases_the_text(responses_mode, monkeypatch):
    uid = make_user("shield tail")["id"]
    events = [{"type": "response.output_text.delta", "delta": "Result [PERSON"}]  # no completed event
    chunks = run_stream(uid, "chat", [{"role": "user", "content": REPORT}], ok(sse(*events)), monkeypatch)
    assert text_of(chunks) == "Result [PERSON"
    assert chunks[-1].choices[0].finish_reason == "stop"


def test_a_non_streamed_call_is_restored_as_well(responses_mode, monkeypatch):
    uid = make_user("shield sync")["id"]
    serve(monkeypatch, ok(sse({"type": "response.output_text.delta", "delta": "Dear [PERSON_1]"}, COMPLETED)))

    async def go():
        with shield.scope(uid, "chat"):
            return await adapter.ResponsesClient().chat.completions.create(
                model="m", messages=[{"role": "user", "content": REPORT}], stream=False)

    assert asyncio.run(go()).choices[0].message.content == f"Dear {NAME}"


# ----------------------------------------------------------- loopback route


def test_the_route_publishes_privacy_after_model_start_and_streams_restored_text(responses_mode, monkeypatch):
    uid = make_user("shield shim")["id"]
    queue = live_bus.subscribe(uid)
    seen: dict = {}
    serve(monkeypatch, capture([{"type": "response.output_text.delta", "delta": "Hello [PERSON_1]"}, COMPLETED], seen))
    response = TestClient(app).post(
        "/internal/llm/v1/chat/completions",
        json={"model": "m", "messages": [{"role": "user", "content": REPORT}], "stream": True},
        headers={"Authorization": f"Bearer {adapter.shim_token_for(uid)}"},
    )
    events = []
    while not queue.empty():
        events.append(queue.get_nowait())
    live_bus.unsubscribe(uid, queue)

    assert NAME not in seen["raw"] and REPORT_ID not in seen["raw"]
    assert f"Hello {NAME}" in response.text and "[PERSON_1]" not in response.text
    assert [e["kind"] for e in events][:2] == ["model_start", "privacy"]
    assert events[-1]["kind"] == "model_end"
    privacy = events[1]
    row = ledger.list_rows(uid)[0]
    assert privacy["ledger_id"] == row["id"] and privacy["purpose"] == "agent"
    assert privacy["removed_total"] == 2 and privacy["by_type"] == {"ID": 1, "PERSON": 1}
    assert privacy["chars_sent"] == row["chars_sent"] and privacy["chars_original"] == row["chars_original"]
    assert NAME not in json.dumps(events[1])


def test_the_mapper_turns_the_live_event_into_a_privacy_frame_and_the_recorder_keeps_it():
    mapper = EventMapper()
    mapper.feed_live({"kind": "model_start"})
    out = mapper.feed_live({"kind": "privacy", "ledger_id": "led_1", "purpose": "agent", "chars_original": 10,
                            "chars_sent": 9, "removed_total": 2, "by_type": {"PERSON": 1, "ID": 1}})
    assert out == [("privacy", {"call": 1, "ledger_id": "led_1", "purpose": "agent", "chars_original": 10,
                                "chars_sent": 9, "removed_total": 2, "by_type": {"PERSON": 1, "ID": 1}})]
    recorder = agent_service._TurnRecorder()
    recorder.observe(*out[0])
    assert recorder.trajectory == [{"event": "privacy", **out[0][1]}]


# ------------------------------------------------------------- blocking path


def test_the_blocking_ask_path_is_masked_and_restored(responses_mode, monkeypatch):
    seen: dict = {}

    def handler(request: httpx.Request):
        seen["raw"] = request.content.decode()
        return httpx.Response(200, json={"output_text": "Hello [PERSON_1], see [ID_1]."})

    original = adapter.complete_sync
    monkeypatch.setattr(adapter, "complete_sync", lambda *a, **k: original(*a, transport=httpx.MockTransport(handler), **k))
    before = len(ledger.list_rows(""))
    result = ai_client.generate_answer("What was my hemoglobin?", [REPORT])
    assert NAME not in seen["raw"] and REPORT_ID not in seen["raw"] and "13.8 g/dL" in seen["raw"]
    assert result.ok and result.text == f"Hello {NAME}, see {REPORT_ID}."
    rows = ledger.list_rows("")
    assert len(rows) == before + 1 and rows[0]["purpose"] == "ask"


def test_the_connection_test_is_recorded_as_such(responses_mode, monkeypatch):
    original = adapter.complete_sync
    monkeypatch.setattr(
        adapter, "complete_sync",
        lambda *a, **k: original(*a, transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"output_text": "OK"})), **k),
    )
    good, _ = ai_client.test_connection("https://models.example/v1/responses", "key", "m")
    assert good and ledger.list_rows("")[0]["purpose"] == "connection_test"


def test_shield_state_is_forgotten_when_a_persona_is_deleted(responses_mode, monkeypatch):
    from app.services import user_service

    uid = make_user("shield forget")["id"]
    run_stream(uid, "chat", [{"role": "user", "content": REPORT}], ok(sse(COMPLETED)), monkeypatch)
    assert len(shield.vault_for(uid)) == 2
    user_service.delete_user(uid)
    assert len(shield.vault_for(uid)) == 0
    assert ledger.list_rows(uid) == []


def test_an_upstream_error_still_leaves_a_ledger_row_but_no_live_privacy_event(responses_mode, monkeypatch):
    uid = make_user("shield err")["id"]
    queue = live_bus.subscribe(uid)
    serve(monkeypatch, lambda request: httpx.Response(503, json={"error": {"message": "overloaded"}}))
    response = TestClient(app).post(
        "/internal/llm/v1/chat/completions",
        json={"model": "m", "messages": [{"role": "user", "content": REPORT}], "stream": True},
        headers={"Authorization": f"Bearer {adapter.shim_token_for(uid)}"},
    )
    kinds = []
    while not queue.empty():
        kinds.append(queue.get_nowait()["kind"])
    live_bus.unsubscribe(uid, queue)
    assert response.status_code == 503 and kinds == ["model_start", "model_error"]
    assert len(ledger.list_rows(uid)) == 1  # the request did leave (masked), so it is on the record
