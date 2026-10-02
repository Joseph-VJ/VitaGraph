import React, { useMemo, useState } from "react";
import type { ModelFallback, StageEvent, ThinkingLog, ToolCall } from "../../hooks/useAgentStream";

interface AgentThoughtTreeProps {
  thinkingLogs: ThinkingLog[];
  stageEvents: StageEvent[];
  toolCalls: ToolCall[];
  modelFallbacks: ModelFallback[];
  isStreaming: boolean;
  error: string | null;
  diagnostic: string | null;
}

type Node =
  | { kind: "stage"; seq: number; stage: StageEvent }
  | { kind: "thinking"; seq: number; log: ThinkingLog }
  | { kind: "tool"; seq: number; call: ToolCall };

const TOOL_LABELS: Record<string, { pending: string; done: string }> = {
  search_chroma: { pending: "🔍 Searching ChromaDB…", done: "🔍 Searched ChromaDB" },
  query_networkx_graph: { pending: "🕸️ Querying knowledge graph…", done: "🕸️ Queried knowledge graph" },
};

const RAIL_W = 20;

// Vertical rail segment: node dot on top, SVG line running to the next node.
const Rail: React.FC<{ tone: "dim" | "pending" | "done" | "failed"; last: boolean; animate: boolean }> = ({
  tone,
  last,
  animate,
}) => {
  const color =
    tone === "done" ? "var(--jade-slate)" : tone === "pending" ? "var(--solar-bronze)" : tone === "failed" ? "var(--madder)" : "var(--faint)";
  return (
    <svg width={RAIL_W} className="h-full min-h-[24px] flex-shrink-0" aria-hidden="true">
      {!last && (
        <line
          x1={RAIL_W / 2}
          y1={14}
          x2={RAIL_W / 2}
          y2="100%"
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray={tone === "dim" ? "2 3" : tone === "pending" && animate ? "4 3" : undefined}
          className={tone === "pending" && animate ? "vg-flow-line" : undefined}
          opacity={0.7}
        />
      )}
      <circle cx={RAIL_W / 2} cy={10} r={tone === "dim" ? 3 : 4.5} fill={color} stroke="var(--steel-fog)" strokeWidth={2} />
    </svg>
  );
};

const ToolCard: React.FC<{ call: ToolCall }> = ({ call }) => {
  const [open, setOpen] = useState(false);
  const labels = TOOL_LABELS[call.tool] ?? { pending: `⚙️ Running ${call.tool}…`, done: `⚙️ Ran ${call.tool}` };
  const done = call.status === "completed";
  const failed = call.status === "failed";
  const argSummary = Object.entries(call.arguments)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" · ");

  return (
    <div
      className="rounded-[var(--r-10)] bg-[var(--alloy-surface)] border border-[var(--line-strong)] p-3 shadow-[var(--shadow-3d)] m-enter"
      data-testid="tool-card"
      data-status={call.status}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-[var(--deep-petrol)]">{done || failed ? labels.done : labels.pending}</span>
        {done && (
          <svg className="w-4 h-4 text-[var(--jade-slate)] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-label="completed">
            <polyline points="4 12 10 18 20 6" />
          </svg>
        )}
        {failed && <span className="text-[11px] text-[var(--madder)] font-semibold">failed</span>}
        {!done && !failed && (
          <span className="w-3.5 h-3.5 rounded-full border-2 border-[var(--solar-bronze)] border-t-transparent animate-spin flex-shrink-0" aria-label="running" />
        )}
      </div>
      {argSummary && <div className="mt-1 text-[11px] text-[var(--dim)] truncate" title={argSummary}>{argSummary}</div>}
      {call.result !== undefined && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="text-[11px] text-[var(--deep-petrol)] underline-offset-2 hover:underline cursor-pointer"
          >
            {open ? "▾ Hide result" : "▸ Show result"}
          </button>
          {open && (
            <pre className="mt-1.5 max-h-52 overflow-auto rounded-[var(--r-6)] bg-[var(--steel-fog)]/60 border border-[var(--line-faint)] p-2 text-[10.5px] leading-[15px] text-[var(--text-main)] whitespace-pre-wrap break-words">
              {JSON.stringify(call.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export const AgentThoughtTree: React.FC<AgentThoughtTreeProps> = ({
  thinkingLogs,
  stageEvents,
  toolCalls,
  modelFallbacks,
  isStreaming,
  error,
  diagnostic,
}) => {
  const nodes = useMemo<Node[]>(() => {
    const all: Node[] = [
      ...stageEvents.map((stage): Node => ({ kind: "stage", seq: stage.id, stage })),
      ...thinkingLogs.map((log): Node => ({ kind: "thinking", seq: log.id, log })),
      ...toolCalls.map((call): Node => ({ kind: "tool", seq: call.seq, call })),
    ];
    return all.sort((a, b) => a.seq - b.seq);
  }, [stageEvents, thinkingLogs, toolCalls]);

  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <aside
      aria-label="Agent telemetry"
      data-testid="agent-telemetry"
      className="w-full lg:w-[420px] flex-shrink-0 lg:sticky lg:top-0 lg:max-h-[calc(100vh-7rem)] overflow-y-auto rounded-[var(--r-14)] bg-[var(--steel-fog)] border border-[var(--line-strong)] shadow-[var(--shadow-3d)] p-4 font-mono text-[var(--deep-petrol)]"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-strong)]">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isStreaming ? "bg-[var(--solar-bronze)] animate-pulse" : error ? "bg-[var(--madder)]" : "bg-[var(--jade-slate)]"}`} />
          <span className="text-[13px] font-semibold tracking-wide uppercase">Agent Thought Tree</span>
        </div>
        <span className="text-[11px] opacity-70">{isStreaming ? "live" : error ? "halted" : nodes.length ? "settled" : "standby"}</span>
      </div>

      {modelFallbacks.map((fb) => (
        <div
          key={fb.id}
          role="status"
          className="mb-3 rounded-[var(--r-6)] border border-[var(--solar-bronze)] bg-[var(--solar-bronze)]/20 px-3 py-2 text-[11.5px] text-[#6B4510] shadow-[var(--shadow-3d-sm)]"
          data-testid="fallback-banner"
        >
          <strong className="font-semibold">⚠ Engine fallback.</strong> {fb.reason}
        </div>
      ))}

      {error && (
        <div role="alert" className="mb-3 rounded-[var(--r-6)] border border-[var(--madder)] bg-[var(--madder)]/15 px-3 py-2 text-[11.5px] text-[var(--madder)]">
          <div className="font-semibold">{error}</div>
          {diagnostic && <div className="opacity-80 mt-0.5">{diagnostic}</div>}
        </div>
      )}

      {nodes.length === 0 ? (
        <div className="py-8 text-center text-[12px] opacity-70">
          {isStreaming ? "Awaiting first signal from the agent…" : "No agent activity yet. Ask a question to watch it reason."}
        </div>
      ) : (
        <ol className="m-0 p-0 list-none">
          {nodes.map((n, i) => {
            const last = i === nodes.length - 1;
            const tone = n.kind === "thinking" || n.kind === "stage" ? "dim" : n.call.status === "completed" ? "done" : n.call.status === "failed" ? "failed" : "pending";
            return (
              <li key={`${n.kind}-${n.seq}`} className="flex gap-2.5 items-stretch">
                <Rail tone={tone} last={last && !isStreaming} animate={!reduce} />
                <div className="flex-1 min-w-0 pb-3">
                  {n.kind === "stage" ? (
                    <div className="pt-0.5 text-[11.5px] leading-[16px] text-[var(--deep-petrol)]" data-testid="stage-row">
                      <div className="flex items-baseline justify-between gap-2">
                        <span><span className="font-semibold uppercase tracking-wide">[{n.stage.stage}]</span> {n.stage.description}</span>
                        {n.stage.latency && <span className="opacity-60 flex-shrink-0">{n.stage.latency}</span>}
                      </div>
                      {n.stage.detail && <div className="opacity-70 break-words">{n.stage.detail}</div>}
                    </div>
                  ) : n.kind === "thinking" ? (
                    <p className="m-0 pt-0.5 text-[11.5px] italic leading-[17px] text-[var(--dim)] whitespace-pre-wrap break-words" data-testid="thinking-log">
                      {n.log.text}
                    </p>
                  ) : (
                    <ToolCard call={n.call} />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
};
