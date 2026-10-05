import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { reportsApi, type ComparisonData } from "../api/reports";
import { useActiveUser } from "../context/UserContext";
import { transitionNavigate } from "../motion/navigation";
import { makeLabeler, sortReports, parseReportDate } from "../lib/reportLabels";
import { PageFrame, PageState, PersonaState, Tag } from "../components/ui";
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

const arrow = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"
    style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", verticalAlign: "-2px" }}>
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
);

export const ComparePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: personaLoading, refreshUsers } = useActiveUser();
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
        const sorted = sortReports(list);
        setReports(sorted);
        if (sorted.length >= 2) {
          const dated = sorted.filter((r) => parseReportDate(r) !== null);
          if (dated.length >= 2) {
            setBaselineId(dated[0].id);
            setFollowupId(dated[dated.length - 1].id);
          } else {
            setBaselineId(sorted[0].id);
            setFollowupId(sorted[sorted.length - 1].id);
          }
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

  // Load the comparison for the chosen pair (again after "Try again")
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
  }, [userId, baselineId, followupId, reloadTick]);

  const labelOf = useMemo(() => makeLabeler(reports ?? []), [reports]);

  const pairs: [Report, Report][] = useMemo(() => {
    const list = reports ?? [];
    const out: [Report, Report][] = [];
    for (let i = 0; i < list.length - 1; i += 1) out.push([list[i], list[i + 1]]);
    if (list.length > 2) out.push([list[0], list[list.length - 1]]);
    return out;
  }, [reports]);

  const base = reports?.find((r) => r.id === baselineId);
  const follow = reports?.find((r) => r.id === followupId);

  const retry = () => setReloadTick((t) => t + 1);

  if (!userId) {
    return (
      <PageFrame label="Compare" gap="var(--space-6)">
        <PersonaState loading={personaLoading} onRetry={refreshUsers} />
      </PageFrame>
    );
  }

  if (reports === null && !error) {
    return (
      <PageFrame label="Compare" gap="var(--space-6)">
        <PageState kind="loading" title="Loading reports" />
      </PageFrame>
    );
  }

  if (error && reports === null) {
    return (
      <PageFrame label="Compare" gap="var(--space-6)">
        <PageState
          kind="error"
          title="Could not load reports"
          detail={error}
          action={{ label: "Try again", onClick: retry }}
        />
      </PageFrame>
    );
  }

  if ((reports ?? []).length < 2) {
    const count = (reports ?? []).length;
    return (
      <PageFrame label="Compare" gap="var(--space-6)">
        <PageState
          kind="empty"
          title="Comparing needs two reports"
          detail={`This persona has ${count} ${count === 1 ? "report" : "reports"}. Upload another one to compare values.`}
          action={{
            label: "Upload a report",
            onClick: () => transitionNavigate(navigate, "/upload", { direction: "back" }),
          }}
        />
      </PageFrame>
    );
  }

  const usePairButtons = (reports ?? []).length <= 4;
  const rows = data?.rows ?? [];

  return (
    <PageFrame label="Compare" gap="var(--space-6)">
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
          <div className="field" style={{ flex: "1 1 260px", minWidth: "min(260px, 100%)" }}>
            <label htmlFor="cmp-base">Baseline</label>
            <select id="cmp-base" className="input" value={baselineId} onChange={(e) => setBaselineId(e.target.value)}>
              {(reports ?? []).map((r) => <option key={r.id} value={r.id}>{labelOf(r)}</option>)}
            </select>
          </div>
          <span aria-hidden="true" style={{ paddingBottom: 8 }}>{arrow}</span>
          <div className="field" style={{ flex: "1 1 260px", minWidth: "min(260px, 100%)" }}>
            <label htmlFor="cmp-follow">Follow-up</label>
            <select id="cmp-follow" className="input" value={followupId} onChange={(e) => setFollowupId(e.target.value)}>
              {(reports ?? []).map((r) => <option key={r.id} value={r.id}>{labelOf(r)}</option>)}
            </select>
          </div>
        </div>
      )}

      {error && (
        <PageState
          kind="error"
          title="Could not load the comparison"
          detail={error}
          action={{ label: "Try again", onClick: retry }}
        />
      )}
      {loading && !data && <PageState kind="loading" title="Comparing" />}

      {data && (
        <div className="vg-scroll-x">
          <table className="table" data-testid="compare-table" style={{ minWidth: 560 }}>
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
                      <Tag tone={d === null ? "neutral" : "accent"}>{status}</Tag>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageFrame>
  );
};
