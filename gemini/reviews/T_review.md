# Review of Plan T, round 1 (T1 backend + T2 frontend), 2026-10-12

Verdict: **ACCEPTED WITH ONE FIX (D1) AND ONE SMALL IMPROVEMENT (D2).** Round-2 task: `gemini/TASK_T3_fixes.md`.

## What I checked (by me, not copied from the reports)
| Check | Result |
|---|---|
| `routes/ai.py` new block vs the exact code in TASK_T1 (diff of 177 lines) | identical, 0 differing lines |
| `config.py` diff | matches the task (one cosmetic nit: three blank lines before `class Settings`) |
| `AiConnectionSection.tsx` vs the exact code in TASK_T2 (diff) | identical, 0 differing lines; `api/ai.ts` has every required line; `SettingsPage.tsx` +3 lines (import, one render) |
| Full backend suite, my own run | **778 passed** in 6 min 5 s (755 + 23 new), equals the T1 report |
| `npm run build`, `audit:design`, `secret_scan` | build exit 0; audit 104 files 0 errors; scan PASS (T2 report; I ran build/audit earlier on the same tree and re-ran tsc as part of the build) |
| Real `vitagraph/backend/.env` | untouched: `LastWriteTime` 2026-10-08 14:16:14, same as before the sessions; no `.env.tmp` left; no scratch ports left open |
| Browser run on a scratch stack (backend 8001 with DATA_DIR, DB_PATH, CHROMA_DIR, UPLOADS_DIR, VITAGRAPH_ENV_FILE set and 0 chunks; frontend 5174; fake model server 8099), 30 checks | 29 passed. The 30th ("no console errors") only counted the browser's own log line for the deliberate 422 of the wrong-address test, not an app error |
| What the browser run proved | section placement; disabled/enabled states; password box and Show/Hide; Chat warning appears for Detect+`/v1` and disappears for Responses; Test saves nothing; Save shows "Saved.", clears the key box, shows "ending in 1234"; reload keeps address/model, not the key; the key is nowhere in the page text, HTML, localStorage/sessionStorage or console; wrong address gives a red error + "Save without testing" and changes nothing; Enter in the model field saves; remove-key dialog starts on "Keep it", Esc closes it, confirm removes the key; no brand words on the page; no sideways scroll at 1000/820/400 |
| Live effect | after a save with an address ending `/responses`: `api_format` responses, `shield_covered` true, `/api/health` shows the new model, the fake server received `Bearer <key>` on `/v1/responses`; the scratch `.env` kept `TOP_K_RESULTS=5` and got the five MODEL_ lines; after remove-key `MODEL_API_KEY=` is empty |

T2 skipped its own live check as designed (T1's report did not exist when it finished); I ran it.

## Defects
**D1 (backend, must fix, a gap in MY specification): a saved key can be sent to a different address.** `POST /api/ai/model/test` (and save) with an empty key field use the SAVED key for whatever address was typed. Proven: saved a key for `http://127.0.0.1:8099/v1`, then tested `http://localhost:8099/v1` with an empty key; the fake server received the saved key. `config.py` already states the rule "an old gateway key can never go to a new host"; the new routes must obey it. Fix: when the key field is empty and the host (including port) of the typed address differs from the saved address, answer 422 "You changed the address, so paste the key again..." and do not call the model.

**D2 (frontend, small): the page still says "Leave this empty to keep it" after the person changed the address to a different host,** which is the exact case D1 now refuses. Show the right help text and keep Test/Save disabled until a key is typed in that case.

## Nits (fix in round 2, no separate review needed)
- `config.py`: three blank lines before `class Settings` (keep two).
- No test asserts that `close_all` is called when saving; add one assertion to the save test if it is not there (the fixture already has the counter).

## Not verified / honest gaps
- A real model call through the new connection (no real key used in review; the fake server only proves the request reaches the saved address with the saved key, format and path).
- A save while an agent worker is idle-warm: the code calls `close_all()` (asserted by the fake pool in tests), but I did not watch a real worker restart.
- The 403 for a remote caller is covered by a unit test only (a remote machine was not available).
- Firefox/Safari.
