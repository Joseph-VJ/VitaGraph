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
  sub = "Last 24 hours",
  footnote = "p50 38 ms / p95 121 ms",
  className = "",
}) => {
  // Sample path representing retrieval latency across 24h
  const points = [
    35, 42, 38, 48, 32, 40, 52, 38, 44, 39, 41, 195, 48, 42, 38, 55, 40, 36, 68, 45, 52, 43, 49, 38
  ];
  const maxVal = 300;
  const width = 280;
  const height = 70;

  const polylinePoints = points
    .map((pt, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - (pt / maxVal) * height;
      return `${x},${y}`;
    })
    .join(" ");

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
          <span>300</span>
          <span>150</span>
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
            <polyline
              fill="none"
              stroke="var(--verdigris)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylinePoints}
            />
          </svg>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between pl-7 pr-1 mt-1.5 type-mono-sm text-[var(--dim)] select-none">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>

      {/* Footnote */}
      <div className="mt-3 pt-2 border-t border-[var(--line-faint)] text-right type-mono-sm text-[var(--dim)]">
        {footnote}
      </div>
    </div>
  );
};
