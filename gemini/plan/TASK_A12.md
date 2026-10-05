<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task A12 — Timeline rebuilt to the reference, with real values and the reference's isometric charts

- **Goal:** Replace the old Timeline with the reference layout: a report list on the left and one isometric bar chart per test that appears in at least two dated reports. The layout comes from screenshot `design/reference/screens/04_Timeline.png` and markup `design/reference/app-v3-source.html` lines 640–678.
- **Tier:** Must
- **Size:** L · hard
- **Review:** gate
- **Depends on:** A2, A5
- **Files to read first:**
  - `design/reference/app-v3-source.html` lines 640–678 (anchor `c.iso.floor`) and lines 1086–1114 (anchor `iso(bars, o) {`)
  - `design/reference/screens/04_Timeline.png`
  - `site design/src/pages/TimelinePage.tsx`
  - `site design/src/api/reports.ts` lines 16–31 (anchor `export interface TrendData`) and lines 75–89 (anchor `export interface MeasurementRow`)
  - `vitagraph/backend/app/services/report_service.py` lines 420–480 (anchor `def get_user_trends(user_id: str, test_name: str = "Hemoglobin") -> dict:`)
- **Files to create or modify:**
  - modify `site design/src/pages/TimelinePage.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`
- **Why the charts cannot trust the trends route as it is.** `get_user_trends` (the route `GET /api/reports/{user_id}/trends`) has three weak points, all visible in `vitagraph/backend/app/services/report_service.py` lines 420–480 (anchor `matches.sort(key=lambda m: m["date"])`):
  - It sorts points by the date *text*.
  - It matches tests by substring, so "Glucose" also matches "Fasting Glucose".
  - Its `trend_direction` calls any rise "improving".
- **So this page:**
  1. Places points by the report's parsed printed date (`parseReportDate` from `lib/reportLabels.ts`). Undated values are not placed on a time axis; they are counted in the caption.
  2. Keeps a point only when the same test name and value appear in that report's own measurements (`GET /api/reports/{report_id}/measurements`), with one value per report. Substring mix-ups are therefore dropped.
  3. Never shows `trend_direction`.
  4. Draws the reference band only from the range printed in the latest report.
  5. Colours the latest value red, as the reference does. Red means "latest", never "bad".
- **What leaves this page:**
  - "Delete persona" moved to Settings in task A8. The old flow is at `site design/src/pages/TimelinePage.tsx` lines 287–335 (anchor `const executeDeleteCascade = async () => {`).
  - The developer-only "upload second report" helper is dropped: `site design/src/pages/TimelinePage.tsx` line 385 (anchor `Simulation upload failed`).
  - The old evidence viewer is not used here: `site design/src/pages/TimelinePage.tsx` line 22 (anchor `import { EvidenceSpanViewer }`).
  - The old test IDs of this page are retired, for example `site design/src/pages/TimelinePage.tsx` line 545 (anchor `timeline-spine-container`) and line 1082 (anchor `timeline-delete-confirm-panel`). The motion-era scripts that use them are listed in open issue O-10.

**What to change**
1. **Replace the whole content of `site design/src/pages/TimelinePage.tsx`** (all 1214 lines, from `site design/src/pages/TimelinePage.tsx` line 28, anchor `export const TimelinePage: React.FC = () => {`). The new file still exports a component named `TimelinePage`. It is built from these parts.
   - **Imports:**
     - `reportsApi` and the types `MeasurementRow` and `TrendData` from `../api/reports`;
     - `graphApi` from `../api/graph`;
     - `useActiveUser`;
     - `transitionNavigate`;
     - `parseReportDate`, `reportStatus` and `sortReports` from `../lib/reportLabels`;
     - `PageFrame`, `PageState`, `PersonaState` and `Tag` from `../components/ui`;
     - the type `Report`.
   - **Constants:** `MAX_TESTS` = 6 and `MAX_POINTS` = 5.
   - **Helpers:**
     - a `kicker` text style: 0.6875rem, weight 800, letter-spacing 0.1em, uppercase, `--color-neutral-700`;
     - `shortDate(date)`, giving "Mon YYYY" in UTC;
     - `fmtValue(number)`, with at most two decimals in `en-US`.
   - **`iso(bars, options)`** is a typed TypeScript port of the reference function at `design/reference/app-v3-source.html` lines 1086–1114 (anchor `iso(bars, o) {`).
     - Keep the same constants: c 0.866, LX 260, LY 70, LZ 120, ox 100, oy 135, bar width and depth 34.
     - Keep the same projection and the same polygons: floor, back wall, left wall, band back, band left, seven grid lines, and top, front and right faces per bar.
     - Each label carries its own inline position style instead of a CSS string.
     - The band and its two labels are drawn only when both a low and a high value exist.
     - Bar fills: the latest bar uses `--color-accent-400` (top), `--color-accent` (front) and `--color-accent-700` (right). Other bars use `--color-neutral-400`, `--color-neutral-700` and `--color-neutral-900`.
   - **`datedPoints(trend, reportsById)`:**
     - Keep a trend point only when its `report_id` names a known report with a parsed printed date. Count the undated ones.
     - Sort by date, oldest first, and keep the last `MAX_POINTS`.
   - **`spread(dates)`:** time-proportional positions from 0 to 1, pushed apart so that consecutive bars are at least 0.22 apart, then rescaled to fit within 1.
   - **`niceMax(value)`:** round up to two significant digits, with 1 when the value is 0 or less.
   - **`buildChart(test, unit, points, latestRow, undated)`:**
     - The range comes only from the latest report's row (`range_low`, `range_high`, `reference_range`).
     - The axis maximum is 1.25 × the largest value, raised to 1.1 × the range low when needed, then passed through `niceMax`.
     - The headline is "first → latest".
     - The caption joins these sentences, leaving out the empty ones:
       - "Reference <range>, as printed in the latest report." or "No reference range printed in the latest report.";
       - "<n> reports, <first date> to <last date>.";
       - "Axis cut at <max>." when the range high is above the axis maximum;
       - "<n> undated value(s) not shown."
   - **The component:**
     - **Persona:** read `user`, `loading` and `refreshUsers`.
     - **Reports effect,** on `[userId, tick]`: load `reportsApi.list` and keep it sorted with `sortReports`.
     - **Charts effect,** on `[userId, reports, chartTick]`:
       1. With no reports, there are no charts.
       2. Otherwise load `graphApi.getGraph(userId)`. Take the `test` nodes sorted by betweenness, highest first, keep the unique `test_name` (or the label when it is missing), and cap the list at `MAX_TESTS`.
       3. For each test, load `reportsApi.trends(userId, test)`. Skip it when the call fails or when the returned `test_name` differs from the requested one, ignoring case; that is a substring match.
       4. Keep only the points that the report's own measurements confirm: same test name ignoring case, and same value. Cache one measurements request per report, treating a failed request as no rows.
       5. Skip the test when fewer than two points remain, or when one report gives two values.
       6. Use a `cancelled` flag in the cleanup.
     - **States,** in this order, each in `PageFrame` with label "Timeline":
       - no persona: `PersonaState`;
       - reports loading: `PageState` loading, "Loading reports";
       - reports error: `PageState` error, "Could not load reports", with "Try again" (increments `tick`);
       - no reports: `PageState` empty, "No reports yet", detail "Upload reports to see their values over time.", action "Upload a report" (the existing `transitionNavigate` call to `/upload`, direction back).
     - **Layout,** when reports exist:
       - A root `div` with `data-screen-label="Timeline"` and `data-testid="timeline-page"`, a wrapping flex row, full height.
       - **Left column:** class `vg-pad`, flex `0 1 380px`, min width 0, a 2 px right rule. It holds the kicker "Reports", then one row per report with `data-testid="timeline-report-row"`:
         - the printed date as "Mon YYYY" (or "Undated") at 1.375rem, weight 800;
         - the filename in small `--color-neutral-700`, with long words allowed to break;
         - a `Tag` from `reportStatus`.
       - **Right column:** flex `1 1 560px`, min width 0, a grid of `repeat(auto-fit,minmax(min(300px,100%),1fr))`. It shows one of:
         - **Charts error:** `PageState` error, "Could not read values over time", with "Try again" (increments `chartTick`), in a `vg-pad` box.
         - **Charts loading:** `PageState` loading, "Reading values across your reports".
         - **No chart:** `PageState` empty, "No test appears in two dated reports yet", detail "A chart needs the same test, with a value its report confirms, in at least two reports that print a date."
         - **Otherwise,** one cell per chart with `data-testid="timeline-chart"`, 2 px right and bottom rules, containing:
           - the kicker "<test> · <unit>";
           - the headline at 2rem, weight 800, tabular numbers;
           - the caption;
           - an `svg` with viewBox `0 0 400 320`, `role="img"` and an `aria-label` listing every value with its date, with the labels absolutely positioned over it.
       - Every colour comes from tokens.
2. **Own layout:** `site design/src/components/shell/AppShell.tsx` line 31 (anchor `const OWN_LAYOUT = new Set<string>(`). Add `"/timeline"` to the set, because the page now draws its own two-column layout.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Live, as persona `usr_51f14542d71a`, which holds the two dated synthetic panels:
   - Each report row's date equals the printed `report_date` from `GET /api/reports?user_id=usr_51f14542d71a`, shown as "Mon YYYY", or "Undated" when that field is empty.
   - For each chart, open `GET /api/reports/<report_id>/measurements` for both of its reports and paste the test's values next to the chart's headline numbers.
3. A persona with exactly one report shows "No test appears in two dated reports yet".
4. A persona with no reports shows the empty state with "Upload a report".
5. Stop the backend after the report list has loaded, then reload. The error state shows, and "Try again" works.
6. At 360 px there is no horizontal page scroll, and the charts stack under the report list.
7. Compare with `design/reference/screens/04_Timeline.png` and save `gemini/shots/A12-timeline-1440.png`. The layout matches: a 380 px list with 2 px rules, and charts in a grid with 2 px rules.

**Acceptance criteria**
- [ ] `/timeline` is in `OWN_LAYOUT`, and the page exports `TimelinePage`.
- [ ] Every number on screen is traced to an API response (pasted).
- [ ] The no-reports, one-report, loading and error states were each seen.
- [ ] `Select-String -Path "site design\src\pages\TimelinePage.tsx" -Pattern 'trend_direction|VG-2026|var\(--ink|console\.'` prints nothing.
- [ ] There is no page scroll at 360 px.
- [ ] The build exits 0.


---

## Code skeleton for this task (Appendix A of the plan)

Only signatures and the one tricky part. If the skeleton and the task description disagree, the task description wins; report the difference.

### A.1 Task A12 — Timeline: keep only points the report confirms

```ts
interface IsoBarInput { t: number; v: number; val: string; date: string; hot: boolean }
interface IsoOptions { max: number; lo: number | null; hi: number | null; loText: string; hiText: string }
interface ChartPoint { reportId: string; date: Date; value: number }

function iso(bars: IsoBarInput[], o: IsoOptions): IsoChart;              // port of app-v3-source.html lines 1086-1114
function datedPoints(trend: TrendData, byId: Map<string, Report>): { points: ChartPoint[]; undated: number };
function spread(dates: Date[]): number[];                                 // gap >= 0.22, rescaled to <= 1
function buildChart(test: string, unit: string, points: ChartPoint[], latestRow: MeasurementRow, undated: number): ChartModel;

// The tricky loop, inside the charts effect, per test:
const verified: { point: ChartPoint; row: MeasurementRow }[] = [];
for (const point of draft.points) {
  const rows = await measurementsOf(point.reportId);   // one cached request per report; [] on failure
  const row = rows.find(
    (r) => r.test_name.toLowerCase() === trend.test_name.toLowerCase() && Math.abs(r.value - point.value) < 1e-9
  );
  if (row) verified.push({ point, row });
}
const onePerReport = new Set(verified.map((v) => v.point.reportId)).size === verified.length;
if (verified.length < 2 || !onePerReport) continue;      // never chart a doubtful series
out.push(buildChart(trend.test_name, trend.unit, verified.map((v) => v.point), verified[verified.length - 1].row, draft.undated));
```
