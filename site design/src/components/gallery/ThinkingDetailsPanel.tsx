import React, { useState } from "react";
import { Badge } from "./Badge";
import { IconButton } from "./Buttons";
import { Select } from "./Input";

export interface TraceRowData {
  index: string;
  stage: "retrieval" | "reranking" | "graph" | "generation" | "safety" | "citation" | "done";
  description: string;
  subDescription?: string;
  latency: string;
}

interface ThinkingDetailsPanelProps {
  traces?: TraceRowData[];
  fingerprint?: string;
  className?: string;
}

const defaultTraces: TraceRowData[] = [
  {
    index: "01",
    stage: "retrieval",
    description: "Retrieving relevant documents and chunks (top k = 20)",
    latency: "612 ms",
  },
  {
    index: "02",
    stage: "reranking",
    description: "Reranking with cross-encoder (bge-reranker-large)",
    latency: "1,240 ms",
  },
  {
    index: "03",
    stage: "graph",
    description: "Mapping entities to knowledge graph",
    latency: "980 ms",
  },
  {
    index: "04",
    stage: "generation",
    description: "Generating answer with evidence citations",
    latency: "1,612 ms",
  },
  {
    index: "05",
    stage: "safety",
    description: "Checking for medical safety and grounding",
    latency: "356 ms",
  },
  {
    index: "06",
    stage: "done",
    description: "Response completed",
    latency: "4.8 s",
  },
];

export const ThinkingDetailsPanel: React.FC<ThinkingDetailsPanelProps> = ({
  traces = defaultTraces,
  fingerprint = "sha256:8f4a3e9c0d2b7e6f1c9d4a1e0b6c7f13d9a2e8b4c1f6d7e0a9b3c5d8f2e6c21",
  className = "",
}) => {
  const [detailMode, setDetailMode] = useState("Show details");
  const [copied, setCopied] = useState(false);

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

  const handleCopyFingerprint = () => {
    navigator.clipboard.writeText(fingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 flex flex-col ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--line-faint)]">
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-[var(--dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span className="type-card-title text-[var(--bone)]">Thinking details</span>
          <Badge variant="completed">Completed in 4.8 s</Badge>
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

      {/* Trace rows */}
      <div className="divide-y divide-[var(--line-faint)] py-1">
        {traces.map((row) => (
          <div key={row.index} className="flex items-center justify-between py-2 text-[12.5px]">
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
              <span className="type-mono-sm text-[var(--faint)] w-5 flex-shrink-0">{row.index}</span>
              <span className={`type-mono text-[11px] w-28 flex-shrink-0 ${stageColors[row.stage]}`}>
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

      {/* Fingerprint row */}
      <div className="pt-2.5 mt-1 border-t border-[var(--line-faint)] flex items-center justify-between">
        <span className="type-label text-[var(--dim)]">trace fingerprint</span>
        <div className="flex items-center gap-2">
          <span className="type-mono-sm text-[var(--dim)] truncate max-w-[420px]">{fingerprint}</span>
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
