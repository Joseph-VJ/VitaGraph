# TASK P3: polish after the P1/P2 review

Read first: `gemini/reviews/P1P2_review.md` (the findings), `gemini/DESIGN_LAW.md`, and the screenshot `ai box.png`. Branch `feature/playground-graph-and-backgrounds`. **Do NOT commit, push, stash or reset.** No sub-agents. Never touch `vitagraph/backend/.env` or `site design/tsconfig.tsbuildinfo`. Backend on 8000 and frontend on 5173 already run: reuse them, do not start new ones. Use persona `usr_51f14542d71a` (21 reports) for real checks. Never delete "Demo Cohort (demo data)".

Two sessions can work at the same time because the files are separate. **Session P3a = Part A. Session P3b = Part B.** Do only your part.

---
## PART A (session P3a): graph stage polish
Files you own: `site design/src/components/graph/stage/*`, `site design/src/pages/KnowledgeGraphPage.tsx`, `site design/src/api/graph.ts`, `site design/src/lib/reportLabels.ts` (only to add small helpers). Do not touch anything else.

A1. **Short report labels on the canvas.** A report node is labelled on the canvas by its date only, taken from `lib/reportLabels.ts` (for example "20 June 2025"; undated reports "Undated"). The file name stays in the card, the search list, the hover tooltip and the Subgraph list. Timeline column headers use the short month label ("Jun 2025", "Undated"), never the file name. Headers are thinned by measured text width (keep the first and the last, skip any that would touch the previous drawn one, with 8 px gap); several reports on the same date draw one header. The time machine caption is ONE line: big short date ("Jun 2025", 44 px max) with the file name as a small 14 px line under it; it must not wrap, must stay inside the stage and clear of the bottom layout buttons (move it up if needed).

A2. **Trend chart in the card works for 1 to 50 readings.** With more than 6 points: value labels only on the first, the last, the minimum and the maximum point; date labels thinned by measured width (at most 4 shown, always the first and the last); point markers shrink with the count; nothing overprints. Keep the printed-range band and the red marker for out-of-range points. Check Vitamin D (about 17 points) and Hemoglobin.

A3. **Delete `fallbackSeriesFixture`** and the DEV branch in `graphApi.series` completely. `series()` just calls the endpoint. If it fails the card shows the existing quiet "trend not available" line (no invented data).

A4. **Undated readings.** The big number and "change since" line may only compare DATED readings. If the newest reading is undated, show the newest dated one as the big number and list the undated reading as "Undated reading: 18 ng/mL (file name)" in small text. An undated reading is never called latest, oldest or "since".

A5. **Timers.** Replace the three `setTimeout`s in `GraphStage.tsx` (both places) by one effect that stores the ids and clears them on cleanup and on Replay intro; no state update after unmount.

A6. Re-run: `npm run build` (exit 0), `npm run audit:design` (0 errors). Take new 1440x900 screenshots into `gemini/shots/`: `P3a-timeline.png`, `P3a-time-machine.png`, `P3a-card-vitd.png` (bottom of the card with the chart), `P3a-sphere.png`. Look at each one yourself and fix what overlaps before you finish. Write `gemini/reports/P3a_summary.md` (short).

---
## PART B (session P3b): background must be visible
Files you own: `site design/src/components/background/*`, `site design/src/components/shell/AppShell.tsx`, `site design/src/index.css` (only the background lines you added), `site design/src/pages/SettingsPage.tsx` (only the background rows). Do not touch anything else.

B1. **Soft must be clearly visible, Full strong, content still readable.** Targets measured on a 1440x900 screenshot of `/library` and `/settings` (default Warp): at Soft the grid lines are visible in the header strip and margins, about 6 to 8 % darker than the ground, and the wells and ripples are visible when the pointer moves; at Full about 14 to 18 %. Do it in two places: (1) raise the engines' line and dot alphas for Soft and Full in all four engines (`strength()` in `LivingBackground.tsx` and each engine's own alphas); (2) lower the content backing in `AppShell.tsx` from 88 % to about 72 % ground (keep text contrast at least 4.5:1 on table rows, cards and inputs; if any page's text becomes hard to read, give only that page's panels their own solid ground instead of raising the backing again).
B2. Check all four engines at Soft on `/library`, `/agent`, `/upload` and `/settings`, plus Full on `/settings`; save `gemini/shots/P3b-library-soft.png`, `P3b-settings-full.png`, `P3b-agent-soft.png`, `P3b-upload-soft.png`. Look at each yourself: grid/ink/dots must be seen without touching the reading of text. Reduce motion still draws one still frame; Off still hides the canvas; `/graph` and `/text-to-graph` still hide it; no horizontal overflow at 400 px.
B3. Measure frame rate again: Soft at least 28 fps on `/library`, Full at least 40 fps on `/settings` (use your existing hook).
B4. Run `npm run build` (exit 0), `npm run audit:design` (0 errors), `python scripts/plan/secret_scan.py` (PASS). Write `gemini/reports/P3b_summary.md` (short: what changed, the numbers, the screenshots).
