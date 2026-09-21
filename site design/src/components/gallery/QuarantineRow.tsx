import React, { useState, useEffect, useRef } from "react";
import { Button } from "./Buttons";
import { governor, isReducedMotion } from "../../motion";
import { DetentPress } from "../../motion/fx/DetentPress";
import { playDetent } from "../../motion/audio";

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
  const isT0 = governor.getState().tier === "T0" || isReducedMotion();
  const [isImpulsing, setIsImpulsing] = useState(false);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (isT0) return;
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    // Track repeated failures in sessionStorage: max 2 impulses per session on the same row (§M7.2)
    const sessionKey = `vg_quarantine_impulse_${filename}`;
    const rawCount = sessionStorage.getItem(sessionKey);
    const count = rawCount ? parseInt(rawCount, 10) : 0;

    if (count > 0 && count <= 2) {
      // Repeated failure! Trigger detent impulse (§M5.4, §M7.2)
      setIsImpulsing(true);
      sessionStorage.setItem(sessionKey, String(count + 1));
      const timer = setTimeout(() => setIsImpulsing(false), 240);
      return () => clearTimeout(timer);
    } else if (count === 0) {
      // First failure: record initial encounter, no impulse yet
      sessionStorage.setItem(sessionKey, "1");
    }
  }, [filename, isT0]);

  const handleRetry = () => {
    playDetent();
    onRetry?.();
  };

  return (
    <div
      data-testid={`quarantine-row-${filename}`}
      data-impulse={isImpulsing ? "active" : "idle"}
      className={`relative overflow-hidden flex items-center justify-between p-3 border-l-2 border-l-[var(--madder)] bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-strong)] ${
        isImpulsing ? "animate-impulse" : ""
      } ${className}`}
    >
      {/* Madder 2px rule scaleX wipe across top (§M7.2) */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] bg-[var(--madder)] origin-left ${
          !isT0 ? "animate-rule-wipe" : ""
        }`}
        style={{ transformOrigin: "left" }}
      />

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
          <div
            className={`type-meta text-[var(--dim)] mt-0.5 ${
              !isT0 ? "animate-fade-in" : ""
            }`}
          >
            {reason}
          </div>
        </div>
      </div>

      <DetentPress>
        <Button
          variant="solid-danger"
          onClick={handleRetry}
          className="h-8 px-3"
        >
          Retry
        </Button>
      </DetentPress>
    </div>
  );
};
