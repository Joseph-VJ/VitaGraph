# Review of TASK AG3b (reviewer: Claude)

**Verdict: ACCEPTED. No must-fix items.** Commit `744e4b2` on `redesign/modernist-app`.

## What I checked (fresh, by me)
- `git show --stat HEAD` and `git diff --numstat HEAD~1 HEAD`: exactly the 7 files of the closed list; every line count in the report equals the numstat (mapper 9/2, users 6/4, service 5/2, tests 42, 46, 27, report 139).
- Production diff read in full:
  - `users.py`: `get_user` and `delete_user` now run through `asyncio.to_thread`; the pool call stays awaited in the loop. Correct.
  - `mapper.py`: the failure detail is now `self._turn_error or final_response or finish_reason or "error"`, and the `turn/end` error is stored as `json.dumps(..., default=str)` for dicts and lists. Correct; the redaction still runs inside `_failure_message`.
  - `agent_service.py`: the report-scope lookup logs a warning; the offline path relays an `error` once and returns. Correct.
- New tests read: the delete test really measures heartbeat gaps around a 0.5 s blocking delete (Gemini saw 0.516 s before, 0.061 s after); the mapper tests assert the diagnostic content, the 401 wording and the redaction; the offline-error test asserts one event and nothing persisted. Test 3 (finish-reason fallback) passed before the fix by design (it guards the last resort); the report says so correctly.
- Whole backend suite re-run by me: **201 passed in 231.72 s** (report: 201 in 228.35 s; arithmetic 195 + 1 + 4 + 1 matches).
- `.env` last-write time unchanged (2026-10-02 13:38:30). No `os.environ` write, no provider or model name in the browser-facing files (Gemini's greps; my AG3 greps on the same files were clean and the AG3b diff adds no such text).
- **Live check by me** (backend on 8000, throwaway persona, then stopped and cleaned): the failing turn now ends with ONE `error` frame (stage done, after 7.3 s) whose `diagnostic` is the real structured error `{"message": "content-blocked (request id: ...)", "code": "INVALID_REQUEST", "status": 400}` instead of the word `error`. No traceback in the server log, no `dsh`/worker/tool-server process left, ports 5173/8000 free, the persona's agent folder removed again.

## An important observation from the live run (not a defect)
The free gateway is no longer answering the harness with HTTP 401 "unauthorized client" (the AG0 finding). The harness request now REACHES the gateway and is rejected by its deterministic content filter: `content-blocked`, HTTP 400, for the plain text "What was my hemoglobin?". That is the same filter that forced the rephrase retries in the old chat (T08c). Consequences:
- The agent path may well work end to end on the free gateway for a question text the filter accepts. Nobody has tried a second wording yet. (Per RULES 5d this is not a workaround, only a check; do it as part of the AG4 browser run and say what happened.)
- The agent path has NO rephrase retry (correctly: the user will move to a paid API). The person will see "The AI Agent could not finish this answer." for blocked wordings until then. The diagnostic now says why.
- The previous status text in my notes ("harness gets 401") is outdated; the mapper's 401 wording stays as a safety net.

## Remarks (no action needed)
- The first turn of a persona still takes about 6 to 7 s before `status(working)` (two process starts), as predicted; AG4 must show the "Starting the AI Agent" state for that time.
- The shapes of `assistant/message`, `tool/call` and `tool/result` are still unobserved (no model answer has come through yet); AG6 re-checks them.

## Next
AG3 and AG3b close the backend of the agent. Next: AG4, the frontend "AI Agent" page (and the decision whether T09b is folded into it).
