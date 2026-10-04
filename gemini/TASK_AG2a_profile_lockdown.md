# TASK AG2a: the agent's locked-down profile, its system prompt, and the start-up safety check (backend)

Read `gemini/RULES.md` first (branch guard 3b, report 5, **work report 5b**, **quality bar 5c**, **5d: the AI API is blocked, never work around it**). Read `gemini/AGENT_PLAN.md` completely, **`gemini/reviews/TASK_AG0b_review.md`** and **`gemini/reviews/TASK_AG1_review.md`** completely (the second one lists four fixes that are Part 0 of this task). Obey them: copy line counts from git, answer PARTIAL when evidence is partial, check process ids and command lines before attributing a process to your test.

## Why this task exists
The AI Agent runs on the real DeepSeek Harness (`dsh`), which by default can run shell commands. Everything that makes it safe is configuration that the backend must generate for every persona, and a check that proves the configuration works before a persona's first run. This task builds exactly that, and nothing that talks to a real AI model: every harness started here points to the dead URL `http://127.0.0.1:9/v1` (RULES 5d: no workaround, no fake API server). The runtime pool and the streaming come in AG2b and AG3.

## Binding facts from the spikes (do not re-discover, but do verify when the task says so)
- Supported way to add a tool server: a patch row `- insert:` with `name: '@deepseek-ai/dsh-mcp-client'` and `config: { serverName: vitagraph, transport: stdio, command, args, env, cwd }`. The tools then appear as `mcp__vitagraph__<tool name>`.
- Lock-down patch: rows `persistent-pwsh` and `persistent-bash` get `disabled: true`; the row `sandbox-policy` is REPLACED as a whole, so it must restate `name: '@deepseek-ai/dsh-sandbox-policy'`, `config: { mode: read-only, workspaceRoot: <literal absolute path of the persona's empty workspace folder> }`.
- System prompt: patch of the row `system-prompt` (`name: '@deepseek-ai/dsh-system-prompt'`, field `personaPrefix`). Read the AG0 and AG0b reports and the default dump (`dsh --profile sdk-minimal --dump-config`) for the other fields of that row and restate those you keep (a patch replaces the whole config of the row).
- Fast failure for tests only: a row `- id: llm-retry` with `disabled: true`.
- Proof of what the model can call: the harness event `request/header`, field `data.header.tools[].function.name` (AG0b printed it as `tools[].name` in one place and `tools[].function.name` in another: look at the real event shape in your own run).
- The parent's ambient environment leaks into the tool server unless the patch has an explicit `env:`; only variable names that look like secrets are scrubbed by the harness. So the backend must (a) always write `env:` and (b) start the harness with a minimal environment.
- The SDK takes `api_key=` and `base_url=` as arguments (AG0 used them); `DSH_HOME` is mandatory (`dsh_home=` argument).

## Files you may change (closed list)
1. `vitagraph/backend/app/agent/mcp_server.py` : Part 0 fixes only
2. `vitagraph/backend/tests/test_agent_mcp_server.py` : ADD tests for Part 0 (do not change the 8 existing tests)
3. NEW `vitagraph/backend/app/agent/prompt.py`
4. NEW `vitagraph/backend/app/agent/profile.py`
5. NEW `vitagraph/backend/app/agent/lockdown.py`
6. NEW `vitagraph/backend/tests/fixtures/echo_mcp_server.py` (and an empty `vitagraph/backend/tests/fixtures/__init__.py` if the folder needs it)
7. NEW `vitagraph/backend/tests/test_agent_profile.py`
8. `vitagraph/backend/requirements.txt` : one added line, the pinned SDK (see Step 1)
9. NEW `gemini/reports/TASK_AG2a_report.md`
Forbidden: every other file (in particular `app/main.py`, `app/services/*`, `app/routes/*`, any existing test other than the addition in item 2, `site design/`, `docs/`, `design/`). Never print or commit `.env` or any key.

## Step 0: guard and baseline
```
git branch --show-current
cd "F:\kiruthika\kiruthika final project\vitagraph\backend"
(Get-Item .env).LastWriteTime
.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
```
Branch `redesign/modernist-app`; suite ends with `111 passed`. Note the `.env` time.

## Step 1: install and pin the SDK in the backend venv
```
.venv\Scripts\python.exe -m pip install deepseek-harness-sdk==0.1.5rc1 deepseek-harness-runtime-bin==0.1.5rc1
```
Add to `requirements.txt` (after the `mcp` line): a comment `# DeepSeek Harness SDK and its native runtime for the AI Agent (pre-release, exact versions proven in the spikes)` and the two lines `deepseek-harness-sdk==0.1.5rc1` and `deepseek-harness-runtime-bin==0.1.5rc1`. Run the whole suite: still `111 passed`, otherwise STOP and report BLOCKED.
Read the installed SDK (`.venv\Lib\site-packages\deepseek_harness\`): paste the fields of `DeepSeekHarnessConfig` and answer: **how can the child process be started with a minimal environment?** (an `env` argument? how does the SDK build the child's environment? does it inherit `os.environ`?). Paste the exact lines.

## Step 2: Part 0, the four fixes from the AG1 review (tests first)
Add the tests to `tests/test_agent_mcp_server.py`, run them (they must fail), then fix `mcp_server.py`:
1. `test_reference_numbers_stay_unique_under_parallel_searches`: with one server of persona A, send two `search_reports` calls at the same time with `asyncio.gather` (queries `Hemoglobin` and `Glucose`, `top_k` 8 each) and assert that all returned `ref` values for DIFFERENT `chunk_id`s are different, that the same `chunk_id` always has the same `ref`, and that the union of refs is `1..N` without gaps. Fix: guard `_EvidenceRefs.add` (the whole body) with a `threading.Lock`.
2. `test_format_json_always_returns_valid_json_within_the_limit`: import `_format_json` from `app.agent.mcp_server` and assert, for (a) a payload with three long lists, (b) a payload that is one string of 50,000 characters, (c) a small payload, that `json.loads(result)` works and `len(result) <= 12000`, and that for (a) and (b) the parsed object has `"truncated": true`. Fix `_format_json` so that its last resort returns VALID JSON (for example `{"error": "Result too large", "truncated": true}` or the payload with its biggest string cut and `"truncated": true`); never return a string that is cut in the middle of JSON.
3. Remove the stray `"` at the end of the docstring of `get_measurements`.
4. **Investigation (rule 4):** read `mcp/server/stdio.py` and `mcp/server/mcpserver.py` of the installed 2.3.0 and find out whether the stdio transport can be given explicit input and output streams (so that the process can keep the ORIGINAL stdout for the protocol while `sys.stdout` and file descriptor 1 are redirected to stderr for everything else). If it can, implement it in `main()` and add a test `test_a_stray_print_in_the_server_process_does_not_break_the_protocol`: a tool can not print (do not add a tool); instead start the server with an environment variable `VITAGRAPH_TEST_STDOUT_NOISE=1` which, ONLY when set, makes `main()` run `print("noise")` and `os.write(1, b"noise\n")` right before serving, and assert that the client still initializes and lists the four tools. If the SDK does not support it cleanly, do NOT hack: write what you found (file, lines, why) in the report and change nothing. Either outcome is accepted; an undocumented guess is not.
After the fixes: the whole `test_agent_mcp_server.py` passes (paste the last lines).

## Step 3: tests first for the profile (`tests/test_agent_profile.py`)
Write these tests before the code (they fail now). Use the temporary data root of `tests/conftest.py` (`settings.data_dir` is a temp folder in tests) so nothing is written into the real `backend/data`.
1. `test_the_profile_folders_are_inside_the_agent_data_root_and_the_persona_id_is_checked`: `profile_for("usr_abc123")` creates `<data_dir>/agent/usr_abc123/{home,ws,patches}`; the ids `""`, `"../x"`, `"usr a"`, `"usr/x"`, `"a"*200` raise `ValueError`.
2. `test_the_lock_patch_disables_both_shells_and_restates_the_sandbox_row`: the generated lock patch text, parsed as YAML (use `yaml.safe_load` only if PyYAML is installed in the venv; otherwise a small line-based check; check with `pip list`; do NOT add PyYAML to requirements), contains `persistent-pwsh` and `persistent-bash` with `disabled: true` and a `sandbox-policy` row with `mode: read-only`, the name `@deepseek-ai/dsh-sandbox-policy` and the literal absolute workspace path (no `process.cwd()`).
3. `test_the_mcp_patch_sets_the_persona_explicitly_and_contains_no_secret`: the MCP patch text has `- insert:`, `@deepseek-ai/dsh-mcp-client`, `serverName: vitagraph`, `transport: stdio`, `env:` with `VITAGRAPH_USER_ID` equal to the persona and the four database variables (`DATA_DIR`, `UPLOADS_DIR`, `DB_PATH`, `CHROMA_DIR`) equal to the current `settings`, and `cwd` equal to the backend folder; it contains neither `api_key`, nor `KEY`, nor `TOKEN` (case-insensitive), nor any value from `settings.effective_api_key` when that is non-empty.
4. `test_the_prompt_patch_replaces_the_system_prompt`: the prompt patch text contains the full `AGENT_SYSTEM_PROMPT` (JSON-quoted string is acceptable YAML), targets `system-prompt`, `personaPrefix`.
5. `test_the_agent_prompt_keeps_every_boundary_of_the_chat_prompt`: `AGENT_SYSTEM_PROMPT` contains the substrings `Never diagnose`, `Never recommend`, `urgent`, `General information (not from your reports):`, `[1]`, and the four tool names `list_reports`, `search_reports`, `get_measurements`, `graph_lookup`; it contains no word `shell`, `bash`, `PowerShell`, `file system`.
6. `test_the_child_environment_is_minimal`: with `os.environ` temporarily containing `VITAGRAPH_USER_ID=ambient_user`, `AG2_CANARY=leak`, `DEEPSEEK_API_KEY=sk-canary`, `AGENTROUTER_API_KEY=sk-canary2`, the function `child_environment()` returns a dict that contains none of those four names and only names from a small allow-list (`PATH`, `PATHEXT`, `SystemRoot`, `SYSTEMROOT`, `WINDIR`, `COMSPEC`, `TEMP`, `TMP`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `HOME`, `PYTHONIOENCODING`).
7. `test_lockdown_check_accepts_exactly_the_four_tools_and_refuses_anything_else` (pure function, no harness): `assert_locked_down(names)` returns silently for exactly the sorted four names `mcp__vitagraph__get_measurements`, `mcp__vitagraph__graph_lookup`, `mcp__vitagraph__list_reports`, `mcp__vitagraph__search_reports`; raises `LockdownViolation` for an extra name (`pwsh`), for a missing name, and for an empty list.
8. `test_a_real_runtime_is_locked_down_and_the_persona_cannot_be_overridden` (real harness against the dead URL, slow, about 10 to 20 s): see Step 5.
Run the file now: all fail (module missing). Paste the last lines.

## Step 4: implement (behavior; you write the code in the style of the surrounding files)
- `app/agent/prompt.py`: `AGENT_SYSTEM_PROMPT` (a module constant). Base it on `CHAT_SYSTEM_PROMPT` in `app/services/chat_service.py` (read it): same conversational style, same BOUNDARIES (every one), same rule of citing evidence numbers in square brackets and the label `General information (not from your reports):`; but written for TOOLS: it names `list_reports`, `search_reports`, `get_measurements`, `graph_lookup`, says that a reference number belongs to the evidence cards returned by `search_reports`, that numbers continue across the conversation, that the assistant has no other tools and must never claim to run commands or read files, and that earlier turns of the conversation are given as context. It must not mention any provider or model name.
- `app/agent/profile.py`:
  - constant `TOOL_NAMES` (the four sorted `mcp__vitagraph__...` names).
  - `class PersonaProfile` (frozen dataclass): `persona_id`, `home`, `workspace`, `patch_files` (tuple of `Path`).
  - `agent_root()` returns `settings.data_dir / "agent"`.
  - `lock_patch_text(workspace: Path) -> str`, `mcp_patch_text(persona_id, command, args, cwd, env_extra) -> str`, `prompt_patch_text(prompt: str) -> str`, `fast_fail_patch_text() -> str`. Strings inside the YAML are written with `json.dumps(value)` (a valid YAML double-quoted scalar, handles Windows backslashes). No secret ever goes into a patch.
  - `profile_for(persona_id, *, mcp_command=None, mcp_args=None, mcp_env_extra=None, fast_fail=False) -> PersonaProfile`: validates the id (`^[A-Za-z0-9_-]{1,64}$`), creates the folders, writes `lock.patch.yml`, `mcp.patch.yml`, `prompt.patch.yml` (+ `fast-fail.patch.yml` when `fast_fail`), and returns the profile. Defaults: `mcp_command=sys.executable`, `mcp_args=["-m", "app.agent.mcp_server"]`, `cwd` = the backend folder, `env` = `VITAGRAPH_USER_ID` + the four database variables from `settings` + `PYTHONIOENCODING=utf-8` + `mcp_env_extra`.
  - `child_environment() -> dict[str, str]`: the minimal environment of test 6.
- `app/agent/lockdown.py`:
  - `class LockdownViolation(RuntimeError)`.
  - `assert_locked_down(tool_names)` (test 7).
  - `tool_names_from_events(events) -> list[str]`: finds the last `request/header` event and returns the sorted tool names (handle both event shapes you meet in Step 5; raise `LockdownViolation` if there is no `request/header` event).
  - `verify_lockdown(persona_id, *, harness_factory=None) -> list[str]`: builds `profile_for(persona_id, fast_fail=True)`, starts a harness with `profile="sdk-minimal"`, `patches` = the profile's patch files, `api_key="probe-token"`, `base_url="http://127.0.0.1:9/v1"`, the minimal child environment, runs the prompt `hello` in a fresh session id, closes the harness in a `finally`, derives the tool names, calls `assert_locked_down`, returns them. `harness_factory` lets tests inject a fake. Cache successful results in a module dictionary keyed by a hash of the patch file contents (so a changed profile is checked again).
  - The SDK is synchronous; do not wrap it in asyncio here.

## Step 5: the real-runtime test and the ambient-environment proof (test 8)
`tests/fixtures/echo_mcp_server.py`: a tiny server with the 2.3.0 API that offers the four real tool NAMES (with dummy bodies returning `{}`) and, at start-up, writes the JSON file whose path is its first command-line argument with `{"persona": os.environ.get("VITAGRAPH_USER_ID"), "canary": os.environ.get("AG2_CANARY"), "deepseek_key": os.environ.get("DEEPSEEK_API_KEY"), "agentrouter_key": os.environ.get("AGENTROUTER_API_KEY")}`.
Test 8: with `os.environ` temporarily set to `VITAGRAPH_USER_ID=ambient_user`, `AG2_CANARY=leak`, `DEEPSEEK_API_KEY=sk-canary`, `AGENTROUTER_API_KEY=sk-canary2`, call `verify_lockdown("usr_test_ag2", ...)` with a profile whose MCP command is `sys.executable` and args `[<echo server path>, <output file>]` (use the `mcp_command` / `mcp_args` parameters; `verify_lockdown` must accept an optional `profile` argument for this). Assert: it returns the four tool names; the output file shows `persona == "usr_test_ag2"` (NOT `ambient_user`), `canary is None`, both keys `None`. Also assert that after the test no `dsh` process of this test is left (check by process id recorded from the SDK or by listing `dsh*` processes before and after; remember that other programs on this machine may run unrelated `node` processes).
Also prove the key hygiene: run the real-runtime path once with `api_key="AG2-CANARY-KEY-123456"` and afterwards search every file under the persona's `home` and `patches` folders for that string; assert it is nowhere (tell in the report whether the SDK passes it through the environment or the JSON-RPC and how you know).
Mark test 8 with a comment saying it takes about 15 seconds. The total added test time of this task should stay under 90 seconds.

## Step 6: verify
1. `pytest tests/test_agent_profile.py -q -p no:cacheprovider` all pass; `pytest tests/test_agent_mcp_server.py -q -p no:cacheprovider` all pass.
2. Whole suite: `111` old + your new tests, all passed (paste the last line). If an existing test fails, STOP and report BLOCKED.
3. Print once, in the report, the generated `lock.patch.yml`, `mcp.patch.yml` (persona `usr_test_ag2`) and the first 400 characters of `prompt.patch.yml`, from a temp data root, with no secret.
4. Run `dsh.exe --profile sdk-minimal` with those patches and `--dump-config` using `$env:DSH_HOME` set to the persona's home, and paste the lines of the rows `persistent-pwsh`, `persistent-bash`, `sandbox-policy`, `mcp-vitagraph`, `system-prompt`: proof that the generated patches produce the effective tree you intend (exactly one `sandbox-policy` row, `mode: read-only`).
5. `git status --short vitagraph` lists only the files of the closed list; `.env` last-write time equals Step 0; nothing of this task was written into `vitagraph/backend/data` (the real folder; list `data\agent` if it exists and say so).

## Step 7: work report
`gemini/reports/TASK_AG2a_report.md`, nine headings (RULES 5b). Section 3 line counts from `git diff --stat`. Section 6 must contain: the answer about the minimal child environment (Step 1), the investigation result of Part 0 item 4 (with file names and line numbers), every difference between the real `request/header` event shape and what this task assumed, where the API key travels, and a table "Safety property | Where enforced | Test".

## COMMIT
Stage ONLY the paths of the closed list, by explicit path (new folders by their files):
```
git add vitagraph/backend/app/agent/mcp_server.py vitagraph/backend/app/agent/prompt.py vitagraph/backend/app/agent/profile.py vitagraph/backend/app/agent/lockdown.py vitagraph/backend/tests/test_agent_mcp_server.py vitagraph/backend/tests/test_agent_profile.py vitagraph/backend/tests/fixtures vitagraph/backend/requirements.txt gemini/reports/TASK_AG2a_report.md
git commit -m "feat(agent): locked-down harness profile, agent prompt, start-up safety check; MCP server fixes"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```
`git show --stat HEAD` must list only those files.

## ACCEPTANCE (PASS/FAIL each with evidence)
- Part 0: the four fixes done with tests that failed first (item 4 either implemented or documented).
- Tests 1 to 8 of the profile file pass; the real runtime is locked down (exactly the four tools) and the persona seen by the tool server is the one in the patch even with a hostile ambient environment; canaries do not reach the server; the canary API key is on disk nowhere under the persona folders.
- The generated patches produce the intended effective tree (Step 6.4).
- Full suite green; `requirements.txt` pins the SDK; `.env` untouched; no orphan process; real `data` folder untouched; only closed-list files committed; branch correct.
