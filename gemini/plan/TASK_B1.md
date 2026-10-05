<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task B1 — Backend: one chunk's text for the inspector

- **Goal:** Add `GET /api/reports/{report_id}/chunks/{chunk_id}`, which returns the stored passage of one chunk, so the inspector can show the real text behind chunk and uncertainty nodes.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `vitagraph/backend/app/routes/reports.py`
  - `vitagraph/backend/app/schemas/report.py` lines 86–101 (anchor `class MeasurementOut(BaseModel):`)
  - `vitagraph/backend/app/services/report_service.py` lines 409–417 (anchor `def get_pages(report_id: str) -> list[dict]:`)
  - `vitagraph/backend/tests/test_journey_events.py`
- **Files to create or modify:**
  - modify `vitagraph/backend/app/schemas/report.py`
  - modify `vitagraph/backend/app/services/report_service.py`
  - modify `vitagraph/backend/app/routes/reports.py`
  - modify `site design/src/api/reports.ts`
  - create `vitagraph/backend/tests/test_report_chunk.py`

**What to change**
1. **Schema:** in `vitagraph/backend/app/schemas/report.py`, after `MeasurementOut`, add a model `ChunkOut` with these fields:
   - `chunk_id` (str);
   - `report_id` (str);
   - `page_number` (int);
   - `sequence` (int);
   - `section` (str or None);
   - `char_start` and `char_end` (int);
   - `text` (str).
2. **Service:** in `vitagraph/backend/app/services/report_service.py`, after `get_pages` (lines 409–417, anchor `def get_pages(report_id: str) -> list[dict]:`), add `get_chunk(report_id, chunk_id)`:
   - Call `uploader.get_report(report_id)` first, which raises 404 for an unknown report, as `get_pages` does.
   - Select `id`, `report_id`, `page_number`, `sequence`, `section`, `char_start`, `char_end` and `text` from `report_chunks`, matching both the chunk ID and the report ID.
   - Raise `HTTPException(404, "Chunk not found in this report.")` when there is no row.
   - Return the row as a dict, with `id` renamed to `chunk_id`.
3. **Route:** in `vitagraph/backend/app/routes/reports.py`:
   - Add `ChunkOut` to the schema import at line 7 (anchor `from app.schemas.report import ComparisonOut, MeasurementOut, PageOut, ReportOut, ReportStatusOut, TrendOut`).
   - After the measurements route (lines 85–88, anchor `def report_measurements(report_id: str) -> list[dict]:`), add a GET route `/{report_id}/chunks/{chunk_id}` with response model `ChunkOut` and docstring "One stored passage, for the graph inspector."
   - It takes a **required** `user_id` query parameter and calls `user_service.user_exists(user_id)`. It then calls a new service helper, `report_service.assert_report_owner(report_id, user_id)`, which raises 404 "Report not found." when the report does not exist or belongs to another persona. Finally it returns `report_service.get_chunk(report_id, chunk_id)`.
   - The new route has no existing tests, so it is private from the start. The three older per-report routes get the same check in task F1.
4. **Client:** in `site design/src/api/reports.ts`:
   - Add an exported interface `ChunkDetail` with the same fields as `ChunkOut`.
   - Add `chunk: (userId, reportId, chunkId) => api.get<ChunkDetail>(...)` to `reportsApi` (lines 91–114, anchor `export const reportsApi = {`). It calls the route with `?user_id=` and encodes all three IDs with `encodeURIComponent`.
5. **Tests:** create `vitagraph/backend/tests/test_report_chunk.py`. It uses `TestClient(app)`, `make_user`, `sample_pdf` and `report_service.process_upload`, as `tests/test_journey_events.py` does.
   - **`test_chunk_route_returns_the_stored_passage`:** upload `synthetic_panel_2025-01-15.pdf`, then read the first chunk ID from `report_chunks` for that report. The route returns 200 with the same text, `char_end` greater than `char_start`, and `page_number` 1 or more.
   - **`test_chunk_route_refuses_a_chunk_of_another_report`:** upload both sample panels. Asking for report A with a chunk ID of report B returns 404.
   - **`test_chunk_route_refuses_another_persona`:** persona B asking for persona A's chunk with B's own `user_id` returns 404. A request without `user_id` returns 422.

**How to verify**
1. `cd vitagraph\backend; .venv\Scripts\python.exe -m pytest tests\test_report_chunk.py -q -p no:cacheprovider`. The output reads `3 passed`.
2. Full suite: baseline + 3 (section 5.1).
3. `cd "site design"; npm run build`. It must exit 0.

**Acceptance criteria**
- [ ] `GET /api/reports/{report_id}/chunks/{chunk_id}` exists and returns `ChunkOut`. It gives 404 for a chunk of another report and for another persona, and 422 without `user_id`.
- [ ] `reportsApi.chunk` exists and calls exactly that path with `user_id`.
- [ ] Full suite: baseline + 3. No existing test was edited.
