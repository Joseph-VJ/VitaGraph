<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task D10 — Artifact cards with a subtle 3D effect that stays readable

- **Goal:** Show code and report artifacts as cards. A card tilts very slightly in 3D and lifts on hover or focus, stays flat when motion is reduced, and its text is always sharp and easy to read. It also lets a person make a report from the page.
- **Tier:** Could
- **Size:** M
- **Review:** light
- **Depends on:** D4, D11
- **Files to read first:**
  - `site design/src/api/agent.ts`
  - `site design/src/hooks/useAgentChat.ts` lines 42–57 (anchor `export interface AgentEntry {`) and line 278 (anchor `case "tool_result": {`)
  - `site design/src/index.css` lines 1032–1043 (anchor `.agent-evidence-row:hover`)
- **Files to create or modify:**
  - modify `site design/src/api/agent.ts`
  - modify `site design/src/hooks/useAgentChat.ts`
  - create `site design/src/components/agent/ArtifactCard.tsx`
  - modify `site design/src/index.css`
  - modify `site design/src/pages/AgentPage.tsx`

**What to change**
1. **Client:** in `agent.ts`, add the interface `ArtifactSummary`, matching D4's `ArtifactOut`, and two functions:
   - `createReport(userId, format, title, conversationId?)`, calling `POST /api/agent/artifacts/report`;
   - `artifactUrl(userId, artifactId)`, building the full `BASE_URL` address of `GET /api/agent/artifacts/{artifact_id}?user_id=`.
2. **Hook:**
   - Add `artifacts: ArtifactSummary[]` to `AgentEntry`. Fill it in the `tool_result` case when the result has an `artifact` object; that happens only when D5 is done and the AI runs.
   - Add `addArtifact(entryId, artifact)`.
3. **CSS:** append to `site design/src/index.css` a class `.artifact-card` and its states.
   - **Resting:** a flat card with background `--color-bg`, a 2 px top rule in `--color-text`, no radius, no shadow, `transform: none`, and a transition of `transform` and `box-shadow` over 160 ms.
   - **Hover and focus-within:**
     - `transform: perspective(900px) rotateX(1.5deg) rotateY(-1.5deg) translateY(-2px)`;
     - `box-shadow: var(--shadow-md)`. The card is now floating, so a shadow is allowed.
   - **Readability:**
     - The tilt is at most 1.5 degrees.
     - `backface-visibility: hidden` and `-webkit-font-smoothing: antialiased` keep the text crisp.
     - Never blur, and never scale the text.
   - **Reduced motion:** under `@media (prefers-reduced-motion: reduce)` and under `:root[data-reduce-motion="true"]` (set by `lib/preferences.ts`), the card has no transform and no transition, only the shadow on hover.
4. **Create `ArtifactCard.tsx`.**
   - **Props:** `artifact`, `userId`, and for code, the code text.
   - **Wrapper:** an `article` with class `artifact-card`, `data-testid="agent-artifact"`, `data-kind`, and `tabIndex={0}` so keyboard focus shows the same lift.
   - **Header:** a kicker ("Code", "HTML report" or "PDF report"), the title in bold, and a line with:
     - the language and line count for code;
     - the page count for PDF;
     - the creation time.
   - **Code:** the text in a `pre` with `white-space: pre-wrap` and `overflow-wrap: anywhere`, in Archivo at 0.875rem with a line height of 1.6 (open issue O-8). Below it:
     - a "Copy" button, which writes to the clipboard and shows "Copied" for 2 seconds; the timer is cleared on unmount;
     - "Download", a link to `artifactUrl` with the `download` attribute.
   - **HTML report:**
     - "Open" (a new tab to `artifactUrl`) and "Download";
     - a 360 px preview in an `iframe` with `sandbox=""` (no scripts) and `title` set to the report title.
   - **PDF report:** "Open" and "Download".
5. **Page:**
   - Under each answer, render an `ArtifactCard` for each item in `entry.artifacts`. When the model called `show_code`, the code text comes from that tool call's `code` argument in the trajectory.
   - Add a "Make a report" control with HTML and PDF choices to the page header row.
     1. It calls `createReport(userId, format, "Health report summary", conversationId)`.
     2. It adds a local entry holding the card.
     3. While it runs it shows "Making the report"; on failure, it shows the real error.
   - **Only when D8 is done:** also register `/report html|pdf`, which does the same.

**How to verify**
1. `cd "site design"; npm run build; npm run audit:design`. Both must exit 0.
2. Browser, with the AI off:
   - "Make a report" with PDF gives a PDF card. "Open" shows values equal to `GET /api/reports/<id>/measurements`; paste two.
   - With HTML, the card shows a sandboxed preview.
   - Hovering a card lifts it slightly. With Settings > Reduce motion on, it stays flat.

**Acceptance criteria**
- [ ] The tilt is at most 1.5 degrees, and the card is flat under both reduced-motion signals.
- [ ] There is no blur and no radius. The shadow appears only on the lifted card.
- [ ] The HTML preview is sandboxed.
- [ ] Report values come from the persona's data (pasted).
- [ ] The build and the audit exit 0.
