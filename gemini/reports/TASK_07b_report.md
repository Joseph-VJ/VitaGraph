# TASK 07b report

## 1. What I was asked to do
Fix two line-spanning bugs in the backend report extractor where generic row matching permitted `\s` (newlines) inside test names and reference ranges, leading to junk rows like `Cholesterol, Total\nResult` and reference ranges swallowing subsequent rows like Potassium. Write test-first unit tests in `vitagraph/backend/tests/test_extractor_rows.py`, update `_GENERIC_ROW_PATTERN` and add label words filter in `extractor.py`, and verify against the full test suite and live database.

## 2. What I actually did
1. Verified git branch is `redesign/modernist-app`.
2. Ran baseline pytest on the backend test suite, confirming 89 passed.
3. Created `vitagraph/backend/tests/test_extractor_rows.py` with 4 tests and ran pytest to verify all 4 tests failed before the fix.
4. Implemented Edit D in `vitagraph/backend/app/graph/extractor.py` to constrain whitespace in `_GENERIC_ROW_PATTERN` to `[ \t]`.
5. Implemented Edit E in `vitagraph/backend/app/graph/extractor.py` to filter out label words (`result`, `results`, `value`, `values`, `range`).
6. Ran `tests/test_extractor_rows.py` and verified 4 passed.
7. Ran `tests/test_extractor_flags.py` and verified 4 passed.
8. Ran the full backend test suite and verified 93 passed.
9. Ran the real-data inline test and verified exact output.
10. Started the backend server on port 8000, verified live report measurements via the API, and shut down the backend cleanly.
11. Created and committed the work report and code files.

## 3. Files changed
- `vitagraph/backend/app/graph/extractor.py` (+3, -1): Constrained `_GENERIC_ROW_PATTERN` regex whitespace to horizontal space (`[ \t]`) so row matching cannot span newlines, and added skip filter for label tokens `{"result", "results", "value", "values", "range"}`.
- `vitagraph/backend/tests/test_extractor_rows.py` (+69, -0): Added unit tests to ensure test names do not contain line breaks, reference ranges do not swallow subsequent rows, label words are not extracted as tests, and bullet list rows retain their own ranges and flags.
- `gemini/reports/TASK_07b_report.md` (+115, -0): Created work report file for reviewer per RULES 5b.

## 4. Commands and their output

```
$ git branch --show-current
redesign/modernist-app
```

```
$ .venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider (baseline)
89 passed in 47.94s
```

```
$ .venv\Scripts\python.exe -m pytest tests/test_extractor_rows.py -q -p no:cacheprovider (before fix)
FFFF                                                                     [100%]
================================== FAILURES ===================================
________________ test_a_test_name_never_contains_a_line_break _________________
    def test_a_test_name_never_contains_a_line_break():
        by = _by_name("Cholesterol, Total\nResult 198 mg/dL\n\nTSH\nResult 2.1 uIU/mL\n")
>       assert set(by) == {"Total Cholesterol", "TSH"}
E       AssertionError: assert {'Cholesterol... Cholesterol'} == {'TSH', 'Total Cholesterol'}
E         
E         Extra items in the left set:
E         'Cholesterol, Total\nResult'
E         'Result'
E         Use -v to get more diff

tests\test_extractor_rows.py:15: AssertionError
____________ test_a_reference_range_does_not_swallow_the_next_row _____________
    def test_a_reference_range_does_not_swallow_the_next_row():
        by = _by_name("Serum Glucose: 94 mg/dL 70 - 99\nWeight: 82 kg Height: 172 cm BMI: 27.7\n")
>       assert by["Serum Glucose"]["reference_range"] == "70 - 99"
E       AssertionError: assert '70 - 99\nWeight' == '70 - 99'
E         
E         - 70 - 99
E         + 70 - 99
E         ?        +
E         + Weight

tests\test_extractor_rows.py:20: AssertionError
____________ test_the_words_result_and_value_are_labels_not_tests _____________
    def test_the_words_result_and_value_are_labels_not_tests():
        by = _by_name("Result: 5.1 mg/dL\nValue: 3 mg/dL\n")
>       assert by == {}
E       AssertionError: assert {'Result': {'...'mg/dL', ...}} == {}
E         
E         Left contains 1 more item:
E         {'Result': {'category': 'Diagnostic Measurement',
E                     'chunk_id': 'c1',
E                     'date': '2024-11-01',
E                     'evidence_snippet': 'Result: 5.1 mg/dL\nValue',
E                     'flag': 'NORMAL',...
E         
E         ...Full output truncated (7 lines hidden), use '-vv' to show

tests\test_extractor_rows.py:26: AssertionError
_______________ test_bullet_rows_keep_their_own_range_and_flag ________________
    def test_bullet_rows_keep_their_own_range_and_flag():
        by = _by_name("- Sodium: 140 mmol/L 135 - 145\n- Potassium: 5.9 mmol/L 3.5 - 5.1\n")
>       assert by["Sodium"]["reference_range"] == "135 - 145"
E       AssertionError: assert '135 - 145\n- Potassium' == '135 - 145'
E         
E         - 135 - 145
E         + 135 - 145
E         ?          +
E         + - Potassium

tests\test_extractor_rows.py:31: AssertionError
=========================== short test summary info ===========================
FAILED tests/test_extractor_rows.py::test_a_test_name_never_contains_a_line_break
FAILED tests/test_extractor_rows.py::test_a_reference_range_does_not_swallow_the_next_row
FAILED tests/test_extractor_rows.py::test_the_words_result_and_value_are_labels_not_tests
FAILED tests/test_extractor_rows.py::test_bullet_rows_keep_their_own_range_and_flag
4 failed in 0.16s
```

```
$ .venv\Scripts\python.exe -m pytest tests/test_extractor_rows.py -q -p no:cacheprovider (after fix)
....                                                                     [100%]
4 passed in 0.03s
```

```
$ .venv\Scripts\python.exe -m pytest tests/test_extractor_flags.py -q -p no:cacheprovider (after fix)
....                                                                     [100%]
4 passed in 0.03s
```

```
$ .venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider (full suite after fix)
93 passed in 46.17s
```

```
$ .venv\Scripts\python.exe -c "from app.graph.extractor import extract_entities_from_chunk as x; t='Serum Glucose: 94 mg/dL 70 - 99\nWeight: 82 kg Height: 172 cm BMI: 27.7\n'; print([(e['test_name'],e['value'],e['reference_range']) for e in x(t,'c','r',1,None)])"
[('Serum Glucose', 94.0, '70 - 99'), ('Weight', 82.0, None)]
```

```
$ .venv\Scripts\python.exe -c "import json,urllib.request as u; rs=json.load(u.urlopen('http://127.0.0.1:8000/api/reports?user_id=usr_d1d7f9b2a4b1')); [print(r.get('filename'), [(m['test_name'],m['value']) for m in json.load(u.urlopen('http://127.0.0.1:8000/api/reports/%s/measurements'%(r.get('report_id') or r.get('id'))))]) for r in rs]"
None [('Hemoglobin', 14.1), ('Vitamin D', 34.0), ('Total Cholesterol', 198.0), ('LDL Cholesterol', 126.0), ('HDL Cholesterol', 51.0), ('Fasting Glucose', 92.0), ('TSH', 2.1), ('Vitamin B12', 410.0)]
None [('Weight', 82.0), ('Vitamin D', 18.0), ('Total Cholesterol', 224.0), ('HbA1c', 5.8)]
None [('Hemoglobin', 13.8), ('Vitamin D', 18.0), ('Total Cholesterol', 224.0), ('LDL Cholesterol', 148.0), ('HDL Cholesterol', 44.0), ('Fasting Glucose', 96.0), ('TSH', 2.4)]
```

## 5. Acceptance checklist
- All four new tests failed before the edits and pass after: PASS (4 failed before in 0.16s; 4 passed after in 0.03s).
- Full suite `93 passed`; no existing test file changed: PASS (93 passed in 46.17s; no existing test modified).
- Real-data command prints exactly the expected list: PASS (Printed `[('Serum Glucose', 94.0, '70 - 99'), ('Weight', 82.0, None)]`).
- Live check: no test name with a line break, no `Result` row, Total Cholesterol and TSH appear once per dated report: PASS (Confirmed in all three reports).
- Backend stopped afterwards: PASS (Confirmed port 8000 listener stopped).
- `gemini/reports/TASK_07b_report.md` exists, has all nine headings, and is in the commit: PASS.
- Branch is `redesign/modernist-app`; `git show --stat HEAD` lists only the three files: PASS.

## 6. Things that surprised me
In the live check command, `r.get('filename')` prints `None` because the API response uses `file_name` instead of `filename` in the schema dictionary. The measurements themselves are completely clean: no newline-spanning test names, no `Result` test, and no swallowed ranges.

## 7. Deviations from the task
none

## 8. Open questions for the reviewer
none

## 9. How the reviewer can double-check
1. Check git branch: `git branch --show-current` (outputs `redesign/modernist-app`).
2. Run new tests: `cd vitagraph/backend && .venv\Scripts\python.exe -m pytest tests/test_extractor_rows.py -q -p no:cacheprovider` (prints `4 passed`).
3. Run full backend suite: `cd vitagraph/backend && .venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider` (prints `93 passed`).
4. Run real-data check: `cd vitagraph/backend && .venv\Scripts\python.exe -c "from app.graph.extractor import extract_entities_from_chunk as x; t='Serum Glucose: 94 mg/dL 70 - 99\nWeight: 82 kg Height: 172 cm BMI: 27.7\n'; print([(e['test_name'],e['value'],e['reference_range']) for e in x(t,'c','r',1,None)])"`
5. Check commit content: `git show --stat HEAD` (shows exactly the 3 files).
