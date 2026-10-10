# VitaGraph — Project Context & Working Rules

Also read `AGENTS.md` (loop constitution) and `gemini/DESIGN_LAW.md` (the reference design wins).

## 1. Project Identity
VitaGraph is a Privacy-Aware Retrieval-Augmented System for Longitudinal Health-Report Analysis with Evidence-Linked Visualization. It is a Final-Year B.Tech Computer Science & Engineering project.

## 2. Design System: Modernist (The Reference Wins)
The visual law is the Modernist design system defined by `VitaGraph-App-v3.html` and `design/reference/app-v3-source.html`. This outranks all older task files and plans.
- **Font:** Archivo only (weights 400, 600, 800). No serif, mono or display fonts in UI.
- **Geometry:** Strictly flat surfaces with 0px border-radius (`--radius-none: 0px`).
- **Color:** Neutral stark palette (`--color-bg: #f3f2f2`, `--color-surface: #eae9e9`, `--color-text: #201e1d`) accented by one vivid red (`--color-accent: #ec3013`).
- **Tokens:** Semantic tokens live in `site design/src/theme/tokens.css` and `modernist.css`.
- **Reference screens:** Measured at 1440 x 900 in `design/reference/screens/*.png`.

## 3. Application Pages (11 Screens)
1. **Upload & Ingest** (`/upload`): Ingestion show (5s per stage), dropzone, page quality manifest, interactive stage.
2. **Library** (`/library`): Report index with SHA-256 hashes, page/chunk counts, biomarker values, reference ranges, and character-level passage preview.
3. **AI Agent** (`/agent`): Provenance-grounded question answering via `POST /api/agent/stream`.
4. **Knowledge Graph** (`/graph`): the `/graph` page is the preview-based graph stage (dark ink stage with a Paper switch, opening sequence, four layouts, lens, What changed, time machine, path finder), readable labels with collision pruning and priority sorting, the node card docked at the right of the stage with the AI summary box (numbered citations to exact passages), rotation/pause; see gemini/DESIGN_LAW.md items 9 to 11.
5. **Timeline** (`/timeline`): Longitudinal reports list and 3D isometric biomarker change charts.
6. **Compare** (`/compare`): Side-by-side longitudinal report comparisons and change deltas.
7. **Insights** (`/insights`): Graph size, betweenness centrality rankings, edge type frequencies.
8. **Image to Text** (`/image-to-text`): Standalone OCR tool.
9. **PDF to Text** (`/pdf-to-text`): Standalone text-layer extraction tool.
10. **Text to Graph** (`/text-to-graph`): Standalone clinical text-to-graph extraction tool.
11. **Settings** (`/settings`): Process speed, chunk size slider (120 to 600), privacy controls, persona management.

## 4. AI Agent Streaming Protocol
The frontend consumes Server-Sent Events from `POST /api/agent/stream` (fetch + ReadableStream). Every frame carries `event_type` and a `metadata` payload:
1. `status`: Lifecycle updates (`starting`, `working`, `retrying`).
2. `step`: `{ "phase": "start"|"end", "step": n }`.
3. `model`: Live model activity from the loopback route: `{ "phase": "start"|"end"|"error", "call": n, "ms", "first_ms", "input_tokens", "output_tokens", "tool_calls" }`.
4. `thinking`: The model's reasoning summary (the raw private chain of thought is not available from the API).
5. `tool_call`: `{ "id", "tool", "arguments", "step" }`.
6. `tool_result`: `{ "id", "tool", "result", "is_error", "duration_ms" }`.
7. `text_delta`: `{ "delta": "..." }` (streaming Markdown; text of a model call that then runs tools is narration, the last call without tools is the answer).
8. `stats`: Steps, tool calls, elapsed ms, token counts.
9. `completed`: `{ "status": "answered"|"refused", "summary_text", "evidence": [...], "safety_passed" }` then a terminal `done`.
10. `error`: `{ "message", "diagnostic" }`.

### Five Read-Only Harness Tools (exactly these, none with a person parameter):
- `list_reports`: The person's reports and ids.
- `search_reports`: Vector search over report passages; numbered evidence cards with character offsets (opening passages as a marked fallback).
- `get_measurements`: Extracted lab values, ranges and flags of one report.
- `graph_lookup`: Related concepts and paths in the person's graph.
- `calculate`: Exact arithmetic (`app/agent/calc.py`, AST whitelist; no names, attributes, files or network). Added 2026-10-08 by owner decision.

### Reports and code
- The agent never writes HTML. A report is Markdown in a ```report block; the server renders it (`report_render.py`: raw HTML, images and links off, strict CSP) and builds the PDF with PyMuPDF; saved in `agent_artifacts` (`/api/agent/reports`). The browser shows it in an iframe with `sandbox=""`.
- Code is only shown (highlighted, Copy), never run.

### Safety Gates:
- Clinical advice, diagnoses, or prescriptions are refused fail-closed by system policy.
- All statements must cite verifiable evidence passages with character offsets.

## 5. Working Rules
- **No Provider or Model Names:** Never mention or display LLM provider or model names anywhere in the UI.
- **No Placeholders / Fake Timers:** Real data only. No setTimeout fake progress where endpoints exist.
- **Stage by Explicit Path:** Never use `git add .`. Never stage `site design/tsconfig.tsbuildinfo`.
- **Never Commit While Red:** Every commit must have `npm run build` exit code 0 and pytest green.
- **Never Touch The Other Folder:** When working in `vitagraph-backend-track`, do not touch `kiruthika final project`.
- **Never Push or Reset:** Never `git push`, merge, rebase, `reset --hard`, clean, or amend.

## 6. Verification Commands (Windows)
- **Backend:** `cd vitagraph/backend && .venv\Scripts\python.exe -m pytest tests -q` (426 tests passing)
- **Frontend:** `cd "site design" && npm run build`
- **Dev Servers:**
  - Backend: `uvicorn app.main:app --port 8000` (port 8001 for worktree)
  - Frontend: `npm run dev` (port 5173, or port 5174 for worktree)
- **Secret Scan:** `python scripts/plan/secret_scan.py` (must print `RESULT: PASS`)
