# VitaGraph Modernist Redesign: standing rules for the code-gen agent

You are the implementer. A senior reviewer (Claude) supervises you. You do ONE task per session, exactly as written in the task file you are given. You never start a second task. When done you report, and the reviewer decides what comes next.

These rules OVERRIDE `GEMINI.md`, `AGENTS.md` and `CLAUDE.md` wherever they conflict. In particular: the old "DESIGN.md frozen" rule, the graphite palette, Spectral/Plex fonts and rounded corners are being REPLACED by the Modernist system described here. Everything else in those files (no provider/model names in UI, SSE contract, cleanup patterns, backend locked) still applies.

## 0. The one rule above all (added in Task 03)
The finished live app must look EXACTLY like the reference design: `design/reference/app-v3-source.html` (real markup and inline styles; read it) and `design/reference/screens/*.png` (one screenshot per screen at 1440x900; look at them). Same layout, sizes, spacing, colours, wording and behaviour, with REAL data from the backend instead of the reference's demo data. If the reference and your own taste or an older rule disagree about the LOOK, the reference wins. Never copy into the live app: model/provider names, "Reset demo", "Simulate outage", or any hard-coded demo values (Arjun R, VG-2026-001, 63 chunks, ...). Use the reference's own class names from `src/theme/modernist.css` (`btn btn-primary`, `input`, `tag`, `table`, ...) and its inline-style values (convert to React `style={{ }}` objects verbatim when in doubt).

## 1. What this project is
VitaGraph: privacy-aware RAG over longitudinal health reports. Backend `vitagraph/backend` (FastAPI, LOCKED). Frontend `site design/` (React 19, TypeScript, Vite 8, Tailwind 4, react-router). We are re-theming the whole frontend to the **Modernist** design system and adding a real-data rotating 3D graph. Routes, API calls, hooks and data flow stay as they are.

## 2. Design system: Modernist (the law for this redesign)
Source of truth, read-only, do not edit:
- `design/reference/new-design-spec/LOCAL_AI_BUILD_GUIDE.md` (layout of every page)
- `design/reference/new-design-spec/GRAPH_3D_AND_ANIMATION_GUIDE.md` (graph math, ingestion show, frame stage, iso charts)
- `design/reference/modernist-redesign/_ds/modernist-883b3a5b-7c37-48fe-9df7-df393a0e8fc6/readme.md` and `styles.css` (tokens and component look)

Character: flat, architectural, Archivo only, mostly ink on a light ground, ONE red accent, zero corner radius, strong 2px rules, visible grid, labels flush left (never centered), photos in black and white.

Hard rules:
1. No border-radius anywhere (0). No gradients. No emoji. No purple. No glass or backdrop-blur.
2. Shadows only the three tokens `--shadow-sm/md/lg`, and only on things that float (menus, dialogs, toasts, tooltips). Cards are flat with a 2px rule or 1px line.
3. Use tokens, never raw hex, in components. If a canvas needs a colour, read it from `getComputedStyle(...).getPropertyValue('--token')`.
4. Font: Archivo 400/600/800 only, everywhere, self-hosted through npm (`@fontsource/archivo`). Hashes, ids and numbers are ALSO Archivo, with `font-variant-numeric: tabular-nums`, exactly as in the reference. No monospace font in the UI.
5. Colour: use the reference's exact colours. The brand red `--color-accent` (#ec3013) is used for button fills (white-ish `--color-bg` text on it), bars, marks, rules, focus rings and graph highlights, exactly as in the reference. Small red TEXT (links, kickers, citation chips, 'Q1' labels) uses `--color-accent-700` (#ae1800), exactly as in the reference. Secondary text uses `--color-neutral-700`.
6. Sentence case copy. No trailing arrows on buttons. No em dashes in UI text.
7. Keep every existing `data-testid` and every ARIA label/role. Do not rename routes.
8. Respect `prefers-reduced-motion`. No `setTimeout` for animation; no `backdrop-filter`. Keep 60 fps.
9. Do NOT show provider or model names in the UI (no "AgentRouter", "DeepSeek", "GPT", "Claude", "Gemini" in visible text).
10. No invented numbers. A value shown to the user comes from an API response, or is clearly labelled "demo".

## 3. What you must NEVER touch
- Anything under `vitagraph/backend/` (code, tests, data, .env).
- `site design/src/api/*` signatures and `site design/src/hooks/useAgentStream.ts` / `useJobStream.ts` behaviour (cleanup pattern: always clear timers and close streams/abort controllers on unmount). Restyling the components that use them is fine.
- Test files, `tasks/prd.json`, `skills/`, `legacy/`, everything under `design/` and `docs/`.
- Do not delete files unless the task says so by name. Do not run `git push`, `git reset --hard`, `git checkout -- .` on files you did not edit, or `git clean`.

## 3b. Branch guard (mandatory, every task, before anything else)
All work happens on ONE branch: `redesign/modernist-app`. You must never work on, commit to, merge into, rebase onto, or push `main` or any other branch.
- First command of every task: `git branch --show-current`.
  - Task 01 only: if the branch does not exist, create it from the current `main` with `git switch -c redesign/modernist-app`. If it already exists, `git switch redesign/modernist-app`.
  - Every later task: the output MUST be `redesign/modernist-app`. If it is anything else, run `git switch redesign/modernist-app`. If that fails (for example because of conflicting local changes), STOP and report BLOCKED. Do not stash, reset, or force.
- Last command of every task: `git branch --show-current` and `git log --oneline -3`, pasted in the report, proving the commit landed on `redesign/modernist-app`.
- Forbidden git commands: `git push` (any form), `git merge`, `git rebase`, `git reset --hard`, `git clean`, `git checkout main`, `git switch main`, `git branch -D`, `git commit --amend` on commits from earlier tasks, `--force` anywhere, `--no-verify`.
- The reviewer, not you, decides when the branch is merged or pushed.

## 4. Working method (every task)
1. Read only: `gemini/RULES.md`, your task file, then the files the task names. Do not read the whole repo.
2. Make the smallest change that satisfies the acceptance list. No drive-by refactors, no renaming, no "improvements" outside the task.
3. No placeholders, no TODO comments, no `lorem`, no stub components, no commented-out code left behind.
4. Match surrounding code style (TypeScript strict, function components, Tailwind utilities + tokens).
5. Run the verify commands in the task. They must print exit code 0. Frontend build: `cd "F:\kiruthika\kiruthika final project\site design"` then `npm run build`. Backend is never touched, so you do not run pytest unless the task says so.
6. Commit only on the branch `redesign/modernist-app` (see 3b), one commit per task, message `feat(redesign): <task id> <short summary>`. Stage files by explicit path only (never `git add .` or `-A`, because untracked reference folders and zips sit in the repo). Never commit while the build is red.
7. If a build fails and you cannot fix it in 3 attempts: STOP, do not commit, restore only the files you edited with `git checkout -- <those files>`, and report BLOCKED with the exact error.
8. If something in the task is ambiguous or contradicts these rules: STOP and ask in your report. Do not guess and do not invent.

## 5. Report format (end of every task, exactly this, nothing else)
```
TASK: <id>
STATUS: COMPLETE | BLOCKED | PARTIAL
BRANCH: <output of git branch --show-current, must be redesign/modernist-app>
FILES CHANGED: <one per line, with +added/-removed line counts from git diff --stat>
COMMANDS RUN: <each verify command and its final lines of output, verbatim>
ACCEPTANCE: <each acceptance item, PASS or FAIL, with one line of evidence>
DEVIATIONS: <anything you did differently from the task, or "none">
OPEN QUESTIONS: <or "none">
```
Never claim COMPLETE without pasted fresh command output. The reviewer will diff your work and re-run the build.

## 6. Token cheat-sheet and gotchas (learned in Task 01; read before touching any component)
Use arbitrary-value utilities with CSS variables, the way the existing code does: `bg-[var(--color-bg)]`, `text-[var(--color-text)]`, `border-[var(--color-divider)]`. Do NOT use Tailwind colour names such as `bg-accent`, `text-accent`, `bg-surface`; they are not registered and must not be added.

| Need | Use |
|---|---|
| Page background (the ground) | `var(--color-bg)` |
| Card / panel / input fill | `var(--color-surface)` (grey) or `var(--color-neutral-100)` (lighter) |
| Main text | `var(--color-text)` |
| Secondary text (>= 4.5:1) | `var(--faint)` (= #605d5d) or `var(--dim)` (= #444141) |
| Strong rule between sections | `border-2 border-[var(--color-divider)]` |
| Light rule inside a table or list | `border border-[var(--line-faint)]` |
| Primary button fill (reference look) | `className="btn btn-primary"` (bright red fill, `--color-bg` text) |
| Small red text, links, kickers, citation chips | `var(--color-accent-700)` (= #ae1800) |
| Bright brand red: button fills, bars, squares, left edge of active nav, focus ring, graph highlights, range-bar markers | `var(--color-accent)` (= #ec3013) |
| Tints | `var(--color-accent-100)` (pale red fill), `var(--color-accent-200)`, `var(--color-neutral-300)` |
| Verified / success | `var(--verdigris)`; caution `var(--ochre)` fill/border, `var(--ochre-ink)` text; failure `var(--madder)` |
| Hover tint on a transparent surface | `hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)]` |
| Shadow (floating things only) | `shadow-[var(--shadow-md)]` |
| Monospace (hashes, ids, latencies) | the `.font-mono` class or `type-mono` / `type-mono-sm` |

Gotchas:
1. The classes `type-body`, `type-label`, `type-meta`, `type-mono-sm`, `type-display`, `type-title`, `type-screen-sub` also set a text colour. Inside a dark-on-light element (for example an active nav item with inverted colours) they override inherited colour. When a task needs inverted colours, do NOT use `type-*` classes on that element or its children; use plain utilities (`text-[15px] font-extrabold leading-tight`).
2. `rounded-full` is hard-coded by Tailwind and does NOT follow our radius tokens. Every `rounded-full` stays round until you remove it. In the files your task names, delete every `rounded-*` class. (A repo-wide sweep happens in a later task; do not do it early.)
3. Weight 800 in Tailwind is `font-extrabold`; 600 is `font-semibold`. Only 400/600/800 of Archivo are loaded. Never use 500 or 700 (they would be faked or fall back).
4. `viewTransitionName`, `data-boot-target`, `data-testid`, `aria-*` and `ref` attributes are wired to the motion/boot code and to tests. Keep each one exactly where it is, on an element of the same role.
5. Do not add npm packages unless the task says so.
6. Do not use `any` in TypeScript. Do not leave unused imports or variables (the build runs `tsc -b` and fails on them).
