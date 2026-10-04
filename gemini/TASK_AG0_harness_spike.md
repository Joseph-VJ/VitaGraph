# TASK AG0: spike the real DeepSeek Harness and report the facts (no repository code)

Read `gemini/RULES.md` first (branch guard 3b, report format 5, **work report 5b**, **quality bar 5c**, and the NEW section **5d: when the AI API does not work**). Read `gemini/AGENT_PLAN.md` completely: it explains why this task exists and which rules never change. Also read `gemini/reviews/TASK_09a_review.md` and obey it.

## Why this task exists
The user wants the Ask page to become an **AI Agent** that runs on the real open-source DeepSeek Harness (`dsh`, https://github.com/deepseek-ai/deepseek-harness). Nobody has proven yet, on this Windows machine, that it can be driven from Python, locked down so the model has no shell or file access, and given VitaGraph tools through MCP. This task proves or disproves each point with real output. **You write NO code in the repository.** All experiments live in a temporary folder. The only thing you commit is your report.

## What the reviewer already learned by reading the docs (verify each, do not trust)
- The Python SDK is `deepseek-harness-sdk`, only published as a pre-release: `pip install --pre deepseek-harness-sdk` (expected 0.1.5rc1). It installs a matching `deepseek-harness-runtime-bin` wheel that contains `dsh.exe`; no system Node.js is needed. Windows x64 is supported.
- Use:
```python
from deepseek_harness import DeepSeekHarness
with DeepSeekHarness(dsh_home=ABS_PATH, cwd=ABS_PATH, profile="sdk-minimal", patches=(ABS_PATH_TO_PATCH,), model="deepseek-v4-flash", initialize_timeout_seconds=60) as harness:
    result = harness.run("hello", session_id="some-id")
# result.final_response, result.finish_reason, result.events (list of dicts), result.notifications
```
- The credentials come from the process environment: `DEEPSEEK_API_KEY` and `DEEPSEEK_BASE_URL`. An explicit `DSH_HOME` (absolute path of an empty folder) is mandatory.
- DANGER: the shipped `sdk-minimal` profile mounts a PowerShell shell tool (rows `persistent-pwsh` and `persistent-bash`) and a row `sandbox-policy` with `mode: danger-full-access`. The harness's own `SAFETY.md` says it is unaudited and can run model-written commands. For VitaGraph (health data) the shell must be switched off. A patch file that does this (syntax believed correct; verify it):
```yaml
- id: persistent-pwsh
  disabled: true
- id: persistent-bash
  disabled: true
- id: sandbox-policy
  name: '@deepseek-ai/dsh-sandbox-policy'
  config:
    mode: read-only
    workspaceRoot: !!js process.cwd()
```
- `dsh.exe --profile sdk-minimal --dump-default-config` prints the profile's rows; `dsh.exe --profile sdk-minimal --patch <file> --dump-config` prints the effective tree after a patch.
- Tools from an MCP server are added with a row of this shape (how to INSERT a new row in a patch file is something you must find out: read https://github.com/deepseek-ai/deepseek-harness `packages/boot/app-boot/README.md` (section Profiles, the `cordis.patch.yml` paragraph) and `packages/mcp/mcp-client/README.md`, using `gh api repos/deepseek-ai/deepseek-harness/contents/<path> -H "Accept: application/vnd.github.raw"`, or try variants with `--dump-config`):
```yaml
- id: mcp-vitagraph
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: vitagraph
    transport: stdio
    command: <absolute path of the spike venv python.exe>
    args: ['<absolute path of mcp_server.py>']
    env:
      VITAGRAPH_USER_ID: usr_spike_persona
    failOnStartupError: true
```
  The model then sees the tool as `mcp__vitagraph__<tool name>`.
- Known from an earlier look (do not rely on it, re-check): with `DEEPSEEK_BASE_URL=https://agentrouter.org/v1` and the AgentRouter key, the gateway's firewall answered HTTP 401 `unauthorized client detected` to the harness. Per RULES 5d you must NOT work around this. Record it and continue.

## Files you may change (closed list)
1. NEW `gemini/reports/TASK_AG0_report.md`
Nothing else in the repository. No file under `vitagraph/`, `site design/`, `docs/`, `design/`. All spike files go to `$env:TEMP\dsh_spike\` and are deleted at the end (keep nothing that contains a key).

## Step 0: guard
```
git branch --show-current
git status --short
```
Branch must be `redesign/modernist-app`. `git status --short` may list untracked reference files and `site design/tsconfig.tsbuildinfo`; it must list NO other modified tracked file at the end of this task either.

## Step 1: install in a temp folder
```
$spike = "$env:TEMP\dsh_spike"
New-Item -ItemType Directory -Force $spike, "$spike\home", "$spike\ws" | Out-Null
python -m venv "$spike\.venv"
& "$spike\.venv\Scripts\python.exe" -m pip install --pre deepseek-harness-sdk
& "$spike\.venv\Scripts\python.exe" -m pip list
& "$spike\.venv\Scripts\dsh.exe" --version
```
Paste the installed versions and the `dsh --version` line. If the install fails, paste the error and write the report with STATUS BLOCKED.

## Step 2: the unpatched profile (what is dangerous)
```
$env:DSH_HOME = "$spike\home"
& "$spike\.venv\Scripts\dsh.exe" --profile sdk-minimal --dump-default-config > "$spike\cfg_default.yaml"
Select-String -Path "$spike\cfg_default.yaml" -Pattern '^- id:' | ForEach-Object { $_.Line }
Select-String -Path "$spike\cfg_default.yaml" -Pattern 'danger-full-access|persistent-pwsh|persistent-bash'
```
Paste the list of row ids and the matches.

## Step 3: the lock-down patch
Save the patch above as `$spike\lock.patch.yml`. Then:
```
& "$spike\.venv\Scripts\dsh.exe" --profile sdk-minimal --patch "$spike\lock.patch.yml" --dump-config > "$spike\cfg_locked.yaml"
Select-String -Path "$spike\cfg_locked.yaml" -Pattern 'id: persistent-|id: sandbox-policy' -Context 0,3
(Select-String -Path "$spike\cfg_locked.yaml" -Pattern 'id: sandbox-policy').Count
```
Required: both `persistent-*` rows show `disabled: true`; there is exactly ONE `id: sandbox-policy` row and its mode is `read-only`. If a row is duplicated or the original `danger-full-access` row survives, say so clearly and try to fix the patch until the dump is right; paste the final working patch.

## Step 4: what does the model actually get offered? (works without any API)
Write `$spike\tools_probe.py`: it starts the harness with `DEEPSEEK_API_KEY=probe-token` and `DEEPSEEK_BASE_URL=http://127.0.0.1:9/v1` (nothing listens there, so NO real model is called and the run ends with `finish_reason: error`), runs the prompt `hello`, and prints (a) `finish_reason`, (b) the list of distinct `type` values in `result.events`, (c) the full JSON of every event whose type is `request/context` or `request/header`, with long strings cut at 400 characters.
Run it THREE times and paste the three outputs:
- 4a: profile `sdk-minimal` WITHOUT any patch (expected: a shell tool such as `pwsh` is advertised; if you cannot find a tool list in the events, find where the tool schemas appear and say so),
- 4b: with `lock.patch.yml` (expected: no shell, no file tool; list exactly which tool names remain, if any),
- 4c: with `lock.patch.yml` plus the MCP patch from Step 5.
The key question this step answers: **can we prove, from the harness's own events, which tools the model can call?** Write down exactly which event and which field proves it.

## Step 5: a VitaGraph-style MCP tool, persona-bound by environment
```
& "$spike\.venv\Scripts\python.exe" -m pip install mcp
```
Write `$spike\mcp_server.py` with the `mcp` package (`from mcp.server.fastmcp import FastMCP`): a server named `vitagraph` with ONE tool `search_reports(query: str) -> str` that returns `"persona=" + os.environ["VITAGRAPH_USER_ID"] + " query=" + query` (a dummy: the real tool comes in stage AG2). Create the MCP patch (`$spike\mcp.patch.yml`) with the row shown above (absolute paths of THIS venv's python and of mcp_server.py), find out how to insert it, and prove with `--dump-config` that it is part of the effective tree together with the lock-down. Then run Step 4c and paste the proof that `mcp__vitagraph__search_reports` is advertised. Also prove persona binding: run the MCP server by hand with a different `VITAGRAPH_USER_ID` value and call the tool through the `mcp` client library (a small script using `mcp.client.stdio`), paste both outputs. Answer: can the model choose another persona? (It must not be possible: the id is not a tool argument.)

## Step 6: real model call (only if the API works)
Read the AgentRouter key and URL from `vitagraph\backend\.env` WITHOUT printing them (lines `AGENTROUTER_API_KEY` and `AGENTROUTER_BASE_URL`; set them as `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` in the child process only). Run, with lock-down and MCP patches, the prompt `Use the search_reports tool with the query hemoglobin and tell me exactly what it returned.`
- If the run ends with an HTTP error (the expected `401 unauthorized client`), paste the raw error with the key redacted, write `API blocked`, and SKIP the rest of this step (RULES 5d: no workaround).
- If it works: paste the final response, and the full JSON (long strings cut at 400 characters) of one event of EACH type that appears (`tool/call`, `tool/result`, `assistant/message`, `step/end`, ...). Also paste how `result.notifications` look (first 3) and which Python parameter receives notifications DURING the run (look at the SDK source in `$spike\.venv\Lib\site-packages\deepseek_harness\`, find `on_notification` and the iteration API) with a 10-line example of streaming them to a callback.

## Step 7: process behaviour on Windows
Using the unreachable-API setup (no real model), measure and paste:
1. seconds from `DeepSeekHarness(...).__enter__` to ready, and seconds for one `run`,
2. after leaving the `with` block, `Get-Process dsh* -ErrorAction SilentlyContinue` is empty (no orphan process),
3. two harnesses started at the same time in two Python threads with two different `dsh_home` folders both finish (paste both `finish_reason`),
4. one harness running two sessions one after the other (`session_id` "a" then "b"): do both work, and where does the harness store them under `dsh_home`? (list the folder tree two levels deep),
5. how does one cancel a running turn (find the SDK method) and does it work (start a run against the unreachable API; if cancel cannot be exercised without a model, say so).

## Step 8: what else is on?
From `cfg_locked.yaml` list every enabled (not disabled) row whose name suggests a capability the model could reach: network, web fetch/search, filesystem, subprocess, terminal, skills, MCP resources. For each, say whether it is a model-callable TOOL (it appears in Step 4b's tool list) or only infrastructure. If any model-callable tool besides the VitaGraph MCP tool remains, propose the patch rows that disable it and prove the result with a new Step 4 run.

## Step 9: write the report
`gemini/reports/TASK_AG0_report.md` with the nine headings of RULES 5b. Section 4 holds ALL raw outputs above. Section 6 must contain a table "Question | Answer | Proof (step)" for these ten questions, each answered YES, NO or UNKNOWN with evidence:
1. Does the SDK install and start on this machine?
2. Does the lock-down patch remove the shell and set read-only?
3. Is the lock-down provable from the model-visible tool list? (which event/field)
4. Can a stdio MCP server be attached by a patch, and is its tool advertised as `mcp__vitagraph__...`?
5. Is the persona fixed by the process environment and impossible for the model to change?
6. Does a real model call through the harness work with the current API? (or `API blocked`)
7. Which events and notifications does the harness emit, and can they be streamed to a callback while the run is in progress?
8. Is there any orphan process or leftover file after a run?
9. Can several runs be active at once (different homes)? Can one runtime serve several sessions?
10. How can a run be cancelled?
Section 8 ("Open questions") must list every surprise and every risk you saw. Then delete `$env:TEMP\dsh_spike` (after you copied everything needed into the report) and confirm `git status --short` shows no modified tracked file.

## COMMIT
```
git add gemini/reports/TASK_AG0_report.md
git commit -m "docs(agent): AG0 harness spike report"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```
`git show --stat HEAD` must list exactly one file.

## ACCEPTANCE (PASS/FAIL each with evidence)
- Steps 1 to 5 and 7 and 8 have raw output in the report; Step 6 either has raw output or the redacted raw error plus `API blocked`.
- The lock-down is proven by the model-visible tool list (4b, 4c), not only by the config dump.
- The ten-question table is complete; every answer cites a step.
- No key, no `.env` content anywhere in the report; spike folder deleted; no tracked file modified; exactly one file in the commit; branch correct.
