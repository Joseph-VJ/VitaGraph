import React, { useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CANONICAL_JOURNEY, transitionNavigate } from "../../motion/navigation";
import { playDetent, isAudioEnabled } from "../../motion/audio";
import { DetentPress } from "../../motion/fx/DetentPress";
import { PulseRing } from "../../motion/fx/PulseRing";

export const JourneyRail: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const currentStepIndex = CANONICAL_JOURNEY.findIndex(
    (step) => step.path === currentPath
  );

  const isJourneyScreen = currentStepIndex !== -1;
  const currentStep = isJourneyScreen ? CANONICAL_JOURNEY[currentStepIndex] : null;
  const nextStepIndex = isJourneyScreen ? (currentStepIndex + 1) % CANONICAL_JOURNEY.length : -1;
  const nextStep = isJourneyScreen ? CANONICAL_JOURNEY[nextStepIndex] : null;
  const prevStepIndex = isJourneyScreen ? (currentStepIndex - 1 + CANONICAL_JOURNEY.length) % CANONICAL_JOURNEY.length : -1;
  const prevStep = isJourneyScreen ? CANONICAL_JOURNEY[prevStepIndex] : null;

  // Move focus to page's primary <h1> on route change for a11y (§WS-2)
  useEffect(() => {
    if (!isJourneyScreen) return;
    const timer = setTimeout(() => {
      const h1 = document.querySelector("h1");
      if (h1) {
        h1.setAttribute("tabindex", "-1");
        h1.focus({ preventScroll: true });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [currentPath, isJourneyScreen]);

  const advance = useCallback(() => {
    if (!nextStep) return;
    if (isAudioEnabled()) {
      playDetent();
    }
    transitionNavigate(navigate, nextStep.path, { direction: "forward" });
  }, [navigate, nextStep]);

  const retreat = useCallback(() => {
    if (!prevStep) return;
    if (isAudioEnabled()) {
      playDetent();
    }
    transitionNavigate(navigate, prevStep.path, { direction: "back" });
  }, [navigate, prevStep]);

  // Keyboard navigation shortcuts: 'n' or '→' advances, '←' retreats (§WS-2)
  useEffect(() => {
    if (!isJourneyScreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (isInput) return;

      if (e.key === "n" || e.key === "ArrowRight") {
        e.preventDefault();
        advance();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        retreat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isJourneyScreen, advance, retreat]);

  // Hidden on non-journey pages (§WS-2)
  if (!isJourneyScreen || !currentStep || !nextStep) {
    return null;
  }

  return (
    <aside
      data-testid="journey-rail"
      data-view-journey-rail="true"
      aria-label="Guided Journey Navigation"
      className="fixed bottom-10 right-8 z-40 flex items-center gap-3.5 px-4 py-2 rounded-full bg-[var(--ink-800)]/95 backdrop-blur-md border border-[var(--line-strong)] shadow-[var(--shadow-floating)] transition-all duration-[var(--m-quick)] ease-out select-none hover:border-[var(--line-faint)] group"
    >
      {/* Previous Step Affordance Button (if not on first step) */}
      {currentStepIndex > 0 && prevStep && (
        <DetentPress className="inline-flex">
          <button
            type="button"
            data-testid="journey-prev-btn"
            onClick={retreat}
            title={`Previous: ${prevStep.label}`}
            aria-label={`Previous step: ${prevStep.label}`}
            className="w-5 h-5 rounded-full bg-[var(--ink-700)] flex items-center justify-center text-[var(--bone)] hover:bg-[var(--line-strong)] hover:text-[var(--bone)] transition-all duration-[var(--m-micro)] hover:-translate-x-0.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--verdigris)] focus-visible:outline-offset-2"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </DetentPress>
      )}

      {/* 5-Stage Journey Progress Dots */}
      <div className="flex items-center gap-1.5" aria-label="Journey steps">
        {CANONICAL_JOURNEY.map((step, idx) => {
          const isCurrent = idx === currentStepIndex;
          const isCompleted = idx < currentStepIndex;
          return (
            <button
              key={step.id}
              type="button"
              data-testid={`journey-dot-${step.id}`}
              data-active={isCurrent ? "true" : "false"}
              data-completed={isCompleted ? "true" : "false"}
              aria-current={isCurrent ? "step" : undefined}
              title={`${step.label} (${idx + 1}/5)`}
              onClick={() => {
                const dir = idx >= currentStepIndex ? "forward" : "back";
                if (isAudioEnabled()) playDetent();
                transitionNavigate(navigate, step.path, { direction: dir });
              }}
              className={`relative rounded-full transition-all duration-[var(--m-quick)] cursor-pointer flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[var(--verdigris)] focus-visible:outline-offset-2 ${
                isCurrent
                  ? "w-3 h-3 bg-[var(--verdigris)] ring-2 ring-[var(--verdigris)]/30 scale-110"
                  : isCompleted
                  ? "w-2.5 h-2.5 bg-[var(--verdigris)]/80 hover:bg-[var(--verdigris)]"
                  : "w-2.5 h-2.5 bg-[var(--line-strong)] hover:bg-[var(--dim)]"
              }`}
            >
              {isCurrent && <PulseRing color="verdigris" />}
              <span className="sr-only">Step {idx + 1}: {step.label}</span>
            </button>
          );
        })}
      </div>

      <div className="h-4 w-[1px] bg-[var(--line-faint)]" />

      {/* Next Step Affordance Button */}
      <DetentPress className="inline-flex">
        <button
          type="button"
          data-testid="journey-next-btn"
          onClick={advance}
          className="flex items-center gap-2 text-left cursor-pointer group/btn focus-visible:outline-2 focus-visible:outline-[var(--verdigris)] focus-visible:outline-offset-2 rounded"
        >
          <div className="flex flex-col w-[210px]">
            <span className="type-meta text-[10px] text-[var(--dim)] uppercase tracking-wider font-semibold truncate">
              Next step ({nextStepIndex + 1}/5)
            </span>
            <span className="type-label text-xs text-[var(--bone)] group-hover/btn:text-[var(--verdigris)] transition-colors truncate">
              {currentStep.reason}
            </span>
          </div>

          {/* Directional Next Indicator Arrow */}
          <span className="w-5 h-5 rounded-full bg-[var(--ink-700)] flex items-center justify-center text-[var(--bone)] group-hover/btn:bg-[var(--verdigris)] group-hover/btn:text-[var(--ink-900)] transition-all duration-[var(--m-micro)] group-hover/btn:translate-x-0.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </button>
      </DetentPress>
    </aside>
  );
};
