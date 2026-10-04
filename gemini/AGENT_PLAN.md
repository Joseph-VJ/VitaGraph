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
| AG1 | Gemini | Backend runner: `app/agent/` module (lock-down profile generator, harness runner, event mapper), `POST /api/agent/stream` SSE, hard gates around it, persistence of the turn, dependency pinned, tests with a fake harness. |
| AG2 | Gemini | VitaGraph MCP tool server (stdio, persona from env): `search_reports` (evidence cards with ref numbers, as today), `graph_lookup`, `get_measurements`, `compare_reports`; tests; proof that a tool cannot read another persona. |
| AG3 | Gemini | Frontend: rename Ask to **AI Agent** (route `/agent`, `/ask` redirects and keeps its query string; sidebar label, header title), delete the old Ask components, consume `/api/agent/stream`, harness-style UI: trajectory timeline (turns, steps, tool calls), live stats strip (turns, steps, tool calls, elapsed), tool-call cards with arguments and results; keep citation chips and the highlighted passage slip from Task 09. |
| AG4 | Gemini | Sessions: list, resume and delete the persona's agent sessions, session titles from the harness. |
| AG5 | Gemini + Claude review | Safety test suite (no shell tool offered, persona isolation, boundary refusal before the model, diagnostic phrase after), docs update (`CLAUDE.md`, `AGENTS.md`, `docs/`), final QA with the paid API when the user has switched. |

Task 09b (citations, passage slip) is not wasted: AG3 reuses its components. If Gemini has not yet finished 09b, finish it first.
