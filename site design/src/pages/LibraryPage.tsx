import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { reportsApi, type MeasurementRow } from "../api/reports";
import { useActiveUser } from "../context/UserContext";
import { transitionNavigate } from "../motion/navigation";
import { makeLabeler, sortReports, reportStatus, parseReportDate } from "../lib/reportLabels";
import { PageFrame, PageState, PersonaState, Tag, type TagTone } from "../components/ui";
import type { Report, ReportPage } from "../types";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const num = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 3 });
const headStyle: React.CSSProperties = {
  fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-700)",
};
const GRID = "minmax(120px,1.2fr) minmax(90px,0.8fr) minmax(150px,1.6fr) 5.5rem";

/** Status from the report's own printed range, else the lab's own flag. Never a judgement of ours. */
function statusOf(r: MeasurementRow): { label: string; tone: TagTone } {
  if (r.range_low !== null && r.range_high !== null) {
    if (r.value < r.range_low) return { label: "Below range", tone: "hot" };
    if (r.value > r.range_high) return { label: "Above range", tone: "hot" };
    return { label: "In range", tone: "neutral" };
  }
  const f = r.flag.toUpperCase();
  if (f === "LOW") return { label: "Below range", tone: "hot" };
  if (f === "HIGH") return { label: "Above range", tone: "hot" };
  if (f && f !== "NORMAL") return { label: `Lab flag ${r.flag.toLowerCase()}`, tone: "hot" };
  return { label: "No range", tone: "neutral" };
}

export const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: personaLoading, refreshUsers } = useActiveUser();
  const userId = user?.id ?? null;

  const [reports, setReports] = useState<Report[] | null>(null);
  const [selId, setSelId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<MeasurementRow[] | null>(null);
  const [prevRows, setPrevRows] = useState<MeasurementRow[]>([]);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [pages, setPages] = useState<ReportPage[] | null>(null);
  const [pagesFailed, setPagesFailed] = useState(false);
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
        const latestDated = [...sorted].reverse().find((r) => parseReportDate(r) !== null);
        setSelId(latestDated ? latestDated.id : (sorted.length > 0 ? sorted[sorted.length - 1].id : ""));
      })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [userId, tick]);

  const labelOf = useMemo(() => makeLabeler(reports ?? []), [reports]);
  const selIndex = (reports ?? []).findIndex((r) => r.id === selId);
  const selected = selIndex >= 0 ? (reports ?? [])[selIndex] : null;
  const previous = selIndex > 0 ? (reports ?? [])[selIndex - 1] : null;

  const loadMeasurements = useCallback(async (reportId: string): Promise<MeasurementRow[]> => {
    if (!userId) return [];
    const hit = cache.current.get(reportId);
    if (hit) return hit;
    const data = await reportsApi.measurements(userId, reportId);
    cache.current.set(reportId, data);
    return data;
  }, [userId]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setRows(null);
    setRowsError(null);
    setPages(null);
    setPagesFailed(false);
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
    if (next && selected && userId && pages === null && !pagesFailed) {
      reportsApi
        .pages(userId, selected.id)
        .then(setPages)
        .catch(() => setPagesFailed(true));
    }
  };

  if (!userId) {
    return (
      <PageFrame label="Library">
        <PersonaState loading={personaLoading} onRetry={refreshUsers} />
      </PageFrame>
    );
  }

  if (reports === null && !error) {
    return (
      <PageFrame label="Library">
        <PageState kind="loading" title="Loading reports" />
      </PageFrame>
    );
  }

  if (error) {
    return (
      <PageFrame label="Library">
        <PageState
          kind="error"
          title="Could not load reports"
          detail={error}
          action={{ label: "Try again", onClick: () => setTick((t) => t + 1) }}
        />
      </PageFrame>
    );
  }

  if ((reports ?? []).length === 0) {
    return (
      <PageFrame label="Library">
        <PageState
          kind="empty"
          title="No reports yet"
          detail="Upload a report to see the values read from it."
          action={{
            label: "Upload a report",
            onClick: () => transitionNavigate(navigate, "/upload", { direction: "back" }),
          }}
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame label="Library">
      <div className="vg-scroll-x">
        <table className="table" data-testid="library-table" style={{ minWidth: 640 }}>
          <thead>
            <tr><th>Report</th><th>Description</th><th>Pages</th><th>Chunks</th><th>SHA-256</th><th>Status</th></tr>
          </thead>
          <tbody>
            {(reports ?? []).map((r) => {
              const st = reportStatus(r);
              return (
                <tr
                  key={r.id}
                  tabIndex={0}
                  onClick={() => setSelId(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelId(r.id);
                    }
                  }}
                  style={{ cursor: "pointer", background: r.id === selId ? "var(--color-accent-100)" : undefined }}
                  aria-selected={r.id === selId}
                >
                  <td style={{ fontWeight: 800 }}>{labelOf(r)}</td>
                  <td style={{ overflowWrap: "anywhere" }}>{r.original_filename}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.page_count ?? "—"}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.chunk_count ?? "—"}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-neutral-700)", whiteSpace: "nowrap" }}>
                    {r.file_hash.length > 8 ? `${r.file_hash.slice(0, 4)}…${r.file_hash.slice(-4)}` : r.file_hash}
                  </td>
                  <td><Tag tone={st.tone}>{st.label}</Tag></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-4)", flexWrap: "wrap", paddingBottom: "var(--space-2)", borderBottom: "2px solid var(--color-divider)" }}>
            <h3 style={{ margin: 0, fontSize: "1.5625rem", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.015em" }}>{labelOf(selected)} · values</h3>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-neutral-700)" }}>Select a row to see the passage a value came from</span>
          </div>

          {rows === null && (
            <div style={{ paddingTop: "var(--space-4)" }}>
              <PageState kind="loading" title="Reading values" />
            </div>
          )}

          {rows !== null && rows.length === 0 && (
            rowsError ? (
              <PageState
                kind="error"
                title="Could not read values"
                detail={rowsError}
                action={{ label: "Try again", onClick: () => setTick((t) => t + 1) }}
              />
            ) : (
              <PageState
                kind="empty"
                title="No values were read from this report"
                detail="Its pages may hold text without test results, or the values could not be read."
              />
            )
          )}

          {rows !== null && rows.length > 0 && (
            <div className="vg-scroll-x">
              <div style={{ minWidth: 560 }}>
                <div style={{ display: "grid", gridTemplateColumns: GRID, gap: "var(--space-4)", padding: "var(--space-2) var(--space-2)", borderBottom: "2px solid var(--color-divider)", ...headStyle }}>
                  <span>Biomarker</span><span>Value</span><span>Reference range</span><span>Status</span>
                </div>

                {rows.map((b) => {
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
                          <Tag tone={st.tone}>{st.label}</Tag>
                        </span>
                      </button>
                      {open && (
                        <div style={{ margin: "0 var(--space-2) var(--space-4)", background: "var(--color-surface)", borderTop: "2px solid var(--color-text)", padding: "var(--space-4)" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", ...headStyle }}>
                            <span>{labelOf(selected)}</span>
                            <span>Page {b.page_number}</span>
                            <span>{b.span_exact ? "Characters" : "Chunk"} {b.char_start}–{b.char_end}</span>
                          </div>
                          {pagesFailed ? (
                            <div style={{ marginTop: "var(--space-3)", fontSize: "0.9375rem", color: "var(--color-neutral-700)" }}>
                              The page text could not be loaded.
                            </div>
                          ) : pages === null ? (
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
            </div>
          )}
        </div>
      )}
    </PageFrame>
  );
};
