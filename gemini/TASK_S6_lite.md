# SESSION (one only), round 4: Text to Graph must turn ANY text into a 3D graph

College project: keep it light and fast. Read `gemini/DESIGN_LAW.md` first. Folder `F:\kiruthika\kiruthika final project`, branch `redesign/modernist-app` (last commit after S5). One session only; the worktree folder is retired. Ports 5173 only (this page needs no backend; the AI gateway is blocked, so **no AI call**, everything is built in the browser). Run `cd "site design"; npm run dev -- --port 5173`; stop leftovers first.

## The problem (confirmed by the reviewer)
`site design/src/pages/TextToGraphPage.tsx` (function `buildGraphFromText`) only understands lab lines "Name value unit". Result today:
- A normal paragraph ("Arjun visited Dr. Meera at Apollo Hospital in Chennai on 12 March 2026. He complained of fatigue and headache. Dr. Meera prescribed Metformin and advised a diet change. Apollo Hospital will follow up in April.") gives **2 nodes, 1 edge** (only the Document and the date).
- Lab text "Hemoglobin 13.8 g/dL / Fasting Glucose 96 mg/dL / TSH 2.4 uIU/mL" gives 2 biomarkers: **TSH is lost** because the unit list lacks `uIU/mL`.
The owner wants: **type or paste any text, press Build graph, and get a 3D graph of its things with connections**, drawn by the same 3D canvas as the Knowledge Graph (rotating, drag, zoom, click a node, Replay build, Pause rotation). Keep the page layout exactly as it is (left canvas, right 340 px text panel, legend); only the extraction, the node kinds, the table and the legend change.

## PART 1: extraction (commit `plan(S6a): text to graph extraction`)
Create `site design/src/components/graph/textGraph.ts` (pure functions, no React, no network) with `export function extractGraph(text: string): { nodes: T2GNode-like[]; edges: [string,string][]; entities: Entity[]; date: string | null }`, and move `buildGraphFromText`'s logic to call it. Rules:
1. **Sentences:** split on `.`, `!`, `?` and new lines (keep abbreviations like `Dr.`, `Mr.`, `Mrs.`, `St.`, `e.g.` from splitting). Give each sentence its character start and end.
2. **Entities** found per sentence (deduplicate case-insensitively across the whole text, count mentions, remember the first character span):
   - **Values:** number plus unit, with an extended unit list: `g/dL, mg/dL, ng/mL, pg/mL, ng/dL, ug/dL, µg/dL, mmol/L, mEq/L, IU/L, U/L, uIU/mL, µIU/mL, mIU/L, /µL, /uL, fL, pg, %, mmHg, bpm, kg, cm, mg, g, mcg, ml, mL, °C, °F`. A value attaches to the nearest preceding name in its sentence (lab style "Hemoglobin 13.8 g/dL" and "BP 120/80 mmHg" must work). Kind `meas`, label "13.8 g/dL".
   - **Dates:** `12 March 2026`, `March 2026`, `2026-03-12`, `12/03/2026`, plus month-only words ("April") when no year. Kind `report` (ring). The first full date is the page's `date`.
   - **Names / places / organisations:** runs of capitalised words that are not at the start of a sentence only because of position (a single capitalised first word counts only if it appears capitalised again elsewhere or is in the lexicon), with `Dr.`/`Mr.`/`Mrs.`/`Ms.` kept as part of the name. Kind `bio` (filled circle).
   - **Medical terms:** a small built-in lexicon (at least 80 words: common biomarkers like hemoglobin, glucose, cholesterol, TSH, creatinine, vitamin D / B12; conditions like diabetes, hypertension, anemia, asthma, fever, infection; symptoms like fatigue, headache, cough, pain, nausea, dizziness; drugs like metformin, paracetamol, insulin, aspirin, atorvastatin, amoxicillin, omeprazole; and words like diet, exercise, surgery, scan, x-ray, MRI, ECG, biopsy). Kind `bio`. Matching is case-insensitive on whole words; display the original spelling of the first mention.
   - **Keywords:** if fewer than 8 entities were found overall, add the most frequent non-stop-word words (length at least 4, not in a built-in stop-word list of about 120 English words), up to 12 in total. This guarantees ANY text (a story, an email, an essay) gives a graph.
   - Cap: at most 40 entities (keep the most mentioned, then earliest), at most 60 nodes in total.
3. **Nodes and edges:**
   - one Document node (`k:"person"`, label "Document") as the centre;
   - one **sentence group node** (`k:"section"`, diamond) per sentence that contains at least two entities, labelled with its first 4 words plus an ellipsis (keep at most 10 sentence nodes; drop the ones with fewest entities first); Document → sentence;
   - entity nodes connect to every sentence node they appear in; entities not in a kept sentence connect to the Document;
   - **co-occurrence edges:** two entities in the same sentence are joined by an edge (at most 3 such edges per entity, strongest first); `value` nodes join their name entity (lab style) instead of the Document;
   - the graph must be **one connected component** (no orphan node: connect leftovers to the Document).
4. **Positions** (`pos`, unit-ish coordinates as the canvas expects): Document at the origin; sentence nodes on a ring (radius ~0.45) spread by angle and a little height; entities placed near the average position of their sentences (+ small deterministic offsets), values slightly outside their name entity; use the existing Fibonacci-sphere spread for ones with no sentence. Check `components/graph/layout3d.ts` and reuse what fits. Result must look like the Knowledge Graph (spread in 3D, no heap on one point). Deterministic: same text, same graph.
5. **Node card text** (`about`): for entities "Mentioned N time(s), first at characters a–b: “…snippet…”"; for sentences the whole sentence (cut at 160 chars); for values "Name = 13.8 g/dL".
Make the lab case keep working: the three lab lines above must give three biomarkers with values (Hemoglobin, Fasting Glucose, TSH) and a date.

## PART 2: page wiring (commit `plan(S6b): text to graph page uses the new extraction`)
In `TextToGraphPage.tsx`:
- Use `extractGraph`. Empty or whitespace-only text: show the calm empty state, no crash; the message under the textarea says "Type or paste some text first."
- Right panel table: replace the biomarker table by **Entities** with columns Name, Kind (Value / Date / Name / Term / Keyword), Mentions; show the first 12 and "+ N more" if there are more. Summary line: "N entities · M sentences · date · X nodes, Y edges".
- Legend (keep the 2x2 grid style, add rows as needed): Document (filled square), Sentence (diamond), Name or term (filled circle), Date (ring), Value (small dot). Selected-node kind names follow it. The empty-state sentence becomes "Paste or type any text on the right and click Build graph."
- Placeholder of the textarea: "Paste or type any text, such as a report, a note or an email".
- **Download JSON** keeps working (nodes, edges, entities).
- Keep the page free of raw hex colours, the `npm run audit:design` must stay at 0 errors.
- Put **two example buttons** under the Build graph row, small secondary buttons "Example: lab report" and "Example: free text", which fill the textarea with the two samples above (lab sample with a date line) and build at once.

## PART 3: check (commit `plan(S6c): text to graph checks` only if you fix something)
Write `scripts/plan/check_text_graph.mjs` or a Playwright script (system python, `channel="chrome"`, 1440x900) that, for each of these texts, builds the graph and prints nodes, edges and whether the graph is connected (read it from the exported JSON via the Download JSON data or an exposed debug value, your choice, nothing hidden in production UI): the two samples; a three-paragraph English story with no medical words; a text with only numbers ("12 45 78"); a very long text (20 000 characters); an empty text; a text of two words. Requirements: no console error; at least 6 nodes for the story and the free-text sample; the numbers-only text does not crash (a Document node plus whatever is sensible); 20 000 characters build in under 1 s; node count never above 60; every graph connected. Screenshots at 1440x900 of the free-text sample and the story: `gemini/shots/S6-free-text-1440.png`, `gemini/shots/S6-story-1440.png` (they must show a rotating 3D graph with labelled nodes and visible connections, labels not piled up; use the same readable-label behaviour the Knowledge Graph has). Also run `npm run build` and `npm run audit:design`.

## When you finish
ONE short file `gemini/reports/S6_summary.md` (per part: done, commit hash, results of the checks above, anything still weak), commit it. Rules: never `git push`, merge, rebase, reset --hard, clean or amend; never print or commit `.env` or a key; stage by explicit path (never `git add .`, never `site design/tsconfig.tsbuildinfo`); commit after every part; a part that fails 3 times is skipped and reported. Stop your servers at the end. Do not touch the backend.
