<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task C7 — Stage latencies that were really measured

- **Goal:** Each stage reports its own measured time. Embedding and indexing are timed separately, and graph building is timed instead of reported as a fixed 10 ms.
- **Tier:** Should
- **Size:** S
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `vitagraph/backend/app/services/report_service.py` lines 165–218 (anchor `t_idx_start = time.perf_counter()`)
  - `vitagraph/backend/app/rag/vector_store.py` lines 29–52 (anchor `def index_chunks(rows: list[dict]) -> int:`)
  - `vitagraph/backend/tests/test_journey_events.py` lines 1–24 (anchor `def _upload(name: str, jid: str) -> dict:`)
- **Files to create or modify:**
  - modify `vitagraph/backend/app/rag/vector_store.py`
  - modify `vitagraph/backend/app/services/report_service.py`
  - create `vitagraph/backend/tests/test_stage_timing.py`

**What to change**
1. **Embedding hook:** `vitagraph/backend/app/rag/vector_store.py` lines 29–52 (anchor `vectors = embedder.embed_texts(texts)`).
   - Add a keyword-only optional parameter `on_embedded`, a callable with no arguments, default `None`.
   - Call it right after `embed_texts` returns, before the collection `add`.
   - Existing callers pass nothing and behave exactly as before.
2. **Separate timings:** `vitagraph/backend/app/services/report_service.py` lines 167–191 (anchor `latency_ms=max(10, lat_idx // 2),`).
   - Record the time in a callback passed as `on_embedded`.
   - "embedded" reports the time from `t_idx_start` to that moment.
   - "indexed" reports the time from that moment to `t_idx_end`.
   - Each value is at least 1 ms. A value of 0 would hide the latency, because `publish_event` treats 0 as "no latency".
3. **Graph timing:** `vitagraph/backend/app/services/report_service.py` lines 209–217 (anchor `latency_ms=10,`). Call `_graph_payload` before publishing, timed with `time.perf_counter()`, and report its real duration (at least 1 ms) instead of 10.
4. **Create `vitagraph/backend/tests/test_stage_timing.py`.** It follows the pattern of `tests/test_journey_events.py`: `make_user` and `sample_pdf` from `tests.conftest`, `report_service.process_upload` with a job ID, and events read from `job_broker._jobs[jid]["events"]`. Two tests:
   - **`test_graphed_latency_is_measured`:** monkeypatch `report_service._graph_payload` with a wrapper that sleeps 30 ms and then calls the original. Upload `synthetic_panel_2025-01-15.pdf`. The graphed event's `latency` parses to at least 30 ms.
   - **`test_embedding_and_indexing_are_timed_separately`:** monkeypatch `vector_store.embedder.embed_texts` with a wrapper that sleeps 60 ms and then calls the original. Upload the same file under a new job ID.
     - The embedded event's latency is at least 60 ms.
     - The indexed event's latency is below the embedded one.
     - Both end with " ms".

**How to verify**
1. `cd vitagraph\backend; .venv\Scripts\python.exe -m pytest tests\test_stage_timing.py -q -p no:cacheprovider`. The output reads `2 passed`.
2. Run the full suite with the command in section 5.1. The count is baseline + 2.
3. `python scripts\plan\e2e_journey.py` still ends with `RESULT: PASS`.

**Acceptance criteria**
- [ ] No hard-coded `latency_ms=10` and no `lat_idx // 2` remain in `report_service.py`.
- [ ] `index_chunks` keeps working for callers that pass only `rows`.
- [ ] Full suite: baseline + 2.
- [ ] No existing test file was edited.
