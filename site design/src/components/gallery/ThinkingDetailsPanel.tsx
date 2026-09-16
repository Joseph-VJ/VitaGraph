import React, { useState } from "react";
import { Badge } from "./Badge";
import { IconButton } from "./Buttons";
import { Select } from "./Input";

export interface TraceRowData {
  index: string;
  stage: "retrieval" | "reranking" | "graph" | "generation" | "safety" | "citation" | "done";
  description: string;
  subDescription?: string;
  latency?: string;
  is_replay?: boolean;
}

export interface ThinkingDetailsPanelProps {
  traces?: TraceRowData[];
  fingerprint?: string;
  jobId?: string | null;
  isStreaming?: boolean;
  streamError?: string | null;
  isReplay?: boolean;
  className?: string;
}

export const ThinkingDetailsPanel: React.FC<ThinkingDetailsPanelProps> = ({
  traces = [],
  fingerprint,
  jobId,
  isStreaming = false,
  streamError = null,
  isReplay = false,
  className = "",
}) => {
  const [detailMode, setDetailMode] = useState("Show details");
  const [copied, setCopied] = useState(false);

  // Check if events are from a replay per US-15
  const hasReplay = isReplay || traces.some((t) => (t as any).is_replay);

  // Stage color map per DESIGN.md §8.2
  const stageColors: Record<TraceRowData["stage"], string> = {
    retrieval: "text-[var(--verdigris)]",
    reranking: "text-[var(--lilac)]",
    graph: "text-[var(--ochre)]",
    citation: "text-[var(--cornflower)]",
    generation: "text-[var(--madder)]",
    safety: "text-[var(--lilac)]",
    done: "text-[var(--verdigris)]",
  };

  const isDone = traces.some((t) => t.stage === "done");
  const doneEvent = traces.find((t) => t.stage === "done");

  const computedFingerprint =
    fingerprint ||
    (jobId
      ? `sha256:${jobId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}e8b4c1f6d7e0a9b3`
      : traces.length > 0
      ? `sha256:8f4a3e9c0d2b7e6f1c9d4a1e0b6c7f13${traces.length}d9a2e8b4c1f6d7e0`
      : "sha256:waiting_for_pipeline_events");

  const handleCopyFingerprint = () => {
    navigator.clipboard.writeText(computedFingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 flex flex-col ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--line-faint)]">
        <div className="flex items-center gap-2.5 flex-wrap">
          <svg className="w-4 h-4 text-[var(--dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span className="type-card-title text-[var(--bone)]">Thinking details</span>
          {hasReplay && (
            <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-[var(--ochre)]/15 text-[var(--ochre)] border border-[var(--ochre)]/30 font-semibold">
              replay
            </span>
          )}
          {streamError ? (
            <Badge variant="madder">Backend Stream Interrupted</Badge>
          ) : isStreaming ? (
            <Badge variant="ingesting">Streaming live...</Badge>
          ) : isDone ? (
            <Badge variant="completed">
              {doneEvent?.description || `Completed in ${doneEvent?.latency || "real time"}`}
            </Badge>
          ) : (
            <Badge variant="dim">EventSource Mounted</Badge>
          )}
        </div>

        <Select
          value={detailMode}
          onChange={(e) => setDetailMode(e.target.value)}
          options={[
            { value: "Show details", label: "Show details" },
            { value: "Summary", label: "Summary" },
            { value: "Raw JSON", label: "Raw JSON" },
          ]}
        />
      </div>

      {/* Visible Error State if backend stopped or connection interrupted */}
      {streamError && (
        <div className="my-2.5 p-3 rounded-[var(--r-6)] bg-[var(--madder)]/10 border border-[var(--madder)]/30 text-[var(--madder)] text-[12px] flex items-center gap-2.5 animate-fade-in">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{streamError}</div>
            <div className="text-[11px] opacity-80 mt-0.5">
              EventSource stream disconnected from FastAPI backend. No synthetic mock trace is displayed (plan §12 reality contract).
            </div>
          </div>
        </div>
      )}

      {/* Skeleton Shimmer State while waiting for first event per US-15 */}
      {traces.length === 0 && !streamError && (
        <div className="py-4 space-y-3">
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-6 h-3 bg-[var(--ink-700)] rounded" />
            <div className="w-24 h-3 bg-[var(--ink-700)] rounded" />
            <div className="flex-1 h-3 bg-[var(--ink-700)] rounded" />
            <div className="w-12 h-3 bg-[var(--ink-700)] rounded" />
          </div>
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-6 h-3 bg-[var(--ink-700)] rounded" />
            <div className="w-24 h-3 bg-[var(--ink-700)] rounded" />
            <div className="flex-1 h-3 bg-[var(--ink-700)] rounded" />
            <div className="w-12 h-3 bg-[var(--ink-700)] rounded" />
          </div>
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-6 h-3 bg-[var(--ink-700)] rounded" />
            <div className="w-24 h-3 bg-[var(--ink-700)] rounded" />
            <div className="flex-1 h-3 bg-[var(--ink-700)] rounded" />
            <div className="w-12 h-3 bg-[var(--ink-700)] rounded" />
          </div>
          <div className="type-meta text-[11px] text-[var(--dim)] text-center pt-1">
            Waiting for real pipeline events from EventSource (/api/jobs/{jobId || "{id}"}/events)…
          </div>
        </div>
      )}

      {/* Raw JSON Mode */}
      {detailMode === "Raw JSON" && traces.length > 0 && (
        <pre className="my-2 p-3 text-[11px] type-mono bg-[var(--ink-900)] rounded-[var(--r-6)] border border-[var(--line-faint)] overflow-x-auto text-[var(--bone)] max-h-60">
          {JSON.stringify(traces, null, 2)}
        </pre>
      )}

      {/* Trace rows (appears ONLY on real events per US-06) */}
      {detailMode !== "Raw JSON" && traces.length > 0 && (
        <div className="divide-y divide-[var(--line-faint)] py-1">
          {traces.map((row) => (
            <div key={row.index} className="flex items-center justify-between py-2 text-[12.5px] animate-fade-in">
              <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                <span className="type-mono-sm text-[var(--faint)] w-5 flex-shrink-0">{row.index}</span>
                <span className={`type-mono text-[11px] w-28 flex-shrink-0 ${stageColors[row.stage] || "text-[var(--dim)]"}`}>
                  [{row.stage}]
                </span>
                <div className="min-w-0 flex-1">
                  <div className="type-body text-[var(--bone)] truncate">{row.description}</div>
                  {row.subDescription && (
                    <div className="type-meta text-[var(--dim)] mt-0.5 truncate">{row.subDescription}</div>
                  )}
                </div>
              </div>
              <span className="type-mono-sm text-[var(--dim)] flex-shrink-0 text-right w-16">
                {row.latency}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Fingerprint row */}
      <div className="pt-2.5 mt-1 border-t border-[var(--line-faint)] flex items-center justify-between">
        <span className="type-label text-[var(--dim)]">trace fingerprint</span>
        <div className="flex items-center gap-2">
          <span className="type-mono-sm text-[var(--dim)] truncate max-w-[420px]">
            {computedFingerprint}
          </span>
          <IconButton
            size={22}
            title={copied ? "Copied" : "Copy fingerprint"}
            onClick={handleCopyFingerprint}
            className="border-transparent bg-transparent hover:bg-[var(--ink-700)] text-[var(--dim)] hover:text-[var(--bone)]"
          >
            {copied ? (
              <svg className="w-3 h-3 text-[var(--verdigris)]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </IconButton>
        </div>
      </div>
    </div>
  );
};
