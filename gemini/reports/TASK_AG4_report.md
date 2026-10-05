# TASK AG4 report

## 1. What I was asked to do
I was asked to replace the old `/ask` page completely with the new `/agent` AI Agent page, wired to `POST /api/agent/stream` via a new `useAgentChat` hook. I was tasked with folding in Task 09b citation chips (`[n]`), highlighted passage slips, and evidence modules, adding a harness-style trajectory panel with tool-call cards and a live stats strip, removing dead code, and keeping `/ask` as a query-preserving redirect. The AI gateway was expected to be blocked per RULES 5d, so UI states were to be verified with mocked streams built from real database records, while testing the real backend separately and confirming clean error handling.

## 2. What I actually did
1. Read `gemini/RULES.md`, previous reviews (`TASK_AG3_review.md`, `TASK_AG3b_review.md`, `TASK_09a_review.md`), `design/reference/screens/02_Ask.png`, and `gemini/TASK_AG4_agent_page.md`.
2. Verified initial branch was `redesign/modernist-app` and baseline build passed.
3. Proved dead files had no unexpected imports with grep, removed 9 dead files via `git rm`, and moved `useChatStream.ts` to `useAgentChat.ts` and `AskPage.tsx` to `AgentPage.tsx`.
4. Rewrote `site design/src/hooks/useAgentChat.ts` to consume `POST /api/agent/stream` with `TrajectoryItem`, `AgentStats`, `AgentEvidence`, plain-language tool summaries, and stream parsing.
5. Implemented `AnswerMarkdown.tsx`, `PassageSlip.tsx`, and `EvidenceModules.tsx` in `site design/src/components/agent/` adapting Task 09b with `AgentEvidence` and `agent-` prefixes.
6. Created `site design/src/components/agent/TrajectoryPanel.tsx` with collapsible trajectory view, live timer, tool-call cards with argument inspection and raw JSON toggle, and stats strip.
7. Rewrote `site design/src/pages/AgentPage.tsx` with all 7 requested adjustments (trajectory panel, scope chip, empty state explanation, placeholder, evidence-only banner, new chat, and "AI Agent" terminology).
8. Wired shell and routing in `src/App.tsx` (`/agent` route and `/ask` redirect), `Sidebar.tsx`, `AppShell.tsx`, `Header.tsx`, `navigation.ts`, `UploadPage.tsx`, and `index.css`.
9. Ran static verification checks (build, dead ask references, styling tokens, provider names, assistant occurrences).
10. Executed Playwright browser verification script against throwaway persona `usr_51f14542d71a` verifying N1–N4, M1–M7, M9, M10, K, and L, and captured 3 screenshots in `gemini/shots/`.
11. Ran manual checks verifying header search prefill into `/agent`, Upload page navigation with scope chip, and `/ask` redirect.
12. Stopped dev servers, confirmed ports 5173 and 8000 were released, verified no orphan processes remained, deleted the temp script, and cleared persona runtime from `RuntimePool`.

## 3. Files changed
- `gemini/shots/ag4-answer-1440.png` | Bin 0 -> 142566 bytes: Screenshot of desktop answer with trajectory, chips, and passage slip.
- `gemini/shots/ag4-answer-820.png` | Bin 0 -> 110668 bytes: Screenshot of tablet answer with 820px responsive layout.
- `gemini/shots/ag4-live-1440.png` | Bin 0 -> 94512 bytes: Screenshot of live real-backend query with error card.
- `site design/src/App.tsx` | +8 -5: Wires `/agent` route and `AskRedirect` component for `/ask`.
- `site design/src/components/agent/AgentThoughtTree.tsx` | -234: Deleted unused legacy component.
- `site design/src/components/agent/AnswerMarkdown.tsx` | +104: Markdown renderer with citation chip links and table styling.
- `site design/src/components/agent/ChatComposer.tsx` | -132: Deleted unused legacy component.
- `site design/src/components/agent/ChatTurn.tsx` | -209: Deleted unused legacy component.
- `site design/src/components/agent/DocumentPane.tsx` | -186: Deleted unused legacy component.
- `site design/src/components/agent/EvidenceModules.tsx` | +80: Evidence, Limitations, and Safety metadata cards.
- `site design/src/components/agent/PaperAnswer.tsx` | -177: Deleted unused legacy component.
- `site design/src/components/agent/PassageSlip.tsx` | +102: Exact passage display with page extraction and text marking.
- `site design/src/components/agent/TrajectoryPanel.tsx` | +229: Trajectory rows, tool-call cards, raw JSON viewer, and stats strip.
- `site design/src/components/agent/chatTypes.ts` | -28: Deleted unused legacy types file.
- `site design/src/components/ask/AnswerMarkdown.tsx` | -37: Deleted old ask component.
- `site design/src/components/ask/StepsPanel.tsx` | -112: Deleted old ask component.
- `site design/src/components/shell/AppShell.tsx` | +3 -3: Updated route titles, own-layout set, and pathname checks to `/agent`.
- `site design/src/components/shell/Header.tsx` | +3 -3: Updated header title/sub and search navigation target to `/agent`.
- `site design/src/components/shell/Sidebar.tsx` | +2 -2: Updated navigation item to AI Agent `/agent` with sublabel.
- `site design/src/hooks/useAgentChat.ts` (renamed from `useChatStream.ts`) | +150 -102: Rewritten stream hook consuming `POST /api/agent/stream`.
- `site design/src/hooks/useAgentStream.ts` | -396: Deleted unused legacy hook.
- `site design/src/index.css` | +8: Added hover state styles for citation chips and evidence rows.
- `site design/src/motion/navigation.ts` | +4 -4: Updated canonical journey step and route index to `/agent`.
- `site design/src/pages/AgentPage.tsx` (renamed from `AskPage.tsx`) | +69 -45: Rewritten AI Agent page with trajectory, citations, and evidence.
- `site design/src/pages/UploadPage.tsx` | +2 -2: Updated continue navigation targets to `/agent`.

## 4. Commands and their output

### Frontend build (`npm run build`)
```
> vitagraph-site-design@0.0.0 build
> tsc -b && vite build

vite v8.3.2 building client environment for production...
transforming...
✓ 367 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.71 kB │ gzip:   0.44 kB
dist/assets/archivo-latin-600-normal-3BBy0ZsW.woff2   13.82 kB
dist/assets/archivo-latin-800-normal-cB6v3kRN.woff2   14.41 kB
dist/assets/archivo-latin-400-normal-C81ewxNO.woff2   14.70 kB
dist/assets/archivo-latin-600-normal-DwYieO8P.woff    18.20 kB
dist/assets/archivo-latin-800-normal-DZa_k145.woff    18.90 kB
dist/assets/archivo-latin-400-normal-Bl602Mgc.woff    18.97 kB
dist/assets/index-DkwM3Z9a.css                       103.93 kB │ gzip:  18.48 kB
dist/assets/index-Bdlx7aTp.js                        879.77 kB │ gzip: 240.62 kB

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 568ms
```

### Dead reference check (Step 7.2)
```
PS F:\kiruthika\kiruthika final project\site design> Get-ChildItem src -Recurse -Include *.ts,*.tsx | Select-String -Pattern 'useChatStream|useAgentStream|components/ask|AskPage|"/ask"|/ask\?'

src\App.tsx:40:              <Route path="/ask" element={<AskRedirect />} />
```

### Styling token check (Step 7.3)
```
PS F:\kiruthika\kiruthika final project\site design> Select-String -Path src\pages\AgentPage.tsx,src\hooks\useAgentChat.ts,src\components\agent\*.tsx -Pattern 'rounded|Spectral|backdrop|#[0-9a-fA-F]{3,6}'
```
(Output empty)

### Provider / model name check (Step 7.4)
```
PS F:\kiruthika\kiruthika final project\site design> Select-String -Path src\pages\AgentPage.tsx,src\hooks\useAgentChat.ts,src\components\agent\*.tsx -Pattern 'gemini|agentrouter|deepseek|claude|gpt|openai'
```
(Output empty)

### Assistant keyword check (Step 7.4b)
```
PS F:\kiruthika\kiruthika final project\site design> Select-String -Path src\pages\AgentPage.tsx,src\hooks\useAgentChat.ts,src\components\agent\*.tsx -Pattern 'assistant'

src\hooks\useAgentChat.ts:361:          { role: "assistant", content: e.answer.slice(0, MAX_TURN_CHARS) },
```

### Playwright browser verification (`agent_check_ag4.py`)
```
N1 page title: AI Agent | sidebar has AI Agent: True | sub-label: True
N2 empty state mentions the agent: True
N3 /ask?q= redirects: http://localhost:5173/agent | composer prefilled: 'hello there'
N4 /ask?report= redirects: http://localhost:5173/agent?report=rpt_a060e5ce048c | scope chip: Chatting with synthetic_panel_2025-01-15.pdf. Answers use only this report. Use all my reports
M1 header while collapsed: Worked for 3.4 s · 2 steps · 1 tool call Show
M1 rows: ['status: Starting the AI Agent', 'step: STEP 1', 'reasoning: Reasoning', 'tool: Searched your reports for "Hemoglobin"', 'step: STEP 2']
M2 stats strip: STEPS 2 TOOL CALLS 1 TIME 3.4 s TOKENS 812 in · 140 out | expected steps 2, tool calls 1, time 3.4 s, tokens 812 in 140 out
M3 tool card: Searched your reports for "Hemoglobin" | SEARCH_REPORTS · 120 MS | ARGUMENTS | query: Hemoglobin | top_k: 5 | RESULT | 1 passage found | Show raw result
M3 raw result toggled, contains chunk id: True
M4 chips: ['1'] | the unknown [7] stays plain text: True
M5 columns: ['Evidence', 'Limitations', 'Safety']
M6 page text blocked, the slip says: L_2025-01-15.PDF PAGE 1 CHARACTERS 274–278 13.8 The exact position on the page could not be loaded, so the saved excerpt is shown.
M6 after the network is back the passage is highlighted: True
M6 slip head: Reference 1 | synthetic_panel_2025-01-15.pdf | Page 1 | Characters 274–278
M6 highlighted text equals stored page text: True | length 4
M7 slips after closing: 0
M7 evidence row opens a slip, aria-expanded: true
M9 refusal: declined card: True | trajectory panels: 0
M9 withheld: card shown: True | the diagnostic text is NOT shown: True
M9 error card: True | message shown: True | diagnostic hidden: True | Try again enabled: True
M9 evidence-only: tag shown: True | tool label: Searched your reports for "hemoglobin"
M10 while waiting: trajectory header: Working Hide
M10 after Stop: Stopped tag: True | Send button back: True
K keyboard: Enter on a focused chip opens the slip: True
K 820 overflow: {'scrollWidth': 820, 'innerWidth': 820}
L 'What was my hemoglobin?' -> ERROR CARD: The AI service refused the request. Please try again later.  Try again
L 'Which of my values are outside the reference range?' -> ERROR CARD: The AI service refused the request. Please try again later.  Try again
L 'Tell me about my vitamin D result' -> ERROR CARD: The AI service refused the request. Please try again later.  Try again
console (errors and warnings): []
```

### Manual verification checks
```
(a) Header search URL: http://localhost:5173/agent | composer input: 'my blood pressure'
(b) Upload page button navigated to: http://localhost:5173/agent?report=rpt_d52d84e4d2fa
(c) /ask?q=test redirect: http://localhost:5173/agent
```

### Backend tests (`pytest tests -q`)
```
........................................................................ [ 35%]
........................................................................ [ 71%]
.........................................................                [100%]
201 passed in 220.71s (0:03:40)
```

## 5. Acceptance checklist
- Build exits 0: PASS (`npm run build` exits 0 in 568ms).
- Greps 7.2 to 7.4 print what is required: PASS (7.2 prints only `App.tsx` redirect, 7.3 and 7.4 print nothing, 7.4b prints only history construction).
- Dead files deleted after import proof: PASS (all 9 dead files removed, imports verified).
- `/ask` redirects with query string preserved: PASS (`/ask?q=` and `/ask?report=` redirect to `/agent` and prefill / keep parameters).
- Sidebar, header, and navigation say "AI Agent": PASS (`Sidebar.tsx`, `Header.tsx`, `navigation.ts`, and `AgentPage.tsx` updated).
- Mocked checks N, M, K as required: PASS (M2 numbers match stream stats, M6 highlighted text equals stored page text, refusal/withheld have 0 trajectory panels, secret diagnostic hidden).
- Real-backend part L reported honestly: PASS (`API blocked` recorded with raw error frame from upstream provider).
- Console list empty: PASS (`console (errors and warnings): []`).
- Screenshots compared with reference and visual oddities listed: PASS (reviewed 1440px desktop, 820px tablet, and live error).
- Keyboard check done: PASS (Enter key on focused citation chip opened passage slip).
- Servers stopped, no orphan process, temp script deleted, branch correct: PASS (ports 5173 and 8000 clear, no orphan workers, `agent_check_ag4.py` removed, branch `redesign/modernist-app`).

## 6. Things that surprised me
1. Real backend part L outcome: `API blocked`. All 3 queries returned a clean error frame:
   - `L 'What was my hemoglobin?' -> ERROR CARD: The AI service refused the request. Please try again later.  Try again`
   - `L 'Which of my values are outside the reference range?' -> ERROR CARD: The AI service refused the request. Please try again later.  Try again`
   - `L 'Tell me about my vitamin D result' -> ERROR CARD: The AI service refused the request. Please try again later.  Try again`
   Per RULES 5d, no proxy or fake provider workaround was used; the frontend cleanly caught the error and rendered the "Could not finish" card with the retry action.
2. Visual oddities:
   - In `ag4-answer-1440.png`, auto-scrolling to the bottom of a tall response with passage slip pushes the top of the trajectory box above the viewport top edge; the user must scroll up slightly to see the initial status line.
   - In `ag4-answer-820.png`, the sidebar collapses to a 60px icon strip, exactly avoiding horizontal overflow (`scrollWidth: 820 == innerWidth: 820`).
   - In `ag4-live-1440.png`, the error card matches the modernist styling with a red top rule and secondary "Try again" button without leaking any gateway diagnostics.
   - Expanding raw results inside a tool card has a compact max-height with an internal scrollbar, preventing long JSON results from taking over the trajectory list.
3. Mocked output: matched all required checklist items with 0 discrepancies.

## 7. Deviations from the task
none

## 8. Open questions for the reviewer
none

## 9. How the reviewer can double-check
1. Verify git branch is `redesign/modernist-app`: `git branch --show-current`.
2. Run frontend build: `cd "site design" && npm run build` (exits 0).
3. Verify dead file references: `Get-ChildItem src -Recurse -Include *.ts,*.tsx | Select-String -Pattern 'useChatStream|useAgentStream|components/ask|AskPage|"/ask"|/ask\?'`.
4. Verify styling and provider cleanliness: `Select-String -Path src\pages\AgentPage.tsx,src\hooks\useAgentChat.ts,src\components\agent\*.tsx -Pattern 'rounded|Spectral|backdrop|#[0-9a-fA-F]{3,6}|gemini|agentrouter|deepseek|claude|gpt|openai'`.
5. Run backend pytest suite: `cd vitagraph/backend && .venv\Scripts\python.exe -m pytest tests -q` (all tests pass).
6. Inspect screenshot artifacts: `gemini/shots/ag4-answer-1440.png`, `gemini/shots/ag4-answer-820.png`, and `gemini/shots/ag4-live-1440.png`.
