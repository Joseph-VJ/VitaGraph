# Session P1 Summary: Knowledge Graph Modernist Stage

## 1. Overview
Session P1 implemented the complete Modernist 3D Knowledge Graph stage and docked node dossier on branch `feature/playground-graph-and-backgrounds`, matching `design/prototypes/VitaGraph-Playground.html` and the circled docked card in `ai box.png`. The stage is fully wired to real backend endpoints (`/api/graph/{user_id}`, `/api/reports?user_id=...`, `/api/graph/{user_id}/series`) with real user reports, centralities, biomarker trends, and live AI summaries with cited sources.

## 2. Parts Implemented

### Part 0 & 1: Graph Stage Engine (`GraphStageEngine.ts` and `GraphStage.tsx`)
- Pure TypeScript canvas engine (`GraphStageEngine`) managing 3D projection, camera rotation, picking, hover tooltips, and rendering loop via `requestAnimationFrame`.
- Supports 3D floor grid, curved quadratic bezier edges, data flow animated particles, node importance sizing (betweenness centrality), floor drop-lines, breathing idle motion, cluster outlines, and lens magnifier (L key).
- Selection with 1-hop and 2-hop emphasis and animated ripple shockwaves.
- React wrapper (`GraphStage.tsx`) managing engine lifecycle, imperative handles, top-left node/link counters, search input with datalist auto-complete and Enter selection, top-right action buttons (Replay intro, Pause/Rotate, Lens, Paper/Ink toggle), bottom-center layout switcher, and message bars.

### Part 2: Opening Sequence (`startIntro`)
- Opening count-up sequence reading real entity counts (reports, biomarkers, values, links).
- Red shockwaves expanding outward from subject node.
- Graph translates rightwards while titles are visible, then centers smoothly.
- Dedicated "Replay intro" button.

### Part 3: Four Morphing 3D Layouts (`Sphere`, `Orbits`, `Timeline`, `Columns`)
- **Sphere**: Force-directed spherical distribution with importance clustering.
- **Orbits**: Concentric orbital rings dynamically sized by real entity types.
- **Timeline**: 3D spatial table with biomarker rows and chronological report columns. Date ticks thin out automatically so they never overlap.
- **Columns**: Grouped columns by node entity type.
- Camera smoothly transitions angles and spins/stops according to layout specification.

### Part 4: Interactive Controls
- **Lens**: Circular magnifier following pointer and expanding clustered node labels (toggleable via button or L key).
- **Pause / Rotate**: Toggles automatic 3D orbital camera rotation.
- **Paper stage / Ink stage**: Toggles between light ground and dark ink stage.
- **Search box**: Datalist auto-complete of real biomarker, section, and report names; instant navigation on selection or Enter.
- **Save as image**: Generates high-resolution PNG snapshot modal with download button.

### Part 5: Docked Node Card (`NodeDossier.tsx` matching `ai box.png`)
- Docked at right edge of stage (16px from edge, 60px from top, 340px wide; responsive bottom sheet on mobile screens <= 600px).
- Styled with 1px border and 3px brand red top rule (`--color-accent`).
- Red elbow leader line rendered dynamically on the canvas from the selected node dot to the docked card's edge, adjusting camera view so the node is never obscured by the card.
- Internal hierarchy:
  1. Small caps kind label ("BIOMARKER", "REPORT", "SECTION", "SUBJECT", "MEASUREMENT", "UNCERTAINTY") + "Close" button.
  2. Entity title in 1.25rem/800 Archivo.
  3. Real `<NodeSummary userId={userId} nodeId={node.id} autoScroll={false} />` streaming live AI summaries with cited file sources.
  4. For biomarkers: big latest numeric value with unit and report date, delta change since first reading, flag words, SVG trend sparkline with printed-range shaded band and labelled values.
  5. Sibling biomarker rows for sections.
  6. Neighbor chips (up to 8 chips, clicking selects neighbor).
  7. Connection count text preserving `data-testid="graph-connections"`.

### Part 6: Right Panel Options (`KnowledgeGraphPage.tsx`)
- **Subgraph**: Community cluster list from backend graph topology, driving engine `focusIds` dimming.
- **Modes**: Toggles for Data flow, Lens, What changed, Ghosts in the time machine.
- **Time machine**: Play/Pause button, Show all button, chronological range slider `0..(reports-1)*100`, and thinned date labels.
- **Find a connection**: Two dropdowns, BFS path finding, animated path highlighting with moving comet, and path summary in message bar.
- **Agent link and filters**: "Show what the last answer cited" evidence button reading `vitagraph:last_answer` with numbered red badges; kind filter chips (Reports, Sections, Biomarkers, Values, Uncertain); "Save as image".
- **Fine-tune**: Collapsible `<details className="fine">` with six toggles (Size by importance, Gentle idle motion, Floor drop-lines, Hover preview, Fly to node, Cluster outlines).
- **Legend**: Architectural symbol markers for Subject, Report, Section, Biomarker, Value, Uncertain.

### Part 7 & 8: Responsive & Accessibility
- Mobile layout (400px): Stage (74vh) sits on top, panel stacks below, layout buttons span full width, card docks as bottom sheet (`scrollWidth <= innerWidth` verified: 400px <= 400px, 0 overflow).
- Reduced motion: Respects `usePreferences().reduceMotion` and OS setting (disables intro animation, instantaneous morphs, stops idle breathing).

## 3. Series Endpoint Status
- Backend `/api/graph/{user_id}/series` currently returns HTTP 404 (in progress by P2).
- The typed fallback fixture in `site design/src/api/graph.ts` activates transparently in DEV when 404 is received, parsing real report dates and measurements from the user's graph so full trend charts and time machine operate with real data.

## 4. Verification Outputs
- `npm run build`: Exited code 0 (`tsc -b && vite build` built in 947ms).
- `npm run audit:design`: 0 errors across 66 checked files.
- Real Playwright browser test on Chrome (`usr_51f14542d71a` with 20 reports, 435 nodes, 120 rendered):
  - 5-second FPS measurement: **55 fps** (target was >= 40 fps).
  - Docked card visible: True, leader line drawn to dot.
  - Connections text: `'Connected to 2 nodes. Its lines are red; the fainter ones go one step further.'`
  - Evidence button: Disabled initially ("No answer to show yet. Ask the AI Agent first."); enabled after sessionStorage injection.
  - Mobile 400x860: `scrollWidth = 400, innerWidth = 400`, bottom sheet rendered.
  - Text-to-Graph (`/text-to-graph`): Untouched and operational (title: 'VitaGraph').
  - Console: 0 errors and 0 warnings from our code (only the expected 404 fetch fallback on series endpoint).

## 5. Artifact Screenshots Saved
- `gemini/shots/P1-sphere.png`: Sphere layout overview with real nodes.
- `gemini/shots/P1-selected-card.png`: Docked biomarker card with elbow leader line, AI summary box, and sparkline.
- `gemini/shots/P1-timeline.png`: 3D spatial timeline layout with thinned date columns.
- `gemini/shots/P1-heat.png`: "What changed" heat mode with caption bar and highlighted nodes.
- `gemini/shots/P1-phone-stage.png`: Mobile stage view at 400x860.
- `gemini/shots/P1-phone-dossier.png`: Mobile bottom sheet docked card.
- `gemini/shots/P1-phone-panel.png`: Mobile stacked options panel.

## 6. Files Changed
- `site design/src/components/graph/stage/GraphStageEngine.ts` (new)
- `site design/src/components/graph/stage/GraphStage.tsx` (new)
- `site design/src/components/graph/stage/NodeDossier.tsx` (new)
- `site design/src/components/graph/stage/graphStage.css` (new)
- `site design/src/pages/KnowledgeGraphPage.tsx` (rewired to stage)
- `site design/src/api/graph.ts` (added series endpoint types and fallback fixture)
- `site design/src/components/graph/NodeSummary.tsx` (added optional `autoScroll?: boolean` prop)
