# P6a summary: streamed Text to Graph (backend) and removal of old UI code

Branch `feature/playground-graph-and-backgrounds`. Nothing committed, staged, pushed or reset.

## Part A: streaming route

**Route:** `POST /api/tools/graph/stream`, body `{text}`. The gates (`graph_ai.check_input`) run before the stream opens, so refusals are plain HTTP errors: 400 empty, 413 too long, 409 AI off or no key. Nothing is sent to the model in those cases. Then `StreamingResponse(sse_stream(graph_ai.stream_graph(text)))` with `Cache-Control: no-cache` and `X-Accel-Buffering: no`. The old `POST /api/tools/graph` is unchanged in behaviour and shape.

**Events (wire name → payload):**
- `status` `{phase: "reading"}` at once; `{phase: "writing"}` at the first model text.
- `title` `{title}` (max 60 chars), once.
- `node` `{id, label, type, start, end, quote}` per accepted entity.
- `edge` `{source, target, label, start, end, quote}` per accepted relation (both ends must already be sent).
- `completed` (from `done`) `{status: "ai", title, nodes, edges, dropped}`.
- `error` `{message, status}` only on failure: 502 model call failed, 502 unreadable reply, 422 nothing accepted. The messages are the same as `build_graph`. Nodes already sent stay valid.

**Model output:** `STREAM_SYSTEM_PROMPT` asks for JSON Lines (`{"t":"title"…}`, `{"t":"entity"…}`, `{"t":"relation"…}`), called with `stream=True`, `temperature=0.1`, and `reasoning_effort="minimal"` on the Responses format. The old `SYSTEM_PROMPT` is kept.

**Shared rules:** `GraphAccumulator` (`accept_entity`, `accept_relation`, `full`, `dropped`) now holds every check. `validate()` calls it, so both routes share one rule set.

**Parsing:** lines are split on newlines. Lines that are not JSON objects are ignored (fences, prose). The last unterminated line is flushed at the end. If no line has a `t` field, the whole reply is parsed as the old one-object shape and sent through the same accumulator (nodes, then edges). This is tested for single-line and pretty-printed JSON.

**Stopping:** reading stops when both caps are full (40 nodes, 60 edges). It also stops when the client disconnects or the reply ends. The `finally` closes the model stream.

**Design decision:** caps are checked as "both full", not "either full", because a relation-only tail can still be accepted after the entity cap is reached.

## Live proof (real model, backend restarted on 8000)

Input: a five-sentence paragraph about a clinic visit. Timings are client-side, measured from the request.

| Event | Time |
|---|---|
| `status` reading | 0.03 s |
| `status` writing (first model text) | 10.50 s |
| `title` | 10.90 s |
| first `node` | 11.06 s |
| last `node` | 14.40 s |
| last `edge` | 14.57 s |
| `completed` | 14.79 s |

Totals: 10 nodes, 9 edges, `dropped: 0`, title "Clinic visit with headaches dizziness". Nodes and edges arrived one at a time, interleaved, over about 3.9 s after the first output. The 10.5 s before the first text is the model's own time to start writing. It is not a burst.

## Tests

- `tests/test_graph_ai.py`: 15 passed, unchanged.
- `tests/test_graph_ai_stream.py` (new): 15 passed. It covers event order, split lines, fences and stray lines, unterminated last line, dropped quotes, relation before entities, caps with early close of the model stream, privacy off / no key / empty / too long (no model call), model failure after two nodes (two `node`, then `error`, no key in output, stream closed), unreadable reply (502), nothing found (422), single big JSON object (both layouts), and the old route's shape.
- Full backend suite: **418 passed** (403 before this session + 15 new). No P4a tests were in the tree during the run.

## Part B: cleanup

**Deleted, with the grep proof run after the edits:**
- `components/upload/CinematicIngestionShow.tsx`: only importer was `UploadPage.tsx`, now removed.
- `components/upload/FrameStage.tsx`: no importer.
- `components/shell/JourneyRail.tsx`: no importer.
- `api/jobs.ts`: no module import. The `/api/jobs/...` hits in `hooks/useJobStream.ts` and `components/gallery/ThinkingDetailsPanel.tsx` are backend URL strings.
- `api/questions.ts`: no importer.
- `api/timeline.ts`: no importer.
- Also checked `scripts/`, `vite.config.ts` and `tests/` (none exists in `site design`). Nothing references the deleted files.

**Edited:**
- `UploadPage.tsx`: removed the import, `isPopupOpen` state, the open call (comment renumbered 3→2) and the `<CinematicIngestionShow>` element. Nothing else changed.
- `lib/preferences.ts`: removed `cinematic` from the interface, defaults and `load()`. Other fields and validation are unchanged. An old saved `cinematic` key is ignored.
- `SettingsPage.tsx`: removed the "Cinematic ingestion" row only.

**Gates:**
- `npm run build`: exit 0 (includes `tsc -b`).
- `npm run audit:design`: 0 errors, 71 files.
- `python scripts/plan/secret_scan.py`: RESULT: PASS.

**Chrome check (1440x900):** no Chrome automation tool is available in this session, so I drove headless Chrome over the DevTools protocol with a script in the scratchpad. Steps:
- Created throwaway persona `usr_2ab3eb46f0dd` and consented it.
- Seeded localStorage with `"cinematic": true`.
- Uploaded `vitagraph/sample_data/synthetic_panel_2025-06-20.pdf` through the real file input.
- Screenshots at 1, 4, 8 and 14 s: the process theatre plays (Extracted stage, "Following your upload"). No dialog, and no full-viewport element except a background `CANVAS` at z-index 0.
- Settings: no "Cinematic" text. "Process speed" sits directly under the Ingestion header.
- Console errors, uncaught exceptions and error-level log entries: 0.
- Persona deleted (HTTP 200). Demo Cohort was not touched.

## Not done / notes

- **Not committed or staged.** Only my owned files show as changed; `git diff --cached` is empty.
- **Left as is:** the Settings "Reduce motion" helper text ("Shortens the ingestion show…"). It is another row, and the task said not to change other rows.
- **Adapter close path:** `graph_ai._close` also closes the wrapped `_chunks` generator of the Responses adapter (`responses_adapter.py`, which is outside my file list). The cap-stop close is proven only with the fake stream. The live answer had 10 nodes, below the caps, so the live run did not exercise it.
- **Backend on 8000:** I stopped the old uvicorn (PID 15300, main-folder venv) and started a new one with the new code. It is still running on 8000 (log in the scratchpad). The Vite server on 5173 was already running and I did not touch it.
- **Upload pipeline:** the throwaway upload was still in its early stages when the check ended. The persona was deleted anyway.
- **Frontend:** the `/graph/stream` route is not yet used by the UI. That is P6b.
