<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task D7 — Display modes: Minimal, Standard, Detailed

- **Goal:** Let a person choose how much of the agent's loop is shown. The choice persists and maps to the harness's compact, standard and detailed modes.
- **Tier:** Could
- **Size:** M
- **Review:** light
- **Depends on:** D11
- **Files to read first:**
  - `site design/src/components/agent/TrajectoryPanel.tsx`
  - `site design/src/lib/preferences.ts`
  - `site design/src/pages/AgentPage.tsx`
- **Files to create or modify:**
  - modify `site design/src/lib/preferences.ts`
  - modify `site design/src/components/agent/TrajectoryPanel.tsx`
  - modify `site design/src/pages/AgentPage.tsx`

**What to change**
1. **Preference:** in `preferences.ts`, add `agentDisplay` with the values `"minimal"`, `"standard"` or `"detailed"`, default `"standard"`, validated in `load()` like `graphView` (B7).
2. **`TrajectoryPanel`** takes a new prop, `mode`:
   - **Minimal (compact):** only one status line and the run stats line from D11. The steps are hidden.
   - **Standard:** the view as it is after D11. Each tool call is one row with its name, an arguments summary and its duration. Reasoning is collapsed, and raw results sit behind `agent-raw-toggle`.
   - **Detailed:** everything is expanded. The reasoning text, each tool's full arguments and raw result, and the step numbers are shown.
   - Keep these test IDs: `agent-trajectory`, `agent-tool-card`, `agent-raw-toggle`, `agent-raw`, `agent-stats`.
3. **Page control:**
   - In `AgentPage.tsx`, add a `seg` control "Minimal · Standard · Detailed" above the messages, with `data-testid="agent-display-mode"`, bound to `usePreferences().agentDisplay` and `setPreference`.
   - Pass the mode to every `TrajectoryPanel`.
   - In Minimal, the evidence modules stay visible. Only the loop is condensed.
4. **Only when D8 is done:** register the command `/mode minimal|standard|detailed`, which sets the preference when the argument is valid.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser: switch the three modes on an answered entry. The loop view changes, and the choice survives a reload.

**Acceptance criteria**
- [ ] Three modes exist, and an unknown stored value falls back to standard.
- [ ] The five test IDs still exist.
- [ ] The build exits 0.
