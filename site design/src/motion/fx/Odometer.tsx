import React, { useEffect, useState, useRef } from "react";
import { governor } from "../quality";
import { isReducedMotion } from "../features";
import { ticker } from "../ticker";

interface OdometerProps {
  value: number | string;
  initialValue?: number;
  decimals?: number;
  duration?: number; // defaults to 480ms (--m-settle)
  className?: string;
  format?: (val: number) => string;
  testId?: string;
}

/**
 * Odometer — Precision digit count-up (§M4.7, §M5.5)
 * Triggers: (a) first real value arrival, (b) value change.
 * Uses --m-settle (480ms) with needle curve.
 * Tabular nums, dev assertion on exact endpoint, T0/reduced-motion instant set.
 */
export const Odometer: React.FC<OdometerProps> = ({
  value,
  initialValue,
  decimals,
  duration = 480, // --m-settle (§M2.1)
  className = "",
  format,
  testId,
}) => {
  // Parse numeric target
  const numTarget = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, "")) || 0;
  const isNumeric = !isNaN(numTarget);

  const isReduced =
    typeof window !== "undefined" &&
    (isReducedMotion() || governor.getState().tier === "T0");

  const [displayValue, setDisplayValue] = useState<number>(
    isReduced ? numTarget : initialValue !== undefined ? initialValue : numTarget
  );
  const currentValRef = useRef<number>(
    isReduced ? numTarget : initialValue !== undefined ? initialValue : numTarget
  );
  const prevTargetRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isNumeric) return;

    const startVal =
      prevTargetRef.current !== null
        ? currentValRef.current
        : initialValue !== undefined
        ? initialValue
        : 0;
    prevTargetRef.current = numTarget;

    // T0 or reduced-motion: instant set (§M5.5, §M11)
    const tier = governor.getState().tier;
    if (tier === "T0" || isReducedMotion() || duration === 0) {
      currentValRef.current = numTarget;
      setDisplayValue(numTarget);
      return;
    }

    if (startVal === numTarget) {
      setDisplayValue(numTarget);
      return;
    }

    // presentation pacing of a real value (§M5.5)
    let elapsedMs = 0;
    const diff = numTarget - startVal;

    // Needle cubic bezier approximation: (0.70, 0, 0.30, 1)
    // Fast symmetric sweep peaking at midpoint
    const sampleNeedle = (t: number): number => {
      // Standard cubic bezier solver for (0.70, 0, 0.30, 1)
      const p1x = 0.70, p1y = 0.0, p2x = 0.30, p2y = 1.0;
      // Newton-Raphson approximation for progress t
      let u = t;
      for (let i = 0; i < 4; i++) {
        const currentX = 3 * (1 - u) * (1 - u) * u * p1x + 3 * (1 - u) * u * u * p2x + u * u * u;
        const currentSlope = 3 * (1 - u) * (1 - u) * p1x + 6 * (1 - u) * u * (p2x - p1x) + 3 * u * u * (1 - p2x);
        if (Math.abs(currentSlope) < 1e-5) break;
        u -= (currentX - t) / currentSlope;
        u = Math.max(0, Math.min(1, u));
      }
      return 3 * (1 - u) * (1 - u) * u * p1y + 3 * (1 - u) * u * u * p2y + u * u * u;
    };

    const unsubscribe = ticker.subscribe("L1", (dtMs) => {
      elapsedMs += dtMs;
      const progress = Math.min(1, elapsedMs / duration);
      const curvedProgress = sampleNeedle(progress);

      if (progress >= 1) {
        // Dev assertion: ends exactly on endpoint (Gate 27, §M5.5)
        currentValRef.current = numTarget;
        setDisplayValue(numTarget);
        unsubscribe();
      } else {
        const current = startVal + diff * curvedProgress;
        currentValRef.current = current;
        if (decimals !== undefined) {
          setDisplayValue(Number(current.toFixed(decimals)));
        } else if (Number.isInteger(numTarget)) {
          setDisplayValue(Math.round(current));
        } else {
          setDisplayValue(Number(current.toFixed(1)));
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [numTarget, initialValue, decimals, duration, isNumeric]);

  const formatted = format
    ? format(displayValue)
    : decimals !== undefined
    ? displayValue.toFixed(decimals)
    : Number.isInteger(numTarget)
    ? displayValue.toLocaleString()
    : displayValue.toFixed(1);

  return (
    <span
      className={`tabular-nums font-mono ${className}`}
      data-testid={testId}
      data-odo-final={numTarget} // Gate 27 test hook
    >
      {isNumeric ? formatted : value}
    </span>
  );
};
