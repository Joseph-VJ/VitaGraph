# Review of TASK AG2b (reviewer: Claude)

**Verdict: ACCEPTED, with four robustness problems in `runtime.py` that are fixed first in AG2c (Part 0).** Commit `083e8dd` on `redesign/modernist-app`.

## What I checked (read the code, ran the suite myself)
- `git show --stat HEAD` and `git diff --numstat HEAD~1 HEAD`: exactly the closed list (`worker.py` 129, `runtime.py` 325, `lockdown.py` 51/41, `fake_worker.py` 183, `echo_mcp_server.py` +1, `test_agent_runtime.py` 380, `test_agent_profile.py` 71/2, the report). Your line counts in section 3 are correct this time (you used `--numstat`). In `test_agent_profile.py` only the allowed function changed.
- I re-ran the whole backend suite: **131 passed in 168 s** (121 + 10 new). `.env` untouched, `backend/data` has no `agent` folder, no `deepseek`/`dsh`/worker/echo process left, ports free.
- `app/agent` contains two READS of `os.environ` (`mcp_server.py:28`, `profile.py:137`) and no write: the unsafe environment rewrite of AG2a is gone, and the parent environment is proven unchanged by the 10 ms polling thread in two tests.
- `worker.py` is small and correct: private duplicate of stdout for the protocol, fd 1 redirected to stderr, one run at a time, key replaced by `***` in error text, key received only in the `start` message through the pipe. `runtime.py`: Popen with the minimal environment, process-tree kill with `taskkill /PID /T /F`, reader threads handing messages to the loop with `call_soon_threadsafe`, live monitor on every `request/header` that fails closed (an empty tool list is also a violation), abandoning the stream kills the runtime. The process-tree test shows the worker, `dsh` and the tool server all die.
- Your findings were useful: cold start of the real worker 4.26 s; on Windows no environment names are added beyond the 11 given; the real `request/header` notification has `seq`, `time` and `header.config` besides `header.tools`.

## Problems found (all fixed in AG2c, Part 0; each gets a failing test first)
1. **Blocking calls inside async code.** `stream_turn` calls `self.start()` synchronously when the worker is not running: that blocks the whole event loop for about 4 seconds, so in the server EVERY other request and stream would freeze whenever a persona starts. `verify_lockdown_async` calls `rt.start()` and `rt.close()` the same way, and `cancel()`/`kill()` run `taskkill` synchronously. Offload them with `asyncio.to_thread`. Test: while a start is in progress (a fake worker that waits 1 s before `ready`) a heartbeat task ticking every 50 ms must never be delayed by more than 300 ms.
2. **Stale reader-thread race after kill and restart.** Each runtime object is reused: after `kill()` the next turn starts a new process, but the OLD process's reader thread is still alive for a moment and, when its pipe closes, it pushes `worker_stopped` into the NEW turn's queue and can set the NEW start's `_start_event` early. Result: a spurious "The agent runtime stopped." or a spurious start error right after a cancel. Fix: every reader thread captures its own process object and only touches shared state while `self._proc is proc`. Test: 20 times in a row "cancel, then immediately start a new turn" must always succeed.
3. **No timeout during a turn.** `await q.get()` waits forever if the harness hangs, which would keep an SSE stream open for ever. Add `idle_timeout` (seconds without any message; default 180): on expiry kill the runtime and yield `{"type":"run_error","message":"The agent took too long to answer."}`. Test with a fake worker that never answers.
4. **Worker output is not guarded by a lock.** `send()` can be called from the SDK's notification thread and the main thread; add a `threading.Lock` around the write.

## Smaller notes
- `RuntimeBusy` is raised at the first iteration of the async generator, not at the call; the caller must handle it inside the `async for`. Keep this in mind in AG3.
- The suite now takes about 170 s. New tests must stay light; use the fake worker wherever the real harness is not the point. A `slow` marker for the real-harness tests will be added in the final QA stage.
- `is_pid_alive` in the tests uses `ctypes.windll`, which only exists on Windows. Acceptable for this project (Windows machine); say so in a comment.

## Notes on how you worked
Strong: tests first, clean architecture, accurate numstat figures, honest findings about the SDK, nothing left behind. The design now has a real cancel, a clean environment and a live monitor.

## Must fix
Items 1 to 4 above, as Part 0 of AG2c.
