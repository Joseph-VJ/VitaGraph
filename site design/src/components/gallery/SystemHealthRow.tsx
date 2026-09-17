import React, { useEffect, useRef, useState } from "react";
import { LED, type LEDColor } from "./LED";
import { Odometer, Sequence } from "../../motion";
import { governor, isReducedMotion } from "../../motion";

export type HealthStatus = "ok" | "live" | "disabled" | "error";

interface SystemHealthRowProps {
  name: string;
  status: HealthStatus;
  statusLabel?: string;
  latency?: string;
  className?: string;
  staggerIndex?: number;
  igniteDelay?: number;
}

export const SystemHealthRow: React.FC<SystemHealthRowProps> = ({
  name,
  status,
  statusLabel,
  latency,
  className = "",
  staggerIndex,
  igniteDelay = 0,
}) => {
  const getStatusConfig = (s: HealthStatus): { color: LEDColor; live: boolean; label: string; textClass: string } => {
    switch (s) {
      case "ok":
        return { color: "verdigris", live: false, label: "ok", textClass: "text-[var(--verdigris)]" };
      case "live":
        return { color: "verdigris", live: true, label: "live", textClass: "text-[var(--verdigris)]" };
      case "disabled":
        return { color: "ochre", live: false, label: "disabled by policy", textClass: "text-[var(--ochre)]" };
      case "error":
        return { color: "madder", live: false, label: "error", textClass: "text-[var(--madder)]" };
    }
  };

  const config = getStatusConfig(status);
  const ledRef = useRef<HTMLDivElement | null>(null);
  const [latencyActive, setLatencyActive] = useState<boolean>(false);

  const isT0 = governor.getState().tier === "T0" || isReducedMotion();
  const staggerDelayMs = staggerIndex !== undefined ? Math.min(staggerIndex * 24, 240) : 0;

  // LED ignite animation 120ms before latency odometer (§M7.1)
  useEffect(() => {
    if (isT0) {
      setLatencyActive(true);
      return;
    }

    const seq = new Sequence();
    if (igniteDelay > 0) {
      seq.wait(igniteDelay);
    }
    seq.addAction(() => {
      if (ledRef.current) {
        ledRef.current.animate(
          [
            { opacity: 0, transform: "scale(0.6)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: 180, easing: "cubic-bezier(0.30, 0.80, 0.20, 1)", fill: "forwards" }
        );
      }
    });
    seq.wait(120);
    seq.addAction(() => {
      setLatencyActive(true);
    });
    seq.play();

    return () => {
      seq.cancel();
    };
  }, [igniteDelay, isT0]);

  // Parse latency number if present (e.g. "18 ms" -> 18)
  const latencyMatch = latency ? latency.match(/^(\d+)\s*(ms)?$/) : null;
  const numericLatency = latencyMatch ? parseInt(latencyMatch[1], 10) : null;

  return (
    <div
      style={staggerIndex !== undefined ? { animationDelay: `${staggerDelayMs}ms` } : undefined}
      className={`flex items-center justify-between py-2 border-b border-[var(--line-faint)] last:border-b-0 m-enter ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <div ref={ledRef}>
          <LED color={config.color} live={config.live} />
        </div>
        <span className="type-body text-[var(--bone)]">{name}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`type-label ${config.textClass}`}>
          {statusLabel || config.label}
        </span>
        <span className="type-mono-sm text-[var(--dim)] w-14 text-right">
          {numericLatency !== null && latencyActive ? (
            <>
              <Odometer value={numericLatency} duration={480} /> ms
            </>
          ) : (
            latency || "—"
          )}
        </span>
      </div>
    </div>
  );
};
