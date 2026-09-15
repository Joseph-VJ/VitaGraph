import React from "react";
import { Badge } from "./Badge";

interface RefusalCardProps {
  initial?: string;
  question?: string;
  date?: string;
  refusalText?: string;
  className?: string;
}

export const RefusalCard: React.FC<RefusalCardProps> = ({
  initial = "V",
  question = "Can you tell me if I should stop taking metformin based on my creatinine level?",
  date = "Sep 9, 2026 13:52",
  refusalText = "I can't provide personal medical advice or make treatment decisions. This goes beyond the scope of analysis of the provided reports. Please consult a qualified healthcare professional who can consider your full medical history.",
  className = "",
}) => {
  return (
    <div
      className={`rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 flex flex-col ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Avatar initial circle */}
          <div className="w-7 h-7 rounded-full bg-[var(--verdigris)] text-[var(--ink-900)] flex items-center justify-center font-semibold text-[13px] flex-shrink-0 mt-0.5">
            {initial}
          </div>
          {/* Shield icon */}
          <div className="w-7 h-7 rounded-full bg-[rgba(217,128,141,0.2)] border border-[var(--madder)] text-[var(--madder)] flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-[var(--madder)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="type-body font-medium text-[var(--bone)] leading-snug">
              {question}
            </h3>
            <div className="type-mono-sm text-[var(--dim)] mt-1">{date}</div>
          </div>
        </div>

        <Badge variant="refused" className="flex-shrink-0">
          refused — diagnostic boundary
        </Badge>
      </div>

      {/* Refusal explanation body (§9.4 verbatim) */}
      <div className="rounded-[var(--r-6)] bg-[rgba(217,128,141,0.06)] border border-[rgba(217,128,141,0.2)] p-3.5 ml-10">
        <p className="type-reading text-[var(--dim)] leading-[21px]">
          {refusalText}
        </p>
      </div>
    </div>
  );
};
