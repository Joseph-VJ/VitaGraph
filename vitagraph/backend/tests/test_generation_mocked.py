"""Mocked-generation integration tests (plan Section 16: generation testing).

Exercises the allow_api=true path end-to-end with a fake chat-completions
transport, covering: healthy generated answers, the numeric grounding check
(D03), persistence of the fallback reason, and the disabled path.
"""

from __future__ import annotations

import httpx
import pytest

from app.core.config import settings
from app.core.database import get_db
from app.generation import ai_client
from app.services import question_service, report_service
from tests.conftest import make_user, sample_pdf


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


class _FakeClient:
    payload = {"choices": [{"message": {"content": "unset"}}]}

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def post(self, url, json=None, headers=None):
        return _FakeResponse(_FakeClient.payload)


def _prepared_persona():
    user = make_user("Mocked generation persona")
    report_service.process_upload(user["id"], "jan.pdf",
                                   sample_pdf("synthetic_panel_2025-01-15.pdf"))
    return user


@pytest.fixture
def api_enabled(monkeypatch):
    monkeypatch.setattr(settings, "allow_api", True)
    yield
    monkeypatch.setattr(settings, "allow_api", False)


def test_generated_answer_is_used_when_safe(api_enabled, monkeypatch):
    _FakeClient.payload = {"choices": [{"message": {"content": (
        "Your January report lists Vitamin D, 25-Hydroxy at 18 ng/mL with a "
        "reference range of 30 - 100 ng/mL. No interpretation is offered."
    )}}]}
    monkeypatch.setattr(httpx, "Client", _FakeClient)

    user = _prepared_persona()
    answer = question_service.ask(user["id"], "What was my vitamin D level?")
    assert answer["status"] == "answered"
    assert answer["ai_service_status"] == "ok"
    assert "18 ng/mL" in answer["summary_text"]


def test_invented_measurement_is_replaced_and_reason_persisted(api_enabled, monkeypatch):
    # The response quotes a real value AND invents '999 mg/dL' ferritin.
    _FakeClient.payload = {"choices": [{"message": {"content": (
        "Your Vitamin D is 18 ng/mL. Also, your ferritin was 999 mg/dL which is severe."
    )}}]}
    monkeypatch.setattr(httpx, "Client", _FakeClient)

    user = _prepared_persona()
    answer = question_service.ask(user["id"], "What was my vitamin D level?")
    assert answer["status"] == "answered"
    # Safety check failed -> local evidence-only composer replaced the answer.
    assert answer["ai_service_status"] == "replaced_by_fallback"
    assert "999 mg/dL" not in answer["summary_text"]

    with get_db() as db:
        row = db.execute(
            "SELECT ai_service_status, safety_check_note FROM answers "
            "WHERE question_id = ?",
            (answer["question_id"],)).fetchone()
    assert row["ai_service_status"] == "replaced_by_fallback"
    assert row["safety_check_note"] and "999mg/dl" in row["safety_check_note"].lower()


def test_formatting_differences_do_not_trigger_replacement(api_enabled, monkeypatch):
    """D03 regression: '18ng/mL' (no space) must still pass the check."""
    _FakeClient.payload = {"choices": [{"message": {"content": (
        "Vitamin D: 18ng/mL (range 30 - 100 ng/mL)."
    )}}]}
    monkeypatch.setattr(httpx, "Client", _FakeClient)

    user = _prepared_persona()
    answer = question_service.ask(user["id"], "What was my vitamin D level?")
    assert answer["ai_service_status"] == "ok"


def test_service_error_falls_back_with_reason_persisted(api_enabled, monkeypatch):
    class _BrokenClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, json=None, headers=None):
            raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(httpx, "Client", _BrokenClient)

    user = _prepared_persona()
    answer = question_service.ask(user["id"], "What was my vitamin D level?")
    assert answer["status"] == "answered"
    assert answer["ai_service_status"] == "error"
    assert "18 ng/mL" in answer["summary_text"]      # local composer evidence

    with get_db() as db:
        row = db.execute(
            "SELECT safety_check_note FROM answers WHERE question_id = ?",
            (answer["question_id"],)).fetchone()
    assert row["safety_check_note"] and "failed" in row["safety_check_note"].lower()


def test_disabled_service_never_touches_the_network(monkeypatch):
    def _fail(*args, **kwargs):
        raise AssertionError("network transport must not be used when disabled")

    monkeypatch.setattr(httpx, "Client", _fail)
    assert settings.allow_api is False

    user = _prepared_persona()
    answer = question_service.ask(user["id"], "What was my vitamin D level?")
    assert answer["status"] == "answered"
    assert answer["ai_service_status"] == "disabled"
