import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GraphStage } from "./GraphStage";
import { graphApi } from "../../api/graph";
import type { GraphResponse } from "../../api/graph";
import { PipelineStepper } from "./PipelineStepper";
import { Badge } from "./Badge";
import { Button } from "./Buttons";
import { DetentPress } from "../../motion/fx/DetentPress";
import { PulseRing } from "../../motion/fx/PulseRing";
import { playDetent } from "../../motion/audio";
import { governor, isReducedMotion } from "../../motion";
import type { UseJobStreamReturn } from "../../hooks/useJobStream";

export interface CinematicPipelinePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueToLibrary?: () => void;
  /** User whose knowledge graph is shown after processing completes. */
  userId?: string;
  /** Next step after the graph: open Ask scoped to the uploaded PDF. */
  onContinueToAsk?: () => void;
  filename: string;
  jobStream: UseJobStreamReturn;
}

export const CinematicPipelinePopup: React.FC<CinematicPipelinePopupProps> = ({
  isOpen,
  onClose,
  onContinueToLibrary,
  userId,
  onContinueToAsk,
  filename,
  jobStream,
}) => {
  const isT0 = governor.getState().tier === "T0" || isReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape allowed anytime if completed, errored, or user aborts
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const [view, setView] = useState<"pipeline" | "graph">("pipeline");
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const completed = jobStream.status === "completed";

  // Reset to the pipeline view for every new job.
  useEffect(() => {
    setView("pipeline");
    setGraph(null);
    setGraphError(null);
  }, [jobStream.activeJobId]);

  // When processing finishes, load the real graph (it now includes this report) and show it.
  useEffect(() => {
    if (!isOpen || !completed || !userId) return;
    let cancelled = false;
    setGraphError(null);
    graphApi
      .getGraph(userId)
      .then((g) => {
        if (cancelled) return;
        setGraph(g);
        setView("graph");
      })
      .catch((err) => {
        if (!cancelled) setGraphError(err instanceof Error ? err.message : "Could not load the knowledge graph.");
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, completed, userId]);

  if (!isOpen) return null;

  const isCompleted = jobStream.status === "completed";
  const isError = jobStream.status === "error" || Boolean(jobStream.error);
  const stage = jobStream.currentStage || "received";

  if (view === "graph" && graph) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cinematic-popup-title"
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[rgba(40,50,58,0.55)] backdrop-blur-md ${
          !isT0 ? "animate-fade-in" : ""
        }`}
      >
        <div className="relative w-full max-w-4xl rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] shadow-[0_24px_64px_rgba(40,50,58,0.35)] overflow-hidden flex flex-col max-h-[92vh]">
          <div className="flex items-center justify-between gap-3 p-5 border-b border-[var(--line-faint)]">
            <div className="min-w-0">
              <h2 id="cinematic-popup-title" className="font-['Spectral'] font-semibold text-[var(--bone)] text-[17px] leading-tight">
                Your knowledge graph is ready
              </h2>
              <div className="type-meta truncate mt-1">
                Built from {filename || "your report"} and your earlier reports.
              </div>
              <span className="sr-only" data-testid="graph-metrics">
                {graph.metrics.total_nodes} nodes, {graph.metrics.total_edges} edges, {graph.metrics.communities_count} communities
              </span>
            </div>
            <Badge variant="verdigris">Verified</Badge>
          </div>

          <div className="overflow-y-auto p-4">
            <GraphStage graphData={graph} height="min(58vh, 540px)" />
          </div>

          <div className="p-4 px-6 bg-[var(--ink-800)] flex items-center justify-between gap-3 border-t border-[var(--line-faint)]">
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="text-xs h-8 px-3" onClick={() => { playDetent(); onClose(); }}>
                Close
              </Button>
              <Button variant="ghost" className="text-xs h-8 px-3" onClick={() => setView("pipeline")}>
                Back to pipeline
              </Button>
              {onContinueToLibrary && (
                <Button variant="ghost" className="text-xs h-8 px-3" onClick={() => { playDetent(); onContinueToLibrary(); }}>
                  Go to Library
                </Button>
              )}
            </div>
            <DetentPress>
              <Button
                variant="primary"
                className="text-xs h-9 px-5 font-semibold flex items-center gap-2"
                onClick={() => { playDetent(); (onContinueToAsk ?? onClose)(); }}
                data-testid="next-to-ask"
              >
                <span>Next: Ask your document</span>
              </Button>
            </DetentPress>
          </div>
        </div>
      </div>
      , document.body);
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cinematic-popup-title"
      aria-live="polite"
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[rgba(40,50,58,0.55)] backdrop-blur-md ${
        !isT0 ? "animate-fade-in" : ""
      }`}
    >
      {/* 3D Glass Frame */}
      <div className="relative w-full max-w-2xl rounded-[var(--r-14)] bg-[var(--ink-800)]/95 border border-[var(--line-strong)] shadow-[0_24px_64px_rgba(40,50,58,0.35),0_0_0_1px_rgba(255,255,255,0.4)_inset] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Subtle bevel line at the top */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--bone)]/20 to-transparent pointer-events-none" />

        {/* Header Bar */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--line-faint)] bg-[var(--ink-900)]/70">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-8 h-8 rounded-[var(--r-6)] flex items-center justify-center flex-shrink-0 border ${
                isError
                  ? "bg-[var(--madder)]/15 border-[var(--madder)]/40 text-[var(--madder)]"
                  : isCompleted
                  ? "bg-[var(--verdigris)]/15 border-[var(--verdigris)]/40 text-[var(--verdigris)]"
                  : "bg-[var(--ochre)]/15 border-[var(--ochre)]/40 text-[var(--ochre-ink)]"
              }`}
            >
              {isError ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <h2
                id="cinematic-popup-title"
                className="font-['Spectral'] font-semibold text-[var(--bone)] text-[16px] leading-tight truncate"
              >
                {isCompleted
                  ? "Document ingested"
                  : isError
                  ? "Processing interrupted"
                  : "Ingesting clinical document"}
              </h2>
              <div className="type-mono-sm text-[var(--dim)] text-[12px] truncate mt-0.5">
                {filename || "Clinical Report PDF"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            {jobStream.activeJobId && (
              <span className="type-mono-sm text-[12px] text-[var(--faint)] hidden sm:inline-block">
                {jobStream.activeJobId}
              </span>
            )}
            <Badge variant={isCompleted ? "verdigris" : isError ? "madder" : "ochre"}>
              {isCompleted ? "Verified" : isError ? "Failed" : "Streaming live"}
            </Badge>
          </div>
        </div>

        {/* Cinematic Visual Stage: Storytelling simulating paper extraction */}
        <div className="relative p-6 bg-gradient-to-b from-[var(--ink-900)]/60 to-[var(--ink-800)] flex flex-col items-center justify-center min-h-[220px] overflow-hidden border-b border-[var(--line-faint)]">
          {/* Subtle Grid Accent */}
          <div className="absolute inset-0 bg-[radial-gradient(#47775F_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.06] pointer-events-none" />

          {/* Central Animated Story Canvas */}
          <div className="relative z-10 w-full max-w-md flex flex-col items-center">
            {/* 3D Paper Simulation Box */}
            <div
              className={`relative w-72 h-40 rounded-[var(--r-10)] bg-[var(--ink-900)] border p-4 shadow-[inset_0_2px_12px_rgba(40,50,58,0.18),0_4px_16px_rgba(40,50,58,0.15)] flex flex-col justify-between overflow-hidden transition-colors duration-300 ${
                isError
                  ? "border-[var(--madder)]/60 bg-[var(--madder)]/[0.04]"
                  : "border-[var(--line-strong)]"
              }`}
            >
              {/* Paper Scanning Beam - Strictly respects prefers-reduced-motion */}
              {!isCompleted && !isError && !isT0 && (
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--verdigris)] to-transparent shadow-[0_0_10px_var(--verdigris)] animate-scanline pointer-events-none"
                />
              )}

              {/* Header row of simulated paper */}
              <div className="flex items-center justify-between border-b border-[var(--line-faint)] pb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isError
                        ? "bg-[var(--madder)]"
                        : isCompleted
                        ? "bg-[var(--verdigris)]"
                        : "bg-[var(--verdigris)] animate-pulse"
                    }`}
                  />
                  <span className="type-mono-sm text-[11.5px] text-[var(--bone)]">
                    {isError
                      ? "FAIL-CLOSED POLICY TRIP"
                      : stage === "received"
                      ? "Verifying format"
                      : stage === "extracted"
                      ? "Extracting text"
                      : stage === "chunked"
                      ? "Splitting into chunks"
                      : stage === "embedded"
                      ? "Creating embeddings"
                      : stage === "indexed"
                      ? "Building the search index"
                      : stage === "graphed"
                      ? "Mapping the knowledge graph"
                      : "INDEXED & LINKED"}
                  </span>
                </div>
                <span className="type-mono-sm text-[11.5px] text-[var(--dim)]">
                  {isError ? "Stopped" : `${jobStream.eventCount} evt`}
                </span>
              </div>

              {/* Dynamic stage visuals */}
              <div className="py-2 flex-1 flex flex-col justify-center">
                {isError ? (
                  <div className="flex flex-col items-center justify-center gap-1.5 text-center px-2">
                    <span className="type-label text-[var(--madder)] text-[12px] font-semibold">
                      Security & Layout Verification Rejected
                    </span>
                    <span className="type-meta text-[var(--dim)] text-[12px] leading-tight">
                      Corrupted document, missing text layer, or schema violation. File quarantined.
                    </span>
                  </div>
                ) : (
                  <>
                    {stage === "received" && (
                      <div className="flex flex-col items-center justify-center gap-1.5 text-center">
                        <span className="type-meta text-[12px] text-[var(--dim)]">Validating PDF header & structure</span>
                        <div className="w-36 h-1 bg-[var(--ink-700)] rounded overflow-hidden">
                          <div className={`w-full h-full bg-[var(--verdigris)] ${!isT0 ? "animate-pulse" : ""}`} />
                        </div>
                      </div>
                    )}

                    {stage === "extracted" && (
                      <div className="space-y-1.5">
                        <div className={`h-2 w-3/4 bg-[var(--verdigris)]/30 rounded ${!isT0 ? "animate-pulse" : ""}`} />
                        <div className="h-2 w-full bg-[var(--ink-700)] rounded" />
                        <div className={`h-2 w-5/6 bg-[var(--verdigris)]/40 rounded ${!isT0 ? "animate-pulse" : ""}`} />
                        <div className="h-2 w-1/2 bg-[var(--ink-700)] rounded" />
                      </div>
                    )}

                    {stage === "chunked" && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="p-1.5 rounded bg-[var(--ink-800)] border border-[var(--line-faint)] text-[9px] text-[var(--verdigris)] type-mono-sm truncate">
                          § 1. Diagnostic Panel
                        </div>
                        <div className="p-1.5 rounded bg-[var(--ink-800)] border border-[var(--line-faint)] text-[9px] text-[var(--verdigris)] type-mono-sm truncate">
                          § 2. Reference Range
                        </div>
                        <div className="p-1.5 rounded bg-[var(--ink-800)] border border-[var(--line-faint)] text-[9px] text-[var(--dim)] type-mono-sm truncate">
                          § 3. Patient Vitals
                        </div>
                        <div className="p-1.5 rounded bg-[var(--ink-800)] border border-[var(--line-faint)] text-[9px] text-[var(--dim)] type-mono-sm truncate">
                          § 4. Clinician Notes
                        </div>
                      </div>
                    )}

                    {stage === "embedded" && (
                      <div className="flex items-center justify-center gap-1.5 py-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                          <div
                            key={i}
                            className="w-1.5 rounded bg-[var(--verdigris)] transition-all duration-200"
                            style={{
                              height: `${10 + (i % 4) * 6}px`,
                              opacity: 0.35 + (i % 3) * 0.3,
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {stage === "indexed" && (
                      <div className="flex items-center justify-center gap-2">
                        <div className="relative flex items-center justify-center">
                          {!isT0 && <PulseRing color="verdigris" />}
                          <div className="w-3 h-3 rounded-full bg-[var(--verdigris)] shadow-[0_0_8px_var(--verdigris)]" />
                        </div>
                        <span className="type-meta text-[12px] text-[var(--bone)]">
                          Persisting to local vector store
                        </span>
                      </div>
                    )}

                    {(stage === "graphed" || stage === "done") && (
                      <div className="flex items-center justify-center">
                        <svg className="w-36 h-16" viewBox="0 0 120 60">
                          <line x1="20" y1="30" x2="60" y2="15" stroke="var(--verdigris)" strokeWidth="1.5" />
                          <line x1="60" y1="15" x2="100" y2="35" stroke="var(--verdigris)" strokeWidth="1.5" />
                          <line x1="20" y1="30" x2="60" y2="45" stroke="var(--line-strong)" strokeWidth="1.5" />
                          <line x1="60" y1="45" x2="100" y2="35" stroke="var(--line-strong)" strokeWidth="1.5" />
                          <circle cx="20" cy="30" r="5" fill="var(--verdigris)" />
                          <circle cx="60" cy="15" r="5" fill="var(--verdigris)" />
                          <circle cx="100" cy="35" r="5" fill="var(--verdigris)" />
                          <circle cx="60" cy="45" r="4" fill="var(--ink-700)" stroke="var(--dim)" />
                        </svg>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Bottom status line */}
              <div className="pt-1.5 border-t border-[var(--line-faint)] flex items-center justify-between text-[11.5px] text-[var(--dim)]">
                <span className="truncate max-w-[180px]">
                  {isError
                    ? "Execution halted"
                    : jobStream.latestEvent?.description || "Processing stream…"}
                </span>
                <span className="type-mono-sm">
                  {isError ? "error" : isCompleted ? "384-dim" : jobStream.latestEvent?.latency || "live"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 6-Stage Stepper inside modal */}
        <div className="p-6 bg-[var(--ink-800)]/80 border-b border-[var(--line-faint)]">
          <PipelineStepper steps={jobStream.steps} />
        </div>

        {/* Live Event Ticker / Error Display */}
        <div className="p-4 bg-[var(--ink-900)]/70 px-6">
          {isError ? (
            <div className="p-3.5 rounded-[var(--r-6)] bg-[var(--madder)]/15 border border-[var(--madder)]/40 text-[var(--madder)] text-[12.5px] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--madder)] flex-shrink-0 animate-pulse" />
                <span className="truncate font-medium">
                  {jobStream.error || "Corrupted document structure or unreadable text layers."}
                </span>
              </div>
              <span className="type-mono-sm text-[12px] text-[var(--madder)] opacity-80 flex-shrink-0 ml-3">
                fail-closed
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between type-meta text-[12px] text-[var(--dim)]">
              <div className="flex items-center gap-2 truncate">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCompleted
                      ? "bg-[var(--verdigris)]"
                      : "bg-[var(--ochre)]"
                  } ${!isT0 && !isCompleted ? "animate-pulse" : ""} flex-shrink-0`}
                />
                <span className="text-[var(--bone)] font-medium truncate">
                  {isCompleted
                    ? `Processed ${jobStream.finalMetadata?.pages || 1} page(s), ${
                        jobStream.finalMetadata?.chunks || 1
                      } chunk(s)`
                    : jobStream.latestEvent?.description || "Awaiting pipeline worker..."}
                </span>
              </div>
              <span className="type-mono-sm text-[var(--faint)] text-[12px] flex-shrink-0 ml-3">
                {isCompleted ? "Pipeline verified" : "EventSource connected"}
              </span>
            </div>
          )}
        </div>

        {isCompleted && userId && !graphError && !graph && (
          <div className="px-6 py-2 text-[12px] text-[var(--dim)] border-t border-[var(--line-faint)]">Building your knowledge graph view…</div>
        )}
        {graphError && (
          <div role="alert" className="px-6 py-2 text-[12px] text-[var(--madder)] border-t border-[var(--line-faint)]">
            Knowledge graph unavailable: {graphError}
          </div>
        )}

        {/* Action Footer */}
        <div className="p-4 px-6 bg-[var(--ink-800)]/90 flex items-center justify-between border-t border-[var(--line-faint)]">
          <Button
            variant="ghost"
            className="text-xs h-8 px-3"
            onClick={() => {
              playDetent();
              onClose();
            }}
          >
            {isError ? "Dismiss Failure" : isCompleted ? "Close" : "Cancel"}
          </Button>

          <DetentPress>
            <Button
              variant="primary"
              className="text-xs h-8 px-4 font-semibold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!isCompleted}
              onClick={() => {
                playDetent();
                if (onContinueToLibrary) {
                  onContinueToLibrary();
                } else {
                  onClose();
                }
              }}
            >
              <span>Continue to library</span>
            </Button>
          </DetentPress>
        </div>
      </div>
    </div>
    , document.body);
};
