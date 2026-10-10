# TASK P5: move the whole graph left / right / up / down (pan), same layout as today

Branch `feature/playground-graph-and-backgrounds`. **Do NOT commit, push, stash or reset.** No sub-agents. Never touch `vitagraph/backend/.env` or `site design/tsconfig.tsbuildinfo`. Frontend dev server is on 5173 (reuse it). Real checks use persona `usr_51f14542d71a` (21 reports) and the read-only "Demo Cohort (demo data)" `usr_7cd5de757a04` (50 reports).

**Run this AFTER P4b is finished and reviewed**: P4b owns the same files (`components/graph/stage/*`, `pages/KnowledgeGraphPage.tsx`). Two sessions must not edit them at the same time. Files you own: `site design/src/components/graph/stage/GraphStageEngine.ts`, `GraphStage.tsx`, `graphStage.css`. Nothing else.

## Why
The owner loves the current graph stage and wants NOTHING about its look changed. Today a drag only rotates the 3D graph; there is no way to slide the whole graph to the left, right, up or down (for example to look at a node hidden behind the docked card, or to put a cluster in the middle). Add panning as an extra, with the look of the stage unchanged.

## Current code (read these lines first)
- `GraphStageEngine.ts` `bindEvents()` (about line 680): `pointerdown` starts a drag for ANY button; `pointermove` rotates (`ry += dx*0.008`, `rx += dy*0.006`); `wheel` zooms (`zoomT`, 0.55 to 2.2).
- `renderFrame()` (about line 797 to 858): builds `this.PR = { cy, sy, c, s, S, ox, oy }` where `ox = W/2 + this.oxs`, `oy = H/2 + ... + this.oys`. `oxs/oys` is the "make room for the docked card" slide. Everything (nodes, labels, hit test, lens, leader line at about line 1634, Save as image) is drawn from `PR`, so a pan added to `ox/oy` moves everything together.
- Overlay buttons are in `GraphStage.tsx` (top-right row about line 417, layout switch at the bottom).

## What to build

### P5.1 Engine: a screen-space pan
- Add `panX, panY` (current) and `panTX, panTY` (target), in CSS pixels, default 0. Each frame ease current toward target (`+= (target - current) * 0.2`; instant when reduced motion). Add the current pan to the projection origin: `ox: W/2 + this.oxs + this.panX`, `oy: ... + this.oys + this.panY`.
- Clamp the TARGET so the graph centre cannot be lost: `|panTX| <= W * 0.6`, `|panTY| <= H * 0.6`.
- Public methods: `panBy(dx, dy)` (adds to target and clamps), `resetPan()` (target = 0), `getPan(): {x, y}` (target values, for the UI and tests).
- `replayIntro()` also calls `resetPan()`. Changing layout, selecting a node, time machine, path finder and filters do NOT reset the pan (the owner moved it on purpose). Only "Centre" (P5.3), Replay intro and double-click on empty space reset it.
- The existing slide for the docked card (`oxs`) stays as is and adds to the pan.

### P5.2 Input (rotation stays exactly as today for the left button)
- Left button drag (no modifier) = rotate, unchanged. Click = select, unchanged. Shift+click = path, unchanged.
- **Right button drag or middle button drag = pan.** Only `e.button === 0` may rotate; buttons 1 and 2 pan (`panBy(dx, dy)` with the pointer delta; the graph follows the cursor 1:1; set `panT = pan` while dragging so there is no lag). Block the browser context menu on the canvas (`contextmenu` -> `preventDefault`). A pan drag never selects a node on release.
- **Space held + left drag = pan** (Space only while the stage is hovered or focused and the focus is not in an input/select/textarea/button; prevent the page from scrolling). Show cursor `grab`/`grabbing` while panning.
- **Arrow keys pan** by 40 px (Shift = 120 px) when the stage has keyboard focus or the pointer is over it, and focus is not in an input, select or textarea, and the Save-as-image modal is closed. Make the stage wrapper focusable (`tabIndex={0}`, visible focus ring using the accent token, no radius) so a keyboard user can reach it. Up arrow moves the graph UP on screen. `0` or `Home` = Centre. `+`/`-` may stay as they are if they already exist; do not add new zoom keys.
- **Touch:** one finger rotates (as today). Two fingers: drag pans, pinch zooms (use `pointerType === "touch"` with two tracked pointers; keep `touch-action: none` on the canvas). Keep it small and safe; if it becomes unreliable, ship pan by two-finger drag only and say so.
- **Double-click on empty space = Centre** (reset pan only; do not touch rotation or zoom). Double-click on a node keeps whatever it does today.

### P5.3 Visible control: a small "Move" pad (so people who never right-click can find it)
- Bottom-left of the stage, 16 px from the left and bottom edges, ABOVE the time-machine caption and clear of the centred layout switch. A 3 x 3 grid of 36 px square flat buttons (1 px divider border, no radius, ink background on the dark stage, `--color-accent` focus ring, Archivo): row 1 `Up` in the middle; row 2 `Left`, `Centre`, `Right`; row 3 `Down` in the middle. The empty corner cells stay empty. Use plain arrow glyphs (up, left, right, down) and the word-less "Centre" glyph (a small square), each with `aria-label` ("Move the graph up", ... "Centre the graph") and `title`.
- A label "Move" in the 11 px uppercase style used by the other stage labels sits above the grid, plus a quiet one-line hint under it: "Right-drag or Space + drag" (11 px, neutral).
- Press = `panBy` 40 px; **holding repeats** every 60 ms after 300 ms (clear the timers on release, pointer leave, blur and unmount). `Centre` is disabled when the pan is already (0,0) (read `getPan()` on a light polling-free path: engine callback or React state updated when the pan changes; no `setInterval`).
- Light theme ("Paper stage") must work: the pad uses the same token pairs as the other overlay buttons.
- Width <= 900 px: buttons 32 px and the pad moves to the bottom-left above the bottom sheet's top edge or hides behind a small "Move" toggle; it must NEVER be covered by the docked card/bottom sheet or overlap the layout switch (check 1000x700, 820x1100, 400x860). If it cannot fit at 400 px, hide the pad there (right-drag cannot exist on a phone but two-finger pan does).
- Reduced motion: moves instantly, no easing.

### P5.4 Things that must keep working with a panned graph (test each)
Node click/hover hit test (`hitTest` uses `PR`), tooltip position, the red elbow leader line from the dot to the docked card (it must still start AT the dot and end at the card edge), lens circle, labels and their collision pruning, path-finder comet, time-machine, "Show what the last answer cited" badges, search-select (selecting a node from the box should still bring it into view: if the dot is outside the stage after a pan, reset the pan when a node is chosen FROM the search box or path finder; a canvas click does not reset it), Save as image (the PNG must show the graph where it is on screen), Replay intro, Pause/Rotate, layout morphs, Paper/Ink switch, resize of the window.

### P5.5 Do NOT
Change any colour, font, size, label, text or layout of the existing stage, panel or card. Do not add a library. Do not add `setTimeout` fake progress. No model/provider names. Keep the engine's cleanup: remove every listener you add in `destroy()`, clear the repeat timers, no leaked `keydown`/`keyup` listeners after leaving `/graph` (five round trips Library -> Graph must still keep one canvas and no extra listeners; count them with `getEventListeners` or by dispatching keys after leaving).

## Verify (paste the numbers into the summary)
1. `cd "site design" && npm run build` exit 0; `npm run audit:design` 0 errors; `python scripts/plan/secret_scan.py` PASS.
2. Chrome 1440x900, Demo Cohort and `usr_51f14542d71a`, Playwright (`channel="chrome"`, `canvas:visible`): 
   - right-button drag of 200 px left: the person node's screen position moves about 200 px left (read it through a DEV-only hook such as `window.__graphStage?.getPan()`, or compare screenshots); left drag still rotates and does not pan; a right-drag release does not select a node;
   - Space + drag, arrow keys (40 and Shift 120), Home/0, double-click on empty space, the pad's 4 arrows (single press and 1.2 s hold: more than 3 repeats) and Centre (disabled at 0,0, enabled after a move);
   - clamp: 30 right-arrow presses stop at `W * 0.6`;
   - select a node (dock opens) AFTER panning: leader line still touches the dot; click a dot while panned selects the right node;
   - Save as image after a pan: screenshot shows the panned graph;
   - Replay intro resets the pan; layout switch keeps it;
   - typing in the search box and using arrows inside a `select` does NOT pan;
   - reduced motion on: pan is instant.
3. Phone/tablet: 1000x700, 820x1100, 400x860: the pad is visible and not covered, no horizontal overflow; a two-finger drag test with CDP touch events if you can, otherwise state that you could not test it.
4. Listener leak: five round trips Library -> Graph; one `canvas:visible`; arrow keys after leaving `/graph` do nothing.
5. Screenshots in `gemini/shots/`: `P5-pad-ink.png`, `P5-pad-paper.png`, `P5-panned-left-card-open.png` (graph panned, a node selected, leader line visible), `P5-820.png`. Look at each one yourself and list any visual difference from the unchanged stage.
6. Write `gemini/reports/P5_summary.md` (short): what you built, the numbers above, anything not tested.
