"""search_reports hands back a report's opening passages when nothing matches; the tool server warms up."""

from __future__ import annotations

import pytest

from app.services import report_service
from tests.conftest import make_user, sample_pdf
from tests.test_agent_mcp_server import call_mcp_tool

NO_MATCH = "xylophone quasar zebra unrelated gibberish"


@pytest.fixture(scope="module")
def owner():
    user = make_user("Fallback owner")
    report = report_service.process_upload(
        user["id"], "synthetic_panel_2025-01-15.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf")
    )
    return {"user_id": user["id"], "report_id": report["id"]}


def test_a_scoped_search_with_no_close_match_returns_the_opening_passages(owner):
    result = call_mcp_tool(
        owner["user_id"], "search_reports", {"query": NO_MATCH, "report_id": owner["report_id"], "top_k": 3}
    )
    assert "fallback" in result and "opening passages" in result["fallback"]
    cards = result["evidence"]
    assert 1 <= len(cards) <= 3
    assert [c["ref"] for c in cards] == list(range(1, len(cards) + 1))
    assert all(c["report_id"] == owner["report_id"] and c["snippet"] for c in cards)
    assert all(c["char_start"] is not None and c["char_end"] is not None for c in cards)


def test_an_unscoped_search_with_no_match_stays_empty_without_a_fallback(owner):
    result = call_mcp_tool(owner["user_id"], "search_reports", {"query": NO_MATCH})
    assert result == {"evidence": []}


def test_a_real_match_is_not_marked_as_a_fallback(owner):
    result = call_mcp_tool(
        owner["user_id"], "search_reports", {"query": "hemoglobin", "report_id": owner["report_id"]}
    )
    assert "fallback" not in result
    assert result["evidence"]


def test_the_fallback_never_reads_another_personas_report(owner):
    other = make_user("Fallback stranger")
    result = call_mcp_tool(other["id"], "search_reports", {"query": NO_MATCH, "report_id": owner["report_id"]})
    assert result == {"error": "Report not found for this persona."}


def test_the_tool_server_warms_the_embedding_model_in_the_background():
    import inspect

    from app.agent import mcp_server

    source = inspect.getsource(mcp_server.main)
    assert "_warm_embedder" in source and "daemon=True" in source
