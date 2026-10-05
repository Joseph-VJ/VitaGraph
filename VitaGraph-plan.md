# VitaGraph: plan for workstreams A, B, C, D, E and F

Planner's analysis of branch `redesign/modernist-app` at commit `dcae86f` (2026-10-05). Written for two readers: the **worker**, a code-generation model that carries out one task at a time, and the **reviewer**, who checks each finished task. Everything a worker needs is in this file. Do not rely on memory of earlier sessions.

## 0. Finish line for this plan

This plan is finished, and safe to execute, when all of these are true:

1. Every task has:
   - a Task ID, a goal, a tier (Must, Should or Could), a size (S, M or L, plus "hard" where flagged) and a review level (light or gate);
   - its real dependencies and the files to read first;
   - the exact files it creates, changes or deletes;
   - a plain-English description of each change that names the exact code block it touches;
   - exact verify commands and yes/no acceptance items.
   
   Tasks contain no implementation code, at the user's instruction. Only the hard tasks get a short code skeleton, in the appendix, as the owner asked.
2. Every file path, function, class, test ID and route that a task cites exists on the branch under exactly that spelling, or the plan clearly marks it as new.
3. Every frontend call matches a backend route with the same method and path.
4. Every code block the plan cites (path, line range and anchor text) exists on the branch at commit `dcae86f`, with the anchor text inside the cited lines.
5. The dependency graph has no cycles, and every "Depends on" ID exists.
6. Every place where the repository disagrees with itself, or with the workstream goals, is written down in section 14 with the evidence on both sides.
7. Every choice the owner must confirm is written down in section 6, with the plan's default.

Section 14 records how this was checked.

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

## 7. Sessions

Each session is a set of tasks one worker can finish in one sitting. Each task still gets one commit and one report. Sessions follow the order of work, and a session starts only when every dependency of its tasks is done. Tasks that change the same file are kept in order: AppShell, Header, Sidebar, App, UploadPage, AgentPage, SettingsPage and preferences.

| Session | Tasks | Sizes | Notes |
|---|---|---|---|
| S1 | A1, A2, A3, A11 | M, M, S, S | Audit, shared components, page removal, toast. |
| S2 | A4, A6, A7, A10 | S, S, S, S | Shell, Compare, Insights, AI Agent states. |
| S3 | A5, A8, A9 | M, M, M | Library, Settings, Upload. |
| S4 | A12 | L · hard | Timeline alone (appendix skeleton). |
| S5 | A13, C1, C4 | M, M, S | End-of-A gate first, then the job stream and the evidence text. |
| S6 | C2, C3 | M, L · hard | Six stages and the ingestion show (appendix skeleton). |
| S7 | C5, C7, C8, C6 | M, S, S, L | Offline states, timings and show speed, then the journey script last. |
| S8 | B1, B2, B3, B7 | S, S, M, S | Chunk route, packages, graph model, view preference. |
| S9 | B4, B6 | M, M | Inspector and the 2D view. |
| S10 | B5 | L · hard | The 3D view alone (appendix skeleton). |
| S11 | B8, B9 | L · hard, S | The graph page (appendix skeleton), then "Show in graph". |
| S12 | B10, B11 | M, S | Performance script, then the end-of-B gate. |
| S13 | D1, D2, D3, D6 | S, M, S, M | Conversation store, routes, mapper, client and hook. |
| S14 | D4, D5 | L · hard, M | Artifacts (Could; appendix skeleton for D4). |
| S15 | D9, D11 | S, L · hard | Conversation list and the harness page (appendix skeleton). |
| S16 | D7, D8, D10, D12 | M, M, M, M | Optional harness features, then the check script. |
| S17 | E1, E2, E3 | S, M, M | Tools: shared parts, Image to Text, PDF to Text. |
| S18 | E4, E5, F2 | M, S, S | Text to Graph (Could), the tools check, secret hygiene. |
| S19 | F1, F3, F4 | M, S, S | Privacy routes, safety suite, documents last. |
| S20 | F5 | M | Waiting for the owner's paid key. |

## 8. Workstream A: Finish the design

What A delivers:
- a design audit you can run again at any time;
- one shared component pattern (page frame, page state, tag, section head, persona gate);
- loading, empty, error and offline states on every page;
- no invented data, and "uncertain" always labelled as uncertain;
- pages that are usable at 360 px wide.

Findings from the analysis that A fixes, with the evidence:
- **Invented data.**
  - Three pages are entirely static, invented content:
    - `site design/src/pages/DatasetsPage.tsx` line 48 (anchor `VG-2026-001 (Arjun R)`);
    - `site design/src/pages/NotebooksPage.tsx` line 55 (anchor `load_vitagraph_subgraph(user_id="VG-2026-001")`);
    - `site design/src/pages/OntologyPage.tsx`, which has no API call at all.
    
    All three are still reachable by URL: `site design/src/App.tsx` lines 43–45 (anchor `<Route path="/datasets"`).
  - Four pages fall back to the demo persona ID `"VG-2026-001"` when no persona is loaded:
    - `site design/src/pages/UploadPage.tsx` line 15 (anchor `"VG-2026-001"`);
    - `site design/src/pages/AgentPage.tsx` line 204 (anchor `"VG-2026-001"`);
    - `site design/src/pages/TimelinePage.tsx` line 31 (anchor `"VG-2026-001"`);
    - `site design/src/pages/KnowledgeGraphPage.tsx` line 48 (anchor `"VG-2026-001"`).
  - `TimelinePage.tsx` shows the invented name "Arjun R" when no persona is loaded: `site design/src/pages/TimelinePage.tsx` line 972 (anchor `"Arjun R"`).
  - `UploadPage.tsx` builds a fake report object when a job finishes, inventing a file hash and a report date: `site design/src/pages/UploadPage.tsx` lines 40–51 (anchor `"verified_digest"`).
- **`uncertain` relabelled.**
  - `UploadPage.tsx` shows every page that is neither native text nor OCR as "No text": `site design/src/pages/UploadPage.tsx` line 366 (anchor `"No text"`).
  - But the extractor writes `extraction_method = "uncertain"`: `vitagraph/backend/app/ingestion/extractor.py` and `vitagraph/backend/app/ingestion/ocr_fallback.py`.
- **360 px.**
  - The header search box has a fixed width of 300 px: `site design/src/components/shell/Header.tsx` line 149 (anchor `style={{ width: 300 }}`).
  - The Insights grid uses `minmax(340px,1fr)` columns, which overflow a 360 px screen.
  - The Library and Compare tables have no horizontal scroll container.
  - Pages, the header and the footer use 32 px gutters even on phones.
- **Sidebar bar at 820 px.**
  - The red active bar is positioned only when the route changes: `site design/src/components/shell/Sidebar.tsx` lines 27–61 (anchor `}, [currentPath]);`.
  - It is never repositioned when the sidebar switches between its 244 px and 60 px widths, so it can point at the wrong item. The issue is noted in `gemini/reviews/TASK_AG4_review.md`.
- **Unconverted Timeline.**
  - `site design/src/pages/TimelinePage.tsx` (1214 lines) still uses the old design and `var(--ink-*)` tokens.
  - The reference's isometric chart function `iso()` is committed in `design/reference/app-v3-source.html` lines 1086–1114 (anchor `iso(bars, o) {`).

---

### Task A1 — Design audit script

- **Goal:** A repeatable audit that follows every import of the shipping app and reports anything that breaks the design and data rules.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `gemini/RULES.md` (section 2)
  - `site design/package.json`
  - `site design/src/main.tsx`
  - `site design/src/App.tsx`
- **Files to create or modify:**
  - create `site design/scripts/audit-design.mjs`
  - modify `site design/package.json`

**What to change**
1. **Create `site design/scripts/audit-design.mjs`**: a Node ES-module script that uses only Node built-ins (`node:fs`, `node:path`, `node:url`). Behaviour:
   - **Locating `src`.** Find the `src` folder relative to the script's own location, one level up from `scripts/`. Do not use the current working directory.
   - **Following imports.**
     - Start at `src/main.tsx`. Follow every relative import with a breadth-first walk:
       - static `import … from "…"`;
       - `export … from "…"`;
       - dynamic `import("…")`;
       - CSS `@import "…"`.
     - Do not follow type-only imports (`import type …`).
     - To resolve an import, try the suffixes "", `.tsx`, `.ts`, `.css`, `/index.ts` and `/index.tsx`, in that order. Ignore package imports (anything not starting with a dot).
   - **Skipped files.**
     - Never visit `pages/GalleryPage.tsx`. It is development-only after task A3.
     - Never visit any file under `src/motion/`. See open issue O-9 in section 14.
   - **Pending files.**
     - A PENDING list holds exactly two files that later tasks replace: `pages/KnowledgeGraphPage.tsx` (replaced in B8) and `components/gallery/CinematicPipelinePopup.tsx` (replaced in C3).
     - Findings in a pending file are printed as `pending` and do not fail the run, and that file's imports are not followed.
     - With the command-line flag `--strict`, the PENDING list is ignored: those files are checked and followed like any other.
   - **Lines checked.** Check each visited file line by line. Skip lines whose trimmed text starts with `//`, `/*`, `*` or `{/*`.
   - **The eight rules:**
     - `hex-colour`: a `#` followed by exactly 3, 6 or 8 hexadecimal digits, not followed by another letter, digit, underscore or hyphen.
     - `rounded`: the Tailwind class word `rounded` or `rounded-…`, as a whole word.
     - `radius`: `borderRadius:` or `border-radius:` with any value other than 0. In CSS, a `var(--r…)` value is also allowed.
     - `old-font`: the text `Spectral`, `IBM Plex` or `Georgia`.
     - `legacy-token`: `var(--…)` of any of these old token names:
       - `ink-<digits>`, `bone`, `paper…`, `chrome…`;
       - `titanium-mist`, `alloy-surface`, `steel-fog`, `deep-petrol`, `jade-slate`, `solar-bronze`;
       - `cornflower`, `lilac`, `text-main`, `text-muted`;
       - `shadow-3d…`, `shadow-float`, `shadow-floating`.
     - `console`: a call to `console.log`, `console.warn`, `console.error`, `console.info` or `console.debug`.
     - `demo-value`: the text `VG-2026-001`, `Arjun R` (as a whole word) or `NEJM_2023`.
     - `provider-name`: case-insensitive `agentrouter`, `deepseek`, `gemini`, `openai`, `anthropic`, `claude` or `gpt-<digit>`, at the start of a word.
   - **Theme files.** The three theme files `index.css`, `theme/tokens.css` and `theme/modernist.css` may contain raw colours and old token names. Skip the rules `hex-colour`, `rounded`, `radius` and `legacy-token` for them. Every other rule still applies.
   - **Output and exit code.**
     - For each finding, print one line: the severity padded to seven characters (`ERROR` or `pending`), the rule ID padded to 14 characters, `file:line` relative to `src`, then the first 120 characters of the trimmed line.
     - After a blank line, print `Checked N files: E error(s), P pending.`. In strict mode, put ` (strict)` after `files`.
     - Exit with code 1 when E is above zero, otherwise 0.
2. **Modify the `scripts` object:** `site design/package.json` lines 6–10 (anchor `"preview": "vite preview"`). Add an entry named `audit:design` whose command is `node scripts/audit-design.mjs`, directly after `preview`. Remember the comma after the `preview` line.

**How to verify**
1. `cd "site design"; npm run audit:design`. At this point the run is expected to **fail** with exit code 1, because tasks A3 to A12 have not removed the violations yet. Paste the full output into report section 4.
2. `cd "site design"; npm run build`. It must exit 0. The script lives outside `src`, so the build ignores it.

**Acceptance criteria**
- [ ] `site design/scripts/audit-design.mjs` exists and implements the eight rules, the skip list, the PENDING list and the `--strict` flag described above.
- [ ] `npm run audit:design` prints one line per finding and ends with a line of the form `Checked N files: E error(s), P pending.`.
- [ ] The output includes all of these ERROR lines (the planner's dry run of this specification found exactly these, among others):
  - `demo-value` at `pages/UploadPage.tsx:15`, `pages/AgentPage.tsx:204` and `pages/TimelinePage.tsx:31`;
  - `console` at `pages/UploadPage.tsx:108`;
  - `legacy-token` at `components/shell/AppShell.tsx:128`.
- [ ] The output includes `pending` lines for `pages/KnowledgeGraphPage.tsx`, and no line for any file under `motion/` or for `pages/GalleryPage.tsx`.
- [ ] `npm run build` exits 0.

---

### Task A2 — Shared page components (one component pattern)

- **Goal:** Add one page frame, one state block (loading, empty, error, offline), one status tag, one section head and one persona gate, plus the mobile CSS they rely on.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `site design/src/theme/tokens.css`
  - `site design/src/theme/modernist.css`
  - `site design/src/pages/LibraryPage.tsx` (for the inline patterns used today)
  - `site design/src/index.css` lines 1032–1043 (anchor `.agent-evidence-row:hover`)
- **Files to create or modify:**
  - create `site design/src/components/ui/PageFrame.tsx`
  - create `site design/src/components/ui/PageState.tsx`
  - create `site design/src/components/ui/Tag.tsx`
  - create `site design/src/components/ui/SectionHead.tsx`
  - create `site design/src/components/ui/PersonaState.tsx`
  - create `site design/src/components/ui/index.ts`
  - modify `site design/src/index.css`

**What to change**
1. **Create `PageFrame.tsx`.** It exports a type `PageWidth` (`"wide"`, `"narrow"` or `"full"`) and a component `PageFrame`.
   - **Props:**
     - `label` (string, required): written to `data-screen-label`, the page name that tests and screenshots use;
     - `width` (PageWidth, default `"wide"`);
     - `gap` (CSS length string, default `var(--space-8)`);
     - `testId` (optional, written to `data-testid`);
     - `children`.
   - **Renders** one `div` with class `vg-page` and inline styles: `maxWidth` 1280px for wide, 960px for narrow and `none` for full; vertical flex column; the given `gap`.
   - Gutters and centring come only from the `vg-page` class (step 7).
2. **Create `PageState.tsx`.** It exports a type `PageStateKind` (`"loading"`, `"empty"`, `"error"` or `"offline"`) and a component `PageState`.
   - **Props:**
     - `kind`;
     - `title` (string);
     - optional `detail` (string);
     - optional `action` and optional `secondaryAction`, each an object with a `label` string and an `onClick` function;
     - optional `testId`, which defaults to `page-state-<kind>`.
   - **Rendering:**
     - One block with `data-state` set to the kind.
     - `role="alert"` for error and offline, `role="status"` otherwise; `aria-live="polite"` only for loading.
     - Padding `var(--space-6)`; children in a column with gap `var(--space-3)`, aligned to the start.
     - A 2 px top rule: `--color-divider` for loading, `--color-text` for empty, `--color-accent` for error and offline.
     - Background `--color-accent-100` for error and offline, `--color-surface` otherwise.
     - The title is 1.25rem, weight 800, letter-spacing -0.01em, in `--color-accent-800` for error and offline and `--color-text` otherwise.
     - The detail is 0.9375rem in `--color-neutral-700`, at most 62ch wide, with long words allowed to break.
     - The actions are a wrapping row with gap `var(--space-2)`. The action is a `btn btn-primary` button and the secondary action a `btn btn-secondary` button, both `type="button"`.
3. **Create `Tag.tsx`.** It exports a type `TagTone` with the eight tones `done`, `running`, `waiting`, `failed`, `hot`, `accent`, `neutral` and `uncertain`, and a component `Tag`.
   - **Props:** `tone`, `children`, optional `testId`, optional `title`.
   - **Renders** a `span` with class `tag`, `data-tone` set to the tone and `white-space: nowrap`.
   - **Colours per tone:**
     - `done`: background `--color-text`, text `--color-bg`, weight 800.
     - `running` and `hot`: background `--color-accent`, text `--color-bg`, weight 800.
     - `failed` and `accent`: background `--color-accent-100`, text `--color-accent-800`, weight 800.
     - `waiting` and `neutral`: background `--color-neutral-200`, text `--color-neutral-800`.
     - `uncertain`: background `color-mix(in srgb, var(--ochre) 22%, var(--color-bg))`, text `--ochre-ink`, weight 800. Rule 4 says "Uncertain" is never shown in any other tone.
4. **Create `SectionHead.tsx`.** It exports a component `SectionHead`.
   - **Props:** `title` (string), optional `aside` (any React node), `accent` (boolean, default false), optional `testId`.
   - **Layout:** a wrapping flex row, space-between, centred, gap `var(--space-3)`, with `padding-bottom` `var(--space-2)` and a 2 px bottom rule in `--color-divider`.
   - **Title:** an `h2` at 0.6875rem, weight 800, letter-spacing 0.1em, uppercase. Colour is `--color-accent-700` when `accent` is set and `--color-neutral-700` otherwise.
   - **Aside:** at 0.8125rem in `--color-neutral-700`.
5. **Create `PersonaState.tsx`.** It exports a component `PersonaState` with props `loading` (boolean) and `onRetry` (function). It renders through `PageState`:
   - While `loading` is true: kind loading with the title "Loading your persona".
   - Otherwise: kind offline with the title "No persona available", the detail "The backend did not return a persona. Check that it is running, then try again." and the action "Try again", which calls `onRetry`.
6. **Create `index.ts`.** It re-exports `PageFrame` and the type `PageWidth`, `PageState` and the type `PageStateKind`, `Tag` and the type `TagTone`, `SectionHead`, and `PersonaState`.
7. **Append to the end of `site design/src/index.css`**, after the `.agent-evidence-row:hover` rule at `site design/src/index.css` lines 1041–1043 (anchor `.agent-evidence-row:hover`):
   - Add a comment saying these are the shared page frame and phone rules from plan task A2. Inline styles cannot hold media queries, which is why the gutters live in CSS.
   - Then add these classes:
     - `.vg-page`: border-box, full width, centred with auto side margins, padding `var(--space-8)`.
     - `.vg-pad`: border-box, padding `var(--space-8)`.
     - `.vg-gutter`: left and right padding `var(--space-8)`.
     - `.vg-header`: padding `var(--space-3) var(--space-8)`.
     - `.vg-footer`: padding `0 var(--space-8)`.
     - `.vg-scroll-x`: max-width 100%, horizontal overflow auto.
   - Add one `@media (max-width: 640px)` block that reduces every `var(--space-8)` above to `var(--space-4)` (16 px).

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0. The new components are not used yet, and unused exports are allowed.
2. `Select-String -Path "site design\src\components\ui\*.tsx" -Pattern 'rounded|#[0-9a-fA-F]{6}|Spectral|console\.'` prints nothing.

**Acceptance criteria**
- [ ] The six files exist in `site design/src/components/ui/`, with the exports, props and colours listed above.
- [ ] `index.css` ends with the `.vg-*` classes and the 640 px media block.
- [ ] The build exits 0.

---

### Task A3 — Remove pages made of invented data; make the gallery development-only

- **Goal:** Remove the Datasets, Ontology and Notebooks pages, which show only invented content (see the findings above), and load the component gallery only in development builds.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `site design/src/App.tsx`
  - `site design/src/pages/DatasetsPage.tsx`
  - `site design/src/pages/OntologyPage.tsx`
  - `site design/src/pages/NotebooksPage.tsx`
  - `site design/src/pages/NotReleasedPage.tsx`
  - `site design/src/components/shell/AppShell.tsx`
  - `site design/src/components/shell/Header.tsx`
- **Files to create or modify:**
  - modify `site design/src/App.tsx`
  - delete `site design/src/pages/DatasetsPage.tsx`
  - delete `site design/src/pages/OntologyPage.tsx`
  - delete `site design/src/pages/NotebooksPage.tsx`
  - delete `site design/src/pages/NotReleasedPage.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`
  - modify `site design/src/components/shell/Header.tsx`
- **Why delete instead of keep:**
  - `docs/SESSION_CONTEXT.md` section 16.8 lists "Datasets / Ontology / Notebooks: bring back or delete" as an open decision. Rule 3 (no invented data anywhere) rules out bringing them back as they are.
  - `NotReleasedPage.tsx` is imported nowhere.
  - Old addresses keep working, because the catch-all route sends them to `/upload`.

**What to change**
1. `site design/src/App.tsx` line 1 (anchor `import React from "react";`): also import `Suspense` and `lazy` from React.
2. `site design/src/App.tsx` lines 9–11 (anchor `import { DatasetsPage }`): delete the three page imports (Datasets, Ontology, Notebooks).
3. `site design/src/App.tsx` line 15 (anchor `import { GalleryPage } from "./pages/GalleryPage";`): delete this static import.
   - After the last import, add a module-level constant `GalleryPage` with a one-line comment: "The component gallery is a development tool. Production builds never load it."
   - When `import.meta.env.DEV` is true, the constant is a `lazy()` component. Its loader dynamically imports `./pages/GalleryPage` and maps the named export `GalleryPage` to `default`.
   - Otherwise the constant is `null`. Vite then drops the gallery from the production bundle.
4. `site design/src/App.tsx` lines 31–32 (anchor `<Route path="/gallery" element={<GalleryPage />} />`): render the `/gallery` route only when the constant is not null, and wrap the element in `Suspense` with a `null` fallback.
5. `site design/src/App.tsx` lines 43–45 (anchor `<Route path="/datasets"`): delete the three routes `/datasets`, `/ontology` and `/notebooks`.
6. Delete the four page files with `git rm`.
7. `site design/src/components/shell/AppShell.tsx` lines 23–25 (anchor `"/datasets": "Datasets and Knowledge Sources",`): delete the three `ROUTE_TITLES` entries for `/datasets`, `/ontology` and `/notebooks`.
8. `site design/src/components/shell/Header.tsx` lines 103–105 (anchor `case "/datasets":`): delete the three `case` lines for `/datasets`, `/ontology` and `/notebooks` in `getHeaderConfig`.

**How to verify**
1. `Get-ChildItem "site design\src" -Recurse -Include *.ts,*.tsx | Select-String -Pattern 'DatasetsPage|OntologyPage|NotebooksPage|NotReleasedPage'` prints nothing.
2. `cd "site design"; npm run build`. It must exit 0.
3. Production check: `Select-String -Path "site design\dist\assets\*.js" -Pattern 'Component gallery|MotionSpecimens'` prints nothing, because the gallery is not in the production bundle.
4. Browser check, with the dev server running: `http://localhost:5173/datasets` ends on `/upload`, and `http://localhost:5173/gallery` still opens the gallery.

**Acceptance criteria**
- [ ] The four page files are deleted with `git rm`.
- [ ] No route for `/datasets`, `/ontology` or `/notebooks` remains, and no title or header case for them.
- [ ] The production bundle contains no gallery code (check 3 prints nothing).
- [ ] The build exits 0.

---

### Task A4 — Shell: phone gutters, responsive search, and a sidebar bar that follows resizes

- **Goal:** Make the header, footer and sidebar usable at 360 px, and fix the red active bar that points at the wrong item after the sidebar changes width.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `site design/src/components/shell/Header.tsx`
  - `site design/src/components/shell/StatusStrip.tsx`
  - `site design/src/components/shell/Sidebar.tsx`
  - `site design/src/components/shell/AppShell.tsx`
  - `site design/src/motion/flip.ts`
- **Files to create or modify:**
  - modify `site design/src/components/shell/Header.tsx`
  - modify `site design/src/components/shell/StatusStrip.tsx`
  - modify `site design/src/components/shell/Sidebar.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`

**What to change**
1. **Header element:** `site design/src/components/shell/Header.tsx` lines 113–119 (anchor `padding: "var(--space-3) var(--space-8)"`).
   - Add the class `vg-header` in front of the existing classes.
   - Remove only the `padding` entry from the inline style. The class now supplies the padding, with 16 px on phones.
2. **Controls row:** `site design/src/components/shell/Header.tsx` line 133 (anchor `gap: "var(--space-3)", flexWrap: "wrap" }}>`). Add `minWidth: 0` and `maxWidth: "100%"` to its inline style so it can shrink.
3. **Search form:** `site design/src/components/shell/Header.tsx` lines 137–141 (anchor `data-boot-target="header-search"`). Its style `{ margin: 0 }` becomes flexible:
   - margin 0;
   - flex `1 1 200px`;
   - min width 0;
   - max width 300 px.
4. **Search input:** `site design/src/components/shell/Header.tsx` line 149 (anchor `style={{ width: 300 }}`). Change the width to `"100%"`.
5. **Footer:** `site design/src/components/shell/StatusStrip.tsx` lines 96–102 (anchor `className="flex-shrink-0 z-30 select-none"`).
   - Add the class `vg-footer`.
   - Remove `padding: "0 var(--space-8)"` from the inline style, keeping everything else.
6. **Sidebar import:** `site design/src/components/shell/Sidebar.tsx` line 1 (anchor `import React, { useEffect, useRef } from "react";`). Also import `useCallback`.
7. **Sidebar effect:** `site design/src/components/shell/Sidebar.tsx` lines 27–61 (anchor `}, [currentPath]);`). Restructure this effect into three parts.
   - **(a) `placeIndicator`.** Add a function `placeIndicator(animate: boolean)`, memoised with `useCallback` and empty dependencies. It holds the body of today's effect, with three differences:
     - The bar's top is computed as the link's top minus the nav's top, plus the nav's current `scrollTop`.
     - The bar's `display` is set to `block` before either branch.
     - When `animate` is false, it sets `top` and `height` directly and returns. When true, it runs the existing `flip(...)` call with the weighted spring and `capMs: 240`, unchanged.
   - **(b) Route effect.** It depends on `[currentPath, placeIndicator]`. It calls `placeIndicator(!isFirstRender.current)`, then sets `isFirstRender.current = false`.
   - **(c) Resize effect.** It depends on `[placeIndicator]`.
     - When `navRef.current` exists and `ResizeObserver` is defined, it observes the nav element and calls `placeIndicator(false)` on every resize.
     - Its cleanup disconnects the observer.
   - Add a two-line comment above `placeIndicator`: route changes animate the bar, and a resize or breakpoint change (244 px to 60 px sidebar) moves it at once, so it never points at the wrong item.
8. **Text colour token:** `site design/src/components/shell/AppShell.tsx` line 128 (anchor `text-[var(--bone)]`). Change the legacy token class to `text-[var(--color-text)]`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. In the browser at 1440 px on `/agent`, resize the window to 820 px. The red bar stays beside the dark AI Agent item at both widths. Save screenshots `gemini/shots/A4-sidebar-1440.png` and `gemini/shots/A4-sidebar-820.png`.
3. In the browser at 360 × 740 on `/library`, the header search box fits inside the screen. In the console, `document.documentElement.scrollWidth` equals `window.innerWidth`; paste both numbers.

**Acceptance criteria**
- [ ] All eight changes are made.
- [ ] At 820 px, the red bar's top equals the active item's top within 1 px. Paste the `getBoundingClientRect().top` of both elements, measured in the console.
- [ ] At 360 px there is no horizontal page scroll on `/library`.
- [ ] The build exits 0.

---

### Task A5 — Library: shared states, phone tables and honest status labels

- **Goal:** Move the Library page onto the shared frame, states and tags. Make its two tables scroll sideways on phones, and stop it from treating a failed page load as "empty text".
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `site design/src/pages/LibraryPage.tsx`
  - `site design/src/lib/reportLabels.ts`
  - `site design/src/context/UserContext.tsx` lines 6–12 (anchor `refreshUsers: () => Promise<void>;`)
  - `site design/src/components/ui/index.ts`
- **Files to create or modify:**
  - modify `site design/src/lib/reportLabels.ts`
  - modify `site design/src/pages/LibraryPage.tsx`

**What to change**
1. **New helper `reportStatus`:** at the end of `site design/src/lib/reportLabels.ts`, after `makeLabeler` (`site design/src/lib/reportLabels.ts` lines 34–45, anchor `export function makeLabeler`).
   - It takes an object with a report's `status` and returns a label plus a tone (`"done"`, `"failed"` or `"waiting"`):
     - `ready` gives "Indexed" with tone done;
     - `failed` gives "Failed" with tone failed;
     - any other status gives the stored status with its first letter in capitals, with tone waiting.
   - Add a one-line doc comment: "The status tag of a report row: Indexed, Failed, or the pipeline state exactly as stored."
   - This moves the inline logic now in `site design/src/pages/LibraryPage.tsx` lines 133–136 (anchor `r.status === "ready" ? { text: "Indexed"`) into a shared function.
2. **Imports:** `site design/src/pages/LibraryPage.tsx` line 6 (anchor `import { makeLabeler, sortReports } from "../lib/reportLabels";`).
   - Also import `reportStatus`.
   - Add an import of `PageFrame`, `PageState`, `PersonaState`, `Tag` and the type `TagTone` from `../components/ui`.
3. **Grid columns:** `site design/src/pages/LibraryPage.tsx` line 14 (anchor `5.5rem`). Widen the fourth column from `5.5rem` to `8rem`, so the longer status labels from step 4 fit on one line.
4. **`statusOf`:** `site design/src/pages/LibraryPage.tsx` lines 16–26 (anchor `function statusOf(r: MeasurementRow)`).
   - It returns `{ label, tone }` with a `TagTone` instead of `{ label, hot }`: `hot` becomes tone `hot`, and not-hot becomes tone `neutral`.
   - Keep the range logic and the LOW and HIGH flags exactly as they are.
   - Add one new case before the final "No range": when the uppercased lab flag is not empty and not `NORMAL`, return the label "Lab flag " followed by the flag in lower case, with tone `hot`. Today such a flag is silently shown as "No range".
   - Add a doc comment: "Status from the report's own printed range, else the lab's own flag. Never a judgement of ours."
5. **Persona context:** `site design/src/pages/LibraryPage.tsx` line 30 (anchor `const { user } = useActiveUser();`). Also read `loading` (as `personaLoading`) and `refreshUsers` from the context.
6. **Page-load failure:** `site design/src/pages/LibraryPage.tsx` line 40 (anchor `const [pages, setPages]`). Add a boolean state `pagesFailed`, starting false.
   - In the selected-report effect, `site design/src/pages/LibraryPage.tsx` lines 75–90 (anchor `setPages(null);`), reset it to false next to `setPages(null)`.
   - In `toggle`, `site design/src/pages/LibraryPage.tsx` lines 92–98 (anchor `const toggle = (testName: string) =>`):
     - Request the pages only when they are not loaded and `pagesFailed` is false.
     - On failure, set `pagesFailed` to true, instead of setting an empty page list. An empty list made a failed load look like a page with no text.
7. **States:** `site design/src/pages/LibraryPage.tsx` lines 100–123 (anchor `const pageStyle: React.CSSProperties`).
   - Delete `pageStyle` and `note`, then replace the early returns with four states, each inside `PageFrame` with label "Library":
     - **No persona:** `PersonaState`, with `loading` from the context and a retry that calls `refreshUsers`.
     - **Reports still loading:** `PageState` kind loading, title "Loading reports".
     - **Load error:** `PageState` kind error, title "Could not load reports", the error message as detail, and the action "Try again", which increments `tick`.
     - **No reports:** `PageState` kind empty, title "No reports yet", detail "Upload a report to see the values read from it.", and the action "Upload a report". It calls `transitionNavigate(navigate, "/upload", { direction: "back" })` exactly as the current button does.
   - Keep the condition order exactly as above, so a missing persona never shows "Loading reports" forever.
8. **Reports table:** `site design/src/pages/LibraryPage.tsx` lines 125–156 (anchor `data-testid="library-table"`).
   - The root `div` becomes `PageFrame` with label "Library".
   - Wrap the table in a `div` with class `vg-scroll-x`, and give the table an inline `minWidth` of 640.
   - Each row gets `tabIndex={0}` and selects its report on Enter or Space, calling `preventDefault` first.
   - The Description cell gets `overflowWrap: "anywhere"`.
   - The status cell renders `Tag` with the tone and label from `reportStatus`.
   - Keep these test IDs: `library-table`.
9. **Values section:** `site design/src/pages/LibraryPage.tsx` lines 164–173 (anchor `<span>Biomarker</span>`).
   - **While values load:** show `PageState` kind loading, title "Reading values", inside a `div` with top padding `var(--space-4)`.
   - **When there are no rows:**
     - If `rowsError` is set: `PageState` kind error, title "Could not read values", the error as detail, and the action "Try again", which increments `tick`.
     - Otherwise: `PageState` kind empty, title "No values were read from this report", detail "Its pages may hold text without test results, or the values could not be read."
   - **When there are rows:**
     - Render the grid header row and all value rows inside a `div` with class `vg-scroll-x`, which holds an inner `div` with `minWidth: 560`.
     - The header row's padding becomes `var(--space-2) var(--space-2)`.
10. **Status tag in each value row:** `site design/src/pages/LibraryPage.tsx` lines 226–233 (anchor `{st.label}`). Render `Tag` with `st.tone` and `st.label`.
11. **Opened passage:** `site design/src/pages/LibraryPage.tsx` lines 243–253 (anchor `Loading the page`). When `pagesFailed` is true, show "The page text could not be loaded." in place of the passage.
12. **Closing tag:** the root `div` closing at `site design/src/pages/LibraryPage.tsx` lines 259–263 (anchor `)}`) becomes `</PageFrame>`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser, both servers running, persona "Empty Test Persona":
   - Open `/library`. The table shows the persona's reports with Indexed tags.
   - Click a row, then a value. The passage opens with the value highlighted.
   - At 360 × 740, the reports table and the values grid scroll sideways inside their own boxes, and `document.documentElement.scrollWidth` equals `window.innerWidth`.
3. Stop the backend and reload `/library`. The page shows the offline persona state ("No persona available") with a "Try again" button.

**Acceptance criteria**
- [ ] `reportStatus` is exported from `lib/reportLabels.ts`, and the Library table uses it.
- [ ] Every loading, empty and error message on the page is a `PageState` (search the file: no `style={note}` remains).
- [ ] A flag such as `ABNORMAL` with no printed range shows "Lab flag abnormal", not "No range".
- [ ] At 360 px there is no page-level horizontal scroll on `/library`.
- [ ] The build exits 0.

---

### Task A6 — Compare: shared states, retry that really retries, phone layout

- **Goal:** Move the Compare page onto the shared frame and states. Make "Try again" reload the comparison as well, and stop the pickers and table from overflowing at 360 px.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `site design/src/pages/ComparePage.tsx`
  - `site design/src/components/ui/index.ts`
- **Files to create or modify:**
  - modify `site design/src/pages/ComparePage.tsx`

**What to change**
1. **Imports:** `site design/src/pages/ComparePage.tsx` line 6 (anchor `import { makeLabeler, sortReports } from "../lib/reportLabels";`). After this import, add an import of `PageFrame`, `PageState`, `PersonaState` and `Tag` from `../components/ui`.
2. **Persona context:** `site design/src/pages/ComparePage.tsx` line 35 (anchor `const { user } = useActiveUser();`). Also read `loading` (as `personaLoading`) and `refreshUsers`.
3. **Comparison effect:** `site design/src/pages/ComparePage.tsx` lines 73–85 (anchor `}, [userId, baselineId, followupId]);`).
   - Add `reloadTick` to the dependency list. Today "Try again" reloads only the report list, never the comparison.
   - Update the comment above the effect to "Load the comparison for the chosen pair (again after "Try again")".
4. **States:** `site design/src/pages/ComparePage.tsx` lines 99–126 (anchor `const pageStyle: React.CSSProperties`).
   - Delete `pageStyle` and `noteStyle`, and add a function `retry` that increments `reloadTick`.
   - Replace the early returns with these states, each inside `PageFrame` with label "Compare" and gap `var(--space-6)`:
     - **No persona:** `PersonaState`, as in task A5.
     - **Reports loading:** `PageState` loading, "Loading reports".
     - **Error while no reports are loaded:** `PageState` error, "Could not load reports", the error as detail, and the action "Try again" (`retry`).
     - **Fewer than two reports:** `PageState` empty, title "Comparing needs two reports", detail "This persona has N report(s). Upload another one to compare values." Write "report" when N is 1 and "reports" otherwise. The action is "Upload a report", using the same `transitionNavigate` call as today.
5. **Root element:** `site design/src/pages/ComparePage.tsx` line 132 (anchor `<div data-screen-label="Compare" style={pageStyle}>`). It becomes `PageFrame` with label "Compare" and gap `var(--space-6)`. Its closing tag at `site design/src/pages/ComparePage.tsx` line 214 (anchor `</div>`) becomes `</PageFrame>`.
6. **Report pickers:** `site design/src/pages/ComparePage.tsx` lines 151–158 (anchor `minWidth: 260`).
   - Both `field` boxes get `flex: "1 1 260px"` and `minWidth: "min(260px, 100%)"`, replacing the fixed `minWidth: 260`.
   - With this change the two pickers stack on a phone.
7. **Messages:** `site design/src/pages/ComparePage.tsx` lines 167–168 (anchor `Could not load the comparison`).
   - The comparison error becomes `PageState` error, title "Could not load the comparison", the error as detail, and the action "Try again" (`retry`).
   - The loading line becomes `PageState` loading, "Comparing".
8. **Comparison table:** `site design/src/pages/ComparePage.tsx` lines 170–212 (anchor `data-testid="compare-table"`).
   - Wrap the table in a `div` with class `vg-scroll-x`, and give the table an inline `minWidth` of 560.
   - The status cell renders `Tag`: tone `neutral` when there is no delta ("One report"), and tone `accent` otherwise.
   - Keep these test IDs: `compare-table`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser on `/compare` with "Empty Test Persona" (it has at least two reports): pick two reports, and the table fills in. At 360 × 740, the pickers stack, the table scrolls inside its box, and there is no page-level horizontal scroll.
3. Stop the backend, pick another pair, and the comparison error appears. Start the backend, click "Try again", and the table loads without a page reload.

**Acceptance criteria**
- [ ] `reloadTick` is in the comparison effect's dependency list.
- [ ] No `noteStyle` or `pageStyle` remains in the file.
- [ ] "Try again" after a comparison error reloads the comparison (step 3 of the checks).
- [ ] At 360 px there is no page-level horizontal scroll on `/compare`.
- [ ] The build exits 0.

---

### Task A7 — Insights: shared states and section heads, phone grid, "Uncertain" label

- **Goal:** Move Insights onto the shared frame, states and section heads. Fix the 340 px column minimum that overflows a phone, and show uncertainty nodes as "Uncertain".
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `site design/src/pages/InsightsPage.tsx`
  - `site design/src/components/ui/index.ts`
- **Files to create or modify:**
  - modify `site design/src/pages/InsightsPage.tsx`

**What to change**
1. **Imports:** `site design/src/pages/InsightsPage.tsx` line 5 (anchor `import { transitionNavigate } from "../motion/navigation";`). After this import, add an import of `PageFrame`, `PageState`, `PersonaState` and `SectionHead` from `../components/ui`.
2. **Uncertainty label:** `site design/src/pages/InsightsPage.tsx` lines 7–10 (anchor `uncertainty: "Uncertainty"`). Change the display name for the `uncertainty` node type to "Uncertain" (rule 4).
3. **Unused style:** `site design/src/pages/InsightsPage.tsx` lines 13–15 (anchor `const headStyle`). Delete `headStyle`, which is unused after step 6.
4. **Persona context:** `site design/src/pages/InsightsPage.tsx` line 19 (anchor `const { user } = useActiveUser();`). Also read `loading` (as `personaLoading`) and `refreshUsers`.
5. **States:** `site design/src/pages/InsightsPage.tsx` lines 64–85 (anchor `const pageStyle`).
   - Delete `pageStyle` and `noteStyle`, then replace the early returns with four states, each in `PageFrame` with label "Insights":
     - **No persona:** `PersonaState`.
     - **Loading:** `PageState` loading, "Loading the graph".
     - **Error:** `PageState` error, "Could not load the graph", the error as detail, and "Try again", which increments `tick`.
     - **Empty graph:** `PageState` empty, "No graph yet", detail "Upload a report and a graph is built for this persona.", and the action "Upload a report" using the existing `transitionNavigate` call.
6. **Body:** `site design/src/pages/InsightsPage.tsx` lines 87–131 (anchor `gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))"`).
   - The root becomes `PageFrame` with label "Insights".
   - Inside it, the grid is a plain `div` with `gridTemplateColumns: "repeat(auto-fit,minmax(min(340px,100%),1fr))"`, gap `var(--space-8)` and items aligned to the start.
   - Each of the three columns becomes a `section` whose heading is `SectionHead`, with the titles "Graph size", "Betweenness centrality" and "Edge types".
   - The edge-type rows also get `gap: "var(--space-3)"`, so long pair names never touch their counts.
   - Everything else (the rows, numbers and bars) stays exactly as it is.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser on `/insights` with "Empty Test Persona": three sections with the same counts as before the change. At 360 × 740 the sections stack into one column, with no page-level horizontal scroll.

**Acceptance criteria**
- [ ] The display name for `uncertainty` is "Uncertain".
- [ ] The column minimum is `min(340px,100%)`.
- [ ] The three section heads use `SectionHead`.
- [ ] The build exits 0.

---

### Task A8 — Settings: offline state with retry, phone-safe rows, and the persona delete action

- **Goal:** Show an offline state with retry when the backend is down, keep rows readable at 360 px, and move the "Delete persona" action here. Task A12 removes the old one from Timeline.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `site design/src/pages/SettingsPage.tsx`
  - `site design/src/api/users.ts`
  - `site design/src/pages/TimelinePage.tsx` lines 287–335 (anchor `const executeDeleteCascade = async () => {`), the delete flow being moved
  - `vitagraph/backend/app/routes/users.py` lines 32–39 (anchor `@router.delete("/{user_id}")`)
  - `vitagraph/backend/app/services/user_service.py` lines 90–118 (anchor `def delete_user(user_id: str) -> dict:`)
- **Files to create or modify:**
  - modify `site design/src/pages/SettingsPage.tsx`

**What to change**
1. **Imports:** `site design/src/pages/SettingsPage.tsx` lines 2–4 (anchor `import { aiApi, type AiConfig, type HealthInfo } from "../api/ai";`). Add imports of `usersApi` from `../api/users`, and `PageFrame` and `PageState` from `../components/ui`.
2. **`NoteRow`:** `site design/src/pages/SettingsPage.tsx` lines 75–90 (anchor `const NoteRow`).
   - The row gap becomes `var(--space-3) var(--space-6)`.
   - The description loses `textAlign: "right"` and gains `overflowWrap: "anywhere"`. Long values such as the user ID filter sentence then wrap on a phone instead of overflowing.
3. **Persona context:** `site design/src/pages/SettingsPage.tsx` line 93 (anchor `const { user } = useActiveUser();`). Also read `setUser` and `refreshUsers`.
4. **New state:** `site design/src/pages/SettingsPage.tsx` lines 97–99 (anchor `const [loadFailed, setLoadFailed] = useState(false);`). Add:
   - a number state `loadTick` (0);
   - a state `deleteStep`, one of `"idle"`, `"confirm"` or `"deleting"`, starting at `"idle"`;
   - a state `deleteError`, a string or null.
5. **Load effect:** `site design/src/pages/SettingsPage.tsx` lines 101–116 (anchor `Promise.all([aiApi.getConfig(), aiApi.getHealth()])`).
   - At the start, set `loadFailed` back to false, and remove the same call from inside the success handler.
   - The dependency list becomes `[loadTick]`, so "Try again" reloads.
6. **New function `deletePersona`:** after `changePrivacy` (`site design/src/pages/SettingsPage.tsx` lines 118–135, anchor `const changePrivacy = async`).
   - When no persona is active, do nothing.
   - Otherwise:
     1. Set `deleteStep` to `"deleting"` and clear `deleteError`.
     2. Call `usersApi.remove(user.id)`, which is `DELETE /api/users/{user_id}`.
     3. On success: call `setUser(null)` (this also forgets the saved ID), set `deleteStep` back to `"idle"`, and await `refreshUsers()`. `refreshUsers` then picks the first remaining persona, or creates a new empty one when none is left (`site design/src/context/UserContext.tsx` lines 27–51, anchor `const refreshUsers = async () => {`).
     4. On failure: store the error message, or "The persona could not be deleted.", in `deleteError`, and set `deleteStep` back to `"confirm"`.
7. **Root and offline state:** `site design/src/pages/SettingsPage.tsx` lines 155–165 (anchor `data-screen-label="Settings"`).
   - The root `div` becomes `PageFrame` with label "Settings", width narrow and gap `"0"`. The section heads keep their own spacing.
   - As the frame's first child, when `loadFailed` is true, render `PageState` kind offline:
     - title "Backend settings are not available";
     - detail "The backend did not answer. Settings stored in this browser still work.";
     - action "Try again", which increments `loadTick`.
8. **Persona section:** after the "Reduce motion" row (`site design/src/pages/SettingsPage.tsx` lines 192–201, anchor `testId="setting-reduce-motion"`), add a `Head` titled "Persona" and one row built like `OptionRow`'s layout, using `rowBox`, `rowTitle` and `rowDesc`, with `data-testid="setting-delete-persona"`.
   - **Title:** "Delete this persona".
   - **Description:** when a persona is active: "Removes <display label> (<id>) and its reports, pages, chunks, vectors, questions, answers, timeline, raw files and AI Agent folder." These are exactly the records that `user_service.delete_user` and the route delete; see open issue O-11 about `ai_calls`. When no persona is active: "No persona is active."
   - **Error:** when `deleteError` is set, show it below the description in a `role="alert"` line coloured `--color-accent-700`, weight 600.
   - **Buttons, when `deleteStep` is `"idle"`:** one `btn btn-secondary` button, "Delete persona", disabled when there is no persona. It sets `deleteStep` to `"confirm"`.
   - **Buttons otherwise:**
     - a `btn btn-primary` button with `data-testid="setting-delete-confirm"`, reading "Yes, delete everything", or "Deleting" while deleting. It is disabled while deleting and calls `deletePersona`.
     - a `btn btn-secondary` "Cancel" button, disabled while deleting, which sets `deleteStep` back to `"idle"`.
   - Close the frame with `</PageFrame>` (the closing tag at `site design/src/pages/SettingsPage.tsx` line 201, anchor `</div>`).
   - Keep these test IDs: `setting-cinematic`, `setting-chunk-size`, `setting-embedding`, `setting-privacy`, `setting-vector-filter`, `setting-reduce-motion`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser on `/settings`, both servers running: all six existing rows show, then the Persona section.
   - Create a throwaway persona first: `Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/users -ContentType 'application/json' -Body '{"display_label":"Delete Me"}'`.
   - Select it in the persona picker. On Settings, click "Delete persona", then "Yes, delete everything". The page switches to another persona, and `Invoke-RestMethod http://127.0.0.1:8000/api/users` no longer lists "Delete Me".
   - Never run this check with "Empty Test Persona" or any other persona that holds data.
3. Stop the backend and reload `/settings`. The offline state with "Try again" shows above the rows. Start the backend and click "Try again"; the state disappears.
4. At 360 × 740: no page-level horizontal scroll.

**Acceptance criteria**
- [ ] The offline `PageState` appears only when loading failed, and "Try again" reloads.
- [ ] Deleting a throwaway persona works from Settings, and the deleted persona is gone from `GET /api/users`.
- [ ] All six existing setting test IDs still exist, and the two new ones are spelled exactly `setting-delete-persona` and `setting-delete-confirm`.
- [ ] The build exits 0.

---

### Task A9 — Upload: no demo fallback, no invented report, "Uncertain" pages, shared states

- **Goal:** The Upload page shows only real data for the active persona. After a job it shows the stored report instead of an invented object, labels uncertain pages "Uncertain", and uses the shared frame, tags and section head.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `site design/src/pages/UploadPage.tsx`
  - `site design/src/hooks/useJobStream.ts` lines 17–30 (anchor `export interface UseJobStreamReturn`)
  - `site design/src/api/reports.ts` lines 64–73 (anchor `export interface DemoCohortResult`)
  - `vitagraph/backend/app/ingestion/extractor.py` lines 140–163 (anchor `method, quality = "native", "good"`)
  - `vitagraph/backend/app/services/report_service.py` lines 380–390 (anchor `ORDER BY r.upload_time DESC`)
- **Files to create or modify:**
  - modify `site design/src/pages/UploadPage.tsx`

**Facts this task relies on:**
- `GET /api/reports?user_id=` returns reports newest upload first (`ORDER BY r.upload_time DESC` in `report_service.py`).
- The extractor writes `extraction_method` as `native`, an OCR method such as `ocr-tesseract` or `ocr-rapid`, or `uncertain`. It writes `quality` as `good` or `uncertain`.
- `POST /api/demo/cohort` returns `user_id`, `display_label`, `reports_ingested`, `report_ids`, `nodes`, `edges`, `communities` and `modularity`.

**What to change**
1. **Imports:** `site design/src/pages/UploadPage.tsx` lines 1–10 (anchor `import { CinematicPipelinePopup, useToast } from "../components/gallery";`).
   - Import `CinematicPipelinePopup` directly from `../components/gallery/CinematicPipelinePopup`, and `useToast` from `../components/gallery/Toast`. The barrel `../components/gallery` would make the audit, and the bundle, pull in every old gallery component.
   - Add an import of `PageFrame`, `PersonaState`, `SectionHead`, `Tag` and the type `TagTone` from `../components/ui`.
2. **Module-level helpers**, placed above the component:
   - Move `fmtSize` up from inside the component (`site design/src/pages/UploadPage.tsx` lines 156–157, anchor `const fmtSize`).
   - Add `sourceTag(page)`, which returns a label and a tone:
     - `native` gives "Native text", tone neutral;
     - any method containing `ocr` gives "OCR", tone hot;
     - `uncertain` gives "Uncertain", tone uncertain;
     - anything else gives the stored text, tone neutral.
     
     Give it the doc comment "How a page was read. An uncertain page stays Uncertain (plan rule 4)."
   - Add `qualityTag(page)`: `uncertain` gives "Uncertain", tone uncertain. Anything else gives the stored text with its first letter in capitals, tone neutral.
   - Move the arrow icon `svg` from the "Ask about this report" button (`site design/src/pages/UploadPage.tsx` lines 339–342, anchor `<path d="M5 12h14" /><path d="m12 5 7 7-7 7" />`) into a module-level constant `arrowIcon`, and use it in the button.
3. **Persona and fallback:** `site design/src/pages/UploadPage.tsx` lines 14–15 (anchor `|| "VG-2026-001"`).
   - Read `user`, `loading` (as `personaLoading`) and `refreshUsers` from the context. `setUser` is no longer needed.
   - Replace `effectiveUserId`, which falls back to localStorage and then to the demo ID, with `userId = user?.id ?? null`.
   - Rename every later use of `effectiveUserId` in this file to `userId`.
   - Move the `dragOver` state up next to the other state (it sits at `site design/src/pages/UploadPage.tsx` line 154, anchor `const [dragOver, setDragOver] = useState(false);`).
4. **Job-finished effect:** `site design/src/pages/UploadPage.tsx` lines 30–67 (anchor `"verified_digest"`).
   - **On success**, when the job's `reportId` is a non-empty string and a persona is active:
     1. Load that report's pages with `reportsApi.pages` (an empty list on failure).
     2. Load `reportsApi.list(userId)`.
     3. Set the active report to the list entry whose `id` equals the job's report ID, or to null when it is not there.
     
     Delete the invented object entirely. It made up `file_hash` ("verified_digest"), `report_date` (today), `version` and `page_count`.
   - **On error:**
     - The quarantine reason is the stream's error, or "The report could not be processed." when the stream has none.
     - The toast is `addToast("failed", "Report quarantined", reason)`.
   - The dependency list uses `userId` instead of `effectiveUserId`.
5. **Demo cohort:** `site design/src/pages/UploadPage.tsx` lines 69–94 (anchor `const handleLoadDemoCohort = async () => {`).
   - After the cohort loads, write `res.user_id` to localStorage under `vitagraph_user_id`, then await `refreshUsers()`. `refreshUsers` selects the saved persona from the real list (`site design/src/context/UserContext.tsx` lines 27–51, anchor `const matched = list.find((u) => u.id === savedId) || list[0];`).
   - Delete the hand-built persona object, which invented `consent_accepted`, `created_at` and `status`.
   - The success toast is "Demo cohort loaded", with the detail "<reports_ingested> synthetic reports labelled demo data: <nodes> nodes, <edges> edges.". Today it hard-codes "2 synthetic panels".
   - The failure toast is "Demo cohort not loaded" with the error message.
   - The navigation to `/graph` stays.
6. **Initial load:** `site design/src/pages/UploadPage.tsx` lines 96–112 (anchor `// On initial mount, load existing report pages for the persona`). Replace it with an effect on `[userId]`:
   - Do nothing without a persona.
   - Otherwise clear the pages and the active report, then load `reportsApi.list(userId)`. When the list is not empty, make its first entry (the newest upload) active and load its pages.
   - Use a `cancelled` flag that the cleanup sets, and check it before every state update.
   - On failure, keep an empty page list. There is no `console` call anywhere.
7. **`handleFileSelect`:** `site design/src/pages/UploadPage.tsx` lines 114–152 (anchor `const handleFileSelect = async (selectedFile: File) => {`).
   - Return at once when there is no persona.
   - Upload with `userId`.
   - On a `failed` response and on a thrown error:
     - add the quarantine row as today;
     - show the toast "Report quarantined" with the reason (failed response) or "Upload rejected" with the error (thrown error);
     - call `jobStream.reset()`, so the stream from step 1 of the function is closed and its timers are cleared.
   - The thrown-error reason is the error message itself. Delete the invented "Security validation rejected file:" prefix.
   - Reword the three numbered comments to:
     1. "Subscribe to the job's event stream before the upload starts."
     2. "Open the full-screen show, unless "Cinematic ingestion" is off in Settings."
     3. "Send the file; the backend runs the pipeline in the background."
8. **Tags:** `site design/src/pages/UploadPage.tsx` lines 184–195 (anchor `const tagStyle = (kind:`).
   - Delete `tagStyle`. `fileTag` returns a `tone` (`failed`, `done`, `running`, `waiting`) instead of a `kind`.
   - After the `fileTag` line, add the persona gate: when `userId` is null, return `PersonaState` inside `PageFrame` with label "Upload".
9. **Root:** `site design/src/pages/UploadPage.tsx` lines 197–201 (anchor `data-screen-label="Upload"`) and the closing tag at line 395 (anchor `</div>`). The root becomes `PageFrame` with label "Upload".
10. **Left column:** `site design/src/pages/UploadPage.tsx` line 204 (anchor `flex: "0 0 320px"`). Change its flex to `0 1 320px` and add `minWidth: 0`, so it can shrink below 320 px on a phone.
11. **Tags in the left column:** `site design/src/pages/UploadPage.tsx` lines 262–316 (anchor `{fileTag.label}`).
    - The file tag, the quarantine tag and the stage tags all render `Tag` with the matching tone.
    - The pipeline list `div` at line 295 gets `data-testid="upload-pipeline"`.
    - The pipeline rows keep their current five entries in this task. Task C2 replaces them with the six real stages.
    - Keep these test IDs: `upload-dropzone`, `upload-file-input`, `upload-quarantine-row`.
12. **Pages section:** `site design/src/pages/UploadPage.tsx` lines 326–377 (anchor `{pages.length > 0 && (`).
    - The section becomes a `section` element whose heading is `SectionHead` titled "Pages", with the two existing buttons ("Ask about this report" and "Open library") in its `aside`, in a wrapping flex row with gap `var(--space-2)`.
    - The table sits inside a `div` with class `vg-scroll-x`. It gets `data-testid="upload-pages-table"` and an inline `minWidth` of 420.
    - The Source cell renders `Tag` from `sourceTag`, and the Quality cell renders `Tag` from `qualityTag`. Today "No text" replaces "Uncertain" (`site design/src/pages/UploadPage.tsx` line 366, anchor `"No text"`).
13. **Frame stage (decision DEC-3):** remove the right column, `site design/src/pages/UploadPage.tsx` lines 320–323 (anchor `<FrameStage />`). Also remove its import at line 9 (anchor `import { FrameStage } from "../components/upload/FrameStage";`).
    - The project has no frame images, so today the stage shows the developer text "Frames go in assets/frames…" (`site design/src/components/upload/FrameStage.tsx` line 187, anchor `Frames go in assets/frames`).
    - The left column then grows to fill the row: change its flex to `1 1 320px` and set its max width to 720 px.
    - Keep `FrameStage.tsx` in the repository, unused, so that supplying frames later only needs the column back.
14. **Popup:** keep the `CinematicPipelinePopup` block (`site design/src/pages/UploadPage.tsx` lines 379–394, anchor `<CinematicPipelinePopup`) unchanged, except that `userId={user?.id}` becomes `userId={userId ?? undefined}`. Task C3 replaces the popup.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. `Select-String -Path "site design\src\pages\UploadPage.tsx" -Pattern 'VG-2026|verified_digest|console\.|No text|FrameStage'` prints nothing.
3. Browser, both servers running, as "Empty Test Persona":
   - Upload `vitagraph/sample_data/VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf`.
   - After the job, the Pages table lists every page.
   - Each page's Source and Quality tags match `GET /api/reports/<report_id>/pages` exactly. Paste the JSON next to a screenshot; an `uncertain` page must read "Uncertain".
4. The file row's details match `GET /api/reports?user_id=usr_51f14542d71a` for the new report: same filename, and no invented hash or date anywhere.

**Acceptance criteria**
- [ ] No demo persona ID, no invented report object and no `console` call remain in the file.
- [ ] A page whose `extraction_method` or `quality` is `uncertain` is labelled "Uncertain" with the uncertain tone.
- [ ] A failed upload closes the job stream (`jobStream.reset()` is called on both failure paths).
- [ ] Keep these test IDs: `upload-dropzone`, `upload-file-input`, `upload-quarantine-row`.
- [ ] The new test IDs `upload-pipeline` and `upload-pages-table` exist.
- [ ] The build exits 0.

---

### Task A10 — AI Agent page: no demo fallback, real loading, empty and error states, phone gutters

- **Goal:** The AI Agent page never borrows the demo persona. It shows the shared persona, loading, empty and error states, and uses 16 px gutters on phones.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `site design/src/pages/AgentPage.tsx`
  - `site design/src/hooks/useAgentChat.ts`
  - `site design/src/components/ui/index.ts`
- **Files to create or modify:**
  - modify `site design/src/pages/AgentPage.tsx`

**What to change**
1. **Imports:** `site design/src/pages/AgentPage.tsx` line 11 (anchor `import { TrajectoryPanel } from "../components/agent/TrajectoryPanel";`). Add an import of `PageState` and `PersonaState` from `../components/ui`.
2. **Persona:** `site design/src/pages/AgentPage.tsx` lines 203–204 (anchor `|| "VG-2026-001"`).
   - Read `user`, `loading` (as `personaLoading`) and `refreshUsers`.
   - `effectiveUserId` becomes `user?.id ?? ""`: no localStorage fallback and no demo ID.
3. **Retry counter:** `site design/src/pages/AgentPage.tsx` line 212 (anchor `const [reportsState, setReportsState]`). Add a number state `reportsTick` (0) for retrying the report list.
4. **Report-list effect:** `site design/src/pages/AgentPage.tsx` lines 245–262 (anchor `// The persona's reports: they decide the empty state`).
   - Return at once when `effectiveUserId` is empty.
   - The dependency list becomes `[effectiveUserId, reportsTick]`.
5. **Scroll listener:** `site design/src/pages/AgentPage.tsx` lines 309–318 (anchor `// Follow the answer while the reader is at the bottom`). Change its dependency list from `[]` to `[effectiveUserId]`.
   - Without this, the listener never attaches. Step 6 returns early, without the chat column, while the persona is still loading. On that first render `bottomRef.current` is null, and an effect with `[]` would never run again.
6. **Persona gate:** after the last hook (`site design/src/pages/AgentPage.tsx` lines 320–323, anchor `useLayoutEffect(() => {`) and before `placeholder`, when `effectiveUserId` is empty, return:
   - a `div` with `data-screen-label="AI Agent"`, `data-testid="agent-page"`, class `vg-pad`, max width 960 px and auto side margins;
   - containing `PersonaState`, with `loading` from the context and a retry that calls `refreshUsers`.
   
   This early return is safe because it comes after every hook call.
7. **Composer placeholder:** `site design/src/pages/AgentPage.tsx` line 325 (anchor `const placeholder = composerReady`). It has three cases:
   - "Ask the AI Agent about a value, a trend or a report" when the composer is ready;
   - "Loading your reports" while the report list loads;
   - otherwise "Upload a report to start asking".
8. **Column gutters:** `site design/src/pages/AgentPage.tsx` lines 328–341 (anchor `padding: "var(--space-8) var(--space-8) var(--space-4)"`). The column `div` gets class `vg-gutter`. Its `padding` shorthand becomes `paddingTop: "var(--space-8)"` plus `paddingBottom: "var(--space-4)"`; the class supplies the side gutters.
9. **Empty states:** `site design/src/pages/AgentPage.tsx` lines 375–392 (anchor `data-testid="agent-empty"`). Inside `agent-empty`:
   - **Report list failed:** `PageState` kind error, title "Could not load your reports", detail "Check that the backend is running, then try again.", and the action "Try again", which increments `reportsTick`. This replaces "Cannot reach the backend … reload this page".
   - **Ready with no reports:** `PageState` kind empty, title "No reports yet", detail "Upload a report first, then ask about it here.", and the action "Upload a report", which navigates to `/upload`.
   - **Loading:** a new branch, `PageState` kind loading, "Loading your reports". Today the page shows the question prompt while it is still loading.
   - **Otherwise:** the existing "What would you like to know?" block, unchanged.
10. **Composer gutters:** `site design/src/pages/AgentPage.tsx` lines 449–462 (anchor `data-testid="agent-composer"`). The form gets class `vg-gutter`. Its `padding` shorthand becomes `paddingTop` and `paddingBottom` of `var(--space-4)`.
    - Keep these test IDs: `agent-page`, `agent-empty`, `agent-composer`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. `Select-String -Path "site design\src\pages\AgentPage.tsx" -Pattern 'VG-2026'` prints nothing.
3. Browser: `/agent` with "Empty Test Persona" shows "What would you like to know?". Then stop the backend and reload:
   - The persona state shows, because the persona list cannot load either.
   - Start the backend and click "Try again". The page recovers without a reload.
4. In the browser at 360 × 740, there is no page-level horizontal scroll.

**Acceptance criteria**
- [ ] No demo fallback remains.
- [ ] Loading, empty and error each use `PageState`, and the error has a working "Try again".
- [ ] The scroll-follow effect depends on `[effectiveUserId]`.
- [ ] The three listed test IDs still exist.
- [ ] The build exits 0.

---

### Task A11 — Toast restyled to the Modernist rules

- **Goal:** Restyle toasts to the Modernist design (no rounded corners, no old tokens) and place them above the 40 px status strip so they never cover it. Their behaviour does not change.
- **Tier:** Should
- **Size:** S
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `site design/src/components/gallery/Toast.tsx`
  - `site design/src/components/shell/StatusStrip.tsx` lines 96–102 (anchor `height: 40,`)
- **Files to create or modify:**
  - modify `site design/src/components/gallery/Toast.tsx`

**What to change**
1. **Keep all logic and exports unchanged:** `site design/src/components/gallery/Toast.tsx` lines 7–67 (anchor `export type ToastType = "done" | "failed" | "info";`). That covers the types, the context, `removeToast` with its exit and FLIP behaviour, `addToast` with its five-toast limit and 4-second dwell, and `useToast`.
2. **New colour map:** add a module-level map `RULE` from toast type to a top-rule colour: done `var(--color-text)`, failed `var(--color-accent)`, info `var(--color-neutral-500)`.
3. **Global hook:** `site design/src/components/gallery/Toast.tsx` lines 69–74 (anchor `(window as any).__VG_ADD_TOAST__ = addToast;`). Keep the window hook, but type it instead of using `any`: cast `window` to an object with an optional `__VG_ADD_TOAST__` whose type is `ToastContextValue["addToast"]`, in both the set and the delete.
4. **Container:** `site design/src/components/gallery/Toast.tsx` lines 80–84 (anchor `data-testid="toast-container"`).
   - Classes: `fixed z-50 flex flex-col gap-2 pointer-events-none`. Remove `bottom-6 right-6 max-w-sm`.
   - Inline style:
     - right `var(--space-4)`;
     - bottom `calc(40px + var(--space-4))`, above the status strip;
     - width `min(360px, calc(100vw - 2 * var(--space-4)))`.
   - Add the comment "Floating toasts sit above the 40 px status strip".
5. **Each toast:** `site design/src/components/gallery/Toast.tsx` lines 85–150 (anchor `const borderClass =`). Replace the markup:
   - **Attributes:**
     - `role="alert"` for failed toasts and `role="status"` otherwise;
     - keep `data-testid` as `toast-<id>`;
     - add `data-toast-type`;
     - keep the exit and enter animation classes `m-exit` and `animate-fade-in`.
   - **Box:** a flex row with gap `var(--space-3)` and padding `var(--space-3) var(--space-4)`, background `--color-bg`, a 2 px top rule in the type's `RULE` colour, and `box-shadow: var(--shadow-md)`. Toasts float, so a shadow is allowed. There is no radius and no left border.
   - **Title:** weight 800, 0.875rem, `--color-accent-700` for failed and `--color-text` otherwise, cut with an ellipsis. The timestamp sits on the right at 0.6875rem in `--color-neutral-700` with tabular numbers.
   - **Detail:** 0.8125rem in `--color-neutral-700`, with long words allowed to break.
   - **Dismiss button:** class `btn btn-ghost`, `aria-label="Dismiss notification"`, small padding, the same 14 px cross icon with `aria-hidden="true"`.
   - Delete the three coloured status icons, since the top rule now carries the meaning.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. `Select-String -Path "site design\src\components\gallery\Toast.tsx" -Pattern 'rounded|var\(--ink|var\(--bone|var\(--madder|as any'` prints nothing.
3. Browser: on `/upload`, upload a non-PDF file renamed to `.pdf`. The upload is rejected, and the toast appears above the status strip with a red top rule.

**Acceptance criteria**
- [ ] Toast behaviour is unchanged (same limit, dwell and dismiss).
- [ ] No old tokens and no rounding remain in the file.
- [ ] The toast does not cover the 40 px status strip.
- [ ] The build exits 0.

---

### Task A12 — Timeline rebuilt to the reference, with real values and the reference's isometric charts

- **Goal:** Replace the old Timeline with the reference layout: a report list on the left and one isometric bar chart per test that appears in at least two dated reports. The layout comes from screenshot `design/reference/screens/04_Timeline.png` and markup `design/reference/app-v3-source.html` lines 640–678.
- **Tier:** Must
- **Size:** L · hard
- **Review:** gate
- **Depends on:** A2, A5
- **Files to read first:**
  - `design/reference/app-v3-source.html` lines 640–678 (anchor `c.iso.floor`) and lines 1086–1114 (anchor `iso(bars, o) {`)
  - `design/reference/screens/04_Timeline.png`
  - `site design/src/pages/TimelinePage.tsx`
  - `site design/src/api/reports.ts` lines 16–31 (anchor `export interface TrendData`) and lines 75–89 (anchor `export interface MeasurementRow`)
  - `vitagraph/backend/app/services/report_service.py` lines 420–480 (anchor `def get_user_trends(user_id: str, test_name: str = "Hemoglobin") -> dict:`)
- **Files to create or modify:**
  - modify `site design/src/pages/TimelinePage.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`
- **Why the charts cannot trust the trends route as it is.** `get_user_trends` (the route `GET /api/reports/{user_id}/trends`) has three weak points, all visible in `vitagraph/backend/app/services/report_service.py` lines 420–480 (anchor `matches.sort(key=lambda m: m["date"])`):
  - It sorts points by the date *text*.
  - It matches tests by substring, so "Glucose" also matches "Fasting Glucose".
  - Its `trend_direction` calls any rise "improving".
- **So this page:**
  1. Places points by the report's parsed printed date (`parseReportDate` from `lib/reportLabels.ts`). Undated values are not placed on a time axis; they are counted in the caption.
  2. Keeps a point only when the same test name and value appear in that report's own measurements (`GET /api/reports/{report_id}/measurements`), with one value per report. Substring mix-ups are therefore dropped.
  3. Never shows `trend_direction`.
  4. Draws the reference band only from the range printed in the latest report.
  5. Colours the latest value red, as the reference does. Red means "latest", never "bad".
- **What leaves this page:**
  - "Delete persona" moved to Settings in task A8. The old flow is at `site design/src/pages/TimelinePage.tsx` lines 287–335 (anchor `const executeDeleteCascade = async () => {`).
  - The developer-only "upload second report" helper is dropped: `site design/src/pages/TimelinePage.tsx` line 385 (anchor `Simulation upload failed`).
  - The old evidence viewer is not used here: `site design/src/pages/TimelinePage.tsx` line 22 (anchor `import { EvidenceSpanViewer }`).
  - The old test IDs of this page are retired, for example `site design/src/pages/TimelinePage.tsx` line 545 (anchor `timeline-spine-container`) and line 1082 (anchor `timeline-delete-confirm-panel`). The motion-era scripts that use them are listed in open issue O-10.

**What to change**
1. **Replace the whole content of `site design/src/pages/TimelinePage.tsx`** (all 1214 lines, from `site design/src/pages/TimelinePage.tsx` line 28, anchor `export const TimelinePage: React.FC = () => {`). The new file still exports a component named `TimelinePage`. It is built from these parts.
   - **Imports:**
     - `reportsApi` and the types `MeasurementRow` and `TrendData` from `../api/reports`;
     - `graphApi` from `../api/graph`;
     - `useActiveUser`;
     - `transitionNavigate`;
     - `parseReportDate`, `reportStatus` and `sortReports` from `../lib/reportLabels`;
     - `PageFrame`, `PageState`, `PersonaState` and `Tag` from `../components/ui`;
     - the type `Report`.
   - **Constants:** `MAX_TESTS` = 6 and `MAX_POINTS` = 5.
   - **Helpers:**
     - a `kicker` text style: 0.6875rem, weight 800, letter-spacing 0.1em, uppercase, `--color-neutral-700`;
     - `shortDate(date)`, giving "Mon YYYY" in UTC;
     - `fmtValue(number)`, with at most two decimals in `en-US`.
   - **`iso(bars, options)`** is a typed TypeScript port of the reference function at `design/reference/app-v3-source.html` lines 1086–1114 (anchor `iso(bars, o) {`).
     - Keep the same constants: c 0.866, LX 260, LY 70, LZ 120, ox 100, oy 135, bar width and depth 34.
     - Keep the same projection and the same polygons: floor, back wall, left wall, band back, band left, seven grid lines, and top, front and right faces per bar.
     - Each label carries its own inline position style instead of a CSS string.
     - The band and its two labels are drawn only when both a low and a high value exist.
     - Bar fills: the latest bar uses `--color-accent-400` (top), `--color-accent` (front) and `--color-accent-700` (right). Other bars use `--color-neutral-400`, `--color-neutral-700` and `--color-neutral-900`.
   - **`datedPoints(trend, reportsById)`:**
     - Keep a trend point only when its `report_id` names a known report with a parsed printed date. Count the undated ones.
     - Sort by date, oldest first, and keep the last `MAX_POINTS`.
   - **`spread(dates)`:** time-proportional positions from 0 to 1, pushed apart so that consecutive bars are at least 0.22 apart, then rescaled to fit within 1.
   - **`niceMax(value)`:** round up to two significant digits, with 1 when the value is 0 or less.
   - **`buildChart(test, unit, points, latestRow, undated)`:**
     - The range comes only from the latest report's row (`range_low`, `range_high`, `reference_range`).
     - The axis maximum is 1.25 × the largest value, raised to 1.1 × the range low when needed, then passed through `niceMax`.
     - The headline is "first → latest".
     - The caption joins these sentences, leaving out the empty ones:
       - "Reference <range>, as printed in the latest report." or "No reference range printed in the latest report.";
       - "<n> reports, <first date> to <last date>.";
       - "Axis cut at <max>." when the range high is above the axis maximum;
       - "<n> undated value(s) not shown."
   - **The component:**
     - **Persona:** read `user`, `loading` and `refreshUsers`.
     - **Reports effect,** on `[userId, tick]`: load `reportsApi.list` and keep it sorted with `sortReports`.
     - **Charts effect,** on `[userId, reports, chartTick]`:
       1. With no reports, there are no charts.
       2. Otherwise load `graphApi.getGraph(userId)`. Take the `test` nodes sorted by betweenness, highest first, keep the unique `test_name` (or the label when it is missing), and cap the list at `MAX_TESTS`.
       3. For each test, load `reportsApi.trends(userId, test)`. Skip it when the call fails or when the returned `test_name` differs from the requested one, ignoring case; that is a substring match.
       4. Keep only the points that the report's own measurements confirm: same test name ignoring case, and same value. Cache one measurements request per report, treating a failed request as no rows.
       5. Skip the test when fewer than two points remain, or when one report gives two values.
       6. Use a `cancelled` flag in the cleanup.
     - **States,** in this order, each in `PageFrame` with label "Timeline":
       - no persona: `PersonaState`;
       - reports loading: `PageState` loading, "Loading reports";
       - reports error: `PageState` error, "Could not load reports", with "Try again" (increments `tick`);
       - no reports: `PageState` empty, "No reports yet", detail "Upload reports to see their values over time.", action "Upload a report" (the existing `transitionNavigate` call to `/upload`, direction back).
     - **Layout,** when reports exist:
       - A root `div` with `data-screen-label="Timeline"` and `data-testid="timeline-page"`, a wrapping flex row, full height.
       - **Left column:** class `vg-pad`, flex `0 1 380px`, min width 0, a 2 px right rule. It holds the kicker "Reports", then one row per report with `data-testid="timeline-report-row"`:
         - the printed date as "Mon YYYY" (or "Undated") at 1.375rem, weight 800;
         - the filename in small `--color-neutral-700`, with long words allowed to break;
         - a `Tag` from `reportStatus`.
       - **Right column:** flex `1 1 560px`, min width 0, a grid of `repeat(auto-fit,minmax(min(300px,100%),1fr))`. It shows one of:
         - **Charts error:** `PageState` error, "Could not read values over time", with "Try again" (increments `chartTick`), in a `vg-pad` box.
         - **Charts loading:** `PageState` loading, "Reading values across your reports".
         - **No chart:** `PageState` empty, "No test appears in two dated reports yet", detail "A chart needs the same test, with a value its report confirms, in at least two reports that print a date."
         - **Otherwise,** one cell per chart with `data-testid="timeline-chart"`, 2 px right and bottom rules, containing:
           - the kicker "<test> · <unit>";
           - the headline at 2rem, weight 800, tabular numbers;
           - the caption;
           - an `svg` with viewBox `0 0 400 320`, `role="img"` and an `aria-label` listing every value with its date, with the labels absolutely positioned over it.
       - Every colour comes from tokens.
2. **Own layout:** `site design/src/components/shell/AppShell.tsx` line 31 (anchor `const OWN_LAYOUT = new Set<string>(`). Add `"/timeline"` to the set, because the page now draws its own two-column layout.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Live, as persona `usr_51f14542d71a`, which holds the two dated synthetic panels:
   - Each report row's date equals the printed `report_date` from `GET /api/reports?user_id=usr_51f14542d71a`, shown as "Mon YYYY", or "Undated" when that field is empty.
   - For each chart, open `GET /api/reports/<report_id>/measurements` for both of its reports and paste the test's values next to the chart's headline numbers.
3. A persona with exactly one report shows "No test appears in two dated reports yet".
4. A persona with no reports shows the empty state with "Upload a report".
5. Stop the backend after the report list has loaded, then reload. The error state shows, and "Try again" works.
6. At 360 px there is no horizontal page scroll, and the charts stack under the report list.
7. Compare with `design/reference/screens/04_Timeline.png` and save `gemini/shots/A12-timeline-1440.png`. The layout matches: a 380 px list with 2 px rules, and charts in a grid with 2 px rules.

**Acceptance criteria**
- [ ] `/timeline` is in `OWN_LAYOUT`, and the page exports `TimelinePage`.
- [ ] Every number on screen is traced to an API response (pasted).
- [ ] The no-reports, one-report, loading and error states were each seen.
- [ ] `Select-String -Path "site design\src\pages\TimelinePage.tsx" -Pattern 'trend_direction|VG-2026|var\(--ink|console\.'` prints nothing.
- [ ] There is no page scroll at 360 px.
- [ ] The build exits 0.

---

### Task A13 — Layout check script and the end-of-A gate

- **Goal:** Add two re-runnable browser scripts. One checks every route at 360, 820 and 1440 px for horizontal overflow and console errors. The other checks accessibility (axe-core), keyboard focus and reduced motion. Then run the end-of-A gate: the design audit and both scripts must pass.
- **Tier:** Must
- **Size:** M
- **Review:** gate
- **Depends on:** A1, A3, A4, A5, A6, A7, A8, A9, A10, A11, A12
- **Files to read first:**
  - `gemini/TASK_AG4_agent_page.md` lines 692–700 (anchor `from playwright.sync_api import sync_playwright`), the existing Playwright style
  - `site design/src/components/shell/AppShell.tsx` line 70 (anchor `sessionStorage.getItem("vg_booted")`), the key that skips the boot animation
- **Files to create or modify:**
  - create `scripts/plan/check_layout.py`
  - create `scripts/plan/check_a11y.py`
  - modify `site design/package.json`
  - modify `site design/package-lock.json`

**What to change**
1. **Create `scripts/plan/check_layout.py`**, a Python script using Playwright's sync API:
   - **Command line:** `check_layout.py <persona_id> [route ...]`. Without routes it checks `/upload`, `/library`, `/agent`, `/graph`, `/timeline`, `/compare`, `/insights` and `/settings`. With no persona ID it prints a usage line and exits 2.
   - **Browser:** start Chrome with `p.chromium.launch(channel="chrome")`.
   - **Viewports:** check three, in this order: 360 × 740, 820 × 1100 and 1440 × 900.
   - **Context setup:** for each viewport, open a new browser context with an init script that sets localStorage `vitagraph_user_id` to the persona and sessionStorage `vg_booted` to `1`.
   - **Error capture:** record console messages of type error and uncaught page errors. Ignore messages that contain `net::ERR`.
   - **Per route:**
     1. Open `http://localhost:5173<route>` and wait 3 seconds.
     2. Measure `document.documentElement.scrollWidth` against `window.innerWidth`, and the `main#main-content` element's `scrollWidth` against its `clientWidth`, allowing 1 px.
     3. A route passes only when neither overflows and there are no console errors.
     4. Print one line: `OK` or `FAIL`, the width, the route, both measurements and the console error count, plus up to three error texts.
     5. At 360 and 1440 px, save a screenshot to `gemini/shots/layout-<width><route with / replaced by ->.png`.
   - **Result:** end with exactly one line `RESULT: PASS`, or `RESULT: FAIL (<number of failed checks>)`. Exit 0 only on PASS.
2. **Install axe-core:** in `site design`, run `npm install -D axe-core@4.13.0 --save-exact`. Rule 10 allows exactly this version, and it changes only `package.json` and `package-lock.json`.
3. **Create `scripts/plan/check_a11y.py`**, with the same command line, browser start and persona setup as `check_layout.py`, at 1440 × 900. For each route it runs three checks:
   - **Accessibility:**
     - Inject `site design/node_modules/axe-core/axe.min.js` with `page.add_script_tag(path=…)`.
     - Run `axe.run` limited to the tags `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa`.
     - The route fails on any violation with impact `serious` or `critical`. Print each one's rule ID, impact, node count and first target selector.
   - **Keyboard focus:**
     1. Press Tab up to 40 times. After each press, read `document.activeElement`.
     2. It must not be `body` after the first press.
     3. It must be visible: its bounding box is inside the viewport after it scrolls into view.
     4. It must show a focus indicator: a computed `outline-style` other than `none` with a width of 1 px or more, or a `box-shadow` other than `none`.
     5. Stop when focus returns to an element already visited. Print the number of tab stops.
   - **Reduced motion:**
     1. Open a second context with Playwright's `reduced_motion="reduce"`, then load the route.
     2. After 1.5 s, the number of running animations, from `document.getAnimations()` filtered on `playState === "running"`, must be 0.
     3. On `/graph` (after B8), `window.__VG_GRAPH_ROTATION__` must not change over 2 s.
   
   End with `RESULT: PASS` or `RESULT: FAIL (...)`, and exit 0 only on PASS.

**How to verify**
1. `cd "site design"; npm run audit:design`. It **exits 0**. The only findings left are `pending` lines for `pages/KnowledgeGraphPage.tsx` and `components/gallery/CinematicPipelinePopup.tsx`, which tasks B8 and C3 replace. Paste the last line. The planner's dry run of the A1 specification on the tree after A1–A12 gave `Checked 40 files: 0 error(s), 53 pending.`
2. `cd "site design"; npm run build`. It must exit 0.
3. With both servers running, from the repository root: `$env:PYTHONIOENCODING="utf-8"; python scripts\plan\check_layout.py usr_51f14542d71a /upload /library /agent /timeline /compare /insights /settings`. It ends with `RESULT: PASS`. `/graph` is checked again after workstream B.
4. `python scripts\plan\check_a11y.py usr_51f14542d71a /upload /library /agent /timeline /compare /insights /settings`. It ends with `RESULT: PASS`.
   - If axe reports serious or critical violations, fix them in the page they name. That fix is part of this gate task.
   - List every fix in report section 4.

**Acceptance criteria**
- [ ] `npm run audit:design` exits 0, and its pending lines name only the two files above.
- [ ] `check_layout.py` prints `RESULT: PASS` for the seven routes (output pasted).
- [ ] `check_a11y.py` prints `RESULT: PASS` for the seven routes: no serious or critical axe violations, visible focus on every tab stop, and no running animation under reduced motion (output pasted).
- [ ] `axe-core` is a dev dependency at exactly 4.13.0, and no other package changed.
- [ ] Screenshots `gemini/shots/layout-360-*.png` and `gemini/shots/layout-1440-*.png` are committed.
- [ ] The build exits 0.

## 9. Workstream C: End-to-end reliability

What C delivers: the whole journey works without gaps. It runs from an uploaded PDF, through the six ingestion stages shown live from real events, to the graph, to the AI Agent, to a cited answer. The refusal path, the no-evidence path and backend-offline states are handled too. A re-runnable script proves it.

Findings from the analysis that C fixes, with the evidence:
- **Named job events are never heard.**
  - The broker writes `event: <name>` lines for `page_extracted`, `completed` and `error`: `vitagraph/backend/app/services/job_service.py` lines 170–175 (anchor `prefix = f"event: {evt_type}\n" if evt_type else ""`).
  - `useJobStream` listens only through `onmessage` and `onerror`: `site design/src/hooks/useJobStream.ts` lines 268–284 (anchor `es.onmessage = (e) => {`).
  - So per-page events are lost. Success and failure arrive only through the 1.5 s polling fallback after the socket closes: `site design/src/hooks/useJobStream.ts` lines 300–343 (anchor `const recover = (attempt: number) => {`).
- **Invented stage values.**
  - The hook writes fixed labels ("ChromaDB ok", "NetworkX mapped", "384-dim", "verified") instead of event data: `site design/src/hooks/useJobStream.ts` lines 148–177 (anchor `value: "ChromaDB ok"`).
  - It falls back to "1 pages" and "1 chunks": `site design/src/hooks/useJobStream.ts` lines 179–180 (anchor `evt.metadata?.report?.page_count || 1`).
  - The popup shows invented section names during chunking: `site design/src/components/gallery/CinematicPipelinePopup.tsx` lines 297–310 (anchor `§ 1. Diagnostic Panel`).
  - The popup shows a fixed failure sentence, whatever the real error is: `site design/src/components/gallery/CinematicPipelinePopup.tsx` lines 278–285 (anchor `Corrupted document, missing text layer, or schema violation`).
- **Five rows for six stages.** The Upload page lists five rows, "Parse digital text" to "Index, scoped to user", with no Received or Graphed row: `site design/src/pages/UploadPage.tsx` lines 171–182 (anchor `const pipeRows`).
- **Latencies that were not measured.**
  - "embedded" and "indexed" each report half of one combined measurement: `vitagraph/backend/app/services/report_service.py` lines 177–191 (anchor `latency_ms=max(10, lat_idx // 2),`).
  - "graphed" always reports 10 ms, although building the graph payload takes real time: `vitagraph/backend/app/services/report_service.py` lines 209–217 (anchor `latency_ms=10,`).
- **Offline answers carry an AI caveat.** Evidence-only answers (`ai_status` `not_used`, set in `vitagraph/backend/app/services/chat_service.py` lines 252–255, anchor `Evidence-only mode: the AI was not called.`) still say "The AI Agent can misread a table or a scan": `site design/src/components/agent/EvidenceModules.tsx` lines 25–27 (anchor `The AI Agent can misread a table or a scan`).
- **Offline status stays in the shell.** `AppShell` knows when the backend is offline (`site design/src/components/shell/AppShell.tsx` line 38, anchor `const [backendOnline, setBackendOnline] = useState(true);`). It passes this only to `Header` and `StatusStrip`, so the Upload and AI Agent pages still let a person start an upload or a question that must fail.

---

### Task C1 — Job stream hears named events and shows only real stage values

- **Goal:** `useJobStream` receives `page_extracted`, `completed` and `error` the moment they are sent, and fills each stage's value only from event data.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `site design/src/hooks/useJobStream.ts`
  - `vitagraph/backend/app/services/job_service.py` lines 59–201 (anchor `def publish_event(`)
  - `vitagraph/backend/app/services/report_service.py` lines 28–262 (anchor `def process_upload(`)
- **Files to create or modify:**
  - modify `site design/src/hooks/useJobStream.ts`

**What to change**
1. **Shared parser:** `site design/src/hooks/useJobStream.ts` lines 268–284 (anchor `es.onmessage = (e) => {`).
   - Move the body of `onmessage` into a local function `handleData(raw: string)`. It parses the JSON, marks the stream done for `stage === "done"` and for status completed, error or failed, pushes the event onto the queue, and starts the queue when it is idle.
   - `onmessage` calls `handleData(e.data)`.
   - Register `es.addEventListener("page_extracted", …)` and `es.addEventListener("completed", …)`, each calling `handleData` with the event's `data`.
2. **Named "error" event:** `site design/src/hooks/useJobStream.ts` lines 345–356 (anchor `es.onerror = () => {`). A broker event named `error` reaches `onerror` as a `MessageEvent` that carries `data`. A dropped connection reaches it as a plain `Event` without data.
   - Give the handler an event parameter.
   - When the event is a `MessageEvent` whose `data` is a non-empty string, call `handleData` with it and return.
   - Otherwise keep today's recovery logic unchanged.
3. **Per-page progress:** in `processQueue`, `site design/src/hooks/useJobStream.ts` lines 145–177 (anchor `if (evt.stage) {`), handle stage `extracting` (the `page_extracted` events). While Extracted is active, set its value to "page <page_number> of <total_pages>" from the event metadata.
4. **Real stage values:** `site design/src/hooks/useJobStream.ts` lines 148–177 (anchor `value: "ChromaDB ok"`). Every value now comes from the event that finished the stage:
   - **Received:** the event's `latency` (or "stored" when it is empty).
   - **Extracted:** "<page_count> pages" from metadata.
   - **Chunked:** "<total_chunks> chunks".
   - **Embedded:** "<count> vectors, <dim> dimensions".
   - **Indexed:** "<indexed> indexed".
   - **Graphed:** "<total_nodes> nodes, <total_edges> edges". When graphed metadata carries `error`, show "graph not built" instead.
   - A running stage shows "running".
   - Delete "verified", "parsing layout…", "ChromaDB ok", "NetworkX mapped" and "384-dim".
   - Keep the order and the six names of `INITIAL_STEPS`.
5. **Done event:** `site design/src/hooks/useJobStream.ts` lines 178–208 (anchor `const pageCount = evt.metadata?.pages`).
   - Remove the `|| 1` fallbacks. Page and chunk counts are taken from the metadata, or stay `null` when missing.
   - The final step list keeps each stage's value as already set by step 4, and only marks all six as done.
   - The `finalMetadata` keys `pages`, `chunks` and `reportId` keep their names. `UploadPage` reads `reportId`.
6. **Event type:** `site design/src/hooks/useJobStream.ts` lines 5–13 (anchor `export interface JobStreamEvent`). Replace `Record<string, any>` with `Record<string, unknown>`. Narrow values where they are read: numbers with `typeof … === "number"`, strings with `typeof … === "string"`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser, both servers running: upload `vitagraph/sample_data/synthetic_panel_2025-01-15.pdf` with Cinematic ingestion off (Settings).
   - The Extracted row counts pages while it runs.
   - The stream finishes without a 1.5 s pause after Graphed. In DevTools > Network, the `/api/jobs/<id>/result` request must **not** appear.
3. Upload a text file renamed to `bad.pdf`. The failure shows the backend's real message ("Ingestion failed: The file could not be read as a PDF …") at once, again with no `/result` request.

**Acceptance criteria**
- [ ] `page_extracted`, `completed` and named `error` events are handled, and no `/result` polling happens on a healthy stream.
- [ ] `Select-String -Path "site design\src\hooks\useJobStream.ts" -Pattern 'ChromaDB ok|NetworkX mapped|384-dim|\|\| 1\b|Record<string, any>'` prints nothing.
- [ ] The build exits 0.

---

### Task C2 — Upload page lists exactly the six stages, each with its real output

- **Goal:** The Upload page shows the six pipeline stages (Received, Extracted, Chunked, Embedded, Indexed, Graphed), each with the output of its real event. Asking is a button after the stages, never a seventh stage.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** A9, C1
- **Files to read first:**
  - `site design/src/pages/UploadPage.tsx`
  - `site design/src/hooks/useJobStream.ts`
  - `vitagraph/backend/app/services/report_service.py` lines 277–355 (anchor `def _chunk_payload(`)
- **Files to create or modify:**
  - create `site design/src/components/upload/stages.ts`
  - modify `site design/src/pages/UploadPage.tsx`

**What to change**
1. **Create `site design/src/components/upload/stages.ts`.** It exports:
   - **`STAGES`:** a read-only list of six entries, in order. Each entry has:
     - `key`, the backend stage name: `received`, `extracted`, `chunked`, `embedded`, `indexed` or `graphed`;
     - `name`, the title-case label: Received, Extracted, Chunked, Embedded, Indexed, Graphed. These equal the names in `INITIAL_STEPS`.
     - `what`, one plain sentence:
       - Received: "The file is stored unchanged and its SHA-256 fingerprint is taken."
       - Extracted: "Text is read from every page, with OCR for scanned pages."
       - Chunked: "The text is cut into passages that keep their page and character positions."
       - Embedded: "Each passage becomes a vector for meaning-based search."
       - Indexed: "The vectors are stored for this persona only."
       - Graphed: "Reports, tests and values are linked in the knowledge graph."
   - **Type `StageState`:** `"waiting"`, `"running"`, `"done"` or `"failed"`.
   - **`stageState(stream, key)`:** derives the state from `stream.steps` (`pending` gives waiting, `active` running, `done` done). A stage the hook marked `quarantined` or `interrupted` while the stream status is `error` gives failed. This is the same rule as today's `stepStopped` at `site design/src/pages/UploadPage.tsx` lines 166–169 (anchor `const stepStopped = (stepName: string) => {`).
   - **`stageEvent(stream, key)`:** returns the last event in `stream.events` whose `stage` equals the key, or null.
   - **`stageOutput(stream, key)`:** the one-line real output of a finished stage, or null while it is not done. All values come from that stage's event metadata:
     - received: "SHA-256 <first 8>…<last 4>, version <version>";
     - extracted: "<page_count> pages, <n> with a text layer, <m> read by OCR, <u> uncertain", counted from `metadata.pages[].method` and `quality`;
     - chunked: "<total_chunks> passages";
     - embedded: "<count> vectors, <dim> dimensions";
     - indexed: "<indexed> passages indexed for this persona";
     - graphed: "<total_nodes> nodes, <total_edges> edges", or the metadata `error` text.
2. **Remove the five-row model:** `site design/src/pages/UploadPage.tsx` lines 164–182 (anchor `const pipeRows`).
   - Delete `stepStatus`, `stepStopped` and `pipeRows`.
   - Delete `nativePagesCount`, `ocrPagesCount` and `totalChunks` (lines 159–161, anchor `const nativePagesCount`) when nothing else uses them.
3. **Six rows:** `site design/src/pages/UploadPage.tsx` lines 295–317 (anchor `{pipeRows.map((r, i) => {`). Inside the `upload-pipeline` container (task A9), render one row per entry of `STAGES`, in the same grid layout as today (number, text, tag). Each row:
   - has `data-testid="upload-stage-row"` and `data-state` set to the stage state;
   - shows the two-digit number, the stage name in bold, and below it `stageOutput` when the stage is done or `what` otherwise;
   - shows a `Tag`: done gives "Done" (tone done), running "Running" (running), failed "Failed" (failed), waiting "Waiting" (waiting).
4. **Ask after the stages:** after the six rows, when the stream status is `completed` and a report ID is known, show a `btn btn-primary` button "Ask about this report" with `data-testid="upload-ask"`. It navigates exactly like the existing "Ask about this report" button (`/agent?report=<id>`). It is a button, not a row.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser: upload `synthetic_panel_2025-06-20.pdf` with Cinematic ingestion off.
   - Six rows run in order.
   - Each finished row shows numbers that equal the values in the job's events. Read them from `GET /api/jobs/<job_id>` (the `events` list) and paste them.
   - "Ask about this report" appears after Graphed.
3. In the console, `document.querySelectorAll('[data-testid="upload-stage-row"]').length` returns 6.

**Acceptance criteria**
- [ ] Exactly six stage rows exist, named exactly Received, Extracted, Chunked, Embedded, Indexed and Graphed.
- [ ] Every number in a row equals the matching event's metadata (pasted).
- [ ] "Ask about this report" is a button (`upload-ask`), not a stage.
- [ ] The build exits 0.

---

### Task C3 — The ingestion show: a full-screen live view built only from real events

- **Goal:** Replace the old `CinematicPipelinePopup` on the Upload page with a Modernist full-screen view. It shows the six stages and the real payload of each stage as it arrives, and ends with "Ask about this report".
- **Tier:** Must
- **Size:** L · hard
- **Review:** gate
- **Depends on:** C2
- **Files to read first:**
  - `site design/src/components/gallery/CinematicPipelinePopup.tsx` lines 26–80 (anchor `export const CinematicPipelinePopup: React.FC<CinematicPipelinePopupProps>`)
  - `site design/src/components/upload/stages.ts`
  - `site design/src/pages/UploadPage.tsx`
  - `vitagraph/backend/app/services/report_service.py` lines 91–109 (anchor `event_type="page_extracted",`)
- **Files to create or modify:**
  - create `site design/src/components/upload/IngestionShow.tsx`
  - modify `site design/src/pages/UploadPage.tsx`
  - modify `site design/scripts/audit-design.mjs`

**What to change**
1. **Create `site design/src/components/upload/IngestionShow.tsx`**, exporting `IngestionShow`.
   - **Props:**
     - `isOpen`;
     - `filename`;
     - `jobStream` (the hook's return type);
     - `onClose`;
     - `onAsk` (receives the report ID);
     - `onOpenLibrary`.
   - **Rendering:** render nothing when it is closed. When open, render into `document.body` through a portal:
     - a fixed full-screen `div` with `role="dialog"`, `aria-modal="true"` and `aria-labelledby` pointing at its heading;
     - `data-testid="ingestion-show"`;
     - background `--color-bg` and text `--color-text`.
   - **Header row:**
     - the kicker "Ingesting";
     - the filename as an `h2` (1.5rem, weight 800, long names allowed to break);
     - on the right, a `btn btn-ghost` "Close" button.
   - **Body:** two columns that stack below 820 px.
     - **Left column:** the six `STAGES` as a numbered list. Each item has `data-testid="ingestion-stage-<n>"` (n from 1 to 6), `data-state` set to the stage state, the name, the `what` sentence or the real output (as in C2), and a `Tag`. The running stage gets a 4 px left rule in `--color-accent`.
     - **Right column:** a "Live" panel showing the payload of the latest real event only:
       - **while extracting:** for each `page_extracted` event received so far, a row with the page number, the method, the character count and a `Tag` for the quality ("Uncertain" in the uncertain tone when it is `uncertain`), plus the newest page's `text_preview` (up to 240 characters, pre-wrapped);
       - **chunked:** the first passages from `metadata.chunks` (page, character span, preview);
       - **embedded:** the vector count and dimension. When `samples` exist, the first sample's values are shown as a row of numbers with three decimals, labelled "First 8 of <dim> values";
       - **indexed:** the indexed count and the collection total, when the metadata has them;
       - **graphed:** the node and edge counts, and up to 12 node labels from `metadata.nodes`.
       
       Nothing is drawn for a stage until its event has arrived.
   - **Failure:** when the stream status is `error`, a `PageState` kind error with the title "Ingestion stopped" and the stream's real `error` text as detail. There is no fixed sentence.
   - **Completion:** when the stream is completed, a footer row with:
     - a `btn btn-primary` "Ask about this report" (`data-testid="ingestion-ask"`), which calls `onAsk(reportId)`;
     - a `btn btn-secondary` "Open library", which calls `onOpenLibrary`.
   - **Behaviour:**
     - Escape calls `onClose`.
     - On open, focus moves to the dialog heading. On close, focus returns to the element that had it before.
     - Remove the keydown listener on close and on unmount.
     - No animation runs while Reduce motion is on (`usePreferences().reduceMotion`) or while the user's system prefers reduced motion.
     - Only design tokens are used: no hex, no radius, no blur.
2. **Swap the popup:** in `site design/src/pages/UploadPage.tsx`, replace the `CinematicPipelinePopup` import (task A9) and its element (`site design/src/pages/UploadPage.tsx` lines 379–394, anchor `<CinematicPipelinePopup`) with `IngestionShow`. Give it:
   - `isOpen` from the same state;
   - `filename` from the selected file, or "Report";
   - `onAsk` navigating to `/agent?report=<id>` with the existing `transitionNavigate` call;
   - `onOpenLibrary` navigating to `/library`;
   - `onClose`, which closes it.
3. **Audit:** in `site design/scripts/audit-design.mjs`, remove `components/gallery/CinematicPipelinePopup.tsx` from the PENDING list. The shipping app no longer imports it; it stays only for the development gallery (`site design/src/pages/GalleryPage.tsx`).

**How to verify**
1. `cd "site design"; npm run build; npm run audit:design`. Both must exit 0. The audit's pending lines now name only `pages/KnowledgeGraphPage.tsx`.
2. Browser, with Cinematic ingestion on: upload `VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf`.
   - The show lists six stages, and page rows appear while extracting.
   - A page whose quality is `uncertain` in `GET /api/reports/<id>/pages` shows "Uncertain".
   - After Graphed, "Ask about this report" opens `/agent?report=<id>`.
3. Upload `bad.pdf` (a text file). "Ingestion stopped" shows the backend's own message.
4. Press Escape. The show closes and focus returns to "Choose file".

**Acceptance criteria**
- [ ] `ingestion-show`, `ingestion-stage-1` to `ingestion-stage-6` and `ingestion-ask` exist.
- [ ] Every number and text in the Live panel comes from an event (no fixed section names, no fixed failure sentence).
- [ ] The audit exits 0, with only the graph page pending.
- [ ] The build exits 0.

---

### Task C4 — Evidence-only answers say so

- **Goal:** When an answer was written without the AI model (`ai_status` is not `ok`), the evidence block says it is quoted report text and does not warn about the AI.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `site design/src/components/agent/EvidenceModules.tsx`
  - `site design/src/pages/AgentPage.tsx` lines 160–175 (anchor `<EvidenceModules cards={citedCards} openRefs={openRefs} onToggle={toggleRef} />`)
  - `vitagraph/backend/app/services/agent_service.py` lines 369–379 (anchor `ai_status="ok",`)
- **Files to create or modify:**
  - modify `site design/src/components/agent/EvidenceModules.tsx`
  - modify `site design/src/pages/AgentPage.tsx`

**What to change**
1. **New prop:** `site design/src/components/agent/EvidenceModules.tsx` lines 15–20 (anchor `interface EvidenceModulesProps`). Add a required boolean prop `aiUsed`.
2. **Limitations text:** `site design/src/components/agent/EvidenceModules.tsx` lines 25–27 (anchor `The AI Agent can misread a table or a scan`).
   - When `aiUsed` is true, keep the sentence exactly as it is.
   - When false: "Quoted from <n passage(s)> in <m report(s)>. No AI model wrote this answer; it is report text only."
3. **Pass the prop:** `site design/src/pages/AgentPage.tsx` line 168 (anchor `<EvidenceModules cards={citedCards}`). Pass `aiUsed={entry.aiStatus === "ok"}`. The backend sets `ai_status` to `ok` only on the harness path (`agent_service.py`), and to `not_used` on the offline path (`chat_service.py`).

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Turn the AI off: `Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/ai/privacy -ContentType 'application/json' -Body '{"allow_api":false}'`.
3. On `/agent` as "Empty Test Persona", ask "What was my vitamin D result?". The answer cites passages, and Limitations reads "… No AI model wrote this answer; it is report text only."
4. Restore the setting you found before step 2. Read it first with `Invoke-RestMethod http://127.0.0.1:8000/api/ai/config`.

**Acceptance criteria**
- [ ] `aiUsed` is required, and `AgentPage` passes it.
- [ ] An evidence-only answer never shows the AI caveat (screenshot).
- [ ] The privacy setting is restored to its earlier value (paste both config reads).
- [ ] The build exits 0.

---

### Task C5 — One backend status for every page; Upload and the AI Agent pause while offline

- **Goal:** Share the shell's backend-online flag through a React context, so the Upload and AI Agent pages disable actions that would fail and say why.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** A9, A10
- **Files to read first:**
  - `site design/src/components/shell/AppShell.tsx` lines 36–118 (anchor `const [backendOnline, setBackendOnline] = useState(true);`)
  - `site design/src/pages/UploadPage.tsx`
  - `site design/src/pages/AgentPage.tsx`
- **Files to create or modify:**
  - create `site design/src/context/BackendStatus.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`
  - modify `site design/src/pages/UploadPage.tsx`
  - modify `site design/src/pages/AgentPage.tsx`

**What to change**
1. **Create `site design/src/context/BackendStatus.tsx`.** It exports:
   - `BackendStatusProvider`, with props `online` (boolean) and `children`;
   - `useBackendStatus()`, which returns `{ online }`.
   
   The default value outside a provider is `{ online: true }`, so the gallery and tests still render. The probe stays in `AppShell`; this file only shares the result.
2. **Provide it:** `site design/src/components/shell/AppShell.tsx` lines 160–176 (anchor `<StatusStrip backendOnline={backendOnline} />`). Wrap `Header`, `main` and `StatusStrip` in `BackendStatusProvider` with `online={backendOnline}`. Keep the existing offline banner and the existing props.
3. **Upload page:**
   - Read `useBackendStatus()`.
   - While offline, disable the "Choose file" label (the same way it is disabled while uploading), the file input and "Load demo cohort". Drops on the dropzone are ignored.
   - Show `PageState` kind offline above the columns: title "Uploads are paused", detail "The backend is offline. Uploading starts again when it is back."
   - It has no action, because the shell re-checks every 8 seconds (`site design/src/components/shell/AppShell.tsx` line 112, anchor `setInterval(probeBackend, 8000)`).
4. **AI Agent page:**
   - Read `useBackendStatus()`. The composer counts as ready only when online.
   - While offline:
     - the placeholder is "The backend is offline. Asking starts again when it is back.";
     - the send button and the suggestion buttons are disabled (`site design/src/pages/AgentPage.tsx` lines 403–487, anchor `disabled={!composerReady}`);
     - an answer that is streaming when the connection drops keeps the hook's own error handling.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Both servers running: open `/upload` and `/agent`, then stop the backend. Within 10 seconds, both pages show the offline message and their actions are disabled.
3. Start the backend. Within 10 seconds, the actions work again without a page reload.

**Acceptance criteria**
- [ ] `useBackendStatus` is used by the Upload and AI Agent pages.
- [ ] No action that needs the backend can be started while it is offline (screenshots of both pages).
- [ ] The pages recover without a reload.
- [ ] The build exits 0.

---

### Task C6 — End-to-end journey script

- **Goal:** One re-runnable script proves the whole journey: upload, six stages, graph, a cited answer, a refusal, a no-evidence answer and the offline states.
- **Tier:** Must
- **Size:** L
- **Review:** gate
- **Depends on:** C2, C3, C4, C5
- **Files to read first:**
  - `scripts/plan/check_layout.py`
  - `vitagraph/backend/app/routes/ai.py`
  - `vitagraph/backend/app/routes/users.py`
  - `vitagraph/sample_data/synthetic_panel_2025-01-15.pdf` (it prints "Vitamin D, 25-Hydroxy Result: 18 ng/mL"; the 2025-06-20 panel prints 34 ng/mL; neither prints ferritin)
- **Files to create or modify:**
  - create `scripts/plan/e2e_journey.py`

**What to change**
1. **Create `scripts/plan/e2e_journey.py`**, a Python script using Playwright (sync API, Chrome channel) and plain HTTP calls through `urllib.request`. No new packages. Three modes:
   - **Default mode** (both servers running):
     1. Read `GET /api/ai/config` and remember `allow_api`. Then set it to false with `POST /api/ai/privacy` (`{"allow_api": false}`), so the run is deterministic and needs no AI gateway.
     2. Create a throwaway persona: `POST /api/users` with the label "E2E Journey" and `POST /api/users/{id}/consent`. Open the app with that persona ID in localStorage and `vg_booted` set.
     3. On `/upload`, set the file input `upload-file-input` to `vitagraph/sample_data/synthetic_panel_2025-01-15.pdf`.
        - Wait up to 120 s until `ingestion-ask` is visible, or all six `upload-stage-row` rows have `data-state="done"` when the show is off.
        - Check that exactly six stage elements exist, and that none failed.
     4. Read the new report from `GET /api/reports?user_id=<id>`. Check `GET /api/graph/<id>` returns at least one node and one edge.
     5. Open `/agent?report=<report_id>`. Ask "What was my vitamin D result?" and wait for the answer to finish (up to 90 s).
        - The answer text contains "18".
        - At least one citation exists.
        - Limitations contains "No AI model wrote this answer".
     6. Ask "Do I have diabetes? Please diagnose me." The answer is a refusal: the entry's refusal state shows, and no evidence modules are shown.
     7. Ask "What was my ferritin level?". The answer says the reports hold no evidence for it (status `insufficient_evidence`), with no invented number. Check that no digit sequence followed by "ng/mL" appears in that answer.
     8. **Always, in a `finally` block:**
        - restore `allow_api` to the value read in step 1;
        - delete the throwaway persona with `DELETE /api/users/{id}`;
        - print one line per check and end with `RESULT: PASS` or `RESULT: FAIL (<names of failed checks>)`.
   - **`--offline-check` mode** (run with the frontend up and the backend stopped):
     - Open `/upload` and `/agent`.
     - Expect the shell banner text "Backend offline." on both, the upload controls disabled, and the composer disabled.
     - End with the RESULT line.
   - **`--online-check` mode** (run after starting the backend again):
     - Wait up to 15 s.
     - Expect the banner gone and the controls enabled.
     - End with the RESULT line.
   - Exit code 0 only on PASS.

**How to verify**
1. Both servers running, from the repository root: `$env:PYTHONIOENCODING="utf-8"; python scripts\plan\e2e_journey.py`. It must end with `RESULT: PASS`.
2. Stop the backend, then run `python scripts\plan\e2e_journey.py --offline-check`. It ends with `RESULT: PASS`.
3. Start the backend, wait 10 seconds, then run `python scripts\plan\e2e_journey.py --online-check`. It ends with `RESULT: PASS`.
4. `Invoke-RestMethod http://127.0.0.1:8000/api/users` no longer lists "E2E Journey", and `GET /api/ai/config` shows the original `allow_api`.

**Acceptance criteria**
- [ ] All three runs end with `RESULT: PASS` (outputs pasted).
- [ ] The throwaway persona is deleted, and the privacy setting is restored (pasted).
- [ ] The script never uses "Empty Test Persona" or any other existing persona.

---

### Task C7 — Stage latencies that were really measured

- **Goal:** Each stage reports its own measured time. Embedding and indexing are timed separately, and graph building is timed instead of reported as a fixed 10 ms.
- **Tier:** Should
- **Size:** S
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `vitagraph/backend/app/services/report_service.py` lines 165–218 (anchor `t_idx_start = time.perf_counter()`)
  - `vitagraph/backend/app/rag/vector_store.py` lines 29–52 (anchor `def index_chunks(rows: list[dict]) -> int:`)
  - `vitagraph/backend/tests/test_journey_events.py` lines 1–24 (anchor `def _upload(name: str, jid: str) -> dict:`)
- **Files to create or modify:**
  - modify `vitagraph/backend/app/rag/vector_store.py`
  - modify `vitagraph/backend/app/services/report_service.py`
  - create `vitagraph/backend/tests/test_stage_timing.py`

**What to change**
1. **Embedding hook:** `vitagraph/backend/app/rag/vector_store.py` lines 29–52 (anchor `vectors = embedder.embed_texts(texts)`).
   - Add a keyword-only optional parameter `on_embedded`, a callable with no arguments, default `None`.
   - Call it right after `embed_texts` returns, before the collection `add`.
   - Existing callers pass nothing and behave exactly as before.
2. **Separate timings:** `vitagraph/backend/app/services/report_service.py` lines 167–191 (anchor `latency_ms=max(10, lat_idx // 2),`).
   - Record the time in a callback passed as `on_embedded`.
   - "embedded" reports the time from `t_idx_start` to that moment.
   - "indexed" reports the time from that moment to `t_idx_end`.
   - Each value is at least 1 ms. A value of 0 would hide the latency, because `publish_event` treats 0 as "no latency".
3. **Graph timing:** `vitagraph/backend/app/services/report_service.py` lines 209–217 (anchor `latency_ms=10,`). Call `_graph_payload` before publishing, timed with `time.perf_counter()`, and report its real duration (at least 1 ms) instead of 10.
4. **Create `vitagraph/backend/tests/test_stage_timing.py`.** It follows the pattern of `tests/test_journey_events.py`: `make_user` and `sample_pdf` from `tests.conftest`, `report_service.process_upload` with a job ID, and events read from `job_broker._jobs[jid]["events"]`. Two tests:
   - **`test_graphed_latency_is_measured`:** monkeypatch `report_service._graph_payload` with a wrapper that sleeps 30 ms and then calls the original. Upload `synthetic_panel_2025-01-15.pdf`. The graphed event's `latency` parses to at least 30 ms.
   - **`test_embedding_and_indexing_are_timed_separately`:** monkeypatch `vector_store.embedder.embed_texts` with a wrapper that sleeps 60 ms and then calls the original. Upload the same file under a new job ID.
     - The embedded event's latency is at least 60 ms.
     - The indexed event's latency is below the embedded one.
     - Both end with " ms".

**How to verify**
1. `cd vitagraph\backend; .venv\Scripts\python.exe -m pytest tests\test_stage_timing.py -q -p no:cacheprovider`. The output reads `2 passed`.
2. Run the full suite with the command in section 5.1. The count is baseline + 2.
3. `python scripts\plan\e2e_journey.py` still ends with `RESULT: PASS`.

**Acceptance criteria**
- [ ] No hard-coded `latency_ms=10` and no `lat_idx // 2` remain in `report_service.py`.
- [ ] `index_chunks` keeps working for callers that pass only `rows`.
- [ ] Full suite: baseline + 2.
- [ ] No existing test file was edited.

---

### Task C8 — Show speed setting (decision DEC-4)

- **Goal:** Let a person choose how long each stage of the ingestion show stays on screen (Fast, Normal or Slow), as the reference offers. The measured stage times stay exactly as they are.
- **Tier:** Could
- **Size:** S
- **Review:** light
- **Depends on:** C1, A8
- **Files to read first:**
  - `site design/src/hooks/useJobStream.ts` lines 219–234 (anchor `const dwellMs = prefersReducedMotion ? 0 : 280;`)
  - `design/reference/app-v3-source.html` line 1119 (anchor `showMult()`)
  - `site design/src/lib/preferences.ts`
  - `site design/src/pages/SettingsPage.tsx`
- **Files to create or modify:**
  - modify `site design/src/lib/preferences.ts`
  - modify `site design/src/hooks/useJobStream.ts`
  - modify `site design/src/pages/SettingsPage.tsx`

**What to change**
1. **Preference:** in `preferences.ts`, add `showSpeed` with the values `"fast"`, `"normal"` or `"slow"`, default `"normal"`, validated in `load()`.
2. **Dwell time:** `site design/src/hooks/useJobStream.ts` line 222 (anchor `const dwellMs = prefersReducedMotion ? 0 : 280;`). The dwell becomes 280 ms times the speed factor: 0.5 for fast, 1 for normal and 1.8 for slow, the reference's factors.
   - Read the factor with `getPreferences()` at that moment.
   - It stays 0 under reduced motion, and also when the Reduce motion preference is on.
   - Only the pause between displayed events changes. Event order, values and the reported latencies are untouched.
3. **Settings row:** in `SettingsPage.tsx`, add a component `ChoiceRow` next to `OptionRow`, built like it (`site design/src/pages/SettingsPage.tsx` lines 44–73, anchor `const OptionRow: React.FC<OptionRowProps>`) but with one button per choice.
   - Use it in the Ingestion section with `data-testid="setting-show-speed"`, the title "Show speed", the options Fast, Normal and Slow, and the description "How long each stage of the ingestion show stays on screen. The stage times shown are always the measured ones."
   - Task B7 reuses this `ChoiceRow` when it exists.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser: set Slow and upload a sample. The stages advance visibly more slowly than on Fast. The latencies shown equal those in `GET /api/jobs/<job_id>` in both runs.

**Acceptance criteria**
- [ ] Three speeds exist, and an unknown stored value falls back to normal.
- [ ] The dwell is 0 under either reduced-motion signal.
- [ ] The displayed latencies are unchanged by the setting.
- [ ] The build exits 0.

## 10. Workstream B: 3D knowledge graph

What B delivers:
- a real 3D knowledge graph built with three.js through `@react-three/fiber`;
- the same data as today, from `GET /api/graph/{user_id}` and `POST /api/graph/subgraph`;
- the same node inspector (`DocumentPanel`), rebuilt in the Modernist design and showing real provenance;
- strict performance rules;
- a 2D fallback that is always available and is used automatically when WebGL is missing or fails.

**What exists today (the evidence).**
- **The page.**
  - `site design/src/pages/KnowledgeGraphPage.tsx` draws the 2D canvas `GraphStage` and the inspector `DocumentPanel`: `site design/src/pages/KnowledgeGraphPage.tsx` lines 418–450 (anchor `<GraphStage`).
  - It loads with a demo fallback: `site design/src/pages/KnowledgeGraphPage.tsx` lines 46–63 (anchor `const loadGraph = useCallback(async () => {`).
  - It still runs the old ask flow through job events: `site design/src/pages/KnowledgeGraphPage.tsx` line 315 (anchor `new EventSource(`).
- **The 2D canvas.**
  - `site design/src/components/gallery/GraphStage.tsx` is 2376 lines in the old design: rounded classes, old tokens and raw hex colours (the A1 audit counts 21 hex, 9 rounded and 3 legacy-token findings).
  - It shows at most the 120 most central nodes, with text fragments hidden by default. The cap is the constant at `site design/src/components/gallery/GraphStage.tsx` line 78 (anchor `const MAX_NODES = 120;`). The selection is at `site design/src/components/gallery/GraphStage.tsx` lines 745–777 (anchor `const filtering = !showFragments && fragments > 0 && meaningful >= 5;`).
  - Its test IDs include `graph-frame`, `graph-cap-note`, `graph-fragments-toggle`, `graph-legend` and `graph-fit`.
- **Layout and theme helpers.** Pure layout helpers live in `site design/src/components/gallery/graphLayout.ts`, for example `hashString`, `communityAnchors`, `seedForce`, `stepForce` and `settle`. The type sets live in `site design/src/components/gallery/graphTheme.ts` lines 52–59 (anchor `export const FRAGMENT_TYPES`).
- **Node data.** The backend passes every node attribute through, because `GraphResponse.nodes` is a list of plain dicts (`vitagraph/backend/app/schemas/graph.py` lines 35–39, anchor `nodes: list[dict[str, Any]]`):
  - chunk and uncertainty nodes carry `chunk_id`, `report_id` and `page` (`vitagraph/backend/app/graph/builder.py` lines 143–150, anchor `type="chunk",`; and lines 247–254, anchor `type="uncertainty",`);
  - measurement nodes carry `value`, `unit`, `flag` and `date`, but no `report_id` (`vitagraph/backend/app/graph/builder.py` lines 225–236, anchor `type="measurement",`).
- **Inspector.** `site design/src/components/gallery/DocumentPanel.tsx` takes `selectedNode`, `reportFilename`, `onClose` and `morphing` (`site design/src/components/gallery/DocumentPanel.tsx` lines 8–15, anchor `interface DocumentPanelProps`). Its test IDs are `document-panel-header` and `document-panel-close`.
- **No chunk endpoint.** No route returns one chunk's text. The routes in `vitagraph/backend/app/routes/reports.py` cover pages, measurements and images only, so the inspector cannot show the passage behind a chunk node. Task B1 adds the route.

**Performance rules (every B task must keep them; B10 measures them):**
1. **One draw call per node style:** all nodes are drawn with `THREE.InstancedMesh`, one mesh per node shape, and all edges with one `THREE.LineSegments` and one buffer geometry. Never one React component per node or per edge.
2. **Render on demand:** the canvas uses `frameloop="demand"`. A frame is drawn only after a camera move, hover, selection, data change or an auto-rotation step (decision DEC-1), through `invalidate()`. While nothing changes and auto-rotation is off or paused, zero frames are drawn.
3. **Pixel ratio cap:** `dpr={[1, 1.75]}`. Antialiasing is on only when `window.devicePixelRatio` is below 2.
4. **Hard caps:** at most 120 nodes by default, as in the 2D view today, and at most 400 with fragments shown. Edges are drawn only between drawn nodes. The cap is said on screen (`graph-cap-note`).
5. **Layout off the render loop:** 3D positions are computed once per data set, in a pure function capped at 300 iterations, and memoised by the node and edge IDs. Never per frame.
6. **No per-frame allocation:** `useFrame` callbacks reuse preallocated `Vector3` and `Matrix4` objects.
7. **Labels:** HTML labels are drawn only for the selected node, its neighbours, and at most the 12 most central nodes. Never for every node.
8. **Hidden tab:** while `document.visibilityState` is `hidden`, no animation runs.
9. **Cleanup:** on unmount, every geometry, material and the renderer are disposed, and every listener is removed. The page can be opened and left 5 times without the JS heap growing by more than 15 MB (B10 measures this).
10. **Code splitting:** three.js and `@react-three/fiber` load only on `/graph`, through `React.lazy`. The main bundle does not grow by more than 10 kB gzip because of B.
11. **Reduced motion:** with Reduce motion on, or the system setting on, there is no auto-rotation, no eased camera flights (moves are instant) and no pulsing.
12. **Auto-rotation (decision DEC-1):** the 3D view turns slowly around its vertical axis, as the reference does (`design/reference/app-v3-source.html` line 1028, anchor `g.ry += 0.0032`).
    - **Speed:** 0.19 radians per second, measured in time rather than per frame. That is the reference's 0.0032 per frame at 60 fps, about one turn every 33 seconds.
    - **Pausing:** it pauses while the pointer is pressed or dragging, while the pointer is over a node, and while a node is selected. It resumes 3 seconds after the last such interaction.
    - **Switching it off:** a toolbar switch (B8) turns it off for the session. It is always off under rule 11, while the tab is hidden, and in the 2D view.

**2D fallback rules:**
- **Automatic:** the 2D view (`Graph2D`, task B6) is used when WebGL2 is not available, when the WebGL context is lost, when the 3D view throws (an error boundary catches it), or when the person picks "2D" in the view switch or in Settings.
- **Same data:** both views use the same node selection (`graphModel.ts`), the same colours and the same inspector, so switching views never changes which nodes or numbers are shown.
- **Honest switch:** an automatic switch says why, in one line above the graph, for example "3D is not available in this browser, so the 2D view is shown."

---

### Task B1 — Backend: one chunk's text for the inspector

- **Goal:** Add `GET /api/reports/{report_id}/chunks/{chunk_id}`, which returns the stored passage of one chunk, so the inspector can show the real text behind chunk and uncertainty nodes.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `vitagraph/backend/app/routes/reports.py`
  - `vitagraph/backend/app/schemas/report.py` lines 86–101 (anchor `class MeasurementOut(BaseModel):`)
  - `vitagraph/backend/app/services/report_service.py` lines 409–417 (anchor `def get_pages(report_id: str) -> list[dict]:`)
  - `vitagraph/backend/tests/test_journey_events.py`
- **Files to create or modify:**
  - modify `vitagraph/backend/app/schemas/report.py`
  - modify `vitagraph/backend/app/services/report_service.py`
  - modify `vitagraph/backend/app/routes/reports.py`
  - modify `site design/src/api/reports.ts`
  - create `vitagraph/backend/tests/test_report_chunk.py`

**What to change**
1. **Schema:** in `vitagraph/backend/app/schemas/report.py`, after `MeasurementOut`, add a model `ChunkOut` with these fields:
   - `chunk_id` (str);
   - `report_id` (str);
   - `page_number` (int);
   - `sequence` (int);
   - `section` (str or None);
   - `char_start` and `char_end` (int);
   - `text` (str).
2. **Service:** in `vitagraph/backend/app/services/report_service.py`, after `get_pages` (lines 409–417, anchor `def get_pages(report_id: str) -> list[dict]:`), add `get_chunk(report_id, chunk_id)`:
   - Call `uploader.get_report(report_id)` first, which raises 404 for an unknown report, as `get_pages` does.
   - Select `id`, `report_id`, `page_number`, `sequence`, `section`, `char_start`, `char_end` and `text` from `report_chunks`, matching both the chunk ID and the report ID.
   - Raise `HTTPException(404, "Chunk not found in this report.")` when there is no row.
   - Return the row as a dict, with `id` renamed to `chunk_id`.
3. **Route:** in `vitagraph/backend/app/routes/reports.py`:
   - Add `ChunkOut` to the schema import at line 7 (anchor `from app.schemas.report import ComparisonOut, MeasurementOut, PageOut, ReportOut, ReportStatusOut, TrendOut`).
   - After the measurements route (lines 85–88, anchor `def report_measurements(report_id: str) -> list[dict]:`), add a GET route `/{report_id}/chunks/{chunk_id}` with response model `ChunkOut` and docstring "One stored passage, for the graph inspector."
   - It takes a **required** `user_id` query parameter and calls `user_service.user_exists(user_id)`. It then calls a new service helper, `report_service.assert_report_owner(report_id, user_id)`, which raises 404 "Report not found." when the report does not exist or belongs to another persona. Finally it returns `report_service.get_chunk(report_id, chunk_id)`.
   - The new route has no existing tests, so it is private from the start. The three older per-report routes get the same check in task F1.
4. **Client:** in `site design/src/api/reports.ts`:
   - Add an exported interface `ChunkDetail` with the same fields as `ChunkOut`.
   - Add `chunk: (userId, reportId, chunkId) => api.get<ChunkDetail>(...)` to `reportsApi` (lines 91–114, anchor `export const reportsApi = {`). It calls the route with `?user_id=` and encodes all three IDs with `encodeURIComponent`.
5. **Tests:** create `vitagraph/backend/tests/test_report_chunk.py`. It uses `TestClient(app)`, `make_user`, `sample_pdf` and `report_service.process_upload`, as `tests/test_journey_events.py` does.
   - **`test_chunk_route_returns_the_stored_passage`:** upload `synthetic_panel_2025-01-15.pdf`, then read the first chunk ID from `report_chunks` for that report. The route returns 200 with the same text, `char_end` greater than `char_start`, and `page_number` 1 or more.
   - **`test_chunk_route_refuses_a_chunk_of_another_report`:** upload both sample panels. Asking for report A with a chunk ID of report B returns 404.
   - **`test_chunk_route_refuses_another_persona`:** persona B asking for persona A's chunk with B's own `user_id` returns 404. A request without `user_id` returns 422.

**How to verify**
1. `cd vitagraph\backend; .venv\Scripts\python.exe -m pytest tests\test_report_chunk.py -q -p no:cacheprovider`. The output reads `3 passed`.
2. Full suite: baseline + 3 (section 5.1).
3. `cd "site design"; npm run build`. It must exit 0.

**Acceptance criteria**
- [ ] `GET /api/reports/{report_id}/chunks/{chunk_id}` exists and returns `ChunkOut`. It gives 404 for a chunk of another report and for another persona, and 422 without `user_id`.
- [ ] `reportsApi.chunk` exists and calls exactly that path with `user_id`.
- [ ] Full suite: baseline + 3. No existing test was edited.

---

### Task B2 — Add three.js and react-three-fiber at pinned versions

- **Goal:** Install the 3D libraries at versions checked against this project's React 19.2 and TypeScript setup.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `site design/package.json`
- **Files to create or modify:**
  - modify `site design/package.json`
  - modify `site design/package-lock.json`

**Facts checked by the planner (from the published packages):**
- `@react-three/fiber` 9.8.1 declares the peer dependencies `react >=19 <19.4`, `react-dom >=19 <19.4` and `three >=0.156`. This project uses React 19.2.
- 9.8.1 exports `Canvas`, `useThree`, `useFrame`, `invalidate` and the type `ThreeEvent`. `Canvas` accepts `frameloop`, `dpr`, `gl`, `camera`, `onCreated` and `onPointerMissed`. Pointer events on an `InstancedMesh` carry `instanceId`.
- three 0.180.0 ships `OrbitControls` at `three/addons/controls/OrbitControls.js`, with `enableDamping`, `target`, `update()`, `dispose()` and the `change` event. `@types/three` 0.180.0 types that path.
- `@react-three/drei` is **not** used. It is not needed, and leaving it out keeps the bundle small.

**What to change**
1. In `site design`, run `npm install three@0.180.0 @react-three/fiber@9.8.1 --save-exact`.
2. Then run `npm install -D @types/three@0.180.0 --save-exact`.
3. These two commands must change only `site design/package.json` and `site design/package-lock.json`.

**How to verify**
1. `git diff --stat` lists only those two files.
2. `cd "site design"; npm ls three @react-three/fiber @types/three` shows exactly 0.180.0, 9.8.1 and 0.180.0, with no `UNMET PEER` line.
3. `npm run build` exits 0.

**Acceptance criteria**
- [ ] The three packages are at the exact versions, saved without `^`.
- [ ] No other package was added or upgraded (check the lock file diff).
- [ ] The build exits 0.

---

### Task B3 — Graph model and WebGL check (shared by the 3D and 2D views)

- **Goal:** Add one pure module that chooses the nodes, lays them out in 3D and 2D, and gives colours. Add one small WebGL check. Both views use them.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `site design/src/components/gallery/GraphStage.tsx` lines 745–777 (anchor `const filtering = !showFragments && fragments > 0 && meaningful >= 5;`)
  - `site design/src/components/gallery/graphLayout.ts`
  - `site design/src/components/gallery/graphTheme.ts`
  - `site design/src/api/graph.ts`
  - `site design/src/theme/tokens.css`
- **Files to create or modify:**
  - create `site design/src/components/graph3d/graphModel.ts`
  - create `site design/src/components/graph3d/webgl.ts`

**What to change**
1. **Create `graphModel.ts`.** Pure functions only: no React, no three.js imports, no DOM access except in `readTokenColours`. It exports:
   - **`selectNodes(graph, { showFragments, cap })`:**
     - Implements exactly the selection rule of `GraphStage` (lines 745–777): fragments are the types in `FRAGMENT_TYPES`. They are left out only when `showFragments` is false and at least 5 other nodes remain.
     - Sort by `betweenness`, highest first, then slice to `cap`.
     - Returns:
       - `nodes`;
       - `edges`, keeping only edges whose two ends are both kept, as index pairs plus `relation`;
       - `poolSize`;
       - `fragmentCount`;
       - `hiddenFragments` (boolean).
   - **`NODE_CAP` = 120** and **`NODE_CAP_WITH_FRAGMENTS` = 400** (performance rule 4).
   - **`layout3d(nodes, edges)`:** returns a `Float32Array` of x, y and z for each node. It is deterministic: the same input always gives the same output.
     1. Seed each node from `hashString(node.id)`.
     2. Place communities on anchors spread over a sphere of radius 60 with a golden-angle spiral, and start each node near its community anchor.
     3. Run at most 300 iterations of a simple force step in 3D: edge springs, node repulsion within the community, and a weak pull to the anchor. Use plain arrays, with no allocation inside the loop.
     4. Recentre the result on the origin.
   - **`layout2d(nodes, edges, width, height)`:** returns x and y using the existing helpers `seedForce` and `settle` from `graphLayout.ts`, so the 2D view looks like today's.
   - **`nodeStyle(node)`:**
     - Returns a size class from the node type: report and person largest, test medium, measurement small, fragments smallest.
     - Returns a colour role: `accent` for the selected or active state, `text` for reports, `neutral` for structural types (`STRUCTURAL_TYPES`), `uncertain` for type `uncertainty`, and otherwise the community colour from `communityColor`.
   - **`readTokenColours()`:** reads `--color-text`, `--color-accent`, `--color-neutral-400`, `--color-neutral-600`, `--color-divider`, `--ochre` and `--color-bg` from `getComputedStyle(document.documentElement)`, so the 3D view uses the same tokens as the page. No hex is written in the component code.
2. **Create `webgl.ts`.** It exports `hasWebGL2()`:
   - Create an off-screen canvas and request a `webgl2` context, catching errors.
   - Release the context through `WEBGL_lose_context` when present.
   - Cache the result for the session.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0, with the new files unused for now.
2. `npm run audit:design` exits 0.

**Acceptance criteria**
- [ ] `selectNodes` keeps the exact selection rule of `GraphStage`: the same IDs for the same input. B10 compares the 2D and 3D node counts with today's `graph-cap-note` text.
- [ ] `layout3d` is deterministic and allocates nothing inside its iteration loop.
- [ ] No hex colour appears in either file.
- [ ] The build exits 0.

---

### Task B4 — Inspector: DocumentPanel shows real provenance in the Modernist design

- **Goal:** Rebuild the node inspector so that every node type shows facts from the API: chunk text, report details, a measurement's source passage, and "Uncertain" for uncertainty nodes. It uses the shared components.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** A2, B1
- **Files to read first:**
  - `site design/src/components/gallery/DocumentPanel.tsx`
  - `site design/src/api/reports.ts`
  - `vitagraph/backend/app/graph/builder.py` lines 84–254 (anchor `g.add_node(`)
- **Files to create or modify:**
  - modify `site design/src/components/gallery/DocumentPanel.tsx`

**What to change**
1. **Rewrite the component** (all of `site design/src/components/gallery/DocumentPanel.tsx`, from lines 8–15, anchor `interface DocumentPanelProps`).
   - **Props:** all optional, so the development gallery keeps compiling.
     - `selectedNode`;
     - `graph`, the whole `GraphResponse`, needed to find neighbours;
     - `reports`, the persona's report list;
     - `onClose`;
     - `className`.
   - The `morphing` prop and the view-transition name are removed, together with the morph chip in B8.
   - A new optional prop, `userId`, is the active persona's ID. Without it the panel shows the node's own fields and loads nothing.
2. **Layout:** a `section` with `aria-label="Node details"`, background `--color-surface` and a 2 px top rule in `--color-text`.
   - **Header row:** `data-testid="document-panel-header"`. It holds the node label as an `h2` and a `btn btn-ghost` "Close" button with `data-testid="document-panel-close"`.
   - **Kicker:** the node type's display name, using the same names as Insights (task A7), with "Uncertain" for `uncertainty`.
   - **Body by node type:**
     - **No node:** "Select a node to see where it comes from."
     - **report:** the filename, the printed date ("Undated" when missing) and the page count, all from the matching entry of `reports`, matched by the report ID in the node's ID or label. A button "Open in library" goes to `/library`.
     - **chunk and uncertainty:** call `reportsApi.chunk(userId, node.report_id, node.chunk_id)` and show:
       - "Page <page_number>, characters <start>–<end>";
       - the passage, pre-wrapped;
       - for `uncertainty`, a `Tag` "Uncertain" (tone uncertain) and the sentence "No value could be read from this passage, so it is kept as uncertain."
       
       While the request runs, show `PageState` loading "Loading the passage". On failure, show `PageState` error "The passage could not be loaded" with the error.
     - **measurement:** the value, the unit, the flag as a `Tag` (hot for LOW or HIGH, neutral otherwise) and the date. Then find the source:
       1. Find the connected test node through the `HAS_MEASUREMENT` edge.
       2. Find the reports whose printed `report_date` equals the node's `date`.
       3. Call `reportsApi.measurements` for each, and keep the rows with the same test name ignoring case, the same value and the same unit.
       4. With exactly one match, show its report name, page and character span. Without exactly one match, show "The source passage could not be matched exactly." Never guess between two matches.
     - **test:** the test name, its category, and the number of measurement nodes linked to it.
     - **Any other type:** the label and its number of connections.
   - **Cancellation:** every request is cancelled with a flag when the node changes or the panel unmounts.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0. The gallery and the current graph page still compile, because every prop is optional.
2. Checked in the browser after B8.

**Acceptance criteria**
- [ ] Keep these test IDs: `document-panel-header`, `document-panel-close`.
- [ ] Chunk and uncertainty nodes show the stored passage from `GET /api/reports/{report_id}/chunks/{chunk_id}`.
- [ ] A measurement with zero or two matching rows says that it could not be matched; it never picks one.
- [ ] No old tokens, rounding or hex remain in the file.
- [ ] The build exits 0.

---

### Task B5 — The 3D view

- **Goal:** Add a 3D graph component that follows every performance rule above, shows selection and hover, and reports WebGL failures so the page can fall back to 2D.
- **Tier:** Must
- **Size:** L · hard
- **Review:** gate
- **Depends on:** B2, B3
- **Files to read first:**
  - `site design/src/components/graph3d/graphModel.ts`
  - `site design/src/components/graph3d/webgl.ts`
  - `site design/src/lib/preferences.ts`
- **Files to create or modify:**
  - create `site design/src/components/graph3d/Graph3D.tsx`

**What to change**
1. **Create `Graph3D.tsx`**, with a default export so it can be lazy-loaded, plus a named export `Graph3D`.
   - **Props:**
     - `nodes` and `edges` (the output of `selectNodes`);
     - `selectedId`;
     - `activeIds` (a set of highlighted node IDs);
     - `onSelect(nodeId | null)`;
     - `onContextLost()`;
     - `fitSignal`, a number that changes when "Fit" is pressed.
   - **Canvas:**
     - `frameloop="demand"`;
     - `dpr={[1, 1.75]}`;
     - `gl` with `antialias` only when the device pixel ratio is below 2, `powerPreference: "high-performance"` and `alpha: false`;
     - background colour from `readTokenColours().bg`;
     - a perspective camera with field of view 45, placed to frame the layout's bounding sphere.
     
     `onCreated` registers a `webglcontextlost` listener on the canvas that calls `onContextLost`.
   - **Nodes:**
     - One `InstancedMesh` of a low-poly sphere (an icosahedron with detail 1), holding all node instances.
     - Per-instance matrix from `layout3d` and the node size, and per-instance colour from `nodeStyle` and the token colours.
     - Selected and active nodes use the accent colour. Non-active nodes are dimmed to the neutral colour while a highlight set is present.
   - **Edges:** one `LineSegments` with one buffer geometry built from the edge index pairs, in the divider colour. Edges touching the selected node use the text colour (the colour buffer is updated, never rebuilt).
   - **Picking:**
     - `onPointerMove` on the instanced mesh reads `event.instanceId` for hover, sets the cursor to pointer and calls `invalidate()`.
     - `onClick` calls `onSelect(id)`.
     - `onPointerMissed` on the canvas calls `onSelect(null)`.
   - **Camera control:** `OrbitControls`, imported from `three/addons/controls/OrbitControls.js`, created imperatively from `useThree` (camera and `gl.domElement`):
     - `enableDamping` only while motion is allowed;
     - a `change` listener calls `invalidate()`;
     - `dispose()` and listener removal on unmount.
   - **Labels:** HTML labels (absolutely positioned `div`s, projected with the camera) only for the selected node, its neighbours and the 12 most central nodes. They use the Archivo font, the `--color-text` colour and a `--color-bg` backing for contrast.
   - **Fit:** when `fitSignal` changes, frame the bounding sphere. It is instant when motion is reduced, otherwise an ease of at most 400 ms driven by `useFrame` with preallocated vectors.
   - **Auto-rotation:** follow rule 12. A new prop, `autoRotate` (boolean), comes from the page's switch.
     - While it is true and not paused, a `useFrame` callback adds 0.19 × delta radians to the graph group's y rotation and calls `invalidate()` for the next frame. When it is false or paused, no frame is requested.
     - The pause state is set by the pointer handlers, hover, selection, and a 3-second idle timer that is cleared on unmount.
   - **Motion:** while Reduce motion is on (`usePreferences().reduceMotion`) or the system prefers reduced motion, there is no auto-rotation, no damping and no eased fit.
   - **Visibility:** while `document.visibilityState` is hidden, no eased animation runs.
   - **Cleanup:** dispose the sphere geometry, the line geometry and both materials on unmount.
   - **Accessibility:** the canvas wrapper has `aria-hidden="true"`. The page (B8) provides the keyboard path through a node list.
   - **Measuring frames:** when the app runs in development (`import.meta.env.DEV`), B10 needs two window values. Production builds do not include them.
     - `window.__VG_GRAPH_FRAMES__`, a number incremented in `useFrame`, measures rule 2.
     - `window.__VG_GRAPH_ROTATION__`, the group's current y rotation, measures rule 12.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. `Select-String -Path "site design\src\components\graph3d\Graph3D.tsx" -Pattern '#[0-9a-fA-F]{3,8}\b|drei|frameloop="always"'` prints nothing.

**Acceptance criteria**
- [ ] One instanced mesh for the nodes and one line segments object for the edges (rule 1).
- [ ] `frameloop="demand"` and `dpr={[1, 1.75]}` are used (rules 2 and 3).
- [ ] OrbitControls and all geometries and materials are disposed on unmount (rule 9).
- [ ] The build exits 0.

---

### Task B6 — The 2D view (fallback and choice)

- **Goal:** Add a light 2D SVG view in the Modernist design with the same nodes, colours, selection and fit as the 3D view. It replaces the old canvas `GraphStage` on the graph page.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** B3
- **Files to read first:**
  - `site design/src/components/graph3d/graphModel.ts`
  - `site design/src/components/gallery/GraphStage.tsx` lines 2096–2110 (anchor `const filtering = !showFragments && fragmentCount > 0 && totalNodes - fragmentCount >= 5;`)
- **Files to create or modify:**
  - create `site design/src/components/graph3d/Graph2D.tsx`

**What to change**
1. **Create `Graph2D.tsx`**, exporting `Graph2D` with the same props as `Graph3D` (except `onContextLost`).
   - **Drawing:**
     - It renders an `svg` that fills its frame, laid out with `layout2d` for the frame's measured size.
     - Edges are one `path` element built from all segments, so there are no thousands of `line` elements.
     - Nodes are one `circle` per drawn node, at most 400 by rule 4.
     - Colours come from `nodeStyle` with CSS variables directly (`fill="var(--color-…)"`), never hex.
   - **Interaction:**
     - Pan by dragging the background, and zoom with the wheel or with + and − buttons, between 0.4× and 4×.
     - "Fit" (when `fitSignal` changes) resets the view to show every node.
     - Clicking a node calls `onSelect`, and clicking the background calls `onSelect(null)`.
     - Hover shows the node label in a small `--color-bg` box.
   - **Labels:** the same label limit as the 3D view.
   - **Motion:** no animation when reduced motion is on.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.

**Acceptance criteria**
- [ ] The 2D view uses `selectNodes` and `nodeStyle` from `graphModel.ts` (the same data as 3D).
- [ ] Edges are drawn as one path.
- [ ] No hex colours appear.
- [ ] The build exits 0.

---

### Task B7 — A "Graph view" preference

- **Goal:** Let a person choose Automatic, 3D or 2D in Settings. Automatic means 3D when WebGL2 works, otherwise 2D.
- **Tier:** Should
- **Size:** S
- **Review:** light
- **Depends on:** A8
- **Files to read first:**
  - `site design/src/lib/preferences.ts`
  - `site design/src/pages/SettingsPage.tsx`
- **Files to create or modify:**
  - modify `site design/src/lib/preferences.ts`
  - modify `site design/src/pages/SettingsPage.tsx`

**What to change**
1. **Preference:** `site design/src/lib/preferences.ts` lines 4–10 (anchor `export interface Preferences {`).
   - Add `graphView` with the values `"auto"`, `"3d"` or `"2d"`, default `"auto"`.
   - In `load()` (lines 12–26, anchor `function load(): Preferences {`), accept only those three strings and fall back to the default otherwise.
2. **Choice row:** in `site design/src/pages/SettingsPage.tsx`, reuse `ChoiceRow` when task C8 has already added it. Otherwise add it now, next to `OptionRow` and built like it (lines 44–73, anchor `const OptionRow: React.FC<OptionRowProps>`), but with one button per choice.
   - In the Display section, after "Reduce motion", add a `ChoiceRow` with `data-testid="setting-graph-view"`:
     - title "Graph view";
     - description "Automatic uses 3D when this browser supports it, and 2D otherwise.";
     - options Automatic, 3D and 2D, each calling `setPreference("graphView", …)`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser on `/settings`: choose 2D, reload, and the choice is kept.

**Acceptance criteria**
- [ ] `graphView` exists with exactly the three values, and an unknown stored value falls back to `auto`.
- [ ] `setting-graph-view` exists in Settings.
- [ ] The build exits 0.

---

### Task B8 — The graph page rebuilt around the 3D view

- **Goal:** Rebuild `/graph` on the shared frame. Show the 3D view (lazy-loaded) or the 2D view with an honest reason. Keep the existing graph test IDs, use the new inspector, and highlight the last answer's evidence.
- **Tier:** Must
- **Size:** L · hard
- **Review:** gate
- **Depends on:** A2, B4, B5, B6, B7
- **Files to read first:**
  - `site design/src/pages/KnowledgeGraphPage.tsx`
  - `site design/src/components/graph3d/Graph3D.tsx`
  - `site design/src/components/graph3d/Graph2D.tsx`
  - `site design/src/components/gallery/DocumentPanel.tsx`
  - `site design/src/api/graph.ts`
- **Files to create or modify:**
  - create `site design/src/lib/lastAnswer.ts`
  - create `site design/src/components/graph3d/GraphErrorBoundary.tsx`
  - modify `site design/src/pages/KnowledgeGraphPage.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`
  - modify `site design/scripts/audit-design.mjs`

**What to change**
1. **Create `lib/lastAnswer.ts`.** It exports:
   - `saveLastAnswer({ userId, question, chunkIds })`, which writes the record with a timestamp to `sessionStorage` under `vitagraph:last_answer`;
   - `readLastAnswer(userId)`, which returns the record only when it belongs to that persona. Storage errors are caught and give null.
2. **Create `GraphErrorBoundary.tsx`.** A class component with `getDerivedStateFromError`. On error it renders its `fallback` prop and calls an `onError` prop once.
3. **Rewrite `site design/src/pages/KnowledgeGraphPage.tsx`** (all 476 lines; today's component starts at the anchor `const loadGraph = useCallback(async () => {`, lines 46–63). The new page:
   - **Data:**
     - The persona comes from `useActiveUser`, with no demo fallback.
     - The graph comes from `graphApi.getGraph(userId)`, with a retry tick, and the report list from `reportsApi.list(userId)` for the inspector.
     - When `readLastAnswer(userId)` gives chunk IDs and the URL has `?answer=1`, call `graphApi.getSubgraph(userId, chunkIds)`. Use its node IDs as the highlight set, and show the line "Highlighting the evidence of: <question>" with a "Clear" button.
   - **States:** each in `PageFrame` with label "Knowledge Graph":
     - no persona: `PersonaState`;
     - loading: "Loading the graph";
     - error: "Could not load the graph", with "Try again";
     - empty: "No graph yet", with "Upload a report".
   - **Layout:**
     - A full-height two-column layout: the graph frame and the 400 px inspector, which stacks under the graph below 1024 px.
     - The frame `div` has `data-testid="graph-frame"`, a 2 px rule, `--color-bg`, a fixed height of `min(70vh, 720px)` and 420 px on phones.
   - **Toolbar** above the frame:
     - **View switch:** `seg` buttons "3D" and "2D", stored as the session's choice and initialised from `graphView`. "Automatic" picks 3D when `hasWebGL2()`.
     - **Fragments:** a switch "Show text fragments" with `data-testid="graph-fragments-toggle"` and `aria-checked`.
     - **Fit:** `data-testid="graph-fit"`.
     - **Auto-rotate:** a switch "Auto-rotate" with `data-testid="graph-auto-rotate"` and `aria-checked`. It is on by default, and off and disabled while motion is reduced. It is shown only in 3D. The value lasts for the session only.
     - **Cap note:** `data-testid="graph-cap-note"`. It says, for example, "Showing the 120 most central of 342 nodes. 210 text fragments are hidden.", with numbers from `selectNodes`.
     - **Legend:** `data-testid="graph-legend"`, listing the colour roles in use, with "Uncertain" for uncertainty nodes.
   - **3D:** loaded with `React.lazy(() => import("../components/graph3d/Graph3D"))` inside `Suspense`, whose fallback is `PageState` loading "Loading the 3D view". The view is wrapped in `GraphErrorBoundary`, whose fallback is `Graph2D`.
   - **Fallback reason:** when 3D fails or WebGL2 is missing, switch to 2D and show one line, either "3D is not available in this browser, so the 2D view is shown." or "The 3D view stopped working, so the 2D view is shown."
   - **Keyboard path:** below the frame, a collapsed "Nodes" list (a `details` element) of the drawn nodes as buttons. Selecting one selects the node, so the inspector is reachable without a pointer.
   - **Inspector:** `DocumentPanel` with `selectedNode`, `graph`, `reports`, `userId` and `onClose`. Escape clears the selection.
   - **Removed:**
     - the old ask flow (the `AskBar`, the job `EventSource` at line 315, `ThinkingDetailsPanel` and `questionsApi`);
     - the morph chip (`node-fly-chip`);
     - the global `window.__VG_TEST_ACTIVATE_QUESTION__` hook;
     - the community hand-off through `location.state`, which no page sends (open issue O-12).
     
     Asking happens on `/agent`. A `btn btn-secondary` "Ask the AI Agent" navigates there.
4. **Own layout:** `site design/src/components/shell/AppShell.tsx` line 31 (anchor `const OWN_LAYOUT = new Set<string>(`). Add `"/graph"`.
5. **Audit:** in `site design/scripts/audit-design.mjs`, remove `pages/KnowledgeGraphPage.tsx` from the PENDING list. PENDING is now empty.

**How to verify**
1. `cd "site design"; npm run build; npm run audit:design`. Both must exit 0, with `0 pending`.
2. `Get-ChildItem "site design\dist\assets\*.js" | Sort-Object Length -Descending | Select-Object -First 5 Name,Length`. three.js is in its own chunk, not in the main `index-*.js`. Paste the list.
3. Browser as "Empty Test Persona":
   - `/graph` shows the 3D graph, and the cap note matches `GET /api/graph/usr_51f14542d71a` (its node count) and the fragment rule.
   - Click a chunk node. The inspector shows the passage from the chunk route.
   - Switch to 2D. The same nodes show and the cap note is unchanged.
4. The automatic 2D fallback is checked by B10, which runs Chrome with WebGL disabled.

**Acceptance criteria**
- [ ] Keep these test IDs: `graph-frame`, `graph-cap-note`, `graph-fragments-toggle`, `graph-legend`, `graph-fit`, `document-panel-header`, `document-panel-close`.
- [ ] No demo fallback, `console` call or old ask flow remains in the page.
- [ ] three.js is code-split out of the main bundle.
- [ ] The audit has 0 pending lines.
- [ ] The build exits 0.

---

### Task B9 — "Show in graph" from an answer

- **Goal:** Under a finished, cited answer on the AI Agent page, a button saves that answer's evidence and opens the graph with it highlighted.
- **Tier:** Should
- **Size:** S
- **Review:** light
- **Depends on:** B8
- **Files to read first:**
  - `site design/src/pages/AgentPage.tsx` lines 160–200 (anchor `<EvidenceModules cards={citedCards}`)
  - `site design/src/lib/lastAnswer.ts`
- **Files to create or modify:**
  - modify `site design/src/pages/AgentPage.tsx`

**What to change**
1. Next to the evidence modules of an answered, not withheld entry with at least one cited card (the same condition as at `site design/src/pages/AgentPage.tsx` line 168, anchor `<EvidenceModules cards={citedCards}`), add a `btn btn-secondary` "Show in graph" with `data-testid="agent-show-in-graph"`.
2. On click:
   1. Call `saveLastAnswer` with the persona, the entry's question, and the `chunk_id`s of the cited cards.
   2. Navigate to `/graph?answer=1`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser: ask "What was my vitamin D result?". Click "Show in graph".
   - The graph opens with the evidence nodes highlighted and the line "Highlighting the evidence of: What was my vitamin D result?".
   - Paste the chunk IDs from the answer's evidence next to the highlighted node IDs.

**Acceptance criteria**
- [ ] `agent-show-in-graph` appears only under cited answers.
- [ ] The highlighted nodes come from `POST /api/graph/subgraph` for exactly the cited chunk IDs.
- [ ] The build exits 0.

---

### Task B10 — Graph performance and fallback check script

- **Goal:** Measure performance rules 2, 4, 9 and 10 and the automatic 2D fallback, with one re-runnable script.
- **Tier:** Must
- **Size:** M
- **Review:** gate
- **Depends on:** B8
- **Files to read first:**
  - `scripts/plan/check_layout.py`
  - `site design/src/components/graph3d/Graph3D.tsx`
- **Files to create or modify:**
  - create `scripts/plan/graph_perf.py`

**What to change**
1. **Create `scripts/plan/graph_perf.py`** (Playwright, Chrome channel, dev server on 5173). Its argument is the persona ID. Checks:
   - **Idle frames (rule 2):** open `/graph` in 3D and switch Auto-rotate off. Wait 4 s for the view to settle, read `window.__VG_GRAPH_FRAMES__`, wait 3 s more and read it again. The difference must be 0.
   - **Auto-rotation (rule 12):**
     - With Auto-rotate on, `window.__VG_GRAPH_ROTATION__` grows by 0.4 to 0.75 radians over 3 s, which is 0.19 radians per second with tolerance.
     - While the mouse button is held down on the canvas without moving, it does not change.
     - In a context created with `reduced_motion="reduce"`, it does not change over 3 s and the switch is disabled.
   - **Orbit frame rate:** drag the canvas with the mouse for 3 s while counting `requestAnimationFrame` callbacks in the page. Print the frames per second, which must be at least 30 at 1440 × 900. Print the GPU renderer string from `WEBGL_debug_renderer_info` when available, so the reviewer knows the machine.
   - **Caps (rule 4):** the `graph-cap-note` text names at most 120 shown nodes with fragments hidden, and at most 400 with fragments shown.
   - **Memory (rule 9):** navigate between `/graph` and `/library` 5 times. Read `performance.memory.usedJSHeapSize` (Chrome) after a forced garbage collection through the DevTools protocol (`HeapProfiler.collectGarbage`). Growth must stay at or below 15 MB.
   - **Fallback:** launch a second browser with `args=["--disable-webgl", "--disable-3d-apis"]`, open `/graph`, and expect the 2D view with the line "3D is not available in this browser, so the 2D view is shown."
   - End with `RESULT: PASS` or `RESULT: FAIL (...)`.

**How to verify**
1. Both servers running: `$env:PYTHONIOENCODING="utf-8"; python scripts\plan\graph_perf.py usr_51f14542d71a`. It ends with `RESULT: PASS`.
2. Paste the printed frame counts, frame rate, renderer, cap note texts and memory numbers.

**Acceptance criteria**
- [ ] Zero frames are drawn while idle with Auto-rotate off.
- [ ] Auto-rotation runs at the stated speed, stops while dragging, and is off under reduced motion.
- [ ] At least 30 fps while orbiting (with the renderer named).
- [ ] Heap growth is 15 MB or less after 5 visits.
- [ ] The fallback works with WebGL disabled.
- [ ] `RESULT: PASS` (output pasted).

---

### Task B11 — End-of-B gate: strict audit and layout at every width

- **Goal:** Close workstream B. The design audit passes in strict mode, and every route, now including `/graph`, passes the layout check and the accessibility, keyboard-focus and reduced-motion checks.
- **Tier:** Must
- **Size:** S
- **Review:** gate
- **Depends on:** A13, C3, B8, B10
- **Files to read first:**
  - `site design/scripts/audit-design.mjs`
- **Files to create or modify:**
  - modify `site design/package.json`

**What to change**
1. In `site design/package.json`, change the `audit:design` script to `node scripts/audit-design.mjs --strict`. From now on, every reached file must be clean. PENDING has been empty since B8.

**How to verify**
1. `cd "site design"; npm run audit:design`. It must exit 0 and print `(strict)` and `0 error(s), 0 pending`.
2. `cd "site design"; npm run build`. It must exit 0.
3. `$env:PYTHONIOENCODING="utf-8"; python scripts\plan\check_layout.py usr_51f14542d71a`, with no route arguments so that all eight routes are checked. It ends with `RESULT: PASS`.
4. `python scripts\plan\check_a11y.py usr_51f14542d71a`, with no route arguments, so that `/graph` is now included. It ends with `RESULT: PASS`. The script is created in A13.

**Acceptance criteria**
- [ ] The strict audit exits 0.
- [ ] The layout check passes all eight routes at 360, 820 and 1440 px.
- [ ] `check_a11y.py` passes all eight routes: no serious or critical axe violations, a visible focus on every tab stop, and no running animation under reduced motion.
- [ ] The build exits 0.

## 11. Workstream D: Harness agent

What D delivers:
- an AI Agent page that works like an agent harness: a visible loop of thinking, tool calls and results; run statistics (time, tool calls, tokens); Minimal, Standard and Detailed display modes; slash commands; and conversations that can be resumed;
- two new artifact tools that let the agent show code it wrote and create real PDF and HTML reports from the persona's own data, shown on cards with a subtle 3D effect that stays easy to read.

**Where the repository and the goals disagree, and what this plan chooses (repo reality first):**
- **Session resume.** The harness's Python SDK offers only `initialize`, `session/prompt` and `shutdown`. It has no session list or resume (section 2.5). So VitaGraph's own database stores conversations (D1, D2), and resuming replays the stored turns as context. That is how the agent already receives history today: `vitagraph/backend/app/schemas/agent.py` lines 8–15 (anchor `messages: list[ChatTurn] = Field(min_length=1, max_length=60)`).
- **Four-tool lockdown versus artifact tools.** The lockdown accepts exactly four tools: `vitagraph/backend/app/agent/lockdown.py` lines 19–26 (anchor `def assert_locked_down(tool_names: list[str]) -> None:`). Three existing tests pin this (section 2.5). So the artifact tools live in a **separate** MCP server, `vgartifacts`, that a persona profile adds only when a new setting is on. The four-tool check stays exactly as it is by default, and the six-tool check applies only to profiles built with artifacts on. The data tools stay read-only, and the artifact tools only write artifacts for the same persona.
- **Display modes.** The harness's modes are compact, standard, detailed and verbose (the constant `TRANSCRIPT_VIEW_MODES` in the file `packages/client/ui-chat/src/chat-settings.ts` of the harness repository). Minimal maps to compact, and Standard and Detailed map to the same names. Verbose is not offered.
- **Monospace code.** The design rules allow Archivo only (`gemini/RULES.md` section 2), so code artifacts are shown in Archivo with preserved line breaks and spacing. This is recorded as open issue O-8.
- **The API is blocked.** The free gateway rejects the harness (section 2.5). Every D check that needs the model is marked "needs the AI". When the gateway refuses, the worker records `API blocked` (rule 9), and all other checks run with the AI off.

---

### Task D1 — Database: conversations, messages and artifacts, and a complete persona delete

- **Goal:** Add tables for agent conversations, their messages and their artifacts. Deleting a persona then removes these rows, and its `ai_calls` rows too.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** A8
- **Files to read first:**
  - `vitagraph/backend/app/core/database.py` lines 20–117 (anchor `CREATE INDEX IF NOT EXISTS idx_events_user ON history_events(user_id);`)
  - `vitagraph/backend/app/services/user_service.py` lines 90–118 (anchor `def delete_user(user_id: str) -> dict:`)
  - `site design/src/pages/SettingsPage.tsx`
- **Files to create or modify:**
  - modify `vitagraph/backend/app/core/database.py`
  - modify `vitagraph/backend/app/services/user_service.py`
  - modify `site design/src/pages/SettingsPage.tsx`
  - create `vitagraph/backend/tests/test_agent_store_schema.py`

**What to change**
1. **New tables:** `vitagraph/backend/app/core/database.py` line 116 (anchor `CREATE INDEX IF NOT EXISTS idx_events_user ON history_events(user_id);`). Before the closing `"""` of `SCHEMA`, add three tables and their indexes:
   - **`agent_conversations`:**
     - `id` TEXT PRIMARY KEY;
     - `user_id` TEXT NOT NULL;
     - `title` TEXT;
     - `created_at` TEXT NOT NULL;
     - `updated_at` TEXT NOT NULL.
     
     Index on `user_id`.
   - **`agent_messages`:**
     - `id` TEXT PRIMARY KEY;
     - `conversation_id` TEXT NOT NULL;
     - `user_id` TEXT NOT NULL;
     - `seq` INTEGER NOT NULL;
     - `role` TEXT NOT NULL (`user` or `assistant`);
     - `content` TEXT NOT NULL;
     - `status` TEXT;
     - `ai_status` TEXT;
     - `evidence_json` TEXT;
     - `trajectory_json` TEXT;
     - `stats_json` TEXT;
     - `created_at` TEXT NOT NULL.
     
     A unique index on `(conversation_id, seq)`, and an index on `user_id`.
   - **`agent_artifacts`:**
     - `id` TEXT PRIMARY KEY;
     - `user_id` TEXT NOT NULL;
     - `conversation_id` TEXT;
     - `kind` TEXT NOT NULL (`code`, `report_html` or `report_pdf`);
     - `title` TEXT NOT NULL;
     - `language` TEXT;
     - `content` TEXT (code or HTML);
     - `data` BLOB (PDF bytes);
     - `created_at` TEXT NOT NULL.
     
     An index on `user_id`.
   
   Every statement uses `IF NOT EXISTS`, as the existing ones do, so existing databases upgrade on the next start.
2. **Complete delete:** `vitagraph/backend/app/services/user_service.py` lines 101–115 (anchor `db.execute("DELETE FROM history_events WHERE user_id = ?", (user_id,))`).
   - Before the `DELETE FROM users` line, delete the persona's rows from `agent_artifacts`, `agent_messages`, `agent_conversations` and `ai_calls`.
   - Today `ai_calls` rows survive a persona delete, although the docstring promises "every derived record" (open issue O-11).
   - Update the returned `records` text to also name "agent conversations, artifacts, AI call records".
3. **Settings sentence:** in `site design/src/pages/SettingsPage.tsx`, extend the persona-delete description added in task A8 to: "… raw files, AI Agent folder, AI Agent conversations, artifacts and AI call records."
4. **Tests:** create `vitagraph/backend/tests/test_agent_store_schema.py`.
   - **`test_agent_tables_exist`:** after `init_db()`, `sqlite_master` lists the three tables.
   - **`test_deleting_a_persona_removes_agent_rows_and_ai_calls`:**
     1. Make a persona with `make_user`.
     2. Insert one row into each of the three tables and into `ai_calls` with plain SQL.
     3. Call `user_service.delete_user`.
     4. Count zero rows for that `user_id` in all four tables.

**How to verify**
1. `cd vitagraph\backend; .venv\Scripts\python.exe -m pytest tests\test_agent_store_schema.py -q -p no:cacheprovider`. The output reads `2 passed`.
2. Full suite: baseline + 2 (section 5.1).
3. `cd "site design"; npm run build`. It must exit 0.

**Acceptance criteria**
- [ ] The three tables exist on a fresh and on an existing database.
- [ ] A persona delete leaves no agent rows and no `ai_calls` rows.
- [ ] Full suite: baseline + 2. No existing test was edited.

---

### Task D2 — Conversation store and routes (session resume)

- **Goal:** Every finished agent turn is stored as a user message and an assistant message, with its evidence, trajectory and stats. Three routes list, open and delete a persona's conversations.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** D1
- **Files to read first:**
  - `vitagraph/backend/app/services/agent_service.py` lines 78–135 (anchor `def _persist_turn(`) and lines 136–395 (anchor `async def stream_agent(`)
  - `vitagraph/backend/app/routes/agent.py`
  - `vitagraph/backend/app/schemas/agent.py`
  - `vitagraph/backend/tests/test_agent_service.py` lines 18–90 (anchor `def _collect(user_id, turns, *, pool, conversation_id=None, report_id=None):`)
- **Files to create or modify:**
  - create `vitagraph/backend/app/services/conversation_service.py`
  - modify `vitagraph/backend/app/services/agent_service.py`
  - modify `vitagraph/backend/app/schemas/agent.py`
  - modify `vitagraph/backend/app/routes/agent.py`
  - create `vitagraph/backend/tests/test_agent_conversations.py`

**What to change**
1. **Create `conversation_service.py`**, with these functions:
   - **`record_turn(user_id, conversation_id, question, final, trajectory, stats)`:**
     - Create the conversation row if it is missing. Its title is `final["session_title"]` when present, else the first 80 characters of the question.
     - Append two messages with the next `seq` numbers:
       - the user message with the question;
       - the assistant message with `summary_text`, `status`, `ai_status`, the evidence list, the trajectory and the stats, the last three as JSON text.
     - Update `updated_at`.
     - It never raises. Errors are logged, as `_persist_turn` does.
   - **`list_conversations(user_id)`:** each conversation's `id`, `title`, `updated_at` and message count, newest first.
   - **`get_conversation(user_id, conversation_id)`:** the conversation with its messages in `seq` order and the JSON fields decoded. It raises `HTTPException(404)` when the conversation does not exist **or belongs to another persona**.
   - **`delete_conversation(user_id, conversation_id)`:** deletes the conversation, its messages and its artifacts, with the same 404 rule.
2. **`_TurnRecorder`:** in `agent_service.py`, add a small class that only **observes** events. It collects `thinking`, `tool_call` and `tool_result` items into a trajectory list (tool results trimmed to 4,000 characters of JSON each) and keeps the last `stats` payload.
   - In `stream_agent`, every event that is yielded is also passed to the recorder, at the mapper loop (`vitagraph/backend/app/services/agent_service.py` line 278, anchor `for ev in mapper.feed(msg):`) and wherever stats are yielded.
   - The yielded events, their order and their payloads stay exactly the same. The existing tests pin the order, for example `["text_delta","completed","done"]` for refusals.
3. **Store the turn:** `_persist_turn` (lines 78–135, anchor `def _persist_turn(`) gets two keyword-only parameters, `trajectory=None` and `stats=None`.
   - After `question_service._persist(...)` succeeds, it calls `conversation_service.record_turn(user_id, conversation_id, question, final, trajectory or [], stats or {})`.
   - All four existing call sites keep working unchanged. The harness path passes the recorder's data.
4. **Schemas:** in `vitagraph/backend/app/schemas/agent.py`, add:
   - `ConversationSummaryOut`: `id`, `title`, `updated_at`, `message_count`;
   - `ConversationMessageOut`: `seq`, `role`, `content`, `status`, `ai_status`, `evidence` (list), `trajectory` (list), `stats` (dict), `created_at`;
   - `ConversationOut`: `id`, `title`, `messages`.
5. **Routes** in `vitagraph/backend/app/routes/agent.py`, after `agent_stream` (lines 69–80, anchor `async def agent_stream(`). Each takes a `user_id` query parameter and calls `user_service.user_exists` first.
   - `GET /api/agent/conversations` returns a list of `ConversationSummaryOut`.
   - `GET /api/agent/conversations/{conversation_id}` returns `ConversationOut`.
   - `DELETE /api/agent/conversations/{conversation_id}` returns `{"deleted": <id>}`.
6. **Tests:** create `vitagraph/backend/tests/test_agent_conversations.py`. Import `FakePool` and `_collect` from `tests.test_agent_service`; the existing file is imported, never edited. Use the refusal path, which needs no AI ("Do I have diabetes? Please diagnose me."), with `conversation_id="conv_test1"`.
   - **`test_a_refused_turn_is_stored_and_listed`:** the list route shows `conv_test1` with 2 messages, and the get route returns the question and the refusal text.
   - **`test_another_persona_cannot_open_the_conversation`:** a get with a second persona's `user_id` returns 404.
   - **`test_deleting_a_conversation_removes_it`:** delete returns 200, and a following get returns 404.

**How to verify**
1. `.venv\Scripts\python.exe -m pytest tests\test_agent_conversations.py tests\test_agent_service.py -q -p no:cacheprovider`. Both files pass. The second one proves the event order did not change.
2. Full suite: baseline + 3.

**Acceptance criteria**
- [ ] The three routes exist with exactly these methods and paths, and a foreign persona gets 404.
- [ ] `tests/test_agent_service.py` passes unchanged.
- [ ] Full suite: baseline + 3.

---

### Task D3 — Mapper reads the harness's real field names

- **Goal:** The event mapper reads the retry number from the harness's own field `retry`, and shortens tool names of both MCP servers.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `vitagraph/backend/app/agent/mapper.py` lines 198–226 (anchor `prefix = "mcp__vitagraph__"`) and lines 272–281 (anchor `attempt = d.get("attempt") if isinstance(d.get("attempt"), int) else self._retries`)
  - `vitagraph/backend/tests/test_agent_mapper.py`
- **Files to create or modify:**
  - modify `vitagraph/backend/app/agent/mapper.py`
  - create `vitagraph/backend/tests/test_agent_mapper_harness_fields.py`

**What to change**
1. **Retry number:** `vitagraph/backend/app/agent/mapper.py` line 275 (anchor `attempt = d.get("attempt")`). Take the attempt from `retry` when it is an integer (the harness field), else from `attempt` when it is an integer, else from the counter.
   - The existing test that feeds `{"attempt": 1}` and expects 1, then `{}` and expects 2, keeps passing.
   - The `provider` field is never copied into any event (rule 6).
2. **Tool names:** `vitagraph/backend/app/agent/mapper.py` lines 202–203 (anchor `prefix = "mcp__vitagraph__"`). Strip either prefix, `mcp__vitagraph__` or `mcp__vgartifacts__`, to get the short tool name. Apply the same rule wherever the mapper shortens names.
3. **Tests:** create `vitagraph/backend/tests/test_agent_mapper_harness_fields.py`.
   - **`test_retry_uses_the_harness_field`:** feeding `llm/retry` with `{"retry": 3, "provider": "x"}` gives `attempt` 3, and the word "x" appears in no payload.
   - **`test_artifact_tool_names_are_shortened`:** a `tool/call` named `mcp__vgartifacts__show_code` gives tool `show_code`.

**How to verify**
1. `.venv\Scripts\python.exe -m pytest tests\test_agent_mapper.py tests\test_agent_mapper_harness_fields.py -q -p no:cacheprovider`. Both files pass.
2. Full suite: baseline + 2.

**Acceptance criteria**
- [ ] `retry` is read first, and the old test still passes.
- [ ] Both prefixes are shortened.
- [ ] Full suite: baseline + 2.

---

### Task D4 — Artifact service: code, and HTML and PDF reports built only from the persona's data

- **Goal:** Store code artifacts, and build HTML and PDF reports from the persona's real reports, values and changes. Two routes create and serve them.
- **Tier:** Could
- **Size:** L · hard
- **Review:** gate
- **Depends on:** D1
- **Files to read first:**
  - `vitagraph/backend/app/services/report_service.py` lines 380–390 (anchor `ORDER BY r.upload_time DESC`), plus the functions `compare_reports` and `get_pages`
  - `vitagraph/backend/app/routes/reports.py` lines 85–88 (anchor `def report_measurements(report_id: str) -> list[dict]:`)
  - `vitagraph/backend/requirements.txt` (PyMuPDF is already installed)
- **Files to create or modify:**
  - create `vitagraph/backend/app/services/artifact_service.py`
  - modify `vitagraph/backend/app/schemas/agent.py`
  - modify `vitagraph/backend/app/routes/agent.py`
  - create `vitagraph/backend/tests/test_agent_artifacts.py`

**Facts checked by the planner in PyMuPDF 1.26.4:**
- The backend imports it as `pymupdf`: `vitagraph/backend/app/services/report_service.py` line 367 (anchor `import pymupdf`). Use the same name.
- `pymupdf.Story(html, user_css, em, archive)` lays out HTML.
- `story.place(rect)` returns `(more, filled)`, and `story.draw(device)` draws it.
- `pymupdf.DocumentWriter(BytesIO)` provides `begin_page(mediabox)`, `end_page()` and `close()`.
- `pymupdf.paper_rect("a4")` gives the A4 page size.

**What to change**
1. **Create `artifact_service.py`**, with these functions:
   - **`create_code(user_id, conversation_id, title, language, code)`:**
     - Limits: title 1–120 characters, language 1–30 characters, code 1–20,000 characters. Raise `ValueError` beyond them.
     - Store kind `code` and return the summary dict: `artifact_id`, `kind`, `title`, `language`, `lines`, `created_at`.
   - **`build_report_html(user_id, title)`:** a self-contained HTML document built only from:
     - the persona's display label;
     - `report_service.list_reports(user_id)`, giving each report's filename, printed date or "Undated", and page count;
     - for every ready report, `measurement_service.list_report_measurements(report_id)`, giving a table of test, value, unit, the printed reference range or "Not printed", the flag, and the page;
     - when at least two reports exist, `report_service.compare_reports(user_id)` rows, giving a "Changes between <baseline> and <follow-up>" table.
     
     Every value is HTML-escaped. The document states:
     - the generation time;
     - the source sentence "Generated by VitaGraph from <n> stored reports for this persona. Values are copied exactly as printed in the reports.";
     - the line "This is not a diagnosis.".
     
     It is styled with inline CSS: an Archivo, then Arial, then sans-serif font stack; black text on white; 2 px rules; no images; no scripts. With no reports, it states "This persona has no reports yet." and contains no tables.
   - **`create_report(user_id, conversation_id, fmt, title)`:**
     - `fmt` is `html` or `pdf`.
     - For `html`, store kind `report_html` with the HTML.
     - For `pdf`, render the same HTML to A4 pages with `pymupdf.Story` and `pymupdf.DocumentWriter`: 36 pt margins, placing and drawing until `more` is 0. Store kind `report_pdf` with the bytes.
     - Return the summary dict with `kind`, `title`, `pages` (for PDF) and `created_at`.
   - **`get_artifact(user_id, artifact_id)`:** the stored row, or `HTTPException(404)` when it is missing or belongs to another persona.
2. **Schemas:** in `schemas/agent.py`, add:
   - `ReportArtifactRequest`: `user_id`, optional `conversation_id`, `format` (`html` or `pdf`), and `title`, defaulting to "Health report summary" (max 120);
   - `ArtifactOut`: `artifact_id`, `kind`, `title`, `language`, `lines`, `pages`, `created_at`.
3. **Routes** in `routes/agent.py`:
   - **`POST /api/agent/artifacts/report`:** calls `user_service.user_exists` and `create_report`, and returns `ArtifactOut`. This lets the page's "Make a report" control (D10), and the `/report` command when D8 is done, make a report without the model.
   - **`GET /api/agent/artifacts/{artifact_id}`** with a `user_id` query: serves code as `text/plain; charset=utf-8`, HTML as `text/html; charset=utf-8` and PDF as `application/pdf`.
     - Add `Content-Disposition: inline; filename="<safe title>.<ext>"`.
     - Add the header `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`, so a stored HTML report can never run a script.
4. **Tests:** create `vitagraph/backend/tests/test_agent_artifacts.py`.
   - **`test_html_report_contains_exactly_the_persona_values`:**
     1. Upload `synthetic_panel_2025-01-15.pdf` for persona A, and the 06-20 panel for persona B.
     2. A's HTML report contains each of A's measurement values from `list_report_measurements`.
     3. It contains B's vitamin D value 34 nowhere in a "Vitamin D" row.
   - **`test_pdf_report_is_a_real_pdf`:** the bytes start with `%PDF`, and `pymupdf.open(stream=…)` has at least one page whose text contains "VitaGraph".
   - **`test_artifacts_are_private_to_their_persona`:** a GET with persona B's `user_id` for A's artifact returns 404.
   - **`test_code_artifact_round_trip`:** `create_code`, then a GET with the same persona returns the same text as `text/plain`.

**How to verify**
1. `.venv\Scripts\python.exe -m pytest tests\test_agent_artifacts.py -q -p no:cacheprovider`. The output reads `4 passed`.
2. Full suite: baseline + 4.

**Acceptance criteria**
- [ ] Reports contain only values returned by the persona's own report and measurement services. Nothing is invented: no averages, no advice, no "typical" ranges.
- [ ] A foreign persona gets 404, and HTML is served with the no-script policy.
- [ ] Full suite: baseline + 4.

---

### Task D5 — Artifact MCP server and the opt-in lockdown

- **Goal:** Give the agent two artifact tools, `show_code` and `create_report`, through a second MCP server. Personas get it only when `agent_artifacts` is on. The default four-tool lockdown is unchanged.
- **Tier:** Could
- **Size:** M
- **Review:** gate
- **Depends on:** D3, D4
- **Files to read first:**
  - `vitagraph/backend/app/agent/mcp_server.py` lines 20–40 (anchor `def _persona() -> str:`) and lines 143–150 (anchor `def create_server(persona: str) -> MCPServer:`)
  - `vitagraph/backend/app/agent/profile.py` lines 17–22 (anchor `TOOL_NAMES = (`), lines 43–48 (anchor `class PersonaProfile:`), lines 72–90 (anchor `def mcp_patch_text(`) and lines 145–192 (anchor `def profile_for(`)
  - `vitagraph/backend/app/agent/lockdown.py` lines 19–26 (anchor `def assert_locked_down(tool_names: list[str]) -> None:`) and lines 57–66 (anchor `prof = profile or profile_for(persona_id, fast_fail=True)`)
  - `vitagraph/backend/app/agent/runtime.py` lines 290–294 (anchor `assert_locked_down(tool_names)`)
  - `vitagraph/backend/app/agent/pool.py` line 145 (anchor `prof = profile_for(persona_id)`)
  - `vitagraph/backend/app/agent/prompt.py`
  - `vitagraph/backend/tests/test_agent_profile.py` lines 110–129 (anchor `def test_the_agent_prompt_keeps_every_boundary_of_the_chat_prompt():`)
- **Files to create or modify:**
  - create `vitagraph/backend/app/agent/artifact_server.py`
  - modify `vitagraph/backend/app/agent/profile.py`
  - modify `vitagraph/backend/app/agent/lockdown.py`
  - modify `vitagraph/backend/app/agent/runtime.py`
  - modify `vitagraph/backend/app/agent/pool.py`
  - modify `vitagraph/backend/app/agent/prompt.py`
  - modify `vitagraph/backend/app/core/config.py`
  - create `vitagraph/backend/tests/test_agent_artifact_tools.py`

**What to change**
1. **Create `artifact_server.py`**, modelled on `mcp_server.py`: the same `_persona()` environment check, a `create_server(persona)` function that builds an `MCPServer("vgartifacts")`, and a `main()` that runs it on stdio. The server has exactly two tools:
   - **`show_code(title, language, code)`:** calls `artifact_service.create_code` for the persona, with the conversation ID from the environment variable `VITAGRAPH_CONVERSATION_ID` when it is set.
   - **`create_report(format, title)`:** calls `artifact_service.create_report`.
   
   Both return JSON text `{"artifact": {...summary...}}`, and `{"error": "<reason>"}` on a `ValueError`. The tool descriptions say plainly that they only display code or file a report built from the stored data, and never read anything new.
2. **`profile.py`:**
   - **`ARTIFACT_TOOL_NAMES`:** a tuple of `mcp__vgartifacts__create_report` and `mcp__vgartifacts__show_code`.
   - **`PersonaProfile`:** add a final field `artifacts: bool = False`. The dataclass stays frozen, and existing constructions keep working.
   - **`artifact_mcp_patch_text(persona_id, command, args, cwd, env_extra=None)`:** the same YAML shape as `mcp_patch_text`, but for the server name `vgartifacts` and the module `app.agent.artifact_server`. `mcp_patch_text` stays byte-for-byte unchanged, because a test pins it.
   - **`profile_for(..., artifacts: bool = False)`:** a new keyword. When true, it writes `artifacts.patch.yml` with that text, adds it to `patch_files`, writes the prompt patch with `agent_prompt(True)` instead of `AGENT_SYSTEM_PROMPT`, and returns `artifacts=True`.
3. **`lockdown.py`:**
   - `assert_locked_down(tool_names, *, allow_artifacts=False)`: the expected set is `TOOL_NAMES`, plus `ARTIFACT_TOOL_NAMES` only when `allow_artifacts` is true. Anything else raises `LockdownViolation`, as today.
   - `verify_lockdown_async` passes `allow_artifacts=prof.artifacts`.
4. **`runtime.py`:** at line 294 (anchor `assert_locked_down(tool_names)`), pass `allow_artifacts` from the profile the runtime was started with.
5. **`pool.py`:** at line 145 (anchor `prof = profile_for(persona_id)`), pass `artifacts=settings.agent_artifacts`.
6. **`config.py`:** add `agent_artifacts: bool = True` next to `allow_api` (`vitagraph/backend/app/core/config.py` line 42, anchor `allow_api: bool = False`).
7. **`prompt.py`:** keep `AGENT_SYSTEM_PROMPT` exactly as it is; tests pin it. Add `agent_prompt(artifacts: bool) -> str`:
   - With false, it returns `AGENT_SYSTEM_PROMPT`.
   - With true, it returns the same text with two replacements:
     - "four specialized health tools and NO other tools:" becomes "four specialized health tools for reading the person's data:";
     - the line "- You have no other tools. You must never claim to execute system commands or access external files." becomes "- Besides these four and the two display tools below, you have no tools. You cannot run commands or open files; never claim to."
     
     Then it appends a "DISPLAY TOOLS" section: `show_code` displays code you wrote for the person (title, language, code). `create_report` files an HTML or PDF report built by VitaGraph from their stored reports. Never put values in a report yourself; the report is built from the stored data.
   - The variant must also avoid the words shell, bash, powershell and "file system".
8. **Tests:** create `vitagraph/backend/tests/test_agent_artifact_tools.py`.
   - **`test_the_artifact_server_offers_exactly_two_tools`:** list the tools of `artifact_server.create_server(<persona id>)` the same way `tests/test_agent_mcp_server.py` lists the four, and expect exactly `create_report` and `show_code`.
   - **`test_lockdown_accepts_six_only_when_artifacts_are_allowed`:**
     - the six names pass with `allow_artifacts=True`;
     - the same six fail without it;
     - five names plus an unknown one fail with it.
   - **`test_default_profile_writes_no_artifact_patch`:** `profile_for` with a valid ID writes no `artifacts.patch.yml`, while `profile_for(..., artifacts=True)` writes it and returns `artifacts=True`.

**How to verify**
1. `.venv\Scripts\python.exe -m pytest tests\test_agent_artifact_tools.py tests\test_agent_profile.py tests\test_agent_mcp_server.py -q -p no:cacheprovider`. All pass. The two older files prove the four-tool lockdown is unchanged.
2. Full suite: baseline + 3.

**Acceptance criteria**
- [ ] The default lockdown still accepts exactly the four tools, and the three pinned tests pass unchanged.
- [ ] Artifact tools appear only in profiles built with `artifacts=True`.
- [ ] `AGENT_SYSTEM_PROMPT` is unchanged (`git diff` shows only the added function).
- [ ] Full suite: baseline + 3.

---

### Task D6 — Frontend API for conversations; the chat hook can resume

- **Goal:** Add a typed client for the conversation routes, and extend `useAgentChat` so a stored conversation can be loaded and continued.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** D2
- **Files to read first:**
  - `site design/src/hooks/useAgentChat.ts`
  - `site design/src/api/client.ts`
- **Files to create or modify:**
  - create `site design/src/api/agent.ts`
  - modify `site design/src/hooks/useAgentChat.ts`

**What to change**
1. **Create `site design/src/api/agent.ts`.** It holds the interfaces `ConversationSummary`, `ConversationMessage` and `Conversation`, matching the D2 schemas, and an object `agentApi` with:
   - `listConversations(userId)`, calling `GET /api/agent/conversations?user_id=`;
   - `getConversation(userId, id)`, calling `GET /api/agent/conversations/{conversation_id}?user_id=`;
   - `deleteConversation(userId, id)`, calling `DELETE /api/agent/conversations/{conversation_id}?user_id=`.
   
   Every ID is encoded with `encodeURIComponent`. Task D10 adds the artifact functions to this file when it is done.
2. **Extend `useAgentChat.ts`:**
   - **`load(userId, conversationId)`:**
     - Fetch the conversation and rebuild the entries from its message pairs: the question, the answer, the status, the evidence, the trajectory, the stats and `aiStatus`.
     - Set the hook's conversation ID reference (`site design/src/hooks/useAgentChat.ts` line 152, anchor `const conversationIdRef = useRef<string | null>(null);`) to that ID.
     - Later `send` calls continue it, sending the stored turns as history exactly as live turns are sent today.
   - **`conversationId`:** expose the current ID for the URL.
   - **Unchanged:**
     - `reset()` still starts a new conversation (line 477, anchor `conversationIdRef.current = null;`);
     - the existing fields, events and cleanup stay the same: the `AbortController` is aborted on unmount and on stop.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.

**Acceptance criteria**
- [ ] Every `agentApi` path matches a D2 route by method and path.
- [ ] `load` restores entries, and the next `send` reuses the loaded conversation ID.
- [ ] The build exits 0.

---

### Task D9 — Conversation list (resume)

- **Goal:** Show the persona's past conversations, open one to resume it, and delete one with a confirmation.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** A2, D6
- **Files to read first:**
  - `site design/src/api/agent.ts`
  - `site design/src/components/ui/index.ts`
- **Files to create or modify:**
  - create `site design/src/components/agent/ConversationList.tsx`

**What to change**
1. **Create `ConversationList.tsx`.**
   - **Props:** `userId`, `currentId`, `onOpen(id)`, `onNew()`, `refreshSignal` (a number).
   - **Loading:** call `agentApi.listConversations`, and reload when `refreshSignal` changes.
   - **States:**
     - loading: `PageState` loading "Loading conversations";
     - error: `PageState` error with "Try again";
     - empty: "No conversations yet. Ask a question to start one."
   - **Rows:** each row is a button (`data-testid="agent-conversation-row"`) showing the title, the date of `updated_at` and the message count. The current conversation is marked with a 4 px left rule in `--color-accent`.
   - **Delete:** a small "Delete" button per row asks "Delete this conversation?" with "Delete" and "Cancel", then calls `agentApi.deleteConversation` and reloads.
   - **Wrapper:** a `nav` with `aria-label="Conversations"` and `data-testid="agent-conversations"`. It has a "New conversation" `btn btn-primary` at the top.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.

**Acceptance criteria**
- [ ] The list uses only the D2 routes for listing and deleting conversations.
- [ ] Loading, empty and error states are present.
- [ ] The build exits 0.

---

### Task D11 — The AI Agent page as a harness

- **Goal:** Wire the conversation list, resume through the URL, the visible thinking, tool-call and result loop, and the run and session statistics into `/agent`. Keep every working behaviour and test ID. The optional tasks D7, D8 and D10 plug into this page later.
- **Tier:** Must
- **Size:** L · hard
- **Review:** gate
- **Depends on:** D6, D9
- **Files to read first:**
  - `site design/src/pages/AgentPage.tsx`
  - `site design/src/components/agent/TrajectoryPanel.tsx`
  - `site design/src/components/agent/ConversationList.tsx`
- **Files to create or modify:**
  - modify `site design/src/pages/AgentPage.tsx`
  - modify `site design/src/components/agent/TrajectoryPanel.tsx`

**What to change**
1. **Layout:**
   - At 1024 px and wider, a 280 px conversation column on the left and the existing chat column on the right.
   - Below 1024 px, the list opens as a full-width panel from a "Conversations" button in the page header row.
   - Both keep the `vg-gutter` rules from A10.
2. **Resume through the URL:** `?c=<conversation_id>`.
   - On load, when `c` is present, call `chat.load(userId, c)`.
   - After every `send`, write the hook's `conversationId` to `c` with `replace`, so a reload resumes the same conversation.
   - "New conversation" clears `c` and calls `chat.reset()`.
   - The existing `report` and `q` parameters keep working (`site design/src/pages/AgentPage.tsx` lines 228–236, anchor `// Header search hands a question over as ?q=`).
3. **The visible loop:** `TrajectoryPanel` (`site design/src/components/agent/TrajectoryPanel.tsx` line 139, anchor `export const TrajectoryPanel: React.FC<{ entry: AgentEntry }> = ({ entry }) => {`) already shows status, steps, reasoning and tool cards. Keep it, and add a **run stats line** at its top:
   - the elapsed time (`stats.elapsedMs`);
   - the number of tool calls (`stats.toolCalls`);
   - the input and output tokens (`stats.inputTokens`, `stats.outputTokens`) from the hook's `AgentStats` (`site design/src/hooks/useAgentChat.ts` lines 32–38, anchor `export interface AgentStats {`). They are `null` when the backend sent none.
   
   A count the backend did not send is left out, never shown as 0.
4. **Session totals:** a line above the messages shows the conversation's total answers, tool calls and tokens, summed from the entries' stats. A total is left out when no entry has that number.
5. **Keep:**
   - the B9 "Show in graph" button (when B9 is done);
   - the C4 `aiUsed` evidence text;
   - the C5 offline handling;
   - the A10 states.
   - Keep these test IDs: `agent-page`, `agent-empty`, `agent-composer`, `agent-input`, `agent-trajectory`, `agent-stats`, `agent-modules`.

**How to verify**
1. `cd "site design"; npm run build; npm run audit:design`. Both must exit 0.
2. Browser as "Empty Test Persona", with the AI off (as in C4):
   - Ask "What was my vitamin D result?", then reload. The conversation is restored from `?c=…` and appears in the list.
   - Start a new conversation, then open the first one again from the list.
3. **Needs the AI** (rule 9): with the AI on, ask the same question.
   - The loop shows the tool calls with their arguments and results.
   - The stats line shows the time, the tool calls and the tokens.
   - If the gateway refuses, paste the error frame and write `API blocked`.

**Acceptance criteria**
- [ ] Resume through `?c=` works after a reload.
- [ ] The run stats line and the session totals show only numbers the backend sent.
- [ ] All listed test IDs exist.
- [ ] The build and the audit exit 0.

---

### Task D7 — Display modes: Minimal, Standard, Detailed

- **Goal:** Let a person choose how much of the agent's loop is shown. The choice persists and maps to the harness's compact, standard and detailed modes.
- **Tier:** Could
- **Size:** M
- **Review:** light
- **Depends on:** D11
- **Files to read first:**
  - `site design/src/components/agent/TrajectoryPanel.tsx`
  - `site design/src/lib/preferences.ts`
  - `site design/src/pages/AgentPage.tsx`
- **Files to create or modify:**
  - modify `site design/src/lib/preferences.ts`
  - modify `site design/src/components/agent/TrajectoryPanel.tsx`
  - modify `site design/src/pages/AgentPage.tsx`

**What to change**
1. **Preference:** in `preferences.ts`, add `agentDisplay` with the values `"minimal"`, `"standard"` or `"detailed"`, default `"standard"`, validated in `load()` like `graphView` (B7).
2. **`TrajectoryPanel`** takes a new prop, `mode`:
   - **Minimal (compact):** only one status line and the run stats line from D11. The steps are hidden.
   - **Standard:** the view as it is after D11. Each tool call is one row with its name, an arguments summary and its duration. Reasoning is collapsed, and raw results sit behind `agent-raw-toggle`.
   - **Detailed:** everything is expanded. The reasoning text, each tool's full arguments and raw result, and the step numbers are shown.
   - Keep these test IDs: `agent-trajectory`, `agent-tool-card`, `agent-raw-toggle`, `agent-raw`, `agent-stats`.
3. **Page control:**
   - In `AgentPage.tsx`, add a `seg` control "Minimal · Standard · Detailed" above the messages, with `data-testid="agent-display-mode"`, bound to `usePreferences().agentDisplay` and `setPreference`.
   - Pass the mode to every `TrajectoryPanel`.
   - In Minimal, the evidence modules stay visible. Only the loop is condensed.
4. **Only when D8 is done:** register the command `/mode minimal|standard|detailed`, which sets the preference when the argument is valid.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser: switch the three modes on an answered entry. The loop view changes, and the choice survives a reload.

**Acceptance criteria**
- [ ] Three modes exist, and an unknown stored value falls back to standard.
- [ ] The five test IDs still exist.
- [ ] The build exits 0.

---

### Task D8 — Slash commands and the command menu

- **Goal:** Typing `/` in the composer opens a command menu. Commands run locally and are never sent to the model, and unknown commands are rejected, as in the harness.
- **Tier:** Could
- **Size:** M
- **Review:** light
- **Depends on:** D11
- **Files to read first:**
  - `site design/src/pages/AgentPage.tsx` lines 449–498 (anchor `data-testid="agent-composer"`)
  - `site design/src/api/agent.ts`
- **Files to create or modify:**
  - create `site design/src/components/agent/commands.ts`
  - create `site design/src/components/agent/CommandMenu.tsx`
  - modify `site design/src/pages/AgentPage.tsx`

**What to change**
1. **Create `commands.ts`.** It exports:
   - a small registry: `registerCommand({ name, args, description, run })` and `listCommands()`;
   - `parseCommand(text)`, which returns `{ name, arg }` for text starting with `/`, or null. The name is lower-case and the argument is trimmed.
   
   It registers four commands:
   - `/help`: "List the commands."
   - `/new`: "Start a new conversation."
   - `/history`: "Open your past conversations."
   - `/stats`: "Show the statistics of the last answer."
   
   D7 adds `/mode` and D10 adds `/report` through `registerCommand` when they are done.
2. **Create `CommandMenu.tsx`.**
   - **Props:** `query` (the text after `/`), `onPick(name)` and `onClose`.
   - **Rendering:** a listbox (`role="listbox"`, `data-testid="agent-command-menu"`) of the matching commands, positioned above the composer, with `--color-bg`, a 2 px rule and `--shadow-md`.
   - **Keyboard:**
     - Up and Down move the active option (`aria-activedescendant`).
     - Enter or Tab fills the composer with the command name and a space.
     - Escape closes the menu.
3. **Wire it in the page:** in `AgentPage.tsx`, the composer runs `parseCommand` before `submit`.
   - A known command runs locally and adds a local entry marked "Command". Local entries are never sent to the model.
   - An unknown name adds the local entry "Unknown command /x. Type /help for the list."
   - The menu shows while the input starts with `/` and contains no space.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser:
   - `/help` lists the commands, `/new` starts a new conversation, `/history` opens the list, and `/stats` shows the last answer's line.
   - `/foo` answers "Unknown command /foo". No request to `/api/agent/stream` appears in DevTools > Network.

**Acceptance criteria**
- [ ] The four base commands work, and unknown ones are rejected locally.
- [ ] The menu is fully usable with the keyboard.
- [ ] The build exits 0.

---

### Task D10 — Artifact cards with a subtle 3D effect that stays readable

- **Goal:** Show code and report artifacts as cards. A card tilts very slightly in 3D and lifts on hover or focus, stays flat when motion is reduced, and its text is always sharp and easy to read. It also lets a person make a report from the page.
- **Tier:** Could
- **Size:** M
- **Review:** light
- **Depends on:** D4, D11
- **Files to read first:**
  - `site design/src/api/agent.ts`
  - `site design/src/hooks/useAgentChat.ts` lines 42–57 (anchor `export interface AgentEntry {`) and line 278 (anchor `case "tool_result": {`)
  - `site design/src/index.css` lines 1032–1043 (anchor `.agent-evidence-row:hover`)
- **Files to create or modify:**
  - modify `site design/src/api/agent.ts`
  - modify `site design/src/hooks/useAgentChat.ts`
  - create `site design/src/components/agent/ArtifactCard.tsx`
  - modify `site design/src/index.css`
  - modify `site design/src/pages/AgentPage.tsx`

**What to change**
1. **Client:** in `agent.ts`, add the interface `ArtifactSummary`, matching D4's `ArtifactOut`, and two functions:
   - `createReport(userId, format, title, conversationId?)`, calling `POST /api/agent/artifacts/report`;
   - `artifactUrl(userId, artifactId)`, building the full `BASE_URL` address of `GET /api/agent/artifacts/{artifact_id}?user_id=`.
2. **Hook:**
   - Add `artifacts: ArtifactSummary[]` to `AgentEntry`. Fill it in the `tool_result` case when the result has an `artifact` object; that happens only when D5 is done and the AI runs.
   - Add `addArtifact(entryId, artifact)`.
3. **CSS:** append to `site design/src/index.css` a class `.artifact-card` and its states.
   - **Resting:** a flat card with background `--color-bg`, a 2 px top rule in `--color-text`, no radius, no shadow, `transform: none`, and a transition of `transform` and `box-shadow` over 160 ms.
   - **Hover and focus-within:**
     - `transform: perspective(900px) rotateX(1.5deg) rotateY(-1.5deg) translateY(-2px)`;
     - `box-shadow: var(--shadow-md)`. The card is now floating, so a shadow is allowed.
   - **Readability:**
     - The tilt is at most 1.5 degrees.
     - `backface-visibility: hidden` and `-webkit-font-smoothing: antialiased` keep the text crisp.
     - Never blur, and never scale the text.
   - **Reduced motion:** under `@media (prefers-reduced-motion: reduce)` and under `:root[data-reduce-motion="true"]` (set by `lib/preferences.ts`), the card has no transform and no transition, only the shadow on hover.
4. **Create `ArtifactCard.tsx`.**
   - **Props:** `artifact`, `userId`, and for code, the code text.
   - **Wrapper:** an `article` with class `artifact-card`, `data-testid="agent-artifact"`, `data-kind`, and `tabIndex={0}` so keyboard focus shows the same lift.
   - **Header:** a kicker ("Code", "HTML report" or "PDF report"), the title in bold, and a line with:
     - the language and line count for code;
     - the page count for PDF;
     - the creation time.
   - **Code:** the text in a `pre` with `white-space: pre-wrap` and `overflow-wrap: anywhere`, in Archivo at 0.875rem with a line height of 1.6 (open issue O-8). Below it:
     - a "Copy" button, which writes to the clipboard and shows "Copied" for 2 seconds; the timer is cleared on unmount;
     - "Download", a link to `artifactUrl` with the `download` attribute.
   - **HTML report:**
     - "Open" (a new tab to `artifactUrl`) and "Download";
     - a 360 px preview in an `iframe` with `sandbox=""` (no scripts) and `title` set to the report title.
   - **PDF report:** "Open" and "Download".
5. **Page:**
   - Under each answer, render an `ArtifactCard` for each item in `entry.artifacts`. When the model called `show_code`, the code text comes from that tool call's `code` argument in the trajectory.
   - Add a "Make a report" control with HTML and PDF choices to the page header row.
     1. It calls `createReport(userId, format, "Health report summary", conversationId)`.
     2. It adds a local entry holding the card.
     3. While it runs it shows "Making the report"; on failure, it shows the real error.
   - **Only when D8 is done:** also register `/report html|pdf`, which does the same.

**How to verify**
1. `cd "site design"; npm run build; npm run audit:design`. Both must exit 0.
2. Browser, with the AI off:
   - "Make a report" with PDF gives a PDF card. "Open" shows values equal to `GET /api/reports/<id>/measurements`; paste two.
   - With HTML, the card shows a sandboxed preview.
   - Hovering a card lifts it slightly. With Settings > Reduce motion on, it stays flat.

**Acceptance criteria**
- [ ] The tilt is at most 1.5 degrees, and the card is flat under both reduced-motion signals.
- [ ] There is no blur and no radius. The shadow appears only on the lifted card.
- [ ] The HTML preview is sandboxed.
- [ ] Report values come from the persona's data (pasted).
- [ ] The build and the audit exit 0.

---

### Task D12 — Harness check script

- **Goal:** Add one script that proves the harness features end to end without needing the AI. Optional features are checked only when their task was done.
- **Tier:** Must
- **Size:** M
- **Review:** gate
- **Depends on:** D11
- **Files to read first:**
  - `scripts/plan/e2e_journey.py`
  - `scripts/plan/check_layout.py`
- **Files to create or modify:**
  - create `scripts/plan/agent_harness.py`

**What to change**
1. **Create `scripts/plan/agent_harness.py`** (Playwright, Chrome channel). The setup and the `finally` cleanup follow `e2e_journey.py`:
   - read and restore `allow_api`, setting it to false for the run;
   - create a throwaway persona with consent;
   - upload `synthetic_panel_2025-01-15.pdf` with `POST /api/reports/upload` and the form field `background` set to `false`, so it finishes before the checks start;
   - delete the persona at the end.
   
   **Must checks:**
   1. **Answer and resume:** ask the vitamin D question and wait for `completed`. Reload. The same entry is restored, and `GET /api/agent/conversations?user_id=` lists one conversation with 2 messages.
   2. **List:** the conversation list shows one `agent-conversation-row`. "New conversation" clears the page, and clicking the row restores it.
   3. **Stats:** the run stats line shows an elapsed time.
   
   **Optional checks.** Each runs only when its test ID exists on the page, and otherwise prints "skipped (task not done)":
   - **D7:** each option of `agent-display-mode` changes the number of visible `agent-tool-card` elements.
   - **D8:** `/foo` gives "Unknown command /foo", and no new request is sent to `/api/agent/stream`.
   - **D10:**
     - "Make a report" (HTML) gives an `agent-artifact` with `data-kind="report_html"` whose fetched HTML contains "18" in the vitamin D row and "This is not a diagnosis.";
     - PDF bytes start with `%PDF`;
     - an artifact card's computed `transform` is not `none` on hover, and is `none` after turning on Reduce motion.
   
   End with `RESULT: PASS` or `RESULT: FAIL (...)`.

**How to verify**
1. `$env:PYTHONIOENCODING="utf-8"; python scripts\plan\agent_harness.py`. It ends with `RESULT: PASS` and lists any skipped optional checks.
2. Full backend suite: baseline + 0 (this task adds no backend tests).

**Acceptance criteria**
- [ ] The Must checks pass.
- [ ] Optional checks either pass or say "skipped (task not done)".
- [ ] `RESULT: PASS` (output pasted).

## 12. Workstream E: Tools

What E delivers: the reference's three Tools pages and their sidebar group, built on the shared components from A and the graph views from B:
- Image to Text;
- PDF to Text;
- Text to Graph.

Evidence:
- The reference lists a "Tools" group with "Image to Text" (Picture to text), "PDF to Text" (Digital text layer) and "Text to Graph" (Entities and links): `design/reference/app-v3-source.html` line 1406 (anchor `['h', 'Tools']`). It draws the two text pages at lines 713–737 (anchor `IMAGE TO TEXT`).
- The screenshots are `design/reference/screens/07_Image_to_Text.png`, `08_PDF_to_Text.png` and `09_Text_to_Graph.png`.
- The backend already offers image OCR at `vitagraph/backend/app/routes/tools.py` lines 15–35 (anchor `@router.post("/ocr")`). The route reads the image in memory and never stores it. It returns `engine`, `width`, `height`, `elapsed_ms`, `mean_confidence`, `text` and `lines` (each with `text`, `confidence` in percent, and a `box` in 0–1 coordinates): `vitagraph/backend/app/ingestion/ocr_image.py` lines 62–86 (anchor `"mean_confidence": mean_conf,`).
- **The reference and the backend disagree.** The reference says an image "is read in your browser and never uploaded", but VitaGraph's OCR runs in the backend. This plan follows the backend (repo reality). The page must say instead: "The image is sent to the VitaGraph backend on this computer, read in memory and never stored."
- **No invented samples (rule 3).** The reference's Text to Graph sample text holds made-up values (`design/reference/app-v3-source.html` line 1273, anchor `t2gSample = () =>`), so it is not copied. Samples come only from the real sample PDFs in `site design/public/`.

---

### Task E1 — Tools: shared parts and the API client

- **Goal:** Add the OCR API client and the two layout pieces all three Tools pages share: the input band and the original-and-text split.
- **Tier:** Should
- **Size:** S
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `vitagraph/backend/app/routes/tools.py`
  - `vitagraph/backend/app/ingestion/ocr_image.py` lines 36–86 (anchor `def read_image(data: bytes) -> dict:`)
  - `design/reference/app-v3-source.html` lines 713–737 (anchor `IMAGE TO TEXT`)
  - `site design/src/api/client.ts`
- **Files to create or modify:**
  - create `site design/src/api/tools.ts`
  - create `site design/src/components/tools/ToolInput.tsx`
  - create `site design/src/components/tools/ToolSplit.tsx`

**What to change**
1. **Create `api/tools.ts`.** It holds the interfaces `OcrLine` (`text`, `confidence`, `box` with `x0`, `y0`, `x1`, `y1`), `OcrResult` and `OcrStatus`, and an object `toolsApi` with:
   - `ocrStatus()`, calling `GET /api/tools/ocr/status`;
   - `ocr(file)`, calling `POST /api/tools/ocr` with a form field named `file`, through `api.upload`.
2. **Create `ToolInput.tsx`.** It mirrors the reference's dashed input band.
   - **Props:** `label` (the kicker, for example "Input"), `description`, `accept` (a MIME list), `chooseLabel`, `onFile(file)`, an optional `secondary` button (label and handler), and `disabled`.
   - **Rendering:**
     - a band with a 2 px dashed `--color-divider` border and `--color-surface` background;
     - a visually hidden file input inside a `label` styled `btn btn-primary`, reachable with the keyboard as on the Upload page;
     - drag and drop of one file;
     - `data-testid="tool-input"`.
3. **Create `ToolSplit.tsx`.**
   - **Props:** `left` and `right`, each a section with a `title`, an optional `aside` and `children`.
   - **Layout:** the reference's two-column grid `repeat(auto-fit,minmax(min(380px,100%),1fr))`. Each column has a 2 px top rule in `--color-text` and a header row with the title and the aside.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.

**Acceptance criteria**
- [ ] `toolsApi` calls exactly `GET /api/tools/ocr/status` and `POST /api/tools/ocr`.
- [ ] `ToolInput` is keyboard-usable.
- [ ] The build exits 0.

---

### Task E2 — Image to Text page

- **Goal:** Read the text in a PNG or JPEG through the backend OCR, and show the original image (with a boxes toggle), the text, the line count, the characters and the mean confidence. Mark low-confidence lines "needs review", and offer Copy and Download .md.
- **Tier:** Should
- **Size:** M
- **Review:** light
- **Depends on:** E1, A3, A4
- **Files to read first:**
  - `design/reference/screens/07_Image_to_Text.png`
  - `vitagraph/backend/app/ingestion/ocr_fallback.py` line 68 (anchor `low_confidence = mean_confidence < 60`)
  - `site design/src/components/shell/Sidebar.tsx` lines 70–102 (anchor `const navGroups: { label: string; items: NavItem[] }[] = [`)
  - `site design/src/App.tsx`
- **Files to create or modify:**
  - create `site design/src/pages/tools/ImageToTextPage.tsx`
  - create `site design/src/lib/toolHandoff.ts`
  - modify `site design/src/App.tsx`
  - modify `site design/src/components/shell/Sidebar.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`
  - modify `site design/src/components/shell/Header.tsx`

**What to change**
1. **Create `lib/toolHandoff.ts`:** a module-level, in-memory hand-off for one image between tools: `setHandoffImage(blob, name)` and `takeHandoffImage()`, which returns it once and then clears it. Nothing is stored in the browser. Task E3 uses it.
2. **Create `pages/tools/ImageToTextPage.tsx`**, exporting `ImageToTextPage`, inside `PageFrame` with label "Image to Text".
   - **Engine check:** on mount, call `toolsApi.ocrStatus()`. When the engine is not available, show `PageState` kind offline: "The OCR engine is not available on the backend", with the detail from the status, and no input.
   - **Input:** `ToolInput` accepting `image/png` and `image/jpeg`, with the description "Choose a PNG or JPG. The image is sent to the VitaGraph backend on this computer, read in memory and never stored."
     - Files above 15 MB are refused in the page with the backend's limit text, before any request.
     - On mount, a hand-off image from `takeHandoffImage()` is read at once.
   - **While reading:** `PageState` loading "Reading the image".
   - **On error:** `PageState` error with the backend's message.
   - **Result:**
     - **Stats row:** "<n> lines read · <c> characters · <m>% mean confidence", all from the response. The characters are the length of `text`.
     - **Actions:** "Copy text" (clipboard; "Copied" for 2 s, with the timer cleared on unmount) and "Download .md". The Markdown has a title line, a line with the mean confidence, then each line, with `(needs review)` after low-confidence lines.
     - **`ToolSplit` left, "Original":**
       - the image, from an object URL that is revoked on change and on unmount;
       - a switch "Show boxes" (`data-testid="ocr-boxes-toggle"`) that overlays each line's box as an absolutely positioned outline, scaled from the 0–1 coordinates;
       - boxes of low-confidence lines are drawn in `--color-accent`, the others in `--color-text`.
     - **`ToolSplit` right, "Text":** one row per line with the text and its confidence.
       - A line below 60% confidence is low confidence. That is the same threshold the backend uses to mark a scanned page uncertain.
       - A low-confidence line gets `Tag` tone `uncertain` reading "Needs review", plus `data-review="true"`.
       - The line text is never changed or "corrected".
3. **Route and navigation:**
   - In `App.tsx`, add the route `/tools/image-to-text`, with the page lazy-loaded.
   - In `Sidebar.tsx`, add a group "Tools" between "Analyze" and "System", with the item `{ id: "ocr", path: "/tools/image-to-text", label: "Image to Text", sublabel: "Picture to text" }`. Use the reference's icon path from line 1406 (anchor `['ocr', 'Image to Text'`).
   - Add the route title "Image to Text" to `ROUTE_TITLES`, and the path to `OWN_LAYOUT`.
   - Add a `Header.tsx` case with the subtitle "Read the text in a picture."

**How to verify**
1. `cd "site design"; npm run build; npm run audit:design`. Both must exit 0.
2. Browser:
   - Open PDF to Text after E3, or for now any PNG of a lab report.
   - Choose it. The stats match the `POST /api/tools/ocr` response in DevTools: line count, `mean_confidence`, and `text` length.
   - "Show boxes" draws one outline per line.
   - Every line below 60 shows "Needs review".

**Acceptance criteria**
- [ ] The three stats equal the API response (pasted).
- [ ] Low-confidence lines are marked and never altered.
- [ ] Copy and Download .md work.
- [ ] The boxes toggle works.
- [ ] The engine-unavailable state shows when `available` is false.
- [ ] The build and the audit exit 0.

---

### Task E3 — PDF to Text page (in the browser, with pdfjs-dist)

- **Goal:** Read a PDF's text layer page by page in the browser, show the pages and their text, and send a scanned page (one with no text layer) to Image to Text.
- **Tier:** Should
- **Size:** M
- **Review:** light
- **Depends on:** E2
- **Files to read first:**
  - `design/reference/screens/08_PDF_to_Text.png`
  - `design/reference/app-v3-source.html` line 1355 (anchor `tag: g.native ? 'Native text' : 'No text layer'`)
  - `site design/public/` (the sample PDFs)
  - `site design/src/lib/toolHandoff.ts`
- **Files to create or modify:**
  - modify `site design/package.json`
  - modify `site design/package-lock.json`
  - create `site design/src/pages/tools/PdfToTextPage.tsx`
  - modify `site design/src/App.tsx`
  - modify `site design/src/components/shell/Sidebar.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`
  - modify `site design/src/components/shell/Header.tsx`

**Facts checked by the planner (pdfjs-dist 6.4.299):**
- The entry point is `build/pdf.mjs`, with types at `types/src/pdf.d.ts`, and the worker file is `build/pdf.worker.min.mjs`.
- `GlobalWorkerOptions.workerSrc` must be set.
- `page.render` takes `{ canvas, viewport }`, where `canvas` is required.
- The package's `engines` field asks for Node 22.13 or later. The planner's machine has Node 22.22.

**What to change**
1. **Install:** run `npm install pdfjs-dist@6.4.299 --save-exact` in `site design`. Rule 10 allows exactly this version.
2. **Create `pages/tools/PdfToTextPage.tsx`**, exporting `PdfToTextPage`, lazy-loaded so pdf.js stays out of the main bundle.
   - Set the worker with a Vite `?url` import of `pdfjs-dist/build/pdf.worker.min.mjs`.
   - Load the file with `getDocument({ data })` from the chosen file's bytes.
   - **Input:** `ToolInput` accepting `application/pdf`, with the description "The text layer is read page by page in your browser. Nothing is uploaded." That is true here, because pdf.js runs in the browser.
   - **Secondary buttons:**
     - "Use sample report" loads `/synthetic_panel_2025-01-15.pdf`;
     - "Use scanned sample" loads `/VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf`.
     
     Both files already exist in `site design/public/`.
   - **Per page:**
     - Read `getTextContent()` and join the items' `str`, adding a line break where `hasEOL` is set.
     - Count the characters.
     - Render a thumbnail at a width of 380 px into a canvas.
     - At most 30 pages are processed. A note says "Showing the first 30 of <n> pages." when there are more.
   - **Rows:** each page is one `ToolSplit` row, with "Original p.<n>" on the left (the canvas) and "Text p.<n>" on the right, with `Tag` "Native text" when the text layer has at least 1 character.
   - **Pages with no text layer:**
     - The tag reads "No text layer" in tone `uncertain`.
     - A button "Read with Image to Text" (`data-testid="pdf-send-to-ocr"`) renders that page at scale 2 into a canvas and turns it into a PNG blob.
     - It then calls `setHandoffImage(blob, "<file> p.<n>.png")` and navigates to `/tools/image-to-text`.
   - **Summary row:** "<name> · <c> characters · <n> pages", with "Copy all" and "Download .md". The Markdown is one "## Page n" section per page.
   - **Cleanup:** destroy the pdf.js document (`loadingTask.destroy()`) on change and on unmount. Revoke object URLs. Cancel pending page renders.
   - **States:** loading "Reading the PDF", and error with pdf.js's message.
3. **Route and navigation:** as in E2, add:
   - the route `/tools/pdf-to-text`;
   - the sidebar item `{ id: "pdf", label: "PDF to Text", sublabel: "Digital text layer" }` with the reference icon (line 1406, anchor `['pdf', 'PDF to Text'`);
   - the title "PDF to Text" in `ROUTE_TITLES`, and the path in `OWN_LAYOUT`;
   - a header subtitle "Read the text layer of a PDF."

**How to verify**
1. `cd "site design"; npm run build; npm run audit:design`. Both must exit 0, and the build output shows pdf.js in its own chunk.
2. Browser:
   - "Use sample report" shows each page with text that contains "Vitamin D, 25-Hydroxy". The page count equals the PDF's real page count.
   - "Use scanned sample" marks the scanned page(s) "No text layer". "Read with Image to Text" opens Image to Text with that page and reads it.

**Acceptance criteria**
- [ ] `pdfjs-dist` is at exactly 6.4.299, and no other package changed.
- [ ] Text and counts come from pdf.js.
- [ ] The scanned page is handed to Image to Text in memory.
- [ ] The document is destroyed on unmount.
- [ ] The build and the audit exit 0.

---

### Task E4 — Text to Graph page

- **Goal:** Find biomarker values in pasted text with client-side pattern matching, show them in a table and as a graph with the B renderers, and offer Download JSON.
- **Tier:** Could
- **Size:** M
- **Review:** light
- **Depends on:** E3, B5, B6
- **Files to read first:**
  - `design/reference/screens/09_Text_to_Graph.png`
  - `design/reference/app-v3-source.html` lines 1275–1286 (anchor `const text = this.state.t2gText, re =`)
  - `site design/src/components/graph3d/graphModel.ts`
  - `site design/src/components/graph3d/Graph3D.tsx`
  - `site design/src/components/graph3d/Graph2D.tsx`
- **Files to create or modify:**
  - create `site design/src/lib/textToGraph.ts`
  - create `site design/src/pages/tools/TextToGraphPage.tsx`
  - modify `site design/src/lib/toolHandoff.ts`
  - modify `site design/src/pages/tools/PdfToTextPage.tsx`
  - modify `site design/src/App.tsx`
  - modify `site design/src/components/shell/Sidebar.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`
  - modify `site design/src/components/shell/Header.tsx`

**What to change**
1. **Create `lib/textToGraph.ts`.** It exports `extractEntities(text)` and `toGraph(result)`.
   - **Value pattern:** port the reference's pattern exactly (`design/reference/app-v3-source.html` line 1275, anchor `re = /([A-Za-z][A-Za-z0-9 ()\-]{1,34}?)`): a name, an optional `:` or `=`, a number, and one of the reference's units.
   - **Date pattern:** port the reference's date pattern (line 1276, anchor `const dm = text.match(`).
   - **Skipped names:** the reference skips names starting with report, date, reference, ref or range (line 1277).
   - **Each row:** `name`, `value` (the text exactly as written), `unit`, and the exact character span `start` and `end` in the input.
   - **`toGraph`:** builds `GraphNode`-shaped objects:
     - one `person` node labelled "Document";
     - an optional `date` node;
     - per row, one `test` node and one `measurement` node;
     - edges Document–test and test–measurement, as the reference does.
     
     It returns a `GraphResponse`-shaped object, so `selectNodes`, `Graph3D` and `Graph2D` render it unchanged.
2. **Create `pages/tools/TextToGraphPage.tsx`**, exporting `TextToGraphPage`, inside `PageFrame` with label "Text to Graph".
   - **Input:**
     - a `textarea` (class `input`, at least 190 px high), and a `ToolInput` that reads a `.txt` or `.md` file into it;
     - "Use text from PDF to Text", shown only when a text hand-off is waiting.
       - Add `setHandoffText(text, name)` and `takeHandoffText()` to `toolHandoff.ts`, working like the image pair.
       - Add a button "Send text to Text to Graph" (`data-testid="pdf-send-to-graph"`) to the PDF to Text summary row. It hands over all page texts joined with blank lines and navigates to `/tools/text-to-graph`.
     - There is no invented sample.
   - **Extraction:** runs 300 ms after the last keystroke.
   - **Summary:** "<n> biomarkers · <date> · <nodes> nodes, <edges> edges", or "No values found. The pattern looks for a name, a number and a unit such as mg/dL." when there are none.
   - **Note:** the line "Found by pattern matching, not by reading the meaning. Check each row against the text."
   - **Table:** Biomarker, Value, Unit and Characters (start–end). Clicking a row selects its nodes in the graph.
   - **Graph:**
     - the same view switch and fallback rules as `/graph` (B8), using `Graph3D` (lazy) and `Graph2D`;
     - the inspector shows the selected node's label and its character span, from `DocumentPanel` without `userId`.
   - **Download JSON:** `vitagraph-text-graph.json`, holding the date, the rows with their spans, the nodes and the edges.
3. **Route and navigation:** as in E2, add:
   - the route `/tools/text-to-graph`;
   - the sidebar item `{ id: "t2g", label: "Text to Graph", sublabel: "Entities and links" }`, using the graph icon;
   - the title "Text to Graph" in `ROUTE_TITLES`, and the path in `OWN_LAYOUT`;
   - the header subtitle "Turn report text into a small graph."

**How to verify**
1. `cd "site design"; npm run build; npm run audit:design`. Both must exit 0.
2. Browser: paste the text of `synthetic_panel_2025-01-15.pdf` from PDF to Text.
   - For each row, the text at its character span in the textarea equals the row's name, value and unit. Spot-check three rows in the console with `textarea.value.slice(start, end)`.
   - Download JSON and confirm the counts match the summary.

**Acceptance criteria**
- [ ] No sample data is invented. Every row is found in the input at its stated span.
- [ ] The graph uses the B renderers with the 2D fallback.
- [ ] Download JSON works.
- [ ] The build and the audit exit 0.

---

### Task E5 — Tools check script

- **Goal:** Prove the Tools pages end to end with one re-runnable script, and include them in the layout and accessibility checks.
- **Tier:** Should
- **Size:** S
- **Review:** gate
- **Depends on:** E3
- **Files to read first:**
  - `scripts/plan/check_layout.py`
  - `scripts/plan/check_a11y.py`
- **Files to create or modify:**
  - create `scripts/plan/tools_check.py`

**What to change**
1. **Create `scripts/plan/tools_check.py`** (Playwright, Chrome channel, both servers running). Checks:
   - **PDF to Text:** "Use sample report" gives at least one page whose text contains "Vitamin D".
   - **Scanned hand-off:**
     1. "Use scanned sample" marks at least one page "No text layer".
     2. Its "Read with Image to Text" opens `/tools/image-to-text`.
     3. Capture the `POST /api/tools/ocr` response with `page.on("response")`.
     4. The page's stats equal that response's line count and `mean_confidence`.
     5. The number of "Needs review" rows equals the number of lines below 60.
   - **Text to Graph:**
     - only when `/tools/text-to-graph` exists (E4 done), otherwise print "skipped (task not done)";
     - send the sample's text, and every table row's span slices back to its own text.
   
   End with `RESULT: PASS` or `RESULT: FAIL (...)`.

**How to verify**
1. `$env:PYTHONIOENCODING="utf-8"; python scripts\plan\tools_check.py`. It ends with `RESULT: PASS`.
2. `python scripts\plan\check_layout.py usr_51f14542d71a /tools/image-to-text /tools/pdf-to-text`. Add `/tools/text-to-graph` when E4 is done. It ends with `RESULT: PASS`.
3. `python scripts\plan\check_a11y.py usr_51f14542d71a /tools/image-to-text /tools/pdf-to-text`. Add `/tools/text-to-graph` when E4 is done. It ends with `RESULT: PASS`.

**Acceptance criteria**
- [ ] All three runs print `RESULT: PASS` (outputs pasted).

## 13. Workstream F: Hardening and handover

What F delivers:
- the persona check on the older per-report routes;
- removal of a committed key, with a scan that keeps keys out;
- a named safety test suite for the new agent features;
- updated project documents;
- the paid-API follow-up, which waits for the owner.

---

### Task F1 — Privacy: persona check on the older per-report routes

- **Goal:** The page, measurement and page-image routes check that the report belongs to the asking persona, and the frontend always says who is asking. This closes issue O-3 as far as rule 7 allows (decision DEC-6).
- **Tier:** Must
- **Size:** M
- **Review:** gate
- **Depends on:** A5, A9, A12, B1, B4
- **Files to read first:**
  - `vitagraph/backend/app/routes/reports.py` lines 80–95 (anchor `def report_pages(report_id: str) -> list[dict]:`)
  - `vitagraph/backend/app/services/report_service.py`, the helper `assert_report_owner` added in B1
  - `vitagraph/backend/tests/test_journey_events.py` lines 75–85 (anchor `def test_page_image_endpoint_serves_png():`)
  - `vitagraph/backend/tests/test_measurements.py` lines 21–46 (anchor `def test_measurements_unknown_report_is_404():`)
  - `site design/src/api/reports.ts` lines 91–114 (anchor `export const reportsApi = {`)
- **Files to create or modify:**
  - modify `vitagraph/backend/app/routes/reports.py`
  - modify `site design/src/api/reports.ts`
  - modify `site design/src/pages/LibraryPage.tsx`
  - modify `site design/src/pages/UploadPage.tsx`
  - modify `site design/src/pages/AgentPage.tsx`
  - modify `site design/src/pages/TimelinePage.tsx`
  - modify `site design/src/components/gallery/DocumentPanel.tsx`
  - create `vitagraph/backend/tests/test_report_route_privacy.py`

**What to change**
1. **Backend:** `vitagraph/backend/app/routes/reports.py` lines 80–95 (anchor `def report_measurements(report_id: str) -> list[dict]:`).
   - The routes `/{report_id}/pages`, `/{report_id}/measurements` and `/{report_id}/pages/{page_number}/image` gain an optional query parameter `user_id`.
   - When it is given, the route calls `user_service.user_exists(user_id)`, then `report_service.assert_report_owner(report_id, user_id)` (404 "Report not found." for another persona's report), then does what it does today.
   - When it is absent, the behaviour is unchanged. Three existing tests call these routes without it, and rule 7 forbids editing them. Making it required is decision DEC-6.
2. **Client:**
   - `reportsApi.pages` becomes `pages(userId, reportId)`, and `reportsApi.measurements` becomes `measurements(userId, reportId)`. Both always send `?user_id=`.
   - Update every caller:
     - `site design/src/pages/LibraryPage.tsx` line 70 (anchor `const data = await reportsApi.measurements(reportId);`) and line 96 (anchor `reportsApi.pages(selected.id)`);
     - `site design/src/pages/AgentPage.tsx` line 222 (anchor `pending = reportsApi.pages(reportId);`);
     - the page loads added to `UploadPage.tsx` in A9;
     - the measurement loads added to `TimelinePage.tsx` in A12 and to `DocumentPanel.tsx` in B4.
   - Search with `Get-ChildItem "site design\src" -Recurse -Include *.ts,*.tsx | Select-String 'reportsApi\.(pages|measurements)\('` and update every hit.
3. **Tests:** create `vitagraph/backend/tests/test_report_route_privacy.py`, with two personas each uploading one sample panel:
   - **`test_pages_refuse_another_persona`:** `GET /api/reports/{report_id}/pages` for A's report with B's `user_id` returns 404.
   - **`test_measurements_refuse_another_persona`:** the same check for `/measurements`.
   - **`test_page_image_refuses_another_persona`:** the same check for `/pages/1/image`.
   - **`test_the_owner_still_gets_pages_and_measurements`:** with A's own `user_id`, both return 200.

**How to verify**
1. `.venv\Scripts\python.exe -m pytest tests\test_report_route_privacy.py tests\test_measurements.py tests\test_journey_events.py -q -p no:cacheprovider`. All pass. The last two files prove the old behaviour is kept.
2. Full suite: baseline + 4.
3. `cd "site design"; npm run build`. It must exit 0.
4. Browser: in DevTools > Network on `/library`, every `/pages` and `/measurements` request carries `user_id`.

**Acceptance criteria**
- [ ] A foreign `user_id` gets 404 on all three routes.
- [ ] Every frontend call sends `user_id` (search output pasted).
- [ ] Full suite: baseline + 4. No existing test was edited.

---

### Task F2 — Security hygiene: remove the committed key and add a secret scan

- **Goal:** Remove the API key value committed in two archive files, and add a scan script that fails when a key-like value is committed again. Rotating the key is the owner's job.
- **Tier:** Must
- **Size:** S
- **Review:** gate
- **Depends on:** none
- **Files to read first:**
  - `docs/archive/CODES.md` line 685 (anchor `AI_SERVICE_API_KEY=`)
  - `vitagraph/CODES.md` line 671 (anchor `AI_SERVICE_API_KEY=`)
  - `.gitignore` lines 14–16 (anchor `*.env`)
  
  Read these lines without printing the value. Use `Select-String … | ForEach-Object { $_.LineNumber }`.
- **Files to create or modify:**
  - modify `docs/archive/CODES.md`
  - modify `vitagraph/CODES.md`
  - create `scripts/plan/secret_scan.py`

**Facts found by the planner (values never printed):**
- `docs/archive/CODES.md` line 685 and `vitagraph/CODES.md` line 671 each hold `AI_SERVICE_API_KEY=` followed by a 51-character value starting with `sk-`.
- The other key-like hits in tracked files are placeholders, for example in `vitagraph/backend/.env.example`, or false matches such as "ask-…" and "risk-…".
- `.env` files are ignored by git.

**What to change**
1. **Redact the two lines:** in both files, replace only the value after `AI_SERVICE_API_KEY=` with `<redacted>`. Nothing else in those files changes. Never paste the old value anywhere: not in the report, not in a commit message, not in a terminal echo.
2. **Create `scripts/plan/secret_scan.py`.** It scans every file from `git ls-files`, skipping binary files.
   - **Patterns:**
     - `sk-` followed by 20 or more letters, digits, `_` or `-`, with no letter or digit just before it, so "ask-" and "risk-" never match;
     - a name ending in `API_KEY`, `SECRET`, `TOKEN` or `PASSWORD`, followed by `=` or `:` and a value of 16 or more characters;
     - `-----BEGIN … PRIVATE KEY-----`;
     - `AKIA` followed by 16 capitals or digits.
   - **Placeholders are not findings:** values starting with `<`, `${` or `$env:`, and values containing `replace`, `your`, `example`, `changeme`, `xxx` or `redacted`, ignoring case.
   - **Output:** one line per finding, giving the file, the line, the pattern name, and the value masked as its first 4 characters plus its length. It never prints the full value.
   - **Result:** end with `RESULT: PASS` or `RESULT: FAIL (<n> findings)`, and exit 1 on failure.
3. **The key stays in git history.** Removing it from the files does not remove it from earlier commits. Rewriting history needs a force-push, which rule 1 forbids. So the report must say in capitals that the owner must **rotate the key now**, and that the old key stays readable in the history of `main` and of this branch.

**How to verify**
1. `python scripts\plan\secret_scan.py`. It ends with `RESULT: PASS`.
2. `git diff --stat` lists exactly the two files and the new script.

**Acceptance criteria**
- [ ] The scan passes, and its output contains no full secret value.
- [ ] Only the two value strings changed in the archive files.
- [ ] The report asks the owner to rotate the key.

---

### Task F3 — Final safety suite for the agent features

- **Goal:** Collect the agent's safety guarantees into one named suite: the existing safety tests plus new tests for the paths this plan added. The suite runs with one command.
- **Tier:** Must
- **Size:** S
- **Review:** gate
- **Depends on:** none
- **Files to read first:**
  - `vitagraph/backend/tests/test_agent_service.py` lines 80–100 (anchor `def test_a_boundary_question_is_refused_without_starting_any_runtime():`)
  - `vitagraph/backend/tests/test_agent_mcp_server.py` lines 71–92 (anchor `def test_the_server_offers_exactly_four_tools_without_any_persona_parameter(personas):`)
  - `vitagraph/backend/tests/test_agent_profile.py`
- **Files to create or modify:**
  - create `vitagraph/backend/tests/test_agent_safety_suite.py`

**Already covered by existing tests (run as part of the suite, never edited):**
- `tests/test_agent_service.py::test_a_boundary_question_is_refused_without_starting_any_runtime`
- `tests/test_agent_service.py::test_a_question_that_is_only_an_injection_is_refused_without_a_runtime`
- `tests/test_agent_mcp_server.py::test_the_server_offers_exactly_four_tools_without_any_persona_parameter`
- `tests/test_agent_mcp_server.py::test_a_persona_can_not_read_another_personas_report`
- `tests/test_agent_profile.py::test_lockdown_check_accepts_exactly_the_four_tools_and_refuses_anything_else`
- `tests/test_agent_profile.py::test_a_real_runtime_is_locked_down_and_the_persona_cannot_be_overridden`
- `tests/test_safety.py::test_prompt_injection_text_is_treated_as_data`

**What to change**
1. **Create `tests/test_agent_safety_suite.py`.** It imports `FakePool` and `_collect` from `tests.test_agent_service`, and reads the tools the same way `tests/test_agent_mcp_server.py` does. Tests:
   - **`test_boundary_refusal_in_a_resumed_conversation_starts_no_runtime`:**
     - Pass `conversation_id="conv_safety"` and two earlier turns of history, then "Do I have diabetes? Please diagnose me.".
     - `pool.calls` stays empty.
     - The event types are exactly `["text_delta", "completed", "done"]`.
   - **`test_no_tool_accepts_a_persona_argument_at_any_depth`:** walk every input schema of the vitagraph server's tools recursively. No property name contains `user`, `persona`, `patient` or `owner`, ignoring case.
   - **Only when D5 is done:**
     - **`test_artifact_tools_accept_no_persona_argument`:** the same walk over the `vgartifacts` tools.
     - **`test_the_artifact_server_stays_inside_its_persona`:**
       1. Start the artifact tools with `VITAGRAPH_USER_ID` set to persona A, and call `create_report` through the server's tool function.
       2. The stored row's `user_id` is A.
       3. The HTML holds A's vitamin D value (18, from the 2025-01-15 panel), and B's value (34) appears in no "Vitamin D" row.
       4. A `GET /api/agent/artifacts/{id}` with B's `user_id` returns 404.
2. **Command:** the suite's command lists the seven existing node IDs above and the new file in one `pytest` call. Put it in the report as "Safety suite command".

**How to verify**
1. Run the safety suite command. Everything passes.
2. Full suite: baseline + 2, or + 4 when D5 is done.

**Acceptance criteria**
- [ ] The new tests exist with exactly these names, and the D5 pair exists only when D5 is done.
- [ ] The safety suite command passes (output pasted).
- [ ] No existing test was edited.

---

### Task F4 — Project documents brought up to date

- **Goal:** Make the project documents describe the branch as it is after this plan, replacing the stale design, test and streaming facts (issues O-1, O-2 and O-7).
- **Tier:** Should
- **Size:** S
- **Review:** light
- **Depends on:** F1, F2, F3, B11, C6, D12, E5
- **Files to read first:**
  - `CLAUDE.md`
  - `AGENTS.md`
  - `GEMINI.md`
  - `README.md`
  - `docs/ui-ux-design-notes.md`
  - this plan's sections 2, 4 and 14
- **Files to create or modify:**
  - modify `CLAUDE.md`
  - modify `AGENTS.md`
  - modify `GEMINI.md`
  - modify `README.md`
  - modify `docs/ui-ux-design-notes.md`

**What to change**
1. **In all five documents**, wherever they speak about these subjects, state:
   - **Design:** the Modernist design system (Archivo only, the tokens in `site design/src/theme/tokens.css`, no radius, no blur, one red accent, meaning colours for verified, caution and uncertain). Remove the "Instrument & Paper", Spectral, IBM Plex and graphite text (`CLAUDE.md` lines 9–10, anchor `Spectral`; line 32, anchor `graphite`).
   - **AI Agent stream:** `POST /api/agent/stream` with its events (status, step, thinking, tool_call, tool_result, text_delta, stats, completed, error), plus the conversation and artifact routes this plan added. Replace the `/api/questions/stream` contract text (`CLAUDE.md` line 22, anchor `POST /api/questions/stream`).
   - **Tests:** the real backend test count from the last full run, pasted from the run. Replace "60/60" (`CLAUDE.md` line 19, anchor `60/60 pytest passing`).
   - **Packages:** the added packages and their pinned versions.
   - **Check scripts:** the scripts in `scripts/plan/` and what each proves.
   - **Rules kept:** no provider names in the UI, `uncertain` stays labelled, exactly six pipeline stages, and no invented data.
   - **Open issues:** that the open issues live in this plan's section 14.
2. Keep each document's own purpose and voice. `AGENTS.md` stays the loop rules, and `README.md` stays the user-facing introduction. Only correct and extend facts.
3. No secret, no `.env` content and no persona data from a real person in any document.

**How to verify**
1. `Select-String -Path CLAUDE.md,AGENTS.md,GEMINI.md,README.md,docs\ui-ux-design-notes.md -Pattern 'Spectral|IBM Plex|60/60|graphite|questions/stream'` prints nothing, unless a line explains the history. Paste any remaining line with its reason.
2. `python scripts\plan\secret_scan.py` ends with `RESULT: PASS`.

**Acceptance criteria**
- [ ] The five documents state the design, stream, tests, packages, scripts and rules as they now are.
- [ ] The stale facts are gone (check 1).
- [ ] The secret scan passes.

---

### Task F5 — Paid-API follow-up (waiting for the owner)

- **Goal:** Once the owner supplies a paid AI key, capture the harness's real event shapes, check the mapper against them, and re-run every check recorded as `API blocked`.
- **Tier:** Should
- **Size:** M
- **Review:** gate
- **Depends on:** D12
- **Files to read first:**
  - `vitagraph/backend/app/agent/mapper.py`
  - `vitagraph/backend/tests/test_agent_mapper.py`
  - every report under `gemini/reports/` that says `API blocked`
- **Files to create or modify:**
  - modify `vitagraph/backend/app/services/agent_service.py`
  - create `vitagraph/backend/tests/test_agent_mapper_real_shapes.py`

**Status:** waiting for the owner. Do not start until the owner confirms a paid key is set in `vitagraph/backend/.env`. The worker never reads, prints or copies the key (rule 8).

**What to change**
1. **Opt-in capture:** in `agent_service.py`, at the mapper loop (`vitagraph/backend/app/services/agent_service.py` line 278, anchor `for ev in mapper.feed(msg):`), add a capture that runs only when the environment variable `VITAGRAPH_AGENT_CAPTURE` names a folder.
   - It appends each raw harness message to `<folder>/<conversation_id>.jsonl`.
   - It removes the key the same way the mapper's redaction does (`tests/test_agent_mapper.py::test_the_key_is_redacted_from_a_turn_end_error` pins that behaviour).
   - It is off by default. The folder must be outside the repository, or ignored by git.
2. **Capture these shapes:** run three questions with the AI on: "What was my vitamin D result?", "How did my vitamin D change between my reports?" and "What was my ferritin level?". Record one real example of each of these from the capture, with any personal text shortened:
   - `assistant/message`: the content blocks for text, reasoning and tool-call, and `usage` with `inputTokens`, `outputTokens` and `reasoningTokens`;
   - `tool/call`: `callId`, `name`, and `arguments` as a JSON string;
   - `tool/result`: `message.toolCallId`, `isError`, `content`, and `error` when present;
   - `turn/end`: `reason`;
   - `llm/retry`: `retry` and `provider`;
   - `session/title`.
3. **Compare with the mapper's assumptions.** These existing tests encode the assumed shapes:
   - `tests/test_agent_mapper.py::test_reasoning_and_text_blocks_become_thinking_and_text_delta`
   - `tests/test_agent_mapper.py::test_tool_call_uses_the_short_name_and_parsed_arguments`
   - `tests/test_agent_mapper.py::test_search_results_collect_evidence_cards_once_per_chunk_and_keep_their_refs`
   - `tests/test_agent_mapper.py::test_a_tool_error_becomes_an_error_result`
   - `tests/test_agent_mapper.py::test_llm_retry_events_become_retrying_status_with_a_counter`
   - `tests/test_agent_mapper.py::test_step_events_and_usage_produce_stats_and_never_invent_token_counts`
   - `tests/test_agent_mapper.py::test_the_latest_session_title_is_kept`
   
   Do **not** edit them (rule 7). Instead, create `tests/test_agent_mapper_real_shapes.py`. It feeds the captured, redacted examples through `EventMapper` and asserts the events the UI needs.
   - If a captured shape breaks the mapper, fix the mapper in this task.
   - If an existing test's assumption contradicts the real shape, list it in the report for the owner to decide.
4. **Re-run every check recorded as `API blocked`:**
   - D11 verify step 3 (the loop, stats and tokens with the AI on);
   - D10's `show_code` card, when D10 and D5 are done;
   - every `API blocked` line in `gemini/reports/` from earlier tasks.
   
   Paste each result.

**How to verify**
1. `.venv\Scripts\python.exe -m pytest tests\test_agent_mapper.py tests\test_agent_mapper_real_shapes.py -q -p no:cacheprovider`. Both pass.
2. The full suite passes at baseline + the number of new tests.
3. The capture is off when the variable is unset. Run one question without it, and no file is written.

**Acceptance criteria**
- [ ] One real example of each listed shape is recorded, with no key in it.
- [ ] Every earlier `API blocked` check was re-run (results pasted).
- [ ] No existing test was edited.

## Appendix A. Code skeletons for the hard tasks

The owner asked for these. Each skeleton shows only the signatures and the one tricky part of a task flagged "hard". It is not the whole file. Write the rest from the task's description. If a skeleton and a task description disagree, the task description wins; report the difference.

### A.1 Task A12 — Timeline: keep only points the report confirms

```ts
interface IsoBarInput { t: number; v: number; val: string; date: string; hot: boolean }
interface IsoOptions { max: number; lo: number | null; hi: number | null; loText: string; hiText: string }
interface ChartPoint { reportId: string; date: Date; value: number }

function iso(bars: IsoBarInput[], o: IsoOptions): IsoChart;              // port of app-v3-source.html lines 1086-1114
function datedPoints(trend: TrendData, byId: Map<string, Report>): { points: ChartPoint[]; undated: number };
function spread(dates: Date[]): number[];                                 // gap >= 0.22, rescaled to <= 1
function buildChart(test: string, unit: string, points: ChartPoint[], latestRow: MeasurementRow, undated: number): ChartModel;

// The tricky loop, inside the charts effect, per test:
const verified: { point: ChartPoint; row: MeasurementRow }[] = [];
for (const point of draft.points) {
  const rows = await measurementsOf(point.reportId);   // one cached request per report; [] on failure
  const row = rows.find(
    (r) => r.test_name.toLowerCase() === trend.test_name.toLowerCase() && Math.abs(r.value - point.value) < 1e-9
  );
  if (row) verified.push({ point, row });
}
const onePerReport = new Set(verified.map((v) => v.point.reportId)).size === verified.length;
if (verified.length < 2 || !onePerReport) continue;      // never chart a doubtful series
out.push(buildChart(trend.test_name, trend.unit, verified.map((v) => v.point), verified[verified.length - 1].row, draft.undated));
```

### A.2 Task C3 — Ingestion show: portal, focus and the live payload

```tsx
export interface IngestionShowProps {
  isOpen: boolean;
  filename: string;
  jobStream: UseJobStreamReturn;
  onClose: () => void;
  onAsk: (reportId: string) => void;
  onOpenLibrary: () => void;
}

export const IngestionShow: React.FC<IngestionShowProps> = ({ isOpen, onClose, jobStream, ...rest }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const returnTo = document.activeElement as HTMLElement | null;   // focus goes back here on close
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnTo?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;
  const pages = jobStream.events.filter((e) => e.stage === "extracting");     // page_extracted events
  const latest = jobStream.events[jobStream.events.length - 1] ?? null;       // decides which live panel shows
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="ingestion-title" data-testid="ingestion-show">
      <h2 id="ingestion-title" ref={headingRef} tabIndex={-1}>{rest.filename}</h2>
      {/* six STAGES rows (ingestion-stage-1..6) | live panel built only from `latest` and `pages` */}
    </div>,
    document.body
  );
};
```

### A.3 Task B5 — The 3D view: canvas, instanced nodes, controls, auto-rotation

```tsx
import { Canvas, useFrame, useThree, invalidate, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export default function Graph3D(props: Graph3DProps) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.75]}
        gl={{ antialias: window.devicePixelRatio < 2, powerPreference: "high-performance", alpha: false }}
        camera={{ fov: 45, near: 0.1, far: 2000, position: [0, 0, 220] }}
        onCreated={({ gl }) => gl.domElement.addEventListener("webglcontextlost", props.onContextLost)}
        onPointerMissed={() => props.onSelect(null)}
      >
        <Scene {...props} />
      </Canvas>
    </div>
  );
}

function Nodes({ nodes, positions, colors, onHover, onSelect }: NodesProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    nodes.forEach((n, i) => {
      const s = sizeOf(n);
      m.makeScale(s, s, s).setPosition(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(colors[i]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [nodes, positions, colors]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return (
    <instancedMesh
      key={nodes.length}                       // the instance count is fixed per mesh
      ref={ref}
      args={[geometry, material, nodes.length]}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => onHover(e.instanceId ?? null)}
      onClick={(e: ThreeEvent<MouseEvent>) => { if (e.instanceId !== undefined) onSelect(nodes[e.instanceId].id); }}
    />
  );
}

function Controls({ paused }: { paused: React.MutableRefObject<boolean> }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    const onChange = () => invalidate();
    const onStart = () => { paused.current = true; };       // a drag pauses auto-rotation (rule 12)
    controls.addEventListener("change", onChange);
    controls.addEventListener("start", onStart);
    return () => {
      controls.removeEventListener("change", onChange);
      controls.removeEventListener("start", onStart);
      controls.dispose();
    };
  }, [camera, gl, paused]);
  return null;
}

function AutoRotate({ group, enabled, paused }: AutoRotateProps) {
  useEffect(() => { if (enabled) invalidate(); }, [enabled]);   // kick the first frame; the resume timer also calls invalidate()
  useFrame((_, delta) => {
    if (!enabled || paused.current || !group.current) return;   // no request, so the loop stops (rule 2)
    group.current.rotation.y += 0.19 * delta;                   // time-based, rule 12
    if (import.meta.env.DEV) {
      (window as unknown as { __VG_GRAPH_ROTATION__?: number }).__VG_GRAPH_ROTATION__ = group.current.rotation.y;
    }
    invalidate();                                               // the next frame, only while rotating
  });
  return null;
}
```

### A.4 Task B8 — The graph page: lazy 3D, honest fallback, evidence highlight

```tsx
const Graph3D = lazy(() => import("../components/graph3d/Graph3D"));
type FallbackReason = null | "no-webgl" | "crashed";

const wanted: "3d" | "2d" = prefs.graphView === "2d" ? "2d" : "3d";
const [view, setView] = useState<"3d" | "2d">(wanted);
const [reason, setReason] = useState<FallbackReason>(wanted === "3d" && !hasWebGL2() ? "no-webgl" : null);
const shown = reason ? "2d" : view;

{shown === "3d" ? (
  <GraphErrorBoundary fallback={<Graph2D {...common} />} onError={() => setReason("crashed")}>
    <Suspense fallback={<PageState kind="loading" title="Loading the 3D view" />}>
      <Graph3D {...common} autoRotate={autoRotate} onContextLost={() => setReason("crashed")} />
    </Suspense>
  </GraphErrorBoundary>
) : (
  <Graph2D {...common} />
)}

useEffect(() => {
  if (!userId || searchParams.get("answer") !== "1") return;
  const last = readLastAnswer(userId);
  if (!last || last.chunkIds.length === 0) return;
  let cancelled = false;
  graphApi
    .getSubgraph(userId, last.chunkIds)
    .then((sub) => { if (!cancelled) setActiveIds(new Set(sub.nodes.map((n) => n.id))); })
    .catch(() => { if (!cancelled) setActiveIds(new Set()); });
  return () => { cancelled = true; };
}, [userId, searchParams]);
```

### A.5 Task D4 — Reports from stored data, and HTML to PDF with PyMuPDF

```python
from html import escape
import io

from fastapi import HTTPException

from app.core.database import get_db
from app.services import measurement_service, report_service


def build_report_html(user_id: str, title: str) -> str:
    reports = report_service.list_reports(user_id)          # newest upload first
    ready = [r for r in reports if r["status"] == "ready"]
    # sections: summary, values per report (list_report_measurements), changes (compare_reports when >= 2)
    # every value goes through escape(); nothing is computed or invented
    ...


def _html_to_pdf(html_text: str) -> tuple[bytes, int]:
    import pymupdf  # the same import name report_service.render_page_png uses

    buf = io.BytesIO()
    writer = pymupdf.DocumentWriter(buf)
    mediabox = pymupdf.paper_rect("a4")
    where = mediabox + (36, 36, -36, -36)                    # 36 pt margins
    story = pymupdf.Story(html=html_text)
    pages, more = 0, 1
    while more:
        device = writer.begin_page(mediabox)
        more, _ = story.place(where)
        story.draw(device)
        writer.end_page()
        pages += 1
    writer.close()
    return buf.getvalue(), pages


def get_artifact(user_id: str, artifact_id: str) -> dict:
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM agent_artifacts WHERE id = ? AND user_id = ?", (artifact_id, user_id)
        ).fetchone()
    if row is None:                                          # missing or another persona's: the same 404
        raise HTTPException(status_code=404, detail="Artifact not found.")
    return dict(row)
```

### A.6 Task D11 — Resume through the URL without double loads, and session totals

```tsx
const c = searchParams.get("c");
const loadedRef = useRef<string | null>(null);

useEffect(() => {                                   // open a stored conversation once
  if (!userId || !c || loadedRef.current === c || c === chat.conversationId) return;
  loadedRef.current = c;
  void chat.load(userId, c);
}, [userId, c]);                                    // chat.load is a stable useCallback

useEffect(() => {                                   // after a send, put the id in the URL
  const id = chat.conversationId;
  if (!id || searchParams.get("c") === id) return;
  loadedRef.current = id;                           // the page already shows it: do not reload
  const next = new URLSearchParams(searchParams);
  next.set("c", id);
  setSearchParams(next, { replace: true });
}, [chat.conversationId]);

function sessionTotals(entries: AgentEntry[]) {
  let toolCalls = 0;
  let input: number | null = null;
  let output: number | null = null;
  for (const e of entries) {
    if (!e.stats) continue;
    toolCalls += e.stats.toolCalls;
    if (e.stats.inputTokens !== null) input = (input ?? 0) + e.stats.inputTokens;
    if (e.stats.outputTokens !== null) output = (output ?? 0) + e.stats.outputTokens;
  }
  return { answers: entries.filter((e) => e.status === "answered").length, toolCalls, input, output };
}
```

## 14. Verification log

### 14.1 How the plan was checked
- **The source.** All facts come from branch `redesign/modernist-app` at commit `dcae86f`, checked out read-only. The repository was not changed.
- **The checker.** A checker script read this plan file and tested it mechanically, every pass:
  - every task has all required fields (including Tier, Size and Review), and no code block appears outside the appendix;
  - every "create" path does not exist yet, and every "modify" or "delete" path exists, counting the earlier tasks;
  - every "Files to read first" path exists at the moment the task runs;
  - every cited block (`path` lines N–M, anchor `text`) exists, with the anchor inside those lines;
  - every "Depends on" ID exists and comes earlier in the order of work, which rules out cycles;
  - every `METHOD /api/...` the plan names matches a backend route on the branch, or one of the six routes this plan adds (section 2.3);
  - every frontend API call on the branch (33 calls) matches a backend route;
  - every existing backend test the plan names by file and test function exists;
  - every test ID listed after "Keep these test IDs:" exists on the branch.
- **Manual review.** In each pass the planner also read every task again against the cited code. The review covered names reused across tasks, the "baseline + N" test counts, React hook order, and whether each acceptance item can be checked with the commands given.
- **Facts checked outside the repository:**
  - the published packages of three 0.180.0, @types/three 0.180.0 and @react-three/fiber 9.8.1 (exports and peer dependencies);
  - the PyMuPDF API (`Story`, `DocumentWriter`, `paper_rect`);
  - the reference harness source at `deepseek-ai/deepseek-harness`, commit `5badb150`.

### 14.2 Passes and corrections
| Pass | What it was | Corrections found |
|---|---|---|
| 1 | Mapped the four areas: theme and pages, the 2D graph, the agent backend, and the routes and services the frontend calls | (mapping, no draft yet) |
| 2 | Drafted the plan. At the user's instruction it was rewritten to contain no implementation code: each change names its exact code block and is described in plain English | (drafting) |
| 3 | First verification pass, run on each part as it was finished | **8** |
| 4 | Second verification pass, on the whole file | **8** |
| 5 | Third verification pass, on the whole file | **2** |
| 6 | Fourth verification pass, on the assembled file with this log added | **1** |
| 7 | Final full pass, checker and manual | **0** |

**Corrections in pass 3:**
1. The fake-report citation in `UploadPage.tsx` pointed at lines 46–71. The block is at lines 40–51.
2. The "No text" citation pointed at lines 160–165. The label is at line 366.
3. The anchor for the reference chart function was `function iso(`. The real text is `iso(bars, o) {`.
4. The range of that function was given as lines 1086–1120. It ends at line 1114.
5. The old Timeline test IDs were said to belong to `scripts/verify_ms*.py`. They are used by `verify_g1.py`, `verify_g2.py`, `verify_g4.py`, `verify_m4.py`, `verify_mgaps.py` and `verify_ms08.py` (issue O-10).
6. Task A10's early persona gate would have left the scroll-follow effect, which had `[]` dependencies, unattached for ever. Its dependencies became `[effectiveUserId]`.
7. Task A8's delete text promised "everything stored". `ai_calls` rows survive a persona delete, so the text now lists exactly what is deleted (issue O-11, fixed in D1).
8. Task A9 had labels for `failed` extraction values that the extractor never writes. They were removed.

**Corrections in pass 4:**
1. Task D12's verify heading did not match the required field name.
2. A harness file was cited in the branch-citation format. It is now named in plain words.
3. The new-route list said "five more". It is six routes on five paths, and each is now listed separately.
4. Task D9 named a route with an ellipsis. It now names the D2 routes.
5. Section 5.1's example test count was 213. It now reads 219, the final count.
6. The refusal question in C6 and D2 was untested wording. It is now the wording an existing test proves is refused: "Do I have diabetes? Please diagnose me."
7. Task B8 pointed the dead community hand-off at issue O-10. It now has its own issue, O-12.
8. A browser verify step in B8 mentioned an unneeded `chrome://flags` step. It was reworded.

**Corrections in pass 5:**
1. Task D5's test description referred to the artifact server's tools vaguely. It now names `artifact_server.create_server(<persona id>)` and the two expected tool names.
2. Task D12's setup said "through `process`". It now names `POST /api/reports/upload` with `background` set to false, a form field the route accepts (`vitagraph/backend/app/routes/reports.py` lines 24–30, anchor `background: bool = Form(True),`).

**Correction in pass 6:**
1. This log's own example of a test name looked like a real test citation to the checker. It was reworded.

**Pass 7** re-ran the checker on the final file and re-read every task. It found nothing to correct: 43 tasks, 0 problems.

**Revision 2: the owner's list.** The owner asked for:
- new scope: the Tools workstream E; privacy, secrets, the safety suite, documents and the paid-API follow-up in workstream F; and accessibility gates;
- decisions (section 6);
- three fixes: one citation, fixed test totals, and chained dependencies;
- speed aids: sessions, sizes, review levels, skeletons and a stable heading format.

These passes followed:

| Pass | What it was | Corrections found |
|---|---|---|
| 8 | Applied the owner's list. Every new fact was checked in the code first: the OCR response shape, the backend's 60% low-confidence rule, the key lines (values never printed), and the tests affected by a required `user_id`. pdfjs-dist 6.4.299, axe-core 4.13.0 and PyMuPDF 1.26.4 were checked in the published packages. | (revision draft) |
| 9 | Verification of the revision: checker, plus a script that checks the tier rule and the session order | **7** |
| 10 | Full pass of the revision, checker, tier and session script, and manual review | **1** |
| 11 | Final full pass, the same checks | **0** |

**Corrections in pass 9:**
1. F2's read-first anchor named a `.env` path that the checker took as a file. The anchor is now `*.env`.
2. F1 wrote a route with a placeholder inside the path. It now uses `{report_id}`.
3. D11's stats line used `startedAt` and reasoning tokens. The hook's `AgentStats` has `elapsedMs`, `toolCalls`, `inputTokens` and `outputTokens`, and the text now uses those.
4. D4 used the name `fitz`. The backend imports PyMuPDF as `pymupdf` (`vitagraph/backend/app/services/report_service.py` line 367, anchor `import pymupdf`).
5. E4's text hand-off needed changes in `toolHandoff.ts` and in the PDF to Text page. Both were added to its file list, and its dependency became E3.
6. B7 and C8 would both have created `ChoiceRow`. B7 now reuses C8's when it exists.
7. D4 still credited the `/report` command, which is now optional (D8). It now names D10's "Make a report" control first.

**Correction in pass 10:**
1. A citation in this log used a short path that the checker cannot resolve. It now gives the full path and an anchor.

**Pass 11** re-ran everything on the final file and found nothing to correct:
- 54 tasks;
- 280 block citations, 63 route mentions and 33 frontend calls, all matching;
- no tier violation and no session-order violation.

### 14.3 Open issues: where the codebase disagrees with itself or with the goals
- **O-1. Which design is in force.**
  - The branch's `CLAUDE.md` still describes the earlier "Instrument & Paper" design: `CLAUDE.md` lines 9–10 (anchor `Spectral`) and line 32 (anchor `graphite`).
  - The branch's code and its rules use the Modernist system: `gemini/RULES.md` line 25 (anchor `Archivo 400/600/800 only`) and `site design/src/theme/tokens.css`.
  - **Choice:** the Modernist system (repo reality). `CLAUDE.md` is not edited by this plan. The owner should update it.
- **O-2. Streaming contract.**
  - `CLAUDE.md` line 22 (anchor `POST /api/questions/stream`) says the frontend must consume `/api/questions/stream`, including `model_fallback`.
  - The AI Agent page actually streams from `POST /api/agent/stream`: `site design/src/hooks/useAgentChat.ts` line 397 (anchor `/api/agent/stream`). That route emits `status`, `step`, `thinking`, `tool_call`, `tool_result`, `text_delta`, `stats`, `completed` and `error` (`vitagraph/backend/app/routes/agent.py` line 71, anchor `receive status, thinking, step`).
  - **Choice:** the agent route. No model or provider name is shown (rule 6).
- **O-3. Per-report routes do not check the persona.**
  - `GET /api/reports/{report_id}/pages`, `/measurements` and `/pages/{page_number}/image` take only a report ID: `vitagraph/backend/app/routes/reports.py` lines 80–95 (anchor `def report_pages(report_id: str) -> list[dict]:`).
  - The agent's tool server does check ownership: `vitagraph/backend/app/agent/mcp_server.py` line 42 (anchor `def _check_report_owner(report_id: str, persona: str) -> bool:`).
  - B1's chunk route follows the existing per-report pattern. A later privacy task should add a persona check to all four routes. That is outside this plan's four workstreams.
- **O-4. The trends service is weak.** In `vitagraph/backend/app/services/report_service.py` lines 420–480 (anchor `matches.sort(key=lambda m: m["date"])`):
  - it sorts points by date text;
  - it matches tests by substring;
  - it calls any rise "improving";
  - it returns the unit `g/dL` when nothing matched.
  
  Task A12 works around all four and never shows `trend_direction`. The backend is unchanged.
- **O-5. Page value comments disagree with the extractor.**
  - `PageOut` comments list `ocr|failed` and `sparse|failed`: `vitagraph/backend/app/schemas/report.py` lines 22–27 (anchor `extraction_method: str   # native|ocr|failed`).
  - The extractor writes `native`, `ocr-tesseract`, `ocr-rapid` or `uncertain`, and `good` or `uncertain`: `vitagraph/backend/app/ingestion/extractor.py` lines 140–163 (anchor `method, quality = "native", "good"`).
  - **Choice:** the plan follows the extractor.
- **O-6. Stage latencies.** The embedded and indexed stages report halves of one measurement, and graphed reports a fixed 10 ms: `vitagraph/backend/app/services/report_service.py` lines 177–217 (anchor `latency_ms=10,`). Fixed in C7.
- **O-7. Test count in the docs.**
  - `CLAUDE.md` line 19 (anchor `60/60 pytest passing`) says 60 tests.
  - The reviewer's last full run on this branch was 201 passed: `gemini/reviews/TASK_AG3b_review.md` line 12 (anchor `201 passed`).
  - **Choice:** the plan uses 201 as the baseline.
- **O-8. Monospace.**
  - `gemini/RULES.md` line 25 (anchor `No monospace font in the UI`) forbids a monospace font.
  - The same file's table maps "Monospace (hashes, ids, latencies)" to `.font-mono` classes: `gemini/RULES.md` line 127 (anchor `Monospace (hashes, ids, latencies)`).
  - The class still exists: `site design/src/index.css` line 75 (anchor `.font-mono,`).
  - **Choice:** the explicit rule, so no monospace. Code artifacts (D10) are shown in Archivo with preserved spacing.
- **O-9. The motion engine is outside the audit.**
  - `site design/src/motion/` predates the redesign. It contains raw colours, for example two hex values each in `site design/src/motion/fx/DustField.ts` and `Photon.ts`.
  - A1's audit skips this folder so that the page work can finish first. A later task should audit or retire it.
- **O-10. Retired test IDs used by old scripts.**
  - Task A12 retires Timeline test IDs that old motion-era scripts still use: `timeline-delete-confirm-panel` and `timeline-copy-id-btn` (`scripts/verify_g4.py`), `timeline-view-in-graph-btn` (`scripts/verify_g1.py`, `scripts/verify_mgaps.py`), `timeline-upload-error` (`scripts/verify_g2.py`), `spine-progress-line` (`scripts/verify_m4.py`, `scripts/verify_ms08.py`) and `confirm-purge-btn` (`scripts/verify_ms08.py`).
  - Task B8 retires `graph-node-provenance-card` (`scripts/verify_m3.py`).
  - Those scripts are not part of this plan's checks and are not deleted. They will fail on the retired IDs until the owner retires them.
- **O-11. A persona delete leaves AI call records.**
  - `delete_user` promises "every derived record", but its SQL never deletes from `ai_calls`, which has a `user_id` column: `vitagraph/backend/app/services/user_service.py` lines 90–118 (anchor `Delete a persona and every derived record.`).
  - Fixed in D1.
- **O-12. Dead community hand-off.**
  - The graph page reacts to `location.state.community`: `site design/src/pages/KnowledgeGraphPage.tsx` lines 248–255 (anchor `const commState = (location.state as any)?.community;`).
  - No page sends such state; a search of `site design/src` finds no sender.
  - B8 removes the receiver.
- **O-13. An embedding dimension shown without being measured.**
  - When no sample vector can be read, the embedded event still reports `dim` 384: `vitagraph/backend/app/services/report_service.py` line 315 (anchor `"dim": samples[0]["dim"] if samples else 384,`).
  - C1 and C2 show the `dim` the event sends. A follow-up should send `null` in that case, so the page can say "dimensions not measured". It is left unchanged here to keep C7 small.
- **O-15. The reference says the OCR image never leaves the browser.** The reference's Image to Text page says "It is read in your browser and never uploaded". VitaGraph's OCR runs in the backend (`vitagraph/backend/app/routes/tools.py` line 23, anchor `The image is processed in memory and never stored.`). E2 follows the backend and says so on the page.
- **O-16. An API key is committed.** A key value sits in `docs/archive/CODES.md` line 685 and `vitagraph/CODES.md` line 671, both with the anchor `AI_SERVICE_API_KEY=`. F2 removes it from the files, but it stays in git history. The owner must rotate it (DEC-7).
- **O-17. The reference's Text to Graph sample is invented.** Its sample text holds made-up values (`design/reference/app-v3-source.html` line 1273, anchor `t2gSample = () =>`). E4 offers only text from the real sample PDFs (rule 3).
- **Status of earlier issues after this revision:**
  - O-3 is closed for the new chunk route (B1). For the older routes the check runs when `user_id` is given (F1), and requiring it is DEC-6.
  - O-1, O-2 and O-7 are corrected in the documents by F4.
  - O-6 is fixed by C7, O-11 by D1 and O-12 by B8.
  - O-14 is followed up by F5.
- **O-14. The AI gateway rejects the harness.** No real model answer has come through the agent route (`gemini/reviews/TASK_AG4_review.md`). Every check marked "needs the AI" in D is either passed or recorded as `API blocked` under rule 9. No workaround is built.
