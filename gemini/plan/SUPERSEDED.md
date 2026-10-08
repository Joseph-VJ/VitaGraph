# What changed in the plan on 2026-10-05 (owner: "I need this exact design")

`gemini/DESIGN_LAW.md` outranks the plan. These plan tasks are replaced, cancelled or re-ranked:

| Plan task | New status | Why |
|---|---|---|
| C2 (six upload stages) | **CANCELLED**, replaced by part 2 of `gemini/TASK_S1_lite.md` | The reference Upload page has FIVE rows with fixed wording and the interactive stage panel. |
| C8 (show speed, Could) | **REPLACED by task X5** (Must) | Process speed is a reference Settings row; Normal = 5 s per stage. |
| B5, B6, B8 (three.js graph, 2D view, new graph page), B9, B10 | **SUPERSEDED by task G1** | The reference graph is a hand-built canvas renderer (guide Part A), not three.js. B2's packages are removed by G1. |
| B7 (Graph view setting) | **REMOVED** | The reference has no 3D/2D choice. |
| B11 (end-of-B gate) | re-targeted at G1 later | |
| E1, E2, E3, E4, E5 (Tools) | **Tier Must** (were Should/Could) | The three Tools pages are required by the owner. Where an E task differs from the reference markup (`design/reference/app-v3-source.html` lines 713 to 740 and the Tools lines of the graph page) the reference wins. |
| A4 header change | **FIXED by task X1** | It made the header two rows tall (106 px). |
| A9 step 13 (frame stage removed, DEC-3) | **REVERSED by task X3** | The owner will supply frames last; the stage stays. |
| C3 (ingestion show) | stays Must, to be re-specified | Must follow reference lines 775 to 798 and guide Part B, with 5 s per stage at Normal speed. |
| D1 to D12, F1, F4, F5, C5, C6 | unchanged, queued after the "exact design" work | |

**Execution files now in force (lean versions, they replace the earlier X and G1 task files):** `gemini/TASK_S1_lite.md` (main folder session) and `gemini/TASK_S2_lite.md` (worktree session). `gemini/TASK_X_round1_exact_shell_pages.md` and `gemini/TASK_G1_exact_graph.md` are kept only as background; do not follow them.
