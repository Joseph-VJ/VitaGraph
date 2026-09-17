import React, { useEffect, useRef, useState } from "react";
import { governor, isReducedMotion } from "../../motion";

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

  const polylineRef = useRef<SVGPolylineElement | null>(null);
  const latestDotRef = useRef<SVGCircleElement | null>(null);
  const hasDrawnRef = useRef<boolean>(false);
  const prevPointsLenRef = useRef<number>(0);
  const [footnoteVisible, setFootnoteVisible] = useState<boolean>(false);

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

  // DrawPath on first data arrival (§M7.1: --m-cinematic 720ms needle)
  useEffect(() => {
    if (activePoints.length === 0) return;

    const polylineEl = polylineRef.current;
    if (!polylineEl) return;

    const isT0 = governor.getState().tier === "T0" || isReducedMotion();

    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
      prevPointsLenRef.current = activePoints.length;

      if (isT0) {
        setFootnoteVisible(true);
        return;
      }

      // DrawPath stroke-dashoffset needle curve (--m-cinematic 720ms)
      try {
        const len = (polylineEl as any).getTotalLength ? (polylineEl as any).getTotalLength() : 350;
        polylineEl.style.strokeDasharray = `${len}`;
        polylineEl.style.strokeDashoffset = `${len}`;
        const anim = polylineEl.animate(
          [{ strokeDashoffset: `${len}` }, { strokeDashoffset: "0" }],
          {
            duration: 720, // --m-cinematic (§M2.1)
            easing: "cubic-bezier(0.70, 0, 0.30, 1)", // --ease-needle (§M2.2)
            fill: "forwards",
          }
        );
        anim.onfinish = () => {
          polylineEl.style.strokeDasharray = "";
          polylineEl.style.strokeDashoffset = "";
          setFootnoteVisible(true);
        };
      } catch {
        setFootnoteVisible(true);
      }
    } else if (activePoints.length > prevPointsLenRef.current) {
      prevPointsLenRef.current = activePoints.length;
      // New sample point appends with a 1.5px verdigris dot fade (120 ms) per §M7.1
      if (!isT0 && latestDotRef.current) {
        latestDotRef.current.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 120, easing: "ease-out", fill: "forwards" }
        );
      }
    }
  }, [activePoints.length]);

  const pointsCoordinates = activePoints.map((pt, i) => {
    const x = activePoints.length > 1 ? (i / (activePoints.length - 1)) * width : width;
    const y = height - (Math.min(pt, maxVal) / maxVal) * height;
    return { x, y };
  });

  const polylinePoints =
    activePoints.length > 1
      ? pointsCoordinates.map((p) => `${p.x},${p.y}`).join(" ")
      : activePoints.length === 1
      ? `0,${height - (activePoints[0] / maxVal) * height} ${width},${height - (activePoints[0] / maxVal) * height}`
      : "";

  const latestPoint = pointsCoordinates.length > 0 ? pointsCoordinates[pointsCoordinates.length - 1] : null;

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
                ref={polylineRef}
                fill="none"
                stroke="var(--verdigris)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polylinePoints}
              />
            )}

            {/* Appended sample dot (1.5px verdigris dot) */}
            {latestPoint && (
              <circle
                ref={latestDotRef}
                cx={latestPoint.x}
                cy={latestPoint.y}
                r="2.5"
                fill="var(--verdigris)"
                className="opacity-100"
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

      {/* Footnote — fades at draw end (§M7.1) */}
      <div
        className={`mt-3 pt-2 border-t border-[var(--line-faint)] text-right type-mono-sm text-[var(--dim)] transition-opacity duration-[180ms] ${
          footnoteVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {dynamicFootnote}
      </div>
    </div>
  );
};
