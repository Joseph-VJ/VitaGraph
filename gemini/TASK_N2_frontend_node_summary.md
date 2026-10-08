# SESSION N2 (frontend): the AI summary box in the Knowledge Graph card

Two sessions work at the same time on the same feature. **You are session N2 = the FRONTEND.** Session N1 builds the backend route and never touches `site design/`. You never touch `vitagraph/backend`.

This is a college project: it must look like the preview and work without problems; do not over-engineer, keep the summary file short.

## Read first (in this order)
1. `gemini/RULES.md` and `gemini/DESIGN_LAW.md` (item 9 is this feature). The overrides below win where they differ.
2. **`design/prototypes/VitaGraph-AI-Node-Summary.md`: the full spec with the code. Sections 0, 1, 2, 3.5 (the SSE contract), 4, 5, 6.2, 7 are yours.** Copy the code of section 4.
3. **The visual target: open `design/prototypes/VitaGraph-Playground.html` in Chrome** (double-click or `file:///F:/kiruthika/kiruthika%20final%20project/design/prototypes/VitaGraph-Playground.html`), click any dot on the graph, and look at the grey **AI SUMMARY** box at the top of the card. Your box must look and behave like it (spacing, type, citation squares, sources list, quote with the marked value, the caret). The playground card is dark-stage and docked; the real card is the existing light card in the right panel: only the BOX is copied, not the card.
4. Only these code files: `site design/src/pages/KnowledgeGraphPage.tsx` (the "Selected Node Card", about lines 556 to 700), `src/api/graph.ts`, `src/api/client.ts`, `src/hooks/useAgentChat.ts` (lines 340 to 390: the SSE reader you are copying into `lib/sse.ts`), `src/index.css` (look at `.vg-key` and how `.vg-*` classes are written), `src/theme/modernist.css` (`btn`, `btn-ghost`).

## Overrides of RULES.md for this round (owner decision, important)
1. **DO NOT COMMIT.** `KnowledgeGraphPage.tsx` and `index.css` already hold the owner's earlier uncommitted work, and a commit would sweep it in. Leave your changes uncommitted, stage nothing. Never `git add`, `commit`, `stash`, `checkout --`, `reset`, `clean`, `push`, `merge`, `rebase`. **Branch for this round: `feature/ai-node-summary`** (this overrides RULES.md 3b, which names `redesign/modernist-app`). First command: `git branch --show-current` must print `feature/ai-node-summary`; if it does not, run `git switch feature/ai-node-summary` (the uncommitted files come along); if that fails, STOP and report BLOCKED. Never switch to `main` or `redesign/modernist-app`. Last command of your work: `git branch --show-current` again, pasted in your summary. Never touch `site design/tsconfig.tsbuildinfo`.
2. **The backend route does not exist yet when you start** (session N1 is building it). You test with a MOCKED route in Playwright (Part 4). Do not change the backend, do not add a mock server to the repo. The real end-to-end check is done by the reviewer after both sessions finish.
3. Ports: you use **5173** (frontend) and **8000** (backend, read-only use: loading the graph). **Both are already running** when you start (check with `curl http://127.0.0.1:8000/api/health` and `curl -I http://localhost:5173/`); reuse them, do NOT start a second copy and do NOT stop them. If one is down, start it WITHOUT `--reload` (`cd vitagraph\backend; .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`, or `cd "site design"; npm run dev -- --port 5173`) and leave it running. Session N1 uses 8001: never touch it. The test persona `usr_51f14542d71a` has 20 reports and a 435-node graph (the page caps what it draws; that is fine).
4. Allowed to change exactly these files and no others: NEW `site design/src/lib/sse.ts`, NEW `site design/src/hooks/useNodeSummary.ts`, NEW `site design/src/components/graph/NodeSummary.tsx`, `site design/src/api/graph.ts` (ADD only; keep `getGraph`/`getSubgraph` and every existing export unchanged), `site design/src/index.css` (APPEND only), `site design/src/pages/KnowledgeGraphPage.tsx` (the import and the ONE line that renders `<NodeSummary>`; nothing else; do not refactor, do not touch `about`, the connection count, the neighbour chips or the source slip). Do NOT refactor `useAgentChat.ts` to use `lib/sse.ts`.
5. No new npm packages. No provider or model names in any visible text. No `setTimeout` for progress or typing: the text appears only from the stream. No `any`, no unused variables, no `console.log`, no commented-out code.
6. Test personas: use `usr_51f14542d71a` (has sample reports) for reading only; for anything that writes, create a throwaway persona and delete it. Never touch "Demo Cohort (demo data)".

## Part 0: start
`git branch --show-current`, `git status --short` (note what is already modified, so you can tell yours apart), `cd "site design"; npm run build` must pass before you start (baseline), then `npm run audit:design` (baseline, expect 0 errors).

## Part 1: build it (spec section 4)
1. `lib/sse.ts` (4.2), `api/graph.ts` additions (4.3: `NodeSource`, `NodeSummaryStatus`, `NodeSummaryEvent`, `graphApi.streamNodeSummary`), `hooks/useNodeSummary.ts` (4.4), `components/graph/NodeSummary.tsx` (4.5), CSS (4.6), wiring (4.7).
2. Add `data-testid` attributes so it can be tested: `node-summary` (the section), `node-summary-wait`, `node-summary-text`, `node-summary-sources`, `node-summary-source` (each row button), `node-summary-quote`, `node-summary-again`.
3. Use ONLY tokens in the CSS (no raw hex), zero radius, Archivo, as in 4.6. If `@keyframes vg-blink` already exists in `index.css`, do not add a second copy.
4. Behaviour details that the code in the spec must satisfy (fix the code if it does not):
   - clicking another dot aborts the running request (no stale text from the old dot ever shows);
   - a half-written `**` at the end of the streaming text is hidden (no stray asterisks while it types);
   - `[n]` become small black squares with the number; the hovered one and its source row turn red together;
   - clicking `[n]` or a source row opens that passage with the exact value marked (`<mark>`), and its meta line shows page, character offsets and "OCR" when the method is `ocr`;
   - status `off` or `fallback` changes the label to "Summary from your files"; `fallback` also shows the server's `reason` line;
   - "Write again" is disabled while writing; it sends `refresh: true`;
   - reopening a dot in the same tab shows the text at once with NO network request;
   - reduced motion: no blinking caret, no pulsing label;
   - keyboard: every citation and source row is a real `button` with a visible focus ring.

## Part 2: build and audit
`cd "site design"; npm run build` exit 0; `npm run audit:design` 0 errors.

## Part 3: look (compare with the preview, 3 rounds at most)
Take a 1440x900 screenshot of the real `/graph` page with a node selected and compare the box with the preview's box side by side (padding, 3 px red left edge, label size 11 px uppercase, text 15 px / 1.55, citation squares 16 px, source rows, quote block, caret). Fix what differs. Save the screenshot as `gemini/shots/N2-graph-summary-1440.png` and a 400x860 phone one as `gemini/shots/N2-graph-summary-400.png`. At 400 px there must be no horizontal scroll.

## Part 4: behaviour tests with a MOCKED route (Playwright, system Python, Chrome)
Use `p.chromium.launch(channel="chrome")`, viewport 1440x900, `ctx.add_init_script("localStorage.setItem('vitagraph_user_id','usr_51f14542d71a')")`, `$env:PYTHONIOENCODING="utf-8"`. Intercept the new endpoint: `page.route("**/api/graph/node-summary", handler)` and answer with `route.fulfill(status=200, headers={"Content-Type":"text/event-stream"}, body=<frames>)`. A frame is exactly `event: <type>\ndata: <json>\n\n` where the JSON is `{"event_type": "<type>", "metadata": {...}}`. The server's wire format (spec 3.5):
```
event: status
data: {"event_type":"status","metadata":{"phase":"reading"}}

event: sources
data: {"event_type":"sources","metadata":{"sources":[{"n":1,"report_id":"r1","chunk_id":"c1","filename":"lab-2025-01-15.pdf","report_date":"2025-01-15","page_number":1,"char_start":120,"char_end":142,"text":"...Hemoglobin 13.2 g/dL Ref. 13 - 17 g/dL...","hit_start":13,"hit_end":22,"method":"native","quality":"good"},{"n":2,"...":"a second source with \"method\":\"ocr\""}],"passages":2,"files":2}}

event: text_delta
data: {"event_type":"text_delta","metadata":{"delta":"Hemoglobin carries oxygen. It went from **13.2 to 14.1 g/dL** [1][2]."}}

event: completed
data: {"event_type":"completed","metadata":{"status":"ai","text":"Hemoglobin carries oxygen. It went from **13.2 to 14.1 g/dL** [1][2].","reason":null}}
```
(`hit_start`/`hit_end` must really index the value inside `text`; write the mock so they do.) The browser receives the body at once in this test, so the typing animation is NOT visible here; that is fine, the reviewer checks streaming live.
Cases to run and report (PASS/FAIL each, one line of evidence):
1. Click a dot on `/graph` (pause rotation first; click a grid of points until the card with `[data-testid=graph-connections]` appears): `node-summary` appears as the first block under the node's title; text shows; two citation squares; the Sources header says "2 passages in 2 files".
2. Hover citation 1: source row 1 gets the red look; hover leaves: it goes back.
3. Click citation 2: its quote opens with a `<mark>` containing the value, and the meta line shows "chars" and "OCR".
4. Click "Write again": the request body has `"refresh": true` (check `route.request.post_data_json`).
5. Click the same dot again after clicking another: no new request for the first dot (count handler calls).
6. `completed` with `"status":"fallback"` and a `reason`: label reads "Summary from your files" and the reason line shows. `"status":"off"`: label reads "Summary from your files", no reason line.
7. Respond 404 `{"detail":"This dot is not in your graph any more."}`: the box shows that text, no crash, the rest of the card still renders.
8. Respond with a `completed` whose text has a half-written `**`: no asterisk is visible.
9. Switch dots quickly: no text of the first dot appears in the second dot's box.
10. Console: zero errors and zero warnings from our code in all runs. `Tab` reaches a citation and a source row and shows a focus ring (screenshot or computed outline).

## Acceptance (all must be true for COMPLETE)
- [ ] Only the files of override 4 changed (`git status --short` compared with your Part 0 note; paste the difference).
- [ ] `npm run build` exit 0; `npm run audit:design` 0 errors.
- [ ] The box matches the preview (screenshots saved; list any difference you still see).
- [ ] Part 4 cases 1 to 10 PASS.
- [ ] No provider/model names, no fake timers, no raw hex, no radius, no `any`.
- [ ] Nothing committed or staged; the servers on 5173 and 8000 are left running as you found them.

## When you finish
Write ONE short file `gemini/reports/N2_summary.md` (do not commit it): per part what you did, build and audit outputs, the 10 test results, every deviation from the spec (and why), anything that still differs from the preview, and the files you changed. Then reply in the RULES.md section 5 report format. If something fails 3 times, stop that part, say so, and continue with the next.
