<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task F4 — Project documents brought up to date

- **Goal:** Make the project documents describe the branch as it is after this plan, replacing the stale design, test and streaming facts (issues O-1, O-2 and O-7).
- **Tier:** Should
- **Size:** S
- **Review:** light
- **Depends on:** F1, F2, F3, B11, C6, D12, E5
- **Files to read first:**
  - `CLAUDE.md`
  - `AGENTS.md`
  - `GEMINI.md`
  - `README.md`
  - `docs/ui-ux-design-notes.md`
  - this plan's sections 2, 4 and 14
- **Files to create or modify:**
  - modify `CLAUDE.md`
  - modify `AGENTS.md`
  - modify `GEMINI.md`
  - modify `README.md`
  - modify `docs/ui-ux-design-notes.md`

**What to change**
1. **In all five documents**, wherever they speak about these subjects, state:
   - **Design:** the Modernist design system (Archivo only, the tokens in `site design/src/theme/tokens.css`, no radius, no blur, one red accent, meaning colours for verified, caution and uncertain). Remove the "Instrument & Paper", Spectral, IBM Plex and graphite text (`CLAUDE.md` lines 9–10, anchor `Spectral`; line 32, anchor `graphite`).
   - **AI Agent stream:** `POST /api/agent/stream` with its events (status, step, thinking, tool_call, tool_result, text_delta, stats, completed, error), plus the conversation and artifact routes this plan added. Replace the `/api/questions/stream` contract text (`CLAUDE.md` line 22, anchor `POST /api/questions/stream`).
   - **Tests:** the real backend test count from the last full run, pasted from the run. Replace "60/60" (`CLAUDE.md` line 19, anchor `60/60 pytest passing`).
   - **Packages:** the added packages and their pinned versions.
   - **Check scripts:** the scripts in `scripts/plan/` and what each proves.
   - **Rules kept:** no provider names in the UI, `uncertain` stays labelled, exactly six pipeline stages, and no invented data.
   - **Open issues:** that the open issues live in this plan's section 14.
2. Keep each document's own purpose and voice. `AGENTS.md` stays the loop rules, and `README.md` stays the user-facing introduction. Only correct and extend facts.
3. No secret, no `.env` content and no persona data from a real person in any document.

**How to verify**
1. `Select-String -Path CLAUDE.md,AGENTS.md,GEMINI.md,README.md,docs\ui-ux-design-notes.md -Pattern 'Spectral|IBM Plex|60/60|graphite|questions/stream'` prints nothing, unless a line explains the history. Paste any remaining line with its reason.
2. `python scripts\plan\secret_scan.py` ends with `RESULT: PASS`.

**Acceptance criteria**
- [ ] The five documents state the design, stream, tests, packages, scripts and rules as they now are.
- [ ] The stale facts are gone (check 1).
- [ ] The secret scan passes.
