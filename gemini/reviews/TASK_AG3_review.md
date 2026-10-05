# Review of TASK AG3 (reviewer: Claude)

**Verdict: ACCEPTED, with two small defects fixed in Task AG3b (one is a flaw in MY task text, one is a gap in the mapper) and one report-accuracy remark.** Commit `32b1898` on `redesign/modernist-app`.

## What I checked (fresh, by me)
- `git show --stat HEAD` and `git diff --numstat HEAD~1 HEAD`: exactly the 13 files of the closed list. Line counts in the report are correct except `test_agent_route.py` (report says 228, numstat says 227).
- Whole backend suite re-run by me: **195 passed in 209.98 s** (report: 195 passed in 215.07 s). 147 - 1 replaced + 1 + 7 pool + 15 mapper + 18 service cases + 8 route = 195, consistent.
- `os.environ` write grep and provider/model-name grep on the new files: both empty. No `print`, `TODO` or `console` in the new production files. `.env` last-write time unchanged (2026-10-02 13:38:30).
- Code read in full: `mapper.py`, `agent_service.py`, `routes/agent.py`, `schemas/agent.py`, the `pool.py`, `main.py` and `users.py` diffs. `routes/agent.py` and the schema are character-for-character my text; the service follows the fixed gate order (boundary, injection, AI off, then the agent), emits `status(starting)` before touching the pool, never cancels on a "busy" refusal (`turn_started` flag), cancels only the owner turn on disconnect (shielded), never persists errors, uses a random suffix in the session id.
- Pool Part 0: failed start now removes the entry and kills the runtime (also under cancellation); a dead own entry is popped before the capacity check; `forget_persona` retries `rmtree` 5 times and clears the verified flag and the lock. Correct.
- The stale-thread test: the committed test is the deterministic sync version. **I proved it has teeth myself** with a scratch copy of `runtime.py` (nothing in the repo touched): with the guards the assertions hold; with the `self._proc is not proc` guards removed the stale reader sets `_is_ready = True` and `_start_event`, so the test would fail. Good.
- **Live check by me** (backend started, throwaway persona `usr_51f14542d71a`, then stopped): refusal gate answered in 0.05 s with `text_delta`, `completed`, `completed(stage done)` and a stored `question_id`; the normal question gave `status(starting)`, `status(working)`, `step`, `stats` and ONE `error` frame with `stage: done` after 6.6 s (API blocked, as expected); the immediate repeat answered normally with an `error` after 2.6 s, NOT "still answering". No traceback in the server log, no `dsh`/worker/tool-server process before or after stopping the backend, ports 5173/8000 free, agent folder of the persona removed again with `forget_persona`.

## Defects (fixed in Task AG3b)
1. **Persona deletion now blocks the whole server (flaw in my task text).** I specified `async def delete_user` that calls the SYNCHRONOUS `user_service.delete_user` (vector-store delete, raw-file delete, many SQL deletes) directly. The old route was a plain `def`, which FastAPI ran in a worker thread. Now deleting a persona with many reports freezes the event loop, so every live agent stream (keep-alives, other personas) stalls until it finishes. Fix: keep the route async but run both synchronous service calls with `await asyncio.to_thread(...)`.
2. **The real failure reason is lost.** In the live run the `error` frame says `diagnostic: "error"`. In `EventMapper.feed` the `result` branch builds `detail = final_response or finish_reason`; for a failed run the harness `result` carries `finish_reason: "error"` and (as seen in AG0) no useful `final_response`, so `detail` is the word "error". The harness puts the real cause in `turn/end` -> `reason.error`, which the mapper stores in `_turn_error` but only uses when `detail` is EMPTY (never). Consequence: the 401/403 wording ("The AI service refused the request") can never appear on the real path, and the person and the developer both see a useless diagnostic. Also `str(reason.get("error"))` of a dict gives a Python repr; serialise it with `json.dumps(..., default=str)`.

## Smaller remarks (fix while you are there, no extra task)
- `_get_report_hint` has a bare `except Exception: pass`; log it instead (`logger.exception` is overkill, `logger.warning` with the exception is enough).
- If `chat_service.stream_chat` itself yields an `error` in the offline path, the service yields that error and then a second error ("offline composition failed"). The route stops at the first, so nobody sees it, but the service should `return` right after relaying an `error`.

## Report accuracy (please apply the habit)
- Section 6a shows the failing output of an `async def ... (tmp_path)` test asserting `rt._is_ready is True`. That is NOT the committed test (the committed one is a sync function asserting `_is_ready is False`). So the report's evidence belongs to an earlier version of the test; the committed version was never shown failing. The test is fine (I proved it), but the report must show the evidence of what was committed. Rule: when you change a test after a proof, redo the proof.
- Acceptance line "Service tests 1 to 13 ... (all 18 test cases across 13 test functions)": correct, thank you for stating it.

## Still unknown (not Gemini's fault, tracked for AG6)
The shapes of `assistant/message`, `tool/call`, `tool/result`, `llm/retry`, `session/title` and `turn/end` with a real model are documented but unobserved; the answer text will arrive step by step (not token by token). All mapper rules for them are covered by tests built from the documentation only. Re-check them with the paid API.

## Must fix
The two defects above (AG3b), and the two small remarks.
