import React, { useEffect, useState } from "react";
import { useHealth } from "../../lib/healthMonitor";
import { useActiveUser } from "../../context/UserContext";
import { reportsApi } from "../../api/reports";

interface HealthState {
  online: boolean;
  latencyMs: number | null;
}

interface StatusStripProps {
  backendOnline?: boolean;
}

export const StatusStrip: React.FC<StatusStripProps> = ({ backendOnline = true }) => {
  const { user } = useActiveUser();
  const [counts, setCounts] = useState<{ reports: number; chunks: number } | null>(null);

  // Latency comes from the shared health check (one request for the whole shell).
  const shared = useHealth();
  const health: HealthState = {
    online: backendOnline && shared.online,
    latencyMs: backendOnline && shared.online ? shared.latencyMs : null,
  };

  useEffect(() => {
    if (!user?.id || !backendOnline) {
      setCounts(null);
      return;
    }

    let cancelled = false;

    const fetchCounts = async () => {
      try {
        const list = await reportsApi.list(user.id);
        if (!cancelled && list) {
          const reports = list.length;
          const chunks = list.reduce((s, r) => s + (r.chunk_count ?? 0), 0);
          setCounts({ reports, chunks });
        }
      } catch {
        // on error leave previous counts
      }
    };

    fetchCounts();
    const interval = setInterval(() => {
      if (!document.hidden) void fetchCounts();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id, backendOnline]);

  return (
    <footer
      className="vg-footer flex-shrink-0 z-30 select-none"
      style={{
        height: 40, display: "flex", alignItems: "center", gap: "var(--space-6)",
        borderTop: "2px solid var(--color-divider)", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums",
        background: "var(--color-bg)", whiteSpace: "nowrap", overflow: "hidden",
      }}
    >
      <span data-boot-target="status-led" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontWeight: 800 }}>
        <span aria-hidden="true" style={{ width: 10, height: 10, display: "inline-block", background: health.online ? "var(--color-text)" : "var(--color-accent)" }} />
        {health.online ? "Backend online" : "Backend offline"}
      </span>
      <span data-boot-target="status-segment" className="hidden md:inline">
        ChromaDB · {counts ? counts.chunks : "–"} chunks
      </span>
      <span className="hidden md:inline">{counts ? counts.reports : "–"} reports</span>
      <span className="hidden md:inline" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", color: "var(--color-neutral-700)" }}>
        {health.latencyMs !== null ? `Latency ${health.latencyMs} ms` : "Latency not measured"}
      </span>
    </footer>
  );
};
