"""Consent control tests (plan Section 15.2: consent before upload)."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.services import report_service, timeline_service, user_service
from tests.conftest import sample_pdf


def test_upload_without_consent_is_refused():
    user = user_service.create_user("No-consent persona")   # consent NOT accepted
    assert user["consent_accepted"] is False
    with pytest.raises(HTTPException) as excinfo:
        report_service.process_upload(
            user["id"], "jan.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    assert excinfo.value.status_code == 403


def test_consent_unlocks_upload_and_is_recorded():
    user = user_service.create_user("Consent persona")
    accepted = user_service.accept_consent(user["id"])
    assert accepted["consent_accepted"] is True

    result = report_service.process_upload(
        user["id"], "jan.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    assert result["status"] == "ready"

    events = timeline_service.list_events(user["id"])
    consent_events = [e for e in events if e["event_type"] == "consent_accepted"]
    assert len(consent_events) == 1
    assert consent_events[0]["payload"]["statement_version"]


def test_consent_is_idempotent():
    user = user_service.create_user("Idempotent persona")
    user_service.accept_consent(user["id"])
    user_service.accept_consent(user["id"])
    events = [e for e in timeline_service.list_events(user["id"])
              if e["event_type"] == "consent_accepted"]
    assert len(events) == 1
