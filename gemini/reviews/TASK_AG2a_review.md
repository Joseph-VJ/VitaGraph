# Review of TASK AG2a (reviewer: Claude)

**Verdict: ACCEPTED, with ONE design defect that must be removed first thing in AG2b (Part 0).** Commit `99b5ad5` on `redesign/modernist-app`.

## What I checked (read the code and the report myself)
- `git show --stat HEAD`: exactly the closed list (`mcp_server.py`, `prompt.py`, `profile.py`, `lockdown.py`, `tests/fixtures/{__init__,echo_mcp_server}.py`, `tests/test_agent_mcp_server.py`, `tests/test_agent_profile.py`, `requirements.txt`, the report). No other file touched. `requirements.txt` pins `mcp==2.3.0`, `deepseek-harness-sdk==0.1.5rc1`, `deepseek-harness-runtime-bin==0.1.5rc1`.
- `.env` untouched (same last-write time). The real `backend/data` folder has no `agent` folder (tests wrote only into the temporary data root). No `dsh`/`deepseek` process left. Ports free.
- Part 0 fixes are real: a `threading.Lock` inside `_EvidenceRefs.add` plus a `search_lock` around retrieval; `_format_json` now has three levels (trim lists, trim long strings, last resort `{"error": "Result too large", "truncated": true}`) and always returns valid JSON; the stray quote is gone.
- **Part 0 item 4 is answered well and settles the question:** the MCP 2.3.0 `stdio_server` already moves file descriptor 1 to a private copy and points fd 1 at stderr while serving (`mcp/server/stdio.py`), so a stray `print()` in the server process cannot reach the protocol. My AG1 concern was handled by the library. Nothing to change. Thank you for reading the source instead of guessing.
- The generated patches (printed in the report) are what the design needs: both shells `disabled: true`; one `sandbox-policy` row with `mode: read-only` and a literal workspace path; MCP row with `@deepseek-ai/dsh-mcp-client`, explicit `env:` with the persona and the four database variables, no secret; system-prompt row. The `--dump-config` output confirms exactly one `sandbox-policy` row.
- Real-runtime test: exactly the four tools are offered; the tool server saw `persona == usr_test_ag2` although the parent process had `VITAGRAPH_USER_ID=ambient_user`; the canary variable and both canary keys did not reach it; the canary API key is on disk nowhere under the persona folders. The SDK passes the key only as the environment variable `DEEPSEEK_API_KEY` of `dsh.exe`.

## The defect (must be removed in AG2b Part 0): `verify_lockdown` rewrites the whole process environment
Your finding that the SDK always starts from a copy of `os.environ` (`client.py:76-78`) is right and valuable. But the way `verify_lockdown` copes with it is unsafe:
```
os.environ.clear(); os.environ.update(child_env)   # ... harness.start() ... then restore
```
`os.environ` is process-wide. The backend is a threaded server: for the 3 seconds of a harness start, EVERY other thread sees a stripped environment (for example the embedding-model loader reading its cache variables, HTTP clients reading proxy settings). Worse, there is no lock: if two personas start at the same time, the second call saves the first call's already stripped environment as "the original" and restores THAT, which leaves the whole backend permanently with a stripped environment. The next task (the runtime pool) starts runtimes concurrently, so this would become a real bug.
The clean solution is not a lock but not touching the parent at all: host the harness in a small **worker process that the backend starts with an explicit minimal environment** (`subprocess.Popen(..., env=child_environment())`); the worker uses the SDK (its environment is minimal by construction), talks to the backend by JSON lines over its pipes, and killing that worker (plus its children) is also exactly the per-persona cancel that AG0b found to be the only cancel. This is the design of AG2b.

## Smaller points
- The task asked the real-runtime test to assert that no `dsh` process of the test is left; the test does not assert it (you checked by hand). Add the assertion in AG2b.
- In `verify_lockdown`, if `harness.start()` raises, `harness.close()` is never called (the `try/finally` that closes starts after the start). AG2b removes this function body anyway; make sure the new version always closes.
- `tool_names_from_events` raises "No request/header event found with tools" even when the header exists but offers an empty list (the strongest violation case: the MCP server failed to start). Give the empty case its own clear message.
- Your section 3 repeats the line-count mistake: `mcp_server.py` is not `+127/-55`. `git show --stat` prints the TOTAL number of changed lines (127) next to the file; the real figures are 72 insertions and 55 deletions (the commit total is 1107 insertions and 55 deletions, and all 55 deletions are in that file). Use `git diff --numstat HEAD~1 HEAD` to get the two numbers per file.
- The prompt calls the tools `search_reports`, etc., while the model will see `mcp__vitagraph__search_reports`. Probably harmless; re-check when a paid API allows a real run (AG6).

## Notes on how you worked
Very good: failing-first evidence for the JSON and profile tests, honest source reading for items 1 and 4, the canary design, and an accurate explanation of where the key travels. Please use `--numstat` from now on.

## Must fix
Part 0 of AG2b: replace the `os.environ` rewrite by the worker process, with a test that proves the parent's `os.environ` never changes.
