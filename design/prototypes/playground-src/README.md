# Playground reference source (read-only copy)

This folder is a **READ-ONLY reference copy** of the approved preview `design/prototypes/VitaGraph-Playground.html`. The original file stays the source of truth and is not modified. The four files hold the original text byte for byte (same line endings, no edits), split at the boundaries below so the Gemini sessions can read one part at a time.

The data in the preview is **made-up sample data**. Nothing here is real.

The Gemini task files (`gemini/TASK_P1_graph_stage.md`, `gemini/TASK_P2_series_and_background.md`) cite **line numbers of the ORIGINAL file** (`VitaGraph-Playground.html`), not of these copies. Use the section tables below to find the same code in the copies.

The real implementation uses **typed modules** in the app (`site design/src`), not these plain scripts. Do not copy this code into the app as it is.

## Files

| File | Original lines | Lines here | What it is |
|---|---|---|---|
| `playground.css` | 6-270 | 265 | the text inside `<style>` |
| `playground-markup.html` | 272-485 | 214 | the page markup after `</style>`, before `<script>` |
| `playground-graph.js` | 487-1433 | 947 | the Knowledge Graph stage (sample data, layouts, card, AI summary, intro, lens, path, heat) |
| `playground-background.js` | 1434-1906 | 473 | the living background: four engines, events from the app, play mode, views and keys |

Check: `playground-graph.js` + `playground-background.js` together equal the original script lines 487-1906 exactly (same SHA-256). The original `})();` at line 1907 and `</script>` at line 1908 close the script.

## playground-graph.js (line numbers inside this file)

| Line | Section / function |
|---|---|
| 16 | SAMPLE DATA (made-up person, three reports) |
| 130 | four layouts |
| 132 | `LAY.sphere` |
| 159 | `LAY.orbits` |
| 175 | `LAY.timeline` |
| 184 | `LAY.columns` |
| 196 | THE GRAPH STAGE |
| 229 | `function setLayout` |
| 260 | `function sparkline` (trend chart in the card) |
| 324 | `function aiSummary` |
| 369 | `function aiBlock` (AI summary box in the card) |
| 437 | `function buildDossier` |
| 515 | `function startIntro` (opening sequence) |
| 538 | `function lensMap` |
| 548 | `function frameG` (frame loop for the graph) |
| 887 | `function heatCaption` ("What changed") |
| 894 | `function showPath` (path finder) |

## playground-background.js (line numbers inside this file)

| Line | Section / function |
|---|---|
| 2 | THE LIVING BACKGROUND: four engines (banner) |
| 10 | `function freeArea` |
| 28 | engine 1: the rubber grid |
| 98 | engine 2: ink currents |
| 178 | engine 3: constellation |
| 250 | engine 4: living type |
| 327 | events from the app (simulated in the preview) |
| 394 | `function enterPlay` |
| 427 | `function bgFrame` |
| 443 | views and keys |
| 463 | `function loop` |
| 473 | `window.__pg` (debug handle used by the preview) |

## Notes

- Events from the app are **simulated** in the preview (line 327 onward). The real layer must be driven by real agent and upload events.
- The preview has no backend calls. The real Knowledge Graph reads real data through the API.
- Line numbers above were found with `grep -n` on these files. If a file changes, re-run the grep rather than trusting the table.
