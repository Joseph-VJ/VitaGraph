# Session P6b Summary: Text to Graph on GraphStage with Live Streaming

## 1. Overview
Session P6b ported the dark ink 3D canvas stage (`GraphStage`) to `TextToGraphPage.tsx`, wired it to the real-time SSE streaming backend (`POST /api/tools/graph/stream`), enabled incremental node/edge appends (`appendData`), built the dedicated docked node card (`TextNodeCard.tsx`), created the pure data adapter (`textStageData.ts`), and verified all behavior with automated Playwright tests, static design audits, and backend pytest suites.

---

## 2. Part 0 Fixes (F1–F4)
- **F1 Esc with Save-as-image modal open**: In `GraphStage.tsx`, keydown handler checks for `document.querySelector(".graph-modal")`. If present, Esc is ignored by `GraphStage` so the page modal handler owns it.
  - *Result*: First Esc closes the modal; the selected node **stays selected**. Second Esc deselects. Verified in Playwright.
- **F2 Space / arrow keys focus guard**: In `GraphStage.tsx`, added early exit if `activeElement` is a focusable control (`button`, `a`, `select`, `input`, `textarea`, `summary`, `[role=button]`, `[role=slider]`, or `contenteditable`), unless it is the stage wrapper or canvas.
  - *Result*: Tab to Lens + Space toggles the Lens without pan; focusing wrapper/canvas pans with arrows and Space-drag.
- **F3 Move pad overlay positioning**:
  - In `graphStage.css`, offset `.bar` and `.intro` with `left: 180px` to clear the 148px move pad (+ 32px margin).
  - During opening sequence, `.move-pad.intro-dim` fades pad to 35% opacity and disables pointer events.
  - *Result*: 0 pixel overlap across 1440x900, 1000x700, and 820x1100 viewports.
- **F4 Settings text**: Updated `SettingsPage.tsx` line 406 to:
  `"Shortens animations and stops graph rotation."`

---

## 3. P6b.1 Stage Engine Additions
- **Incremental append (`appendData`)**: Added `appendData(nodes, edges)` to `GraphStageEngine.ts` and exposed via `GraphStageHandle`.
  - Appends nodes/edges without resetting camera, pan, or running the full opening intro.
  - New nodes start at their linked parent's position (or origin) and ease smoothly to their layout target.
  - Appended edges ignite red spark growth animations.
  - Selection, hover state, and docked card survive appends.
- **Edge labels on selection**: Added step 7c to render loop. When a node is selected, edge relation labels (`label?: string`) for connected links (and second-ring links at 55% opacity) are rendered at curve midpoints with background halo and collision pruning.
- **`hideTimeline` flag**: Added to `StageOptions` and `GraphStageProps`. When `true`, Timeline button is omitted from the layout switcher, and timeline keyboard shortcuts are ignored.
- **Real intro counters**: Real node and link counts are shown during intro overlay (even with 0 reports), and suppressed while `isGrowing === true`.

---

## 4. P6b.2 Data Adapter (`textStageData.ts`)
Created pure adapter functions with degree centrality calculation:
- `entityTypeToNodeKind(type)`: Maps AI types to stage kinds (`person`, `section`, `bio`, `meas`, `unc`).
- `entityToStageNode`, `edgeToStageEdge`: Extracts quote spans, character offsets, relation labels.
- `createHubNode`: Preserves connected component structure.
- **Adapter Test Results (Node/TSX)**:
  1. *AI Lab Report*: 5 nodes, 4 edges (Hub + 4 test values/dates).
  2. *AI Clinical Encounter*: 6 nodes, 5 edges (Hub + Doctor, Patient, Hospital, Symptoms).
  3. *Pattern Graph Extractor*: 8 nodes, 7 edges (Date: 12 March 2026).

---

## 5. P6b.3 The Page & Selected Node Card
- **`TextNodeCard.tsx`**:
  - Docked 340px card with 3px red top border, kind in small caps, red Close button, 1.25rem 800 title.
  - Sentence from text with exact quote highlighted using `<mark>` and character offsets ("characters X to Y").
  - Connection chips with relation arrows ("visited → Dr. Meera", "prescribed → Metformin").
  - Connection count sentence ("Connected to N nodes. Its lines are red...").
  - No AI summary box.
- **`TextToGraphPage.tsx`**:
  - Replaced `GraphCanvas` with `GraphStage` (defaults to ink stage, Paper stage switch, Lens, Replay, 3 layouts, Pan, Save as image).
  - Streamed AI build via `toolsApi.graphStream(text, handlers, signal)` on `POST /api/tools/graph/stream`.
  - RAF batching flushes up to once per animation frame.
  - Live status line shows real elapsed seconds and node/edge counts; completed banner shows duration and dropped items.
  - "Stop" button aborts stream and preserves drawn nodes.
  - Privacy switch check (`vg_allow_api` in sessionStorage / aiApi) falls back to pattern build with message without calling API.
  - Retained `GraphCanvas.tsx` and `layout3d.ts` because `graphData.ts` and `textGraph.ts` import them for `KnowledgeGraphPage`. Deleted unreferenced `aiGraph.ts`.

---

## 6. Verification Results

### Static Checks & Backend Tests
- **Frontend Build**: `npm run build` -> Exit 0 (866ms).
- **Design Audit**: `npm run audit:design` -> 0 errors (71 files checked).
- **Secret Scan**: `python scripts/plan/secret_scan.py` -> `RESULT: PASS`.
- **Backend Tests**: `pytest tests -q` -> `420 passed in 350.71s` (100% green).

### Playwright Automated Verification (`verify_p6b.py`)
- **Pattern Build**:
  - Empty state visible before build: `True`
  - Stage canvas visible after build: `True`
  - Layout buttons: Sphere: 1, Orbits: 1, Columns: 1, Timeline: 0
  - Morphed Orbits -> Columns -> Sphere cleanly.
  - Docked `TextNodeCard`: width 340px, height 377px, right 356px.
  - Quote mark in card: count 1, text `'Dr. Meera'`.
  - Connections sentence: `'Connected to 4 nodes. Its lines are red; the fainter ones go one step further.'`
  - Pan right (x=40), pan centre (x=0).
  - Save as image modal closed on Esc; node stayed selected: `True`.
- **Real AI Stream Build (Timeline & Counts)**:
  - Button switches to `'Building with AI...'` with red `'Stop'` button.
  - `first_node`: **6.33s** (nodes=2)
  - `5th_node`: **6.91s** (nodes=5)
  - `last_event`: **8.70s** (nodes=11, total_edges=9)
  - Nodes arrived spread over ~2.4 seconds as the model streamed.
  - Status banner: `"Done in 14.2 s: 10 nodes, 9 links"`.
- **Privacy Gate**:
  - With `sessionStorage.vg_allow_api = 'false'`: 0 stream requests fired to `/api/tools/graph/stream`.
  - Message displayed: `"The AI model is turned off in Settings. Showing the pattern graph instead."`
- **Regression `/graph`**:
  - Timeline button: 1, Time machine: 1 (all features intact).
- **Responsive & Leak Checks**:
  - Viewport 1000x700: horizontal scroll = `False`
  - Viewport 820x1100: horizontal scroll = `False`
  - Viewport 400x860: horizontal scroll = `False`
  - 5 round trips between `/text-to-graph` and `/library`: 0 leaked canvases.

---

## 7. Screenshot Visual Analysis
Four screenshots saved in `gemini/shots/`:
1. `P6b-pattern.png`: Dark ink stage with pattern build, node selected with `TextNodeCard`, Sphere layout active, no Timeline button, pan pad positioned with 0 overlap.
2. `P6b-paper.png`: Paper stage theme with crisp grid, light background, ink stage toggle button, Dr. Meera selected card with exact `<mark>` quote.
3. `P6b-ai-growing.png`: Captured mid-stream at 11.7s showing live status banner `"Writing the graph... 2 nodes, 0 links (11.7 s)"`, disabled "Building with AI..." button, red "Stop" button, hub node with title `"Arjun Visit to Apollo Hospital"`.
4. `P6b-ai-done-card.png`: Completed AI graph with 11 nodes, 9 links, Arjun node selected with relation labels along edges ("visited", "visited at", "visited on", "complained of"), `TextNodeCard` showing 5 connection chips.

### Visual Differences from Knowledge Graph Stage
1. **Layout Switcher**: Text to Graph has 3 layouts (Sphere, Orbits, Columns); Knowledge Graph has 4 (Sphere, Orbits, Timeline, Columns).
2. **Time Machine Button**: Knowledge Graph has the "Time machine" button (`data-testid="graph-time"`); Text to Graph omits time machine entirely.
3. **Selected Node Card**:
   - `TextNodeCard` shows exact verbatim text snippet with `<mark>` highlight and character offsets ("characters 0 to 5"), relation chips with direction arrows, and has **no AI summary box**.
   - `NodeDossier` on Knowledge Graph displays clinical metrics, reference ranges, sparklines, history series across reports, and an AI summary box.
4. **Edge Labels**: In Text to Graph, selecting a node draws edge relation text ("visited", "prescribed", "complained of") at the link midpoints; Knowledge Graph links do not have textual labels.
5. **Right Sidebar**: Text to Graph has the text input area, example buttons, Build buttons, and kind filters; Knowledge Graph has the subgraphs list, lens mode, time machine controls, and agent queries.
