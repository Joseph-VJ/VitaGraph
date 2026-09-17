import React from "react";
import { Button } from "./Buttons";
import { WashSweep } from "../../motion/fx/WashSweep";

// 1. Empty State
interface EmptyStateProps {
  quote?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  quote = "Every journey begins with a first record.",
  actionLabel = "Upload report",
  onAction,
  className = "",
}) => {
  return (
    <div
      className={`rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-8 flex flex-col items-center justify-center text-center ${className}`}
    >
      <div className="w-16 h-16 mb-4 text-[var(--dim)] opacity-70">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
          <path
            d="M12 48L24 24L36 40L44 30L52 48H12Z"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-sketch-draw"
            data-testid="empty-state-sketch"
          />
          <circle cx="20" cy="18" r="3" className="animate-sketch-draw" />
        </svg>
      </div>

      <p className="type-quote text-[var(--dim)] mb-4 max-w-sm m-fade-only" data-testid="empty-state-quote">
        “{quote}”
      </p>

      {actionLabel && (
        <Button variant="ghost" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

// 2. Loading State (Skeleton Shimmer 1.2s)
export const LoadingState: React.FC<{ rows?: number; className?: string }> = ({
  rows = 3,
  className = "",
}) => {
  return (
    <div
      className={`rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 space-y-3 ${className}`}
    >
      <div className="h-5 w-44 rounded-[var(--r-4)] skeleton-shimmer" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2 pt-1">
          <div className="h-3.5 w-full rounded-[var(--r-4)] skeleton-shimmer" />
          <div className="h-3.5 w-4/5 rounded-[var(--r-4)] skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
};

// 3. Error State (2px madder rule card + plain sentence + Retry)
interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = "Vector index connection refused. Offline cache in use.",
  onRetry,
  className = "",
}) => {
  return (
    <div
      data-testid="error-card"
      className={`rounded-[var(--r-6)] border border-[var(--line-strong)] bg-[var(--ink-800)] p-4 flex items-center justify-between gap-4 relative overflow-hidden animate-detent-impulse ${className}`}
    >
      {/* 2px madder rule scaleY wipe in (§M7.10) */}
      <div
        data-testid="error-madder-rule"
        className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--madder)] origin-top animate-rule-wipe-y"
      />
      {/* WashSweep 8% once (§M7.10) */}
      <WashSweep color="var(--madder)" testId="error-card-wash" />

      <div className="flex items-center gap-3 z-10">
        <svg className="w-5 h-5 text-[var(--madder)] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="type-body text-[var(--bone)]">{message}</span>
      </div>

      <Button variant="solid-danger" onClick={onRetry} className="h-8 px-3 text-[12px] z-10">
        Retry
      </Button>
    </div>
  );
};

// 4. Uncertain State (Ochre rule + "marked uncertain" note)
interface UncertainStateProps {
  note?: string;
  className?: string;
}

export const UncertainState: React.FC<UncertainStateProps> = ({
  note = "Extracted value lacks explicit reference range. Marked uncertain.",
  className = "",
}) => {
  return (
    <div
      className={`rounded-[var(--r-6)] border border-[var(--line-strong)] border-l-2 border-l-[var(--ochre)] bg-[var(--ink-800)] p-3.5 flex items-center gap-3 ${className}`}
    >
      <svg className="w-4 h-4 text-[var(--ochre)] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div>
        <span className="type-label text-[var(--ochre)] font-semibold mr-2">
          marked uncertain
        </span>
        <span className="type-meta text-[var(--dim)]">{note}</span>
      </div>
    </div>
  );
};
