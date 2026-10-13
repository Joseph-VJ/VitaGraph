import React, { useEffect, useMemo, useState } from "react";
import { chartsApi, isAbortError, type ChartPoint, type ChartResult } from "../../api/charts";
import type { ChartSpec } from "../../lib/chartSpec";
import { usePreferences } from "../../lib/preferences";
import { svgForDisplay } from "../../lib/displayTheme";

type ChartState = { status: "loading" } | { status: "ready"; result: ChartResult } | { status: "failed"; message: string };

/** The flag in plain words. Never colour alone. Falls back to comparing with the printed range. */
export function flagWords(point: ChartPoint): string {
  const flag = point.flag.trim().toLowerCase();
  if (flag.includes("abnormal")) return "Outside the printed range";
  if (flag.includes("high") || flag.includes("above")) return "Above the printed range";
  if (flag.includes("low") || flag.includes("below")) return "Below the printed range";
  if (flag.includes("normal") || flag.includes("in range") || flag.includes("inside")) return "Inside the printed range";
  if (point.range_high !== null && point.value > point.range_high) return "Above the printed range";
  if (point.range_low !== null && point.value < point.range_low) return "Below the printed range";
  if (point.range_low !== null || point.range_high !== null) return "Inside the printed range";
  return "No printed range to compare";
}

/** The printed reference range in words, e.g. "12 to 16 g/dL". */
export function rangeWords(point: ChartPoint, unit: string): string {
  const suffix = unit ? ` ${unit}` : "";
  const { range_low: low, range_high: high } = point;
  if (low !== null && high !== null) return `${low} to ${high}${suffix}`;
  if (low !== null) return `At least ${low}${suffix}`;
  if (high !== null) return `At most ${high}${suffix}`;
  return "Not printed";
}

export function dataUrlForSvg(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function fileSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "chart";
}

const cellStyle: React.CSSProperties = { verticalAlign: "top", fontVariantNumeric: "tabular-nums" };

interface ChartViewProps {
  userId: string;
  spec: ChartSpec;
  /** Smaller picture, no table: used inside an answer. */
  compact?: boolean;
}

export const ChartView: React.FC<ChartViewProps> = ({ userId, spec, compact = false }) => {
  const { theme } = usePreferences();
  // The spec is compared by its text, so an equal spec made on a new render does not refetch.
  const specKey = JSON.stringify(spec);
  const [state, setState] = useState<ChartState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    chartsApi
      .render(userId, JSON.parse(specKey) as ChartSpec, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setState({ status: "ready", result });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setState({
          status: "failed",
          message: error instanceof Error && error.message ? error.message : "Something went wrong.",
        });
      });
    return () => controller.abort();
  }, [userId, specKey]);

  const src = useMemo(() => (state.status === "ready" ? dataUrlForSvg(svgForDisplay(state.result.svg, theme)) : ""), [state, theme]);

  if (state.status === "loading") {
    return (
      <p data-testid="chart-loading" role="status" style={{ margin: 0, color: "var(--color-neutral-700)", fontSize: "0.9375rem" }}>
        Drawing the chart from your reports…
      </p>
    );
  }

  if (state.status === "failed") {
    return (
      <div data-testid="chart-error" role="alert" style={{ margin: 0, fontSize: "0.9375rem" }}>
        <p style={{ margin: 0, fontWeight: 800 }}>This chart could not be drawn.</p>
        <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-neutral-700)" }}>{state.message}</p>
      </div>
    );
  }

  const { result } = state;
  const title = result.title || spec.title || "Chart";
  const rows = result.series.flatMap((series) => series.points.map((point) => ({ series, point })));

  const download = () => {
    const blob = new Blob([result.svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileSlug(title)}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div data-testid="chart-view" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 0 }}>
      <img
        src={src}
        alt={title}
        style={{ display: "block", width: "100%", maxWidth: compact ? 600 : undefined, height: "auto" }}
      />
      {result.notes.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: "1.2em", fontSize: "0.8125rem", color: "var(--color-neutral-700)" }}>
          {result.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      ) : null}
      <div>
        <button type="button" className="vg-action" onClick={download}>
          Download SVG
        </button>
      </div>

      {compact ? null : (
        <details className="vg-fold" style={{ borderTop: "1px solid var(--color-divider)" }}>
          <summary style={{ fontWeight: 800, fontSize: "0.9375rem" }}>Show as table</summary>
          {rows.length === 0 ? (
            <p style={{ margin: "var(--space-2) 0", color: "var(--color-neutral-700)" }}>There are no values to list.</p>
          ) : (
            <div style={{ overflowX: "auto", paddingBottom: "var(--space-3)" }}>
              <table className="table" style={{ fontSize: "0.875rem" }}>
                <thead>
                  <tr>
                    <th scope="col">Test</th>
                    <th scope="col">Report</th>
                    <th scope="col">Value</th>
                    <th scope="col">Printed range</th>
                    <th scope="col">Flag</th>
                    <th scope="col">Page</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ series, point }, i) => (
                    <tr key={`${series.test}-${point.report_id}-${i}`}>
                      <td style={cellStyle}>{series.test}</td>
                      <td style={cellStyle}>{point.label}</td>
                      <td style={cellStyle}>
                        <strong>{point.value}</strong>
                        {series.unit ? ` ${series.unit}` : ""}
                      </td>
                      <td style={cellStyle}>{rangeWords(point, series.unit)}</td>
                      <td style={cellStyle}>{flagWords(point)}</td>
                      <td style={cellStyle}>{point.page_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      )}
    </div>
  );
};
