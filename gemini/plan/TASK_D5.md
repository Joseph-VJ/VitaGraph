<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task D5 — Artifact MCP server and the opt-in lockdown

- **Goal:** Give the agent two artifact tools, `show_code` and `create_report`, through a second MCP server. Personas get it only when `agent_artifacts` is on. The default four-tool lockdown is unchanged.
- **Tier:** Could
- **Size:** M
- **Review:** gate
- **Depends on:** D3, D4
- **Files to read first:**
  - `vitagraph/backend/app/agent/mcp_server.py` lines 20–40 (anchor `def _persona() -> str:`) and lines 143–150 (anchor `def create_server(persona: str) -> MCPServer:`)
  - `vitagraph/backend/app/agent/profile.py` lines 17–22 (anchor `TOOL_NAMES = (`), lines 43–48 (anchor `class PersonaProfile:`), lines 72–90 (anchor `def mcp_patch_text(`) and lines 145–192 (anchor `def profile_for(`)
  - `vitagraph/backend/app/agent/lockdown.py` lines 19–26 (anchor `def assert_locked_down(tool_names: list[str]) -> None:`) and lines 57–66 (anchor `prof = profile or profile_for(persona_id, fast_fail=True)`)
  - `vitagraph/backend/app/agent/runtime.py` lines 290–294 (anchor `assert_locked_down(tool_names)`)
  - `vitagraph/backend/app/agent/pool.py` line 145 (anchor `prof = profile_for(persona_id)`)
  - `vitagraph/backend/app/agent/prompt.py`
  - `vitagraph/backend/tests/test_agent_profile.py` lines 110–129 (anchor `def test_the_agent_prompt_keeps_every_boundary_of_the_chat_prompt():`)
- **Files to create or modify:**
  - create `vitagraph/backend/app/agent/artifact_server.py`
  - modify `vitagraph/backend/app/agent/profile.py`
  - modify `vitagraph/backend/app/agent/lockdown.py`
  - modify `vitagraph/backend/app/agent/runtime.py`
  - modify `vitagraph/backend/app/agent/pool.py`
  - modify `vitagraph/backend/app/agent/prompt.py`
  - modify `vitagraph/backend/app/core/config.py`
  - create `vitagraph/backend/tests/test_agent_artifact_tools.py`

**What to change**
1. **Create `artifact_server.py`**, modelled on `mcp_server.py`: the same `_persona()` environment check, a `create_server(persona)` function that builds an `MCPServer("vgartifacts")`, and a `main()` that runs it on stdio. The server has exactly two tools:
   - **`show_code(title, language, code)`:** calls `artifact_service.create_code` for the persona, with the conversation ID from the environment variable `VITAGRAPH_CONVERSATION_ID` when it is set.
   - **`create_report(format, title)`:** calls `artifact_service.create_report`.
   
   Both return JSON text `{"artifact": {...summary...}}`, and `{"error": "<reason>"}` on a `ValueError`. The tool descriptions say plainly that they only display code or file a report built from the stored data, and never read anything new.
2. **`profile.py`:**
   - **`ARTIFACT_TOOL_NAMES`:** a tuple of `mcp__vgartifacts__create_report` and `mcp__vgartifacts__show_code`.
   - **`PersonaProfile`:** add a final field `artifacts: bool = False`. The dataclass stays frozen, and existing constructions keep working.
   - **`artifact_mcp_patch_text(persona_id, command, args, cwd, env_extra=None)`:** the same YAML shape as `mcp_patch_text`, but for the server name `vgartifacts` and the module `app.agent.artifact_server`. `mcp_patch_text` stays byte-for-byte unchanged, because a test pins it.
   - **`profile_for(..., artifacts: bool = False)`:** a new keyword. When true, it writes `artifacts.patch.yml` with that text, adds it to `patch_files`, writes the prompt patch with `agent_prompt(True)` instead of `AGENT_SYSTEM_PROMPT`, and returns `artifacts=True`.
3. **`lockdown.py`:**
   - `assert_locked_down(tool_names, *, allow_artifacts=False)`: the expected set is `TOOL_NAMES`, plus `ARTIFACT_TOOL_NAMES` only when `allow_artifacts` is true. Anything else raises `LockdownViolation`, as today.
   - `verify_lockdown_async` passes `allow_artifacts=prof.artifacts`.
4. **`runtime.py`:** at line 294 (anchor `assert_locked_down(tool_names)`), pass `allow_artifacts` from the profile the runtime was started with.
5. **`pool.py`:** at line 145 (anchor `prof = profile_for(persona_id)`), pass `artifacts=settings.agent_artifacts`.
6. **`config.py`:** add `agent_artifacts: bool = True` next to `allow_api` (`vitagraph/backend/app/core/config.py` line 42, anchor `allow_api: bool = False`).
7. **`prompt.py`:** keep `AGENT_SYSTEM_PROMPT` exactly as it is; tests pin it. Add `agent_prompt(artifacts: bool) -> str`:
   - With false, it returns `AGENT_SYSTEM_PROMPT`.
   - With true, it returns the same text with two replacements:
     - "four specialized health tools and NO other tools:" becomes "four specialized health tools for reading the person's data:";
     - the line "- You have no other tools. You must never claim to execute system commands or access external files." becomes "- Besides these four and the two display tools below, you have no tools. You cannot run commands or open files; never claim to."
     
     Then it appends a "DISPLAY TOOLS" section: `show_code` displays code you wrote for the person (title, language, code). `create_report` files an HTML or PDF report built by VitaGraph from their stored reports. Never put values in a report yourself; the report is built from the stored data.
   - The variant must also avoid the words shell, bash, powershell and "file system".
8. **Tests:** create `vitagraph/backend/tests/test_agent_artifact_tools.py`.
   - **`test_the_artifact_server_offers_exactly_two_tools`:** list the tools of `artifact_server.create_server(<persona id>)` the same way `tests/test_agent_mcp_server.py` lists the four, and expect exactly `create_report` and `show_code`.
   - **`test_lockdown_accepts_six_only_when_artifacts_are_allowed`:**
     - the six names pass with `allow_artifacts=True`;
     - the same six fail without it;
     - five names plus an unknown one fail with it.
   - **`test_default_profile_writes_no_artifact_patch`:** `profile_for` with a valid ID writes no `artifacts.patch.yml`, while `profile_for(..., artifacts=True)` writes it and returns `artifacts=True`.

**How to verify**
1. `.venv\Scripts\python.exe -m pytest tests\test_agent_artifact_tools.py tests\test_agent_profile.py tests\test_agent_mcp_server.py -q -p no:cacheprovider`. All pass. The two older files prove the four-tool lockdown is unchanged.
2. Full suite: baseline + 3.

**Acceptance criteria**
- [ ] The default lockdown still accepts exactly the four tools, and the three pinned tests pass unchanged.
- [ ] Artifact tools appear only in profiles built with `artifacts=True`.
- [ ] `AGENT_SYSTEM_PROMPT` is unchanged (`git diff` shows only the added function).
- [ ] Full suite: baseline + 3.
