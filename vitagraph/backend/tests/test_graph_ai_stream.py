"""Text to Graph, streamed: items arrive as the model writes them, and the same quote, cap and privacy rules hold."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services import graph_ai, llm_service

TEXT = (
    "Arjun visited Dr. Meera at Apollo Hospital in Chennai on 12 March 2026. "
    "He complained of fatigue. Dr. Meera prescribed Metformin."
)

# The same five entities and three relations as the whole-reply tests, written the way the stream asks for:
# the title first, each entity before the relations that use it, relations interleaved as soon as both ends exist.
GOOD_LINES = [
    {"t": "title", "title": "Hospital visit"},
    {"t": "entity", "id": "e1", "label": "Arjun", "type": "person", "quote": "Arjun visited Dr. Meera"},
    {"t": "entity", "id": "e2", "label": "Dr. Meera", "type": "person", "quote": "Dr. Meera"},
    {"t": "relation", "source": "e1", "target": "e2", "label": "visited", "quote": "Arjun visited Dr. Meera"},
    {"t": "entity", "id": "e3", "label": "Apollo Hospital", "type": "organization", "quote": "Apollo Hospital"},
    {"t": "entity", "id": "e4", "label": "Metformin", "type": "medication", "quote": "prescribed Metformin"},
    {"t": "relation", "source": "e2", "target": "e4", "label": "prescribed", "quote": "Dr. Meera prescribed Metformin"},
    {"t": "entity", "id": "e5", "label": "fatigue", "type": "symptom", "quote": "complained of fatigue"},
    {"t": "relation", "source": "e1", "target": "e5", "label": "complained of", "quote": "He complained of fatigue"},
]

GOOD_WHOLE = {
    "title": "Hospital visit",
    "entities": [
        {"id": "e1", "label": "Arjun", "type": "person", "quote": "Arjun visited Dr. Meera"},
        {"id": "e2", "label": "Dr. Meera", "type": "person", "quote": "Dr. Meera"},
        {"id": "e3", "label": "Apollo Hospital", "type": "organization", "quote": "Apollo Hospital"},
        {"id": "e4", "label": "Metformin", "type": "medication", "quote": "prescribed Metformin"},
        {"id": "e5", "label": "fatigue", "type": "symptom", "quote": "complained of fatigue"},
    ],
    "relations": [
        {"source": "e1", "target": "e2", "label": "visited", "quote": "Arjun visited Dr. Meera"},
        {"source": "e2", "target": "e4", "label": "prescribed", "quote": "Dr. Meera prescribed Metformin"},
        {"source": "e1", "target": "e5", "label": "complained of", "quote": "He complained of fatigue"},
    ],
}


def jsonl(objects, trailing_newline=True) -> str:
    body = "\n".join(json.dumps(obj, ensure_ascii=False) for obj in objects)
    return body + "\n" if trailing_newline else body


def slices(text: str, size: int) -> list[str]:
    """Cut the model's text into fixed-size pieces: lines split across pieces, several lines in one piece."""
    return [text[i : i + size] for i in range(0, len(text), size)]


class FakeStream:
    """The model's streamed reply: text pieces, or an exception raised in their place. Records whether it was closed."""

    def __init__(self, items) -> None:
        self.items = list(items)
        self.closed = False
        self.pulled = 0

    def __aiter__(self):
        return self._run()

    async def _run(self):
        for item in self.items:
            self.pulled += 1
            if isinstance(item, Exception):
                raise item
            yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=item))])

    async def aclose(self) -> None:
        self.closed = True


def use_stream(monkeypatch, items):
    stream = FakeStream(items)
    calls: list[dict] = []

    async def create(**kwargs):
        calls.append(kwargs)
        return stream

    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(llm_service, "get_client", lambda: client)
    return calls, stream


def use_whole_reply(monkeypatch, reply: str):
    calls: list[dict] = []

    async def create(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=reply))])

    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(llm_service, "get_client", lambda: client)
    return calls


@pytest.fixture
def ai_on(monkeypatch):
    monkeypatch.setattr(settings, "allow_api", True)
    monkeypatch.setattr(type(settings), "effective_api_key", property(lambda self: "sk-test-key-123456"))


def post_stream(text: str = TEXT):
    return TestClient(app).post("/api/tools/graph/stream", json={"text": text})


def events_of(res) -> list[tuple[str, dict]]:
    """(event name, metadata) for every SSE frame; comment lines (connected, keep-alive) are skipped."""
    found = []
    for block in res.text.split("\n\n"):
        name, data = None, None
        for line in block.splitlines():
            if line.startswith("event: "):
                name = line[len("event: "):]
            elif line.startswith("data: "):
                data = json.loads(line[len("data: "):])
        if name is not None and data is not None:
            found.append((name, data["metadata"]))
    return found


def names(events) -> list[str]:
    return [name for name, _ in events if name != "status"]


# ------------------------------------------------------------- order and content


def test_events_arrive_in_order_and_each_span_is_exact(ai_on, monkeypatch):
    calls, _ = use_stream(monkeypatch, slices(jsonl(GOOD_LINES), 13))
    res = post_stream()
    assert res.status_code == 200
    events = events_of(res)
    assert [m for n, m in events if n == "status"] == [{"phase": "reading"}, {"phase": "writing"}]
    assert names(events) == ["title", "node", "node", "edge", "node", "node", "edge", "node", "edge", "completed"]
    assert events[-1][1] == {"status": "ai", "title": "Hospital visit", "nodes": 5, "edges": 3, "dropped": 0}
    nodes = [m for n, m in events if n == "node"]
    for node in nodes:
        assert TEXT[node["start"] : node["end"]] == node["quote"]
    assert [node["label"] for node in nodes] == ["Arjun", "Dr. Meera", "Apollo Hospital", "Metformin", "fatigue"]
    assert calls[0]["stream"] is True and calls[0]["temperature"] == 0.1
    assert calls[0]["messages"][1]["content"] == f"<text>\n{TEXT}\n</text>"
    assert "DATA" in calls[0]["messages"][0]["content"]


def test_a_line_split_across_pieces_a_fence_stray_lines_and_blank_lines_are_handled(ai_on, monkeypatch):
    items = [
        '{"t":"title","title":"Hospital ',
        'visit"}\n```json\n{"t":"entity","id":"e1","label":"Arjun","type":"person","quote":"Arjun visited Dr. Meera"}\n'
        '{"t":"entity","id":"e2",',
        '"label":"Dr. Meera","type":"person","quote":"Dr. Meera"}\n\n',
        '{"t":"relation","source":"e1","target":"e2","label":"visited","quote":"Arjun visited Dr. Meera"}\n```\n',
        "no such item here\n",
    ]
    use_stream(monkeypatch, items)
    events = events_of(post_stream())
    assert names(events) == ["title", "node", "node", "edge", "completed"]
    assert events[-1][1]["nodes"] == 2 and events[-1][1]["edges"] == 1 and events[-1][1]["title"] == "Hospital visit"


def test_the_last_line_is_used_even_without_a_newline(ai_on, monkeypatch):
    use_stream(monkeypatch, slices(jsonl(GOOD_LINES, trailing_newline=False), 40))
    events = events_of(post_stream())
    assert names(events)[-1] == "completed" and events[-1][1]["nodes"] == 5 and events[-1][1]["edges"] == 3


# ------------------------------------------------------------- the quote and order rules


def test_an_entity_whose_quote_is_not_in_the_text_is_dropped_and_counted(ai_on, monkeypatch):
    lines = [
        {"t": "title", "title": "Medicines"},
        {"t": "entity", "id": "e1", "label": "Metformin", "type": "medication", "quote": "prescribed Metformin"},
        {"t": "entity", "id": "e9", "label": "Insulin", "type": "medication", "quote": "was given insulin"},
        {"t": "relation", "source": "e1", "target": "e9", "label": "replaced", "quote": "Dr. Meera prescribed Metformin"},
    ]
    use_stream(monkeypatch, slices(jsonl(lines), 21))
    events = events_of(post_stream())
    assert [m["label"] for n, m in events if n == "node"] == ["Metformin"]
    assert not [m for n, m in events if n == "edge"]
    assert events[-1][1]["dropped"] == 1 and events[-1][1]["nodes"] == 1


def test_a_relation_before_its_entities_is_dropped(ai_on, monkeypatch):
    lines = [
        {"t": "title", "title": "Hospital visit"},
        {"t": "relation", "source": "e1", "target": "e2", "label": "visited", "quote": "Arjun visited Dr. Meera"},
        {"t": "entity", "id": "e1", "label": "Arjun", "type": "person", "quote": "Arjun visited Dr. Meera"},
        {"t": "entity", "id": "e2", "label": "Dr. Meera", "type": "person", "quote": "Dr. Meera"},
    ]
    use_stream(monkeypatch, slices(jsonl(lines), 30))
    events = events_of(post_stream())
    assert names(events) == ["title", "node", "node", "completed"]
    assert events[-1][1]["edges"] == 0


def test_the_caps_stop_the_reading_and_close_the_model_stream(ai_on, monkeypatch):
    lines = [{"t": "title", "title": "Many words"}]
    lines += [{"t": "entity", "id": f"e{i}", "label": f"word{i}", "type": "concept", "quote": f"word{i}"} for i in range(45)]
    lines += [
        {"t": "relation", "source": f"e{i % 40}", "target": f"e{(i + 1) % 40}", "label": f"link{i}", "quote": f"word{i} word{i + 1}"}
        for i in range(65)
    ]
    words = " ".join(f"word{i}" for i in range(200))
    assert all(f"word{i}" in words for i in range(66))
    items = slices(jsonl(lines), 37)
    _, stream = use_stream(monkeypatch, items)
    events = events_of(post_stream(words))
    assert [n for n, _ in events].count("node") == graph_ai.MAX_NODES
    assert [n for n, _ in events].count("edge") == graph_ai.MAX_EDGES
    assert events[-1][1]["nodes"] == graph_ai.MAX_NODES and events[-1][1]["edges"] == graph_ai.MAX_EDGES
    assert stream.closed is True and stream.pulled < len(items)


# ------------------------------------------------------------- gates before any model call


def test_with_ai_off_nothing_is_sent_and_the_stream_says_why(monkeypatch):
    monkeypatch.setattr(settings, "allow_api", False)
    calls, _ = use_stream(monkeypatch, slices(jsonl(GOOD_LINES), 13))
    res = post_stream()
    assert res.status_code == 409 and "switched off" in res.json()["detail"]
    assert calls == []


def test_without_a_key_nothing_is_sent(monkeypatch):
    monkeypatch.setattr(settings, "allow_api", True)
    monkeypatch.setattr(type(settings), "effective_api_key", property(lambda self: ""))
    calls, _ = use_stream(monkeypatch, slices(jsonl(GOOD_LINES), 13))
    res = post_stream()
    assert res.status_code == 409 and "No AI service key" in res.json()["detail"]
    assert calls == []


def test_empty_and_too_long_text_are_refused_before_any_call(ai_on, monkeypatch):
    calls, _ = use_stream(monkeypatch, slices(jsonl(GOOD_LINES), 13))
    assert post_stream("   ").status_code == 400
    assert post_stream("x" * (graph_ai.MAX_TEXT_CHARS + 1)).status_code == 413
    assert calls == []


# ------------------------------------------------------------- failures and fallbacks


def test_a_model_failure_after_two_nodes_sends_two_nodes_then_one_error(ai_on, monkeypatch):
    boom = RuntimeError("secret internal detail sk-test-key-123456")
    items = slices(jsonl(GOOD_LINES[:3]), 19) + [boom]
    _, stream = use_stream(monkeypatch, items)
    res = post_stream()
    assert res.status_code == 200
    events = events_of(res)
    assert names(events) == ["title", "node", "node", "error"]
    assert events[-1][1] == {"message": graph_ai.GENERATION_FAILED, "status": 502}
    assert "sk-test" not in res.text and "secret internal" not in res.text
    assert stream.closed is True


def test_an_unreadable_reply_is_an_error_event(ai_on, monkeypatch):
    use_stream(monkeypatch, ["I cannot do that."])
    events = events_of(post_stream())
    assert events[-1] == ("error", {"message": graph_ai.UNREADABLE, "status": 502})


def test_a_reply_with_nothing_verifiable_is_a_422_error_event(ai_on, monkeypatch):
    lines = [
        {"t": "title", "title": "Ghost"},
        {"t": "entity", "id": "x", "label": "Ghost", "type": "person", "quote": "no such words"},
    ]
    use_stream(monkeypatch, slices(jsonl(lines), 25))
    events = events_of(post_stream())
    assert names(events) == ["title", "error"]
    assert events[-1] == ("error", {"message": graph_ai.NOTHING_FOUND, "status": 422})


@pytest.mark.parametrize("indent", [None, 2])
def test_one_big_json_object_from_an_old_style_model_is_still_read(ai_on, monkeypatch, indent):
    reply = "```json\n" + json.dumps(GOOD_WHOLE, indent=indent) + "\n```"
    use_stream(monkeypatch, slices(reply, 50))
    events = events_of(post_stream())
    assert names(events) == ["title", "node", "node", "node", "node", "node", "edge", "edge", "edge", "completed"]
    assert events[-1][1] == {"status": "ai", "title": "Hospital visit", "nodes": 5, "edges": 3, "dropped": 0}


# ------------------------------------------------------------- the whole-reply route keeps its shape


def test_the_whole_reply_route_still_returns_the_same_shape(ai_on, monkeypatch):
    use_whole_reply(monkeypatch, json.dumps(GOOD_WHOLE))
    res = TestClient(app).post("/api/tools/graph", json={"text": TEXT})
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"title", "nodes", "edges"}
    assert len(body["nodes"]) == 5 and len(body["edges"]) == 3
    assert body["nodes"][0] == {
        "id": "e1", "label": "Arjun", "type": "person", "start": 0, "end": 23, "quote": "Arjun visited Dr. Meera",
    }
