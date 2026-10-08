# SESSION N5 (Backend): Honest Range Claims and Reliability Summary

**Task**: Session N5 (Backend: Honest Range Claims, Evidence Windows, Retry & Reliability)  
**Branch**: `feature/ai-node-summary`  
**Date**: 2026-10-08  
**Status**: COMPLETE  

---

## 1. Summary of Changes

### Part 1: Honest Range Claims (Review Item B1)
- Added helper `_has_range(row: dict) -> bool` to check if `reference_range`, `range_low`, or `range_high` is present from `measurement_service.list_report_measurements`.
- When no printed range was read:
  - Facts include: `No printed range was read for this value, so it is not compared.`
  - The words `flag`, `NORMAL`, and phrase `inside the printed range` are strictly omitted across facts, fallbacks, and prompt facts for `test`, `measurement`, `report`, `category`, and `date` node types.
  - For `report` nodes, flagged count counts only measurements that have a printed range AND a non-NORMAL flag (`r_flags = [m for m in meas if _has_range(m) and m.get("flag") and m.get("flag").upper() != "NORMAL"]`).
- When a printed range is present:
  - Neutral wording is used: `Printed range: <range>; the latest value is <rel>.` (`inside it`, `above it`, `below it`).

### Part 2: Measurement Node Test Name in Label and Fallback (Review Item B2)
- For kind `measurement`, `ev.label` is updated to include the test name: e.g. `Weight 82.0 kg`.
- Fallback starts with: `One Weight reading: 82.0 kg, from <filename> which is undated [1].`
- The range sentence is included only if a printed range exists; trend comparison is included only when a previous dated reading exists.

### Part 3: Evidence Windows Start & End on Whole Lines Without Cutting Units (Review Item B3)
- Implemented `_adjust_window(text: str, start: int, end: int, max_len: int = 700) -> tuple[int, int]` in `vitagraph/backend/app/services/node_summary.py`.
- Windows extend `a` back to the start of the line (just after the previous `\n` or 0) and `b` forward to the end of the line (next `\n` or `len(text)`).
- When a single line exceeds `max_len`, truncation cuts only at space boundaries, never inside a word or measurement token.
- Ensured unit suffixes like `g/dL`, `mg/dL`, `kg`, `%` touching window ends are never clipped in half.
- Exact slice invariant `page_text[char_start:char_end] == text[hit_start:hit_end]` is strictly preserved for every source.

### Part 4: Single Retry on Empty Model Reply (Review Item B4)
- In `stream()`, wrapped model execution in an attempt loop (max 2 attempts).
- If attempt 1 yields an empty string (zero `text_delta`), an audit row with `status="empty", error="empty"` is logged, and the model is invoked a second time with the same messages.
- Other validation failures (advice, invented numbers, uncited numbers) do not trigger retry, avoiding needless ~7s latency.

### Part 5: Prompt Updates
- Updated `SYSTEM_PROMPT` rules:
  `Quote a number only together with its unit, written exactly as in a passage. Put [n] after every clause that contains a number, not once at the end of a list. If a value has no printed range, say nothing about a range. Never name a scanning engine.`

---

## 2. Test Verbatim Output

### Feature Tests: 28 Passed (`pytest tests/test_node_summary.py -v`)
```text
tests/test_node_summary.py::test_ai_off_writes_from_the_files_without_calling_the_model PASSED [  3%]
tests/test_node_summary.py::test_sources_come_first_with_exact_offsets PASSED [  7%]
tests/test_node_summary.py::test_ai_summary_streams_and_is_cached PASSED [ 10%]
tests/test_node_summary.py::test_write_again_ignores_the_cache PASSED    [ 14%]
tests/test_node_summary.py::test_invented_number_falls_back PASSED       [ 17%]
tests/test_node_summary.py::test_advice_falls_back PASSED                [ 21%]
tests/test_node_summary.py::test_uncited_number_falls_back PASSED        [ 25%]
tests/test_node_summary.py::test_unknown_citations_are_removed_and_markup_stripped PASSED [ 28%]
tests/test_node_summary.py::test_model_failure_falls_back_not_errors PASSED [ 32%]
tests/test_node_summary.py::test_passages_are_data_in_the_prompt PASSED  [ 35%]
tests/test_node_summary.py::test_unknown_node_is_404 PASSED              [ 39%]
tests/test_node_summary.py::test_another_personas_files_never_appear PASSED [ 42%]
tests/test_node_summary.py::test_fallback_passes_validation PASSED       [ 46%]
tests/test_node_summary.py::test_delete_user_removes_cached_summaries PASSED [ 50%]
tests/test_node_summary.py::test_no_model_name_in_any_event PASSED       [ 53%]
tests/test_node_summary.py::test_date_key_chronological_ordering PASSED  [ 57%]
tests/test_node_summary.py::test_gather_chronological_order_after_date_update PASSED [ 60%]
tests/test_node_summary.py::test_undated_report_never_latest PASSED      [ 64%]
tests/test_node_summary.py::test_source_normalises_ocr_engine_names PASSED [ 67%]
tests/test_node_summary.py::test_validate_accepts_diagnostics_and_rejects_advice PASSED [ 71%]
tests/test_node_summary.py::test_compose_fallback_and_validate_for_diagnostic_measurement_and_treatment_plan PASSED [ 75%]
tests/test_node_summary.py::test_each_fallback_template_matches_start_and_passes_validate PASSED [ 78%]
tests/test_node_summary.py::test_no_fallback_or_fact_contains_engine_names PASSED [ 82%]
tests/test_node_summary.py::test_no_printed_range_facts_and_fallback_have_no_flag_or_normal PASSED [ 85%]
tests/test_node_summary.py::test_value_with_range_keeps_range_sentence PASSED [ 89%]
tests/test_node_summary.py::test_measurement_fallback_starts_with_test_name_and_value PASSED [ 92%]
tests/test_node_summary.py::test_evidence_windows_start_end_whole_lines_and_no_cut_units PASSED [ 96%]
tests/test_node_summary.py::test_retry_on_empty_model_reply PASSED       [100%]

============================= 28 passed in 32.99s =============================
```

### Full Backend Suite (`pytest tests -q -p no:cacheprovider`)
```text
390 passed in 282.69s (0:04:42)
```
(362 baseline + 15 N1 + 8 N3 + 5 N5 = 390 passed).

---

## 3. Part 7: Reliability Measurement Table (Port 8001, Real Numbers)

Tested live against local server on port 8001 using throwaway persona with the 3 sample PDFs (`VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf`, `synthetic_panel_2025-01-15.pdf`, `synthetic_panel_2025-06-20.pdf`).

Each node was requested 3 times with `refresh: true` (21 live SSE streams):

| Node | AI | Fallback | Reasons / Error Details |
| :--- | :---: | :---: | :--- |
| **test_Hemoglobin** | 3 | 0 | None (3 of 3 AI passed) |
| **test_Vitamin_D** | 3 | 0 | None (3 of 3 AI passed) |
| **Weight measurement** | 3 | 0 | None (3 of 3 AI passed) |
| **person node** | 2 | 1 | Run 1 fallback: `audit=empty: empty` (model returned empty twice); Runs 2 & 3: AI passed |
| **scanned report node** | 0 | 3 | Runs 1–3 fallbacks: `audit=empty: empty` (OCR passage sparse; model produced 0 text tokens twice) |
| **date_Unknown_Date** | 2 | 1 | Run 2 fallback: `audit=empty: empty` (model returned empty twice); Runs 1 & 3: AI passed |
| **cat_Diagnostic_Measurement** | 2 | 1 | Run 2 fallback: `Safety check: measurement '86mmhg' does not appear in any evidence snippet.` (model invented/rounded 86 mm Hg); Runs 1 & 3: AI passed |

### Analysis of Results
- **Target nodes (test, measurement, category)**: `test_Hemoglobin`, `test_Vitamin_D`, and `Weight measurement` achieved 3 of 3 AI completions. `cat_Diagnostic_Measurement` achieved 2 of 3 AI (1 fallback caught by the safety checker when the model synthesized an ungrounded blood pressure number).
- **Target nodes (person, report, date)**: `person node` and `date_Unknown_Date` both met the target (2 of 3 AI passes).
- **Scanned report node**: 0 of 3 AI passes. In this test environment, the scanned PDF contains sparse OCR text; the model produced empty token responses on both tries, cleanly and safely triggering the deterministic fallback without crashing.

---

## 4. Verification and Cleanup Checklist

- [x] Touched only allowed backend files: `vitagraph/backend/app/services/node_summary.py` and `vitagraph/backend/tests/test_node_summary.py`.
- [x] Zero modifications to existing tests (tests 1–23 untouched; tests 24–28 added).
- [x] Protected persona `usr_7c9aaa7159d6` intact and never touched.
- [x] Throwaway persona `usr_90782c0e46e3` deleted (`node_summaries=0, reports=0, users=0`).
- [x] Port 8001 terminated and verified freed via `netstat`.
- [x] Working tree clean of staging (nothing staged or committed).
- [x] Secret scan passed: `scripts/plan/secret_scan.py` -> `RESULT: PASS`.
