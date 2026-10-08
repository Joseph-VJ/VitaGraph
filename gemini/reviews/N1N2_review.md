# Review of N1 (backend) and N2 (frontend): AI node summary

Reviewer: Claude. Date 2026-10-08. Branch `feature/ai-node-summary`, nothing committed.

## Verdict
The feature works end to end: real Chrome, real backend, real model. Streaming, sources, citations, quotes, cache hit (0.0 s), "Write again", 404 and the look (matches the preview) are all good. **NOT ACCEPTED yet**: five defects found on real data that the sessions' own tests could not see. Fix tasks: `TASK_N3_backend_fixes.md` and `TASK_N4_frontend_fixes.md`.

## What I re-ran myself (all PASS)
`npm run build` exit 0; `npm run audit:design` 0 errors (61 files); `scripts/plan/secret_scan.py` PASS; `pytest tests/test_node_summary.py tests/test_agent_route.py` 24 passed; `.env` unchanged; nothing committed. N1's own full run: 377 passed (362 + 15).
Live with the real model (throwaway persona, 3 sample PDFs): event order `status, sources, status(writing), text_delta x8..17, status(checking), completed`; first word after 5.8 to 12 s (the model API's reasoning time, not ours); second call `cached` in 0.0 s; `refresh` calls the model again; unknown node 404 with a readable message.

## Must fix (backend, N3)
1. **Dates are sorted as text, so "oldest/latest/earlier" can be wrong.** `_reports()` uses `ORDER BY report_date` on strings like `20 June 2025`; `02 October 2025` sorts BEFORE `20 June 2025`, and undated reports (NULL) sort FIRST. The person fact uses `min()/max()` of those strings. N1's own proof shows it: it printed "Values, oldest first: 13.8 (15 January 2025); 14.1 (20 June 2025); 14.2 (01 December 2024)" and a fallback saying "The latest value is 14.2 g/dL on 01 December 2024" (that is the OLDEST report). The "earlier value" lookup in the `measurement` branch compares date strings with `<` and has the same flaw.
2. **Scanned pages carry the wrong method name.** The database holds `ocr-rapid` / `ocr-tesseract`; the spec, the browser (`method === "ocr"`) and the prompt (`s.method == 'ocr'`) expect `ocr`. Result on a real scan: no "OCR" badge, no "read by OCR" in the prompt, and the fallback text says "read as 'ocr-rapid'" (an engine name in visible text).
3. **The advice filter rejects normal names.** `_ADVICE` has `diagnos\w*` and `treat\w*`, so "Riverdale **Diagnostics**" (the lab name on EVERY sample report), a section called "Treatment plan" or a category "Diagnostic Measurement" makes a perfectly good AI answer fail and be replaced by the plain fallback. Reproduced live: the person node and `cat_Diagnostic_Measurement` both came back `fallback` ("The AI text did not pass the checks"); and `compose_fallback` for that category does not even pass `validate()` (N1 claimed all 9 types pass; the sample data had no such label).
4. **Fallback wording is rough (this is what the person sees when the AI is off).** Step 2 of spec 3.7 (per-kind sentences) was not done. Examples from real data: "Reviewer N temp is a person found in 3 of your files", "Page 1 is a passage found in 1 of your files", "Marked Uncertain (Page 1) is a unreadable passage", "Unknown Date is a date found in 1 of your files". Also an uncertainty node means "no lab values could be read from this passage", not "unreadable" (the page may be a good native page).
5. **The tests did not cover any of 1 to 4.** Add tests that fail on today's code.

## Must fix (frontend, N4)
6. OCR badge: accept any method that starts with `ocr` (defence in depth next to fix 2).
7. **Every dot click fires a request, and each request rebuilds the whole graph on the server.** My grid-click test selected 46 dots in a few seconds and sent 46 requests. Wait about 250 ms after the selection settles before asking (a debounce, not a progress timer); a cached node still shows instantly.
8. **The box can be off screen.** The card sits under the Subgraph list in the right panel; on a phone it is far below the 74vh graph. Scroll it into view (nearest, smooth unless reduced motion) when a dot is selected.
9. Show the Sources list as soon as the `sources` event arrives (the first words take 6 to 12 s; today the whole box is just "Reading 3 passages…" until the end).
10. N2's phone screenshot `gemini/shots/N2-graph-summary-400.png` does not show the box at all (it shows the page with no dot selected, for a different persona). Take a real one with a dot selected.
11. Tidy: `renderSummary` has an unused `streaming` parameter silenced with `void streaming;`.

## Accepted as is
`core/sse.py` move (the compatibility aliases in `routes/agent.py` are a little clumsy but keep every existing test unedited; leave them), `node_summaries` table and `delete_user` cleanup, route and 404 behaviour, cache key, audit rows, `validate()` structure, all frontend files' structure, CSS (tokens only, 0 radius), the mocked-route tests (10 of 10).

## Notes for the owner (not defects)
- First words take 6 to 12 s with the real model even at minimal reasoning; the box shows "Reading N passages" and (after N4) the sources meanwhile. Cached summaries are instant.
- A model answer sometimes reads oddly ("a part of red blood cells"); the prompt could be tuned later.
