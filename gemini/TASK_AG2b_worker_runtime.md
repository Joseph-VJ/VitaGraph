# TASK AG2b: the harness runs in a worker process (clean environment, real cancel, live lock-down monitor)

Read `gemini/RULES.md` first (branch guard 3b, report 5, **work report 5b**, **quality bar 5c**, **5d: the AI API is blocked, never work around it**). Read `gemini/AGENT_PLAN.md` completely and **`gemini/reviews/TASK_AG2a_review.md` completely** (it explains why this task exists and lists small fixes). Obey it: use `git diff --numstat HEAD~1 HEAD` for line counts, answer PARTIAL when evidence is partial, check process ids and command lines before attributing a process to your test.

## Why this task exists
AG2a made the agent's configuration safe, but `verify_lockdown` clears and refills the process-wide `os.environ` around the harness start. In a threaded server that is a bug (other threads see a stripped environment; two concurrent starts can leave it stripped forever). The fix is to never touch the backend's environment: the harness (SDK) runs inside a small **worker process** that the backend starts with an explicit minimal environment. The same worker gives the only real cancel the harness has (the AG0b spike found no per-turn cancel: closing the runtime is the cancel), and it isolates crashes. This task builds the worker, the backend-side runtime object that streams a turn, the live lock-down monitor, and moves `verify_lockdown` onto it. The runtime POOL (one runtime per persona, idle close, maximum) is the next task (AG2c). No real AI model is called: every real harness here points to the dead URL `http://127.0.0.1:9/v1` (RULES 5d).

## Design (binding)
- **Worker** = a standalone Python script `app/agent/worker.py` that imports only the standard library and `deepseek_harness` (never the `app` package). The backend starts it with `subprocess.Popen([sys.executable, <path of worker.py>], stdin=PIPE, stdout=PIPE, stderr=PIPE, env=child_environment(), cwd=<backend folder>)` plus the platform flags in the next bullet. The backend's own `os.environ` is NEVER modified.
- **Process tree control.** On Windows start the worker with `creationflags=subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP`; to kill, run `taskkill /PID <pid> /T /F` (kills the worker, `dsh.exe` and the MCP tool server). On POSIX use `start_new_session=True` and `os.killpg`. After a kill, wait for the worker with a short timeout.
- **Protocol** (UTF-8, one JSON object per line, flushed after every line):
  - backend to worker: `{"cmd":"start","config":{"profile","patches":[...],"dsh_home","cwd","model","base_url","api_key","initialize_timeout_seconds"}}`, `{"cmd":"run","run_id","session_id","input"}`, `{"cmd":"close"}`.
  - worker to backend: `{"type":"ready"}`, `{"type":"error","message"}` (start failed), `{"type":"notification","run_id","method","payload"}` (one per SDK notification, while the run is in progress), `{"type":"result","run_id","final_response","finish_reason"}`, `{"type":"run_error","run_id","message","kind"}`, `{"type":"closed"}`.
  - The API key travels only in the `start` message through the pipe (never in argv, never in the environment of the worker, never on disk, never in any message back). The worker replaces the key by `***` in every error text it sends.
- **stdout hygiene in the worker:** at start-up the worker keeps a private duplicate of its real stdout for the protocol (`os.dup(1)`), then redirects file descriptor 1 to stderr (`os.dup2(2, 1)`) so that any stray print goes to stderr.
- The worker handles ONE run at a time. `stdin` closing (EOF) means close.
- **Backend side** `app/agent/runtime.py`: class `AgentRuntime`. The backend side must work under any asyncio event loop on Windows (do not use `asyncio.create_subprocess_exec`, it needs the Proactor loop): use `subprocess.Popen` plus reader threads that hand messages to the event loop with `loop.call_soon_threadsafe(queue.put_nowait, msg)`.

## Files you may change (closed list)
1. NEW `vitagraph/backend/app/agent/worker.py`
2. NEW `vitagraph/backend/app/agent/runtime.py`
3. `vitagraph/backend/app/agent/lockdown.py` : rewrite `verify_lockdown` onto the runtime; remove the `os.environ` rewrite; give the empty-tools case its own clear message in `tool_names_from_events`
4. NEW `vitagraph/backend/tests/fixtures/fake_worker.py`
5. `vitagraph/backend/tests/fixtures/echo_mcp_server.py` : may be extended (it must additionally write its own pid into its output JSON, key `pid`)
6. NEW `vitagraph/backend/tests/test_agent_runtime.py`
7. `vitagraph/backend/tests/test_agent_profile.py` : you may edit ONLY the function `test_a_real_runtime_is_locked_down_and_the_persona_cannot_be_overridden`: keep every assertion it has, adapt it to the new `verify_lockdown`, and add the orphan assertion (see Step 4). No other test may change.
8. NEW `gemini/reports/TASK_AG2b_report.md`
Forbidden: everything else (`app/main.py`, `app/services/*`, `app/routes/*`, `profile.py`, `prompt.py`, `mcp_server.py`, `site design/`, `docs/`, `design/`). Never print or commit `.env` or any key.

## Step 0: guard and baseline
```
git branch --show-current
cd "F:\kiruthika\kiruthika final project\vitagraph\backend"
(Get-Item .env).LastWriteTime
.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
```
Branch `redesign/modernist-app`; the suite ends with `121 passed`. Note the `.env` time.

## Step 1: tests first (`tests/test_agent_runtime.py`, `tests/fixtures/fake_worker.py`)
`fake_worker.py` speaks the protocol WITHOUT the SDK so that most tests are fast and deterministic. It takes `--mode` as an argument: `normal` (answers `start` with `ready`; for `run` it sends three `notification` lines 0.3 s apart (methods `session.event`, payload event types `turn/start`, `request/header` with the four allowed tool names in the shape `{"type":"request/header","data":{"header":{"tools":[{"name":"mcp__vitagraph__search_reports"}, ...]}}}`, `turn/end`) and then `result`), `badtools` (the `request/header` also offers a tool named `pwsh`), `slow` (a run takes 30 s), `crash_on_start` (writes `boom` to stderr and exits with code 3 before `ready`), `noisy` (prints junk to stdout... use the same fd trick as the real worker, or simply print junk to stderr; decide and say which), `envdump` (writes the sorted names of its `os.environ` to the file given as the next argument, then behaves like `normal`). `worker_command` of `AgentRuntime` can be injected, so the tests start `[sys.executable, fake_worker.py, "--mode", ...]`.
Tests (names exactly):
1. `test_start_and_close_stop_the_worker_process`
2. `test_a_turn_streams_notifications_while_the_run_is_in_progress`: the first notification arrives at least 0.2 s before the `result` (use the event loop clock); the order of messages is notification, notification, notification, result.
3. `test_a_second_turn_while_one_is_running_is_refused`: raises `RuntimeBusy`.
4. `test_cancel_kills_the_worker_and_ends_the_stream`: with mode `slow`, `cancel()` after 0.5 s; the stream ends with a `run_error` message; the process is gone within 2 s.
5. `test_abandoning_the_stream_kills_the_runtime`: stop iterating a running turn (`aclose()`); the worker process is gone within 2 s.
6. `test_a_tool_that_is_not_allowed_kills_the_runtime_and_raises`: mode `badtools`; `LockdownViolation` is raised, the process is gone, and the yielded messages include a `{"type":"lockdown_violation","tools":[...]}` message BEFORE the exception.
7. `test_a_worker_that_crashes_on_start_gives_a_clear_error`: `RuntimeStartError` whose text contains `boom`; no process left.
8. `test_the_workers_environment_is_minimal_and_the_parent_environment_never_changes`: with `os.environ` temporarily containing `VITAGRAPH_USER_ID=ambient`, `AG2_CANARY=leak`, `DEEPSEEK_API_KEY=sk-x`; mode `envdump`; the dumped names are a subset of the allow-list of `profile.SAFE_ENV_ALLOWLIST` plus any names that Python itself adds on Windows (list the extra names you observe in the report); none of the three canary names appears; AND a background thread that snapshots `dict(os.environ)` every 10 ms during `start()` sees only ONE distinct snapshot (the parent environment never changes); the snapshot after equals the snapshot before.
9. `test_the_api_key_never_appears_in_the_workers_command_line_or_environment`: start the fake worker in mode `envdump` with `api_key="AG2B-CANARY-KEY-987654"`; assert the key is not in the dumped names/values (dump values too, only inside the test), not in the process command line (read it from the OS: `Get-CimInstance Win32_Process` through PowerShell, or `wmic`), and not in any file under the persona folder.
10. `test_verify_lockdown_with_the_real_harness_and_a_hostile_environment` is the migrated test 8 of AG2a (Step 4), it stays in `test_agent_profile.py`.
Run the new file: all fail (module missing). Paste the last lines.

## Step 2: implement `worker.py`
As in the Design section. Keep it small (about 100 lines): read lines from `sys.stdin`, dispatch, never crash on a bad line (reply with an `error` or `run_error`), flush after every write, convert SDK notification objects with `model_dump(mode="json")` when available (read the SDK: `deepseek_harness.models.Notification`), JSON-encode with `default=str`. Create the harness with the SDK arguments you used in AG2a (`profile`, `patches`, `dsh_home`, `cwd`, `model`, `base_url`, `api_key`, `initialize_timeout_seconds`). The harness is created inside the worker, so the SDK's habit of copying `os.environ` now copies the worker's minimal environment.

## Step 3: implement `runtime.py` and move `verify_lockdown`
`AgentRuntime(profile, *, api_key=None, base_url=None, model="deepseek-v4-flash", worker_command=None, start_timeout=60.0)`:
- `start()` (blocking): spawn, send `start`, wait for `ready`; on `error`, timeout or early exit: kill the tree, raise `RuntimeStartError(message + last 20 stderr lines)` (stderr is drained continuously by a thread into a bounded `collections.deque`; the key is never in these lines).
- properties `pid`, `is_alive`, `last_used` (a `time.monotonic()` value updated on start and on every message).
- `async stream_turn(session_id, text, *, run_id=None) -> AsyncIterator[dict]`: refuses a second concurrent turn with `RuntimeBusy`; sends `run`; yields every worker message of that run (`notification`, then `result` or `run_error`); if the worker dies mid-run yields `{"type":"run_error","message":"The agent runtime stopped."}`; the live monitor: for each `notification` whose `payload.event.type` is `request/header`, compute the tool names with `tool_names_from_events([payload["event"]])`; if they are not exactly the allowed four: `kill()`, yield `{"type":"lockdown_violation","tools":[...]}`, then raise `LockdownViolation`. If the consumer abandons the iteration (`GeneratorExit` / `aclose()`) before the run finished, kill the runtime in a `finally`.
- `cancel()` = kill the process tree now (idempotent); `close(timeout=3.0)` = send `close`, wait, else kill; `kill()`.
- It must be safe to call `cancel()` from another thread or task while `stream_turn` waits.
`lockdown.py`: keep `LockdownViolation`, `assert_locked_down`, `tool_names_from_events` (improve the empty case: raise `LockdownViolation("The request/header event offered NO tools; the tool server did not start.")`). Replace `verify_lockdown` by an `async def verify_lockdown_async(persona_id, *, profile=None, runtime_factory=None, api_key="probe-token") -> list[str]` that builds `profile_for(persona_id, fast_fail=True)` (unless a profile is given), starts an `AgentRuntime` against `http://127.0.0.1:9/v1`, runs `hello` in a fresh session id, collects the notification events, derives and asserts the tool names, and ALWAYS closes/kills the runtime in a `finally` (also when `start()` fails); and a synchronous `verify_lockdown(...)` that calls `asyncio.run` of it. Keep the result cache keyed by the hash of the patch files. There must be NO modification of `os.environ` anywhere in `app/agent` (prove with `grep` in the report).

## Step 4: migrate and extend the real test
Adapt `test_a_real_runtime_is_locked_down_and_the_persona_cannot_be_overridden` to the new `verify_lockdown` and keep its assertions (four tools; persona equals the patch value despite `VITAGRAPH_USER_ID=ambient_user` in the parent; canary variable and both canary keys not seen by the tool server; canary API key on disk nowhere). ADD: (a) the parent `os.environ` snapshot is identical before and after the call and never changes in between (same polling thread idea as test 8); (b) the orphan assertion: the pid of the worker (read it through a hook you add, for example `runtime_factory` returning the runtime you can inspect, or the `pid` the echo server wrote plus the worker pid) is not alive after the call, and the pid of the echo MCP server (key `pid` in its JSON) is not alive either. Also add one more real test `test_killing_the_runtime_kills_the_whole_process_tree` in `test_agent_runtime.py`: start a real `AgentRuntime` for a persona profile whose MCP command is the echo server, with `fast_fail=False` (a real run against the dead URL takes about 15 s because of the retries), start a turn, after 2 seconds `cancel()`; collect the worker pid, the `dsh` runtime pid (child of the worker) and the echo server pid BEFORE the cancel (descendants via `Get-CimInstance Win32_Process | Where ParentProcessId` recursively, through PowerShell from Python), and assert all of them are gone within 5 seconds after `cancel()`. Mark both real tests with a comment about their duration. Total time added by this task must stay under 90 seconds.

## Step 5: verify
1. `pytest tests/test_agent_runtime.py tests/test_agent_profile.py tests/test_agent_mcp_server.py -q -p no:cacheprovider` all pass (paste the last lines and the duration).
2. Whole suite: `121` old tests plus yours, all passed (paste the last line). Existing tests unchanged except the one function allowed in item 7.
3. `Select-String -Path vitagraph\backend\app\agent\*.py -Pattern 'os\.environ\[|os\.environ\.(clear|update|pop|setdefault)|putenv'` : paste the output; the only allowed hits are READS (`os.environ.get`) in `mcp_server.py` and `profile.py::child_environment`; if any WRITE remains, fix it.
4. Show once the exact command line and environment variable NAMES (not values) of a real worker process while it is running: start a real `AgentRuntime` in a small script in `$env:TEMP`, then read its command line with `Get-CimInstance Win32_Process`, and the names of its environment through the process (`(Get-Process -Id <pid>).StartInfo` does not work; instead let the fake worker in mode `envdump` write them). It is enough to paste the `envdump` result of test 8 and the command line.
5. `git status --short vitagraph` lists only the closed-list files; `.env` last-write time equals Step 0; `Test-Path vitagraph\backend\data\agent` is `False`; no `dsh`, `deepseek*`, `fake_worker` or echo-server process of this task is left (check ids and command lines before attributing a process).

## Step 6: work report
`gemini/reports/TASK_AG2b_report.md`, nine headings (RULES 5b). Section 3 line counts from `git diff --numstat`. Section 6 must contain: how long a cold start of the real worker takes (seconds, from the test output), the extra environment names Python adds on Windows, how you killed the process tree and how you verified it, any difference between the real SDK notification shape and the one the fake worker uses (paste one real `request/header` notification line from a real run, strings cut at 300 characters), and the table "Property | Where enforced | Test".

## COMMIT
```
git add vitagraph/backend/app/agent/worker.py vitagraph/backend/app/agent/runtime.py vitagraph/backend/app/agent/lockdown.py vitagraph/backend/tests/fixtures/fake_worker.py vitagraph/backend/tests/fixtures/echo_mcp_server.py vitagraph/backend/tests/test_agent_runtime.py vitagraph/backend/tests/test_agent_profile.py gemini/reports/TASK_AG2b_report.md
git commit -m "feat(agent): harness hosted in a worker process (clean env, real cancel, live lock-down monitor)"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```
`git show --stat HEAD` must list only those files.

## ACCEPTANCE (PASS/FAIL each with evidence)
- Tests 1 to 9 pass (all failed first); the migrated real test passes with its old assertions plus the two new ones; the process-tree test passes.
- No write to `os.environ` anywhere in `app/agent` (grep output); the parent environment never changes (polling proof).
- The key is nowhere except inside the pipe message: not in argv, not in the worker environment, not on disk.
- Cancel kills the worker, `dsh` and the tool server; abandoning a stream kills the runtime; a disallowed tool kills the runtime and raises.
- Full suite green; `.env` untouched; real `data` untouched; no orphan; only closed-list files committed; branch correct.
