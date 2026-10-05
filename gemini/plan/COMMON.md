# Common part of VitaGraph-plan.md (sections 1 to 6, copied verbatim)

Every file `gemini/plan/TASK_<ID>.md` holds ONE task of the plan. Read this file first, then the task file(s) you were given.
The full plan is `VitaGraph-plan.md` in the repository root; it is the source of truth if a copy ever differs.

## 1. How to use this plan

- **Order and sessions.** The default order is the one in section 3, workstream by workstream. Section 7 groups the tasks into sessions of 1 to 4 tasks.
  - Within a session, still make one commit and one report per task (rule 11 and section 5.2), and stop after each task for the reviewer.
  - A task may start as soon as everything in its "Depends on" line is done. The list names only real dependencies: code or data the task needs. Tasks that touch the same file stay in the session order of section 7, to avoid conflicts.
- **Task IDs are stable names, not positions.** Inside workstream D, the file lists D1–D6, then D9, D11, D7, D8, D10 and D12, because D7, D8 and D10 plug into the page that D11 builds.
- **Heading format (stable, for splitting the file mechanically).** Every task starts with a line `### Task <ID> — <title>`, followed by these lines in this order:
  - `- **Goal:**`
  - `- **Tier:**` (Must, Should or Could)
  - `- **Size:**` (S, M or L, with ` · hard` for the flagged tasks)
  - `- **Review:**` (light or gate)
  - `- **Depends on:**` (task IDs, or none)
  - `- **Files to read first:**`
  - `- **Files to create or modify:**`
  
  Then the bold headings **What to change**, **How to verify** and **Acceptance criteria**. A task ends at the next `---` line.
- **Tiers.** Must and Should tasks never depend on a Could task. When time is short, skip Could tasks; nothing else breaks.
  - A step marked "Only when X is done" is carried out only if task X was done before. Otherwise skip that step and say so in the report.
- **Review levels.**
  - `light`: the reviewer checks the file list (`git diff --stat`), the command outputs in the report, and the acceptance boxes.
  - `gate`: the reviewer also repeats every browser check by hand and reads the whole diff.
- **This plan contains no implementation code.** The user asked for a plan that says what to change and in which block of code, not the code itself. The worker writes the code from each task's description. Every name the description gives (files, components, props, functions, test IDs, routes, CSS classes, texts shown to people) is binding and must be spelled exactly as written. Anything the description leaves open is the worker's choice, within the rules of section 4.
- **How a code block is cited.** A block of existing code is cited as a path, a line range and an anchor, for example `site design/src/pages/LibraryPage.tsx` lines 16–26 (anchor `function statusOf(r: MeasurementRow)`).
  - The line numbers are those of the branch at commit `dcae86f`, before any task runs.
  - The anchor is a short piece of text that appears inside those lines.
  - When an earlier task has already changed the same file, the line numbers can drift. Find the block by its anchor then. If the anchor is missing or appears more than once, stop and report the task BLOCKED. Never guess.
- **Each task lists:**
  - "Files to create or modify", where each item says create, modify or delete;
  - "What to change", numbered changes that each name their block and describe the result;
  - "How to verify" and "Acceptance criteria". Run every command exactly as written.
- Delete a file with `git rm "<path>"`. Create new files only at the paths given.
- If a verify command fails three times, stop. Restore only the files this task touched (`git checkout -- "<path>"`, and delete files the task created). Report the task BLOCKED with the exact error.

## 2. Facts the worker needs (all checked against the branch)

### 2.1 Places
- Repository root on the worker's machine: `F:\kiruthika\kiruthika final project` (as used by the earlier task files in `gemini/`). All commands below run in **PowerShell from the repository root** unless a step says otherwise.
- Frontend: `site design/`, built with React 19.2, TypeScript ~6.0, Vite 8 and Tailwind 4, plus react-router-dom 7, react-markdown 10 and remark-gfm 4 (`site design/package.json`). The TypeScript config is strict and also sets `noUnusedLocals` and `noUnusedParameters` (`site design/tsconfig.json`), so an unused import or variable fails the build.
- Backend: `vitagraph/backend/` (FastAPI, SQLite at `vitagraph/backend/data/vitagraph.db`, ChromaDB, NetworkX, PyMuPDF imported as `fitz`, RapidOCR). The agent uses DeepSeek Harness SDK `0.1.5rc1` and `mcp==2.3.0` (`vitagraph/backend/requirements.txt`).
- `vitagraph/frontend/` is an old frontend (48 tracked files). It is **never touched** by this plan.
- The reference design is `design/reference/app-v3-source.html`, plus screenshots `design/reference/screens/00_Upload.png` to `10_Settings.png`.
- Sample PDFs: `vitagraph/sample_data/synthetic_panel_2025-01-15.pdf`, `vitagraph/sample_data/synthetic_panel_2025-06-20.pdf` and `vitagraph/sample_data/VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf`. The same three are copied in `site design/public/`.

### 2.2 Design system (Modernist)
- Tokens live in `site design/src/theme/tokens.css`. Use the canonical tokens: `--color-bg #f3f2f2`, `--color-surface #eae9e9`, `--color-text #201e1d`, `--color-accent #ec3013`, `--color-accent-100` to `--color-accent-900`, `--color-neutral-100` to `--color-neutral-900`, `--color-divider`, `--space-1/2/3/4/6/8` (4, 8, 12, 16, 24, 32 px) and `--shadow-sm/md/lg`. Three meaning colours are also allowed: `--verdigris` (verified), `--ochre` and `--ochre-ink` (caution, used for "uncertain").
- The reference component classes are in `site design/src/theme/modernist.css`: `btn`, `btn-primary`, `btn-secondary`, `btn-ghost`, `input`, `tag`, `tag-accent`, `tag-neutral`, `tag-outline`, `table`, `seg`, `seg-opt`, `field`.
- The rules (`gemini/RULES.md` section 2):
  - Archivo 400/600/800 only.
  - No border radius, no gradients, no backdrop blur, no emoji.
  - Shadows only on floating things.
  - Never raw hex colours in components.
  - Sentence-case copy.
  - No provider or model names in the UI.
- Shell: `site design/src/components/shell/AppShell.tsx` renders `Sidebar`, `Header`, `<main id="main-content">` (the scroll container) and `StatusStrip`. Routes in its `OWN_LAYOUT` set draw their own page layout.

### 2.3 Backend routes (method, path, file), all real
| Method | Path | Defined in |
|---|---|---|
| GET | `/api/health` | `vitagraph/backend/app/main.py` |
| POST, GET | `/api/users` | `app/routes/users.py` |
| POST | `/api/users/{user_id}/consent` | `app/routes/users.py` |
| DELETE | `/api/users/{user_id}` | `app/routes/users.py` |
| GET | `/api/reports/compare` | `app/routes/reports.py` |
| POST | `/api/reports/upload` | `app/routes/reports.py` |
| GET | `/api/reports?user_id=` | `app/routes/reports.py` |
| GET | `/api/reports/{report_id}/status` | `app/routes/reports.py` |
| GET | `/api/reports/{report_id}/pages` | `app/routes/reports.py` |
| GET | `/api/reports/{report_id}/measurements` | `app/routes/reports.py` |
| GET | `/api/reports/{report_id}/pages/{page_number}/image` | `app/routes/reports.py` |
| GET | `/api/reports/{user_id}/trends?test=` | `app/routes/reports.py` |
| GET | `/api/graph/{user_id}` | `app/routes/graph.py` |
| POST | `/api/graph/subgraph` | `app/routes/graph.py` |
| GET | `/api/jobs/{job_id}/events` (SSE) | `app/routes/jobs.py` |
| GET | `/api/jobs/{job_id}` and `/api/jobs/{job_id}/result` | `app/routes/jobs.py` |
| POST | `/api/jobs` | `app/routes/jobs.py` |
| POST | `/api/questions`, `/api/questions/stream` | `app/routes/questions.py` |
| POST | `/api/chat/stream` | `app/routes/chat.py` |
| POST | `/api/agent/stream` | `app/routes/agent.py` |
| GET | `/api/timeline/{user_id}`, `/api/timeline/{user_id}/ai-calls` | `app/routes/timeline.py` |
| GET, POST | `/api/ai/config`; POST `/api/ai/privacy`, `/api/ai/analyze-report` | `app/routes/ai.py` |
| POST | `/api/demo/cohort` | `app/routes/demo.py` |
| GET | `/api/tools/ocr/status`; POST `/api/tools/ocr` | `app/routes/tools.py` |

This plan adds six routes on five paths:
- `GET /api/reports/{report_id}/chunks/{chunk_id}` (task B1)
- `GET /api/agent/conversations` (task D2)
- `GET, DELETE /api/agent/conversations/{conversation_id}` (task D2)
- `POST /api/agent/artifacts/report` (task D4)
- `GET /api/agent/artifacts/{artifact_id}` (task D4)

### 2.4 How the upload pipeline reports progress
- `report_service.process_upload` (in `app/services/report_service.py`) publishes job events through `job_broker.publish_event` (in `app/services/job_service.py`). The real stages are: `received`, a series of per-page `extracting` events, then `extracted`, `chunked`, `embedded`, `indexed` and `graphed`. A terminal `done` follows, sent by `complete_job` or `fail_job`. That makes **six stages**: Received, Extracted, Chunked, Embedded, Indexed, Graphed. The six step names in `site design/src/hooks/useJobStream.ts` (`INITIAL_STEPS`) are the same six.
- The broker writes a named SSE line (`event: <name>`) whenever an event has an `event_type`. Three events have one: per-page `page_extracted`, terminal success `completed`, and terminal failure `error`. A browser `EventSource` delivers named events only to listeners registered for that name, never to `onmessage`. Today `useJobStream` listens only through `onmessage` and `onerror`, so the `done` event only reaches it after the stream closes and its polling fallback asks `/api/jobs/{id}/result` (1.5 s later). Task C1 fixes this.

### 2.5 How the AI Agent works today
- `POST /api/agent/stream` (`app/routes/agent.py`) streams `(event_type, payload)` frames from `agent_service.stream_agent` (`app/services/agent_service.py`). The safety gates run first, in this order:
  1. clinical-boundary refusal;
  2. injection sanitising;
  3. if AI is off or no key is set, the offline evidence-only path through `chat_service.stream_chat(..., mode="rag_only")`;
  4. otherwise the harness runtime pool in `app/agent/pool.py`.
- Harness notifications are turned into events by `EventMapper` (`app/agent/mapper.py`). The events are `status`, `step`, `thinking`, `tool_call`, `tool_result`, `text_delta`, `stats`, `completed` and `error`.
- The model can see exactly four read-only tools from `app/agent/mcp_server.py`: `list_reports`, `search_reports`, `get_measurements` and `graph_lookup`. The harness names them `mcp__vitagraph__<tool>`.
- The four-tool lockdown is enforced by `assert_locked_down` (`app/agent/lockdown.py`) against `TOOL_NAMES` (`app/agent/profile.py`). Three existing tests pin it to exactly four tools, and those tests must stay green:
  - `tests/test_agent_mcp_server.py::test_the_server_offers_exactly_four_tools_without_any_persona_parameter`
  - `tests/test_agent_profile.py::test_lockdown_check_accepts_exactly_the_four_tools_and_refuses_anything_else`
  - `tests/test_agent_profile.py::test_a_real_runtime_is_locked_down_and_the_persona_cannot_be_overridden`
- The free AI gateway rejects the harness. It returns HTTP 401 "unauthorized client", or HTTP 400 `content-blocked` for some wordings (`gemini/reviews/TASK_AG4_review.md`). So no real model answer has ever come through the agent. Per `gemini/RULES.md` section 5d this is recorded as "API blocked" and never worked around.
- Facts checked against the reference harness source (`deepseek-ai/deepseek-harness`):
  - The Python SDK only offers `initialize`, `session/prompt` and `shutdown`. There is no session list or resume, so VitaGraph's own database must own conversations (task D2).
  - The harness's transcript modes are `compact`, `standard`, `detailed` and `verbose` (`packages/client/ui-chat/src/chat-settings.ts`). This plan's Minimal, Standard and Detailed map to compact, standard and detailed.
  - Harness slash commands are `/name [input]`. They never become a model message, and an unknown name is rejected (`packages/interaction/commands/README.md`).
  - The harness `llm/retry` event names its attempt number `retry`, not `attempt`, and also carries `provider` (`packages/llm/llm-retry/src/types.ts`).

### 2.6 Test data and servers
- Backend tests: `cd vitagraph\backend; .venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider`. At this commit the reviewer's last full run was **201 passed** (`gemini/reviews/TASK_AG3b_review.md`; AG4 changed no backend file). The full run takes about 230 seconds. Tasks never state a fixed total; see section 5.1.
- Start the backend (background terminal): `cd vitagraph\backend; .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`
- Start the frontend (background terminal): `cd "site design"; npm run dev -- --port 5173`. Wait 12 seconds.
- Stop both: `Get-NetTCPConnection -LocalPort 5173,8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
- Throwaway persona for live checks: **"Empty Test Persona"**, id `usr_51f14542d71a`. It holds sample reports. Never use other personas for destructive checks.
- Browser checks use system `python` with Playwright and `p.chromium.launch(channel="chrome")`, as in `gemini/TASK_AG4_agent_page.md`. Run `$env:PYTHONIOENCODING="utf-8"` first.

## 3. Order of work

| Order | Workstream | Why it goes here |
|---|---|---|
| 1 | **A. Finish the design** (A1 to A13) | Every later screen is built from the shared page frame, tag and state components that A creates, and A removes invented data before more is built on top of it. |
| 2 | **C. End-to-end reliability** (C1 to C8) | The upload-to-answer journey must be correct before heavier features use its data: the 3D graph reads what ingestion writes, and the agent reads what retrieval finds. |
| 3 | **B. 3D knowledge graph** (B1 to B11) | B is self-contained frontend work on top of the now-reliable graph API, and it reuses A's states and C's journey checks. |
| 4 | **D. Harness agent** (D1 to D12) | D is the largest change, to both backend and frontend. It depends on A's page states, C's offline evidence path and B's "show in graph" link. |
| 5 | **E. Tools** (E1 to E5) | E is new scope from the owner. Text to Graph reuses B's 3D and 2D renderers, so E comes after B. It follows the four requested workstreams. |
| 6 | **F. Hardening and handover** (F1 to F5) | F closes the privacy and secret issues across all the pages built before it, adds the final safety suite, updates the documents last, and waits on the owner for the paid-API follow-up. |

## 4. Rules (binding for every task)

1. **Branch.** Work only on `redesign/modernist-app`. The first command of every task is `git branch --show-current`, and it must print `redesign/modernist-app`. Never commit to, merge into, rebase onto or push `main`. Never force-push anything, and never force-push `main`. Never run `git reset --hard`, `git clean`, `git commit --amend` on earlier tasks, or `--no-verify`.
2. **Never touch `vitagraph/frontend/`.** No task reads from it or writes to it.
3. **No invented data anywhere.** Every number, name, date, ID, label count or quote shown to a person comes from an API response for the active persona. Never fall back to a demo persona ID, a placeholder filename, a made-up similarity or a "typical" value. When data is missing, say that it is missing.
4. **`uncertain` stays labelled uncertain.** A page whose `quality` or `extraction_method` is `uncertain`, and a graph node of type `uncertainty`, are shown with the word "Uncertain". Use the `uncertain` tone of the shared `Tag` (task A2). Never relabel them as "No text", "Failed", a value or a finding.
5. **The pipeline has exactly six stages:** Received, Extracted, Chunked, Embedded, Indexed, Graphed. Asking the AI Agent is the destination after the pipeline (a button). It is never shown as a seventh stage.
6. **No provider or model names in the UI.** The page says "AI Agent". No "AgentRouter", "DeepSeek", "GPT", "Claude" or "Gemini" in visible text.
7. **Backend tests:**
   - Never edit or delete an existing test file under `vitagraph/backend/tests/`. New tests go in new files that this plan names.
   - The full suite must pass at the end of every backend task, with the count rule of section 5.1.
8. **Secrets.** Never print, copy or commit `vitagraph/backend/.env` or any key.
9. **API blocked.** If the AI gateway refuses a request, paste the raw error frame (key redacted) and write `API blocked`. Carry on with every check that does not need the model. Never build a workaround.
10. **Packages.** Add only these npm packages, at exactly these versions:
    - `three` 0.180.0, `@react-three/fiber` 9.8.1 and, as a dev dependency, `@types/three` 0.180.0 (task B2);
    - `pdfjs-dist` 6.4.299 (task E3);
    - `axe-core` 4.13.0 as a dev dependency (task A13).
    
    Add no Python packages.
11. **Commits.**
    - Stage files by explicit path only. Never `git add .` or `git add -A`.
    - Never stage `site design/tsconfig.tsbuildinfo`.
    - Make one commit per task, with the message `plan(<TaskID>): <short summary>`, for example `plan(A2): shared page frame, state and tag components`.
12. **Keep test IDs.** Keep every `data-testid` a task tells you to keep. New IDs are spelled exactly as given.
13. **Cleanup discipline.** Every timer is cleared, every `EventSource` closed and every `AbortController` aborted when its component unmounts.
14. **Follow the description exactly.** Use every name, text and number a task gives. If anything in a task is unclear or contradicts these rules, stop and ask in the report. Do not guess.

## 5. Standard commands and reporting

### 5.1 Standard verify commands
- Frontend build: `cd "site design"; npm run build`. It must end with `built in` and exit code 0.
- Design audit (from task A1 on): `cd "site design"; npm run audit:design`. It must exit 0. From task B11 on, the same command runs in strict mode.
- One backend test file: `cd vitagraph\backend; .venv\Scripts\python.exe -m pytest tests\<file>.py -q -p no:cacheprovider`
- Full backend suite: `cd vitagraph\backend; .venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider`. Paste the last line.
- **Test counts are "baseline + N", never a fixed number.** Before a backend task, run the full suite and write its count in the report as the baseline (B). After the task, the full suite must show B + N passed, where N is the number of new tests the task names.
  - Tasks can run in another order or in parallel sessions, so a fixed total would be wrong.
  - The first baseline, at commit `dcae86f`, is 201.

### 5.2 Report file per task
Write `gemini/reports/TASK_<TaskID>_report.md` using the nine headings of `gemini/RULES.md` section 5b. Stage it in the same commit. Paste real command output only. Take line counts from `git diff --numstat`, never estimate them.

### 5.3 Browser checks
Scripts that drive the browser live in `scripts/plan/` and are committed with the task that creates them, so the reviewer can re-run them. Run them as `$env:PYTHONIOENCODING="utf-8"; python scripts\plan\<name>.py <arguments>` with both servers running. Every script ends with exactly one line `RESULT: PASS` or `RESULT: FAIL (...)`, and exits with code 0 only on PASS. Screenshots go to `gemini/shots/`.

## 6. Decisions for the owner

Each decision states the plan's default, which the tasks already follow, and what changes if the owner chooses otherwise. Write the answers in `gemini/reports/DECISIONS.md` before the task they affect starts. If there is no answer, the default stands.

| ID | Question | Plan default | If the owner chooses otherwise |
|---|---|---|---|
| DEC-1 | Should the 3D graph rotate by itself, as the reference does (`design/reference/app-v3-source.html` line 1028, anchor `g.ry += 0.0032`)? | **Yes**, with the rules of performance rule 12 (section 10). The speed is 0.19 rad/s, about one turn in 33 s. It pauses while dragging, hovering a node or with a node selected, and resumes 3 s after the last interaction. It is off under Reduce motion, in a hidden tab and in 2D. A toolbar switch (`graph-auto-rotate`) turns it off for the session. | **No:** drop rule 12, the switch in B8 and the auto-rotation check in B10. Idle frames are then always 0. |
| DEC-2 | Should the Datasets, Ontology and Notebooks pages be deleted? | **Delete** (task A3). They hold only invented content (section 8, findings), and no API exists that could fill them with real data. | **Keep:** each needs a backend data source first. That is new scope that this plan does not cover. |
| DEC-3 | The Upload page's frame stage has no frame images, so it shows developer text (`site design/src/components/upload/FrameStage.tsx` line 187, anchor `Frames go in assets/frames`). Supply frames or remove the stage? | **Remove** the stage from the page (task A9, step 13). Keep `FrameStage.tsx` in the repository, unused. | **Supply frames:** put `frame_1.jpg` … `frame_<n>.jpg` (n of at least 2) into `site design/public/assets/frames/`, then restore the column that A9 removed. No other change is needed. |
| DEC-4 | Add the reference's process speed setting (`design/reference/app-v3-source.html` line 1119, anchor `showMult()`)? | **Add** it, as the optional task C8 "Show speed" (Fast, Normal, Slow). It changes only the display pause, never the measured times. | **Drop:** skip C8. Nothing depends on it. |
| DEC-5 | Scope tiers for every task. | As labelled on each task. **Could:** C8, D4, D5, D7, D8, D10 and E4, which includes the owner's five D tasks. **Should:** A11, C7, B7, B9, E1, E2, E3, E5, F4 and F5. **Must:** everything else. | Change a label in the task's `Tier` line. A Must or Should task must never depend on a Could task; check the `Depends on` lines. |
| DEC-6 | Make `user_id` **required** on the older routes `/pages`, `/measurements` and `/pages/{page_number}/image`? | **Optional, checked when given** (task F1). The frontend always sends it. Making it required would break three existing tests, which rule 7 forbids editing: `tests/test_journey_events.py::test_page_image_endpoint_serves_png`, `tests/test_measurements.py::test_measurements_have_values_ranges_and_exact_spans` and `tests/test_measurements.py::test_measurements_unknown_report_is_404`. The new chunk route (B1) requires it. | **Required:** the owner allows editing those three tests to send `user_id`. F1 then makes the parameter required and updates exactly those three tests. |
| DEC-7 | Rotate the API key found committed in two archive files (task F2)? | **The owner must rotate it.** F2 removes the value from the files, but it stays in git history, and rule 1 forbids rewriting history. | (no alternative: the old key must be treated as exposed) |
