<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task E4 — Text to Graph page

- **Goal:** Find biomarker values in pasted text with client-side pattern matching, show them in a table and as a graph with the B renderers, and offer Download JSON.
- **Tier:** Could
- **Size:** M
- **Review:** light
- **Depends on:** E3, B5, B6
- **Files to read first:**
  - `design/reference/screens/09_Text_to_Graph.png`
  - `design/reference/app-v3-source.html` lines 1275–1286 (anchor `const text = this.state.t2gText, re =`)
  - `site design/src/components/graph3d/graphModel.ts`
  - `site design/src/components/graph3d/Graph3D.tsx`
  - `site design/src/components/graph3d/Graph2D.tsx`
- **Files to create or modify:**
  - create `site design/src/lib/textToGraph.ts`
  - create `site design/src/pages/tools/TextToGraphPage.tsx`
  - modify `site design/src/lib/toolHandoff.ts`
  - modify `site design/src/pages/tools/PdfToTextPage.tsx`
  - modify `site design/src/App.tsx`
  - modify `site design/src/components/shell/Sidebar.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`
  - modify `site design/src/components/shell/Header.tsx`

**What to change**
1. **Create `lib/textToGraph.ts`.** It exports `extractEntities(text)` and `toGraph(result)`.
   - **Value pattern:** port the reference's pattern exactly (`design/reference/app-v3-source.html` line 1275, anchor `re = /([A-Za-z][A-Za-z0-9 ()\-]{1,34}?)`): a name, an optional `:` or `=`, a number, and one of the reference's units.
   - **Date pattern:** port the reference's date pattern (line 1276, anchor `const dm = text.match(`).
   - **Skipped names:** the reference skips names starting with report, date, reference, ref or range (line 1277).
   - **Each row:** `name`, `value` (the text exactly as written), `unit`, and the exact character span `start` and `end` in the input.
   - **`toGraph`:** builds `GraphNode`-shaped objects:
     - one `person` node labelled "Document";
     - an optional `date` node;
     - per row, one `test` node and one `measurement` node;
     - edges Document–test and test–measurement, as the reference does.
     
     It returns a `GraphResponse`-shaped object, so `selectNodes`, `Graph3D` and `Graph2D` render it unchanged.
2. **Create `pages/tools/TextToGraphPage.tsx`**, exporting `TextToGraphPage`, inside `PageFrame` with label "Text to Graph".
   - **Input:**
     - a `textarea` (class `input`, at least 190 px high), and a `ToolInput` that reads a `.txt` or `.md` file into it;
     - "Use text from PDF to Text", shown only when a text hand-off is waiting.
       - Add `setHandoffText(text, name)` and `takeHandoffText()` to `toolHandoff.ts`, working like the image pair.
       - Add a button "Send text to Text to Graph" (`data-testid="pdf-send-to-graph"`) to the PDF to Text summary row. It hands over all page texts joined with blank lines and navigates to `/tools/text-to-graph`.
     - There is no invented sample.
   - **Extraction:** runs 300 ms after the last keystroke.
   - **Summary:** "<n> biomarkers · <date> · <nodes> nodes, <edges> edges", or "No values found. The pattern looks for a name, a number and a unit such as mg/dL." when there are none.
   - **Note:** the line "Found by pattern matching, not by reading the meaning. Check each row against the text."
   - **Table:** Biomarker, Value, Unit and Characters (start–end). Clicking a row selects its nodes in the graph.
   - **Graph:**
     - the same view switch and fallback rules as `/graph` (B8), using `Graph3D` (lazy) and `Graph2D`;
     - the inspector shows the selected node's label and its character span, from `DocumentPanel` without `userId`.
   - **Download JSON:** `vitagraph-text-graph.json`, holding the date, the rows with their spans, the nodes and the edges.
3. **Route and navigation:** as in E2, add:
   - the route `/tools/text-to-graph`;
   - the sidebar item `{ id: "t2g", label: "Text to Graph", sublabel: "Entities and links" }`, using the graph icon;
   - the title "Text to Graph" in `ROUTE_TITLES`, and the path in `OWN_LAYOUT`;
   - the header subtitle "Turn report text into a small graph."

**How to verify**
1. `cd "site design"; npm run build; npm run audit:design`. Both must exit 0.
2. Browser: paste the text of `synthetic_panel_2025-01-15.pdf` from PDF to Text.
   - For each row, the text at its character span in the textarea equals the row's name, value and unit. Spot-check three rows in the console with `textarea.value.slice(start, end)`.
   - Download JSON and confirm the counts match the summary.

**Acceptance criteria**
- [ ] No sample data is invented. Every row is found in the input at its stated span.
- [ ] The graph uses the B renderers with the 2D fallback.
- [ ] Download JSON works.
- [ ] The build and the audit exit 0.
