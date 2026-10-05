"""Tests for harness fields in EventMapper (Task D3)."""

from __future__ import annotations

import json

from app.agent.mapper import EventMapper


def _notif(event_type: str, data: dict) -> dict:
    return {
        "type": "notification",
        "method": "session.event",
        "payload": {
            "sessionId": "s1",
            "event": {
                "type": event_type,
                "data": data,
                "seq": 1,
                "time": 1730000000000,
            },
        },
    }


def test_retry_uses_the_harness_field():
    mapper = EventMapper()
    msg = _notif("llm/retry", {"retry": 3, "provider": "x"})
    events = mapper.feed(msg)
    assert len(events) == 1
    ev_type, payload = events[0]
    assert ev_type == "status"
    assert payload["attempt"] == 3
    assert "x" not in json.dumps(payload)


def test_artifact_tool_names_are_shortened():
    mapper = EventMapper()
    msg = _notif("tool/call", {
        "callId": "c_art",
        "name": "mcp__vgartifacts__show_code",
        "arguments": "{}",
    })
    events = mapper.feed(msg)
    assert len(events) == 1
    ev_type, payload = events[0]
    assert ev_type == "tool_call"
    assert payload["tool"] == "show_code"
