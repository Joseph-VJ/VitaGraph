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

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-3)",
  padding: "var(--space-1) 0",
  fontSize: "0.9375rem",
};

const mutedStyle: React.CSSProperties = { color: "var(--color-neutral-700)", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" };

function formatValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function seconds(ms: number | null | undefined): string {
  return `${(Math.max(0, ms ?? 0) / 1000).toFixed(1)} s`;
}

// A clock that only runs while the agent is working, and is always cleared.
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

const linkButton: React.CSSProperties = {
  appearance: "none",
  cursor: "pointer",
  border: 0,
  padding: 0,
  background: "transparent",
  color: "var(--color-accent-700)",
  fontSize: "0.8125rem",
  fontWeight: 800,
};

// One tool call: a single line while you read the feed, the arguments and raw result on request.
const ToolRow: React.FC<{ item: TrajectoryItem; now: number }> = ({ item, now }) => {
  const [open, setOpen] = useState(false);
  const args = Object.entries(item.args ?? {}).filter(([, value]) => value !== "" && value !== null && value !== undefined);
  const rawText = item.result ? JSON.stringify(item.result, null, 2).slice(0, RAW_LIMIT) : "";
  const running = item.status === "running";
  const elapsed = running && item.startedAt ? seconds(now - item.startedAt) : item.durationMs ? seconds(item.durationMs) : "";
  return (
    <div data-testid="agent-tool-card" style={{ minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "baseline" }}>
        <span style={{ fontWeight: 800 }}>{item.label}</span>
        <span style={{ ...mutedStyle, color: item.status === "failed" ? "var(--color-accent-700)" : "var(--color-neutral-700)" }}>
          {running ? "running" : item.detail || "Done"}
          {elapsed ? ` · ${elapsed}` : ""}
        </span>
        <button type="button" data-testid="agent-raw-toggle" aria-expanded={open} onClick={() => setOpen(!open)} style={linkButton}>
          {open ? "Hide details" : "Details"}
        </button>
      </div>
      {open ? (
        <div style={{ border: "1px solid var(--color-divider)", background: "var(--color-surface)", padding: "var(--space-3)", marginTop: "var(--space-1)" }}>
          <div style={labelStyle}>{item.tool}</div>
          {args.length > 0 ? (
            <div style={{ marginTop: "var(--space-2)", fontSize: "0.875rem" }}>
              {args.map(([key, value]) => (
                <div key={key} style={{ overflowWrap: "anywhere" }}>
                  <span style={{ fontWeight: 800 }}>{key}</span>: {formatValue(value)}
                </div>
              ))}
            </div>
          ) : null}
          {item.result ? (
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

const ModelRow: React.FC<{ item: TrajectoryItem; now: number }> = ({ item, now }) => {
  const running = item.status === "running";
  const parts: string[] = [];
  if (running && item.startedAt) parts.push(seconds(now - item.startedAt));
  if (item.meta?.ms) parts.push(seconds(item.meta.ms));
  if (item.meta?.firstMs) parts.push(`first words after ${seconds(item.meta.firstMs)}`);
  if (item.meta?.inputTokens != null) parts.push(`${item.meta.inputTokens} in`);
  if (item.meta?.outputTokens != null) parts.push(`${item.meta.outputTokens} out`);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "baseline" }}>
      <span style={{ fontWeight: 800 }}>{item.label}{running ? "…" : ""}</span>
      {parts.length > 0 ? <span style={mutedStyle}>{parts.join(" · ")}</span> : null}
      {item.status === "failed" && item.detail ? <span style={{ ...mutedStyle, color: "var(--color-accent-700)" }}>{item.detail}</span> : null}
    </div>
  );
};

export const TrajectoryPanel: React.FC<{ entry: AgentEntry }> = ({ entry }) => {
  const [toggled, setToggled] = useState<boolean | null>(null);
  const streaming = entry.status === "streaming";
  const now = useNow(streaming);
  if (entry.trajectory.length === 0 && !streaming) return null;

  const open = toggled ?? streaming;
  const toolCalls = entry.stats?.toolCalls ?? entry.trajectory.filter((i) => i.kind === "tool").length;
  const steps = entry.stats?.steps ?? entry.trajectory.filter((i) => i.kind === "model").length;
  const elapsedMs = streaming ? now - entry.startedAt : entry.stats?.elapsedMs ?? (entry.endedAt ?? entry.startedAt) - entry.startedAt;
  const total = seconds(elapsedMs);
  const stepsText = steps === 1 ? "1 step" : `${steps} steps`;
  const callsText = toolCalls === 1 ? "1 tool call" : `${toolCalls} tool calls`;
  const label = streaming ? `Working · ${total}` : `Thought for ${total}`;
  const detail = streaming ? "" : ` · ${stepsText} · ${callsText}`;
  const hasIn = entry.stats?.inputTokens !== null && entry.stats?.inputTokens !== undefined;
  const hasOut = entry.stats?.outputTokens !== null && entry.stats?.outputTokens !== undefined;
  const tokensVal = hasIn && hasOut
    ? `${entry.stats!.inputTokens} in · ${entry.stats!.outputTokens} out`
    : hasIn
    ? `${entry.stats!.inputTokens} in`
    : hasOut
    ? `${entry.stats!.outputTokens} out`
    : null;
  // While it works, the line says what is happening right now.
  const running = [...entry.trajectory].reverse().find((i) => i.status === "running");
  const nowText = streaming
    ? running?.kind === "tool"
      ? running.label
      : running?.kind === "model"
      ? running.label
      : running?.kind === "reasoning"
      ? "Thinking"
      : "Working"
    : "";

  return (
    <div style={{ marginBottom: "var(--space-3)" }} data-testid="agent-trajectory">
      <button
        type="button"
        onClick={() => setToggled(!open)}
        aria-expanded={open}
        style={{
          appearance: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          maxWidth: "100%",
          padding: "var(--space-1) 0",
          border: 0,
          background: "transparent",
          color: "var(--color-neutral-700)",
          fontSize: "0.875rem",
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            flex: "none",
            background: streaming ? "var(--color-accent)" : "var(--color-neutral-700)",
          }}
        />
        <span>{label}</span>
        {detail ? <span style={{ fontWeight: 600 }}>{detail}</span> : null}
        {nowText ? <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {nowText}</span> : null}
        <span aria-hidden="true" style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "none", fontWeight: 800 }}>›</span>
      </button>
      {open ? (
        <div style={{ borderLeft: "2px solid var(--color-divider)", marginLeft: 3, paddingLeft: "var(--space-4)", marginTop: "var(--space-1)" }}>
          {tokensVal ? (
            <div data-testid="agent-stats" style={{ ...mutedStyle, padding: "var(--space-1) 0" }}>
              Tokens: {tokensVal}
            </div>
          ) : null}
          <div>
            {entry.trajectory.map((item) => (
              <div key={item.id} data-row={item.kind} style={rowStyle}>
                <span style={{ display: "flex", paddingTop: 5 }}>
                  {item.kind === "note" ? <span style={{ width: 12 }} /> : <Marker status={item.status} />}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  {item.kind === "tool" ? (
                    <ToolRow item={item} now={now} />
                  ) : item.kind === "model" ? (
                    <ModelRow item={item} now={now} />
                  ) : item.kind === "note" ? (
                    <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.detail}</span>
                  ) : item.kind === "step" ? (
                    <span style={labelStyle}>{item.label}</span>
                  ) : item.kind === "reasoning" ? (
                    <>
                      <span style={labelStyle}>Thinking</span>
                      <span style={{ display: "block", color: "var(--color-neutral-700)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                        {item.detail.trim()}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontWeight: 800 }}>
                      {item.label}
                      {item.status === "running" && item.startedAt ? <span style={{ ...mutedStyle, fontWeight: 400 }}> · {seconds(now - item.startedAt)}</span> : null}
                    </span>
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
