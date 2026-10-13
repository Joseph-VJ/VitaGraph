# T3 T1 backend report

Status: **COMPLETE**, implemented by Codex on the owner's request to complete the last work directly. No sub-agents, commits or pushes.

## 1. What I was asked to do
Close round-one defect D1: never send a saved key to another host or port when the key input is empty. Preserve same-host reuse, accept a newly typed key, verify the full backend and keep the real `.env` untouched.

## 2. What I actually did
1. Added regressions before changing the route: five failed, 22 passed, reproducing both endpoint leaks and the skip-test bypass.
2. Added `_same_host` and the exact `_checked_input` guard from TASK_T3. Host comparison includes port and ignores letter case; path changes remain allowed.
3. Removed the extra blank line in config.py and a trailing blank line in ai.py.
4. Added 13 test cases covering changed host/port, same-host path/case changes, typed keys, no saved key, unchanged settings/file, no test call, worker close counts and skip-test rejection.
5. Re-ran focused tests and the complete suite, then proved the guard against a real scratch backend and a recording synthetic endpoint.

## 3. Files changed
- `vitagraph/backend/app/routes/ai.py`: cumulative branch diff +198/-2, including the pre-existing T1 work. T3 adds the saved-key host guard.
- `vitagraph/backend/app/core/config.py`: cumulative branch diff +92/-28; T3 removes one extra blank line only.
- `vitagraph/backend/tests/test_ai_model_connection.py`: untracked from T1, now 428 lines; T3 adds 13 cases. The existing empty-key test changes only its address to the fixture's saved host. Its assertions are unchanged. The successful-save test already asserted `closed_count == 1`.

## 4. Commands and their output
Before the route fix:
```text
5 failed, 22 passed in 3.26s
```
`.venv\Scripts\python.exe -m pytest tests/test_ai_model_connection.py tests/test_env_writer.py tests/test_ai_privacy.py -q -p no:cacheprovider`
```text
41 passed in 3.08s
```
`.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider`
```text
791 passed in 459.39s (0:07:39)
```
Real `.env` LastWriteTime before and after every check:
```text
2026-10-08T14:16:14.5578770+05:30
```

## 5. Acceptance checklist
- PASS: `/model/test` and `/model` return 422 for changed host or port with an empty key; no upstream call, settings mutation, file write or pool close.
- PASS: same host with another path or letter case uses the saved key; an explicit key for a new host works.
- PASS: without a saved key, the old "Enter an API key." message remains.
- PASS: skip_test cannot bypass the guard; successful saves close the pool once.
- PASS: live regression saved a synthetic key for 127.0.0.1:8099, then tried localhost:8099 on both routes: both 422, recording server request count unchanged, temporary settings bytes unchanged.
- PASS: real primary backend restarted with current code; real saved connection ping returned HTTP 200, ok true. It sent a ping only and did not save settings or send report passages.

## 6. Things that surprised me
The close-all assertion requested as a nit already existed in the T1 test. The first browser script expected a saved explicit Chat format to auto-switch after changing the URL; correcting the test to select Detect from the address resolved that test-only mistake.

## 7. Deviations from the task
Owner explicitly requested direct completion, replacing the two-Gemini-session workflow for this round. Added port and skip-test regressions. Removed the pre-existing trailing blank line flagged by git diff --check. No test assertion was weakened.

## 8. Open questions for the reviewer
None for T3. Remote-client 403 remains unit-tested; a real remote machine and Firefox/Safari were not used. Existing extraction, language, privacy and login limitations are outside this round.

## 9. How the reviewer can double-check
Read `gemini/reviews/T3_review.md`; run the focused command above, build/audit/scan, and compare the route to TASK_T3. Live scripts and logs are in `C:/Users/Admin/AppData/Local/Temp/codex-vita-t3-49735847c0f54036b8761092a3a9ba40/`. All scratch servers are stopped.

Branch proof: `feature/privacy-shield-and-rag-lab`; HEAD `c4fca21`. Work remains uncommitted.
