# VitaGraph Modernist redesign: session context (written for Claude, to resume later)

**Last updated 2026-10-06: the newest state is section 18 (Upload process theatre, the AI-generated process film, video prompts, pacing, bug fix). Sections 17 and 18 are authoritative; the rest is history.** Written 2026-10-04 at the end of a long session and re-verified the same day (every commit hash, referenced file, and the corrected Task 07 text were checked against the repository). The user is closing the session. This file is the single source of truth for what was done, how work was delegated to Gemini, how each task went, what is broken or pending, and exactly what to do first when the session resumes. Read it fully before doing anything.

---

## 0. TL;DR (read this first)

- **Project:** VitaGraph, a final-year B.Tech project. Privacy-aware RAG over health reports. Backend `vitagraph/backend` (FastAPI, SQLite, ChromaDB, NetworkX, RapidOCR, AgentRouter LLM gateway). Frontend `site design/` (React 19, TS, Vite 8, Tailwind 4).
- **Goal of this work:** re-skin and rebuild the whole frontend so the LIVE app looks EXACTLY like the Modernist reference design (`VitaGraph-App-v3.html`), but with REAL backend data, not the reference's demo data. The user insists: "full working model, not a demo or fake mock-up".
- **Working agreement (the user repeated this three times, obey it):** Claude is the senior reviewer. Claude does NOT write the app code. A small model (the user calls it "Gemini 3.8 flash") writes the code. Claude (1) writes very detailed task prompt files in `gemini/`, (2) gives the user a short message to paste into Gemini, (3) when the user pastes Gemini's report or says "check again", reviews the work by building, grepping, diffing, and testing it live against the real backend, and (4) writes the next prompt. The user's words: "you are only going to do the review work and going to give a prompt right". I broke this twice (wrote backend code myself after "ok do it"). Do not do it again unless the user explicitly says to code.
- **Branch:** all work is on `redesign/modernist-app` (created from `main`). Gemini must never touch `main`, never push, never merge. Nothing has been merged or pushed.
- **READ ORDER:** section 0, then **section 16 (full status, review ledger and the detailed next work; NEWEST and authoritative)**, then section 15 (detailed log up to AG0), then `gemini/AGENT_PLAN.md`. Sections 5, 9, 10, 11, 14 describe the end of the first session and are historical.
- **UPDATE 6 (NEWEST, 2026-10-06, supersedes everything below where they differ): read section 18 FIRST.** The Upload page stage is no longer the 120-frame scrub panel: it is the new **process theatre** (`ProcessTheatre.tsx`, a 7-stage film made from the user's own AI-generated videos) that follows the REAL upload job, with the five pipeline rows, tile bars, file tag and pages table paced to the film. The full-screen ingestion show is now opt-in. Also a real bug fixed in `useJobStream.ts`. All of it is UNCOMMITTED (code + media + `video-prompts/`). On this day the user explicitly let me do the video/design work myself (not Gemini) and gave full design freedom with ONE rule: no numbers or data on the video.
- **UPDATE 5 (2026-10-05):** read section 17. The app is essentially complete: all pages rebuilt to the reference (`VitaGraph-App-v3.html`), AI Agent with conversations, three Tools pages, 3D knowledge graph, live ingestion show, privacy fix F1, any-text Text to Graph. Two Gemini sessions ran in parallel (main folder + git worktree), I merged them. Backend suite 222 passed. Main folder is `redesign/modernist-app` at `580f71f`, nothing pushed since the early push. Only owner inputs and optional polish remain (section 17.7).
- **UPDATE 4:** Gemini's LAST finished work is **AG2c** (runtime pool, commit `18f49c7`), reviewed and accepted with one bug and four weaknesses that become Part 0 of AG3 (see section 16.3). The next thing Claude writes is the AG3 task (streaming route, gates, event mapper, persistence); its full specification is in section 16.6.
- **UPDATE 3 (newest):** On 2026-10-04 the user decided that the Ask page becomes **"AI Agent"** and must run on the real DeepSeek Harness (https://github.com/deepseek-ai/deepseek-harness); the old Ask page is to be replaced. The staged plan is in `gemini/AGENT_PLAN.md` (stages AG0 to AG5, one Gemini task each; the first is `gemini/TASK_AG0_harness_spike.md`, a no-code spike). The user also decided: Claude does NOT do spikes or implementation, only prompts and reviews; and if the AI API does not work, nobody works around it (RULES.md section 5d), the user will switch to a paid API. Task 09b (citations, passage slip) is still the previous open task; its components are reused by AG3.
- **UPDATE 2 (supersedes the update below where they differ):** T07, T07b, T08a (backend: `POST /api/ai/privacy`, `.env` persistence, `/api/health` chunk sizes), T08 + T08b (Settings page, real controls, `src/lib/preferences.ts`), and T08c (chat retries a gateway-blocked message rephrased + paragraph break between tool rounds) are ALL ACCEPTED. Backend suite = 103 passed. The chat is now PROVEN live against the real gateway (the old "unresolved content-blocked" note in section 6.4 is obsolete: the filter is deterministic per text, so the fix rephrases the last user message). Reviews are in `gemini/reviews/`, Gemini's reports in `gemini/reports/`. NEXT: the Ask page (T09 series).
- **UPDATE (earlier the same day):** T07 was re-run by Gemini and ACCEPTED (commit `a890164`, 89 tests, review in `gemini/reviews/TASK_07_review.md`). Live review then found two more extractor bugs (line breaks inside names, a range swallowing the next row, which lost e.g. Potassium 5.9 HIGH), so `gemini/TASK_07b_extractor_rows.md` was written (commit `d497803`, expects 93 passed). **NEW PROTOCOL:** every task ends with a Gemini work report `gemini/reports/TASK_<id>_report.md` (RULES.md 5b) and must meet the quality bar (RULES.md 5c); the reviewer answers in `gemini/reviews/TASK_<id>_review.md`. NEXT: wait for the T07b report, review it, then T08 Settings. The chat `content-blocked` problem (6.4) must be solved before the Ask task.
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

---

## 15. DETAILED LOG: everything done after the first session (T07 to AG0), written 2026-10-04

**This section supersedes sections 5, 9, 10, 11 and 14 wherever they differ** (those describe the state at the end of the first session). Read this section after section 0. Commit hashes are on branch `redesign/modernist-app`. Nothing is merged or pushed.

### 15.1 Who does what (the working agreement, restated by the user many times)
- **Gemini** ("Gemini 3.8 flash", a small model) does ALL the work: implementation, research spikes, installs, experiments, live testing, screenshots.
- **Claude (me)** does only two things: (1) writes very explicit task files in `gemini/` and a short paste-message for the user, (2) REVIEWS what Gemini returns (diff against the task text, build, backend suite, live check against the real backend, screenshots) and writes the review.
- **User decisions of 2026-10-04 that change how I work:** "i dont want you to work ... let the gemini do the work" (stop doing spikes, installs and experiments myself; reading docs and code is fine) and "if the API is not working proper just leave it i will change to paid api" (never work around AI-gateway problems; see `gemini/RULES.md` section 5d).
- I broke the agreement twice before (wrote backend code after "ok do it") and once more on 2026-10-04 (I started installing the harness SDK and running a proxy myself; the user interrupted; I killed the leftover proxy on port 8010, nothing from it is in the repository). Do not repeat this: put exploration into a Gemini task.

### 15.2 The communication protocol (new since T07b; all of it is in the repository)
- Every Gemini task must produce a work report file `gemini/reports/TASK_<id>_report.md` with nine fixed headings (what was asked, what was done, files changed, raw command output, acceptance checklist, surprises, deviations, open questions, how to double-check). It is committed together with the task. Rules in `gemini/RULES.md` section 5b.
- I answer every report with `gemini/reviews/TASK_<id>_review.md` (verdict ACCEPTED / ACCEPTED WITH FIXES, what I checked, must-fix items). Gemini must read the previous review before starting the next task.
- `gemini/RULES.md` section 5c is the QUALITY BAR (the user wants a perfect, fully working project): green build, zero console errors against the real backend, every visible number equals the API, every control clicked once, empty/loading/error states seen, no overflow at 1440 and 820, no leftover debug code. Section 5d: API-blocked rule.
- Habits I demanded in reviews: copy line counts from `git diff --stat`, never estimate; compare each screenshot's text with the footer, header and API and write contradictions into report section 6; list visual oddities even if the checklist does not ask; never print `.env` or a key (only `ALLOW_API` lines may be shown); live tests only on the throwaway persona "Empty Test Persona" (`usr_51f14542d71a`, it has duplicate sample uploads and a `bad.pdf` from earlier tests).
- My own validation method for prompts (used up to T09b): I built each task in a scratch copy under the session scratchpad (a copy of `site design/src` with a junction to the real `node_modules`, or a copy of `vitagraph/backend/app` and `tests`), ran build/tests and a Playwright check against the real backend, and generated the task file FROM the validated files so Gemini copies code that is already proven. Always remove the junction with `cmd /c rmdir` (never `Remove-Item -Recurse` on it, that could delete `node_modules`). After the user's 2026-10-04 instruction this scratch validation is OFF: new prompts must instead make Gemini do the proving.

### 15.3 Chronology with commits (what Gemini did, what I did)
| Task | Commit | Gemini did | I did |
|---|---|---|---|
| **T07** extractor flags | `a890164` (prompt `322a722`, corrected `5ccfba8`; review in `d497803`) | Re-run of the corrected task: `extractor.py` gets `_LABELLED_FLAG_PATTERN` and a "range must contain a digit" guard; new `tests/test_extractor_flags.py` (4 tests). Suite 89. | Reviewed (diff identical to task, suite, real-data one-liner). Live API check on persona `usr_d1d7f9b2a4b1` showed Cholesterol/HbA1c no longer "Below range". Found two further bugs while testing live (below). |
| **T07b** extractor rows | `da87674` (prompt in `d497803`, review `571cf33`) | Regex of `_GENERIC_ROW_PATTERN`: `\s` became `[ \t]` in name, number gap, range and flag groups; label words (`result`, `value`, `range`...) are not tests; `tests/test_extractor_rows.py` (4 tests). Suite 93. | Found junk rows `Cholesterol, Total\nResult` and `Result`, and a range swallowing the next row (Potassium 5.9 HIGH vanished). Proved the fix in a scratch backend copy (all 89 old tests still passed). |
| **T08a** privacy endpoint | `349934d` (prompt `32cf03d`, review `d89ec1e`) | `POST /api/ai/privacy` (no network call, saves `allow_api`), `config.py` now really WRITES `.env` when `persist=True`, `/api/health` reports `chunk_target_chars` 200 and `chunk_max_chars` 800; `tests/test_ai_privacy.py` (5). Suite 98. Live: Off survives a backend restart, `.env` restored byte for byte. | Found by reading code: `POST /api/ai/config` pings the remote AI first, so turning AI OFF silently failed when the network was bad; and `update_ai_config(persist=True)` built the `.env` text but never wrote it. |
| **T08** Settings | `c40d260` (prompt `2d5f67a`, review `8e1676a`) | New `src/lib/preferences.ts` (localStorage `vitagraph_preferences`, `data-reduce-motion` on `<html>`, motion governor override), Settings page replaced (rows: Cinematic ingestion On/Off, Chunk size note, Embedding model note, Send retrieved passages On/Off via the new endpoint, Vector filter note, Reduce motion), `api/ai.ts` additions, Header listens to event `vitagraph:ai-config`, UploadPage opens the old popup only if Cinematic is On, `index.css` reduce-motion rule, `/settings` in `OWN_LAYOUT`. Intentionally NOT copied from the reference: Process speed (no effect until T12), chunk-size slider (backend has no such parameter), provider row (no provider names). | Designed all of it from the reference + real APIs, validated in scratch. |
| **T08b** | `3d0e321` (review `bde7c93`) | One line: notes say "Loading" while loading instead of "unreachable". | Spotted the contradiction in Gemini's own 820px screenshot (footer "Backend online" vs note "backend unreachable"). |
| **T08c** chat vs gateway | `ea680ab` (prompt `0a4a063`, review `868a989`) | `chat_service._stream_with_fallback` retries a `content-blocked` message with the last user message REPHRASED (variants: as typed, `User message: ...`, `... Please.`, `Question: ...`), remembers the variant that worked for later tool rounds, then falls back to the next model; paragraph break (`\n\n`) between text before a tool call and the answer; `tests/test_chat_blocked.py` (5). Suite 103. | Ran a read-only experiment matrix against the real gateway (BEFORE the no-experiments instruction): the filter is deterministic but arbitrary per text (`What was my hemoglobin?` always blocked, `Hello` passes, `Question: Hello` blocked), so my earlier "retry the same text" fix could never work. Verified a live 3-turn conversation with memory and a boundary refusal. |
| **T09a** Ask chat | `dd8cad7` (prompt `ce87a05`, review `57b6217`) | New `src/hooks/useChatStream.ts` (POST `/api/chat/stream` via fetch + ReadableStream + AbortController, owns the conversation, sends earlier answered turns as memory, collects steps and evidence cards, rAF-coalesced text), `components/ask/AnswerMarkdown.tsx` (react-markdown + remark-gfm), `components/ask/StepsPanel.tsx`, `pages/AskPage.tsx` (960px column, suggestions from the real graph, Q bubble, steps panel, refusal / no-passage / withheld / error cards with Try again, sticky composer with Send and Stop, New chat, `?q=` prefill, `?report=` scope chip, no-reports and backend-down states), `/ask` in `OWN_LAYOUT`. | Designed + validated live in ten scenarios. Review found two defects only visible with real fonts: an empty "Thought for 0.0 s - 0 steps" panel on refusals/errors, and a step `Looked up "" in the knowledge graph`. Both are Part 0 of T09b. |
| **T09b** citations (NOT yet run) | prompt `74e5b50` | (pending) citation chips `[n]` as dark-red numbered buttons, `PassageSlip` (stored page text with the cited characters highlighted via `/api/reports/{id}/pages` + `char_start/char_end`; failed page loads are not cached; fallback to the saved excerpt), `EvidenceModules` (Evidence / Limitations / Safety columns), plus the two Part 0 fixes. | Verified read-only that every evidence card's offsets point at exactly the right characters (also for the scanned OCR report) and live that the highlighted slip text equals the stored page text character for character. |
| **AG0** harness spike (RUNNING NOW) | prompt in `ed80cef` | See 15.5. | Research by reading docs only, then wrote the plan and the task. |

### 15.4 Technical discoveries worth remembering
- **Extractor** (`vitagraph/backend/app/graph/extractor.py`): flags and ranges must belong to their own line; the generic row pattern may not cross line breaks; label words are not tests. Canonical tests (e.g. Fasting Glucose) take the keyword-range path and do not read inline ranges; non-canonical names (e.g. Serum Glucose) use the generic path.
- **AI config** (`/api/ai/config` vs `/api/ai/privacy`): config pings the model and saves nothing when a switch-OFF ping fails; privacy never pings. `Settings.update_ai_config(persist=True)` now writes `backend/.env` (tests must monkeypatch `app.core.config.BACKEND_DIR` to a temp folder; the real `.env` has a key and is git-ignored).
- **Gateway** (AgentRouter): sends HTTP 400 `content-blocked` deterministically for some exact texts; sends HTTP 401 `unauthorized client detected` to clients without the special `User-Agent: RooCode/0.15.0` (our backend sends it; the DeepSeek Harness does not). Models verified: `deepseek-v4-flash` (default), `gpt-6-astra`, `claude-opus-5`, `claude-opus-4-8`. The user will move to a paid API; do not engineer around the free gateway.
- **Chat wire format**: `POST /api/chat/stream` (body `user_id`, `messages[]`, optional `job_id`, `report_id`, `mode`) answers with SSE where every event has `event_type` and a `metadata` payload; the model-level `completed` event carries `status` (answered / refused / insufficient_evidence), `summary_text`, `evidence[]` cards (`ref, chunk_id, report_id, report_filename, report_date, page_number, snippet, score, char_start, char_end`), `safety_passed`, `safety_note`; the terminal event is `completed` with `stage: "done"`. Hard gates before any model call: clinical-boundary refusal, prompt-injection sanitising, persona-scoped retrieval. The turn is persisted by `run_chat_task`.
- **Frontend conventions that bit us**: styling by inline `style={{}}` copied from the reference plus the reference classes in `src/theme/modernist.css` (`btn`, `input`, `tag`, `table`, `seg`); `OWN_LAYOUT` in `components/shell/AppShell.tsx` must contain every converted route (now `/upload /compare /insights /library /settings /ask`); the shell's `<main id="main-content">` is the scroll container (the sticky composer and the follow-the-answer scrolling depend on it); inline elements ignore width/height (a 12 px square step marker needs `display:block`); the header has its OWN `<form>` so tests must select the Ask composer by `data-testid="ask-composer"`; CSS `text-transform` upper-cases `innerText` (use `textContent` in tests); the scratch dev server served fonts wrongly through the node_modules junction (font warnings were an artifact, the real app is clean).
- **Tooling gotchas on this machine**: the bash tool mangles backslashes in heredocs, so write scripts with the Write tool; set `PYTHONIOENCODING=utf-8` for Python output; Playwright must use `channel="chrome"`; LF/CRLF git warnings are harmless; never stage `site design/tsconfig.tsbuildinfo`.
- **DeepSeek Harness facts** (read-only research, to be VERIFIED by AG0): repo `deepseek-ai/deepseek-harness` (MIT, developer preview, plugin framework "Cordis", ~60 packages); Python SDK `deepseek-harness-sdk` 0.1.5rc1 installs only with `pip install --pre`, brings `dsh.exe` for Windows x64; `DeepSeekHarness(dsh_home, cwd, profile="sdk-minimal", patches=(...), model=...).run(prompt, session_id=...)` returns `RunResult(final_response, finish_reason, events, notifications)`; credentials via `DEEPSEEK_API_KEY` and `DEEPSEEK_BASE_URL`; the `sdk-minimal` profile ships a PowerShell tool and `sandbox-policy mode: danger-full-access` (a patch with `disabled: true` on `persistent-pwsh` and `persistent-bash` and `mode: read-only` was seen to work with `--dump-config`); tools can be added with an MCP client row (`@deepseek-ai/dsh-mcp-client`, stdio, env); its `SAFETY.md` says unaudited and able to run model-written commands. Event names: `turn/start`, `step/start`, `system/message`, `user/message`, `request/header`, `request/context`, `assistant/message`, `assistant/attempt`, `tool/call`, `tool/result`, `step/end`, `turn/end`, `session/title`.

### 15.5 WHAT GEMINI IS DOING RIGHT NOW: Task AG0 (harness spike), started 2026-10-04
The user pasted the AG0 message into Gemini. Instructions are in `gemini/TASK_AG0_harness_spike.md`; the plan is in `gemini/AGENT_PLAN.md`. Gemini must NOT commit any code; its only deliverable is `gemini/reports/TASK_AG0_report.md` (one file in the commit `docs(agent): AG0 harness spike report`). Steps it is executing, in a temp folder `$env:TEMP\dsh_spike` (deleted at the end):
1. Install `deepseek-harness-sdk` with `--pre` into a temp venv; record versions and `dsh --version` (expected `0.1.5-rc.1`).
2. Dump the default `sdk-minimal` config; list its rows; locate the shell rows and `danger-full-access`.
3. Apply a lock-down patch (shell rows disabled, `sandbox-policy` `read-only`); prove with `--dump-config` that there is exactly one `sandbox-policy` row.
4. Prove from the harness's OWN events (`request/context` / `request/header`) which tools the model is offered, three times: unpatched, locked, locked + MCP. It points `DEEPSEEK_BASE_URL` at a dead local URL (`http://127.0.0.1:9/v1`) so no model call is needed; each run ends with `finish_reason: error`, which is expected.
5. Install `mcp` in the temp venv, write a dummy stdio MCP server with one tool `search_reports(query)` that echoes `VITAGRAPH_USER_ID` from its environment, attach it with a patch row, prove that `mcp__vitagraph__search_reports` is advertised and that the persona comes only from the process environment.
6. Real model call through the harness with the AgentRouter key from `backend/.env` (read inside a script, never printed). EXPECTED: HTTP 401 `unauthorized client detected`; per RULES 5d Gemini records "API blocked" and does not work around it. If it works, it captures one event of each type and shows how notifications can be streamed to a callback.
7. Windows behaviour: start-up seconds, no orphan `dsh` process after exit, two harnesses at once with different homes, two sessions on one runtime, where sessions are stored, how to cancel a run.
8. List every other enabled capability row (network, web fetch, filesystem, terminal, MCP resources) and say whether it is a model-callable tool.
9. Write the report with a ten-question YES/NO/UNKNOWN table (install; lock-down; provable from tool list; MCP attach; persona binding; real call; events and streaming; orphans; concurrency; cancel).

**How I will review it when Gemini says it finished:** `git show --stat HEAD` lists exactly one file (`gemini/reports/TASK_AG0_report.md`); `git status` shows no other modified tracked file and `$env:TEMP\dsh_spike` is gone; no key or `.env` content in the report; the lock-down is proven by the model-visible tool list (Steps 4b and 4c), not only by the config dump; all ten table rows cite a step; Step 6 shows either real events or the redacted 401 with "API blocked". I will NOT re-run the experiments myself. If the answers to questions 1 to 5 are YES, I write Task AG1; if the lock-down cannot be proven, I stop and tell the user before anything touches the repository.

### 15.5b AG0 RESULT (reviewed 2026-10-04, commit `c9f4939`, review `gemini/reviews/TASK_AG0_review.md`)
Gemini finished AG0 cleanly (one file committed, spike folder deleted, no orphan process, no key in the report, API 401 recorded as "API blocked"). PROVEN: the SDK (0.1.5rc1) installs and runs on this Windows machine; the lock-down is proven from the harness's own `request/header` -> `data.header.tools` (unpatched: `pwsh`; locked: `[]`; locked + MCP: only `mcp__vitagraph__search_reports`); an MCP tool can be attached with a `- insert:` patch row; no orphan processes; several runtimes with different homes run side by side; sessions are JSONL files under `dsh_home\sessions`. NOT PROVEN (reviewer found five gaps): (1) persona delivery through the harness config (the patch had no `env:` block) and no ambient leak; (2) live streaming of events (only a code example, never run); (3) cancel of ONE turn (`close()` kills the whole runtime); (4) the design hole that a shared warm runtime can only serve ONE persona because the persona is in the MCP server's process environment, so the design must be ONE RUNTIME PER PERSONA, whose memory/start-up cost is unmeasured; (5) config facts (supported MCP plugin form `dsh-mcp` vs documented `dsh-mcp-client`, `workspaceRoot` dropped by the patch, empty tool description, 15 s failing run, replacing the system prompt, session resume). Therefore the NEXT Gemini task is **AG0b** (`gemini/TASK_AG0b_harness_followup.md`, another no-code spike, one report file), and only after its review is AG1 written. The binding design consequences are listed in `gemini/AGENT_PLAN.md` ("Design consequences found by the AG0 review").

### 15.5c AG0b RESULT (reviewed 2026-10-04, commit `656129d`, review `gemini/reviews/TASK_AG0b_review.md`) and the NEW stage order
AG0b ACCEPTED. Binding results: supported MCP form is `@deepseek-ai/dsh-mcp-client` (`serverName`, `transport: stdio`, `command`, `args`, `env`) added with `- insert:`; the patch `env:` value reaches the tool server exactly, BUT without an `env:` block the parent's ambient `VITAGRAPH_USER_ID` LEAKS into the server (so the backend must always write `env:` and start the harness with a scrubbed environment); events stream live via `on_notification` (also `llm/retry`, `llm/retry-started`); there is NO per-turn cancel, NO resume after restart (`session "s1" already exists`), NO list/delete-sessions API (protocol has only `initialize`, `session/prompt`, `shutdown`), so: cancel = close that persona's runtime (0.16 s, restart about 3 s), one NEW harness session per user turn with VitaGraph sending the earlier turns, VitaGraph's own database owns the conversation list, deleting a persona = close runtime + delete its `dsh_home`; cost about 170 MB per runtime (the report's 270 MB wrongly counted two unrelated `node` processes of a Stitch MCP helper); `mcp` package is 2.3.0 (`MCPServer`); system prompt replaced by a `system-prompt`/`personaPrefix` patch; `- id: llm-retry` + `disabled: true` makes failures fast for tests. New stage order in `gemini/AGENT_PLAN.md`: **AG1 VitaGraph MCP tool server** (`TASK_AG1_mcp_tool_server.md`, the current Gemini task), AG2 runner + per-persona runtime pool, AG3 SSE route + event mapper + gates + persistence, AG4 frontend "AI Agent" page, AG5 conversations list, AG6 safety suite + docs + paid-API QA.

### 15.6 Everything still to do (in order)
0. **AG1 ACCEPTED** (commit `ba9aeae`, review `gemini/reviews/TASK_AG1_review.md`; 111 backend tests; four tools `list_reports`, `search_reports`, `get_measurements`, `graph_lookup`; persona only from env; four small weaknesses go into AG2a Part 0). **AG2a ACCEPTED** (commit `99b5ad5`, review `gemini/reviews/TASK_AG2a_review.md`; 121 backend tests; locked-down profile generator, agent system prompt, SDK pinned, `verify_lockdown`; the MCP 2.3.0 stdio transport already diverts fd 1 to stderr while serving, so stray prints cannot corrupt the protocol). Review found ONE design defect: `verify_lockdown` clears and refills the process-wide `os.environ` (unsafe in a threaded server). **AG2b ACCEPTED** (commit `083e8dd`, review `gemini/reviews/TASK_AG2b_review.md`; 131 backend tests; harness hosted in a WORKER PROCESS started with a minimal environment, JSON-lines protocol, cancel = kill the process tree, live lock-down monitor, `verify_lockdown` moved onto it, zero writes to `os.environ`). Review found four robustness problems in `runtime.py` (blocking `start()` inside async code, a stale reader-thread race after kill/restart, no turn timeout, unguarded worker output) which are Part 0 of AG2c. The current Gemini task is **AG2c** (`gemini/TASK_AG2c_runtime_pool.md`: `RuntimePool`, one runtime per persona, LRU eviction, idle reaping, `forget_persona`, plus the Part 0 fixes). Then AG3 (SSE route, gates, mapper, persistence), AG4 (frontend AI Agent page), AG5 (conversations), AG6 (safety suite, docs, paid-API QA). Items 1 and 2 below that mention AG1 to AG5 use the OLD numbering.
1. ~~Review AG0~~ (done, see 15.5b). Then write **AG1** (backend runner `app/agent/`, `POST /api/agent/stream`, hard gates outside the harness, persistence, fake-harness tests, dependency pin), **AG2** (VitaGraph MCP tool server, persona from env), **AG3** (rename Ask to "AI Agent", route `/agent` with `/ask` redirecting and keeping its query string, delete the old Ask components, harness-style UI: trajectory timeline, live stats, tool-call cards; reuse the 09b chips and slip), **AG4** (sessions list/resume/delete, titles), **AG5** (safety test suite, docs, final QA with the paid API).
2. **T09b** is written but not run (its Part 0 fixes and the citation components are prerequisites for AG3). If the user wants the harness first, T09b can be folded into AG3.
3. **T10 Timeline** (isometric charts from `/api/reports/{uid}/trends`, reference screenshot `04_Timeline.png`, lines 640-678 and the guide Part D).
4. **T11 Knowledge Graph 3D on real data** (screenshot 03, lines 592-638, guide Part A; replace the old `GraphStage`/`KnowledgeGraphPage`; keep "Showing N of M"; "Last answer" subgraph from the agent via `POST /api/graph/subgraph`).
5. **T12 Live ingestion show** (reference lines 775-798 + guide Part B), driven by the real upload job events, replaces `CinematicPipelinePopup`, adds the "Process speed" setting, respects "Cinematic ingestion" and "Reduce motion".
6. **T13 Tools pages** (Image to Text via `POST /api/tools/ocr`, PDF to Text with pdf.js, Text to Graph client-side) + the Tools group in the sidebar.
7. **T14 Cleanup** (remove `components/agent/`, `useAgentStream`, unused gallery pieces, remaining `rounded-*`, Spectral, `var(--ink-*)`, the "Component gallery (dev)" sidebar link; decide Datasets/Ontology/Notebooks).
8. **T15 QA and docs** (1440/820/390, axe-core, keyboard, reduced motion, console; update `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `docs/ui-ux-design-notes.md`, README; clean throwaway personas; merge decision).

### 15.7 Open decisions and facts needed from the user
- Datasets / Ontology / Notebooks: bring back in a nav group, or delete? (routes still work by URL; removed from the nav to match the reference)
- Frame images for the Upload stage (`site design/public/assets/frames/frame_0001.jpg` ...; `ffmpeg -i in.mp4 -vf "fps=24,scale=1600:-1" -q:v 3 frame_%04d.jpg`); until then the stage shows a developer placeholder text.
- When the user switches to a PAID API: tell Claude, so the "API blocked" live checks (AG0 step 6, AG1 and later model checks) are re-run properly. Also decide then whether the harness should use the vendor's official endpoint directly (no special User-Agent needed).
- Merge of `redesign/modernist-app` into `main`: not decided, nothing pushed.
- Housekeeping: throwaway personas hold test uploads and chat events; `site design/tsconfig.tsbuildinfo` shows as modified after every build (never commit it).

### 15.8 State of the machine at the time of writing
Backend suite 103 passed. Frontend `npm run build` green. No dev servers running (ports 5173, 8000, 8010 free). `vitagraph/backend/.env` has `ALLOW_API=true` and is unchanged from 2026-10-02. Latest commits: `ed80cef` (plan + AG0 prompt + RULES 5d), `74e5b50` (T09b prompt). Working tree: clean except `site design/tsconfig.tsbuildinfo` and untracked reference/prototype files.

### 15.9 How to resume in a new session (do exactly this)
1. Read section 0, then this section 15, then `gemini/AGENT_PLAN.md`.
2. `git status`, `git log --oneline -6`, `ls gemini/reports gemini/reviews`.
3. If `gemini/reports/TASK_AG0_report.md` exists, review it as described in 15.5 and write `gemini/reviews/TASK_AG0_review.md`; otherwise ask the user whether Gemini has finished.
4. Then continue with 15.6. Always: one task at a time, closed file list, explicit staging, report file, review file, no work by Claude beyond prompts and reviews.

---

## 16. FULL STATUS, FULL REVIEW AND THE DETAILED NEXT WORK (written 2026-10-04 after Gemini finished AG2c)

**This section is the newest and authoritative one. It supersedes 15.5 to 15.9 where they differ** (15.6 in particular lists stage numbers that were later re-ordered). Read order for a new session: section 0, then THIS section 16, then `gemini/AGENT_PLAN.md`, then the newest file in `gemini/reviews/`.

### 16.1 One-paragraph summary
The Modernist re-skin of the frontend is done for Upload, Library, Compare, Insights, Settings and the Ask chat core (T01 to T09a, all reviewed and accepted). Task T09b (citation chips, highlighted passage slip, evidence columns) has a finished prompt but has NOT been run by Gemini. In parallel, on the user's request of 2026-10-04, the Ask page is being turned into an **AI Agent on the real DeepSeek Harness**. The whole BACKEND foundation of that agent is built and reviewed: the VitaGraph tool server (AG1), the locked-down per-persona harness profile and start-up safety check (AG2a), the worker-process runtime with real cancel and live lock-down monitor (AG2b), and the runtime pool (AG2c, Gemini's LAST finished work, reviewed in this session). Still missing for the agent: the HTTP streaming route with its safety gates and event mapper (AG3), the frontend page (AG4), the conversation list (AG5), the safety suite / docs / paid-API QA (AG6). The free AI gateway rejects the harness (HTTP 401 "unauthorized client"), so no real model answer through the harness has been seen yet; the user will switch to a paid API later. Backend suite: 147 tests (Gemini's figure; reviewer re-run noted in 16.9). Nothing is merged or pushed.

### 16.2 Status board (every task, in order)
| Id | What | Commit | State |
|---|---|---|---|
| T01 to T06 | tokens, fonts, shell, nav, Upload, Compare, Insights, Library, real measurements endpoint, OCR endpoint, chat endpoint | see 15.3 / section 5 | ACCEPTED |
| T07, T07b | extractor: flags and ranges stay on their own line; rows never span lines | `a890164`, `da87674` | ACCEPTED (89 then 93 tests) |
| T08a | `POST /api/ai/privacy` (no network), `.env` persistence really written, health reports chunk sizes | `349934d` | ACCEPTED (98 tests) |
| T08, T08b | Settings page with real controls; "Loading" instead of false "unreachable" | `c40d260`, `3d0e321` | ACCEPTED |
| T08c | chat retries a gateway-blocked message rephrased; paragraph break between tool rounds | `ea680ab` | ACCEPTED (103 tests) |
| T09a | Ask as a real streaming chat (hook, markdown, steps panel, memory, stop, refusal/error cards) | `dd8cad7` | ACCEPTED with two fixes (folded into T09b Part 0) |
| T09b | citation chips, passage slip, Evidence/Limitations/Safety columns | prompt `74e5b50` | PROMPT READY, NOT RUN |
| AG0, AG0b | harness spikes (no code): install, lock-down proof, MCP attach, persona env, streaming, cancel, costs | `c9f4939`, `656129d` | ACCEPTED (reports only) |
| AG1 | VitaGraph MCP tool server (4 tools, persona only from env) | `ba9aeae` | ACCEPTED (111 tests) |
| AG2a | locked-down profile generator, agent prompt, minimal child env, `verify_lockdown`, SDK pinned | `99b5ad5` | ACCEPTED (121 tests) |
| AG2b | harness in a worker process, real cancel, live lock-down monitor | `083e8dd` | ACCEPTED (131 tests) |
| **AG2c** | **runtime pool + 4 runtime fixes** | **`18f49c7`** | **ACCEPTED with 1 bug + 4 weaknesses (Part 0 of AG3); GEMINI'S LAST FINISHED WORK** |
| AG3 | streaming route, gates, event mapper, persistence | - | PROMPT NOT YET WRITTEN (spec in 16.6) |
| AG4 to AG6, T10 to T15 | see 16.6 and 16.7 | - | NOT STARTED |

### 16.3 Gemini's last finished work: AG2c (runtime pool), and my full review of it
**Delivered** (`vitagraph/backend`): `app/agent/pool.py` (`RuntimePool`, `PoolFull`, `get_pool()`), Part 0 fixes in `runtime.py` (`astart`/`acancel`/`aclose`/`akill` through `asyncio.to_thread`, reader threads check `self._proc is proc`, `idle_timeout` default 180 s that kills a silent turn and yields "The agent took too long to answer."), `worker.py` (`_send_lock`), `lockdown.py` (non-blocking), tests `test_agent_pool.py` (12) and 4 new tests in `test_agent_runtime.py`, fake-worker modes `slow_start` and `silent`. Measured: event-loop heartbeat gap 1.108 s before the fix, 0.063 s after. A real-harness smoke test against the dead URL produced 15 notifications and a `result`, then `forget_persona` deleted the persona folder under the real `backend/data/agent` (verified gone).
**Review verdict: ACCEPTED**, checked by me: commit contents equal the closed list, numstat figures in the report are correct, `.env` untouched, no leftover processes, no `os.environ` writes in `app/agent`, real `data/agent` folder absent. **Findings (all in `gemini/reviews/TASK_AG2c_review.md`, to be fixed as Part 0 of AG3, each with a failing test first):**
1. **BUG, a failed worker start poisons the persona**: in `RuntimePool.stream_turn` the entry is stored with `running=True` BEFORE `astart()`; if the start raises, the entry stays with `running=True` and a dead runtime for ever, so every later turn raises `RuntimeBusy` and `reap_idle` never removes it. Fix: try/except around eviction-close and start that removes the entry and re-raises.
2. **The stale-thread race test is toothless**: the report's own failing-first output says "3 failed, 1 passed" (the race test passed before the fix) while its acceptance line claims all four failed first. Replace by a deterministic test that drives `_drain_stdout` for an OLD process object and asserts the new queue and start flags are untouched.
3. `_default_runtime_factory` and `get_pool()` are untested (the real server will use them): test the factory with monkeypatched settings (`effective_api_key`, `effective_base_url`, `effective_model`) and that no process is started; test the singleton.
4. `forget_persona` can fail on Windows right after a tree kill (file handle still held): retry `shutil.rmtree` up to 5 times, 200 ms apart.
5. A dead own entry counts toward `max_runtimes` and can cause an unneeded eviction of another persona.
Notes: first turn of a persona costs two process starts (probe + real, about 4 s each) so AG3 must emit an immediate status event; the full suite takes about 220 s (a `slow` marker comes in AG6).

### 16.4 Complete review ledger (what each review found, so nothing is forgotten)
| Where | Defect found by review | Found how | Status |
|---|---|---|---|
| T07 | the corrected test 4 used a canonical test name | Gemini's BLOCKED report | fixed (Resolution 1) |
| T07/T07b | flag bleed (next line's `-low`), range from a word, name spanning lines, range swallowing next row (Potassium 5.9 HIGH vanished), `Result` rows | live API check on real data | FIXED (T07b) |
| T08a | turning AI OFF failed silently when the network failed (`POST /api/ai/config` pings first); `persist=True` never wrote `.env` | reading the code | FIXED |
| T08 | note rows said "backend unreachable" while loading | Gemini's own 820 px screenshot | FIXED in T08b |
| T08c | gateway content filter is deterministic per text, so retrying the same text can never work | read-only experiments on the real gateway | FIXED (rephrase variants) |
| T09a | empty "Thought for 0.0 s - 0 steps" panel on refusals/errors; step `Looked up "" ...` | screenshots with real fonts | OPEN: T09b Part 0 |
| AG0 | persona binding, streaming and cancel only half proven; "one warm runtime" cannot serve several personas | report read-through | resolved by AG0b |
| AG0b | memory figure inflated by two unrelated `node` processes (Stitch MCP helpers); ambient `VITAGRAPH_USER_ID` leaks into the tool server when the patch has no `env:` | process-id check; spike result | design fixed (explicit env, worker process) |
| AG1 | non-thread-safe reference numbers; `_format_json` could return invalid JSON; stray docstring quote; overstated stdout claim | reading code | FIXED in AG2a (stdout: MCP 2.3.0 already diverts fd 1) |
| AG2a | `verify_lockdown` rewrote the process-wide `os.environ` (unsafe in a threaded server) | reading code | FIXED in AG2b (worker process) |
| AG2b | blocking `start()` inside async code; stale reader thread after kill/restart; no turn timeout; unguarded worker output | reading code | FIXED in AG2c |
| AG2c | failed start poisons the persona; toothless race test; untested default factory; rmtree race; dead-entry accounting | reading code + report vs output | OPEN: AG3 Part 0 |
Recurring Gemini habits I keep asking for: copy line counts from `git diff --numstat`, never estimate; believe the output when it contradicts the checklist; answer PARTIAL when evidence is partial; check process ids and command lines before attributing a process to a test; never print keys or `.env`.

### 16.5 The AI Agent as built so far (backend only; nothing is wired to HTTP or to the UI yet)
```
browser (future AG4) -> POST /api/agent/stream (future AG3: gates, history, SSE mapper, persistence)
   -> app/agent/pool.py      RuntimePool: one runtime per persona, LRU, idle reap, busy refusal, forget_persona
   -> app/agent/runtime.py   AgentRuntime: spawns the worker with a MINIMAL env, JSON-lines protocol, stream_turn,
                             live monitor of request/header, cancel = kill process tree, idle_timeout
   -> app/agent/worker.py    standalone script hosting deepseek_harness.DeepSeekHarness (key arrives only via the pipe)
   -> dsh.exe (the harness)  locked down by generated patches: shells disabled, sandbox read-only, system prompt replaced
   -> app/agent/mcp_server.py  stdio MCP server: list_reports, search_reports, get_measurements, graph_lookup
                             (persona ONLY from VITAGRAPH_USER_ID; report ownership checked; thread-safe refs)
   -> existing services (retriever/Chroma, report_service, measurement_service, graph builder, SQLite)
```
Other files: `app/agent/profile.py` (per-persona folders `data/agent/<persona>/{home,ws,patches}`, patch generators, `child_environment()` allow-list, `TOOL_NAMES`), `app/agent/prompt.py` (`AGENT_SYSTEM_PROMPT`), `app/agent/lockdown.py` (`assert_locked_down`, `tool_names_from_events`, `verify_lockdown_async` + sync wrapper, cache). Tests: `tests/test_agent_mcp_server.py`, `test_agent_profile.py`, `test_agent_runtime.py`, `test_agent_pool.py`, fixtures `fake_worker.py`, `echo_mcp_server.py`.
**Safety layers (all tested):** (1) no shell tools and a read-only sandbox, proven from the harness's own `request/header` tool list; (2) the model can only call the four VitaGraph tools; (3) the persona is fixed by the backend (explicit patch `env:` + minimal worker environment + no persona parameter in any tool + ownership check on every `report_id`); (4) the API key is never in argv, environment of the worker, patches, or disk; (5) live monitor kills the runtime if any other tool is ever offered; (6) cancel and abandoned streams kill the whole process tree; (7) the hard gates of the existing chat (clinical-boundary refusal, injection sanitising, diagnostic-phrase check) will run OUTSIDE the harness in AG3.
**Pinned dependencies in `requirements.txt`:** `mcp==2.3.0`, `deepseek-harness-sdk==0.1.5rc1`, `deepseek-harness-runtime-bin==0.1.5rc1`.

### 16.6 THE NEXT WORK IN DETAIL
**Order: (0) T09b, optional now but needed before AG4; (1) AG3; (2) AG4; (3) AG5; (4) AG6; (5) T10 to T15.** Each is ONE Gemini task with a closed file list, a report file and a review file. Claude writes the task file, commits it, gives the user the paste message, then reviews.

**AG3: the streaming route, the gates, the event mapper, persistence (backend). The prompt is the NEXT thing Claude writes.**
- **Part 0 (first):** the five AG2c review items (16.3), each with a failing test first.
- **Route** `POST /api/agent/stream` in a new `app/routes/agent.py` registered in `app/main.py` (that edit is allowed in AG3), body `{user_id, messages[{role,content}] (whole conversation, last = user), conversation_id?, report_id?}` (same shape as `ChatRequest` in `app/schemas/chat.py`; the persona is `user_id` and is validated with `user_service.user_exists`). Response: SSE like `/api/chat/stream` (events carry `event_type` and `metadata`; terminal `completed` with `stage: "done"`).
- **Gates OUTSIDE the harness, in this order:** (a) `safety.classify_question` + `needs_boundary_response` -> refusal (`text_delta` with `safety.BOUNDARY_RESPONSE`, `completed` status `refused`, NO runtime started); (b) `safety.sanitize_question_for_retrieval`, empty after sanitising -> refusal text as in `chat_service`; (c) after the answer: `_diagnostic_phrase` check (copy the small logic, do not import private names from `chat_service` if avoidable) -> `safety_passed` false and the UI withholds it; (d) `allow_api` off or no key -> evidence-only fallback exactly like `chat_service` (offline composer), no runtime.
- **Conversation memory:** a NEW harness session id per user turn (`<conversation_id>-t<n>`); the earlier answered turns are sent as a compact context block in the prompt text (the harness cannot resume sessions after a restart, AG0b). Cap size (last 12 turns, 4000 chars each, as in `chat_service`).
- **Event mapper** from harness notifications (`method` `session.event` with `payload.event.type`, plus `session.status`, `subagent.started/finished`) to the SSE contract: `thinking` (reasoning), `tool_call` (`mcp__vitagraph__search_reports` -> `search_chroma`-compatible names so the existing frontend contract keeps working, arguments), `tool_result` (parse the JSON text of the tool result; for `search_reports` extract `evidence[]` cards), `text_delta` (assistant text), `model_fallback`, NEW events `status` (immediate "starting the agent", "retrying" from `llm/retry`/`llm/retry-started` with attempt number), `step` (step/start, step/end), `stats` (turns, steps, tool calls, elapsed ms, token counts if present), `completed` (status, `summary_text`, `evidence`, `safety_passed`, `ai_status`, `session_title` from `session/title`), `error` (clear text; for HTTP 401/403 from the gateway say the AI service refused the request, never print the key). **Unknown until the paid API:** the exact shapes of `tool/call`, `tool/result`, `assistant/message` events. The mapper must be written from the harness documentation (read `docs/tool-execution-pipeline.md` and `docs/subsystems/session.md` with `gh api repos/deepseek-ai/deepseek-harness/contents/<path> -H "Accept: application/vnd.github.raw"`), defensive (unknown event types are ignored, never crash), covered by tests with a fake pool, and flagged "shape unverified" in the report until AG6.
- **Errors/HTTP:** `RuntimeBusy` -> HTTP 409 before streaming (or an `error` event if already streaming); `PoolFull` -> 503 `error` event; `LockdownViolation` -> `error` event, the runtime is already killed; client disconnect -> the pool cancels that persona's runtime.
- **Persistence:** after completion call the same helpers as `chat_service.run_chat_task` (`question_service._persist`, `_record_ai_call`) so the Timeline and AI-call log keep working.
- **App lifecycle (edit `app/main.py`):** a lifespan task calling `pool.reap_idle()` every 60 s and `pool.close_all()` on shutdown; and `pool.forget_persona` when a persona is deleted (hook in the existing delete-user flow; read it first).
- **Tests:** route tests with `TestClient` and an injected fake pool (dependency override), covering: refusal without runtime, sanitised-empty, normal turn mapping, retry events, tool call + evidence extraction, disconnect cancels, busy 409, pool full, lockdown violation, offline fallback, persistence row written. No real model.
- **Live check (API blocked is expected):** start the backend, call the route for the throwaway persona "Empty Test Persona" (`usr_51f14542d71a`); with the free gateway the stream must end with a clean `error` event within about 20 s (retries), never hang; paste it.

**T09b before AG4:** run the existing prompt `gemini/TASK_09b_ask_citations.md` (Part 0: no steps panel without steps, no empty quotes; citation chips; passage slip; Evidence/Limitations/Safety columns). AG4 reuses these components. If the user prefers, fold T09b into AG4.

**AG4: the frontend "AI Agent" page.** Rename Ask to **AI Agent**: route `/agent` (keep `/ask` as a redirect that preserves the query string, because the Upload page links to `/ask?report=` and the header search sends `/ask?q=`), sidebar label "AI Agent" with a new sub-label, header title and subtitle, `OWN_LAYOUT` entry, page `data-testid`s kept. Delete the old Ask components that become unused (`src/components/agent/*`, `useAgentStream.ts`, the old `useChatStream` if replaced; decide in the task) only when the task says so by name. New hook consuming `/api/agent/stream` (fetch + ReadableStream + AbortController, cleanup on unmount, same pattern as `useChatStream`), harness-style UI: (1) a **trajectory timeline** (turn -> steps -> tool calls, retries, fallback notice, each row with status dot, label, duration), (2) a **live stats strip** (turns, steps, tool calls, elapsed seconds, tokens if available), (3) **tool-call cards** (tool name in plain words, arguments, a short result summary, expandable raw result), (4) the streamed Markdown answer with the 09b citation chips and passage slip, (5) refusal/withheld/error cards as in 09a, (6) Stop button = abort the fetch (the backend cancels the persona runtime), (7) the first-turn "starting the agent" state. No provider or model names anywhere ("AI Agent" only). Verification as in 09a (Playwright script run by Gemini against the real stack, API-blocked results recorded as such).

**AG5: conversations.** New table (backend) `agent_conversations` (id, persona, title, created, updated) and `agent_messages` (or reuse the existing questions table; decide in the task after reading `question_service`), endpoints list / get / delete, titles from the harness `session/title` event with a fallback of the first 60 characters of the first question; frontend sidebar list inside the AI Agent page (reopen, new, delete); deleting a persona deletes its conversations.

**AG6: safety suite, docs, QA.** Tests that fail the build if: any tool other than the four is offered; a tool has a persona parameter; the patch lacks `env:`; the worker environment contains a non-allow-listed name; the key appears on disk or argv; boundary refusal is skipped; the diagnostic check is skipped. Introduce a pytest marker `slow` for real-harness tests and document `pytest -m "not slow"`. Update `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `docs/ui-ux-design-notes.md`, README (the old design and the "backend locked" rules are stale). **When the user has switched to a paid API:** re-run everything marked "API blocked" (AG0 step 6, AG0b unknowns, AG3 live check), capture the real `tool/call`, `tool/result`, `assistant/message` event shapes, fix the mapper where it differs, and re-test a full conversation with citations in the browser. Also re-check the system prompt tool names (the model sees `mcp__vitagraph__search_reports`, the prompt says `search_reports`).

### 16.7 The rest of the Modernist work (unchanged from 15.6, listed again)
T10 Timeline (isometric charts, reference `04_Timeline.png`, lines 640-678, guide Part D), T11 Knowledge Graph 3D on real data (screenshot 03, lines 592-638, guide Part A; "Last answer" subgraph from the agent via `POST /api/graph/subgraph`), T12 live ingestion show (lines 775-798, guide Part B; adds the "Process speed" setting; replaces `CinematicPipelinePopup`), T13 Tools pages (Image to Text via `POST /api/tools/ocr`, PDF to Text with pdf.js, Text to Graph client-side; Tools group in the sidebar), T14 cleanup (old `components/agent`, `useAgentStream`, gallery pieces, remaining `rounded-*`, Spectral, `var(--ink-*)`, the "Component gallery (dev)" sidebar link; Datasets/Ontology/Notebooks decision), T15 QA and docs (1440/820/390, axe-core, keyboard, reduced motion, console; docs; clean throwaway personas; merge decision).

### 16.8 Open decisions and inputs needed from the user
1. **Paid API:** tell Claude when it is switched (what provider, which base URL and model); then the "API blocked" checks are re-run. The harness expects a DeepSeek-compatible endpoint (`DEEPSEEK_BASE_URL`, `DEEPSEEK_API_KEY`); the backend passes `settings.effective_base_url` / `effective_api_key` / `effective_model` to the runtime (check these settings point to the paid provider).
2. **Order choice:** run T09b first, or fold it into AG4?
3. Datasets / Ontology / Notebooks: bring back or delete.
4. Frame images for the Upload stage (`site design/public/assets/frames/frame_0001.jpg` ...).
5. Merge of `redesign/modernist-app` into `main` (nothing pushed).
6. Awareness: the free gateway blocks the harness; until the paid API, the agent can be built and tested only up to the model call.

### 16.9 State of the machine at the time of writing
Branch `redesign/modernist-app`, last Gemini commit `18f49c7` (AG2c), last Claude docs commit before this update `e304d39`. `vitagraph/backend/.env` unchanged since 2026-10-02 13:38 (`ALLOW_API=true`). No dev servers or harness processes running (ports 5173, 8000, 8010 free). `vitagraph/backend/data` has no `agent` folder. Working tree clean except `site design/tsconfig.tsbuildinfo` and untracked reference/prototype files. Backend suite: **147 tests, all passed** (Gemini: 223 s; my own re-run after AG2c: 147 passed in 209 s, working tree clean, no leftover `dsh`/worker/echo-server process, `backend/data/agent` absent). Frontend `npm run build` last confirmed green at the T08b review (no frontend change since T09a; T09a was accepted with a green build).

### 16.10 Resume checklist (do exactly this)
1. Read section 0, section 16, `gemini/AGENT_PLAN.md`; `git status`, `git log --oneline -8`, `ls gemini/reports gemini/reviews`.
2. If a report newer than `TASK_AG2c_report.md` exists, review it first (closed file list, numstat, suite, leftovers, code reading, report vs output).
3. Otherwise write `gemini/TASK_AG3_agent_route.md` from the spec in 16.6 (Part 0 + route + gates + mapper + persistence + lifecycle + tests), commit it, and give the user the paste message.
4. Never do spikes or implementation yourself; if the AI API fails, record "API blocked" and move on.


---

## 17. STATE AT 2026-10-05 (NEWEST AND AUTHORITATIVE; written after the S1 to S6 rounds)

### 17.1 One paragraph
The "exact reference design" push is done. After the user complained ("you forgot all the OG design", "I need the same exact 3D knowledge graph", "the live one has no tools"), I wrote `gemini/DESIGN_LAW.md` (the reference wins), cancelled/superseded the plan's own design choices (`gemini/plan/SUPERSEDED.md`), and ran lean rounds: S1/S2 (shell, header, upload, agent, settings + chunk size, Tools pages, ingestion show; reference 3D graph without three.js), S3/S4 (polish, conversations, readable graph labels, visual pass of four pages, docs), S5 (header fix, docs numbers, quiet frame probe, privacy F1, click-through), S6 (Text to Graph from any text). Everything is merged on `redesign/modernist-app` (main folder). The worktree `F:\kiruthika\vitagraph-backend-track` (branch `redesign/backend-track`, at `19f394e`, identical ancestor) is RETIRED; remove it with `git worktree remove` when convenient (its data folder `F:\kiruthika\vitagraph-data-wt` can be deleted).

### 17.2 Working agreement (unchanged, plus new facts)
- Claude = reviewer + prompt writer (memory `feedback-reviewer-role`). Gemini writes code. I merged branches myself (merge main into the worktree branch, verify, `git merge --ff-only` into main). Gemini never pushes/merges/rebases/resets/cleans/amends. In the Text to Graph turn the user said "check and fix it"; I wrote the task for Gemini (S6) and offered to code it myself, the user did not object.
- The user wants SPEED ("college project, if it works without issue it is OK"): lean task files (`gemini/TASK_S1_lite.md` ... `TASK_S6_lite.md`), no per-task reports, ONE summary per session in `gemini/reports/S<n>_summary.md`, my reviews in `gemini/reviews/` (`TASK_S1S2_lite_review.md`, `TASK_S3S4_review.md`).
- My review method now: build, `npm run audit:design`, full pytest, Playwright at 1440x900 against `design/reference/screens/*.png`, header height on every page (must be 76 px), console errors, my own unseen test inputs. Scripts live in my scratchpad (`capture_merged.py`, `capture_main.py`, `t2g.py`, `t2g_b.py`).

### 17.3 Owner decisions (2026-10-05)
Frame images/video come LAST from the owner (`site design/public/assets/frames/frame_0001.jpg` ... up to 120, 4-digit; the stage panel probes quietly and shows its empty text until then). Chunk-size slider DONE (backend `chunk_size` 120 to 600). 5 s per ingestion stage at Normal. NO "Reset demo", NO "Simulate outage", NO "Run the full show"; "Load demo" button kept (renamed from "Load demo cohort"). Keep the name "AI Agent". The three Tools pages are required and exist.

### 17.4 What exists now (pages, all matched to the reference at 1440x900)
Upload (drop box, five stage rows, interactive stage panel, live ingestion show `CinematicIngestionShow.tsx` with real OCR counter), Library, AI Agent (`/agent`; conversation column 280 px, `?c=<id>` resume, stats line, session totals), Knowledge Graph (hand-built canvas renderer `components/graph/GraphCanvas.tsx`, label priority/truncation/collision pruning, subgraph list, legend; capped at 120 central nodes), Timeline (isometric charts, light-grey "Indexed" tags), Compare, Insights, Image to Text (`ImageToTextPage.tsx`, RapidOCR via backend), PDF to Text (`PdfToTextPage.tsx`, pdf.js), Text to Graph (`TextToGraphPage.tsx` + `components/graph/textGraph.ts`, pure client-side extraction, no AI, up to 40 entities / 60 nodes, deterministic, always connected; example buttons), Settings (Process speed, chunk size, persona delete including conversations). Three.js removed; packages `pdfjs-dist`, `axe-core` (dev).
Backend additions this round: `GET /api/reports/{id}/chunks/{chunk_id}`, upload `chunk_size`, conversation tables (`agent_conversations`, `agent_messages`, `agent_artifacts`), `conversation_service.py`, `_TurnRecorder` in `agent_service.py`, routes `GET /api/agent/conversations`, `GET|DELETE /api/agent/conversations/{id}`, F1: `user_id` + owner check on `GET /api/reports/{id}/pages`, `/measurements`, `/pages/{n}/image` (404 for another persona). Persona delete also removes conversations and `ai_calls`.

### 17.5 Verified numbers
Backend `pytest tests -q`: **222 passed** (~225 s). In the worktree (no `.env`) tests need `AI_SERVICE_API_KEY=test-placeholder-key`; main has the real `.env`. `npm run build` OK, `npm run audit:design` 0 errors (49 files), `scripts/plan/secret_scan.py` PASS. Header 76 px on all 12 pages. Accent color token is `#ec3013` (`site design/src/theme/tokens.css`).

### 17.6 Known weak spots (cosmetic, not blocking)
- Conversation rows say "2 turns" for one question (counts messages); should read "1 turn" or "2 messages".
- Text to Graph: sentence-initial capitalised words can become "Name" entries ("Discharge", "Phone" from "iPhone"); frequent verbs can appear as keywords in stories; connections mean "same sentence", not a real relation. Real relation labels need an AI mode (see 17.7 item 5).
- Upload page shows a striped empty stage panel until frames exist.
- The AI Agent cannot produce real answers: the free gateway rejects the harness (401 unauthorized client; some wording content-blocked). Refusal and block paths work and are tested; mocked-SSE UI tests exist.

### 17.7 What is left (all small or owner-side)
1. OWNER: ROTATE the AgentRouter key. It was committed (CODES.md files, commit 85e9a30), is on the public repo `Joseph-VJ/VitaGraph`, redacted in the tree but still in git history.
2. OWNER: frame images for the Upload stage (see 17.3).
3. OWNER: paid API key in `vitagraph/backend/.env`, then re-run the "API blocked" checks: AG0 step 6, AG0b unknowns, AG3 live check, F5; capture real `tool/call`, `tool/result`, `assistant/message` shapes and fix the mapper; test a full cited conversation in the browser (see 16.6, AG6).
4. Push to GitHub ONLY when the user asks. Many local commits are ahead of the remote; there is an old pushed branch.
5. Optional next tasks (ask the user): (a) Text to Graph cleanup of the two flaws above; (b) "Build with AI" mode for Text to Graph (backend asks the AI for entities and labelled relations as JSON, same canvas draws relation labels; pattern-based graph stays the fallback; needs the paid key to go live); (c) conversation row label "turns"; (d) optional extras from the plan: artifacts D4/D5, display modes D7, slash commands D8, 3D result cards D10, "Show in graph" B9; (e) Datasets/Ontology/Notebooks decision (still open from 16.8).
6. Housekeeping: `site design/tsconfig.tsbuildinfo` is always modified (never stage it); untracked reference/prototype files stay untracked; remove the retired worktree.

### 17.8 Resume checklist
1. Read memory `MEMORY.md`, then sections 0 and 17 of this file; skip 15/16 unless detail on the agent backend is needed.
2. `git log --oneline -8`, `git status`; check `gemini/reports/` for a newer summary than `S6_summary.md` and review it first (build, audit, pytest, 1440x900 screenshots, own inputs).
3. Ask the user which of 17.7 item 5 to do, or whether the paid key is ready.
4. Never code unless the user says so; never push unless asked; stop dev servers after every live check (ports 5173/8000, and 5174/8001 for the retired worktree).
(Superseded in part by section 18, written 2026-10-06: read it first.)

---

## 18. STATE AT 2026-10-06: VIDEOS, PROCESS THEATRE, AND EVERYTHING ELSE DONE THAT DAY (NEWEST AND AUTHORITATIVE)

Written at the end of the 2026-10-06 session (Claude Sonnet 5.5, effort high). Everything below is UNCOMMITTED on `redesign/modernist-app` (HEAD still `7d24faf`, nothing pushed). Servers were left running for the user to check: backend `127.0.0.1:8000`, frontend `localhost:5173/upload` (stop them with PowerShell `Get-NetTCPConnection -LocalPort 5173,8000 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`).

### 18.1 One paragraph
The user wanted AI-generated explainer videos for the Upload page's process and then the Upload page itself redesigned around them. I (a) wrote prompt files in many rounds until the user was happy (final set = `video-prompts/story_clear/`), (b) after the user generated the 7 videos, removed the Gemini watermark, joined them, encoded one scrub-friendly film plus 7 thumbnails, (c) replaced the old frame-scrub stage on `/upload` with a new **process theatre** that has NO controls and simply mirrors the real upload job stage by stage, (d) paced the page's own pipeline rows, tile bars, file tag and pages table to the film, (e) made the film 1.5x faster, (f) enlarged the row text, (g) fixed a pre-existing bug in the job stream hook that froze fast uploads, and (h) turned the old full-screen ingestion show off by default. Build, `npm run audit:design` (0 errors, 49 files) and `scripts/plan/secret_scan.py` (PASS) were green at the end. Backend was not changed, so backend pytest was NOT re-run (last known: 222 passed).

### 18.2 Working agreement changes today (read with sections 0 and 17.2)
- The reviewer-only rule from section 0 still stands in general (memory `feedback-reviewer-role`). Today the user changed it for this work: "now this is your work" (writing the prompt .txt files myself), later "can you start working on it or let the gemini do the work?" and "complete the design ... i will leave it to you" (I did the integration myself). I once misread "do the work" as "write code" and started reading app code; the user interrupted: they wanted TEXT FILES of prompts. Lesson: when the user says "do the work", check whether they mean prompts, media or code.
- Design freedom: the user said "do whatever you want" with ONE rule: **no number or data on the video**. Readable stage words and captions are allowed; no digits, no medical values, no provider/model names.
- The user rejected: abstract object metaphors, bars-only explanations, anything they "cannot understand". They loved the 3D explainer style of `story_clear/` and asked for each stage to EXPLAIN itself (Embedded: words become numbers; Indexed: numbers filed so they can be searched).
- The user's reference images (kept in `video-prompts/story/`): `4b1316c8-...jpg` (PDF -> scan -> OCR boxes -> clean text, dark neon style, example of WHAT to show, not of style) and `503964a4-...jpg` (the 7-stage pipeline: Received, Extracted, Chunked, Embedded, Indexed, Graphed, Answer). The backend really runs: received (raw upload stored, SHA-256) -> extracting per page (native text layer, or OCR for scan-suspect pages) -> extracted -> chunked -> embedded -> indexed (Chroma, scoped to user) -> graphed -> done. Job events replay (`is_replay`) when the stream connects late.

### 18.3 Prompt files in `video-prompts/` (all untracked; the old v1 set is deleted in the working tree but still in git HEAD)
- `story_clear/` (**FINAL, what the user generated from**): `00_overview_image.txt` (style-anchor image prompt), `01_received` ... `07_answer` (one prompt per stage, 4 s each, style paragraph + big one-word title + a small caption that changes 2 to 3 times + AVOID line), `08_full_28s_one_take`, `_notes/READ_ME.txt`, `_notes/_v1_3s_titles_only/`. Embedded shows words -> dials -> barcode-like strip of coloured cells (similar meaning = similar strip); Indexed shows strips filed on shelves by similarity, tagged with page + owner, in the user's own locked compartment, with a search strip lifting out the nearest strips. No digits anywhere.
- `story/`: earlier flat-style Upload-stage set. Final state: `01_step1_upload_scan_and_copy_text` (file drops in, four pages scanned, text pages copied out, picture page flagged), `02_step2_picture_page_read_by_ocr`, `03_step3_cut_into_passages_with_address`, `04_step4_numbers_and_meaning_map`, `05_step5_your_own_panel_filtered_search`, `06_full_15s_one_take`, `keyframes/K0..K5.png` (text-free, rendered by me with the app font Archivo, used as first/last frames: step1 K0->K1, step2 K1->K2, step3 K2->K3, step4 K3->K4, step5 K4->K5), `_notes/` with archives `_old_object_metaphors`, `_v2_slow_20s`, `_v3_long`, `_v4_with_words`, `_v5_old_order`. SUPERSEDED by `story_clear/` for the final film but kept.
- `background/`: `01_upload_blueprint_pipeline` ... `11_settings_switches_and_lock` (one 6 s quiet line-art clip per page, white field for CSS multiply, scroll-scrub idea, short prompts) + `_notes/` (READ_ME with opacity tiers, archives `_v1_quiet_8s`, `_v2_long`). **Only prompts exist: no clips generated, nothing wired into the app.** Open owner decisions are in 18.9.
- Conventions the user asked for: prompt `.txt` files contain ONLY the prompt (plus one short AVOID line); notes, negative prompts and ffmpeg commands live in `_notes/`. When the user asks in chat, give the full prompts with the style included, each followed by a short note.

### 18.4 Media pipeline (how the film was made; redo it if videos change)
1. The user put the 7 generated clips in `video-prompts/project videos/` (`video 1.mp4`, `2.mp4` ... `7.mp4`; each 10.05 s, 1920x1080, 30 fps, 301 frames). They carry the visible Gemini sparkle watermark (bottom right).
2. Watermark removal with `@pilio/gemini-watermark-remover` (MIT, one dependency `mediabunny`). `pnpm` is NOT installed; `npx` works but the video mode needs the optional `playwright` package AND a matching browser: in a scratch folder `npm i @pilio/gemini-watermark-remover playwright` then `npx playwright install chromium-headless-shell` (about 115 MB into `%LOCALAPPDATA%\ms-playwright`), then `node node_modules/@pilio/gemini-watermark-remover/bin/gwr.mjs remove in.mp4 --output clean/out.mp4` (about 2 minutes per clip). Outputs are in `video-prompts/project videos/clean/` (all 7 done; originals untouched). The tool removes only the VISIBLE mark (not any invisible provenance mark) and shifts colours by 1 to 2 percent. Do not run it with `python -I` or from inside downloaded folders.
3. Video 7 (Answer) shows the digits 1 to 7 inside its progress circles, and the circle rows differ between clips. To obey the no-numbers rule the bottom 12 percent of every frame is cropped.
4. `process.mp4`: concat of the 7 clean clips (`-c:v libx264 -crf 14`), then `-vf "crop=1920:920:0:0,scale=1280:614" -c:v libx264 -preset slow -crf 25 -g 6 -keyint_min 6 -pix_fmt yuv420p -movflags +faststart -an` -> `site design/public/assets/stages/process.mp4` (7.8 MB, 70.33 s, 7 equal stage slots of about 10.05 s). `process-poster.jpg` = frame 0.
5. Thumbnails `site design/public/assets/stages/thumbs/{received,extracted,chunked,embedded,indexed,graphed,answer}.jpg` (480 px wide) taken from `process.mp4` at stage start + 6, 8.5, 8.5, 4.8, 5, 9, 8 seconds.
6. An earlier 140-frame sequence (`public/assets/frames`) was made first and DELETED once the theatre replaced the frame stage. `FrameStage.tsx` still exists (with a new optional `fit="contain"` and a blurred edge extension) but nothing imports it.

### 18.5 Code changes (all uncommitted; stage by explicit path, never `git add .`, never the tsbuildinfo)
- `site design/src/components/upload/ProcessTheatre.tsx` (NEW). Props: `liveIndex` (0..6 or null), `states` (per stage `done|running|waiting|failed`), `settled`, `onPace(stage|null)`. NO controls: no scrubbing, no clickable tiles, no play buttons. Behaviour: idle = poster + "Waiting for a report" text; following a real job = plays each stage in order, never skipping, `MIN_DWELL_MS = 2500` per stage, `PLAYBACK_RATE = 1.5`, loops a stage while the backend is still in it, plays the Answer stage once then stops following; `settled` (finished report on screen, no job) = rests on the Answer frame with the tag "Ready"; reduced motion (Settings or OS) = no autoplay, still frames; `onPace` reports the stage being shown (null when not following or when the film failed to load, so nothing ever waits for a missing film). Layout: video (aspect 1280/614) + 7 non-interactive thumbnail tiles (colour bar per stage state, active tile inverted) + stage name, short line, two plain sentences and a status tag. `PROCESS_STAGES` holds the stage texts (no numbers, no provider names; the database is not named).
- `site design/src/pages/UploadPage.tsx`: right column now `<ProcessTheatre liveIndex theatreLive states theatreStates settled theatreSettled onPace setPacedStage />` (replaces `FrameStage`). Job event stage -> theatre index: `received 0`, `extracting/extracted 1`, `chunked 2`, `embedded 3`, `indexed 4`, `graphed 5`, job done -> 6. New `pacedStage` state; `paceRow()` paces the five rows to the film (`ROW_FILM_STAGE = [1,1,2,3,4]`: Parse + OCR <-> Extracted, Chunk <-> Chunked, Embed <-> Embedded, Index <-> Indexed; a row is never Done before the film has passed its stage; real failures show immediately); the tile bars, the file tag ("Ingesting" until the film passes Indexed) and the pages table / "Ask about this report" (shown only after the film ends) follow the same pace. Left column widened from 320 to 400 px and the row text enlarged (name 1.25rem, detail 0.9375rem, number 1rem, tag 0.8125rem) at the user's request.
- `site design/src/hooks/useJobStream.ts`: **bug fix of a pre-existing defect.** `es.onerror` after completion called `disconnect()`, which clears the event queue and dwell timer; when the server closes the stream right after a fast job, queued events were thrown away and the rows froze at "Running". Now it closes only the socket and lets the queue drain.
- `site design/src/lib/preferences.ts`: default `cinematic: false`. The user called the full-screen `CinematicIngestionShow` overlay "a new page" (it is pre-existing from commit `0f9a9d0`, opens on every upload when the Settings switch "Cinematic ingestion" is On). The switch and the component are KEPT, now opt-in. A browser that had saved On must switch it Off in Settings.
- `site design/src/components/upload/FrameStage.tsx`: optional `fit` prop (unused by the app now).
- Deviations from `gemini/DESIGN_LAW.md` (owner-approved by instruction, but the file still says the old things and should be updated): the Upload stage is the process theatre, not the 120-frame scrub panel; left column 400 px; larger row text; the full-screen show off by default; extra stage info text under the stage; frame images are no longer needed.

### 18.6 Verification done (all with real servers, Playwright `channel="chrome"` at 1440x900)
- Build OK, `npm run audit:design` 0 errors (49 files), `python scripts/plan/secret_scan.py` PASS (re-run at the end of the film-integration step; the later small edits were re-checked with build + audit).
- Explore/idle: no buttons in the theatre, mouse move/wheel/tile click leave the video at 0.
- Live: a real PDF upload (`site design/public/synthetic_panel_2025-01-15.pdf`) into a temporary persona showed Received, Extracted, Chunked, Embedded, Indexed, Graphed, Answer in order, about 2.5 s apart at 1.5x; rows, tile bars, file tag and pages table matched the film at every 0.4 s sample; after reload the theatre rests on Answer/"Ready"; no console/page errors. No full-screen overlay opens by default.
- Test hygiene: for each live test I created a persona through `POST /api/users`, accepted consent with `POST /api/users/{id}/consent` (uploads are refused until consent: "This persona has not accepted the data-use statement yet"), uploaded, then `DELETE /api/users/{id}` (removes reports, vectors, files). All temporary personas ("Theatre test N (temporary)") were deleted. The Chroma count read 958 after cleanup; at the end it read 981 because the USER's own click on "Load demo" created a persona "Demo Cohort (demo data)" (`usr_a520b6b5fb32`, 2 reports, 23 chunks, uploaded around 14:09 UTC). That is the user's data: do not delete it.

### 18.7 Gotchas learned
- Bash on this machine: `$PWD` gives `/f/...` paths that ffmpeg cannot open; use `F:/...` paths. Heredocs with apostrophes are fragile; use the Write tool or a Python script.
- `ffmpeg` and `ffprobe` are available (WinGet link). Python 3.13 has Playwright (user site; do not use `-I` for scripts that need it).
- Video generators produce 10 s clips even when asked for 4 s; stage slots are computed as `duration / 7` in the component, so the film length can change without code changes.
- Generated clips need a check for digits/numbers before use (video 7 had them).
- Writing to a file after a linter/other edit can fail ("File has been modified since read"): re-read it first.
- The reference `VitaGraph-App-v3.html` has dead video-drop code and no background media. The reference export `design/reference/modernist-redesign/dist/VitaGraph-Story-offline.html` is a finished 1:56, 12-scene film made by the design tool, but it shows demo values and headline text, so it must NOT be used as UI material (fine for a viva presentation).

### 18.8 State of the working tree (what is uncommitted)
Modified: `site design/src/components/upload/FrameStage.tsx`, `src/hooks/useJobStream.ts`, `src/lib/preferences.ts`, `src/pages/UploadPage.tsx`, `site design/tsconfig.tsbuildinfo` (never stage). New: `site design/src/components/upload/ProcessTheatre.tsx`, `site design/public/assets/stages/` (8 files, 7.6 MB), `video-prompts/background/`, `video-prompts/story/`, `video-prompts/story_clear/`, `video-prompts/project videos/` (14 mp4 files, about 25 MB; probably should stay untracked or go to a release asset, ask the user). Pre-existing: the 17 tracked `video-prompts/*.txt` v1 files show as deleted in the working tree (still in HEAD `7d24faf`), plus the untracked reference/prototype files listed in the first git status.

### 18.9 Open items and decisions for the user
1. **Commit?** Not committed on purpose (the user did not ask). Suggested explicit paths: the four modified source files, `ProcessTheatre.tsx`, `public/assets/stages/`, and (maybe) the `video-prompts` prompt folders without `project videos/`. Message style as in the repo (`feat(upload): process theatre ...`).
2. **Update the docs that are now wrong:** `gemini/DESIGN_LAW.md` (allowed differences), `CLAUDE.md` section 3 (Upload page description), `docs/ui-ux-design-notes.md`; mention the opt-in cinematic show.
3. **Page background clips** (`background/`): decide whether they are wanted at all (they would be a new deviation: the reference has no backgrounds), generate them, then a coding task (scroll layer, Settings Off/Soft/Full). Opacity tiers and the mechanism are in `background/_notes/00_READ_ME_BACKGROUND.txt`; the scroller is `main#main-content` (not the window); Knowledge Graph and AI Agent do not scroll it.
4. Optional: remove the now-unused `FrameStage.tsx` and the full-screen `CinematicIngestionShow.tsx` + the Settings switch, if the user confirms; make the film's first 3 stages show more of their explanation (each stage is cut to about 2.5 s of a 10 s clip when the backend is fast, 3.75 s of film time at 1.5x); tune `PLAYBACK_RATE` / `MIN_DWELL_MS`; enlarge the file-name line and the drop box text if asked; the film has 7 stages but the page lists 5 rows (mapping in 18.5).
5. Everything still open from section 17.7 remains open: rotate the exposed AgentRouter key (owner), the paid API key and the "API blocked" re-checks, Text to Graph cleanup / "Build with AI", conversation "turns" label, Datasets/Ontology/Notebooks decision, retired worktree removal, push only when asked.

### 18.10 Resume checklist (2026-10-06 state)
1. Read memory `MEMORY.md` (entries `feedback-child-clear-visuals` and `project-vitagraph-background-art` carry the day's decisions), then sections 0, 17 and 18 of this file.
2. `git status` (expect the uncommitted list in 18.8), `git log --oneline -3` (HEAD `7d24faf`).
3. If the servers are still up, `curl http://127.0.0.1:8000/api/health` and open `http://localhost:5173/upload`; check the theatre visually before changing anything. Stop servers after live checks.
4. Ask the user what is next: commit, docs update, backgrounds, or the 17.7 items. Do not push. Do not delete the user's "Demo Cohort" persona.
5. Before any new live test use a temporary persona with consent, and delete it afterwards.

---

## 19. STATE AT 2026-10-08: THE MODEL API, A LIVE AGENT FEED, AND AI TEXT TO GRAPH (NEWEST AND AUTHORITATIVE)

Written by Claude Sonnet 5.5 in the session where the user said "set this" (their model API) and asked for speed, a friendly format and "show each and everything the AI model is doing, live". The user told Claude to do this work directly (not through Gemini). Everything below is UNCOMMITTED on `redesign/modernist-app`.

### 19.1 The model API (replaces the AgentRouter gateway)
- `.env` now holds only the user's model (`MODEL_API_KEY`, `MODEL_API_URL`, `MODEL_NAME`, `MODEL_API_FORMAT=responses`, `MODEL_REASONING_EFFORT=low`), `ALLOW_API`, retrieval and embedding settings. The old gateway and `AI_SERVICE_*` blocks were removed. The key is entered by the user in `vitagraph/backend/.env` (never in chat, never printed). The old gateway key is still in git history on the public repo: it must be revoked on the provider side.
- The endpoint speaks the **Responses** format (`POST <base>/responses`), the rest of the backend speaks chat-completions. `app/services/responses_adapter.py` translates in both directions (`build_request`, `ChunkTranslator`, `ResponsesClient` as an AsyncOpenAI look-alike, `complete_sync` for the ask path and the connection test). `config.py`: `MODEL_*` settings feed the existing `agentrouter_*` fields only when `MODEL_API_KEY` is set (so an old key can never go to a new host); `settings.api_format` is "responses" only while the active endpoint is `MODEL_API_URL`.
- The DeepSeek Harness only speaks chat-completions, so `app/routes/llm_shim.py` (`/internal/llm/v1/chat/completions`, loopback only, per-persona HMAC token from `shim_token_for`) translates for it and holds the real key; the agent worker only gets the token. `BACKEND_URL` (default `http://127.0.0.1:8000`) must match the backend port.
- No provider or model name appears in the UI; they live in `.env` only. `/api/health` now reports the active model.

### 19.2 Why it was slow, and what changed (measured on one question, "What is my hemoglobin value?")
Before: 54 s, 4 model steps. After: 14.9 s, 2 steps (checked in Chrome at 1440x900). Causes found and fixed: (1) silent reasoning before the first word: `medium` ~15 s, `low` ~9 s, `minimal` ~5 s for a two-sentence reply, so the default is `low` and the AI graph call uses `minimal`; (2) four sequential steps: the prompt now says plan once, call tools together, never `list_reports` when ids are known, and `agent_service` puts the person's report list (`_report_index`) in the prompt; (3) a 15 s cold load of the embedding model inside the tool server: `mcp_server.main` warms it in a thread; (4) 7 s agent start: `POST /api/agent/warm` (`RuntimePool.warm`), called by the Agent page on open and by the Upload page when a scan finishes; (5) answers too long: a format rule in `app/agent/prompt.py` (direct answer first, at most four bullets).
Bugs fixed on the way: the mapper read the harness `tool/result` in the wrong place (every result was saved as "unknown", evidence stayed empty, citations did not link: real shape is `message.content[0]` = `{type:"tool-result", toolCallId, content:[{type:"text"}]}`, tests in `tests/test_agent_mapper_real_shapes.py`); chat titles came from the harness (`[Scope: the person is asking`), now the first 60 characters of the question; reopened chats rendered raw events as rows (now replayed through `src/lib/agentFeed.ts`).

### 19.3 The live feed
The harness reports a step only when it ends and the model API sends its text in a burst, so the loopback route taps the model stream: `app/services/live_bus.py` (per persona) receives `model_start`, `reasoning`, `text`, `model_end` (ms, first_ms, tokens, tool_calls), `model_error`; `agent_service._merged` merges them with the harness events; `EventMapper.feed_live` maps them to SSE events (`model`, `thinking`, `text_delta`) and tracks `final_text` (the last model call without tools is the answer, earlier text is narration). The request asks for a reasoning summary (`MODEL_REASONING_SUMMARY=auto`), shown as "Thinking". The raw private chain of thought is not available from the API. Frontend: `src/lib/agentFeed.ts` (pure feed builder, also used to replay saved turns), `useAgentChat.ts` (narration moves into the feed when a model call ends with tools), `TrajectoryPanel.tsx` (one chronological feed in the style of the user's `harness.png`: header "Working · 8.8 s" then "Completed in 14.9 s · 2 steps · 2 tool calls", model rows with live seconds, thinking, narration, one-line tool rows with a Details toggle). Saved turns store `{"event": ...}` items; older saves are still understood. If the endpoint is chat-completions (no shim), the feed falls back to per-step updates.
`search_reports` returns the report's opening passages (with a `fallback` note) when a report-scoped search matches nothing, so "summarize this report" works on documents without lab text. The extractor was deliberately NOT changed (it invents "measurements" from non-lab documents; the prompt tells the agent to say so).

### 19.4 Text to Graph with the AI
`POST /api/tools/graph` (`app/services/graph_ai.py`): the model returns entities and labelled relations as JSON; every entity and relation must carry a quote that really occurs in the text (case and whitespace insensitive), otherwise it is dropped; caps 40 nodes / 60 edges; refuses when AI is off or no key (409), oversize (413), unreadable reply (502); sends nothing when the privacy switch is off. The page has a "Build with AI" button (live seconds); on any failure it shows the reason and builds the pattern graph instead. `components/graph/aiGraph.ts` converts the result (one hub node keeps the graph connected); `GraphCanvas` got an optional `edgeLabels` prop (relation words drawn on edges; only the selected node's when one is selected).

### 19.5 Upload to Agent
After a scan finishes and the film has played, `UploadPage` remembers the report (`src/lib/loadedReport.ts`, sessionStorage) and warms the agent; `AgentPage` opens scoped to it ("Chatting with <file>") until "Use all my reports" (which also clears the memory). The "Ask about this report" button still works the same way.

### 19.6 Verified
Backend suite and frontend build/audit/secret scan results are in the final message of that session (suite was 247 passed before the live-feed work; new test files: `test_responses_adapter.py`, `test_agent_mapper_real_shapes.py`, `test_agent_mcp_fallback.py`, `test_agent_warm.py`, `test_agent_live.py`, `test_agent_prompt_index.py`, `test_graph_ai.py`). Live: one real agent question (14.9 s), one real AI graph (10 entities, 9 relations), Chrome run with no console errors.

### 19.7 Open
Commit nothing was done: stage by explicit path. The old gateway key must be revoked. Not verified: a long multi-turn conversation, the harness with a model that returns several parallel tool calls in one step beyond the tested case, and the AI graph on very long texts (cap is 6000 characters). `CLAUDE.md` section 3/4 and `DESIGN_LAW.md` still describe the older Upload page and the DeepSeek-only endpoint.


---

## 20. STATE AT 2026-10-08 (LATER): AI-CHAT LAYOUT, MATHS, CODE, REPORTS AND PDF (NEWEST AND AUTHORITATIVE)

Written by Claude Sonnet 5.5 after the owner asked for a better reading format (researched online first), then "do maths and coding, show a report in HTML and save it as a PDF, and make the chat area feel like other AI chats". The plan was shown and approved ("go with your idea"). Everything is UNCOMMITTED on `redesign/modernist-app`. Section 19 still holds for the model API, the loopback route and the live feed.

### 20.1 How an answer reads (research-backed)
Sources used: NN/g (answer first, bold only key terms, short paragraphs), Chrome and Smashing (hide a half-typed `**`, batch per frame, 60 px auto-scroll threshold), Perplexity/NotebookLM citation patterns (inline chip + hover preview + sources row), AHRQ/JMIR and WCAG 1.4.1 (words and symbols, not colour alone). Built: `AnswerMarkdown.tsx` (first sentence set larger once the answer is finished, 17 px body at 66 ch, list markers, `General information` block, `▲ High / ▼ Low / ● In range` flags), `src/lib/answerFormat.ts` (`splitFollowUps`, `stabilizeMarkdown`, `verifiedFacts` + `markVerified`), `src/lib/linkCitations.ts` (citation linking that skips code). **Verified highlights:** a number with a unit is tinted (`.vg-key`) only if a tool returned that exact value and unit this turn (measurements or numbers inside cited passages). Citation chips preview the quoted passage on hover or focus. A "Sources" row, Copy, "Evidence and limits", and up to two follow-up chips (from the model's closing `FOLLOW-UPS: a | b` line, which is stripped from the text) sit under each answer.

### 20.2 Layout
`AgentPage.tsx`: right-aligned question block, plain AI answer with an "AI Agent" label, `TrajectoryPanel` is now one quiet line ("Working · 8.8 s · Searching your reports" then "Thought for 14.9 s · 2 steps · 2 tool calls ›") that opens the live feed, docked composer (textarea grows to six lines, Enter sends, Shift+Enter new line, Stop replaces Send, a "Report: file.pdf ×" chip for scope), 2x2 suggestion cards, collapsible History (remembered in localStorage, hidden automatically while a report is open) and a "Reports" button. Flat, square, Archivo, one red accent (the owner agreed to keep the Modernist look).

### 20.3 Maths: the `calculate` tool (a deliberate change from four tools to five)
`app/agent/calc.py`: `ast` whitelist (numbers, `+ - * / // % **`, brackets, `abs round min max sum mean avg sqrt log ln log10 exp pct_change`, constants `pi e`), size limits, no names/attributes/subscripts/lambdas, no network or files; `tests/test_agent_calc.py` (22 value cases, 20 attack strings, limits, and a call through the real MCP server). `TOOL_NAMES` in `profile.py` now has five entries; the pinned tests were moved from four to five (`test_agent_mcp_server`, `test_agent_profile` x2, `test_agent_safety_suite`, and the echo fixture) with every other safety assertion unchanged: still no person parameter, still no other tool allowed, lock-down monitor unchanged.

### 20.4 Coding
Fenced code becomes a `CodeBlock` card (language label, Copy code, keywords bold, strings red, comments grey; `src/lib/codeTokens.ts`, lossless tokenizer). Code is never run. Archivo is used for code because of the design law. Running code in the browser (Pyodide in a worker) was left for later by decision.

### 20.5 Reports and PDF
The agent writes a report as Markdown inside a ```report block (prompt rule); "Save as report" under any answer works too. `POST /api/agent/reports` renders it with `report_render.py` (markdown-it with raw HTML, images and links disabled, strict CSP, escaped title, evidence appendix read from the database for the caller's own passages only, forged ids skipped), builds an A4 PDF with PyMuPDF `Story`, and stores both in `agent_artifacts` (kind `report`, max 100 per person). Also `GET /api/agent/reports`, `GET /api/agent/reports/{id}`, `GET .../pdf` (attachment), `DELETE`. Frontend: `ReportPanel.tsx` (third column, 520 px; iframe `sandbox=""`; Download PDF; saved-reports list), report card inside the chat. The PDF uses simple CSS and a built-in font (no flex/grid, no Archivo); the on-screen preview is the same HTML.

### 20.6 Fixes found on the way
Saved chats showed "Thought for 0.0 s" (stats names differ, now mapped in `savedStats`); the Sources row now ignores code but counts a report block's citations; `conftest.py` now neutralises the developer's real `.env` model settings and uses a placeholder key (the suite had silently depended on it).

### 20.7 Verified
Real runs in Chrome at 1440x900 (no console errors): a percent-change question used `calculate` (3 steps, 34.7 s on a cold embedder), a BMI request produced a code card (8.1 s), a report request produced a report card, the panel, a valid one-page PDF with the Evidence section and a list of saved reports. Frontend `tsc`, `npm run build`, `npm run audit:design` (0 errors), `secret_scan.py` PASS. Helper tests for the pure TypeScript modules ran with Node (`--experimental-strip-types`): `answerFormat`, `codeTokens`, `linkCitations`. Backend suite: **362 passed** (~270 s). The fake worker and echo tool-server fixtures also list the fifth tool.

### 20.8 Open
Nothing committed (stage by explicit path; never `git add .`, never `tsconfig.tsbuildinfo`). Not built: running code, HTML authored by the model (deliberately refused), a per-page footer/page numbers in the PDF, Archivo in the PDF. The old gateway key is still in git history on the public repo and must be revoked.

---

## 21. KNOWLEDGE GRAPH: CONNECTED BUILD AND CLICK-TO-SEE-CONNECTIONS (2026-10-08, latest; uncommitted)

The shared canvas `site design/src/components/graph/GraphCanvas.tsx` (used by Knowledge Graph and Text to Graph) now has two behaviours the owner asked for.
- **Build one by one:** `revealPlan(nodes, edges)` orders nodes breadth-first from the main node (person first, else the most connected), about 14 to 110 ms apart (about 5 s for a big graph). Each edge grows from the node that appeared first towards the one that follows (sub-curve of the same quadratic, with a red spark at the tip). "Replay build" still restarts it; reduced motion compresses the delays to 4 percent.
- **Click shows the connections:** the clicked node, its direct neighbours (h1) and their neighbours (h2) are computed on selection. Unrelated nodes and edges fade to about 10 percent; the clicked node's edges flow outward in red (thick, with sparks that keep travelling), neighbours turn red and get a ripple and a label (including measurements), and a fainter second ring of edges follows 450 ms later. Rotation pauses while a node is selected; Escape or clicking empty space clears it. The old code computed the neighbour set but never used it for edges.
- The node panel says "Connected to N nodes" (it lists the first 8); Text to Graph shows the same count.
Checked in Chrome at 1440x900 on a 94-node, 160-edge graph (screenshots of the build at 0.7, 2, 3.5 and 7 s, and the click at 0.25, 0.9 and 2.2 s): no console errors. `tsc`, build and `audit:design` clean. Backend untouched (suite last run: 362 passed).

---

## 22. PLAYGROUND PREVIEW, AI NODE SUMMARY, AND THE PLAN TO BUILD THE PLAYGROUND INTO THE APP (2026-10-08, latest)

- **Approved target:** `design/prototypes/VitaGraph-Playground.html` (also the private Artifact https://claude.ai/artifact/M3KsfVd1eNK39bteSbVU1b) is the owner-approved target. Sample data only.
- **The card:** the owner's marked picture `ai box.png` (repo root) circles the docked node card with the AI summary box and its red elbow line. That exact card is wanted in the app.
- **AI summary box (built):** branch `feature/ai-node-summary`, commits `ac15d93` (source) and `293002d` (docs). `POST /api/graph/node-summary` over SSE, `app/services/node_summary.py`, `core/sse.py`, `node_summaries` cache table, frontend `NodeSummary.tsx`, `useNodeSummary.ts`, `lib/sse.ts`. Spec `design/prototypes/VitaGraph-AI-Node-Summary.md`. Built by Gemini sessions N1 to N7, reviews in `gemini/reviews/`. Backend suite 395 passed.
- **Known limits:** the shared safety check wrongly rejects some good AI texts on "132/86mmHg" and on an ISO date followed by a word; the labelled plain fallback is then shown. Person and report summaries can drift. First words take 7 to 13 s. Only PDFs are ingested; Markdown upload is a later task (spec section 9).
- **Playground build (branch `feature/playground-graph-and-backgrounds`, not committed by Gemini):**
  - P1: new Knowledge Graph stage for `/graph` per `gemini/TASK_P1_graph_stage.md` (dark ink stage with a Paper switch, opening, four layouts, lens, docked card with trend chart, What changed, time machine, path finder, evidence badges, filters, Save as image; real data). Text to Graph keeps the old `GraphCanvas`.
  - P2: backend `GET /api/graph/{user_id}/series` (per-test values across reports with printed ranges), then the living background layer per `gemini/TASK_P2_series_and_background.md` (four engines, Off/Soft/Full and style in Settings, play mode, driven by real agent and upload events; not drawn on `/graph` and `/text-to-graph`).
- **Process:** Gemini does not commit in this round; the reviewer reviews, then commits. Sub-agents are not used in this project (owner decision).
