<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task A6 — Compare: shared states, retry that really retries, phone layout

- **Goal:** Move the Compare page onto the shared frame and states. Make "Try again" reload the comparison as well, and stop the pickers and table from overflowing at 360 px.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `site design/src/pages/ComparePage.tsx`
  - `site design/src/components/ui/index.ts`
- **Files to create or modify:**
  - modify `site design/src/pages/ComparePage.tsx`

**What to change**
1. **Imports:** `site design/src/pages/ComparePage.tsx` line 6 (anchor `import { makeLabeler, sortReports } from "../lib/reportLabels";`). After this import, add an import of `PageFrame`, `PageState`, `PersonaState` and `Tag` from `../components/ui`.
2. **Persona context:** `site design/src/pages/ComparePage.tsx` line 35 (anchor `const { user } = useActiveUser();`). Also read `loading` (as `personaLoading`) and `refreshUsers`.
3. **Comparison effect:** `site design/src/pages/ComparePage.tsx` lines 73–85 (anchor `}, [userId, baselineId, followupId]);`).
   - Add `reloadTick` to the dependency list. Today "Try again" reloads only the report list, never the comparison.
   - Update the comment above the effect to "Load the comparison for the chosen pair (again after "Try again")".
4. **States:** `site design/src/pages/ComparePage.tsx` lines 99–126 (anchor `const pageStyle: React.CSSProperties`).
   - Delete `pageStyle` and `noteStyle`, and add a function `retry` that increments `reloadTick`.
   - Replace the early returns with these states, each inside `PageFrame` with label "Compare" and gap `var(--space-6)`:
     - **No persona:** `PersonaState`, as in task A5.
     - **Reports loading:** `PageState` loading, "Loading reports".
     - **Error while no reports are loaded:** `PageState` error, "Could not load reports", the error as detail, and the action "Try again" (`retry`).
     - **Fewer than two reports:** `PageState` empty, title "Comparing needs two reports", detail "This persona has N report(s). Upload another one to compare values." Write "report" when N is 1 and "reports" otherwise. The action is "Upload a report", using the same `transitionNavigate` call as today.
5. **Root element:** `site design/src/pages/ComparePage.tsx` line 132 (anchor `<div data-screen-label="Compare" style={pageStyle}>`). It becomes `PageFrame` with label "Compare" and gap `var(--space-6)`. Its closing tag at `site design/src/pages/ComparePage.tsx` line 214 (anchor `</div>`) becomes `</PageFrame>`.
6. **Report pickers:** `site design/src/pages/ComparePage.tsx` lines 151–158 (anchor `minWidth: 260`).
   - Both `field` boxes get `flex: "1 1 260px"` and `minWidth: "min(260px, 100%)"`, replacing the fixed `minWidth: 260`.
   - With this change the two pickers stack on a phone.
7. **Messages:** `site design/src/pages/ComparePage.tsx` lines 167–168 (anchor `Could not load the comparison`).
   - The comparison error becomes `PageState` error, title "Could not load the comparison", the error as detail, and the action "Try again" (`retry`).
   - The loading line becomes `PageState` loading, "Comparing".
8. **Comparison table:** `site design/src/pages/ComparePage.tsx` lines 170–212 (anchor `data-testid="compare-table"`).
   - Wrap the table in a `div` with class `vg-scroll-x`, and give the table an inline `minWidth` of 560.
   - The status cell renders `Tag`: tone `neutral` when there is no delta ("One report"), and tone `accent` otherwise.
   - Keep these test IDs: `compare-table`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser on `/compare` with "Empty Test Persona" (it has at least two reports): pick two reports, and the table fills in. At 360 × 740, the pickers stack, the table scrolls inside its box, and there is no page-level horizontal scroll.
3. Stop the backend, pick another pair, and the comparison error appears. Start the backend, click "Try again", and the table loads without a page reload.

**Acceptance criteria**
- [ ] `reloadTick` is in the comparison effect's dependency list.
- [ ] No `noteStyle` or `pageStyle` remains in the file.
- [ ] "Try again" after a comparison error reloads the comparison (step 3 of the checks).
- [ ] At 360 px there is no page-level horizontal scroll on `/compare`.
- [ ] The build exits 0.
