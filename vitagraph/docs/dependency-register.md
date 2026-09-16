# VitaGraph Dependency Register

Per the project plan (Section 3.6), every adopted dependency is recorded
with purpose, version, license, and replacement plan. Exact installed
versions are snapshotted in `docs/requirements-freeze.txt` (re-run
`pip freeze` after any change; plan Section 16 reproducibility).

## Backend (Python 3.13.7, venv at backend/.venv)

| Dependency | Frozen version (2026-08-22) | License | Purpose | Replacement plan |
|---|---|---|---|---|
| fastapi | 0.141.1 | MIT | Backend API, authorization boundary | Flask (documented fallback in plan) |
| uvicorn[standard] | (see freeze) | BSD-3 | ASGI server; native streaming for future SSE | any ASGI server |
| python-multipart | (see freeze) | Apache-2.0 | Multipart upload parsing | — |
| pydantic / pydantic-settings | (see freeze) | MIT | Schemas and configuration | dataclasses + manual env parsing |
| pymupdf | 1.28.2 | AGPL-3.0 / commercial | PDF extraction with page-level provenance | pypdf (weaker layout support) |
| sentence-transformers | 6.0.0 | Apache-2.0 | Frozen embedding model (all-MiniLM-L6-v2) | any local embedding lib; re-freeze + re-calibrate threshold |
| chromadb | 1.5.9 | Apache-2.0 | Local persistent vector store | Qdrant (plan upgrade path); isolated in app/rag/vector_store.py |
| httpx | 0.28.1 | BSD-3 | Neutral AI-service client | requests |
| python-dotenv | (see freeze) | BSD-3 | .env loading | pydantic-settings built-in |
| pytest | (see freeze) | MIT | Test suite | — |
| rapidocr-onnxruntime | 1.2.3 | Apache-2.0 | Pure Python ONNX OCR fallback (US-16) | pytesseract + Tesseract binary |

**Planned deviations from the frozen stack (recorded per plan Section 3.6):**

- **Haystack**: the plan freezes Haystack as the RAG orchestrator. It was
  not installed in Session 1; retrieval is implemented directly against
  Chroma behind `app/rag/vector_store.py` + `app/rag/retriever.py`, which
  keeps the pipeline explicit and testable. Adopting Haystack later is a
  contained change to those two files. Rationale: fewer moving parts while
  the pipeline semantics (filters, thresholds, fail-closed behavior) were
  being calibrated; revisit before the mid-project demonstration.

**Accepted interpretation decisions (code-review follow-up):**

- **Chunk-level `ai_service_status` (D02)**: the plan's metadata table
  lists it per chunk, but generation availability is a property of the
  answer transaction, not of stored evidence. It is therefore recorded on
  the answer row (`ai_service_status` + `ai_service_config` +
  `safety_check_note`), while chunks carry `text_hash` for duplicate
  detection. Recorded here as the team's chosen interpretation.
- **Service-layer HTTPException (D10)**: services raise
  `fastapi.HTTPException` directly. Accepted as a pragmatic choice for a
  demo-scale codebase; revisit if services are ever reused outside HTTP.

## Frontend (Node 24)

| Dependency | Version | License | Purpose | Replacement plan |
|---|---|---|---|---|
| react / react-dom | 19.x | MIT | UI | — |
| react-router-dom | 7.x | MIT | Routing | — |
| vite | 8.x | MIT | Dev server + build | — |
| typescript | 5.x | Apache-2.0 | Type safety | — |
| tailwindcss + @tailwindcss/vite | 4.x | MIT | Styling | plain CSS (plan fallback) |

## Planned additions (later sessions)

| Dependency | Purpose | Note |
|---|---|---|
| pytesseract + Tesseract binary | OCR fallback | code path ready incl. mean-confidence check (D14); install before scanned-PDF testing |
| networkx | Graph analytics | Phase 6 |
| react-force-graph | Knowledge-graph view | Phase 6 |
| @xyflow/react (React Flow) | Live pipeline / AI-brain view | Phase 7 |
| ragas | RAG evaluation | Phase 9; supplements manual review only |

## Calibration record

- Embedding model frozen at `sentence-transformers/all-MiniLM-L6-v2`.
- `MIN_EVIDENCE_SCORE = 0.40`, re-calibrated after the D05 chunk-grouping
  fix: real evidence matches score 0.53–0.71; best unrelated topical hit
  observed 0.377. (Initial Session-1 values: 0.49–0.71 real / 0.364
  unrelated with pre-fix grouping.)
- Chunk policy frozen: line-level section-aware chunking, target 200 chars,
  max 800 (capped to stay inside the embedding model's 256-word-piece limit,
  deep-review D17), flush at completed lab entries (Result/Reference/Flag
  lines); "Reference range:" lines are entry completers, never headings (D05).
- Consent statement version: `consent-v1` (recorded with each acceptance
  event, plan Section 15.2).
- Retrieval hit rate on the synthetic benchmark: 3/3 = 100% (gate ≥ 80%) —
  see `docs/evaluation.md`.
