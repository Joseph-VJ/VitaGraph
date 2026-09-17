import React from "react";
import { Odometer } from "../../motion";

export type StatMetricType = "doc" | "cube" | "graph" | "link" | "speech" | "shield";

interface StatTileProps {
  type: StatMetricType;
  label: string;
  value: string | number;
  className?: string;
  staggerIndex?: number;
}

export const StatTile: React.FC<StatTileProps> = ({
  type,
  label,
  value,
  className = "",
  staggerIndex,
}) => {
  const isRefusal = type === "shield";
  const valueColorClass = isRefusal ? "text-[var(--madder)]" : "text-[var(--bone)]";
  const staggerDelay = staggerIndex !== undefined ? Math.min(staggerIndex * 60, 480) : 0;

  const getIcon = (t: StatMetricType) => {
    switch (t) {
      case "doc":
        return (
          <svg className="w-5 h-5 text-[var(--verdigris)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
        );
      case "cube":
        return (
          <svg className="w-5 h-5 text-[var(--cornflower)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
          </svg>
        );
      case "graph":
        return (
          <svg className="w-5 h-5 text-[var(--cornflower)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        );
      case "link":
        return (
          <svg className="w-5 h-5 text-[var(--ochre)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
        );
      case "speech":
        return (
          <svg className="w-5 h-5 text-[var(--ochre)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        );
      case "shield":
        return (
          <svg className="w-5 h-5 text-[var(--madder)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        );
    }
  };

  return (
    <div
      style={staggerIndex !== undefined ? { animationDelay: `${staggerDelay}ms` } : undefined}
      className={`rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 flex flex-col justify-between min-w-[140px] flex-1 m-enter ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="p-1.5 rounded-[var(--r-6)] bg-[var(--ink-700)] flex items-center justify-center">
          {getIcon(type)}
        </span>
      </div>
      <div>
        <div className="type-label text-[var(--dim)] mb-1">{label}</div>
        <div className={`type-stat ${valueColorClass}`}>
          <Odometer value={value} testId={`odometer-${type}`} />
        </div>
      </div>
    </div>
  );
};
