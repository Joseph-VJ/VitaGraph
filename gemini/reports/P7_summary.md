# P7 summary: Text to Graph fixes from the P6b review

Branch `feature/playground-graph-and-backgrounds`. Nothing committed, staged, pushed or reset. Backend untouched.

## Gates
- `npm run build`: exit 0 (re-run after the last edit).
- `npm run audit:design`: 71 files, 0 errors.
- `python scripts/plan/secret_scan.py`: RESULT: PASS.

## P7.1 Hub connects the graph (fixed)

**Cause:** the streamed build created the hub with no links and never linked it to anything. The old `aiGraph.ts` linked the hub to the first node of each separate piece.

**Fix:**
- `textStageData.ts`: `componentRepresentatives(nodes, edges)` returns, for each connected group of entities, the node with the most links in that group (ties: the earlier node). `hubEdges(reps)` makes one unlabelled link per representative. `buildStageFromAi` uses the same rule. The pattern graph and `ensureConnected` are unchanged.
- `TextToGraphPage.tsx`: `flushBatch` keeps the real entities and relations in refs. On every flush it recomputes the representatives. If an old hub link is now stale (a merge), it calls `setData` with the full graph. Otherwise it `appendData`s the new items and the new hub links. This also runs at completion and on error.
- Banner and status use only real counts: "N entities, M relations". The stage counter may include the hub.

**Live check** (Playwright on installed Chrome, Demo Cohort, 1440x900; numbers from the final run):

| Text | Entities / relations | Components | Hub links | Isolated | Hub card |
|---|---|---|---|---|---|
| Paragraph ("Mrs. Rao visited City Clinic ...") | 9 / 8 | 1 | 1 | none | Connected to 1 node |
| Example: lab report | 7 / 3 | 4 | 4 | none | Connected to 4 nodes |
| Example: free text | 10 / 9 | 1 | 1 | none | Connected to 1 node |
| Two unrelated people (Arjun/Dr. Meera, Ravi/Dr. Lakshmi) | 9 / 7 | 2 | 2 | none | Connected to 2 nodes |

- In every case, the number of hub links equals the number of components, and each link goes to the highest-degree node of its group.
- The paragraph run before the final one had two components and two hub links; the model's output varies between runs, and the rule held in both.
- The banner matched the backend `completed` counts (9 entities, 8 relations).

**Not done:** the hub card's sentence is still "The text as a whole. Root hub keeping all entities and connections unified." It is in `TextNodeCard.tsx`, which is not in this task's file list. The new text is ready to paste. Tell me if I may edit that file.

## P7.2 Wording (done)
- The Text to Graph search box says "Find an entity" (new `searchPlaceholder` prop on `GraphStage`; the default is the old text, so the Knowledge Graph keeps it).
- Counter: singular and plural on both pages ("1 node · 0 links" observed on Text to Graph at 2 s; screenshot shows "10 nodes · 9 links").

## P7.3 Stop and failure messages (done)
- Stop before any entity: "Stopped. 0 nodes kept."
- Stop after nodes: "Stopped. 3 nodes kept." The count matched the stage (3 entities). The message stayed visible after the stream was closed.
- Error after two nodes (faked stream): both entities and their link stay; the message "The AI service did not answer. The pattern graph is still available." shows.
- HTTP 409 (faked): the pattern graph shows with "AI is switched off in Settings, so the graph is built from patterns only. Showing the pattern graph instead."
- **Found while checking, fixed:** in the 409 case the stage showed only the hub. Cause: when the stream stops growing, `GraphStage` skips its own data update, so the pattern fallback never reached the stage. `buildGraphFromText` now pushes the pattern graph to the stage directly. Re-checked: 9 entities, 4 components, nothing isolated.
- Errors that arrive after an abort are now ignored, so Stop's message is not overwritten. I did not reproduce the original empty Stop bar on the old build, so I cannot confirm that was the cause; the message is correct now.

## P7.4 Dead canvas removed (done)
- `GNode` and `GEdge` moved into `graphData.ts`, the only file that imported them. `textGraph.ts` never imported `GraphCanvas`, so it is unchanged.
- `GraphCanvas.tsx` deleted. `grep -rn GraphCanvas site design/src` returns nothing.
- `/text-to-graph` and `/graph` open without errors in the checks.

## /graph regression check
- Search placeholder unchanged: "Find a test, section or report". Timeline button present.
- Counter: "70 nodes · 111 links", stable over 30 s. The API returns 97 nodes and 194 edges for the Demo Cohort. I did not change how the Knowledge Graph page builds its node list, so this is not caused by these edits.
- The "120 nodes" from the task and the review does not match the data now; the page's cap of 120 is not reached. I did not force a match. Please confirm whether 70 is the expected count.

## Screenshot
`gemini/shots/P7-ai-connected.png`: the paragraph after the AI build, hub selected. The card shows "Connected to 1 node" and the red line to Mrs. Rao. The counter, placeholder and banner read as specified. The hub card's old sentence is visible (see P7.1).

## Notes and open items
- Merges re-lay out the stage with a full `setData`, which moves the nodes. This is visible only when a merge makes a hub link stale. I checked that it works; I did not judge how it looks mid-stream.
- The "Done in…" message appears in both the stage bar and under the page controls; this is unchanged from before.
- Playwright was installed only in the scratchpad, not in the project.
- Not run: a live `/graph` check at the one-node state (its singular wording is in code, not observed).
