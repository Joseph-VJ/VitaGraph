# SESSION N7 (backend, last round): ranges from the passage text, and the empty replies

Read `gemini/RULES.md`, then this file. Same rules as `gemini/TASK_N5_backend_honesty_and_reliability.md` (they still apply): **branch `feature/ai-node-summary`**, **DO NOT COMMIT or stage**, port **8001** (no `--reload`; my own backend is on 8000, do not touch it), never print or edit `.env`, never call `/api/ai/privacy` or `/api/ai/config`, throwaway personas only (delete after), never edit an existing test, do not touch persona `usr_7c9aaa7159d6`, no provider/model/engine names in visible text. You may change ONLY `vitagraph/backend/app/services/node_summary.py` and `vitagraph/backend/tests/test_node_summary.py`. If something fails 3 times, stop that part and say so.

Start: `git branch --show-current`; `pytest tests/test_node_summary.py -q -p no:cacheprovider` (expect 28 passed).

## What the reviewer found (real data, 2026-10-08; all reproduced, you can reproduce them too)
**A. N5 made `test_Hemoglobin` say something false.** Facts now read `No printed range was read for this value, so it is not compared.` for Hemoglobin. But BOTH sample reports print the range (`Reference range: 12.0 - 15.5 g/dL`). `measurement_service.list_report_measurements` returns the range for the January report and `None` for the June report, because in the June PDF the range sits on its own line: `Hemoglobin\nResult: 14.1 g/dL\nReference range: 12.0 - 15.5 g/dL\n...`. The extractor is not to be changed. The summary therefore contradicts the passages the model is shown.
**B. The empty replies are NOT a model glitch.** Calling the model directly for the scanned-report node returns `chunks=1 text_len=0 finish=length` three times in a row, 9 to 11 seconds each: the model used all of `MAX_TOKENS = 600` for hidden reasoning and wrote nothing (the budget counts reasoning). The retry with the same budget fails the same way, so N5's retry doubles the wait and fixes nothing. That is why the scanned report node was 0 of 3 and the person/date nodes also showed `empty`.
**C. "flagged" is gated on a printed range, but a flag can come straight from the text.** The scanned report prints `Vitamin D 18 ng/mL -low` with no numeric range; the extractor flags it LOW, and the report fact now says `4 values found; 0 flagged: none.` and the fallback `none are outside the printed range`, which is wrong and misleading.

## Part 1: read the printed range from the passage itself (A)
In `gather()` for kinds `test`, `measurement` (and wherever `_has_range` decides a claim):
- A value HAS a printed range if either the extractor row has one OR the source window text right after the value contains one. Write `_range_from_text(text: str, hit_end: int) -> str | None`: look at the next 160 characters after `hit_end` (same window text) for `(?:reference range|ref\.?\s*range|ref\.?|normal range)\s*[:\-]?\s*([<>≤≥]?\s*\d+(?:\.\d+)?(?:\s*[-–to]+\s*\d+(?:\.\d+)?)?)\s*([A-Za-z%/]+(?:/[A-Za-z]+)?)?` (case-insensitive); return the matched range text (for example `12.0 - 15.5 g/dL`) or `None`. Use `measurement_service.parse_range` on the numeric part to get low/high.
- The range is shown and compared ONLY if it comes from the extractor or from this text match, so it is always real printed text. The facts then say `Printed range (<date>): 12.0 - 15.5 g/dL.` per value where known, and `The latest value is inside / above / below it.` only when the latest dated value itself has the range; if only an older report shows the range, say `Printed range (15 January 2025 report): 12.0 - 15.5 g/dL.` and do NOT compare the newer value in Python (the model may compare from its passages).
- Only if no value has a range anywhere do the facts say `No printed range was read for this value, so it is not compared.`
- The fallback for the `test` kind keeps the range sentence in the same way (`... The latest value is inside the printed range of 12.0 - 15.5 g/dL.`).

## Part 2: the token budget (B)
- Raise the first attempt to `MAX_TOKENS = 1600`. Read `finish_reason` from the stream chunks (`chunk.choices[0].finish_reason`).
- Retry rule (replace N5's): retry ONCE only when nothing was streamed (empty). If `finish_reason == "length"` retry with `max_tokens = 3200`; for any other empty reply retry with the same budget. Never retry after text was streamed. One `ai_calls` audit row per attempt (status `empty` / `error` text such as `empty (finish=length)`).
- After the change run the direct-call experiment for the scanned report node 3 times and paste `seconds`, `text_len`, `finish` for each (the reviewer saw 3 failures, 9 to 11 s each, before the change). Expected: text appears.
- Keep `reasoning_effort: "minimal"` and the `NodeSummary` prompt as is.

## Part 3: flags from the text (C)
- `report` kind: `flagged` = values whose `flag` is not `NORMAL` (HIGH, LOW, CRITICAL, ABNORMAL), regardless of printed range (a flag only exists when the text printed one). Fact: `4 values found; 1 marked low: Vitamin D.` / `... 2 marked high or low: A, B.` / `... none marked high or low.`
- Fallback wording follows: `It holds 4 values; 1 is marked low: Vitamin D [2].` / `... none is marked high or low.` The words `outside the printed range` are used ONLY for values that have a printed range.
- `test` and `measurement` kinds: say `marked low` / `marked high` when the extractor flag says so, even without a numeric range, never `NORMAL`.

## Part 4: tests (new only)
1. `_range_from_text` finds `12.0 - 15.5 g/dL` in `"Hemoglobin\nResult: 14.1 g/dL\nReference range: 12.0 - 15.5 g/dL\nVitamin D"` after the value, and returns `None` for `"Weight: 82 kg Height: 172 cm"` and for a range that belongs to the NEXT test (`"Result: 14.1 g/dL\nVitamin D, 25-Hydroxy\nResult: 34 ng/mL\nReference range: 30 - 100 ng/mL"`: it must not pick the Vitamin D range for hemoglobin; stop at a line that starts a new test name or at a blank line).
2. `gather()` for `test_Hemoglobin` on the two-PDF persona states the printed range `12.0 - 15.5` in its facts (even though the June row has none) and does not contain `No printed range`.
3. A node with no range anywhere still says `No printed range was read`.
4. Report with `Vitamin D -low` and no range: facts say `1 marked low: Vitamin D`, fallback contains `marked low` and not `outside the printed range`.
5. Retry: first reply empty with `finish_reason="length"` then text: second call used `max_tokens=3200`; first reply empty with another reason: second call used the same budget; text streamed then error: NOT retried; two empties: `fallback`, two audit rows.
6. Existing tests stay green.

## Part 5: verify
1. `pytest tests/test_node_summary.py -q -p no:cacheprovider`; full suite once (expect 390 + new).
2. Port 8001, throwaway persona with the three sample PDFs: print facts + fallback for `test_Hemoglobin` (range present), the Weight measurement (no range), the scanned report (marked low), `cat_Diagnostic_Measurement`.
3. Part 2's direct-call experiment (3 runs) for the scanned report node, and then the reliability table: each of `test_Hemoglobin`, the Vitamin D test, the Weight measurement, the person node, the scanned report node, `date_Unknown_Date`, `cat_Diagnostic_Measurement` with `"refresh": true` THREE times: ai/fallback counts, reasons from `ai_calls.error`, and the seconds to the final `completed`. Real numbers only.
4. Delete your persona; stop port 8001; `.env` unchanged; nothing staged.

Write `gemini/reports/N7_summary.md` (short, not committed) and reply with the RULES.md section 5 report.

## Acceptance
- [ ] `test_Hemoglobin` facts state the printed range; no false "No printed range" anywhere on the sample data.
- [ ] Empty replies fixed at the root (budget); direct-call numbers pasted.
- [ ] Report/test/measurement wording uses "marked low/high" for text flags.
- [ ] New tests green; full suite count stated; nothing committed or staged; persona deleted; port 8001 stopped.
