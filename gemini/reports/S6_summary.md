# S6 summary: Text to Graph from any text

| Part | Status | Commit |
|---|---|---|
| 1 Extraction (`components/graph/textGraph.ts`) | done | d9dc0eb |
| 2 Page wiring (`TextToGraphPage.tsx`) | done | 92575f5 |
| 3 Checks (`scripts/plan/check_text_graph.mjs`, `check_text_graph_browser.py`) | done, nothing needed fixing | bab7f27 |

## Check results
- Free-text sample: 15 nodes, 24 edges, 10 entities (Dr. Meera x2, Apollo Hospital x2, Arjun, Chennai, 12 March 2026, April, fatigue, headache, Metformin, diet), connected.
- Lab sample: Hemoglobin 13.8 g/dL, Fasting Glucose 96 mg/dL, TSH 2.4 uIU/mL (TSH now kept) plus date 12 March 2026: 11 nodes, 10 edges, connected.
- Story with no medical words: 18 nodes, 43 edges (keywords + Marlow), connected.
- "12 45 78": 1 node (Document), no crash. Empty text: calm empty state with "Type or paste some text first.". Two words: 2 nodes, connected.
- 20 000 characters: 22 nodes, about 10 ms (limit 1 s). Node count never above 60 (max 1 + 10 + 40). Every graph connected.
- Browser run at 1440x900: no console errors. (`ERR_CONNECTION_REFUSED` lines come from the backend being off and are filtered; the page itself needs no backend.)
- `npm run build` exit 0, `npm run audit:design` 0 errors, pytest 222 passed (backend untouched), secret scan PASS.
- Screenshots: `gemini/shots/S6-free-text-1440.png`, `gemini/shots/S6-story-1440.png` (rotating 3D graph, labels readable via the Knowledge Graph's label pruning).

## Still weak
- Stories are mostly keywords; frequent verbs ("climbed", "lived") can show up as keywords.
- Layout is the spec'd ring-and-cluster, not a force layout; the 5-6 sentence nodes sit close to the Document in the story case.
- The `/text-to-graph` route is used (the repo's real route), not `/tools/graph` from CLAUDE.md.
- No visual reference exists for this page's new legend rows; layout (canvas, 340 px panel) is unchanged.
