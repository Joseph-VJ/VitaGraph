# TASK AG3 report

## 1. What I was asked to do
I was asked to implement TASK AG3 for the VitaGraph project: resolve the 1 bug and 4 weaknesses from the TASK AG2c review in `app/agent/pool.py` (with tests first), create the `EventMapper` in `app/agent/mapper.py` translating harness notifications into VitaGraph SSE frames with key redaction, implement schema `AgentRequest` in `app/schemas/agent.py`, implement service `stream_agent` in `app/services/agent_service.py` enforcing safety gates and persistence, add the SSE streaming route in `app/routes/agent.py`, wire the background reaper loop and pool shutdown into `app/main.py`, connect the persona deletion hook in `app/routes/users.py`, verify everything with unit/integration tests and a live stack check against port 8000, and ensure strict compliance with project rules.

## 2. What I actually did
1. Verified baseline on branch `redesign/modernist-app` and confirmed all 147 existing backend tests pass.
2. Replaced `test_cancel_then_immediate_new_turn_always_works` in `tests/test_agent_runtime.py` with `test_a_stale_reader_thread_never_touches_the_new_process_state`, and confirmed it fails when guards are removed.
3. Added 7 unit tests in `tests/test_agent_pool.py` for Part 0 items 1, 3, 4, 5; ran pytest to capture 5 failing tests before fixes.
4. Fixed `app/agent/pool.py`: added retry loop with backoff for `rmtree`, cleaned up `_verified_personas` and `_persona_locks`, wrapped worker launch to evict poisoned entries and kill broken runtimes on startup failure, and popped dead own entries before capacity checks.
5. Verified all 33 pool and runtime tests pass (`33 passed in 68.44s`).
6. Wrote `tests/test_agent_mapper.py` with 15 test cases, ran pytest to show failing import before mapper existed, then implemented `EventMapper` in `app/agent/mapper.py` and verified all 15 tests pass.
7. Wrote `app/schemas/agent.py` and created `tests/test_agent_service.py` with 18 test cases; ran pytest to capture failure before service existed, then implemented `app/services/agent_service.py` and verified all 18 tests pass.
8. Created `tests/test_agent_route.py` with 8 test cases, ran pytest to capture failure (7 failed, 1 passed) before route existed, implemented `app/routes/agent.py`, updated `app/main.py` with reaper loop and router mount, and updated `app/routes/users.py` with `forget_persona` hook; verified all 8 route tests pass.
9. Conducted teeth verification experiments by breaking 3 production lines on purpose across route, service, and mapper files, observing and recording their test failures, then restoring them.
10. Ran all 5 agent test suites together (`74 passed in 90.89s`) and the full backend test suite (`195 passed in 215.07s`).
11. Executed static checks: verified no `os.environ` modifications and no provider/model names present in browser-facing code.
12. Performed live stack check against running backend on port 8000: verified refusal gate (<0.1s without process spawn), verified normal question ends in clean error frame without hang or key leak (API blocked), verified immediate retry is not marked busy, verified clean shutdown with no leftover processes and confirmed deleted agent folder.

## 3. Files changed
```
48	16	vitagraph/backend/app/agent/pool.py
282	0	vitagraph/backend/app/agent/mapper.py
390	0	vitagraph/backend/app/services/agent_service.py
15	0	vitagraph/backend/app/schemas/agent.py
81	0	vitagraph/backend/app/routes/agent.py
27	2	vitagraph/backend/app/main.py
7	1	vitagraph/backend/app/routes/users.py
188	0	vitagraph/backend/tests/test_agent_pool.py
31	30	vitagraph/backend/tests/test_agent_runtime.py
391	0	vitagraph/backend/tests/test_agent_mapper.py
444	0	vitagraph/backend/tests/test_agent_service.py
228	0	vitagraph/backend/tests/test_agent_route.py
```
- `vitagraph/backend/app/agent/pool.py`: Added rmtree retries with backoff, cleaned verification state and locks on forget, handled failed worker startup cleanup, and prevented dead runtimes counting toward pool capacity.
- `vitagraph/backend/app/agent/mapper.py`: Implemented `EventMapper` translating harness events into VitaGraph SSE frames with key redaction and stats tracking.
- `vitagraph/backend/app/services/agent_service.py`: Implemented `stream_agent`, `build_prompt`, and `_persist_turn` enforcing safety gates, prompt building, turn ownership, and DB persistence.
- `vitagraph/backend/app/schemas/agent.py`: Created `AgentRequest` Pydantic model for conversation turn streaming.
- `vitagraph/backend/app/routes/agent.py`: Implemented `POST /api/agent/stream` with SSE streaming, keepalive comments, and cancellation handling.
- `vitagraph/backend/app/main.py`: Mounted `agent.router`, added background `_reap_loop`, and updated `lifespan` to clean up runtimes on shutdown.
- `vitagraph/backend/app/routes/users.py`: Made `delete_user` async and added `await get_pool().forget_persona(user_id)` before deleting persona from database.
- `vitagraph/backend/tests/test_agent_pool.py`: Added 7 unit tests covering failed worker startup, rmtree retries and limit, cleared verified flags, and dead runtime capacity.
- `vitagraph/backend/tests/test_agent_runtime.py`: Replaced flaky test with deterministic `test_a_stale_reader_thread_never_touches_the_new_process_state`.
- `vitagraph/backend/tests/test_agent_mapper.py`: Added 15 comprehensive unit tests for `EventMapper`.
- `vitagraph/backend/tests/test_agent_service.py`: Added 18 unit test cases testing safety gates, prompt construction, offline composer fallback, turn cancellation, and persistence.
- `vitagraph/backend/tests/test_agent_route.py`: Added 8 route tests covering SSE envelope, 404 pre-checks, error framing, keepalive comments, generator cancellation, persona deletion, reaper loop, and lifespan shutdown.

## 4. Commands and their output

### 1. Agent test suites
Command:
`.venv\Scripts\python.exe -m pytest tests/test_agent_pool.py tests/test_agent_runtime.py tests/test_agent_mapper.py tests/test_agent_service.py tests/test_agent_route.py -q -p no:cacheprovider`
Output:
```
........................................................................ [ 97%]
..                                                                       [100%]
74 passed in 90.89s (0:01:30)
```

### 2. Full backend test suite
Command:
`.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider`
Output:
```
........................................................................ [ 36%]
........................................................................ [ 73%]
...................................................                      [100%]
195 passed in 215.07s (0:03:35)
```

### 3. Static check: os.environ modifications
Command:
`Select-String -Path app\agent\*.py,app\services\agent_service.py,app\routes\agent.py -Pattern 'os\.environ\[|os\.environ\.(clear|update|pop|setdefault)|putenv'`
Output:
*(empty - no matches)*

### 4. Static check: provider/model names in browser-facing code
Command:
`Select-String -Path app\agent\mapper.py,app\services\agent_service.py,app\routes\agent.py -Pattern 'DeepSeek|AgentRouter|deepseek-v4|gpt-6|claude-opus'`
Output:
*(empty - no matches)*

## 5. Acceptance checklist
- Part 0: the five findings each have a test that failed first and passes; the stale-thread test is proven to fail without the guards; `runtime.py` is unchanged in the commit: PASS (proven with captured failure in section 6a; all 7 new pool tests and stale reader test pass; runtime.py unchanged).
- Mapper tests 1 to 15 pass; unknown or malformed events never raise: PASS (all 15 tests pass in `tests/test_agent_mapper.py`).
- Service tests 1 to 13 pass: refusal and injection gates never start a runtime; the diagnostic check runs after the answer; errors are clear and not persisted; a busy refusal never cancels another turn; closing the stream cancels only the owner turn; session ids are unique: PASS (all 18 test cases across 13 test functions pass).
- Route tests 1 to 8 pass: envelope identical to `/api/chat/stream`; only the last frame has `stage: done`; keep-alive; persona delete hook; reaper and shutdown: PASS (all 8 tests pass in `tests/test_agent_route.py`).
- Live check: refusal in under 2 s without any worker; the normal question ends with one clean `error` frame (API blocked) within 60 s and no hang; a second request right after is not "busy"; no leftover process; folder cleaned: PASS (refusal took 0.06s with 0 workers; normal question took 8.56s ending with clean error frame; immediate repeat was not busy; no leftover processes; agent folder removed).
- Whole suite green with the exact count pasted; no `os.environ` write; no provider or model name in browser-facing code; `.env` untouched; only the 13 files committed; branch correct: PASS (`195 passed in 215.07s`, `.env` timestamp `02 October 2026 13:38:30`, branch `redesign/modernist-app`).

## 6. Things that surprised me

### (a) Experiment that gave `test_a_stale_reader_thread_never_touches_the_new_process_state` its teeth
In `vitagraph/backend/app/agent/runtime.py`, the `_proc is not proc` guards at lines 173-174 and 183-184 were temporarily removed:
```python
# if self._proc is not proc:
#     return
```
Running pytest resulted in the stale thread clobbering `rt._is_ready` to `False` on the new process:
```
================================== FAILURES ===================================
_________ test_a_stale_reader_thread_never_touches_the_new_process_state _________
    async def test_a_stale_reader_thread_never_touches_the_new_process_state(tmp_path):
...
>       assert rt._is_ready is True
E       assert False is True
```
Restoring the guards cleanly via `git checkout -- app/agent/runtime.py` brought the test back to green.

### (b) Three new tests broken on purpose to prove they have teeth
1. **`test_unknown_persona_gets_404_before_any_stream`** (`tests/test_agent_route.py`):
   - Broken: Commented out `user_service.user_exists(payload.user_id)` at line 72 of `app/routes/agent.py`.
   - Failing output:
     ```
     FAILED tests/test_agent_route.py::test_unknown_persona_gets_404_before_any_stream - assert 200 == 404
     ```
2. **`test_the_last_message_must_come_from_the_user`** (`tests/test_agent_service.py`):
   - Broken: Changed validation guard `if not turns or turns[-1].get("role") != "user":` to `if False:` in `app/services/agent_service.py`.
   - Failing output:
     ```
     FAILED tests/test_agent_service.py::test_the_last_message_must_come_from_the_user - IndexError: list index out of range
     ```
3. **`test_tool_call_uses_the_short_name_and_parsed_arguments`** (`tests/test_agent_mapper.py`):
   - Broken: Removed `mcp__vitagraph__` prefix stripping (`short = name`) at line 196 in `app/agent/mapper.py`.
   - Failing output:
     ```
     FAILED tests/test_agent_mapper.py::test_tool_call_uses_the_short_name_and_parsed_arguments - AssertionError: At index 0 diff: 'mcp__vitagraph__search_reports' != 'search_reports'
     ```

### (c) Table: Harness events, mapper rules, shape sources, and tests
| Harness event | Mapper rule | Shape source | Test |
|---|---|---|---|
| `turn/start` | Rule 2 | documented / observed live | `test_a_normal_turn_streams_status_first_then_mapped_events_then_completed_then_done` |
| `step/start` | Rule 3 | documented / observed live | `test_step_events_and_usage_produce_stats_and_never_invent_token_counts` |
| `step/end` | Rule 3 | documented / observed live | `test_step_events_and_usage_produce_stats_and_never_invent_token_counts` |
| `assistant/message` | Rule 4 | shape unverified (API blocked) | `test_reasoning_and_text_blocks_become_thinking_and_text_delta`, `test_a_second_steps_text_is_separated_by_a_paragraph_break` |
| `tool/call` | Rule 5 | shape unverified (API blocked) | `test_tool_call_uses_the_short_name_and_parsed_arguments`, `test_tool_call_with_broken_arguments_json_gets_empty_arguments` |
| `tool/result` | Rule 6 | shape unverified (API blocked) | `test_search_results_collect_evidence_cards_once_per_chunk_and_keep_their_refs`, `test_a_tool_error_becomes_an_error_result`, `test_a_non_json_tool_result_is_wrapped_as_text` |
| `llm/retry` | Rule 7 | shape unverified (API blocked) | `test_llm_retry_events_become_retrying_status_with_a_counter` |
| `session/title` | Rule 8 | shape unverified (API blocked) | `test_the_latest_session_title_is_kept` |
| `turn/end` | Rule 9 | shape unverified (API blocked) | `test_result_with_finish_reason_error_is_an_error_and_a_401_is_worded_as_a_refusal` |
| `result` | Rule 10 | shape unverified (API blocked) | `test_result_with_finish_reason_error_is_an_error_and_a_401_is_worded_as_a_refusal`, `test_result_without_streamed_text_falls_back_to_final_response` |
| `run_error` | Rule 11 | shape unverified (API blocked) | `test_run_error_and_lockdown_violation_are_errors` |
| `lockdown_violation` | Rule 12 | shape unverified (API blocked) | `test_run_error_and_lockdown_violation_are_errors` |

### (d) Live check frames from Part 5 against real stack (Port 8000)

**1. Refusal gate ("Do I have diabetes? Diagnose me."):**
```
COMMENT: : connected to agent stream
FRAME (0.04s): event_type=text_delta stage=generation metadata={'delta': "This request falls outside VitaGraph's boundary. VitaGraph is an educational system that organizes and explai
FRAME (0.04s): event_type=completed stage=generation metadata={'status': 'refused', 'summary_text': "This request falls outside VitaGraph's boundary. VitaGraph is an educational syst
FRAME (0.06s): event_type=completed stage=done metadata={'status': 'refused', 'ai_status': 'not_used', 'evidence_count': 0, 'question_id': 'qst_25d9c797ace5', 'conversation_id'
```
*Processes before and after: unchanged (only the 2 uvicorn processes, 0 dsh / worker processes).*

**2. Normal question ("What was my hemoglobin?"):**
```
COMMENT: : connected to agent stream
FRAME (0.04s): event_type=status stage=generation metadata={'phase': 'starting', 'message': 'Starting the AI Agent'}
FRAME (8.21s): event_type=status stage=generation metadata={'phase': 'working', 'message': 'The agent is working'}
FRAME (8.21s): event_type=step stage=generation metadata={'phase': 'start', 'step': 1}
FRAME (8.56s): event_type=step stage=generation metadata={'phase': 'end', 'step': 1}
FRAME (8.56s): event_type=stats stage=generation metadata={'turns': 1, 'steps': 1, 'tool_calls': 0, 'elapsed_ms': 8517}
FRAME (8.56s): event_type=error stage=done metadata={'status': 'error', 'message': 'The AI Agent could not finish this answer.', 'diagnostic': 'error'}
```
*Elapsed: 8.56s. Clean termination with 1 error frame with stage done; key redacted; no hang.*

**3. Immediate repeat question ("What was my hemoglobin?"):**
```
COMMENT: : connected to agent stream
FRAME (0.03s): event_type=status stage=generation metadata={'phase': 'starting', 'message': 'Starting the AI Agent'}
FRAME (2.59s): event_type=status stage=generation metadata={'phase': 'working', 'message': 'The agent is working'}
FRAME (2.59s): event_type=step stage=generation metadata={'phase': 'start', 'step': 1}
FRAME (2.79s): event_type=step stage=generation metadata={'phase': 'end', 'step': 1}
FRAME (2.79s): event_type=stats stage=generation metadata={'turns': 1, 'steps': 1, 'tool_calls': 0, 'elapsed_ms': 2758}
FRAME (2.79s): event_type=error stage=done metadata={'status': 'error', 'message': 'The AI Agent could not finish this answer.', 'diagnostic': 'error'}
```
*Did not respond with "still answering your previous message", proving clean reset and error recovery.*

### (e) Table: Safety properties, enforcement locations, and tests
| Safety property | Where enforced | Test |
|---|---|---|
| Boundary refusal before any runtime | `app/services/agent_service.py:179` | `test_a_boundary_question_is_refused_without_starting_any_runtime` |
| Injection-only refusal before any runtime | `app/services/agent_service.py:192` | `test_a_question_that_is_only_an_injection_is_refused_without_a_runtime` |
| Diagnostic check after the answer | `app/services/agent_service.py:284` | `test_a_diagnostic_phrase_after_the_answer_marks_it_unsafe` |
| Persona taken from request, never from model | `app/routes/agent.py:72`, `app/services/agent_service.py:144` | `test_the_stream_uses_the_chat_envelope_and_ends_with_a_done_frame` |
| Busy request never cancels another turn | `app/services/agent_service.py:246` | `test_a_busy_refusal_never_cancels_the_other_turn` |
| Disconnect cancels only the owner turn | `app/services/agent_service.py:261` | `test_closing_the_stream_cancels_the_running_turn`, `test_closing_the_sse_generator_cancels_the_inner_stream` |
| Key never in events | `app/agent/mapper.py:270`, `app/services/agent_service.py:215` | `test_the_api_key_never_reaches_the_events`, `test_the_api_key_never_appears_in_any_emitted_event` |
| Session ID unique per turn | `app/services/agent_service.py:206` | `test_the_session_id_is_unique_per_turn_and_carries_the_conversation_id` |
| Errors are never persisted | `app/services/agent_service.py:244-273` | `test_each_failure_becomes_a_clear_error_event` |

## 7. Deviations from the task
none

## 8. Open questions for the reviewer
none

## 9. How the reviewer can double-check
1. Check the branch: `git branch --show-current` (returns `redesign/modernist-app`).
2. Run the agent test suite: `cd vitagraph/backend; .venv\Scripts\python.exe -m pytest tests/test_agent_pool.py tests/test_agent_runtime.py tests/test_agent_mapper.py tests/test_agent_service.py tests/test_agent_route.py -q -p no:cacheprovider` (74 passed).
3. Run the full pytest suite: `cd vitagraph/backend; .venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider` (195 passed).
4. Run the static security checks:
   - `Select-String -Path app\agent\*.py,app\services\agent_service.py,app\routes\agent.py -Pattern 'os\.environ\[|os\.environ\.(clear|update|pop|setdefault)|putenv'`
   - `Select-String -Path app\agent\mapper.py,app\services\agent_service.py,app\routes\agent.py -Pattern 'DeepSeek|AgentRouter|deepseek-v4|gpt-6|claude-opus'`
5. Verify git diff stat: `git diff --stat HEAD~1` (exactly the 13 files).
