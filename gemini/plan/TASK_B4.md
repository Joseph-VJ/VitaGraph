<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task B4 — Inspector: DocumentPanel shows real provenance in the Modernist design

- **Goal:** Rebuild the node inspector so that every node type shows facts from the API: chunk text, report details, a measurement's source passage, and "Uncertain" for uncertainty nodes. It uses the shared components.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** A2, B1
- **Files to read first:**
  - `site design/src/components/gallery/DocumentPanel.tsx`
  - `site design/src/api/reports.ts`
  - `vitagraph/backend/app/graph/builder.py` lines 84–254 (anchor `g.add_node(`)
- **Files to create or modify:**
  - modify `site design/src/components/gallery/DocumentPanel.tsx`

**What to change**
1. **Rewrite the component** (all of `site design/src/components/gallery/DocumentPanel.tsx`, from lines 8–15, anchor `interface DocumentPanelProps`).
   - **Props:** all optional, so the development gallery keeps compiling.
     - `selectedNode`;
     - `graph`, the whole `GraphResponse`, needed to find neighbours;
     - `reports`, the persona's report list;
     - `onClose`;
     - `className`.
   - The `morphing` prop and the view-transition name are removed, together with the morph chip in B8.
   - A new optional prop, `userId`, is the active persona's ID. Without it the panel shows the node's own fields and loads nothing.
2. **Layout:** a `section` with `aria-label="Node details"`, background `--color-surface` and a 2 px top rule in `--color-text`.
   - **Header row:** `data-testid="document-panel-header"`. It holds the node label as an `h2` and a `btn btn-ghost` "Close" button with `data-testid="document-panel-close"`.
   - **Kicker:** the node type's display name, using the same names as Insights (task A7), with "Uncertain" for `uncertainty`.
   - **Body by node type:**
     - **No node:** "Select a node to see where it comes from."
     - **report:** the filename, the printed date ("Undated" when missing) and the page count, all from the matching entry of `reports`, matched by the report ID in the node's ID or label. A button "Open in library" goes to `/library`.
     - **chunk and uncertainty:** call `reportsApi.chunk(userId, node.report_id, node.chunk_id)` and show:
       - "Page <page_number>, characters <start>–<end>";
       - the passage, pre-wrapped;
       - for `uncertainty`, a `Tag` "Uncertain" (tone uncertain) and the sentence "No value could be read from this passage, so it is kept as uncertain."
       
       While the request runs, show `PageState` loading "Loading the passage". On failure, show `PageState` error "The passage could not be loaded" with the error.
     - **measurement:** the value, the unit, the flag as a `Tag` (hot for LOW or HIGH, neutral otherwise) and the date. Then find the source:
       1. Find the connected test node through the `HAS_MEASUREMENT` edge.
       2. Find the reports whose printed `report_date` equals the node's `date`.
       3. Call `reportsApi.measurements` for each, and keep the rows with the same test name ignoring case, the same value and the same unit.
       4. With exactly one match, show its report name, page and character span. Without exactly one match, show "The source passage could not be matched exactly." Never guess between two matches.
     - **test:** the test name, its category, and the number of measurement nodes linked to it.
     - **Any other type:** the label and its number of connections.
   - **Cancellation:** every request is cancelled with a flag when the node changes or the panel unmounts.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0. The gallery and the current graph page still compile, because every prop is optional.
2. Checked in the browser after B8.

**Acceptance criteria**
- [ ] Keep these test IDs: `document-panel-header`, `document-panel-close`.
- [ ] Chunk and uncertainty nodes show the stored passage from `GET /api/reports/{report_id}/chunks/{chunk_id}`.
- [ ] A measurement with zero or two matching rows says that it could not be matched; it never picks one.
- [ ] No old tokens, rounding or hex remain in the file.
- [ ] The build exits 0.
