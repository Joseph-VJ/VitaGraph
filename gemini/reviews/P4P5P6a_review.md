# Review of P4a, P4b, P5 and P6a (2026-10-09)

Reviewer: Claude. P5 ran at the same time as P4b on the same three stage files (`GraphStageEngine.ts`, `GraphStage.tsx`, `graphStage.css`); I checked that both sessions' edits survived (see "Merge check").

## Gates (run by me)
| Check | Result |
|---|---|
| `npm run build` | exit 0 |
| `npm run audit:design` | 71 files, 0 errors |
| `python scripts/plan/secret_scan.py` | RESULT: PASS |
| Backend suite | **420 passed** (403 + 2 P4a + 15 P6a), 7 min |

## Passed (verified live, Chrome 1440x900, `usr_51f14542d71a` unless noted)
- **H1 stale series cache (P4a):** code keyed by `(report_id, chunk_count)`, only ready/failed cached; 10 series tests pass; P4a's polling proof (46 polls, final 8 tests = 8 measurements) accepted.
- **H2 evidence link (P4a):** asked the REAL agent "What was my Hemoglobin in the June 2025 report?" (52 s): `sessionStorage['vitagraph:last_answer']` held the question and 5 chunk ids; on `/graph` the button was enabled and numbered red badges 1 to 6 appeared on the cited nodes (`scratchpad rv3-evidence.png`).
- **H3 and M-items (P4b):** Vitamin D card on the Demo Cohort shows "17 undated readings, all 18 ng/mL"; dates read "15 January 2025"; timeline with 50 reports shows one guide, no red hatching (their screenshots, which I looked at); 1000/820/400 widths: no horizontal overflow (my run).
- **Pan (P5):** right-drag 200 px = pan -200 and no selection, left-drag still rotates and does not pan; arrows 40 / Shift 120; clamp stops at exactly `W*0.6` (513.6); `0`/Home resets; pad buttons move, hold-to-repeat reaches the clamp in about 750 ms; Centre disabled at (0,0), enabled after a move; double-click empty space resets; arrows in the search box do not pan; one canvas after five round trips; `__graphStage` gone after leaving; no console errors. Hidden at 400 px (allowed by the task).
- **Streaming route (P6a), my own run:** first status 0.04 s, writing at 7.85 s, then 11 nodes and 10 edges in order from 7.92 s to 9.74 s, `completed {nodes 11, edges 10, dropped 0}`; empty text = HTTP 400. All quotes were real spans of the text.
- **Cleanup (P6a):** no references to the deleted files remain (grep); no "Cinematic" in `src` except motion tokens; Upload and Settings unchanged otherwise.

## Defects (fixed in Part 0 of `TASK_P6b_text_graph_stage.md`)
1. **F1 (medium)** Esc with the Save-as-image modal open and a node selected: first Esc deselects the node and leaves the modal open. Two Esc handlers (`GraphStage.tsx` ~384 and `KnowledgeGraphPage.tsx` ~474) race; the stage's runs first and its re-render replaces the page handler before it can close the modal.
2. **F2 (low-medium, accessibility)** Space (and arrows) are swallowed whenever focus is inside the stage, so a keyboard user cannot activate the Lens, Rotate, Replay or Paper buttons with Space (Enter still works).
3. **F3 (visual)** The Move pad overlaps the bottom-left message bars ("The last answer cited 6 passages...") and the opening titles.
4. **F4 (text)** Settings "Reduce motion" helper still says "Shortens the ingestion show".

## Merge check (P4b + P5 on the same files)
Both sets of edits are present: P4b (`keptHeaders` guides, `calc(100vh - 48px)` modal, 900 px bottom sheet, unique datalist names, date-axis de-dup, undated line) and P5 (`panBy/resetPan/getPan/isNodeInView/setSpaceDown`, move pad, named pointer handlers removed in `destroy()`).

## Notes, not defects
- Stream timing: the model needs about 8 s before its first word; after that the whole graph arrives within about 2 s. P6b must make that feel alive (opening, growth animation) without fake delays.
- A relation like "Mrs. Rao has 150/95 mmHg" is quote-valid but weak inference; acceptable, the quote is shown on the card.
- P6a could not exercise the cap-close path live (answers stayed below the caps); proven with the fake stream only.
- Nothing is committed. Suggested commit groups when the owner says so: (a) backend series + stream (`series_service.py`, `graph_ai.py`, `routes/graph.py`, `routes/tools.py`, `schemas/graph.py`, tests), (b) graph stage + pan (`components/graph/stage/*`, `KnowledgeGraphPage.tsx`, `api/graph.ts`, `NodeSummary.tsx`, `reportLabels.ts`, `useAgentChat.ts`), (c) living background + cleanup (`components/background/*`, `appActivity.ts`, `preferences.ts`, `SettingsPage.tsx`, `UploadPage.tsx`, `AppShell.tsx`, `index.css`, `useJobStream.ts`, deletions), (d) docs.

---
# Addendum: review of P6b (2026-10-09)

Gates (run by me): `npm run build` exit 0; `audit:design` 71 files 0 errors; secret scan PASS. Backend suite 420 passed (P6b report; P6b did not touch the backend).

Passed live (Chrome 1440x900, Demo Cohort, my own text): Part 0 (F1: first Esc closes the modal and the node stays selected, second Esc deselects; F2: focus Lens + Space toggles it; F3/F4 per report and screenshots); pattern build (3 layouts, no Timeline button, card 340 px with the quote highlighted `<mark>` and offsets); AI stream (one request, nodes arrive one by one, 1 -> 13 nodes over about 3 s after the first word at 6.8 s; Stop keeps the 3 nodes drawn and ends the stream; stream error after 2 nodes keeps them and shows "The AI service did not answer."; HTTP 409 shows the pattern graph with the message); no overflow at 1000/820/400; 1 canvas after 5 round trips; `/graph` unchanged (120 nodes, Timeline layout, time machine).

Defects (fix in `gemini/TASK_P7_text_graph_fixes.md`):
1. **Hub node isolated (real).** After an AI build the hub has degree 0 ("Connected to 0 nodes"); the P6b rule "every node ends up connected" is not met. Reproduced twice.
2. Stage search placeholder on Text to Graph still says "Find a test, section or report"; counter says "1 nodes".
3. After Stop no message is shown.
4. `GraphCanvas.tsx` (707 lines) is dead code kept only for two type imports.
Not a defect: the first word of the model takes 7 to 18 s (model start time); the graph then grows over 2 to 4 s.
