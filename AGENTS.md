# VitaGraph loop constitution
Project: VitaGraph (B.Tech). Shipping frontend = `site design/` prototype wired to the REAL backend in `vitagraph/backend`.
Read order each iteration: AGENTS.md → tasks/prd.json → progress.txt (tail) → DESIGN.md (only when touching UI) → PROJECT_CONTEXT_AND_ROADMAP.md §2.4 + plan §12/§20.1 (only when touching events/graph).
Verify commands (Windows):
  backend:  cd vitagraph/backend && .venv\Scripts\python.exe -m pytest tests -q
  frontend: cd "site design" && npm run build   (and npm run dev + browser check for UI stories)
Iron laws: one story per iteration · no placeholders · no fake timers/static mock where an endpoint exists · no commit while red · no completion claim without fresh command output · DESIGN.md tokens frozen · never name a provider/model in UI · never edit backend tests to pass · keep 38/38 pytest green.
Learnings: append gotchas/conventions here (brief) at end of each iteration.
