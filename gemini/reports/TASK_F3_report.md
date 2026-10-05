# TASK F3 report

## 1. What I was asked to do
Collect the agent's safety guarantees into one consolidated test suite and add new tests covering safety paths added by the redesign. Implement `test_boundary_refusal_in_a_resumed_conversation_starts_no_runtime` and `test_no_tool_accepts_a_persona_argument_at_any_depth` in `tests/test_agent_safety_suite.py` (skipping D5-dependent artifact tests since D5 is not done). Provide the unified safety suite command and verify baseline + 2 on the full test suite.

## 2. What I actually did
1. Created `vitagraph/backend/tests/test_agent_safety_suite.py` containing:
   - `test_boundary_refusal_in_a_resumed_conversation_starts_no_runtime`: verifies that a medical boundary question asked in turn 3 of an existing conversation refuses immediately without starting any runtime, emitting exactly `["text_delta", "completed", "done"]`.
   - `test_no_tool_accepts_a_persona_argument_at_any_depth`: recursively inspects all tool schemas provided by the `vitagraph` MCP server, ensuring no property name at any depth contains `user`, `persona`, `patient`, or `owner` (case-insensitive).
   - Skipped D5-dependent artifact tests since D5 has not been implemented.
2. Executed the single consolidated Safety Suite Command covering the 7 existing safety tests and the 2 new safety tests (9 passed in 52.09s).
3. Ran the full backend test suite (207 passed in 242.89s, baseline 205 + 2).

## 3. Files changed
- `vitagraph/backend/tests/test_agent_safety_suite.py` (+77/-0): New safety test suite for resumed boundary refusal and recursive tool schema parameter checks.
- `gemini/reports/TASK_F3_report.md` (+75/-0): Task execution and verification report.

## 4. Commands and their output
Safety suite command:
```powershell
$PY = "F:\kiruthika\kiruthika final project\vitagraph\backend\.venv\Scripts\python.exe"; & $PY -m pytest tests/test_agent_service.py::test_a_boundary_question_is_refused_without_starting_any_runtime tests/test_agent_service.py::test_a_question_that_is_only_an_injection_is_refused_without_a_runtime tests/test_agent_mcp_server.py::test_the_server_offers_exactly_four_tools_without_any_persona_parameter tests/test_agent_mcp_server.py::test_a_persona_can_not_read_another_personas_report tests/test_agent_profile.py::test_lockdown_check_accepts_exactly_the_four_tools_and_refuses_anything_else tests/test_agent_profile.py::test_a_real_runtime_is_locked_down_and_the_persona_cannot_be_overridden tests/test_safety.py::test_prompt_injection_text_is_treated_as_data tests/test_agent_safety_suite.py -q -p no:cacheprovider
```
Output:
```
.........                                                                [100%]
9 passed in 52.09s
```

Full suite command:
```powershell
$env:AI_SERVICE_API_KEY = "test-placeholder-key"; $PY = "F:\kiruthika\kiruthika final project\vitagraph\backend\.venv\Scripts\python.exe"; & $PY -m pytest tests -q -p no:cacheprovider
```
Output:
```
........................................................................ [ 34%]
........................................................................ [ 69%]
...............................................................          [100%]
207 passed in 242.89s (0:04:02)
```

## 5. Acceptance checklist
- [x] The new tests exist with exactly these names, and the D5 pair exists only when D5 is done: PASS (`test_boundary_refusal_in_a_resumed_conversation_starts_no_runtime` and `test_no_tool_accepts_a_persona_argument_at_any_depth` exist; D5 pair skipped).
- [x] The safety suite command passes: PASS (9 passed in 52.09s).
- [x] No existing test was edited: PASS (`git status` shows only new test file and report).
- [x] Full suite: baseline + 2: PASS (207 passed vs baseline of 205).

## 6. Things that surprised me
none

## 7. Deviations from the task
Steps marked "Only when D5 is done" were skipped because D5 is not done, per task instructions.

## 8. Open questions for the reviewer
none

## 9. How the reviewer can double-check
1. `git branch --show-current` (verifies `redesign/backend-track`)
2. Run the Safety suite command:
   `cd vitagraph\backend; $PY = "F:\kiruthika\kiruthika final project\vitagraph\backend\.venv\Scripts\python.exe"; & $PY -m pytest tests/test_agent_service.py::test_a_boundary_question_is_refused_without_starting_any_runtime tests/test_agent_service.py::test_a_question_that_is_only_an_injection_is_refused_without_a_runtime tests/test_agent_mcp_server.py::test_the_server_offers_exactly_four_tools_without_any_persona_parameter tests/test_agent_mcp_server.py::test_a_persona_can_not_read_another_personas_report tests/test_agent_profile.py::test_lockdown_check_accepts_exactly_the_four_tools_and_refuses_anything_else tests/test_agent_profile.py::test_a_real_runtime_is_locked_down_and_the_persona_cannot_be_overridden tests/test_safety.py::test_prompt_injection_text_is_treated_as_data tests/test_agent_safety_suite.py -q -p no:cacheprovider`
3. Run the full suite command:
   `cd vitagraph\backend; $env:AI_SERVICE_API_KEY = "test-placeholder-key"; $PY = "F:\kiruthika\kiruthika final project\vitagraph\backend\.venv\Scripts\python.exe"; & $PY -m pytest tests -q -p no:cacheprovider`
