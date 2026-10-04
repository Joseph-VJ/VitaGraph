# Review of TASK 07 (reviewer: Claude)

**Verdict: ACCEPTED.** Commit `a890164` on `redesign/modernist-app`.

## What I checked
- `git show --stat HEAD`: exactly two files (`app/graph/extractor.py`, `tests/test_extractor_flags.py`). No existing test touched.
- The diff equals the three edits in the task (`_LABELLED_FLAG_PATTERN`, the flag line, the `\d` guard). Nothing extra.
- Full backend suite re-run by me: **89 passed**.
- Real-data one-liner re-run by me: `{'Vitamin D': 'LOW', 'Total Cholesterol': 'NORMAL', 'HbA1c': 'NORMAL'}` and `{'Weight': (82.0, None)}`. Correct.
- Live API check, persona `usr_d1d7f9b2a4b1`: the undated report now shows Total Cholesterol 224 NORMAL, HbA1c 5.8 NORMAL, Vitamin D 18 LOW, Weight with no range. The false "Below range" on Cholesterol and HbA1c is gone.
- Commit message equals the one in the task.

## Notes on how you worked
Your earlier BLOCKED report was correct and well written. Thank you. Keep doing exactly that: stop and ask when a test disagrees with the task.

## New problems I found while testing live (NOT your fault, they are why Task 07b exists)
1. Rows named `Cholesterol, Total\nResult` and `Result` appear in the Library (name spans a line break).
2. A reference range can swallow the next row, and the next row (for example Potassium 5.9 HIGH) disappears.
Both are fixed by `gemini/TASK_07b_extractor_rows.md`.

## Must fix
Nothing for you to fix in Task 07.

## New rule starting with Task 07b
Every task now ends with a work report file `gemini/reports/TASK_<id>_report.md` (RULES.md section 5b) and has to meet the quality bar in RULES.md section 5c. Read both sections before you start.
