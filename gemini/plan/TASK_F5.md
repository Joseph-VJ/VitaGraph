<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task F5 — Paid-API follow-up (waiting for the owner)

- **Goal:** Once the owner supplies a paid AI key, capture the harness's real event shapes, check the mapper against them, and re-run every check recorded as `API blocked`.
- **Tier:** Should
- **Size:** M
- **Review:** gate
- **Depends on:** D12
- **Files to read first:**
  - `vitagraph/backend/app/agent/mapper.py`
  - `vitagraph/backend/tests/test_agent_mapper.py`
  - every report under `gemini/reports/` that says `API blocked`
- **Files to create or modify:**
  - modify `vitagraph/backend/app/services/agent_service.py`
  - create `vitagraph/backend/tests/test_agent_mapper_real_shapes.py`

**Status:** waiting for the owner. Do not start until the owner confirms a paid key is set in `vitagraph/backend/.env`. The worker never reads, prints or copies the key (rule 8).

**What to change**
1. **Opt-in capture:** in `agent_service.py`, at the mapper loop (`vitagraph/backend/app/services/agent_service.py` line 278, anchor `for ev in mapper.feed(msg):`), add a capture that runs only when the environment variable `VITAGRAPH_AGENT_CAPTURE` names a folder.
   - It appends each raw harness message to `<folder>/<conversation_id>.jsonl`.
   - It removes the key the same way the mapper's redaction does (`tests/test_agent_mapper.py::test_the_key_is_redacted_from_a_turn_end_error` pins that behaviour).
   - It is off by default. The folder must be outside the repository, or ignored by git.
2. **Capture these shapes:** run three questions with the AI on: "What was my vitamin D result?", "How did my vitamin D change between my reports?" and "What was my ferritin level?". Record one real example of each of these from the capture, with any personal text shortened:
   - `assistant/message`: the content blocks for text, reasoning and tool-call, and `usage` with `inputTokens`, `outputTokens` and `reasoningTokens`;
   - `tool/call`: `callId`, `name`, and `arguments` as a JSON string;
   - `tool/result`: `message.toolCallId`, `isError`, `content`, and `error` when present;
   - `turn/end`: `reason`;
   - `llm/retry`: `retry` and `provider`;
   - `session/title`.
3. **Compare with the mapper's assumptions.** These existing tests encode the assumed shapes:
   - `tests/test_agent_mapper.py::test_reasoning_and_text_blocks_become_thinking_and_text_delta`
   - `tests/test_agent_mapper.py::test_tool_call_uses_the_short_name_and_parsed_arguments`
   - `tests/test_agent_mapper.py::test_search_results_collect_evidence_cards_once_per_chunk_and_keep_their_refs`
   - `tests/test_agent_mapper.py::test_a_tool_error_becomes_an_error_result`
   - `tests/test_agent_mapper.py::test_llm_retry_events_become_retrying_status_with_a_counter`
   - `tests/test_agent_mapper.py::test_step_events_and_usage_produce_stats_and_never_invent_token_counts`
   - `tests/test_agent_mapper.py::test_the_latest_session_title_is_kept`
   
   Do **not** edit them (rule 7). Instead, create `tests/test_agent_mapper_real_shapes.py`. It feeds the captured, redacted examples through `EventMapper` and asserts the events the UI needs.
   - If a captured shape breaks the mapper, fix the mapper in this task.
   - If an existing test's assumption contradicts the real shape, list it in the report for the owner to decide.
4. **Re-run every check recorded as `API blocked`:**
   - D11 verify step 3 (the loop, stats and tokens with the AI on);
   - D10's `show_code` card, when D10 and D5 are done;
   - every `API blocked` line in `gemini/reports/` from earlier tasks.
   
   Paste each result.

**How to verify**
1. `.venv\Scripts\python.exe -m pytest tests\test_agent_mapper.py tests\test_agent_mapper_real_shapes.py -q -p no:cacheprovider`. Both pass.
2. The full suite passes at baseline + the number of new tests.
3. The capture is off when the variable is unset. Run one question without it, and no file is written.

**Acceptance criteria**
- [ ] One real example of each listed shape is recorded, with no key in it.
- [ ] Every earlier `API blocked` check was re-run (results pasted).
- [ ] No existing test was edited.
