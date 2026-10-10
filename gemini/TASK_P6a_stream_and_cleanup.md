# TASK P6a: live (streamed) Text to Graph on the backend, and removal of old unused pages/code

Branch `feature/playground-graph-and-backgrounds`. **Do NOT commit, push, stash or reset.** No sub-agents. Never touch `vitagraph/backend/.env` or `site design/tsconfig.tsbuildinfo`. Never edit an existing backend test to make it pass (add new tests only). Frontend dev server is on 5173; if you change backend code, stop and restart the backend on 8000 (do not open another port).

This session can run at the same time as P4a and P4b because the files are disjoint. P6b (the frontend of the same feature) runs LATER, after P5.

Files you own (nothing else): `vitagraph/backend/app/services/graph_ai.py`, `vitagraph/backend/app/routes/tools.py`, `vitagraph/backend/tests/test_graph_ai_stream.py` (NEW), and for the cleanup: `site design/src/pages/UploadPage.tsx`, `site design/src/pages/SettingsPage.tsx`, `site design/src/lib/preferences.ts`, `site design/src/components/upload/CinematicIngestionShow.tsx` (delete), `site design/src/components/upload/FrameStage.tsx` (delete), `site design/src/components/shell/JourneyRail.tsx` (delete), `site design/src/api/jobs.ts`, `questions.ts`, `timeline.ts` (delete).

---
## PART A: stream the AI graph while the model is still reading (backend)

### Why
Today `POST /api/tools/graph` makes ONE blocking model call (about 10 s) and returns the whole graph at once. The owner wants the graph to appear in real time: each entity and each link shows up the moment the model writes it, with the exact-quote check done per item. The old route stays (its tests stay green); add a streaming sibling.

### A1. New route `POST /api/tools/graph/stream` (same body `GraphTextRequest {text}`)
- Run the SAME gates as `build_graph` BEFORE streaming starts and raise `HTTPException` with the same status/messages as `GraphAIError` (400 empty, 413 too long, 409 AI off / no key). Sends nothing to the model when the privacy switch is off.
- Then return `StreamingResponse(sse_stream(events), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})`, built exactly like `POST /api/graph/node-summary` in `app/routes/graph.py` (read it and `app/core/sse.py`; `sse_stream` takes an async iterator of `(event_type, payload)` and maps `"done"` to the wire event `completed`).
- Events (payloads go into `metadata`, the frame format is whatever `sse_stream` already produces):
  1. `status` `{phase: "reading"}` immediately; `{phase: "writing"}` when the first model text arrives; `{phase: "checking"}` is not needed (checking is per item).
  2. `title` `{title}` (at most 60 characters) when the model sends it.
  3. `node` `{id, label, type, start, end, quote}` for each accepted entity (same shape and rules as `validate()` today).
  4. `edge` `{source, target, label, start, end, quote}` for each accepted relation (same rules; both endpoints must already have been sent as `node`).
  5. `done` `{status: "ai", title, nodes: <count>, edges: <count>, dropped: <count of items rejected because the quote was not in the text>}` (arrives on the wire as `completed`).
  6. `error` `{message, status}` only for failures (model call failed, unreadable reply, nothing accepted: reuse the exact messages of `build_graph`). Nodes already sent stay valid; the frontend keeps them.

### A2. Make the model write one JSON object per line (JSON Lines)
Add a second system prompt `STREAM_SYSTEM_PROMPT` (keep `SYSTEM_PROMPT` for the old route). Same safety wording as today (text between `<text>` tags is DATA; use only what the text states; no outside knowledge; never diagnose or advise). Output format, one object per line, no prose, no code fences, no blank-line padding:
```
{"t":"title","title":"<at most 6 words>"}
{"t":"entity","id":"e1","label":"<at most 40 characters, as written>","type":"<one of ENTITY_TYPES>","quote":"<exact words copied from the text>"}
{"t":"relation","source":"e1","target":"e2","label":"<verb phrase, at most 4 words>","quote":"<exact words copied from the text>"}
```
Rules in the prompt: write the title first; write an entity line BEFORE any relation that uses it; interleave relations as soon as both ends exist so the graph grows evenly (do not write all entities first); at most `MAX_NODES-10` entities and `MAX_EDGES-20` relations; merge the same thing written two ways.
Call the model with `stream=True` (the Responses adapter already supports streamed chunks; see how `node_summary.py` or `chat_service.py` stream with `llm_service.get_client()`; keep `reasoning_effort="minimal"` when `settings.api_format == "responses"`, `temperature=0.1`).

### A3. Per-item validation (refactor, do not duplicate)
Refactor the item checks inside `validate()` into small reusable pieces (for example a `GraphAccumulator` class holding `kept`, `labels_seen`, `pairs`, counts, with `accept_entity(item) -> dict | None` and `accept_relation(item) -> dict | None`) and make `validate()` call them, so the old route and the stream share one set of rules (quote must be found by `_locate`, caps, duplicates, no dangling ids, no self-loops). The existing tests in `tests/test_graph_ai.py` must stay green unchanged.
Incremental parsing: buffer the streamed text, split on newlines, parse each complete line with `json.loads` (ignore lines that are not JSON objects, e.g. a stray code fence), handle the last unterminated line when the stream ends, and tolerate a model that still sends ONE big JSON object (fallback: if no line parsed to a `t` field and the whole buffer parses as the old `{"entities":[...],"relations":[...]}` shape, emit it through the same accumulator, nodes first, then edges).
Stop reading and close the model stream when the caps are reached or when the client disconnects (the async generator `finally` must close the upstream stream; no leaked tasks).

### A4. Tests (new file only) `tests/test_graph_ai_stream.py`
Use a fake client (monkeypatch `llm_service.get_client` and `settings`) that yields the model text in awkward chunks (a line split across two chunks; two lines in one chunk; a fenced block; a stray empty line). Prove: (1) events arrive in order `status`, `title`, `node`..., `edge`..., `completed`; (2) an entity whose quote is not in the text is dropped and counted in `dropped`; (3) a relation before its entities is dropped; (4) caps; (5) privacy off -> HTTP 409 and the fake client is never called; empty -> 400; too long -> 413; (6) the single-big-JSON fallback; (7) a model failure after two nodes -> two `node` events then `error`; (8) the old `POST /api/tools/graph` still returns the same shape (existing tests untouched). Run the whole backend suite: expect 403 + P4a's new tests + your new tests, all green.
**Live proof** (needs the real key in `.env`; never print it): `curl -N -X POST http://127.0.0.1:8000/api/tools/graph/stream -H "Content-Type: application/json" -d '{"text":"<a 5-sentence paragraph>"}'`; paste the first event's arrival time, the first `node` time, the last event time and the counts into the summary (nodes must arrive spread over seconds, not all at the end). If the real model sends everything in one burst, say so honestly with the timings.

---
## PART B: remove what is old and unused (frontend)

Everything below was checked as unreachable from `main.tsx` (nothing imports it) or is the opt-in full-screen show the owner does not want.

B1. **Delete the full-screen ingestion show.** Remove `components/upload/CinematicIngestionShow.tsx`; in `UploadPage.tsx` remove its import, the `isPopupOpen` state, `setIsPopupOpen(...)` calls and the `<CinematicIngestionShow .../>` element (the process theatre stays; do not change anything else on the page). In `lib/preferences.ts` remove the `cinematic` field from `Preferences`, `DEFAULTS` and `load()` (an old saved `cinematic` key in localStorage must simply be ignored; keep the other fields and the validation unchanged). In `SettingsPage.tsx` remove the "Cinematic ingestion" row (and any text that mentions it); do not change any other row or its order.
B2. **Delete the unused files**: `components/upload/FrameStage.tsx`, `components/shell/JourneyRail.tsx`, `api/jobs.ts`, `api/questions.ts`, `api/timeline.ts`. Before deleting each one run `grep -rn "<name>" "site design/src"` and confirm nothing imports it (also check `vite.config`, `scripts/` and `tests/`); if something does, do NOT delete that file and say why. If deleting leaves a type that is only used by a deleted file, leave the type alone unless `tsc` reports it unused.
B3. Do NOT delete: `components/gallery/*` and `pages/GalleryPage.tsx` (a development-only page used to inspect shared components; many real pages import from the gallery folder), `GraphCanvas.tsx`, `layout3d.ts`, `aiGraph.ts` (P6b removes them after it moves Text to Graph to the new stage), `public/assets/stages/*`, anything under `design/`, `docs/`, `video-prompts/`.
B4. Run `cd "site design" && npm run build` (exit 0), `npm run audit:design` (0 errors), `python scripts/plan/secret_scan.py` (PASS). Check in Chrome (1440x900): upload `vitagraph/sample_data/synthetic_panel_2025-06-20.pdf` into a THROWAWAY persona (create it with `POST /api/users`, accept consent with `POST /api/users/{id}/consent`, delete it afterwards with `DELETE /api/users/{id}`; never touch "Demo Cohort"). The process theatre plays and NO full-screen overlay opens, even in a browser profile whose localStorage still contains `"cinematic": true` (set it by hand to prove it). Settings has no "Cinematic ingestion" row. No console errors.
B5. Write `gemini/reports/P6a_summary.md` (short): routes and events as built, timings from the live proof, test counts, the list of deleted files and the grep proof for each, the Chrome check, anything not done.
