# VitaGraph — DESIGN.md
## Design language: "Instrument & Paper"
**Version:** 2.1 · **Status:** FROZEN for demo build · **Owner:** Role E (Frontend & UX)
**Applies to:** `vitagraph/frontend` (React 19 + Vite + TypeScript + Tailwind 4)
**Companion artifacts:** `/design-board/*.png` (9 generated mockups), `PROJECT_CONTEXT_AND_ROADMAP.md` (data contracts)

> **Rule 0 for any agent or developer reading this file:**
> You do not invent colors, fonts, radii, shadows, copy, or motion. Everything you render
> exists in this document. If a needed element is not here, stop and extend this file first
> (Hallmark rule: the spec grows before the UI does). Build the **Component Gallery**
> (§7) before any screen. After each screen, run the **QA Gates** (§11) and fix all findings
> before moving on.

---

## 1. Design personas & principles

### 1.1 Product design persona
VitaGraph behaves like **a careful laboratory instrument that keeps a field notebook**.
The machine half (canvas, traces, telemetry) is dark, precise, quiet, and glows only where
evidence is active. The human half (answers, quotes, summaries) reads like paper: serif,
italic where quoted, cited, foldable. Every visual decision must answer: *"Is this the
instrument speaking, or the notebook speaking?"* Never mix the two voices in one component.

### 1.2 User personas (design targets, in priority order)
| ID | Persona | Goal | Scans first | Design implication |
|---|---|---|---|---|
| P1 | **Vijay Joseph, Researcher** (operator) | Run questions & inspections fast | Search bar, recent sessions, status strip | Dense mono telemetry, ⌘K everywhere, zero modal interruptions |
| P2 | **Arjun R, VG-2026-001** (synthetic data subject) | Understand own reports safely | Answer prose, evidence slips, timeline deltas | Paper voice: serif quotes, plain-language deltas, visible consent & delete |
| P3 | **Prof. Examiner** (viva audience) | Verify depth, safety, provenance | Thinking details, trace fingerprint, safety badges, status strip | Every number traceable to a real endpoint (§10); refusals are first-class UI |
| P4 | **QA / adversarial reviewer** | Break isolation & boundaries | Quarantine, failure states, refusal cards | Failure is designed, visible, plain-language; never silent spinners |

### 1.3 Principles
1. **Evidence over decoration.** A border, badge, or glow must encode real state (score, flag, latency, consent). No decorative strokes.
2. **One bold moment per screen.** Knowledge Graph = question-activation pulse. RAG = paper slips. Ingest = pipeline ring. Everything else stays quiet (Anthropic: spend boldness in one place).
3. **Instrument grammar.** One coherent visual grammar (like macOS HIG / Qt on HN): dark stage, hairlines, mono telemetry. Strict grammar is what removes "AI slop".
4. **Paper for prose.** Anything a human reads as narrative (answer parts, AI summary, quotes, marginalia) uses Spectral serif; anything a machine emitted uses IBM Plex Mono.
5. **Fail visibly, fail closed.** Every failure mode in §15.3 of the master plan has a designed state (§7.24).
6. **Reproducibility as aesthetic.** Hashes, spans, fingerprints, config versions are displayed, not hidden.

---

## 2. Anti-slop contract (from researched GitHub skills)

### 2.1 Hard prohibitions (Anthropic `frontend-design` + Impeccable detector, adapted)
- No ALL-CAPS labels. Sentence case everywhere, including sidebar group titles and table headers.
- No `→` appended to link or button **text**. Arrows exist only as glyphs inside bordered icon-buttons.
- No middle-dot meta strings in prose. **Exception (deliberate, documented):** `·` is allowed only (a) inside the document meta line under a filename, and (b) as a column separator in mono footnotes/status strip, where it functions as a data delimiter.
- No single italicized/accented word inside a heading. No gradient text, no purple gradients, no bounce easing, no glassmorphism, no side-tab borders.
- No uniform "SaaS card kit": radii vary by hierarchy (§4.4); shadows exist only on floating layers (§4.6).
- No hover transitions on non-interactive cards. Hover = interactive elements only, 120 ms.
- No fade-and-slide entrances per section. One orchestrated sequence per user action (§8).
- Numbered markers only where content is a true sequence (trace lines, ranked chunks, insights 1-3).
- Monospace only for machine output: timestamps, hashes, scores, latencies, counts, event names, file names, spans, config versions. Human labels = Plex Sans.
- Type hierarchy must keep ≥1.25× ratio between adjacent roles (Impeccable flat-hierarchy check).
- Categorical palette capped at 5 node colors + 3 status colors (dataviz ≤6 rule).

### 2.2 Hallmark-style gates run before every hand-off
See §11 (12 gates). A screen that fails any gate is not committed.

---

## 3. Typography

| Token | Family | Size/Line | Weight | Use |
|---|---|---|---|---|
| `type/display` | Spectral | 26/32 | 600 | Screen titles ("Knowledge Graph") |
| `type/screen-sub` | Spectral | 14/20 | 400 italic? **No — regular**, dim | One-sentence subline under title |
| `type/card-title` | Spectral | 17/24 | 600 | Card & panel headings ("System health") |
| `type/reading` | Plex Sans | 13.5/21 | 400 | Answer parts, AI summary body (max 68 ch) |
| `type/body` | Plex Sans | 13/20 | 400 | General UI text |
| `type/label` | Plex Sans | 12/16 | 500 | Field labels, nav sublabels |
| `type/meta` | Plex Sans | 11/14 | 400, dim | Helper lines, table notes |
| `type/quote` | Spectral | 14/22 | 400 *italic* | Evidence quotes, quoted questions |
| `type/mono` | Plex Mono | 12/16 | 400 | Data values, trace text, filenames |
| `type/mono-sm` | Plex Mono | 11/14 | 400 | Timestamps, latencies, strip values |
| `type/stat` | Plex Mono | 24/28 | 500, tabular-nums | Stat tile numbers |
| `type/marginalia` | Spectral | 15/22 | 500 italic, rotate −2°, 60% dim | Handwritten margin notes |

Rules: line length ≤78 ch (serif ≤84 ch with +0.05 line-height); `font-variant-numeric: tabular-nums` on every numeric column, latency, score, stat; letter-spacing 0 on mono, +0.01em on sans labels; never bold+italic together except marginalia.

---

## 4. Tokens

### 4.1 Color — theme `instrument` (default, dark)
| Token | Hex | Role |
|---|---|---|
| `ink-900` | #0E1116 | App + canvas background (blue-tinted, never #000) |
| `ink-800` | #141920 | Panels, cards, sidebar |
| `ink-700` | #1A2028 | Raised surfaces, active nav wash, table header |
| `ink-600` | #232B35 | Hover fill on interactive rows |
| `line-strong` | #2B3440 | Card outlines, canvas frame |
| `line-faint` | #1E2530 | Inner row dividers, table rules |
| `bone` | #E6E4DE | Primary text (warm bone, never #FFF) |
| `dim` | #98A2AD | Secondary text |
| `faint` | #6B7683 | Tertiary text, placeholders |
| `verdigris` | #79B8A6 | **The one saturated accent**: primary buttons, success, active, biomarker nodes, LEDs ok |
| `ochre` | #D9A441 | Measurements, warnings, OCR, decreasing |
| `cornflower` | #86A9D9 | Conditions, info, new, dataset events |
| `lilac` | #A992D0 | Treatments, reranking/safety-event tint |
| `madder` | #D9808D | Flags/risk, refusals, failures, quarantine |
| `paper` | #EDE7DA | Evidence slip background (the "paper" voice) |
| `paper-ink` | #2A2620 | Text on paper slips |
| `paper-fold` | #D8CFBC | Folded-corner triangle |

Node categories (graph legend, exactly 5): Condition `cornflower`, Biomarker `verdigris`, Measurement `ochre`, Treatment `lilac`, Outcome `madder`.
Status LEDs: ok/live `verdigris`, warn/disabled `ochre`, fail/refused `madder`, info/new `cornflower`, idle `faint`.

### 4.2 Theme `paper` (light, toggle in status strip right)
bg #F2F3F1 · panel #FAFAF8 · raised #FFFFFF · line-strong #D8DBD6 · line-faint #E7E9E5 · ink #16181D · dim #5A6470 · accents darkened 12% (verdigris #4E8F7F etc.). Paper slips invert to white with `line-strong` border. Canvas **stays dark** in both themes (the stage is always the stage).

### 4.3 Spacing
4-pt base: 4/8/12/16/24/32/48. Card padding 16; panel padding 20; canvas margin 24; row gap 8; section gap 24; one deliberate 28 px break above "Thinking details" (the only off-scale value — intentional imperfection, do not "fix").

### 4.4 Radius hierarchy (never one value everywhere)
4 px chips/badges/flag tags · 6 px inputs/buttons/quotes chips · 10 px cards/panels/drawers · 14 px canvas frame & dropzone · 999 px LEDs/avatars only.

### 4.5 Borders
Two weights only: `line-strong` 1 px for component outlines; `line-faint` 1 px for inner dividers. Left rules 2 px for event class & quarantine. Active nav = 2 px verdigris left rule.

### 4.6 Elevation
No drop shadows on static surfaces. Floating layers only (tooltip, popover, node card, menus): `0 8px 24px rgba(0,0,0,.40)`. Node "glow" is a 1 px ring + 6 px outer ring in node color at 35% — a data-state, not decoration.

### 4.7 Texture
App background: 3% opacity SVG `feTurbulence` grain overlay, `pointer-events:none`. Canvas: 24 px dot grid `rgba(230,228,222,0.05)` 1 px dots + radial vignette (edges −18% luminance). Paper slips: 2% grain.

### 4.8 Focus & selection
Focus ring: 2 px `verdigris`, offset 2, on every interactive element (quality floor). Text selection: `verdigris` 25% background.

---

## 5. App shell (persistent chrome — identical on every screen)

### 5.1 Sidebar — 240 px, `ink-800`, right border `line-faint`
- **Brand:** leaf glyph (verdigris, hand-drawn SVG) + "VitaGraph" Spectral 18/600 + tagline "Evidence for a healthier tomorrow" `type/meta` dim.
- **Nav items** (icon 18 px 1.5-stroke + label `type/body` + optional sublabel `type/label` dim):
  Home · Upload & Ingest · Knowledge Graph (sub: Explore connections) · Ask (sub: Get evidence-backed answers) · Patient Timeline · Library (sub: Your documents) · Datasets (sub: Manage sources) · Ontology (sub: Concepts and mappings) · Notebooks (sub: Research notes) · Settings (sub: Preferences).
  States: default dim icon/bone text · hover `ink-700` wash 120 ms · **active = 2 px verdigris left rule + `ink-700` wash + bone text**.
  *Demo scope:* Home, Upload & Ingest, Knowledge Graph, Ask, Patient Timeline are live; Library/Datasets/Ontology/Notebooks/Settings render as designed "not in first release" empty states (§7.24) — never dead links.
- **Context list** (varies per screen, serif-free): Recent sessions (Knowledge Graph) / Recent questions with status LEDs (Ask) / Recent personas with IDs + LEDs (Timeline). Items: icon or LED + name `type/body` + date/ID `type/meta` mono dim; active item gets 2 px verdigris rule.
- **Marginalia block** (bottom): `type/marginalia` note + small hand-drawn sketch (mountains / quill / leaf). Rotates per screen — see §9 marginalia library.

### 5.2 Header — 72 px, `ink-900`, bottom border `line-faint`
- Left: screen title `type/display` + subline `type/screen-sub` (on Timeline: breadcrumb `Patients › Arjun R › Timeline` with `›` chevrons, `type/label`, replaces title block position).
- Right: search input 320 px (`ink-800`, radius 6, magnifier icon, placeholder per screen §9, shortcut chip: `/` on mac layout detection else `Ctrl K`, mono-sm in bordered chip) · user chip (verdigris circle avatar 32 px initial, name `type/body`, role `type/meta` dim, chevron).

### 5.3 Status strip — 28 px, `ink-800`, top border `line-faint`, `type/mono-sm`
Left: LED verdigris + "System online". Middle: per-screen key/value segments separated by `line-faint` vertical rules (values mono, labels dim). Right: `v0.3.1 | Docs | Feedback | theme-toggle sun icon` OR telemetry icons (CPU %, RAM %, lock "Local mode") per screen §9. **Model field rule:** display `gen-service <config-version>` (e.g. `gen-service v2 · cfg 2026-08`); never a provider or model name (academic boundary).

---

## 6. Layout grids per screen
| Screen | Grid |
|---|---|
| Home | main 1fr + rail 360 px; main = title, stat row (6 tiles), activity card |
| Upload & Ingest | main 1fr + rail 360 px; main = dropzone, pipeline card, page-quality card |
| Knowledge Graph | main 1fr + panel 400 px; main = stats+controls row, canvas (min 520 px), ask bar, thinking details |
| Ask | sidebar-list 240 (recent questions inside sidebar) + main 1fr + drawer 400 (collapsible) |
| Patient Timeline | main 1fr + rail 380 px; timeline spine at 260 px from main left |
| Compare / Insights / Safety / Evidence viewer | reuse Home or Graph grid; rail 360 px |

---

## 7. Component gallery (build in this order, one folder `src/components/gallery/`)

Each entry: anatomy → states → tokens. States notation: `default / hover / active / focus / disabled / loading / error`.

1. **LED** 8 px circle; colors §4.1; `live` adds 2 s opacity breathe (reduced-motion: static).
2. **Badge** radius 4, padding 2/8, mono-sm: `answered` verdigris tint · `refused — diagnostic boundary` madder tint · `insufficient evidence` ochre tint · `educational` verdigris tint · `1 file rejected` madder tint · `Ingesting…` verdigris tint + spinner · `Completed in 4.8 s` = LED + text, no box.
3. **Flag tag** (High/Low): madder tint bg, madder text, mono-sm, radius 4, paired right of measurement value (ochre mono).
4. **Delta chip**: `+0.1 improving` verdigris tint · `−6 slight decrease` ochre tint · `+0.3 increase` madder tint · `new result` cornflower tint.
5. **Buttons**: primary (verdigris bg, ink-900 text, radius 6, hover +6% lightness) · ghost (transparent, `line-strong` border, bone text) · outline-danger (madder border/text) · solid-danger (madder bg, ink-900 text, "Retry") · icon-button 28 px square bordered (arrow/copy/kebab/zoom) · all 120 ms hover, 2 px verdigris focus.
6. **Inputs / selects**: `ink-800` bg, `line-strong` border, radius 6, height 36; focus ring §4.8; select shows chevron; "Paper" mode select width 84.
7. **Stat tile**: radius 10, `ink-800`, padding 16; icon 20 px tinted per metric (doc verdigris, cube cornflower, graph cornflower, link ochre, speech ochre, shield madder); label `type/label` dim; value `type/stat`.
8. **System-health row**: LED + name `type/body` + status `type/label` + latency `type/mono-sm` right; divider `line-faint`.
9. **Sparkline card**: title row (card-title + "Last 24 hours" meta); SVG line verdigris 1.5 px, axis mono-sm dim (300/150/0; 00:00…24:00), gridlines `line-faint` dashed; footnote mono-sm "p50 38 ms / p95 121 ms".
10. **Activity row**: 2 px left rule by class (indexed/answered verdigris, graph ochre, refusal madder, dataset cornflower); mono-sm timestamp; icon+event `type/body` medium; details dim; right object chip (icon + name mono-sm, `ink-700` bg radius 4).
11. **Dropzone**: radius 14 dashed `line-strong`; hand-drawn page SVG 96 px; `type/quote` hint (not italic — regular Spectral 15); primary button; "or drag and drop here" meta; mono-sm footnote "Supports PDF · Max 50 MB · Encrypted in transit"; drag-over = border verdigris + wash.
12. **Pipeline stepper**: 6 nodes 28 px: done = verdigris fill + ink-900 check; active = verdigris ring + 6 px glow pulse (once per event, not looping); pending = `line-strong` circle. Connectors 2 px: done-segment verdigris else `line-faint`. Captions: name `type/label`, value `type/mono-sm` (412 ms / 1.2 s / 24 chunks / 1.9 s batch 32 / ok / +18 nodes).
13. **Quality bar**: track 96×4 `ink-600` radius 2; fill verdigris (native) / ochre (ocr), width = quality %.
14. **Manifest row**: label `type/label` dim left, value `type/mono-sm` right; copy icon-button on SHA256.
15. **Quarantine row**: 2 px madder rule; doc icon; filename mono; reason meta; solid-danger Retry.
16. **Graph stage**: frame radius 14 `line-strong`, dot grid + vignette §4.7; legend chips top-right (dot + label `type/label`); stats row above frame (icon + `type/stat`-small 16 px + label meta): nodes/edges/communities/modularity; controls: select "Force-directed", ghost "Filters", ghost "Reset view"; **community hulls**: dashed 1.5 px category-color closed curve + label `type/label` colored "(n nodes)"; **nodes**: circle r by degree (10–26 px), fill category color 85% + 1 px ring; active = ring glow §4.6; label `type/label` bone below; **measurement chips**: value ochre mono + flag tag, connected by 12 px hairline; **edges**: curved bezier 1 px `dim` 45%, label `type/quote`-small italic dim (indicates, measures, treats, increases_risk, leads_to); **node card** (on click/hover): `ink-800` radius 10 shadow-floating, title + copy icon, rows Type/Measured in/Location/Confidence (label dim + mono value); **minimap** 120×72 bottom-left `ink-800` bordered with viewport rect; **zoom cluster** right: +, −, locate icon-buttons stacked; **canvas marginalia** in two corners (§9).
17. **Ask bar**: tab row (Ask/Summarize/Compare/Find evidence) — active tab = `ink-700` wash + 2 px verdigris top rule; input row: text input flex + mode select + primary Send (paper-plane glyph).
18. **Thinking-details panel**: header: gear icon + card-title + status badge + right select "Show details"; trace row: index mono-sm faint (01…), bracket tag mono colored per stage map (§8.2), description `type/body`, latency `type/mono-sm` right tabular; sub-description `type/meta` dim (drawer variant); final row: "trace fingerprint" label + mono-sm sha256 full + copy icon-button; dividers `line-faint`.
19. **Document panel** (right, Graph): header icon-tile 40 px `ink-700` radius 6 with page glyph; filename Spectral 16/22; meta line `type/meta` dim with allowed `·`; kebab icon-button; tab row (Overview / Evidence (8) / Related nodes (6)) underline-active; **key-info rows** label dim / value bone (DOI value = verdigris mono link + external icon); **AI summary** card-title + `type/reading`; **paper slip** (§7.20); **related-insight row**: numbered 20 px square chip `ink-700` mono-sm + text `type/body` + score badge verdigris tint mono-sm; ghost button "View all related nodes (6)" with graph glyph; marginalia bottom-right.
20. **Paper slip** (the notebook voice): bg `paper`, radius 6, padding 16, folded corner top-right 22 px triangle `paper-fold`; citation chip top-right `ink-900` 12% on paper → use `#D8CFBC` bg, mono-sm "p. 4, §2.3"; quote `type/quote` paper-ink; attribution row: authors `type/label` paper-ink 70% + journal Spectral italic; similarity row (Ask variant): label meta + bar 96×4 track `#D8CFBC` fill verdigris-dark + mono value; Cite button = ghost-on-paper (border paper-ink 30%, quote glyph).
21. **Question card**: avatar 28 verdigris initial; question `type/body` medium; date mono-sm dim; category badge; inner rewritten-query block: `ink-900` bg radius 6, label chip mono-sm "Rewritten query (RAG)", mono text, copy icon.
22. **Answer block**: header check-circle verdigris 20 + "Answer" Spectral 20/26 + badge + time chip mono; **four part rows**: left label column 180 px `type/body` medium (What the reports say / Evidence used / What cannot be concluded / Safety guidance), right `type/reading` with **evidence-linked terms underlined** (dotted underline `dim`, hover verdigris → opens slip); dividers `line-faint`.
23. **Refusal card**: avatar + madder shield icon; question; madder badge; body `type/reading` dim boundary text (§9 copy).
24. **State set** (every screen implements all): *empty* = hand-drawn sketch + `type/quote` line + ghost action; *loading* = skeleton shimmer `ink-700` 1.2 s (reduced-motion: static); *error* = 2 px madder rule card + plain sentence + Retry; *uncertain* = ochre rule + "marked uncertain" note. No silent spinners anywhere.
25. **Marginalia** (§5.1/§9): max 2 per screen, never inside data cards.
26. **Breadcrumb**: `type/label`, `›` chevrons dim, current page bone.

---

## 8. Motion & the orchestrated sequences

### 8.1 Global
Hover 120 ms ease-out (border/color only) · drawer/accordion 240 ms ease-out · tooltip 120 ms in / 0 out · no scale, no bounce, no parallax. `prefers-reduced-motion`: all durations 0, pulses static, trace renders as full table instantly.

### 8.2 The one orchestrated moment — "Ask" (event-driven, NEVER timer-driven)
On Send: input dims → trace rows append **only when the matching SSE event arrives** (`question_interpreted, chunks_selected, graph_subgraph_built, citation_check_completed, generation_completed, safety_check_completed`) → at `chunks_selected` the matching graph nodes pulse **once** (400 ms ring expand) while unrelated nodes settle to 40% opacity → at `response_ready` paper slips fade in 240 ms. Stage color map: retrieval/question_interpreted `verdigris` · reranking `lilac` · graph/chunks_selected `ochre` · citation `cornflower` · generation `madder` · safety `lilac` · done `verdigris`.
**Reality contract:** if the backend stream errors, the sequence freezes at the failed stage with an error state; replay mode must print badge `replay`.

---

## 9. Screen specs (content, copy, bindings)

### 9.1 Home — "Workspace overview"
Sub: "Your health reports, evidence, and insights — all in one place." · Marginalia TR: "Same data. Deeper understanding."
Stat tiles: Reports 12 · Chunks 1,024 · Graph nodes 214 · Edges 486 · Questions 37 · Refusals 4.
Activity rows (exact classes §7.10) e.g. `2026-09-09 14:32:11 · Report indexed · Indexed 24 chunks from NEJM_2023_HeartFailure.pdf`.
Rail: System health (FastAPI :8000 ok 24 ms · Chroma ok 12 ms · SQLite ok 6 ms · SSE live — · LLM **disabled by policy** ochre) · Retrieval latency sparkline · Continue (last document row + last question row, icon-buttons with arrow glyph).
Bindings: counts `GET /api/reports/{uid}`, `GET /api/graph/{uid}`, questions/answers tables; feed `GET /api/timeline/{uid}`; health `GET /api/health` + `allow_api`.
Strip: LED · quote "Evidence connects. People benefit." (Spectral italic) · right v0.3.1 | Docs | Feedback | sun.

### 9.2 Upload & Ingest
Sub: "Turn your health reports into a structured knowledge graph." · Marginalia TR: "Same documents. Deeper insights." · sidebar marginalia: "Turn Health Reports into Knowledge." + mountains.
Dropzone copy: "Drop a report PDF. VitaGraph reads it page by page."
Pipeline card sub: "Processing your document step by step." + badge `Ingesting…`.
Page quality table: Page/Characters/Method/Quality/Notes; rows 1-4 (2,418 native Good structure · 1,983 native Tables detected · 2,105 **ocr** Scanned page (OCR) · 1,764 native Good structure).
Rail: File manifest (synthetic_panel_2025-06-20.pdf; SHA256 8f4a9c0d2b7e6f1c9d4a1e0b6c21 + copy; 214 KB; 4 pages; 2025-06-20 (parsed); Lab report (panel)) · Quarantine (corrupted_report_2025-06-18.pdf, reason, Retry) · Need help? 4 rows.
Bindings: `POST /api/reports/upload` → SSE job events drive stepper; pages `GET /api/reports/{id}/pages`.
Strip: "Ingestion service ready".

### 9.3 Knowledge Graph
Sub: "Discover how medical concepts, evidence, and outcomes are connected in your documents." · Search placeholder: "Search documents, concepts, or ask a question…" · shortcut chip `/`.
Stats: 42 nodes · 96 edges · 3 communities · 0.42 modularity. Legend 5 categories.
Hulls: Cardiac function (5 nodes) cornflower · Renal function (4 nodes) verdigris · Treatments (4 nodes) lilac · Clinical outcomes (3 nodes) madder.
Nodes/edges exactly as mockup (Heart Failure hub; BNP 428 pg/mL High; Ejection Fraction 32% Low; NYHA Class; Creatinine + open node card (Biomarker / NEJM_2023_HeartFailure.pdf / p. 3, span 412–448 / 0.94); eGFR 48 mL/min Low; SGLT2 Inhibitors; ACE Inhibitors; Hospitalization; Readmission).
Canvas marginalia: TL "Evidence connects a healthier tomorrow." · BR stacked "Data / People / Better Care".
Ask bar question: "What is the effect of SGLT2 inhibitors on hospitalization risk in heart failure?"
Thinking details rows 01-06 with latencies 612 ms / 1,240 ms / 980 ms / 1,612 ms / 356 ms / 4.8 s + fingerprint `sha256:8f4a3e9c0d2b7e6f1c9d4a1e0b6c7f13d9a2e8b4c1f6d7e0a9b3c5d8f2e6c21`.
Panel: NEJM_2023_HeartFailure.pdf · meta "New England Journal of Medicine · 2023 · 18 pages" · tabs Overview/Evidence (8)/Related nodes (6) · key-info (Journal article / Cardiology / Adults with heart failure (n = 4,372) / Randomized controlled trial / Mar 2, 2023 / DOI 10.1056/NEJMoa2211931) · AI summary text · slip quote "Treatment with the SGLT2 inhibitor resulted in a 26% lower risk…" chip p. 4, §2.3, McMurray et al. (2023) NEJM · insights 0.94/0.87/0.82 · panel marginalia "Better Questions Healthier People" + leaf.
Bindings: `GET /api/graph/{uid}` (nodes/edges/metrics), `POST /api/graph/subgraph` on question, node click → evidence viewer (§9.8).
Strip: Indexing: 12,438 chunks · Graph updated 2 min ago · Latency 4.8 s · gen-service v2 · CPU 18% · RAM 41% · Local mode.

### 9.4 Ask — "RAG Assistant"
Sub: "Ask questions. Get evidence-backed answers from your health reports." · placeholder "Search your reports, concepts, or ask a question…".
Sidebar recent questions with LEDs (refusal = madder).
Thread 1: question card (Sep 9, 2026 14:28, educational) + rewritten query mono; Answer block 4 parts with underlined evidence terms; Evidence used (4): slips "Dapagliflozin in Heart Failure with Reduced Ejection Fraction" p. 2, span 310–355, 0.89 and "Empagliflozin in Patients with HFpEF" p. 5, span 112–168, 0.86; follow-up input.
Thread 2 refusal: "Can you tell me if I should stop taking metformin based on my creatinine level?" badge `refused — diagnostic boundary`; body: "I can't provide personal medical advice or make treatment decisions. This goes beyond the scope of analysis of the provided reports. Please consult a qualified healthcare professional who can consider your full medical history."
Drawer tabs: Thinking details / Graph context / Related questions; execution trace 01-06 with SSE names, timestamps 14:28:11.102…, latencies 182/416/612/398/1,482/164 ms + sub-lines; fingerprint; Retrieved chunks top-5 (NEJM_2019_DAPA.pdf p.2 0.89 … MetaAnalysis 2023.pdf p.7 0.71); Graph context chips (SGLT2 inhibitor, Heart failure, Hospitalization, HFrEF, HFpEF, Cardiovascular risk) + "Show subgraph"; drawer marginalia "Same data. Deeper understanding."
Bindings: `POST /api/questions`, SSE stream, `answer.evidence[]`.
Strip: Documents 12 · Chunks 1,024 · Graph nodes 214 · Latency 38 ms · Local mode · Privacy first.

### 9.5 Patient Timeline
Breadcrumb `Patients › Arjun R › Timeline` · sub "A longitudinal view of reports, key changes, and research activity." · control select "All events".
Blocks 2025-01-15 & 2025-06-20: report cards (4 pages · 96 chunks · sha256: a3f2…9c1d / 118 chunks · 8f4a…c21) + View report; events Graph updated / Question asked (serif italic quoted + Show answer) / observation rows (Hemoglobin 13.1 → 13.2 g/dL +0.1 improving Ref: p. 2 · eGFR 78 → 72 −6 slight decrease p. 3 · HbA1c 6.8 → 7.1 +0.3 increase p. 4) · dashed missing row "Vitamin D — Not present in January report" · June block adds Vitamin D — → 24 ng/mL `new result`.
Rail: Patient/persona (Arjun R, VG-2026-001 + copy, 1994-08-12, Male, Consent Accepted LED, 2026-02-10, note "Synthetic persona for research use only.", Delete persona outline-danger) · Report versions table (Indexed LEDs) · Key observations (+0.2 g/dL Improving · −10 mL/min/1.73m² Decreasing · +0.6 % Increasing · New in latest report New) + View in graph · Related tools 3 ghosts.
Sidebar recent personas Arjun/Meera/Kavya/Rohan · marginalia "Same data. Kinder answers."
Bindings: `GET /api/timeline/{uid}`, `GET /api/reports/{uid}/trends?test=…`.
Strip: Personas 1 · Reports 2 · Chunks 214 · Graph nodes 486 · Latency 38 ms.

### 9.6 Compare Reports · 9.7 Insights · 9.8 Evidence viewer · 9.9 Safety & Privacy
Specs as previously approved prompts (diff columns with delta chips + summary strip "3 improved · 1 declined · 9 stable · 1 unavailable"; Louvain/centrality/top-relations/topic-evolution cards with causality footnote; PDF sheet + verdigris bounding box + chunk card with char_start/char_end; guardrail ledger + consent + deletion log + boundary diagram "allow_api = false — snippets only"). All bind to real endpoints; footnotes in `type/quote`.

### 9.10 Marginalia library (rotate, never repeat on one screen)
"Same data. Deeper understanding." · "Same documents. Deeper insights." · "Better questions Healthier tomorrows." · "Better data. Healthier decisions." · "Same data. Kinder answers." · "Evidence connects a healthier tomorrow." · "Data / People / Better Care" · "Better Questions Healthier People".

### 9.11 Copy fixes over mockups (typos & boundary)
"All systems unperational" → "All systems operational" · "key clingés" → "key changes" · status-strip "Model gpt-4o" → "gen-service v2 · cfg 2026-08".

---

## 10. Data-binding contract (demo realism)
Every visible number maps to a live source; **no lorem, no fake timers, no static graph.json** (real-time reality contract). Table of bindings per screen in §9; failure injection demos (stop Chroma / disable API) must render §7.24 error states while local graph/timeline stay inspectable.

---

## 11. QA gates (run before every commit & before viva)
1 Squint test: hierarchy visible blurred · 2 zero trailing arrows in text · 3 middle-dots only in allowed slots · 4 zero ALL-CAPS · 5 ≥3 radii in use · 6 shadows only floating · 7 mono only machine output · 8 ≤6 categorical colors · 9 exactly one saturated accent region per screen · 10 motion event-driven + reduced-motion ok · 11 all numbers tabular & real · 12 empty/loading/error/uncertain present · 13 type-step ratio ≥1.25 · 14 no hover on static cards · 15 focus ring visible on every interactive · 16 overflow/overlap pass at 1280 & 1440 px.

## 12. Accessibility floor
Contrast ≥4.5:1 body, ≥3:1 graphics; keyboard: `/` or Ctrl K search, Esc closes drawer, tabs roving; trace region `aria-live=polite`; graph exposes hidden data-table equivalent; paper slips are `figure` with `blockquote`; theme toggle persists.

## 13. Handoff workflow
1 Agent builds `gallery` page from §7 only. 2 Screenshot-diff against `/design-board`. 3 Assemble screens from gallery components exclusively. 4 Bind per §10. 5 Run §11 + §12. 6 Extend this file for anything new (PR must edit DESIGN.md first).

## Appendix A — CSS variables & font links
```html
<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;1,400;1,500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```
```css
:root{--ink-900:#0E1116;--ink-800:#141920;--ink-700:#1A2028;--ink-600:#232B35;
--line-strong:#2B3440;--line-faint:#1E2530;--bone:#E6E4DE;--dim:#98A2AD;--faint:#6B7683;
--verdigris:#79B8A6;--ochre:#D9A441;--cornflower:#86A9D9;--lilac:#A992D0;--madder:#D9808D;
--paper:#EDE7DA;--paper-ink:#2A2620;--paper-fold:#D8CFBC;
--r-4:4px;--r-6:6px;--r-10:10px;--r-14:14px;--t-fast:120ms;--t-med:240ms;--ease:cubic-bezier(.2,.7,.3,1);}
```
## Appendix B — Mockup regeneration
Paste SYSTEM BLOCK (v2, §4 tokens) + the matching screen prompt from the approved prompt set; generate Knowledge Graph first and use it as `--sref` for the rest.