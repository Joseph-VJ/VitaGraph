"""Tests for EventMapper in app/agent/mapper.py."""

from __future__ import annotations

import json
import pytest

from app.agent.mapper import EventMapper


def make_notif(event_type: str, data: dict, *, session_id: str = "s1") -> dict:
    return {
        "type": "notification",
        "method": "session.event",
        "payload": {
            "sessionId": session_id,
            "event": {
                "type": event_type,
                "data": data,
                "seq": 1,
                "time": 1730000000000,
            },
        },
    }


def test_reasoning_and_text_blocks_become_thinking_and_text_delta():
    mapper = EventMapper()
    msg = make_notif("assistant/message", {
        "turn": 1,
        "step": 1,
        "message": {
            "id": "m1",
            "role": "assistant",
            "content": [
                {"type": "reasoning", "text": "Analyzing query..."},
                {"type": "text", "text": "Here is the response."},
            ],
        },
    })
    events = mapper.feed(msg)
    assert events == [
        ("thinking", {"thinking": "Analyzing query..."}),
        ("text_delta", {"delta": "Here is the response."}),
    ]
    assert mapper.answer_text == "Here is the response."


def test_a_second_steps_text_is_separated_by_a_paragraph_break():
    mapper = EventMapper()
    msg1 = make_notif("assistant/message", {
        "turn": 1,
        "step": 1,
        "message": {
            "id": "m1",
            "role": "assistant",
            "content": [{"type": "text", "text": "Step 1 text."}],
        },
    })
    events1 = mapper.feed(msg1)
    assert events1 == [("text_delta", {"delta": "Step 1 text."})]

    msg2 = make_notif("assistant/message", {
        "turn": 1,
        "step": 2,
        "message": {
            "id": "m2",
            "role": "assistant",
            "content": [{"type": "text", "text": "Step 2 text."}],
        },
    })
    events2 = mapper.feed(msg2)
    assert events2 == [
        ("text_delta", {"delta": "\n\n"}),
        ("text_delta", {"delta": "Step 2 text."}),
    ]
    assert mapper.answer_text == "Step 1 text.\n\nStep 2 text."


def test_tool_call_uses_the_short_name_and_parsed_arguments():
    mapper = EventMapper()
    msg = make_notif("tool/call", {
        "turn": 1,
        "step": 1,
        "callId": "c_123",
        "name": "mcp__vitagraph__search_reports",
        "arguments": json.dumps({"query": "hemoglobin", "top_k": 3}),
    })
    events = mapper.feed(msg)
    assert events == [
        ("tool_call", {
            "id": "c_123",
            "tool": "search_reports",
            "arguments": {"query": "hemoglobin", "top_k": 3},
            "step": 1,
        }),
    ]


def test_tool_call_with_broken_arguments_json_gets_empty_arguments():
    mapper = EventMapper()
    msg = make_notif("tool/call", {
        "turn": 1,
        "step": 1,
        "callId": "c_broken",
        "name": "mcp__vitagraph__list_reports",
        "arguments": "{not-valid-json",
    })
    events = mapper.feed(msg)
    assert events == [
        ("tool_call", {
            "id": "c_broken",
            "tool": "list_reports",
            "arguments": {},
            "step": 1,
        }),
    ]


def test_search_results_collect_evidence_cards_once_per_chunk_and_keep_their_refs():
    curr_time = 100.0

    def clock():
        return curr_time

    mapper = EventMapper(clock=clock)
    # First register the tool call so callId is known
    mapper.feed(make_notif("tool/call", {
        "callId": "call_search",
        "name": "mcp__vitagraph__search_reports",
        "arguments": "{}",
    }))

    curr_time = 100.25  # 250ms duration
    card1 = {
        "ref": 1,
        "chunk_id": "chk_1",
        "report_id": "rep_1",
        "report_filename": "jan.pdf",
        "report_date": "2025-01-15",
        "page_number": 1,
        "snippet": "Hemoglobin 14.1 g/dL",
        "score": 0.85,
        "char_start": 10,
        "char_end": 30,
    }
    card2 = dict(card1, ref=2)  # Duplicate chunk_id
    card3 = dict(card1, chunk_id="chk_2", ref=3)

    tool_result_content = json.dumps({"evidence": [card1, card2, card3]})
    msg = make_notif("tool/result", {
        "turn": 1,
        "step": 1,
        "message": {
            "id": "tr_1",
            "role": "tool",
            "toolCallId": "call_search",
            "content": [{"type": "text", "text": tool_result_content}],
        },
    })
    events = mapper.feed(msg)
    assert len(events) == 1
    ev_type, payload = events[0]
    assert ev_type == "tool_result"
    assert payload["id"] == "call_search"
    assert payload["tool"] == "search_reports"
    assert payload["is_error"] is False
    assert payload["duration_ms"] == 250

    # Ensure evidence cards deduplicated by chunk_id, preserving first ref
    assert len(mapper.evidence) == 2
    assert mapper.evidence[0] == card1
    assert mapper.evidence[1] == card3


def test_a_tool_error_becomes_an_error_result():
    mapper = EventMapper()
    mapper.feed(make_notif("tool/call", {
        "callId": "c_fail",
        "name": "mcp__vitagraph__get_measurements",
        "arguments": "{}",
    }))

    msg = make_notif("tool/result", {
        "turn": 1,
        "step": 1,
        "message": {
            "id": "tr_fail",
            "role": "tool",
            "toolCallId": "c_fail",
            "isError": True,
            "content": [{"type": "text", "text": "Measurement service failed"}],
        },
    })
    events = mapper.feed(msg)
    assert events == [
        ("tool_result", {
            "id": "c_fail",
            "tool": "get_measurements",
            "result": {"error": "Measurement service failed"},
            "is_error": True,
            "duration_ms": 0,
        }),
    ]


def test_a_non_json_tool_result_is_wrapped_as_text():
    mapper = EventMapper()
    mapper.feed(make_notif("tool/call", {
        "callId": "c_raw",
        "name": "mcp__vitagraph__graph_lookup",
        "arguments": "{}",
    }))

    msg = make_notif("tool/result", {
        "turn": 1,
        "step": 1,
        "message": {
            "id": "tr_raw",
            "role": "tool",
            "toolCallId": "c_raw",
            "content": [{"type": "text", "text": "Raw plain text result"}],
        },
    })
    events = mapper.feed(msg)
    assert events == [
        ("tool_result", {
            "id": "c_raw",
            "tool": "graph_lookup",
            "result": {"text": "Raw plain text result"},
            "is_error": False,
            "duration_ms": 0,
        }),
    ]


def test_llm_retry_events_become_retrying_status_with_a_counter():
    mapper = EventMapper()
    msg1 = make_notif("llm/retry", {"attempt": 1})
    events1 = mapper.feed(msg1)
    assert events1 == [
        ("status", {
            "phase": "retrying",
            "attempt": 1,
            "message": "The AI service is slow to answer; trying again",
        }),
    ]

    msg2 = make_notif("llm/retry", {})
    events2 = mapper.feed(msg2)
    assert events2 == [
        ("status", {
            "phase": "retrying",
            "attempt": 2,
            "message": "The AI service is slow to answer; trying again",
        }),
    ]


def test_step_events_and_usage_produce_stats_and_never_invent_token_counts():
    mapper = EventMapper()
    # step/start
    events_start = mapper.feed(make_notif("step/start", {"step": 1}))
    assert events_start == [("step", {"phase": "start", "step": 1})]

    # step/end without usage
    events_end1 = mapper.feed(make_notif("step/end", {"step": 1}))
    assert len(events_end1) == 2
    assert events_end1[0] == ("step", {"phase": "end", "step": 1})
    assert events_end1[1][0] == "stats"
    stats1 = events_end1[1][1]
    assert stats1["steps"] == 1
    assert "input_tokens" not in stats1
    assert "output_tokens" not in stats1

    # assistant message with usage in step 2
    mapper.feed(make_notif("assistant/message", {
        "step": 2,
        "message": {"role": "assistant", "content": []},
        "usage": {"inputTokens": 100, "outputTokens": 50, "reasoningTokens": 20},
    }))
    events_end2 = mapper.feed(make_notif("step/end", {"step": 2}))
    stats2 = events_end2[1][1]
    assert stats2["steps"] == 2
    assert stats2["input_tokens"] == 100
    assert stats2["output_tokens"] == 50
    assert stats2["reasoning_tokens"] == 20


def test_the_latest_session_title_is_kept():
    mapper = EventMapper()
    mapper.feed(make_notif("session/title", {"title": "First Title"}))
    assert mapper.title == "First Title"
    mapper.feed(make_notif("session/title", {"title": "Second Title"}))
    assert mapper.title == "Second Title"
    mapper.feed(make_notif("session/title", {"title": ""}))
    assert mapper.title == "Second Title"


def test_unknown_or_malformed_events_are_ignored_without_raising():
    mapper = EventMapper()
    assert mapper.feed(None) == []
    assert mapper.feed("string message") == []
    assert mapper.feed({}) == []
    assert mapper.feed({"type": "notification", "method": "session.status"}) == []
    assert mapper.feed({"type": "notification", "method": "session.event", "payload": "not-a-dict"}) == []
    assert mapper.feed({"type": "notification", "method": "session.event", "payload": {"event": "not-a-dict"}}) == []
    assert mapper.feed(make_notif("tool/call", {"callId": "c"})) == []  # missing name
    assert mapper.feed(make_notif("assistant/message", {"message": "bad"})) == []
    assert mapper.feed({"type": "notification", "method": "subagent.started"}) == []


def test_result_with_finish_reason_error_is_an_error_and_a_401_is_worded_as_a_refusal():
    mapper = EventMapper()
    res = {
        "type": "result",
        "run_id": "r1",
        "final_response": "HTTP 401: unauthorized client detected",
        "finish_reason": "error",
    }
    events = mapper.feed(res)
    assert mapper.outcome == "error"
    assert events == [
        ("error", {
            "status": "error",
            "message": "The AI service refused the request. Please try again later.",
            "diagnostic": "HTTP 401: unauthorized client detected",
        }),
    ]


def test_result_without_streamed_text_falls_back_to_final_response():
    mapper = EventMapper()
    res = {
        "type": "result",
        "run_id": "r2",
        "final_response": "Fallback complete text response.",
        "finish_reason": "stop",
    }
    events = mapper.feed(res)
    assert mapper.outcome == "result"
    assert events == [
        ("text_delta", {"delta": "Fallback complete text response."}),
    ]
    assert mapper.answer_text == "Fallback complete text response."


def test_run_error_and_lockdown_violation_are_errors():
    mapper1 = EventMapper()
    events1 = mapper1.feed({
        "type": "run_error",
        "run_id": "r3",
        "message": "The agent took too long to answer. Timeout reached.",
    })
    assert mapper1.outcome == "error"
    assert events1 == [
        ("error", {
            "status": "error",
            "message": "The AI Agent took too long to answer. Please try again.",
            "diagnostic": "The agent took too long to answer. Timeout reached.",
        }),
    ]

    mapper2 = EventMapper()
    events2 = mapper2.feed({
        "type": "lockdown_violation",
        "tools": ["pwsh", "bash"],
    })
    assert mapper2.outcome == "error"
    assert events2 == [
        ("error", {
            "status": "error",
            "message": "The AI Agent was stopped by a safety check.",
            "diagnostic": "Unexpected tools were offered: pwsh, bash",
        }),
    ]


def test_the_api_key_never_appears_in_any_emitted_event():
    secret = "sk-secret-key-12345"
    redact = lambda s: s.replace(secret, "***")

    mapper = EventMapper(redact=redact)
    events = mapper.feed({
        "type": "run_error",
        "run_id": "r4",
        "message": f"Connection failed to backend with auth {secret}!",
    })
    raw_json = json.dumps(events)
    assert secret not in raw_json
    assert "***" in raw_json


def test_a_failed_result_uses_the_turn_end_error_as_its_diagnostic():
    mapper = EventMapper()
    mapper.feed(make_notif("turn/end", {"reason": {"kind": "error", "error": {"status": 429, "message": "rate limited"}}}))
    events = mapper.feed({"type": "result", "finish_reason": "error", "final_response": ""})
    assert len(events) == 1
    etype, payload = events[0]
    assert etype == "error"
    assert "rate limited" in payload["diagnostic"]
    assert payload["diagnostic"] != "error"
    assert payload["message"] == "The AI Agent could not finish this answer."


def test_a_401_in_the_turn_end_error_is_worded_as_a_refusal_on_the_real_path():
    mapper = EventMapper()
    mapper.feed(make_notif("turn/end", {"reason": {"kind": "error", "error": {"status": 401, "message": "unauthorized client detected"}}}))
    events = mapper.feed({"type": "result", "finish_reason": "error", "final_response": ""})
    assert len(events) == 1
    etype, payload = events[0]
    assert etype == "error"
    assert payload["message"] == "The AI service refused the request. Please try again later."


def test_a_failed_result_without_any_detail_falls_back_to_the_finish_reason():
    mapper = EventMapper()
    events = mapper.feed({"type": "result", "finish_reason": "error", "final_response": ""})
    assert len(events) == 1
    etype, payload = events[0]
    assert etype == "error"
    assert payload["diagnostic"] == "error"


def test_the_key_is_redacted_from_a_turn_end_error():
    secret = "sk-secret-key-123"
    redact = lambda s: s.replace(secret, "***")
    mapper = EventMapper(redact=redact)
    mapper.feed(make_notif("turn/end", {"reason": {"kind": "error", "error": {"status": 403, "auth": secret}}}))
    events = mapper.feed({"type": "result", "finish_reason": "error", "final_response": ""})
    raw_json = json.dumps(events)
    assert secret not in raw_json
    assert "***" in raw_json
