MISSION: Add the game-grade motion & FX layer to VitaGraph's shipping frontend (`site design/`),
story-by-story, until every MS story in tasks/prd.json has passes:true.
Model routing: thinking_level MEDIUM for all stories; HIGH for MS-01 (engine), MS-05 + MS-06 (canvas).

LAW: MOTION.md (site design/MOTION.md) is frozen motion law; DESIGN.md v2.1 stays frozen except the
three ratified amendments in MOTION.md §M0. Reality contract (plan §2.4) binds motion: reveals are
gated on real fetch/SSE events; cosmetic pacing of already-real values must end on the exact value
and be commented `presentation pacing`. Backend untouched: pytest stays 43/43. Zero new npm/pip
dependencies. No fake timers, no invented states, no looping error animations.

EXECUTE THIS LOOP, ONE STORY PER TURN:
1. ORIENT: read AGENTS.md, tasks/prd.json, tail progress.txt, git log --oneline -5.
   Select the highest-priority MS story with passes:false. Never two.
2. SEARCH before code: rg for existing implementations (GraphStage rAF, tokens.css, existing
   transitions); reuse the motion engine; assume nothing is missing.
3. IMPLEMENT fully per MOTION.md sections named in the story's `spec` field. No placeholders.
   All motion goes through src/motion/* (single ticker; no rogue requestAnimationFrame;
   no transitions on layout properties; will-change ≤8 concurrent).
4. VERIFY (circuit breaker, 3 strikes => BLOCKED + git checkout -- . + end turn):
   a) npm run build exit 0   b) pytest tests -q 43/43 (unchanged backend)
   c) browser artifact of the touched screen: recording or screenshot pair (motion on / T0),
      saved to design-board/motion/ms-XX-*.{png,webm,json}
   d) story-specific checks from its `acceptance` field (fps trace, tier chip, stagger caps…)
   e) MOTION.md gates from its `gates` field, plus DESIGN gates 1-16 spot-check.
5. CHECKPOINT when green: git add -A && git commit -m "MS-xx: <title>"; set passes:true in
   prd.json; append progress.txt entry with command tails + artifact filenames + learnings.
6. REPORT: bullets only — changed files, build tail, pytest tail, artifacts, gate results,
   next story id. Never paste whole files.
7. CONTEXT HYGIENE: re-read only files the story touches; state lives in prd.json/progress.txt/git.
8. QUOTA: cost warning or turn end => write "RESUME: MS-xx step n" to progress.txt and stop.
STOP CONDITION: all MS passes:true AND gates 17-32 green AND artifacts committed AND
git tag v1.1.0-motion created => output exactly: <promise>MOTION-COMPLETE</promise>
