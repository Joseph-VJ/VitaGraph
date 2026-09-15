import React from "react";

interface QualityBarProps {
  percentage: number; // 0 to 100
  method?: "native" | "ocr";
  className?: string;
}

export const QualityBar: React.FC<QualityBarProps> = ({
  percentage,
  method = "native",
  className = "",
}) => {
  const clamped = Math.max(0, Math.min(100, percentage));
  const fillColor = method === "native" ? "bg-[var(--verdigris)]" : "bg-[var(--ochre)]";

  return (
    <div
      className={`inline-flex items-center w-24 h-1 bg-[var(--ink-600)] rounded-[2px] overflow-hidden ${className}`}
      title={`Quality: ${clamped}% (${method})`}
    >
      <div
        style={{ width: `${clamped}%` }}
        className={`h-full ${fillColor} transition-all duration-[240ms] ease-out rounded-[2px]`}
      />
    </div>
  );
};
