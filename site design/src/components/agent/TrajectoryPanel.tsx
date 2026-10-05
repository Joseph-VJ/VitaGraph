import React, { useEffect, useState } from "react";
import type { AgentEntry, TrajectoryItem } from "../../hooks/useAgentChat";

const RAW_LIMIT = 4000;

const markerColor = (status: TrajectoryItem["status"]): string =>
  status === "running" ? "var(--color-accent)" : status === "failed" ? "var(--color-accent-700)" : "var(--color-text)";

const Marker: React.FC<{ status: TrajectoryItem["status"] }> = ({ status }) => (
  <span
    aria-hidden="true"
    style={{
      display: "block",
      width: 12,
      height: 12,
      flex: "none",
      boxSizing: "border-box",
      border: `2px solid ${markerColor(status)}`,
      background: status === "failed" ? "transparent" : markerColor(status),
    }}
  />
);

const labelStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-neutral-700)",
};

const valueStyle: React.CSSProperties = { fontSize: "1.125rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" };

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-3)",
  padding: "var(--space-1) 0",
  fontSize: "0.875rem",
};

function formatValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

// A clock that only runs while the agent is working, and is always cleared.
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

const ToolCard: React.FC<{ item: TrajectoryItem }> = ({ item }) => {
  const [raw, setRaw] = useState(false);
  const args = Object.entries(item.args ?? {}).filter(([, value]) => value !== "" && value !== null && value !== undefined);
  const rawText = item.result ? JSON.stringify(item.result, null, 2).slice(0, RAW_LIMIT) : "";
  return (
    <div
      data-testid="agent-tool-card"
      style={{ border: "1px solid var(--color-divider)", background: "var(--color-surface)", padding: "var(--space-3)", marginTop: "var(--space-1)" }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 800 }}>{item.label}</span>
        <span style={labelStyle}>
          {item.tool}
          {item.durationMs !== null && item.durationMs !== undefined ? ` · ${item.durationMs} ms` : ""}
        </span>
      </div>
      {args.length > 0 ? (
        <div style={{ marginTop: "var(--space-2)" }}>
          <div style={labelStyle}>Arguments</div>
          {args.map(([key, value]) => (
            <div key={key} style={{ overflowWrap: "anywhere" }}>
              <span style={{ fontWeight: 800 }}>{key}</span>: {formatValue(value)}
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ marginTop: "var(--space-2)" }}>
        <div style={labelStyle}>Result</div>
        <div style={{ overflowWrap: "anywhere", color: item.status === "failed" ? "var(--color-accent-700)" : "var(--color-text)" }}>
          {item.status === "running" ? "Waiting for the result" : item.detail || "Done"}
        </div>
      </div>
      {item.result ? (
        <div style={{ marginTop: "var(--space-2)" }}>
          <button
            type="button"
            data-testid="agent-raw-toggle"
            aria-expanded={raw}
            onClick={() => setRaw(!raw)}
            style={{
              appearance: "none",
              cursor: "pointer",
              border: 0,
              padding: 0,
              background: "transparent",
              color: "var(--color-accent-700)",
              fontSize: "0.8125rem",
              fontWeight: 800,
            }}
          >
            {raw ? "Hide raw result" : "Show raw result"}
          </button>
          {raw ? (
            <pre
              data-testid="agent-raw"
              style={{
                margin: "var(--space-2) 0 0",
                fontFamily: "inherit",
                fontSize: "0.8125rem",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                maxHeight: 280,
                overflow: "auto",
              }}
            >
              {rawText}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const Cell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ padding: "var(--space-2) var(--space-4) var(--space-2) 0", minWidth: 0 }}>
    <div style={labelStyle}>{label}</div>
    <div style={valueStyle}>{value}</div>
  </div>
);

export const TrajectoryPanel: React.FC<{ entry: AgentEntry }> = ({ entry }) => {
  const [toggled, setToggled] = useState<boolean | null>(null);
  const streaming = entry.status === "streaming";
  const now = useNow(streaming);
  if (entry.trajectory.length === 0 && !streaming) return null;

  const open = toggled ?? streaming;
  const steps = entry.stats?.steps ?? entry.trajectory.filter((i) => i.kind === "step").length;
  const toolCalls = entry.stats?.toolCalls ?? entry.trajectory.filter((i) => i.kind === "tool").length;
  const elapsedMs = streaming ? now - entry.startedAt : entry.stats?.elapsedMs ?? (entry.endedAt ?? entry.startedAt) - entry.startedAt;
  const seconds = (Math.max(0, elapsedMs) / 1000).toFixed(1);
  const stepsText = steps === 1 ? "1 step" : `${steps} steps`;
  const callsText = toolCalls === 1 ? "1 tool call" : `${toolCalls} tool calls`;
  const label = streaming ? "Working" : `Worked for ${seconds} s · ${stepsText} · ${callsText}`;
  const hasIn = entry.stats?.inputTokens !== null && entry.stats?.inputTokens !== undefined;
  const hasOut = entry.stats?.outputTokens !== null && entry.stats?.outputTokens !== undefined;
  const tokensVal = hasIn && hasOut
    ? `${entry.stats!.inputTokens} in · ${entry.stats!.outputTokens} out`
    : hasIn
    ? `${entry.stats!.inputTokens} in`
    : hasOut
    ? `${entry.stats!.outputTokens} out`
    : null;

  return (
    <div style={{ border: "2px solid var(--color-divider)", marginBottom: "var(--space-4)" }} data-testid="agent-trajectory">
      <button
        type="button"
        onClick={() => setToggled(!open)}
        aria-expanded={open}
        style={{
          appearance: "none",
          width: "100%",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "var(--space-2) var(--space-4)",
          border: 0,
          background: "transparent",
          color: "var(--color-text)",
          fontSize: "0.9375rem",
          fontWeight: 800,
        }}
      >
        <span>{label}</span>
        <span style={{ color: "var(--color-accent-700)", fontSize: "0.8125rem" }}>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div style={{ borderTop: "2px solid var(--color-divider)" }}>
          <div
            data-testid="agent-stats"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", padding: "0 var(--space-4)", borderBottom: "1px solid var(--color-divider)" }}
          >
            <Cell label="Steps" value={String(steps)} />
            <Cell label="Tool calls" value={String(toolCalls)} />
            <Cell label="Time" value={`${seconds} s`} />
            {tokensVal ? <Cell label="Tokens" value={tokensVal} /> : null}
          </div>
          <div style={{ padding: "var(--space-2) var(--space-4)" }}>
            {entry.trajectory.map((item) => (
              <div key={item.id} data-row={item.kind} style={rowStyle}>
                <span style={{ display: "flex", paddingTop: 3 }}>
                  <Marker status={item.status} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  {item.kind === "tool" ? (
                    <ToolCard item={item} />
                  ) : item.kind === "step" ? (
                    <span style={labelStyle}>{item.label}</span>
                  ) : (
                    <>
                      <span style={{ fontWeight: 800 }}>{item.label}</span>
                      {item.detail.trim() ? (
                        <span
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            color: "var(--color-neutral-700)",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {item.detail.trim()}
                        </span>
                      ) : null}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
