from __future__ import annotations

from fastapi.testclient import TestClient

from app.generation.safety import BOUNDARY_RESPONSE
from app.main import app
from tests.conftest import make_user
from tests.test_agent_service import FakePool, _collect

client = TestClient(app)


def test_a_refused_turn_is_stored_and_listed():
    user = make_user("Refused Turn Persona")
    pool = FakePool()
    turns = [{"role": "user", "content": "Do I have diabetes? Please diagnose me."}]

    events = _collect(user["id"], turns, pool=pool, conversation_id="conv_test1")
    assert [e[0] for e in events] == ["text_delta", "completed", "done"]

    # 1. List route
    list_res = client.get(f"/api/agent/conversations?user_id={user['id']}")
    assert list_res.status_code == 200
    convs = list_res.json()
    matching = [c for c in convs if c["id"] == "conv_test1"]
    assert len(matching) == 1
    assert matching[0]["message_count"] == 2

    # 2. Get route
    get_res = client.get(f"/api/agent/conversations/conv_test1?user_id={user['id']}")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["id"] == "conv_test1"
    assert len(data["messages"]) == 2
    assert data["messages"][0]["role"] == "user"
    assert data["messages"][0]["content"] == "Do I have diabetes? Please diagnose me."
    assert data["messages"][1]["role"] == "assistant"
    assert data["messages"][1]["content"] == BOUNDARY_RESPONSE
    assert data["messages"][1]["status"] == "refused"


def test_another_persona_cannot_open_the_conversation():
    user_a = make_user("Persona A Conv Owner")
    user_b = make_user("Persona B Conv Stranger")
    pool = FakePool()
    turns = [{"role": "user", "content": "Do I have diabetes? Please diagnose me."}]

    _collect(user_a["id"], turns, pool=pool, conversation_id="conv_test2")

    # Accessing with user_b's id must return 404
    res = client.get(f"/api/agent/conversations/conv_test2?user_id={user_b['id']}")
    assert res.status_code == 404


def test_deleting_a_conversation_removes_it():
    user = make_user("Delete Conv Persona")
    pool = FakePool()
    turns = [{"role": "user", "content": "Do I have diabetes? Please diagnose me."}]

    _collect(user["id"], turns, pool=pool, conversation_id="conv_test3")

    # Verify exists
    get_res = client.get(f"/api/agent/conversations/conv_test3?user_id={user['id']}")
    assert get_res.status_code == 200

    # Delete
    del_res = client.delete(f"/api/agent/conversations/conv_test3?user_id={user['id']}")
    assert del_res.status_code == 200
    assert del_res.json() == {"deleted": "conv_test3"}

    # Get now returns 404
    get_res_after = client.get(f"/api/agent/conversations/conv_test3?user_id={user['id']}")
    assert get_res_after.status_code == 404
