import React from "react";
import { Button } from "./Buttons";

interface QuarantineRowProps {
  filename: string;
  reason: string;
  onRetry?: () => void;
  className?: string;
}

export const QuarantineRow: React.FC<QuarantineRowProps> = ({
  filename,
  reason,
  onRetry,
  className = "",
}) => {
  return (
    <div
      className={`flex items-center justify-between p-3 border-l-2 border-l-[var(--madder)] bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-strong)] ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1 mr-3">
        <svg
          className="w-5 h-5 text-[var(--madder)] flex-shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="type-mono text-[var(--bone)] truncate">{filename}</div>
          <div className="type-meta text-[var(--dim)] mt-0.5">{reason}</div>
        </div>
      </div>

      <Button variant="solid-danger" onClick={onRetry} className="h-8 px-3">
        Retry
      </Button>
    </div>
  );
};
