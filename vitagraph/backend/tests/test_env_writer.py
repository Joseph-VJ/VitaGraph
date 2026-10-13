"""Tests for write_env_values and model connection settings persistence."""

from __future__ import annotations

import pytest

from app.core import config


@pytest.fixture(autouse=True)
def isolate_backend_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BACKEND_DIR", tmp_path)
    return tmp_path


def test_replaces_existing_key_and_preserves_order(tmp_path):
    env_file = tmp_path / ".env"
    initial_text = "# Header comment\n\nEXISTING_KEY=old_value\nOTHER_KEY=keep_this\n# Trailing comment\n"
    env_file.write_text(initial_text, encoding="utf-8")

    config.write_env_values({"EXISTING_KEY": "new_value"})

    lines = env_file.read_text(encoding="utf-8").splitlines()
    assert lines == [
        "# Header comment",
        "",
        "EXISTING_KEY=new_value",
        "OTHER_KEY=keep_this",
        "# Trailing comment",
    ]


def test_replaces_commented_key(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("#MY_KEY=default_val\nOTHER=1\n", encoding="utf-8")

    config.write_env_values({"MY_KEY": "activated_val"})

    lines = env_file.read_text(encoding="utf-8").splitlines()
    assert lines == ["MY_KEY=activated_val", "OTHER=1"]


def test_appends_new_key_and_creates_file_if_missing(tmp_path):
    env_file = tmp_path / ".env"
    assert not env_file.exists()

    config.write_env_values({"FIRST_KEY": "val1"})
    assert env_file.exists()
    assert env_file.read_text(encoding="utf-8").splitlines() == ["FIRST_KEY=val1"]

    config.write_env_values({"SECOND_KEY": "val2"})
    assert env_file.read_text(encoding="utf-8").splitlines() == [
        "FIRST_KEY=val1",
        "SECOND_KEY=val2",
    ]


def test_drops_second_active_key_but_keeps_commented_example(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "DUP=active_first\n#DUP=commented_example\nDUP=active_second\nKEEP=1\n",
        encoding="utf-8",
    )

    config.write_env_values({"DUP": "updated"})

    lines = env_file.read_text(encoding="utf-8").splitlines()
    assert lines == [
        "DUP=updated",
        "#DUP=commented_example",
        "KEEP=1",
    ]


def test_rejects_multiline_or_null_bytes_and_leaves_file_untouched(tmp_path):
    env_file = tmp_path / ".env"
    initial = "SAFE=1\n"
    env_file.write_text(initial, encoding="utf-8")

    for bad_val in ("line1\nline2", "line1\rline2", "bad\x00val"):
        with pytest.raises(ValueError, match="must be a single line"):
            config.write_env_values({"TEST": bad_val})

    assert env_file.read_text(encoding="utf-8") == initial


def test_leaves_no_tmp_file_behind(tmp_path):
    env_file = tmp_path / ".env"
    config.write_env_values({"KEY": "value"})

    assert env_file.exists()
    tmp_candidate = tmp_path / ".env.tmp"
    assert not tmp_candidate.exists()


def test_honours_vitagraph_env_file_override(tmp_path, monkeypatch):
    custom_dir = tmp_path / "custom"
    custom_dir.mkdir()
    custom_file = custom_dir / "override.env"

    monkeypatch.setenv("VITAGRAPH_ENV_FILE", str(custom_file))

    config.write_env_values({"CUSTOM": "val"})

    assert custom_file.exists()
    assert custom_file.read_text(encoding="utf-8").splitlines() == ["CUSTOM=val"]
    assert not (tmp_path / ".env").exists()


def test_apply_model_connection(tmp_path, monkeypatch):
    settings = config.settings
    fields = (
        "model_api_url",
        "model_api_key",
        "model_name",
        "model_api_format",
        "model_reasoning_effort",
        "agentrouter_api_key",
        "agentrouter_base_url",
        "agentrouter_model",
        "agentrouter_fallback_models",
        "ai_service_api_key",
    )
    for field in fields:
        monkeypatch.setattr(settings, field, getattr(settings, field))

    settings.apply_model_connection(
        url="https://example.invalid/v1",
        key="test-key-ABCDEFGH1234",
        model="m1",
        api_format="responses",
        reasoning_effort="low",
        persist=False,
    )
    assert settings.effective_api_key == "test-key-ABCDEFGH1234"
    assert settings.effective_base_url == "https://example.invalid/v1"
    assert settings.effective_model == "m1"
    assert settings.api_format == "responses"

    settings.apply_model_connection(
        url="https://example.invalid/v1",
        key="",
        model="m1",
        api_format="chat",
        reasoning_effort="low",
        persist=False,
    )
    assert settings.api_format == "chat"
    assert settings.effective_api_key == "test-key-ABCDEFGH1234"

    settings.apply_model_connection(
        url="https://example.invalid/v1",
        key="test-key-ABCDEFGH1234",
        model="m1",
        api_format="responses",
        reasoning_effort="low",
        persist=True,
    )
    env_lines = (tmp_path / ".env").read_text(encoding="utf-8").splitlines()
    assert "MODEL_API_URL=https://example.invalid/v1" in env_lines
    assert "MODEL_NAME=m1" in env_lines
    assert "MODEL_API_FORMAT=responses" in env_lines
    assert "MODEL_REASONING_EFFORT=low" in env_lines
    assert "MODEL_API_KEY=test-key-ABCDEFGH1234" in env_lines


def test_forget_model_key(tmp_path, monkeypatch):
    settings = config.settings
    fields = (
        "model_api_url",
        "model_api_key",
        "model_name",
        "model_api_format",
        "model_reasoning_effort",
        "agentrouter_api_key",
        "agentrouter_base_url",
        "agentrouter_model",
        "agentrouter_fallback_models",
        "ai_service_api_key",
    )
    for field in fields:
        monkeypatch.setattr(settings, field, getattr(settings, field))

    settings.apply_model_connection(
        url="https://example.invalid/v1",
        key="test-key-ABCDEFGH1234",
        model="m1",
        api_format="responses",
        reasoning_effort="low",
        persist=True,
    )
    assert settings.effective_api_key == "test-key-ABCDEFGH1234"

    settings.forget_model_key(persist=True)
    assert settings.effective_api_key == ""

    env_lines = (tmp_path / ".env").read_text(encoding="utf-8").splitlines()
    assert "MODEL_API_KEY=" in env_lines
