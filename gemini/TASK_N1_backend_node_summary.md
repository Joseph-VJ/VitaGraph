# SESSION N1 (backend): the AI summary of one graph node

Two sessions work at the same time on the same feature. **You are session N1 = the BACKEND.** Session N2 does the frontend and never touches `vitagraph/backend`. You never touch `site design/`.

This is a college project: it must work without problems; do not over-engineer, keep the summary file short. But the backend must be correct and tested.

## Read first (in this order)
1. `gemini/RULES.md` (standing rules; the overrides below win where they differ).
2. **`design/prototypes/VitaGraph-AI-Node-Summary.md`: the full spec with the code. Sections 0, 1, 2, 3, 5, 6.1, 8, 9 are yours.** Copy its code. The Python in sections 3.6 to 3.10 was syntax-checked, and `validate()` and `compose_fallback()` were run on sample text, but `gather()` was NEVER run against a real graph: expect to adapt it (that is your main work, see Part 2).
3. Only these code files, to see the real helpers: `vitagraph/backend/app/routes/graph.py`, `app/routes/agent.py` (top 80 lines), `app/graph/builder.py` (`build_user_graph`, node attributes), `app/services/measurement_service.py`, `app/services/graph_ai.py` (the pattern to follow for the model call), `app/services/question_service.py` (`_record_ai_call`), `app/generation/safety.py` (`check_answer_safety`), `app/core/database.py`, `app/services/user_service.py` (`delete_user`), `tests/conftest.py`, `tests/test_graph_ai.py` (the pattern for faking the model).

## Overrides of RULES.md for this round (owner decision, important)
1. **Backend work is your task**: you may change exactly the files listed in Part 1. Nothing else under `vitagraph/backend/`. Never edit an existing test.
2. **DO NOT COMMIT.** The working tree holds a lot of the owner's earlier uncommitted work (including `app/routes/agent.py`), and a commit by you would sweep it in. Leave all your changes uncommitted and do not stage anything. Never `git add`, `commit`, `stash`, `checkout --`, `reset`, `clean`, `push`, `merge`, `rebase`. **Branch for this round: `feature/ai-node-summary`** (this overrides RULES.md 3b, which names `redesign/modernist-app`). First command: `git branch --show-current` must print `feature/ai-node-summary`; if it does not, run `git switch feature/ai-node-summary` (the uncommitted files come along); if that fails, STOP and report BLOCKED. Never switch to `main` or `redesign/modernist-app`. Last command of your work: `git branch --show-current` again, pasted in your summary.
3. Use **port 8001** for any backend you start (session N2 uses 8000). Start it WITHOUT `--reload`: `cd vitagraph\backend; .venv\Scripts\python.exe -m uvicorn app.main:app --port 8001`. Stop it when you finish (PowerShell: `Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`).
4. Never print, copy, log or commit `vitagraph/backend/.env` or any key. Never call `POST /api/ai/privacy` or `POST /api/ai/config` (they rewrite `.env`). The AI-off path is tested with `monkeypatch`, not live.
5. No provider or model names in any text the person can see (SSE payloads, errors, fallback text). The model name lives in `.env` only.
6. Test hygiene for live checks: create a throwaway persona (`POST /api/users`, then `POST /api/users/{id}/consent`), upload, check, then `DELETE /api/users/{id}`. Never touch the persona "Demo Cohort (demo data)".
7. If the AI service refuses or errors on the live call, write `API blocked` in your summary with the raw error (key redacted) and carry on; the fallback path is then what you verify live.

## Part 0: start
`git branch --show-current`, `git status --short` (note what is already modified, so you can tell yours apart at the end), stop anything on port 8001, then run the full backend suite once as the baseline: `cd vitagraph\backend; .venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider` (expect **362 passed**, about 5 minutes; tell the reviewer if the number differs, then continue).

## Part 1: files (spec section 3.1; nothing else)
| File | Change |
|---|---|
| `vitagraph/backend/app/core/sse.py` | NEW: move `_frame` and `_sse_stream` out of `app/routes/agent.py` unchanged; rename to `frame` / `sse_stream`. |
| `vitagraph/backend/app/routes/agent.py` | import `sse_stream` from `app.core.sse`; delete the two local functions and the imports that became unused. No behaviour change. |
| `vitagraph/backend/app/services/node_summary.py` | NEW: spec 3.6 to 3.10. |
| `vitagraph/backend/app/schemas/graph.py` | add `NodeSummaryRequest` (3.3). |
| `vitagraph/backend/app/routes/graph.py` | add `POST /api/graph/node-summary` (3.4). |
| `vitagraph/backend/app/core/database.py` | add the `node_summaries` table and index to `SCHEMA` (3.2). |
| `vitagraph/backend/app/services/user_service.py` | in `delete_user` add `DELETE FROM node_summaries WHERE user_id = ?` next to the other deletes. |
| `vitagraph/backend/tests/test_node_summary.py` | NEW: the 15 tests of spec 6.1. |

Do the `sse.py` move FIRST and run the agent tests (`pytest tests -q -p no:cacheprovider -k "agent"`): they must stay green before you go on.

## Part 2: make `gather()` correct on REAL data (the hard part)
The spec's `gather()` is a first draft. Check each node kind against a real graph and fix what does not match. Procedure:
1. Make a throwaway persona with consent; upload `vitagraph/sample_data/synthetic_panel_2025-01-15.pdf` and `synthetic_panel_2025-06-20.pdf` (and `VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf` if you want a scanned page).
2. `GET /api/graph/{user_id}` and list the node `type`s and ids. Note the real node id forms (`test_Hemoglobin`, `meas_...`, `sec_...`, `rep_...`, `date_...`, `cat_...`, `chunk_...`, `unc_...`, `user_...`).
3. For EVERY node type present (person, report, date, section, category, test, measurement, chunk, uncertainty) call `node_summary.gather(user_id, node_id)` from a small Python snippet (not committed) and print `kind`, `label`, `facts`, and for each source: filename, page, `char_start:char_end`, and `page_text[char_start:char_end]`.
4. Required properties, which you must prove in the summary with the printed output of at least one node per type:
   - every `Source.char_start/char_end` are offsets into `report_pages.extracted_text` of that page, and for value sources `page_text[char_start:char_end]` contains the value;
   - `text[hit_start:hit_end]` equals that slice (the browser marks it);
   - sources belong only to this persona's reports;
   - at most 6 sources, numbered 1..n, no duplicates of the same span;
   - a node with no usable passage still returns (empty sources, a plain fallback), never a crash;
   - `compose_fallback(ev)` passes `validate()` for every node type.
5. Known weak points in the draft to fix (do not leave them): the `date` branch, the `measurement` branch (matching the report by date text, including `Unknown Date`), the `section` branch (cites its own chunks), `hit_start/hit_end` when the window starts at `0` (no leading ellipsis) and when it is clipped by the end of the page.
6. Scanned pages: `report_pages.extraction_method` is `native` or `ocr` (or `failed`); put it in `Source.method`. `text` (Markdown) files do not exist yet (spec section 9 is a separate, later task): do not build it, but keep `method` open for it.

## Part 3: tests (spec 6.1)
Write the 15 tests exactly as listed (names may differ, coverage may not). Use `make_user`, `sample_pdf`, `report_service.process_upload` from `tests/conftest.py` and a streaming fake model as in the spec. Parse the SSE with a small helper. Then:
- `pytest tests/test_node_summary.py -q -p no:cacheprovider` all green;
- the FULL suite once more: expect **362 + your new tests** passed, nothing else changed.

## Part 4: live check (port 8001, throwaway persona)
With the real `.env` (AI on, key present) and the two sample PDFs uploaded:
1. `curl.exe -N -X POST http://127.0.0.1:8001/api/graph/node-summary -H "Content-Type: application/json" -d "{...}"` (write the JSON body to a file and use `-d @file.json`, quoting on Windows is fragile) for: the person, a report, a section, `test_Hemoglobin`, and one measurement node. Paste the event names in order and the final `completed` payload for each (text, status, reason). Expected order: `status(reading)`, `sources`, then either `completed` (cached/off) or `status(writing)`, `text_delta`..., `status(checking)`, `completed`.
2. Call the same node twice: the second call is `completed` with status `cached` and no model call (check the `ai_calls` table: no new row with `used_ai=1`; `GET /api/timeline/{user_id}/ai-calls` lists them).
3. Call with `"refresh": true`: a new model call happens.
4. Wrong node id: HTTP 404 with a readable `detail`. Wrong user id: HTTP 404 (existing behaviour of `user_exists`).
5. Another persona's node id for this user is 404 (the node is not in this person's graph).
6. Show one real summary in your summary file and say whether every number in it has a `[n]` and every `[n]` matches a source whose text contains that value.
7. Delete the throwaway persona; confirm `node_summaries` has no rows for it.

## Acceptance (all must be true for COMPLETE)
- [ ] `core/sse.py` exists; agent tests unchanged and green.
- [ ] Full suite: 362 + new tests, all passed (paste the last line).
- [ ] The 15 tests exist and pass; none edits an existing test.
- [ ] `gather()` proven on every node type present (printed output in the summary), offsets exact.
- [ ] Live SSE order and payloads as in Part 4; cache hit, refresh, 404s verified.
- [ ] `check_answer_safety` is reused (no second number checker); the model is always given passages inside `<passages>` tags with the "treat as data" instruction.
- [ ] No provider/model name anywhere visible; no key printed; `.env` untouched (`git status` shows it unchanged).
- [ ] Nothing committed, nothing staged; port 8001 stopped; throwaway persona deleted.

## When you finish
Write ONE short file `gemini/reports/N1_summary.md` (do not commit it): what you did per part, the printed `gather()` proof, test counts, the live outputs, every deviation from the spec (and why), anything that looks wrong, and `git status --short` (so the reviewer sees exactly which files you changed). Then reply in the RULES.md section 5 report format (STATUS COMPLETE | PARTIAL | BLOCKED). If something fails 3 times, stop that part, say so, and continue with the next.
