# Session P5 Summary: 2D Screen-Space Panning for Knowledge Graph Stage

## 1. Executive Summary
Session P5 completed **TASK P5** (`gemini/TASK_P5_pan.md`) on branch `feature/playground-graph-and-backgrounds`. 
The 3D Knowledge Graph stage now supports full 2D screen-space panning across mouse, keyboard, touch, and an on-screen Move pad control, without altering existing 3D rotation semantics, visual styling, or layout algorithms.

Per session rules:
- **Zero commits**: Working directory left unstaged and uncommitted (`git commit`, `git add`, `git push`, and `git stash` were not executed).
- **Strict file ownership**: Only the 3 assigned files were edited:
  1. `site design/src/components/graph/stage/GraphStageEngine.ts`
  2. `site design/src/components/graph/stage/GraphStage.tsx`
  3. `site design/src/components/graph/stage/graphStage.css`
- No sub-agents used. Backend `.env` and `tsconfig.tsbuildinfo` untouched.

---

## 2. What Was Built

### P5.1 Engine Panning Architecture (`GraphStageEngine.ts`)
- **Screen-Space Offset**: Added `panX, panY` (current rendered pixels) and `panTX, panTY` (target pixels), default `0`.
- **Easing & Motion**: In `renderFrame()`, eases current pan to target: `panX += (panTX - panX) * 0.2` and `panY += (panTY - panY) * 0.2`. When `reduceMotion` is active, pan updates instantly without easing (`panX = panTX`, `panY = panTY`).
- **Unified Projection Origin**: Added pan offset to `this.PR` projection origin:
  `ox: W / 2 + this.oxs + this.panX`, `oy: H / 2 + this.oys + this.panY`.
  Because all canvas rendering (nodes, edges, leader lines, lens, hit testing, time-machine ghosting, snapshot export) projects from `this.PR`, panning moves all elements in lockstep.
- **Bounding Clamp**: Clamps target pan to prevent losing graph center: `|panTX| <= W * 0.6`, `|panTY| <= H * 0.6`.
- **Public API**:
  - `panBy(dx: number, dy: number, instant = false)`: Shifts target pan by `(dx, dy)` with boundary clamping.
  - `resetPan()`: Resets `panTX = 0`, `panTY = 0` (and `panX = 0`, `panY = 0` when instant).
  - `getPan(): { x: number, y: number }`: Returns target pan coordinates for UI and test assertions.
  - `setSpaceDown(down: boolean)`: Toggles pan drag mode when Space is held.
  - `isNodeInView(nodeId: string, margin = 20)`: Checks if a node's projected screen coordinates fall within canvas boundaries.
- **Reset Invariants**:
  - `replayIntro()` calls `resetPan()`.
  - Empty space double-click calls `resetPan()`.
  - Move pad "Centre" button calls `resetPan()`.
  - Layout switching (Sphere, Orbits, Timeline, Columns), time-machine playback, node selection on canvas, and filter changes **preserve** pan.
  - Search box selection and path finder only reset pan if the target node is outside visible view (`!isNodeInView(id)`).
- **Leak-Free Event Architecture**:
  - Replaced inline listeners with named class member handlers (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`, `onWheel`, `onContextMenu`, `onDblClick`).
  - All listeners are cleanly detached in `destroy()`.

### P5.2 Input Modalities
- **Left Mouse Drag**: Orbit rotates 3D graph (unchanged). Left click selects a node (unchanged). Shift+click sets path target (unchanged).
- **Right & Middle Mouse Drag**: Screen-space pan with 1:1 cursor sync (`panTX = panX`, no drag lag). Browser context menu prevented on canvas (`contextmenu.preventDefault()`). Right drag release never triggers node selection.
- **Space + Left Drag**: Pans graph with `cursor: grab` / `cursor: grabbing`. Space scrolling prevented when stage is active.
- **Keyboard Navigation**:
  - Stage wrapper is focusable with `tabIndex={0}` and `--color-accent` focus ring.
  - Arrow keys pan by 40 px (Shift + Arrow pans by 120 px).
  - `Home` or `0` resets pan to `(0, 0)`.
  - Key events ignored when focus is inside `<input>`, `<select>`, `<textarea>`, or when `.graph-modal` (Save as image) is open.
- **Touch Interaction**:
  - 1 finger rotates 3D stage (unchanged).
  - 2 fingers pan stage via pointer tracking, pinch zooms.
- **Double-Click**:
  - Double-clicking empty canvas resets pan to `(0, 0)` without affecting zoom or rotation.
  - Double-clicking a node retains existing focus/drill-down behavior.

### P5.3 Move Pad Control (`GraphStage.tsx` & `graphStage.css`)
- **Visual Design**:
  - 3x3 flat button grid located at the bottom-left of the stage canvas (`bottom: 16px; left: 16px`).
  - 36 px square flat buttons, 1 px divider borders, 0 px border radius, Archivo font.
  - Arrow glyphs: Up `↑`, Down `↓`, Left `←`, Right `→`, and wordless square `■` for Centre.
  - Full `aria-label` and `title` attributes on all buttons.
  - 11 px uppercase section header "MOVE" with 11 px neutral subtitle "Right-drag or Space + drag".
- **Interaction & Repeat**:
  - Single press: `panBy(dx, dy)` 40 px.
  - Press and hold: repeats every 60 ms after a 300 ms initial delay.
  - Timers automatically clear on pointer up, pointer leave, blur, and component unmount.
- **State Synchronization**:
  - Centre button is disabled when `pan.x === 0 && pan.y === 0`.
  - Driven by reactive `panState` in `GraphStage.tsx` updated via `engine.onPan` callback (zero `setInterval` polling).
- **Theme & Responsiveness**:
  - Styled with semantic tokens (`--color-surface`, `--color-border`, `--color-text`, `--color-accent`) for seamless display in both Ink and Paper stages.
  - Viewports <= 1050 px: elevated to `bottom: 56px` to clear `.layoutbar`.
  - Viewports <= 900 px: scaled to 32 px buttons and positioned at `bottom: 56px; left: 12px`.
  - Viewports <= 500 px / mobile phones: hidden (`display: none`) to eliminate clutter; native 2-finger touch panning handles navigation.

---

## 3. Measured Numbers & Verification

Automated end-to-end verification executed via Playwright (`scratch/verify_p5.py`) and CDP Touch Harness (`scratch/test_cdp_touch.py`) using real personas `usr_51f14542d71a` (21 reports) and `usr_7cd5de757a04` (Demo Cohort, 50 reports):

| Check / Requirement | Target / Spec | Measured Result | Status |
|---|---|---|---|
| **Frontend Production Build** | Exit 0 | **Exit 0** (built in 1.07s) | PASS |
| **Design Token Audit** | 0 errors | **72 files checked: 0 error(s)** | PASS |
| **Secret Scan** | RESULT: PASS | **RESULT: PASS** | PASS |
| **Backend Pytest** | Green | **403 passed** | PASS |
| **Initial Pan** | `(0, 0)` | `x: 0, y: 0` | PASS |
| **Centre Button at Origin** | `disabled === true` | `disabled === true` | PASS |
| **Right Drag 200px Left** | `pan.x ≈ -200`, `selId === null` | `pan.x = -200`, `selId = null` (no node selected) | PASS |
| **Left Drag** | Rotates only, no pan change | `pan.x = -200, pan.y = 0` (unchanged) | PASS |
| **Space + Left Drag (50px)** | `pan.x` decreases by 50px | `pan.x = -250` | PASS |
| **Centre Click Reset** | `pan === (0, 0)`, Centre disabled | `pan = (0, 0)`, `disabled = true` | PASS |
| **Arrow Keys (Up, Down, Left, Right)** | Steps of 40 px | `Up: y=-40`, `Down: y=0`, `Left: x=-40`, `Right: x=0` | PASS |
| **Shift + Arrow Left** | Steps of 120 px | `x = -120` | PASS |
| **Home / 0 Key Reset** | Resets pan to `(0, 0)` | `Home: (0, 0)`, `0: (0, 0)` | PASS |
| **Empty Canvas Double-Click** | Resets pan to `(0, 0)` | `pan.x = 0, pan.y = 0` | PASS |
| **Move Pad Buttons** | Steps 40 px each | `Up, Down, Left, Right` all step 40 px | PASS |
| **Move Pad 1.2s Hold Repeat** | > 3 repeats | **11.8 repeats** (`pan.x = 513.6px`) | PASS |
| **Target Clamping (30 Right Arrows)** | Clamped to `W * 0.6` | `pan.x = 513.6px` (exact match for `W = 856px`) | PASS |
| **Select Node While Panned** | Leader line touches dot & card | Dossier card opens; red leader line connects | PASS |
| **Snapshot Export While Panned** | Valid PNG data URL | `getSnapshotDataUrl()` returned valid PNG | PASS |
| **Replay Intro Reset** | Resets pan to `(0, 0)` | `pan = (0, 0)` | PASS |
| **Layout Switch Keeps Pan** | Pan preserved across layouts | `pan.x = -40` maintained on switch to Orbits | PASS |
| **Search Box Isolation** | Arrow keys in input do not pan | `pan = (0, 0)` | PASS |
| **Reduced Motion Pan** | Instant update (`panX === panTX`) | `panX = panTX = 50` | PASS |
| **Responsive 1000x700** | Visible, no layoutbar overlap | Move pad visible, clears layoutbar | PASS |
| **Responsive 820x1100 (Tablet)** | Visible, 32px buttons, clears layout | Pad at `bottom: 56px; left: 12px`, button width 32px | PASS |
| **Responsive 400x860 (Phone)** | Pad hidden, no overflow | `display: none`, `scrollWidth = 400` (overflow = false) | PASS |
| **Listener Leak Check** | 5 round trips Library <-> Graph | Exactly 1 canvas, `__graphStage` undefined, 0 leaks | PASS |
| **Demo Cohort (`usr_7cd5de757a04`)** | > 40 nodes loaded | **120 nodes rendered**, Move pad pans & centres | PASS |
| **Two-Finger Drag (CDP Touch)** | 2-finger drag pan | Touch pan shifted stage by 120 px | PASS |

---

## 4. Screenshot Visual Audit (`gemini/shots/`)

1. **`gemini/shots/P5-pad-ink.png`**:
   - Move pad sits at the bottom-left of the dark stage.
   - Clean 1px white/gray divider lines, 0px border radius, sharp Archivo typography.
   - Distinct Up, Down, Left, Right arrows and disabled Centre square (`■`).
   - Sits clearly to the left of the centered layout selector and above the time-machine controls.
   - No visual regressions on existing stage elements.

2. **`gemini/shots/P5-pad-paper.png`**:
   - Paper stage theme with light surface background and dark glyphs.
   - Seamless token contrast matching top overlay buttons (`Replay intro`, `Pause`, `Lens`, `Ink stage`).

3. **`gemini/shots/P5-panned-left-card-open.png`**:
   - Graph stage panned 240 px leftward.
   - Vitamin D biomarker node selected.
   - Dossier card docked on right side.
   - Red elbow leader line originates exactly from the center of the panned Vitamin D dot and terminates flush at the dossier card edge.
   - Centre button (`■`) is enabled and ready to recenter.

4. **`gemini/shots/P5-820.png`**:
   - Tablet portrait viewport (820x1100).
   - Sidebar collapsed to icon rail.
   - Layout bar spans across `bottom: 12px`.
   - Move pad buttons scaled down to 32px and lifted to `bottom: 56px; left: 12px`, avoiding any overlap with the layout bar.

---

## 5. Notes & Follow-Ups
- All requirements of `gemini/TASK_P5_pan.md` are fully met.
- No files committed or staged. Ready for human review.
