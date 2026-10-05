<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task A5 — Library: shared states, phone tables and honest status labels

- **Goal:** Move the Library page onto the shared frame, states and tags. Make its two tables scroll sideways on phones, and stop it from treating a failed page load as "empty text".
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `site design/src/pages/LibraryPage.tsx`
  - `site design/src/lib/reportLabels.ts`
  - `site design/src/context/UserContext.tsx` lines 6–12 (anchor `refreshUsers: () => Promise<void>;`)
  - `site design/src/components/ui/index.ts`
- **Files to create or modify:**
  - modify `site design/src/lib/reportLabels.ts`
  - modify `site design/src/pages/LibraryPage.tsx`

**What to change**
1. **New helper `reportStatus`:** at the end of `site design/src/lib/reportLabels.ts`, after `makeLabeler` (`site design/src/lib/reportLabels.ts` lines 34–45, anchor `export function makeLabeler`).
   - It takes an object with a report's `status` and returns a label plus a tone (`"done"`, `"failed"` or `"waiting"`):
     - `ready` gives "Indexed" with tone done;
     - `failed` gives "Failed" with tone failed;
     - any other status gives the stored status with its first letter in capitals, with tone waiting.
   - Add a one-line doc comment: "The status tag of a report row: Indexed, Failed, or the pipeline state exactly as stored."
   - This moves the inline logic now in `site design/src/pages/LibraryPage.tsx` lines 133–136 (anchor `r.status === "ready" ? { text: "Indexed"`) into a shared function.
2. **Imports:** `site design/src/pages/LibraryPage.tsx` line 6 (anchor `import { makeLabeler, sortReports } from "../lib/reportLabels";`).
   - Also import `reportStatus`.
   - Add an import of `PageFrame`, `PageState`, `PersonaState`, `Tag` and the type `TagTone` from `../components/ui`.
3. **Grid columns:** `site design/src/pages/LibraryPage.tsx` line 14 (anchor `5.5rem`). Widen the fourth column from `5.5rem` to `8rem`, so the longer status labels from step 4 fit on one line.
4. **`statusOf`:** `site design/src/pages/LibraryPage.tsx` lines 16–26 (anchor `function statusOf(r: MeasurementRow)`).
   - It returns `{ label, tone }` with a `TagTone` instead of `{ label, hot }`: `hot` becomes tone `hot`, and not-hot becomes tone `neutral`.
   - Keep the range logic and the LOW and HIGH flags exactly as they are.
   - Add one new case before the final "No range": when the uppercased lab flag is not empty and not `NORMAL`, return the label "Lab flag " followed by the flag in lower case, with tone `hot`. Today such a flag is silently shown as "No range".
   - Add a doc comment: "Status from the report's own printed range, else the lab's own flag. Never a judgement of ours."
5. **Persona context:** `site design/src/pages/LibraryPage.tsx` line 30 (anchor `const { user } = useActiveUser();`). Also read `loading` (as `personaLoading`) and `refreshUsers` from the context.
6. **Page-load failure:** `site design/src/pages/LibraryPage.tsx` line 40 (anchor `const [pages, setPages]`). Add a boolean state `pagesFailed`, starting false.
   - In the selected-report effect, `site design/src/pages/LibraryPage.tsx` lines 75–90 (anchor `setPages(null);`), reset it to false next to `setPages(null)`.
   - In `toggle`, `site design/src/pages/LibraryPage.tsx` lines 92–98 (anchor `const toggle = (testName: string) =>`):
     - Request the pages only when they are not loaded and `pagesFailed` is false.
     - On failure, set `pagesFailed` to true, instead of setting an empty page list. An empty list made a failed load look like a page with no text.
7. **States:** `site design/src/pages/LibraryPage.tsx` lines 100–123 (anchor `const pageStyle: React.CSSProperties`).
   - Delete `pageStyle` and `note`, then replace the early returns with four states, each inside `PageFrame` with label "Library":
     - **No persona:** `PersonaState`, with `loading` from the context and a retry that calls `refreshUsers`.
     - **Reports still loading:** `PageState` kind loading, title "Loading reports".
     - **Load error:** `PageState` kind error, title "Could not load reports", the error message as detail, and the action "Try again", which increments `tick`.
     - **No reports:** `PageState` kind empty, title "No reports yet", detail "Upload a report to see the values read from it.", and the action "Upload a report". It calls `transitionNavigate(navigate, "/upload", { direction: "back" })` exactly as the current button does.
   - Keep the condition order exactly as above, so a missing persona never shows "Loading reports" forever.
8. **Reports table:** `site design/src/pages/LibraryPage.tsx` lines 125–156 (anchor `data-testid="library-table"`).
   - The root `div` becomes `PageFrame` with label "Library".
   - Wrap the table in a `div` with class `vg-scroll-x`, and give the table an inline `minWidth` of 640.
   - Each row gets `tabIndex={0}` and selects its report on Enter or Space, calling `preventDefault` first.
   - The Description cell gets `overflowWrap: "anywhere"`.
   - The status cell renders `Tag` with the tone and label from `reportStatus`.
   - Keep these test IDs: `library-table`.
9. **Values section:** `site design/src/pages/LibraryPage.tsx` lines 164–173 (anchor `<span>Biomarker</span>`).
   - **While values load:** show `PageState` kind loading, title "Reading values", inside a `div` with top padding `var(--space-4)`.
   - **When there are no rows:**
     - If `rowsError` is set: `PageState` kind error, title "Could not read values", the error as detail, and the action "Try again", which increments `tick`.
     - Otherwise: `PageState` kind empty, title "No values were read from this report", detail "Its pages may hold text without test results, or the values could not be read."
   - **When there are rows:**
     - Render the grid header row and all value rows inside a `div` with class `vg-scroll-x`, which holds an inner `div` with `minWidth: 560`.
     - The header row's padding becomes `var(--space-2) var(--space-2)`.
10. **Status tag in each value row:** `site design/src/pages/LibraryPage.tsx` lines 226–233 (anchor `{st.label}`). Render `Tag` with `st.tone` and `st.label`.
11. **Opened passage:** `site design/src/pages/LibraryPage.tsx` lines 243–253 (anchor `Loading the page`). When `pagesFailed` is true, show "The page text could not be loaded." in place of the passage.
12. **Closing tag:** the root `div` closing at `site design/src/pages/LibraryPage.tsx` lines 259–263 (anchor `)}`) becomes `</PageFrame>`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser, both servers running, persona "Empty Test Persona":
   - Open `/library`. The table shows the persona's reports with Indexed tags.
   - Click a row, then a value. The passage opens with the value highlighted.
   - At 360 × 740, the reports table and the values grid scroll sideways inside their own boxes, and `document.documentElement.scrollWidth` equals `window.innerWidth`.
3. Stop the backend and reload `/library`. The page shows the offline persona state ("No persona available") with a "Try again" button.

**Acceptance criteria**
- [ ] `reportStatus` is exported from `lib/reportLabels.ts`, and the Library table uses it.
- [ ] Every loading, empty and error message on the page is a `PageState` (search the file: no `style={note}` remains).
- [ ] A flag such as `ABNORMAL` with no printed range shows "Lab flag abnormal", not "No range".
- [ ] At 360 px there is no page-level horizontal scroll on `/library`.
- [ ] The build exits 0.
