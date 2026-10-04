import React, { useState } from "react";
import type { ChatEntry, ChatStep } from "../../hooks/useChatStream";

const dotColor = (status: ChatStep["status"]): string => {
  if (status === "running") return "var(--color-accent)";
  if (status === "failed") return "var(--color-accent-700)";
  return "var(--color-text)";
};

const Dot: React.FC<{ status: ChatStep["status"] }> = ({ status }) => (
  <span
    aria-hidden="true"
    style={{
      display: "block",
      width: 12,
      height: 12,
      flex: "none",
      boxSizing: "border-box",
      border: `2px solid ${dotColor(status)}`,
      background: status === "failed" ? "transparent" : dotColor(status),
    }}
  />
);

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-3)",
  padding: "var(--space-1) 0",
  fontSize: "0.875rem",
};

export const StepsPanel: React.FC<{ entry: ChatEntry }> = ({ entry }) => {
  const [toggled, setToggled] = useState<boolean | null>(null);
  const streaming = entry.status === "streaming";
  const open = toggled ?? streaming;
  const seconds = ((entry.endedAt ?? Date.now()) - entry.startedAt) / 1000;
  const count = entry.steps.length;
  const label = streaming
    ? "Thinking"
    : `Thought for ${seconds.toFixed(1)} s · ${count === 1 ? "1 step" : `${count} steps`}`;

  return (
    <div style={{ border: "2px solid var(--color-divider)", marginBottom: "var(--space-4)" }} data-testid="ask-steps">
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
        <div style={{ borderTop: "2px solid var(--color-divider)", padding: "var(--space-2) var(--space-4)" }}>
          {entry.steps.length === 0 && streaming ? (
            <div style={rowStyle}>
              <Dot status="running" />
              <span style={{ color: "var(--color-neutral-700)" }}>Waiting for the first step</span>
            </div>
          ) : null}
          {entry.steps.map((step) => (
            <div key={step.id} style={rowStyle}>
              <span style={{ display: "flex", paddingTop: 3 }}>
                <Dot status={step.status} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 800 }}>{step.label}</span>
                {step.detail.trim() ? (
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
                    {step.detail.trim()}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
          {entry.fallbackNotice ? (
            <div style={rowStyle}>
              <span style={{ display: "flex", paddingTop: 3 }}>
                <Dot status="done" />
              </span>
              <span style={{ fontWeight: 800 }}>Switched to a backup engine</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
