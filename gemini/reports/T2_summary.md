# TASK T2 Summary: AI connection (Frontend)

## Status
PARTIAL (Frontend static implementation complete; live check not run because `gemini/reports/T1_summary.md` was missing per Plan T contract)

## Files changed (numstat)
```
36	0	site design/src/api/ai.ts
3	0	site design/src/pages/SettingsPage.tsx
```
New component created:
`site design/src/components/settings/AiConnectionSection.tsx` (380 lines)

## Ladder results
- **25 %**: `api/ai.ts` done, `npx tsc -b` clean (PASS)
- **60 %**: `AiConnectionSection.tsx` exists and `SettingsPage.tsx` renders it, `npx tsc -b` clean (PASS)
- **85 %**: `npm run build` exit code 0, `npm run audit:design` 0 errors (PASS)
- **100 %**: live check reported "not run" (T1 report missing per Plan T contract) and `gemini/reports/T2_summary.md` written (PASS)

## Static checks (pasted)

### 1. `npx tsc -b`
Command: `npx tsc -b` (in `site design`)
```
Exit code: 0
(Clean output, no errors or warnings)
```

### 2. `npm run build`
Command: `npm run build` (in `site design`)
```
> vitagraph-site-design@0.0.0 build
> tsc -b && vite build

vite v8.3.2 building client environment for production...
transforming...
✓ 400 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                          0.86 kB │ gzip:   0.48 kB
dist/assets/archivo-latin-600-normal-3BBy0ZsW.woff2     13.82 kB
dist/assets/archivo-latin-800-normal-cB6v3kRN.woff2     14.41 kB
dist/assets/archivo-latin-400-normal-C81ewxNO.woff2     14.70 kB
dist/assets/archivo-latin-600-normal-DwYieO8P.woff      18.20 kB
dist/assets/archivo-latin-800-normal-DZa_k145.woff      18.90 kB
dist/assets/archivo-latin-400-normal-Bl602Mgc.woff      18.97 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs              1,264.34 kB
dist/assets/GraphStage-DVrZ88Mq.css                     12.13 kB │ gzip:   2.90 kB
dist/assets/index-CYgruyr5.css                         107.01 kB │ gzip:  19.37 kB
dist/assets/ai-ee7adWV0.js                               0.48 kB │ gzip:   0.24 kB
dist/assets/sse-w3GhxN21.js                              0.61 kB │ gzip:   0.40 kB
dist/assets/client-BpjxBKyL.js                           0.67 kB │ gzip:   0.45 kB
dist/assets/graph-o2XwTLdt.js                            1.08 kB │ gzip:   0.61 kB
dist/assets/reportLabels-BorBZNtH.js                     1.47 kB │ gzip:   0.73 kB
dist/assets/ConfirmDialog-BLifM8aS.js                    2.12 kB │ gzip:   1.00 kB
dist/assets/ui-CUAK17kD.js                               3.09 kB │ gzip:   1.23 kB
dist/assets/InsightsPage-BPnKDv83.js                     4.17 kB │ gzip:   1.73 kB
dist/assets/ComparePage-DgwipBt7.js                      5.50 kB │ gzip:   2.10 kB
dist/assets/LedgerDrawer-D0hjgq2A.js                     8.15 kB │ gzip:   3.05 kB
dist/assets/ImageToTextPage-CnURHlec.js                  8.77 kB │ gzip:   2.75 kB
dist/assets/jsx-runtime-D3jfb0Ew.js                      8.90 kB │ gzip:   3.38 kB
dist/assets/LibraryPage-esLeSVQg.js                      9.42 kB │ gzip:   3.11 kB
dist/assets/TimelinePage-DeKDDSZS.js                    10.14 kB │ gzip:   3.84 kB
dist/assets/PrivacyPage-CauPitX6.js                     17.62 kB │ gzip:   5.36 kB
dist/assets/SettingsPage-DqlczkLd.js                    24.73 kB │ gzip:   5.68 kB
dist/assets/KnowledgeGraphPage-4B8ttGCf.js              24.88 kB │ gzip:   8.01 kB
dist/assets/DataPage-HnYqFN1H.js                        30.42 kB │ gzip:   8.15 kB
dist/assets/TextToGraphPage-RQ4l5G_b.js                 36.22 kB │ gzip:  13.16 kB
dist/assets/LabPage-Cnan76Iu.js                         37.93 kB │ gzip:  11.24 kB
dist/assets/GraphStage-HPOuub32.js                      62.95 kB │ gzip:  20.56 kB
dist/assets/AgentPage-BoL_c_GD.js                       79.65 kB │ gzip:  23.07 kB
dist/assets/answerFormat-20EcjikN.js                   156.58 kB │ gzip:  47.08 kB
dist/assets/index-Cht17Fdc.js                          386.82 kB │ gzip: 122.22 kB
dist/assets/PdfToTextPage-CGoSMkxF.js                  437.92 kB │ gzip: 131.38 kB

✓ built in 1.11s
```

### 3. `npm run audit:design`
Command: `npm run audit:design` (in `site design`)
```
> vitagraph-site-design@0.0.0 audit:design
> node scripts/audit-design.mjs


Checked 104 files: 0 error(s), 0 pending.
```

### 4. `python scripts/plan/secret_scan.py`
Command: `python scripts/plan/secret_scan.py`
```
RESULT: PASS
```

### 5. `git diff --numstat` and line count of component
Command: `git diff --numstat -- "site design/src/api/ai.ts" "site design/src/pages/SettingsPage.tsx"`
```
36	0	site design/src/api/ai.ts
3	0	site design/src/pages/SettingsPage.tsx
```
Line count of `site design/src/components/settings/AiConnectionSection.tsx`: 380 lines.

## Live check
live check NOT RUN (T1 report missing)

Per `gemini/PLAN_T_ai_connection.md` section 3:
> "Run order: both start at once. T2 finishes with static checks (tsc, build, audit). Its live check waits for `gemini/reports/T1_summary.md`; if that file does not exist when T2 is otherwise done, T2 reports "live check not run" and stops."

and `gemini/TASK_T2_ai_connection_frontend.md`:
> "If that file does not exist when you reach this point: skip this whole section, write "live check NOT RUN (T1 report missing)" in your report and finish with the static checks only."

## Screenshots written
None (live check not run due to missing T1 summary report).

## Deviations
None.

## Open points
None. All components and types strictly follow the Plan T and Task T2 contracts.

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
