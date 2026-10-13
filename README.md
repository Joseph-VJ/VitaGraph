# VitaGraph

**A Privacy-Aware Retrieval-Augmented System for Longitudinal Health-Report Analysis with Evidence-Linked Visualization**  
*Final-Year B.Tech Computer Science & Engineering Project*

---

> ### ⚠️ Clinical & Safety Boundary
> **VitaGraph is an educational, evidence-organization, and provenance-preservation system.**  
> It is **not** a diagnostic medical tool, clinician replacement, emergency triage service, or prescriptive drug recommender. All clinical advice, treatment decisions, and diagnostic inquiries are refused fail-closed by system policy. All demonstration datasets and persona profiles are entirely synthetic or de-identified. Never show provider or model names in the user interface.

---

## 1. What VitaGraph Is

VitaGraph reads longitudinal health reports (PDFs and lab panels), extracts structured biomarkers with exact character-level document provenance, builds a multi-relational Knowledge Graph, and provides an interactive AI Agent that answers questions strictly supported by verifiable citations.

### Modernist Design Paradigm
The interface follows a rigorous **Modernist** design system (reference prototype: `VitaGraph-App-v3.html`, source in `design/reference/app-v3-source.html`):
- **Typography:** Single universal typeface — **Archivo** (400 regular, 600 semi-bold, 800 extra-bold). No serif or decorative fonts.
- **Geometry:** Pure flat surfaces with zero corner radii (`border-radius: 0px`), structured by 1px and 2px divider lines (`--color-divider: #e0e0e0`).
- **Color Discipline:** High-contrast neutral palette (neutral background `#f3f2f2`, surfaces `#eae9e9`, deep ink `#201e1d`) accented by a single vivid red (`--color-accent: #ec3013`).
- **Tokens:** Defined semantically in `site design/src/theme/tokens.css` and `modernist.css`.
- **Whole-app theme:** Settings → Display → Light / Dark; Dark is the default. The browser remembers the choice and synchronizes tabs. All 14 pages, shell, graphs and generated previews adapt without restarting work or animations. Source PDFs/images/videos and document downloads/printing keep their original colours. Graph colour buttons control this same setting.

---

## 2. Application Pages (14 Screens)

| Screen | Route | Description |
|---|---|---|
| **Upload & Ingest** | `/upload` | Drag-and-drop report ingestion, five pipeline rows with real job output, page quality, and the seven-stage process theatre that follows the upload. |
| **Library** | `/library` | Comprehensive document registry showing SHA-256 hashes, page/chunk counts, indexed status, extracted biomarker values with reference ranges, and character-accurate evidence slips. |
| **My Data** | `/data` | One plain page with everything the active persona added and asked: reports (pages, passages, values, download the original file, delete a report), chats (questions, answers, which reports they used), saved AI reports and an activity feed. |
| **AI Agent** | `/agent` | Cited answers stream through SSE and keep running when the browser leaves the chat. Searchable, pinnable History; resizable report/chart/source-page tabs; charts from stored values; saved HTML/PDF reports and passage highlights. |
| **Knowledge Graph** | `/graph` | 3D canvas viewport rendering ontology nodes (Subject, Report, Section, Biomarker, Measurement, Uncertainty). Features collision-free readable labels, community subgraphs, rotation/pause, and node inspector. |
| **Timeline** | `/timeline` | Longitudinal patient ledger showing reports over time alongside 3D isometric charts visualizing biomarker changes across chronological panels. |
| **Compare** | `/compare` | Side-by-side delta analysis between any two longitudinal panels with computed absolute changes and directional tags. |
| **Insights** | `/insights` | Graph structural analytics including node/edge counts, Betweenness Centrality rankings, and inter-entity relation distributions. |
| **Image to Text** | `/image-to-text` | Standalone optical character recognition tool for scanned health documents and test receipts. |
| **PDF to Text** | `/pdf-to-text` | Digital text layer inspector extracting per-page plain text and layout coordinates. |
| **Text to Graph** | `/text-to-graph` | Clinical text-to-graph extraction playground mapping unstructured notes into interactive entity graphs. |
| **Privacy Shield** | `/privacy` | In Responses format, hides recognised names, IDs, phone numbers and emails locally before sending and restores them on screen. Shows what was sent, supports extra words to hide, and checks the recorded history. Masking is best effort; Chat format is not covered. |
| **Accuracy Test** | `/lab` | The system grades itself on 11 fixed questions about sample reports (never your own): how many it got right, how many unsafe questions it refused, and whether any personal detail got through. Includes a piece-size experiment. |
| **Settings** | `/settings` | Process speed, passage size (120 to 600 characters), display preferences, privacy controls, persona management and AI connection. Test, Save and Remove key are local-only; a saved key cannot be reused for a different host or port without being entered again. |

---

## 3. AI Agent Architecture

The AI Agent executes through a secure, grounded multi-step reasoning harness:
- **Streaming Protocol:** Server-Sent Events over `POST /api/agent/stream`.
- **Event Lifecycle:**
  1. `status`: Lifecycle indicators (`starting`, `searching`, `synthesizing`).
  2. `step`: High-level reasoning stage announcements.
  3. `thinking`: Activity and reasoning summaries; private chain of thought is not available from the API.
  4. `tool_call`: Read-only tool invocation with JSON arguments.
  5. `tool_result`: Tool output returned to the harness.
  6. `text_delta`: Incremental answer markdown stream.
  7. `stats`: Operational telemetry (latency, token counts, chunks evaluated).
  8. `completed`: Final structured result with citation indices.
  9. `error`: Transparent diagnostic error messages.
- **Read-Only Tool Harness (five tools, none takes a person parameter):**
  - `list_reports`: The person's reports and ids.
  - `search_reports`: Vector search over report passages with numbered evidence cards and character offsets.
  - `get_measurements`: Extracted lab values, ranges and flags of one report.
  - `graph_lookup`: Related concepts and paths in the person's graph.
  - `calculate`: Exact arithmetic (safe whitelist; no files, names or network).
- **Safety Policy:** Fail-closed boundary; questions seeking clinical diagnosis or prescription trigger an immediate structured refusal card with zero hallucination.

Answers execute in a server-owned run registry. The first SSE frame is `run`; every frame has an index. `/api/agent/runs/active` and `/api/agent/runs/{id}/events?after=` allow reattachment, while `/stop` explicitly cancels a run. Runs survive browser disconnection; a backend restart closes unfinished answers as stopped.

AI connection routes are `GET /api/ai/model`, `POST /api/ai/model/test`, `POST /api/ai/model` and `POST /api/ai/model/remove-key`. A failed test changes nothing. Saving during an active answer returns 409. The API returns a masked key only. Tests use `VITAGRAPH_ENV_FILE` to keep temporary settings separate from the real `.env`.

---

## 4. Repository Folder Map

```text
vitagraph-backend-track/
├── VitaGraph-App-v3.html      # Frozen reference prototype application
├── AGENTS.md                  # Autonomous agent loop constitution and rules
├── CLAUDE.md                  # Developer guidelines and streaming contracts
├── GEMINI.md                  # Workspace execution rules
├── README.md                  # Main project introduction and documentation
├── design/
│   └── reference/             # Reference source (app-v3-source.html) and 1440x900 screenshots
├── docs/
│   └── ui-ux-design-notes.md  # Design architecture and evolution notes
├── gemini/
│   ├── DESIGN_LAW.md          # Visual law: reference parity is authoritative
│   ├── TASK_S4_lite.md        # Session 4 task specification
│   ├── reports/               # Session summary reports
│   └── shots/                 # 1440x900 browser evidence screenshots
├── scripts/
│   └── plan/                  # Layout verification, a11y, and secret scanning tools
├── site design/               # Frontend (React 19, TypeScript, Vite, Tailwind 4)
│   ├── src/
│   │   ├── api/               # API clients (reports, graph, agent)
│   │   ├── components/        # Shell, UI primitives, graph canvas, agent stream
│   │   ├── pages/             # 14 application screen components
│   │   └── theme/             # Modernist theme tokens and CSS
│   └── package.json
└── vitagraph/
    └── backend/               # FastAPI backend
        ├── app/               # Routes, core services, RAG pipeline, agent harness
        └── tests/             # Pytest test suite (791 passed on 2026-10-12)
```

---

## 5. Quickstart & Verification Guide

### Prerequisites
- Python 3.10+ (Python 3.13 tested)
- Node.js 20+ & npm

### Running the Backend
```powershell
cd vitagraph/backend
# Activate virtual environment if configured:
# .venv\Scripts\activate

# Run test suite (791 passed on 2026-10-12):
.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider

# Start FastAPI server on port 8000 (or 8001 for worktree):
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Running the Frontend
```powershell
cd "site design"

# Production build check:
npm run build

# Start development server on port 5173 (or 5174 for worktree):
npm run dev -- --port 5173 --strictPort
```

---

## 6. Safety & Privacy Guardrails

1. **No External Entity Identification:** Never expose model names or external providers in the UI.
2. **Local-First Grounding:** All claims must link back to specific character offsets in raw report PDFs.
3. **Fail-Closed Clinical Refusal:** Educational and organizational use only.
