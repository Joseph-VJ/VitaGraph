# VitaGraph workspace rules (binds all agents)
- Read AGENTS.md, tasks/prd.json, progress.txt (tail) before any edit.
- One user story per task. Never bundle stories.
- Verify before claiming: run backend pytest (38 tests) + `npm run build` in "site design";
  for UI stories also open the page in the browser and attach a screenshot Artifact.
- No placeholders, no fake timers, no hardcoded numbers where an endpoint exists
  (reality contract, plan §2.4). DESIGN.md tokens are frozen.
- Never edit backend tests to make them pass. Never commit while red.
- UI voice: sentence case, mono only for machine output, no trailing arrows, radii 4/6/10/14.
