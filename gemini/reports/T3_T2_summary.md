# T3 T2 frontend report

Status: **COMPLETE**, implemented by Codex on the owner's request to finish the last work directly. No sub-agents, commits or pushes.

## 1. What I was asked to do
Close D2: show the correct red key help and disable Test/Save when the saved host changes and the key box is empty. Keep the Modernist layout, verify against the backend and update the complete handover.

## 2. What I actually did
1. Added TASK_T3's `hostOf`, `hostChanged`, `needsKey` and `filled` conditions.
2. Updated the key help, placeholder, red accent-700/600 style and `ai-conn-key-help` test id.
3. Applied the same action guard to Save without testing so it cannot bypass the key requirement in the error flow.
4. Built and audited; checked 32 browser behaviours against the real scratch backend, captured four screenshots, and checked the primary Settings page after starting the verified app.

## 3. Files changed
`site design/src/components/settings/AiConnectionSection.tsx`: untracked from T2, now 396 lines. No API client or Settings layout changes were needed for T3. The existing `tsconfig.tsbuildinfo` is a generated build cache and must not be staged. Related documentation updates are listed in the final review and SESSION_CONTEXT section 40.

## 4. Commands and their output
`npm run build` (includes tsc -b):
```text
vite v8.3.2 building client environment for production...
400 modules transformed.
✓ built in 720ms
Exit code 0
```
`npm run audit:design`:
```text
Checked 104 files: 0 error(s), 0 pending.
```
`python scripts/plan/secret_scan.py`:
```text
RESULT: PASS
```
Browser checks: **32 passed**. Primary page: six checks passed (address/model match API, empty key input, help present, no connection-offline block, no app console errors). No app warnings/errors; one browser HTTP error was the deliberately rejected 422 failed-save check.

## 5. Acceptance checklist
- PASS: a saved 127.0.0.1:8099 address changed to localhost:8099 produces the red help line and disables Test/Save; a typed key enables both.
- PASS: another path on the saved host restores normal help and allows Save; a typed key to another host saves successfully.
- PASS: Save without testing is disabled for a changed host with an empty key.
- PASS: Test saves nothing, Save clears the key box, reload keeps address/model but no key, Show/Hide work, Enter submits, remove dialog focuses Keep it, Escape closes it and confirm removes the key.
- PASS: Responses coverage and Chat warning; failed save keeps the old connection; no key in DOM/HTML/storage/console after saving.
- PASS: no overflow at 1440, 1000, 820 and 400 pixels; 820 checked at height 1100. Reduced-motion controls work.

## 6. Things that surprised me
After reloading, the saved explicit format remains selected. The initial test incorrectly assumed changing a URL ending in /responses would change an explicit Chat selection. The passing check explicitly selects Detect from the address first.

## 7. Deviations from the task
Added the guard to Save without testing. Used scratch backend 8001 and frontend 5174 (allowed by CORS), rather than the obsolete 5175 instruction. Owner requested direct completion and documentation updates. No visual redesign or extra assets were introduced.

## 8. Open questions for the reviewer
None for T3. Firefox/Safari and a real remote client were not checked. The screenshot comparison to 10_Settings.png shows the previously approved Trust/My Data navigation, living background, process-theatre-era Settings and added AI connection; T3 changes only conditional help and action states.

## 9. How the reviewer can double-check
Screenshots:
- `gemini/shots/T3-host-changed-1440.png`
- `gemini/shots/T3-settings-1440.png`
- `gemini/shots/T3-settings-820.png`
- `gemini/shots/T3-settings-400.png`

Browser check results are in `gemini/reports/T3_browser_checks.json`. Scratch files are under `C:/Users/Admin/AppData/Local/Temp/codex-vita-t3-49735847c0f54036b8761092a3a9ba40/`; scratch ports 8001/5174/8099 are free. Primary app is running on 8000/5173.

Branch proof: `feature/privacy-shield-and-rag-lab`; HEAD `c4fca21`. Work remains uncommitted.
