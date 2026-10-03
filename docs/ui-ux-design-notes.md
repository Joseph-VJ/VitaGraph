# VitaGraph UI/UX design notes

Branch: `design/ui-ux-overhaul`. Scope: visual and UX only. No backend, route, endpoint,
SSE, hook-behaviour or data-flow changes. Every `data-testid` is unchanged.

## Design read

A health-record evidence workbench for patients and researchers, in a "steel bench and
paper" language. Dials: ENERGY 1 / RHYTHM 2 / MOTION 1. Direction comes from the README's
"Instrument & Paper" paradigm and the Titanium Lagoon palette in `CLAUDE.md`.

## Decisions and the one-line reason for each

| Decision | Reason |
|---|---|
| Value encodes role: paper `#F3F6F6` (lightest) for reading surfaces, canvas `#DFE3E6` for the bench, steel chrome `#CDD4D9` for machine UI | The product has two voices (Instrument and Paper); lightness now says which one you are looking at. Cards used to be darker than the canvas, so content sank. |
| Text tokens `#28323A` / `#4A5762` / `#566470`; state hues have a text-safe variant | Secondary text measured 4.17:1 and tertiary 3.0:1 on cards, jade text 3.5:1, bronze text 2.0:1. All pairs are now at least 4.5:1 on canvas and paper. |
| Primary action is deep petrol; jade only means verified | One accent per role. Jade on every button made "verified" and "click here" look the same. |
| Spectral for titles and answers, Plex Sans 14/22 for UI, Plex Mono only for machine output (hashes, ids, latencies, JSON) | The repo rule says mono is for machine output. Mono labels and mono stat figures were everywhere. |
| Cards are flat with a hairline border; shadow only on things that float (journey rail, ask bar, menus, toasts, modals) | Elevation should mean "above the page". Shadow on every card meant nothing. |
| Sidebar collapses to a 60px icon rail below 1024px | At 390px the 240px sidebar left a 100px content column. Navigation is unchanged. |
| Active nav item is a paper tab with a petrol edge | The lightest surface is the "you are here" surface. |
| Type classes moved into the `components` layer | They sat outside Tailwind's layers and silently beat utilities such as `text-on-primary`, so primary buttons rendered dark text on petrol. |
| Sentence case everywhere, no trailing arrows on buttons, no em dashes in UI text | Repo voice rules plus antislop R-02 and R-08. Meaningful arrows stay (value before to after, relation direction). |
| Graph labels placed by importance with collision skipping; value chips only for the focused neighbourhood or when zoomed in | 275 nodes drew every label and chip on top of each other. |
| Agent activity pane is chrome, not a dark terminal; reasoning is prose, stage rows are plain text | The pane is a reading surface for what the agent did. Mono is kept for ids, latencies and JSON. |
| Journey dots have a 24px hit area | WCAG 2.5.8; they were 10px. |
| Settings switches are named `role="switch"` controls with a visible off state | They had no accessible name and the off thumb was nearly invisible. |

## Removed, and why

- The handwritten "marginalia" tagline on every page and in the sidebar. Nine different
  slogans that contradicted each other and said nothing about the page.
- Sidebar "Recent sessions / questions / personas": hardcoded demo content, not user data.
- Status strip numbers that were typed in, not measured: documents, chunks, graph nodes,
  CPU, RAM, "graph updated 2 min ago", app and service versions. Latency, online state and
  motion tier are real and stay.
- A constant "Lab report" badge and a persona id repeated on every Library row.
- The pulsing dot inside the "Load demo cohort" button (decorative loop).
- "Encrypted in transit" (not true over local HTTP) and "Max 50 MB" (the backend limit is 25 MB).
- "Parsed by PyPDF/Surya-OCR" on Timeline cards (the pipeline uses PyMuPDF and RapidOCR/Tesseract).

## Verification (measured, not claimed)

- axe-core 4.10 (WCAG 2.0/2.1/2.2 A and AA), all 11 routes, desktop, reduced motion: 0 violations.
- Keyboard: visible focus indicator on every tab stop checked (Upload, Ask, Library, Settings).
- Reduced motion: no infinite animations running on Upload, Ask, Graph, Library.
- Horizontal overflow at 390px and 768px: checked on all 11 routes.
- `npm run build` passes. Backend pytest unchanged and green.

## Open items for the product owner (not changed: they need data wiring or a content decision)

1. **Timeline shows made-up lab values.** `TimelinePage.tsx` hardcodes Hemoglobin 13.8 to 14.1
   ("+0.3 improving"), eGFR 88 to 82, HbA1c 5.9 to 6.2 and Vitamin D 32, with their reference ranges,
   for every persona. In a health product these must come from `/api/reports/{uid}/trends`.
2. **Settings makes privacy claims that are not true for this build.** It says inference is
   "strictly local" and external APIs are "disabled by academic policy", while the app calls an
   external gateway when `allow_api` is on. Bind to `/api/ai/config` or reword.
3. **Datasets and Ontology show typed-in numbers** ("1,024 vectors", "1,536 dim" where the real
   embedding size is 384, "Last verified 2 min ago", relation edge counts).
4. **Dead controls:** Docs and Feedback links point to `#`, the theme toggle changes nothing
   (`data-theme` is never set).
5. **Breadcrumbs hardcode the persona name** ("Arjun R") on Timeline, Compare and Insights.
6. **False "backend offline" flash:** the health probe times out at 2s, which a busy backend can exceed.
7. `/gallery` (component gallery) still shows spec notes with old token values.

## Knowledge graph

The graph is the product's signature view. It is rebuilt as a dark instrument viewport; each decision
below has its one-line reason (antislop R-31).

| Decision | Reason |
|---|---|
| Dark canvas inside the light app | A graph is read as light-on-dark structure; the dark frame makes it a focused viewport and lets luminous edges and orbs carry depth. The rest of the app stays light. |
| Colour = community, size = centrality | Modularity (13 communities in the demo data) is the story of this graph; type is shown in the node card and groups list instead of colour. The legend says so in one line. |
| Cluster-aware layout (circle-packed regions, then a degree-aware force simulation, settled before the first frame) | Communities form visible regions at a glance, the graph appears composed instead of unravelling, and camera fit is computed on final positions. |
| Camera auto-fits and refits on resize or panel toggle until the person moves it; zoom is anchored on the cursor; pinch and drag work on touch | The graph fills the frame at any size without a manual reset, and zoom behaves like a map. |
| Orbs (lit spheres), luminous curved edges (additive on T2/T3), community mist (T2/T3 only, breathes on T3) | Depth without decoration: size and alpha carry importance, mist makes clusters read as regions. Low tiers and reduced motion fall back to plain nodes and edges. |
| Glow only on hubs (the top concept of each community), hover and selection | Antislop R-13 dose cap: halos mark the structure, not every node. |
| Label type: Spectral 600 for hubs, Plex Sans for the rest, Plex Mono for measured values | Concept names are the human voice (Spectral); dense secondary labels need Plex Sans legibility; numbers are machine output (mono). |
| Labels placed by importance with semantic zoom and collision checks (right, below, left, above) | Overview shows the few labels that matter, zooming in earns more, and a label never covers another label or a node. |
| Hover spotlights the neighbourhood strongly, selection only leans; value chips only for the focused node, activated nodes or when zoomed in | The page opens with a node already selected, so selection must not blank the graph; 20 stacked chips were unreadable. |
| Text fragments (chunks, sections, uncertainty markers) are hidden by default behind a labelled switch, with the real hidden count | They are real nodes but not what a person reads (181 of 275 here); the note states what is shown ("Showing all 94 ...") so nothing is hidden silently. |
| HUD inside the frame: four real counts (Odometer ids kept), the cap note, the selection chip | The counts are backend values; the chip says what is selected without covering the graph (the full detail stays in the panel beside it). |
| Concepts, connections and groups panel (real centrality, real edge relations, groups named after their most central concept) | A keyboard and screen-reader route into a canvas, and a way to read the graph in words. Group focus dims the rest and fits the camera to the group. |
| Slider, fit and layout switch on the right edge; the layout switch replaces the reference's "2D" button | There is no 3D here, so a 2D/3D toggle would be a dead control. |
| Camera fit and label placement keep clear of the measured overlays (HUD, controls column, caption, open panel); the controls column sits below a tall HUD and shortens its slider if the band is tight | Fixed padding let nodes and labels run under the HUD and the zoom label (a label under the cap note, "Undated" meeting "107%") and, on a phone, the cap note under the "+" button. The footprint is read from the DOM, so it holds at any size. |
| Overlay changes redo the camera's current mode (overview, or centred on the picked node, clear of a phone sheet); a refresh with the same nodes leaves the camera alone | A pick has to survive the HUD changing height (its chip is longer or shorter per node) and a data refresh with the same nodes, which used to snap the camera back to the overview. |
| Soft dark scrim behind the HUD | The counts and note stay legible when a node drifts behind them, without a hard panel edge. |
| The concepts panel is solid, about five rows tall and scrolls inside; on a phone it is a full-width sheet over the graph | Translucent glass let graph labels show through the list. The centrality bars were inline spans that never drew, so rows were taller than they looked. The middle tab is "Links" (the HUD's word) so the header fits 390px. |

Measured (Chrome, real graph data for the first persona: 275 nodes, 645 edges, 94 drawn):
axe-core 4.10 WCAG 2.2 A/AA on the full page with the panel open, 0 violations; 32 tab stops inside the frame,
all with a visible focus ring, none under 24px; no horizontal overflow at 390, 768 and 1440; no looping animation
under reduced motion; 144 fps idle and 143 fps with the CPU throttled 4x.

Demo cohort persona on the live backend (usr_7cd5de757a04: 1,090 nodes, 2,911 links, 13 groups; 120 of 170 concepts
drawn), captured at 1440x900, 1920x1080 and 390x844: no drawn node under the HUD, controls, caption, pill or open
panel at rest (on a phone the open panel is a sheet over the graph, by design); no text overlaps the controls column;
the panel background is opaque; axe-core 0 violations on /graph with the panel open at 1440; no horizontal
overflow at 390.

Open items: the page selects the first node on load and keeps static placeholder content in the document panel
(NEJM_2023_HeartFailure.pdf) beside the graph; `GET /api/graph/{user}` costs seconds of CPU for a large persona
(about 5 s for 1,090 nodes), blocks the health probe and is not cancelled when the request is abandoned;
touch-action is none on the canvas so one-finger drags pan the graph, not the page; the page loads the graph twice on
first visit (before and after the persona resolves), which doubles that cost and resets a selection made in between
to the first node.

## Neutral grey + graphite (supersedes the blue-grey values above)

Why: canvas, sidebar, header and cards were four near-identical blue-greys, so layers did not separate
and the product looked unfinished. One token (`--deep-petrol`) was also primary button, focus ring, link and
heading colour. Decided by the product owner: graphite frame, graphite primary, colour only for meaning.

| Decision | Reason |
|---|---|
| Neutral greys: canvas `#ECECEA`, paper `#FBFBFA`, wells `#F2F2F0` / `#E3E3E0`; flat canvas (no body gradient) | Hue-free surfaces let the few real colours carry meaning; value still encodes role (paper = read, canvas = bench). |
| Graphite frame `#1C1F22` for sidebar, status strip and Ask side panel, via a `.chrome-dark` token scope | The Instrument voice gets its own material and the page gets a clear layer step; it matches the dark graph viewport. Components are not edited: the scope re-skins tokens. |
| Primary = `--accent` graphite (near-white inside the dark scope); focus = `--focus` | One neutral primary; the accent no longer competes with state colours. Contrast on-accent 14.7:1 (13.5:1 in the dark scope). |
| Petrol `--link` only for links and citation chips; jade, bronze, madder unchanged in role | Colour appears only where it means something (cite, verified, caution, refused). |
| Answer is one paper sheet with hairline section breaks; Safety is a tinted section; citations are outline chips; sources are deduped by file and page | Four stacked cards and solid green blocks repeated the same weight; one sheet reads as one answer and the dedupe removes noise (5 passages became 2 chips). |
| Header search works (Enter opens Ask with the text, Ctrl/Cmd+K focuses it) and is hidden on Ask | It looked interactive on every page and did nothing, with a false shortcut hint. |
| Plain-language agent labels, no emoji, long reasoning clamped to 3 lines | Patients and reviewers do not need "ChromaDB"; the raw tool name stays on the mono argument line. |
| "AI explanations off" instead of `allow_api=false . Local Composer` | Same state, readable by a patient; the exact meaning is in the tooltip. |
| No success toast after an answer | The answer on screen is the confirmation; failures still toast. |
| Component gallery link only in dev builds | A developer tool is not a product screen; the route stays reachable. |

Measured contrast (WCAG formula): all text tokens at least 4.5:1 on canvas, paper, wells and (in `.chrome-dark`) graphite
surfaces; control borders at least 3:1 on canvas and paper. Exceptions: `--line-control` on `--ink-600` (a skeleton
fill, never a control surface).

Fixed on the way: header breadcrumb hardcoded "Arjun R" (now the active persona); header search was a dead
control; Upload showed a literal `{pages.length === 1 ? ...}` string in the page-quality badge.

Open (pre-existing, not changed): Timeline overflows horizontally by about 41px at 390px width (also at the
commit before this work).
