"""Mapper tests built from events recorded from the real harness (session.v3.jsonl), not guessed."""

from __future__ import annotations

import json

from app.agent.mapper import EventMapper
from tests.test_agent_mapper import make_notif

CALL_ID = "call_01a11a9ffe6c7131a676fc0e5b06a5ee"


def _call(mapper: EventMapper, name: str = "mcp__vitagraph__search_reports") -> None:
    mapper.feed(
        make_notif(
            "tool/call",
            {"turn": 1, "step": 1, "callId": CALL_ID, "name": name, "arguments": '{"query":"iron"}'},
        )
    )


def _real_result(text: str, *, is_error: bool = False) -> dict:
    # Exactly the recorded layout: the id and text live inside a "tool-result" content block.
    return make_notif(
        "tool/result",
        {
            "turn": 1,
            "step": 1,
            "message": {
                "source": {"kind": "tool", "callId": CALL_ID},
                "content": [
                    {
                        "type": "tool-result",
                        "toolCallId": CALL_ID,
                        "content": [{"type": "text", "text": text}],
                        "isError": is_error,
                    }
                ],
                "role": "user",
                "id": "b259f97b-f8f6-4260-9317-2ab86f4539b3",
            },
        },
    )


def test_a_real_tool_result_is_matched_to_its_call_and_decoded():
    mapper = EventMapper()
    _call(mapper)
    events = mapper.feed(_real_result('{"evidence": [{"chunk_id": "c1", "ref": 1, "snippet": "Iron 80"}]}'))
    assert [e[0] for e in events] == ["tool_result"]
    payload = events[0][1]
    assert payload["id"] == CALL_ID
    assert payload["tool"] == "search_reports"
    assert payload["result"]["evidence"][0]["snippet"] == "Iron 80"
    assert payload["is_error"] is False


def test_evidence_cards_from_a_real_result_reach_the_final_evidence_list():
    mapper = EventMapper()
    _call(mapper)
    cards = [{"chunk_id": "c1", "ref": 1}, {"chunk_id": "c2", "ref": 2}]
    mapper.feed(_real_result(json.dumps({"evidence": cards})))
    assert [c["chunk_id"] for c in mapper.evidence] == ["c1", "c2"]


def test_an_empty_evidence_list_is_a_result_not_a_blank_unknown():
    mapper = EventMapper()
    _call(mapper)
    payload = mapper.feed(_real_result('{"evidence": []}'))[0][1]
    assert payload["tool"] == "search_reports"
    assert payload["result"] == {"evidence": []}


def test_a_real_error_result_is_flagged():
    mapper = EventMapper()
    _call(mapper)
    payload = mapper.feed(_real_result("report not found", is_error=True))[0][1]
    assert payload["is_error"] is True
    assert payload["result"] == {"error": "report not found"}


def test_the_call_id_can_come_from_the_message_source_alone():
    mapper = EventMapper()
    _call(mapper)
    event = _real_result('{"ok": true}')
    del event["payload"]["event"]["data"]["message"]["content"][0]["toolCallId"]
    assert mapper.feed(event)[0][1]["id"] == CALL_ID
