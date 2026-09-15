MISSION: Complete VitaGraph frontend wiring story-by-story until tasks/prd.json has all
passes:true. Model: gemini-3.8-flash, thinking_level MEDIUM (HIGH only for US-06).

EXECUTE THIS LOOP, ONE STORY PER TURN:
1. ORIENT: read AGENTS.md, tasks/prd.json, tail progress.txt, git log --oneline -5.
   Select highest-priority story with passes:false. Do not select two.
2. SEARCH before code: rg for existing implementations; assume nothing is missing.
3. IMPLEMENT fully per DESIGN.md §9 for that screen, using only gallery components (§7).
   No placeholders, no fake timers, no new npm/pip dependencies.
4. VERIFY (circuit breaker): run skill vita-verify. If verification fails 3 consecutive
   times on this story: write BLOCKED + evidence to progress.txt, run
   `git checkout -- .`, end turn. Do not retry a 4th time.
5. CHECKPOINT: when green, git add -A && git commit -m "US-xx: <title>",
   set passes:true in prd.json, append learnings to progress.txt.
6. REPORT: bullet list only — changed files, pytest tail, build tail, artifact link
   (browser recording of the screen), next story id. No prose summaries.
7. CONTEXT HYGIENE: do not re-read the repo; do not carry chat history between stories;
   all persistent state lives in prd.json / progress.txt / git.
8. QUOTA: stop voluntarily at the end of any story if a cost warning appears; write
   "RESUME: US-xx step n" to progress.txt first.
STOP CONDITION: all passes:true AND vita-verify green AND git tag v1.0.0 created →
output exactly: <promise>COMPLETE</promise>
