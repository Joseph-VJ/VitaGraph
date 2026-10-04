# AI Agent on the real DeepSeek Harness: staged plan

Decided by the user on 2026-10-04: the Ask page becomes **"AI Agent"** and runs on the real open-source **DeepSeek Harness** (`dsh`, https://github.com/deepseek-ai/deepseek-harness, MIT, developer preview). The old Ask page is replaced ("nuked"), not kept beside it. Work is done ONE stage at a time by Gemini; Claude only writes the task and reviews.

## What the harness is (read-only research, no experiments by the reviewer)
- A plugin-based agent framework (TypeScript, Cordis). Everything is a plugin: model adapter, tool registry, session log, the agent loop.
- Events: durable session events `turn/start`, `step/start`, `system/message`, `user/message`, `request/header`, `request/context`, `assistant/message`, `assistant/attempt`, `tool/call`, `tool/result`, `step/end`, `turn/end`, `session/title`. A step is one model request plus its tool calls; a turn is zero or more steps.
- Python SDK `deepseek-harness-sdk` (0.1.5rc1, installs with `pip install --pre` on Windows x64; brings its own native `dsh.exe`, no system Node needed). `DeepSeekHarness(dsh_home=..., cwd=..., profile="sdk-minimal", patches=(...), model=...)` then `.run(prompt, session_id=...)` returns `RunResult(final_response, finish_reason, events, notifications)`. It talks JSON-RPC over stdio to the subprocess.
- Credentials from the environment: `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`.
- Tools can come from MCP servers: a row `@deepseek-ai/dsh-mcp-client` with `transport: stdio`, `command`, `args`, `env`. Tool names become `mcp__<serverName>__<tool>`.
- Config layers are YAML patch files (`--patch file.yml`); `--dump-config` prints the effective tree.

## DANGER the plan must neutralise (non-negotiable)
`SAFETY.md` of the harness: experimental, **not security audited**, can execute model-written commands, read and delete files, use the network. The shipped `sdk-minimal` profile mounts a PowerShell tool and sets `sandbox-policy mode: danger-full-access`. VitaGraph holds health data, so EVERY harness run in this project must use a lock-down patch: `persistent-pwsh` and `persistent-bash` disabled, `sandbox-policy` set to `read-only`, and the only tools the model can see are the VitaGraph MCP tools. Every stage that starts a harness must prove this with the tool list the model is actually offered.

## Fixed rules for all stages
1. The hard gates of the existing chat stay in VitaGraph code and run OUTSIDE the harness: the clinical-boundary refusal and prompt-injection sanitising BEFORE the model is called, the diagnostic-phrase check AFTER the answer. The harness never decides these.
2. Persona isolation: the persona id reaches the VitaGraph MCP server through its process environment (set by our backend per run), never through a tool argument the model can choose.
3. The real API key stays in the backend. No provider or model names appear in the UI (the page says "AI Agent").
4. If the AI API does not work (RULES 5d) record it and move on; the user will switch to a paid API.
5. The backend keeps its pytest suite green (103 passing at the start of this plan); new backend code gets tests that need no real model (a fake harness object).
6. The wire contract to the browser stays the existing SSE contract (`thinking`, `tool_call`, `tool_result`, `text_delta`, `model_fallback`, `completed`, `error`) plus new harness-style events defined in stage AG1.

## Stages (one Gemini task each, in this order)
| Stage | Owner of the work | What |
|---|---|---|
| **AG0** | Gemini | **Spike and proof, no repo code.** Install the SDK in a temp folder, prove the lock-down patch, list the tools the model is offered (before/after lock), prove an MCP tool is advertised and persona-bound, capture the real event vocabulary, measure start-up and concurrency, record API status. Deliverable: a factual report. Task file: `TASK_AG0_harness_spike.md`. |
| **AG0b** | Gemini | **Follow-up spike, no repo code.** Closes the five gaps found in the AG0 review: persona delivery through the harness config (and no ambient leak), live event streaming, per-turn cancel, cost of one runtime per persona (memory, start-up), and configuration facts (supported MCP plugin form, system prompt patch, fast-fail retry patch, session resume and delete). Task file: `TASK_AG0b_harness_followup.md`. |
| **AG1** | Gemini | **VitaGraph MCP tool server** (`app/agent/mcp_server.py`, stdio, persona ONLY from the process environment): tools `list_reports`, `search_reports` (evidence cards with unique reference numbers), `get_measurements`, `graph_lookup`; every `report_id` argument is checked against the persona; the `mcp` package is pinned; tests use the MCP client library, no harness and no model. Task file: `TASK_AG1_mcp_tool_server.md`. |
| **AG2a** | Gemini | **Locked-down profile and start-up safety check** (`app/agent/prompt.py`, `profile.py`, `lockdown.py`): per-persona `dsh_home` and workspace, generated lock-down / MCP (explicit `env:`) / system-prompt patches, a minimal child environment, `verify_lockdown` (starts a harness against the dead URL and proves from `request/header` that exactly the four VitaGraph tools are offered), SDK pinned; plus Part 0: the four fixes from the AG1 review (thread-safe reference numbers, valid truncated JSON, docstring, stdout investigation). Task file: `TASK_AG2a_profile_lockdown.md`. |
| AG2b | Gemini | **Runtime pool and turn streaming**: keyed pool of runtimes (lazy start, idle close, maximum, one turn at a time per persona), `stream_turn` as an async iterator over the harness notifications, cancel = close that persona's runtime, persona deletion hook (close + delete `dsh_home`), live monitor of `request/header` on every real turn (defense in depth), tests with a fake harness. |
| AG3 | Gemini | **SSE route and mapper**: `POST /api/agent/stream`; hard gates outside the harness (boundary refusal and injection sanitising BEFORE the model, diagnostic-phrase check AFTER); a NEW harness session per user turn with the earlier turns sent as context; mapper from harness notifications (`session.event`, `llm/retry`, `tool/call`, `tool/result`, `assistant/message`, `step/*`, `turn/*`, `session/title`) to the existing SSE contract plus `retry`, `step`, `stats` events; persistence of the turn; documented-shape mapping (the shapes of the model events can only be verified with the paid API). |
| AG4 | Gemini | **Frontend**: rename Ask to **AI Agent** (route `/agent`, `/ask` redirects and keeps its query string; sidebar label, header title), delete the old Ask components, consume `/api/agent/stream`, harness-style UI: trajectory timeline (turns, steps, tool calls, retries), live stats strip (turns, steps, tool calls, elapsed), tool-call cards with arguments and results; keep citation chips and the highlighted passage slip from Task 09. |
| AG5 | Gemini | **Conversations**: list, reopen and delete the persona's conversations from VitaGraph's own database (the harness has no such API), conversation titles from the harness `session/title` event. |
| AG6 | Gemini + Claude review | Safety test suite (no shell tool offered, persona isolation including the ambient-leak case, boundary refusal before the model, diagnostic phrase after), docs update (`CLAUDE.md`, `AGENTS.md`, `docs/`), final QA with the paid API when the user has switched (this is also when the shapes of `tool/call`, `tool/result`, `assistant/message` are verified). |

## Design consequences found by the AG0 review (binding for AG1 and AG2)
- **One runtime per persona.** The persona id reaches the VitaGraph MCP server through that server's process environment, which is fixed when a runtime starts. A single shared "warm" runtime can therefore serve only one persona. AG1 must use a small keyed pool: one runtime (own `dsh_home`, own patch with `env: VITAGRAPH_USER_ID`) per persona, started lazily, closed when idle or when the persona is deleted. Whether that is affordable is measured in AG0b (memory and start-up numbers).
- **Lock-down is proven by `request/header` -> `data.header.tools`.** Every harness start in the backend must be followed by a check of that field (only the VitaGraph MCP tools allowed); if anything else is offered the run is refused. Test this in AG1/AG5.
- **Never `close()` a shared runtime to stop one turn** (it kills the runtime). Use the per-turn cancel found in AG0b, or stop only that persona's runtime.
- **Patches replace a row's WHOLE config.** The lock patch must restate `name` and `workspaceRoot` (literal absolute path of an empty workspace folder) for the `sandbox-policy` row. Adding a row needs `- insert:`.
- **Failures take about 15 s** with the default retry policy; AG0b finds the fast-fail patch for tests, and the UI must show the failure state honestly while waiting.
- The system prompt must be replaced by a patch (the default is "You are a helpful software engineer assistant.") with a health-report assistant prompt that also tells the model to cite evidence numbers.

## Binding results of the AG0b review (these REPLACE the open points above)
- **Supported MCP form:** `name: '@deepseek-ai/dsh-mcp-client'`, `config: { serverName, transport: stdio, command, args, env }`, added with `- insert:`. `@deepseek-ai/dsh-mcp` does not exist.
- **Persona leak:** without an explicit `env:` block the parent's ambient `VITAGRAPH_USER_ID` reaches the tool server. The backend ALWAYS writes `env:` and starts the harness with a minimal scrubbed environment; AG2 tests both.
- **No per-turn cancel, no resume, no session list/delete in the SDK.** Cancel = close that persona's runtime (0.16 s; restart about 3 s). A new harness session per user turn; VitaGraph sends earlier turns as context and owns the conversation list. Deleting a persona = close its runtime, delete its `dsh_home`.
- **Cost:** about 170 MB per runtime (harness 103 MB + tool server 65 MB; the 270 MB in the AG0b report wrongly included two unrelated `node` processes), cold start about 3 s. Five personas about 0.85 GB.
- **Events stream live** through `on_notification` (`session.event`, `session.status`, `subagent.started`, `subagent.finished`); retries are visible (`llm/retry`, `llm/retry-started`). `- id: llm-retry` + `disabled: true` makes failures fast for tests only.
- **`mcp` package is 2.3.0** (server class `MCPServer`); pin the exact version in `requirements.txt`.

Task 09b (citations, passage slip) is not wasted: AG4 reuses its components. If Gemini has not yet finished 09b, finish it first.
