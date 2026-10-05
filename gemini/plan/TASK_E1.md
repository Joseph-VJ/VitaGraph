<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task E1 — Tools: shared parts and the API client

- **Goal:** Add the OCR API client and the two layout pieces all three Tools pages share: the input band and the original-and-text split.
- **Tier:** Should
- **Size:** S
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `vitagraph/backend/app/routes/tools.py`
  - `vitagraph/backend/app/ingestion/ocr_image.py` lines 36–86 (anchor `def read_image(data: bytes) -> dict:`)
  - `design/reference/app-v3-source.html` lines 713–737 (anchor `IMAGE TO TEXT`)
  - `site design/src/api/client.ts`
- **Files to create or modify:**
  - create `site design/src/api/tools.ts`
  - create `site design/src/components/tools/ToolInput.tsx`
  - create `site design/src/components/tools/ToolSplit.tsx`

**What to change**
1. **Create `api/tools.ts`.** It holds the interfaces `OcrLine` (`text`, `confidence`, `box` with `x0`, `y0`, `x1`, `y1`), `OcrResult` and `OcrStatus`, and an object `toolsApi` with:
   - `ocrStatus()`, calling `GET /api/tools/ocr/status`;
   - `ocr(file)`, calling `POST /api/tools/ocr` with a form field named `file`, through `api.upload`.
2. **Create `ToolInput.tsx`.** It mirrors the reference's dashed input band.
   - **Props:** `label` (the kicker, for example "Input"), `description`, `accept` (a MIME list), `chooseLabel`, `onFile(file)`, an optional `secondary` button (label and handler), and `disabled`.
   - **Rendering:**
     - a band with a 2 px dashed `--color-divider` border and `--color-surface` background;
     - a visually hidden file input inside a `label` styled `btn btn-primary`, reachable with the keyboard as on the Upload page;
     - drag and drop of one file;
     - `data-testid="tool-input"`.
3. **Create `ToolSplit.tsx`.**
   - **Props:** `left` and `right`, each a section with a `title`, an optional `aside` and `children`.
   - **Layout:** the reference's two-column grid `repeat(auto-fit,minmax(min(380px,100%),1fr))`. Each column has a 2 px top rule in `--color-text` and a header row with the title and the aside.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.

**Acceptance criteria**
- [ ] `toolsApi` calls exactly `GET /api/tools/ocr/status` and `POST /api/tools/ocr`.
- [ ] `ToolInput` is keyboard-usable.
- [ ] The build exits 0.
