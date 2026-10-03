# TASK 02: Modernist app shell (sidebar, header, status strip, shell frame) + Task 01 cleanup

Read `gemini/RULES.md` completely first (especially section 3b branch guard and section 6 token cheat-sheet and gotchas). Obey it. This task touches exactly these 5 files and no others:

1. `site design/src/index.css`        (Part A only: small cleanup)
2. `site design/src/components/shell/AppShell.tsx`
3. `site design/src/components/shell/Sidebar.tsx`
4. `site design/src/components/shell/Header.tsx`
5. `site design/src/components/shell/StatusStrip.tsx`

Do not edit any page, any `components/gallery/*` file, any hook, or any `motion/*` file.

All commands run from the project root unless stated: `F:\kiruthika\kiruthika final project`. The frontend is in `site design` (quote the path, it has a space).

---

## STEP 0: Branch guard
```
git branch --show-current
```
Must print `redesign/modernist-app`. If not: `git switch redesign/modernist-app`. If that fails, STOP and report BLOCKED. Then run `git log --oneline -3` and confirm the newest commit is `chore: group root docs ...`. Then confirm the build starts green:
```
cd "F:\kiruthika\kiruthika final project\site design"
npm run build
```
(must exit 0 before you change anything; if not, STOP and report BLOCKED.)

---

## PART A: cleanup of Task 01 in `site design/src/index.css`

### A1. Delete the circular Tailwind bridges
Task 01 added lines to the `@theme { ... }` block that point a variable at itself (for example `--color-surface: var(--color-surface);`). A variable that refers to itself is invalid CSS and is a trap. DELETE all of these lines from `@theme`:
- `--color-accent: var(--accent);`
- `--color-accent-ink: var(--accent-ink);`
- `--color-surface: var(--color-surface);`
- `--color-divider: var(--color-divider);`
- every `--color-neutral-100` to `--color-neutral-900` line (9 lines)
- every `--color-accent-100` to `--color-accent-900` line (9 lines)
Leave every OTHER line of `@theme` as it is (the `--color-ink-*`, `--color-bone`, font and radius lines). The real values live in `tokens.css` and stay there. We use them through `var(...)` arbitrary values, so Tailwind does not need to know them.

Check afterwards:
```
grep -n "var(--color-surface)\|var(--color-divider)\|var(--color-neutral-[0-9]*);\|var(--color-accent-[0-9]*);" "site design/src/index.css"
```
This must show NO line of the form `--color-xxx: var(--color-xxx);` inside `@theme`. (Other lines that use `var(--color-surface)` inside normal rules are fine.)

### A2. Replace raw colour numbers with tokens
In `index.css` find each of these and replace the colour with a token-based `color-mix`:
- `rgba(31,35,40,0.08)` (a dot-grid background) becomes `color-mix(in srgb, var(--color-text) 8%, transparent)`
- `rgba(31,35,40, 0.5)` becomes `color-mix(in srgb, var(--color-text) 50%, transparent)`; `rgba(31,35,40, 0.25)` becomes `color-mix(in srgb, var(--color-text) 25%, transparent)`
- `rgba(71,119,95, 0)` becomes `color-mix(in srgb, var(--verdigris) 0%, transparent)`; `rgba(71,119,95, 0.10)` becomes `color-mix(in srgb, var(--verdigris) 10%, transparent)`
- both `rgba(176,82,94, 0.7)` become `color-mix(in srgb, var(--madder) 70%, transparent)`
Change nothing else in those rules (names, durations, keyframe structure stay).
After: `grep -n "rgba(" "site design/src/index.css"` must print nothing.

---

## PART B: the shell

Measurements come from the Modernist spec. Remember: no `rounded-*` classes, no `shadow` on flat elements, no `type-*` classes on elements that change colour, Archivo only (inherit; never set a font-family inline).

### B1. `Sidebar.tsx`

**Keep exactly as is:** the `useEffect` that positions the FLIP indicator, the `isFirstRender` ref, `navRef`, `indicatorRef`, the `Link` props (`viewTransition`, `onClick`, `data-active`, `data-boot-target="nav-item"`, `title`, `aria-label`, `aria-current`), the `data-testid="sidebar-active-indicator"` element, the dev-only gallery link logic, and the imports from `../../motion`.

**Change the data:** The file defines `const navItems: NavItem[] = [...]` with 9 entries. Keep the 9 entries and their SVG icons untouched. ADD two more entries, placed in the array exactly as shown below, using these exact SVGs (same `className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"` wrapper as the others):
- Compare: id `"compare"`, path `"/compare"`, label `"Compare"`, sublabel `"Two reports side by side"`, `live: true`, icon children:
  `<circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><path d="M11 18H8a2 2 0 0 1-2-2V9" />`
- Insights: id `"insights"`, path `"/insights"`, label `"Insights"`, sublabel `"Graph analytics"`, `live: true`, icon children:
  `<path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />`

Change these labels/sublabels exactly (the others keep theirs):
- id `upload`: label `"Upload & Ingest"`, sublabel `"Add a report"`
- id `ask`: label `"Ask"`, sublabel `"Questions with evidence"`
- id `timeline`: label `"Timeline"`, sublabel `"Changes over time"`
- id `library`: label `"Library"`, sublabel `"Your reports"`
- id `settings`: label `"Settings"`, sublabel `"Ingestion, privacy"`
(`graph`, `datasets`, `ontology`, `notebooks` keep their current label and sublabel.)

**Group the items.** After the `navItems` array add:
```ts
const navGroups: { label: string; ids: string[] }[] = [
  { label: "Workspace", ids: ["upload", "library", "datasets"] },
  { label: "Analyze", ids: ["ask", "graph", "timeline", "compare", "insights"] },
  { label: "Reference", ids: ["ontology", "notebooks"] },
  { label: "System", ids: ["settings"] },
];
```
Render each group as: a group label, then that group's links (look the items up with `navItems.find((n) => n.id === id)`; skip with a `.filter(Boolean)`-style type guard if undefined; no `!` assertions).

**Replace the JSX returned by the component** with this structure (keep the existing Link/indicator props described above; only the class names and layout change):

1. `<aside aria-label="Primary navigation" className={`w-[60px] lg:w-[244px] h-screen bg-[var(--color-bg)] border-r-2 border-[var(--color-divider)] flex flex-col justify-between flex-shrink-0 select-none overflow-y-auto overflow-x-hidden ${className}`}>` (the old `chrome-dark` class and `--chrome` background are removed).
2. Brand row: a `div` with className `h-[76px] px-3 lg:px-5 flex items-center justify-center lg:justify-start border-b-2 border-[var(--color-divider)]`, containing the `<Link to="/upload" ...>` (keep its `viewTransition` and `onClick` props) with className `flex items-center gap-3`. Inside the Link, REPLACE the old 3-path leaf `<svg>` with this square (keeps the boot/view-transition hooks):
   ```tsx
   <span
     data-boot-target="sidebar-leaf"
     aria-hidden="true"
     className="block w-4 h-4 bg-[var(--color-accent)] flex-shrink-0"
     style={{
       viewTransitionName: supportsViewTransitions() && governor.getState().tier !== "T0" ? "sidebar-leaf" : "none",
     }}
   />
   ```
   and the name: `<span className="hidden lg:inline text-[20px] leading-none font-extrabold tracking-[-0.015em] text-[var(--color-text)]">VitaGraph</span>`.
   DELETE the tagline paragraph "Evidence for a healthier tomorrow" entirely.
3. `<nav ref={navRef} className="relative py-2" aria-label="Main Navigation">`. Inside, first the indicator div (keep `ref`, `data-testid`, `style={{ top: 0, height: 0, display: "none" }}`) with className `absolute left-0 w-[5px] bg-[var(--color-accent)] pointer-events-none z-10` (no `rounded-r`, no `left-2`).
4. For each group (use `React.Fragment` with `key`): 
   - desktop label: `<div className="hidden lg:block px-5 pt-5 pb-2 text-[11px] leading-none font-extrabold uppercase tracking-[0.08em] text-[var(--faint)]">{group.label}</div>`
   - rail separator (only for groups after the first): `<div className="lg:hidden mx-3 my-2 border-t border-[var(--line-faint)]" aria-hidden="true" />`
   - then the group's links.
5. Each link `className` (template literal, replace the old one entirely):
   ```
   flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-5 py-2.5 relative group transition-colors duration-[120ms] ease-out
   ```
   plus, when active: `bg-[var(--color-text)] text-[var(--color-bg)]`; when inactive: `text-[var(--color-text)] hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)]`.
   Inside the link: icon wrapper `<span className="flex-shrink-0">{item.icon}</span>` (inherits colour; remove the old conditional colour classes), then
   ```tsx
   <div className="hidden lg:block min-w-0 flex-1">
     <div className="text-[15px] leading-tight font-extrabold">{item.label}</div>
     {item.sublabel && (
       <div className={`text-[12px] leading-tight mt-0.5 font-normal truncate ${isActive ? "text-[var(--color-neutral-400)]" : "text-[var(--faint)]"}`}>{item.sublabel}</div>
     )}
   </div>
   ```
   Do NOT use `type-body` / `type-label` here (they force a colour and would make the active item unreadable).
6. Dev-only gallery link block: keep the `import.meta.env.DEV &&` condition and the `Link` props; change classes: wrapper `mt-4 pt-3 border-t-2 border-[var(--color-divider)]`; link `flex items-center justify-center lg:justify-start gap-2.5 px-2 lg:px-5 py-2 text-[var(--faint)] hover:text-[var(--color-text)] hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] transition-colors duration-[120ms]`; the "§7" span: `text-[12px] font-semibold text-[var(--faint)]`; the label span: `hidden lg:inline text-[13px]`.
7. Remove every `rounded-*` class in this file.

### B2. `Header.tsx`

Do NOT change any logic: the Ctrl/Cmd+K effect, `submitSearch`, the `allowApi` fetch effect, `isReplay`, `getHeaderConfig`, `useActiveUser`, `transitionNavigate`. Only change class names and the avatar/menu markup.

- `<header>` className: `min-h-[76px] px-4 sm:px-8 py-3 bg-[var(--color-bg)] border-b-2 border-[var(--color-divider)] flex flex-wrap items-center justify-between gap-x-6 gap-y-3 flex-shrink-0 select-none ${className}`.
- Both `<h1>` elements: className `text-[22px] leading-[28px] sm:text-[24px] sm:leading-[30px] font-extrabold tracking-[-0.015em] text-[var(--color-text)]` (remove `type-display`; keep the `style={{ viewTransitionName ... }}`).
- Both subtitle `<p>`: className `mt-1 max-w-[62ch] text-[14px] leading-[20px] text-[var(--faint)]` (remove `type-screen-sub`).
- Search wrapper keeps `data-boot-target="header-search"` and its width classes. The `<input>` className becomes:
  `w-full h-9 pl-9 pr-14 bg-[var(--color-surface)] border border-[var(--color-divider)] text-[var(--color-text)] placeholder:text-[var(--faint)] text-[14px] transition-colors duration-[120ms] hover:border-[color-mix(in_srgb,var(--color-text)_45%,transparent)] focus-visible:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-0`
- The keyboard-hint `<span>` ("Ctrl K"): className `absolute right-2.5 px-1.5 py-0.5 bg-[var(--color-bg)] border border-[var(--color-divider)] text-[var(--faint)] text-[11px] font-semibold pointer-events-none hidden sm:inline` (remove `type-mono-sm`, remove rounded).
- User chip button: className `flex items-center text-left gap-2.5 sm:pl-3 sm:border-l-2 sm:border-[var(--color-divider)] hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] transition-colors cursor-pointer`.
- Avatar `div`: className `w-8 h-8 bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center font-extrabold text-[14px]` (square; remove `rounded-full`, `w-9 h-9`).
- Name span: `text-[14px] font-extrabold leading-none text-[var(--color-text)]` (remove `type-body`). Persona-id span: `mt-1.5 text-[12px] leading-none text-[var(--faint)]` (remove `type-meta`).
- Dropdown menu container className: `absolute right-0 mt-2 w-56 bg-[var(--color-neutral-100)] border-2 border-[var(--color-divider)] shadow-[var(--shadow-md)] py-1 z-50`. Menu heading: `px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--faint)] border-b border-[var(--line-faint)]`. Menu item button: `w-full text-left px-3 py-2 text-[13px] flex items-center justify-between hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] ` + active user `text-[var(--verdigris)] font-semibold` / others `text-[var(--color-text)]`. The "active" marker span: `text-[11px] font-semibold`.
- Remove every `rounded-*` class in this file. Do not touch the `Badge`/`Breadcrumb` components (a later task handles them).

### B3. `StatusStrip.tsx`

Logic stays (probe effect, `setProbeTick`, `MotionTierChip`), with these REAL-DATA FIXES:
1. Delete the `configVersion` field from the `HealthState` interface and from both places that set it, and delete the made-up initial latency: the initial state must be `{ online: backendOnline, latencyMs: null, allowApi: true }`. (The strip must never show a number that was not measured.)
2. Delete the whole `Docs` link, `Feedback` link, the theme-toggle `<button>` and the `|` separators around them (they were dead controls). Keep the "Local mode" lock item. After deleting, the `path !== "/graph" && path !== "/ask"` block disappears; if `path` is still used elsewhere (it is, in the middle segments) keep it.
3. The text `allow_api=false (offline core)` becomes `AI explanations off`.

Markup/classes:
- `<footer>` className: `h-10 px-3 sm:px-4 bg-[var(--color-bg)] border-t-2 border-[var(--color-divider)] whitespace-nowrap overflow-hidden flex items-center justify-between type-mono-sm select-none flex-shrink-0 z-30` (remove `chrome-dark`, `h-8`, `--chrome`, `--chrome-line`).
- Replace `<LED .../>` with a 10px square and remove the now-unused `LED` import:
  ```tsx
  <span
    aria-hidden="true"
    className={`block w-[10px] h-[10px] flex-shrink-0 ${health.online ? "bg-[var(--color-text)]" : "bg-[var(--color-accent)]"}`}
  />
  ```
  The status text keeps its wording; offline colour class becomes `text-[var(--accent)] font-semibold`.
- Separator spans keep `text-[var(--line-strong)]`.

### B4. `AppShell.tsx`

Only these edits (everything else, including boot, replay, health probe, route announcer, grain element, `runBoot` call, stays):
- Backend-down banner className: replace `border-b border-[var(--madder)]` with `border-b-2 border-[var(--color-accent)]`. Keep `bg-madder-hatch`, `data-testid`, text, `animate-banner-drop`.
- `<main>` className: `flex-1 overflow-y-auto p-4 sm:p-8 relative ${routeAnimClass}`.
- Inner container: width depends on route. Replace the fixed `max-w-[1440px]` with:
  `${location.pathname === "/ask" || location.pathname === "/graph" ? "max-w-[1440px]" : "max-w-[1280px]"}` inside the className template (keep `mx-auto flex flex-col` and the existing `/ask` height logic).

---

## PART C: verify

1. Build:
```
cd "F:\kiruthika\kiruthika final project\site design"
npm run build
```
Must exit 0 with no TypeScript errors (unused imports fail the build: remove them).

2. Grep checks (from project root; paste the outputs):
```
grep -n "rounded" "site design/src/components/shell/Sidebar.tsx" "site design/src/components/shell/Header.tsx" "site design/src/components/shell/StatusStrip.tsx"
grep -n "Spectral\|IBM Plex\|chrome-dark\|configVersion\|Docs\|Feedback\|Toggle paper theme" "site design/src/components/shell/"*.tsx
grep -n "rgba(" "site design/src/index.css"
```
All three must print nothing (comments excepted; if a comment matches, say so).

3. Browser check: `npm run dev`, open the URL it prints. For each of `/upload`, `/library`, `/ask`, `/settings`, at viewport 1440x900, and `/upload` at 390x844 and 820x1000, take a screenshot into `gemini/shots/task02-<route>-<width>.png`. Confirm and report:
   - The sidebar has the red square + "VitaGraph", group labels in small caps, the active item is a black block with a red bar on its left edge and light text.
   - At 390 width the sidebar is a 60px icon rail, no horizontal scroll.
   - Status strip is 40px, shows a small black square when online or red square when offline, and shows no "Docs"/"Feedback"/sun icon.
   - No text is clipped or unreadable.
4. Paste the output of this snippet (run in the browser console or via your browser tool) on `/upload` at 1440 width. It lists any shell element that still has rounded corners:
```js
[...document.querySelectorAll("aside *, header *, footer *")].filter(e => parseFloat(getComputedStyle(e).borderTopLeftRadius) > 0).map(e => e.tagName + "." + String(e.className).slice(0, 60))
```
Expected: an empty array, except icons' internal SVG shapes may appear; list them if so. If you cannot run a browser, say "NO BROWSER" in the report and still do steps 1 and 2.

## COMMIT
Stage ONLY: `site design/src/index.css`, `site design/src/components/shell/AppShell.tsx`, `site design/src/components/shell/Sidebar.tsx`, `site design/src/components/shell/Header.tsx`, `site design/src/components/shell/StatusStrip.tsx`, and `gemini/shots/task02-*.png`.
Message: `feat(redesign): T02 Modernist shell, grouped nav, honest status strip`.
Then run `git show --stat HEAD` and `git branch --show-current` and `git log --oneline -3` for the report.

## ACCEPTANCE (report each PASS or FAIL with one line of evidence)
- B1 Sidebar: 11 nav entries in 4 groups (Workspace 3, Analyze 5, Reference 2, System 1), width 244px at >=1024 and 60px below, 76px brand row, red square, tagline gone, testids and boot targets preserved.
- B2 Header: 76px min height, 2px bottom rule, square avatar, no rounded classes, logic untouched (`git diff` shows only className/markup lines changed, except nothing in the effects).
- B3 StatusStrip: 40px, square indicator, no invented numbers, no dead links or theme toggle, `LED` import removed.
- B4 AppShell: 2px banner rule, `p-8`, 1280 max width except `/ask` and `/graph`.
- A `@theme` has no self-referencing line; `index.css` has no `rgba(`.
- `npm run build` exit 0.
- Only the files listed under COMMIT are in the commit.
- Branch is `redesign/modernist-app`.
