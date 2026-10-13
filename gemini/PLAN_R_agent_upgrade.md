# PLAN R: AI Agent upgrade (2026-10-12)

Owner request (2026-10-12): the AI Agent answer must keep running when the person changes page or chat; a customisable side panel for reports; visuals made from the person's real data (charts) that also go into the saved HTML report and its PDF; a cleaner AI Agent layout; ideas copied from the DeepSeek Harness web client (ui-session, ui-sidebar-right, ui-deliverables, documentpreview) and from kotaemon / Morphic / LibreChat / open-webui.

Built by five parallel sub-agents (owner asked for Sonnet and Haiku sub-agents, effort high). Claude (the lead session) integrates, runs the gates and the browser check. **This file is the contract between the agents. Do not change a contract on your own; if you must, say so in your final report.**

Branch: `feature/privacy-shield-and-rag-lab` (the earlier Privacy/Accuracy/My Data work is uncommitted on it; do not touch those files unless listed for you).

## 0. Rules for every agent

- Edit ONLY the files listed for your workstream (new files you create in your listed folders are fine). If you think another file must change, do not change it: write it in your final report.
- No git commands that change anything (no add, commit, stash, checkout, reset, restore, clean, push, merge, rebase). Read-only git (`git diff`, `git status`) is fine.
- Never open, print or edit `vitagraph/backend/.env`. Never print API keys.
- Do not start, stop or kill servers on ports 8000 or 5173 (the owner's running app). Backend agents may run a scratch backend on their own port (R1: 8011, R2: 8012) with a fresh data folder: `DATA_DIR=<scratchpad>/r1data BACKEND_URL=http://127.0.0.1:8011 .venv\Scripts\python.exe -m uvicorn app.main:app --port 8011`; stop it before finishing.
- Design law (`gemini/DESIGN_LAW.md`): Archivo only (400/600/800), 0 radius, flat, neutral palette with ONE red accent (`--color-accent` #ec3013; small red text uses `--color-accent-700`), tokens from `site design/src/theme/tokens.css`, classes from `modernist.css` (`btn btn-primary|secondary|ghost`, `input`, `tag`, `table`, `seg`) and `index.css` (`vg-action`, `vg-chip`, `vg-fold`). Never show an AI provider or model name in the UI. Plain words a grandparent understands.
- Safety: clinical advice/diagnosis stays refused; every number shown must come from the person's stored data, never typed by the model.
- Backend tests: `cd vitagraph/backend && .venv\Scripts\python.exe -m pytest tests/<your files> -q -p no:cacheprovider`. Run the FULL suite once at the end only (it takes ~7 min; 657 passed before this plan). Do not edit an existing test unless it asserts behaviour this plan deliberately changes; list every such test edit and the reason in your report.
- Frontend type check: `cd "site design" && npx tsc -b` (do NOT run `npm run build` or `npm run dev`; the lead runs them). Frontend files other agents are writing may not exist yet: code against the contract below; the lead fixes integration.
- Final report (your last message): files changed/created, what works, test results (paste the summary lines), contract deviations, anything left.

## 1. Backend contract

### 1.1 Agent runs survive the browser (R1)

- `POST /api/agent/stream`: same request body. The run now executes in a background asyncio task owned by a per-process run registry (`app/agent/runs.py`). The HTTP response only SUBSCRIBES to it. If the client disconnects, the run continues, finishes and is saved. Only an explicit stop cancels it.
- Every SSE frame keeps today's shape (`app/core/sse.py` `frame`: `index`, `event_type`, `metadata`, ...). The FIRST frame after `: connected` is a new event `run` with metadata `{ "conversation_id", "started_at" (epoch ms) }`.
- `GET /api/agent/runs/active?user_id=` -> `[{ "conversation_id", "question", "started_at" (epoch ms), "status": "running" }]` (empty list when idle). Finished runs are kept in memory for 10 minutes for re-attach, but are not listed here.
- `GET /api/agent/runs/{conversation_id}/events?user_id=&after=<int, default 0>` -> SSE (same framing). Replays every buffered frame whose `index` > `after`, then streams live frames until the terminal frame (`completed` with stage done, or `error`). 404 if no run (running or finished in the last 10 minutes) exists for that conversation and user. Several subscribers may follow one run.
- `POST /api/agent/runs/{conversation_id}/stop?user_id=` -> `{ "stopped": true|false }`. Cancels the run (and the persona runtime, as today), then saves the turn with status `stopped` and the partial answer text. Subscribers receive a final `error` frame `{ "status": "stopped", "message": "Stopped." }`.
- Persistence:
  - The conversation row and the USER message are written when the run STARTS (so the chat shows in History immediately with `running: true`). The assistant message is written when it ends.
  - Turns that end with `error` or `stopped` are saved too (assistant `status` `error` / `stopped`, content = partial answer or the error message).
  - New columns on `agent_messages`: `safety_passed INTEGER NOT NULL DEFAULT 1`, `safety_note TEXT` (add them with an idempotent migration in `app/core/database.py`, the same way earlier columns were added).
- `GET /api/agent/conversations?user_id=` items gain `"pinned": bool`, `"running": bool`, and `"turns": <number of user questions>` (it used to count messages, so one question showed "2 turns"). Order: pinned first, then newest update first.
- `GET /api/agent/conversations/{id}?user_id=` messages gain `"safety_passed": bool` and `"safety_note": str|null`.
- `PATCH /api/agent/conversations/{id}?user_id=` body `{ "title"?: str (1..120 chars, trimmed), "pinned"?: bool }` -> the updated summary item. 404 for another person's chat. New column `agent_conversations.pinned INTEGER NOT NULL DEFAULT 0`.
- Busy: while a run for that persona is running, a second `POST /stream` returns the existing `error` event text "The AI Agent is still answering your previous message..." (unchanged).

### 1.2 Charts from real data (R2)

- The agent may add a chart to an answer or a report with a fenced block whose language is `chart` and whose body is JSON. The JSON NEVER contains values; the server looks the values up:
  - `{"kind": "trend", "tests": ["Hemoglobin"], "title"?: str}`: one test (or up to 4 tests, one small panel each) over all dated reports, with the printed reference range as a band.
  - `{"kind": "compare", "tests": ["LDL Cholesterol", "HDL Cholesterol"], "reports"?: ["<report_id>", ...], "title"?: str}`: grouped bars per test for 2..6 reports (default: first and latest dated report).
  - `{"kind": "values", "report_id": "<report_id>", "title"?: str}`: every value of one report against its printed range (range bar per test).
  - Test names match case-insensitively against the person's series (`series_service`), also without spaces/underscores.
- `POST /api/agent/chart` body `{ "user_id", "spec": {...} }` -> 200 `{ "kind", "title", "svg": "<svg ...>", "series": [{ "test", "unit", "points": [{ "report_id", "label" (e.g. "Jan 2025" or "Undated"), "date_iso"|null, "value", "flag", "range_low", "range_high", "page_number", "chunk_id", "char_start", "char_end" }] }], "notes": [str] }`; 422 `{ "detail": "<plain sentence>" }` for a bad spec or a test the person has no values for. Route lives in NEW `app/routes/charts.py` (prefix `/api/agent`), registered in `app/main.py`.
- SVG rules: inert (no `<script>`, no event attributes, no links, no external refs), `viewBox` width 720, `font-family="Archivo, Arial, sans-serif"`, ink `#201e1d`, grid `#cfcdcd`, range band `#eae9e9`, values outside the range in `#ec3013` with an arrow/marker, otherwise ink; every point labelled with value + unit; axis labels are report months; `role="img"` + `<title>`.
- Saved reports: `report_render.py` renders a ```chart block as the same SVG in the HTML preview and as an embedded image in the PDF (convert SVG to PNG with PyMuPDF if the PDF Story cannot draw SVG). A bad spec becomes a short plain note, never an error.
- `POST /api/agent/reports` is idempotent: same `user_id` + same title + same markdown as an existing saved report returns that report (no new row).
- The agent prompt (`app/agent/prompt.py`) gets a short rule: when a trend or a comparison would help, add one ```chart block with the spec above (test names exactly as the tools returned them); never put numbers in the spec; at most 2 charts per answer.

### 1.3 Passage highlight on the page image (R2)

- `GET /api/reports/{report_id}/pages/{page_number}/highlight?user_id=&char_start=&char_end=` -> `{ "rects": [{ "x0", "y0", "x1", "y1" }] (normalised 0..1, relative to the page image from `/api/reports/{id}/pages/{n}/image`), "method": "text" | "ocr" | "none" }`. Owner check like the other page routes (404 for another persona). Text-layer pages: locate the characters `extracted_text[char_start:char_end]` on the PDF page (PyMuPDF words/`search_for`, line by line). OCR pages: use stored OCR boxes when available. Nothing found: `rects: []`, `method: "none"`.

## 2. Frontend contract

### 2.1 Run store and background answers (F1)

- NEW `site design/src/lib/agentRuns.ts`: a module-level store (outside React) that owns every agent run of the app: `start(userId, conversationId, messages, reportId)`, `attach(userId, conversationId, afterIndex)`, `stop(userId, conversationId)`, `subscribe(listener)`, `getSnapshot()`. Runs keep streaming when the AI Agent page unmounts. On app start and on persona change it calls `GET /api/agent/runs/active` and re-attaches.
- NEW `site design/src/api/agentRuns.ts`: fetch helpers for the 1.1 endpoints.
- `site design/src/hooks/useAgentChat.ts` becomes a view over the store for ONE viewed conversation. Return type keeps every current field (`entries, isStreaming, conversationId, load, send, stop, reset`) and ADDS:
  - `draft: string`, `setDraft(text: string): void` (per conversation, kept in memory and in `sessionStorage`; a new chat has its own draft),
  - `runningIds: string[]` (conversation ids with a running answer),
  - `isRunningElsewhere: boolean` (some other conversation is running, so Send must wait).
  `load(other)` and `reset()` never abort a running answer. `stop()` calls the stop endpoint. Reopened answers use `safety_passed` to set `withheld`, and `status` `stopped`/`error` are shown as such.
- NEW `site design/src/hooks/useAgentActivity.ts`: `{ running: {conversationId, question}[], ready: {conversationId, question}[] (finished while the person was not looking at that chat), markSeen(conversationId) }`.
- `Sidebar.tsx`: a small red square pulsing next to "AI Agent" while any answer runs; a count badge when answers are ready. On `/agent` the main sidebar collapses to its existing narrow icon rail (the same one used below 1024 px) so the chat gets room; a hover/tooltip still names each item.
- `AppShell.tsx`: a toast at the bottom right when an answer finishes while the person is on another page or another chat: "Your answer is ready" + the question (one line) + "Open" (goes to `/agent?c=<id>`) + close. Keep `appActivity.agentBusy` and `saveLastAnswer` working exactly as today.

### 2.2 AI Agent page layout and side panel (F2)

- Layout at >= 1024 px: [collapsed app rail] [History 264 px] [chat] [side panel, optional].
- History (`ConversationList.tsx`): "New chat" button; search box (filters titles client-side); sections Pinned / Today / Yesterday / Earlier; one-line rows (title, relative time, red running square when running, red dot when ready-unseen); a "..." menu per row with Rename (inline input, Enter saves via PATCH), Pin/Unpin, Delete (confirm dialog like My Data's). No red Delete text on every row. "1 question" / "N questions" (from `turns`).
- Sticky chat top bar (stays visible while scrolling): editable chat title (pencil, Enter saves), the report scope chip, buttons "History" (toggle), "Panel" (toggle side panel), "+ New chat".
- Composer: keeps today's behaviour; a toolbar row with "Report" (pick a report to scope, replaces the old chip logic), "Chart" (puts "Show a chart of " into the box), "Write a report" (puts "Write a report about " into the box). Draft comes from `useAgentChat().draft`. While another chat is answering, Send is disabled with the note "Another chat is still answering."
- Side panel (`components/agent/SidePanel.tsx`, replaces `ReportPanel.tsx` usage): tabs (each closable) of kinds `report` (saved report preview iframe `sandbox=""` + Download PDF + Print), `chart` (`<ChartView>`), `page` (`<PageView>`), `reports` (saved reports list with delete confirm). Opening the same item focuses its tab instead of adding a copy. Resize by dragging its left edge (min 360 px, max 60 % of the window; remembered in `localStorage` `vitagraph_agent_panel_width`), a full-screen toggle, Esc leaves full screen. Below 1024 px it opens full screen with a "Back to chat" button. It no longer hides History.
- An answer's ```report block card and "Save as report" open the report tab (the backend is now idempotent, so no duplicates). A ```chart card's "Open" opens a chart tab. A passage slip's "See it on the page" opens a page tab.

### 2.3 Charts and page view components (F3)

- NEW `site design/src/api/charts.ts`: `chartsApi.render(userId, spec) -> ChartResult` (types from 1.2) and `chartsApi.highlight(userId, reportId, page, charStart, charEnd) -> { rects, method }`.
- NEW `site design/src/lib/chartSpec.ts`: `type ChartSpec`, `parseChartSpec(text): ChartSpec | null` (JSON, kind check, tests array of 1..4 strings, max lengths; rejects anything with numbers in values).
- NEW `site design/src/components/agent/ChartView.tsx`: props `{ userId: string; spec: ChartSpec; compact?: boolean }`; fetches `chartsApi.render`, shows the server SVG via an `<img src="data:image/svg+xml;...">` (never injected into the DOM), plus a "Show as table" fold with the values, units, flags, report label and page, and "Download SVG". Loading / error states in plain words.
- NEW `site design/src/components/agent/ChartCard.tsx`: props `{ userId: string; spec: ChartSpec; onOpen: (spec: ChartSpec) => void }`; compact chart inside the answer with title and an "Open" button.
- NEW `site design/src/components/agent/PageView.tsx`: props `{ userId: string; reportId: string; page: number; charStart: number | null; charEnd: number | null; label?: string }`; the page image with translucent red highlight boxes from `chartsApi.highlight`, Fit width / 50 / 100 / 150 / 200 % zoom, scrolls the first box into view; when `method` is `none` it says "The exact spot could not be marked on this page."
- `AnswerMarkdown.tsx`: new optional props `userId?: string` and `onChart?: (spec: ChartSpec) => void`; a ```chart block renders `<ChartCard>` (or, if the spec does not parse, a short note "This chart could not be drawn."); while streaming an unfinished ```chart block shows "Drawing a chart...".
- `PassageSlip.tsx`: new optional prop `onOpenPage?: () => void` rendering a "See it on the page" action.
- `lib/linkCitations.ts` / `lib/answerFormat.ts`: a ```chart block is not a citation target and does not count as code for the Sources row (edit only if needed).

## 3. Ownership

| Agent | Model | Files |
|---|---|---|
| R1 backend runs | Sonnet | `app/agent/runs.py` (new), `app/routes/agent.py` (stream, runs, conversations; NOT `create_report`), `app/services/agent_service.py`, `app/services/conversation_service.py`, `app/core/database.py`, `app/schemas/*` for these routes, `app/main.py` (lifespan cleanup only), new tests `tests/test_agent_runs.py`, `tests/test_agent_conversations_v2.py` |
| R2 backend visuals | Sonnet | `app/services/chart_service.py` (new), `app/routes/charts.py` (new), `app/main.py` (one include line), `app/services/report_render.py`, `app/services/report_artifacts.py`, `app/routes/agent.py` `create_report` function ONLY if dedupe cannot live in `report_artifacts.py`, `app/agent/prompt.py`, `app/routes/reports.py` (highlight route), a new `app/services/page_highlight.py`, new tests `tests/test_chart_service.py`, `tests/test_page_highlight.py`, `tests/test_report_dedupe.py` |
| F1 run store | Sonnet | `src/lib/agentRuns.ts`, `src/api/agentRuns.ts`, `src/hooks/useAgentChat.ts`, `src/hooks/useAgentActivity.ts`, `src/components/shell/Sidebar.tsx`, `src/components/shell/AppShell.tsx` |
| F2 page layout | Sonnet | `src/pages/AgentPage.tsx`, `src/components/agent/ConversationList.tsx`, `src/components/agent/SidePanel.tsx` (new), `src/components/agent/ReportPanel.tsx`, `src/api/agent.ts`, `src/index.css` (append only, classes prefixed `vg-agent-`) |
| F3 charts + page view | Haiku | `src/api/charts.ts`, `src/lib/chartSpec.ts`, `src/components/agent/ChartView.tsx`, `ChartCard.tsx`, `PageView.tsx`, `AnswerMarkdown.tsx`, `PassageSlip.tsx`, `src/lib/linkCitations.ts`, `src/lib/answerFormat.ts` |

`app/routes/agent.py` is shared by R1 and R2 (R2 only if needed, `create_report` only); `app/main.py` by R1 and R2: re-read right before editing and make the smallest additive edit.
