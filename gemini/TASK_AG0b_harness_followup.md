# TASK AG0b: close the five gaps of the harness spike (no repository code)

Read `gemini/RULES.md` first (branch guard 3b, report 5, work report 5b, quality bar 5c, **5d: when the AI API does not work**). Read `gemini/AGENT_PLAN.md` and **`gemini/reviews/TASK_AG0_review.md` completely**: it lists what AG0 proved and what it did not. Obey the review (copy numbers from git; answer PARTIAL when evidence is partial).

## Why
AG0 proved the lock-down and the MCP attachment. Five things that decide the backend design are still unproven: (1) the persona id really reaches the MCP server through the harness and the ambient environment does not leak, (2) events really stream while a run is in progress, (3) one turn can be cancelled without killing the runtime, (4) what a runtime costs (memory, start-up) because the design needs ONE RUNTIME PER PERSONA, (5) a handful of configuration facts (system prompt, retry policy, the right MCP plugin name, `workspaceRoot`, session resume). **You write NO code in the repository.** The AI API is blocked (401) so every experiment uses the dead URL `http://127.0.0.1:9/v1` (RULES 5d: no workarounds, no fake API server). Only your report is committed.

## Files you may change (closed list)
1. NEW `gemini/reports/TASK_AG0b_report.md`
Nothing else. Spike files live in `$env:TEMP\dsh_spike2\` and are deleted at the end (keep nothing with a key).

## Step 0: guard and rebuild the spike
```
git branch --show-current
git status --short
$spike = "$env:TEMP\dsh_spike2"
New-Item -ItemType Directory -Force $spike, "$spike\ws" | Out-Null
python -m venv "$spike\.venv"
& "$spike\.venv\Scripts\python.exe" -m pip install deepseek-harness-sdk==0.1.5rc1 deepseek-harness-runtime-bin==0.1.5rc1 mcp
```
Branch must be `redesign/modernist-app`. Recreate `lock.patch.yml` from the AG0 report (and this time RESTATE `name` and `workspaceRoot` of the `sandbox-policy` row: `workspaceRoot` must be the absolute path of `$spike\ws`, written literally, not `process.cwd()`). Every harness you start in this task uses `profile="sdk-minimal"`, `api_key="probe-token"`, `base_url="http://127.0.0.1:9/v1"` (SDK arguments, as in AG0) and a model id of your choice.

## Step 1: which MCP plugin form is the supported one? (gap 5)
AG0 attached the server with `name: '@deepseek-ai/dsh-mcp'` and a `servers:` map. The harness documentation (`packages/mcp/mcp-client/README.md`, read it with `gh api repos/deepseek-ai/deepseek-harness/contents/packages/mcp/mcp-client/README.md -H "Accept: application/vnd.github.raw"`) describes `name: '@deepseek-ai/dsh-mcp-client'` with `config: { serverName, transport: stdio, command, args, env, failOnStartupError }`. Try BOTH forms (each inserted with `- insert:`), and for each paste the `request/header` `data.header.tools` list. Say which works, which is the documented one, and which one you will use for the rest of this task (prefer the documented one if it works; give the exact patch text). The MCP server (`mcp_server.py`) must now have a docstring on its tool so the description is not empty, and must, at STARTUP, write `$spike\mcp_started_<N>.json` where `<N>` is the value of environment variable `PERSONA_FILE_TAG` (or `none`), containing `{"pid": ..., "persona": os.environ.get("VITAGRAPH_USER_ID"), "ambient_secret": os.environ.get("SPIKE_AMBIENT_SECRET"), "path_set": bool(os.environ.get("PATH"))}`.

## Step 2: does the persona reach the server through the harness? (gap 1)
Run three harness starts (each with its own `dsh_home` folder under `$spike`), reading the files the server wrote:
- 2a: parent process environment has `SPIKE_AMBIENT_SECRET=leak-test` and `VITAGRAPH_USER_ID=ambient_user`; the patch has `env: { VITAGRAPH_USER_ID: usr_patch_A }`. Expected: the server file shows `persona = usr_patch_A` and `ambient_secret = null`. Report exactly what you see.
- 2b: same parent environment, patch with NO `env:` block. Does the ambient `VITAGRAPH_USER_ID=ambient_user` leak into the server? (This tells us whether the persona could be injected from outside the patch.)
- 2c: patch with `env: { VITAGRAPH_USER_ID: usr_patch_B }`: file shows B.
Answer plainly: **is the persona that the server sees exactly the value in the patch, and nothing from the ambient environment?** If the server does not start (no file written), find out why (`failOnStartupError: true` helps) and fix the patch.

## Step 3: one runtime per persona: what does it cost? (gap 4)
1. Start two harnesses at the same time with different homes and personas A and B (the same patch template, different `env`). Prove each MCP server file has the right persona.
2. Measure and paste: seconds for a COLD start (new empty home), seconds for a WARM start (second start in the SAME home), seconds to run a second session on an already running runtime, and the working-set memory in MB of every `dsh*` and `node*` process that belongs to ONE running harness (use `Get-Process dsh*,node* | Select Id,ProcessName,@{n='MB';e={[math]::Round($_.WorkingSet64/1MB)}}` before and during the run, plus the MCP server python process). Report the memory per runtime and the extrapolation for 5 concurrent personas.
3. Does `DeepSeekHarness.close()` also stop the MCP server process? (`Get-Process python*` before and after, filtered by the pid in the file.)

## Step 4: the SDK surface (read the installed source, gaps 2, 3 and 5)
Open `$spike\.venv\Lib\site-packages\deepseek_harness\` and paste the PUBLIC signatures (class, method, parameters, return type, first docstring line) of everything involved in: creating a harness, starting or getting a session, running a turn, streaming notifications, **cancelling or interrupting one turn**, listing sessions, resuming a session, deleting a session, reading a session title. If the SDK offers `start_session`, `Session.run`, `Session.cancel`, `interrupt`, `abort` or similar, paste exactly what exists, not what you expect. If a function does not exist, write "does not exist". Also look in the protocol layer (`packages/sdk/protocol` in the GitHub repo, `gh api repos/deepseek-ai/deepseek-harness/contents/packages/sdk/protocol/README.md -H "Accept: application/vnd.github.raw"`) for the JSON-RPC methods and list their names.

## Step 5: do events stream while the run is in progress? (gap 2)
Run a turn against the dead URL with `on_notification` set to a function that prints `time since the run started (seconds, 2 decimals)`, `n.method` and, when present, `payload["event"]["type"]`. Paste the full printed list. Required answer: are the timestamps spread over the 15 seconds of the failing run (streaming) or do all lines appear at the end (batch)? Also paste how a notification object looks (its attributes).
Then find out WHY a failing run takes about 15 seconds (the retry policy of `@deepseek-ai/dsh-llm-retry`; read its entry in `https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/config-catalog.md` through `gh api`) and write the patch row that makes a failing request fail fast (for tests only), and prove the run now ends in under 3 seconds.

## Step 6: cancel one turn without killing the runtime (gap 3)
Using the method you found in Step 4 (or, if the SDK has none, the JSON-RPC method of the protocol layer), start a turn against the dead URL WITHOUT the fail-fast patch (it needs ~15 s), cancel it after about 2 seconds from another thread, and paste: the time the cancel took, what the cancelled `run` returned (`finish_reason`), and then PROOF the SAME harness still works afterwards (start a new session on it; its `request/header` event appears). If no per-turn cancel exists, say "does not exist", paste what you searched, and propose the least bad alternative with proof (for example closing only that session's runtime).

## Step 7: conversation memory, session resume and the system prompt (gap 5)
1. Run session `s1` twice on the same harness with the prompts `my name is Ada` and `what is my name`. The second run's `request/context` event must contain the first turn (this proves the model would see the history even without a real model). Paste the second `request/context` (strings cut at 300 characters). Then close the harness, start a NEW harness with the SAME `dsh_home`, run `s1` a third time with `again`: does `request/context` still contain the earlier turns (resume across restarts)?
2. Replace the system prompt `You are a helpful software engineer assistant.` through a patch of the `system-prompt` row (field `personaPrefix`, see the AG0 dump), not through an environment variable. Prove with `request/context`. Use the text `You are the VitaGraph health-report assistant. Use only the tools you are given.`
3. How would the backend delete a persona's sessions (the user can delete their persona)? Show what is on disk under `dsh_home` for one persona and state the safe way to remove it (deleting the persona's whole `dsh_home` folder after closing its runtime). Prove it by doing it and listing the result.

## Step 8: write the report
`gemini/reports/TASK_AG0b_report.md` with the nine headings of RULES 5b. Section 4 holds all raw output. Section 6 must contain a table "Gap | Answer (YES / NO / PARTIAL / UNKNOWN) | Evidence step" for these questions:
1. Is the persona seen by the MCP server exactly the value in the patch `env`, with no ambient leak? (2a, 2b, 2c)
2. Which MCP plugin form is supported and what is the exact patch text?
3. Do events stream live during a run?
4. Does a per-turn cancel exist, and does the runtime survive it?
5. Memory and start-up cost per runtime (numbers) and is a runtime-per-persona design affordable for 5 personas?
6. Does `close()` also stop the MCP server?
7. Does conversation memory work, also after a restart?
8. Can the system prompt be replaced by a patch?
9. How can failing requests be made fast for tests?
10. How can a persona's sessions be deleted safely?
Section 8 lists every remaining unknown that only the paid API can answer (shapes of `tool/call`, `tool/result`, `assistant/message` events) and any new risk. Finally delete `$env:TEMP\dsh_spike2`, confirm no `dsh*` process remains, and confirm `git status --short` shows no modified tracked file.

## COMMIT
```
git add gemini/reports/TASK_AG0b_report.md
git commit -m "docs(agent): AG0b harness follow-up report"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```
`git show --stat HEAD` must list exactly one file. Copy the line count in section 3 from it.

## ACCEPTANCE (PASS/FAIL each with evidence)
- Steps 1 to 7 have raw output; the ten-row table is complete and uses PARTIAL where evidence is partial.
- Persona delivery (Step 2) shows the three file contents; ambient leakage is answered YES or NO with proof.
- Cancel (Step 6) shows the runtime working after the cancel, or "does not exist" with the search.
- No key anywhere; spike folder deleted; no orphan process; exactly one file committed; branch correct.
