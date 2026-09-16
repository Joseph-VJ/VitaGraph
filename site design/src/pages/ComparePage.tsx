import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { DeltaChip, Button, Marginalia } from "../components/gallery";
import { useActiveUser } from "../context/UserContext";
import { reportsApi, type ComparisonData } from "../api/reports";
import type { Report } from "../types";

export const ComparePage: React.FC = () => {
  const { user } = useActiveUser();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";

  const [reports, setReports] = useState<Report[]>([]);
  const [baselineId, setBaselineId] = useState<string>("");
  const [followupId, setFollowupId] = useState<string>("");
  const [compData, setCompData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user's reports first
  useEffect(() => {
    let isMounted = true;
    reportsApi.list(effectiveUserId)
      .then((reps) => {
        if (!isMounted) return;
        setReports(reps);
        if (reps.length > 0) {
          // Earliest as baseline, latest as followup
          const sorted = [...reps].sort((a, b) => a.upload_time.localeCompare(b.upload_time));
          setBaselineId(sorted[0].id);
          setFollowupId(sorted[sorted.length - 1].id);
        }
      })
      .catch((err) => console.warn("Failed to load reports:", err));
    return () => {
      isMounted = false;
    };
  }, [effectiveUserId]);

  // Load comparison data when baselineId or followupId is ready
  const loadComparison = useCallback(async () => {
    if (!baselineId && !followupId && reports.length === 0) return;
    setLoading(true);
    try {
      const data = await reportsApi.compare(effectiveUserId, baselineId, followupId);
      setCompData(data);
    } catch (err) {
      console.warn("Failed to load report comparison:", err);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, baselineId, followupId, reports.length]);

  useEffect(() => {
    loadComparison();
  }, [loadComparison]);

  const summary = compData?.summary || {
    improved: 0,
    declined: 0,
    stable: 0,
    unavailable: 0,
    total: 0,
  };

  const rows = compData?.rows || [];

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top row with summary and marginalia */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="type-title text-[var(--bone)]">Compare Longitudinal Reports</h2>
          <p className="type-meta text-[var(--dim)] mt-0.5">
            Side-by-side comparative analysis of {user?.display_label || "Arjun R"} ({effectiveUserId}) across panels.
          </p>
        </div>
        <Marginalia
          text="Same data. Deeper understanding."
          sketch="leaf"
        />
      </div>

      {/* Selectors for Baseline and Follow-up panels */}
      <div className="p-4 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="baseline-select" className="type-label text-[var(--dim)] text-xs">
              Baseline panel:
            </label>
            <select
              id="baseline-select"
              value={baselineId}
              onChange={(e) => setBaselineId(e.target.value)}
              className="h-8 px-2.5 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-strong)] text-[var(--bone)] type-mono-sm text-xs focus:outline-none focus:border-[var(--verdigris)]"
            >
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.report_date || r.upload_time.split("T")[0]} — {r.original_filename}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[var(--dim)] font-mono">→</span>

          <div className="flex items-center gap-2">
            <label htmlFor="followup-select" className="type-label text-[var(--dim)] text-xs">
              Follow-up panel:
            </label>
            <select
              id="followup-select"
              value={followupId}
              onChange={(e) => setFollowupId(e.target.value)}
              className="h-8 px-2.5 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-strong)] text-[var(--bone)] type-mono-sm text-xs focus:outline-none focus:border-[var(--verdigris)]"
            >
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.report_date || r.upload_time.split("T")[0]} — {r.original_filename}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/upload">
            <Button variant="ghost" className="h-8 text-xs">
              + Upload panel
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Strip (§9.6: "X improved · Y declined · Z stable · W unavailable") */}
      <div className="p-4 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="type-label text-[var(--bone)]">Longitudinal shifts:</span>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-[var(--r-4)] bg-[rgba(121,184,166,0.12)] text-[var(--verdigris)] border border-[rgba(121,184,166,0.25)] type-mono-sm">
              {summary.improved} improved
            </span>
            <span className="px-2.5 py-0.5 rounded-[var(--r-4)] bg-[rgba(217,128,141,0.12)] text-[var(--madder)] border border-[rgba(217,128,141,0.25)] type-mono-sm">
              {summary.declined} declined
            </span>
            <span className="px-2.5 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-700)] text-[var(--dim)] border border-[var(--line-strong)] type-mono-sm">
              {summary.stable} stable
            </span>
            <span className="px-2.5 py-0.5 rounded-[var(--r-4)] bg-[rgba(217,164,65,0.12)] text-[var(--ochre)] border border-[rgba(217,164,65,0.25)] type-mono-sm">
              {summary.unavailable} unavailable
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 type-mono-sm text-xs text-[var(--dim)]">
          <span>
            Baseline: <strong>{compData?.baseline_date || "—"}</strong>
          </span>
          <span>→</span>
          <span>
            Follow-up: <strong>{compData?.followup_date || "—"}</strong>
          </span>
        </div>
      </div>

      {/* Comparison Diff Table */}
      <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--dim)] type-body">
            Computing longitudinal differences between panels...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-[var(--dim)] type-body">
            No comparable lab observations found in the selected reports.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--line-faint)] bg-[var(--ink-700)]/20">
                <th className="type-label text-[var(--dim)] py-3 px-4">Biomarker / Test</th>
                <th className="type-label text-[var(--dim)] py-3 px-4">
                  Baseline ({compData?.baseline_date || "Baseline"})
                </th>
                <th className="type-label text-[var(--dim)] py-3 px-4">
                  Follow-up ({compData?.followup_date || "Follow-up"})
                </th>
                <th className="type-label text-[var(--dim)] py-3 px-4">Delta & Trajectory</th>
                <th className="type-label text-[var(--dim)] py-3 px-4 text-right">Provenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-faint)]">
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="hover:bg-[var(--ink-700)]/40 transition-colors duration-[120ms] ease-out"
                >
                  <td className="py-3 px-4">
                    <span className="type-body font-medium text-[var(--bone)] block">
                      {row.test}
                    </span>
                    <span className="type-meta text-[var(--dim)] text-[11px]">
                      {row.category} · {row.unit}
                    </span>
                  </td>
                  <td className="py-3 px-4 type-mono text-sm text-[var(--dim)]">
                    {row.baseline}{" "}
                    {row.baseline !== "—" && (
                      <span className="type-mono-sm text-[11px] text-[var(--faint)]">
                        {row.unit}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 type-mono text-sm text-[var(--bone)] font-medium">
                    {row.followup}{" "}
                    {row.followup !== "—" && (
                      <span className="type-mono-sm text-[11px] text-[var(--dim)]">
                        {row.unit}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <DeltaChip type={row.delta_type} label={row.delta_label} />
                  </td>
                  <td className="py-3 px-4 text-right type-mono-sm text-[var(--faint)]">
                    Ref: {row.citation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Table Footer */}
        <div className="p-3 bg-[var(--ink-900)] border-t border-[var(--line-faint)] flex items-center justify-between">
          <span className="type-quote-sm italic text-[var(--dim)] text-xs">
            "Automated clinical difference extraction verified against ground truth PDFs."
          </span>
          <Link to="/timeline">
            <Button variant="ghost" className="h-7 text-xs">
              Return to timeline spine
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
