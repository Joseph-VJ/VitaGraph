import React, { useState, useEffect, useRef } from "react";
import { Odometer, governor, isReducedMotion, playDetent, WashSweep } from "../../motion";
import { DrawPath } from "../../motion/fx/DrawPath";
import { PulseRing } from "../../motion/fx/PulseRing";

export interface PipelineStep {
  name: string;
  value: string;
  status: "done" | "active" | "pending";
}

interface PipelineStepperProps {
  steps?: PipelineStep[];
  className?: string;
}

const defaultSteps: PipelineStep[] = [
  { name: "Received", value: "412 ms", status: "done" },
  { name: "Extracted", value: "1.2 s", status: "active" },
  { name: "Chunked", value: "24 chunks", status: "pending" },
  { name: "Embedded", value: "1.9 s batch 32", status: "pending" },
  { name: "Indexed", value: "ok", status: "pending" },
  { name: "Graphed", value: "+18 nodes", status: "pending" },
];

export const PipelineStepper: React.FC<PipelineStepperProps> = ({
  steps = defaultSteps,
  className = "",
}) => {
  const isT0 = governor.getState().tier === "T0" || isReducedMotion();
  const [isImpulsing, setIsImpulsing] = useState(false);
  const [completedStepIndices, setCompletedStepIndices] = useState<Set<number>>(new Set());
  const prevStepsRef = useRef<PipelineStep[]>(steps);
  const isFirstRenderRef = useRef<boolean>(true);

  // Choreographed stage handoffs (§7.2-A, §M7.2): WashSweep on completed node + DetentPress impulse + playDetent()
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (isT0) return;

    const currentStr = JSON.stringify(steps);
    const prevStr = JSON.stringify(prevStepsRef.current);

    if (currentStr !== prevStr) {
      // Identify newly completed steps for WashSweep
      const newlyCompleted = new Set<number>();
      steps.forEach((step, idx) => {
        const prevStep = prevStepsRef.current[idx];
        if (prevStep && prevStep.status !== "done" && step.status === "done") {
          newlyCompleted.add(idx);
        }
      });

      if (newlyCompleted.size > 0) {
        setCompletedStepIndices(newlyCompleted);
        setTimeout(() => {
          setCompletedStepIndices(new Set());
        }, 360);
      }

      prevStepsRef.current = steps;
      setIsImpulsing(true);
      playDetent();
      const timer = setTimeout(() => setIsImpulsing(false), 180);
      return () => clearTimeout(timer);
    }
  }, [steps, isT0]);

  const renderStepValue = (val: string, stepName: string) => {
    const match = val.match(/^(\+?)(\d+(?:\.\d+)?)\s*(.*)$/);
    if (match) {
      const prefix = match[1];
      const num = parseFloat(match[2]);
      const suffix = match[3];
      return (
        <>
          {prefix}
          <Odometer value={num} duration={480} testId={`stepper-odo-${stepName.toLowerCase()}`} />
          {suffix ? ` ${suffix}` : ""}
        </>
      );
    }
    return val;
  };

  return (
    <div
      className={`w-full py-2 transition-transform ${
        isImpulsing ? "animate-detent-impulse" : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between relative">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const nextStep = steps[idx + 1];
          const isConnectorDone =
            step.status === "done" &&
            (nextStep?.status === "done" || nextStep?.status === "active");
          const isConnectorActive =
            step.status === "done" && nextStep?.status === "active";

          return (
            <React.Fragment key={step.name}>
              {/* Node item */}
              <div className="flex flex-col items-center relative z-10">
                {/* Done State — checkmark DrawPath (§M7.2) + WashSweep on complete (§7.2-A) */}
                {step.status === "done" && (
                  <div className="relative w-7 h-7 rounded-full bg-[var(--verdigris)] text-[var(--ink-900)] flex items-center justify-center font-bold shadow-[0_0_8px_rgba(121,184,166,0.3)] overflow-hidden">
                    <WashSweep
                      active={completedStepIndices.has(idx)}
                      color="rgba(255, 255, 255, 0.45)"
                      testId={`stepper-node-wash-${step.name.toLowerCase()}`}
                    />
                    <svg
                      className="w-4 h-4 z-20 relative"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <DrawPath
                        d="M4 10.5l4 4 8-8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        stroke="currentColor"
                        durationMs={240}
                        className={!isT0 ? "animate-draw-check" : ""}
                        data-testid="stepper-check-draw"
                      />
                    </svg>
                  </div>
                )}

                {/* Active State — node ring pulse once (6px glow, 400ms, §M7.2) */}
                {step.status === "active" && (
                  <div className="relative w-7 h-7 rounded-full border-2 border-[var(--verdigris)] bg-[var(--ink-800)] flex items-center justify-center">
                    {!isT0 && (
                      <PulseRing color="verdigris" />
                    )}
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--verdigris)] shadow-[0_0_6px_var(--verdigris)]" />
                  </div>
                )}

                {/* Pending State */}
                {step.status === "pending" && (
                  <div className="w-7 h-7 rounded-full border border-[var(--line-strong)] bg-[var(--ink-900)] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[var(--line-strong)]" />
                  </div>
                )}

                {/* Captions */}
                <div className="text-center mt-2.5">
                  <div className="type-label text-[var(--bone)] whitespace-nowrap">
                    {step.name}
                  </div>
                  <div className="type-mono-sm text-[var(--dim)] mt-0.5 whitespace-nowrap">
                    {renderStepValue(step.value, step.name)}
                  </div>
                </div>
              </div>

              {/* Connector line with scaleX fill & work-dot (§M5.3, §M7.2) */}
              {!isLast && (
                <div className="relative flex-1 h-[2px] mx-2 -mt-10 bg-[var(--line-faint)] overflow-hidden">
                  {/* Fill track */}
                  <div
                    style={{
                      transform: isConnectorDone ? "scaleX(1)" : "scaleX(0)",
                      transformOrigin: "left",
                      transition: !isT0
                        ? "transform var(--m-deliberate, 360ms) var(--ease-servo, cubic-bezier(0.32, 0, 0.24, 1))"
                        : "none",
                    }}
                    className="w-full h-full bg-[var(--verdigris)]"
                  />

                  {/* Honest work-dot when stage is active (§M5.3, loop <= 1 Hz) */}
                  {isConnectorActive && !isT0 && (
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                      <div className="w-1.5 h-1.5 -top-[2px] relative rounded-full bg-[var(--verdigris)] shadow-[0_0_4px_var(--verdigris)] animate-work-dot" />
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
