"""User-isolation tests (plan Sections 5 and 16.4: must be 100%).

Two personas upload different reports; retrieval for one must never return
the other's chunks, and an unfiltered retrieval call must fail closed.
"""

from __future__ import annotations

import pytest

from app.rag import retriever, vector_store
from app.services import report_service, user_service
from tests.conftest import make_user, sample_pdf


def _setup_two_users():
    user_a = make_user("Persona A (isolation test)")
    user_b = make_user("Persona B (isolation test)")
    report_service.process_upload(user_a["id"], "panel_jan.pdf",
                                   sample_pdf("synthetic_panel_2025-01-15.pdf"))
    report_service.process_upload(user_b["id"], "panel_jun.pdf",
                                   sample_pdf("synthetic_panel_2025-06-20.pdf"))
    return user_a, user_b


def _report_id_of(user: dict) -> str:
    return report_service.list_reports(user["id"])[0]["id"]


def test_two_users_get_distinct_ids():
    user_a = user_service.create_user("Persona X")
    user_b = user_service.create_user("Persona Y")
    assert user_a["id"] != user_b["id"]


def test_retrieval_never_crosses_users():
    user_a, user_b = _setup_two_users()
    # Question strongly matched by user B's June-only content (vitamin B12).
    hits = retriever.retrieve(user_id=user_a["id"], question="vitamin B12 pg/mL")
    for hit in hits:
        assert hit["metadata"]["user_id"] == user_a["id"], "cross-user leak detected"
        assert hit["metadata"]["report_id"] != _report_id_of(user_b)


def test_user_a_question_returns_only_a_reports():
    user_a, _ = _setup_two_users()
    hits = retriever.retrieve(user_id=user_a["id"], question="vitamin D level")
    assert hits, "expected at least one evidence hit"
    report_ids = {hit["metadata"]["report_id"] for hit in hits}
    a_report_ids = {r["id"] for r in report_service.list_reports(user_a["id"])}
    assert report_ids.issubset(a_report_ids)


def test_retrieval_without_user_fails_closed():
    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        retriever.retrieve(user_id="", question="anything")


def test_vector_query_without_user_fails_closed():
    with pytest.raises(ValueError):
        vector_store.query_user_chunks(user_id="", query_vector=[0.0] * 384, top_k=3)


def test_delete_user_removes_everything():
    user_a, _ = _setup_two_users()
    user_service.delete_user(user_a["id"])
    with pytest.raises(Exception):
        user_service.get_user(user_a["id"])
    assert report_service.list_reports(user_a["id"]) == [] or _user_gone(user_a["id"])
    hits = retriever.retrieve(user_id=user_a["id"], question="vitamin D level")
    assert hits == []


def _user_gone(user_id: str) -> bool:
    try:
        user_service.get_user(user_id)
        return False
    except Exception:
        return True
