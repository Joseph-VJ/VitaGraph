# Review of P1 (graph stage) and P2 (series endpoint + living background)

Reviewer: Claude. Date: 2026-10-08. Branch `feature/playground-graph-and-backgrounds`. Real data: persona `usr_51f14542d71a` (21 reports, 120 nodes shown), backend restarted on port 8000 with the new code.

## Verdict
Both sessions are close. The structure, data wiring and the docked card match the preview and `ai box.png`. **Not committed yet**: a short polish round (`TASK_P3_polish.md`) fixes the visible defects below, then the reviewer commits.

## What I checked and what passed
| Check | Result |
|---|---|
| `npm run build` | exit 0 |
| `npm run audit:design` | 72 files, 0 errors |
| `python scripts/plan/secret_scan.py` | PASS |
| Backend full suite | **403 passed** (395 + 8 new series tests) |
| `GET /api/graph/usr_51f14542d71a/series` | 200; 21 reports in chronological order, undated last, `order` 0..20; 10 tests; 138 points, 134 with printed ranges, 138 with exact offsets |
| Graph page 1440x900 | dark stage, Paper switch, opening, four layouts, lens (button), What changed (caption bar works), time machine Play, evidence button disabled until an answer exists, docked card with red top rule, elbow line, AI box first (matches `ai box.png`) |
| Phone 400 px | no horizontal overflow (400/400), stage on top, panel below |
| Text to Graph | still the old canvas, works |
| Living background | hidden on `/graph` and `/text-to-graph`; Off persists; Play mode (grid, wells, toolbar, Esc) looks like the preview; Settings rows present; events (upload stages, agent busy) published from the real hooks |
| Hygiene | no `console.log`, no `any`, no raw hex, no provider names |

## Findings to fix (all visible to the owner)
**Graph (P1)**
1. **Report labels are too long on the canvas.** Timeline column headers read "JAN 2025 · SYNTHETIC_PANEL_2025-01-15.PDF" and overprint into an unreadable red smear at the top; the time machine caption is a two-line headline "JUN 2025 · SYNTHETIC_PANEL_2025-06-20.PDF" that sits on top of the nodes. In the sphere the report nodes are labelled with long file names and crowd the view. The preview labels reports with their date only.
2. **Trend chart in the card breaks with many readings.** With 17 to 21 points, value labels and date labels overprint ("34343434...", a black smear on the axis).
3. **Dead dev fallback.** `api/graph.ts` has a 110-line `fallbackSeriesFixture` that rebuilds the series in the browser when the endpoint 404s. The endpoint exists now; the fallback duplicates backend logic, hides real errors in dev, and gives ranges as null. Remove it.
4. **Undated reading shown as the headline value.** The card says "18 ng/mL · Undated" and "+0 ng/mL since Jan 2025" (an undated report compared with a dated one). Only dated readings may be compared.
5. **Loose timers.** `GraphStage.tsx` lines 196 to 198 start three `setTimeout`s that are never cleared (state update after unmount). Store and clear them, or drive the opening text from the engine clock.

**Background (P2)**
6. **At the default (Soft) the layer is invisible.** P2's own screenshot `gemini/shots/P2-warp-1440.png` shows a plain page; at Full on `/settings` only a very faint grid shows in the margins. The owner asked for a living background; if it cannot be seen it looks broken. The 88 % backing over the whole content column hides most of it.

## Not defects (noted)
- Sphere is dense with 120 real nodes; priority and collision pruning exist and work.
- Legend circles in `KnowledgeGraphPage.tsx` use `border-radius` 50 % as node symbols (same as the Text to Graph legend), allowed.
- Pressing L while a checkbox has focus does nothing; the Lens button works.
