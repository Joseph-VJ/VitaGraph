# TASK T1 Summary: AI connection (Backend)

## Status
COMPLETE

## Files changed
### `git diff --numstat`
```
93	28	vitagraph/backend/app/core/config.py
186	2	vitagraph/backend/app/routes/ai.py
```
`vitagraph/backend/app/agent/runs.py`: added `RunRegistry.any_running()` (+9 lines, 285 total lines)

### New test files created
- `vitagraph/backend/tests/test_env_writer.py` (155 lines)
- `vitagraph/backend/tests/test_ai_model_connection.py` (289 lines)

## Ladder results
- **25 %**: Part A done, `pytest tests/test_env_writer.py -q` green (9 passed in 0.28s)
- **50 %**: Part B + C done (config + registry), `pytest tests/test_env_writer.py tests/test_ai_privacy.py tests/test_agent_runs.py -q` green (29 passed in 3.98s)
- **75 %**: Part D done (routes), `pytest tests/test_ai_model_connection.py -q` green (14 passed in 2.07s)
- **90 %**: Targeted 5 test suites green (52 passed in 5.88s); full test suite green (778 passed in 389.26s)
- **100 %**: Live check done against scratch environment and fake model server, ports verified free, report written

## Test output (pasted verbatim)

### 1. Targeted 5-suite check
Command:
```powershell
$env:PYTHONPATH = "F:\kiruthika\kiruthika final project\vitagraph\backend"; & "F:\kiruthika\kiruthika final project\vitagraph\backend\.venv\Scripts\python.exe" -m pytest "F:\kiruthika\kiruthika final project\vitagraph\backend\tests\test_env_writer.py" "F:\kiruthika\kiruthika final project\vitagraph\backend\tests\test_ai_model_connection.py" "F:\kiruthika\kiruthika final project\vitagraph\backend\tests\test_ai_privacy.py" "F:\kiruthika\kiruthika final project\vitagraph\backend\tests\test_agent_runs.py" "F:\kiruthika\kiruthika final project\vitagraph\backend\tests\test_agent_route.py" --rootdir="F:\kiruthika\kiruthika final project\vitagraph\backend" -q -p no:cacheprovider
```
Output:
```
....................................................                     [100%]
52 passed in 5.88s
```

### 2. Full test suite
Command:
```powershell
$env:PYTHONPATH = "F:\kiruthika\kiruthika final project\vitagraph\backend"; & "F:\kiruthika\kiruthika final project\vitagraph\backend\.venv\Scripts\python.exe" -m pytest "F:\kiruthika\kiruthika final project\vitagraph\backend\tests" --rootdir="F:\kiruthika\kiruthika final project\vitagraph\backend" -q -p no:cacheprovider
```
Output:
```
........................................................................ [  9%]
........................................................................ [ 18%]
........................................................................ [ 27%]
........................................................................ [ 37%]
........................................................................ [ 46%]
........................................................................ [ 55%]
........................................................................ [ 64%]
........................................................................ [ 74%]
........................................................................ [ 83%]
........................................................................ [ 92%]
..........................................................               [100%]
778 passed in 389.26s (0:06:29)
```

## `.env` timestamps
Checked via `(Get-Item "vitagraph\backend\.env").LastWriteTime.ToString("o")`:
- **Before first edit**: `2026-10-08T14:16:14.5578770+05:30`
- **After full suite & live check**: `2026-10-08T14:16:14.5578770+05:30`
- **Result**: Timestamps are identical. The real `vitagraph/backend/.env` was never opened, printed, or modified.

## Live check (scratch server, fake model)
Conducted in isolated scratch environment `C:\Users\Admin\AppData\Local\Temp\t1live` with scratch backend on port 8001 and fake model server on port 8099.

### Step 3: Health check against scratch backend
Command:
`Invoke-RestMethod -Uri "http://127.0.0.1:8001/api/health"`
Output:
```json
{
  "status": "ok",
  "retrieval_store": {
    "status": "ok",
    "chunks": 0
  },
  "allow_api": false,
  "ai_service": "disabled (offline mode)",
  "ai_service_model": "offline-fallback-composer",
  "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
  "chunk_target_chars": 200,
  "chunk_max_chars": 800
}
```
(`"chunks": 0` confirms scratch storage isolation)

### Step 4a: GET `/api/ai/model` before
Command:
`Invoke-RestMethod -Uri "http://127.0.0.1:8001/api/ai/model"`
Output:
```json
{
  "url": "",
  "model": "",
  "api_format": "responses",
  "reasoning": "low",
  "has_key": false,
  "masked_key": "",
  "allow_api": false,
  "shield_covered": false,
  "can_edit": true,
  "message": ""
}
```

### Step 4b: POST `/api/ai/model/test` with fake model server
Command:
```powershell
$body = @{ url = "http://127.0.0.1:8099/v1"; key = "<KEY>"; model = "live-model-alpha"; api_format = "auto" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:8001/api/ai/model/test" -Method Post -ContentType "application/json" -Body $body
```
Output:
```json
{
  "ok": true,
  "message": "Connection verified. Model responded: 'OK'",
  "api_format": "chat"
}
```
Fake server auth header inspection:
```json
[
  "Bearer <KEY>"
]
```

### Step 4c: POST `/api/ai/model` (save)
Command:
```powershell
$body = @{ url = "http://127.0.0.1:8099/v1"; key = "<KEY>"; model = "live-model-alpha"; api_format = "auto"; reasoning = "low" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:8001/api/ai/model" -Method Post -ContentType "application/json" -Body $body
```
Output:
```json
{
  "url": "http://127.0.0.1:8099/v1",
  "model": "live-model-alpha",
  "api_format": "chat",
  "reasoning": "low",
  "has_key": true,
  "masked_key": "••••1234",
  "allow_api": false,
  "shield_covered": false,
  "can_edit": true,
  "message": "Connection verified. Model responded: 'OK'"
}
```
`GET /api/ai/model` after save:
```json
{
  "url": "http://127.0.0.1:8099/v1",
  "model": "live-model-alpha",
  "api_format": "chat",
  "reasoning": "low",
  "has_key": true,
  "masked_key": "••••1234",
  "allow_api": false,
  "shield_covered": false,
  "can_edit": true,
  "message": ""
}
```
`scratch.env` content:
```
MODEL_API_URL=http://127.0.0.1:8099/v1
MODEL_NAME=live-model-alpha
MODEL_API_FORMAT=chat
MODEL_REASONING_EFFORT=low
MODEL_API_KEY=<KEY>
```

### Step 4d: Wrong URL returns 422 and leaves `scratch.env` untouched
Command:
```powershell
$body = @{ url = "http://127.0.0.1:8099/nothing"; key = "<KEY>"; model = "live-model-alpha"; api_format = "auto" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:8001/api/ai/model" -Method Post -ContentType "application/json" -Body $body
```
Output:
```
HTTP 422:
{
  "detail": "Not found (HTTP 404): Check endpoint URL and model name 'live-model-alpha'."
}
ENV_UNCHANGED: True
```

### Step 4e: POST `/api/ai/model/remove-key`
Command:
`Invoke-RestMethod -Uri "http://127.0.0.1:8001/api/ai/model/remove-key" -Method Post`
Output:
```json
{
  "url": "http://127.0.0.1:8099/v1",
  "model": "live-model-alpha",
  "api_format": "chat",
  "reasoning": "low",
  "has_key": false,
  "masked_key": "",
  "allow_api": false,
  "shield_covered": false,
  "can_edit": true,
  "message": "The saved key was removed."
}
```
`scratch.env` content after key removal:
```
MODEL_API_URL=http://127.0.0.1:8099/v1
MODEL_NAME=live-model-alpha
MODEL_API_FORMAT=chat
MODEL_REASONING_EFFORT=low
MODEL_API_KEY=
```

### Step 5: Teardown and Port Verification
Scratch backend and fake model server stopped. Ports verified free via `Get-NetTCPConnection -LocalPort 8001, 8099`.

## Deviations
None.

## Open points
None. All backend endpoints, persistence mechanics, validations, redactions, and tests strictly satisfy the PLAN T and TASK T1 specifications.

## Branch proof
Command: `git branch --show-current`
```
feature/privacy-shield-and-rag-lab
```

Command: `git status --short`
```
 M CLAUDE.md
 M README.md
 M docs/SESSION_CONTEXT.md
 M gemini/DESIGN_LAW.md
 M gemini/RULES.md
 M "site design/src/App.tsx"
 M "site design/src/api/agent.ts"
 M "site design/src/api/ai.ts"
 M "site design/src/api/reports.ts"
 M "site design/src/components/agent/AnswerMarkdown.tsx"
 M "site design/src/components/agent/ConversationList.tsx"
 M "site design/src/components/agent/PassageSlip.tsx"
 M "site design/src/components/agent/TrajectoryPanel.tsx"
 M "site design/src/components/shell/AppShell.tsx"
 M "site design/src/components/shell/Header.tsx"
 M "site design/src/components/shell/Sidebar.tsx"
 M "site design/src/hooks/useAgentChat.ts"
 M "site design/src/index.css"
 M "site design/src/lib/agentFeed.ts"
 M "site design/src/lib/answerFormat.ts"
 M "site design/src/lib/linkCitations.ts"
 M "site design/src/pages/AgentPage.tsx"
 M "site design/src/pages/LibraryPage.tsx"
 M "site design/src/pages/SettingsPage.tsx"
 M "site design/tsconfig.tsbuildinfo"
 M vitagraph/backend/app/agent/mapper.py
 M vitagraph/backend/app/agent/prompt.py
 M vitagraph/backend/app/core/config.py
 M vitagraph/backend/app/core/database.py
 M vitagraph/backend/app/generation/ai_client.py
 M vitagraph/backend/app/ingestion/uploader.py
 M vitagraph/backend/app/main.py
 M vitagraph/backend/app/routes/agent.py
 M vitagraph/backend/app/routes/ai.py
 M vitagraph/backend/app/routes/llm_shim.py
 M vitagraph/backend/app/routes/reports.py
 M vitagraph/backend/app/schemas/agent.py
 M vitagraph/backend/app/services/agent_service.py
 M vitagraph/backend/app/services/chat_service.py
 M vitagraph/backend/app/services/conversation_service.py
 M vitagraph/backend/app/services/graph_ai.py
 M vitagraph/backend/app/services/node_summary.py
 M vitagraph/backend/app/services/report_artifacts.py
 M vitagraph/backend/app/services/report_render.py
 M vitagraph/backend/app/services/report_service.py
 M vitagraph/backend/app/services/responses_adapter.py
 M vitagraph/backend/app/services/user_service.py
?? gemini/PLAN_Q_privacy_and_lab.md
?? gemini/PLAN_R_agent_upgrade.md
?? gemini/PLAN_T_ai_connection.md
?? gemini/TASK_T1_ai_connection_backend.md
?? gemini/TASK_T2_ai_connection_frontend.md
?? gemini/reports/T1_summary.md
?? gemini/reports/T2_summary.md
?? "site design/src/api/agentRuns.ts"
?? "site design/src/api/charts.ts"
?? "site design/src/api/lab.ts"
?? "site design/src/api/overview.ts"
?? "site design/src/api/privacy.ts"
?? "site design/src/components/agent/ChartCard.tsx"
?? "site design/src/components/agent/ChartView.tsx"
?? "site design/src/components/agent/PageView.tsx"
?? "site design/src/components/agent/ScopePicker.tsx"
?? "site design/src/components/agent/SidePanel.tsx"
?? "site design/src/components/data/"
?? "site design/src/components/lab/"
?? "site design/src/components/privacy/"
?? "site design/src/components/settings/"
?? "site design/src/hooks/useAgentActivity.ts"
?? "site design/src/hooks/useLabRun.ts"
?? "site design/src/lib/agentRuns.ts"
?? "site design/src/lib/chartSpec.ts"
?? "site design/src/lib/labWords.ts"
?? "site design/src/lib/privacyFormat.ts"
?? "site design/src/pages/DataPage.tsx"
?? "site design/src/pages/LabPage.tsx"
?? "site design/src/pages/PrivacyPage.tsx"
?? video-prompts/how-it-works-film/
?? vitagraph/backend/app/agent/runs.py
?? vitagraph/backend/app/lab/
?? vitagraph/backend/app/privacy/
?? vitagraph/backend/app/routes/charts.py
?? vitagraph/backend/app/routes/lab.py
?? vitagraph/backend/app/routes/overview.py
?? vitagraph/backend/app/routes/privacy.py
?? vitagraph/backend/app/schemas/lab.py
?? vitagraph/backend/app/schemas/overview.py
?? vitagraph/backend/app/schemas/privacy.py
?? vitagraph/backend/app/services/chart_service.py
?? vitagraph/backend/app/services/overview_service.py
?? vitagraph/backend/app/services/page_highlight.py
?? vitagraph/backend/tests/test_agent_conversations_v2.py
?? vitagraph/backend/tests/test_agent_runs.py
?? vitagraph/backend/tests/test_ai_model_connection.py
?? vitagraph/backend/tests/test_chart_service.py
?? vitagraph/backend/tests/test_env_writer.py
?? vitagraph/backend/tests/test_lab_metrics.py
?? vitagraph/backend/tests/test_lab_routes.py
?? vitagraph/backend/tests/test_lab_runner.py
?? vitagraph/backend/tests/test_overview.py
?? vitagraph/backend/tests/test_page_highlight.py
?? vitagraph/backend/tests/test_privacy_adapter.py
?? vitagraph/backend/tests/test_privacy_ledger.py
?? vitagraph/backend/tests/test_privacy_redactor.py
?? vitagraph/backend/tests/test_privacy_restore.py
?? vitagraph/backend/tests/test_privacy_routes.py
?? vitagraph/backend/tests/test_report_dedupe.py
?? vitagraph/backend/tests/test_report_delete.py
?? vitagraph/backend/tests/test_report_file.py
```
