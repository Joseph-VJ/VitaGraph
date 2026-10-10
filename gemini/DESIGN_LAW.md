# DESIGN LAW: the app must look EXACTLY like the reference

Written 2026-10-05 after the owner saw that the live app had drifted from the reference. **This file outranks `VitaGraph-plan.md` and every older task file.** Where the plan, an older task or your own taste disagrees with the reference about the LOOK, the reference wins, every time.

## The reference (read it, open it, measure it)
- The finished design: `VitaGraph-App-v3.html` in the repository root (open it in Chrome; it is a bundled prototype).
- Its readable source: `design/reference/app-v3-source.html` (real markup with inline styles; the page markup of each screen starts at the line of its `data-screen-label`).
- One screenshot per screen at 1440 x 900: `design/reference/screens/00_Upload.png` ... `10_Settings.png`.
- The build guides: `LOCAL_AI_BUILD_GUIDE.md` and `GRAPH_3D_AND_ANIMATION_GUIDE.md` (graph math and full code, ingestion show, frame stage, isometric charts).
- Class names and tokens: `site design/src/theme/modernist.css` and `site design/src/theme/tokens.css`.

## What "exact" means
Same layout, same sizes, same spacing, same fonts and weights, same colours, same wording, same behaviour as the reference, at 1440 x 900, with REAL data from the backend instead of the reference's demo data. The shell (sidebar 244 px, header ONE row of 76 px, status strip 40 px) is identical on every page.

## The only differences allowed (owner decisions)
1. No model or provider names anywhere (no "Gemini 1.5 Flash" button, no model dialog). No "Reset demo" and no "Simulate outage". No "Run the full show" button: the Upload page keeps "Load demo cohort" instead.
2. "Ask" is called **"AI Agent"** (sidebar label "AI Agent", sub-label "Answers with evidence", page title "AI Agent"), and the route is `/agent`.
3. Demo values (Arjun R, VG-2026-001, 63 chunks ...) are replaced by real data from the active persona, and no number may be invented.
4. The ingestion show uses **5 seconds per stage at Normal speed** (the reference used 8, 9, 8, 9, 8 s). Process speed multipliers stay as in the reference: Fast x 0.5, Normal x 1, Real-time x 1.8, Reduce motion x 0.4.
5. The Settings page keeps the extra "Persona" delete section (real feature); nothing else is added.
6. The interactive frame stage on the Upload page stays exactly as in the reference. The owner will add the frame images at the very end; until then it shows the reference's own empty state.

7. **The AI Agent page is an AI-chat layout (owner decision 2026-10-08):** a centred 760 px conversation, the person's message as a right-aligned block, the AI's answer as plain text with a small "AI Agent" label, a quiet "Thought for N s" line that opens the live activity feed, a docked composer (auto-growing box, Enter sends), suggestion cards, a collapsible History column, and a report panel on the right. It stays flat and square-cornered, Archivo only (code is shown in Archivo too), one red accent. Key values that match a tool result are marked with a light red tint.
8. **Upload page:** the stage is the process theatre (a 7-stage film that follows the real job), the left column is 400 px and the full-screen ingestion show is opt-in (owner decisions 2026-10-06).
9. **Knowledge Graph, selected-node card (owner decision 2026-10-08):** the card gets an **AI summary box** that looks and behaves exactly like the one in `design/prototypes/VitaGraph-Playground.html` (open it in Chrome, click any dot). Its code-level spec is `design/prototypes/VitaGraph-AI-Node-Summary.md`. The other playground features (docked card, layouts, lens, time machine, backgrounds) were approved later by items 10 and 11.
10. **Knowledge Graph look (owner decision 2026-10-08):** the Knowledge Graph page is rebuilt to look and behave exactly like `design/prototypes/VitaGraph-Playground.html` (the preview), with REAL data: dark ink stage by default with a "Paper stage" switch, cinematic opening, four morphing layouts (Sphere, Orbits, Timeline, Columns), lens, "What changed" mode, time machine, path finder, evidence badges, filters, Save as image, and the node card docked on the right of the stage with a red elbow line to the dot and the AI summary box at the top of the card (see the image `ai box.png` in the repository root, the owner circled it). This replaces the light stage of the older reference for THIS page only; the rest of the app stays Modernist and light. The reference sources are split in `design/prototypes/playground-src/`.
11. **Living background (owner decision 2026-10-08):** a fixed, decorative canvas layer behind the whole app with four engines (Rubber grid, Ink currents, Constellation, Living type), strength Off / Soft / Full in Settings, and a play mode. It reacts to REAL events (agent thinking, upload stages, scan finished), respects Reduce motion, pauses when the tab is hidden, and is not drawn on the Knowledge Graph page. It is the only place where the app has background art; content stays on calm surfaces and readable.

## Everything the reference has must exist
Sidebar groups Workspace / Analyze / **Tools (Image to Text, PDF to Text, Text to Graph)** / System; Settings rows **Process speed** and **Chunk size** (slider 120 to 600, step 10) with "Chunks for a 5-page report"; the Knowledge Graph exactly as in the reference (see `gemini/TASK_S2_lite.md`); the three Tools pages; the live ingestion show.

## How every UI task is judged
1. The reviewer compares a 1440 x 900 screenshot of each page you touched with the matching reference screenshot. A page that differs in layout, size, spacing, wording or look is NOT accepted, even if the task's own checklist passes.
2. You compare your own 1440 x 900 screenshot with the reference yourself before you commit (at most 3 rounds per page), and you list every visual difference you can still see in your summary.
3. This is a college project: it must look like the reference and work without problems. Keep the process light (short summary instead of long reports); the look is what matters.

## Superseded parts of the plan
See `gemini/plan/SUPERSEDED.md`.
