# SESSION N3 (backend fixes): after the review of N1

Read `gemini/RULES.md`, then `gemini/reviews/N1N2_review.md` (items 1 to 5 are yours), then this file. Same rules as `gemini/TASK_N1_backend_node_summary.md` (the overrides there still apply): **branch `feature/ai-node-summary`**, **DO NOT COMMIT or stage**, port **8001** for any server you start (no `--reload`), never print or edit `.env`, never call `/api/ai/privacy` or `/api/ai/config`, throwaway personas only (delete them after), never edit an existing test, no provider/model names in visible text. You may change ONLY `vitagraph/backend/app/services/node_summary.py` and `vitagraph/backend/tests/test_node_summary.py`. If something fails 3 times, stop that part and say so.

Start: `git branch --show-current`; run `pytest tests/test_node_summary.py -q -p no:cacheprovider` (24 with the route tests: expect your 15 passed).

## Part 1: real chronological order (review item 1)
Add one pure helper and use it EVERYWHERE dates are compared or sorted:
```python
def _date_key(value: str | None) -> tuple[int, str]:
    """Sort key for a printed report date: dated reports in time order, undated ones last."""
```
- Parse these shapes (try in this order, `datetime.strptime`, strip and collapse spaces first): `%d %B %Y` (`15 January 2025`), `%d %b %Y`, `%B %d, %Y`, `%b %d, %Y`, `%Y-%m-%d`, `%d/%m/%Y`, `%d-%m-%Y`. Result `(0, "2025-01-15")` (ISO string); unparseable or `None` or `"Unknown Date"` -> `(1, "")`.
- `_reports()`: build the dict ordered by `_date_key(report_date)`, then `upload_time` (drop the SQL `ORDER BY report_date`).
- Everywhere in `gather()` that says "oldest first", "latest", "earlier", `min()/max()` of dates, or compares dates with `<`: use `_date_key`. Undated reports come last and are NEVER called the latest or the oldest: in the `test` branch put them in the facts as "Undated report: 14.2 g/dL." after the dated values, and take "latest" only from dated ones (if none are dated, say nothing about latest). In the `person` branch the range is "from <first dated> to <last dated>" (omit when fewer than two dated reports) and add "N undated" if any. In the `measurement` branch "Previous value" = the nearest EARLIER DATED report by `_date_key`; no previous value when this one is undated.
- Facts text and sources must be in the same chronological order (source `[1]` is the oldest dated one).

## Part 2: engine names (item 2)
In `_source()` normalise `Source.method`: any value starting with `ocr` becomes `"ocr"`; keep `native` and `failed`; anything else `native`. In facts and text never write an engine name: the uncertainty fact becomes `"This passage is on a scanned page read by OCR."` (or `"... on a page with a text layer."`) instead of "read as 'ocr-rapid'". In `build_messages` the `' · read by OCR'` tag now works because the value is `ocr`.

## Part 3: advice filter must not reject names (item 3)
- Narrow the pattern: replace `diagnos\w*` with `diagnos(?:e|es|ed|is|ing)\b` (so "Diagnostics" and "Diagnostic" pass) and replace `treat(?:ment|ed|ing)?` with `treat(?:ed|ing)?\b` plus the exact phrases `treatment plan for you` is NOT needed: keep `\btreatment\b` OUT of the list. Keep `you should|you must|you need to|we recommend|i recommend|recommended|consult|see a doctor|stop taking|start taking|dose|dosage|prescri\w*`.
- Before running `_ADVICE` (and before `safety.check_answer_safety`), mask the proper names that legitimately appear: remove from the text every occurrence (case-insensitive) of `ev.label`, every `Source.filename`, and every section/test/category name in `ev.facts` that is quoted from the graph. Do the masking on a COPY used only for the checks; the returned text is untouched.
- `compose_fallback(ev)` must pass `validate()` for a label like `Diagnostic Measurement`, `Riverdale Diagnostics`, `Treatment plan`.

## Part 4: fallback sentences (item 4)
Implement step 2 of `design/prototypes/VitaGraph-AI-Node-Summary.md` section 3.7: one template per node kind, plain words, correct grammar (a/an), citations `[n]` right after the numbers they support, no engine or database words, no "is a person found in N of your files". Each template must still pass `validate()` and may use ONLY facts and sources from `gather()`. Required results (use exactly this wording for these cases, adapt only the values):
- test, 2 dated values: `Hemoglobin is measured in 2 of your 3 files. It went from 13.8 g/dL on 15 January 2025 [1] to 14.1 g/dL on 20 June 2025 [2].` (+ ` The latest value is inside the printed range.` / ` ... above the printed range of <range>.` / ` ... below ...` only when `flag`/range is known)
- test, one dated and one undated: `... It is 13.8 g/dL on 15 January 2025 [1] and 14.2 g/dL in an undated report [2].` (never "latest" for the undated one)
- measurement: `One Hemoglobin reading: 13.8 g/dL, from synthetic_panel_2025-01-15.pdf dated 15 January 2025 [1]. It is inside the printed range of 12.0 - 15.5 g/dL on the same page.` (+ ` It is up 0.3 g/dL from 15 January 2025 [2].` only when a previous dated value exists)
- person: `<persona label> has 3 files, from 15 January 2025 to 20 June 2025 (one undated) [1][2][3].` (omit the range when fewer than two dated files)
- report: `<filename> is a scanned PDF, read by OCR, dated 15 January 2025 [1]. It holds 4 values; 1 is outside the printed range: Vitamin D [2].` (kind word from the page methods: "PDF with a text layer" / "scanned PDF, read by OCR"; "undated" instead of the date when there is none)
- date: `15 January 2025 is the date of 1 of your files: <filename> [1].` For `Unknown Date`: `These files have no printed date: <filenames> [1].`
- section: `<name> is a section of <filename> [1]. It holds <n> values: <tests>.` (no values: `... No lab values were read from it.`)
- category: `<name> is a group of tests. In your files it holds: <tests> [1][2].`
- chunk: `This is a passage from page 1 of <filename> [1].`
- uncertainty: `This passage of <filename> (page 1) [1] had no lab values that could be read from it, so nothing from it is used in answers or in the values in this graph. A person should look at the page.`
- No sources at all: `<label> is in your graph, but no passage of your files mentions it directly.` (no digits from the label: strip them as today).
Keep the AI prompt as it is, except add to the rules line: "Never name a scanning engine." and update the facts you give the model to the new wording.

## Part 5: tests that would have caught the defects (item 5)
Add to `tests/test_node_summary.py` (new tests only, do not edit the 15; keep them fast and offline):
1. `_date_key` ordering: `["02 October 2025", "20 June 2025", "15 January 2025", None, "Unknown Date", "01 December 2024"]` sorted by key = `01 December 2024, 15 January 2025, 20 June 2025, 02 October 2025, None, Unknown Date` (the last two in any order).
2. `gather()` on a persona with the two sample PDFs after `UPDATE reports SET report_date = ...` to `02 October 2025` and `20 June 2025`: the `test_Hemoglobin` facts list the June value BEFORE the October value, and source `[1]` is the June report.
3. An undated report is never "latest": persona with one dated and one undated report: the test facts contain "Undated report" and the "latest" wording only for the dated value; the person fact has no range when only one report is dated.
4. `_source()` turns `ocr-rapid` and `ocr-tesseract` into `ocr` (insert a `report_pages` row or monkeypatch `_page`).
5. `validate()` accepts `"Riverdale Diagnostics reports Hemoglobin of **13.8 g/dL** [1]."` when `ev` has that filename or label, still rejects `"You should take iron [1]."`, `"This points to a diagnosis of anemia [1]."` and `"Consult a doctor [1]."`.
6. `compose_fallback` + `validate` for a node whose label is `Diagnostic Measurement` and one called `Treatment plan`.
7. Each fallback template in Part 4 (one assertion per kind on the exact sentence start and on `validate(...)[0] is True`), using small hand-built `NodeEvidence` objects.
8. No fallback or fact contains `rapid`, `tesseract` or `ocr-`.

## Part 6: verify (port 8001, throwaway persona, then delete it)
1. `pytest tests/test_node_summary.py -q -p no:cacheprovider` all green; then the FULL suite once (expect 377 + your new tests, nothing else changed).
2. Persona with the three sample PDFs (`vitagraph/sample_data/`: the scanned Report4, `synthetic_panel_2025-01-15.pdf`, `synthetic_panel_2025-06-20.pdf`). Print `gather()` facts and fallback for: `test_Hemoglobin`, the person node, a report node, the `date_Unknown_Date` node, the category node (`cat_Diagnostic_Measurement` on the scanned report), an uncertainty node, a measurement node. Paste them in your summary and show that: order is chronological, undated is last and never "latest", methods are `ocr`/`native`, the sentences read like Part 4, and every fallback passes `validate()`.
3. Live SSE (curl with a JSON file) on the person node, the category node, a report node and `test_Hemoglobin` with the real model: report the final `status` of each. At least the person, report and category nodes must now be `ai`, not `fallback` (a real model answer can still fail a check now and then: if one is `fallback`, call it again with `"refresh": true` and report both results and the `ai_calls.error` reason).
4. Delete the persona; stop port 8001; confirm `.env` unchanged and nothing staged.

## Acceptance
- [ ] Parts 1 to 5 done in the two allowed files only; tests added and green; full suite count stated.
- [ ] The printed output of Part 6.2 proves chronological order, undated handling, `ocr` method and the new sentences.
- [ ] Live results of 6.3 reported.
- [ ] Nothing committed or staged; throwaway persona deleted; port 8001 stopped.

Finish with `gemini/reports/N3_summary.md` (short, not committed) and the RULES.md section 5 report.
