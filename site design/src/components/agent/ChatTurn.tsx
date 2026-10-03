import React, { memo, useMemo, useState } from "react";
import { Badge } from "../gallery";
import { WashSweep } from "../../motion/fx/WashSweep";
import { PaperAnswer } from "./PaperAnswer";
import type { EvidenceCard } from "../../types";
import type { TurnTrace, TurnView } from "./chatTypes";

interface ChatTurnProps {
  turn: TurnView;
  /** True while this turn's steps are the ones shown in the activity panel. */
  stepsFocused: boolean;
  onCite: (token: string, turn: TurnView) => void;
  onAsk: (text: string) => void;
  onShowSteps: (turn: TurnView) => void;
  retrySuggestions: string[];
}

// Plain-language line for what the agent is doing right now, taken from the latest real event.
function currentStep(trace: TurnTrace): string {
  const lastTool = trace.toolCalls[trace.toolCalls.length - 1];
  if (lastTool && lastTool.status === "pending") {
    if (lastTool.tool === "search_chroma") return "Searching your reports";
    if (lastTool.tool === "query_networkx_graph") return "Checking the knowledge graph";
    return "Running a lookup";
  }
  const lastStage = trace.stageEvents[trace.stageEvents.length - 1];
  if (lastStage?.description) return lastStage.description.replace(/[.…]+$/, "");
  return trace.thinkingLogs.length ? "Reasoning over the evidence" : "Starting";
}

function stepCount(trace: TurnTrace): number {
  return trace.stageEvents.length + trace.toolCalls.length;
}

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
      className="type-meta px-2 min-h-[28px] rounded-[var(--r-4)] text-[var(--dim)] hover:text-[var(--bone)] hover:bg-[var(--ink-700)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
    >
      {copied ? "Copied" : "Copy answer"}
    </button>
  );
};

export const ChatTurn = memo(function ChatTurn({ turn, stepsFocused, onCite, onAsk, onShowSteps, retrySuggestions }: ChatTurnProps) {
  const { result, trace } = turn;
  const isRefusal = result?.status === "refused";
  const hasAnswer = !isRefusal && !!turn.answerMarkdown;

  const citations = useMemo(
    () => (result?.evidence?.length ? result.evidence : turn.streamEvidence).map((e) => ({ chunk_id: e.chunk_id, report_filename: e.report_filename })),
    [result, turn.streamEvidence]
  );
  const handleCite = useMemo(() => (token: string) => onCite(token, turn), [onCite, turn]);

  // The retriever often returns several passages from one page: show each file and page once (best match kept).
  const sources = useMemo(() => {
    const byPage = new Map<string, { best: EvidenceCard; count: number }>();
    for (const e of result?.evidence ?? []) {
      const key = `${e.report_filename}#${e.page_number}`;
      const cur = byPage.get(key);
      if (!cur) byPage.set(key, { best: e, count: 1 });
      else {
        cur.count += 1;
        if (e.score > cur.best.score) cur.best = e;
      }
    }
    return [...byPage.values()].sort((a, b) => b.best.score - a.best.score);
  }, [result]);

  const steps = stepCount(trace);

  return (
    <article className="flex flex-col gap-4" data-testid="chat-turn" data-turn-id={turn.id}>
      {/* User message */}
      <div className="flex flex-col items-end gap-1 m-enter" data-testid="question-card">
        <div className="max-w-[88%] rounded-[var(--r-10)] bg-[var(--accent)] text-[var(--on-accent)] px-4 py-2.5 text-[14px] leading-[22px] whitespace-pre-wrap break-words">
          {turn.text}
        </div>
        <span className="type-meta">You, {turn.time}</span>
      </div>

      {/* Assistant message */}
      <div className="flex flex-col gap-3 min-w-0">
        {isRefusal && result && (
          <div
            data-testid="refusal-card"
            className="relative overflow-hidden rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--madder)] p-4"
          >
            <WashSweep color="var(--madder)" testId="refusal-wash-sweep" />
            <div className="mb-2">
              <Badge variant="refused">refused: diagnostic boundary</Badge>
            </div>
            <p className="type-reading text-[var(--bone)] m-0">{result.summary_text}</p>
          </div>
        )}

        {turn.withheld && !isRefusal && (
          <div
            className="rounded-[var(--r-10)] border border-[var(--solar-bronze)] bg-[var(--solar-bronze)]/10 px-4 py-3 text-[13px] text-[var(--text-main)]"
            data-testid="withheld-note"
          >
            <strong className="font-semibold">AI wording withheld.</strong> The safety check did not accept the AI&apos;s phrasing,
            so this is the verified evidence-only answer taken directly from your report.
          </div>
        )}

        {hasAnswer && <PaperAnswer markdown={turn.answerMarkdown} citations={citations} onCite={handleCite} isStreaming={turn.isStreaming} />}

        {/* Waiting for the first words: show the real current step, not a fake skeleton. */}
        {!isRefusal && !hasAnswer && turn.isStreaming && (
          <div
            className="inline-flex items-center gap-2.5 self-start rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] px-4 py-3"
            aria-busy="true"
            role="status"
            data-testid="turn-working"
          >
            <span className="w-3.5 h-3.5 rounded-full border-2 border-[var(--solar-bronze)] border-t-transparent animate-spin flex-shrink-0" aria-hidden="true" />
            <span className="type-body">{currentStep(trace)}</span>
          </div>
        )}

        {!isRefusal && sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" data-testid="sources-row">
            <span className="type-label text-[var(--dim)]">Sources</span>
            {sources.slice(0, 8).map(({ best: e, count }) => (
              <button
                key={`${e.report_filename}#${e.page_number}`}
                onClick={() => handleCite(e.chunk_id)}
                title={e.snippet}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--r-6)] border border-[var(--link)]/40 text-[var(--link)] text-[12.5px] font-medium hover:bg-[var(--link)]/10 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
              >
                {e.report_filename}, page {e.page_number}, {(e.score * 100).toFixed(0)}% match
                {count > 1 && <span className="text-[var(--dim)] font-normal"> ({count} passages)</span>}
              </button>
            ))}
          </div>
        )}

        {result?.status === "insufficient_evidence" && (
          <div
            className="rounded-[var(--r-10)] border border-[var(--solar-bronze)] bg-[var(--solar-bronze)]/10 p-4 text-[13px] text-[var(--text-main)]"
            data-testid="insufficient-note"
          >
            <strong className="font-semibold">No AI answer was generated.</strong> None of your report passages matched this question
            above the 0.40 relevance floor, so VitaGraph did not call the AI rather than guess. Ask about a test or value in your
            reports, for example:
            <div className="flex flex-wrap gap-2 mt-2">
              {retrySuggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => onAsk(q)}
                  className="px-2.5 py-1 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)] text-[12.5px] text-left cursor-pointer hover:border-[var(--accent)]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {turn.stopped && (
          <p className="type-meta m-0" data-testid="stopped-note">
            Stopped before the answer finished.
          </p>
        )}

        {turn.streamError && !hasAnswer && (
          <div
            role="alert"
            className="rounded-[var(--r-10)] border border-[var(--madder)] bg-[var(--madder)]/10 p-4 text-[13px] text-[var(--madder)]"
          >
            {turn.streamError} No answer was produced. Send the question again to retry.
          </div>
        )}

        {/* Per-turn actions */}
        {(steps > 0 || hasAnswer) && !turn.isStreaming && (
          <div className="flex items-center gap-1 -ml-2">
            {steps > 0 && (
              <button
                type="button"
                onClick={() => onShowSteps(turn)}
                aria-pressed={stepsFocused}
                className={`type-meta px-2 min-h-[28px] rounded-[var(--r-4)] cursor-pointer hover:bg-[var(--ink-700)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] ${
                  stepsFocused ? "text-[var(--link)] font-medium" : "text-[var(--dim)] hover:text-[var(--bone)]"
                }`}
              >
                {steps === 1 ? "1 step" : `${steps} steps`}
              </button>
            )}
            {hasAnswer && <CopyButton text={turn.answerMarkdown} />}
          </div>
        )}
      </div>
    </article>
  );
});
