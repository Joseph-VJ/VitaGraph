import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LED } from "../gallery/LED";
import { useMotionGovernor } from "../../motion";

interface HealthState {
  online: boolean;
  latencyMs: number | null;
  configVersion: string;
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
    latencyMs: backendOnline ? 24 : null,
    configVersion: "gen-service v2 · cfg 2026-08",
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
        const res = await fetch("http://127.0.0.1:8000/api/health", {
          signal: AbortSignal.timeout(2000),
        });
        const duration = Math.round(performance.now() - startTime);
        if (res.ok && mounted) {
          const data = await res.json();
          setHealth({
            online: true,
            latencyMs: duration,
            configVersion: "gen-service v2 · cfg 2026-08",
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
        onClick={() => navigate("/settings")}
        className="flex items-center gap-1 cursor-pointer hover:text-[var(--bone)] transition-colors group"
        title={`Motion Tier: ${motion.tier} (${motion.mode} mode${motion.reducedMotion ? ", reduced-motion locked" : ""}) — Click to configure in Settings`}
      >
        <span className="text-[var(--dim)] group-hover:text-[var(--bone)] type-mono-sm">
          motion {motion.tier}{motion.mode === "manual" ? " · manual" : ""}
        </span>
      </div>
    );
  };

  // Per-screen middle segments (§5.3, §9, §M0 A3)
  const renderMiddleSegments = () => {
    switch (path) {
      case "/upload":
        return (
          <div className="flex items-center gap-3">
            <span className="text-[var(--bone)]">Ingestion service ready</span>
            <span className="text-[var(--line-strong)]">|</span>
            <MotionTierChip />
          </div>
        );
      case "/graph":
        return (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--dim)]">Indexing:</span>
              <span className="text-[var(--bone)]">12,438 chunks</span>
            </div>
            <span className="text-[var(--line-strong)]">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--dim)]">Graph updated</span>
              <span className="text-[var(--bone)]">2 min ago</span>
            </div>
            <span className="text-[var(--line-strong)]">|</span>
            <div className="flex items-center gap-1.5" title={`Probe #${probeTick}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--verdigris)] animate-pulse" />
              <span className="text-[var(--dim)]">Latency</span>
              <span key={probeTick} className="text-[var(--bone)] type-mono animate-fade-in font-medium">
                {health.latencyMs ? `${health.latencyMs} ms` : "—"}
              </span>
            </div>
            <span className="text-[var(--line-strong)]">|</span>
            <MotionTierChip />
            <span className="text-[var(--line-strong)]">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--dim)]">Service:</span>
              <span className="text-[var(--bone)]">{health.configVersion}</span>
            </div>
          </div>
        );
      case "/ask":
        return (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--dim)]">Documents</span>
              <span className="text-[var(--bone)]">12</span>
            </div>
            <span className="text-[var(--line-strong)]">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--dim)]">Chunks</span>
              <span className="text-[var(--bone)]">1,024</span>
            </div>
            <span className="text-[var(--line-strong)]">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--dim)]">Graph nodes</span>
              <span className="text-[var(--bone)]">214</span>
            </div>
            <span className="text-[var(--line-strong)]">|</span>
            <div className="flex items-center gap-1.5" title={`Probe #${probeTick}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--verdigris)] animate-pulse" />
              <span className="text-[var(--dim)]">Latency</span>
              <span key={probeTick} className="text-[var(--bone)] type-mono animate-fade-in font-medium">
                {health.latencyMs ? `${health.latencyMs} ms` : "—"}
              </span>
            </div>
            <span className="text-[var(--line-strong)]">|</span>
            <MotionTierChip />
          </div>
        );
      case "/timeline":
        return (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--dim)]">Personas</span>
              <span className="text-[var(--bone)]">1</span>
            </div>
            <span className="text-[var(--line-strong)]">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--dim)]">Reports</span>
              <span className="text-[var(--bone)]">2</span>
            </div>
            <span className="text-[var(--line-strong)]">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--dim)]">Chunks</span>
              <span className="text-[var(--bone)]">214</span>
            </div>
            <span className="text-[var(--line-strong)]">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--dim)]">Graph nodes</span>
              <span className="text-[var(--bone)]">486</span>
            </div>
            <span className="text-[var(--line-strong)]">|</span>
            <div className="flex items-center gap-1.5" title={`Probe #${probeTick}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--verdigris)] animate-pulse" />
              <span className="text-[var(--dim)]">Latency</span>
              <span key={probeTick} className="text-[var(--bone)] type-mono animate-fade-in font-medium">
                {health.latencyMs ? `${health.latencyMs} ms` : "—"}
              </span>
            </div>
            <span className="text-[var(--line-strong)]">|</span>
            <MotionTierChip />
          </div>
        );
      default: // Home & other screens
        return (
          <div className="flex items-center gap-4">
            <span className="font-['Spectral'] italic text-[var(--bone)] text-[12px]">
              “Evidence connects. People benefit.”
            </span>
            <span className="text-[var(--line-strong)]">|</span>
            <div className="flex items-center gap-1.5" title={`Probe #${probeTick}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--verdigris)] animate-pulse" />
              <span className="text-[var(--dim)]">Latency</span>
              <span key={probeTick} className="text-[var(--bone)] type-mono animate-fade-in font-medium">
                {health.latencyMs ? `${health.latencyMs} ms` : "—"}
              </span>
            </div>
            <span className="text-[var(--line-strong)]">|</span>
            <MotionTierChip />
          </div>
        );
    }
  };

  // Right telemetry / meta (§5.3)
  const renderRightControls = () => {
    if (path === "/graph") {
      return (
        <div className="flex items-center gap-3 text-[var(--dim)]">
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-[var(--verdigris)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>CPU 18%</span>
          </div>
          <span>·</span>
          <span>RAM 41%</span>
          <span>·</span>
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3 text-[var(--dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span>Local mode</span>
          </div>
        </div>
      );
    }

    if (path === "/ask") {
      return (
        <div className="flex items-center gap-3 text-[var(--dim)]">
          <span>v0.3.1</span>
          <span>·</span>
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-[var(--verdigris)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>Local mode</span>
          </div>
          <span>·</span>
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3 text-[var(--verdigris)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span>Privacy first</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 text-[var(--dim)]">
        <span>v0.3.1</span>
        <span className="text-[var(--line-strong)]">|</span>
        <a href="#" className="hover:text-[var(--bone)] transition-colors">Docs</a>
        <span className="text-[var(--line-strong)]">|</span>
        <a href="#" className="hover:text-[var(--bone)] transition-colors">Feedback</a>
        <span className="text-[var(--line-strong)]">|</span>
        <button
          title="Toggle paper theme"
          className="text-[var(--dim)] hover:text-[var(--bone)] transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </button>
      </div>
    );
  };

  return (
    <footer
      className="h-7 px-4 bg-[var(--ink-800)] border-t border-[var(--line-faint)] flex items-center justify-between type-mono-sm select-none flex-shrink-0 z-30"
    >
      {/* Left: System LED + Status + allow_api status */}
      <div className="flex items-center gap-2.5">
        <LED color={health.online ? "verdigris" : "madder"} live={health.online} />
        <span className={health.online ? "text-[var(--bone)]" : "text-[var(--madder)] font-medium"}>
          {health.online ? "System online" : "System offline"}
        </span>
        {!health.allowApi && (
          <>
            <span className="text-[var(--line-strong)]">|</span>
            <span className="text-[var(--dim)] text-[11px]">allow_api=false (Offline Core)</span>
          </>
        )}
      </div>

      {/* Middle: Screen-specific telemetry segments */}
      <div className="hidden md:flex items-center">
        {renderMiddleSegments()}
      </div>

      {/* Right: Version + links + theme toggle */}
      <div className="flex items-center">
        {renderRightControls()}
      </div>
    </footer>
  );
};
