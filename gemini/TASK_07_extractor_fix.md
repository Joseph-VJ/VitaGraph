# TASK 07: fix two wrong-value bugs in the report extractor (BACKEND, tiny, test-first)

Read `gemini/RULES.md` first (branch guard 3b applies). This task is the ONLY exception to the rule "never touch `vitagraph/backend`". You may change exactly these two files and no others:
1. `vitagraph/backend/app/graph/extractor.py` (three small edits)
2. `vitagraph/backend/tests/test_extractor_flags.py` (NEW file)
You must NOT edit any existing test file, `site design/`, or anything else.

## Why this matters
Task 06 showed a real health-data error. On a scanned lab note the Library showed **Total Cholesterol 224 mg/dL and HbA1c 5.8 % as "Below range"**, and **Weight 82 kg with the reference range "Height"**. Cause, confirmed by running the extractor on the text:
- Bug 1 (flag bleed): after a test name the extractor looks for a flag word (`LOW`, `HIGH`, ...) in the rest of the block, so the `-low` printed after the NEXT line (`Vitamin D: 18 ng/mL -low`) is wrongly attached to the tests above it.
- Bug 2 (range from a word): the generic row pattern captures any trailing letters as a "reference range", so `Weight: 82 kg Height: 172 cm` produces the range `Height`.
A wrong LOW flag on a normal value is misleading in a health product, so both must be fixed exactly as below, nothing more.

## STEP 0: branch guard and baseline
```
git branch --show-current          # redesign/modernist-app
cd "F:\kiruthika\kiruthika final project\vitagraph\backend"
.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
```
Must end with `85 passed` (paste the last line). If not, STOP and report BLOCKED.

## STEP 1: write the tests first
Create `vitagraph/backend/tests/test_extractor_flags.py` with exactly this content:
```python
"""Extractor must not attach a flag or a reference range that belongs to somewhere else."""

from __future__ import annotations

from app.graph.extractor import extract_entities_from_chunk


def _by_name(text: str) -> dict[str, dict]:
    ents = extract_entities_from_chunk(text, chunk_id="c1", report_id="r1", page_number=1, date="2024-11-01")
    return {e["test_name"]: e for e in ents}


def test_flag_word_on_the_next_line_is_not_attached_to_earlier_tests():
    by = _by_name("Lab Values:\n- HbA1c: 5.8 %\n- Total Cholesterol: 224 mg/dL\n- Vitamin D: 18 ng/mL -low\n")
    assert by["Vitamin D"]["flag"] == "LOW"          # the flag printed on its own line still counts
    assert by["HbA1c"]["flag"] == "NORMAL"
    assert by["Total Cholesterol"]["flag"] == "NORMAL"


def test_labelled_flag_on_a_following_line_still_counts():
    by = _by_name("Hemoglobin\nResult: 9.1 g/dL\nReference range: 13.0 - 17.0\nFlag: LOW\n")
    assert by["Hemoglobin"]["flag"] == "LOW"
    assert by["Hemoglobin"]["reference_range"] == "13.0 - 17.0"


def test_reference_range_must_contain_a_number():
    by = _by_name("Weight: 82 kg Height: 172 cm BMI: 27.7\n")
    assert by["Weight"]["value"] == 82.0
    assert by["Weight"]["reference_range"] is None


def test_a_real_inline_range_is_kept():
    # Not a canonical test, so it goes through the generic row pattern that Edit C touches.
    by = _by_name("Serum Glucose: 94 mg/dL 70 - 99\n")
    assert by["Serum Glucose"]["value"] == 94.0
    assert by["Serum Glucose"]["reference_range"] == "70 - 99"
```
Run only this file now and paste the result. The first and third tests MUST FAIL right now (that proves the bugs). The second and fourth should pass.
```
.venv\Scripts\python.exe -m pytest tests/test_extractor_flags.py -q -p no:cacheprovider
```

## STEP 2: the three edits in `app/graph/extractor.py`
Edit A. Directly under the existing definition of `_FLAG_PATTERN` (the `re.compile(...)` that ends with `re.IGNORECASE,\n)`), add:
```python
# A flag on a LATER line only counts when it is labelled ("Flag: LOW"); a bare "-low" belongs to its own line.
_LABELLED_FLAG_PATTERN = re.compile(
    r"^[ \t]*(?:Flag|Status|Interpretation)[ \t]*:[ \t]*(LOW|HIGH|NORMAL|ABNORMAL|CRITICAL)",
    re.IGNORECASE | re.MULTILINE,
)
```
Edit B. Find this exact line inside `extract_entities_from_chunk`:
```python
        flag_match = _FLAG_PATTERN.search(first_line) or _FLAG_PATTERN.search(sub)
```
and replace it with:
```python
        flag_match = _FLAG_PATTERN.search(first_line) or _LABELLED_FLAG_PATTERN.search(sub)
```
Edit C. Find this exact line in the "Generic measurement fallback" loop:
```python
        ref_r = match.group(4).strip() if match.group(4) else None
```
and add directly after it:
```python
        if ref_r and not re.search(r"\d", ref_r):
            ref_r = None  # a reference range always contains a number; trailing words are not a range
```
Do not change anything else in the file.

## STEP 3: verify
1. `.venv\Scripts\python.exe -m pytest tests/test_extractor_flags.py -q -p no:cacheprovider` must show `4 passed`.
2. The whole suite: `.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider` must end with `89 passed` (85 before + 4 new). Paste the last line. If ANY existing test fails: do NOT edit that test. Undo only Edit B or Edit C (whichever caused it) with `git checkout -- vitagraph/backend/app/graph/extractor.py`, STOP, and report BLOCKED with the failing test name and its output.
3. Real check with the project's own data: run this and paste the output:
```
.venv\Scripts\python.exe -c "from app.graph.extractor import extract_entities_from_chunk as x; t='Lab Values:\n- HbA1c: 5.8 %\n- Total Cholesterol: 224 mg/dL\n- Vitamin D: 18 ng/mL -low\n'; print({e['test_name']:e['flag'] for e in x(t,'c','r',1,None)}); print({e['test_name']:(e['value'],e['reference_range']) for e in x('Weight: 82 kg Height: 172 cm BMI: 27.7\n','c','r',1,None)})"
```
Expected: `{'Vitamin D': 'LOW', 'Total Cholesterol': 'NORMAL', 'HbA1c': 'NORMAL'}` and `{'Weight': (82.0, None)}`.

## COMMIT
Stage ONLY `vitagraph/backend/app/graph/extractor.py` and `vitagraph/backend/tests/test_extractor_flags.py`. Message: `fix(backend): flag and reference range must belong to their own line`. Then `git show --stat HEAD`, `git branch --show-current`, `git log --oneline -3`.

## ACCEPTANCE (PASS/FAIL each with evidence)
- The new tests failed before the fix (tests 1 and 3) and pass after (all 4).
- Full suite `89 passed`; no existing test file changed (`git show --stat HEAD` lists only the two files).
- The real-data one-liner prints the expected output.
- Branch correct.
