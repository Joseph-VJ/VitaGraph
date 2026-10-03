# TASK 06: Library page, exact to the reference, real data (plus a date bug fix in Compare)

Read `gemini/RULES.md` first (section 0 "the reference wins", 3b branch guard, section 6 cheat-sheet). Obey it.

Task 05 was reviewed and accepted. One bug was found in Compare and is fixed in Part C: report dates such as `20 June 2025` were sorted as text, and a report with no date was labelled with its upload month ("Oct 2026"), which looks like a real report date. Undated reports must say **Undated** and sort last.

**Reference for Library:** `design/reference/app-v3-source.html` lines 458-497 (markup), plus the range-bar math below, and the screenshot `design/reference/screens/01_Library.png`. Open the screenshot now.

The backend now has a new read-only endpoint (already built and tested by the reviewer, do not touch the backend):
`GET /api/reports/{report_id}/measurements` returns a list like
`{"test_name":"Hemoglobin","category":"Complete Blood Count","value":13.8,"unit":"g/dL","reference_range":"13.0 - 17.0","range_low":13.0,"range_high":17.0,"flag":"NORMAL","page_number":1,"chunk_id":"chk_...","char_start":412,"char_end":416,"span_exact":true}`.
`char_start`/`char_end` are offsets into that page's `extracted_text` (from `GET /api/reports/{id}/pages`). The reference range is the text printed in the report itself.

## FILES THIS TASK MAY CHANGE (and nothing else)
1. `site design/src/lib/reportLabels.ts` (NEW; create the folder `src/lib` if missing)
2. `site design/src/api/reports.ts` (add one type and one method, Part B)
3. `site design/src/pages/ComparePage.tsx` (Part C only)
4. `site design/src/pages/LibraryPage.tsx` (rewritten, Part D)
5. `site design/src/components/shell/AppShell.tsx` (one line, Part E)

---

## STEP 0: branch guard, green start
```
git branch --show-current          # redesign/modernist-app
git log --oneline -3
cd "F:\kiruthika\kiruthika final project\site design"
npm run build                      # exit 0 before you start
```

## PART A: new file `site design/src/lib/reportLabels.ts`
Create it with exactly this code:
```ts
import type { Report } from "../types";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** The date printed in the report itself. Never falls back to the upload time. */
export function parseReportDate(r: Pick<Report, "report_date">): Date | null {
  const raw = r.report_date?.trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const dmy = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(raw);
  if (dmy) {
    const m = MONTHS.indexOf(dmy[2].toLowerCase());
    if (m >= 0) return new Date(Date.UTC(Number(dmy[3]), m, Number(dmy[1])));
  }
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t);
}

/** Oldest dated report first; reports without a date go last, in upload order. */
export function sortReports(list: Report[]): Report[] {
  return [...list].sort((a, b) => {
    const da = parseReportDate(a);
    const db = parseReportDate(b);
    if (da && db) return da.getTime() - db.getTime() || a.upload_time.localeCompare(b.upload_time);
    if (da) return -1;
    if (db) return 1;
    return a.upload_time.localeCompare(b.upload_time);
  });
}

const monthYear = (d: Date) => d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** "Jan 2025", or "Undated". If two reports would get the same label, the filename is appended. */
export function makeLabeler(reports: Report[]): (r: Report) => string {
  const base = (r: Report) => {
    const d = parseReportDate(r);
    return d ? monthYear(d) : "Undated";
  };
  const counts: Record<string, number> = {};
  reports.forEach((r) => {
    counts[base(r)] = (counts[base(r)] ?? 0) + 1;
  });
  return (r: Report) => (counts[base(r)] > 1 ? `${base(r)} · ${r.original_filename}` : base(r));
}
```

## PART B: `site design/src/api/reports.ts`
Add this exported interface above `export const reportsApi` (next to the other interfaces):
```ts
export interface MeasurementRow {
  test_name: string;
  category: string;
  value: number;
  unit: string;
  reference_range: string | null;
  range_low: number | null;
  range_high: number | null;
  flag: string;
  page_number: number;
  chunk_id: string;
  char_start: number;
  char_end: number;
  span_exact: boolean;
}
```
and add this method inside the `reportsApi` object (after `pages`):
```ts
  measurements: (reportId: string) => api.get<MeasurementRow[]>(`/api/reports/${reportId}/measurements`),
```
Change nothing else in that file.

## PART C: Compare date fix (`ComparePage.tsx`)
1. Add the import `import { makeLabeler, sortReports } from "../lib/reportLabels";`.
2. Delete the local helpers `reportDate` and `monthLabel` at the top of the file.
3. In the effect that loads reports, replace the line `const sorted = [...list].sort((a, b) => reportDate(a).localeCompare(reportDate(b)));` with `const sorted = sortReports(list);`.
4. Replace the whole `const labelOf = useMemo(...)` block with `const labelOf = useMemo(() => makeLabeler(reports ?? []), [reports]);`.
Change nothing else. After this, a persona whose third report has no date shows `Undated` and the pair buttons read like `Jan 2025 → Jun 2025`, `Jun 2025 → Undated`, `Jan 2025 → Undated`.

## PART D: rewrite `site design/src/pages/LibraryPage.tsx`
Behaviour (all from the API, nothing typed in):
- Top: a table (`className="table"`) of the persona's reports, oldest first, columns **Report, Description, Pages, Chunks, SHA-256, Status**. Report = the label from `makeLabeler` (bold). Description = `original_filename`. Pages = `page_count`. Chunks = `chunk_count`. SHA-256 = first 4 and last 4 characters of `file_hash` joined with `…`, muted. Status tag: `ready` shows `Indexed` (ink tag), `failed` shows `Failed` (accent-100 tag), anything else shows the status word capitalised (neutral tag).
- Clicking a row selects it (selected row background `var(--color-accent-100)`, pointer cursor). The newest report is selected on load.
- Below: a section with `h3`-style title `<label> · values` and, on the right, the muted text `Select a row to see the passage a value came from`. Then a column header and one button-row per value from `GET /api/reports/{id}/measurements`.
- Each value row: biomarker name (bold) with `Page N` under it; the value large with its unit small; if the previous report (the one before the selected one in the sorted list) has the same test with a different value, show `<value> in <previous label>` under the unit; a range bar; a status tag.
- Range bar: only when both `range_low` and `range_high` exist. `span = hi - lo`, `mn = lo - span*0.35`, `mx = hi + span*0.35`, `pc(v) = clamp(((v - mn) / (mx - mn)) * 100, 0, 100)`. Grey band from `pc(lo)` to `pc(hi)`, red marker at `pc(value)`. Below the bar show `lo` on the left and `hi` on the right. If a range is not printed, show the printed `reference_range` text if there is one, else `No range printed`.
- Status: with both bounds, `value < lo` = `Below range`, `value > hi` = `Above range`, else `In range`. Without both bounds use the flag: `LOW` = `Below range`, `HIGH` = `Above range`, otherwise `No range`. `In range` and `No range` use the neutral tag; the others use the red filled tag.
- Clicking a value row opens its source passage under it (click again to close; only one open at a time). The passage uses the page text from `GET /api/reports/{id}/pages`: header line `<label>`, `Page N`, `Characters start–end`; body = up to 80 characters before, the value characters `page.extracted_text.slice(char_start, char_end)` highlighted with a `<mark>`, up to 80 characters after (exactly as the reference). If `span_exact` is false, the header says `Chunk` instead of `Characters`.
- States: loading text, error text with a "Try again" button, empty message (`No reports yet. Upload one to see its values.` with an "Upload a report" button), and for a report with no readable values: `No values were read from this report.`

Copy this code:
```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { reportsApi, type MeasurementRow } from "../api/reports";
import { useActiveUser } from "../context/UserContext";
import { transitionNavigate } from "../motion/navigation";
import { makeLabeler, sortReports } from "../lib/reportLabels";
import type { Report, ReportPage } from "../types";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const num = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 3 });
const headStyle: React.CSSProperties = {
  fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-700)",
};
const GRID = "minmax(120px,1.2fr) minmax(90px,0.8fr) minmax(150px,1.6fr) 5.5rem";

function statusOf(r: MeasurementRow): { label: string; hot: boolean } {
  if (r.range_low !== null && r.range_high !== null) {
    if (r.value < r.range_low) return { label: "Below range", hot: true };
    if (r.value > r.range_high) return { label: "Above range", hot: true };
    return { label: "In range", hot: false };
  }
  const f = r.flag.toUpperCase();
  if (f === "LOW") return { label: "Below range", hot: true };
  if (f === "HIGH") return { label: "Above range", hot: true };
  return { label: "No range", hot: false };
}

export const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useActiveUser();
  const userId = user?.id ?? null;

  const [reports, setReports] = useState<Report[] | null>(null);
  const [selId, setSelId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<MeasurementRow[] | null>(null);
  const [prevRows, setPrevRows] = useState<MeasurementRow[]>([]);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [pages, setPages] = useState<ReportPage[] | null>(null);
  const [openTest, setOpenTest] = useState<string | null>(null);
  const cache = useRef<Map<string, MeasurementRow[]>>(new Map());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setReports(null);
    setError(null);
    cache.current = new Map();
    reportsApi
      .list(userId)
      .then((list) => {
        if (cancelled) return;
        const sorted = sortReports(list);
        setReports(sorted);
        setSelId(sorted.length > 0 ? sorted[sorted.length - 1].id : "");
      })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [userId, tick]);

  const labelOf = useMemo(() => makeLabeler(reports ?? []), [reports]);
  const selIndex = (reports ?? []).findIndex((r) => r.id === selId);
  const selected = selIndex >= 0 ? (reports ?? [])[selIndex] : null;
  const previous = selIndex > 0 ? (reports ?? [])[selIndex - 1] : null;

  const loadMeasurements = useCallback(async (reportId: string): Promise<MeasurementRow[]> => {
    const hit = cache.current.get(reportId);
    if (hit) return hit;
    const data = await reportsApi.measurements(reportId);
    cache.current.set(reportId, data);
    return data;
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setRows(null);
    setRowsError(null);
    setPages(null);
    setOpenTest(null);
    setPrevRows([]);
    loadMeasurements(selected.id)
      .then((d) => { if (!cancelled) setRows(d); })
      .catch((err: unknown) => { if (!cancelled) { setRows([]); setRowsError(err instanceof Error ? err.message : String(err)); } });
    if (previous) {
      loadMeasurements(previous.id).then((d) => { if (!cancelled) setPrevRows(d); }).catch(() => undefined);
    }
    return () => { cancelled = true; };
  }, [selected?.id, previous?.id, loadMeasurements]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (testName: string) => {
    const next = openTest === testName ? null : testName;
    setOpenTest(next);
    if (next && selected && pages === null) {
      reportsApi.pages(selected.id).then(setPages).catch(() => setPages([]));
    }
  };

  const pageStyle: React.CSSProperties = {
    maxWidth: 1280, margin: "0 auto", padding: "var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-8)",
  };
  const note: React.CSSProperties = { fontSize: "0.9375rem", fontWeight: 600 };

  if (!userId || (reports === null && !error)) {
    return <div data-screen-label="Library" style={pageStyle}><div style={note}>Loading reports</div></div>;
  }
  if (error) {
    return (
      <div data-screen-label="Library" style={pageStyle}>
        <div style={note}>Could not load reports. {error}</div>
        <div><button className="btn btn-secondary" onClick={() => setTick((t) => t + 1)}>Try again</button></div>
      </div>
    );
  }
  if ((reports ?? []).length === 0) {
    return (
      <div data-screen-label="Library" style={pageStyle}>
        <div style={note}>No reports yet. Upload one to see its values.</div>
        <div><button className="btn btn-primary" onClick={() => transitionNavigate(navigate, "/upload", { direction: "back" })}>Upload a report</button></div>
      </div>
    );
  }

  return (
    <div data-screen-label="Library" style={pageStyle}>
      <table className="table" data-testid="library-table">
        <thead>
          <tr><th>Report</th><th>Description</th><th>Pages</th><th>Chunks</th><th>SHA-256</th><th>Status</th></tr>
        </thead>
        <tbody>
          {(reports ?? []).map((r) => {
            const tag =
              r.status === "ready" ? { text: "Indexed", css: { background: "var(--color-text)", color: "var(--color-bg)", fontWeight: 800 } }
              : r.status === "failed" ? { text: "Failed", css: { background: "var(--color-accent-100)", color: "var(--color-accent-800)", fontWeight: 800 } }
              : { text: r.status.charAt(0).toUpperCase() + r.status.slice(1), css: { background: "var(--color-neutral-200)", color: "var(--color-neutral-800)" } };
            return (
              <tr
                key={r.id}
                onClick={() => setSelId(r.id)}
                style={{ cursor: "pointer", background: r.id === selId ? "var(--color-accent-100)" : undefined }}
                aria-selected={r.id === selId}
              >
                <td style={{ fontWeight: 800 }}>{labelOf(r)}</td>
                <td>{r.original_filename}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.page_count ?? "—"}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.chunk_count ?? "—"}</td>
                <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-neutral-700)" }}>
                  {r.file_hash.length > 8 ? `${r.file_hash.slice(0, 4)}…${r.file_hash.slice(-4)}` : r.file_hash}
                </td>
                <td><span className="tag" style={tag.css}>{tag.text}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selected && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-4)", flexWrap: "wrap", paddingBottom: "var(--space-2)", borderBottom: "2px solid var(--color-divider)" }}>
            <h3 style={{ margin: 0, fontSize: "1.5625rem", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.015em" }}>{labelOf(selected)} · values</h3>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-neutral-700)" }}>Select a row to see the passage a value came from</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: GRID, gap: "var(--space-4)", padding: "0 var(--space-2) var(--space-2)", borderBottom: "2px solid var(--color-divider)", ...headStyle }}>
            <span>Biomarker</span><span>Value</span><span>Reference range</span><span>Status</span>
          </div>

          {rows === null && <div style={{ ...note, padding: "var(--space-4) var(--space-2)" }}>Reading values</div>}
          {rows !== null && rows.length === 0 && (
            <div style={{ ...note, padding: "var(--space-4) var(--space-2)" }}>
              {rowsError ? `Could not read values. ${rowsError}` : "No values were read from this report."}
            </div>
          )}

          {(rows ?? []).map((b) => {
            const st = statusOf(b);
            const hasBar = b.range_low !== null && b.range_high !== null;
            const lo = b.range_low ?? 0;
            const hi = b.range_high ?? 0;
            const span = hi - lo || 1;
            const mn = lo - span * 0.35;
            const mx = hi + span * 0.35;
            const pc = (v: number) => clamp(((v - mn) / (mx - mn)) * 100, 0, 100);
            const before = prevRows.find((p) => p.test_name === b.test_name && p.value !== b.value);
            const open = openTest === b.test_name;
            const page = pages?.find((p) => p.page_number === b.page_number);
            const text = page?.extracted_text ?? "";
            return (
              <div key={b.test_name} style={{ borderBottom: "1px solid var(--color-divider)" }}>
                <button
                  onClick={() => toggle(b.test_name)}
                  aria-expanded={open}
                  className="hover:bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)]"
                  style={{
                    appearance: "none", width: "100%", textAlign: "left", cursor: "pointer", display: "grid", gridTemplateColumns: GRID,
                    gap: "var(--space-4)", alignItems: "center", padding: "var(--space-4) var(--space-2)", border: 0, background: "transparent", color: "var(--color-text)",
                  }}
                >
                  <span>
                    <span style={{ display: "block", fontWeight: 800 }}>{b.test_name}</span>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>Page {b.page_number}</span>
                  </span>
                  <span>
                    <span style={{ fontSize: "1.375rem", fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{num(b.value)}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--color-neutral-700)", marginLeft: 4 }}>{b.unit}</span>
                    {before && previous && (
                      <span style={{ display: "block", fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>{num(before.value)} in {labelOf(previous)}</span>
                    )}
                  </span>
                  <span>
                    {hasBar ? (
                      <>
                        <span style={{ display: "block", position: "relative", height: 8, background: "var(--color-neutral-200)" }}>
                          <span style={{ position: "absolute", top: 0, bottom: 0, left: `${pc(lo)}%`, width: `${pc(hi) - pc(lo)}%`, background: "var(--color-neutral-500)" }} />
                          <span style={{ position: "absolute", top: -6, width: 4, height: 20, marginLeft: -2, background: "var(--color-accent)", left: `${pc(b.value)}%` }} />
                        </span>
                        <span style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-2)", fontSize: "0.6875rem", color: "var(--color-neutral-700)", fontVariantNumeric: "tabular-nums" }}>
                          <span>{num(lo)}</span><span>{num(hi)}</span>
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>{b.reference_range ?? "No range printed"}</span>
                    )}
                  </span>
                  <span>
                    <span
                      className="tag"
                      style={st.hot
                        ? { background: "var(--color-accent)", color: "var(--color-bg)", fontWeight: 800 }
                        : { background: "var(--color-neutral-200)", color: "var(--color-neutral-800)" }}
                    >
                      {st.label}
                    </span>
                  </span>
                </button>
                {open && (
                  <div style={{ margin: "0 var(--space-2) var(--space-4)", background: "var(--color-surface)", borderTop: "2px solid var(--color-text)", padding: "var(--space-4)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", ...headStyle }}>
                      <span>{labelOf(selected)}</span>
                      <span>Page {b.page_number}</span>
                      <span>{b.span_exact ? "Characters" : "Chunk"} {b.char_start}–{b.char_end}</span>
                    </div>
                    {pages === null ? (
                      <div style={{ marginTop: "var(--space-3)", fontSize: "0.9375rem" }}>Loading the page</div>
                    ) : (
                      <div style={{ marginTop: "var(--space-3)", whiteSpace: "pre-wrap", fontSize: "0.9375rem", lineHeight: 1.75, fontVariantNumeric: "tabular-nums" }}>
                        <span>{text.slice(Math.max(0, b.char_start - 80), b.char_start)}</span>
                        <mark style={{ background: "var(--color-accent-200)", color: "var(--color-text)", boxShadow: "inset 0 -2px 0 var(--color-accent)", padding: "0 2px" }}>
                          {text.slice(b.char_start, b.char_end)}
                        </mark>
                        <span>{text.slice(b.char_end, b.char_end + 80)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
```
Keep the exported name `LibraryPage` (`App.tsx` imports it). The `// eslint-disable-line` comment is allowed here because the project has no eslint step; if the build complains about it, remove only the comment.

## PART E: AppShell
Change `new Set<string>(["/upload", "/compare", "/insights"])` to `new Set<string>(["/upload", "/compare", "/insights", "/library"])`. Nothing else.

---

## VERIFY
1. `cd "F:\kiruthika\kiruthika final project\site design"` then `npm run build`: exit 0.
2. Greps from the project root (paste outputs; all empty): `grep -n "rounded\|Spectral\|var(--ink-" "site design/src/pages/LibraryPage.tsx" "site design/src/lib/reportLabels.ts"` and `grep -n "monthLabel\|reportDate(" "site design/src/pages/ComparePage.tsx"`.
3. Start backend and frontend as in Task 04. Browser at 1440x900:
   a. `/library` for the persona "3 Reports Persona" (`usr_d1d7f9b2a4b1`; set `localStorage.vitagraph_user_id` or pick it from the persona menu). Screenshot `gemini/shots/task06-library.png`. Open a value row; screenshot `gemini/shots/task06-library-open.png`.
   b. Paste `GET /api/reports/<selected report id>/measurements` (first 3 rows) and show the page shows the same value, unit, range, page; and that the highlighted text in the opened passage equals the value.
   c. Confirm the range-bar marker sits inside the grey band for an in-range value and outside it for an out-of-range value (name the test you checked).
   d. `/compare` for the same persona: the pair buttons read `Jan 2025 → Jun 2025`, `Jun 2025 → Undated`, `Jan 2025 → Undated` (paste `innerText` of the buttons). Screenshot `gemini/shots/task06-compare-undated.png`.
   e. A persona with no reports shows the empty message and an Upload button.
   f. Compare `/library` with `design/reference/screens/01_Library.png` and list the visible layout differences.
4. Measure on `/library` at 1440x900 and paste: `getComputedStyle(document.querySelector('[data-screen-label="Library"]')).padding`, the header cell text `document.querySelector('[data-testid="library-table"] th').innerText`, and the number of `tr` in the table body.

## COMMIT
Stage ONLY the 5 files listed at the top and `gemini/shots/task06-*.png`. Message: `feat(redesign): T06 Library exact to reference with real measurements; undated-report fix in Compare`. Then `git show --stat HEAD`, `git branch --show-current`, `git log --oneline -3`.

## ACCEPTANCE (PASS/FAIL each with evidence)
- Library matches the reference layout (report table, values section, grid columns, range bar, tags, passage slip).
- Every number equals the API (values, ranges, pages, chunks, passage text).
- Compare shows `Undated` last and never shows an upload month as a report date.
- No demo data, no animation helpers, no rounded corners.
- Build exit 0; branch correct; only the listed files in the commit.
