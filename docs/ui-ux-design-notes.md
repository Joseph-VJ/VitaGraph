# VitaGraph UI/UX Design Notes & Architecture

## 1. Design Evolution & Modernist Paradigm

VitaGraph began with an exploratory dual-voice concept ("Instrument & Paper" with Spectral and IBM Plex), which evolved through user testing into the definitive **Modernist** design system.

The definitive visual reference is `VitaGraph-App-v3.html` (readable source in `design/reference/app-v3-source.html` and 1440x900 screenshots in `design/reference/screens/*.png`). As established in `gemini/DESIGN_LAW.md`, the reference design outranks older design notes and planning documents.

### Modernist Visual Principles
- **Universal Typography:** A single typeface family — **Archivo** (400 regular, 600 semi-bold, 800 extra-bold). All serif, mono, and display fonts have been unified into Archivo to eliminate cognitive switching.
- **Zero Radius:** Pure flat geometry with `border-radius: 0px` across buttons, inputs, tags, dialogs, cards, and panels (`--radius-none: 0px`).
- **High-Contrast Neutral Surfaces:** Clean white background (`--color-bg: #ffffff`), neutral light surfaces (`--color-surface: #f7f7f7`, `--color-neutral-100: #f2f2f2`, `--color-neutral-200: #e6e6e6`), crisp dark text (`--color-text: #111111`, `--color-neutral-700: #666666`), structured by 1px and 2px dividing rules (`--color-divider: #e0e0e0`).
- **Single Vivid Accent:** Exactly one vivid red accent (`--color-accent: #e03e1a`) reserved exclusively for active states, key data indicators, and alerts.
- **Tokens:** Canonical tokens are defined in `site design/src/theme/tokens.css` and `modernist.css`.

---

## 2. Application Screens (11 Screens)

The application provides 11 cohesive screens organized in the sidebar into Workspace, Analyze, Tools, and System:

1. **Upload & Ingest (`/upload`)**
   - Drag-and-drop document intake for clinical PDFs and lab panels.
   - Live ingestion show featuring 5 seconds per pipeline stage at normal speed (`fast: 0.5x`, `normal: 1x`, `real-time: 1.8x`, `reduce-motion: 0.4x`).
   - Page quality manifest detailing OCR confidence and character counts.
   - Interactive document stage.

2. **Library (`/library`)**
   - Registry of all indexed patient reports with SHA-256 integrity hashes, page counts, chunk counts, and status tags.
   - Biomarker summary table for the selected report with reference range bars, previous panel comparisons, and character-accurate evidence passage inspection.

3. **AI Agent (`/agent`)**
   - Provenance-grounded natural language question answering.
   - Streaming response protocol via `POST /api/agent/stream` displaying live thinking traces, tool execution events, and grounded text deltas.
   - Fail-closed safety boundary refusing clinical advice or diagnostic claims.

4. **Knowledge Graph (`/graph`)**
   - High-performance 3D canvas viewport using isometric projection.
   - Ontology nodes: Subject, Report, Section, Biomarker, Measurement, Uncertainty.
   - Label readability engine: priority sorting (selected > person > report > biomarker > section > measurement > uncertainty), collision avoidance pruning, and 24-character truncation.
   - Community-based subgraph filtering, rotation pause/replay, and detailed node inspector card.

5. **Timeline (`/timeline`)**
   - Chronological report history ledger on the left with neutral-toned "Indexed" tags.
   - 3D isometric biomarker trend projection charts on the right displaying historical value progression across dates and reference bounds.

6. **Compare (`/compare`)**
   - Side-by-side longitudinal report comparisons.
   - Fast pair selector buttons and detailed delta comparison table showing absolute numeric change and directional status tags (Higher, Lower, Unchanged, One report).

7. **Insights (`/insights`)**
   - Graph structural metrics: total node and edge counts, entity breakdown.
   - Betweenness Centrality rankings highlighting top conceptual hubs with clean date/name labels and proportional bars (top hub in red accent).
   - Multi-relational edge type frequency analysis.

8. **Image to Text (`/tools/ocr`)**
   - Standalone OCR utility for extracting structured clinical text from scanned image reports.

9. **PDF to Text (`/tools/pdf`)**
   - Standalone digital text extractor inspecting per-page text layers and document structure.

10. **Text to Graph (`/tools/graph`)**
    - Clinical NLP sandbox parsing unstructured clinical notes into interactive entity-relationship graphs.

11. **Settings (`/settings`)**
    - Ingestion pipeline process speed configuration.
    - Chunk size slider (120 to 600 tokens) with live chunk estimation for a 5-page report.
    - Persona selection and management with deletion cascades.
    - Privacy guarantees and local telemetry status.

---

## 3. AI Agent Streaming Protocol & Tools

The AI Agent communicates with the backend via Server-Sent Events (`POST /api/agent/stream`):
- **Event Sequence:** `status` → `step` → `thinking` → `tool_call` → `tool_result` → `text_delta` → `stats` → `completed` (or `error`).
- **Harness Tools:**
  1. `get_biomarkers`: Extract lab measurements and reference ranges from a specific report.
  2. `get_trends`: Retrieve longitudinal biomarker progression for a test name across chronological reports.
  3. `query_chroma`: Dense vector search across sentence-aware document chunks using cosine similarity.
  4. `query_graph`: Graph query for related concepts, pathways, and node neighbors.
- **Safety Policy:**
  - Zero hallucination policy: every stated fact must cite character-level spans in the evidence passages.
  - Fail-closed refusal: inquiries regarding diagnosis, medication dosage, or medical treatment trigger an immediate refusal card.
  - Rule: Never display LLM provider or model names in the user interface.

---

## 4. Verification and Quality Budgets

- **Backend Pytest:** 213 unit and integration tests passing (`python -m pytest tests -q`).
- **Frontend Build:** Strict TypeScript check and Vite production build (`npm run build`) passing with zero errors.
- **Accessibility:** Full keyboard navigability, WCAG AA contrast compliance across all text tokens, and visible focus rings.
- **Secret Scan:** `python scripts/plan/secret_scan.py` passes cleanly with zero exposed credentials.
