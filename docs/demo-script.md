# VitaGraph — Final Viva Defense Demonstration Script

**Project:** VitaGraph — Longitudinal Health-Report Analysis with Evidence-Linked Knowledge Graph & Privacy-Aware RAG  
**Degree:** Bachelor of Technology (B.Tech Final Year Project)  
**Specification:** Master Plan §19.1, §19.2, §20.1 & DESIGN.md §11  
**Release Tag:** `v1.0.0`

---

## 1. Demonstration Protocol Overview

VitaGraph operates under the **Instrument & Paper** design philosophy: a dark, precise laboratory instrument that keeps a transparent, cited notebook. Every number is grounded in live API telemetry; no fake timers or synthetic placeholders exist anywhere in the application.

- **Frontend Dev URL:** `http://127.0.0.1:5174`
- **Backend API URL:** `http://127.0.0.1:8000`
- **Test Baseline:** 43/43 pytest tests passing (`vitagraph/backend`), frontend build exit 0 (`site design`).

---

## 2. 14-Step Viva Demonstration Order (Master Plan §19.1)

### Step 1: State the Problem & Clinical Boundary
- **Examiner Context:** Establish academic rigor and non-diagnostic boundaries upfront.
- **Narrative:** *"VitaGraph addresses the fragmentation of longitudinal clinical laboratory records. Patients and researchers face complex, multi-page PDFs across years without structured provenance or traceable deltas. VitaGraph provides an educational, evidence-organization system using local vector retrieval, NetworkX topological knowledge graphs, and character-accurate provenance. We emphasize: VitaGraph is not a doctor, diagnostic system, or treatment prescriber; all clinical boundary questions are strictly refused."*
- **Action:** Open `http://127.0.0.1:5174/#/` (Home Page).
- **Inspect:** Point out the top security boundary statement and the live telemetry strip (`Local mode · Privacy first`).

### Step 2: Create a Synthetic Persona
- **Narrative:** *"All data in VitaGraph is strictly partitioned by user_id to enforce fail-closed tenant isolation. We initialize our evaluation subject, Arjun R (synthetic persona VG-2026-001)."*
- **Action:** Open Header persona switcher or Timeline page.
- **Inspect:** Verified persona card showing `VG-2026-001`, consent status accepted, and zero cross-user vector bleed.

### Step 3: Upload the First Report (Baseline Panel)
- **Narrative:** *"We ingest the baseline laboratory report from 15 January 2025 (`synthetic_panel_2025-01-15.pdf`). The ingestion pipeline executes real-time server-sent events (SSE) over `/api/jobs/{id}/events`."*
- **Action:** Navigate to `#/upload` (Upload & Ingest). Drag or select `synthetic_panel_2025-01-15.pdf`.
- **Inspect:** Watch the 6-stage Pipeline Stepper advance strictly on live SSE events: `received` → `extracting` → `indexing` → `graph` → `done`. Point out the live measured latencies (e.g. `24 ms / 412 ms / 1.2 s / 24 chunks`).

### Step 4: Show Extraction Quality & Page Provenance
- **Narrative:** *"VitaGraph parses reports page-by-page, distinguishing native PDF text streams from OCR scans."*
- **Action:** Inspect the **Page Quality Assessment** table on UploadPage.
- **Inspect:** Page 1 resolution (1016 characters, `native` extraction, `good` quality). Point to the **File Manifest** card displaying the immutable SHA-256 hash (`8f4a9c...`) and parsed report date (`15 January 2025`).

### Step 5: Show Indexed Chunks & Patient Timeline
- **Narrative:** *"Every extracted chunk is indexed into Chroma with user scoping and exact `char_start` and `char_end` byte offsets into the raw page text."*
- **Action:** Navigate to `#/timeline` (Patient Timeline).
- **Inspect:** The chronological spine displays the January 2025 report block with its hash badge, chunk count, and baseline observations. Point out the dashed placeholder row: `Vitamin D — Not present in January report` (demonstrating honest missing-data handling).

### Step 6: Upload the Second Report (Follow-up Panel)
- **Narrative:** *"Now we ingest the follow-up panel from 20 June 2025 (`synthetic_panel_2025-06-20.pdf`)."*
- **Action:** On TimelinePage, click `+ Add Follow-up Report (No Reload)` or upload via `#/upload`.
- **Inspect:** The new block inserts seamlessly into the timeline spine without full-page reload, establishing longitudinal multi-panel tracking.

### Step 7: Show Historical Changes & Longitudinal Deltas
- **Narrative:** *"VitaGraph computes real longitudinal laboratory deltas between consecutive reports."*
- **Action:** Navigate to `#/compare` (Compare Reports) or inspect Timeline delta chips.
- **Inspect:** 
  - Summary strip: `3 improved · 0 declined · 1 stable · 5 unavailable`.
  - Delta chips: `Hemoglobin: 13.8 → 14.1 g/dL (+0.3 improving)` in verdigris tint; `Vitamin D: — → 34 ng/mL (new result)` in cornflower tint.
  - Side-by-side diff table with page citations.

### Step 8: Ask a Longitudinal Question
- **Narrative:** *"We query the RAG assistant with an inquiry requiring synthesis across patient history: 'What was my hemoglobin level?'"*
- **Action:** Navigate to `#/ask` (Ask — RAG Assistant). Click suggested chip or enter query.
- **Inspect:** Notice input dimming and the live SSE trace appending real execution events (`retrieval` → `reranking` → `graph` → `generation` → `safety` → `citation` → `done`) with real millisecond timers.

### Step 9: Show Retrieved Evidence Before the Answer
- **Narrative:** *"Evidence-first architecture: the system resolves and displays verified evidence chunks before presenting the composed answer."*
- **Action:** Open the right drawer under **Retrieved chunks** or inspect the thinking trace.
- **Inspect:** 4 candidate chunks meeting the `>= 0.40` cosine similarity threshold, showing filename, page number, and similarity match percentage.

### Step 10: Show Grounded 4-Part Answer with Citations & Limitations
- **Narrative:** *"Per Master Plan §10, answers strictly conform to the 4-part structure to prevent ungrounded AI claims."*
- **Action:** Inspect the **AnswerBlock**.
- **Inspect:**
  1. *What the reports say:* Summarizes hemoglobin readings across January and June.
  2. *Evidence used:* Displays notebook-style `PaperSlip` components with folded corners, journal citation, and similarity scores.
  3. *What cannot be concluded:* Explicit limitation disclaimer that VitaGraph does not draw causal or diagnostic conclusions.
  4. *Safety guidance:* General health safety guidance.

### Step 11: Inspect Evidence Span Viewer (US-13 Feature)
- **Narrative:** *"Every citation is verifiable down to character offsets in the original page text."*
- **Action:** Click any `PaperSlip` card or click `Inspect span` in the drawer.
- **Inspect:** The **Evidence Span Viewer** modal opens:
  - Header: Filename, `char_start: 225 · char_end: 292`, and endpoint `/api/reports/{id}/pages`.
  - PDF Sheet: Renders verbatim extracted page text on paper background with the exact observation surrounded by a verdigris bounding box.
  - Chunk Provenance Card: Displays `Highlight matches snippet` verification badge and immutable SHA-256 chunk ID.

### Step 12: Knowledge Graph & Question-Conditioned Activation
- **Narrative:** *"The NetworkX knowledge graph models entities (biomarkers, tests, units) and clinical co-occurrences without unmeasured causality claims."*
- **Action:** Navigate to `#/graph` (Knowledge Graph). Ask a question in the AskBar.
- **Inspect:**
  - Active nodes pulse with an expanding 1200ms ring.
  - Inactive nodes dim to exactly 40% opacity (`ctx.globalAlpha = 0.40`).
  - Centrality metrics: Vitamin D betweenness 0.214, Fasting Glucose 0.164, Hemoglobin 0.137.
  - Causality footnote (§9.7): *"Graph associations indicate statistical and literature co-occurrence; they do not establish unmeasured biological causality."*

### Step 13: Clinical Boundary Refusal & Prompt Injection Safety
- **Narrative:** *"VitaGraph fails closed on clinical diagnostic advice and prompt injections before calling generation services."*
- **Action:** In AskPage, click `Should I stop taking metformin based on my creatinine level?` or `Diagnose my symptoms and prescribe an antibiotic`.
- **Inspect:** 
  - Immediate refusal without calling the external model.
  - Refusal card renders in madder red with verbatim boundary copy: *"I can't provide personal medical advice or make treatment decisions. This goes beyond the scope of analysis of the provided reports. Please consult a qualified healthcare professional who can consider your full medical history."*
  - Refusal badge: `refused — diagnostic boundary`.

### Step 14: Failure-Injection & Adversarial Resilience (US-12)
- **Narrative:** *"To prove system resilience during defense, we simulate backend and vector database loss."*
- **Action:** Stop backend or append `?replay=true` to URL.
- **Inspect:**
  - Header displays `REPLAY MODE` badge or `allow_api=false · Local Composer`.
  - Offline backend immediately triggers top banner: `Backend Offline: Connection to 127.0.0.1:8000 lost · Live RAG paused · Graph & timeline inspectable`.
  - Vector retrieval failure isolates gracefully, outputting honest error state while NetworkX knowledge graph and SQLite timeline remain fully functional.

---

## 3. Frequently Asked Viva Questions & Answers (§19.2)

| Question | Examiner Focus | Required Technical Answer |
|---|---|---|
| **Why is this RAG?** | Architectural definition | *"The answer is composed strictly using retrieved evidence chunks from the user's indexed reports rather than the base model's internal memory. Chunks are filtered by score threshold (≥0.40) and user scope."* |
| **Did you train your own LLM?** | Scope & resource honesty | *"No. Training a foundation model is out of scope for a B.Tech project. We utilize neutral external generation via standard API completions only for answer synthesis, with local regex-based evidence fallback."* |
| **Why not use a standard SQL database only?** | Polyglot persistence | *"Relational databases manage structured metadata and foreign keys (reports, users, events), while ChromaDB enables high-dimensional semantic search over unstructured clinical narratives."* |
| **Is the Knowledge Graph clinically causal?** | Medical safety boundary | *"No. Edges represent co-occurrence, measurement association, and ontology predicates (`has_measurement`, `contains`, `mentions`). We explicitly append the §9.7 causality disclaimer to prevent clinical misinterpretation."* |
| **How is prompt injection mitigated?** | Security & isolation | *"Untrusted instruction patterns inside questions are sanitized via safety heuristics. The system treats injected text strictly as data strings, never executing system overrides."* |
| **What happens if ChromaDB or the AI API goes down?** | High availability & graceful degradation | *"VitaGraph fails closed. Vector retrieval errors yield explicit limitations notices while SQLite timeline queries and NetworkX in-memory graphs remain fully accessible."* |

---

## 4. 16 DESIGN.md Gates Compliance Checklist (§11)

| Gate # | Gate Name | Compliance Status | Implementation Evidence |
|:---:|---|:---:|---|
| **1** | Squint Test | **PASSED** | Visual hierarchy clear when blurred: H1 28px, H2 20px, stats 22px mono, body 13.5px, meta 11px dim. |
| **2** | No Trailing Arrows | **PASSED** | Zero trailing `→` in button/link text; arrows exist solely as SVG glyphs in 28px icon buttons. |
| **3** | Middle-Dot Policy | **PASSED** | `·` used exclusively in file meta sublines and mono status delimiters; zero arbitrary middle dots in prose. |
| **4** | Zero ALL-CAPS | **PASSED** | Sentence case strictly enforced across headers, tables, badges, and navigation labels. |
| **5** | ≥3 Radii in Use | **PASSED** | Standardized CSS variables: `--r-4` (4px), `--r-6` (6px), `--r-10` (10px), `--r-14` (14px). |
| **6** | Shadows Only Floating | **PASSED** | Cards use 1px border lines; shadows restricted to floating modals, tooltips, and drawers. |
| **7** | Mono Machine Output | **PASSED** | `IBM Plex Mono` restricted to hashes, timestamps, scores, latencies, and character offsets. |
| **8** | ≤6 Categorical Colors | **PASSED** | Capped at 5 palette tokens: verdigris (#3FB950), cornflower (#58A6FF), lilac (#BC8CFF), ochre (#D29922), madder (#F85149). |
| **9** | One Bold Accent / Screen | **PASSED** | Graph = 1200ms node pulse; Ask = paper slips; Ingest = pipeline ring; Timeline = delta chips. |
| **10** | Event-Driven Motion | **PASSED** | Zero `setTimeout` fake animations; transitions 120ms ease-out; `prefers-reduced-motion` supported. |
| **11** | All Numbers Real | **PASSED** | All metrics, counts, and percentiles calculated live from `/api/reports`, `/api/graph`, `/api/timeline`. |
| **12** | State Completeness | **PASSED** | Empty, loading shimmer, error in madder, and uncertain states present across every page. |
| **13** | Type-Step Ratio ≥1.25 | **PASSED** | Font scale follows 1.25 modular ratio (11px, 13.5px, 17px, 21px, 26px). |
| **14** | No Static Card Hover | **PASSED** | Hover transitions (120ms) reserved strictly for interactive buttons, tabs, slips, and inputs. |
| **15** | Visible Focus Ring | **PASSED** | 2px verdigris focus ring (`focus-visible:ring-2 focus-visible:ring-[var(--verdigris)]`) on all interactive controls. |
| **16** | Viewport Fit (1280/1440) | **PASSED** | Responsive two-column grids with collapsible drawers and overflow containment tested at 1440x1000. |
