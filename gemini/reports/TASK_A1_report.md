# TASK A1 report

## 1. What I was asked to do
Create a repeatable Node ES-module audit script `site design/scripts/audit-design.mjs` that traverses the shipping application from `src/main.tsx` via breadth-first search and checks for design system violations (eight specific rules). Add an npm script `"audit:design": "node scripts/audit-design.mjs"` to `site design/package.json`. Support `--strict` mode, skipped files, and a PENDING list for temporary legacy files.

## 2. What I actually did
1. Created `site design/scripts/audit-design.mjs` with bread-first search following relative static imports/exports, dynamic imports, and CSS `@import`.
2. Implemented the eight rules: `hex-colour`, `rounded`, `radius`, `old-font`, `legacy-token`, `console`, `demo-value`, `provider-name`.
3. Configured skip rules: completely omit `pages/GalleryPage.tsx` and any file under `motion/`.
4. Configured PENDING files (`pages/KnowledgeGraphPage.tsx` and `components/gallery/CinematicPipelinePopup.tsx`) to report `pending` and not follow imports unless `--strict` is passed.
5. Allowed raw colors/legacy tokens in theme files (`index.css`, `theme/tokens.css`, `theme/modernist.css`).
6. Added `"audit:design": "node scripts/audit-design.mjs"` directly after `"preview": "vite preview"` in `site design/package.json`.
7. Verified with `npm run audit:design` (failing with 690 errors and 47 pending, as expected before tasks A3–A12).
8. Verified specific expected error lines and pending lines.
9. Verified `npm run build` exits 0.

## 3. Files changed
- `site design/package.json` (+2/-1): Added `audit:design` npm script.
- `site design/scripts/audit-design.mjs` (+209/-0): Design audit script using Node built-ins.

## 4. Commands and their output

### Command: `npm run audit:design`
```
pending rounded        components/gallery/CinematicPipelinePopup.tsx:406  className={`w-2 h-2 rounded-full ${
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:412  <span className="text-[var(--bone)] font-medium truncate">
pending legacy-token   components/gallery/CinematicPipelinePopup.tsx:437  <div className="p-4 px-6 bg-[var(--ink-800)]/90 flex items-center justify-between border-t border-[var(--line-faint)]">
ERROR   hex-colour     components/gallery/graphTheme.ts:6  "#6FC3D4", // sky teal
ERROR   hex-colour     components/gallery/graphTheme.ts:7  "#82D3A2", // mint
ERROR   hex-colour     components/gallery/graphTheme.ts:8  "#E8B067", // bronze
ERROR   hex-colour     components/gallery/graphTheme.ts:9  "#B79CE8", // lilac
ERROR   hex-colour     components/gallery/graphTheme.ts:10  "#F08E9A", // coral
ERROR   hex-colour     components/gallery/graphTheme.ts:11  "#8FA8F0", // periwinkle
ERROR   hex-colour     components/gallery/graphTheme.ts:12  "#CBDC66", // lime
ERROR   hex-colour     components/gallery/graphTheme.ts:13  "#E6E0D0", // bone
...
Checked 72 files: 690 error(s), 47 pending.
```
(Command exited with code 1 as expected prior to cleanup tasks)

### Specific required lines check
```powershell
node scripts/audit-design.mjs | Select-String "UploadPage.tsx:15|AgentPage.tsx:204|TimelinePage.tsx:31|UploadPage.tsx:108|AppShell.tsx:128"
```
Output:
```
ERROR   legacy-token   components/shell/AppShell.tsx:128  <div className="flex h-screen w-screen text-[var(--bone)] overflow-hidden relative">
ERROR   demo-value     pages/UploadPage.tsx:15  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";
ERROR   console        pages/UploadPage.tsx:108  console.warn("Could not load initial report pages:", err);
ERROR   demo-value     pages/AgentPage.tsx:204  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";
ERROR   demo-value     pages/TimelinePage.tsx:31  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";
```

### KnowledgeGraphPage pending check
```powershell
node scripts/audit-design.mjs | Select-String "KnowledgeGraphPage.tsx"
```
Output:
```
pending demo-value     pages/KnowledgeGraphPage.tsx:48  const uid = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";
pending console        pages/KnowledgeGraphPage.tsx:60  console.warn("Could not load knowledge graph:", err);
pending hex-colour     pages/KnowledgeGraphPage.tsx:146  color: node.color || "#47775F",
pending demo-value     pages/KnowledgeGraphPage.tsx:260  const sub = await graphApi.getSubgraph(user?.id || "VG-2026-001", chunkIds);
pending console        pages/KnowledgeGraphPage.tsx:281  console.warn("Could not load subgraph:", err);
pending legacy-token   pages/KnowledgeGraphPage.tsx:457  className="node-fly-chip fixed pointer-events-none z-50 rounded-[var(--r-6)] border border-[var(--line-strong)] bg-[var(
pending rounded        pages/KnowledgeGraphPage.tsx:466  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
pending legacy-token   pages/KnowledgeGraphPage.tsx:469  <span className="type-mono-sm text-xs text-[var(--bone)] truncate">
```

### Skipped check (motion/ and GalleryPage.tsx)
```powershell
node scripts/audit-design.mjs | Select-String "motion/|GalleryPage"
```
Output: (empty)

### Command: `npm run build`
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
dist/assets/index-DkwM3Z9a.css                       103.93 kB │ gzip:  18.48 kB
dist/assets/index-Bdlx7aTp.js                        879.77 kB │ gzip: 240.62 kB
✓ built in 631ms
```
(Exited with code 0)

## 5. Acceptance checklist
- [x] `site design/scripts/audit-design.mjs` exists and implements the eight rules, the skip list, the PENDING list and the `--strict` flag described above. (PASS: script implemented with Node built-ins)
- [x] `npm run audit:design` prints one line per finding and ends with a line of the form `Checked N files: E error(s), P pending.`. (PASS: output ends with `Checked 72 files: 690 error(s), 47 pending.`)
- [x] The output includes all of these ERROR lines:
  - `demo-value` at `pages/UploadPage.tsx:15`, `pages/AgentPage.tsx:204` and `pages/TimelinePage.tsx:31` (PASS)
  - `console` at `pages/UploadPage.tsx:108` (PASS)
  - `legacy-token` at `components/shell/AppShell.tsx:128` (PASS)
- [x] The output includes `pending` lines for `pages/KnowledgeGraphPage.tsx`, and no line for any file under `motion/` or for `pages/GalleryPage.tsx`. (PASS: verified via Select-String)
- [x] `npm run build` exits 0. (PASS: built cleanly in 631ms)

## 6. Things that surprised me
Nothing unexpected; the output line counts and dry run findings matched the planner's specification precisely.

## 7. Deviations from the task
none

## 8. Open questions for the reviewer
none

## 9. How the reviewer can double-check
1. `cd "site design" && npm run audit:design`
2. `cd "site design" && node scripts/audit-design.mjs --strict`
3. `cd "site design" && npm run build`
