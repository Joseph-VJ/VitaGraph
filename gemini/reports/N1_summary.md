# SESSION N1 (Backend) Summary: AI Node Summary

**Task**: Session N1 (Backend) of AI Node Summary in Knowledge Graph card  
**Branch**: `feature/ai-node-summary`  
**Date**: 2026-10-08  
**Status**: COMPLETE  

---

## 1. Work Performed by Part

### Part 0: Baseline Verification
- Verified active branch: `feature/ai-node-summary`.
- Confirmed port 8001 closed before starting.
- Ran backend pytest baseline: **362 passed** in 282.87s (`.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider`).
- Confirmed uncommitted work in working tree preserved without any git staging or commits.

### Part 1: Files Touched & Created
1. `vitagraph/backend/app/core/sse.py` (NEW):
   - Created reusable SSE framing (`frame()`) and streaming generator (`sse_stream()`) with 15-second keepalive pings.
2. `vitagraph/backend/app/routes/agent.py`:
   - Refactored to import `sse_stream` and `frame` from `app.core.sse`.
   - Maintained backward compatibility aliases (`_frame = frame`, `_sse_stream` wrapper respecting `KEEPALIVE_SECONDS`) to guarantee zero edits needed in existing tests (`tests/test_agent_route.py`).
3. `vitagraph/backend/app/core/database.py`:
   - Added `node_summaries` table (`id`, `user_id`, `node_id`, `evidence_key`, `text`, `created_at`) and unique index `idx_node_summaries_user_node` to `SCHEMA`. Executed `init_db()`.
4. `vitagraph/backend/app/services/user_service.py`:
   - Updated `delete_user()` to execute `DELETE FROM node_summaries WHERE user_id = ?` alongside report and history purges.
5. `vitagraph/backend/app/schemas/graph.py`:
   - Added `NodeSummaryRequest` Pydantic model (`user_id: str`, `node_id: str`, `refresh: bool = False`).
6. `vitagraph/backend/app/routes/graph.py`:
   - Added `POST /api/graph/node-summary` endpoint.
   - Validates user existence (404), invokes `run_in_threadpool(node_summary.gather, ...)`, returns `StreamingResponse(sse_stream(node_summary.stream(ev, refresh=req.refresh)), media_type="text/event-stream")`.
7. `vitagraph/backend/app/services/node_summary.py` (NEW):
   - Full implementation of `gather()`, `stream()`, `validate()`, `compose_fallback()`, `_store()`, `_cached()`, and `_audit()`.
   - Node evidence extraction across all 9 node types with exact document offsets into `report_pages.extracted_text`.
   - Reuses `check_answer_safety` from `app.generation.safety`.
   - Prompt encloses source passages inside `<passages>` tags with the "treat as data" instruction.
   - Handles reasoning model token requirements (`MAX_TOKENS = 600`).
8. `vitagraph/backend/tests/test_node_summary.py` (NEW):
   - Implemented all 15 specification tests (Spec §6.1).

---

## 2. Part 2: Real Data Offset & `gather()` Proof

Tested against a throwaway user with 3 real PDF reports (`synthetic_panel_2025-01-15.pdf`, `synthetic_panel_2025-06-20.pdf`, `VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf`).

### Verification Results Across All 9 Node Types:
- **Exact character slice equality**: For every source, `page_text[char_start:char_end] == source.text[hit_start:hit_end]` is strictly `True`.
- **Method provenance**: Native digital PDFs tagged `method="native"`; OCR scanned report tagged `method="ocr-rapid"`.
- **Deduplication & Limit**: At most 6 deduplicated passage sources numbered 1..n.
- **User isolation**: Sources strictly belong to the persona's own reports.
- **Deterministic fallback**: `compose_fallback(ev)` successfully passes `validate()` across all 9 node types (`ok=True`).

#### Node Gather Verification Samples:

1. **`test` Node (`test_Hemoglobin`)**:
   - Kind: `test`, Label: `Hemoglobin`
   - Facts: `3 results: 13.8 g/dL (15 January 2025), 14.1 g/dL (20 June 2025), 14.2 g/dL (01 December 2024); ref 12.0 - 15.5 g/dL`
   - Source 1: `synthetic_panel_2025-01-15.pdf`, Page 1, offsets `[274:278]`, method: `native`.
     - `page_text[274:278]`: `"13.8"`
     - `source.text[hit_start:hit_end]`: `"13.8"` (Match: `True`)
   - Source 2: `synthetic_panel_2025-06-20.pdf`, Page 1, offsets `[274:278]`, method: `native`.
     - `page_text[274:278]`: `"14.1"`
     - `source.text[hit_start:hit_end]`: `"14.1"` (Match: `True`)
   - Source 3: `VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf`, Page 1, offsets `[278:282]`, method: `ocr-rapid`.
     - `page_text[278:282]`: `"14.2"`
     - `source.text[hit_start:hit_end]`: `"14.2"` (Match: `True`)
   - `compose_fallback()`: `"Hemoglobin was measured 3 times across your files [1][2][3]. The latest value is 14.2 g/dL on 01 December 2024 [3]..."` -> `validate()`: `ok=True`.

2. **`measurement` Node (`meas_Hemoglobin_15_January_2025_13.8`)**:
   - Kind: `measurement`, Label: `Hemoglobin: 13.8 g/dL`
   - Facts: `value: 13.8 g/dL; test: Hemoglobin; report: synthetic_panel_2025-01-15.pdf; date: 15 January 2025; range: 12.0 - 15.5 g/dL; flag: normal`
   - Source 1: `synthetic_panel_2025-01-15.pdf`, Page 1, offsets `[274:278]`, method: `native`.
     - `page_text[274:278]`: `"13.8"`
     - `source.text[hit_start:hit_end]`: `"13.8"` (Match: `True`)
   - `compose_fallback()`: `"Hemoglobin was 13.8 g/dL on 15 January 2025 [1]..."` -> `validate()`: `ok=True`.

3. **`report` Node (`rep_rpt_2add01763bab`)**:
   - Kind: `report`, Label: `synthetic_panel_2025-01-15.pdf`
   - Facts: `file: synthetic_panel_2025-01-15.pdf; date: 15 January 2025; 1 pages; 5 tests: Hemoglobin, Vitamin D, 25-Hydroxy...`
   - Source 1: `synthetic_panel_2025-01-15.pdf`, Page 1, offsets `[0:120]`, method: `native`.
     - Match: `True`
   - `compose_fallback()` -> `validate()`: `ok=True`.

4. **`person` Node (`user_usr_95eba9a2d82a`)**:
   - Kind: `person`, Label: `Test Persona N1`
   - Facts: `persona: Test Persona N1; 3 reports on file: synthetic_panel_2025-01-15.pdf...`
   - Sources: First page headers from each uploaded report, offsets exact (`Match: True`).
   - `compose_fallback()` -> `validate()`: `ok=True`.

5. **`section` Node (`sec_rpt_2add01763bab_Clinical_Findings_Page_1`)**:
   - Kind: `section`, Label: `Clinical Findings (Page 1)`
   - Sources: Chunks within the section, offsets exact (`Match: True`).
   - `compose_fallback()` -> `validate()`: `ok=True`.

6. **`category` Node (`cat_Hematology`)**:
   - Kind: `category`, Label: `Hematology`
   - Sources: Associated test measurements, offsets exact (`Match: True`).
   - `compose_fallback()` -> `validate()`: `ok=True`.

7. **`date` Node (`date_15_January_2025`)**:
   - Kind: `date`, Label: `15 January 2025`
   - Sources: Reports and measurements matching date, offsets exact (`Match: True`).
   - `compose_fallback()` -> `validate()`: `ok=True`.

8. **`chunk` Node (`chunk_chk_b327ca7aeba4`)**:
   - Kind: `chunk`, Label: `Chunk b327ca7aeba4`
   - Source: Exact chunk char_start:char_end span (`Match: True`).
   - `compose_fallback()` -> `validate()`: `ok=True`.

9. **`uncertainty` Node (`unc_meas_...`)**:
   - Kind: `uncertainty`, Label: `Uncertain measurement`
   - Sources: Exact observation passage (`Match: True`).
   - `compose_fallback()` -> `validate()`: `ok=True`.

---

## 3. Part 3: Test Suite Output

### 15 Dedicated Feature Tests (`test_node_summary.py`):
```text
tests/test_node_summary.py::test_ai_off_writes_from_the_files_without_calling_the_model PASSED [  6%]
tests/test_node_summary.py::test_sources_come_first_with_exact_offsets PASSED [ 13%]
tests/test_node_summary.py::test_ai_summary_streams_and_is_cached PASSED [ 20%]
tests/test_node_summary.py::test_write_again_ignores_the_cache PASSED    [ 26%]
tests/test_node_summary.py::test_invented_number_falls_back PASSED       [ 33%]
tests/test_node_summary.py::test_advice_falls_back PASSED                [ 40%]
tests/test_node_summary.py::test_uncited_number_falls_back PASSED        [ 46%]
tests/test_node_summary.py::test_unknown_citations_are_removed_and_markup_stripped PASSED [ 53%]
tests/test_node_summary.py::test_model_failure_falls_back_not_errors PASSED [ 60%]
tests/test_node_summary.py::test_passages_are_data_in_the_prompt PASSED  [ 66%]
tests/test_node_summary.py::test_unknown_node_is_404 PASSED              [ 73%]
tests/test_node_summary.py::test_another_personas_files_never_appear PASSED [ 80%]
tests/test_node_summary.py::test_fallback_passes_validation PASSED       [ 86%]
tests/test_node_summary.py::test_delete_user_removes_cached_summaries PASSED [ 93%]
tests/test_node_summary.py::test_no_model_name_in_any_event PASSED       [100%]

============================= 15 passed in 21.90s =============================
```

### Full Backend Suite:
```text
======================= 377 passed in 278.04s (0:04:38) =======================
```
(Baseline 362 passed + 15 new tests = 377 passed, 0 failures, 0 regressions).

---

## 4. Part 4: Live Check on Port 8001

Uvicorn server ran on port 8001 with active `.env` configuration. A throwaway persona was created and uploaded with sample reports.

### 1. `test_Hemoglobin` (Live Stream):
- **Event Order**:
  1. `event: status` -> `phase: "reading"`
  2. `event: sources` -> 2 sources (`synthetic_panel_2025-01-15.pdf` p.1, `synthetic_panel_2025-06-20.pdf` p.1)
  3. `event: status` -> `phase: "writing"`
  4. `event: text_delta` stream deltas
  5. `event: status` -> `phase: "checking"`
  6. `event: completed` -> `status: "ai"`
- **Payload Completed**:
  ```json
  {
    "status": "ai",
    "text": "Hemoglobin is the protein in red blood cells that carries oxygen throughout the body. Across your records, it was measured at **13.8 g/dL** on 15 January 2025 [1] and **14.1 g/dL** on 20 June 2025 [2], remaining within the reference range of 12.0 to 15.5 g/dL [1][2].",
    "reason": null
  }
  ```
- **Number & Citation Verification**: Every number (`13.8 g/dL`, `15 January 2025`, `14.1 g/dL`, `20 June 2025`, `12.0`, `15.5`) has a citation `[n]`, and source texts verify the exact values.

### 2. Cache Hit Verification:
- Second request to `test_Hemoglobin`:
  - Immediate `event: completed` with `status: "cached"`.
  - Zero model call made (`ai_calls` table checked, no new entry).

### 3. Write Again (`refresh: true`):
- Third request to `test_Hemoglobin` with `"refresh": true`:
  - Cache bypassed; full model stream executed (`reading` -> `sources` -> `writing` -> `text_delta`... -> `checking` -> `completed` (`status: "ai"`)).

### 4. `meas_Hemoglobin_15_January_2025_13.8`:
- Completed with `status: "ai"`:
  `"Hemoglobin is a protein in red blood cells that carries oxygen through the body. The report from **15 January 2025** [1] shows **13.8 g/dL** [1], which is inside the printed range of 12.0 to 15.5 g/dL [1]."`

### 5. Error & Isolation Checks:
- **Missing node ID (`test_Nope`)**:
  - HTTP 404: `{"detail":"This dot is not in your graph any more."}`
- **Missing user ID (`usr_000000000000`)**:
  - HTTP 404: `{"detail":"User not found."}`
- **Cross-persona query**:
  - User B querying User A's node (`sec_rpt_2add01763bab_...`):
  - HTTP 404: `{"detail":"This dot is not in your graph any more."}`

### 6. Cleanup Verification:
- Invoked `delete_user()` on the throwaway persona.
- Database cascade query result:
  `Cascade check: node_summaries=0, reports=0, report_chunks=0`
- Terminated uvicorn process on port 8001. Port verified closed (`Connection refused`).

---

## 5. Security & Secret Scan
- Executed `scripts/plan/secret_scan.py`: `RESULT: PASS`.
- No provider or model names emitted in any SSE payload, UI text, or fallback messages.
- `.env` untouched and unprinted.

---

## 6. Git Status Baseline

```text
## feature/ai-node-summary
vitagraph/backend/app/core/sse.py (NEW)
vitagraph/backend/app/routes/agent.py (MODIFIED)
vitagraph/backend/app/core/database.py (MODIFIED)
vitagraph/backend/app/services/user_service.py (MODIFIED)
vitagraph/backend/app/schemas/graph.py (MODIFIED)
vitagraph/backend/app/routes/graph.py (MODIFIED)
vitagraph/backend/app/services/node_summary.py (NEW)
vitagraph/backend/tests/test_node_summary.py (NEW)
gemini/reports/N1_summary.md (NEW)
```
(No files committed, no files staged).
