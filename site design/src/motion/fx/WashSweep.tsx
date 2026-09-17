import React from "react";
import { governor } from "../quality";
import { isReducedMotion } from "../features";

export interface WashSweepProps {
  color?: string; // Default: var(--madder)
  className?: string;
  active?: boolean;
  testId?: string;
}

/**
 * WashSweep — Single-pass state wash (§M4.7, §M5.4)
 * Runs once on mount/trigger across the affected card.
 * scaleX 0 -> 1 -> 0 at 8% alpha in the state color. Never loops (§M3.7).
 * At T0 or reduced motion, bypassed completely (§M11).
 */
export const WashSweep: React.FC<WashSweepProps> = ({
  color = "var(--madder)",
  className = "",
  active = true,
  testId = "wash-sweep",
}) => {
  const tier = governor.getState().tier;
  const isReduced = tier === "T0" || isReducedMotion();

  if (!active || isReduced) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden z-10 ${className}`}
      aria-hidden="true"
      data-testid={testId}
    >
      <div
        className="w-full h-full animate-wash-sweep"
        style={{ backgroundColor: color }}
      />
    </div>
  );
};
