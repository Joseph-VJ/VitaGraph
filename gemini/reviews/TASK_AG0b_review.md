# Review of TASK AG0b (reviewer: Claude)

**Verdict: ACCEPTED.** Commit `656129d` on `redesign/modernist-app`. The two spikes together settle the architecture. The next stage can start.

## What I checked (read-only; I did not re-run the experiments)
- `git show --stat HEAD`: exactly one file, `gemini/reports/TASK_AG0b_report.md` (389 lines, the line count in section 3 is correct this time). No tracked file modified. `$env:TEMP\dsh_spike2` is gone. Ports 5173/8000/8010 free. `.env` still `ALLOW_API=true`. No key in the report; no workaround of the blocked API (the dead URL was used throughout, as ordered).
- Two `node.exe` processes were still running when I looked. I identified them (read-only process listing): they are `npx mcp-remote https://stitch.googleapis.com/mcp` helpers started by ANOTHER tool on this computer, not by the harness. They have the same process ids (3376 and 23500) that appear in your memory table.

## What AG0b PROVED (these answers are now binding for the design)
1. **Supported MCP form:** `name: '@deepseek-ai/dsh-mcp-client'` with `config: { serverName, transport: stdio, command, args, env }` inserted with `- insert:`. The AG0 form `@deepseek-ai/dsh-mcp` does NOT exist (boot fails with `Cannot find package`). The exact working patch text is in the report.
2. **Persona delivery works through the harness:** the value in the patch `env:` block is exactly what the server sees (2a: `usr_patch_A`, 2c: `usr_patch_B`), two personas side by side get their own value (concurrent test).
3. **SECURITY FINDING:** when the patch has NO `env:` block, the AMBIENT `VITAGRAPH_USER_ID` of the parent process LEAKS into the server (2b). Only variables whose name matches a secret pattern (`SECRET`) are scrubbed. Consequence: the backend must ALWAYS write the `env:` block explicitly AND start the harness with a minimal, scrubbed environment (no `VITAGRAPH_USER_ID`, no keys). AG2 must test both.
4. **Events stream live** (timestamps 0.01 s ... 15.62 s, not batch), through `on_notification`; notification = `method` (`session.event` / `session.status` / `subagent.started` / `subagent.finished`) + `payload` with `sessionId` and `event`. New event types seen: `llm/retry`, `llm/retry-started`, `agent/inbox/spliced` (retries are visible live: the UI can show "retrying, attempt n").
5. **No per-turn cancel exists** (SDK and wire protocol: only `initialize`, `session/prompt`, `shutdown`; the protocol README says a client abandons a turn by closing the runtime). Cancel = close that persona's runtime (0.16 s) and the next prompt starts a new one (3 s).
6. **Runtime cost:** cold start 2.97 s, warm start 3.49 s, `close()` also stops the MCP child process. Memory: see the correction below.
7. **System prompt** is replaced by a patch of `system-prompt` (`personaPrefix`), proven in the `system/message` event. **Fast failure** for tests: `- id: llm-retry` with `disabled: true` (0.04 s instead of 15.6 s). **Deleting a persona's sessions:** close the runtime, delete its `dsh_home` folder.
8. **No list/delete/title API in the SDK**, no resume: re-using a session id after a restart fails with `session "s1" already exists`.

## Corrections and cautions
- **Memory figure is inflated.** Per runtime it is the harness runtime (103 MB) + the MCP python server (65 MB) = about **170 MB**, not 270 MB: the two `node` processes in your table (43 MB and 62 MB) are the unrelated Stitch helpers. Good news: 5 personas = about 0.85 GB. Always check the process id and command line before attributing a process to the thing you test.
- **Q7 (memory) evidence is thin.** The task asked for the model-visible `request/context` of the second run to contain the first turn; the report shows the session log instead. It is enough for a design decision (see below) but mark such answers PARTIAL, as you did.
- **The `mcp` package is version 2.3.0** and its server class is `MCPServer` (AG0 had assumed `FastMCP`). The backend must pin the exact version it is tested with.

## Design decisions I take from the two spikes (written into `gemini/AGENT_PLAN.md`)
1. **One runtime per persona** in a small keyed pool (about 170 MB each, 3 s to start). Cancel = close that runtime.
2. **VitaGraph owns the conversation, not the harness.** Because a restarted runtime cannot resume a session id, every user turn starts a NEW harness session and VitaGraph sends the earlier turns as context. The harness session log is then only an audit trail. The list of a persona's conversations comes from VitaGraph's own database.
3. **The persona is only ever set by the backend** (explicit `env:` + scrubbed parent environment); no tool has a persona or user-id parameter; each tool checks that any `report_id` argument belongs to the persona.
4. Re-order the stages: the VitaGraph tool server (AG1) comes before the runner (AG2), because the runner's patch needs the server.

## Notes on how you worked
Very good: honest PARTIAL where evidence was partial, you quoted the protocol README on cancel, you cleaned up everything, and the Form 1 / Form 2 comparison was exactly the test needed. Please keep checking process ids.

## Must fix
Nothing.
