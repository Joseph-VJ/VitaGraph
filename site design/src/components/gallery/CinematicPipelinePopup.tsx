import React, { useEffect } from "react";
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
  filename: string;
  jobStream: UseJobStreamReturn;
}

export const CinematicPipelinePopup: React.FC<CinematicPipelinePopupProps> = ({
  isOpen,
  onClose,
  onContinueToLibrary,
  filename,
  jobStream,
}) => {
  const isT0 = governor.getState().tier === "T0" || isReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (jobStream.status === "completed" || jobStream.status === "error")) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, jobStream.status, onClose]);

  if (!isOpen) return null;

  const isCompleted = jobStream.status === "completed";
  const isError = jobStream.status === "error";
  const stage = jobStream.currentStage || "received";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cinematic-popup-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--ink-950)]/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-2xl rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--line-faint)] bg-[var(--ink-900)]/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-[var(--r-6)] bg-[var(--verdigris)]/10 border border-[var(--verdigris)]/30 flex items-center justify-center text-[var(--verdigris)] flex-shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 id="cinematic-popup-title" className="type-title text-[var(--bone)] text-[15px] truncate">
                {isCompleted
                  ? "Document Ingestion Complete"
                  : isError
                  ? "Pipeline Processing Interrupted"
                  : "Ingesting Clinical Document"}
              </h2>
              <div className="type-mono-sm text-[var(--dim)] text-[12px] truncate">
                {filename || "Clinical Report PDF"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            {jobStream.activeJobId && (
              <span className="type-mono-sm text-[11px] text-[var(--faint)] hidden sm:inline-block">
                {jobStream.activeJobId}
              </span>
            )}
            <Badge variant={isCompleted ? "verdigris" : isError ? "madder" : "ochre"}>
              {isCompleted ? "Verified" : isError ? "Failed" : "Streaming live"}
            </Badge>
          </div>
        </div>

        {/* Cinematic Visual Stage: Storytelling extracting data from paper */}
        <div className="relative p-6 bg-gradient-to-b from-[var(--ink-900)]/40 to-[var(--ink-850)] flex flex-col items-center justify-center min-h-[220px] overflow-hidden border-b border-[var(--line-faint)]">
          {/* Background Grid Accent */}
          <div className="absolute inset-0 bg-[radial-gradient(#79b8a6_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.07] pointer-events-none" />

          {/* Central Animated Story Canvas */}
          <div className="relative z-10 w-full max-w-md flex flex-col items-center">
            {/* Visual Paper Simulation Box */}
            <div className="relative w-64 h-36 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] p-4 shadow-inner flex flex-col justify-between overflow-hidden">
              {/* Paper Scanning Line */}
              {!isCompleted && !isError && !isT0 && (
                <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--verdigris)] to-transparent shadow-[0_0_8px_var(--verdigris)] animate-scanline pointer-events-none" />
              )}

              {/* Header row of paper */}
              <div className="flex items-center justify-between border-b border-[var(--line-faint)] pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--verdigris)]" />
                  <span className="type-mono-sm text-[10px] text-[var(--bone)]">
                    {stage === "received"
                      ? "VERIFYING FORMAT"
                      : stage === "extracted"
                      ? "EXTRACTING TOKENS"
                      : stage === "chunked"
                      ? "SEGMENTING CHUNKS"
                      : stage === "embedded"
                      ? "GENERATING VECTORS"
                      : stage === "indexed"
                      ? "BUILDING CHROMA INDEX"
                      : stage === "graphed"
                      ? "MAPPING KNOWLEDGE GRAPH"
                      : "INDEXED & LINKED"}
                  </span>
                </div>
                <span className="type-mono-sm text-[10px] text-[var(--dim)]">
                  {jobStream.eventCount} evt
                </span>
              </div>

              {/* Dynamic stage visuals */}
              <div className="py-2 flex-1 flex flex-col justify-center">
                {stage === "received" && (
                  <div className="flex flex-col items-center justify-center gap-1.5 text-center">
                    <span className="type-meta text-[11px] text-[var(--dim)]">Validating PDF header & structure</span>
                    <div className="w-32 h-1 bg-[var(--ink-700)] rounded overflow-hidden">
                      <div className="w-full h-full bg-[var(--verdigris)] animate-pulse" />
                    </div>
                  </div>
                )}

                {stage === "extracted" && (
                  <div className="space-y-1.5">
                    <div className="h-2 w-3/4 bg-[var(--verdigris)]/30 rounded animate-pulse" />
                    <div className="h-2 w-full bg-[var(--ink-700)] rounded" />
                    <div className="h-2 w-5/6 bg-[var(--verdigris)]/40 rounded animate-pulse" />
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
                  <div className="flex items-center justify-center gap-1 py-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div
                        key={i}
                        className="w-2 rounded bg-[var(--verdigris)] transition-all duration-200"
                        style={{
                          height: `${12 + (i % 4) * 6}px`,
                          opacity: 0.4 + (i % 3) * 0.3,
                        }}
                      />
                    ))}
                  </div>
                )}

                {stage === "indexed" && (
                  <div className="flex items-center justify-center gap-2">
                    <div className="relative flex items-center justify-center">
                      <PulseRing color="verdigris" />
                      <div className="w-3 h-3 rounded-full bg-[var(--verdigris)]" />
                    </div>
                    <span className="type-meta text-[11.5px] text-[var(--bone)]">
                      Persisting to vector store
                    </span>
                  </div>
                )}

                {(stage === "graphed" || stage === "done") && !isError && (
                  <div className="flex items-center justify-center">
                    <svg className="w-32 h-16" viewBox="0 0 120 60">
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

                {isError && (
                  <div className="text-center p-2 text-[var(--madder)] type-mono-sm text-[11px]">
                    Document rejected by safety / integrity policy
                  </div>
                )}
              </div>

              {/* Bottom status line */}
              <div className="pt-1.5 border-t border-[var(--line-faint)] flex items-center justify-between text-[10px] text-[var(--dim)]">
                <span className="truncate max-w-[160px]">
                  {jobStream.latestEvent?.description || "Processing stream…"}
                </span>
                <span className="type-mono-sm">
                  {isCompleted ? "384-dim" : jobStream.latestEvent?.latency || "live"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 6-Stage Stepper inside modal */}
        <div className="p-6 bg-[var(--ink-800)] border-b border-[var(--line-faint)]">
          <PipelineStepper steps={jobStream.steps} />
        </div>

        {/* Live Event Ticker / Error Display */}
        <div className="p-4 bg-[var(--ink-900)]/70 px-6">
          {isError ? (
            <div className="p-3 rounded-[var(--r-6)] bg-[var(--madder)]/15 border border-[var(--madder)]/40 text-[var(--madder)] text-[12.5px] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--madder)] animate-pulse flex-shrink-0" />
              <span>{jobStream.error || "Processing failed. File has been quarantined."}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between type-meta text-[12px] text-[var(--dim)]">
              <div className="flex items-center gap-2 truncate">
                <span className={`w-2 h-2 rounded-full ${isCompleted ? "bg-[var(--verdigris)]" : "bg-[var(--ochre)] animate-pulse"} flex-shrink-0`} />
                <span className="text-[var(--bone)] font-medium">
                  {isCompleted
                    ? `Processed ${jobStream.finalMetadata?.pages || 1} page(s), ${jobStream.finalMetadata?.chunks || 1} chunk(s)`
                    : jobStream.latestEvent?.description || "Awaiting pipeline worker..."}
                </span>
              </div>
              <span className="type-mono-sm text-[var(--faint)] text-[11px] flex-shrink-0 ml-3">
                {isCompleted ? "Pipeline verified" : "EventSource connected"}
              </span>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 px-6 bg-[var(--ink-800)] flex items-center justify-between border-t border-[var(--line-faint)]">
          <Button
            variant="ghost"
            className="text-xs h-8 px-3"
            onClick={() => {
              playDetent();
              onClose();
            }}
          >
            {isCompleted ? "Close" : isError ? "Dismiss" : "Cancel"}
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
              <span>Continue to Library</span>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Button>
          </DetentPress>
        </div>
      </div>
    </div>
  );
};
