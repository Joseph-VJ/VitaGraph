# TASK 03: make the shell pixel-exact to the reference design (and flip the accent)

Read `gemini/RULES.md` completely first (branch guard 3b, cheat-sheet section 6). Obey it.

## THE GOAL OF THIS WHOLE REDESIGN (read twice)
The finished live app must look **exactly like the reference HTML design**, with real data from the backend instead of demo data. "Exactly" means: same layout, same sizes, same spacing, same colours, same wording, same behaviour. When the reference and your own taste disagree, the reference wins. When the reference and an older rule in `RULES.md` disagree about the look, the reference wins (this task corrects such a rule: see Part A).

The reference lives in these files (read-only, never edit them):
- **Source code of the reference:** `design/reference/app-v3-source.html`. This is the real markup with every inline style. Line map: CSS 12-354 · sidebar 360-384 · banner 387-389 · header 390-398 · Upload 402 · Library 458 · Ask 499 · Graph 592 · Timeline 640 · Compare 680 · Insights 695 · Image to Text 713 · PDF to Text 726 · Settings 739 · footer 765-771 · cinematic show 775-798 · dialog 801-809.
- **Screenshots of the reference, one per screen, 1440x900:** `design/reference/screens/00_Upload.png`, `01_Library.png`, `02_Ask.png`, `03_Knowledge_Graph.png`, `04_Timeline.png`, `05_Compare.png`, `06_Insights.png`, `07_Image_to_Text.png`, `08_PDF_to_Text.png`, `09_Text_to_Graph.png`, `10_Settings.png`. LOOK at the screenshot for every screen you touch before you write code, and compare your result with it afterwards.

Reference things that must NOT be copied into the live app (company rules): the model name button ("Gemini 1.5 Flash") and the "Model and API key" dialog; the "Reset demo" and "Simulate outage" buttons; hard-coded demo data (Arjun R, VG-2026-001, 63 chunks, 3 reports, "Built 14 nodes from text"). Wherever the reference shows demo data, the live app shows the real value from the API, or "not measured"/empty state.

## FILES THIS TASK MAY CHANGE (and nothing else)
1. `site design/src/theme/tokens.css`
2. `site design/src/index.css`
3. `site design/src/components/shell/AppShell.tsx`
4. `site design/src/components/shell/Sidebar.tsx`
5. `site design/src/components/shell/Header.tsx`
6. `site design/src/components/shell/StatusStrip.tsx`
(`site design/src/theme/modernist.css` already exists, created by the reviewer. Do not edit it.)

---

## STEP 0: branch guard and green start
```
git branch --show-current          # must be redesign/modernist-app
git log --oneline -3
cd "F:\kiruthika\kiruthika final project\site design"
npm run build                      # must exit 0 before you start
```

## PART A: tokens (`tokens.css`)
The reference uses the BRIGHT red `#ec3013` for button fills and the dark red `#ae1800` (accent-700) for small red text. Task 01 made primary buttons dark red; that was wrong. Change ONLY these legacy lines in the `:root` block (leave every other line):
```
--accent: var(--color-accent);
--accent-hover: var(--color-accent-600);
--on-accent: var(--color-bg);
--link: var(--color-accent-700);
--dim: var(--color-neutral-700);
--faint: var(--color-neutral-700);
--text-muted: var(--color-neutral-700);
```
Keep `--accent-ink: #ae1800;` and `--focus`, `--madder`. Update the comment next to `--accent` to: `/* primary action fill: the brand red, as in the reference. Red TEXT uses --accent-ink / --color-accent-700 */`.
From now on in every task: red text = `var(--color-accent-700)`; red fills (buttons, bars, marks) = `var(--color-accent)`.

## PART B: wire the component CSS (`index.css`)
Directly under the existing line `@import "./theme/tokens.css";` add a new line `@import "./theme/modernist.css";`. This gives you the reference's classes: `btn`, `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-icon`, `input`, `field`, `radio`, `seg`, `seg-opt`, `card`, `tag`, `tag-accent`, `tag-neutral`, `tag-outline`, `table`, `hr`, `dialog-backdrop`, `dialog`. From now on, use these classes exactly the way the reference markup does (for example `className="btn btn-primary"`), instead of re-inventing buttons.
Then verify there is no clash: `grep -n "^\.btn\|^\.tag\|^\.table\|^\.input\|^\.card" "site design/src/index.css"` must print nothing.

## PART C: Sidebar (`Sidebar.tsx`)
Compare with `design/reference/screens/00_Upload.png` (left column) and reference source lines 360-384.

Keep: all imports, `NavItem` interface export, the `useEffect` that positions the FLIP indicator, `isFirstRender`, `navRef`, `indicatorRef`, the `Link` props (`viewTransition`, `onClick`, `data-active`, `data-boot-target="nav-item"`, `title`, `aria-label`, `aria-current`), `data-testid="sidebar-active-indicator"`, the dev-only gallery link logic.

Replace everything from `const navItems` to the end of the file with the following. (Copy it as is; the SVG paths are the reference's.)

```tsx
  const Icon = ({ d }: { d: string }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"
      style={{ strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", flex: "none" }}>
      <path d={d} />
    </svg>
  );

  const navGroups: { label: string; items: NavItem[] }[] = [
    {
      label: "Workspace",
      items: [
        { id: "upload", path: "/upload", label: "Upload & Ingest", sublabel: "Add a report", live: true,
          icon: <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /> },
        { id: "library", path: "/library", label: "Library", sublabel: "Your reports", live: true,
          icon: <Icon d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /> },
      ],
    },
    {
      label: "Analyze",
      items: [
        { id: "ask", path: "/ask", label: "Ask", sublabel: "Questions with evidence", live: true,
          icon: <Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
        { id: "graph", path: "/graph", label: "Knowledge Graph", sublabel: "Explore connections", live: true,
          icon: <Icon d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" /> },
        { id: "timeline", path: "/timeline", label: "Timeline", sublabel: "Changes over time", live: true,
          icon: <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /> },
        { id: "compare", path: "/compare", label: "Compare", sublabel: "Two reports side by side", live: true,
          icon: <Icon d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 3v18" /> },
        { id: "insights", path: "/insights", label: "Insights", sublabel: "Graph analytics", live: true,
          icon: <Icon d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" /> },
      ],
    },
    {
      label: "System",
      items: [
        { id: "settings", path: "/settings", label: "Settings", sublabel: "Ingestion, privacy", live: true,
          icon: <Icon d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /> },
      ],
    },
  ];

  const vtOn = supportsViewTransitions() && governor.getState().tier !== "T0";

  return (
    <aside
      aria-label="Primary navigation"
      className={`w-[60px] lg:w-[244px] h-screen flex-shrink-0 flex flex-col select-none overflow-hidden ${className}`}
      style={{ borderRight: "2px solid var(--color-divider)", background: "var(--color-bg)", boxSizing: "border-box" }}
    >
      {/* Brand row: 76px high, red 16px square + name */}
      <div
        className="h-[76px] flex-shrink-0 flex items-center justify-center lg:justify-start lg:px-6"
        style={{ borderBottom: "2px solid var(--color-divider)" }}
      >
        <Link
          to="/upload"
          viewTransition={vtOn}
          onClick={() => setNavDirection(getNavDirection(currentPath, "/upload"))}
          className="flex items-center gap-2"
          style={{ fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-0.02em", color: "var(--color-text)", textDecoration: "none" }}
        >
          <span
            data-boot-target="sidebar-leaf"
            aria-hidden="true"
            style={{
              width: 16, height: 16, background: "var(--color-accent)", display: "inline-block", flex: "none",
              viewTransitionName: vtOn ? "sidebar-leaf" : "none",
            }}
          />
          <span className="hidden lg:inline">VitaGraph</span>
        </Link>
      </div>

      <nav ref={navRef} className="relative flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: "var(--space-3) 0" }} aria-label="Main Navigation">
        {/* FLIP active bar (5px, brand red) */}
        <div
          ref={indicatorRef}
          data-testid="sidebar-active-indicator"
          className="absolute left-0 pointer-events-none z-10"
          style={{ top: 0, height: 0, display: "none", width: 5, background: "var(--color-accent)" }}
        />

        {navGroups.map((group, groupIdx) => (
          <React.Fragment key={group.label}>
            <div
              className="hidden lg:block"
              style={{
                padding: "var(--space-4) var(--space-6) var(--space-2)", fontSize: "0.6875rem", fontWeight: 800,
                letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-700)",
              }}
            >
              {group.label}
            </div>
            {groupIdx > 0 && <div className="lg:hidden mx-3 my-2" style={{ borderTop: "1px solid var(--color-divider)" }} aria-hidden="true" />}
            {group.items.map((item) => {
              const isActive = currentPath === item.path;
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  viewTransition={vtOn}
                  onClick={() => setNavDirection(getNavDirection(currentPath, item.path))}
                  data-active={isActive ? "true" : "false"}
                  data-boot-target="nav-item"
                  title={item.label}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex items-center justify-center lg:justify-start gap-3 w-full px-2 lg:px-6 py-2 text-left ${isActive ? "" : "hover:bg-[var(--color-surface)]"}`}
                  style={{
                    textDecoration: "none",
                    background: isActive ? "var(--color-text)" : "transparent",
                    color: isActive ? "var(--color-bg)" : "var(--color-text)",
                  }}
                >
                  <span style={{ color: isActive ? "var(--color-bg)" : "var(--color-neutral-700)", display: "flex" }}>{item.icon}</span>
                  <span className="hidden lg:block min-w-0">
                    <span style={{ display: "block", fontSize: "0.9375rem", fontWeight: 800, lineHeight: 1.2 }}>{item.label}</span>
                    {item.sublabel && (
                      <span style={{ display: "block", fontSize: "0.75rem", color: isActive ? "var(--color-neutral-400)" : "var(--color-neutral-700)" }}>
                        {item.sublabel}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </React.Fragment>
        ))}

        {import.meta.env.DEV && (
          <Link
            to="/gallery"
            title="Component gallery"
            viewTransition={vtOn}
            onClick={() => setNavDirection(getNavDirection(currentPath, "/gallery"))}
            className="hidden lg:block hover:bg-[var(--color-surface)]"
            style={{ padding: "var(--space-2) var(--space-6)", fontSize: "0.75rem", color: "var(--color-neutral-700)", textDecoration: "none", marginTop: "var(--space-4)" }}
          >
            Component gallery (dev)
          </Link>
        )}
      </nav>

      <div
        className="hidden lg:block flex-shrink-0"
        style={{ padding: "var(--space-4) var(--space-6)", borderTop: "2px solid var(--color-divider)", fontSize: "0.6875rem", lineHeight: 1.4, color: "var(--color-neutral-700)" }}
      >
        Educational tool. Not a diagnostic service.
      </div>
    </aside>
  );
};
```
Notes: the old file exported `NavItem` and imported `React` already; keep both. Remove any import that becomes unused. `Datasets`, `Ontology`, `Notebooks` are intentionally NOT in the sidebar now (the reference has no such screens). Their routes in `App.tsx` stay as they are; do not touch `App.tsx`.

## PART D: Header (`Header.tsx`)
Compare with `design/reference/screens/00_Upload.png` (top bar) and source lines 390-398.

Keep ALL logic: the Ctrl/Cmd+K effect, `submitSearch`, the `allowApi` effect, `isReplay`, `useActiveUser`, `showUserMenu`, `transitionNavigate`, imports. Make these changes:

1. Replace the whole `getHeaderConfig` function with:
```tsx
  const getHeaderConfig = (): { title: string; sub: string } => {
    switch (path) {
      case "/upload": return { title: "Upload & Ingest", sub: "Add a report and watch it become searchable." };
      case "/library": return { title: "Library", sub: "Your reports and the values extracted from them." };
      case "/ask": return { title: "Ask", sub: "Ask about a value, a trend or a report." };
      case "/graph": return { title: "Knowledge Graph", sub: "How reports, sections and values connect." };
      case "/timeline": return { title: "Timeline", sub: "Reports and key values over time." };
      case "/compare": return { title: "Compare", sub: "Change between two reports." };
      case "/insights": return { title: "Insights", sub: "Structure and key nodes of the graph." };
      case "/settings": return { title: "Settings", sub: "Ingestion, reading, privacy and display." };
      case "/datasets": return { title: "Datasets", sub: "Manage health sources, FHIR bundles, and clinical guidelines." };
      case "/ontology": return { title: "Ontology", sub: "Medical concepts, hierarchical mappings, and relationship rules." };
      case "/notebooks": return { title: "Notebooks", sub: "Computational research scratchpads and analytic protocols." };
      default: return { title: "VitaGraph", sub: "Your reports, evidence and insights in one place." };
    }
  };
```
2. Remove the `Breadcrumb` import (breadcrumbs are gone). Keep the `Badge` import only if you still use it (replay badge); otherwise remove.
3. Replace the returned JSX with this (the `return (...)` of the component):
```tsx
  return (
    <header
      className={`flex-shrink-0 select-none ${className}`}
      style={{
        minHeight: 76, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
        gap: "var(--space-3) var(--space-6)", padding: "var(--space-3) var(--space-8)",
        borderBottom: "2px solid var(--color-divider)", boxSizing: "border-box", background: "var(--color-bg)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            margin: 0, fontSize: "1.5rem", letterSpacing: "-0.02em", fontWeight: 800, lineHeight: 1.12, color: "var(--color-text)",
            viewTransitionName: supportsViewTransitions() && governor.getState().tier !== "T0" ? "header-title" : "none",
          }}
        >
          {config.title}
        </h1>
        <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>{config.sub}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        {isReplay && (
          <span className="tag tag-outline" data-testid="replay-mode-badge">Replay mode</span>
        )}
        <form
          data-boot-target="header-search"
          style={{ margin: 0 }}
          onSubmit={(e) => { e.preventDefault(); submitSearch(); }}
        >
          <input
            ref={searchRef}
            className="input"
            value={query}
            aria-label="Ask a question about your reports"
            placeholder={SEARCH_PLACEHOLDER}
            onChange={(e) => { setQuery(e.target.value); onSearch?.(e.target.value); }}
            style={{ width: 300 }}
          />
        </form>
        {allowApi === false && (
          <span className="tag tag-outline" data-testid="allow-api-chip" title="Answers quote your reports only; the AI service is not called">
            AI explanations off
          </span>
        )}

        <div data-boot-target="header-user" className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-2)", paddingLeft: "var(--space-3)",
              borderLeft: "2px solid var(--color-divider)", background: "transparent", border: 0, cursor: "pointer",
              color: "var(--color-text)", textAlign: "left",
            }}
          >
            <span
              style={{
                width: 32, height: 32, background: "var(--color-accent)", color: "var(--color-bg)",
                display: "grid", placeItems: "center", fontWeight: 800,
              }}
            >
              {user?.display_label ? user.display_label.charAt(0).toUpperCase() : "V"}
            </span>
            <span style={{ lineHeight: 1.2 }}>
              <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 800 }}>{user?.display_label || "Connecting..."}</span>
              <span style={{ display: "block", fontSize: "0.6875rem", color: "var(--color-neutral-700)" }}>{user ? user.id : "No persona"}</span>
            </span>
          </button>

          {showUserMenu && users.length > 0 && (
            <div
              role="menu"
              className="absolute right-0 z-50"
              style={{ marginTop: "var(--space-2)", width: 224, background: "var(--color-surface)", boxShadow: "var(--shadow-lg)", padding: "var(--space-2) 0" }}
            >
              <div style={{ padding: "var(--space-1) var(--space-3)", fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-700)", borderBottom: "1px solid var(--color-divider)" }}>
                Switch persona
              </div>
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  role="menuitem"
                  onClick={() => { setUser(u); setShowUserMenu(false); }}
                  className="w-full hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)]"
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", border: 0, background: "transparent",
                    padding: "var(--space-2) var(--space-3)", fontSize: "0.8125rem", cursor: "pointer",
                    fontWeight: u.id === user?.id ? 800 : 400, color: "var(--color-text)",
                  }}
                >
                  <span className="truncate">{u.display_label}</span>
                  {u.id === user?.id && <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "var(--color-accent-700)" }}>active</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
```
4. Delete the constant `isMac` and the `⌘K` hint (the reference has no key hint). The Ctrl/Cmd+K effect stays.
5. Delete now-unused imports/variables (the build fails on unused ones).

## PART E: Status strip (`StatusStrip.tsx`)
Compare with the bottom bar of `design/reference/screens/00_Upload.png` and source lines 765-771. Real data only.

Rewrite the component so it:
- Keeps the health probe effect (every 5 s, `AbortSignal.timeout(8000)`, cleanup with `mounted` and `clearInterval`), measuring `latencyMs`. Initial state `{ online: backendOnline, latencyMs: null }`. `allowApi` is no longer needed here: delete it from the state.
- Adds counts from the real API for the active persona. Import `useActiveUser` from `../../context/UserContext` and `reportsApi` from `../../api/reports`. State `counts: { reports: number; chunks: number } | null`. An effect keyed on `user?.id` and `backendOnline`: if there is no user or the backend is offline, `setCounts(null)` and return; otherwise call `reportsApi.list(user.id)` immediately and every 15 s; set `reports = list.length` and `chunks = list.reduce((s, r) => s + (r.chunk_count ?? 0), 0)`; on error leave the previous counts. Use a `cancelled` flag and `clearInterval` in cleanup.
- Renders exactly (replace the whole returned JSX):
```tsx
  return (
    <footer
      className="flex-shrink-0 z-30 select-none"
      style={{
        height: 40, display: "flex", alignItems: "center", gap: "var(--space-6)", padding: "0 var(--space-8)",
        borderTop: "2px solid var(--color-divider)", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums",
        background: "var(--color-bg)", whiteSpace: "nowrap", overflow: "hidden",
      }}
    >
      <span data-boot-target="status-led" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontWeight: 800 }}>
        <span aria-hidden="true" style={{ width: 10, height: 10, display: "inline-block", background: health.online ? "var(--color-text)" : "var(--color-accent)" }} />
        {health.online ? "Backend online" : "Backend offline"}
      </span>
      <span data-boot-target="status-segment" className="hidden md:inline">
        ChromaDB · {counts ? counts.chunks : "–"} chunks
      </span>
      <span className="hidden md:inline">{counts ? counts.reports : "–"} reports</span>
      <span className="hidden md:inline" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", color: "var(--color-neutral-700)" }}>
        {health.latencyMs !== null ? `Latency ${health.latencyMs} ms` : "Latency not measured"}
      </span>
    </footer>
  );
```
- Delete `MotionTierChip`, `renderMiddleSegments`, `renderRightControls`, the `LED` / `useMotionGovernor` / `useNavigate` / `transitionNavigate` / `useLocation` imports and every variable that becomes unused (including `probeTick`, `path`).

## PART F: AppShell (`AppShell.tsx`)
Keep boot, replay, probe, announcer, grain element, titles map. Make these edits:
1. Replace the backend-down banner `<div ...>...</div>` (the whole `{!backendOnline && (...)}` block) with:
```tsx
        {!backendOnline && (
          <div
            data-testid="backend-down-banner"
            className="animate-banner-drop"
            style={{
              flex: "none", display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) var(--space-6)",
              backgroundColor: "var(--color-accent-100)",
              backgroundImage: "repeating-linear-gradient(45deg, color-mix(in srgb, var(--color-accent) 22%, transparent) 0 6px, transparent 6px 16px)",
              borderBottom: "2px solid var(--color-accent)", fontSize: "0.875rem",
            }}
          >
            <span style={{ background: "var(--color-accent-100)", padding: "2px 8px", color: "var(--color-accent-800)" }}>
              <b>Backend offline.</b> Answers, search and uploads are paused. The graph, library and timeline stay readable.
            </span>
          </div>
        )}
```
and remove the `LED` import if it becomes unused.
2. Replace the `<main>...</main>` block with the following. The set `OWN_LAYOUT` lists routes whose page already draws its own padding and width exactly like the reference (reference pages use `max-width:1280px; margin:0 auto; padding:32px`). It starts EMPTY; later tasks add routes to it one by one. Routes not in the set keep the old wrapper so unconverted pages do not break.
```tsx
  const ownLayout = OWN_LAYOUT.has(location.pathname);
  ...
        <main
          ref={mainRef}
          id="main-content"
          key={location.pathname}
          data-nav-dir={navDir}
          className={`flex-1 min-h-0 overflow-y-auto relative ${ownLayout ? "" : "p-4 sm:p-8"} ${routeAnimClass}`}
        >
          {ownLayout ? (
            children || <Outlet />
          ) : (
            <div className={`mx-auto flex flex-col ${location.pathname === "/ask" || location.pathname === "/graph" ? "max-w-[1440px]" : "max-w-[1280px]"} ${location.pathname === "/ask" ? "h-full" : "min-h-full"}`}>
              {children || <Outlet />}
            </div>
          )}
        </main>
```
and above the component (module level, after `ROUTE_TITLES`): `const OWN_LAYOUT = new Set<string>([]);` with the comment `// routes already converted to the exact reference layout; each page task adds its route here`.
3. Remove the old `bg-madder-hatch`-based banner classes if they are no longer referenced in this file (do NOT delete the CSS class from `index.css`).

## PART G: verify
1. `cd "F:\kiruthika\kiruthika final project\site design"` then `npm run build`. Exit 0, no TS errors.
2. Greps from project root (all must print nothing; paste outputs):
```
grep -n "rounded\|Breadcrumb\|MotionTierChip\|Docs\|Feedback\|Simulate\|Reset demo\|Gemini" "site design/src/components/shell/"*.tsx
grep -n "rgba(" "site design/src/index.css"
```
3. Browser: run `npm run dev`. Open `/upload`, `/library`, `/ask`, `/settings` at 1440x900. Save screenshots to `gemini/shots/task03-<route>.png`. Open the matching reference screenshot from `design/reference/screens/` next to yours and write down, for the sidebar, header and footer only, every visible difference (colour, size, text, spacing). Pages' CONTENT areas will still differ; ignore those.
4. Measure (paste the JSON). Run in the browser console on `/upload` at 1440x900:
```js
(() => { const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
return JSON.stringify({ aside: r("aside"), header: r("header"), footer: r("footer"), searchInput: r("header input"), avatar: r("header button span"), brandRow: r("aside > div"), font: getComputedStyle(document.querySelector("h1")).fontFamily.slice(0, 20), h1size: getComputedStyle(document.querySelector("h1")).fontSize, bodyBg: getComputedStyle(document.body).backgroundColor }); })()
```
Expected: aside w 244 · header h 76 (minimum; 76 or 77) · footer h 40 · searchInput w 300 h 36 · avatar w 32 h 32 · brandRow h 76 · h1size 24px · font starts with "Archivo" · bodyBg `rgb(243, 242, 242)`. Anything else: fix it, or list it under DEVIATIONS.

## COMMIT
Stage ONLY: the 6 files listed at the top and `gemini/shots/task03-*.png`. Message: `feat(redesign): T03 pixel-exact shell, brand-red accent, reference nav`. Then `git show --stat HEAD`, `git branch --show-current`, `git log --oneline -3`.

## ACCEPTANCE (PASS/FAIL each, with evidence)
- A Tokens: `--accent` resolves to `#ec3013` (paste `getComputedStyle(document.documentElement).getPropertyValue("--accent")` result) and primary buttons on `/upload` are bright red.
- B `modernist.css` imported; no class clash.
- C Sidebar: 3 groups (Workspace 2, Analyze 5, System 1) with exact labels/sublabels; active item is black with a 5px red left bar; no Datasets/Ontology/Notebooks links; bottom text present.
- D Header: matches measurements; no breadcrumb; no kbd hint; search shown on `/ask` too.
- E Strip: 40px; shows real `N reports` and chunk count when a persona is active (state which persona and the numbers you saw), `–` when none; no motion chip, no dead links.
- F Banner matches reference style when the backend is stopped (take one screenshot with backend off: `gemini/shots/task03-offline.png`).
- Build exit 0. Branch correct. Only the listed files in the commit.
