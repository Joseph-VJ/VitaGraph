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
