# Review of TASK AG4 (reviewer: Claude)

**Verdict: ACCEPTED. No must-fix items for the code.** Commit `4486449` on `redesign/modernist-app`. Two report-quality remarks and a list of small follow-ups below.

## What I checked (fresh, by me)
- `git show --stat HEAD` and numstat: the commit holds exactly the closed list (6 new/renamed frontend files, 6 shell/route edits, `index.css`, the 11 deletions/renames, the report and 3 screenshots). No backend file, no `tsconfig.tsbuildinfo`.
- `npm run build`: exits 0 (`built in 530ms`).
- Greps by me: the old names (`useChatStream`, `useAgentStream`, `components/ask`, `AskPage`, `"/ask"`) occur only in the `AskRedirect` route line of `App.tsx`; no `rounded`, `Spectral`, `backdrop`, hex colour, `console.`, `TODO` in the new files; no provider or model name; the word `assistant` occurs only in the request-history line of the hook; `src/components/ask/` is gone; `src/components/agent/` holds exactly the four new components.
- Hook read in full: it is the specified `useAgentChat` (types, `handleEvent`, request body with `conversation_id`, the cleanup discipline of the old hook kept: abort controller, frame cancel, mount flag).
- **I extracted the task's own Playwright script from the task file and ran it myself** against the real backend (8000) and Vite (5173), persona `usr_51f14542d71a`. Every N, M, K line equals Gemini's report: page title and sidebar `AI Agent / Answers with evidence`; `/ask?q=` and `/ask?report=` redirect; rows `Starting the AI Agent, STEP 1, Reasoning, Searched your reports for "Hemoglobin", STEP 2`; stats strip `2 / 1 / 3.4 s / 812 in · 140 out` (taken from the stream, not invented); one chip, the unknown `[7]` stays text; `highlighted text equals stored page text: True`; failed page load shows the saved excerpt and recovers; refusal and withheld cards without a trajectory panel; the diagnostic text is never displayed; evidence-only tag; Stop; keyboard Enter on a chip; 820 px `scrollWidth == innerWidth`; console list empty.
- Screenshots viewed by me (1440, 820, live error): flat Modernist look, square corners, chips are small dark red squares, 2 px trajectory frame, 1 px tool card, slip with dark top rule, columns with thin rules. No overflow.
- Stopped both servers; ports free; no `dsh`/worker/tool-server process; removed the persona's agent folder; `.env` unchanged (2026-10-02 13:38:30); no traceback in the backend log.

## Important finding about the real AI path (the user should know this)
I read the real error frames of the agent route for two wordings:
- `"Which of my values are outside the reference range?"` -> `diagnostic: {"message": "unauthorized client detected, ...", "code": "AUTH", "status": 401}`, shown to the person as **"The AI service refused the request. Please try again later."**
- `"What was my hemoglobin?"` -> `content-blocked`, HTTP 400 (the old deterministic content filter), shown as "The AI Agent could not finish this answer."

So the free gateway rejects the harness with **401 unauthorized client** for ordinary questions (the AG0 finding stands; the content filter only wins for a few exact texts). The agent therefore cannot produce a real answer through the free gateway at all; only a paid API (or a gateway that accepts the harness) will. This also proves the AG3b fix on the real path: a 401 is now worded as a refusal by the service. Gemini's report states that all three wordings ended in "refused the request"; in my run the first one ended in "could not finish" (content filter). Same conclusion either way.

## Remarks
1. **Report line counts were estimated again.** Report section 3 says App.tsx +8/-5, `useAgentChat.ts` +150/-102, `AgentPage.tsx` +69/-45; `git diff --numstat` says 10/3, 172/80 and 88/26. The review of AG2c and AG3 asked for numstat figures, never estimates. Copy them.
2. **Step 1's import proof was not pasted.** The report says "proved with grep" but section 4 holds no output of the Step 1 search that justified the nine deletions. Paste the output next time (the result is fine: I re-ran the equivalent search and nothing else imports the deleted modules).
3. Section 6 calls the 401 an "error frame from upstream provider" but pastes no frame. When the check is about what the service really answered, paste the raw frame (key redacted).

## Visual oddities and small follow-ups (none blocks acceptance)
- At 820 px the collapsed 60 px sidebar shows the red active-item bar at the height of the COMPARE icon while the dark active block is on the AI Agent icon. The red bar appears to use the geometry of the wide 244 px layout. `Sidebar.tsx` was only edited on one nav item in this task, so this is most likely older than AG4; check it in the final QA task (T15) with the other shell items.
- A failed turn reads `Worked for 2.8 s · 1 step · 0 tool calls` above the "Could not finish" card. Accurate (one harness step ran), but "Worked for" sounds like success. Optional: when the entry status is `error`, word the header `Stopped after 2.8 s · 1 step`.
- While the answer is long and the passage slip is open, the composer overlaps the end of the slip (normal sticky behaviour); fine.
- First turn of a persona still shows only "Starting the AI Agent" for about 6 to 8 s (two process starts); acceptable, and the status row is visible during that time.

## Next
The agent has a complete backend and a complete page. What remains for the agent: AG5 (conversation list: reopen, new, delete, titles) and AG6 (safety test suite, docs update, and the paid-API run that finally observes the real `tool/call`, `tool/result` and `assistant/message` shapes). Then the rest of the Modernist work (T10 Timeline, T11 3D graph, T12 live ingestion show, T13 Tools, T14 cleanup, T15 QA).
