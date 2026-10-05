<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task A7 — Insights: shared states and section heads, phone grid, "Uncertain" label

- **Goal:** Move Insights onto the shared frame, states and section heads. Fix the 340 px column minimum that overflows a phone, and show uncertainty nodes as "Uncertain".
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `site design/src/pages/InsightsPage.tsx`
  - `site design/src/components/ui/index.ts`
- **Files to create or modify:**
  - modify `site design/src/pages/InsightsPage.tsx`

**What to change**
1. **Imports:** `site design/src/pages/InsightsPage.tsx` line 5 (anchor `import { transitionNavigate } from "../motion/navigation";`). After this import, add an import of `PageFrame`, `PageState`, `PersonaState` and `SectionHead` from `../components/ui`.
2. **Uncertainty label:** `site design/src/pages/InsightsPage.tsx` lines 7–10 (anchor `uncertainty: "Uncertainty"`). Change the display name for the `uncertainty` node type to "Uncertain" (rule 4).
3. **Unused style:** `site design/src/pages/InsightsPage.tsx` lines 13–15 (anchor `const headStyle`). Delete `headStyle`, which is unused after step 6.
4. **Persona context:** `site design/src/pages/InsightsPage.tsx` line 19 (anchor `const { user } = useActiveUser();`). Also read `loading` (as `personaLoading`) and `refreshUsers`.
5. **States:** `site design/src/pages/InsightsPage.tsx` lines 64–85 (anchor `const pageStyle`).
   - Delete `pageStyle` and `noteStyle`, then replace the early returns with four states, each in `PageFrame` with label "Insights":
     - **No persona:** `PersonaState`.
     - **Loading:** `PageState` loading, "Loading the graph".
     - **Error:** `PageState` error, "Could not load the graph", the error as detail, and "Try again", which increments `tick`.
     - **Empty graph:** `PageState` empty, "No graph yet", detail "Upload a report and a graph is built for this persona.", and the action "Upload a report" using the existing `transitionNavigate` call.
6. **Body:** `site design/src/pages/InsightsPage.tsx` lines 87–131 (anchor `gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))"`).
   - The root becomes `PageFrame` with label "Insights".
   - Inside it, the grid is a plain `div` with `gridTemplateColumns: "repeat(auto-fit,minmax(min(340px,100%),1fr))"`, gap `var(--space-8)` and items aligned to the start.
   - Each of the three columns becomes a `section` whose heading is `SectionHead`, with the titles "Graph size", "Betweenness centrality" and "Edge types".
   - The edge-type rows also get `gap: "var(--space-3)"`, so long pair names never touch their counts.
   - Everything else (the rows, numbers and bars) stays exactly as it is.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser on `/insights` with "Empty Test Persona": three sections with the same counts as before the change. At 360 × 740 the sections stack into one column, with no page-level horizontal scroll.

**Acceptance criteria**
- [ ] The display name for `uncertainty` is "Uncertain".
- [ ] The column minimum is `min(340px,100%)`.
- [ ] The three section heads use `SectionHead`.
- [ ] The build exits 0.
