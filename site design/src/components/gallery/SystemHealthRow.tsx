import React from "react";
import { LED, type LEDColor } from "./LED";

export type HealthStatus = "ok" | "live" | "disabled" | "error";

interface SystemHealthRowProps {
  name: string;
  status: HealthStatus;
  statusLabel?: string;
  latency?: string;
  className?: string;
}

export const SystemHealthRow: React.FC<SystemHealthRowProps> = ({
  name,
  status,
  statusLabel,
  latency,
  className = "",
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

  return (
    <div
      className={`flex items-center justify-between py-2 border-b border-[var(--line-faint)] last:border-b-0 ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <LED color={config.color} live={config.live} />
        <span className="type-body text-[var(--bone)]">{name}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`type-label ${config.textClass}`}>
          {statusLabel || config.label}
        </span>
        <span className="type-mono-sm text-[var(--dim)] w-14 text-right">
          {latency || "—"}
        </span>
      </div>
    </div>
  );
};
