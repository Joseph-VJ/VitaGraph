<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task A10 — AI Agent page: no demo fallback, real loading, empty and error states, phone gutters

- **Goal:** The AI Agent page never borrows the demo persona. It shows the shared persona, loading, empty and error states, and uses 16 px gutters on phones.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `site design/src/pages/AgentPage.tsx`
  - `site design/src/hooks/useAgentChat.ts`
  - `site design/src/components/ui/index.ts`
- **Files to create or modify:**
  - modify `site design/src/pages/AgentPage.tsx`

**What to change**
1. **Imports:** `site design/src/pages/AgentPage.tsx` line 11 (anchor `import { TrajectoryPanel } from "../components/agent/TrajectoryPanel";`). Add an import of `PageState` and `PersonaState` from `../components/ui`.
2. **Persona:** `site design/src/pages/AgentPage.tsx` lines 203–204 (anchor `|| "VG-2026-001"`).
   - Read `user`, `loading` (as `personaLoading`) and `refreshUsers`.
   - `effectiveUserId` becomes `user?.id ?? ""`: no localStorage fallback and no demo ID.
3. **Retry counter:** `site design/src/pages/AgentPage.tsx` line 212 (anchor `const [reportsState, setReportsState]`). Add a number state `reportsTick` (0) for retrying the report list.
4. **Report-list effect:** `site design/src/pages/AgentPage.tsx` lines 245–262 (anchor `// The persona's reports: they decide the empty state`).
   - Return at once when `effectiveUserId` is empty.
   - The dependency list becomes `[effectiveUserId, reportsTick]`.
5. **Scroll listener:** `site design/src/pages/AgentPage.tsx` lines 309–318 (anchor `// Follow the answer while the reader is at the bottom`). Change its dependency list from `[]` to `[effectiveUserId]`.
   - Without this, the listener never attaches. Step 6 returns early, without the chat column, while the persona is still loading. On that first render `bottomRef.current` is null, and an effect with `[]` would never run again.
6. **Persona gate:** after the last hook (`site design/src/pages/AgentPage.tsx` lines 320–323, anchor `useLayoutEffect(() => {`) and before `placeholder`, when `effectiveUserId` is empty, return:
   - a `div` with `data-screen-label="AI Agent"`, `data-testid="agent-page"`, class `vg-pad`, max width 960 px and auto side margins;
   - containing `PersonaState`, with `loading` from the context and a retry that calls `refreshUsers`.
   
   This early return is safe because it comes after every hook call.
7. **Composer placeholder:** `site design/src/pages/AgentPage.tsx` line 325 (anchor `const placeholder = composerReady`). It has three cases:
   - "Ask the AI Agent about a value, a trend or a report" when the composer is ready;
   - "Loading your reports" while the report list loads;
   - otherwise "Upload a report to start asking".
8. **Column gutters:** `site design/src/pages/AgentPage.tsx` lines 328–341 (anchor `padding: "var(--space-8) var(--space-8) var(--space-4)"`). The column `div` gets class `vg-gutter`. Its `padding` shorthand becomes `paddingTop: "var(--space-8)"` plus `paddingBottom: "var(--space-4)"`; the class supplies the side gutters.
9. **Empty states:** `site design/src/pages/AgentPage.tsx` lines 375–392 (anchor `data-testid="agent-empty"`). Inside `agent-empty`:
   - **Report list failed:** `PageState` kind error, title "Could not load your reports", detail "Check that the backend is running, then try again.", and the action "Try again", which increments `reportsTick`. This replaces "Cannot reach the backend … reload this page".
   - **Ready with no reports:** `PageState` kind empty, title "No reports yet", detail "Upload a report first, then ask about it here.", and the action "Upload a report", which navigates to `/upload`.
   - **Loading:** a new branch, `PageState` kind loading, "Loading your reports". Today the page shows the question prompt while it is still loading.
   - **Otherwise:** the existing "What would you like to know?" block, unchanged.
10. **Composer gutters:** `site design/src/pages/AgentPage.tsx` lines 449–462 (anchor `data-testid="agent-composer"`). The form gets class `vg-gutter`. Its `padding` shorthand becomes `paddingTop` and `paddingBottom` of `var(--space-4)`.
    - Keep these test IDs: `agent-page`, `agent-empty`, `agent-composer`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. `Select-String -Path "site design\src\pages\AgentPage.tsx" -Pattern 'VG-2026'` prints nothing.
3. Browser: `/agent` with "Empty Test Persona" shows "What would you like to know?". Then stop the backend and reload:
   - The persona state shows, because the persona list cannot load either.
   - Start the backend and click "Try again". The page recovers without a reload.
4. In the browser at 360 × 740, there is no page-level horizontal scroll.

**Acceptance criteria**
- [ ] No demo fallback remains.
- [ ] Loading, empty and error each use `PageState`, and the error has a working "Try again".
- [ ] The scroll-follow effect depends on `[effectiveUserId]`.
- [ ] The three listed test IDs still exist.
- [ ] The build exits 0.
