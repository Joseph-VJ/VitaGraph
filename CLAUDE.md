# VitaGraph — Project Context & Working Rules

Also read `AGENTS.md` (loop constitution) and `gemini/DESIGN_LAW.md` (the reference design wins).

## 1. Project Identity
VitaGraph is a Privacy-Aware Retrieval-Augmented System for Longitudinal Health-Report Analysis with Evidence-Linked Visualization. It is a Final-Year B.Tech Computer Science & Engineering project.

## 2. Design System: Modernist (The Reference Wins)
The visual law is the Modernist design system defined by `VitaGraph-App-v3.html` and `design/reference/app-v3-source.html`. This outranks all older task files and plans.
- **Font:** Archivo only (weights 400, 600, 800). No serif, mono or display fonts in UI.
- **Geometry:** Strictly flat surfaces with 0px border-radius (`--radius-none: 0px`).
- **Color:** Neutral stark palette (`--color-bg: #ffffff`, `--color-surface: #f7f7f7`, `--color-text: #111111`) accented by one vivid red (`--color-accent: #e03e1a`).
- **Tokens:** Semantic tokens live in `site design/src/theme/tokens.css` and `modernist.css`.
- **Reference screens:** Measured at 1440 x 900 in `design/reference/screens/*.png`.

## 3. Application Pages (11 Screens)
1. **Upload & Ingest** (`/upload`): Ingestion show (5s per stage), dropzone, page quality manifest, interactive stage.
2. **Library** (`/library`): Report index with SHA-256 hashes, page/chunk counts, biomarker values, reference ranges, and character-level passage preview.
3. **AI Agent** (`/agent`): Provenance-grounded question answering via `POST /api/agent/stream`.
4. **Knowledge Graph** (`/graph`): 3D canvas with isometric perspective, readable labels (collision pruning, priority sorting), community subgraphs, rotation/pause.
5. **Timeline** (`/timeline`): Longitudinal reports list and 3D isometric biomarker change charts.
6. **Compare** (`/compare`): Side-by-side longitudinal report comparisons and change deltas.
7. **Insights** (`/insights`): Graph size, betweenness centrality rankings, edge type frequencies.
8. **Image to Text** (`/tools/ocr`): Standalone OCR tool.
9. **PDF to Text** (`/tools/pdf`): Standalone text-layer extraction tool.
10. **Text to Graph** (`/tools/graph`): Standalone clinical text-to-graph extraction tool.
11. **Settings** (`/settings`): Process speed, chunk size slider (120 to 600), privacy controls, persona management.

## 4. AI Agent Streaming Protocol
The frontend consumes Server-Sent Events from `POST /api/agent/stream` (or `/api/agent/stream` via fetch ReadableStream):
1. `status`: Lifecycle updates (`starting`, `searching`, `synthesizing`).
2. `step`: High-level reasoning milestone announcements.
3. `thinking`: Model thought chain deltas.
4. `tool_call`: `{ "tool": "get_biomarkers"|"get_trends"|"query_chroma"|"query_graph", "args": {...}, "call_id": "..." }`
5. `tool_result`: `{ "call_id": "...", "result": {...} }`
6. `text_delta`: `{ "delta": "..." }` (streaming markdown text tokens)
7. `stats`: Operational metrics (latencies, token counts, chunks).
8. `completed`: `{ "status": "answered"|"refused", "evidence": [...] }`
9. `error`: `{ "message": "...", "detail": "..." }`

### Four Read-Only Harness Tools:
- `get_biomarkers`: Query extracted lab values from a report.
- `get_trends`: Retrieve historical lab values across dates.
- `query_chroma`: Vector search over sentence-aware chunks.
- `query_graph`: Graph query for related concepts and paths.

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
- **Backend:** `cd vitagraph/backend && .venv\Scripts\python.exe -m pytest tests -q` (213 tests passing)
- **Frontend:** `cd "site design" && npm run build`
- **Dev Servers:**
  - Backend: `uvicorn app.main:app --port 8000` (port 8001 for worktree)
  - Frontend: `npm run dev` (port 5173, or port 5174 for worktree)
- **Secret Scan:** `python scripts/plan/secret_scan.py` (must print `RESULT: PASS`)
