# TASK 09a report

## 1. What I was asked to do
Convert the Ask page into a real multi-turn streaming chat interface matching the Modernist reference design. Implement `useChatStream` to consume `POST /api/chat/stream` via fetch and `ReadableStream` with `AbortController` cleanup and multi-turn memory. Build a collapsible `StepsPanel` rendering real tool events, render streamed Markdown answers and tables using `AnswerMarkdown`, support policy refusal and error cards with retry, handle sticky composer behavior with Send and Stop controls, and support `?q=` prefilling and `?report=` scoped chatting.

## 2. What I actually did
1. Verified branch is `redesign/modernist-app` and ran baseline build (`npm run build` in `site design` exited 0).
2. Created `site design/src/hooks/useChatStream.ts` handling SSE stream parsing, event mapping (`thinking`, `tool_call`, `tool_result`, `text_delta`, `model_fallback`, `completed`), rAF frame coalescing, and conversation memory.
3. Created `site design/src/components/ask/AnswerMarkdown.tsx` rendering Markdown body text, tables, headers, and code without external links.
4. Created `site design/src/components/ask/StepsPanel.tsx` rendering execution time, step count, square status indicators, reasoning, and tool details.
5. Replaced `site design/src/pages/AskPage.tsx` with the complete 960px centered Modernist layout, suggested question rows, Q bubbles, collapsible steps, answer markdown, sticky composer, empty states, and scope chips.
6. Updated `site design/src/components/shell/AppShell.tsx` to include `"/ask"` in `OWN_LAYOUT`.
7. Appended `.ask-suggestion:hover:not(:disabled)` style to `site design/src/index.css`.
8. Ran static checks: confirmed `npm run build` exits 0, and confirmed no banned tokens (rounded, Spectral, backdrop, raw hex) or provider names appear in source files.
9. Executed the comprehensive Playwright browser test in Chrome against the real backend and AI gateway with throwaway persona `usr_51f14542d71a`, capturing 5 screenshots across all scenarios A through J.
10. Performed extra manual checks: verified backend-down error state (`Cannot reach the backend` and disabled composer) and Enter-to-send functionality.
11. Cleaned up all temporary test scripts from `$env:TEMP`, stopped both server processes, and verified ports 5173 and 8000 were closed.
12. Wrote this work report file `gemini/reports/TASK_09a_report.md`.

## 3. Files changed
- `site design/src/components/shell/AppShell.tsx` (+1, -1): Add "/ask" to OWN_LAYOUT set so the page controls its layout and padding.
- `site design/src/index.css` (+5, -0): Add hover tint style for suggested question rows.
- `site design/src/pages/AskPage.tsx` (+358, -512): Replace old AskPage with full streaming chat, suggestions, steps panel, refusal/error cards, and sticky composer.
- `site design/src/hooks/useChatStream.ts` (+390, -0): New hook consuming POST /api/chat/stream with AbortController, conversation history, and tool event aggregation.
- `site design/src/components/ask/AnswerMarkdown.tsx` (+37, -0): New Markdown rendering component supporting tables and modernist typographic rules.
- `site design/src/components/ask/StepsPanel.tsx` (+112, -0): New collapsible steps component visualizing real assistant reasoning and tool execution.
- `gemini/shots/task09a-ask-empty.png`: Screenshot of empty state with suggested questions.
- `gemini/shots/task09a-ask-answer.png`: Screenshot of Q1 with expanded steps panel and answer.
- `gemini/shots/task09a-ask-refusal.png`: Screenshot of policy refusal card for diagnostic query.
- `gemini/shots/task09a-ask-error.png`: Screenshot of network failure error card with Try again button.
- `gemini/shots/task09a-ask-820.png`: Screenshot of 820x1100 viewport with no overflow.
- `gemini/reports/TASK_09a_report.md` (+126, -0): Work report documenting implementation and verification.

## 4. Commands and their output

```
$ git branch --show-current
redesign/modernist-app
```

```
$ npm run build (in site design)
dist/assets/index-DZ5prTiA.css                       106.79 kB │ gzip:  18.91 kB
dist/assets/index-BlH5D-DW.js                        867.83 kB │ gzip: 237.66 kB
✓ built in 523ms
```

```
$ git grep --no-index -n -E "rounded|Spectral|backdrop|#[0-9a-fA-F]{3,6}" -- src/pages/AskPage.tsx src/hooks/useChatStream.ts src/components/ask/AnswerMarkdown.tsx src/components/ask/StepsPanel.tsx
(exited with code 1, printed nothing)
```

```
$ git grep --no-index -n -i -E "gemini|agentrouter|deepseek|claude|gpt|openai" -- src/pages/AskPage.tsx src/hooks/useChatStream.ts src/components/ask/
(exited with code 1, printed nothing)
```

```
$ $env:PYTHONIOENCODING="utf-8"; python $env:TEMP\ask_live_check_t09a.py "F:\kiruthika\kiruthika final project\gemini\shots" usr_51f14542d71a
A suggestions: ['What does my Hemoglobin trend show over time?', 'Are any of my values outside their printed reference range?', 'Summarize my latest report', 'What was my Vitamin D value in each report?']
A geometry: {'composerBottom': 860, 'mainBottom': 860, 'h2': 'What would you like to know?', 'h2Size': '32px', 'h2Weight': '800', 'rowHeight': 50, 'inputHeight': 52, 'sendWidth': 140, 'font': 'Archivo, system-ui, '}
B seconds: 25.4
B entry: {'label': 'Q1', 'steps': 'Thought for 24.8 s · 8 steps Show', 'answerStart': "I'll look that up in your reports.  A trend needs at least two time points, and your records only contain one Hemoglobin measurement.  Here'", 'tables': 1, 'newChat': True, 'send': 'Send', 'fromBottom': 0}
B step dot: {'w': 12, 'h': 12}
B steps text: Thought for 24.8 s · 8 steps | Hide | Reasoning | The user asks about Hemoglobin trend over time. I should search_chroma and query_networkx_graph. | Searched your reports for "Hemoglobin" | 2 passages found | Looked up "Hemoglobin" in the knowledge graph | Done | Reasoning | Only one date appears: 15 January 2025, 13.8 g/dL. Let me check if there are earlier reports with hemogl
C request messages: [('user', 'What does my Hemoglobin trend show o'), ('assistant', "I'll look that up in your reports.\n\n"), ('user', 'And what is its normal range?')] | report_id: None
C answer: The reference range printed on your report for Hemoglobin is 12.0 – 15.5 g/dL [1][2]. Your result of 13.8 g/dL on 15 January 2025 falls inside that range [1][2].  Worth being precise about one thing: 
D refusal: Declined by policy This request falls outside VitaGraph's boundary. VitaGraph is an educational system that organizes and explains what your uploaded 
E entries after new chat: 0
F stopped tags: 1 | header: Thought for 2.5 s · 5 steps Show
G error card: Could not finish |  | Cannot reach the VitaGraph backend. Is it running? |  | Try again
G retry answered: 1
H no reports: No reports yet |  | Upload a report first, then ask about it here. |  | Upload a report | input disabled: True
I scope chip: Chatting with bad.pdf. Answers use only this report. | Use all my reports | input: Summarize this | url: http://localhost:5173/ask?report=rpt_e610f56e5ba8
I scoped request carried report_id: True
J overflow: {'scrollWidth': 820, 'innerWidth': 820}
console (errors and warnings): []
```

```
$ (Backend stopped check)
BACKEND_STOPPED_H2: Cannot reach the backend | input_disabled: True | button_disabled: True
```

```
$ (Enter key submission check)
ENTER_KEY_SUBMIT: entry_count = 1 | question = Q1 What was my vitamin D?
```

```
$ Get-NetTCPConnection -LocalPort 5173,8000 -State Listen
(exited with code 1, printed nothing)
```

## 5. Acceptance checklist
- Build exits 0; greps 6.2 and 6.3 print nothing; only closed-list files in the commit: PASS (`npm run build` exited 0; static checks clean; only files in closed list modified/created).
- Live check A to J all as required above; console list empty: PASS (A through J matched all required values; console errors/warnings: `[]`).
- Screenshots match the reference layout (compared); no contradiction between what a screenshot says and the footer, header or API: PASS (Compared with `02_Ask.png`; headers, suggestion rows, composer, Q bubble, and steps panel match; zero contradictions).
- Backend-down state and Enter-to-send verified: PASS (`Cannot reach the backend` with disabled input/button verified; pressing Enter submits question into Q1 entry).
- Servers stopped; temp script deleted; branch correct; report file has all nine headings: PASS (Ports 5173 and 8000 verified free; temp files removed; branch `redesign/modernist-app`; report file complete).

## 6. Things that surprised me
1. Intended differences from the reference design:
   - No model selector button in header, and no provider/model names anywhere in UI.
   - Suggested questions dynamically incorporate central nodes from the active persona's knowledge graph (e.g. Hemoglobin and Vitamin D) rather than static demo text.
   - Steps panel displays real assistant tool execution (reasoning rounds, ChromaDB vector searches with found passage counts, and NetworkX graph lookups) rather than mock demo steps.
   - A "New chat" button and streaming "Stop" button are provided to support realistic conversation lifecycles.
   - The obsolete side panel with Document and Activity tabs was replaced by the clean full-height conversation flow.

2. Screenshot and API cross-check:
   - On `task09a-ask-empty.png`, `task09a-ask-answer.png`, `task09a-ask-refusal.png`, `task09a-ask-error.png`, and `task09a-ask-820.png`, the active persona in the header reads `Empty Test Persona usr_51f14542d71a`.
   - The footer consistently indicates `Backend online`, `ChromaDB · 22 chunks`, `4 reports`, and live API latency.
   - The suggested questions and AI answers correctly match the persona's 4 indexed reports and single historical Hemoglobin measurement (15 January 2025, 13.8 g/dL).
   - Zero contradictions were found between visual text, header, footer, and backend API responses.

## 7. Deviations from the task
none

## 8. Open questions for the reviewer
none

## 9. How the reviewer can double-check
1. Check current branch: `git branch --show-current` (outputs `redesign/modernist-app`).
2. Run build: `cd "site design" && npm run build` (exits 0).
3. Inspect screenshots in `gemini/shots/task09a-*.png`.
4. Review git commit: `git show --stat HEAD` (shows exactly the closed list files).
