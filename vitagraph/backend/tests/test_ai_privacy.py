"""POST /api/ai/privacy: the privacy switch must work offline, be remembered, and /api/health must report chunk sizes."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core import config
from app.generation import ai_client
from app.ingestion import chunker
from app.main import app

client = TestClient(app)


@pytest.fixture
def isolated(tmp_path, monkeypatch):
    """Point the .env writer at a temp folder so the real backend/.env is never touched."""
    monkeypatch.setattr(config, "BACKEND_DIR", tmp_path)
    monkeypatch.setattr(config.settings, "allow_api", True)
    monkeypatch.setattr(config.settings, "ai_service_url", "https://example.invalid/v1")
    monkeypatch.setattr(config.settings, "ai_service_model", "deepseek-v4-flash")
    monkeypatch.setattr(config.settings, "ai_service_api_key", "test-key-1234567890")
    return tmp_path


def test_turning_privacy_off_makes_no_network_call(isolated, monkeypatch):
    def boom(*args, **kwargs):
        raise AssertionError("the privacy switch must never call the AI service")

    monkeypatch.setattr(ai_client, "test_connection", boom)
    res = client.post("/api/ai/privacy", json={"allow_api": False})
    assert res.status_code == 200
    body = res.json()
    assert body["allow_api"] is False
    assert body["status"] == "offline"
    assert config.settings.allow_api is False


def test_turning_privacy_on_reports_configured_when_a_key_exists(isolated):
    res = client.post("/api/ai/privacy", json={"allow_api": True})
    assert res.status_code == 200
    body = res.json()
    assert body["allow_api"] is True
    assert body["status"] == "configured"
    assert body["has_api_key"] is True


def test_the_choice_is_written_to_the_env_file_and_other_lines_survive(isolated):
    env = isolated / ".env"
    env.write_text("ALLOW_API=true\nTOP_K_RESULTS=5\n", encoding="utf-8")
    client.post("/api/ai/privacy", json={"allow_api": False})
    lines = env.read_text(encoding="utf-8").splitlines()
    assert lines.count("ALLOW_API=false") == 1
    assert "ALLOW_API=true" not in lines
    assert "TOP_K_RESULTS=5" in lines
    assert not any(line.startswith("AI_SERVICE_API_KEY=") for line in lines)
    client.post("/api/ai/privacy", json={"allow_api": True})
    lines = env.read_text(encoding="utf-8").splitlines()
    assert lines.count("ALLOW_API=true") == 1
    assert "ALLOW_API=false" not in lines


def test_the_request_must_contain_allow_api(isolated):
    assert client.post("/api/ai/privacy", json={}).status_code == 422


def test_health_reports_the_real_chunk_sizes():
    body = client.get("/api/health").json()
    assert body["chunk_target_chars"] == chunker.CHUNK_TARGET_CHARS
    assert body["chunk_max_chars"] == chunker.CHUNK_MAX_CHARS
    assert body["embedding_model"]
