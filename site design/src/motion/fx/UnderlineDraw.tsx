import React from "react";
import { governor } from "../quality";
import { isReducedMotion } from "../features";

export interface UnderlineDrawProps {
  children: React.ReactNode;
  color?: string; // Default: var(--cornflower)
  delayMs?: number; // Default: 0ms (40ms stagger per §M7.4)
  className?: string;
  testId?: string;
}

/**
 * UnderlineDraw — Precision evidence term underline (§M4.7, §M5.3, §M7.4)
 * Draws a hairline rule origin-left via scaleX on citation event.
 * At T0 or reduced motion, renders static 100% scaleX without animation (§M11).
 */
export const UnderlineDraw: React.FC<UnderlineDrawProps> = ({
  children,
  color = "var(--cornflower)",
  delayMs = 0,
  className = "",
  testId = "underline-draw",
}) => {
  const tier = governor.getState().tier;
  const isReduced = tier === "T0" || isReducedMotion();

  return (
    <span
      className={`relative inline-block ${className}`}
      data-testid={testId}
    >
      <span>{children}</span>
      <span
        className={`absolute left-0 bottom-0 w-full h-[1.5px] pointer-events-none origin-left ${
          isReduced ? "" : "animate-underline-draw"
        }`}
        style={{
          backgroundColor: color,
          animationDelay: isReduced ? "0ms" : `${delayMs}ms`,
          transform: isReduced ? "scaleX(1)" : undefined,
        }}
        data-delay-ms={delayMs}
      />
    </span>
  );
};
