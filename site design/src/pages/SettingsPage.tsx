import React, { useState } from "react";
import { Badge, Marginalia } from "../components/gallery";

export const SettingsPage: React.FC = () => {
  const [allowApi, setAllowApi] = useState(false);
  const [diagnosticGuard, setDiagnosticGuard] = useState(true);
  const [localOnly, setLocalOnly] = useState(true);
  const [activeTheme, setActiveTheme] = useState<"instrument" | "paper">("instrument");

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="type-title text-[var(--bone)]">Settings & System Configuration</h2>
          <p className="type-meta text-[var(--dim)] mt-0.5">
            Local generation boundaries, privacy guardrails, and persistent storage paths.
          </p>
        </div>
        <Marginalia
          text="Same data. Kinder answers."
          sketch="leaf"
        />
      </div>

      {/* 1. Model & Inference Engine */}
      <div className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--line-faint)]">
          <div>
            <h3 className="type-title text-[var(--bone)] text-base">
              Generation & Inference Engine
            </h3>
            <p className="type-meta text-[var(--dim)] text-xs mt-0.5">
              Strictly local open-weights inference engine for biomedical questions
            </p>
          </div>
          <Badge variant="verdigris">Operational</Badge>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between py-2 border-b border-[var(--line-faint)]">
            <span className="type-label text-[var(--dim)]">Engine Service</span>
            <span className="type-mono-sm text-[var(--bone)] font-mono">
              gen-service v2 · cfg 2026-08
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-[var(--line-faint)]">
            <span className="type-label text-[var(--dim)]">Inference Endpoint</span>
            <span className="type-mono-sm text-[var(--bone)] font-mono">
              http://localhost:8000/api/ai
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-[var(--line-faint)]">
            <span className="type-label text-[var(--dim)]">External Proprietary APIs</span>
            <span className="type-mono-sm text-[var(--ochre)] font-semibold">
              Disabled by academic policy
            </span>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
          <p className="type-quote-sm italic text-[var(--dim)] text-xs">
            "VitaGraph enforces strict academic reproducibility: no external closed-source LLM calls are permitted in production evaluations."
          </p>
        </div>
      </div>

      {/* 2. Privacy & Diagnostic Boundaries */}
      <div className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
        <h3 className="type-title text-[var(--bone)] text-base mb-1">
          Safety & Clinical Boundaries
        </h3>
        <p className="type-meta text-[var(--dim)] text-xs mb-4 pb-3 border-b border-[var(--line-faint)]">
          Automated refusals on prescriptive and direct diagnostic prompts
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="type-body font-medium text-[var(--bone)] text-sm block">
                Enforce Diagnostic Refusal Boundary
              </span>
              <span className="type-meta text-[var(--dim)] text-xs">
                Automatically intercept questions requesting prescription advice or treatment cessation
              </span>
            </div>
            <button
              onClick={() => setDiagnosticGuard(!diagnosticGuard)}
              className={`w-11 h-6 rounded-full transition-colors duration-[120ms] p-1 flex items-center ${
                diagnosticGuard ? "bg-[var(--verdigris)]" : "bg-[var(--ink-700)]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-[var(--ink-900)] transition-transform duration-[120ms] ${
                  diagnosticGuard ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[var(--line-faint)]">
            <div>
              <span className="type-body font-medium text-[var(--bone)] text-sm block">
                Local-Only Execution Mode (Airgap Guarantee)
              </span>
              <span className="type-meta text-[var(--dim)] text-xs">
                Zero network egress — all vector embeddings and graph queries stay on localhost
              </span>
            </div>
            <button
              onClick={() => setLocalOnly(!localOnly)}
              className={`w-11 h-6 rounded-full transition-colors duration-[120ms] p-1 flex items-center ${
                localOnly ? "bg-[var(--verdigris)]" : "bg-[var(--ink-700)]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-[var(--ink-900)] transition-transform duration-[120ms] ${
                  localOnly ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[var(--line-faint)]">
            <div>
              <span className="type-body font-medium text-[var(--bone)] text-sm block">
                External API Fallback (allow_api)
              </span>
              <span className="type-meta text-[var(--dim)] text-xs">
                Allow cloud model fallback when local GPU memory threshold is exceeded
              </span>
            </div>
            <button
              onClick={() => setAllowApi(!allowApi)}
              className={`w-11 h-6 rounded-full transition-colors duration-[120ms] p-1 flex items-center ${
                allowApi ? "bg-[var(--verdigris)]" : "bg-[var(--ink-700)]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-[var(--ink-900)] transition-transform duration-[120ms] ${
                  allowApi ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Visual Language */}
      <div className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
        <h3 className="type-title text-[var(--bone)] text-base mb-1">
          Visual Language & Theme
        </h3>
        <p className="type-meta text-[var(--dim)] text-xs mb-4 pb-3 border-b border-[var(--line-faint)]">
          Instrument & Paper frozen design tokens (§4, DESIGN.md)
        </p>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTheme("instrument")}
            className={`p-3 rounded-[var(--r-6)] border flex items-center gap-2.5 transition-all duration-[120ms] ${
              activeTheme === "instrument"
                ? "bg-[var(--ink-700)] border-[var(--verdigris)] text-[var(--bone)]"
                : "border-[var(--line-strong)] text-[var(--dim)] hover:text-[var(--bone)]"
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-[#0E1116] border border-[var(--verdigris)]" />
            <span className="type-label">Instrument (Dark)</span>
          </button>

          <button
            onClick={() => setActiveTheme("paper")}
            className={`p-3 rounded-[var(--r-6)] border flex items-center gap-2.5 transition-all duration-[120ms] ${
              activeTheme === "paper"
                ? "bg-[var(--ink-700)] border-[var(--verdigris)] text-[var(--bone)]"
                : "border-[var(--line-strong)] text-[var(--dim)] hover:text-[var(--bone)]"
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-[#F5EFEB] border border-[#D8CFBC]" />
            <span className="type-label">Paper (Light)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
