# SESSION N4 (frontend fixes): after the review of N2

Read `gemini/RULES.md`, then `gemini/reviews/N1N2_review.md` (items 6 to 11 are yours), then this file. Same rules as `gemini/TASK_N2_frontend_node_summary.md` (the overrides there still apply): **branch `feature/ai-node-summary`**, **DO NOT COMMIT or stage**, never touch `vitagraph/backend`, reuse the servers on 5173 and 8000 (leave them running; the backend on 8000 now runs the N1 code), never use port 8001, never touch `tsconfig.tsbuildinfo`, no `any`, no unused code, no provider/model names, no raw hex, no radius. You may change ONLY `site design/src/components/graph/NodeSummary.tsx`, `site design/src/hooks/useNodeSummary.ts` and (append or edit the `.vg-ai*` rules only) `site design/src/index.css`. If something fails 3 times, stop that part and say so.

Start: `git branch --show-current`, `cd "site design"; npm run build` and `npm run audit:design` (baselines).

## Part 1: OCR badge (item 6)
In `NodeSummary.tsx` the meta line shows ` · OCR` when `src.method.startsWith("ocr")` (the backend now sends `ocr`, but never rely on one spelling).

## Part 2: wait before asking (item 7)
In `useNodeSummary.ts`: when the memory cache does NOT have the node, wait **250 ms** after the node becomes selected before sending the request, and cancel that wait (and the request) if the node changes or the component unmounts first. This is a debounce so fast clicking across dots sends at most one request, not a progress timer: the box shows the "Finding the passages behind this dot…" state during the wait. A cached node still shows instantly with no wait. Use `window.setTimeout` with `clearTimeout` in the effect cleanup. "Write again" sends its request at once (no wait).

## Part 3: bring the box into view (item 8)
When the box appears for a newly selected dot, scroll it into view: `ref.current.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" })`, where `reduceMotion` is `window.matchMedia("(prefers-reduced-motion: reduce)").matches` OR the app's own reduce-motion preference (look at `src/lib/preferences.ts` for how other components read it; use the same helper if there is one). Do it once per mounted box (the page already remounts the box per dot through its `key`). On the phone the box must end up fully inside the viewport width and its top within the visible area.

## Part 4: sources early (item 9)
Show the Sources list as soon as the `sources` event has arrived (`s.sources.length > 0`), not only at the end: the rows appear under the "Reading N passages…" line, with the same look, and opening a row works while the text is still being written. The header says "Sources · N passages in M files". Keep the final layout identical to today. The `[n]` citations in the text still highlight their row.

## Part 5: tidy (item 11)
Remove the unused `streaming` parameter of `renderSummary` and the `void streaming;` line.

## Part 6: verify
1. `npm run build` exit 0; `npm run audit:design` 0 errors.
2. Re-run your 10 mocked-route cases from N2 (they must still pass) and add:
   - 11. `"method":"ocr"` and `"method":"ocr-rapid"` sources both show ` · OCR` in the quote meta; `"native"` does not.
   - 12. Click 6 different dots within 150 ms of each other (use `page.mouse.click` in a tight loop on dots that exist): at most ONE `node-summary` request is sent, and only for the last dot. (Use the real graph of `usr_51f14542d71a`; the route is mocked.)
   - 13. Sources rows are visible while the text is still empty. A mock cannot hold a stream open, so test this one against the REAL backend (part 4 below): select a node that is not cached yet (for example the person node of `usr_7c9aaa7159d6`, which takes several seconds), and about 1 s after the click assert that `[data-testid=node-summary-source]` rows exist while `[data-testid=node-summary-text]` is absent or empty; take a screenshot of that moment.
   - 14. After selecting a dot on the 400x860 phone viewport, the box is inside the viewport (`getBoundingClientRect` top between 0 and the viewport height, right edge <= 400) and `document.documentElement.scrollWidth <= window.innerWidth`.
   - 15. With reduced motion (`ctx = browser.new_context(reduced_motion="reduce")`) the box still appears, no caret animation is running (`getComputedStyle(".vg-ai-caret").animationName === "none"`).
3. Screenshots with a dot SELECTED and the box visible: `gemini/shots/N4-graph-summary-1440.png` and `gemini/shots/N4-graph-summary-400.png`, using a persona with data (`usr_51f14542d71a`) and the mocked route. Look at them yourself: no overlap, no clipped text, citation squares and quote readable.
4. One real (unmocked) pass on 1440x900 with the throwaway persona the reviewer left, id `usr_7c9aaa7159d6` (read only; do not delete it): select Hemoglobin and watch the box: wait line, sources appear, text streams, final text, open a quote. Report what you saw in two lines.

## Acceptance
- [ ] Only the three allowed files changed (`git status --short` compared with your Part 0 note).
- [ ] Build exit 0, audit 0 errors; cases 1 to 15 PASS.
- [ ] The two N4 screenshots show the box with a selected dot (phone included).
- [ ] Nothing committed or staged; servers on 5173 and 8000 left running.

Finish with `gemini/reports/N4_summary.md` (short, not committed) and the RULES.md section 5 report.
