<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task C2 — Upload page lists exactly the six stages, each with its real output

- **Goal:** The Upload page shows the six pipeline stages (Received, Extracted, Chunked, Embedded, Indexed, Graphed), each with the output of its real event. Asking is a button after the stages, never a seventh stage.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** A9, C1
- **Files to read first:**
  - `site design/src/pages/UploadPage.tsx`
  - `site design/src/hooks/useJobStream.ts`
  - `vitagraph/backend/app/services/report_service.py` lines 277–355 (anchor `def _chunk_payload(`)
- **Files to create or modify:**
  - create `site design/src/components/upload/stages.ts`
  - modify `site design/src/pages/UploadPage.tsx`

**What to change**
1. **Create `site design/src/components/upload/stages.ts`.** It exports:
   - **`STAGES`:** a read-only list of six entries, in order. Each entry has:
     - `key`, the backend stage name: `received`, `extracted`, `chunked`, `embedded`, `indexed` or `graphed`;
     - `name`, the title-case label: Received, Extracted, Chunked, Embedded, Indexed, Graphed. These equal the names in `INITIAL_STEPS`.
     - `what`, one plain sentence:
       - Received: "The file is stored unchanged and its SHA-256 fingerprint is taken."
       - Extracted: "Text is read from every page, with OCR for scanned pages."
       - Chunked: "The text is cut into passages that keep their page and character positions."
       - Embedded: "Each passage becomes a vector for meaning-based search."
       - Indexed: "The vectors are stored for this persona only."
       - Graphed: "Reports, tests and values are linked in the knowledge graph."
   - **Type `StageState`:** `"waiting"`, `"running"`, `"done"` or `"failed"`.
   - **`stageState(stream, key)`:** derives the state from `stream.steps` (`pending` gives waiting, `active` running, `done` done). A stage the hook marked `quarantined` or `interrupted` while the stream status is `error` gives failed. This is the same rule as today's `stepStopped` at `site design/src/pages/UploadPage.tsx` lines 166–169 (anchor `const stepStopped = (stepName: string) => {`).
   - **`stageEvent(stream, key)`:** returns the last event in `stream.events` whose `stage` equals the key, or null.
   - **`stageOutput(stream, key)`:** the one-line real output of a finished stage, or null while it is not done. All values come from that stage's event metadata:
     - received: "SHA-256 <first 8>…<last 4>, version <version>";
     - extracted: "<page_count> pages, <n> with a text layer, <m> read by OCR, <u> uncertain", counted from `metadata.pages[].method` and `quality`;
     - chunked: "<total_chunks> passages";
     - embedded: "<count> vectors, <dim> dimensions";
     - indexed: "<indexed> passages indexed for this persona";
     - graphed: "<total_nodes> nodes, <total_edges> edges", or the metadata `error` text.
2. **Remove the five-row model:** `site design/src/pages/UploadPage.tsx` lines 164–182 (anchor `const pipeRows`).
   - Delete `stepStatus`, `stepStopped` and `pipeRows`.
   - Delete `nativePagesCount`, `ocrPagesCount` and `totalChunks` (lines 159–161, anchor `const nativePagesCount`) when nothing else uses them.
3. **Six rows:** `site design/src/pages/UploadPage.tsx` lines 295–317 (anchor `{pipeRows.map((r, i) => {`). Inside the `upload-pipeline` container (task A9), render one row per entry of `STAGES`, in the same grid layout as today (number, text, tag). Each row:
   - has `data-testid="upload-stage-row"` and `data-state` set to the stage state;
   - shows the two-digit number, the stage name in bold, and below it `stageOutput` when the stage is done or `what` otherwise;
   - shows a `Tag`: done gives "Done" (tone done), running "Running" (running), failed "Failed" (failed), waiting "Waiting" (waiting).
4. **Ask after the stages:** after the six rows, when the stream status is `completed` and a report ID is known, show a `btn btn-primary` button "Ask about this report" with `data-testid="upload-ask"`. It navigates exactly like the existing "Ask about this report" button (`/agent?report=<id>`). It is a button, not a row.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser: upload `synthetic_panel_2025-06-20.pdf` with Cinematic ingestion off.
   - Six rows run in order.
   - Each finished row shows numbers that equal the values in the job's events. Read them from `GET /api/jobs/<job_id>` (the `events` list) and paste them.
   - "Ask about this report" appears after Graphed.
3. In the console, `document.querySelectorAll('[data-testid="upload-stage-row"]').length` returns 6.

**Acceptance criteria**
- [ ] Exactly six stage rows exist, named exactly Received, Extracted, Chunked, Embedded, Indexed and Graphed.
- [ ] Every number in a row equals the matching event's metadata (pasted).
- [ ] "Ask about this report" is a button (`upload-ask`), not a stage.
- [ ] The build exits 0.
