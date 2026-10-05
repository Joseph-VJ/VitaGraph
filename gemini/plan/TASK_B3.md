<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task B3 — Graph model and WebGL check (shared by the 3D and 2D views)

- **Goal:** Add one pure module that chooses the nodes, lays them out in 3D and 2D, and gives colours. Add one small WebGL check. Both views use them.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `site design/src/components/gallery/GraphStage.tsx` lines 745–777 (anchor `const filtering = !showFragments && fragments > 0 && meaningful >= 5;`)
  - `site design/src/components/gallery/graphLayout.ts`
  - `site design/src/components/gallery/graphTheme.ts`
  - `site design/src/api/graph.ts`
  - `site design/src/theme/tokens.css`
- **Files to create or modify:**
  - create `site design/src/components/graph3d/graphModel.ts`
  - create `site design/src/components/graph3d/webgl.ts`

**What to change**
1. **Create `graphModel.ts`.** Pure functions only: no React, no three.js imports, no DOM access except in `readTokenColours`. It exports:
   - **`selectNodes(graph, { showFragments, cap })`:**
     - Implements exactly the selection rule of `GraphStage` (lines 745–777): fragments are the types in `FRAGMENT_TYPES`. They are left out only when `showFragments` is false and at least 5 other nodes remain.
     - Sort by `betweenness`, highest first, then slice to `cap`.
     - Returns:
       - `nodes`;
       - `edges`, keeping only edges whose two ends are both kept, as index pairs plus `relation`;
       - `poolSize`;
       - `fragmentCount`;
       - `hiddenFragments` (boolean).
   - **`NODE_CAP` = 120** and **`NODE_CAP_WITH_FRAGMENTS` = 400** (performance rule 4).
   - **`layout3d(nodes, edges)`:** returns a `Float32Array` of x, y and z for each node. It is deterministic: the same input always gives the same output.
     1. Seed each node from `hashString(node.id)`.
     2. Place communities on anchors spread over a sphere of radius 60 with a golden-angle spiral, and start each node near its community anchor.
     3. Run at most 300 iterations of a simple force step in 3D: edge springs, node repulsion within the community, and a weak pull to the anchor. Use plain arrays, with no allocation inside the loop.
     4. Recentre the result on the origin.
   - **`layout2d(nodes, edges, width, height)`:** returns x and y using the existing helpers `seedForce` and `settle` from `graphLayout.ts`, so the 2D view looks like today's.
   - **`nodeStyle(node)`:**
     - Returns a size class from the node type: report and person largest, test medium, measurement small, fragments smallest.
     - Returns a colour role: `accent` for the selected or active state, `text` for reports, `neutral` for structural types (`STRUCTURAL_TYPES`), `uncertain` for type `uncertainty`, and otherwise the community colour from `communityColor`.
   - **`readTokenColours()`:** reads `--color-text`, `--color-accent`, `--color-neutral-400`, `--color-neutral-600`, `--color-divider`, `--ochre` and `--color-bg` from `getComputedStyle(document.documentElement)`, so the 3D view uses the same tokens as the page. No hex is written in the component code.
2. **Create `webgl.ts`.** It exports `hasWebGL2()`:
   - Create an off-screen canvas and request a `webgl2` context, catching errors.
   - Release the context through `WEBGL_lose_context` when present.
   - Cache the result for the session.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0, with the new files unused for now.
2. `npm run audit:design` exits 0.

**Acceptance criteria**
- [ ] `selectNodes` keeps the exact selection rule of `GraphStage`: the same IDs for the same input. B10 compares the 2D and 3D node counts with today's `graph-cap-note` text.
- [ ] `layout3d` is deterministic and allocates nothing inside its iteration loop.
- [ ] No hex colour appears in either file.
- [ ] The build exits 0.
