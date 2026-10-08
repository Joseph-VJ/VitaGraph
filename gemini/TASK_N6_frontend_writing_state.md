# SESSION N6 (frontend, small): show that the AI is writing

Read `gemini/RULES.md`, `gemini/reviews/N3N4_review.md` (item F1 is yours), then this file. Same rules as `gemini/TASK_N4_frontend_fixes.md` (they still apply): **branch `feature/ai-node-summary`**, **DO NOT COMMIT or stage**, never touch `vitagraph/backend`, reuse the servers on 5173 and 8000 (leave them running; do not restart them), never use port 8001, no `any`, no unused code, tokens only, no provider/model names. You may change ONLY `site design/src/components/graph/NodeSummary.tsx` and (if needed, `.vg-ai*` rules only) `site design/src/index.css`.

## The problem (seen in Chrome against the real backend)
After the `sources` event arrives the hook's phase becomes `writing` (the server sends `status: writing`) and the Sources rows show, but the text only starts about 6 seconds later. In that gap the box shows ONLY the label and the Sources list: no sign that anything is happening. The "Reading N passages…" line disappears too early because it is shown only while `phase === "reading"`.

## The fix
Show a status line (same element and class as today's wait line, `data-testid="node-summary-wait"`) whenever there is no text yet and the phase is not `done`/`error`, with wording driven by the REAL phase from the server (no timers):
- `reading`, no sources yet: `Finding the passages behind this dot…`
- `reading`, sources known: `Reading N passages from M files…`
- `writing`, no text yet: `Writing the summary from N passages…`
- `checking`, no text: `Checking it against your files…`
The line goes away the moment the first text arrives (the caret then shows as today). The Sources list stays visible below it as now. While the line shows, the label square pulses (already the case via `is-busy`); with reduced motion it does not pulse.

## Verify
1. `npm run build` exit 0; `npm run audit:design` 0 errors.
2. Real backend, persona `usr_7c9aaa7159d6` (read only; do not delete): select Hemoglobin, click "Write again", and sample the box every 0.5 s for 10 s with Playwright: record for each sample the wait-line text (or none), the number of source rows and the text length. Paste the table. Required: there is NO sample where the box has no text, no wait line and the phase is not done (apart from the instant of the first delta).
3. Mocked route: a response with `status writing` + `sources` and no text shows `Writing the summary from 2 passages…`; with only `status checking` shows `Checking it against your files…`.
4. Your earlier 15 mocked cases still pass (re-run them), console clean.
5. Screenshot with the writing line visible: `gemini/shots/N6-writing-1440.png`; look at it yourself.

## Acceptance
- [ ] Only `NodeSummary.tsx` (and at most the `.vg-ai*` CSS) changed.
- [ ] Build exit 0, audit 0 errors, the sampling table has no empty gap, earlier cases pass.
- [ ] Nothing committed or staged; servers left running.

Write `gemini/reports/N6_summary.md` (short, not committed) and reply with the RULES.md section 5 report.
