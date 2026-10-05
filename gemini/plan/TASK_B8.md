<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task B8 — The graph page rebuilt around the 3D view

- **Goal:** Rebuild `/graph` on the shared frame. Show the 3D view (lazy-loaded) or the 2D view with an honest reason. Keep the existing graph test IDs, use the new inspector, and highlight the last answer's evidence.
- **Tier:** Must
- **Size:** L · hard
- **Review:** gate
- **Depends on:** A2, B4, B5, B6, B7
- **Files to read first:**
  - `site design/src/pages/KnowledgeGraphPage.tsx`
  - `site design/src/components/graph3d/Graph3D.tsx`
  - `site design/src/components/graph3d/Graph2D.tsx`
  - `site design/src/components/gallery/DocumentPanel.tsx`
  - `site design/src/api/graph.ts`
- **Files to create or modify:**
  - create `site design/src/lib/lastAnswer.ts`
  - create `site design/src/components/graph3d/GraphErrorBoundary.tsx`
  - modify `site design/src/pages/KnowledgeGraphPage.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`
  - modify `site design/scripts/audit-design.mjs`

**What to change**
1. **Create `lib/lastAnswer.ts`.** It exports:
   - `saveLastAnswer({ userId, question, chunkIds })`, which writes the record with a timestamp to `sessionStorage` under `vitagraph:last_answer`;
   - `readLastAnswer(userId)`, which returns the record only when it belongs to that persona. Storage errors are caught and give null.
2. **Create `GraphErrorBoundary.tsx`.** A class component with `getDerivedStateFromError`. On error it renders its `fallback` prop and calls an `onError` prop once.
3. **Rewrite `site design/src/pages/KnowledgeGraphPage.tsx`** (all 476 lines; today's component starts at the anchor `const loadGraph = useCallback(async () => {`, lines 46–63). The new page:
   - **Data:**
     - The persona comes from `useActiveUser`, with no demo fallback.
     - The graph comes from `graphApi.getGraph(userId)`, with a retry tick, and the report list from `reportsApi.list(userId)` for the inspector.
     - When `readLastAnswer(userId)` gives chunk IDs and the URL has `?answer=1`, call `graphApi.getSubgraph(userId, chunkIds)`. Use its node IDs as the highlight set, and show the line "Highlighting the evidence of: <question>" with a "Clear" button.
   - **States:** each in `PageFrame` with label "Knowledge Graph":
     - no persona: `PersonaState`;
     - loading: "Loading the graph";
     - error: "Could not load the graph", with "Try again";
     - empty: "No graph yet", with "Upload a report".
   - **Layout:**
     - A full-height two-column layout: the graph frame and the 400 px inspector, which stacks under the graph below 1024 px.
     - The frame `div` has `data-testid="graph-frame"`, a 2 px rule, `--color-bg`, a fixed height of `min(70vh, 720px)` and 420 px on phones.
   - **Toolbar** above the frame:
     - **View switch:** `seg` buttons "3D" and "2D", stored as the session's choice and initialised from `graphView`. "Automatic" picks 3D when `hasWebGL2()`.
     - **Fragments:** a switch "Show text fragments" with `data-testid="graph-fragments-toggle"` and `aria-checked`.
     - **Fit:** `data-testid="graph-fit"`.
     - **Auto-rotate:** a switch "Auto-rotate" with `data-testid="graph-auto-rotate"` and `aria-checked`. It is on by default, and off and disabled while motion is reduced. It is shown only in 3D. The value lasts for the session only.
     - **Cap note:** `data-testid="graph-cap-note"`. It says, for example, "Showing the 120 most central of 342 nodes. 210 text fragments are hidden.", with numbers from `selectNodes`.
     - **Legend:** `data-testid="graph-legend"`, listing the colour roles in use, with "Uncertain" for uncertainty nodes.
   - **3D:** loaded with `React.lazy(() => import("../components/graph3d/Graph3D"))` inside `Suspense`, whose fallback is `PageState` loading "Loading the 3D view". The view is wrapped in `GraphErrorBoundary`, whose fallback is `Graph2D`.
   - **Fallback reason:** when 3D fails or WebGL2 is missing, switch to 2D and show one line, either "3D is not available in this browser, so the 2D view is shown." or "The 3D view stopped working, so the 2D view is shown."
   - **Keyboard path:** below the frame, a collapsed "Nodes" list (a `details` element) of the drawn nodes as buttons. Selecting one selects the node, so the inspector is reachable without a pointer.
   - **Inspector:** `DocumentPanel` with `selectedNode`, `graph`, `reports`, `userId` and `onClose`. Escape clears the selection.
   - **Removed:**
     - the old ask flow (the `AskBar`, the job `EventSource` at line 315, `ThinkingDetailsPanel` and `questionsApi`);
     - the morph chip (`node-fly-chip`);
     - the global `window.__VG_TEST_ACTIVATE_QUESTION__` hook;
     - the community hand-off through `location.state`, which no page sends (open issue O-12).
     
     Asking happens on `/agent`. A `btn btn-secondary` "Ask the AI Agent" navigates there.
4. **Own layout:** `site design/src/components/shell/AppShell.tsx` line 31 (anchor `const OWN_LAYOUT = new Set<string>(`). Add `"/graph"`.
5. **Audit:** in `site design/scripts/audit-design.mjs`, remove `pages/KnowledgeGraphPage.tsx` from the PENDING list. PENDING is now empty.

**How to verify**
1. `cd "site design"; npm run build; npm run audit:design`. Both must exit 0, with `0 pending`.
2. `Get-ChildItem "site design\dist\assets\*.js" | Sort-Object Length -Descending | Select-Object -First 5 Name,Length`. three.js is in its own chunk, not in the main `index-*.js`. Paste the list.
3. Browser as "Empty Test Persona":
   - `/graph` shows the 3D graph, and the cap note matches `GET /api/graph/usr_51f14542d71a` (its node count) and the fragment rule.
   - Click a chunk node. The inspector shows the passage from the chunk route.
   - Switch to 2D. The same nodes show and the cap note is unchanged.
4. The automatic 2D fallback is checked by B10, which runs Chrome with WebGL disabled.

**Acceptance criteria**
- [ ] Keep these test IDs: `graph-frame`, `graph-cap-note`, `graph-fragments-toggle`, `graph-legend`, `graph-fit`, `document-panel-header`, `document-panel-close`.
- [ ] No demo fallback, `console` call or old ask flow remains in the page.
- [ ] three.js is code-split out of the main bundle.
- [ ] The audit has 0 pending lines.
- [ ] The build exits 0.


---

## Code skeleton for this task (Appendix A of the plan)

Only signatures and the one tricky part. If the skeleton and the task description disagree, the task description wins; report the difference.

### A.4 Task B8 — The graph page: lazy 3D, honest fallback, evidence highlight

```tsx
const Graph3D = lazy(() => import("../components/graph3d/Graph3D"));
type FallbackReason = null | "no-webgl" | "crashed";

const wanted: "3d" | "2d" = prefs.graphView === "2d" ? "2d" : "3d";
const [view, setView] = useState<"3d" | "2d">(wanted);
const [reason, setReason] = useState<FallbackReason>(wanted === "3d" && !hasWebGL2() ? "no-webgl" : null);
const shown = reason ? "2d" : view;

{shown === "3d" ? (
  <GraphErrorBoundary fallback={<Graph2D {...common} />} onError={() => setReason("crashed")}>
    <Suspense fallback={<PageState kind="loading" title="Loading the 3D view" />}>
      <Graph3D {...common} autoRotate={autoRotate} onContextLost={() => setReason("crashed")} />
    </Suspense>
  </GraphErrorBoundary>
) : (
  <Graph2D {...common} />
)}

useEffect(() => {
  if (!userId || searchParams.get("answer") !== "1") return;
  const last = readLastAnswer(userId);
  if (!last || last.chunkIds.length === 0) return;
  let cancelled = false;
  graphApi
    .getSubgraph(userId, last.chunkIds)
    .then((sub) => { if (!cancelled) setActiveIds(new Set(sub.nodes.map((n) => n.id))); })
    .catch(() => { if (!cancelled) setActiveIds(new Set()); });
  return () => { cancelled = true; };
}, [userId, searchParams]);
```
