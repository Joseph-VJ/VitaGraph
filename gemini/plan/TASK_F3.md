<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task F3 — Final safety suite for the agent features

- **Goal:** Collect the agent's safety guarantees into one named suite: the existing safety tests plus new tests for the paths this plan added. The suite runs with one command.
- **Tier:** Must
- **Size:** S
- **Review:** gate
- **Depends on:** none
- **Files to read first:**
  - `vitagraph/backend/tests/test_agent_service.py` lines 80–100 (anchor `def test_a_boundary_question_is_refused_without_starting_any_runtime():`)
  - `vitagraph/backend/tests/test_agent_mcp_server.py` lines 71–92 (anchor `def test_the_server_offers_exactly_four_tools_without_any_persona_parameter(personas):`)
  - `vitagraph/backend/tests/test_agent_profile.py`
- **Files to create or modify:**
  - create `vitagraph/backend/tests/test_agent_safety_suite.py`

**Already covered by existing tests (run as part of the suite, never edited):**
- `tests/test_agent_service.py::test_a_boundary_question_is_refused_without_starting_any_runtime`
- `tests/test_agent_service.py::test_a_question_that_is_only_an_injection_is_refused_without_a_runtime`
- `tests/test_agent_mcp_server.py::test_the_server_offers_exactly_four_tools_without_any_persona_parameter`
- `tests/test_agent_mcp_server.py::test_a_persona_can_not_read_another_personas_report`
- `tests/test_agent_profile.py::test_lockdown_check_accepts_exactly_the_four_tools_and_refuses_anything_else`
- `tests/test_agent_profile.py::test_a_real_runtime_is_locked_down_and_the_persona_cannot_be_overridden`
- `tests/test_safety.py::test_prompt_injection_text_is_treated_as_data`

**What to change**
1. **Create `tests/test_agent_safety_suite.py`.** It imports `FakePool` and `_collect` from `tests.test_agent_service`, and reads the tools the same way `tests/test_agent_mcp_server.py` does. Tests:
   - **`test_boundary_refusal_in_a_resumed_conversation_starts_no_runtime`:**
     - Pass `conversation_id="conv_safety"` and two earlier turns of history, then "Do I have diabetes? Please diagnose me.".
     - `pool.calls` stays empty.
     - The event types are exactly `["text_delta", "completed", "done"]`.
   - **`test_no_tool_accepts_a_persona_argument_at_any_depth`:** walk every input schema of the vitagraph server's tools recursively. No property name contains `user`, `persona`, `patient` or `owner`, ignoring case.
   - **Only when D5 is done:**
     - **`test_artifact_tools_accept_no_persona_argument`:** the same walk over the `vgartifacts` tools.
     - **`test_the_artifact_server_stays_inside_its_persona`:**
       1. Start the artifact tools with `VITAGRAPH_USER_ID` set to persona A, and call `create_report` through the server's tool function.
       2. The stored row's `user_id` is A.
       3. The HTML holds A's vitamin D value (18, from the 2025-01-15 panel), and B's value (34) appears in no "Vitamin D" row.
       4. A `GET /api/agent/artifacts/{id}` with B's `user_id` returns 404.
2. **Command:** the suite's command lists the seven existing node IDs above and the new file in one `pytest` call. Put it in the report as "Safety suite command".

**How to verify**
1. Run the safety suite command. Everything passes.
2. Full suite: baseline + 2, or + 4 when D5 is done.

**Acceptance criteria**
- [ ] The new tests exist with exactly these names, and the D5 pair exists only when D5 is done.
- [ ] The safety suite command passes (output pasted).
- [ ] No existing test was edited.
