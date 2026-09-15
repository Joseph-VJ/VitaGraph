import React from "react";
import { Link } from "react-router-dom";
import { DeltaChip, Button, Marginalia } from "../components/gallery";

export const ComparePage: React.FC = () => {
  const comparisonRows = [
    {
      test: "Hemoglobin",
      unit: "g/dL",
      baseline: "13.1",
      followup: "13.2",
      deltaType: "improving" as const,
      deltaLabel: "+0.1 improving",
      status: "improved",
      citation: "p. 2",
    },
    {
      test: "eGFR",
      unit: "mL/min/1.73m²",
      baseline: "78.0",
      followup: "72.0",
      deltaType: "decrease" as const,
      deltaLabel: "−6.0 slight decrease",
      status: "declined",
      citation: "p. 3",
    },
    {
      test: "HbA1c",
      unit: "%",
      baseline: "6.8",
      followup: "7.1",
      deltaType: "increase" as const,
      deltaLabel: "+0.3 increase",
      status: "declined",
      citation: "p. 4",
    },
    {
      test: "Vitamin D",
      unit: "ng/mL",
      baseline: "—",
      followup: "24.0",
      deltaType: "new" as const,
      deltaLabel: "new result",
      status: "improved",
      citation: "p. 4",
    },
    {
      test: "Creatinine",
      unit: "mg/dL",
      baseline: "1.4",
      followup: "1.4",
      deltaType: "improving" as const,
      deltaLabel: "0.0 stable",
      status: "stable",
      citation: "p. 3",
    },
    {
      test: "Fasting Blood Glucose",
      unit: "mg/dL",
      baseline: "114",
      followup: "112",
      deltaType: "improving" as const,
      deltaLabel: "−2.0 improving",
      status: "improved",
      citation: "p. 2",
    },
    {
      test: "Total Cholesterol",
      unit: "mg/dL",
      baseline: "192",
      followup: "190",
      deltaType: "improving" as const,
      deltaLabel: "−2.0 stable",
      status: "stable",
      citation: "p. 2",
    },
  ];

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top row with summary and marginalia */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="type-title text-[var(--bone)]">Compare Longitudinal Reports</h2>
          <p className="type-meta text-[var(--dim)] mt-0.5">
            Side-by-side comparative analysis of Arjun R (VG-2026-001) across 6 months.
          </p>
        </div>
        <Marginalia
          text="Same data. Deeper understanding."
          sketch="leaf"
        />
      </div>

      {/* Summary Strip (§9.6: "3 improved · 1 declined · 9 stable · 1 unavailable") */}
      <div className="p-4 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="type-label text-[var(--bone)]">Longitudinal shifts:</span>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-[var(--r-4)] bg-[rgba(121,184,166,0.12)] text-[var(--verdigris)] border border-[rgba(121,184,166,0.25)] type-mono-sm">
              3 improved
            </span>
            <span className="px-2.5 py-0.5 rounded-[var(--r-4)] bg-[rgba(217,128,141,0.12)] text-[var(--madder)] border border-[rgba(217,128,141,0.25)] type-mono-sm">
              1 declined
            </span>
            <span className="px-2.5 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-700)] text-[var(--dim)] border border-[var(--line-strong)] type-mono-sm">
              9 stable
            </span>
            <span className="px-2.5 py-0.5 rounded-[var(--r-4)] bg-[rgba(217,164,65,0.12)] text-[var(--ochre)] border border-[rgba(217,164,65,0.25)] type-mono-sm">
              1 unavailable
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 type-mono-sm text-xs text-[var(--dim)]">
          <span>Baseline: <strong>2025-01-15</strong></span>
          <span>→</span>
          <span>Follow-up: <strong>2025-06-20</strong></span>
        </div>
      </div>

      {/* Comparison Diff Table */}
      <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--line-faint)] bg-[var(--ink-700)]/20">
              <th className="type-label text-[var(--dim)] py-3 px-4">Biomarker / Test</th>
              <th className="type-label text-[var(--dim)] py-3 px-4">Baseline (Jan 15)</th>
              <th className="type-label text-[var(--dim)] py-3 px-4">Follow-up (Jun 20)</th>
              <th className="type-label text-[var(--dim)] py-3 px-4">Delta & Trajectory</th>
              <th className="type-label text-[var(--dim)] py-3 px-4 text-right">Provenance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line-faint)]">
            {comparisonRows.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-[var(--ink-700)]/40 transition-colors duration-[120ms] ease-out"
              >
                <td className="py-3 px-4">
                  <span className="type-body font-medium text-[var(--bone)] block">
                    {row.test}
                  </span>
                  <span className="type-meta text-[var(--dim)] text-[11px]">
                    {row.unit}
                  </span>
                </td>
                <td className="py-3 px-4 type-mono text-sm text-[var(--dim)]">
                  {row.baseline} {row.baseline !== "—" && <span className="type-mono-sm text-[11px] text-[var(--faint)]">{row.unit}</span>}
                </td>
                <td className="py-3 px-4 type-mono text-sm text-[var(--bone)] font-medium">
                  {row.followup} <span className="type-mono-sm text-[11px] text-[var(--dim)]">{row.unit}</span>
                </td>
                <td className="py-3 px-4">
                  <DeltaChip type={row.deltaType} label={row.deltaLabel} />
                </td>
                <td className="py-3 px-4 text-right type-mono-sm text-[var(--faint)]">
                  Ref: {row.citation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

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
