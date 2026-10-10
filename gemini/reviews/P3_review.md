# Deep review of P1 + P2 + P3a + P3b (everything built on this branch)

Reviewer: Claude. Date: 2026-10-08. Branch `feature/playground-graph-and-backgrounds`. Tested on real personas with 0, 1, 3, 21 and 50 reports (the 50-report one is "Demo Cohort (demo data)", read only), a throwaway persona (deleted), the real AI Agent, Chrome at 1440x900, 1000x700, 820 and 400 px, reduced motion.

## Verdict
The P3 fixes work and look right. The deep test found **three real defects** that the earlier checks could not see, plus six smaller ones. **Do not commit yet**: one more short round (`TASK_P4_fixes.md`).

## Passed (re-verified this round)
| Check | Result |
|---|---|
| `npm run build` / `audit:design` / `secret_scan` | exit 0 / 0 errors in 72 files / PASS |
| Backend full suite | 403 passed |
| P3a: timeline headers | short ("JAN 2025 / JUN 2025 / UNDATED"), no overlap, also with 50 reports |
| P3a: time machine caption | one line, small file name below, clear of the layout buttons |
| P3a: dev fallback | gone (`fallbackSeriesFixture`, no `import.meta.env.DEV` in `api/graph.ts`) |
| P3a: timers | one effect with stored ids, cleared on unmount |
| P3b: background | now clearly visible at the default Soft on Library, Agent, Timeline, Insights, Settings; text stays readable; Play mode good; Off, route hiding, reduced motion OK |
| Empty persona | calm "No graph yet" with an Upload button, no errors |
| 1, 3, 21, 50 report personas | render, no console errors, no page errors |
| Leaving and re-entering `/graph` 5 times | one stage canvas, fps stays high (no leak) |
| Reduced motion | graph is formed at once, no opening |
| Path finder, Save as image (modal with Download PNG), What changed, lens, time machine | work |
| Text to Graph | unchanged |

## DEFECTS
**H1. The series cache goes stale permanently (backend, `series_service.py`).** I uploaded a PDF in the background (as the app does) while polling `GET /api/graph/{user_id}/series`. The report was seen while still being ingested (no chunks yet) and its empty measurement list was cached under its id forever. Result: `/api/reports/{id}/measurements` returns 8 tests for it, but `/series` returned no points for it, still wrong 30 s later (only a backend restart clears it). In the app: upload a report, open the graph at once, and that report's values never appear in the trend charts or time machine. The 8 tests did not catch it.

**H2. "Show what the last answer cited" can never be enabled.** `saveLastAnswer` (in `lib/lastAnswer.ts`) is not called anywhere; the old Ask page wrote it, the AI Agent page never does. P1 tested the button only by writing sessionStorage by hand. After a real agent answer the graph still says "No answer to show yet".

**H3. The card prints the same "Undated reading" line once per undated report** (17 times for Vitamin D on the 50-report persona), which makes the card huge. The chart's date axis also repeats labels ("JAN 25 JAN 25").

**M1. Esc does nothing**: it neither closes the Save-as-image modal nor deselects the card.
**M2. The Save-as-image picture is cut off** at small window heights (1000x700): the image is taller than the screen and the dialog does not scroll or shrink it.
**M3. Report names are ambiguous in lists.** With dates as canvas labels, the path finder dropdowns and the search list show many identical "Report: Undated" / "Report: June 15, 2025" entries (22 undated reports in one persona). The list entries need the file name too.
**M4. Date format.** Canvas labels read "June 15, 2025" (US order); the preview and the rest of the app use "15 June 2025" and "Jun 2025".
**M5. The timeline with 50 reports draws a dense red hatched field** (one dashed guide per report). Draw a guide only for the reports that get a header, or fade the rest strongly.
**M6. Narrow windows.** At 1000 px the top-right button row is cut off ("Paper stage" is missing); at 820 px the docked card sits on top of the toolbar. The card should become the bottom sheet (like the phone layout) below 900 px and the toolbar should wrap.

## Noted, not blocking
- Page frame rate on the 50-report persona in headless Chrome was about 32 fps (21 reports: well above 55 earlier). Acceptable.
- Grid lines run behind page titles at Soft; readable. Owner's taste.
- `typeE.ts` has one `setTimeout` (word reverts to "VITAGRAPH" after the READY flash); harmless.
- The AI summary of "Vitamin D" on the demo persona was correct and cited its sources.
