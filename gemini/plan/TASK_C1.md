<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task C1 — Job stream hears named events and shows only real stage values

- **Goal:** `useJobStream` receives `page_extracted`, `completed` and `error` the moment they are sent, and fills each stage's value only from event data.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `site design/src/hooks/useJobStream.ts`
  - `vitagraph/backend/app/services/job_service.py` lines 59–201 (anchor `def publish_event(`)
  - `vitagraph/backend/app/services/report_service.py` lines 28–262 (anchor `def process_upload(`)
- **Files to create or modify:**
  - modify `site design/src/hooks/useJobStream.ts`

**What to change**
1. **Shared parser:** `site design/src/hooks/useJobStream.ts` lines 268–284 (anchor `es.onmessage = (e) => {`).
   - Move the body of `onmessage` into a local function `handleData(raw: string)`. It parses the JSON, marks the stream done for `stage === "done"` and for status completed, error or failed, pushes the event onto the queue, and starts the queue when it is idle.
   - `onmessage` calls `handleData(e.data)`.
   - Register `es.addEventListener("page_extracted", …)` and `es.addEventListener("completed", …)`, each calling `handleData` with the event's `data`.
2. **Named "error" event:** `site design/src/hooks/useJobStream.ts` lines 345–356 (anchor `es.onerror = () => {`). A broker event named `error` reaches `onerror` as a `MessageEvent` that carries `data`. A dropped connection reaches it as a plain `Event` without data.
   - Give the handler an event parameter.
   - When the event is a `MessageEvent` whose `data` is a non-empty string, call `handleData` with it and return.
   - Otherwise keep today's recovery logic unchanged.
3. **Per-page progress:** in `processQueue`, `site design/src/hooks/useJobStream.ts` lines 145–177 (anchor `if (evt.stage) {`), handle stage `extracting` (the `page_extracted` events). While Extracted is active, set its value to "page <page_number> of <total_pages>" from the event metadata.
4. **Real stage values:** `site design/src/hooks/useJobStream.ts` lines 148–177 (anchor `value: "ChromaDB ok"`). Every value now comes from the event that finished the stage:
   - **Received:** the event's `latency` (or "stored" when it is empty).
   - **Extracted:** "<page_count> pages" from metadata.
   - **Chunked:** "<total_chunks> chunks".
   - **Embedded:** "<count> vectors, <dim> dimensions".
   - **Indexed:** "<indexed> indexed".
   - **Graphed:** "<total_nodes> nodes, <total_edges> edges". When graphed metadata carries `error`, show "graph not built" instead.
   - A running stage shows "running".
   - Delete "verified", "parsing layout…", "ChromaDB ok", "NetworkX mapped" and "384-dim".
   - Keep the order and the six names of `INITIAL_STEPS`.
5. **Done event:** `site design/src/hooks/useJobStream.ts` lines 178–208 (anchor `const pageCount = evt.metadata?.pages`).
   - Remove the `|| 1` fallbacks. Page and chunk counts are taken from the metadata, or stay `null` when missing.
   - The final step list keeps each stage's value as already set by step 4, and only marks all six as done.
   - The `finalMetadata` keys `pages`, `chunks` and `reportId` keep their names. `UploadPage` reads `reportId`.
6. **Event type:** `site design/src/hooks/useJobStream.ts` lines 5–13 (anchor `export interface JobStreamEvent`). Replace `Record<string, any>` with `Record<string, unknown>`. Narrow values where they are read: numbers with `typeof … === "number"`, strings with `typeof … === "string"`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser, both servers running: upload `vitagraph/sample_data/synthetic_panel_2025-01-15.pdf` with Cinematic ingestion off (Settings).
   - The Extracted row counts pages while it runs.
   - The stream finishes without a 1.5 s pause after Graphed. In DevTools > Network, the `/api/jobs/<id>/result` request must **not** appear.
3. Upload a text file renamed to `bad.pdf`. The failure shows the backend's real message ("Ingestion failed: The file could not be read as a PDF …") at once, again with no `/result` request.

**Acceptance criteria**
- [ ] `page_extracted`, `completed` and named `error` events are handled, and no `/result` polling happens on a healthy stream.
- [ ] `Select-String -Path "site design\src\hooks\useJobStream.ts" -Pattern 'ChromaDB ok|NetworkX mapped|384-dim|\|\| 1\b|Record<string, any>'` prints nothing.
- [ ] The build exits 0.
