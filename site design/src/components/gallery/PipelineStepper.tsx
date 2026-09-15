import React from "react";

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
  return (
    <div className={`w-full py-2 ${className}`}>
      <div className="flex items-center justify-between relative">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const nextStep = steps[idx + 1];
          const isConnectorDone = step.status === "done" && (nextStep?.status === "done" || nextStep?.status === "active");

          return (
            <React.Fragment key={step.name}>
              {/* Node item */}
              <div className="flex flex-col items-center relative z-10">
                {step.status === "done" && (
                  <div className="w-7 h-7 rounded-full bg-[var(--verdigris)] text-[var(--ink-900)] flex items-center justify-center font-bold shadow-[0_0_8px_rgba(121,184,166,0.3)]">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}

                {step.status === "active" && (
                  <div className="w-7 h-7 rounded-full border-2 border-[var(--verdigris)] bg-[var(--ink-800)] flex items-center justify-center animate-pulse-once relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--verdigris)] shadow-[0_0_6px_var(--verdigris)]" />
                  </div>
                )}

                {step.status === "pending" && (
                  <div className="w-7 h-7 rounded-full border border-[var(--line-strong)] bg-[var(--ink-900)] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[var(--line-strong)]" />
                  </div>
                )}

                {/* Captions */}
                <div className="text-center mt-2.5">
                  <div className="type-label text-[var(--bone)] whitespace-nowrap">{step.name}</div>
                  <div className="type-mono-sm text-[var(--dim)] mt-0.5 whitespace-nowrap">{step.value}</div>
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={`flex-1 h-[2px] mx-2 -mt-10 transition-colors duration-[120ms] ${
                    isConnectorDone ? "bg-[var(--verdigris)]" : "bg-[var(--line-faint)]"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
