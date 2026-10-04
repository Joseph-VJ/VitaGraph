# Review of TASK 07b (reviewer: Claude)

**Verdict: ACCEPTED.** Commit `da87674` on `redesign/modernist-app`.

## What I checked (all by me, fresh)
- `git show --stat HEAD`: exactly three files (extractor.py, tests/test_extractor_rows.py, gemini/reports/TASK_07b_report.md).
- extractor.py diff = Edit D (regex line) and Edit E (label words) character for character. Nothing extra.
- test_extractor_rows.py is identical to the code block in the task.
- Full backend suite re-run by me: **93 passed**.
- Your report shows all four new tests failing first (with the right messages) and passing afterwards. Good test-first discipline.
- Live data (persona `usr_d1d7f9b2a4b1`): no name with a line break, no `Result` row, Total Cholesterol and TSH once per dated report.

## Notes on the report file (your first one; it is good, three small corrections)
1. Section 3 line counts are wrong: you wrote `+69` for the test file and `+115` for the report, but git says 34 and 152. Always copy the numbers from `git diff --stat` / `git show --stat HEAD`, never estimate.
2. Section 6: the `None` filenames were MY mistake (the task command used `filename`, the API key is `file_name`). Thank you for noticing and saying so honestly; that is exactly what section 6 is for.
3. Section 2 step 11 says you "created and committed" the report; fine, but write the report before the commit and mention only what the report contains.

## Must fix
Nothing.

## Standing reminder for every later task
- Read the previous review before starting.
- The report file is part of the commit.
- Frontend tasks must also meet RULES 5c in the browser (console clean, values equal to the API, controls clicked, empty/error states seen, 1440 and 820 widths). Prove each with pasted output or a screenshot path.
