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
      <span className="type-mono text-[var(--ochre)]">
        {value}
        {unit && <span className="ml-1 text-[var(--dim)] type-mono-sm">{unit}</span>}
      </span>
      {flag && (
        <span
          className={`type-mono-sm px-1.5 py-0.2 rounded-[var(--r-4)] font-medium ${
            flag === "High" || flag === "Low"
              ? "bg-[rgba(217,128,141,0.18)] text-[var(--madder)] border border-[rgba(217,128,141,0.3)]"
              : "bg-[rgba(121,184,166,0.15)] text-[var(--verdigris)] border border-[rgba(121,184,166,0.3)]"
          }`}
        >
          {flag}
        </span>
      )}
    </div>
  );
};
