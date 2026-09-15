# VitaGraph workspace rules (binds all agents)
- Imperative mode only: act, verify, report.
- Read order each task: AGENTS.md, tasks/prd.json, tail progress.txt, then only the files the story touches.
- DESIGN.md is the frozen visual law (tokens §4, components §7, gates §11); never invent colors, radii, copy, or motion.
- Reality contract: no setTimeout/fake progress; SSE EventSource only; no static graph.json.
- Checkpoint rule: end every turn with `npm run build` exit 0 AND `pytest tests -q` green, then `git commit`. If you cannot reach green in 3 verification attempts, STOP, write a BLOCKED entry in progress.txt, `git checkout -- .` to last green commit, and end turn.
- One story per task. Never open a second story. Never paste whole files into replies.
- Evidence rule: every completion claim includes fresh command output plus a browser recording/screenshot artifact of the touched screen.
- Quota rule: if remaining work exceeds this turn, write resume state to progress.txt and stop.
