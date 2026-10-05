# TASK AG3: the AI Agent streaming route, safety gates, event mapper, persistence (backend)

Read `gemini/RULES.md` first (branch guard 3b, report 5, **work report 5b**, **quality bar 5c**, **5d: the AI API is blocked, never work around it**). Read `gemini/AGENT_PLAN.md` and **`gemini/reviews/TASK_AG2c_review.md` completely** (its bug and four weaknesses are Part 0 of this task). Obey the habits the reviews ask for: `git diff --numstat` for line counts (never estimate), believe the output when it contradicts your checklist, answer PARTIAL when evidence is partial, check process ids and command lines before attributing a process to your test, never print `.env` or a key.

## Why this task exists
Everything under `app/agent/` (tool server, locked-down profile, worker runtime, runtime pool) works but is NOT reachable over HTTP. This task adds the door: `POST /api/agent/stream`. The route (1) applies the same hard safety gates as the existing chat BEFORE any model is involved, (2) hands the question to the person's own harness runtime through the pool, (3) translates the harness's events into the browser event contract, (4) applies the diagnostic-phrase check AFTER the answer, (5) saves the turn so the Timeline and the AI-call log keep working, and (6) cleans up when the browser disconnects. The next stage (AG4) builds the frontend page on this stream, so the wire format below is a contract.

**The AI API is blocked** (free gateway answers the harness with HTTP 401). No real model answer will be seen in this task. All tests use a FAKE pool that yields scripted worker messages. The shapes of the model events in section "Event shapes" below are taken from the harness documentation and are UNVERIFIED until the paid API is available (stage AG6): the mapper must be defensive and the report must say "shape unverified".

## Files you may change (closed list)
1. `vitagraph/backend/app/agent/pool.py`: Part 0 only (plus nothing else)
2. NEW `vitagraph/backend/app/agent/mapper.py`
3. NEW `vitagraph/backend/app/services/agent_service.py`
4. NEW `vitagraph/backend/app/schemas/agent.py`
5. NEW `vitagraph/backend/app/routes/agent.py`
6. `vitagraph/backend/app/main.py`: register the router, add the reaper and shutdown to `lifespan`
7. `vitagraph/backend/app/routes/users.py`: the persona-delete hook (Part 3)
8. `vitagraph/backend/tests/test_agent_pool.py`: ADD the Part 0 tests; do not change existing tests
9. `vitagraph/backend/tests/test_agent_runtime.py`: REPLACE exactly one test (`test_cancel_then_immediate_new_turn_always_works`, see Part 0 item 2); do not touch any other test
10. NEW `vitagraph/backend/tests/test_agent_mapper.py`, NEW `vitagraph/backend/tests/test_agent_service.py`, NEW `vitagraph/backend/tests/test_agent_route.py`
11. NEW `gemini/reports/TASK_AG3_report.md`
Forbidden: everything else (`runtime.py`, `worker.py`, `lockdown.py`, `profile.py`, `prompt.py`, `mcp_server.py`, `chat_service.py`, `question_service.py`, `llm_service.py`, other routes, other tests, `tests/fixtures/*`, `site design/`, `docs/`, `design/`). Never print or commit `.env` or any key. Do not add packages.

## Step 0: guard and baseline
```
git branch --show-current
cd "F:\kiruthika\kiruthika final project\vitagraph\backend"
(Get-Item .env).LastWriteTime
.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
```
Branch must be `redesign/modernist-app`; the suite ends with `147 passed` (about 220 s). Note the `.env` time. Read these files before writing code: `app/agent/pool.py`, `app/agent/runtime.py`, `app/agent/lockdown.py`, `app/agent/profile.py`, `app/services/chat_service.py`, `app/services/question_service.py` (only `_persist` and `_record_ai_call`), `app/routes/chat.py`, `app/schemas/chat.py`, `app/services/job_service.py` (the SSE envelope), `app/generation/safety.py`, `tests/conftest.py`, `tests/test_agent_pool.py`, `tests/test_chat_stream.py`.

---

## PART 0: the five findings of the AG2c review (tests first, each must FAIL before its fix)

Write the tests, run them and paste the failing run, then fix `pool.py`, then paste the passing run.

**Item 1: a failed worker start poisons the persona (BUG).** In `RuntimePool.stream_turn` the new entry is stored with `running=True` and only afterwards the evicted runtime is closed and the worker is started. If the start raises, the entry stays with `running=True` and a dead runtime for ever.
- Test `test_a_failed_worker_start_does_not_poison_the_persona` (in `test_agent_pool.py`): a `runtime_factory` returning `AgentRuntime(profile, worker_command=[sys.executable, <fake_worker.py>, "--mode", "crash_on_start"], start_timeout=5.0)`; `verify` an async no-op. The first `pool.stream_turn` raises `RuntimeStartError`; `pool.snapshot() == []`; a SECOND attempt raises `RuntimeStartError` again (NOT `RuntimeBusy`).
- Fix: wrap the eviction-close and the start in a `try/except BaseException` that (a) removes THIS entry from `_entries` under `_pool_lock`, only if `self._entries.get(persona_id) is entry`, (b) kills the entry's runtime (suppress any exception from the kill; the kill must happen even if the failure was a `CancelledError`, so run it as `await asyncio.shield(entry.runtime.akill())` inside `contextlib.suppress(Exception)` when `hasattr(entry.runtime, "akill")`, otherwise via `asyncio.to_thread(entry.runtime.kill)`), (c) re-raises.

**Item 2: the stale-thread race test is toothless.** In `tests/test_agent_runtime.py` DELETE `test_cancel_then_immediate_new_turn_always_works` and add in its place `test_a_stale_reader_thread_never_touches_the_new_process_state`, deterministic, no real process:
```python
def test_a_stale_reader_thread_never_touches_the_new_process_state():
    import asyncio
    import io
    import json
    from types import SimpleNamespace

    rt = AgentRuntime(profile_for("usr_test_stale"))
    new_proc = SimpleNamespace(stdout=io.StringIO(""), stderr=io.StringIO(""), stdin=None, poll=lambda: None, pid=1)
    loop = asyncio.new_event_loop()
    queue: asyncio.Queue = asyncio.Queue()

    class _StdoutThatTriggersARestart(io.StringIO):
        """While the OLD reader is reading its first line, a restart installs the NEW process."""
        def __iter__(self):
            rt._proc = new_proc
            return super().__iter__()

    old_proc = SimpleNamespace(
        stdout=_StdoutThatTriggersARestart(json.dumps({"type": "ready"}) + "\n"),
        stderr=io.StringIO(""), stdin=None, poll=lambda: None, pid=2,
    )
    try:
        rt._proc = old_proc                      # the reader is created while the old process is current
        rt._active_queue = (loop, queue)
        rt._is_ready = False
        rt._start_event.clear()
        rt._drain_stdout()                       # runs in THIS thread; captures old_proc, then rt._proc becomes new_proc
        assert rt._proc is new_proc
        assert rt._is_ready is False
        assert not rt._start_event.is_set()
        assert queue.empty()
    finally:
        loop.close()
```
This test uses names that `tests/test_agent_runtime.py` already imports (`AgentRuntime`, `profile_for`); read the file's imports first and add nothing that is not needed. If `_drain_stdout` differs from what this test assumes, adapt the TEST (never the production code) so that it stays deterministic and satisfies the requirements below.
Requirements the test must satisfy (read the real `_drain_stdout` in `runtime.py` first): a reader created for an OLD process object, running while `rt._proc` is a DIFFERENT object, must (a) not set `_is_ready`, (b) not set `_start_event`, (c) not put anything into the new `_active_queue`, (d) return without raising. Then PROVE the test has teeth: temporarily delete the `self._proc is proc` guards in `runtime.py` (you may touch `runtime.py` ONLY for this experiment), run the test, show it FAILS, restore `runtime.py` with `git checkout -- vitagraph/backend/app/agent/runtime.py` and show `git status --short` does not list `runtime.py`. Describe the experiment in the report (section 6). Do not commit any change to `runtime.py`.

**Item 3: the default factory and `get_pool()` are untested.** Tests in `test_agent_pool.py`:
- `test_the_default_factory_uses_the_configured_credentials_and_starts_nothing`: monkeypatch `settings.effective_api_key`, `settings.effective_base_url`, `settings.effective_model` (they are properties: patch them with `monkeypatch.setattr(type(settings), "effective_api_key", property(lambda self: "sk-test"))` and likewise for the other two, or whatever works with the real `Settings` class; read `app/core/config.py`), call `_default_runtime_factory(profile_for("usr_factory"))`, assert `rt.api_key == "sk-test"`, `rt.base_url`, `rt.model` equal the patched values and `rt.pid is None` and `rt.is_alive is False`.
- `test_get_pool_returns_one_shared_pool`: `get_pool() is get_pool()`. (Reset the module singleton `app.agent.pool._pool_singleton = None` before and after, with `monkeypatch`, so the test does not leak a pool.)

**Item 4: `forget_persona` can fail on Windows right after a tree kill.** Add a module constant `_RMTREE_RETRY_DELAY = 0.2` and make `forget_persona` retry `shutil.rmtree` up to 5 times on `PermissionError`/`OSError`, sleeping `_RMTREE_RETRY_DELAY` seconds (`await asyncio.sleep`) between attempts, then raise the last error. Tests: `test_forget_persona_retries_when_a_file_is_still_locked` (monkeypatch `app.agent.pool.shutil.rmtree` so the first two calls raise `PermissionError` and the third calls the real `shutil.rmtree`; set `_RMTREE_RETRY_DELAY` to `0` with monkeypatch; assert 3 calls and the folder is gone) and `test_forget_persona_gives_up_after_five_attempts` (always raises `PermissionError`: assert exactly 5 calls and that the error propagates).
Also in `forget_persona`: remove the persona from `self._verified_personas` and drop its entry from `self._persona_locks` (under `_pool_lock`). Test `test_forget_persona_clears_its_verified_flag`: after `forget_persona`, the next turn calls `verify` again (count the calls).

**Item 5: a dead own entry counts toward capacity.** In the capacity branch of `stream_turn`, first `pop` this persona's own dead entry from `self._entries` (remember its runtime and close it later with the other closes, outside the lock), THEN compare `len(self._entries) >= self.max_runtimes` (which now counts only other personas). Test `test_a_dead_own_entry_does_not_count_toward_capacity`: `max_runtimes=2`; run one turn each for personas A and B (fake worker, `normal`); kill A's worker process directly (`pool._entries["A"].runtime.kill()`); run a new turn for A; assert B's worker pid is the same as before and still alive (B was NOT evicted) and A has a new pid.

Run `pytest tests/test_agent_pool.py tests/test_agent_runtime.py -q -p no:cacheprovider` at the end of Part 0: everything passes. Paste the failing run and the passing run.

---

## PART 1: the event contract (what the browser will receive)

The stream uses the SAME envelope as `/api/chat/stream` (so the frontend hook can be modelled on `useChatStream`). Every SSE frame is:
```
event: <event_type>
data: {"index": "07", "stage": "generation", "description": "<short text>", "subDescription": "", "latency": "", "timestamp": 1730000000.1, "metadata": { ...the payload... }, "event_type": "<event_type>", "event": "<event_type>"}

```
`stage` is `"generation"` for every frame except the LAST frame, which has `stage: "done"` (event_type `completed` on success, `error` on failure). Comment frames (`: connected to agent stream`, `: keep-alive`) are allowed between events.

| event_type | metadata payload | when |
|---|---|---|
| `status` | `{"phase": "starting"\|"working"\|"retrying", "message": str, "attempt"?: int}` | `starting` immediately after the gates (before any process start); `working` on the harness `turn/start`; `retrying` on each `llm/retry` |
| `thinking` | `{"thinking": str}` | reasoning block of an `assistant/message` |
| `step` | `{"phase": "start"\|"end", "step": int}` | harness `step/start` / `step/end` |
| `tool_call` | `{"id": str, "tool": "search_reports"\|"list_reports"\|"get_measurements"\|"graph_lookup", "arguments": {...}, "step": int}` | harness `tool/call` |
| `tool_result` | `{"id": str, "tool": str, "result": {...}, "is_error": bool, "duration_ms": int}` | harness `tool/result` |
| `text_delta` | `{"delta": str}` | text block of an `assistant/message` |
| `stats` | `{"turns": int, "steps": int, "tool_calls": int, "elapsed_ms": int, "input_tokens"?: int, "output_tokens"?: int, "reasoning_tokens"?: int}` | after every `step/end` and once before `completed` (token keys ONLY when the harness reported usage; never invent numbers) |
| `completed` (stage generation) | `{"status": "answered"\|"refused"\|"insufficient_evidence", "summary_text": str, "classification": str, "evidence": [card,...], "evidence_count": int, "safety_passed": bool, "safety_note": str\|null, "ai_status": "ok"\|"not_used", "session_title": str\|null, "conversation_id": str}` | the answer is complete |
| `completed` (stage done, LAST frame) | `{"status": ..., "ai_status": ..., "evidence_count": int, "question_id": str, "conversation_id": str, "session_title": str\|null}` | after persistence |
| `error` (stage done, LAST frame) | `{"status": "error", "message": str, "diagnostic": str}` | any failure; `message` is plain language for the person |

An evidence `card` is exactly what `search_reports` returns: `{ref, chunk_id, report_id, report_filename, report_date, page_number, snippet, score, char_start, char_end}`. `model_fallback` is NEVER emitted (the harness has no model chain; do not invent one). The tool names are the SHORT VitaGraph names (strip the prefix `mcp__vitagraph__`); this refines section 16.6 of the session context (there it said "search_chroma-compatible"): the new frontend (AG4) knows the four short names.

## Event shapes the mapper must read (from the harness docs; UNVERIFIED with a real model)
The runtime (`AgentRuntime.stream_turn`) yields dicts. The mapper receives exactly these:
```
{"type": "notification", "run_id": "...", "method": "session.event", "payload": {"sessionId": "...", "event": {"type": "<harness event type>", "data": {...}, "seq": 12, "time": 1730000000000}}}
{"type": "notification", "method": "session.status", "payload": {...}}        # ignore
{"type": "notification", "method": "subagent.started" | "subagent.finished", ...}   # ignore
{"type": "result", "run_id": "...", "final_response": "text", "finish_reason": "stop" | "error" | ...}
{"type": "run_error", "run_id": "...", "message": "...", "kind": "..."}
{"type": "lockdown_violation", "tools": ["pwsh", ...]}
```
Only `method == "session.event"` is mapped; `event = payload["event"]`, `t = event["type"]`, `d = event["data"]` (a dict; if it is not a dict treat it as `{}`). Harness event types and their data (documented shapes):
- `turn/start`: `{turn}`. `turn/end`: `{turn, reason: {kind: "completed"|"aborted"|"blocked"|"error"|"interrupted"|"max-tokens", ...}}`.
- `step/start` / `step/end`: `{turn, step?}` (step number may be missing: then use your own running counter).
- `assistant/message`: `{turn, step, message: {id, role: "assistant", content: [ {"type": "reasoning", "text": str} | {"type": "text", "text": str} | {"type": "tool-call", "id", "name", "arguments": str} | other ]}, usage?: {inputTokens, outputTokens, reasoningTokens?, totalTokens?}, interrupted?: true}`. NOTE: this event arrives once per STEP when the step's model output is complete, so the answer text arrives step by step, not token by token. Do not fake token streaming.
- `tool/call`: `{turn, step, callId: str, name: str, arguments: str}` where `arguments` is the RAW JSON string the model wrote and `name` is e.g. `mcp__vitagraph__search_reports`.
- `tool/result`: `{turn, step, message: {id, role: "tool", toolCallId: str, content: [ {"type": "text", "text": str} | ... ], isError?: bool}, error?: {name, code, reason?}, meta?}`. The MCP tool server returns ONE JSON string as its text (e.g. `{"evidence": [...]}`), so `content[0].text` is JSON.
- `llm/retry`: the model call failed and will be retried (its data is not documented: read `attempt`/`delayMs` only if present). `llm/retry-started`: ignore.
- `session/title`: `{title: str, source, messageSeqs}` (latest wins).
- `request/header`, `request/context`, `system/message`, `user/message`, `assistant/attempt`, `agent/inbox/spliced`, anything else: ignore (no event, no error).

---

## PART 2: the mapper (`app/agent/mapper.py`, pure, no I/O, no asyncio)

```python
class EventMapper:
    def __init__(self, *, clock=time.monotonic, redact=lambda s: s): ...
    def feed(self, msg: dict) -> list[tuple[str, dict]]     # returns (event_type, payload) pairs, never raises
    answer_text: str            # all visible text so far
    evidence: list[dict]        # evidence cards collected from search_reports results
    title: str | None           # latest session/title
    outcome: str | None         # None while running; "result" or "error" once a terminal message was fed
    def stats(self) -> dict     # the `stats` payload described above
```
Behaviour (every rule needs a test in `tests/test_agent_mapper.py`, named in Part 5):
1. `feed` NEVER raises. A message that is not a dict, a `payload`/`event`/`data` of the wrong type, a missing key: return `[]`. Wrap the body in a defensive structure (small helper `_dict(x)` returning `x if isinstance(x, dict) else {}`); do not use a bare `except Exception: pass` around everything.
2. `turn/start` -> `[("status", {"phase": "working", "message": "The agent is working"})]` and `turns += 1`.
3. `step/start` -> `steps += 1`; `[("step", {"phase": "start", "step": <d.step if int else steps>})]`. `step/end` -> `[("step", {"phase": "end", "step": ...}), ("stats", self.stats())]`.
4. `assistant/message`: loop over `message.content` blocks IN ORDER. `reasoning` block with non-empty text -> `("thinking", {"thinking": text})`. `text` block with non-empty text -> `("text_delta", {"delta": text})`; if some visible text was already emitted earlier (from an earlier step) and this block starts a NEW step's message, emit `("text_delta", {"delta": "\n\n"})` first (same paragraph break as `chat_service`); append to `answer_text`. `tool-call` blocks and unknown blocks: ignore (the `tool/call` event handles calls). If `usage` is a dict, add `inputTokens`, `outputTokens`, `reasoningTokens` into running totals (only for values that are ints).
5. `tool/call`: `name = d["name"]`; short = name with a leading `mcp__vitagraph__` removed. Parse `arguments` with `json.loads`; a parse error or a non-dict result gives `{}`. Remember `callId -> (short, clock())`. `tool_calls += 1`. Emit `("tool_call", {"id": callId, "tool": short, "arguments": args, "step": d.get("step") if int else steps})`. If `callId` is missing use `f"call_{tool_calls}"`.
6. `tool/result`: look up the call by `message["toolCallId"]` (unknown -> tool `"unknown"`, duration 0). Join the `text` of all `text` blocks; `json.loads` it; a non-dict or invalid JSON becomes `{"text": raw}`. If `message.get("isError")` is true OR `d.get("error")` is a dict: `result = {"error": <raw text or error.reason or "The tool failed.">}` and `is_error = True`. If `short == "search_reports"` and `result.get("evidence")` is a list: for each card that is a dict with a string `chunk_id`, add it to `self.evidence` unless a card with the same `chunk_id` is already there (keep the card exactly as given, including its `ref`). Emit `("tool_result", {"id", "tool": short, "result": result, "is_error": bool, "duration_ms": int((clock() - started) * 1000)})`.
7. `llm/retry`: `retries += 1`; `("status", {"phase": "retrying", "attempt": <d.attempt if int else retries>, "message": "The AI service is slow to answer; trying again"})`.
8. `session/title` with a non-empty string title: remember it (no event).
9. `turn/end` with `reason.kind` of `"error"`: remember `self._turn_error = <string of reason.error>` for diagnostics (no event here).
10. Terminal `result`: `outcome = "result"`. If `finish_reason` is `"error"`, `"aborted"` or `"interrupted"`: this is a failure: `outcome = "error"` and return `[("error", {"status": "error", "message": ..., "diagnostic": ...})]` with the message chosen by `_failure_message(detail)` below. Otherwise, if no visible text has been seen and `final_response` is a non-empty string: set `answer_text = final_response` and return `[("text_delta", {"delta": final_response})]`; else `[]`.
11. Terminal `run_error`: `outcome = "error"`; message from `_failure_message(msg["message"])`.
12. Terminal `lockdown_violation`: `outcome = "error"`; `message = "The AI Agent was stopped by a safety check."`, `diagnostic = "Unexpected tools were offered: " + ", ".join(tools)` (cap 300 chars).
13. `_failure_message(detail: str) -> tuple[str, str]` returns `(message, diagnostic)`: if the lowercase detail contains `401`, `403`, `unauthorized` or `forbidden` -> `"The AI service refused the request. Please try again later."`; if it contains `too long to answer` -> `"The AI Agent took too long to answer. Please try again."`; if it contains `cancel` -> `"The turn was cancelled."`; otherwise `"The AI Agent could not finish this answer."`. The diagnostic is `redact(detail)[:300]` (also include `self._turn_error` when `detail` is empty). `redact` is the callable given to the constructor (the service passes a function that removes the API key).
14. `stats()` returns the dict in the contract (token keys only if at least one usage was seen; `elapsed_ms = int((clock() - self._t0) * 1000)`, `_t0` taken in `__init__`).

## PART 3: the service, schema, route, lifecycle

### 3a. Schema `app/schemas/agent.py`
```python
from __future__ import annotations
from pydantic import BaseModel, Field
from app.schemas.chat import ChatTurn

class AgentRequest(BaseModel):
    user_id: str
    # The whole conversation so far, oldest first. The last turn must be the user's new message.
    messages: list[ChatTurn] = Field(min_length=1, max_length=60)
    # Groups the turns of one conversation; the server makes one when absent.
    conversation_id: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,64}$")
    # Restrict the agent to one report ("ask about this report").
    report_id: str | None = None
```

### 3b. Service `app/services/agent_service.py`
```python
async def stream_agent(user_id: str, turns: list[dict], *, pool, conversation_id: str | None = None,
                       report_id: str | None = None) -> AsyncGenerator[tuple[str, dict], None]:
```
Yields `(event_type, payload)` tuples with the types of the contract table plus one internal type `"done"` (the route turns `done` into the LAST `completed` frame with `stage: "done"`). It never raises: every failure becomes an `("error", ...)` tuple. Import and REUSE from `app.services.chat_service`: `_diagnostic_phrase`, `_clean_history`, `MAX_TURN_CHARS` (one source of truth; do not copy them). Import `safety` from `app.generation`. The order inside `stream_agent` is FIXED:

1. If `turns` is empty or the last turn is not from the user: `("error", {"status": "error", "message": "The last message must come from the user.", "diagnostic": ""})` and return.
2. `question = str(turns[-1]["content"])[:MAX_TURN_CHARS]`; `classification = safety.classify_question(question)`; `conversation_id = conversation_id or f"conv_{uuid.uuid4().hex[:12]}"`. A local helper `completed(status, text, **extra)` builds the model-level `completed` payload exactly as in the contract table (`evidence` = `mapper.evidence` when a mapper exists, else `[]`).
3. **Gate (a), no runtime, no model:** `safety.needs_boundary_response(classification)` -> yield `("text_delta", {"delta": safety.BOUNDARY_RESPONSE})`, `completed("refused", safety.BOUNDARY_RESPONSE, safety_passed=True, ai_status="not_used")`, persist (step 9), yield `done`, return.
4. **Gate (b):** `cleaned, _ = safety.sanitize_question_for_retrieval(question)`; if `not cleaned.strip()` -> the same refusal text chat_service uses ("That message only contained instruction-like text addressed to the system, which VitaGraph treats as data. Please ask a question about your reports."), refused, no runtime, persisted, `done`, return.
5. **Gate (d), AI off:** `use_ai = settings.allow_api and bool(settings.effective_api_key)`. If not `use_ai`: delegate to the existing offline path: `async for ev in chat_service.stream_chat(user_id, turns, report_id=report_id, mode="rag_only")`: re-yield every tuple except the `completed` one, which you keep as `final` (add `conversation_id` and `session_title: None` to it) and yield too; then persist and yield `done`. If `final` is missing yield an `error`. No runtime is started.
6. **AI path.** Yield `("status", {"phase": "starting", "message": "Starting the AI Agent"})` FIRST (before touching the pool). Build the prompt with `build_prompt(history, cleaned, report_hint)` (below) and the session id `f"{conversation_id}-t{n_user_turns}-{uuid.uuid4().hex[:6]}"` where `n_user_turns` counts the user turns in `turns` (the random suffix is REQUIRED: the harness refuses a session id it has seen before, so a retry of the same turn after an error or a cancel would otherwise collide).
7. Create `mapper = EventMapper(redact=_redact)` where `_redact(text)` replaces `settings.effective_api_key` by `***` when the key is at least 8 characters. Then:
```python
agen = pool.stream_turn(user_id, session_id, prompt)
turn_started = False
try:
    async for msg in agen:
        turn_started = True
        for ev in mapper.feed(msg):
            yield ev
        if mapper.outcome is not None:
            break
except RuntimeBusy:
    yield ("error", {"status": "error", "message": "The AI Agent is still answering your previous message. Wait for it to finish or press Stop.", "diagnostic": ""}); return
except PoolFull:
    yield ("error", {"status": "error", "message": "The AI Agent is busy with other people right now. Please try again in a moment.", "diagnostic": ""}); return
except RuntimeStartError as exc:
    yield ("error", {"status": "error", "message": "The AI Agent could not start.", "diagnostic": _redact(str(exc))[:300]}); return
except LockdownViolation as exc:
    yield ("error", {"status": "error", "message": "The AI Agent was stopped by a safety check.", "diagnostic": _redact(str(exc))[:300]}); return
except (asyncio.CancelledError, GeneratorExit):
    # The browser went away. Stop the agent, but ONLY if THIS request owns the running turn
    # (a refused "busy" request must never cancel the other request's turn).
    if turn_started:
        with contextlib.suppress(Exception):
            await asyncio.shield(pool.cancel(user_id))
    raise
except Exception as exc:
    logger.exception("Agent stream failed")
    yield ("error", {"status": "error", "message": "The AI Agent could not finish this answer.", "diagnostic": _redact(str(exc))[:300]}); return
finally:
    with contextlib.suppress(Exception):
        await agen.aclose()
```
Note `LockdownViolation` is raised by the runtime AFTER it yielded a `lockdown_violation` message; the mapper has already produced the `error` tuple and set `outcome`, so in that case do not yield a second error (check `mapper.outcome == "error"` in the `except LockdownViolation` branch and just `return`).
8. After the loop: if `mapper.outcome == "error"` -> return (the error tuple was already yielded). If `mapper.outcome is None` (the stream ended without a result) -> `("error", {"status": "error", "message": "The AI Agent stopped without an answer.", "diagnostic": ""})`, return. `text = mapper.answer_text.strip()`; empty -> `("error", {... "message": "The AI Agent returned no answer.", "diagnostic": "Empty completion."})`, return. `phrase = _diagnostic_phrase(text)`. Yield `("stats", mapper.stats())`, then `completed("answered", text, ai_status="ok", safety_passed=phrase is None, safety_note=(f"Safety check: answer contains diagnostic phrasing ('{phrase}')." if phrase else None), session_title=mapper.title)`.
9. **Persistence** (also for refusals and the offline path; never for errors): a helper `_persist_turn(user_id, turns, final, conversation_id)` run with `await asyncio.to_thread(...)`, copying the logic of `chat_service.run_chat_task` (read it): `question_id = f"qst_{uuid.uuid4().hex[:12]}"`; `ai_status = final.get("ai_status", "ok")`, set to `"flagged"` when `status == "answered"` and `final.get("safety_passed", True)` is false; build `hits` from `final["evidence"]` exactly as `run_chat_task` does; call `question_service._record_ai_call(user_id, question_id, question_id, f"agent_{uuid.uuid4().hex[:8]}", ai_status, ai_status == "ok", final.get("safety_note"))` then `question_service._persist(user_id=..., question_id=..., question_text=str(turns[-1]["content"]), classification=final.get("classification", "educational"), status=<answered|refused|insufficient_evidence>, summary_text=final["summary_text"], evidence=hits, limitations_text="", ai_service_status=ai_status, safety_note=final.get("safety_note"), job_id=None)`. Return the `question_id`. Then yield `("done", {"status": status, "ai_status": ai_status, "evidence_count": len(evidence), "question_id": question_id, "conversation_id": conversation_id, "session_title": final.get("session_title")})`. A persistence failure must not hide the answer: catch the exception, log it, and still yield `done` with `question_id` equal to `None`.

`build_prompt(history, cleaned, report_hint)` (module-level, pure, unit-tested):
- `history` = `chat_service._clean_history(turns[:-1])` (already capped to 12 turns / 4000 chars and injection-sanitised).
- No history and no hint -> the prompt is exactly `cleaned`.
- Otherwise:
```
Earlier in this conversation (context only; the person's reports can only be read through your tools):
User: <text>
Assistant: <text>
...

[Scope: the person is asking about the report <filename> (report_id <report_id>). Pass that report_id to search_reports and get_measurements.]   <- only when report_hint is set

Current message from the person:
<cleaned>
```
- `report_hint` is set ONLY when `report_id` is given AND that report belongs to `user_id` (query `SELECT original_filename FROM reports WHERE id = ? AND user_id = ?` through `app.core.database.get_db`; read `app/routes/reports.py` / `report_service` for the real column name first). A report id that is not the person's own is silently ignored (no hint). This hint is advisory; the real protection is the ownership check inside the tool server.

### 3c. Route `app/routes/agent.py` (copy this code exactly; it is subtle)
```python
"""AI Agent route: one conversation turn streamed over SSE (same envelope as /api/chat/stream)."""

from __future__ import annotations

import asyncio
import json
import time
from typing import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.agent.pool import RuntimePool, get_pool
from app.schemas.agent import AgentRequest
from app.services import agent_service, user_service

router = APIRouter(prefix="/api/agent", tags=["agent"])

KEEPALIVE_SECONDS = 15.0


def _frame(index: int, event_type: str, payload: dict, *, last: bool) -> str:
    event = {
        "index": f"{index:02d}",
        "stage": "done" if last else "generation",
        "description": payload.get("delta") or payload.get("thinking") or payload.get("message") or event_type,
        "subDescription": "",
        "latency": "",
        "timestamp": time.time(),
        "metadata": payload,
        "event_type": event_type,
        "event": event_type,
    }
    return f"event: {event_type}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"


async def _sse_stream(events: AsyncIterator[tuple[str, dict]]) -> AsyncIterator[str]:
    """Turn (event_type, payload) tuples into SSE frames; keep the connection alive while the agent is silent."""
    index = 0
    pending: asyncio.Future | None = None
    try:
        yield ": connected to agent stream\n\n"
        pending = asyncio.ensure_future(events.__anext__())
        while True:
            done, _ = await asyncio.wait({pending}, timeout=KEEPALIVE_SECONDS)
            if not done:
                yield ": keep-alive\n\n"
                continue
            try:
                event_type, payload = pending.result()
            except StopAsyncIteration:
                pending = None
                return
            index += 1
            last = event_type in ("done", "error")
            yield _frame(index, "completed" if event_type == "done" else event_type, payload, last=last)
            if last:
                pending = None
                return
            pending = asyncio.ensure_future(events.__anext__())
    finally:
        if pending is not None:
            if not pending.done():
                pending.cancel()
            await asyncio.wait({pending})
        await events.aclose()


@router.post("/stream")
async def agent_stream(payload: AgentRequest, pool: RuntimePool = Depends(get_pool)) -> StreamingResponse:
    """Send the conversation so far; receive status, thinking, step, tool_call, tool_result, text_delta, stats, completed, error."""
    user_service.user_exists(payload.user_id)
    turns = [t.model_dump() for t in payload.messages]
    events = agent_service.stream_agent(
        payload.user_id, turns, pool=pool, conversation_id=payload.conversation_id, report_id=payload.report_id,
    )
    return StreamingResponse(
        _sse_stream(events),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
```
(The unknown-persona 404 comes from `user_service.user_exists` BEFORE streaming starts.)

### 3d. `app/main.py`
- Import `asyncio`, `contextlib`, `logging`, `from app.agent.pool import RuntimePool, get_pool` and `agent` in the routes import line; `app.include_router(agent.router)` after `chat.router`.
- Add above `lifespan`:
```python
logger = logging.getLogger(__name__)


async def _reap_loop(pool: RuntimePool, interval: float) -> None:
    """Close idle agent runtimes every `interval` seconds until cancelled."""
    while True:
        await asyncio.sleep(interval)
        try:
            await pool.reap_idle()
        except Exception:
            logger.exception("Reaping idle agent runtimes failed")
```
- Replace `lifespan` with:
```python
@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.ensure_dirs()
    init_db()
    pool = get_pool()
    reaper = asyncio.create_task(_reap_loop(pool, 60.0))
    try:
        yield
    finally:
        reaper.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await reaper
        await pool.close_all()
```
Nothing else in `main.py` changes (the health route stays as it is).

### 3e. `app/routes/users.py`: deleting a persona closes its agent runtime and deletes its agent folder
Make `delete_user` async and replace its body with:
```python
@router.delete("/{user_id}")
async def delete_user(user_id: str) -> dict:
    user_service.get_user(user_id)               # 404 when the persona does not exist
    try:
        await get_pool().forget_persona(user_id)  # close its runtime, delete data/agent/<id>
    except ValueError:
        pass                                      # an id that can never own an agent folder
    return user_service.delete_user(user_id)
```
with `from app.agent.pool import get_pool` at the top. The existing delete tests must still pass unchanged.

---

## PART 4: verification by tests (all tests use fakes; NO real harness, NO real model)
Use this fake pool in the service and route tests (put it in `tests/test_agent_service.py` and import it from there in `test_agent_route.py`, or duplicate the 20 lines; do not touch `tests/fixtures`):
```python
class FakePool:
    def __init__(self, messages=None, *, raises=None, block_after=None):
        self.messages, self.raises, self.block_after = messages or [], raises, block_after
        self.calls, self.cancelled, self.closed_gen = [], [], False
    async def stream_turn(self, persona_id, session_id, text):
        self.calls.append((persona_id, session_id, text))
        if self.raises:
            raise self.raises
        try:
            for i, msg in enumerate(self.messages):
                yield msg
                if self.block_after is not None and i == self.block_after:
                    await asyncio.sleep(30)
        finally:
            self.closed_gen = True
    async def cancel(self, persona_id):
        self.cancelled.append(persona_id)
```
Build scripted worker messages with small helper functions (`notif(type, data)` returning the `{"type": "notification", "method": "session.event", "payload": {"sessionId": "s", "event": {"type": type, "data": data}}}` dict, `result_msg(text, finish="stop")`). Enable the AI path in service tests with `monkeypatch.setattr(settings, "allow_api", True)` and the `effective_api_key` property patch (as in Part 0 item 3). Use `make_user` / `sample_pdf` from `tests/conftest.py`; read the DB with `app.core.database.get_db`.

### `tests/test_agent_mapper.py` (names exactly; each asserts the full event list, not only its length)
1. `test_reasoning_and_text_blocks_become_thinking_and_text_delta`
2. `test_a_second_steps_text_is_separated_by_a_paragraph_break`
3. `test_tool_call_uses_the_short_name_and_parsed_arguments`
4. `test_tool_call_with_broken_arguments_json_gets_empty_arguments`
5. `test_search_results_collect_evidence_cards_once_per_chunk_and_keep_their_refs`
6. `test_a_tool_error_becomes_an_error_result`
7. `test_a_non_json_tool_result_is_wrapped_as_text`
8. `test_llm_retry_events_become_retrying_status_with_a_counter`
9. `test_step_events_and_usage_produce_stats_and_never_invent_token_counts` (one run WITH usage shows the three token keys; one run WITHOUT usage has no token keys)
10. `test_the_latest_session_title_is_kept`
11. `test_unknown_or_malformed_events_are_ignored_without_raising` (feed `None`, `"x"`, `{}`, a notification whose payload is a string, an event whose data is a list, a `tool/call` without `name`)
12. `test_result_with_finish_reason_error_is_an_error_and_a_401_is_worded_as_a_refusal`
13. `test_result_without_streamed_text_falls_back_to_final_response`
14. `test_run_error_and_lockdown_violation_are_errors`
15. `test_the_api_key_never_appears_in_any_emitted_event` (pass a `redact` that replaces `sk-secret-key-123`; feed a `run_error` containing it; assert it is absent from `json.dumps` of the events)

### `tests/test_agent_service.py`
1. `test_a_boundary_question_is_refused_without_starting_any_runtime` ("Do I have diabetes? Please diagnose me." or a text the real classifier flags: check with `safety.classify_question` first; assert `pool.calls == []`, the events are `text_delta`, `completed` (status refused), `done`, and a question row exists with status `refused`)
2. `test_a_question_that_is_only_an_injection_is_refused_without_a_runtime`
3. `test_with_ai_off_the_offline_composer_answers_and_no_runtime_starts` (persona with a report from `sample_pdf("synthetic_panel_2025-01-15.pdf")`, `allow_api` False; `pool.calls == []`; `completed.ai_status == "not_used"`; `done` present; question row persisted)
4. `test_a_normal_turn_streams_status_first_then_mapped_events_then_completed_then_done` (scripted turn/start, step/start, assistant/message with reasoning, tool/call search_reports, tool/result with one evidence card, step/end, step/start, assistant/message with text containing `[1]`, step/end, turn/end, result; assert the exact ORDER of event types, that the FIRST event is `status` with phase `starting`, `completed.evidence_count == 1`, `safety_passed is True`, and that `done.question_id` exists as a row in `questions` with the persona)
5. `test_a_diagnostic_phrase_after_the_answer_marks_it_unsafe` (answer text "Your results mean you have anemia."; `safety_passed is False`, `safety_note` mentions the phrase; the stored answer status flagged `ai_service_status == "flagged"`)
6. `test_each_failure_becomes_a_clear_error_event` (parametrized: pool raising `RuntimeBusy`, `PoolFull`, `RuntimeStartError("boom")`, `LockdownViolation("bad")`, a scripted `run_error`, a scripted `result` with finish_reason `error`; the LAST event is `error`; message text matches the contract; nothing persisted: count rows in `questions` before and after)
7. `test_a_busy_refusal_never_cancels_the_other_turn` (pool raising `RuntimeBusy`: `pool.cancelled == []`)
8. `test_closing_the_stream_cancels_the_running_turn` (FakePool with `block_after=0`; consume the first two events, then `await gen.aclose()` in one variant and `task.cancel()` in another (run the generator inside an `asyncio.Task` that keeps pulling); assert `pool.cancelled == [persona]` and `pool.closed_gen is True`)
9. `test_the_session_id_is_unique_per_turn_and_carries_the_conversation_id` (call twice with the same `conversation_id`: two different session ids, both starting with `<conversation_id>-t1-`)
10. `test_earlier_turns_are_sent_as_context_and_are_sanitised` (3 earlier turns incl. an injection sentence in an old user turn; assert the prompt contains the earlier user/assistant text, not the injection phrase, and ends with the current question)
11. `test_the_report_scope_hint_is_added_only_for_the_persons_own_report` (own report id -> the prompt contains `report_id <id>`; another persona's report id -> no hint)
12. `test_the_api_key_never_reaches_the_events` (a `run_error` message containing the patched key)
13. `test_the_last_message_must_come_from_the_user`

### `tests/test_agent_route.py`
1. `test_unknown_persona_gets_404_before_any_stream`
2. `test_the_stream_uses_the_chat_envelope_and_ends_with_a_done_frame` (override the dependency: `app.dependency_overrides[get_pool] = lambda: FakePool([...])`; read the body with `client.stream("POST", ...)`; parse frames; first line is the `: connected to agent stream` comment; every data frame has keys `index, stage, metadata, event_type, event`; only the LAST frame has `stage == "done"` and its `event_type` is `completed`; the indexes are 01, 02, 03 ... in order; clean the override in a `finally`/fixture)
3. `test_a_failure_ends_with_one_error_frame_with_stage_done`
4. `test_a_silent_agent_gets_keepalive_comments` (monkeypatch `app.routes.agent.KEEPALIVE_SECONDS` to `0.05`; drive `_sse_stream` directly with an async generator that sleeps 0.3 s before yielding its first event; collect frames; at least two `: keep-alive` comments come BEFORE the first data frame)
5. `test_closing_the_sse_generator_cancels_the_inner_stream` (drive `_sse_stream` over `stream_agent` with a blocking `FakePool`; after the first data frame call `await sse.aclose()`; assert `pool.cancelled == [persona]`)
6. `test_deleting_a_persona_forgets_its_agent_runtime_and_folder` (monkeypatch `app.routes.users.get_pool` to return a recording fake with `async def forget_persona(self, pid)`; create a persona; `client.delete(f"/api/users/{id}")`; the fake saw the id exactly once; the persona is gone; deleting an unknown persona returns 404 and the fake was NOT called)
7. `test_the_reaper_loop_calls_reap_idle_repeatedly_and_stops_when_cancelled` (call `app.main._reap_loop(fake_pool, 0.01)` as a task, sleep 0.1 s, cancel; `reap_idle` was called at least twice; a `reap_idle` that raises does not kill the loop)
8. `test_the_lifespan_closes_the_pool_on_shutdown` (`with TestClient(app):` using a monkeypatched `app.main.get_pool` returning a recording fake with `reap_idle` and `close_all`; after the `with` block `close_all` was awaited once)

Test-writing rules: tests first (run each new file once BEFORE the code exists and paste the import-error / failing line), no `time.sleep` over 0.5 s, nothing that starts `dsh` or the real worker, no change to any existing test except the single replacement named in Part 0, every test must be able to fail (when you finish, pick THREE of your new tests at random, break the production line they protect, show they fail, restore, and say which ones in the report).

---

## PART 5: verify
1. Part 0 and new test files individually: `.venv\Scripts\python.exe -m pytest tests/test_agent_pool.py tests/test_agent_runtime.py tests/test_agent_mapper.py tests/test_agent_service.py tests/test_agent_route.py -q -p no:cacheprovider` (paste the last 5 lines and the duration).
2. Whole suite: `.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider`: every old test (147 minus the one replaced plus its replacement) and all new ones pass; paste the last line (the exact count, do not guess).
3. `Select-String -Path app\agent\*.py,app\services\agent_service.py,app\routes\agent.py -Pattern 'os\.environ\[|os\.environ\.(clear|update|pop|setdefault)|putenv'` prints nothing.
4. `Select-String -Path app\agent\mapper.py,app\services\agent_service.py,app\routes\agent.py -Pattern 'DeepSeek|AgentRouter|deepseek-v4|gpt-6|claude-opus'` prints nothing (no provider or model names in anything the browser can receive).
5. **Live check against the real stack (API blocked is expected).** Start the backend: `cd vitagraph\backend; .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000` in the background, wait about 10 s. Use the throwaway persona `usr_51f14542d71a` ("Empty Test Persona"). Write a small script in `$env:TEMP` (not committed; Python `urllib` or `httpx`, `PYTHONIOENCODING=utf-8`) that POSTs to `http://127.0.0.1:8000/api/agent/stream` and prints every frame's `event_type`, `stage` and the first 120 characters of `metadata`:
   a. **Refusal gate:** message "Do I have diabetes? Diagnose me." -> frames `text_delta`, `completed`, `completed(stage done)` within 2 seconds, and NO new `dsh`/`python ... worker.py` process appears (check with `Get-CimInstance Win32_Process` ids and command lines before and after).
   b. **Normal question** "What was my hemoglobin?" -> expected with the free gateway: `status(starting)`, possibly `status(working)`/`status(retrying)`, then ONE `error` frame with `stage: done` within 60 seconds. It must never hang and never print the key. Paste the frames. If the model really answers (the user may have switched the API), paste the frames and say so.
   c. **After the failure, send the same question again immediately:** it must NOT answer "still answering your previous message" (this proves the Part 0 fix and the cleanup). Paste the first frames.
   d. Stop the backend (`Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`), then check there is no leftover `dsh`, worker or MCP-server process (ids and command lines; do not attribute the two `node` helper processes of an unrelated MCP tool to us, see the AG0b review). Remove the throwaway persona's agent folder: `.venv\Scripts\python.exe -c "import asyncio; from app.agent.pool import RuntimePool; asyncio.run(RuntimePool().forget_persona('usr_51f14542d71a'))"` then `Test-Path data\agent\usr_51f14542d71a` is `False`.
6. `git status --short vitagraph gemini` lists only the closed-list files; `.env` last-write time equals Step 0; ports 5173/8000 free.

## PART 6: work report `gemini/reports/TASK_AG3_report.md` (nine headings, RULES 5b)
Section 3 numbers from `git diff --numstat`. Section 6 MUST contain: (a) the experiment that gave `test_a_stale_reader_thread_never_touches_the_new_process_state` its teeth (what you removed, the failing output), (b) the three tests you broke on purpose, (c) a table "Harness event | Mapper rule | Shape source (documented / observed live) | Test", with every row whose shape is not observed live marked `shape unverified (API blocked)`, (d) the live-check frames from Part 5, (e) a table "Safety property | Where enforced | Test" covering: boundary refusal before any runtime, injection-only refusal before any runtime, diagnostic check after the answer, persona taken from the request and never from the model, a busy request never cancels another turn, disconnect cancels only the owner turn, key never in events, session id unique per turn, errors are never persisted.

## COMMIT
```
git add vitagraph/backend/app/agent/pool.py vitagraph/backend/app/agent/mapper.py vitagraph/backend/app/services/agent_service.py vitagraph/backend/app/schemas/agent.py vitagraph/backend/app/routes/agent.py vitagraph/backend/app/main.py vitagraph/backend/app/routes/users.py vitagraph/backend/tests/test_agent_pool.py vitagraph/backend/tests/test_agent_runtime.py vitagraph/backend/tests/test_agent_mapper.py vitagraph/backend/tests/test_agent_service.py vitagraph/backend/tests/test_agent_route.py gemini/reports/TASK_AG3_report.md
git commit -m "feat(agent): streaming route with safety gates, event mapper, persistence; pool fixes (failed start, capacity, rmtree retry)"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```
`git show --stat HEAD` must list only those 13 files.

## ACCEPTANCE (PASS/FAIL each, with evidence)
- Part 0: the five findings each have a test that failed first and passes; the stale-thread test is proven to fail without the guards; `runtime.py` is unchanged in the commit.
- Mapper tests 1 to 15 pass; unknown or malformed events never raise.
- Service tests 1 to 13 pass: refusal and injection gates never start a runtime; the diagnostic check runs after the answer; errors are clear and not persisted; a busy refusal never cancels another turn; closing the stream cancels only the owner turn; session ids are unique.
- Route tests 1 to 8 pass: envelope identical to `/api/chat/stream`; only the last frame has `stage: done`; keep-alive; persona delete hook; reaper and shutdown.
- Live check: refusal in under 2 s without any worker; the normal question ends with one clean `error` frame (API blocked) within 60 s and no hang; a second request right after is not "busy"; no leftover process; folder cleaned.
- Whole suite green with the exact count pasted; no `os.environ` write; no provider or model name in browser-facing code; `.env` untouched; only the 13 files committed; branch correct.
