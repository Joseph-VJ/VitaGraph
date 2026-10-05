# TASK AG3b: two small backend fixes found in the AG3 review

Read `gemini/RULES.md` first (branch guard 3b, report 5, **work report 5b**, **quality bar 5c**, **5d: the AI API is blocked, never work around it**). Read **`gemini/reviews/TASK_AG3_review.md` completely**. Habits: tests first and paste the FAILING run before each fix; if you change a test after proving it fails, prove it again; line counts only from `git diff --numstat`; never print `.env` or a key.

## Why
The AG3 review found two defects: persona deletion now blocks the event loop, and a failed agent turn reports the useless diagnostic `"error"` instead of the real cause. Both are small. This task fixes them and the two small remarks, nothing else.

## Files you may change (closed list)
1. `vitagraph/backend/app/routes/users.py`
2. `vitagraph/backend/app/agent/mapper.py`
3. `vitagraph/backend/app/services/agent_service.py`
4. `vitagraph/backend/tests/test_agent_route.py` (ADD one test; do not change existing tests)
5. `vitagraph/backend/tests/test_agent_mapper.py` (ADD tests; do not change existing tests)
6. `vitagraph/backend/tests/test_agent_service.py` (ADD one test; do not change existing tests)
7. NEW `gemini/reports/TASK_AG3b_report.md`
Forbidden: everything else. Do not add packages.

## Step 0
```
git branch --show-current
cd "F:\kiruthika\kiruthika final project\vitagraph\backend"
(Get-Item .env).LastWriteTime
.venv\Scripts\python.exe -m pytest tests/test_agent_route.py tests/test_agent_mapper.py tests/test_agent_service.py -q -p no:cacheprovider
```
Branch `redesign/modernist-app`; `.env` time must stay `2026-10-02 13:38:30`; the three files pass (41 tests at the time of writing: report your number).

## Fix 1: persona deletion must not block the event loop (`routes/users.py`)
Current body of `delete_user` runs the synchronous `user_service.get_user(...)` and `user_service.delete_user(...)` directly inside an `async def`. Change it to:
```python
@router.delete("/{user_id}")
async def delete_user(user_id: str) -> dict:
    await asyncio.to_thread(user_service.get_user, user_id)     # 404 when the persona does not exist
    try:
        await get_pool().forget_persona(user_id)                # close its runtime, delete data/agent/<id>
    except ValueError:
        pass                                                    # an id that can never own an agent folder
    return await asyncio.to_thread(user_service.delete_user, user_id)
```
(add `import asyncio`). Test first, in `test_agent_route.py`: `test_deleting_a_persona_does_not_block_the_event_loop`: monkeypatch `app.routes.users.get_pool` with a recording fake (as the existing delete test does) and monkeypatch `app.routes.users.user_service.delete_user` with a function that does `time.sleep(0.5)` and returns `{"deleted": "x"}` and `user_service.get_user` with a no-op returning `{}`; then, inside one `asyncio.run`, run `await users_route.delete_user("usr_x")` as a task together with a heartbeat task that records `loop.time()` every 50 ms; assert the largest gap between heartbeats is below 0.3 s. (Before the fix the gap is about 0.5 s; paste the failing run.) The existing delete tests must still pass unchanged.

## Fix 2: keep the real failure reason (`mapper.py`)
In `EventMapper.feed`, the terminal `result` branch currently does `detail = str(msg.get("final_response") or finish_reason)`. Change the failure path so the detail is the first non-empty of: the stored turn error (`self._turn_error`), `final_response`, `finish_reason`. And in the `turn/end` branch store the error readably: if `reason["error"]` is a dict or list use `json.dumps(reason["error"], ensure_ascii=False, default=str)`, otherwise `str(...)`. Keep `_failure_message` as it is (it already maps 401/403/unauthorized/forbidden to "The AI service refused the request. Please try again later." and redacts the diagnostic). Tests first, in `test_agent_mapper.py` (names exactly):
1. `test_a_failed_result_uses_the_turn_end_error_as_its_diagnostic`: feed `turn/end` with `reason = {"kind": "error", "error": {"status": 429, "message": "rate limited"}}`, then `{"type": "result", "finish_reason": "error", "final_response": ""}`; the `error` event's diagnostic contains `rate limited`, is not equal to `"error"`, and the message is `"The AI Agent could not finish this answer."`.
2. `test_a_401_in_the_turn_end_error_is_worded_as_a_refusal_on_the_real_path`: same, with `{"kind": "error", "error": {"status": 401, "message": "unauthorized client detected"}}`: message is `"The AI service refused the request. Please try again later."`.
3. `test_a_failed_result_without_any_detail_falls_back_to_the_finish_reason`: no `turn/end`, `final_response` empty: diagnostic is `"error"` (the old behaviour is kept as the last resort).
4. `test_the_key_is_redacted_from_a_turn_end_error`: the error dict contains `sk-secret-key-123` and the mapper was built with a `redact` that removes it; it is absent from the event.

## Small remarks (`agent_service.py`)
1. `_get_report_hint`: replace the bare `except Exception: pass` by `except Exception as exc: logger.warning("Report scope lookup failed: %s", exc)` (still returns `None`).
2. Offline path: when `chat_service.stream_chat` yields an `error`, relay it and `return` immediately (no second error). Test first in `test_agent_service.py`: `test_an_offline_composer_error_is_relayed_once`: monkeypatch `agent_service.chat_service.stream_chat` with an async generator that yields `("error", {"status": "error", "message": "boom", "diagnostic": ""})`; with `allow_api` off, the service yields exactly ONE error event and nothing after it, and nothing is persisted.

## Verify
1. The three test files pass; paste the failing run (before the fixes) and the passing run.
2. Whole suite: `.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider` ends with `201 passed` (195 + 1 route + 4 mapper + 1 service = 201). Paste the exact number you get; if it differs, show the arithmetic and explain.
3. `Select-String -Path app\agent\*.py,app\services\agent_service.py,app\routes\agent.py -Pattern 'os\.environ\[|os\.environ\.(clear|update|pop|setdefault)|putenv'` prints nothing.
4. Live check (API blocked is expected): start the backend, ask "What was my hemoglobin?" for persona `usr_51f14542d71a` with the script pattern of the AG3 report; paste the frames. The final `error` frame must now carry a `diagnostic` that is more than the word `error` IF the harness delivered a `turn/end` error (paste it either way and say what you saw; if the diagnostic is still `"error"`, print the raw `turn/end` notification of that run, with the key redacted, so the reviewer can see the real shape). Stop the backend; check no `dsh`/worker/tool-server process remains (ids and command lines; shell wrappers whose command line merely contains the search text do not count); delete the persona's agent folder with `forget_persona` and show `Test-Path data\agent\usr_51f14542d71a` is `False`.
5. `git status --short vitagraph gemini` lists only the closed-list files; `.env` untouched.

## Report `gemini/reports/TASK_AG3b_report.md` (nine headings, RULES 5b)
Section 6 must contain the raw `turn/end` notification from the live run if you captured one (key redacted), and the heartbeat gap before and after Fix 1.

## COMMIT
```
git add vitagraph/backend/app/routes/users.py vitagraph/backend/app/agent/mapper.py vitagraph/backend/app/services/agent_service.py vitagraph/backend/tests/test_agent_route.py vitagraph/backend/tests/test_agent_mapper.py vitagraph/backend/tests/test_agent_service.py gemini/reports/TASK_AG3b_report.md
git commit -m "fix(agent): persona delete off the event loop; keep the real failure reason; relay offline errors once"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```
`git show --stat HEAD` must list only those 7 files.

## ACCEPTANCE (PASS/FAIL with evidence)
- Fix 1: the new test failed first (gap about 0.5 s) and passes (gap under 0.3 s); old delete tests unchanged and green.
- Fix 2: mapper tests 1 to 4 failed first and pass; the 401 on the real path is worded as a refusal.
- Remarks: the warning is logged; the offline error is relayed exactly once.
- Whole suite green with the exact count and arithmetic; no `os.environ` write; `.env` untouched; no orphan process; only the 7 files committed; branch correct.
