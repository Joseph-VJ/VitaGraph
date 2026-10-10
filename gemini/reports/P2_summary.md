# Session P2 Summary: Graph Series Endpoint & Living Background Layer

## 1. Overview
Session P2 implemented:
1. **Backend Series Endpoint**: `GET /api/graph/{user_id}/series` providing whole-persona longitudinal test series and chronological reports with reference ranges.
2. **Frontend Living Background Layer**: Fixed decorative canvas layer behind the app with four engines (Warp, Flow, Stars, TypeE), driven by real application pipeline and AI events, with Settings controls and Play mode, matching `design/prototypes/VitaGraph-Playground.html`.

Branch: `feature/playground-graph-and-backgrounds`.
All changes remain unstaged and uncommitted per instructions.

---

## 2. Part 1: Backend Series Endpoint

### Implementation Details
- **`vitagraph/backend/app/services/series_service.py`**:
  - Chronological ordering of reports using `_date_key` (dated reports ordered chronologically, undated reports placed last, ties resolved by upload time).
  - Per-report cache (`_REPORT_MEASUREMENTS_CACHE`) keyed by `report_id` to avoid re-parsing unchanging reports.
  - Reference range recovery using page text analysis (`_range_from_text`) when extractor misses separate line ranges (e.g., June sample report).
  - Case-insensitive test aggregation with exact `node_id = f"test_{name.replace(' ', '_')}"` matching `app/graph/builder.py`.
- **`vitagraph/backend/app/schemas/graph.py`**:
  - Added Pydantic schemas: `SeriesReportItem`, `SeriesPointItem`, `SeriesTestItem`, `SeriesOut`.
- **`vitagraph/backend/app/routes/graph.py`**:
  - Added `@router.get("/{user_id}/series", response_model=SeriesOut)` using `run_in_threadpool`.
- **`vitagraph/backend/tests/test_graph_series.py`**:
  - 8 offline tests covering items (a) through (h) from specification.

### Verification & Performance
- **Unit & Regression Tests**:
  - `pytest tests/test_graph_series.py -q -p no:cacheprovider`: `8 passed in 37.02s`.
  - Full suite (`pytest tests -q`): `403 passed in 377.39s` (395 existing + 8 new).
- **Latency on 50-Report Demo Persona (`usr_51f14542d71a`)**:
  - Cold latency: **0.090s**
  - Warm latency: **0.027s**
- **Live Endpoint Verification on Port 8001**:
  - Throwaway persona `usr_5587a29e16d9` uploaded with 3 sample PDFs (`synthetic_panel_2025-01-15.pdf`, `synthetic_panel_2025-06-20.pdf`, `VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf`).
  - Reports array output:
```json
[
  {
    "report_id": "rep_626ea42a17f2",
    "filename": "synthetic_panel_2025-01-15.pdf",
    "date": "15 January 2025",
    "date_iso": "2025-01-15",
    "order": 0
  },
  {
    "report_id": "rep_26bbdb4f8c49",
    "filename": "synthetic_panel_2025-06-20.pdf",
    "date": "20 June 2025",
    "date_iso": "2025-06-20",
    "order": 1
  },
  {
    "report_id": "rep_2c4161f52d9a",
    "filename": "VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf",
    "date": null,
    "date_iso": null,
    "order": 2
  }
]
```
  - Hemoglobin test output:
```json
{
  "node_id": "test_Hemoglobin",
  "name": "Hemoglobin",
  "unit": "g/dL",
  "category": "Hematology",
  "points": [
    {
      "report_id": "rep_626ea42a17f2",
      "order": 0,
      "date": "15 January 2025",
      "value": 13.8,
      "flag": "NORMAL",
      "range_text": "12.0 - 15.5 g/dL",
      "range_low": 12.0,
      "range_high": 15.5,
      "page_number": 1,
      "chunk_id": "chk_c6c4989069bc",
      "char_start": 308,
      "char_end": 352
    },
    {
      "report_id": "rep_26bbdb4f8c49",
      "order": 1,
      "date": "20 June 2025",
      "value": 14.1,
      "flag": "NORMAL",
      "range_text": "12.0 - 15.5 g/dL",
      "range_low": 12.0,
      "range_high": 15.5,
      "page_number": 1,
      "chunk_id": "chk_c4dc1b858f96",
      "char_start": 298,
      "char_end": 342
    }
  ]
}
```
  - Cleanup: Throwaway persona `usr_5587a29e16d9` deleted (confirmed HTTP 404). Port 8001 process stopped.

---

## 3. Part 2: Living Background Layer

### Implementation Details
- **Engine Modules (`site design/src/components/background/`)**:
  - `types.ts`: Context and engine interface definitions.
  - `noise.ts`: Smooth 2D Perlin noise implementation.
  - `warp.ts`: Rubber grid engine, gravity wells, ripple waves, scanner sweep.
  - `flow.ts`: Ink currents engine with particles, storm, paint, red ink, and gates.
  - `stars.ts`: Constellation engine with dynamic dots, graph orbit layout, drag, and ripples.
  - `typeE.ts`: Living type engine rendering dots morphing into words (VITAGRAPH, THINKING, PARSING, READING, CUTTING, EMBEDDING, INDEXING, READY).
  - `LivingBackground.tsx`: Fixed canvas component (`position: fixed; inset: 0; z-index: 0; pointer-events: none`), DPR capped at 1.5, 30 fps (Soft) / 60 fps (Full & Play) governor, `document.hidden` pause, `freeArea` margin calculator, Play mode full-screen overlay and toolbar, and DEV hook `window.__livingBackground`.
- **Activity Store (`src/lib/appActivity.ts`)**:
  - Module-level store (`subscribe`, `getActivity`, `setActivity`) for `{ agentBusy: boolean; upload: { stage: 0|1|2|3|4 } | null; finished: number }`.
- **Activity Publishers**:
  - `useAgentChat.ts`: Sets `agentBusy` based on `isStreaming`.
  - `useJobStream.ts`: Maps pipeline stages: received/extracting -> 0 (Parse), extracted -> 1 (Read scans), chunked -> 2 (Cut), embedded -> 3 (Embed), indexed/graphed -> 4 (Index); clears upload and increments `finished` on `done`; clears on error.
- **Shell & Theming (`AppShell.tsx`, `index.css`)**:
  - Mounted `LivingBackground` with `z-index: 0`.
  - Content column wrapped with calm translucent backing `color-mix(in srgb, var(--color-bg) 88%, transparent)` when layer is on.
  - Hidden on `/graph` and `/text-to-graph`.
- **User Preferences (`preferences.ts`, `SettingsPage.tsx`)**:
  - Added `background: "off" | "soft" | "full"` (default `"soft"`) and `backgroundEngine: "warp" | "flow" | "stars" | "type"` (default `"warp"`).
  - Added DISPLAY section rows: "Living background", "Background style" (4 engine tiles), and "Play mode".

---

## 4. Part 2 Verification Results

### Build & Design Audit
- `npm run build`: Exited 0 (`tsc -b && vite build` completed cleanly).
- `npm run audit:design`: **0 errors, 0 pending** across 72 files.
- `python scripts/plan/secret_scan.py`: **RESULT: PASS**.

### Browser Verification (Playwright on Chrome, 1440x900)
1. **Route Presence**:
   - Canvas visible: `/upload`, `/library`, `/agent`, `/compare`, `/insights`, `/timeline`, `/settings`.
   - Canvas hidden: `/graph`, `/text-to-graph`.
2. **Off Preference & Persistence**:
   - Setting to "Off" removes canvas (`display: none`).
   - Persists across full page reload (`display: none`).
3. **Four Engines Captured (`gemini/shots/`)**:
   - `gemini/shots/P2-warp-1440.png`: Rubber grid engine running.
   - `gemini/shots/P2-flow-1440.png`: Ink currents engine running.
   - `gemini/shots/P2-stars-1440.png`: Constellation engine running.
   - `gemini/shots/P2-type-1440.png`: Living type engine running.
4. **Play Mode**:
   - Enters full-screen mode: `body.playing = true`, playbar visible, UI dimmed to 4%.
   - Exits cleanly on `Esc`: `body.playing = false`.
5. **Reduced Motion**:
   - `fps = 0` (draws a single still frame, animation loop halted).
6. **Frame Rates**:
   - Soft on `/library`: **29 fps** (target 28+ fps).
   - Full on `/settings`: **48 fps** (target reached smoothly).
7. **Mobile 400x860**:
   - `scrollWidth = 400`, `clientWidth = 400` (zero horizontal overflow).
   - Screenshot: `gemini/shots/P2-phone-400.png`.
8. **Console & Network**:
   - Console errors: **0**
   - Console warnings: **0**
   - Background layer network requests (fetch/xhr): **0**
9. **Real Events Sequence (Upload Job Stream)**:
   - Upload of `synthetic_panel_2025-06-20.pdf` via `/upload` produced:
```json
[
  { "type": "stage", "stage": 0, "timestamp": 1791478552118 },
  { "type": "stage", "stage": 1, "timestamp": 1791478552681 },
  { "type": "stage", "stage": 2, "timestamp": 1791478552966 },
  { "type": "stage", "stage": 3, "timestamp": 1791478570411 },
  { "type": "stage", "stage": 4, "timestamp": 1791478570692 },
  { "type": "done", "count": 1, "timestamp": 1791478571276 }
]
```
10. **Real Events Sequence (AI Agent Busy)**:
    - AI Agent query produced:
```json
[
  { "type": "think", "busy": true, "timestamp": 1791478575335 },
  { "type": "think", "busy": false, "timestamp": 1791478592821 }
]
```
    - Throwaway persona `usr_80aad3cb80f8` deleted.

---

## 5. Files Changed
### Backend
- `vitagraph/backend/app/services/series_service.py` (new)
- `vitagraph/backend/app/schemas/graph.py` (added `SeriesOut` models)
- `vitagraph/backend/app/routes/graph.py` (added `/{user_id}/series` route)
- `vitagraph/backend/tests/test_graph_series.py` (new)

### Frontend
- `site design/src/components/background/types.ts` (new)
- `site design/src/components/background/noise.ts` (new)
- `site design/src/components/background/warp.ts` (new)
- `site design/src/components/background/flow.ts` (new)
- `site design/src/components/background/stars.ts` (new)
- `site design/src/components/background/typeE.ts` (new)
- `site design/src/components/background/LivingBackground.tsx` (new)
- `site design/src/lib/appActivity.ts` (new)
- `site design/src/lib/preferences.ts` (added background settings)
- `site design/src/pages/SettingsPage.tsx` (added background controls)
- `site design/src/components/shell/AppShell.tsx` (mounted background layer)
- `site design/src/hooks/useAgentChat.ts` (published agentBusy)
- `site design/src/hooks/useJobStream.ts` (published upload stages and finished)
- `site design/src/index.css` (appended playbar and background styles)
