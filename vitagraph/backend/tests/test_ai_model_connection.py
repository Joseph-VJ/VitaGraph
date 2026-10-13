"""Tests for AI model connection routes and RunRegistry.any_running."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.agent.runs import Run, RunRegistry, get_registry
from app.core import config
from app.generation import ai_client
from app.main import app

client = TestClient(app)


class FakePool:
    def __init__(self) -> None:
        self.closed_count = 0

    async def close_all(self) -> None:
        self.closed_count += 1


class ConnectionRecorder:
    def __init__(self) -> None:
        self.calls: list[dict[str, str]] = []
        self.result: tuple[bool, str] = (True, "Connection verified.")

    def __call__(self, url: str, key: str, model: str, timeout: int = 12) -> tuple[bool, str]:
        self.calls.append({"url": url, "key": key, "model": model})
        return self.result


@pytest.fixture
def isolated(tmp_path, monkeypatch):
    """Isolate backend dir, settings, agent pool and connection tests."""
    monkeypatch.setattr(config, "BACKEND_DIR", tmp_path)
    env_file = tmp_path / ".env"
    env_file.write_text("TOP_K_RESULTS=5\n", encoding="utf-8")

    initial_settings = {
        "model_api_url": "https://old.example.invalid/v1",
        "model_api_key": "test-key-OLDOLD9999",
        "model_name": "old-model",
        "model_api_format": "chat",
        "model_reasoning_effort": "low",
        "agentrouter_api_key": "test-key-OLDOLD9999",
        "agentrouter_base_url": "https://old.example.invalid/v1",
        "agentrouter_model": "old-model",
        "agentrouter_fallback_models": "",
        "ai_service_api_key": "",
    }
    for field, val in initial_settings.items():
        monkeypatch.setattr(config.settings, field, val)
    monkeypatch.setattr(config.settings, "allow_api", True)

    fake_pool = FakePool()
    monkeypatch.setattr("app.routes.ai.get_pool", lambda: fake_pool)

    recorder = ConnectionRecorder()
    monkeypatch.setattr(ai_client, "test_connection", recorder)

    return tmp_path, fake_pool, recorder


def test_get_model_connection(isolated):
    res = client.get("/api/ai/model")
    assert res.status_code == 200
    data = res.json()
    assert data["url"] == "https://old.example.invalid/v1"
    assert data["model"] == "old-model"
    assert data["api_format"] == "chat"
    assert data["has_key"] is True
    assert data["masked_key"] == "••••9999"
    assert data["can_edit"] is True
    assert data["shield_covered"] is False
    assert "test-key-OLDOLD9999" not in res.text
    assert "key" not in data


def test_save_model_connection_with_new_key(isolated):
    tmp_path, fake_pool, recorder = isolated
    payload = {
        "url": "https://new.example.invalid/v1",
        "key": "test-key-NEWNEW1234",
        "model": "new-model",
        "api_format": "auto",
        "reasoning": "low",
    }
    res = client.post("/api/ai/model", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "key" not in data
    assert "test-key-NEWNEW1234" not in res.text

    assert config.settings.effective_api_key == "test-key-NEWNEW1234"
    assert config.settings.effective_base_url == "https://new.example.invalid/v1"
    assert config.settings.effective_model == "new-model"
    assert config.settings.api_format == "chat"

    lines = (tmp_path / ".env").read_text(encoding="utf-8").splitlines()
    assert "TOP_K_RESULTS=5" in lines
    assert "MODEL_API_URL=https://new.example.invalid/v1" in lines
    assert "MODEL_NAME=new-model" in lines
    assert "MODEL_API_FORMAT=chat" in lines
    assert "MODEL_API_KEY=test-key-NEWNEW1234" in lines
    assert "MODEL_REASONING_EFFORT=low" in lines

    assert fake_pool.closed_count == 1
    assert recorder.calls[-1]["url"] == "https://new.example.invalid/v1/chat/completions"


def test_save_model_connection_keeps_old_key_when_empty(isolated):
    tmp_path, fake_pool, recorder = isolated
    payload = {
        "url": "https://old.example.invalid/v2",
        "key": "",
        "model": "new-model",
        "api_format": "chat",
    }
    res = client.post("/api/ai/model", json=payload)
    assert res.status_code == 200

    assert config.settings.effective_api_key == "test-key-OLDOLD9999"
    lines = (tmp_path / ".env").read_text(encoding="utf-8").splitlines()
    assert not any(l.startswith("MODEL_API_KEY=") for l in lines)


@pytest.mark.parametrize("route", ["/api/ai/model/test", "/api/ai/model"])
@pytest.mark.parametrize("url", ["https://new.example.invalid/v1", "https://old.example.invalid:8443/v1"])
def test_empty_key_cannot_be_reused_for_another_host_or_port(isolated, route, url):
    tmp_path, fake_pool, recorder = isolated
    before_env = (tmp_path / ".env").read_bytes()
    before_settings = config.settings.model_dump()

    res = client.post(route, json={"url": url, "key": "", "model": "new-model"})

    assert res.status_code == 422
    assert res.json()["detail"].startswith("You changed the address")
    assert recorder.calls == []
    assert fake_pool.closed_count == 0
    assert config.settings.model_dump() == before_settings
    assert (tmp_path / ".env").read_bytes() == before_env


@pytest.mark.parametrize("route", ["/api/ai/model/test", "/api/ai/model"])
@pytest.mark.parametrize("url", ["https://old.example.invalid/v2", "https://OLD.EXAMPLE.INVALID/v1"])
def test_empty_key_is_reused_on_the_saved_host(isolated, route, url):
    _, fake_pool, recorder = isolated
    res = client.post(route, json={"url": url, "key": "", "model": "new-model"})
    assert res.status_code == 200
    assert recorder.calls[-1]["key"] == "test-key-OLDOLD9999"
    assert fake_pool.closed_count == (1 if route == "/api/ai/model" else 0)


@pytest.mark.parametrize("route", ["/api/ai/model/test", "/api/ai/model"])
def test_typed_key_is_used_for_a_new_host(isolated, route):
    _, fake_pool, recorder = isolated
    res = client.post(route, json={
        "url": "https://new.example.invalid/v1",
        "key": "test-key-NEWNEW1234",
        "model": "new-model",
    })
    assert res.status_code == 200
    assert recorder.calls[-1]["key"] == "test-key-NEWNEW1234"
    assert fake_pool.closed_count == (1 if route == "/api/ai/model" else 0)


@pytest.mark.parametrize("route", ["/api/ai/model/test", "/api/ai/model"])
def test_empty_key_with_no_saved_key_keeps_enter_key_message(isolated, monkeypatch, route):
    tmp_path, fake_pool, recorder = isolated
    for field in ("model_api_key", "agentrouter_api_key", "ai_service_api_key"):
        monkeypatch.setattr(config.settings, field, "")
    before_settings = config.settings.model_dump()
    before_env = (tmp_path / ".env").read_bytes()

    res = client.post(route, json={"url": "https://new.example.invalid/v1", "key": "", "model": "new-model"})

    assert res.status_code == 422
    assert res.json()["detail"] == "Enter an API key."
    assert recorder.calls == []
    assert fake_pool.closed_count == 0
    assert config.settings.model_dump() == before_settings
    assert (tmp_path / ".env").read_bytes() == before_env


def test_skip_test_cannot_bypass_saved_key_host_check(isolated):
    tmp_path, fake_pool, recorder = isolated
    before_settings = config.settings.model_dump()
    before_env = (tmp_path / ".env").read_bytes()
    res = client.post("/api/ai/model", json={
        "url": "https://new.example.invalid/v1", "key": "", "model": "new-model", "skip_test": True,
    })
    assert res.status_code == 422
    assert res.json()["detail"].startswith("You changed the address")
    assert recorder.calls == []
    assert fake_pool.closed_count == 0
    assert config.settings.model_dump() == before_settings
    assert (tmp_path / ".env").read_bytes() == before_env


def test_failed_connection_test_returns_422_and_aborts_save(isolated):
    tmp_path, fake_pool, recorder = isolated
    recorder.result = (False, "Authentication failed")
    payload = {
        "url": "https://fail.example.invalid/v1",
        "key": "test-key-FAILFAIL1234",
        "model": "fail-model",
    }
    res = client.post("/api/ai/model", json=payload)
    assert res.status_code == 422
    assert res.json()["detail"] == "Authentication failed"

    assert config.settings.effective_api_key == "test-key-OLDOLD9999"
    lines = (tmp_path / ".env").read_text(encoding="utf-8").splitlines()
    assert lines == ["TOP_K_RESULTS=5"]
    assert fake_pool.closed_count == 0


def test_skip_test_saves_without_calling_test_connection(isolated):
    tmp_path, fake_pool, recorder = isolated
    payload = {
        "url": "https://new.example.invalid/v1",
        "key": "test-key-NEWNEW1234",
        "model": "new-model",
        "skip_test": True,
    }
    res = client.post("/api/ai/model", json=payload)
    assert res.status_code == 200
    assert res.json()["message"] == "Saved without a test."
    assert len(recorder.calls) == 0


def test_api_format_resolution_and_test_urls(isolated):
    tmp_path, fake_pool, recorder = isolated

    # 1. auto with /responses URL -> responses format
    payload1 = {
        "url": "https://host.example.invalid/v1/responses",
        "key": "test-key-NEWNEW1234",
        "model": "m1",
        "api_format": "auto",
    }
    res1 = client.post("/api/ai/model", json=payload1)
    assert res1.status_code == 200
    assert res1.json()["api_format"] == "responses"
    assert config.settings.model_api_format == "responses"
    assert recorder.calls[-1]["url"] == "https://host.example.invalid/v1/responses"

    # 2. auto with /v1 URL -> chat format
    payload2 = {
        "url": "https://host.example.invalid/v1",
        "key": "test-key-NEWNEW1234",
        "model": "m2",
        "api_format": "auto",
    }
    res2 = client.post("/api/ai/model", json=payload2)
    assert res2.status_code == 200
    assert res2.json()["api_format"] == "chat"
    assert config.settings.model_api_format == "chat"
    assert recorder.calls[-1]["url"] == "https://host.example.invalid/v1/chat/completions"

    # 3. explicit responses with /v1 URL -> tests and saves responses
    payload3 = {
        "url": "https://host.example.invalid/v1",
        "key": "test-key-NEWNEW1234",
        "model": "m3",
        "api_format": "responses",
    }
    res3 = client.post("/api/ai/model", json=payload3)
    assert res3.status_code == 200
    assert res3.json()["api_format"] == "responses"
    assert config.settings.model_api_format == "responses"
    assert recorder.calls[-1]["url"] == "https://host.example.invalid/v1/responses"


def test_validation_rejects_bad_inputs_and_accepts_local(isolated):
    tmp_path, fake_pool, recorder = isolated
    bad_payloads = [
        {"url": "ftp://example.com/v1", "key": "test-key-123456", "model": "m"},
        {"url": "http://example.com/v1", "key": "test-key-123456", "model": "m"},
        {"url": "http://user:pw@localhost:8080/v1", "key": "test-key-123456", "model": "m"},
        {"url": "http://localhost:8080/v1?x=1", "key": "test-key-123456", "model": "m"},
        {"url": "https://example .invalid/v1", "key": "test-key-123456", "model": "m"},
        {"url": "javascript:alert(1)", "key": "test-key-123456", "model": "m"},
        {"url": "https://example.invalid/v1", "key": "test-key-123456", "model": ""},
        {"url": "https://example.invalid/v1", "key": "test-key-123456", "model": "bad model"},
        {"url": "https://example.invalid/v1", "key": "test-key-123456", "model": "bad;model"},
        {"url": "https://example.invalid/v1", "key": "short", "model": "m"},
        {"url": "https://example.invalid/v1", "key": "test key 12345", "model": "m"},
        {"url": "https://example.invalid/v1", "key": "test\nkey12345", "model": "m"},
    ]

    for p in bad_payloads:
        res = client.post("/api/ai/model", json=p)
        assert res.status_code == 422, f"Expected 422 for payload {p}, got {res.status_code}"

    # Local endpoints are accepted
    for local_url in ("http://localhost:11434/v1", "http://127.0.0.1:8080/v1"):
        res = client.post(
            "/api/ai/model",
            json={"url": local_url, "key": "test-key-LOCAL1234", "model": "local-m"},
        )
        assert res.status_code == 200, f"Expected 200 for local url {local_url}, got {res.status_code}"


def test_remote_caller_forbidden_on_writes_and_can_edit_false_on_get(isolated):
    remote_client = TestClient(app, client=("203.0.113.9", 50000))

    get_res = remote_client.get("/api/ai/model")
    assert get_res.status_code == 200
    assert get_res.json()["can_edit"] is False

    valid_payload = {
        "url": "https://example.invalid/v1",
        "key": "test-key-REMOTE1234",
        "model": "m1",
    }
    assert remote_client.post("/api/ai/model/test", json=valid_payload).status_code == 403
    assert remote_client.post("/api/ai/model", json=valid_payload).status_code == 403
    assert remote_client.post("/api/ai/model/remove-key").status_code == 403

    assert config.settings.effective_api_key == "test-key-OLDOLD9999"


def test_agent_running_conflict_rejects_save_and_remove_key(isolated, monkeypatch):
    tmp_path, fake_pool, recorder = isolated
    monkeypatch.setattr(get_registry(), "any_running", lambda: True)

    payload = {
        "url": "https://example.invalid/v1",
        "key": "test-key-BUSY123456",
        "model": "busy-model",
    }
    res_save = client.post("/api/ai/model", json=payload)
    assert res_save.status_code == 409
    assert "AI Agent is still answering" in res_save.json()["detail"]

    res_remove = client.post("/api/ai/model/remove-key")
    assert res_remove.status_code == 409
    assert "AI Agent is still answering" in res_remove.json()["detail"]

    res_test = client.post("/api/ai/model/test", json=payload)
    assert res_test.status_code == 200
    assert res_test.json()["ok"] is True


def test_post_model_test_endpoint(isolated):
    tmp_path, fake_pool, recorder = isolated
    payload = {
        "url": "https://test.example.invalid/v1",
        "key": "test-key-TESTTEST12",
        "model": "test-m",
        "api_format": "auto",
    }
    res = client.post("/api/ai/model/test", json=payload)
    assert res.status_code == 200
    assert res.json() == {
        "ok": True,
        "message": "Connection verified.",
        "api_format": "chat",
    }
    assert config.settings.effective_api_key == "test-key-OLDOLD9999"
    assert fake_pool.closed_count == 0


def test_test_message_redacts_api_key(isolated):
    tmp_path, fake_pool, recorder = isolated
    secret_key = "test-key-SECRETKEY12"
    recorder.result = (False, f"bad key {secret_key} here")

    payload = {
        "url": "https://example.invalid/v1",
        "key": secret_key,
        "model": "m",
    }
    res = client.post("/api/ai/model/test", json=payload)
    assert res.status_code == 200
    assert secret_key not in res.json()["message"]
    assert "…" in res.json()["message"]

    res_save = client.post("/api/ai/model", json=payload)
    assert res_save.status_code == 422
    assert secret_key not in res_save.json()["detail"]
    assert "…" in res_save.json()["detail"]


def test_remove_model_key(isolated):
    tmp_path, fake_pool, recorder = isolated
    res = client.post("/api/ai/model/remove-key")
    assert res.status_code == 200
    data = res.json()
    assert data["has_key"] is False
    assert data["masked_key"] == ""
    assert config.settings.effective_api_key == ""

    lines = (tmp_path / ".env").read_text(encoding="utf-8").splitlines()
    assert "MODEL_API_KEY=" in lines
    assert fake_pool.closed_count == 1


def test_run_registry_any_running():
    registry = RunRegistry()
    assert registry.any_running() is False

    run = Run(
        user_id="user_1",
        conversation_id="conv_1",
        question="What is my ferritin?",
        started_at=1000,
        persisted_start=True,
        finished=False,
    )
    registry._runs["conv_1"] = run
    assert registry.any_running() is True

    run.finished = True
    assert registry.any_running() is False


def test_existing_ai_privacy_endpoint_still_works(isolated):
    tmp_path, fake_pool, recorder = isolated
    res = client.post("/api/ai/privacy", json={"allow_api": False})
    assert res.status_code == 200
    assert res.json()["allow_api"] is False

    lines = (tmp_path / ".env").read_text(encoding="utf-8").splitlines()
    assert "ALLOW_API=false" in lines
