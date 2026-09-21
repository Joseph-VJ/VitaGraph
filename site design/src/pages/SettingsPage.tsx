import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Marginalia, LED } from "../components/gallery";
import {
  governor,
  useMotionGovernor,
  setAudioEnabled,
  playDetent,
  isAudioEnabled,
  transitionNavigate,
  isReducedMotion,
  Sequence,
} from "../motion";
import { DetentPress } from "../motion/fx/DetentPress";
import { WashSweep } from "../motion/fx/WashSweep";
import { Odometer } from "../motion/fx/Odometer";

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const motion = useMotionGovernor();
  const [allowApi, setAllowApi] = useState(false);
  const [diagnosticGuard, setDiagnosticGuard] = useState(true);
  const [localOnly, setLocalOnly] = useState(true);
  const [activeTheme, setActiveTheme] = useState<"instrument" | "paper">("instrument");
  const [soundEnabled, setSoundEnabled] = useState(() => isAudioEnabled());

  // Tier-switch confirmation (§M5.5)
  const prevTierRef = useRef(motion.tier);
  const [tierWash, setTierWash] = useState(false);
  const [tierPopped, setTierPopped] = useState(false);

  useEffect(() => {
    if (prevTierRef.current !== motion.tier) {
      prevTierRef.current = motion.tier;
      const isT0 = motion.tier === "T0" || isReducedMotion();
      if (!isT0) {
        setTierWash(true);
        setTierPopped(true);
        new Sequence()
          .wait(480)
          .addAction(() => {
            setTierWash(false);
            setTierPopped(false);
          })
          .play();
      }
    }
  }, [motion.tier]);

  const isT0 = motion.tier === "T0" || isReducedMotion();

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
            <DetentPress>
              <button
                type="button"
                onClick={() => setDiagnosticGuard(!diagnosticGuard)}
                className={`w-11 h-6 rounded-full transition-colors duration-[120ms] p-1 flex items-center cursor-pointer ${
                  diagnosticGuard ? "bg-[var(--verdigris)]" : "bg-[var(--ink-700)]"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-[var(--ink-900)] transition-transform duration-[120ms] ${
                    diagnosticGuard ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </DetentPress>
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
            <DetentPress>
              <button
                type="button"
                onClick={() => setLocalOnly(!localOnly)}
                className={`w-11 h-6 rounded-full transition-colors duration-[120ms] p-1 flex items-center cursor-pointer ${
                  localOnly ? "bg-[var(--verdigris)]" : "bg-[var(--ink-700)]"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-[var(--ink-900)] transition-transform duration-[120ms] ${
                    localOnly ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </DetentPress>
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
            <DetentPress>
              <button
                type="button"
                onClick={() => setAllowApi(!allowApi)}
                className={`w-11 h-6 rounded-full transition-colors duration-[120ms] p-1 flex items-center cursor-pointer ${
                  allowApi ? "bg-[var(--verdigris)]" : "bg-[var(--ink-700)]"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-[var(--ink-900)] transition-transform duration-[120ms] ${
                    allowApi ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </DetentPress>
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
          <DetentPress>
            <button
              type="button"
              onClick={() => setActiveTheme("instrument")}
              className={`p-3 rounded-[var(--r-6)] border flex items-center gap-2.5 transition-all duration-[120ms] cursor-pointer ${
                activeTheme === "instrument"
                  ? "bg-[var(--ink-700)] border-[var(--verdigris)] text-[var(--bone)]"
                  : "border-[var(--line-strong)] text-[var(--dim)] hover:text-[var(--bone)]"
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-[#0E1116] border border-[var(--verdigris)]" />
              <span className="type-label">Instrument (Dark)</span>
            </button>
          </DetentPress>

          <DetentPress>
            <button
              type="button"
              onClick={() => setActiveTheme("paper")}
              className={`p-3 rounded-[var(--r-6)] border flex items-center gap-2.5 transition-all duration-[120ms] cursor-pointer ${
                activeTheme === "paper"
                  ? "bg-[var(--ink-700)] border-[var(--verdigris)] text-[var(--bone)]"
                  : "border-[var(--line-strong)] text-[var(--dim)] hover:text-[var(--bone)]"
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-[#F5EFEB] border border-[#D8CFBC]" />
              <span className="type-label">Paper (Light)</span>
            </button>
          </DetentPress>
        </div>
      </div>

      {/* 4. Motion & Adaptive Governor (§M4.4, §M5.5) */}
      <div
        data-testid="settings-motion-card"
        className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] relative overflow-hidden"
      >
        {tierWash && (
          <WashSweep
            active={tierWash}
            color="var(--verdigris)"
            testId="settings-tier-wash"
          />
        )}

        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--line-faint)]">
          <div>
            <h3 className="type-title text-[var(--bone)] text-base">
              Motion & Adaptive Governor
            </h3>
            <p className="type-meta text-[var(--dim)] text-xs mt-0.5">
              Four-tier physics engine (§M4.4) with prefers-reduced-motion safety floor
            </p>
          </div>
          <span
            className={`type-mono-sm px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-700)] border border-[var(--line-strong)] text-[var(--bone)] ${
              tierPopped ? "animate-chip-pop" : ""
            }`}
          >
            motion {motion.tier}{motion.mode === "manual" ? " · manual" : ""}
          </span>
        </div>

        <div className="space-y-4 text-xs">
          {/* Tier override selector */}
          <div>
            <span className="type-label text-[var(--dim)] block mb-2">Quality Tier Override</span>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { id: "auto", label: "Auto (Governor)", desc: "Dynamic 60fps scaling" },
                { id: "T3", label: "T3 Showcase", desc: "Full FX & photons" },
                { id: "T2", label: "T2 Balanced", desc: "Static ambient" },
                { id: "T1", label: "T1 Safe", desc: "No glow, ≤240ms" },
                { id: "T0", label: "T0 Static", desc: "Instant states only" },
              ].map((opt) => {
                const isSelected = motion.mode === "manual" ? motion.tier === opt.id : opt.id === "auto";
                return (
                  <DetentPress key={opt.id} className="block w-full">
                    <button
                      type="button"
                      onClick={() => governor.setOverride(opt.id as any)}
                      className={`w-full p-2.5 rounded-[var(--r-6)] border text-left flex flex-col gap-1 transition-all duration-[120ms] cursor-pointer ${
                        isSelected
                          ? "bg-[var(--ink-700)] border-[var(--verdigris)] text-[var(--bone)]"
                          : "border-[var(--line-strong)] text-[var(--dim)] hover:text-[var(--bone)] hover:border-[var(--line-faint)]"
                      }`}
                    >
                      <span className="type-mono-sm font-semibold">{opt.label}</span>
                      <span className="text-[10px] text-[var(--dim)] leading-tight">{opt.desc}</span>
                    </button>
                  </DetentPress>
                );
              })}
            </div>
          </div>

          {/* Tier Preview Strip (§M5.5) */}
          <div
            data-testid="tier-preview-strip"
            className="p-3 bg-[var(--ink-900)] rounded-[var(--r-6)] border border-[var(--line-faint)]"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                Active Tier Preview ({motion.tier})
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                {isT0 ? "Instant Settle Floor" : "Physical Choreography"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center items-center">
              <div className="p-2 bg-[var(--ink-800)] rounded-[var(--r-4)] border border-[var(--line-faint)]">
                <span className="type-meta text-[10px] text-[var(--dim)] block mb-1">LED Breathe</span>
                <div className="flex justify-center">
                  <LED color="verdigris" live={!isT0} />
                </div>
              </div>
              <div className="p-2 bg-[var(--ink-800)] rounded-[var(--r-4)] border border-[var(--line-faint)]">
                <span className="type-meta text-[10px] text-[var(--dim)] block mb-1">Odometer Roll</span>
                <span className="type-mono text-xs font-bold text-[var(--bone)]">
                  <Odometer value={motion.tier === "T3" ? 60 : motion.tier === "T2" ? 30 : 0} duration={360} />
                </span>
              </div>
              <div className="p-2 bg-[var(--ink-800)] rounded-[var(--r-4)] border border-[var(--line-faint)]">
                <span className="type-meta text-[10px] text-[var(--dim)] block mb-1">Canvas Particles</span>
                <span className="type-mono text-[10px] text-[var(--verdigris)] font-medium">
                  {motion.tier === "T3" ? "Active (24)" : "Suppressed"}
                </span>
              </div>
            </div>
          </div>

          {/* Telemetry info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-[var(--line-faint)]">
            <div className="p-2.5 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
              <span className="type-label text-[var(--dim)] block text-[11px]">Hardware / Governor Mode</span>
              <span className="type-mono-sm text-[var(--bone)] font-mono">
                {(motion.mode || "auto").toUpperCase()} ({motion.reducedMotion ? "prefers-reduced-motion active" : "standard display"})
              </span>
            </div>
            <div className="p-2.5 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
              <span className="type-label text-[var(--dim)] block text-[11px]">Active FPS Sample</span>
              <span className="type-mono-sm text-[var(--bone)] font-mono">
                {motion.fps} FPS (rolling 2s mean)
              </span>
            </div>
            <div className="p-2.5 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
              <span className="type-label text-[var(--dim)] block text-[11px]">Canvas DPR Cap</span>
              <span className="type-mono-sm text-[var(--bone)] font-mono">
                {motion.dprCap}x resolution
              </span>
            </div>
          </div>

          {/* Optional audio feedback toggle (§M7.9, §M9) */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--line-faint)]">
            <div>
              <span className="type-body font-medium text-[var(--bone)] text-sm block">
                Synthesized Audio Detents (§M9)
              </span>
              <span className="type-meta text-[var(--dim)] text-xs">
                WebAudio-synthesized tactile feedback for stepper, chip pops, and answer completion (off by default)
              </span>
            </div>
            <DetentPress>
              <button
                type="button"
                data-testid="sound-toggle-btn"
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  setAudioEnabled(next);
                  if (next) {
                    playDetent();
                  }
                }}
                className={`w-11 h-6 rounded-full transition-colors duration-[120ms] p-1 flex items-center cursor-pointer ${
                  soundEnabled ? "bg-[var(--verdigris)]" : "bg-[var(--ink-700)]"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-[var(--ink-900)] transition-transform duration-[120ms] ${
                    soundEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </DetentPress>
          </div>

          {/* Replay boot sequence ghost button (§M7.9) */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--line-faint)]">
            <div>
              <span className="type-body font-medium text-[var(--bone)] text-sm block">
                Session Boot Sequence
              </span>
              <span className="type-meta text-[var(--dim)] text-xs">
                Replay the instrument ignition animation (§M6.1) on next page visit
              </span>
            </div>
            <DetentPress className="inline-flex">
              <button
                type="button"
                data-testid="replay-boot-btn"
                onClick={() => {
                  sessionStorage.removeItem("vg_booted");
                  window.dispatchEvent(new CustomEvent("vitagraph:replay-boot"));
                  if (isAudioEnabled()) {
                    playDetent();
                  }
                  transitionNavigate(navigate, "/", { direction: "back" });
                }}
                className="px-3 py-1.5 rounded-[var(--r-6)] border border-[var(--line-strong)] hover:border-[var(--verdigris)] text-[var(--bone)] type-mono-sm text-xs transition-colors cursor-pointer"
              >
                Replay Boot
              </button>
            </DetentPress>
          </div>
        </div>
      </div>
    </div>
  );
};
