import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMotionGovernor } from "../../motion";
import { transitionNavigate } from "../../motion/navigation";
import { BASE_URL } from "../../api/client";

interface HealthState {
  online: boolean;
  latencyMs: number | null;
  allowApi: boolean;
}

interface StatusStripProps {
  backendOnline?: boolean;
}

export const StatusStrip: React.FC<StatusStripProps> = ({ backendOnline = true }) => {
  const location = useLocation();
  const path = location.pathname;

  const [health, setHealth] = useState<HealthState>({
    online: backendOnline,
    latencyMs: null,
    allowApi: true,
  });
  const [probeTick, setProbeTick] = useState(0);

  // Probe live backend /api/health and measure real client latency
  useEffect(() => {
    let mounted = true;
    if (!backendOnline) {
      setHealth((prev) => ({
        ...prev,
        online: false,
        latencyMs: null,
      }));
      return;
    }
    const checkHealth = async () => {
      const startTime = performance.now();
      try {
        const res = await fetch(`${BASE_URL}/api/health`, {
          signal: AbortSignal.timeout(8000),
        });
        const duration = Math.round(performance.now() - startTime);
        if (res.ok && mounted) {
          const data = await res.json();
          setHealth({
            online: true,
            latencyMs: duration,
            allowApi: data.allow_api ?? true,
          });
          setProbeTick((t) => t + 1);
        }
      } catch {
        if (mounted) {
          setHealth((prev) => ({
            ...prev,
            online: false,
            latencyMs: null,
          }));
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [backendOnline]);

  // Motion Governor tier chip (§M0 Amendment A3, §M4.4)
  const MotionTierChip = () => {
    const motion = useMotionGovernor();
    const navigate = useNavigate();

    return (
      <div
        onClick={() => transitionNavigate(navigate, "/settings", { direction: "forward" })}
        className="flex items-center gap-1 cursor-pointer hover:text-[var(--bone)] transition-colors group"
        title={`Motion Tier: ${motion.tier} (${motion.mode} mode${motion.reducedMotion ? ", reduced-motion locked" : ""}). Open Settings to configure.`}
      >
        <span className="text-[var(--dim)] group-hover:text-[var(--bone)] type-mono-sm">
          motion {motion.tier}{motion.mode === "manual" ? " · manual" : ""}
        </span>
      </div>
    );
  };

  // Middle segments: only values the app can actually measure (health probe, motion governor).
  const renderMiddleSegments = () => (
    <div className="flex items-center gap-4">
      {path === "/upload" && health.online && (
        <>
          <span className="text-[var(--bone)]">Ingestion service ready</span>
          <span className="text-[var(--line-strong)]" aria-hidden="true">|</span>
        </>
      )}
      <div className="flex items-center gap-1.5" title={`Probe #${probeTick}`}>
        <span className="text-[var(--dim)]">Latency</span>
        <span key={probeTick} className="text-[var(--bone)] type-mono animate-fade-in font-medium">
          {health.latencyMs ? `${health.latencyMs} ms` : "not measured"}
        </span>
      </div>
      <span className="text-[var(--line-strong)]" aria-hidden="true">|</span>
      <MotionTierChip />
    </div>
  );

  // Right: privacy statement (Local mode).
  const renderRightControls = () => (
    <div className="flex items-center gap-3 text-[var(--dim)]">
      <div className="flex items-center gap-1">
        <svg className="w-3 h-3 text-[var(--verdigris)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <span>Local mode</span>
      </div>
    </div>
  );

  return (
    <footer
      className="h-10 px-3 sm:px-4 bg-[var(--color-bg)] border-t-2 border-[var(--color-divider)] whitespace-nowrap overflow-hidden flex items-center justify-between type-mono-sm select-none flex-shrink-0 z-30"
    >
      {/* Left: System indicator + Status + allow_api status */}
      <div data-boot-target="status-led" className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`block w-[10px] h-[10px] flex-shrink-0 ${health.online ? "bg-[var(--color-text)]" : "bg-[var(--color-accent)]"}`}
        />
        <span className={health.online ? "text-[var(--bone)]" : "text-[var(--accent)] font-semibold"}>
          {health.online ? "System online" : "System offline"}
        </span>
        {!health.allowApi && (
          <>
            <span className="text-[var(--line-strong)]">|</span>
            <span className="text-[var(--dim)] text-[12px]">AI explanations off</span>
          </>
        )}
      </div>

      {/* Middle: Screen-specific telemetry segments */}
      <div data-boot-target="status-segment" className="hidden md:flex items-center">
        {renderMiddleSegments()}
      </div>

      {/* Right: Local mode */}
      <div className="hidden sm:flex items-center">
        {renderRightControls()}
      </div>
    </footer>
  );
};
