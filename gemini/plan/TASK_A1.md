<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task A1 — Design audit script

- **Goal:** A repeatable audit that follows every import of the shipping app and reports anything that breaks the design and data rules.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `gemini/RULES.md` (section 2)
  - `site design/package.json`
  - `site design/src/main.tsx`
  - `site design/src/App.tsx`
- **Files to create or modify:**
  - create `site design/scripts/audit-design.mjs`
  - modify `site design/package.json`

**What to change**
1. **Create `site design/scripts/audit-design.mjs`**: a Node ES-module script that uses only Node built-ins (`node:fs`, `node:path`, `node:url`). Behaviour:
   - **Locating `src`.** Find the `src` folder relative to the script's own location, one level up from `scripts/`. Do not use the current working directory.
   - **Following imports.**
     - Start at `src/main.tsx`. Follow every relative import with a breadth-first walk:
       - static `import … from "…"`;
       - `export … from "…"`;
       - dynamic `import("…")`;
       - CSS `@import "…"`.
     - Do not follow type-only imports (`import type …`).
     - To resolve an import, try the suffixes "", `.tsx`, `.ts`, `.css`, `/index.ts` and `/index.tsx`, in that order. Ignore package imports (anything not starting with a dot).
   - **Skipped files.**
     - Never visit `pages/GalleryPage.tsx`. It is development-only after task A3.
     - Never visit any file under `src/motion/`. See open issue O-9 in section 14.
   - **Pending files.**
     - A PENDING list holds exactly two files that later tasks replace: `pages/KnowledgeGraphPage.tsx` (replaced in B8) and `components/gallery/CinematicPipelinePopup.tsx` (replaced in C3).
     - Findings in a pending file are printed as `pending` and do not fail the run, and that file's imports are not followed.
     - With the command-line flag `--strict`, the PENDING list is ignored: those files are checked and followed like any other.
   - **Lines checked.** Check each visited file line by line. Skip lines whose trimmed text starts with `//`, `/*`, `*` or `{/*`.
   - **The eight rules:**
     - `hex-colour`: a `#` followed by exactly 3, 6 or 8 hexadecimal digits, not followed by another letter, digit, underscore or hyphen.
     - `rounded`: the Tailwind class word `rounded` or `rounded-…`, as a whole word.
     - `radius`: `borderRadius:` or `border-radius:` with any value other than 0. In CSS, a `var(--r…)` value is also allowed.
     - `old-font`: the text `Spectral`, `IBM Plex` or `Georgia`.
     - `legacy-token`: `var(--…)` of any of these old token names:
       - `ink-<digits>`, `bone`, `paper…`, `chrome…`;
       - `titanium-mist`, `alloy-surface`, `steel-fog`, `deep-petrol`, `jade-slate`, `solar-bronze`;
       - `cornflower`, `lilac`, `text-main`, `text-muted`;
       - `shadow-3d…`, `shadow-float`, `shadow-floating`.
     - `console`: a call to `console.log`, `console.warn`, `console.error`, `console.info` or `console.debug`.
     - `demo-value`: the text `VG-2026-001`, `Arjun R` (as a whole word) or `NEJM_2023`.
     - `provider-name`: case-insensitive `agentrouter`, `deepseek`, `gemini`, `openai`, `anthropic`, `claude` or `gpt-<digit>`, at the start of a word.
   - **Theme files.** The three theme files `index.css`, `theme/tokens.css` and `theme/modernist.css` may contain raw colours and old token names. Skip the rules `hex-colour`, `rounded`, `radius` and `legacy-token` for them. Every other rule still applies.
   - **Output and exit code.**
     - For each finding, print one line: the severity padded to seven characters (`ERROR` or `pending`), the rule ID padded to 14 characters, `file:line` relative to `src`, then the first 120 characters of the trimmed line.
     - After a blank line, print `Checked N files: E error(s), P pending.`. In strict mode, put ` (strict)` after `files`.
     - Exit with code 1 when E is above zero, otherwise 0.
2. **Modify the `scripts` object:** `site design/package.json` lines 6–10 (anchor `"preview": "vite preview"`). Add an entry named `audit:design` whose command is `node scripts/audit-design.mjs`, directly after `preview`. Remember the comma after the `preview` line.

**How to verify**
1. `cd "site design"; npm run audit:design`. At this point the run is expected to **fail** with exit code 1, because tasks A3 to A12 have not removed the violations yet. Paste the full output into report section 4.
2. `cd "site design"; npm run build`. It must exit 0. The script lives outside `src`, so the build ignores it.

**Acceptance criteria**
- [ ] `site design/scripts/audit-design.mjs` exists and implements the eight rules, the skip list, the PENDING list and the `--strict` flag described above.
- [ ] `npm run audit:design` prints one line per finding and ends with a line of the form `Checked N files: E error(s), P pending.`.
- [ ] The output includes all of these ERROR lines (the planner's dry run of this specification found exactly these, among others):
  - `demo-value` at `pages/UploadPage.tsx:15`, `pages/AgentPage.tsx:204` and `pages/TimelinePage.tsx:31`;
  - `console` at `pages/UploadPage.tsx:108`;
  - `legacy-token` at `components/shell/AppShell.tsx:128`.
- [ ] The output includes `pending` lines for `pages/KnowledgeGraphPage.tsx`, and no line for any file under `motion/` or for `pages/GalleryPage.tsx`.
- [ ] `npm run build` exits 0.
