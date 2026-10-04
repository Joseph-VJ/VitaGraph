# TASK 07b: extractor rows must not span lines (backend micro-fix, second part of Task 07)

Read `gemini/RULES.md` first (branch guard 3b, report format 5, **work report file 5b**, **quality bar 5c** all apply). This is the second and last backend micro-fix. It is the ONLY other exception to the "do not touch the backend" rule, together with Task 07.

Before you start: if `gemini/reviews/TASK_07_review.md` exists, read it and obey it.

## Why (real bugs, found by the reviewer on live data, all reproduced)
The generic row pattern `_GENERIC_ROW_PATTERN` in `vitagraph/backend/app/graph/extractor.py` uses `\s` inside the test-name group and inside the reference-range group. `\s` also matches a line break, so:
1. **Junk rows with a line break in the name.** For a report that prints `Cholesterol, Total` on one line and `Result 198 mg/dL` on the next, the Library showed an extra row called `Cholesterol, Total\nResult` and another row simply called `Result` (for TSH). They duplicate real tests.
2. **A reference range swallows the next row.** `Serum Glucose: 94 mg/dL 70 - 99` followed by `Weight: 82 kg` gave the range `70 - 99\nWeight`, and the `Weight` row VANISHED (the match consumed it). Same for bullet lists: `- Sodium: 140 mmol/L 135 - 145` followed by `- Potassium: 5.9 mmol/L 3.5 - 5.1` lost Potassium (a HIGH value!) completely. This is silent data loss in a health app, so it must be fixed.
3. A line that starts with the bare word `Result:` or `Value:` is a label, not a test name.

## Files you may change (closed list)
1. `vitagraph/backend/app/graph/extractor.py` (two small edits, below)
2. NEW `vitagraph/backend/tests/test_extractor_rows.py`
3. NEW `gemini/reports/TASK_07b_report.md` (your work report, see RULES 5b)
4. screenshots are not needed for this task

Never edit an existing test. Never edit anything else.

## Step 0: guard and baseline
```
git branch --show-current
```
Must print `redesign/modernist-app`. Then:
```
cd "F:\kiruthika\kiruthika final project\vitagraph\backend"
.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
```
Must end with `89 passed`. If not, STOP, write the report file (BLOCKED) and stop.

## Step 1: write the tests FIRST
Create `vitagraph/backend/tests/test_extractor_rows.py` with exactly this content:
```python
"""Generic rows must stay on one line: no line break in a name, no range that eats the next row."""

from __future__ import annotations

from app.graph.extractor import extract_entities_from_chunk


def _by_name(text: str) -> dict[str, dict]:
    ents = extract_entities_from_chunk(text, chunk_id="c1", report_id="r1", page_number=1, date="2024-11-01")
    return {e["test_name"]: e for e in ents}


def test_a_test_name_never_contains_a_line_break():
    by = _by_name("Cholesterol, Total\nResult 198 mg/dL\n\nTSH\nResult 2.1 uIU/mL\n")
    assert set(by) == {"Total Cholesterol", "TSH"}


def test_a_reference_range_does_not_swallow_the_next_row():
    by = _by_name("Serum Glucose: 94 mg/dL 70 - 99\nWeight: 82 kg Height: 172 cm BMI: 27.7\n")
    assert by["Serum Glucose"]["reference_range"] == "70 - 99"
    assert by["Weight"]["value"] == 82.0


def test_the_words_result_and_value_are_labels_not_tests():
    by = _by_name("Result: 5.1 mg/dL\nValue: 3 mg/dL\n")
    assert by == {}


def test_bullet_rows_keep_their_own_range_and_flag():
    by = _by_name("- Sodium: 140 mmol/L 135 - 145\n- Potassium: 5.9 mmol/L 3.5 - 5.1\n")
    assert by["Sodium"]["reference_range"] == "135 - 145"
    assert by["Potassium"]["value"] == 5.9
    assert by["Potassium"]["reference_range"] == "3.5 - 5.1"
    assert by["Potassium"]["flag"] == "HIGH"
```
Run only this file:
```
.venv\Scripts\python.exe -m pytest tests/test_extractor_rows.py -q -p no:cacheprovider
```
Expected: **4 failed** (all four, because the bugs exist). Paste the last 12 lines. If any of the four PASSES now, STOP and report BLOCKED (the bug is not what the reviewer thinks).

## Step 2: the two edits in `vitagraph/backend/app/graph/extractor.py`

### Edit D: the regex (one line; replace the whole `r"..."` line inside `_GENERIC_ROW_PATTERN`)
Find this line (inside `_GENERIC_ROW_PATTERN = re.compile(`, it is the only line there that starts with `r"^\s*[-*•]?`):
```python
    r"^\s*[-*•]?\s*([A-Za-z][A-Za-z0-9\s,\-_()]{2,32}?)\s*[:=\t\s]\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%μuIU]+(?:/[a-zA-Z]+)?)\b(?:\s*([0-9.<>\s\-–—]+(?:\s*[a-zA-Z/%μuIU]+)?))?(?:\s*[-–—]?\s*(LOW|HIGH|NORMAL|ABNORMAL|CRITICAL|low|high|normal))?",
```
Replace it with exactly this line (same indentation, still followed by the existing `re.MULTILINE | re.IGNORECASE,` line):
```python
    r"^\s*[-*•]?\s*([A-Za-z][A-Za-z0-9 \t,\-_()]{2,32}?)\s*[:=\t\s]\s*([0-9]+(?:\.[0-9]+)?)[ \t]*([a-zA-Z/%μuIU]+(?:/[a-zA-Z]+)?)\b(?:[ \t]*([0-9.<>\-–— \t]+(?:[ \t]*[a-zA-Z/%μuIU]+)?))?(?:[ \t]*[-–—]?[ \t]*(LOW|HIGH|NORMAL|ABNORMAL|CRITICAL|low|high|normal))?",
```
What changed (so you can check yourself): in the name group `\s` became ` \t`; after the number `\s*` became `[ \t]*`; in the range group `\s` became ` \t` and its inner `\s*` became `[ \t]*`; in the flag group both `\s*` became `[ \t]*`. The leading `^\s*[-*•]?\s*` and the separator `\s*[:=\t\s]\s*` stay exactly as they were.

### Edit E: label words are not tests
In the same file, in the loop `for match in _GENERIC_ROW_PATTERN.finditer(chunk_text):`, find this line:
```python
        clean_key = re.sub(r"[^a-z0-9]", "", low_name)
```
Add these two lines directly BELOW it (same indentation):
```python
        if clean_key in {"result", "results", "value", "values", "range"}:
            continue
```
Nothing else in the file changes.

## Step 3: verify
1. The new file: `.venv\Scripts\python.exe -m pytest tests/test_extractor_rows.py -q -p no:cacheprovider` must print `4 passed`.
2. The earlier extractor tests: `.venv\Scripts\python.exe -m pytest tests/test_extractor_flags.py -q -p no:cacheprovider` must print `4 passed`.
3. The whole suite: `.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider` must end with `93 passed` (89 + 4 new). Paste the last line. If ANY existing test fails: do NOT edit that test. Undo only Edit D or Edit E (whichever caused it) with `git checkout -- vitagraph/backend/app/graph/extractor.py`, STOP, write the report (BLOCKED) with the failing test name and its output.
4. Real-data check (one command, from `vitagraph/backend`):
```
.venv\Scripts\python.exe -c "from app.graph.extractor import extract_entities_from_chunk as x; t='Serum Glucose: 94 mg/dL 70 - 99\nWeight: 82 kg Height: 172 cm BMI: 27.7\n'; print([(e['test_name'],e['value'],e['reference_range']) for e in x(t,'c','r',1,None)])"
```
Expected exactly: `[('Serum Glucose', 94.0, '70 - 99'), ('Weight', 82.0, None)]`
5. Live check against the real database (this proves the Library data is clean). Start the backend (`.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`, in the background), wait 10 seconds, then run:
```
.venv\Scripts\python.exe -c "import json,urllib.request as u; rs=json.load(u.urlopen('http://127.0.0.1:8000/api/reports?user_id=usr_d1d7f9b2a4b1')); [print(r.get('filename'), [(m['test_name'],m['value']) for m in json.load(u.urlopen('http://127.0.0.1:8000/api/reports/%s/measurements'%(r.get('report_id') or r.get('id'))))]) for r in rs]"
```
Expected: in NONE of the three lists does a test name contain a line break, and no row is named `Result`. Each dated report shows `Hemoglobin`, `Total Cholesterol` (once), `TSH` (once). Paste the output. Then STOP the backend (PowerShell: `Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`).

## Step 4: write the work report file
Write `gemini/reports/TASK_07b_report.md` using the nine headings in RULES 5b. Section 4 must contain the real output of every command above. Section 6 must say honestly whether the live check showed anything else that looks wrong (for example a value that differs from what a human reading the PDF would expect). Do not fix anything extra; just report it.

## COMMIT
Stage ONLY these three paths, by explicit path:
```
git add vitagraph/backend/app/graph/extractor.py vitagraph/backend/tests/test_extractor_rows.py gemini/reports/TASK_07b_report.md
git commit -m "fix(backend): extractor rows must not span lines"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```
`git show --stat HEAD` must list exactly those three files.

## ACCEPTANCE (PASS/FAIL each with evidence)
- All four new tests failed before the edits and pass after.
- Full suite `93 passed`; no existing test file changed.
- Real-data command prints exactly the expected list.
- Live check: no test name with a line break, no `Result` row, Total Cholesterol and TSH appear once per dated report.
- Backend stopped afterwards.
- `gemini/reports/TASK_07b_report.md` exists, has all nine headings, and is in the commit.
- Branch is `redesign/modernist-app`; `git show --stat HEAD` lists only the three files.
