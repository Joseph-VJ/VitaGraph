# TASK AG2c: the runtime pool (one runtime per persona) and the four robustness fixes of AG2b

Read `gemini/RULES.md` first (branch guard 3b, report 5, **work report 5b**, **quality bar 5c**, **5d: the AI API is blocked, never work around it**). Read `gemini/AGENT_PLAN.md` and **`gemini/reviews/TASK_AG2b_review.md` completely** (its four problems are Part 0 of this task). Obey it: use `git diff --numstat HEAD~1 HEAD` for line counts, answer PARTIAL when evidence is partial, check process ids and command lines before attributing a process to your test.

## Why this task exists
Each persona needs its own harness runtime (the persona is fixed in the tool server's environment, AG0b). Something has to own those runtimes: start one lazily per persona, never run two turns of the same persona at once, close idle ones, limit how many exist, throw one away when a persona is deleted, and refuse to use a runtime whose lock-down has not been proven. That is the pool. Before it, the four problems of the AG2b review must be fixed in `runtime.py`, because the pool and the later HTTP route depend on them. No real AI model is called; all real harnesses (there is only one real-harness test here) use the dead URL `http://127.0.0.1:9/v1`.

## Files you may change (closed list)
1. `vitagraph/backend/app/agent/runtime.py` : Part 0 only
2. `vitagraph/backend/app/agent/lockdown.py` : Part 0 only (offload blocking calls)
3. `vitagraph/backend/app/agent/worker.py` : Part 0 only (output lock)
4. NEW `vitagraph/backend/app/agent/pool.py`
5. `vitagraph/backend/tests/fixtures/fake_worker.py` : ADD modes `slow_start` and `silent` (below); do not change existing modes
6. `vitagraph/backend/tests/test_agent_runtime.py` : ADD the Part 0 tests; do not change existing tests
7. NEW `vitagraph/backend/tests/test_agent_pool.py`
8. NEW `gemini/reports/TASK_AG2c_report.md`
Forbidden: everything else (`profile.py`, `prompt.py`, `mcp_server.py`, `app/main.py`, `app/services/*`, `app/routes/*`, other tests, `site design/`, `docs/`, `design/`). Never print or commit `.env` or any key.

## Step 0: guard and baseline
```
git branch --show-current
cd "F:\kiruthika\kiruthika final project\vitagraph\backend"
(Get-Item .env).LastWriteTime
.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
```
Branch `redesign/modernist-app`; suite ends with `131 passed`. Note the `.env` time.

## Step 1: Part 0, tests first
Add to `fake_worker.py`: mode `slow_start` (waits 1.0 s before sending `ready`, then behaves like `normal`) and mode `silent` (sends `ready`, accepts `run` and then never sends anything). Add these tests to `test_agent_runtime.py`, run them (they must fail), then fix `runtime.py` / `lockdown.py` / `worker.py`:
1. `test_starting_a_runtime_never_blocks_the_event_loop`: run `stream_turn` on a runtime with the `slow_start` fake worker inside `asyncio.run`, and at the same time a heartbeat task that records `loop.time()` every 50 ms; assert the largest gap between two heartbeats is below 0.3 s. Fix: in `stream_turn` start the worker with `await asyncio.to_thread(self.start)`; do the same for the blocking `close()` and `kill()` calls that can run inside coroutines (`cancel()` may stay synchronous for callers that are not async, but add `async def acancel()` that runs it in a thread, and make `stream_turn`'s own `finally` use the threaded version). In `verify_lockdown_async` replace `rt.start()` and `rt.close()` by their threaded forms.
2. `test_cancel_then_immediate_new_turn_always_works`: 20 times: start a turn on the `slow` mode fake worker, cancel it after 0.1 s, then IMMEDIATELY start a new turn (normal mode fake worker is not needed: use a `worker_command` that is `slow` and just check that the new turn starts and receives its first message or a clean `run_error` due to the second cancel; the assertion is that no start ever fails with `RuntimeStartError` and no new turn is ever ended by a `worker_stopped` that belongs to the previous process). Fix: every reader thread captures its own process object (`proc`) and only touches shared state (`_is_ready`, `_start_error`, `_start_event`, `_active_queue`) while `self._proc is proc`; a stale thread must exit silently.
3. `test_a_turn_that_never_answers_times_out`: runtime with the `silent` fake worker and `idle_timeout=1.0`: the stream yields `{"type":"run_error","message":"The agent took too long to answer."}` within 3 seconds and the process is gone. Add the parameter `idle_timeout: float = 180.0` to `AgentRuntime.__init__` (seconds without ANY message while a turn is running).
4. `test_the_worker_output_is_written_under_a_lock`: static check in the test: read `worker.py` and assert that `send` uses a `threading.Lock` (`with _send_lock:`). Fix in `worker.py`.
Paste the failing run, then the passing run of the whole file.

## Step 2: tests first for the pool (`tests/test_agent_pool.py`)
The pool takes a `runtime_factory(profile) -> AgentRuntime` and a `verify` coroutine so that tests use the fake worker (`[sys.executable, <fake_worker.py>, "--mode", "normal"]`) and never the real harness. Use a temporary data root (as in `tests/conftest.py`). Count spawned workers with a counter in the factory. Tests (names exactly):
1. `test_the_first_turn_starts_a_runtime_lazily_and_the_second_reuses_it`: after pool creation no process exists; after two turns of the same persona there is ONE worker pid and the factory was called once.
2. `test_different_personas_get_different_runtimes`: two personas, two pids.
3. `test_concurrent_first_turns_of_the_same_persona_start_exactly_one_worker`: two coroutines acquire at the same time with `asyncio.gather`; one of them is refused with `RuntimeBusy` or waits, but the factory is called once and only one worker exists. (Decision: the second concurrent TURN of the same persona raises `RuntimeBusy`; concurrent acquires of the runtime itself must still start only one process.)
4. `test_a_second_turn_of_the_same_persona_while_one_runs_is_refused`: with a long fake turn (`slow` mode), the second `pool.stream_turn` for the same persona raises `RuntimeBusy` at its first iteration.
5. `test_at_capacity_the_least_recently_used_idle_runtime_is_closed`: `max_runtimes=2`, personas A, B (both idle), then C: A (least recently used) is closed (pid dead) and C runs; a runtime that is in the middle of a turn is never evicted; when every runtime is busy a new persona gets `PoolFull`.
6. `test_idle_runtimes_are_reaped`: `idle_seconds=60` with an injected `clock`; advance the clock by 61 s, call `await pool.reap_idle()`: the idle worker is closed, a runtime with a running turn is not.
7. `test_cancel_kills_the_runtime_and_the_next_turn_starts_a_fresh_one`: after `await pool.cancel(persona)` the pid is dead and the next turn runs on a NEW pid.
8. `test_forget_persona_closes_the_runtime_and_deletes_its_folder`: the persona folder `<data_dir>/agent/<persona>` exists (via `profile_for`), after `await pool.forget_persona(persona)` the process is dead and the folder is gone; `forget_persona("../x")` raises `ValueError` and deletes nothing (create a file outside the agent root and prove it survives).
9. `test_a_persona_whose_lockdown_check_fails_is_never_started`: `verify` raises `LockdownViolation`; the turn raises it; the factory was never called for a real run (or the runtime was closed) and the pool holds no runtime for that persona; the failure is NOT cached as success (a second attempt calls `verify` again).
10. `test_the_lockdown_check_runs_once_per_persona_and_is_reused`: two turns of one persona call `verify` once.
11. `test_close_all_stops_every_worker`: after `await pool.close_all()` no worker pid is alive.
12. `test_snapshot_describes_the_pool`: `pool.snapshot()` returns a list of dicts with `persona_id`, `pid`, `idle_seconds`, `running`.
Run the file: all fail (module missing). Paste the last lines.

## Step 3: implement `app/agent/pool.py` (behavior; you write the code)
- `class PoolFull(RuntimeError)`.
- `class RuntimePool` with `__init__(self, *, max_runtimes: int = 5, idle_seconds: float = 600.0, runtime_factory=None, verify=None, clock=time.monotonic)`. Defaults: `runtime_factory` builds `AgentRuntime(profile_for(persona_id), api_key=settings.effective_api_key or None, base_url=settings.effective_base_url, model=settings.effective_model)` (use the names that exist in `app/core/config.py`; read it; never log the key); `verify` is `lockdown.verify_lockdown_async`.
- Internals: a dict `persona_id -> entry` (runtime, `running` flag, `last_used` from the injected clock), a per-persona `asyncio.Lock` for starting, one pool-level `asyncio.Lock` for the dictionary and the eviction decision. The pool must never block the event loop (start, close and kill go through `asyncio.to_thread`).
- `async def stream_turn(self, persona_id, session_id, text) -> AsyncIterator[dict]`: validates the persona id (reuse the rule of `profile_for`: raise `ValueError` for bad ids); gets or starts the runtime (first start of a persona in this process: `await verify(persona_id)` first and remember success in a set; on failure raise and keep nothing); marks the entry running; yields the runtime's messages; in a `finally` marks it idle and updates `last_used`. A second concurrent turn for the same persona raises `RuntimeBusy`.
- Eviction: when starting a new persona at capacity, close the idle entry with the oldest `last_used`; if every entry is running raise `PoolFull`.
- `async def reap_idle(self)`: close idle entries older than `idle_seconds`.
- `async def cancel(self, persona_id)`: kill that persona's runtime if it exists (the entry is dropped so the next turn starts a new one).
- `async def forget_persona(self, persona_id)`: validate the id, cancel/close, then remove `agent_root() / persona_id` with `shutil.rmtree(..., ignore_errors=False)` ONLY after checking that the resolved path is inside `agent_root().resolve()`.
- `async def close_all(self)` and a synchronous `close_all_sync()` registered once with `atexit` (kills any remaining worker). `snapshot()`.
- Module-level `get_pool()` returning a lazily created singleton (used by the HTTP route in AG3; the route itself is NOT part of this task).

## Step 4: verify
1. `pytest tests/test_agent_pool.py tests/test_agent_runtime.py -q -p no:cacheprovider` all pass (paste the duration).
2. Whole suite: `131` old tests plus yours, all passed (paste the last line). Existing tests unchanged.
3. The real-harness test of AG2b (`test_killing_the_runtime_kills_the_whole_process_tree` and the migrated lockdown test) still pass after Part 0 (they are in the whole suite; name them in the report).
4. `Select-String -Path vitagraph\backend\app\agent\*.py -Pattern 'os\.environ\[|os\.environ\.(clear|update|pop|setdefault)|putenv'` prints nothing.
5. One real end-to-end smoke test, run by a throwaway script in `$env:TEMP` (not committed): create `RuntimePool()` with its DEFAULT factory but with `verify` and the dead URL forced by passing a custom `runtime_factory` that builds `AgentRuntime(profile_for("usr_smoke_ag2c", fast_fail=True), base_url="http://127.0.0.1:9/v1", api_key="probe-token")`, run one `pool.stream_turn("usr_smoke_ag2c", "s1", "hello")` and print the types of the messages you receive and `pool.snapshot()`, then `close_all()`. The persona folder lives under the REAL `backend/data/agent`: delete it afterwards with `forget_persona` (this also proves the real deletion works) and show `Test-Path vitagraph\backend\data\agent\usr_smoke_ag2c` is `False`.
6. `git status --short vitagraph` lists only the closed-list files; `.env` last-write time equals Step 0; no `dsh`, worker, `fake_worker` or echo-server process is left (check ids and command lines before attributing a process).

## Step 5: work report
`gemini/reports/TASK_AG2c_report.md` (nine headings). Section 3 numbers from `git diff --numstat`. Section 6 must contain: the design decision you took for the acquire-versus-turn busy rule, the largest heartbeat gap measured in Part 0 test 1 (before and after the fix), how the pool avoids two starts of one persona, and a table "Property | Where enforced | Test".

## COMMIT
```
git add vitagraph/backend/app/agent/runtime.py vitagraph/backend/app/agent/lockdown.py vitagraph/backend/app/agent/worker.py vitagraph/backend/app/agent/pool.py vitagraph/backend/tests/fixtures/fake_worker.py vitagraph/backend/tests/test_agent_runtime.py vitagraph/backend/tests/test_agent_pool.py gemini/reports/TASK_AG2c_report.md
git commit -m "feat(agent): runtime pool (one runtime per persona); runtime fixes (non-blocking start, stale-thread race, turn timeout)"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```
`git show --stat HEAD` must list only those files.

## ACCEPTANCE (PASS/FAIL each with evidence)
- Part 0 tests 1 to 4 failed first and pass; heartbeat gap under 0.3 s; 20 cancel-then-restart rounds clean; the silent turn times out and kills the worker.
- Pool tests 1 to 12 pass; the pool never keeps a runtime for a persona whose lock-down check failed; deleting a persona deletes only inside the agent root.
- The smoke test shows the message types of a real turn against the dead URL and a clean deletion.
- Full suite green; no `os.environ` write; `.env` untouched; no orphan process; only closed-list files committed; branch correct.
