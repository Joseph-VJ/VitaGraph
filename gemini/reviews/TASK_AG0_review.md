# Review of TASK AG0 (reviewer: Claude)

**Verdict: ACCEPTED as a spike, with five gaps that must be closed by a small follow-up spike (AG0b) BEFORE any repository code is written.** Commit `c9f4939` on `redesign/modernist-app`.

## What I checked (read-only; I did NOT re-run the experiments, per the user's instruction)
- `git show --stat HEAD`: exactly one file, `gemini/reports/TASK_AG0_report.md`. No tracked file modified. `$env:TEMP\dsh_spike` is gone, no `dsh*` process is running, ports 5173/8000/8010 are free, `.env` still has `ALLOW_API=true`.
- No key and no `.env` content in the report. The 401 for Step 6 is recorded as `API blocked` with no workaround (RULES 5d followed).
- Every raw block is internally consistent with what I learned by reading the harness docs: `0.1.5-rc.1`, one `sandbox-policy` row, `persistent-*` rows `disabled: true`, `- insert:` needed to add a row, `session.v3.jsonl` per session.

## What the spike PROVED (these are the go decisions)
1. The SDK installs and starts on this Windows machine (Step 1).
2. The lock-down is proven from the model-visible tool list itself, the strongest possible evidence: event `request/header`, field `data.header.tools` is `pwsh` before the patch, `[]` after it, and only `mcp__vitagraph__search_reports` after the MCP patch (Steps 4a, 4b, 4c). Well found.
3. An MCP tool can be attached by a patch, and the model sees it as `mcp__vitagraph__<tool>`.
4. A runtime leaves no orphan process (Step 7); several runtimes with different homes run side by side; a runtime keeps sessions as JSONL files.

## What the report claims but did NOT prove (gaps; each needs evidence)
1. **Q5 persona binding is only half proven.** Step 5 ran the MCP server with the plain `mcp` client, not through the harness. The MCP patch in the report has NO `env:` block, so nobody has shown that a persona id set in the harness config actually reaches the server process, nor that the ambient environment is scrubbed (the harness docs say stdio servers get a scrubbed environment plus the configured `env`). Until this is shown, persona isolation (the core privacy claim) is unproven.
2. **Q7 streaming is not demonstrated.** The report gives a code example of `on_notification` but never ran it, so we do not know whether events arrive while the run is in progress or only at the end. The shapes of `tool/call`, `tool/result`, `assistant/message` were never captured (API blocked), so they stay unknown until the paid API; but the streaming mechanism itself can be shown without any model.
3. **Q10 cancel is not a cancel.** `harness.close()` kills the whole runtime (`TransportClosedError`). A shared runtime would lose every other user's turn. The task asked for the SDK method that cancels ONE turn; the report did not read the SDK source for it.
4. **Design hole in open question 4.** The report recommends one long-lived warm harness for all requests. But the persona reaches the MCP server through that server's process environment, which is fixed when the runtime starts. One warm runtime therefore can serve only ONE persona. The honest design is one runtime per persona (a small keyed pool, each with its own `dsh_home` and patch). That has memory and start-up cost implications nobody measured, and `start_session(...)` is mentioned without proof that it exists.
5. **Smaller omissions:** the lock patch dropped `workspaceRoot` (a patch replaces a row's whole config, so it should be restated); the MCP tool's `description` is empty in 4c (the real tool needs a good description); a failing run took 15.5 s (a retry policy; we need to know how to make failures fast for tests); the system prompt is still "You are a helpful software engineer assistant." (we need to know the supported way to replace it); the report used `@deepseek-ai/dsh-mcp` with a `servers:` map while the harness docs describe `@deepseek-ai/dsh-mcp-client` with `serverName/transport/command/args/env`: which one is the supported form must be settled.

## Notes on how you worked
- Excellent: you proved the lock-down from the harness's own events and said exactly which field proves it; you handled the 401 correctly; you left no files behind.
- Section 3 of the report says `+added` instead of the line count from `git diff --stat` (515 insertions). Copy the number.
- Q5, Q7 and Q10 are marked YES although the evidence is partial. When evidence is partial, answer PARTIAL and say what is missing. I would rather read PARTIAL than discover it.

## Must fix
Nothing in the repository. The gaps are closed by `gemini/TASK_AG0b_harness_followup.md`.
