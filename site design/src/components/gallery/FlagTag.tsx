import React from "react";

interface FlagTagProps {
  value: string | number;
  unit?: string;
  flag?: "High" | "Low" | "Normal";
  className?: string;
}

export const FlagTag: React.FC<FlagTagProps> = ({
  value,
  unit,
  flag,
  className = "",
}) => {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-800)] border border-[var(--line-strong)] ${className}`}
    >
      <span className="type-mono text-[var(--ochre-ink)]">
        {value}
        {unit && <span className="ml-1 text-[var(--dim)] type-mono-sm">{unit}</span>}
      </span>
      {flag && (
        <span
          className={`type-mono-sm px-1.5 py-0.2 rounded-[var(--r-4)] font-medium ${
            flag === "High" || flag === "Low"
              ? "bg-[var(--madder)]/18 text-[var(--madder)] border border-[var(--madder)]/30"
              : "bg-[var(--verdigris)]/15 text-[var(--verdigris)] border border-[var(--verdigris)]/30"
          }`}
        >
          {flag}
        </span>
      )}
    </div>
  );
};
