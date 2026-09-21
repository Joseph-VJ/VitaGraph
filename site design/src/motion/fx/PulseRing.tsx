import React, { useEffect, useState } from "react";
import { governor } from "../quality";
import { isReducedMotion } from "../features";

export interface PulseRingProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: "verdigris" | "ochre" | "madder" | "cornflower" | "lilac";
  size?: number;
  className?: string;
  testId?: string;
  onComplete?: () => void;
}

const COLOR_MAP = {
  verdigris: "rgba(121, 184, 166, 0.7)",
  ochre: "rgba(217, 164, 65, 0.7)",
  madder: "rgba(217, 128, 141, 0.7)",
  cornflower: "rgba(134, 169, 217, 0.7)",
  lilac: "rgba(169, 146, 208, 0.7)",
};

/**
 * PulseRing primitive (§M4.7, §M8.3, WS-4)
 * Frozen 1200ms single pulse ring (never looping).
 * Scale 1 -> 1.8, opacity 0.8 -> 0 over 1200ms servo decel.
 */
export const PulseRing: React.FC<PulseRingProps> = ({
  color = "verdigris",
  size,
  className = "",
  testId,
  onComplete,
  ...props
}) => {
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const tier = governor.getState().tier;
    if (isReducedMotion() || tier === "T0") {
      setCompleted(true);
      onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setCompleted(true);
      onComplete?.();
    }, 1200);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const tier = governor.getState().tier;
  if (isReducedMotion() || tier === "T0") return null;

  const rgba = COLOR_MAP[color] || COLOR_MAP.verdigris;

  return (
    <span
      data-testid={testId || "pulse-ring"}
      data-completed={completed ? "true" : "false"}
      className={`pointer-events-none absolute -inset-2 rounded-full border ${className}`}
      style={{
        borderColor: rgba,
        width: size ? `${size}px` : undefined,
        height: size ? `${size}px` : undefined,
        animation: "pulseRingOnce 1200ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
      aria-hidden="true"
      {...props}
    />
  );
};
