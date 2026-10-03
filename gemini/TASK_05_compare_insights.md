# TASK 05: Compare and Insights pages, exact to the reference, real data

Read `gemini/RULES.md` first (section 0 "the reference wins", 3b branch guard, section 6 cheat-sheet). Obey it.

Task 04 (Upload) was reviewed and accepted. This task rebuilds two pages. Both already have real endpoints, so nothing is invented.

**Reference:** `design/reference/app-v3-source.html` lines 680-693 (Compare) and 695-711 (Insights); screenshots `design/reference/screens/05_Compare.png` and `06_Insights.png`. Open both screenshots now and look at them.

## FILES THIS TASK MAY CHANGE (and nothing else)
1. `site design/src/components/shell/AppShell.tsx` (one line, Part A)
2. `site design/src/pages/ComparePage.tsx` (rewritten)
3. `site design/src/pages/InsightsPage.tsx` (rewritten)
Do not touch `api/*`, `types.ts`, `motion/*`, `modernist.css`, or any backend file. The old versions of these two pages use many motion helpers (Odometer, flip, DrawPath, DetentPress...). The new versions use none of them. Do not delete those helper files.

---

## STEP 0: branch guard, green start
```
git branch --show-current          # redesign/modernist-app
git log --oneline -3
cd "F:\kiruthika\kiruthika final project\site design"
npm run build                      # exit 0 before you start
```

## PART A: AppShell
In `AppShell.tsx` change `const OWN_LAYOUT = new Set<string>(["/upload"]);` to `new Set<string>(["/upload", "/compare", "/insights"]);`. Nothing else.

---

## PART B: `ComparePage.tsx`
Replace the whole file with the code below. Data sources are unchanged: `reportsApi.list(userId)` and `reportsApi.compare(userId, baselineId, followupId)`.

Rules the code implements (read them, then paste the code):
- Reports are sorted by date ascending (`report_date`, falling back to `upload_time`). A report's label is its month and year, for example `Jan 2024`. If two reports have the same label, the filename is appended: `Jan 2024 · name.pdf`.
- With 2 to 4 reports the page shows the reference's pair buttons: every consecutive pair, plus first to last when there are more than two reports. With 5 or more reports (the demo persona has 50) it shows two selects (Baseline, Follow-up) instead, because 50 buttons would be unusable. With fewer than 2 reports it shows an empty state.
- The default selection is first to last.
- Change is `follow-up minus baseline` when both values are numbers. Status: no number on one side = `One report`; difference 0 = `Unchanged`; positive = `Higher`; negative = `Lower`. Numbers come from the backend response; the page invents nothing.

```tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { reportsApi, type ComparisonData } from "../api/reports";
import { useActiveUser } from "../context/UserContext";
import { transitionNavigate } from "../motion/navigation";
import type { Report } from "../types";

type Cell = string | number | null | undefined;

const num = (v: Cell): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const fmt = (v: Cell): string => {
  if (v === null || v === undefined || v === "") return "—";
  return typeof v === "number" ? v.toLocaleString("en-US") : String(v);
};
const fmtDelta = (d: number): string =>
  `${d > 0 ? "+" : ""}${Math.abs(d) < 10 ? d.toFixed(1) : Math.round(d).toLocaleString("en-US")}`;

const reportDate = (r: Report): string => r.report_date ?? r.upload_time;
const monthLabel = (r: Report): string => {
  const d = new Date(reportDate(r));
  return Number.isNaN(d.getTime()) ? reportDate(r) : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

const arrow = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"
    style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", verticalAlign: "-2px" }}>
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
);

export const ComparePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useActiveUser();
  const userId = user?.id ?? null;

  const [reports, setReports] = useState<Report[] | null>(null);
  const [baselineId, setBaselineId] = useState("");
  const [followupId, setFollowupId] = useState("");
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Load the persona's reports
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setReports(null);
    setData(null);
    setError(null);
    reportsApi
      .list(userId)
      .then((list) => {
        if (cancelled) return;
        const sorted = [...list].sort((a, b) => reportDate(a).localeCompare(reportDate(b)));
        setReports(sorted);
        if (sorted.length >= 2) {
          setBaselineId(sorted[0].id);
          setFollowupId(sorted[sorted.length - 1].id);
        } else {
          setBaselineId("");
          setFollowupId("");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [userId, reloadTick]);

  // Load the comparison for the chosen pair
  useEffect(() => {
    if (!userId || !baselineId || !followupId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    reportsApi
      .compare(userId, baselineId, followupId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, baselineId, followupId]);

  const labelOf = useMemo(() => {
    const counts: Record<string, number> = {};
    (reports ?? []).forEach((r) => { counts[monthLabel(r)] = (counts[monthLabel(r)] ?? 0) + 1; });
    return (r: Report) => (counts[monthLabel(r)] > 1 ? `${monthLabel(r)} · ${r.original_filename}` : monthLabel(r));
  }, [reports]);

  const pairs: [Report, Report][] = useMemo(() => {
    const list = reports ?? [];
    const out: [Report, Report][] = [];
    for (let i = 0; i < list.length - 1; i += 1) out.push([list[i], list[i + 1]]);
    if (list.length > 2) out.push([list[0], list[list.length - 1]]);
    return out;
  }, [reports]);

  const base = reports?.find((r) => r.id === baselineId);
  const follow = reports?.find((r) => r.id === followupId);
  const pageStyle: React.CSSProperties = {
    maxWidth: 1280, margin: "0 auto", padding: "var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-6)",
  };
  const noteStyle: React.CSSProperties = { fontSize: "0.9375rem", fontWeight: 600 };

  if (!userId || (reports === null && !error)) {
    return <div data-screen-label="Compare" style={pageStyle}><div style={noteStyle}>Loading reports</div></div>;
  }
  if (error && reports === null) {
    return (
      <div data-screen-label="Compare" style={pageStyle}>
        <div style={noteStyle}>Could not load reports. {error}</div>
        <div><button className="btn btn-secondary" onClick={() => setReloadTick((t) => t + 1)}>Try again</button></div>
      </div>
    );
  }
  if ((reports ?? []).length < 2) {
    return (
      <div data-screen-label="Compare" style={pageStyle}>
        <div style={noteStyle}>Comparing needs at least two reports. This persona has {(reports ?? []).length}.</div>
        <div>
          <button className="btn btn-primary" onClick={() => transitionNavigate(navigate, "/upload", { direction: "back" })}>
            Upload a report
          </button>
        </div>
      </div>
    );
  }

  const usePairButtons = (reports ?? []).length <= 4;
  const rows = data?.rows ?? [];

  return (
    <div data-screen-label="Compare" style={pageStyle}>
      {usePairButtons ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {pairs.map(([a, b]) => {
            const on = a.id === baselineId && b.id === followupId;
            return (
              <button
                key={`${a.id}-${b.id}`}
                className={`btn ${on ? "btn-primary" : "btn-secondary"}`}
                aria-pressed={on}
                onClick={() => { setBaselineId(a.id); setFollowupId(b.id); }}
              >
                {labelOf(a)} → {labelOf(b)}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", alignItems: "flex-end" }}>
          <div className="field" style={{ minWidth: 260 }}>
            <label htmlFor="cmp-base">Baseline</label>
            <select id="cmp-base" className="input" value={baselineId} onChange={(e) => setBaselineId(e.target.value)}>
              {(reports ?? []).map((r) => <option key={r.id} value={r.id}>{labelOf(r)}</option>)}
            </select>
          </div>
          <span aria-hidden="true" style={{ paddingBottom: 8 }}>{arrow}</span>
          <div className="field" style={{ minWidth: 260 }}>
            <label htmlFor="cmp-follow">Follow-up</label>
            <select id="cmp-follow" className="input" value={followupId} onChange={(e) => setFollowupId(e.target.value)}>
              {(reports ?? []).map((r) => <option key={r.id} value={r.id}>{labelOf(r)}</option>)}
            </select>
          </div>
        </div>
      )}

      {error && <div style={noteStyle}>Could not load the comparison. {error}</div>}
      {loading && !data && <div style={noteStyle}>Comparing</div>}

      {data && (
        <table className="table" data-testid="compare-table">
          <thead>
            <tr>
              <th>Biomarker</th>
              <th>{base ? labelOf(base) : "Baseline"}</th>
              <th>{follow ? labelOf(follow) : "Follow-up"}</th>
              <th>Change</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ color: "var(--color-neutral-700)" }}>These two reports share no extracted values.</td></tr>
            )}
            {rows.map((r) => {
              const a = num(r.baseline);
              const b = num(r.followup);
              const d = a !== null && b !== null ? b - a : null;
              const status = d === null ? "One report" : d === 0 ? "Unchanged" : d > 0 ? "Higher" : "Lower";
              return (
                <tr key={`${r.test}-${r.unit}`}>
                  <td style={{ fontWeight: 800 }}>
                    {r.test} <span style={{ fontWeight: 400, color: "var(--color-neutral-700)" }}>{r.unit}</span>
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(r.baseline)}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(r.followup)}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800 }}>{d === null ? "—" : fmtDelta(d)}</td>
                  <td>
                    <span
                      className="tag"
                      style={d === null
                        ? { background: "var(--color-neutral-200)", color: "var(--color-neutral-800)" }
                        : { background: "var(--color-accent-100)", color: "var(--color-accent-800)", fontWeight: 800 }}
                    >
                      {status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};
```
(`transitionNavigate`'s direction values are `"forward"` or `"back"`; check `site design/src/motion/navigation.ts` for the exact accepted strings and use a valid one. If `"back"` is not valid, use `"forward"`.)

---

## PART C: `InsightsPage.tsx`
Replace the whole file. Data source unchanged: `graphApi.getGraph(userId)`. The numbers are the backend's NetworkX values: `metrics`, each node's `betweenness`, and counts computed from the real nodes and edges. Nothing is recomputed with a different algorithm.

Rules the code implements:
- **Graph size:** Nodes (total), Edges (total), then one row per node type, largest first.
- **Betweenness centrality:** top 8 nodes by the backend's `betweenness`. The bar width is relative to the top node (the top node's bar is brand red, the others ink), value printed with 2 decimals, exactly as the reference.
- **Edge types:** for every edge, the pair of node-kind names sorted alphabetically and joined with ` – `, counted, largest first, top 10.
- Node type names shown to people: person = Subject, report = Report, category = Panel, section = Document section, test = Biomarker, measurement = Measurement, uncertainty = Uncertainty, chunk = Text fragment, date = Date. Any other type: its name with the first letter capitalised.

```tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { graphApi, type GraphResponse } from "../api/graph";
import { useActiveUser } from "../context/UserContext";
import { transitionNavigate } from "../motion/navigation";

const KIND: Record<string, string> = {
  person: "Subject", report: "Report", category: "Panel", section: "Document section", test: "Biomarker",
  measurement: "Measurement", uncertainty: "Uncertainty", chunk: "Text fragment", date: "Date",
};
const kindName = (t: string): string => KIND[t] ?? t.charAt(0).toUpperCase() + t.slice(1);

const headStyle: React.CSSProperties = {
  fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-700)",
};

export const InsightsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useActiveUser();
  const userId = user?.id ?? null;
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setGraph(null);
    setError(null);
    graphApi
      .getGraph(userId)
      .then((g) => { if (!cancelled) setGraph(g); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [userId, tick]);

  const stats = useMemo(() => {
    if (!graph) return null;
    const typeById = new Map<string, string>();
    const byType: Record<string, number> = {};
    graph.nodes.forEach((n) => {
      typeById.set(n.id, n.type);
      byType[n.type] = (byType[n.type] ?? 0) + 1;
    });
    const sizeRows = [
      { k: "Nodes", v: graph.nodes.length },
      { k: "Edges", v: graph.edges.length },
      ...Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, c]) => ({ k: kindName(t), v: c })),
    ];
    const top = [...graph.nodes].sort((a, b) => (b.betweenness ?? 0) - (a.betweenness ?? 0)).slice(0, 8);
    const topMax = top.length > 0 ? (top[0].betweenness ?? 0) : 0;
    const pairCounts: Record<string, number> = {};
    graph.edges.forEach((e) => {
      const a = typeById.get(e.source);
      const b = typeById.get(e.target);
      if (!a || !b) return;
      const key = [kindName(a), kindName(b)].sort().join(" – ");
      pairCounts[key] = (pairCounts[key] ?? 0) + 1;
    });
    const edgeRows = Object.entries(pairCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ k, v }));
    return { sizeRows, top, topMax, edgeRows };
  }, [graph]);

  const pageStyle: React.CSSProperties = { maxWidth: 1280, margin: "0 auto", padding: "var(--space-8)" };
  const noteStyle: React.CSSProperties = { fontSize: "0.9375rem", fontWeight: 600 };

  if (!userId || (!graph && !error)) {
    return <div data-screen-label="Insights" style={pageStyle}><div style={noteStyle}>Loading the graph</div></div>;
  }
  if (error) {
    return (
      <div data-screen-label="Insights" style={{ ...pageStyle, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={noteStyle}>Could not load the graph. {error}</div>
        <div><button className="btn btn-secondary" onClick={() => setTick((t) => t + 1)}>Try again</button></div>
      </div>
    );
  }
  if (!graph || !stats || graph.nodes.length === 0) {
    return (
      <div data-screen-label="Insights" style={{ ...pageStyle, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={noteStyle}>There is no graph yet. Upload a report and one is built for this persona.</div>
        <div><button className="btn btn-primary" onClick={() => transitionNavigate(navigate, "/upload", { direction: "back" })}>Upload a report</button></div>
      </div>
    );
  }

  return (
    <div
      data-screen-label="Insights"
      style={{ ...pageStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: "var(--space-8)", alignItems: "start" }}
    >
      <div>
        <div style={{ paddingBottom: "var(--space-2)", borderBottom: "2px solid var(--color-divider)" }}><div style={headStyle}>Graph size</div></div>
        {stats.sizeRows.map((r) => (
          <div key={r.k} style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-divider)" }}>
            <span>{r.k}</span>
            <span style={{ fontSize: "1.25rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{r.v.toLocaleString("en-US")}</span>
          </div>
        ))}
      </div>

      <div>
        <div style={{ paddingBottom: "var(--space-2)", borderBottom: "2px solid var(--color-divider)" }}><div style={headStyle}>Betweenness centrality</div></div>
        {stats.top.map((n, i) => {
          const v = n.betweenness ?? 0;
          const pct = stats.topMax > 0 ? Math.round((v / stats.topMax) * 100) : 0;
          return (
            <div key={n.id} style={{ padding: "var(--space-2) 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", fontWeight: 800 }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={n.label}>{n.label}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{v.toFixed(2)}</span>
              </div>
              <div style={{ height: 8, background: "var(--color-neutral-200)", marginTop: 2 }}>
                <div style={{ height: 8, width: `${pct}%`, background: i === 0 ? "var(--color-accent)" : "var(--color-text)" }} />
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div style={{ paddingBottom: "var(--space-2)", borderBottom: "2px solid var(--color-divider)" }}><div style={headStyle}>Edge types</div></div>
        {stats.edgeRows.map((r) => (
          <div key={r.k} style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-divider)" }}>
            <span>{r.k}</span>
            <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{r.v.toLocaleString("en-US")}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```
Keep the existing `export` names `ComparePage` and `InsightsPage` (`App.tsx` imports them). `GraphResponse` is exported from `api/graph.ts` and `GraphNode.betweenness` is optional there.

---

## VERIFY
1. `cd "F:\kiruthika\kiruthika final project\site design"` then `npm run build`: exit 0 (no unused imports, no `any`).
2. Greps from the project root (paste outputs; all empty):
```
grep -n "any\b\|rounded\|Spectral\|var(--ink-\|Odometer\|DetentPress" "site design/src/pages/ComparePage.tsx" "site design/src/pages/InsightsPage.tsx"
```
3. Start backend and frontend as in Task 04. In the browser at 1440x900:
   a. `/compare` with the persona that has MANY reports (the "Demo Cohort (demo data)" persona, 50 reports): you should see the two selects, a table, and the status tags. Screenshot `gemini/shots/task05-compare-many.png`.
   b. Switch to a persona with 3 reports if one exists (otherwise upload `site design/public/synthetic_panel_2025-01-15.pdf` and `synthetic_panel_2025-06-20.pdf` into a freshly created persona via the Upload page's file input, or the demo cohort button). You should see the pair buttons exactly like `design/reference/screens/05_Compare.png`. Screenshot `gemini/shots/task05-compare-pairs.png`.
   c. For one pair, paste `GET http://127.0.0.1:8000/api/reports/compare?user_id=<id>&baseline_id=<a>&followup_id=<b>` (first 3 rows) and show that the table shows the same values and that Change = follow-up minus baseline.
   d. A persona with fewer than two reports shows the empty message and an "Upload a report" button.
   e. `/insights`: screenshot `gemini/shots/task05-insights.png`. Paste `GET /api/graph/<id>` summary computed with this command (replace the id):
      `curl -s http://127.0.0.1:8000/api/graph/<id> | python -c "import sys,json,collections;g=json.load(sys.stdin);print(len(g['nodes']),len(g['edges']),collections.Counter(n['type'] for n in g['nodes']))"`
      and confirm the Graph size column equals those numbers. Also confirm the first betweenness row is the node with the highest `betweenness` in the JSON (paste its label and value).
   f. Compare each page with its reference screenshot and list the visible differences in layout (the data will differ).
4. Measure on `/insights` at 1440x900 and paste: the number of columns (`getComputedStyle(document.querySelector('[data-screen-label="Insights"]')).gridTemplateColumns`), and on `/compare` `document.querySelector('[data-testid="compare-table"] th').innerText`.

## COMMIT
Stage ONLY the 3 files listed at the top and `gemini/shots/task05-*.png`. Message: `feat(redesign): T05 Compare and Insights exact to reference, real data`. Then `git show --stat HEAD`, `git branch --show-current`, `git log --oneline -3`.

## ACCEPTANCE (PASS/FAIL each with evidence)
- Compare: layout equals the reference (pair buttons or selects, 5-column table, tags); values equal the API; empty state works.
- Insights: three columns equal the reference layout; all numbers equal the API; top bar is brand red.
- No invented number, no demo data, no animation helpers.
- Build exit 0; branch correct; only the listed files in the commit.
