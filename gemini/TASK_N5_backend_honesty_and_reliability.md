# SESSION N5 (backend): honest range claims and fewer needless fallbacks

Read `gemini/RULES.md`, `gemini/reviews/N3N4_review.md` (items B1 to B4 are yours), then this file. Same rules as `gemini/TASK_N3_backend_fixes.md` (they still apply): **branch `feature/ai-node-summary`**, **DO NOT COMMIT or stage**, port **8001** (no `--reload`), never print or edit `.env`, never call `/api/ai/privacy` or `/api/ai/config`, throwaway personas only (delete after), never edit an existing test, no provider/model/engine names in visible text. You may change ONLY `vitagraph/backend/app/services/node_summary.py` and `vitagraph/backend/tests/test_node_summary.py`. If something fails 3 times, stop that part and say so.

Start: `git branch --show-current`; `pytest tests/test_node_summary.py -q -p no:cacheprovider` (expect 23 passed).

## Part 1: never claim a printed range that does not exist (B1)
The extractor gives every value `flag = "NORMAL"` when the report printed NO range. Today that becomes false text: the fallback for the Weight value says "It is inside the printed range on the same page", and the AI repeated "which the report flagged as NORMAL". Fix in `gather()` and `compose_fallback()` for kinds `test`, `measurement`, `report`, `category`, `date`:
- A value HAS a printed range only when `reference_range` (or `range_low`/`range_high`) from `measurement_service.list_report_measurements` is present. Only then may the facts or the fallback say "inside / above / below the printed range" or give the range.
- Without a printed range: the fact is `No printed range was read for this value, so it is not compared.` and the word `flag`, `NORMAL` and "inside the printed range" must not appear for it anywhere (facts, fallback, prompt facts). For the `test` kind decide per LATEST DATED value; for `report` "N flagged" counts only values that have a printed range and a non-NORMAL flag.
- Use the neutral wording for facts that have a range: `Printed range: 12.0 - 15.5 g/dL; the latest value is inside it.` (or `above it` / `below it`).

## Part 2: the measurement node needs its test name (B2)
For kind `measurement` the label shown to the model and in the fallback must include the test name: `Weight 82.0 kg` (test node label + the value), not `82.0 kg`. The fallback becomes `One Weight reading: 82.0 kg, from <filename> which is undated [1].` (+ the range sentence ONLY if a printed range exists, + the "up/down from <previous dated date> [2]" sentence only when a previous dated value exists).

## Part 3: evidence windows end on whole lines (B3)
`_source()` currently cuts the passage window at a fixed number of characters, so a unit can be cut in half (`14.1 g/d`), the safety check then says `measurement '14.1g/dl' does not appear in any evidence snippet`, and a perfectly good answer is replaced by the plain fallback (seen live on the person node). Change the window so it starts at the beginning of its line and ends at the end of its line (extend `a` back to just after the previous `\n`, extend `b` forward to the next `\n` or the end of the page), keep the leading/trailing ellipsis rule and exact `hit_start/hit_end`, and cap one window at about 700 characters (if a single line is longer, cut at a space, never inside a token). `page_text[char_start:char_end] == text[hit_start:hit_end]` must stay true for every source.

## Part 4: one retry on an empty reply (B4)
Twice live the model returned nothing (`validate` reason `empty`, zero `text_delta`). In `stream()`: if the first call produced no text at all (nothing was streamed), call the model ONE more time with the same messages; if that is empty too, fall back as today. Write one `ai_calls` audit row per attempt. Do NOT retry for other validation failures (that would add 7 s for nothing).

## Part 5: prompt (small)
Add to the rules line of `SYSTEM_PROMPT`: `Quote a number only together with its unit, written exactly as in a passage. Put [n] after every clause that contains a number, not once at the end of a list. If a value has no printed range, say nothing about a range.` Keep `Never name a scanning engine.`

## Part 6: tests (new tests only)
1. A value with no printed range (monkeypatch `measurement_service.list_report_measurements` or use the scanned sample's Weight): facts and fallback contain `No printed range` and contain none of `NORMAL`, `flag`, `inside the printed range`.
2. A value with a range keeps the range sentence.
3. The measurement fallback starts `One Weight reading: 82.0 kg` (label includes the test name).
4. For every source of the persona's person, report, date, category and test nodes: the window starts at a line start (or page start) and ends at a line end (or page end), `page_text[char_start:char_end] == text[hit_start:hit_end]`, and no window cuts a unit: for each source, every `\d+(\.\d+)?\s?(g/dL|mg/dL|ng/mL|%|kg)` that touches the end of `text` is complete (construct a page where the old window would have cut `14.1 g/dL` after `14.1 g/d`).
5. Retry: fake model returns empty the first time and text the second: `completed` status `ai`, model called twice, two audit rows; returns empty twice: status `fallback`, called twice; returns bad text (an invented number) once: NOT retried (called once).

## Part 7: measure the reliability (honest numbers)
Port 8001, throwaway persona with the three sample PDFs (`vitagraph/sample_data/`). For each of these nodes call the stream with `"refresh": true` THREE times and record the final `status` of each call and, for every `fallback`, the `ai_calls.error` text: `test_Hemoglobin`, `test_Vitamin_D...` (use the real id from the graph), the Weight measurement, the person node, the scanned report node, `date_Unknown_Date`, `cat_Diagnostic_Measurement`. Paste a table (node, ai/fallback counts, reasons). Target: test, measurement and category nodes 3 of 3 `ai`; person, report and date nodes at least 2 of 3. If you do not reach it, do NOT fake it: report the real table and your best guess why.

## Part 8: verify and clean up
Full suite once (expect 385 + new tests, nothing else changed); delete your persona; stop port 8001; `.env` unchanged; nothing staged. Write `gemini/reports/N5_summary.md` (short, not committed) and reply with the RULES.md section 5 report.

## Acceptance
- [ ] Parts 1 to 5 done in the two allowed files; Part 6 tests added and green; full suite count stated.
- [ ] The printed facts/fallback of the Weight value contain `No printed range` and no `NORMAL`/`flag`.
- [ ] Windows end on whole lines (test 4 green).
- [ ] The Part 7 table is in the summary, with real numbers.
- [ ] Nothing committed or staged; persona deleted; port 8001 stopped.
