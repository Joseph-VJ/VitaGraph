# VitaGraph loop constitution
Project: VitaGraph (B.Tech). Privacy-aware reading of health reports with cited evidence.
Shipping frontend = `site design/` Modernist prototype wired to the REAL backend in `vitagraph/backend`.
Read order each iteration: AGENTS.md → gemini/DESIGN_LAW.md → gemini/TASK_*.md → progress.txt (tail) → files touched.
Design law: Modernist visual system (`VitaGraph-App-v3.html`, tokens in `site design/src/theme/tokens.css`). Archivo font only, flat surfaces, 0px radius, single red accent (`--color-accent: #ec3013`).
Pages (11): Upload, Library, AI Agent, Knowledge Graph, Timeline, Compare, Insights, Image to Text, PDF to Text, Text to Graph, Settings.
AI Agent: `POST /api/agent/stream` with real-time SSE events (status, step, thinking, tool_call, tool_result, text_delta, stats, completed, error); four read-only tools (`get_biomarkers`, `get_trends`, `query_chroma`, `query_graph`); fail-closed safety gate.
Verify commands (Windows):
  backend:  cd vitagraph/backend && .venv\Scripts\python.exe -m pytest tests -q
  frontend: cd "site design" && npm run build   (and npm run dev + browser check for UI stories)
  scan:     python scripts/plan/secret_scan.py  (must print RESULT: PASS)
Ports: 8000/5173 for primary workspace, 8001/5174 for worktree.
Iron laws: one story per iteration · no placeholders · no fake timers/static mock where an endpoint exists · no commit while red · no completion claim without fresh command output · reference design wins · never name a provider/model in UI · never edit backend tests to pass · keep backend tests green · stage by explicit path (never git add .) · never touch the other folder.
