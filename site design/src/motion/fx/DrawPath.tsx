import React, { useEffect, useRef } from "react";
import { governor } from "../quality";
import { isReducedMotion } from "../features";

export interface DrawPathProps extends React.SVGProps<SVGPathElement> {
  d: string;
  durationMs?: number;
  easing?: string;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
  onComplete?: () => void;
}

/**
 * DrawPath primitive (§M4.7, §M5.3, WS-4)
 * Animates SVG path stroke-dashoffset from path length to 0.
 * Automatically respects prefers-reduced-motion and T0 (draws instantly).
 */
export const DrawPath: React.FC<DrawPathProps> = ({
  d,
  durationMs = 720,
  easing = "cubic-bezier(0.32, 0, 0.24, 1)",
  stroke = "currentColor",
  strokeWidth = 1.5,
  className = "",
  onComplete,
  ...props
}) => {
  const pathRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    const len = path.getTotalLength();
    const tier = governor.getState().tier;
    const reduced = isReducedMotion() || tier === "T0";

    if (reduced) {
      path.style.strokeDasharray = "none";
      path.style.strokeDashoffset = "0";
      onComplete?.();
      return;
    }

    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;

    const anim = path.animate(
      [
        { strokeDashoffset: `${len}` },
        { strokeDashoffset: "0" },
      ],
      {
        duration: durationMs,
        easing,
        fill: "forwards",
      }
    );

    anim.onfinish = () => {
      path.style.strokeDasharray = "none";
      path.style.strokeDashoffset = "0";
      onComplete?.();
    };

    return () => {
      try {
        anim.cancel();
      } catch {
        // ignore cancellation
      }
    };
  }, [d, durationMs, easing, onComplete]);

  return (
    <path
      ref={pathRef}
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="none"
      className={className}
      {...props}
    />
  );
};
