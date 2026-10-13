import React from "react";
import type { LabRunSummary } from "../../api/lab";

export interface SweepPoint {
  chunkSize: number;
  hitRate: number;
  mrr: number;
}

/** Latest finished quick run per chunk size for this top-k. History is newest first. */
export function sweepPoints(history: LabRunSummary[], topK: number): SweepPoint[] {
  const seen = new Map<number, SweepPoint>();
  for (const run of history) {
    if (run.mode !== "quick" || run.top_k !== topK || !run.scorecard) continue;
    if (run.status !== "finished" && run.status !== "completed") continue;
    const { retrieval_hit_rate: hit, mrr } = run.scorecard;
    if (typeof hit !== "number" || typeof mrr !== "number") continue;
    if (!seen.has(run.chunk_size)) seen.set(run.chunk_size, { chunkSize: run.chunk_size, hitRate: hit, mrr });
  }
  return [...seen.values()].sort((a, b) => a.chunkSize - b.chunkSize);
}

const W = 640;
const H = 260;
const M = { left: 44, right: 20, top: 16, bottom: 44 };
const X_MIN = 120;
const X_MAX = 600;
const GRID = [0, 25, 50, 75, 100];

const axisText: React.CSSProperties = { fontSize: 12, fontVariantNumeric: "tabular-nums" };

export const SweepChart: React.FC<{ points: SweepPoint[] }> = ({ points }) => {
  if (points.length === 0) {
    return (
      <div
        data-testid="lab-sweep-chart"
        style={{
          padding: "var(--space-6)",
          background: "var(--color-surface)",
          borderTop: "2px solid var(--color-divider)",
          color: "var(--color-neutral-700)",
          fontSize: "0.9375rem",
        }}
      >
        Compare piece sizes to fill this chart.
      </div>
    );
  }
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const x = (size: number) => M.left + ((size - X_MIN) / (X_MAX - X_MIN)) * plotW;
  const y = (percent: number) => M.top + plotH - (percent / 100) * plotH;
  const label =
    "How well the search worked for each piece size. " +
    points
      .map(
        (p) =>
          `Piece size ${p.chunkSize} characters: the right passage was found for ${Math.round(p.hitRate * 100)} percent of questions, ` +
          `and the near-the-top score was ${Math.round(p.mrr * 100)} out of 100`,
      )
      .join("; ");
  const line = points.map((p) => `${x(p.chunkSize)},${y(p.mrr * 100)}`).join(" ");

  return (
    <div data-testid="lab-sweep-chart" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: "100%", height: "auto", display: "block" }}>
        {GRID.map((g) => (
          <g key={g}>
            <line x1={M.left} x2={W - M.right} y1={y(g)} y2={y(g)} stroke="var(--color-divider)" strokeWidth={1} />
            <text x={M.left - 8} y={y(g) + 4} textAnchor="end" fill="var(--color-neutral-700)" style={axisText}>
              {g}%
            </text>
          </g>
        ))}
        {points.map((p) => (
          <g key={p.chunkSize}>
            <rect
              x={x(p.chunkSize) - 12}
              y={y(p.hitRate * 100)}
              width={24}
              height={y(0) - y(p.hitRate * 100)}
              fill="var(--color-text)"
            />
            <text x={x(p.chunkSize)} y={H - M.bottom + 18} textAnchor="middle" fill="var(--color-neutral-700)" style={axisText}>
              {p.chunkSize}
            </text>
          </g>
        ))}
        <text x={M.left + plotW / 2} y={H - 6} textAnchor="middle" fill="var(--color-neutral-700)" style={axisText}>
          Piece size (characters)
        </text>
        {points.length > 1 && <polyline points={line} fill="none" stroke="var(--color-accent)" strokeWidth={2} />}
        {points.map((p) => (
          <rect
            key={`m-${p.chunkSize}`}
            x={x(p.chunkSize) - 3}
            y={y(p.mrr * 100) - 3}
            width={6}
            height={6}
            fill="var(--color-accent)"
          />
        ))}
      </svg>
      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", fontSize: "0.9375rem", color: "var(--color-neutral-700)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, background: "var(--color-text)", display: "inline-block" }} />
          Black bars: questions where the right passage was found
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, background: "var(--color-accent)", display: "inline-block" }} />
          Red line: how near the top it came
        </span>
      </div>
    </div>
  );
};
