import React from "react";

interface SparklineCardProps {
  title?: string;
  sub?: string;
  footnote?: string;
  points?: number[];
  className?: string;
}

export const SparklineCard: React.FC<SparklineCardProps> = ({
  title = "Retrieval latency",
  sub = "Client measured",
  footnote,
  points = [],
  className = "",
}) => {
  const activePoints = points.length > 0 ? points : [];
  const maxVal = activePoints.length > 0 ? Math.max(50, Math.ceil(Math.max(...activePoints) * 1.15)) : 100;
  const midVal = Math.round(maxVal / 2);
  const width = 280;
  const height = 70;

  // Calculate p50 and p95 dynamically
  let dynamicFootnote = footnote;
  if (!dynamicFootnote) {
    if (activePoints.length === 0) {
      dynamicFootnote = "No latency samples recorded";
    } else {
      const sorted = [...activePoints].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
      dynamicFootnote = `p50 ${p50} ms / p95 ${p95} ms (latest ${activePoints[activePoints.length - 1]} ms)`;
    }
  }

  const polylinePoints =
    activePoints.length > 1
      ? activePoints
          .map((pt, i) => {
            const x = (i / (activePoints.length - 1)) * width;
            const y = height - (Math.min(pt, maxVal) / maxVal) * height;
            return `${x},${y}`;
          })
          .join(" ")
      : activePoints.length === 1
      ? `0,${height - (activePoints[0] / maxVal) * height} ${width},${height - (activePoints[0] / maxVal) * height}`
      : "";

  return (
    <div
      className={`rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 flex flex-col justify-between ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="type-card-title text-[var(--bone)]">{title}</h3>
        <span className="type-meta text-[var(--dim)]">{sub}</span>
      </div>

      <div className="flex gap-2">
        {/* Y-axis */}
        <div className="flex flex-col justify-between text-right type-mono-sm text-[var(--dim)] h-[70px] pr-1 select-none">
          <span>{maxVal}</span>
          <span>{midVal}</span>
          <span>0</span>
        </div>

        {/* SVG Chart */}
        <div className="relative flex-1 h-[70px]">
          <svg
            className="w-full h-full overflow-visible"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
          >
            {/* Gridlines */}
            <line
              x1="0"
              y1="0"
              x2={width}
              y2="0"
              stroke="var(--line-faint)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <line
              x1="0"
              y1={height / 2}
              x2={width}
              y2={height / 2}
              stroke="var(--line-faint)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <line
              x1="0"
              y1={height}
              x2={width}
              y2={height}
              stroke="var(--line-faint)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />

            {/* Sparkline curve */}
            {polylinePoints && (
              <polyline
                fill="none"
                stroke="var(--verdigris)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polylinePoints}
              />
            )}
          </svg>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between pl-7 pr-1 mt-1.5 type-mono-sm text-[var(--dim)] select-none">
        <span>-60m</span>
        <span>-45m</span>
        <span>-30m</span>
        <span>-15m</span>
        <span>now</span>
      </div>

      {/* Footnote */}
      <div className="mt-3 pt-2 border-t border-[var(--line-faint)] text-right type-mono-sm text-[var(--dim)]">
        {dynamicFootnote}
      </div>
    </div>
  );
};
