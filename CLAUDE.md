# VitaGraph — Project Context & Master Plan

Also read `AGENTS.md` (loop constitution: one story per iteration, no placeholders, no commit while red, no completion claim without fresh command output).

## 1. Project Identity
VitaGraph is a Privacy-Aware Retrieval-Augmented System for Longitudinal Health-Report Analysis. It is a Final-Year B.Tech CSE project.

**Core Philosophy: "Instrument & Paper"**
- **The Instrument (machine voice):** dark, dense telemetry, `IBM Plex Mono`, precise data, NetworkX graphs, real-time SSE.
- **The Paper (human voice):** clean serif (`Spectral`), notebook-style evidence cards, character-accurate highlights, physical "paper" feel.

## 2. Current State & Completed Milestones
- **Phase 1 (Cleanup):** DONE. Removed the dead-weight Home page, routed `/` to `/upload`, simplified the Upload page, built `CinematicPipelinePopup` with strict memory-leak fixes (`useJobStream.ts` unmount cleanup).
- **Phase 2 (Backend Brain):** DONE. LLM service uses the **AgentRouter** gateway (`https://agentrouter.org/v1`).
  - OpenAI-compatible SDK pointed at AgentRouter.
  - Verified models: `deepseek-v4-flash`, `gpt-6-astra`, `claude-opus-5`, `claude-opus-4-8`.
  - Hard-locked fallback chain in `app/services/llm_service.py`: on 402/403/429 it yields SSE `event: model_fallback` and retries with the next model.
- **Phase 3 (UI re-theme + streaming UI):** IN PROGRESS. See §4 and §5.
- **Testing:** 60/60 pytest passing, frontend Vite build passing.

## 3. SSE Streaming Contract (CRITICAL)
The frontend MUST consume this exact event sequence from `POST /api/questions/stream` (route in `vitagraph/backend/app/routes/questions.py`):
1. `thinking`: `{ "thinking": "..." }` (chain of thought)
2. `tool_call`: `{ "tool": "search_chroma"|"query_networkx_graph", "arguments": {...}, "id": "..." }`
3. `tool_result`: `{ "tool": "...", "result": {...} }`
4. `text_delta`: `{ "delta": "..." }` (raw markdown tokens, including GFM tables)
5. `model_fallback`: `{ "from": "...", "to": "...", "reason": "..." }`
6. `completed`: `{ "status": "answered", "model": "...", "evidence_count": N }`
7. `error`: `{ "message": "...", "diagnostic": "..." }`

## 4. Design System: neutral grey + graphite ("Instrument & Paper")
Decided by the user, replacing the earlier blue-grey "Titanium Lagoon" palette. This **supersedes** the old "DESIGN.md tokens frozen" rule. Tokens live in `site design/src/theme/tokens.css`; use the semantic tokens, never hex, in components.
- Canvas / bench `--ink-900` `#ECECEA` · Paper (cards, answers, inputs) `--ink-800` `#FBFBFA` · Wells `--ink-700/600` `#F2F2F0` / `#E3E3E0`
- Text `--bone` `#1F2328` · Muted `--dim` `#4F545A` · Tertiary `--faint` `#5C6167`
- **Primary action / active nav / focus / user bubble: `--accent` `#1F2328` (graphite)** with `--on-accent` `#F7F7F5`, `--focus`. Colour is reserved for meaning:
  `--link` `#2E6270` (links, citation chips), `--verdigris` `#3B6A53` (verified), `--ochre` `#C58A43` / `--ochre-ink` `#7F5416` (caution), `--madder` `#9E4552` (refused/failed).
- **Graphite frame:** the sidebar, status strip and Ask side panel use the `.chrome-dark` scope (tokens re-skinned to graphite `#1C1F22`, text `#EDEDEB`, `--accent` flips to near-white); the knowledge graph uses `.graph-dark`. Never hard-code dark hex in a component, wrap it in a scope.
- Every text pair measured at least 4.5:1 (see `docs/ui-ux-design-notes.md`).

## 5. Rules for Claude Code
- **DO NOT** break the 60fps performance budget. Avoid heavy `backdrop-blur` on streaming text elements.
- **DO NOT** alter backend Python/FastAPI code unless explicitly asked. The backend is locked and verified.
- **DO NOT** show provider or model names in the UI (user decision, matches `AGENTS.md`). Ignore `model` in `completed`; render `model_fallback` as a neutral status such as "switched to backup engine".
- **DO** render streaming `text_delta` with `react-markdown` and `remark-gfm` so Markdown tables render.
- **DO** keep the cleanup pattern from `useJobStream.ts`: always clear `setTimeout` and close the `EventSource` on unmount.
- **DO** build "Citation Anchors": filenames/chunk IDs in the AI's evidence section become clickable chips that open the Evidence Span Viewer (`site design/src/components/gallery/EvidenceSpanViewer.tsx`).
- Never edit backend tests to make them pass; keep pytest green.

## 6. Verify Commands (Windows)
- Backend: `cd vitagraph/backend && .venv\Scripts\python.exe -m pytest tests -q`
- Frontend: `cd "site design" && npm run build` (plus `npm run dev` and a browser check for UI stories)

## 7. Notes
- `AskPage.tsx` currently uses the job-event SSE (`/api/jobs/{id}/events` + `POST /api/questions`). Moving it to `POST /api/questions/stream` needs a new hook modelled on `useJobStream`. Note that `EventSource` is GET-only, so use `fetch` + `ReadableStream` with an `AbortController` for the POST stream.
