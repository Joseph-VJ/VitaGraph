import React from "react";
import type { ChartSpec } from "../../lib/chartSpec";
import { ChartView } from "./ChartView";

const MEASURE = "66ch";

/** A title for the card when the spec has none: the tests or the report, in plain words. */
export function chartCardTitle(spec: ChartSpec): string {
  if (spec.title) return spec.title;
  if (spec.kind === "trend") return `Trend of ${spec.tests.join(", ")}`;
  if (spec.kind === "compare") return `Comparison of ${spec.tests.join(", ")}`;
  return "All values of one report";
}

interface ChartCardProps {
  userId: string;
  spec: ChartSpec;
  /** Open the chart in the side panel. */
  onOpen: (spec: ChartSpec) => void;
}

/** A chart shown inside an answer: a small picture, its title and an Open button. */
export const ChartCard: React.FC<ChartCardProps> = ({ userId, spec, onOpen }) => {
  const title = chartCardTitle(spec);
  return (
    <figure
      data-testid="agent-chart-card"
      className="vg-general"
      style={{ maxWidth: MEASURE, margin: "0 0 var(--space-3)", padding: "var(--space-3)" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
        <div style={{ minWidth: 0 }}>
          <span className="tag tag-neutral" style={{ fontWeight: 800 }}>
            Chart
          </span>
          <div style={{ fontWeight: 800, fontSize: "1.0625rem", marginTop: "var(--space-1)", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => onOpen(spec)} style={{ flex: "none" }}>
          Open
        </button>
      </div>
      <ChartView userId={userId} spec={spec} compact />
    </figure>
  );
};
