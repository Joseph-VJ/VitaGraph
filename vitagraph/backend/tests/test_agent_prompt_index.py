"""The agent is told which reports exist, so it does not spend a model step listing them."""

from __future__ import annotations

from app.services import agent_service, report_service
from tests.conftest import make_user, sample_pdf


def test_the_prompt_lists_the_reports_when_no_report_is_in_scope():
    index = [("rpt_1", "jan.pdf", "2025-01-15"), ("rpt_2", "jun.pdf", None)]
    prompt = agent_service.build_prompt([], "What changed?", None, index)
    assert "rpt_1: jan.pdf (2025-01-15)" in prompt and "rpt_2: jun.pdf" in prompt
    assert "do not need list_reports" in prompt
    assert prompt.rstrip().endswith("What changed?")


def test_a_report_in_scope_replaces_the_list():
    prompt = agent_service.build_prompt([], "Summarize", ("jan.pdf", "rpt_1"), [("rpt_2", "x.pdf", None)])
    assert "report_id rpt_1" in prompt and "rpt_2" not in prompt


def test_with_nothing_to_add_the_prompt_is_just_the_question():
    assert agent_service.build_prompt([], "Hello?", None, []) == "Hello?"


def test_the_index_holds_only_this_personas_reports():
    mine = make_user("Index mine")
    other = make_user("Index other")
    report_service.process_upload(mine["id"], "mine.pdf", sample_pdf("synthetic_panel_2025-01-15.pdf"))
    report_service.process_upload(other["id"], "theirs.pdf", sample_pdf("synthetic_panel_2025-06-20.pdf"))
    index = agent_service._report_index(mine["id"])
    assert [name for _, name, _ in index] == ["mine.pdf"]
