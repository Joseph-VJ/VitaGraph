# VitaGraph Modernist redesign: session context (written for Claude, to resume later)

Written 2026-10-04 at the end of a long session and re-verified the same day (every commit hash, referenced file, and the corrected Task 07 text were checked against the repository). The user is closing the session. This file is the single source of truth for what was done, how work was delegated to Gemini, how each task went, what is broken or pending, and exactly what to do first when the session resumes. Read it fully before doing anything.

---

## 0. TL;DR (read this first)

- **Project:** VitaGraph, a final-year B.Tech project. Privacy-aware RAG over health reports. Backend `vitagraph/backend` (FastAPI, SQLite, ChromaDB, NetworkX, RapidOCR, AgentRouter LLM gateway). Frontend `site design/` (React 19, TS, Vite 8, Tailwind 4).
- **Goal of this work:** re-skin and rebuild the whole frontend so the LIVE app looks EXACTLY like the Modernist reference design (`VitaGraph-App-v3.html`), but with REAL backend data, not the reference's demo data. The user insists: "full working model, not a demo or fake mock-up".
- **Working agreement (the user repeated this three times, obey it):** Claude is the senior reviewer. Claude does NOT write the app code. A small model (the user calls it "Gemini 3.8 flash") writes the code. Claude (1) writes very detailed task prompt files in `gemini/`, (2) gives the user a short message to paste into Gemini, (3) when the user pastes Gemini's report or says "check again", reviews the work by building, grepping, diffing, and testing it live against the real backend, and (4) writes the next prompt. The user's words: "you are only going to do the review work and going to give a prompt right". I broke this twice (wrote backend code myself after "ok do it"). Do not do it again unless the user explicitly says to code.
- **Branch:** all work is on `redesign/modernist-app` (created from `main`). Gemini must never touch `main`, never push, never merge. Nothing has been merged or pushed.
- **UPDATE (later the same day, supersedes the next bullet):** T07 was re-run by Gemini and ACCEPTED (commit `a890164`, 89 tests, review in `gemini/reviews/TASK_07_review.md`). Live review then found two more extractor bugs (line breaks inside names, a range swallowing the next row, which lost e.g. Potassium 5.9 HIGH), so `gemini/TASK_07b_extractor_rows.md` was written (commit `d497803`, expects 93 passed). **NEW PROTOCOL:** every task ends with a Gemini work report `gemini/reports/TASK_<id>_report.md` (RULES.md 5b) and must meet the quality bar (RULES.md 5c); the reviewer answers in `gemini/reviews/TASK_<id>_review.md`. NEXT: wait for the T07b report, review it, then T08 Settings. The chat `content-blocked` problem (6.4) must be solved before the Ask task.
- **State at end of the first session:** Tasks T01 to T06 accepted. T07 (backend extractor fix) was run by Gemini and came back **BLOCKED** because MY test #4 was wrong (see section 10). I have already corrected `gemini/TASK_07_extractor_fix.md` and committed it (`5ccfba8`). The next action is to give the user the "re-run T07" prompt in section 14.1 (also section 10.4).

---

## 1. The people and the rules of engagement

- **User:** B.Tech student, building VitaGraph. Email in system context. Communicates informally, in short messages; wants me to be precise and "too careful". Closing sessions often, hence this file.
- **Gemini:** the code-generation model. It reads `gemini/RULES.md` plus one `gemini/TASK_xx_*.md`, does exactly that task on the branch, commits, and replies with a fixed report format. It is a "flash" model, so prompts must be extremely explicit: exact code blocks, exact class strings, exact commands, exact acceptance checks. The user said: "next time be more detailed because the gemini 3.8 is a flash model so it can do the work even more perfect if the task was too detailed and precise".
- **Claude (me):** reviewer and prompt writer. Allowed to run read-only checks and live tests. After testing I always stop the dev servers (ports 5173 and 8000).
- **Project rules that still apply** (from `CLAUDE.md`, `AGENTS.md`):
  - Never show provider or model names in the UI (no "AgentRouter", "DeepSeek", "GPT", "Claude", "Gemini" in visible text). The reference has a "Gemini 1.5 Flash" model button and a model dialog: NOT copied.
  - SSE contract for streaming (events `thinking`, `tool_call`, `tool_result`, `text_delta`, `model_fallback`, `completed`, `error`). `EventSource` is GET-only, so POST streams use `fetch` + `ReadableStream` + `AbortController`. Keep the cleanup pattern: always clear timers, close streams, abort controllers on unmount.
  - Render streamed markdown with `react-markdown` + `remark-gfm`.
  - Citation anchors: filenames/chunk ids in answers become clickable chips that open the evidence viewer.
  - Backend was "locked" (do not alter unless explicitly asked). The user explicitly said "ok do it" to additive backend work (section 6). Never edit existing backend tests to make them pass.
  - `CLAUDE.md` section 4 (graphite palette, Spectral/Plex fonts) is now SUPERSEDED by the Modernist design. `gemini/RULES.md` says so and overrides `GEMINI.md`/`AGENTS.md` where they conflict. `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `docs/ui-ux-design-notes.md` still describe the old design and have NOT been updated. TODO at the end: update them (section 11).

---

## 2. The reference design (what "exact" means)

### 2.1 Files
The user supplied three files (they exist in the repo root too, identical copies; originals are in `design/reference/new-design-spec/`):
- `VitaGraph-App-v3.html`: a bundled single-file prototype (a "Claude Design" export, `<x-dc>` component with `sc-if`/`sc-for` templating). It is a DEMO: Arjun R, VG-2026-001, 3 fixed reports, fixed values, scripted 42 s ingestion show, hand-placed 23-node 3D graph, fake audit lines, provider dialog, "Reset demo", "Simulate outage".
- `LOCAL_AI_BUILD_GUIDE.md`: a build brief for a "local AI" describing the Modernist app page by page (shell sizes, Upload, ingestion show, Library, Ask, Graph, Timeline with isometric charts, Compare, Insights, Tools, Settings, tokens). Section 6 has the 3D graph demo data and renderer; section 7 the isometric chart `iso()` function.
- `GRAPH_3D_AND_ANIMATION_GUIDE.md`: math and full TS for the fake-3D canvas graph (Part A, A1-A19), the cinematic ingestion show (Part B with the verbatim `drawShow`), the frame stage (Part C), isometric bar charts (Part D), betweenness (Part E), how to prompt a small model (Part F), common mistakes (Part G).
- `VitaGraph modernist redesign/` (folder + two zips): the Claude Design export including the "Modernist" design system (`_ds/.../readme.md`, `styles.css`). Design system: flat, Archivo only (400/600/800), light ground `#f3f2f2`, ink `#201e1d`, ONE red accent `#ec3013`, ramps neutral 100-900 and accent 100-900, zero radius, 2px dividers, no gradients, shadows only sm/md/lg for floating things.

### 2.2 How I decoded the bundle (do this again if needed)
The HTML holds `<script type="__bundler/template">` whose content is a JSON string of the real page source. Python:
```python
import re, json
s = open("design/reference/new-design-spec/VitaGraph-App-v3.html", encoding="utf-8").read()
tpl = json.loads(re.search(r'<script type="__bundler/template">(.*?)</script>', s, re.S).group(1).strip())
open("design/reference/app-v3-source.html", "w", encoding="utf-8").write(tpl)
```
Result: `design/reference/app-v3-source.html` (1473 lines; committed). Line map: CSS 12-354 · sidebar 360-384 · banner 387-389 · header 390-398 · Upload 402-456 · Library 458-497 · Ask 499-590 · Graph 592-638 · Timeline 640-678 · Compare 680-693 · Insights 695-711 · Image to Text 713-724 · PDF to Text 726-737 · Settings 739-761 · footer 765-771 · cinematic show overlay 775-798 · model dialog 801-809 · script (state, data, drawShow, graph, frame stage, OCR with Tesseract.js, PDF with pdf.js) 812-1473.

### 2.3 Screenshots of the reference
Rendered with Playwright using the INSTALLED Chrome (`p.chromium.launch(channel="chrome")`; the bundled Chromium crashed on screenshot). One PNG per screen at 1440x900 saved in `design/reference/screens/`: `00_Upload`, `01_Library`, `02_Ask`, `03_Knowledge_Graph`, `04_Timeline`, `05_Compare`, `06_Insights`, `07_Image_to_Text`, `08_PDF_to_Text`, `09_Text_to_Graph`, `10_Settings`. Gemini is told to LOOK at the matching screenshot before each task and compare after.

### 2.4 Key facts extracted from the reference (use when writing later tasks)
- Shell: sidebar 244px (76px brand row with 16px red square + "VitaGraph" 1.25rem/800), groups Workspace (Upload & Ingest, Library) / Analyze (Ask, Knowledge Graph, Timeline, Compare, Insights) / Tools (Image to Text, PDF to Text, Text to Graph) / System (Settings). Active item = ink block with 5px red left bar. Header min-height 76px, padding 12px 32px, 2px bottom rule, h1 1.5rem, sub 0.875rem neutral-700, search 300px (`.input`), tag-outline "AI explanations off", model button (NOT copied), persona chip (32px red square initial, name 800, id small). Footer 40px, 2px top rule: square indicator (ink online / red offline), "Backend online", "ChromaDB · N chunks", "N reports", last log line, "Simulate outage" (NOT copied).
- Buttons: `.btn` 14px/800, padding 8px 14.4px, primary = bright red fill with `--color-bg` text, hover accent-600, active accent-700. Secondary = 1px divider border. Ghost = red text. `.input` min-height 36px surface fill, 1px divider border. `.tag` 11px, padding 3px 10px. `.table` th 11px uppercase with 2px rule, td 1px rule.
- Red text uses accent-700 (`#ae1800`); red fills use `#ec3013`. Secondary text neutral-700 `#605d5d`.
- Page container for content pages: `max-width:1280px; margin:0 auto; padding:var(--space-8)` (32px). Ask is 960px centered with sticky composer. Settings 960px. Graph and Timeline are full-bleed.

---

## 3. Repository organisation (I cleaned the root; nothing was deleted)

Moved with `git mv` (tracked) or `mv` (untracked):
- `docs/planning/`: `PROJECT_CONTEXT_AND_ROADMAP.md`, `VitaGraph-Gap-Analysis.md`, `VitaGraph-Role-Based-Implementation-Plan.md` (renamed from `VitaGraph_ Full Role-Based Implementation Plan (2).md`)
- `docs/motion/`: `VITAGRAPH_MOTION_PROMPT.md`, `PROMPT_MOTION.md` (and `scripts/setup_motion.py` paths updated)
- `docs/archive/`: `AGENT_PROOF.md`, `CODES.md` (1.2 MB), `RESCUE.md`
- `docs/images/`: `fix.png`, `harness.png`
- `design/prototypes/`: `V1-Front-Animated.html`, `Final-FIXED-FULL.html`, `Story-CURRENT.html`, `Story-v2.html` (the two Story files are untracked and large; not committed)
- `design/reference/`: `modernist-redesign/` (folder, untracked), two zips (untracked), `new-design-spec/` (the three spec files; untracked at the time, root copies exist), `app-v3-source.html` (committed), `screens/` (committed)
- `docs/README.md`: index of what is where. `AGENTS.md` read-order path updated.
- Left in root on purpose (tools expect them): `README.md`, `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `PROMPT.md`, `ralph-gemini.sh`, `progress.txt`, `skills-lock.json`. Do NOT use `ralph-gemini.sh` (it runs the old story loop from `PROMPT.md`).
- Untouched on purpose: `site design/` stray files (`MOTION.md`, `Qwen_markdown...md`, many screenshots, 8 old dark-theme "ChatGPT Image" mockups; the mockups are NOT usable as frames), and `vitagraph/` duplicate docs (`CODES.md` differs from the root one).
- `site design/tsconfig.tsbuildinfo` shows as modified after every build: harmless build artifact, never commit it.

---

## 4. The delegation system I built (`gemini/`)

- `gemini/RULES.md`: standing rules read by Gemini first. Sections: 0 "the reference wins" (added in T03), 1 project, 2 Modernist design rules (no radius, no gradients, Archivo only incl. numbers/hashes, colour policy: bright red for fills and marks, accent-700 for small red text, neutral-700 secondary), 3 what never to touch (backend, api signatures, hooks, tests, `design/`, `docs/`), 3b BRANCH GUARD (first command every task: `git branch --show-current`; must be `redesign/modernist-app`; forbidden git commands: push, merge, rebase, reset --hard, clean, checkout main, branch -D, amend, force, no-verify; stage by explicit path only), 4 working method (read only what the task names, no placeholders, build must exit 0, one commit per task `feat(redesign): Txx ...`, BLOCKED protocol after 3 failures), 5 report format, 6 token cheat-sheet and gotchas.
- Report format Gemini must end with: `TASK / STATUS (COMPLETE|BLOCKED|PARTIAL) / BRANCH / FILES CHANGED / COMMANDS RUN / ACCEPTANCE (PASS/FAIL each) / DEVIATIONS / OPEN QUESTIONS`.
- Each task file `gemini/TASK_0x_*.md` contains: why, files it may change (closed list), Step 0 branch guard + green build, parts with exact code or exact class strings, VERIFY (build, greps, live browser checks with numbers to paste, measurement JS snippets), COMMIT (explicit paths and message), ACCEPTANCE list.
- Message template I give the user to paste into Gemini (adapt per task): tells it to (1) read RULES.md, (2) read the TASK file and look at the named reference screenshot/lines, (3) do ONLY that task, with non-negotiables (branch, closed file list, explicit staging, copy code exactly, STOP and report BLOCKED when unclear), and (4) reply only with the report.
- Gemini screenshots go to `gemini/shots/taskNN-*.png` (committed).
- Gemini runs on Windows with a browser tool; it can start `npm run dev` and Playwright-like checks and does take screenshots.

### My review procedure (repeat for every task)
1. `git branch --show-current`, `git log --oneline -4`, `git show --stat HEAD`: confirm branch, commit, and that only the allowed files changed.
2. `cd "site design" && npm run build` (expect `built in ...ms`, no TS errors).
3. Run the task's grep checks (rounded, Spectral, `var(--ink-`, leftover helpers).
4. `git diff <prompt-commit> HEAD` on small files; skim large ones for deviations.
5. Start servers (backend: `cd vitagraph/backend && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8000` in background; frontend: `cd "site design" && npm run dev -- --port 5173`), wait ~10 s.
6. Playwright script (Python, `channel="chrome"`, viewport 1440x900). To pick a persona: `ctx.add_init_script("localStorage.setItem('vitagraph_user_id','<id>')")` BEFORE navigating. Compare the DOM numbers with the API (`urllib` GET to `127.0.0.1:8000`). Set `PYTHONIOENCODING=utf-8` (arrows in labels crash cp1252 printing). Take screenshots and read them.
7. Stop servers: PowerShell `Get-NetTCPConnection -LocalPort 5173,8000 -State Listen | Stop-Process`.
8. Report verdict: PASS/FAIL, evidence, bugs found, then write the next task file, commit it, and give the user the paste message.
(The scratch Playwright scripts lived in the session scratchpad and are gone; rewrite them from the recipe above.)

### Dev data / personas
Backend dev DB has ~19 personas. Useful ids: `usr_d1d7f9b2a4b1` "3 Reports Persona" (2 dated reports + 1 undated scanned OCR report; 103 graph nodes), `usr_7cd5de757a04` "Demo Cohort (demo data)" (50 reports, 1122 graph nodes), `usr_85e48cddd9f7` "Single Report Persona", "Empty Test Persona" (my test uploads added a `bad.pdf` and a sample PDF to it, so it is no longer empty; find an empty persona by listing `/api/reports?user_id=` per user). Sample PDFs: `site design/public/synthetic_panel_2025-01-15.pdf`, `synthetic_panel_2025-06-20.pdf`, `VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf`.

---

## 5. Chronology of every step (commit hashes on `redesign/modernist-app`)

| Step | Commit | What |
|---|---|---|
| Understanding | n/a | Read `CLAUDE.md`, `AGENTS.md`, `progress.txt`, `docs/ui-ux-design-notes.md`, shell files, `UploadPage`, `useJobStream`, `useAgentStream`, backend routes. Found the new design conflicts with the shipped graphite palette; user chose a full re-theme and said Gemini will code. |
| Prompt files | n/a | Created `gemini/RULES.md`, `TASK_01_foundation.md`. User added: Gemini must create a new branch and work only there; I added the branch guard (3b). |
| **T01** foundation | `2190144` | Gemini: branch created, `@fontsource/archivo` installed, `tokens.css` rewritten with Modernist tokens while KEEPING every legacy token name (remapped values) so all pages re-theme, radii 0, `index.css` fonts/type classes, favicon, title. Review: PASS. Notes found: self-referencing `@theme` bridges (`--color-surface: var(--color-surface)`, harmless only because unlayered `:root` wins), leftover `rgba()`, Spectral still hard-coded in components, 81 `rounded-full` remain (Tailwind hard-codes it). |
| Reorg | `fe0f43d` | Root cleanup (section 3). Also the commit that first added `gemini/RULES.md` and `gemini/TASK_01_foundation.md` (the T01 prompt was never committed separately). |
| **T02** shell v1 | `62fa5f4` (prompt `ce8f035`) | Gemini: grouped sidebar, header, status strip, banner; removed fake numbers (24 ms latency, config string), dead Docs/Feedback/theme controls; fixed T01 leftovers. Review: PASS but it was built from my guess of the design, not the real reference. |
| Reference decode | `1e6fb7c` | After rendering the reference in Chrome I discovered the real design differs. Decoded the bundle, saved source + screenshots, generated `site design/src/theme/modernist.css` VERBATIM from reference lines 208-352 (classes `btn`, `input`, `tag`, `table`, `seg`, `card`, `hr`, `dialog`, wrapped in `@layer components`; I removed `.tag-accent-2`). Updated RULES (reference wins). |
| **T03** exact shell | `59ce89d` (prompt in `1e6fb7c`) | Gemini: flipped `--accent` to bright `#ec3013` (my earlier dark-red `#ae1800` contrast compromise was reversed because the user wants exact), imported `modernist.css`, rebuilt Sidebar/Header/StatusStrip/AppShell from the reference markup. Nav = 3 groups (Workspace 2, Analyze 5, System 1); Datasets/Ontology/Notebooks REMOVED from the nav (routes still exist in `App.tsx`; DECISION to confirm with user); Tools group deliberately absent until those pages exist. Introduced `OWN_LAYOUT` set in `AppShell.tsx`: routes in the set render their page with no wrapper (the page draws its own 1280px/32px layout); other routes keep the old padded wrapper. Status strip shows REAL `N reports` and chunk sums from `reportsApi.list`. Review: PASS; measured aside 244, header 76, footer 40, search 300x36, avatar 32, h1 24px Archivo, body `rgb(243,242,242)`, console clean. One deviation: nav items 53px instead of 48px (links inherit line-height 1.55; buttons do not). |
| **T04** Upload | `364b796` (prompt `643ae1c`) | Gemini: `UploadPage.tsx` rewritten to reference (320px left column: dashed dropzone with "Choose file" + "Load demo cohort"; file row; 5 pipeline rows Waiting/Running/Done driven ONLY by real SSE job steps and showing real numbers only after completion; right: new `components/upload/FrameStage.tsx` canvas scrub stage; Pages table + "Ask about this report"/"Open library" after ingestion; quarantine rows with real error + Dismiss). Removed the developer test-upload bar and success toast. Fixed nav line-height (`lineHeight:"normal"`). Added `/upload` to `OWN_LAYOUT`. Review: PASS; live upload of a real PDF took all 5 rows to Done, Indexed tag, Pages table matched; fake `bad.pdf` produced a quarantine row. Caveats: the old `CinematicPipelinePopup` is still the old style and still opens on every upload; the frame stage shows the reference's own empty state ("Frames go in assets/frames...") because NO FRAME IMAGES EXIST (user must supply `site design/public/assets/frames/frame_0001.jpg`...; export tip: `ffmpeg -i in.mp4 -vf "fps=24,scale=1600:-1" -q:v 3 frame_%04d.jpg`). |
| **T05** Compare + Insights | `a6151f0` (prompt `7a41c3c`) | Gemini rewrote both pages. Compare: pair buttons for 2-4 reports (consecutive pairs + first→last), two selects for 5+ reports, empty state; change = follow-up minus baseline; status Higher/Lower/Unchanged/One report. Insights: three columns from the real graph (counts per node type, top-8 backend `betweenness`, edge type pairs). Review: PASS, numbers equal API (103 nodes/212 edges, same top node). Bug found (not Gemini's): report dates like `20 June 2025` were sorted as text and an undated report was labelled with its upload month ("Oct 2026"). Fixed in T06. |
| Backend work by Claude (see section 6) | `e52d6a1`, `ab6b2ce`, `8350cdc` | Measurements endpoint, OCR tool route, chat stream, retry. |
| **T06** Library + Compare fix | `4a4c336` (prompt `4ed843a`) | Gemini: new `src/lib/reportLabels.ts` (parse printed date, sort undated last, label "Mon YYYY"/"Undated" with filename if duplicate), `reportsApi.measurements`, Compare uses the helper, `LibraryPage.tsx` rewritten (report table; selected report's values with range bars from printed ranges, status tags, previous-report note, click to open the passage with the exact characters highlighted from page text). `/library` added to `OWN_LAYOUT`. Review: PASS, data equals API. Found: tag "Below range" wraps to two lines (add `whiteSpace:"nowrap"` to tags in the next page task) and the DATA BUG below. |
| **T07** extractor fix | prompt `322a722` | Backend micro-fix prompt. Gemini returned BLOCKED because reviewer test 4 was wrong (section 10); the task file was then corrected in `5ccfba8`. |

---

## 6. Backend work I did myself (after the user said "ok do it"; additive; 85 tests pass)

All in `vitagraph/backend`, existing routes and tests untouched. Test count went 70 (baseline) → 84 → 85.

1. **`GET /api/reports/{report_id}/measurements`** (`app/services/measurement_service.py`, schema `MeasurementOut` in `app/schemas/report.py`, route in `app/routes/reports.py`, tests `tests/test_measurements.py`). Runs the existing graph extractor over the report's chunks, dedupes by test name, returns `test_name, category, value, unit, reference_range (printed text), range_low, range_high (parsed), flag, page_number, chunk_id, char_start, char_end (offsets into that page's extracted_text), span_exact`. Used by the Library.
2. **`POST /api/tools/ocr`** (multipart image) and **`GET /api/tools/ocr/status`** (`app/ingestion/ocr_image.py`, `app/routes/tools.py`, tests `tests/test_ocr_tool.py`). RapidOCR (already installed; Tesseract is NOT installed), CPU, in memory, never stored, runs in a threadpool so health probes stay responsive, returns `engine, width, height, elapsed_ms, mean_confidence, text, lines[{text, confidence 0-100, box{x0,y0,x1,y1} normalised}]`, 400 for non-images, 413 over 15 MB, 503 if no engine. The user chose RapidOCR as the main engine ("go with rapidocr and or ... an AI API"). My recommendation given: RapidOCR default (private, fast on weak laptops, gives boxes and confidence like the reference, will not "fix" digits); an optional "improve with AI" step only later and only with a tested vision model; GLM-OCR dropped (this PC: Ryzen 5 3500, 32 GB RAM, GTX 1650 4 GB could run it, but a weak laptop could not).
3. **`POST /api/chat/stream`** (`app/schemas/chat.py`, `app/services/chat_service.py`, `app/routes/chat.py`, tests `tests/test_chat_stream.py`, 9 tests). Request `{user_id, messages[{role,content}] (whole conversation, last = user), job_id?, report_id?, mode: rag_ai|rag_only}`. Same SSE wire format as `/api/questions/stream` (events carry `metadata`). Hard gates BEFORE any model call: clinical-boundary classification refusal, prompt-injection sanitising, persona-scoped retrieval. AI path: system prompt `CHAT_SYSTEM_PROMPT` (conversational Markdown, call tools for anything about their reports, cite `[n]`, label general knowledge as "General information (not from your reports):", boundaries), last 12 turns of history, up to 4 tool rounds (`search_chroma` returns numbered evidence cards with `ref, chunk_id, report_id, report_filename, report_date, page_number, snippet, score, char_start, char_end`; `query_networkx_graph` reused), streaming `thinking/tool_call/tool_result/text_delta/model_fallback`, `completed` with `evidence`, `safety_passed` (diagnostic-phrase check only; the number check was NOT applied because general-knowledge numbers would be flagged) and `ai_status`. Evidence-only path (`mode=rag_only` or AI off): quotes reports via the offline composer, no model call. Persists each turn via `question_service._persist` + `_record_ai_call`. The old `/api/questions` endpoints are untouched.
4. **Retry on gateway `content-blocked`** (`8350cdc`): the AgentRouter gateway intermittently returns 400 `content-blocked` for ordinary text (e.g. the bare message "What was my hemoglobin?"; the same text passed minutes later, and `Question: ...`-prefixed text passed). `_stream_with_fallback` retries once on the same model after 0.7 s, then falls back along `settings.model_chain`.
   **KNOWN ISSUE, UNRESOLVED:** the final live test (`POST /api/chat/stream`, persona `usr_d1d7f9b2a4b1`, "What was my hemoglobin?") STILL failed with content-blocked after retry and a model fallback. All mocked tests pass; a live success of the chat has NOT been demonstrated. Do not claim the chat works live until it is. Ideas: prefix user messages with `Question: ` (the format the old verified pipeline uses), shorten the system prompt, inspect which part trips the filter, check the fallback models, add a clearer error message in the UI. WHO FIXES IT: this is backend code. Per the working agreement, either write a small backend task file for Gemini (with tests, like Task 07) or ask the user for explicit permission before Claude debugs it. Do not silently code it.

Note on the ingestion show: NO new endpoint is needed. The upload job SSE already emits real payloads: `page_extracted` events (`page_number, total_pages, method, quality, chars, note, ocr_boxes[{x0,y0,x1,y1,text,conf}], text_preview`), `extracted` (page list, total_chars), `chunked` (`total_chunks`, `chunks[]` up to 12 with `chunk_id, page_number, char_start, char_end, section, chars, preview`), `embedded` (`count, dim, samples[3 chunks x 8 values]`), `indexed` (`indexed, collection_total`), `graphed` (nodes/edges/communities + 40 labels), `done`. Optional later (additive): raise the chunk list limit above 12 and the embedding sample size (the reference draws a 384-value strip and an N x 96 matrix) in `report_service._chunk_payload/_embedded_payload`.

---

## 7. Findings, traps, and conventions to remember

- **Tokens** (`site design/src/theme/tokens.css`): new canonical `--color-*`, `--space-*`, `--shadow-*`; legacy names kept and remapped. `--accent` = `#ec3013` (since T03), `--accent-ink` = `#ae1800`, `--link` = accent-700, `--dim`/`--faint` = neutral-700. `.chrome-dark` is a no-op (light). `.graph-dark` (in `components/gallery/graph.css`) still exists and is still dark: the new graph task must restyle or replace it.
- **Components use `var()` arbitrary values** (`bg-[var(--color-bg)]`), not Tailwind colour names. Do not add `bg-accent` etc.
- **`type-*` classes force a text colour** (`type-body`, `type-label`, `type-meta`...). Never use them on inverted (dark-on-light) elements.
- **`rounded-full` is hard-coded in Tailwind** (81 uses remain in unconverted files); `rounded-[var(--r-*)]` is 0. A sweep is needed for unconverted pages (gallery components: LED, Badge, Buttons...).
- **Font weights:** only 400/600/800 are loaded; `font-extrabold` = 800.
- **`OWN_LAYOUT` in `AppShell.tsx`** now = `/upload, /compare, /insights, /library`. Every converted page must be added.
- **Inline `style={{}}` copied from the reference is the preferred way** to get exact output; reference classes from `modernist.css` are used for buttons, inputs, tags, tables.
- **Windows/bash gotchas:** paths with spaces need quotes (`"site design"`); a big heredoc containing apostrophes broke the bash tool once (use the Write tool for large files); Python printing arrows needs `PYTHONIOENCODING=utf-8`; the bundled Playwright Chromium crashes on screenshots (use `channel="chrome"`); LF→CRLF git warnings are harmless.
- **Gateway:** `settings.allow_api` true and key present in `backend/.env`; models verified: `deepseek-v4-flash` (default), `gpt-6-astra`, `claude-opus-5`, `claude-opus-4-8`; `get_client()` sends `User-Agent: RooCode/0.15.0` to pass the WAF.
- **Graph data reality** (`/api/graph/{uid}`): node `type` ∈ person, report, date, chunk, section, uncertainty, category, test, measurement; metrics = total_nodes, total_edges, communities_count, modularity, density; each node has `betweenness`, `community`, `color`, `r`; measurement nodes carry `value, unit, flag, date`; chunk/report nodes carry `chunk_id/report_id/page`. For 3D: map person→person (square), report→report (ring), category/section/date→section (diamond), test→bio, measurement→meas, uncertainty→unc; hide chunk (text fragments) by default; cap ≈120 nodes with an honest "Showing N of M"; layout with the guide's `layout3D` (A18) run ONCE per dataset; focus sets from real communities or from `POST /api/graph/subgraph` after an Ask answer.
- **Other real APIs:** `/api/reports/{id}/pages/{n}/image` (PNG of the stored page), `/api/reports/{uid}/trends?test=`, `/api/reports/compare`, `/api/timeline/{uid}`, `/api/timeline/{uid}/ai-calls`, `/api/ai/config` (GET/POST; privacy toggle `allow_api`), `/api/users` (+ DELETE, consent), `/api/demo/cohort`, `/api/jobs/{id}/events` (SSE).
- **Known data-quality bug (T07 target):** extractor flag bleed and range-from-word (section 10).

---

## 8. Decisions made by the user so far
1. Full re-theme to the Modernist design; the reference wins over every older rule (even the contrast compromise: buttons are bright red).
2. Gemini writes code, Claude supervises; one task per prompt; Gemini works only on `redesign/modernist-app`.
3. The 3D graph must rotate in 3D but use REAL data (not the fake demo nodes).
4. Add the three Tools pages (Image to Text, PDF to Text, Text to Graph) using real, working code; OCR engine = RapidOCR (backend route), browser-side pdf.js for PDF text and the Text-to-Graph tool, optional AI refinement only later.
5. Ingestion show must be LIVE-driven by the real upload job (real stages, pages, chunks), paced by real events (with a readable minimum per stage).
6. Ask page must be a REAL AI chat (like talking to Claude): streaming, tool calls, memory of earlier turns, not a RAG-only form. Backend support built (section 6.3) but not yet verified live.
7. Backend additive changes approved ("ok do it").

## 9. Pending decisions / things to confirm with the user
- Datasets / Ontology / Notebooks were removed from the sidebar to match the reference (routes still work by URL). Ask if they should return (e.g. a "Reference" group) or be deleted.
- Frame images for the Upload stage (user must supply; text on the empty state is developer-facing).
- Settings "Chunk size" slider: the backend has no per-upload chunk-size parameter. Either add an additive `chunk_size` form field (backend change) or drop the slider.
- Whether to keep the old `CinematicPipelinePopup` until the new live-driven show replaces it.
- Merge plan for `redesign/modernist-app` into `main` (nothing pushed or merged; the user decides).

---

## 10. THE LAST WORK: Task 07 and its output

### 10.1 What was asked
`gemini/TASK_07_extractor_fix.md` (prompt commit `322a722`): fix two real wrong-value bugs in `vitagraph/backend/app/graph/extractor.py`, test-first, with a new test file `tests/test_extractor_flags.py`. Bugs, confirmed by running the extractor (read-only):
- **Flag bleed:** for the text `Lab Values:\n- HbA1c: 5.8 %\n- Total Cholesterol: 224 mg/dL\n- Vitamin D: 18 ng/mL -low\n` the extractor returned LOW for ALL THREE, because `flag_match = _FLAG_PATTERN.search(first_line) or _FLAG_PATTERN.search(sub)` scans the rest of the block and finds the next line's `-low`. The Library therefore showed Total Cholesterol 224 and HbA1c 5.8 as "Below range" (false, dangerous).
- **Range from a word:** `Weight: 82 kg Height: 172 cm BMI: 27.7` produced `reference_range == "Height"` (generic row pattern group 4 accepts letters-only text).
- Three edits: (A) add `_LABELLED_FLAG_PATTERN = re.compile(r"^[ \t]*(?:Flag|Status|Interpretation)[ \t]*:[ \t]*(LOW|HIGH|NORMAL|ABNORMAL|CRITICAL)", re.IGNORECASE | re.MULTILINE)` below `_FLAG_PATTERN`; (B) change the flag line to `_FLAG_PATTERN.search(first_line) or _LABELLED_FLAG_PATTERN.search(sub)`; (C) in the generic fallback after `ref_r = match.group(4).strip() if match.group(4) else None` add `if ref_r and not re.search(r"\d", ref_r): ref_r = None`.

### 10.2 Gemini's report (verbatim summary of the pasted output)
```
TASK: 07   STATUS: BLOCKED   BRANCH: redesign/modernist-app   FILES CHANGED: none (restored per RULES.md 4.7)

1. Baseline suite: 85 passed in 45.56s   [reviewer note, not Gemini's: the task text said 84; the real number is 85 because the retry test was added after the task text was written]
2. Step 1 (new test file created exactly as written): 3 failed, 1 passed
   FAILED test_flag_word_on_the_next_line_is_not_attached_to_earlier_tests   (HbA1c 'LOW' != 'NORMAL')  -> expected, proves bug 1
   FAILED test_reference_range_must_contain_a_number                         ('Height' is not None)    -> expected, proves bug 2
   FAILED test_a_real_inline_range_is_kept   (reference_range is None for "Fasting Glucose: 94 mg/dL 70 - 99")  -> UNEXPECTED
3. With Edits A, B, C applied: 3 passed, 1 failed (only test_a_real_inline_range_is_kept still fails)
4. Real-data one-liner: PASS -> {'Vitamin D': 'LOW', 'Total Cholesterol': 'NORMAL', 'HbA1c': 'NORMAL'} and {'Weight': (82.0, None)}
5. git: branch redesign/modernist-app, HEAD 322a722, nothing committed
ACCEPTANCE: tests failed-before/pass-after: FAIL (test 4); full suite 88: BLOCKED; real-data one-liner: PASS; branch: PASS
DEVIATIONS: none
OPEN QUESTIONS: Fasting Glucose is in CANONICAL_TESTS, so it is handled in step 1, which only reads ranges after the keywords in _RANGE_PATTERN
  ("Reference range:" etc.) and then adds the name to extracted_test_names so the generic fallback (where Edit C lives) skips it.
  Resolution 1: change test 4 to a NON-canonical test (e.g. "Serum Glucose: 94 mg/dL 70 - 99").
  Resolution 2: add inline-range support to the canonical branch (needs exact logic from reviewer).
```

### 10.3 My analysis and resolution
- Gemini behaved correctly: it ran the tests first, noticed an unexpected failure, applied the edits exactly, did not edit any existing test, restored the tree, and stopped with a precise question. **The mistake was mine:** test 4 used a canonical test name ("Fasting Glucose"), so it could never exercise the generic fallback that Edit C protects. Edits A, B, C are correct (the real-data one-liner proves both bugs fixed).
- Decision: **Resolution 1.** Inline ranges for canonical tests are out of scope for this fix.
- I verified (read-only, with the unmodified extractor) that `extract_entities_from_chunk("Serum Glucose: 94 mg/dL 70 - 99\n", ...)` returns `{'Serum Glucose': (94.0, '70 - 99', 'NORMAL')}` (so the new test 4 passes before AND after the fix, acting as a guard that Edit C does not strip real ranges). `"Glucose: 94 mg/dL 70 - 99"` also works. `"Uric Acid ..."` returns nothing (not usable).
- Corrected `gemini/TASK_07_extractor_fix.md`: test 4 now uses `Serum Glucose` and asserts `value == 94.0` and `reference_range == "70 - 99"`; baseline expectation is now `85 passed`; after the fix `89 passed` (85 + 4 new). The corrected file is committed in `5ccfba8`.

### 10.4 What to do first on resume
1. `git status` and `git log --oneline -3` (expect a clean tree except `site design/tsconfig.tsbuildinfo`; the corrected `gemini/TASK_07_extractor_fix.md` and this file are already committed in `5ccfba8` and `500dd09`).
2. Give the user this message to paste into Gemini:
```
TASK 07 is being re-run with a corrected test. Your BLOCKED report was right: test 4 in the old task used a canonical test name (my mistake). Resolution 1 is chosen.
Re-read gemini/TASK_07_extractor_fix.md completely (it was corrected: test 4 now uses "Serum Glucose", baseline is 85 passed, final is 89 passed) and do TASK 07 again from Step 0, exactly as written. Same rules as before: branch redesign/modernist-app only; edit only vitagraph/backend/app/graph/extractor.py and the NEW file vitagraph/backend/tests/test_extractor_flags.py; never edit an existing test; stage by explicit path; STOP and report BLOCKED if anything fails. Reply only with the report in the format at the end of gemini/RULES.md.
```
3. When Gemini replies: review = check `git show --stat HEAD` lists only those 2 files; run the full backend suite (`cd vitagraph/backend && .venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider`, expect 89 passed); re-run the real-data one-liner; then restart servers and confirm the Library for persona `usr_d1d7f9b2a4b1` no longer shows Cholesterol/HbA1c as "Below range" and Weight has no range "Height" (Vitamin D 18 ng/mL stays Low: its `-low` is on its own line).

---

## 11. Roadmap of remaining work (one Gemini task each; write the prompt file, commit it, give the paste message)

Order and key requirements (each must be exact to the reference screenshot + real data; add the route to `OWN_LAYOUT`; add `whiteSpace:"nowrap"` to status tags):
- **T07** extractor fix (re-run, section 10).
- **T08 Settings** (reference lines 739-761, screenshot 10): rows with On/Off buttons. REAL bindings only: "Send retrieved passages to the AI model" ↔ `GET/POST /api/ai/config` (`allow_api`); "Cinematic ingestion" On/Off, "Process speed", "Reduce motion" are client preferences (localStorage; must actually change the live show / motion governor); "Embedding model" and "Vector filter" notes from `/api/health` (`embedding_model`) and the fixed user-scoped filter; chunk-size slider pending decision (section 9). Remove claims that are untrue (see old design notes open items: privacy claims, dead controls).
- **T09 Ask chat** (screenshot 02; reference lines 499-590): centered 960px column, empty state "What would you like to know?" + suggestion rows, question bubble (surface fill, 2px ink top rule, "Q1" red label), collapsible "Thought for N s · M steps" panel built from REAL `thinking/tool_call/tool_result` events (plain labels, no provider names), streamed markdown answer (`react-markdown` + `remark-gfm`), numbered citation chips `[n]` (accent-700 fill) that open the passage slip (pre/hit/post from page text via `char_start/char_end`, highlighted), Evidence / Limitations / Safety columns where applicable, refusal card ("Declined by policy", accent-100, 3px red top rule), "No supporting passage" state, sticky composer (min-height 52px input + primary Send with arrow), Stop button, mode switch (Evidence + AI / Evidence only), conversation memory (send full `messages`), new hook `useChatStream` modelled on `useAgentStream`/`useJobStream` (fetch + ReadableStream + AbortController, cleanup on unmount), activate graph subgraph from last evidence chunk ids. BEFORE this task: get the live chat working against the gateway (known content-blocked issue, section 6.4; decide who fixes it, see there) and verify with a real two-turn conversation including a follow-up like "explain that in one sentence".
- **T10 Timeline** (screenshot 04; reference 640-678 + guide Part D iso charts): left report list (380px, from `/api/timeline` or reports), right isometric 3D bar charts (one per test with ≥2 points; data from `/api/reports/{uid}/trends?test=`; reference band from the report's printed range via `/measurements`), HTML labels positioned in % over the SVG, delta headline `13.1 → 14.0`.
- **T11 Knowledge Graph 3D, real data** (screenshot 03; reference 592-638 + guide Part A): port `GraphCanvas` (A16) exactly (projection, floor grid, curved edges, shapes, label halos, reveal animation, drag/zoom/hit-test, pulse ring, DPR, delta-time auto-rotate, reduced-motion pause) but feed it real nodes: mapping and cap in section 7; positions from `layout3D` (A18) run once; right panel 340px: Subgraph list (All nodes + real communities named after their most central concept + "Last answer" from Ask), selected node card with source passage, legend. Keep the "Showing N of M" honesty. Replace the old `GraphStage`/`KnowledgeGraphPage` (476 + ~2000 lines) without breaking the Ask → graph activation.
- **T12 Live ingestion show** (reference 775-798 + guide Part B): full-screen overlay (ink background, 64px grid at 6%) driven by the real job SSE (`page_extracted` with real OCR boxes, `chunked` with real spans, `embedded` samples, `indexed` totals, `done`), stage names Parse / OCR / Chunk / Embed / Index, HUD counter from real values, "Skip ahead", "Close", "Open the report"; readable minimum per stage but never finishing before the backend does; replaces `CinematicPipelinePopup`; respects the "Cinematic ingestion" setting and reduced motion; stays honest on failure (quarantine). Optional additive backend tweak for larger chunk/embedding samples.
- **T13 Tools**: Image to Text (`POST /api/tools/ocr`; page shows lines count, characters, mean confidence, original image with boxes toggle, text, Copy text, Download .md; low-confidence lines marked "needs review"), PDF to Text (pdf.js in the browser: needs `npm i pdfjs-dist`, text layer per page, "No text layer" tag, send scanned page to Image to Text), Text to Graph (client-side regex extraction exactly as in LOCAL_AI_BUILD_GUIDE section 3, Fibonacci-sphere layout, same 3D renderer, Download JSON). Add the Tools group to the sidebar then. Reference screenshots 07-09.
- **T14 Global cleanup**: restyle remaining unconverted pages/components (Datasets, Ontology, Notebooks, Gallery, gallery components) or remove them per the user's decision; remove remaining `rounded-*`, Spectral, `var(--ink-*)` uses; delete the old motion helpers no longer used; hex sweep.
- **T15 QA**: Playwright pass at 1440/820/390, axe-core, keyboard focus, reduced motion, console errors, `npm run build`, backend pytest, compare every screen to its reference screenshot; update `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `docs/ui-ux-design-notes.md`, `README.md`, add the redesign notes; decide merge to `main`.

## 12. Open issues list (quick reference)
- T07 pending (section 10). Gateway `content-blocked` flakiness for chat (6.4). No frame images. Tag wrapping ("Below range"). Old cinematic popup still in use. `vitagraph/` has duplicate docs; root has duplicate spec copies. Dev DB polluted with test personas/uploads. `site design/tsconfig.tsbuildinfo` noise. Datasets/Ontology/Notebooks routes orphaned from the nav. Docs describing the old design are stale. Backend README/tests count text (60/60) is stale (now 85, 89 after T07).

## 13. Quick command reference
```
# branch / state
git branch --show-current            # redesign/modernist-app
git log --oneline -8
# frontend build
cd "F:\kiruthika\kiruthika final project\site design" && npm run build
# backend tests (85 now, 89 after T07)
cd "F:\kiruthika\kiruthika final project\vitagraph\backend" && .venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
# run backend / frontend for live review
cd vitagraph\backend && .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
cd "site design" && npm run dev -- --port 5173
# stop both (PowerShell)
Get-NetTCPConnection -LocalPort 5173,8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

---

## 14. READY-TO-PASTE PROMPTS (the last prompt, exactly as it must be given to Gemini)

### 14.1 THE NEXT PROMPT TO GIVE (Task 07 re-run). Give this first when the session resumes.
Preconditions: branch `redesign/modernist-app`; `gemini/TASK_07_extractor_fix.md` is the corrected version (test 4 uses "Serum Glucose"; baseline 85 passed; final 89 passed). Commit `5ccfba8` contains it.

```
TASK 07 is being re-run with a corrected test. Your BLOCKED report was right: test 4 in the old task used a canonical test name (my mistake). Resolution 1 is chosen.
Re-read gemini/TASK_07_extractor_fix.md completely (it was corrected: test 4 now uses "Serum Glucose", baseline is 85 passed, final is 89 passed) and do TASK 07 again from Step 0, exactly as written. Same rules as before: branch redesign/modernist-app only; edit only vitagraph/backend/app/graph/extractor.py and the NEW file vitagraph/backend/tests/test_extractor_flags.py; never edit an existing test; stage by explicit path; STOP and report BLOCKED if anything fails. Reply only with the report in the format at the end of gemini/RULES.md.
```

What a correct Gemini reply looks like: STATUS COMPLETE; baseline `85 passed`; Step 1 run shows tests 1 and 3 FAILED, tests 2 and 4 passed; after the edits `4 passed`; full suite `89 passed`; the real-data one-liner prints `{'Vitamin D': 'LOW', 'Total Cholesterol': 'NORMAL', 'HbA1c': 'NORMAL'}` and `{'Weight': (82.0, None)}`; `git show --stat HEAD` lists only `extractor.py` and `tests/test_extractor_flags.py`; branch `redesign/modernist-app`.

### 14.2 The original Task 07 prompt (what was given before it came back BLOCKED), for reference
```
Continue the supervised VitaGraph redesign. TASK 06 was reviewed and accepted. This next task is a small BACKEND bug fix: wrong lab flags and a wrong reference range.

Do this, in order:
1. Read gemini/RULES.md completely (branch guard 3b applies).
2. Read gemini/TASK_07_extractor_fix.md completely.
3. Do TASK 07 exactly as written: Step 0, Step 1, Step 2, Step 3, then COMMIT. Do nothing else. Do not start TASK 08.

Non-negotiable:
- Work only on branch redesign/modernist-app (check with git branch --show-current first). Never touch main. Never git push, merge, rebase or reset.
- This task is the ONLY exception to the backend rule. Edit exactly these two files: vitagraph/backend/app/graph/extractor.py (three small edits) and the NEW file vitagraph/backend/tests/test_extractor_flags.py. Nothing else. Never edit an existing test file to make it pass.
- Write the tests first and show that tests 1 and 3 fail before the fix.
- Stage files by explicit path only. Never git add . or -A.
- Copy the code from the task exactly. If anything is unclear, or an existing test fails, STOP and report BLOCKED.

When finished, reply with the report in the exact format at the end of gemini/RULES.md, with real pasted command output (baseline pytest line, the failing run, the passing run, the full suite last line, the real-data one-liner output, git show --stat HEAD, git branch --show-current, git log --oneline -3). Reply with nothing else.
```

### 14.3 The prompt template for every later task (fill in NN, the task file, the reference screenshot and line range)
```
Continue the supervised VitaGraph redesign. TASK <NN-1> was reviewed and accepted. Remember: the live app must look EXACTLY like the reference design (design/reference/app-v3-source.html and design/reference/screens/*.png), with REAL data from the backend.

Do this, in order:
1. Read gemini/RULES.md completely.
2. Read gemini/TASK_<NN>_<name>.md completely. Open design/reference/screens/<screenshot>.png and look at it. Read design/reference/app-v3-source.html lines <a>-<b>.
3. Do TASK <NN> exactly as written: Step 0, <parts>, then VERIFY, then COMMIT. Do nothing else. Do not start TASK <NN+1>.

Non-negotiable:
- Work only on branch redesign/modernist-app (check with git branch --show-current first). Never touch main. Never git push, merge, rebase or reset.
- Edit ONLY the files listed in the task, plus screenshots in gemini/shots/. Do not edit anything under vitagraph/backend, design/, docs/, hooks, motion files or modernist.css (unless the task says so explicitly).
- Stage files by explicit path only. Never git add . or -A.
- Copy the code blocks from the task exactly. Do not restyle or "improve" them. No invented numbers.
- If something is unclear or the build fails 3 times: STOP and report BLOCKED.

When finished, reply with the report in the exact format at the end of gemini/RULES.md, with real pasted command output (build, the greps, the comparisons with the API output, the measurements, git show --stat HEAD, git branch --show-current, git log --oneline -3). Reply with nothing else.
```

### 14.4 The very first prompt that was ever given to Gemini (Task 01), for the record
```
You are the implementer on a supervised redesign of the VitaGraph frontend. A senior reviewer checks every task you finish.

Do this, in order:
1. Read gemini/RULES.md completely. Obey every rule in it. It overrides GEMINI.md, AGENTS.md and CLAUDE.md where they conflict.
2. Read gemini/TASK_01_foundation.md completely.
3. Do TASK 01 exactly as written, and nothing else. Do not start any other task.

Non-negotiable:
- Work only on the git branch redesign/modernist-app. Create it as TASK 01 step 1 says. Never touch main. Never git push, merge, rebase or reset.
- Stage files by explicit path only. Never use git add . or git add -A.
- Do not edit anything under vitagraph/backend, design/, or docs/.
- Do not read the whole repo. Read only what the task names.
- If you are stuck after 3 attempts, or the task is unclear, STOP and report BLOCKED. Do not guess or invent.

When finished, reply with the report in the exact format at the end of gemini/RULES.md, with real pasted command output (git branch --show-current, npm run build, git log --oneline -3, git show --stat HEAD). Reply with nothing else.
```
(Task files written so far: `gemini/TASK_01_foundation.md`, `TASK_02_shell.md`, `TASK_03_exact_shell.md`, `TASK_04_upload.md`, `TASK_05_compare_insights.md`, `TASK_06_library.md`, `TASK_07_extractor_fix.md`. Next file to write after T07 is accepted: `TASK_08_settings.md`.)

### 14.5 Final state of the session (what exists right now)
- Last commits on `redesign/modernist-app`: `500dd09` (prompts added to this context), `5ccfba8` (this context + corrected Task 07), `322a722` (Task 07 prompt), `4a4c336` (T06 by Gemini), `4ed843a` (T06 prompt), `8350cdc` (gateway retry), `ab6b2ce` (chat stream), `e52d6a1` (measurements + OCR).
- Working tree: clean except the harmless `site design/tsconfig.tsbuildinfo` and untracked reference/prototype files.
- No dev servers are running (both were stopped). Nothing is merged or pushed.
- Gemini's Task 07 attempt left no changes (it restored the files before stopping).
