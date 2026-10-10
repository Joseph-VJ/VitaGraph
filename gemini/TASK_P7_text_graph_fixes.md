# TASK P7: Text to Graph fixes from the P6b review (small, one session)

Branch `feature/playground-graph-and-backgrounds`. **Do NOT commit, push, stash or reset.** No sub-agents. Never touch `vitagraph/backend/.env` or `site design/tsconfig.tsbuildinfo`. Never print the API key. Frontend 5173 and backend 8000 are running; reuse them.

Files you own: `site design/src/components/graph/textStageData.ts`, `site design/src/pages/TextToGraphPage.tsx`, `site design/src/components/graph/stage/GraphStage.tsx` (only the two text tweaks in P7.2), `site design/src/components/graph/GraphCanvas.tsx` (delete, see P7.4), `site design/src/components/graph/graphData.ts` and `textGraph.ts` (only to re-point type imports). Nothing else.

## P7.1 The hub node must connect the graph (real defect)
Reproduced (my own live run, Demo Cohort, text "Mrs. Rao visited City Clinic on 4 March 2025 ... The clinic is in Pune."): after "Build with AI" the stage reads "13 nodes . 11 links", the hub node "Rao Clinic Visit Headaches" has degree 0 (`window.__graphStage.edges` contains no edge with the hub), and selecting it says "Connected to 0 nodes". It floats alone. The P6b task required: "A hub node keeps the graph connected exactly like the old `aiGraph.ts` did ... every node ends up connected." (Read `git show HEAD:"site design/src/components/graph/aiGraph.ts"` for the old rule.)
- Fix in `textStageData.ts` / the page: after each `appendData` batch (and at the end of the stream), link the hub to ONE representative node of every connected component of the entity graph (the node with the highest degree in that component; ties: the earliest). Hub edges carry no label and are drawn like the others. Recompute incrementally while streaming (a node that later gets a relation to another component merges components: do not add duplicate hub edges for components that are already reachable; keep it simple and correct rather than minimal, a full recompute per flush on <= 50 nodes is fine). The pattern graph (`textGraph.ts`) already connects everything, so do not change it.
- Counts must be honest: the status line and the final banner say "N entities, M relations" using ONLY real entities and the relations the model stated (the numbers equal the backend `completed` event: `nodes`, `edges`). The stage's own counter ("13 nodes . 12 links") may include the hub and its structural links. Update the sentence in the card for the hub: "The text as a whole. It links the separate groups of this text so the graph stays in one piece."
- Verify with the same paragraph and with the built-in "Example: lab report" and "Example: free text" texts: for each, after the stream completes, every node has degree >= 1 (print the `isolated` list = empty), the hub card says "Connected to N nodes" with N >= 1, and the number of hub edges equals the number of components. Also prove a text that yields two unrelated components (for example two sentences about different people) gets two hub edges.

## P7.2 Two wording problems on the Text to Graph stage
- The stage search box says "Find a test, section or report" (Knowledge Graph wording). On Text to Graph it must say "Find an entity". Add an optional prop (for example `searchPlaceholder`) to `GraphStage.tsx`; the Knowledge Graph keeps its text.
- The counter prints "1 nodes . 0 links". Use proper singular/plural for nodes and links on BOTH pages ("1 node . 0 links", "1 node . 1 link"); the Knowledge Graph counter text must stay otherwise identical.

## P7.3 Stop and failure messages
- After "Stop" the page shows nothing (status line empty). Show "Stopped. 3 nodes kept." (real count, singular/plural) in the same bar style as the other messages, and clear it the next time a build starts.
- Keep the existing messages for error and refusal. Re-verify: stream error after 2 nodes keeps them and shows the reason; HTTP 409 shows the pattern graph with the message.

## P7.4 Remove the dead canvas component
After P6b, `components/graph/GraphCanvas.tsx` (707 lines) is no longer rendered anywhere; two files only import its TYPES (`GNode`, `GEdge`; `NodeKind` comes from `layout3d.ts`, which stays because `graphData.ts` uses `layout3D`).
- Move the `GNode` and `GEdge` types (and anything else imported from it) into `graphData.ts` (or a new `graphTypes.ts`), update the imports in `graphData.ts`, `textGraph.ts`, `TextToGraphPage.tsx` and anything else `grep` finds, then delete `GraphCanvas.tsx`. Check `grep -rn "GraphCanvas" "site design/src"` afterwards: only comments or nothing. If CSS classes were used only by that component, leave them (do not hunt CSS).
- `npm run build` exit 0 proves nothing broke; also open `/text-to-graph` and `/graph` once.

## Verify
1. `npm run build` exit 0, `npm run audit:design` 0 errors, `python scripts/plan/secret_scan.py` PASS. Backend untouched; no need to run pytest.
2. Playwright (`channel="chrome"`, `canvas:visible`, `window.__graphStage` is available in dev): the hub degree check on three texts (P7.1), the placeholder text, "1 node" wording on both pages (build a one-entity text), the Stop message, the error/409 cases (use `page.route` to fake the stream), `/graph` regression (120 nodes on the Demo Cohort, Timeline button present).
3. Screenshot `gemini/shots/P7-ai-connected.png` (the paragraph after the AI build with the hub selected, showing its lines) and look at it yourself.
4. Write `gemini/reports/P7_summary.md` (short).
