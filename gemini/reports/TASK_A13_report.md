# TASK A13 Report

### 1. STATUS
COMPLETE

### 2. BRANCH
`redesign/modernist-app`

### 3. FILES CHANGED
```
11	0	site design/package-lock.json
1	0	site design/package.json
2	5	site design/src/motion/navigation.ts
3	0	site design/src/pages/ComparePage.tsx
4	0	site design/src/pages/LibraryPage.tsx
3	0	site design/src/pages/SettingsPage.tsx
5	0	site design/src/pages/UploadPage.tsx
created	scripts/plan/check_layout.py
created	scripts/plan/check_a11y.py
created	gemini/shots/A12-timeline-1440.png
created	gemini/shots/layout-360-agent.png
created	gemini/shots/layout-360-compare.png
created	gemini/shots/layout-360-insights.png
created	gemini/shots/layout-360-library.png
created	gemini/shots/layout-360-settings.png
created	gemini/shots/layout-360-timeline.png
created	gemini/shots/layout-360-upload.png
created	gemini/shots/layout-1440-agent.png
created	gemini/shots/layout-1440-compare.png
created	gemini/shots/layout-1440-insights.png
created	gemini/shots/layout-1440-library.png
created	gemini/shots/layout-1440-settings.png
created	gemini/shots/layout-1440-timeline.png
created	gemini/shots/layout-1440-upload.png
```

### 4. COMMIT
`plan(A13): layout and a11y check scripts, axe-core audit and gate fixes` (pending commit hash)

Axe violations fixed per step 57:
1. `UploadPage.tsx`: Added WCAG-compliant styling for `.btn-primary` (background `--color-accent-700`, text `--color-bg`, 6.79:1 contrast), `.table th` (color `--color-neutral-800`, 9.5:1 contrast), and `[data-tone="hot"]` (background `--color-accent-700`, text `--color-bg`, 6.79:1 contrast).
2. `LibraryPage.tsx`: Added WCAG-compliant styling for `.table th` and `[data-tone="hot"]`.
3. `ComparePage.tsx`: Added WCAG-compliant styling for `.table th`.
4. `SettingsPage.tsx`: Added WCAG-compliant styling for `.btn-primary`.
5. `navigation.ts` (authorized extra file): Removed obsolete routes `/datasets`, `/ontology`, and `/notebooks` from `ROUTE_INDEX`.

### 5. VERIFICATION COMMANDS AND REAL OUTPUT
1. `git branch --show-current`:
```
redesign/modernist-app
```

2. `cd "site design"; npm run audit:design`:
```
> vitagraph-site-design@0.0.0 audit:design
> node scripts/audit-design.mjs

pending demo-value     pages/KnowledgeGraphPage.tsx:48  const uid = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";
pending console        pages/KnowledgeGraphPage.tsx:60  console.warn("Could not load knowledge graph:", err);
pending hex-colour     pages/KnowledgeGraphPage.tsx:146  color: node.color || "#47775F",
pending demo-value     pages/KnowledgeGraphPage.tsx:260  const sub = await graphApi.getSubgraph(user?.id || "VG-2026-001", chunkIds);
pending console        pages/KnowledgeGraphPage.tsx:281  console.warn("Could not load subgraph:", err);
pending legacy-token   pages/KnowledgeGraphPage.tsx:457  className="node-fly-chip fixed pointer-events-none z-50 rounded-[var(--r-6)] border border-[var(--line-strong)] bg-[var(
pending rounded        pages/KnowledgeGraphPage.tsx:466  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
pending legacy-token   pages/KnowledgeGraphPage.tsx:469  <span className="type-mono-sm text-xs text-[var(--bone)] truncate">
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:98  <div className="relative w-full max-w-4xl rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] s
pending old-font       components/gallery/CinematicPipelinePopup.tsx:101  <h2 id="cinematic-popup-title" className="font-['Spectral'] font-semibold text-[var(--bone)] text-[17px] leading-tight">
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:101  <h2 id="cinematic-popup-title" className="font-['Spectral'] font-semibold text-[var(--bone)] text-[17px] leading-tight">
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:118  <div className="p-4 px-6 bg-[var(--ink-800)] flex items-center justify-between gap-3 border-t border-[var(--line-faint)]
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:159  <div className="relative w-full max-w-2xl rounded-[var(--r-14)] bg-[var(--ink-800)]/95 border border-[var(--line-strong)
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:161  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--bone)]/20 to-transparent p
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:164  <div className="flex items-center justify-between p-5 border-b border-[var(--line-faint)] bg-[var(--ink-900)]/70">
pending old-font       components/gallery/CinematicPipelinePopup.tsx:191  className="font-['Spectral'] font-semibold text-[var(--bone)] text-[16px] leading-tight truncate"
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:191  className="font-['Spectral'] font-semibold text-[var(--bone)] text-[16px] leading-tight truncate"
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:218  <div className="relative p-6 bg-gradient-to-b from-[var(--ink-900)]/60 to-[var(--ink-800)] flex flex-col items-center ju
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:226  className={`relative w-72 h-40 rounded-[var(--r-10)] bg-[var(--ink-900)] border p-4 shadow-[inset_0_2px_12px_rgba(20,22,
pending rounded        components/gallery/CinematicPipelinePopup.tsx:244  className={`w-2 h-2 rounded-full ${
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:252  <span className="type-mono-sm text-[11.5px] text-[var(--bone)]">
pending rounded        components/gallery/CinematicPipelinePopup.tsx:291  <div className="w-36 h-1 bg-[var(--ink-700)] rounded overflow-hidden">
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:291  <div className="w-36 h-1 bg-[var(--ink-700)] rounded overflow-hidden">
pending rounded        components/gallery/CinematicPipelinePopup.tsx:299  <div className={`h-2 w-3/4 bg-[var(--verdigris)]/30 rounded ${!isT0 ? "animate-pulse" : ""}`} />
pending rounded        components/gallery/CinematicPipelinePopup.tsx:300  <div className="h-2 w-full bg-[var(--ink-700)] rounded" />
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:300  <div className="h-2 w-full bg-[var(--ink-700)] rounded" />
pending rounded        components/gallery/CinematicPipelinePopup.tsx:301  <div className={`h-2 w-5/6 bg-[var(--verdigris)]/40 rounded ${!isT0 ? "animate-pulse" : ""}`} />
pending rounded        components/gallery/CinematicPipelinePopup.tsx:302  <div className="h-2 w-1/2 bg-[var(--ink-700)] rounded" />
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:302  <div className="h-2 w-1/2 bg-[var(--ink-700)] rounded" />
pending rounded        components/gallery/CinematicPipelinePopup.tsx:308  <div className="p-1.5 rounded bg-[var(--ink-800)] border border-[var(--line-faint)] text-[9px] text-[var(--verdigris)] t
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:308  <div className="p-1.5 rounded bg-[var(--ink-800)] border border-[var(--line-faint)] text-[9px] text-[var(--verdigris)] t
pending rounded        components/gallery/CinematicPipelinePopup.tsx:311  <div className="p-1.5 rounded bg-[var(--ink-800)] border border-[var(--line-faint)] text-[9px] text-[var(--verdigris)] t
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:311  <div className="p-1.5 rounded bg-[var(--ink-800)] border border-[var(--line-faint)] text-[9px] text-[var(--verdigris)] t
pending rounded        components/gallery/CinematicPipelinePopup.tsx:314  <div className="p-1.5 rounded bg-[var(--ink-800)] border border-[var(--line-faint)] text-[9px] text-[var(--dim)] type-mo
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:314  <div className="p-1.5 rounded bg-[var(--ink-800)] border border-[var(--line-faint)] text-[9px] text-[var(--dim)] type-mo
pending rounded        components/gallery/CinematicPipelinePopup.tsx:317  <div className="p-1.5 rounded bg-[var(--ink-800)] border border-[var(--line-faint)] text-[9px] text-[var(--dim)] type-mo
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:317  <div className="p-1.5 rounded bg-[var(--ink-800)] border border-[var(--line-faint)] text-[9px] text-[var(--dim)] type-mo
pending rounded        components/gallery/CinematicPipelinePopup.tsx:328  className="w-1.5 rounded bg-[var(--verdigris)] transition-all duration-200"
pending rounded        components/gallery/CinematicPipelinePopup.tsx:342  <div className="w-3 h-3 rounded-full bg-[var(--verdigris)] shadow-[0_0_8px_var(--verdigris)]" />
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:344  <span className="type-meta text-[12px] text-[var(--bone)]">
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:360  <circle cx="60" cy="45" r="4" fill="var(--ink-700)" stroke="var(--dim)" />
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:384  <div className="p-6 bg-[var(--ink-800)]/80 border-b border-[var(--line-faint)]">
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:389  <div className="p-4 bg-[var(--ink-900)]/70 px-6">
pending rounded        components/gallery/CinematicPipelinePopup.tsx:393  <span className="w-2.5 h-2.5 rounded-full bg-[var(--madder)] flex-shrink-0 animate-pulse" />
pending rounded        components/gallery/CinematicPipelinePopup.tsx:406  className={`w-2 h-2 rounded-full ${
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:412  <span className="text-[var(--bone)] font-medium truncate">
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:437  <div className="p-4 px-6 bg-[var(--ink-800)]/90 flex items-center justify-between border-t border-[var(--line-faint)]">

Checked 39 files: 0 error(s), 47 pending.
```

3. `cd "site design"; npm run build`:
```
> vitagraph-site-design@0.0.0 build
> tsc -b && vite build

vite v8.3.2 building client environment for production...
transforming...
✓ 367 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.71 kB │ gzip:   0.44 kB
dist/assets/archivo-latin-600-normal-3BBy0ZsW.woff2   13.82 kB
dist/assets/archivo-latin-800-normal-cB6v3kRN.woff2   14.41 kB
dist/assets/archivo-latin-400-normal-C81ewxNO.woff2   14.70 kB
dist/assets/archivo-latin-600-normal-DwYieO8P.woff    18.20 kB
dist/assets/archivo-latin-800-normal-DZa_k145.woff    18.90 kB
dist/assets/archivo-latin-400-normal-Bl602Mgc.woff    18.97 kB
dist/assets/index-BQNAT4mJ.css                        99.33 kB │ gzip:  18.05 kB
dist/assets/index-5SeAHmgJ.js                        657.04 kB │ gzip: 197.68 kB
✓ built in 590ms
```

4. `$env:PYTHONIOENCODING="utf-8"; python scripts\plan\check_layout.py usr_51f14542d71a /upload /library /agent /timeline /compare /insights /settings`:
```
OK 360px /upload doc:360/360 main:300/300 errors: 0
OK 360px /library doc:360/360 main:300/300 errors: 0
OK 360px /agent doc:360/360 main:300/300 errors: 0
OK 360px /timeline doc:360/360 main:300/300 errors: 0
OK 360px /compare doc:360/360 main:300/300 errors: 0
OK 360px /insights doc:360/360 main:300/300 errors: 0
OK 360px /settings doc:360/360 main:300/300 errors: 0
OK 820px /upload doc:820/820 main:760/760 errors: 0
OK 820px /library doc:820/820 main:760/760 errors: 0
OK 820px /agent doc:820/820 main:760/760 errors: 0
OK 820px /timeline doc:820/820 main:760/760 errors: 0
OK 820px /compare doc:820/820 main:760/760 errors: 0
OK 820px /insights doc:820/820 main:760/760 errors: 0
OK 820px /settings doc:820/820 main:760/760 errors: 0
OK 1440px /upload doc:1440/1440 main:1196/1196 errors: 0
OK 1440px /library doc:1440/1440 main:1196/1196 errors: 0
OK 1440px /agent doc:1440/1440 main:1196/1196 errors: 0
OK 1440px /timeline doc:1440/1440 main:1196/1196 errors: 0
OK 1440px /compare doc:1440/1440 main:1196/1196 errors: 0
OK 1440px /insights doc:1440/1440 main:1196/1196 errors: 0
OK 1440px /settings doc:1440/1440 main:1196/1196 errors: 0
RESULT: PASS
```

5. `python scripts\plan\check_a11y.py usr_51f14542d71a /upload /library /agent /timeline /compare /insights /settings`:
```
--- Checking /upload ---
OK a11y: 0 serious/critical violations on /upload
OK focus: 17 tab stops checked on /upload
OK reduced-motion: 0 running animations on /upload

--- Checking /library ---
OK a11y: 0 serious/critical violations on /library
OK focus: 23 tab stops checked on /library
OK reduced-motion: 0 running animations on /library

--- Checking /agent ---
OK a11y: 0 serious/critical violations on /agent
OK focus: 18 tab stops checked on /agent
OK reduced-motion: 0 running animations on /agent

--- Checking /timeline ---
OK a11y: 0 serious/critical violations on /timeline
OK focus: 13 tab stops checked on /timeline
OK reduced-motion: 0 running animations on /timeline

--- Checking /compare ---
OK a11y: 0 serious/critical violations on /compare
OK focus: 15 tab stops checked on /compare
OK reduced-motion: 0 running animations on /compare

--- Checking /insights ---
OK a11y: 0 serious/critical violations on /insights
OK focus: 13 tab stops checked on /insights
OK reduced-motion: 0 running animations on /insights

--- Checking /settings ---
OK a11y: 0 serious/critical violations on /settings
OK focus: 20 tab stops checked on /settings
OK reduced-motion: 0 running animations on /settings

RESULT: PASS
```

### 6. CRITICAL FINDINGS
- `check_layout.py` verified 21 route/viewport combinations (360, 820, 1440 px across 7 routes) with zero horizontal overflow and zero console errors (`RESULT: PASS`).
- `check_a11y.py` evaluated axe-core (WCAG 2.0/2.1 A/AA), keyboard focus navigation, and reduced motion animations. Initial run found 4 color-contrast failures on `.btn-primary`, `.table th`, and `[data-tone="hot"]`. Fixed across the 4 named pages, reaching 0 serious/critical violations and full pass on keyboard focus and reduced motion (`RESULT: PASS`).
- Saved all required screenshots in `gemini/shots/`.
- Cleaned up obsolete routes `/datasets`, `/ontology`, and `/notebooks` from `ROUTE_INDEX` in `navigation.ts`.

### 7. REMARKS ADDRESSED
- Fixed color contrast violations in all four flagged page components.
- Maintained exact dev dependency `axe-core@4.13.0`.
- Kept design audit error count at 0 errors across 39 checked files.

### 8. QUALITY BAR SELF-CHECK
- `git diff --numstat` used for all line counts: YES
- Real pasted output from verification runs: YES
- No provider or model names in UI: YES
- No `tsconfig.tsbuildinfo` staged: YES
- Explicit paths only: YES

### 9. NEXT STEP
Task C1 (`gemini/plan/TASK_C1.md`): Modernist status strip and streaming pipeline indicator.
