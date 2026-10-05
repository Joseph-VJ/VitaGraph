<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task F1 — Privacy: persona check on the older per-report routes

- **Goal:** The page, measurement and page-image routes check that the report belongs to the asking persona, and the frontend always says who is asking. This closes issue O-3 as far as rule 7 allows (decision DEC-6).
- **Tier:** Must
- **Size:** M
- **Review:** gate
- **Depends on:** A5, A9, A12, B1, B4
- **Files to read first:**
  - `vitagraph/backend/app/routes/reports.py` lines 80–95 (anchor `def report_pages(report_id: str) -> list[dict]:`)
  - `vitagraph/backend/app/services/report_service.py`, the helper `assert_report_owner` added in B1
  - `vitagraph/backend/tests/test_journey_events.py` lines 75–85 (anchor `def test_page_image_endpoint_serves_png():`)
  - `vitagraph/backend/tests/test_measurements.py` lines 21–46 (anchor `def test_measurements_unknown_report_is_404():`)
  - `site design/src/api/reports.ts` lines 91–114 (anchor `export const reportsApi = {`)
- **Files to create or modify:**
  - modify `vitagraph/backend/app/routes/reports.py`
  - modify `site design/src/api/reports.ts`
  - modify `site design/src/pages/LibraryPage.tsx`
  - modify `site design/src/pages/UploadPage.tsx`
  - modify `site design/src/pages/AgentPage.tsx`
  - modify `site design/src/pages/TimelinePage.tsx`
  - modify `site design/src/components/gallery/DocumentPanel.tsx`
  - create `vitagraph/backend/tests/test_report_route_privacy.py`

**What to change**
1. **Backend:** `vitagraph/backend/app/routes/reports.py` lines 80–95 (anchor `def report_measurements(report_id: str) -> list[dict]:`).
   - The routes `/{report_id}/pages`, `/{report_id}/measurements` and `/{report_id}/pages/{page_number}/image` gain an optional query parameter `user_id`.
   - When it is given, the route calls `user_service.user_exists(user_id)`, then `report_service.assert_report_owner(report_id, user_id)` (404 "Report not found." for another persona's report), then does what it does today.
   - When it is absent, the behaviour is unchanged. Three existing tests call these routes without it, and rule 7 forbids editing them. Making it required is decision DEC-6.
2. **Client:**
   - `reportsApi.pages` becomes `pages(userId, reportId)`, and `reportsApi.measurements` becomes `measurements(userId, reportId)`. Both always send `?user_id=`.
   - Update every caller:
     - `site design/src/pages/LibraryPage.tsx` line 70 (anchor `const data = await reportsApi.measurements(reportId);`) and line 96 (anchor `reportsApi.pages(selected.id)`);
     - `site design/src/pages/AgentPage.tsx` line 222 (anchor `pending = reportsApi.pages(reportId);`);
     - the page loads added to `UploadPage.tsx` in A9;
     - the measurement loads added to `TimelinePage.tsx` in A12 and to `DocumentPanel.tsx` in B4.
   - Search with `Get-ChildItem "site design\src" -Recurse -Include *.ts,*.tsx | Select-String 'reportsApi\.(pages|measurements)\('` and update every hit.
3. **Tests:** create `vitagraph/backend/tests/test_report_route_privacy.py`, with two personas each uploading one sample panel:
   - **`test_pages_refuse_another_persona`:** `GET /api/reports/{report_id}/pages` for A's report with B's `user_id` returns 404.
   - **`test_measurements_refuse_another_persona`:** the same check for `/measurements`.
   - **`test_page_image_refuses_another_persona`:** the same check for `/pages/1/image`.
   - **`test_the_owner_still_gets_pages_and_measurements`:** with A's own `user_id`, both return 200.

**How to verify**
1. `.venv\Scripts\python.exe -m pytest tests\test_report_route_privacy.py tests\test_measurements.py tests\test_journey_events.py -q -p no:cacheprovider`. All pass. The last two files prove the old behaviour is kept.
2. Full suite: baseline + 4.
3. `cd "site design"; npm run build`. It must exit 0.
4. Browser: in DevTools > Network on `/library`, every `/pages` and `/measurements` request carries `user_id`.

**Acceptance criteria**
- [ ] A foreign `user_id` gets 404 on all three routes.
- [ ] Every frontend call sends `user_id` (search output pasted).
- [ ] Full suite: baseline + 4. No existing test was edited.
