import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { DeltaChip, Button, Marginalia } from "../components/gallery";
import { Odometer } from "../motion/fx/Odometer";
import { flip, flipFrom } from "../motion/flip";
import { DrawPath } from "../motion/fx/DrawPath";
import { governor } from "../motion/quality";
import { isReducedMotion } from "../motion/features";
import { getNavDirection, setNavDirection } from "../motion/navigation";
import { useActiveUser } from "../context/UserContext";
import { reportsApi, type ComparisonData } from "../api/reports";
import type { Report } from "../types";

export const ComparePage: React.FC = () => {
  const location = useLocation();
  const { user } = useActiveUser();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";

  const [reports, setReports] = useState<Report[]>([]);
  const [baselineId, setBaselineId] = useState<string>("");
  const [followupId, setFollowupId] = useState<string>("");
  const [compData, setCompData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  const rowsRef = useRef<HTMLTableSectionElement>(null);
  const prevWidthsRef = useRef<Record<string, number>>({});
  const segImpRef = useRef<HTMLDivElement>(null);
  const segDecRef = useRef<HTMLDivElement>(null);
  const segStbRef = useRef<HTMLDivElement>(null);
  const segUnkRef = useRef<HTMLDivElement>(null);

  const isT0 = isReducedMotion() || governor.getState().tier === "T0";

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

  const totalCount =
    (summary.improved + summary.declined + summary.stable + summary.unavailable) || summary.total || 0;

  const rows = compData?.rows || [];

  // WAAPI scaleX tween for proportion segments (§M4.1)
  useEffect(() => {
    if (!compData || totalCount === 0) return;
    if (isT0) return;

    const segments: [React.RefObject<HTMLDivElement | null>, string, number][] = [
      [segImpRef, "improved", summary.improved],
      [segDecRef, "declined", summary.declined],
      [segStbRef, "stable", summary.stable],
      [segUnkRef, "unavailable", summary.unavailable],
    ];

    segments.forEach(([ref, key, val]) => {
      const el = ref.current;
      if (!el) return;
      const newWidth = (val / totalCount) * 100;
      const oldWidth = prevWidthsRef.current[key] !== undefined ? prevWidthsRef.current[key] : newWidth;
      prevWidthsRef.current[key] = newWidth;

      if (oldWidth !== newWidth && newWidth > 0) {
        const ratio = Math.max(0.01, oldWidth / newWidth);
        el.animate(
          [
            { transform: `scaleX(${ratio})` },
            { transform: "scaleX(1)" },
          ],
          {
            duration: 360,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "forwards",
          }
        );
      }
    });
  }, [compData, totalCount, summary, isT0]);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top row with summary and marginalia */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            style={{ viewTransitionName: !isT0 ? "report-title" : undefined }}
            className="type-title text-[var(--bone)]"
          >
            Compare Longitudinal Reports
          </h2>
          <p className="type-meta text-[var(--dim)] mt-0.5">
            Side-by-side comparative analysis of {user?.display_label || "Arjun R"} ({effectiveUserId}) across panels.
          </p>
        </div>
        <Marginalia
          text="Same data. Deeper understanding."
          sketch="leaf"
        />
      </div>

      {/* Selectors for Baseline and Follow-up panels with FLIP-swap (§M7.7, M4.1) */}
      <div className="p-4 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div id="baseline-chip-container" className="flex items-center gap-2">
            <label htmlFor="baseline-select" className="type-label text-[var(--dim)] text-xs">
              Baseline panel:
            </label>
            <select
              id="baseline-select"
              value={baselineId}
              onChange={(e) => {
                const val = e.target.value;
                if (rowsRef.current && !isT0) {
                  flip(rowsRef.current, () => setBaselineId(val), { spring: "weighted", capMs: 240 });
                } else {
                  setBaselineId(val);
                }
              }}
              className="h-8 px-2.5 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-strong)] text-[var(--bone)] type-mono-sm text-xs focus:outline-none focus:border-[var(--verdigris)]"
            >
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.report_date || r.upload_time.split("T")[0]} — {r.original_filename}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              const bEl = document.getElementById("baseline-chip-container");
              const fEl = document.getElementById("followup-chip-container");
              if (bEl && fEl) {
                const bRect = bEl.getBoundingClientRect();
                const fRect = fEl.getBoundingClientRect();
                const temp = baselineId;
                setBaselineId(followupId);
                setFollowupId(temp);
                flipFrom(bEl, fRect, { spring: "weighted", capMs: 240 });
                flipFrom(fEl, bRect, { spring: "weighted", capMs: 240 });
              } else {
                const temp = baselineId;
                setBaselineId(followupId);
                setFollowupId(temp);
              }
            }}
            title="Swap baseline and follow-up panels"
            className="px-2.5 py-1 rounded-[var(--r-4)] bg-[var(--ink-900)] hover:bg-[var(--ink-700)] text-[var(--dim)] hover:text-[var(--bone)] border border-[var(--line-strong)] cursor-pointer text-xs font-mono transition-colors"
          >
            ⇄ Swap
          </button>

          <div id="followup-chip-container" className="flex items-center gap-2">
            <label htmlFor="followup-select" className="type-label text-[var(--dim)] text-xs">
              Follow-up panel:
            </label>
            <select
              id="followup-select"
              value={followupId}
              onChange={(e) => {
                const val = e.target.value;
                if (rowsRef.current && !isT0) {
                  flip(rowsRef.current, () => setFollowupId(val), { spring: "weighted", capMs: 240 });
                } else {
                  setFollowupId(val);
                }
              }}
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
          <Link
            to="/upload"
            viewTransition
            onClick={() => setNavDirection(getNavDirection(location.pathname, "/upload"))}
          >
            <Button variant="ghost" className="h-8 text-xs">
              + Upload panel
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Strip (§9.6, §M7.7: counts odometer, segment widths scaleX to real proportions) */}
      <div className="p-4 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="type-label text-[var(--bone)]">Longitudinal shifts:</span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-[var(--r-4)] bg-[rgba(121,184,166,0.12)] text-[var(--verdigris)] border border-[rgba(121,184,166,0.25)] type-mono-sm flex items-center gap-1">
                <Odometer value={summary.improved} duration={480} testId="odo-improved" /> improved
              </span>
              <span className="px-2.5 py-0.5 rounded-[var(--r-4)] bg-[rgba(217,128,141,0.12)] text-[var(--madder)] border border-[rgba(217,128,141,0.25)] type-mono-sm flex items-center gap-1">
                <Odometer value={summary.declined} duration={480} testId="odo-declined" /> declined
              </span>
              <span className="px-2.5 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-700)] text-[var(--dim)] border border-[var(--line-strong)] type-mono-sm flex items-center gap-1">
                <Odometer value={summary.stable} duration={480} testId="odo-stable" /> stable
              </span>
              <span className="px-2.5 py-0.5 rounded-[var(--r-4)] bg-[rgba(217,164,65,0.12)] text-[var(--ochre)] border border-[rgba(217,164,65,0.25)] type-mono-sm flex items-center gap-1">
                <Odometer value={summary.unavailable} duration={480} testId="odo-unavailable" /> unavailable
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

        {/* Proportional summary segments scaleX to real proportions (§M7.7, M4.1 WAAPI) */}
        {totalCount > 0 && (
          <div className="w-full h-1.5 rounded-full bg-[var(--ink-900)] flex overflow-hidden gap-0.5">
            {summary.improved > 0 && (
              <div
                ref={segImpRef}
                style={{ width: `${(summary.improved / totalCount) * 100}%`, transformOrigin: "left" }}
                className="h-full bg-[var(--verdigris)] rounded-full animate-scale-x"
                data-testid="summary-segment-improved"
              />
            )}
            {summary.declined > 0 && (
              <div
                ref={segDecRef}
                style={{ width: `${(summary.declined / totalCount) * 100}%`, transformOrigin: "left" }}
                className="h-full bg-[var(--madder)] rounded-full animate-scale-x"
                data-testid="summary-segment-declined"
              />
            )}
            {summary.stable > 0 && (
              <div
                ref={segStbRef}
                style={{ width: `${(summary.stable / totalCount) * 100}%`, transformOrigin: "left" }}
                className="h-full bg-[var(--dim)] rounded-full animate-scale-x"
                data-testid="summary-segment-stable"
              />
            )}
            {summary.unavailable > 0 && (
              <div
                ref={segUnkRef}
                style={{ width: `${(summary.unavailable / totalCount) * 100}%`, transformOrigin: "left" }}
                className="h-full bg-[var(--ochre)] rounded-full animate-scale-x"
                data-testid="summary-segment-unavailable"
              />
            )}
          </div>
        )}
      </div>

      {/* Comparison Diff Table */}
      <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] overflow-hidden">
        {loading ? (
          <div className="p-5 flex flex-col gap-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-[var(--line-faint)] last:border-0">
                <div className="flex flex-col gap-1.5 w-44">
                  <div className="h-4 w-32 rounded-[var(--r-4)] skeleton-shimmer" />
                  <div className="h-3 w-20 rounded-[var(--r-4)] skeleton-shimmer" />
                </div>
                <div className="h-4 w-24 rounded-[var(--r-4)] skeleton-shimmer" />
                <div className="h-4 w-24 rounded-[var(--r-4)] skeleton-shimmer" />
                <div className="h-6 w-28 rounded-[var(--r-4)] skeleton-shimmer" />
                <div className="h-4 w-16 rounded-[var(--r-4)] skeleton-shimmer" />
              </div>
            ))}
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
            <tbody ref={rowsRef} data-testid="compare-rows" className="divide-y divide-[var(--line-faint)]">
              {rows.map((row, i) => {
                const staggerMs = Math.min(i * 24, 240);
                const bVal = typeof row.baseline === "number" ? row.baseline : parseFloat(String(row.baseline));
                const fVal = typeof row.followup === "number" ? row.followup : parseFloat(String(row.followup));
                const hasNums = !isNaN(bVal) && !isNaN(fVal);
                let y1 = 8;
                let y2 = 8;
                if (hasNums) {
                  if (fVal > bVal) {
                    y1 = 12;
                    y2 = 4;
                  } else if (fVal < bVal) {
                    y1 = 4;
                    y2 = 12;
                  }
                }
                const sparkD = `M 2 ${y1} L 38 ${y2}`;
                const sparkColor =
                  row.delta_type === "improving"
                    ? "var(--verdigris)"
                    : row.delta_type === "decrease"
                    ? "var(--ochre)"
                    : row.delta_type === "increase"
                    ? "var(--madder)"
                    : "var(--cornflower)";

                const rowSlug = (row as any).id || row.test.toLowerCase().replace(/[^a-z0-9]/g, "-");

                return (
                  <tr
                    key={i}
                    data-testid={`diff-row-${i}`}
                    className="hover:bg-[var(--ink-700)]/40 transition-colors duration-[120ms] ease-out m-enter"
                    style={{
                      animationDelay: `${staggerMs}ms`,
                      viewTransitionName: i === 0 && !isT0 ? "compare-row-timeline" : undefined,
                    }}
                  >
                    <td className="py-3 px-4">
                      <span className="type-body font-medium text-[var(--bone)] block">
                        {row.test}
                      </span>
                      <span className="type-meta text-[var(--dim)] text-[11px]">
                        {row.category} · {row.unit}
                      </span>
                    </td>
                    <td
                      className="py-3 px-4 type-mono text-sm text-[var(--dim)] animate-diff-baseline"
                      style={{ animationDelay: `${staggerMs}ms` }}
                      data-testid={`diff-baseline-${i}`}
                    >
                      {row.baseline}{" "}
                      {row.baseline !== "—" && (
                        <span className="type-mono-sm text-[11px] text-[var(--faint)]">
                          {row.unit}
                        </span>
                      )}
                    </td>
                    <td
                      className="py-3 px-4 type-mono text-sm text-[var(--bone)] font-medium animate-diff-followup"
                      style={{ animationDelay: `${staggerMs}ms` }}
                      data-testid={`diff-followup-${i}`}
                    >
                      {row.followup}{" "}
                      {row.followup !== "—" && (
                        <span className="type-mono-sm text-[11px] text-[var(--dim)]">
                          {row.unit}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <DeltaChip type={row.delta_type} label={row.delta_label} pop />
                        <svg
                          data-testid={`delta-spark-${rowSlug}`}
                          className="w-10 h-4 overflow-visible inline-block flex-shrink-0"
                          viewBox="0 0 40 16"
                        >
                          <DrawPath
                            d={sparkD}
                            durationMs={480}
                            stroke={sparkColor}
                            strokeWidth={1.5}
                            strokeLinecap="round"
                          />
                          <circle cx="2" cy={y1} r="1.5" fill={sparkColor} />
                          <circle cx="38" cy={y2} r="1.5" fill={sparkColor} />
                        </svg>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right type-mono-sm text-[var(--faint)]">
                      Ref: {row.citation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Table Footer */}
        <div className="p-3 bg-[var(--ink-900)] border-t border-[var(--line-faint)] flex items-center justify-between">
          <span className="type-quote-sm italic text-[var(--dim)] text-xs">
            "Automated clinical difference extraction verified against ground truth PDFs."
          </span>
          <Link
            to="/timeline"
            viewTransition
            onClick={() => setNavDirection(getNavDirection(location.pathname, "/timeline"))}
          >
            <Button variant="ghost" className="h-7 text-xs">
              Return to timeline spine
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
