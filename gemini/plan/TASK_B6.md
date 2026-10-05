<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task B6 — The 2D view (fallback and choice)

- **Goal:** Add a light 2D SVG view in the Modernist design with the same nodes, colours, selection and fit as the 3D view. It replaces the old canvas `GraphStage` on the graph page.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** B3
- **Files to read first:**
  - `site design/src/components/graph3d/graphModel.ts`
  - `site design/src/components/gallery/GraphStage.tsx` lines 2096–2110 (anchor `const filtering = !showFragments && fragmentCount > 0 && totalNodes - fragmentCount >= 5;`)
- **Files to create or modify:**
  - create `site design/src/components/graph3d/Graph2D.tsx`

**What to change**
1. **Create `Graph2D.tsx`**, exporting `Graph2D` with the same props as `Graph3D` (except `onContextLost`).
   - **Drawing:**
     - It renders an `svg` that fills its frame, laid out with `layout2d` for the frame's measured size.
     - Edges are one `path` element built from all segments, so there are no thousands of `line` elements.
     - Nodes are one `circle` per drawn node, at most 400 by rule 4.
     - Colours come from `nodeStyle` with CSS variables directly (`fill="var(--color-…)"`), never hex.
   - **Interaction:**
     - Pan by dragging the background, and zoom with the wheel or with + and − buttons, between 0.4× and 4×.
     - "Fit" (when `fitSignal` changes) resets the view to show every node.
     - Clicking a node calls `onSelect`, and clicking the background calls `onSelect(null)`.
     - Hover shows the node label in a small `--color-bg` box.
   - **Labels:** the same label limit as the 3D view.
   - **Motion:** no animation when reduced motion is on.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.

**Acceptance criteria**
- [ ] The 2D view uses `selectNodes` and `nodeStyle` from `graphModel.ts` (the same data as 3D).
- [ ] Edges are drawn as one path.
- [ ] No hex colours appear.
- [ ] The build exits 0.
