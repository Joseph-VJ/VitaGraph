# VitaGraph (v1.0.0)

**A Privacy-Aware Retrieval-Augmented System for Longitudinal Health-Report Analysis with Evidence-Linked Visualization**  
*Final-Year B.Tech Computer Science & Engineering Project*

---

> ### ⚠️ Clinical & Safety Boundary
> **VitaGraph is an educational, evidence-organization, and provenance-preservation system.**  
> It is **not** a diagnostic medical tool, clinician replacement, emergency triage service, or prescriptive drug recommender. All clinical advice, treatment decisions, and diagnostic inquiries are refused fail-closed by system policy. All demonstration datasets and persona profiles are entirely synthetic or de-identified.

---

## 1. System Architecture

VitaGraph is built on the **"Instrument & Paper"** design paradigm:
- **The Instrument (Machine Voice):** Dark, dense, precise telemetry rendered with `IBM Plex Mono`, sub-millisecond latencies, NetworkX force-directed graph stages, and real-time Server-Sent Events (SSE).
- **The Paper (Human Voice):** Clean, serif typography (`Spectral`), notebook-style `PaperSlip` evidence cards with 22px folded corners, and character-accurate bounding-box highlights from raw documents.

```mermaid
graph TD
    PDF[Synthetic Lab PDF] -->|POST /api/reports/upload| Ingest[Ingestion Pipeline]
    Ingest -->|PyMuPDF / OCR Fallback| Pages[report_pages (SQLite)]
    Pages -->|Sentence-aware chunker| Chunks[report_chunks (char_start, char_end)]
    Chunks -->|sentence-transformers/all-MiniLM-L6-v2| Chroma[(ChromaDB Evidence Store)]
    Chunks -->|Entity extraction| Graph[(NetworkX Knowledge Graph)]
    
    User([Researcher / Subject]) -->|Ask Question| RAG[POST /api/questions]
    RAG -->|Filter user_id| Chroma
    RAG -->|Activate Subgraph| Graph
    RAG -->|Live SSE stream| Jobs[/api/jobs/{id}/events]
    RAG -->|4-Part Grounded Answer| UI[Instrument & Paper UI]
    
    UI -->|Click Evidence| SpanViewer[Evidence Span Viewer /api/reports/{id}/pages]
```

### Core Technology Stack
- **Backend Core:** FastAPI (Python 3.13), Uvicorn, SQLite3 (foreign key integrity, audit trails), NetworkX (graph topology & Louvain modularity), ChromaDB (cosine vector store), `sentence-transformers/all-MiniLM-L6-v2`.
- **Streaming Pipeline:** Server-Sent Events (SSE) `text/event-stream` with multi-subscriber broadcast broker and replay buffers.
- **Frontend Core:** React 19, TypeScript 5.8, Vite 8.2, Tailwind CSS 4, Lucide SVG iconography.
- **Verification Engine:** Pytest (43 backend unit & integration tests), Playwright browser automated verification.

---

## 2. User Stories & Implementation Verification (US-01 — US-14)

| User Story | Title | Acceptance Criteria | Test Status |
|---|---|---|:---:|
| **US-01** | Repo & Loop Hygiene | Git repository initialized, `.gitignore`, PRD, progress tracking, backend baseline green. | **PASSED** |
| **US-02** | Adopt Instrument & Paper | `site design/src` wired against backend CORS `:5174`; legacy 3-column retired. | **PASSED** |
| **US-03** | HomePage Live Bindings | Live stat tiles, activity feed, latency sparkline from `/api/reports`, `/api/timeline`, `/api/health`. | **PASSED** |
| **US-04** | Knowledge Graph Stage | Real NetworkX graph on canvas (curved edges, category colors, ≤120 nodes, node card provenance). | **PASSED** |
| **US-05** | Question Subgraph Activation | Active concepts pulse once (1200ms ring), inactive nodes dim to 40% (`ctx.globalAlpha = 0.40`). | **PASSED** |
| **US-06** | SSE Job Stream & Trace | `/api/jobs/{id}/events` StreamingResponse drives `ThinkingDetailsPanel` with real events; stopped backend alerts. | **PASSED** |
| **US-07** | AskPage Real 4-Part Answers | Grounded 4 parts (summary, evidence, limitations, safety); verbatim RefusalCard in madder red. | **PASSED** |
| **US-08** | UploadPage Real Pipeline | Stepper advances strictly on real SSE events; Page Quality table and File Manifest bound to real report rows. | **PASSED** |
| **US-09** | TimelinePage Live Spine & Deltas | Chronological spine from `/api/timeline`; deltas from `/api/reports/{uid}/trends`; dynamic report block insertion. | **PASSED** |
| **US-10** | Library & Compare Live | Reports list with chunk counts & SHA-256 copy; Compare diff table computed from real extracted lab entities. | **PASSED** |
| **US-11** | Insights Live Analytics | Modularity card (Louvain Q=0.64), Betweenness Centrality rankings, edge predicate frequencies, causality footnote. | **PASSED** |
| **US-12** | Failure-Injection & Honest States | Global top banner on backend drop; Chroma failure isolates gracefully; `allow_api=false` and `REPLAY MODE` badges. | **PASSED** |
| **US-13** | Evidence Span Viewer | Clicking evidence opens extracted page text from `/api/reports/{id}/pages` with `char_start–char_end` bounding box. | **PASSED** |
| **US-14** | QA, Docs, Viva Script, Release Tag | 16 DESIGN gates passed; 43/43 pytest green; `docs/demo-script.md` written per plan §19.1; tagged `v1.0.0`. | **PASSED** |

---

## 3. Quickstart & Verification Guide

### Prerequisites
- Python 3.10+ (Python 3.13 recommended)
- Node.js 20+ & npm

### Backend Setup & Test Suite
```powershell
# Navigate to backend directory
cd vitagraph/backend

# Activate virtual environment
.\.venv\Scripts\activate

# Run full backend test suite (43 tests)
python -m pytest tests -q

# Start FastAPI backend server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Frontend Setup & Production Build
```powershell
# Navigate to site design directory
cd "site design"

# Install dependencies (if needed)
npm install

# Run TypeScript check and production build
npm run build

# Start Vite development server
npm run dev -- --host 127.0.0.1 --port 5174
```

---

## 4. API Endpoints Reference

| Route | Method | Description |
|---|:---:|---|
| `/api/health` | `GET` | System operational telemetry, Chroma chunks count, allow_api flag. |
| `/api/users` | `GET`, `POST` | User persona management, consent registration, deletion cascade. |
| `/api/reports` | `GET`, `POST` | Report PDF upload, listing with page/chunk counts, SHA-256 validation. |
| `/api/reports/{id}/pages` | `GET` | Page-by-page extraction quality, OCR flags, and verbatim extracted text. |
| `/api/reports/{id}/status` | `GET` | Asynchronous processing status, chunk counts, error state. |
| `/api/reports/{uid}/trends` | `GET` | Longitudinal biomarker trend points across chronological panels. |
| `/api/reports/compare` | `GET` | Side-by-side delta computations between baseline and follow-up panels. |
| `/api/questions` | `POST` | User-scoped RAG question answering with 4-part structured output. |
| `/api/jobs/{id}/events` | `GET` | Real-time Server-Sent Events (SSE) stream for pipeline stage traces. |
| `/api/graph/{uid}` | `GET` | NetworkX knowledge graph nodes, edges, Louvain modularity, and centrality. |
| `/api/graph/subgraph` | `POST` | Question-conditioned active subnetwork extraction for evidence chunks. |
| `/api/timeline/{uid}` | `GET` | Historical event ledger and longitudinal audit trail. |

---

## 5. Viva Defense Reference & Demonstration Script

A step-by-step 14-stage viva presentation protocol is documented in [`docs/demo-script.md`](docs/demo-script.md), following Master Plan §19.1. It provides exact talking points, interaction steps, expected UI responses, and model answers for typical examiner inquiries.

---

## 6. License & Academic Declaration
Developed as an academic final-year project at B.Tech Level.  
Submitted under the VitaGraph Project Constitution and Master Engineering Plan.
