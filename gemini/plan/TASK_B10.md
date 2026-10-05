<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task B10 — Graph performance and fallback check script

- **Goal:** Measure performance rules 2, 4, 9 and 10 and the automatic 2D fallback, with one re-runnable script.
- **Tier:** Must
- **Size:** M
- **Review:** gate
- **Depends on:** B8
- **Files to read first:**
  - `scripts/plan/check_layout.py`
  - `site design/src/components/graph3d/Graph3D.tsx`
- **Files to create or modify:**
  - create `scripts/plan/graph_perf.py`

**What to change**
1. **Create `scripts/plan/graph_perf.py`** (Playwright, Chrome channel, dev server on 5173). Its argument is the persona ID. Checks:
   - **Idle frames (rule 2):** open `/graph` in 3D and switch Auto-rotate off. Wait 4 s for the view to settle, read `window.__VG_GRAPH_FRAMES__`, wait 3 s more and read it again. The difference must be 0.
   - **Auto-rotation (rule 12):**
     - With Auto-rotate on, `window.__VG_GRAPH_ROTATION__` grows by 0.4 to 0.75 radians over 3 s, which is 0.19 radians per second with tolerance.
     - While the mouse button is held down on the canvas without moving, it does not change.
     - In a context created with `reduced_motion="reduce"`, it does not change over 3 s and the switch is disabled.
   - **Orbit frame rate:** drag the canvas with the mouse for 3 s while counting `requestAnimationFrame` callbacks in the page. Print the frames per second, which must be at least 30 at 1440 × 900. Print the GPU renderer string from `WEBGL_debug_renderer_info` when available, so the reviewer knows the machine.
   - **Caps (rule 4):** the `graph-cap-note` text names at most 120 shown nodes with fragments hidden, and at most 400 with fragments shown.
   - **Memory (rule 9):** navigate between `/graph` and `/library` 5 times. Read `performance.memory.usedJSHeapSize` (Chrome) after a forced garbage collection through the DevTools protocol (`HeapProfiler.collectGarbage`). Growth must stay at or below 15 MB.
   - **Fallback:** launch a second browser with `args=["--disable-webgl", "--disable-3d-apis"]`, open `/graph`, and expect the 2D view with the line "3D is not available in this browser, so the 2D view is shown."
   - End with `RESULT: PASS` or `RESULT: FAIL (...)`.

**How to verify**
1. Both servers running: `$env:PYTHONIOENCODING="utf-8"; python scripts\plan\graph_perf.py usr_51f14542d71a`. It ends with `RESULT: PASS`.
2. Paste the printed frame counts, frame rate, renderer, cap note texts and memory numbers.

**Acceptance criteria**
- [ ] Zero frames are drawn while idle with Auto-rotate off.
- [ ] Auto-rotation runs at the stated speed, stops while dragging, and is off under reduced motion.
- [ ] At least 30 fps while orbiting (with the renderer named).
- [ ] Heap growth is 15 MB or less after 5 visits.
- [ ] The fallback works with WebGL disabled.
- [ ] `RESULT: PASS` (output pasted).
