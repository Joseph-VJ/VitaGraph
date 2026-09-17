import React, { useState, useRef, useEffect } from "react";
import { Badge } from "./Badge";
import { IconButton } from "./Buttons";
import { flipFrom } from "../../motion/flip";

export interface QuestionCardProps {
  initial?: string;
  question: string;
  date: string;
  category?: string;
  rewrittenQuery?: string;
  sourceRect?: DOMRect | null;
  className?: string;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  initial = "V",
  question,
  date,
  category = "educational",
  rewrittenQuery,
  sourceRect,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sourceRect && cardRef.current) {
      flipFrom(cardRef.current, sourceRect, { spring: "weighted", capMs: 240 });
    }
  }, [sourceRect]);

  const handleCopy = () => {
    if (rewrittenQuery) {
      navigator.clipboard.writeText(rewrittenQuery);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div
      ref={cardRef}
      data-testid="question-card"
      className={`rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 flex flex-col ${
        !sourceRect ? "m-enter" : ""
      } ${className}`}
    >
      {/* Top row: Avatar + Question + Date + Badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-full bg-[var(--verdigris)] text-[var(--ink-900)] flex items-center justify-center font-semibold text-[13px] flex-shrink-0 mt-0.5">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="type-body font-medium text-[var(--bone)] leading-snug">
              {question}
            </h3>
            <div className="type-mono-sm text-[var(--dim)] mt-1">{date}</div>
          </div>
        </div>

        {category && (
          <Badge variant="educational" className="flex-shrink-0">
            {category}
          </Badge>
        )}
      </div>

      {/* Inner rewritten-query block reveals via mask M5.6 */}
      {rewrittenQuery && (
        <div className="rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-faint)] p-3 flex items-center justify-between gap-3 m-mask-reveal">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
            <span className="px-1.5 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-700)] text-[var(--dim)] type-mono-sm font-medium flex-shrink-0">
              Rewritten query (RAG)
            </span>
            <span className="type-mono text-[12px] text-[var(--bone)] truncate flex-1 min-w-[200px]">
              {rewrittenQuery}
            </span>
          </div>

          <IconButton
            size={24}
            title={copied ? "Copied" : "Copy rewritten query"}
            onClick={handleCopy}
            className="border-transparent bg-transparent hover:bg-[var(--ink-700)] text-[var(--dim)] hover:text-[var(--bone)] flex-shrink-0"
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-[var(--verdigris)]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </IconButton>
        </div>
      )}
    </div>
  );
};
