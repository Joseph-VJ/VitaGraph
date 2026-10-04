# Review of TASK 08 (reviewer: Claude)

**Verdict: ACCEPTED, with ONE small fix required (Task 08b).** Commit `c40d260` on `redesign/modernist-app`.

## What I checked (all by me, fresh)
- `git show --stat HEAD`: exactly the files of the closed list plus the four screenshots and the report. No backend file changed.
- `preferences.ts` and `SettingsPage.tsx` are byte-identical to the code in the task. The six small edits equal the task text.
- `npm run build`: exit 0.
- Live, real backend, persona `usr_d1d7f9b2a4b1`: Settings matches `10_Settings.png` (section order, red heads with 2px rule, red active button, outlined inactive button, grey right-aligned notes). Console was clean on Settings and Upload (no font warnings).
- Real `vitagraph/backend/.env`: same last-write time as before (2 Oct 13:38), `ALLOW_API=true`, no backup left in TEMP, no server left running.
- Your screenshots: Cinematic Off really suppresses the popup while the five pipeline rows run live; the backend-down screenshot is honest (notes unavailable, buttons dimmed, red status line, offline banner).

## Must fix (Task 08b)
`task08-settings-820.png` (your own screenshot) shows a contradiction: the footer says "Backend online · 50 chunks · 5 reports", yet the notes say "Not available while the backend is unreachable" and the privacy buttons are dimmed. The cause is in the code of the task (my fault): while the first request is still loading, `health` is still `null`, so the page prints the "unreachable" text. I reproduced it by slowing `/api/health`: the note says "unreachable" until the data arrives, then flips to "About 200 characters per chunk...". On a slow machine this is a visible lie. Fix: say "Loading" while loading and only say "unreachable" when the request really failed. See `gemini/TASK_08b_loading_state.md`.

## Notes
1. You captured the 820px screenshot during the load, so it exposed the bug, but your report did not mention the contradiction. Rule from now on: after every screenshot, compare what the page says with what the footer, the header and the API say, and write any mismatch in section 6 of the report.
2. Section 4 of the report summarises some checks in one line (5.9, 5.10) instead of pasting output. It was acceptable here because I re-ran them, but paste the raw output where the task asks for it.
3. Good: honest listing of the expected differences from the reference, correct persona for the upload test, `.env` restored with proof.

## Known, not for you to fix now
The Upload frame stage still shows the developer text "Frames go in assets/frames..." (no frame images exist yet). It is tracked in the session context.
