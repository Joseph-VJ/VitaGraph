import React from "react";
import { governor, isReducedMotion } from "../../motion";

interface QualityBarProps {
  percentage: number; // 0 to 100
  method?: "native" | "ocr" | "ocr-rapid" | "ocr-tesseract" | "uncertain" | string;
  className?: string;
}

export const QualityBar: React.FC<QualityBarProps> = ({
  percentage,
  method = "native",
  className = "",
}) => {
  const isT0 = governor.getState().tier === "T0" || isReducedMotion();
  const clamped = Math.max(0, Math.min(100, percentage));
  const fillColor = method === "native" ? "bg-[var(--verdigris)]" : "bg-[var(--ochre)]";

  return (
    <div
      className={`inline-flex items-center w-24 h-1 bg-[var(--ink-600)] rounded-[2px] overflow-hidden ${className}`}
      title={`Quality: ${clamped}% (${method})`}
    >
      <div
        style={{
          transform: `scaleX(${clamped / 100})`,
          transformOrigin: "left",
          transition: !isT0
            ? "transform var(--m-deliberate, 360ms) var(--ease-servo, cubic-bezier(0.32, 0, 0.24, 1))"
            : "none",
        }}
        className={`w-full h-full ${fillColor} rounded-[2px] ${!isT0 ? "animate-bar-settle" : ""}`}
      />
    </div>
  );
};
