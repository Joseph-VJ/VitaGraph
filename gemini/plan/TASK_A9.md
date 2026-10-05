<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task A9 — Upload: no demo fallback, no invented report, "Uncertain" pages, shared states

- **Goal:** The Upload page shows only real data for the active persona. After a job it shows the stored report instead of an invented object, labels uncertain pages "Uncertain", and uses the shared frame, tags and section head.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `site design/src/pages/UploadPage.tsx`
  - `site design/src/hooks/useJobStream.ts` lines 17–30 (anchor `export interface UseJobStreamReturn`)
  - `site design/src/api/reports.ts` lines 64–73 (anchor `export interface DemoCohortResult`)
  - `vitagraph/backend/app/ingestion/extractor.py` lines 140–163 (anchor `method, quality = "native", "good"`)
  - `vitagraph/backend/app/services/report_service.py` lines 380–390 (anchor `ORDER BY r.upload_time DESC`)
- **Files to create or modify:**
  - modify `site design/src/pages/UploadPage.tsx`

**Facts this task relies on:**
- `GET /api/reports?user_id=` returns reports newest upload first (`ORDER BY r.upload_time DESC` in `report_service.py`).
- The extractor writes `extraction_method` as `native`, an OCR method such as `ocr-tesseract` or `ocr-rapid`, or `uncertain`. It writes `quality` as `good` or `uncertain`.
- `POST /api/demo/cohort` returns `user_id`, `display_label`, `reports_ingested`, `report_ids`, `nodes`, `edges`, `communities` and `modularity`.

**What to change**
1. **Imports:** `site design/src/pages/UploadPage.tsx` lines 1–10 (anchor `import { CinematicPipelinePopup, useToast } from "../components/gallery";`).
   - Import `CinematicPipelinePopup` directly from `../components/gallery/CinematicPipelinePopup`, and `useToast` from `../components/gallery/Toast`. The barrel `../components/gallery` would make the audit, and the bundle, pull in every old gallery component.
   - Add an import of `PageFrame`, `PersonaState`, `SectionHead`, `Tag` and the type `TagTone` from `../components/ui`.
2. **Module-level helpers**, placed above the component:
   - Move `fmtSize` up from inside the component (`site design/src/pages/UploadPage.tsx` lines 156–157, anchor `const fmtSize`).
   - Add `sourceTag(page)`, which returns a label and a tone:
     - `native` gives "Native text", tone neutral;
     - any method containing `ocr` gives "OCR", tone hot;
     - `uncertain` gives "Uncertain", tone uncertain;
     - anything else gives the stored text, tone neutral.
     
     Give it the doc comment "How a page was read. An uncertain page stays Uncertain (plan rule 4)."
   - Add `qualityTag(page)`: `uncertain` gives "Uncertain", tone uncertain. Anything else gives the stored text with its first letter in capitals, tone neutral.
   - Move the arrow icon `svg` from the "Ask about this report" button (`site design/src/pages/UploadPage.tsx` lines 339–342, anchor `<path d="M5 12h14" /><path d="m12 5 7 7-7 7" />`) into a module-level constant `arrowIcon`, and use it in the button.
3. **Persona and fallback:** `site design/src/pages/UploadPage.tsx` lines 14–15 (anchor `|| "VG-2026-001"`).
   - Read `user`, `loading` (as `personaLoading`) and `refreshUsers` from the context. `setUser` is no longer needed.
   - Replace `effectiveUserId`, which falls back to localStorage and then to the demo ID, with `userId = user?.id ?? null`.
   - Rename every later use of `effectiveUserId` in this file to `userId`.
   - Move the `dragOver` state up next to the other state (it sits at `site design/src/pages/UploadPage.tsx` line 154, anchor `const [dragOver, setDragOver] = useState(false);`).
4. **Job-finished effect:** `site design/src/pages/UploadPage.tsx` lines 30–67 (anchor `"verified_digest"`).
   - **On success**, when the job's `reportId` is a non-empty string and a persona is active:
     1. Load that report's pages with `reportsApi.pages` (an empty list on failure).
     2. Load `reportsApi.list(userId)`.
     3. Set the active report to the list entry whose `id` equals the job's report ID, or to null when it is not there.
     
     Delete the invented object entirely. It made up `file_hash` ("verified_digest"), `report_date` (today), `version` and `page_count`.
   - **On error:**
     - The quarantine reason is the stream's error, or "The report could not be processed." when the stream has none.
     - The toast is `addToast("failed", "Report quarantined", reason)`.
   - The dependency list uses `userId` instead of `effectiveUserId`.
5. **Demo cohort:** `site design/src/pages/UploadPage.tsx` lines 69–94 (anchor `const handleLoadDemoCohort = async () => {`).
   - After the cohort loads, write `res.user_id` to localStorage under `vitagraph_user_id`, then await `refreshUsers()`. `refreshUsers` selects the saved persona from the real list (`site design/src/context/UserContext.tsx` lines 27–51, anchor `const matched = list.find((u) => u.id === savedId) || list[0];`).
   - Delete the hand-built persona object, which invented `consent_accepted`, `created_at` and `status`.
   - The success toast is "Demo cohort loaded", with the detail "<reports_ingested> synthetic reports labelled demo data: <nodes> nodes, <edges> edges.". Today it hard-codes "2 synthetic panels".
   - The failure toast is "Demo cohort not loaded" with the error message.
   - The navigation to `/graph` stays.
6. **Initial load:** `site design/src/pages/UploadPage.tsx` lines 96–112 (anchor `// On initial mount, load existing report pages for the persona`). Replace it with an effect on `[userId]`:
   - Do nothing without a persona.
   - Otherwise clear the pages and the active report, then load `reportsApi.list(userId)`. When the list is not empty, make its first entry (the newest upload) active and load its pages.
   - Use a `cancelled` flag that the cleanup sets, and check it before every state update.
   - On failure, keep an empty page list. There is no `console` call anywhere.
7. **`handleFileSelect`:** `site design/src/pages/UploadPage.tsx` lines 114–152 (anchor `const handleFileSelect = async (selectedFile: File) => {`).
   - Return at once when there is no persona.
   - Upload with `userId`.
   - On a `failed` response and on a thrown error:
     - add the quarantine row as today;
     - show the toast "Report quarantined" with the reason (failed response) or "Upload rejected" with the error (thrown error);
     - call `jobStream.reset()`, so the stream from step 1 of the function is closed and its timers are cleared.
   - The thrown-error reason is the error message itself. Delete the invented "Security validation rejected file:" prefix.
   - Reword the three numbered comments to:
     1. "Subscribe to the job's event stream before the upload starts."
     2. "Open the full-screen show, unless "Cinematic ingestion" is off in Settings."
     3. "Send the file; the backend runs the pipeline in the background."
8. **Tags:** `site design/src/pages/UploadPage.tsx` lines 184–195 (anchor `const tagStyle = (kind:`).
   - Delete `tagStyle`. `fileTag` returns a `tone` (`failed`, `done`, `running`, `waiting`) instead of a `kind`.
   - After the `fileTag` line, add the persona gate: when `userId` is null, return `PersonaState` inside `PageFrame` with label "Upload".
9. **Root:** `site design/src/pages/UploadPage.tsx` lines 197–201 (anchor `data-screen-label="Upload"`) and the closing tag at line 395 (anchor `</div>`). The root becomes `PageFrame` with label "Upload".
10. **Left column:** `site design/src/pages/UploadPage.tsx` line 204 (anchor `flex: "0 0 320px"`). Change its flex to `0 1 320px` and add `minWidth: 0`, so it can shrink below 320 px on a phone.
11. **Tags in the left column:** `site design/src/pages/UploadPage.tsx` lines 262–316 (anchor `{fileTag.label}`).
    - The file tag, the quarantine tag and the stage tags all render `Tag` with the matching tone.
    - The pipeline list `div` at line 295 gets `data-testid="upload-pipeline"`.
    - The pipeline rows keep their current five entries in this task. Task C2 replaces them with the six real stages.
    - Keep these test IDs: `upload-dropzone`, `upload-file-input`, `upload-quarantine-row`.
12. **Pages section:** `site design/src/pages/UploadPage.tsx` lines 326–377 (anchor `{pages.length > 0 && (`).
    - The section becomes a `section` element whose heading is `SectionHead` titled "Pages", with the two existing buttons ("Ask about this report" and "Open library") in its `aside`, in a wrapping flex row with gap `var(--space-2)`.
    - The table sits inside a `div` with class `vg-scroll-x`. It gets `data-testid="upload-pages-table"` and an inline `minWidth` of 420.
    - The Source cell renders `Tag` from `sourceTag`, and the Quality cell renders `Tag` from `qualityTag`. Today "No text" replaces "Uncertain" (`site design/src/pages/UploadPage.tsx` line 366, anchor `"No text"`).
13. **Frame stage (decision DEC-3):** remove the right column, `site design/src/pages/UploadPage.tsx` lines 320–323 (anchor `<FrameStage />`). Also remove its import at line 9 (anchor `import { FrameStage } from "../components/upload/FrameStage";`).
    - The project has no frame images, so today the stage shows the developer text "Frames go in assets/frames…" (`site design/src/components/upload/FrameStage.tsx` line 187, anchor `Frames go in assets/frames`).
    - The left column then grows to fill the row: change its flex to `1 1 320px` and set its max width to 720 px.
    - Keep `FrameStage.tsx` in the repository, unused, so that supplying frames later only needs the column back.
14. **Popup:** keep the `CinematicPipelinePopup` block (`site design/src/pages/UploadPage.tsx` lines 379–394, anchor `<CinematicPipelinePopup`) unchanged, except that `userId={user?.id}` becomes `userId={userId ?? undefined}`. Task C3 replaces the popup.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. `Select-String -Path "site design\src\pages\UploadPage.tsx" -Pattern 'VG-2026|verified_digest|console\.|No text|FrameStage'` prints nothing.
3. Browser, both servers running, as "Empty Test Persona":
   - Upload `vitagraph/sample_data/VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf`.
   - After the job, the Pages table lists every page.
   - Each page's Source and Quality tags match `GET /api/reports/<report_id>/pages` exactly. Paste the JSON next to a screenshot; an `uncertain` page must read "Uncertain".
4. The file row's details match `GET /api/reports?user_id=usr_51f14542d71a` for the new report: same filename, and no invented hash or date anywhere.

**Acceptance criteria**
- [ ] No demo persona ID, no invented report object and no `console` call remain in the file.
- [ ] A page whose `extraction_method` or `quality` is `uncertain` is labelled "Uncertain" with the uncertain tone.
- [ ] A failed upload closes the job stream (`jobStream.reset()` is called on both failure paths).
- [ ] Keep these test IDs: `upload-dropzone`, `upload-file-input`, `upload-quarantine-row`.
- [ ] The new test IDs `upload-pipeline` and `upload-pages-table` exist.
- [ ] The build exits 0.
