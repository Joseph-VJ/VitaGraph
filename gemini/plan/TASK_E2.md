<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task E2 — Image to Text page

- **Goal:** Read the text in a PNG or JPEG through the backend OCR, and show the original image (with a boxes toggle), the text, the line count, the characters and the mean confidence. Mark low-confidence lines "needs review", and offer Copy and Download .md.
- **Tier:** Should
- **Size:** M
- **Review:** light
- **Depends on:** E1, A3, A4
- **Files to read first:**
  - `design/reference/screens/07_Image_to_Text.png`
  - `vitagraph/backend/app/ingestion/ocr_fallback.py` line 68 (anchor `low_confidence = mean_confidence < 60`)
  - `site design/src/components/shell/Sidebar.tsx` lines 70–102 (anchor `const navGroups: { label: string; items: NavItem[] }[] = [`)
  - `site design/src/App.tsx`
- **Files to create or modify:**
  - create `site design/src/pages/tools/ImageToTextPage.tsx`
  - create `site design/src/lib/toolHandoff.ts`
  - modify `site design/src/App.tsx`
  - modify `site design/src/components/shell/Sidebar.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`
  - modify `site design/src/components/shell/Header.tsx`

**What to change**
1. **Create `lib/toolHandoff.ts`:** a module-level, in-memory hand-off for one image between tools: `setHandoffImage(blob, name)` and `takeHandoffImage()`, which returns it once and then clears it. Nothing is stored in the browser. Task E3 uses it.
2. **Create `pages/tools/ImageToTextPage.tsx`**, exporting `ImageToTextPage`, inside `PageFrame` with label "Image to Text".
   - **Engine check:** on mount, call `toolsApi.ocrStatus()`. When the engine is not available, show `PageState` kind offline: "The OCR engine is not available on the backend", with the detail from the status, and no input.
   - **Input:** `ToolInput` accepting `image/png` and `image/jpeg`, with the description "Choose a PNG or JPG. The image is sent to the VitaGraph backend on this computer, read in memory and never stored."
     - Files above 15 MB are refused in the page with the backend's limit text, before any request.
     - On mount, a hand-off image from `takeHandoffImage()` is read at once.
   - **While reading:** `PageState` loading "Reading the image".
   - **On error:** `PageState` error with the backend's message.
   - **Result:**
     - **Stats row:** "<n> lines read · <c> characters · <m>% mean confidence", all from the response. The characters are the length of `text`.
     - **Actions:** "Copy text" (clipboard; "Copied" for 2 s, with the timer cleared on unmount) and "Download .md". The Markdown has a title line, a line with the mean confidence, then each line, with `(needs review)` after low-confidence lines.
     - **`ToolSplit` left, "Original":**
       - the image, from an object URL that is revoked on change and on unmount;
       - a switch "Show boxes" (`data-testid="ocr-boxes-toggle"`) that overlays each line's box as an absolutely positioned outline, scaled from the 0–1 coordinates;
       - boxes of low-confidence lines are drawn in `--color-accent`, the others in `--color-text`.
     - **`ToolSplit` right, "Text":** one row per line with the text and its confidence.
       - A line below 60% confidence is low confidence. That is the same threshold the backend uses to mark a scanned page uncertain.
       - A low-confidence line gets `Tag` tone `uncertain` reading "Needs review", plus `data-review="true"`.
       - The line text is never changed or "corrected".
3. **Route and navigation:**
   - In `App.tsx`, add the route `/tools/image-to-text`, with the page lazy-loaded.
   - In `Sidebar.tsx`, add a group "Tools" between "Analyze" and "System", with the item `{ id: "ocr", path: "/tools/image-to-text", label: "Image to Text", sublabel: "Picture to text" }`. Use the reference's icon path from line 1406 (anchor `['ocr', 'Image to Text'`).
   - Add the route title "Image to Text" to `ROUTE_TITLES`, and the path to `OWN_LAYOUT`.
   - Add a `Header.tsx` case with the subtitle "Read the text in a picture."

**How to verify**
1. `cd "site design"; npm run build; npm run audit:design`. Both must exit 0.
2. Browser:
   - Open PDF to Text after E3, or for now any PNG of a lab report.
   - Choose it. The stats match the `POST /api/tools/ocr` response in DevTools: line count, `mean_confidence`, and `text` length.
   - "Show boxes" draws one outline per line.
   - Every line below 60 shows "Needs review".

**Acceptance criteria**
- [ ] The three stats equal the API response (pasted).
- [ ] Low-confidence lines are marked and never altered.
- [ ] Copy and Download .md work.
- [ ] The boxes toggle works.
- [ ] The engine-unavailable state shows when `available` is false.
- [ ] The build and the audit exit 0.
