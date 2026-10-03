# TASK 01: Modernist foundation (tokens, font, base type, branch)

Read `gemini/RULES.md` first and obey it fully. This task changes ONLY the global look foundation. No page or component files are edited in this task. If every legacy token is remapped correctly, all existing screens re-theme automatically; that is the point.

## Why
Existing components use semantic tokens (`--ink-900`, `--ink-800`, `--bone`, `--dim`, `--accent`, `--line-strong`, `--r-*`, etc.) defined in `site design/src/theme/tokens.css` and bridged to Tailwind in `site design/src/index.css` (`@theme`). If we keep the token NAMES and change their VALUES to Modernist values, nothing else needs touching yet.

## Steps

### 1. Branch (see RULES.md 3b)
```
cd "F:\kiruthika\kiruthika final project"
git branch --show-current
git switch -c redesign/modernist-app
git branch --show-current
```
The last command must print `redesign/modernist-app`. If the branch already exists, use `git switch redesign/modernist-app` instead. Do not do any work before this is confirmed.
Untracked reference files may show in `git status`; ignore them and never `git add` them. Only `git add` the files you edited, by path.

### 2. Install the font
```
cd "F:\kiruthika\kiruthika final project\site design"
npm install @fontsource/archivo
```
Import weights 400, 600, 800 (latin subset) at the top of `src/main.tsx` (e.g. `import "@fontsource/archivo/latin-400.css";` and the same for 600 and 800). Check the package's actual file names under `node_modules/@fontsource/archivo/` and use those.

In `site design/index.html`: remove the Google Fonts `<link>` and the "DESIGN.md Appendix A" comment. Replace the `<body>` class so it uses no raw hex: `class="antialiased min-h-screen"`. Replace the favicon with an inline SVG of a 16px red square (`#ec3013`) centered in a 24x24 box with a `#f3f2f2` inner square 8px, as a data URI (the Modernist brand mark: red square). Change `<title>` to `VitaGraph`.

### 3. Rewrite `src/theme/tokens.css`
Keep the file's structure and keep **every existing variable name** that is currently defined (so nothing breaks), but change the values, and add the new Modernist tokens. Values:

New canonical tokens (add at the top of `:root`):
```
--color-bg:#f3f2f2; --color-surface:#eae9e9; --color-text:#201e1d; --color-accent:#ec3013;
--color-divider: color-mix(in srgb,#201e1d 40%,transparent);
--color-neutral-100:#f8f4f4; --color-neutral-200:#eae7e7; --color-neutral-300:#d7d3d3; --color-neutral-400:#bab6b6;
--color-neutral-500:#9b9797; --color-neutral-600:#7d7979; --color-neutral-700:#605d5d; --color-neutral-800:#444141; --color-neutral-900:#2d2b2b;
--color-accent-100:#fff2ef; --color-accent-200:#ffe0d9; --color-accent-300:#ffc4b8; --color-accent-400:#ff9783; --color-accent-500:#ff563c;
--color-accent-600:#dd2b0f; --color-accent-700:#ae1800; --color-accent-800:#7c1405; --color-accent-900:#4d170e;
--font-body:"Archivo",system-ui,sans-serif; --font-heading:"Archivo",system-ui,sans-serif; --font-heading-weight:800;
--font-data: ui-monospace,"Cascadia Mono",Consolas,monospace;
--space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px; --space-8:32px;
--radius-sm:0; --radius-md:0; --radius-lg:0;
--shadow-sm:0 1px 2px color-mix(in srgb,#2d2b2b 14%,transparent);
--shadow-md:0 3px 10px color-mix(in srgb,#2d2b2b 16%,transparent);
--shadow-lg:0 12px 32px color-mix(in srgb,#2d2b2b 22%,transparent);
--accent-ink:#ae1800;
```
Legacy names, remapped (these are the ones existing components read):
```
--ink-900: var(--color-bg);        /* canvas */
--ink-800: var(--color-neutral-100);/* reading surface: cards, inputs */
--ink-700: var(--color-surface);   /* well */
--ink-600: var(--color-neutral-300);/* stronger well */
--line-strong: var(--color-divider);
--line-faint: color-mix(in srgb,#201e1d 18%,transparent);
--line-control: #7d7979;           /* 3:1 on bg */
--bone: var(--color-text);
--dim: var(--color-neutral-800);   /* must be >=4.5:1 */
--faint: var(--color-neutral-700);
--accent: var(--accent-ink);       /* PRIMARY ACTION fill + link/active text: the text-safe red */
--accent-hover: var(--color-accent-800);
--on-accent: var(--color-bg);
--focus: var(--color-accent);      /* focus ring uses the bright red */
--link: var(--accent-ink);
--verdigris: #3B6A53; --ochre: #C58A43; --ochre-ink: #7F5416; --madder: var(--accent-ink);
--cornflower: var(--color-neutral-700); --lilac: var(--color-neutral-700);
--paper: var(--color-neutral-100); --paper-ink: var(--color-text); --paper-fold: var(--color-neutral-300);
--text-main: var(--color-text); --text-muted: var(--color-neutral-800); --text-on-primary: var(--color-bg);
--chrome: var(--color-surface); --chrome-line: var(--color-divider);
--titanium-mist: var(--color-bg); --alloy-surface: var(--color-surface); --steel-fog: var(--color-neutral-300);
--deep-petrol: var(--accent-ink); --jade-slate: #3B6A53; --solar-bronze: #C58A43;
--r-4:0; --r-6:0; --r-10:0; --r-14:0; --r-pill:0;
--shadow-3d: none; --shadow-3d-sm: none; --shadow-float: var(--shadow-lg); --shadow-floating: var(--shadow-lg);
```
Keep the motion tokens (`--m-*`, `--ease-*`, `--t-*`) and the `@media (prefers-reduced-motion)` block exactly as they are. Keep `.graph-dark` untouched if it exists in another file; do not edit it.

Remove the `[data-theme="paper"]` block (dead; nothing sets `data-theme`).

`.chrome-dark`: Modernist has no dark chrome. Keep the class name (components use it) but make it a no-op re-skin: set `color-scheme: light` and re-declare nothing else, i.e. it must inherit the light tokens. Replace its body with that single line and a one-line comment.

### 4. Update `src/index.css`
- In `@theme`: set `--font-serif`, `--font-sans` AND `--font-mono` to resolve to Archivo / the data stack: `--font-serif: var(--font-heading); --font-sans: var(--font-body); --font-mono: var(--font-data);` (Tailwind's `font-serif` utilities then render Archivo everywhere; this is intentional and removes Spectral without editing components.)
- In `@theme`: set `--radius-chip`, `--radius-input`, `--radius-card`, `--radius-frame`, `--radius-full` all to `0px`. Also add `--color-accent: var(--accent)` ONLY if it is not already defined and does not break the build; add the new `--color-accent-ink`, `--color-surface`, `--color-divider`, `--color-neutral-100..900`, `--color-accent-100..900` bridges so Tailwind classes like `bg-surface`, `border-divider`, `text-accent-ink` exist. Do not add a bridge that collides with an existing one.
- Replace every hard-coded `"Spectral", Georgia, serif` and `"IBM Plex Sans", ...` and `"IBM Plex Mono", ...` font-family in `index.css` with `var(--font-heading)`, `var(--font-body)`, `var(--font-data)` respectively.
- In the `.type-*` classes: headings (`type-display`, `type-title`, `type-card-title`) get `font-weight: 800` and `letter-spacing: -0.015em`; `type-display` 28px/34px, `type-title` 20px/28px, `type-card-title` 17px/24px. Body classes stay 14px/22px, weight 400; `type-label` weight 600. Add `text-align: left` nowhere (default is fine).
- Global base: `body` font-family `var(--font-body)`, font-size 15px, line-height 1.55. Add `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }`, `::selection { background: var(--color-accent-200); color: var(--color-text); }`, `button:disabled, [aria-disabled="true"] { opacity: .45; }`.
- Remove the body gradient and any `backdrop-filter`/`backdrop-blur` and `border-radius` declarations you find in `index.css` (set radius to 0). Remove the `.grain-overlay` rule's visual effect by setting `display: none` on it (keep the class; `AppShell` still renders the element).
- Do not delete any class that a component might use. Search with grep before removing any selector.

### 5. Sweep for hex literals in the two entry files only
`grep -n "#[0-9A-Fa-f]\{3,6\}" src/index.css index.html src/main.tsx` : any remaining hex in `index.css` outside token-like contexts must become a token. (Hex inside `tokens.css` is allowed.) Do not sweep component files; that is a later task.

### 6. Verify
```
cd "F:\kiruthika\kiruthika final project\site design"
npm run build
```
Must exit 0. Then run `npm run dev`, open `http://localhost:5173/upload`, `/ask`, `/library`, `/settings`, `/graph` in a browser and confirm: font is Archivo, corners are square, accent is red, nothing is unreadable (white text on white etc.). Take one screenshot per route into `gemini/shots/task01-<route>.png`. The graph page may look wrong (it is dark-scoped and gets its own task); just say so in the report. If any text is unreadable on another route, list the file and element in OPEN QUESTIONS; do not fix component files in this task.

### 7. Commit
`git add` only: `site design/package.json`, `site design/package-lock.json`, `site design/index.html`, `site design/src/main.tsx`, `site design/src/theme/tokens.css`, `site design/src/index.css`, `gemini/shots/*`. Commit message: `feat(redesign): T01 Modernist tokens, Archivo, square base` .

## Acceptance (report each PASS/FAIL)
- A1 Branch is `redesign/modernist-app`, `main` untouched.
- A2 `@fontsource/archivo` in `package.json`; no `fonts.googleapis.com` anywhere in `index.html` or `src`.
- A3 Every variable name that existed in the old `tokens.css` still exists (list with `git diff` that no `--name:` line was deleted except the `[data-theme="paper"]` block).
- A4 `grep -rn "border-radius" src/index.css src/theme/tokens.css` shows only `0` values or none.
- A5 No `Spectral` or `IBM Plex` string remains in `index.css`, `tokens.css`, `index.html`.
- A6 `npm run build` exit 0 (paste last lines).
- A7 Five screenshots exist; report states Archivo renders and corners are square.
- A8 Only the files listed in step 7 are in the commit (`git show --stat HEAD`).
