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

---

## 2. Application Pages (11 Screens)

| Screen | Route | Description |
|---|---|---|
| **Upload & Ingest** | `/upload` | Drag-and-drop report ingestion with a live 5-stage pipeline animation (5 s per stage at normal speed), page-by-page quality manifest, and interactive stage. |
| **Library** | `/library` | Comprehensive document registry showing SHA-256 hashes, page/chunk counts, indexed status, extracted biomarker values with reference ranges, and character-accurate evidence slips. |
| **AI Agent** | `/agent` | Provenance-grounded question answering powered by real-time Server-Sent Events (`POST /api/agent/stream`). Displays live thinking traces, tool execution, grounded answers, and fail-closed safety refusals. |
| **Knowledge Graph** | `/graph` | 3D canvas viewport rendering ontology nodes (Subject, Report, Section, Biomarker, Measurement, Uncertainty). Features collision-free readable labels, community subgraphs, rotation/pause, and node inspector. |
| **Timeline** | `/timeline` | Longitudinal patient ledger showing reports over time alongside 3D isometric charts visualizing biomarker changes across chronological panels. |
| **Compare** | `/compare` | Side-by-side delta analysis between any two longitudinal panels with computed absolute changes and directional tags. |
| **Insights** | `/insights` | Graph structural analytics including node/edge counts, Betweenness Centrality rankings, and inter-entity relation distributions. |
| **Image to Text** | `/tools/ocr` | Standalone optical character recognition tool for scanned health documents and test receipts. |
| **PDF to Text** | `/tools/pdf` | Digital text layer inspector extracting per-page plain text and layout coordinates. |
| **Text to Graph** | `/tools/graph` | Clinical text-to-graph extraction playground mapping unstructured notes into interactive entity graphs. |
| **Settings** | `/settings` | Ingestion pipeline speed multipliers, chunk size tuning slider (120 to 600 tokens), privacy guarantees, and persona management. |

---

## 3. AI Agent Architecture

The AI Agent executes through a secure, grounded multi-step reasoning harness:
- **Streaming Protocol:** Server-Sent Events over `POST /api/agent/stream`.
- **Event Lifecycle:**
  1. `status`: Lifecycle indicators (`starting`, `searching`, `synthesizing`).
  2. `step`: High-level reasoning stage announcements.
  3. `thinking`: Raw model chain-of-thought tokens.
  4. `tool_call`: Read-only tool invocation with JSON arguments.
  5. `tool_result`: Tool output returned to the harness.
  6. `text_delta`: Incremental answer markdown stream.
  7. `stats`: Operational telemetry (latency, token counts, chunks evaluated).
  8. `completed`: Final structured result with citation indices.
  9. `error`: Transparent diagnostic error messages.
- **Read-Only Tool Harness:**
  - `get_biomarkers`: Query extracted lab values and reference ranges for a report or panel.
  - `get_trends`: Retrieve longitudinal biomarker progression across dates.
  - `query_chroma`: Vector search over sentence-aware chunks using cosine similarity.
  - `query_graph`: Graph traversal querying neighbors, paths, and centralities.
- **Safety Policy:** Fail-closed boundary; questions seeking clinical diagnosis or prescription trigger an immediate structured refusal card with zero hallucination.

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
│   │   ├── pages/             # 11 application screen components
│   │   └── theme/             # Modernist theme tokens and CSS
│   └── package.json
└── vitagraph/
    └── backend/               # FastAPI backend
        ├── app/               # Routes, core services, RAG pipeline, agent harness
        └── tests/             # Pytest test suite (218 tests)
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

# Run test suite (218 tests):
python -m pytest tests -q

# Start FastAPI server on port 8000 (or 8001 for worktree):
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Running the Frontend
```powershell
cd "site design"

# Production build check:
npm run build

# Start development server on port 5173 (or 5174 for worktree):
npm run dev
```

---

## 6. Safety & Privacy Guardrails

1. **No External Entity Identification:** Never expose model names or external providers in the UI.
2. **Local-First Grounding:** All claims must link back to specific character offsets in raw report PDFs.
3. **Fail-Closed Clinical Refusal:** Educational and organizational use only.
