# VitaGraph loop constitution
Project: VitaGraph (B.Tech). Privacy-aware reading of health reports with cited evidence.
Shipping frontend = `site design/` Modernist prototype wired to the REAL backend in `vitagraph/backend`.
Read order each iteration: AGENTS.md → gemini/DESIGN_LAW.md → gemini/TASK_*.md → progress.txt (tail) → files touched.
Design law: Modernist visual system (`VitaGraph-App-v3.html`, tokens in `site design/src/theme/tokens.css`). Archivo font only, flat surfaces, 0px radius, single red accent (`--color-accent: #ec3013`).
Theme: Settings → Display controls the whole app and both graph shortcuts; Dark default, browser persistence and tab synchronization. Light retains the original Modernist palette. Generated previews adapt; source documents and document downloads/print remain original. See DESIGN_LAW item 15 and SESSION_CONTEXT section 44.
Pages (14): Upload, Library, My Data, AI Agent, Knowledge Graph, Timeline, Compare, Insights, Image to Text, PDF to Text, Text to Graph, Privacy Shield, Accuracy Test, Settings.
AI Agent: `POST /api/agent/stream` with real-time SSE events (run, status, step, model, thinking, tool_call, tool_result, stats, text_delta, completed, error); five read-only tools (`list_reports`, `search_reports`, `get_measurements`, `graph_lookup`, `calculate`); fail-closed safety gate. Runs continue across browser disconnection and reattach by event index; only Stop cancels them. Charts use stored values, reports render on the server, code is displayed only.
Current branch: `main` (owner-authorized checkpoint, SESSION_CONTEXT section 45). Read the newest section of `docs/SESSION_CONTEXT.md`; older task files and progress entries are historical. Default role is review and detailed task prompts; direct implementation and sub-agents require explicit owner instructions. No automatic commits, merges or pushes.
Settings AI connection is local-only. An empty key may retain the saved key only for its saved host and port. Never print or manually edit `vitagraph/backend/.env`. Scratch runs must set DATA_DIR, DB_PATH, CHROMA_DIR, UPLOADS_DIR and VITAGRAPH_ENV_FILE separately.
Verify commands (Windows):
  backend:  cd vitagraph/backend && .venv\Scripts\python.exe -m pytest tests -q
  frontend: cd "site design" && npm run build   (and npm run dev + browser check for UI stories)
  scan:     python scripts/plan/secret_scan.py  (must print RESULT: PASS)
Ports: 8000/5173 for primary workspace, 8001/5174 for worktree.
Iron laws: one story per iteration · no placeholders · no fake timers/static mock where an endpoint exists · no commit while red · no completion claim without fresh command output · reference design wins · never name a provider/model in UI · never edit backend tests to pass · keep backend tests green · stage by explicit path (never git add .) · never touch the other folder.
