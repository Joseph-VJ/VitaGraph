# TASK C7 report

## 1. What I was asked to do
Implement real stage latency measurements during report ingestion. Separate the embedding and indexing stage latencies instead of dividing their combined duration by two, and measure real graph building duration instead of reporting a fixed 10 ms. Add two regression tests covering the timing behavior and ensure the full backend test suite passes at baseline + 2.

## 2. What I actually did
1. Added an optional keyword-only callback parameter `on_embedded` to `index_chunks` in `vitagraph/backend/app/rag/vector_store.py`, invoked immediately after `embedder.embed_texts`.
2. Updated `vitagraph/backend/app/services/report_service.py` to pass an `_on_embedded` callback recording the exact transition timestamp, computing separate `lat_embed` and `lat_idx` values (each at least 1 ms) for the "embedded" and "indexed" job events.
3. Updated `vitagraph/backend/app/services/report_service.py` to evaluate `_graph_payload` before publishing the "graphed" event and time its actual execution via `time.perf_counter()`, removing hard-coded `latency_ms=10`.
4. Created `vitagraph/backend/tests/test_stage_timing.py` containing `test_graphed_latency_is_measured` and `test_embedding_and_indexing_are_timed_separately`.
5. Ran `pytest tests\test_stage_timing.py` (2 passed in 18.17s) and the full backend suite (203 passed in 229.84s, baseline 201 + 2).

## 3. Files changed
- `vitagraph/backend/app/rag/vector_store.py` (+6/-1): Added optional keyword-only callback `on_embedded` to `index_chunks`.
- `vitagraph/backend/app/services/report_service.py` (+16/-6): Replaced split latency and hard-coded 10ms with measured durations for embedded, indexed, and graphed stages.
- `vitagraph/backend/tests/test_stage_timing.py` (+82/-0): Added unit tests for graphed latency measurement and separate embedding/indexing latencies.
- `gemini/reports/TASK_C7_report.md` (+75/-0): Task execution and verification report.

## 4. Commands and their output
Command 1:
```powershell
$PY = "F:\kiruthika\kiruthika final project\vitagraph\backend\.venv\Scripts\python.exe"; & $PY -m pytest tests\test_stage_timing.py -q -p no:cacheprovider
```
Output:
```
..                                                                       [100%]
2 passed in 18.17s
```

Command 2:
```powershell
$env:AI_SERVICE_API_KEY = "test-placeholder-key"; $PY = "F:\kiruthika\kiruthika final project\vitagraph\backend\.venv\Scripts\python.exe"; & $PY -m pytest tests -q -p no:cacheprovider
```
Output:
```
........................................................................ [ 35%]
........................................................................ [ 70%]
...........................................................              [100%]
203 passed in 229.84s (0:03:49)
```

Command 3:
```powershell
python scripts\plan\e2e_journey.py
```
Output:
not run: script is created by C6

## 5. Acceptance checklist
- [x] No hard-coded `latency_ms=10` and no `lat_idx // 2` remain in `report_service.py`: PASS (`Select-String` found zero occurrences).
- [x] `index_chunks` keeps working for callers that pass only `rows`: PASS (`on_embedded` defaults to `None`, tested in existing suites).
- [x] Full suite: baseline + 2: PASS (203 passed vs baseline of 201).
- [x] No existing test file was edited: PASS (`git status` shows only `vector_store.py`, `report_service.py`, new `test_stage_timing.py`, and report).

## 6. Things that surprised me
During baseline establishment on the fresh worktree, 4 mocked-generation tests in `test_generation_mocked.py` failed because this worktree has no `.env` file and `settings.effective_api_key` was empty. Supplying a harmless test placeholder in the environment (`$env:AI_SERVICE_API_KEY = "test-placeholder-key"`) without creating any `.env` allowed all 201 baseline tests to pass cleanly.

## 7. Deviations from the task
Verify step 3 (`python scripts\plan\e2e_journey.py`) was not run because that script is created by task C6, per task-specific instructions.

## 8. Open questions for the reviewer
none

## 9. How the reviewer can double-check
1. `git branch --show-current` (verifies `redesign/backend-track`)
2. `cd vitagraph\backend; $PY = "F:\kiruthika\kiruthika final project\vitagraph\backend\.venv\Scripts\python.exe"; & $PY -m pytest tests\test_stage_timing.py -q -p no:cacheprovider`
3. `cd vitagraph\backend; $env:AI_SERVICE_API_KEY = "test-placeholder-key"; $PY = "F:\kiruthika\kiruthika final project\vitagraph\backend\.venv\Scripts\python.exe"; & $PY -m pytest tests -q -p no:cacheprovider`
4. `Select-String -Path "vitagraph/backend/app/services/report_service.py" -Pattern "latency_ms=10", "lat_idx // 2"`
