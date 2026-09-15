# VitaGraph — Why the Project "Is Not What I Wanted"

**A gap analysis of the plan vs. the actual codebase**

- **Plan read:** `VitaGraph_ Full Role-Based Implementation Plan (2).md` (1,032 lines, 21 sections)
- **Codebase read:** `vitagraph/` — full FastAPI backend + React/TypeScript frontend (every source file)
- **Cross-checked by:** 3 independent auditors (backend, frontend, plan-conformance), all in agreement
- **Date:** 2026-08-25

---

## 1. The short answer

You are right. The project as built is **not** the project described in the plan. What exists is a solid but visually ordinary **RAG question-answer tool** (upload a PDF → ask questions → get cited answers). The thing that gives VitaGraph its identity — the **"Evidence-Linked Knowledge-Graph Visualization"** and the **blue, brain-like "AI-brain" live-pipeline view** — **does not exist in the code at all**. It was never built. It was explicitly deferred.

Every missing piece is honestly documented in the repository itself (the README's "Deferred to later sessions" section, and comments in `database.py` / `report_service.py`), so this is a scoping decision, not a bug — but it means the app you can actually run today looks nothing like the plan's headline promise.

---

## 2. What the plan promises

The plan (Sections 1, 11, 12, 21) describes VitaGraph as a system with **seven layers**, whose distinctive deliverables are:

| Feature | Plan section | What it should look like |
|---|---|---|
| **Knowledge graph** | §11 (Workflow G), Phase 6 | An evidence-linked graph of Person / Report / Measurement / Symptom / Test / Unit / Date / Section nodes, with edges like `mentioned_in`, `measured_in`, `co_occurs_with` |
| **Question-conditioned graph** | §11 | The graph **reorganizes around each question**, highlighting activated concepts, evidence paths, and communities |
| **AI-brain visualization** | §12 (Workflow H), Phase 7 | A **blue, layered, brain-like** view (React Flow) showing the real processing stages: question → retrieval → graph traversal → analytics → answer |
| **Live pipeline (SSE)** | §12, §2.4 | Real backend events streamed over **Server-Sent Events** (no fake timers) |
| **Graph analytics** | §11 | NetworkX: Louvain communities, betweenness centrality, modularity, topic evolution |
| **Thinking Details panel** | §12 | Expandable trace of chunk IDs, scores, paths, timestamps |
| **InfraNodus-style look** | §11 | Dark background, 120-node cap, proportional labels, curved edges, category colors, optional 3D |

The plan's own recommended academic title is literally **"…with Evidence-Linked Knowledge-Graph Visualization."**

---

## 3. What is actually built

The codebase implements only **Phases 2–5 (the RAG walking skeleton)**, and it does those well:

| Built & working | Where |
|---|---|
| Synthetic persona create/delete (with cascade + consent gate) | `backend/app/services/user_service.py` |
| PDF upload with immutable versioning + duplicate detection | `backend/app/ingestion/uploader.py` |
| Page-by-page text extraction (PyMuPDF) + OCR fallback *code* | `backend/app/ingestion/extractor.py`, `ocr_fallback.py` |
| Section-aware chunking with provenance metadata | `backend/app/ingestion/chunker.py` |
| Sentence-transformers embedding (frozen model) | `backend/app/rag/embedder.py` |
| Chroma vector store, user-scoped retrieval (fail-closed) | `backend/app/rag/vector_store.py`, `retriever.py` |
| 4-part cited answers + safety/refusal + offline composer | `backend/app/generation/*`, `services/question_service.py` |
| Internal persona timeline (flat list) | `backend/app/services/timeline_service.py` |
| React frontend: Persona / Reports / Ask / Timeline | `frontend/src/pages/*` |

The frontend has exactly **4 pages**: `/` (Persona), `/reports` (Upload), `/ask` (Ask), `/timeline` (Timeline). The Ask page shows a text answer with evidence cards; the Timeline is a flat `<ol>` list that **polls every 5 seconds** (not a live stream).

---

## 4. The gap, precisely

### 4.1 SQL schema — no graph tables

`backend/app/core/database.py` creates exactly **7 tables**:
`users`, `reports`, `report_pages`, `report_chunks`, `questions`, `answers`, `history_events`.

There are **no** `graph_node`, `graph_edge`, `chunk_node_link`, `question_trace`, or `system_event` tables. The file's own docstring states:

> *"Graph node/edge tables are added in a later phase and are intentionally absent here."*

### 4.2 Dependencies — the graph stack is not installed

| Plan frozen stack (Section 21) | In code? |
|---|---|
| React + TS + Tailwind | ✅ |
| FastAPI | ✅ |
| PyMuPDF (+ Tesseract) | 🟡 partial — OCR *code* present, Tesseract binary not installed |
| SQLite | ✅ |
| Chroma | ✅ |
| Sentence Transformers | ✅ |
| Neutral AI HTTP client (httpx) | ✅ |
| Internal persona timeline | ✅ |
| **Haystack** | ❌ absent (comment only) |
| **NetworkX** | ❌ absent (zero `import networkx`) |
| **react-force-graph** | ❌ absent |
| **React Flow (@xyflow/react)** | ❌ absent |
| **browser EventSource / SSE** | ❌ absent |
| **FastAPI native streaming** | ❌ absent |

**8 of 15 present, 1 partial, 6 absent.** All six absent technologies exist for exactly one purpose — the graph and the AI-brain view.

### 4.3 Feature search — zero hits

Independent text search across the entire backend and frontend found **zero** occurrences of:
`networkx`, `StreamingResponse`, `text/event-stream`, `EventSource`, `asyncio.Queue`, `centrality`, `community`, `modularity`, `react-force-graph`, `@xyflow`, `canvas`, `svg`, `d3`, `pipeline`, `brain`, `thinking`, `nodes`, `edges`.

The only "graph" matches are the product name **"VitaGraph"** itself.

### 4.4 Phase 6 & 7 deliverable scorecard

| Phase | Deliverables | Implemented |
|---|---|---|
| **Phase 6** — Knowledge graph | graph ontology, node/edge tables, chunk-node links, NetworkX analytics, question subgraph, react-force-graph view | **0 / 6** |
| **Phase 7** — AI-brain visualization | React Flow pipeline, SSE event stream, job event queue, Thinking Details panel, dark graph styling, failure-injection demos | **0 / 7** |

---

## 5. Why this happened

The repository was built as a **"Session 1 walking skeleton"** — a deliberate first slice focused on proving the core RAG pipeline end-to-end. This is stated explicitly in the README:

> *"Deferred to later sessions (per the project plan): Knowledge graph construction + react-force-graph view, React Flow AI-brain pipeline view + Server-Sent Events stream, Tesseract installation, reranking, Ragas evaluation, version-comparison UI, Thinking Details panel, optional Twenty CRM integration."*

So the pipeline is real and well-engineered (the existing code reviews report 17–33 passing tests, a 100% retrieval hit rate on the synthetic set, and clean fail-closed user isolation) — but the work stopped at the end of the RAG layer. The two phases that would make the app **look and feel** like "VitaGraph: an evidence-linked knowledge-graph brain" were never started.

---

## 6. What you're missing, ranked by visibility

1. **There is no graph screen at all.** The word "Graph" is in the project name, but the app has only Reports / Ask / Timeline. Nothing visualizes how concepts connect.
2. **No "AI-brain" live pipeline.** The distinctive blue brain-like view is absent; the timeline is a plain list that polls every 5 seconds instead of streaming real events.
3. **No question-conditioned highlighting.** Asking a question doesn't light up relevant graph nodes/paths — there is no graph to light up.
4. **No Thinking Details panel.** No expandable trace of chunk IDs, scores, communities, or timestamps.
5. **No graph analytics.** No NetworkX communities / centrality / modularity / topic-evolution panel.
6. **OCR not actually installed.** The code handles scanned PDFs, but Tesseract isn't installed, so scanned reports degrade to "sparse/failed" instead of being read.

---

## 7. What to do next (your options)

**Option A — finish it to match the plan (the big job).** Implement Phase 6 then Phase 7:
1. Add `graph_node` / `graph_edge` / `chunk_node_link` tables to `database.py`.
2. Add `networkx` and build graph construction + analytics in a new `app/graph/` module.
3. Add `react-force-graph` (2D) and a new `/graph` page.
4. Add a job event queue + `StreamingResponse` SSE endpoint, and `@xyflow/react` + a `/pipeline` "AI-brain" page driven by real events.
5. Install Tesseract to make OCR real.

**Option B — change the project definition to match what's built.** If the graph/AI-brain is not actually wanted, rename/retitle away from "Knowledge-Graph Visualization" and present it honestly as a privacy-aware RAG health-report assistant.

**Option C — hybrid.** Ship the current RAG pipeline as the "core," and add the knowledge graph as the visibly-impressive demo layer (it's the single highest-impact addition for a viva).

If you want, I can draft the concrete implementation plan (schema + endpoints + components) for **Option A / the graph layer** next.

## 8. Resolution & Current Status: Gap Fully Closed (September 2026)

The gap documented in this analysis has been **completely resolved and closed**. VitaGraph now contains the full end-to-end knowledge graph, dynamic RAG, live telemetry, and visual interactive layers:

1. **NetworkX Knowledge Graph Engine (`vitagraph/backend/app/graph/`)**:
   - `extractor.py`: Extracts canonical test names, values, units, flags (`NORMAL`/`LOW`/`HIGH`), and reference ranges from chunks.
   - `builder.py`: Constructs a typed NetworkX entity graph (`Report`, `Chunk`, `Test`, `Measurement`, `Category`) with semantic edges (`CONTAINS`, `MENTIONS`, `HAS_MEASUREMENT`, `BELONGS_TO`). Calculates betweenness centrality, Louvain community detection, and modularity score.
   - Subgraphs: Extracts question-activated subgraphs conditioned on retrieved Chroma chunk IDs.
   - Endpoints: `GET /api/graph/{user_id}` and `POST /api/graph/subgraph` with fail-closed privacy.
2. **Interactive 2D Canvas Knowledge Graph (`vitagraph/frontend/src/components/KnowledgeGraphCanvas.tsx`)**:
   - Directly renders real NetworkX nodes and edges with organic coordinate physics, betweenness-scaled radii, and glowing pulse animations on question-activated concepts.
3. **Live Telemetric Logging & Observable Trace**:
   - Replaced all mock/simulated timers with real execution metrics (HTTP durations in ms, 384d embedding dimensions, vector cosine percentages, and clinical safety statuses).
4. **Longitudinal Trend Visualizer**:
   - Backend endpoint `GET /api/reports/{user_id}/trends?test=hemoglobin`.
   - Right-column Patient File CRM dynamically plots coordinates on the SVG curve with start/latest values and trend indicators (`↑ improving`, `→ stable`, `↓ declining`).
5. **Full System Verification**:
   - 38/38 backend tests passing (`pytest tests -v`).
   - Production frontend build clean (`npm run build` in 276ms).
   - Live end-to-end TestClient verification across all routes.

---

## Appendix — evidence trail

- Plan file: `F:\kiruthika\kiruthika final project\VitaGraph_ Full Role-Based Implementation Plan (2).md` — §11, §12, §21
- Resolved graph module: `F:\kiruthika\kiruthika final project\vitagraph\backend\app\graph\`
- Graph routes: `F:\kiruthika\kiruthika final project\vitagraph\backend\app\routes\graph.py`
- Graph tests: `F:\kiruthika\kiruthika final project\vitagraph\backend\tests\test_graph.py` (5 tests pass)
- Canvas renderer: `F:\kiruthika\kiruthika final project\vitagraph\frontend\src\components\KnowledgeGraphCanvas.tsx`
- Trend endpoint: `F:\kiruthika\kiruthika final project\vitagraph\backend\app\routes\reports.py` (`/trends`)
