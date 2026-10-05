# TASK B1 report

## 1. What I was asked to do
Add `GET /api/reports/{report_id}/chunks/{chunk_id}` to the backend to return the stored text passage and metadata for a single chunk. The route requires `user_id`, validates persona ownership, and returns 404 for missing chunks/reports or cross-persona access. Also expose `reportsApi.chunk` in the frontend client and add regression tests.

## 2. What I actually did
1. Added `ChunkOut` schema to `vitagraph/backend/app/schemas/report.py` with `chunk_id`, `report_id`, `page_number`, `sequence`, `section`, `char_start`, `char_end`, and `text`.
2. Added `assert_report_owner(report_id, user_id)` and `get_chunk(report_id, chunk_id)` to `vitagraph/backend/app/services/report_service.py`.
3. Added the GET route `/{report_id}/chunks/{chunk_id}` in `vitagraph/backend/app/routes/reports.py` with docstring "One stored passage, for the graph inspector." and required `user_id`.
4. Added `ChunkDetail` interface and `chunk` method to `reportsApi` in `site design/src/api/reports.ts`.
5. Created `vitagraph/backend/tests/test_report_chunk.py` with three tests: `test_chunk_route_returns_the_stored_passage`, `test_chunk_route_refuses_a_chunk_of_another_report`, and `test_chunk_route_refuses_another_persona`.
6. Verified targeted tests (3 passed), full backend suite (210 passed = baseline 207 + 3), and frontend build (exit 0).

## 3. Files changed
- `vitagraph/backend/app/schemas/report.py` (+11/-0): Added `ChunkOut` response schema.
- `vitagraph/backend/app/services/report_service.py` (+22/-0): Added `assert_report_owner` and `get_chunk`.
- `vitagraph/backend/app/routes/reports.py` (+9/-1): Added GET `/{report_id}/chunks/{chunk_id}` route.
- `site design/src/api/reports.ts` (+15/-0): Added `ChunkDetail` type and `reportsApi.chunk` method.
- `vitagraph/backend/tests/test_report_chunk.py` (+98/-0): Created test suite for the chunk endpoint.

## 4. Commands and their output
```powershell
& "F:\kiruthika\kiruthika final project\vitagraph\backend\.venv\Scripts\python.exe" -m pytest tests\test_report_chunk.py -q -p no:cacheprovider
```
```
...                                                                      [100%]
3 passed in 19.38s
```

```powershell
$env:AI_SERVICE_API_KEY = "test-placeholder-key"; & "F:\kiruthika\kiruthika final project\vitagraph\backend\.venv\Scripts\python.exe" -m pytest tests -q -p no:cacheprovider
```
```
........................................................................ [ 34%]
........................................................................ [ 68%]
..................................................................       [100%]
210 passed in 234.14s (0:03:54)
```

```powershell
cd "site design"; npm run build
```
```
> vitagraph-site-design@0.0.0 build
> tsc -b && vite build

vite v8.3.2 building client environment for production...
transforming...
✓ 368 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.71 kB │ gzip:   0.44 kB
dist/assets/archivo-latin-600-normal-3BBy0ZsW.woff2   13.82 kB
dist/assets/archivo-latin-800-normal-cB6v3kRN.woff2   14.41 kB
dist/assets/archivo-latin-400-normal-C81ewxNO.woff2   14.70 kB
dist/assets/archivo-latin-600-normal-DwYieO8P.woff    18.20 kB
dist/assets/archivo-latin-800-normal-DZa_k145.woff    18.90 kB
dist/assets/archivo-latin-400-normal-Bl602Mgc.woff    18.97 kB
dist/assets/index-BJ7rjkdB.css                       102.98 kB │ gzip:  18.44 kB
dist/assets/index-eNTA4QaH.js                        692.97 kB │ gzip: 206.15 kB
✓ built in 683ms
```

## 5. Acceptance checklist
- [x] `GET /api/reports/{report_id}/chunks/{chunk_id}` exists and returns `ChunkOut`. It gives 404 for a chunk of another report and for another persona, and 422 without `user_id`: PASS (tested in `test_report_chunk.py`).
- [x] `reportsApi.chunk` exists and calls exactly that path with `user_id`: PASS (added to `site design/src/api/reports.ts`).
- [x] Full suite: baseline + 3. No existing test was edited: PASS (207 + 3 = 210 passed).

## 6. Things that surprised me
None; the schema, service, and routes integrated cleanly with existing `report_chunks` table and tests passed on the first run.

## 7. Deviations from the task
none

## 8. Open questions for the reviewer
none

## 9. How the reviewer can double-check
1. Run `git diff redesign/modernist-app...HEAD` (or review commit diff) to inspect changes.
2. `& "F:\kiruthika\kiruthika final project\vitagraph\backend\.venv\Scripts\python.exe" -m pytest vitagraph/backend/tests/test_report_chunk.py -q -p no:cacheprovider`
3. `$env:AI_SERVICE_API_KEY = "test-placeholder-key"; & "F:\kiruthika\kiruthika final project\vitagraph\backend\.venv\Scripts\python.exe" -m pytest vitagraph/backend/tests -q -p no:cacheprovider`
4. `cd "site design"; npm run build`
