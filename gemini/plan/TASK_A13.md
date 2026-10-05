<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task A13 — Layout check script and the end-of-A gate

- **Goal:** Add two re-runnable browser scripts. One checks every route at 360, 820 and 1440 px for horizontal overflow and console errors. The other checks accessibility (axe-core), keyboard focus and reduced motion. Then run the end-of-A gate: the design audit and both scripts must pass.
- **Tier:** Must
- **Size:** M
- **Review:** gate
- **Depends on:** A1, A3, A4, A5, A6, A7, A8, A9, A10, A11, A12
- **Files to read first:**
  - `gemini/TASK_AG4_agent_page.md` lines 692–700 (anchor `from playwright.sync_api import sync_playwright`), the existing Playwright style
  - `site design/src/components/shell/AppShell.tsx` line 70 (anchor `sessionStorage.getItem("vg_booted")`), the key that skips the boot animation
- **Files to create or modify:**
  - create `scripts/plan/check_layout.py`
  - create `scripts/plan/check_a11y.py`
  - modify `site design/package.json`
  - modify `site design/package-lock.json`

**What to change**
1. **Create `scripts/plan/check_layout.py`**, a Python script using Playwright's sync API:
   - **Command line:** `check_layout.py <persona_id> [route ...]`. Without routes it checks `/upload`, `/library`, `/agent`, `/graph`, `/timeline`, `/compare`, `/insights` and `/settings`. With no persona ID it prints a usage line and exits 2.
   - **Browser:** start Chrome with `p.chromium.launch(channel="chrome")`.
   - **Viewports:** check three, in this order: 360 × 740, 820 × 1100 and 1440 × 900.
   - **Context setup:** for each viewport, open a new browser context with an init script that sets localStorage `vitagraph_user_id` to the persona and sessionStorage `vg_booted` to `1`.
   - **Error capture:** record console messages of type error and uncaught page errors. Ignore messages that contain `net::ERR`.
   - **Per route:**
     1. Open `http://localhost:5173<route>` and wait 3 seconds.
     2. Measure `document.documentElement.scrollWidth` against `window.innerWidth`, and the `main#main-content` element's `scrollWidth` against its `clientWidth`, allowing 1 px.
     3. A route passes only when neither overflows and there are no console errors.
     4. Print one line: `OK` or `FAIL`, the width, the route, both measurements and the console error count, plus up to three error texts.
     5. At 360 and 1440 px, save a screenshot to `gemini/shots/layout-<width><route with / replaced by ->.png`.
   - **Result:** end with exactly one line `RESULT: PASS`, or `RESULT: FAIL (<number of failed checks>)`. Exit 0 only on PASS.
2. **Install axe-core:** in `site design`, run `npm install -D axe-core@4.13.0 --save-exact`. Rule 10 allows exactly this version, and it changes only `package.json` and `package-lock.json`.
3. **Create `scripts/plan/check_a11y.py`**, with the same command line, browser start and persona setup as `check_layout.py`, at 1440 × 900. For each route it runs three checks:
   - **Accessibility:**
     - Inject `site design/node_modules/axe-core/axe.min.js` with `page.add_script_tag(path=…)`.
     - Run `axe.run` limited to the tags `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa`.
     - The route fails on any violation with impact `serious` or `critical`. Print each one's rule ID, impact, node count and first target selector.
   - **Keyboard focus:**
     1. Press Tab up to 40 times. After each press, read `document.activeElement`.
     2. It must not be `body` after the first press.
     3. It must be visible: its bounding box is inside the viewport after it scrolls into view.
     4. It must show a focus indicator: a computed `outline-style` other than `none` with a width of 1 px or more, or a `box-shadow` other than `none`.
     5. Stop when focus returns to an element already visited. Print the number of tab stops.
   - **Reduced motion:**
     1. Open a second context with Playwright's `reduced_motion="reduce"`, then load the route.
     2. After 1.5 s, the number of running animations, from `document.getAnimations()` filtered on `playState === "running"`, must be 0.
     3. On `/graph` (after B8), `window.__VG_GRAPH_ROTATION__` must not change over 2 s.
   
   End with `RESULT: PASS` or `RESULT: FAIL (...)`, and exit 0 only on PASS.

**How to verify**
1. `cd "site design"; npm run audit:design`. It **exits 0**. The only findings left are `pending` lines for `pages/KnowledgeGraphPage.tsx` and `components/gallery/CinematicPipelinePopup.tsx`, which tasks B8 and C3 replace. Paste the last line. The planner's dry run of the A1 specification on the tree after A1–A12 gave `Checked 40 files: 0 error(s), 53 pending.`
2. `cd "site design"; npm run build`. It must exit 0.
3. With both servers running, from the repository root: `$env:PYTHONIOENCODING="utf-8"; python scripts\plan\check_layout.py usr_51f14542d71a /upload /library /agent /timeline /compare /insights /settings`. It ends with `RESULT: PASS`. `/graph` is checked again after workstream B.
4. `python scripts\plan\check_a11y.py usr_51f14542d71a /upload /library /agent /timeline /compare /insights /settings`. It ends with `RESULT: PASS`.
   - If axe reports serious or critical violations, fix them in the page they name. That fix is part of this gate task.
   - List every fix in report section 4.

**Acceptance criteria**
- [ ] `npm run audit:design` exits 0, and its pending lines name only the two files above.
- [ ] `check_layout.py` prints `RESULT: PASS` for the seven routes (output pasted).
- [ ] `check_a11y.py` prints `RESULT: PASS` for the seven routes: no serious or critical axe violations, visible focus on every tab stop, and no running animation under reduced motion (output pasted).
- [ ] `axe-core` is a dev dependency at exactly 4.13.0, and no other package changed.
- [ ] Screenshots `gemini/shots/layout-360-*.png` and `gemini/shots/layout-1440-*.png` are committed.
- [ ] The build exits 0.
