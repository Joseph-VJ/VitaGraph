# VitaGraph

A privacy-aware retrieval-augmented system for longitudinal health-report
analysis with evidence-linked visualization — final-year B.Tech project.

> **Boundary:** VitaGraph is an educational report-organization and
> evidence-retrieval system. It is **not** a doctor, diagnostic system,
> treatment recommender, emergency service, or clinical decision-support
> product. All demo data is synthetic.

## What this repository contains (Session 1 — walking skeleton)

The complete core pipeline works end-to-end:

1. Create a **synthetic persona**.
2. **Upload** a PDF report — the original file is preserved unchanged as an
   immutable version.
3. **Extract** text page by page (PyMuPDF; OCR fallback code exists and
   degrades gracefully when Tesseract is not installed).
4. **Chunk** the text with provenance (report, page, character span,
   section) and rich metadata.
5. **Embed** with sentence-transformers (frozen model) and **index** in a
   local Chroma store, always filtered by user.
6. **Ask a question** — evidence is retrieved from that persona's reports
   only; answers are composed offline (evidence-only composer) or through a
   neutral external AI service when enabled, and always show the mandatory
   four parts: *what the reports say*, *evidence used*, *what cannot be
   concluded*, and *safety guidance*.
7. **Knowledge Graph** (NetworkX) — extracts typed observation entities (tests,
   values, units, flags, reference ranges) and builds an entity-relationship
   graph with betweenness centrality, Louvain communities, modularity, and
   question-conditioned subgraph activation.
8. **Longitudinal Trends** — aggregates historical lab tests chronologically
   across all reports with trend direction (`improving`, `declining`, `stable`).
9. **Interactive Visual Stage & Canvas** — 3-column UI with live technical
   telemetry, 6-stage pipeline, 2D HTML5 canvas physics, and dynamic SVG trend wave.
10. **Animated front page** — a dark, InfraNodus-style text-network entry view
    (`FrontPage.tsx`) that turns any pasted text into a live force-directed graph
    (word co-occurrence nodes, curved links, community colors, drag/zoom/hover),
    with a "Open patient workflow" button into the 3-column app. Low-end friendly
    (DPR capped, repulsion cutoff, fixed-step physics, reduced-motion respected).

Diagnosis/medication/triage requests are refused with a boundary response.
Insufficient evidence is reported honestly. Retrieval without a user filter
fails closed. Prompt-injection phrasing inside questions is treated as data.

## Repository layout

```
backend/
  app/
    main.py            FastAPI app + router mounting only
    core/              config.py (all settings), database.py (SQLite schema)
    graph/             extractor.py (observation parsing), builder.py (NetworkX graph)
    schemas/           Pydantic models (graph, report, question, user)
    routes/            thin HTTP handlers (users, reports, questions, timeline, graph)
    services/          business logic (user, report, question, timeline)
    ingestion/         one pipeline stage per file: uploader, extractor,
                       ocr_fallback, chunker
    rag/               embedder, vector_store, retriever (user-scoped)
    generation/        ai_client (neutral service), fallback_composer, safety
    utils/             file hashing + upload validation
  tests/               user isolation, ingestion, safety, graph, trends (38 tests)
frontend/              Vite + React 19 + TypeScript + Tailwind 4
  src/api/             one file per backend domain (client, users, reports, questions, graph)
  src/components/      MainStageView, KnowledgeGraphCanvas, TechnicalPanel,
                       PatientFilePanel, FrontPage, ForceGraph
sample_data/           synthetic PDF generator + labeled question set
docs/                  dependency register + API.md (endpoint reference)
backend/verification/   API probe script + sample requests + run reports
```

## Setup

### Backend (Python 3.11+; developed on 3.13)

```bash
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt   # Windows
copy .env.example .env                                    # defaults are offline-safe
.venv\Scripts\python -m pytest tests                      # run the test suite
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

The first upload downloads the frozen embedding model
(`sentence-transformers/all-MiniLM-L6-v2`, ~90 MB).

### Frontend (Node 18+)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### One-click (Windows)

Double-click `run_dev.bat`.

### Verify the whole system (recommended before demo)

```bash
# 1. tests
backend\.venv\Scripts\python -m pytest tests

# 2. frontend production build (type-check + bundle)
cd frontend && npm run build

# 3. end-to-end API loop (needs backend on :8000)
backend\.venv\Scripts\python -m uvicorn app.main:app --port 8000
pwsh backend\verification\sample_requests.ps1
```

`backend/verification/` contains the probe/e2e scripts and their saved run
reports (`api_probe_report.txt`, `e2e_loop_report.txt`) as the traceable record
of API activity. Full endpoint reference: `docs/API.md`.

### Troubleshooting

- **`Cannot reach the VitaGraph backend`** in the UI → start the backend on
  `:8000` first; the frontend talks to it at `http://localhost:8000` (override
  with `VITE_API_URL`).
- **First upload is slow** → the frozen embedding model downloads once (~90 MB).
- **Scanned PDF reads "sparse/failed"** → Tesseract OCR is not installed (documented deferral); native-text PDFs work.
- **Port conflict** → change `--port` and set `VITE_API_URL` in `frontend/.env`.
- **No AI answer, only local composer** → set `ALLOW_API=true` + keys in `backend/.env` (offline mode is intentional).

### Sample data

```bash
backend\.venv\Scripts\python sample_data\generate_reports.py
```

generates two synthetic lab reports (January + June) into `sample_data/`.
Upload both for one persona, then try the questions in
`sample_data/questions.json` from the Ask screen.

## Enabling the neutral AI generation service

The system runs fully offline by default (`ALLOW_API=false`): answers are
composed locally from the retrieved evidence only. To plug in any
OpenAI-compatible chat endpoint, edit `backend/.env`:

```
ALLOW_API=true
AI_SERVICE_URL=https://<your-endpoint>/v1/chat/completions
AI_SERVICE_API_KEY=<key>      # never commit this file
AI_SERVICE_MODEL=<label>
```

Only the selected evidence snippets, the question, and safety instructions
cross this boundary — never full reports. A composed answer that fails the
post-generation safety check is replaced by the local composer. When the
service is disabled or unreachable, the local core keeps working and the
answer is labeled with the honest service status.

## Configuration notes

- `MIN_EVIDENCE_SCORE=0.40` was calibrated on the synthetic evaluation set
  (`sample_data/questions.json`): real evidence matches score 0.49–0.71 with
  the frozen embedding model; the best unrelated topical hit observed was
  0.364. Re-calibrate if you change the embedding model or chunking policy.
- Data lives in `backend/data/` (SQLite, uploads, Chroma index) and is
  git-ignored.

## Completed Beyond Walking Skeleton (Phases 1–6)

- **NetworkX Knowledge Graph:** Observation entity extraction, typed entity-relationship graph, betweenness centrality, Louvain communities, modularity, and question subgraphs.
- **Dynamic 3-Column UI:** Full 6-stage pipeline, live telemetric log stream, dynamic evidence cards, and interactive 2D canvas graph.
- **Longitudinal Trend Visualization:** Chronological lab measurement tracking and dynamic SVG wave chart.

## Deferred to later phases (per master project plan)

Tesseract local installation, cross-encoder reranking, Ragas evaluation metrics, version-comparison UI diffing, optional Twenty CRM external sync.
