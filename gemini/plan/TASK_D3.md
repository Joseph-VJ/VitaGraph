<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task D3 — Mapper reads the harness's real field names

- **Goal:** The event mapper reads the retry number from the harness's own field `retry`, and shortens tool names of both MCP servers.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `vitagraph/backend/app/agent/mapper.py` lines 198–226 (anchor `prefix = "mcp__vitagraph__"`) and lines 272–281 (anchor `attempt = d.get("attempt") if isinstance(d.get("attempt"), int) else self._retries`)
  - `vitagraph/backend/tests/test_agent_mapper.py`
- **Files to create or modify:**
  - modify `vitagraph/backend/app/agent/mapper.py`
  - create `vitagraph/backend/tests/test_agent_mapper_harness_fields.py`

**What to change**
1. **Retry number:** `vitagraph/backend/app/agent/mapper.py` line 275 (anchor `attempt = d.get("attempt")`). Take the attempt from `retry` when it is an integer (the harness field), else from `attempt` when it is an integer, else from the counter.
   - The existing test that feeds `{"attempt": 1}` and expects 1, then `{}` and expects 2, keeps passing.
   - The `provider` field is never copied into any event (rule 6).
2. **Tool names:** `vitagraph/backend/app/agent/mapper.py` lines 202–203 (anchor `prefix = "mcp__vitagraph__"`). Strip either prefix, `mcp__vitagraph__` or `mcp__vgartifacts__`, to get the short tool name. Apply the same rule wherever the mapper shortens names.
3. **Tests:** create `vitagraph/backend/tests/test_agent_mapper_harness_fields.py`.
   - **`test_retry_uses_the_harness_field`:** feeding `llm/retry` with `{"retry": 3, "provider": "x"}` gives `attempt` 3, and the word "x" appears in no payload.
   - **`test_artifact_tool_names_are_shortened`:** a `tool/call` named `mcp__vgartifacts__show_code` gives tool `show_code`.

**How to verify**
1. `.venv\Scripts\python.exe -m pytest tests\test_agent_mapper.py tests\test_agent_mapper_harness_fields.py -q -p no:cacheprovider`. Both files pass.
2. Full suite: baseline + 2.

**Acceptance criteria**
- [ ] `retry` is read first, and the old test still passes.
- [ ] Both prefixes are shortened.
- [ ] Full suite: baseline + 2.
