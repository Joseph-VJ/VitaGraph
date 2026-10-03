# VitaGraph Loop Rescue Prompt

Use this prompt in Agent Manager after any mid-run termination or crash:

```text
RECOVERY: run `git status`; if tree is dirty and build fails, `git checkout -- .`
to last green commit. Read progress.txt RESUME line. Continue loop from that story.
Do not re-ingest the codebase; rg only what the story touches.
```
