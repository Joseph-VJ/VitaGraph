# Review of N3 (backend fixes) and N4 (frontend fixes)

Reviewer: Claude. Date 2026-10-08. Branch `feature/ai-node-summary`, nothing committed.

## Verdict
**Most of it is fixed and verified; one more small round is needed** (N5 backend, N6 frontend). The feature is already usable.

## Verified by me on real data (backend restarted with the new code, same throwaway persona `usr_7c9aaa7159d6`, real model, real Chrome)
- Chronological order: `test_Hemoglobin` facts and sources are 15 January 2025 then 20 June 2025; the undated scanned report is last and is never "latest"; the person fact says "(one undated)". PASS.
- Method: scanned pages report `ocr`, text pages `native`; no engine name in any visible text. PASS.
- Advice filter: `cat_Diagnostic_Measurement` now returns `ai` (it was `fallback`); every fallback passes `validate()`, including the "Diagnostic Measurement" label. PASS.
- Fallback sentences read well for test, person, report, date, category, section, chunk and uncertainty nodes. PASS.
- Frontend: the debounce works (re-selecting and dot-hopping send no extra requests; the grid-click test that sent 46 requests before now sends a handful), the box scrolls into view, Sources appear as soon as they arrive, the OCR label logic is in. Build exit 0, audit 0 errors, 24 and 32 backend tests green as reported.

## Still wrong (B = backend, F = frontend)
- **B1. False range claims.** The extractor marks every value `NORMAL` when the report printed no range. The measurement fallback for Weight says "It is inside the printed range on the same page" (there is none) and the AI repeated "which the report flagged as NORMAL". Invented information.
- **B2. The measurement node has no test name.** Fallback reads "One 82.0 kg reading: 82.0 kg, from ...".
- **B3. Evidence windows cut units in half** (`14.1 g/d`), so the safety check rejects good answers ("measurement '14.1g/dl' does not appear"). This is why the person node falls back almost every time (4 of 4 in my runs, and again after the fixes).
- **B4. Empty model replies** (twice live: the person and date nodes) give an instant fallback; one retry is cheap.
- **F1. Dead gap while the AI writes.** After the sources show, nothing says that the AI is working for the next ~6 seconds (the "Reading..." line disappears when the phase becomes `writing`). Seen in a screenshot at t = 3 s.

## Live reliability this round (real model, refresh each time)
cat_Diagnostic_Measurement ai, Weight measurement ai, test_Hemoglobin ai (3 of 3 earlier), person fallback (a unit cut by the window), scanned report fallback (a number without a citation), date node fallback (empty reply). N5 asks for honest 3-run numbers after the fixes.

## Accepted
N3: `_date_key` and chronological handling, `ocr` normalisation, name masking, narrowed advice pattern, per-kind sentences, the 8 new tests. N4: debounce, scroll into view, early sources, OCR check, tidy.

## Notes for the owner
- The model needs about 6 to 12 seconds for its first word; cached summaries are instant.
- A fallback is shown (labelled "Summary from your files") whenever the AI text fails a check. That is by design; N5 reduces the needless ones.


---

# Review of N5 (backend) and N6 (frontend)

Date 2026-10-08, same branch, nothing committed.

## Verified by me
Frontend N6: build exit 0, audit 0 errors, the "Writing the summary from 2 passages..." line is in the screenshot and the sampling table has no dead gap. Backend N5 as reported: 28 node tests, full suite 390 passed (I did not re-run the full suite this time; I re-ran the 37 node + route tests: pass). `.env` unchanged, secret scan PASS.
Real data after N5: evidence windows end on whole lines and the slice invariant holds; measurement label is `Weight 82.0 kg`; no `NORMAL`/`flag`/"inside the printed range" text where there is no range.

## Found (backend, goes to N7)
- **A. New false statement:** `test_Hemoglobin` now says "No printed range was read for this value". Both reports print `Reference range: 12.0 - 15.5 g/dL`; the extractor misses the June one (the range is on its own line). Fix: also read the range from the passage text.
- **B. Empty replies have a root cause:** `finish=length`. The model spends all 600 tokens on hidden reasoning and writes nothing (9 to 11 s wasted, 3 of 3 for the scanned report node). N5's retry with the same budget cannot help. Fix: bigger budget (1600) and a retry with 3200 when `finish=length`.
- **C. `flagged` gated on a range** hides a real text flag: the scanned report's `Vitamin D 18 ng/mL -low` now shows "0 flagged: none" and "none are outside the printed range".

## Accepted
N5 parts 2, 3 and the prompt change; the honest reliability table (N5 did not hide the 0 of 3). N6 entirely.
