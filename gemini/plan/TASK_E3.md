<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task E3 — PDF to Text page (in the browser, with pdfjs-dist)

- **Goal:** Read a PDF's text layer page by page in the browser, show the pages and their text, and send a scanned page (one with no text layer) to Image to Text.
- **Tier:** Should
- **Size:** M
- **Review:** light
- **Depends on:** E2
- **Files to read first:**
  - `design/reference/screens/08_PDF_to_Text.png`
  - `design/reference/app-v3-source.html` line 1355 (anchor `tag: g.native ? 'Native text' : 'No text layer'`)
  - `site design/public/` (the sample PDFs)
  - `site design/src/lib/toolHandoff.ts`
- **Files to create or modify:**
  - modify `site design/package.json`
  - modify `site design/package-lock.json`
  - create `site design/src/pages/tools/PdfToTextPage.tsx`
  - modify `site design/src/App.tsx`
  - modify `site design/src/components/shell/Sidebar.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`
  - modify `site design/src/components/shell/Header.tsx`

**Facts checked by the planner (pdfjs-dist 6.4.299):**
- The entry point is `build/pdf.mjs`, with types at `types/src/pdf.d.ts`, and the worker file is `build/pdf.worker.min.mjs`.
- `GlobalWorkerOptions.workerSrc` must be set.
- `page.render` takes `{ canvas, viewport }`, where `canvas` is required.
- The package's `engines` field asks for Node 22.13 or later. The planner's machine has Node 22.22.

**What to change**
1. **Install:** run `npm install pdfjs-dist@6.4.299 --save-exact` in `site design`. Rule 10 allows exactly this version.
2. **Create `pages/tools/PdfToTextPage.tsx`**, exporting `PdfToTextPage`, lazy-loaded so pdf.js stays out of the main bundle.
   - Set the worker with a Vite `?url` import of `pdfjs-dist/build/pdf.worker.min.mjs`.
   - Load the file with `getDocument({ data })` from the chosen file's bytes.
   - **Input:** `ToolInput` accepting `application/pdf`, with the description "The text layer is read page by page in your browser. Nothing is uploaded." That is true here, because pdf.js runs in the browser.
   - **Secondary buttons:**
     - "Use sample report" loads `/synthetic_panel_2025-01-15.pdf`;
     - "Use scanned sample" loads `/VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf`.
     
     Both files already exist in `site design/public/`.
   - **Per page:**
     - Read `getTextContent()` and join the items' `str`, adding a line break where `hasEOL` is set.
     - Count the characters.
     - Render a thumbnail at a width of 380 px into a canvas.
     - At most 30 pages are processed. A note says "Showing the first 30 of <n> pages." when there are more.
   - **Rows:** each page is one `ToolSplit` row, with "Original p.<n>" on the left (the canvas) and "Text p.<n>" on the right, with `Tag` "Native text" when the text layer has at least 1 character.
   - **Pages with no text layer:**
     - The tag reads "No text layer" in tone `uncertain`.
     - A button "Read with Image to Text" (`data-testid="pdf-send-to-ocr"`) renders that page at scale 2 into a canvas and turns it into a PNG blob.
     - It then calls `setHandoffImage(blob, "<file> p.<n>.png")` and navigates to `/tools/image-to-text`.
   - **Summary row:** "<name> · <c> characters · <n> pages", with "Copy all" and "Download .md". The Markdown is one "## Page n" section per page.
   - **Cleanup:** destroy the pdf.js document (`loadingTask.destroy()`) on change and on unmount. Revoke object URLs. Cancel pending page renders.
   - **States:** loading "Reading the PDF", and error with pdf.js's message.
3. **Route and navigation:** as in E2, add:
   - the route `/tools/pdf-to-text`;
   - the sidebar item `{ id: "pdf", label: "PDF to Text", sublabel: "Digital text layer" }` with the reference icon (line 1406, anchor `['pdf', 'PDF to Text'`);
   - the title "PDF to Text" in `ROUTE_TITLES`, and the path in `OWN_LAYOUT`;
   - a header subtitle "Read the text layer of a PDF."

**How to verify**
1. `cd "site design"; npm run build; npm run audit:design`. Both must exit 0, and the build output shows pdf.js in its own chunk.
2. Browser:
   - "Use sample report" shows each page with text that contains "Vitamin D, 25-Hydroxy". The page count equals the PDF's real page count.
   - "Use scanned sample" marks the scanned page(s) "No text layer". "Read with Image to Text" opens Image to Text with that page and reads it.

**Acceptance criteria**
- [ ] `pdfjs-dist` is at exactly 6.4.299, and no other package changed.
- [ ] Text and counts come from pdf.js.
- [ ] The scanned page is handed to Image to Text in memory.
- [ ] The document is destroyed on unmount.
- [ ] The build and the audit exit 0.
