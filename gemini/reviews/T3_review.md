# Plan T round 2 review (2026-10-12)

Verdict: **ACCEPTED. T3 is complete.** Codex implemented both parts at the owner's explicit request to finish the last work and its updates. This is the same-session implementation and verification record, not an independent second reviewer.

| Check | Fresh result |
|---|---|
| Regression tests before fix | 5 failed, 22 passed; both changed-host routes and skip-test leak reproduced |
| Focused connection/env/privacy suite | 41 passed in 3.08s |
| Complete backend suite | 791 passed in 459.39s |
| Production build | tsc -b and Vite exit 0, 400 modules |
| Design audit | 104 files, 0 errors, 0 pending |
| Secret scan | RESULT: PASS |
| Browser | 32 scratch checks + 6 primary-page checks passed |
| Live changed-host regression | both routes 422; zero extra requests at upstream; temporary file/settings unchanged |
| Integration smoke | 10 passed: upload, Library measurements, cited offline answer, graph/subgraph, series, Timeline, My Data, clinical refusal, cleanup and synthetic-key-only recording |
| Real saved model connection | HTTP 200, ok true; ping only, no saved settings change |
| Real `.env` timestamp | unchanged: 2026-10-08T14:16:14.5578770+05:30 |
| Scratch cleanup | 8001/5174/8099 free |

D1 fixed by the host-and-port guard in `_checked_input`, before testing or saving. D2 fixed by the key help/disabled controls. The error-flow Save without testing also obeys the guard. Same-host paths/case changes retain the key; explicit new keys work. Thirteen additional regression cases bring the prior 778 tests to 791. Existing empty-key test assertions are unchanged; its address now matches the saved fixture host, as TASK_T3 requires.

Compared the affected Settings screenshots with design/reference/screens/10_Settings.png. The existing approved changes (My Data/Trust navigation, living background, current ingestion options and AI connection) remain; new T3 help uses Archivo, accent-700 and square controls. No new visual style. No overflow at 1440/1000/820/400, keyboard and reduced-motion checks passed. The one browser console HTTP error was the deliberate 422 error-state check, not an app exception.

The full task is updated in the reports, TASK_T3 status, PLAN_T status, SESSION_CONTEXT section 40, README, CLAUDE, AGENTS, GEMINI, RULES, DESIGN_LAW, progress.txt and the existing handover memory. Work is uncommitted on feature/privacy-shield-and-rag-lab at c4fca21; no merge/push was performed. Primary backend/frontend were started only after acceptance and serve the current code on 8000/5173.

Remaining limits: real remote-client 403 and Firefox/Safari are unverified; idle worker closure is asserted in tests, not watched during a real warm-worker change. Existing extraction/missing-range, privacy recognition, multilingual safety, no login/encryption and public-history key-rotation items remain outside T3. No further T3 fix is pending.
