import React, { useState, useRef } from "react";
import {
  Odometer,
  WashSweep,
  useMotionGovernor,
  isReducedMotion,
  flip,
  playDetent,
  playChime,
  playThud,
  isAudioEnabled,
  setAudioEnabled,
} from "../../motion";
import { Button } from "./Buttons";
import { Badge } from "./Badge";
import { LED } from "./LED";

export const MotionSpecimensSection: React.FC = () => {
  const motion = useMotionGovernor();
  const isT0 = motion.tier === "T0" || isReducedMotion();

  // M5.1 Enter/Exit state
  const [enterVisible, setEnterVisible] = useState(true);
  const [enterStyle, setEnterStyle] = useState<"standard" | "card">("standard");

  // M5.2 Morph state
  const [isExpanded, setIsExpanded] = useState(false);
  const morphCardRef = useRef<HTMLDivElement>(null);

  // M5.3 Draw state
  const [drawKey, setDrawKey] = useState(0);

  // M5.4 Impulse state
  const [isImpulsing, setIsImpulsing] = useState(false);

  // M5.5 Odometer state
  const odoValues = [94.2, 1248, 412, 18.5];
  const [odoIdx, setOdoIdx] = useState(0);

  // M5.6 Reveal-mask state
  const [maskKey, setMaskKey] = useState(0);

  // M9 Audio states
  const [soundOn, setSoundOn] = useState(() => isAudioEnabled());
  const [audioFeedbackText, setAudioFeedbackText] = useState("Ready");
  const [activeAudioSpecimen, setActiveAudioSpecimen] = useState<string | null>(null);

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setAudioEnabled(next);
    if (next) {
      playDetent();
      setAudioFeedbackText("Audio enabled (1200Hz detent)");
    } else {
      setAudioFeedbackText("Audio muted (default off)");
    }
  };

  const handlePlayDetent = () => {
    setActiveAudioSpecimen("detent");
    const played = playDetent();
    setAudioFeedbackText(
      played
        ? "Played: 1200 Hz triangle (15ms, gain 0.03)"
        : soundOn
        ? "Blocked (T0 or tab hidden)"
        : "Silenced: Audio disabled (off by default)"
    );
    setTimeout(() => setActiveAudioSpecimen(null), 200);
  };

  const handlePlayChime = () => {
    setActiveAudioSpecimen("chime");
    const played = playChime();
    setAudioFeedbackText(
      played
        ? "Played: 660→990 Hz sine pair (120ms, gain 0.04)"
        : soundOn
        ? "Blocked (T0 or tab hidden)"
        : "Silenced: Audio disabled (off by default)"
    );
    setTimeout(() => setActiveAudioSpecimen(null), 200);
  };

  const handlePlayThud = () => {
    setActiveAudioSpecimen("thud");
    const played = playThud();
    setAudioFeedbackText(
      played
        ? "Played: 220 Hz sine (80ms, gain 0.03)"
        : soundOn
        ? "Blocked (T0 or tab hidden)"
        : "Silenced: Audio disabled (off by default)"
    );
    setTimeout(() => setActiveAudioSpecimen(null), 200);
  };

  const handleMorphToggle = () => {
    if (morphCardRef.current && !isT0) {
      flip(
        morphCardRef.current,
        () => {
          setIsExpanded((prev) => !prev);
        },
        { spring: "weighted", capMs: 240 }
      );
    } else {
      setIsExpanded((prev) => !prev);
    }
    playDetent();
  };

  const handleTriggerImpulse = () => {
    if (isT0) return;
    setIsImpulsing(true);
    playThud();
    setTimeout(() => setIsImpulsing(false), 240);
  };

  return (
    <section
      data-testid="motion-specimens-section"
      className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] space-y-8"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[var(--line-strong)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="type-mono-sm px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-700)] text-[var(--verdigris)] border border-[var(--line-strong)]">
              SECTION 27
            </span>
            <span className="type-mono-sm text-[var(--dim)]">·</span>
            <span className="type-mono-sm text-[var(--bone)] font-medium">
              Motion Specimens & Audio Detents (§M5, §M9, DESIGN §13)
            </span>
          </div>
          <h2 className="type-title text-lg text-[var(--bone)]">
            VitaGraph Motion & Feedback Specimens
          </h2>
          <p className="type-meta text-xs text-[var(--dim)] mt-0.5">
            Every §M5 animation primitive showcased with its frozen token and easing curve. WebAudio synthesizer specimens with multi-channel visual redundancy (Gate 31).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-[var(--r-4)] bg-[var(--ink-900)] border border-[var(--line-strong)]">
            <LED color="verdigris" live={motion.tier === "T3"} />
            <span className="type-mono-sm text-[var(--bone)]">
              Tier: <strong className="text-[var(--verdigris)]">{motion.tier}</strong>
            </span>
          </div>
          <button
            type="button"
            data-testid="gallery-sound-toggle"
            onClick={handleToggleSound}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-[var(--r-4)] border text-xs font-mono transition-colors cursor-pointer ${
              soundOn
                ? "bg-[var(--verdigris)]/10 text-[var(--verdigris)] border-[var(--verdigris)]"
                : "bg-[var(--ink-900)] text-[var(--dim)] border-[var(--line-strong)]"
            }`}
          >
            <span>{soundOn ? "🔊 Audio ON" : "🔇 Audio OFF"}</span>
          </button>
        </div>
      </div>

      {/* Token & Easings Index Table */}
      <div className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)]">
        <div className="type-mono-sm text-[var(--dim)] mb-3 uppercase tracking-wider text-[11px]">
          Frozen Timing Tokens & Named Easings (§M2)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
          {[
            { token: "--m-instant", ms: "80ms", desc: "Micro-press" },
            { token: "--m-quick", ms: "180ms", desc: "Standard Enter" },
            { token: "--m-base", ms: "240ms", desc: "Cards & FLIP" },
            { token: "--m-settle", ms: "300ms", desc: "Odometer roll" },
            { token: "--m-deliberate", ms: "360ms", desc: "Draw & Mask" },
            { token: "--m-cinematic", ms: "480ms", desc: "Needle sweep" },
            { token: "--m-ring", ms: "1200ms", desc: "Pulse Ring" },
            { token: "--m-breathe", ms: "2400ms", desc: "LED breathe" },
          ].map((item) => (
            <div
              key={item.token}
              className="p-2 rounded-[var(--r-4)] bg-[var(--ink-800)] border border-[var(--line-faint)] flex flex-col justify-between"
            >
              <span className="type-mono-sm font-mono text-[var(--verdigris)] text-[11px]">
                {item.token}
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="type-mono text-[var(--bone)] font-semibold text-xs">
                  {item.ms}
                </span>
                <span className="type-meta text-[var(--dim)] text-[10px]">
                  {item.desc}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mt-3 pt-3 border-t border-[var(--line-faint)]">
          {[
            { name: "--ease-servo", spring: "snappy", curve: "0.2, 0.9, 0.3, 1.0" },
            { name: "--ease-weighted", spring: "weighted", curve: "0.25, 0.1, 0.25, 1.0" },
            { name: "--ease-camera", spring: "camera", curve: "0.16, 1.0, 0.3, 1.0" },
            { name: "--ease-paper", spring: "paper", curve: "0.18, 0.89, 0.32, 1.0" },
            { name: "--ease-needle", spring: "needle", curve: "0.22, 1.0, 0.36, 1.0" },
            { name: "--ease-ink", spring: "ink", curve: "0.4, 0.0, 0.2, 1.0" },
          ].map((item) => (
            <div
              key={item.name}
              className="p-2 rounded-[var(--r-4)] bg-[var(--ink-800)] border border-[var(--line-faint)]"
            >
              <div className="type-mono-sm font-mono text-[var(--bone)] text-[11px]">
                {item.name}
              </div>
              <div className="type-meta text-[var(--verdigris)] text-[10px] mt-0.5">
                spring: {item.spring}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Specimens Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Specimen M5.1: Enter / Exit */}
        <div
          data-testid="specimen-enter-exit"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.1 Enter / Exit
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-quick (180ms) / --m-base (240ms)
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Standard data surfaces rise 8px with <code>--m-quick servo</code>; cards scale with <code>--m-base paper</code>; exits are 60% duration with <code>ink</code>.
            </p>

            <div className="h-24 flex items-center justify-center bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3">
              {enterVisible ? (
                <div
                  key={`${enterStyle}-${enterVisible}`}
                  className={`p-3 rounded-[var(--r-6)] border border-[var(--verdigris)] bg-[var(--ink-700)] text-xs text-[var(--bone)] flex items-center gap-3 ${
                    enterStyle === "standard"
                      ? "animate-slide-up"
                      : "animate-card-enter"
                  }`}
                >
                  <LED color="verdigris" />
                  <span>
                    Surface Active ({enterStyle === "standard" ? "--m-quick servo" : "--m-base paper"})
                  </span>
                </div>
              ) : (
                <span className="type-meta text-xs text-[var(--dim)]">
                  Surface Exited (Unmounted)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--line-faint)]">
            <Button
              variant="ghost"
              onClick={() => {
                setEnterStyle("standard");
                setEnterVisible((v) => !v);
                playDetent();
              }}
            >
              Toggle Standard Enter
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEnterStyle("card");
                setEnterVisible((v) => !v);
                playDetent();
              }}
            >
              Toggle Card Enter
            </Button>
          </div>
        </div>

        {/* Specimen M5.2: Morph (Shared Element) */}
        <div
          data-testid="specimen-morph"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.2 Morph (Shared Element)
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-base (240ms) weighted
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              First-Last-Invert-Play with <code>weighted</code> spring; single forced reflow at measure; zero mid-flight layout reads.
            </p>

            <div className="h-24 flex items-center justify-center bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 overflow-hidden">
              <div
                ref={morphCardRef}
                className={`transition-colors rounded-[var(--r-6)] border cursor-pointer ${
                  isExpanded
                    ? "w-full p-3 bg-[var(--ink-700)] border-[var(--verdigris)]"
                    : "px-3 py-1.5 bg-[var(--ink-900)] border-[var(--line-strong)]"
                }`}
                onClick={handleMorphToggle}
              >
                {isExpanded ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="type-mono-sm text-[var(--verdigris)] font-medium">
                        Patient Bio-Summary #042
                      </span>
                      <Badge variant="verdigris">FLIP Active</Badge>
                    </div>
                    <div className="text-[11px] text-[var(--bone)]">
                      Hemoglobin: 14.2 g/dL · Fasting Glucose: 92 mg/dL · Grounded
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LED color="verdigris" />
                    <span className="type-mono-sm text-xs text-[var(--bone)]">
                      Bio-Summary #042 (Click to Morph)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)]">
              State: {isExpanded ? "Expanded Sheet" : "Compact Chip"}
            </span>
            <Button variant="ghost" onClick={handleMorphToggle}>
              {isExpanded ? "Collapse to Chip" : "Expand via FLIP"}
            </Button>
          </div>
        </div>

        {/* Specimen M5.3: Draw (Paths & Fills) */}
        <div
          data-testid="specimen-draw"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.3 Draw (Paths & Fills)
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-deliberate (360ms) / --m-cinematic (480ms)
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              SVG <code>stroke-dashoffset</code> reveals; stage connectors fill with honest 4px traveling work-dot while active.
            </p>

            <div className="h-24 flex items-center justify-around bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3">
              {/* Checkmark draw */}
              <div className="flex flex-col items-center gap-1">
                <svg
                  key={`check-${drawKey}`}
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--verdigris)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={!isT0 ? "animate-check-draw" : ""}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="type-meta text-[10px] text-[var(--dim)]">Check Draw</span>
              </div>

              {/* Sparkline Needle */}
              <div className="flex flex-col items-center gap-1">
                <svg
                  key={`spark-${drawKey}`}
                  width="70"
                  height="28"
                  viewBox="0 0 70 28"
                  fill="none"
                  stroke="var(--verdigris)"
                  strokeWidth="2"
                  className={!isT0 ? "animate-needle-draw" : ""}
                >
                  <path d="M 2 20 Q 20 5, 35 15 T 68 8" />
                </svg>
                <span className="type-meta text-[10px] text-[var(--dim)]">Needle Draw</span>
              </div>

              {/* Connector + Work-dot */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-1.5 bg-[var(--ink-700)] rounded-full relative overflow-hidden">
                  <div
                    key={`conn-${drawKey}`}
                    className="h-full bg-[var(--verdigris)] origin-left animate-connector-fill"
                  />
                  <div className="absolute top-0 bottom-0 w-2 bg-[var(--bone)] rounded-full animate-work-dot" />
                </div>
                <span className="type-meta text-[10px] text-[var(--dim)]">Connector + Dot</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)]">
              Path Length Re-evaluated
            </span>
            <Button
              variant="ghost"
              onClick={() => {
                setDrawKey((k) => k + 1);
                playDetent();
              }}
            >
              Replay Draw
            </Button>
          </div>
        </div>

        {/* Specimen M5.4: Press & Impulse */}
        <div
          data-testid="specimen-impulse"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.4 Press & Impulse
              </span>
              <span className="type-mono-sm text-[var(--madder)]">
                --m-base (240ms) ±2px impulse
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Snappy spring to scale 0.985 on press; refusal / failure cards execute critically damped ±2px impulse with single-pass <code>WashSweep</code>.
            </p>

            <div
              className={`relative overflow-hidden h-24 flex items-center justify-center bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 ${
                isImpulsing ? "animate-impulse border-[var(--madder)]" : ""
              }`}
            >
              {isImpulsing && <WashSweep color="var(--madder)" />}
              <div className="flex items-center gap-2">
                <LED color={isImpulsing ? "madder" : "ochre"} />
                <span className="type-mono-sm text-xs text-[var(--bone)] font-mono">
                  {isImpulsing ? "Clinical Boundary Violation" : "Interactive Feedback Surface"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--line-faint)]">
            <Button
              variant="ghost"
              onClick={() => playDetent()}
              className="active:scale-[0.985] active:translate-y-[1px]"
            >
              Press Feedback (-1px)
            </Button>
            <Button variant="outline-danger" onClick={handleTriggerImpulse}>
              Trigger Card Impulse
            </Button>
          </div>
        </div>

        {/* Specimen M5.5: Count-up (Odometer) */}
        <div
          data-testid="specimen-odometer"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.5 Count-up (Odometer)
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-settle (300ms) needle
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Precision needle-curve digit roll with <code>tabular-nums</code>, exact endpoint guarantee, and test hook <code>data-odo-final</code>.
            </p>

            <div className="h-24 flex items-center justify-around bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3">
              <div className="text-center">
                <div className="type-display text-2xl font-mono text-[var(--verdigris)]">
                  <Odometer
                    value={odoValues[odoIdx]}
                    duration={300}
                    decimals={odoValues[odoIdx] % 1 !== 0 ? 1 : 0}
                    testId="gallery-specimen-odo"
                  />
                </div>
                <div className="type-meta text-[10px] text-[var(--dim)] mt-1">
                  Target: {odoValues[odoIdx]}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)]">
              assert(finalValue === input)
            </span>
            <Button
              variant="ghost"
              onClick={() => {
                setOdoIdx((idx) => (idx + 1) % odoValues.length);
                playDetent();
              }}
            >
              Roll Next Value
            </Button>
          </div>
        </div>

        {/* Specimen M5.6: Reveal-Mask */}
        <div
          data-testid="specimen-reveal-mask"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.6 Reveal-Mask
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-deliberate (360ms) ink
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Arrived prose reveals via <code>clip-path: inset(0 0 100% 0) → inset(0)</code>; never applied char-by-char to raw streaming tokens.
            </p>

            <div className="h-24 flex items-center justify-center bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3">
              <div
                key={`mask-${maskKey}`}
                className={!isT0 ? "animate-reveal-mask" : ""}
              >
                <p className="type-body text-xs text-[var(--bone)] italic">
                  &ldquo;Serum hemoglobin levels remained stable across all 3 observation points without requiring therapeutic adjustment.&rdquo;
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)]">
              Easing: var(--ease-ink)
            </span>
            <Button
              variant="ghost"
              onClick={() => {
                setMaskKey((k) => k + 1);
                playDetent();
              }}
            >
              Replay Mask Reveal
            </Button>
          </div>
        </div>
      </div>

      {/* Audio Detents Synthesizer (§M9, Gate 31) */}
      <div
        data-testid="specimen-audio-section"
        className="p-5 rounded-[var(--r-10)] bg-[var(--ink-900)] border border-[var(--line-strong)] space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--line-faint)]">
          <div className="flex items-center gap-2">
            <span className="type-mono-sm text-[var(--verdigris)] font-medium">
              M9. Synthesized WebAudio Detents
            </span>
            <span className="type-meta text-[var(--dim)] text-xs">
              (Zero audio files, persisted toggle, muted when tab hidden, hard-disabled at T0)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="type-mono-sm text-xs px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-800)] border border-[var(--line-faint)]"
              aria-live="polite"
              data-testid="audio-status-feedback"
            >
              {audioFeedbackText}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Detent specimen */}
          <div
            className={`p-3 rounded-[var(--r-6)] border bg-[var(--ink-800)] transition-colors ${
              activeAudioSpecimen === "detent"
                ? "border-[var(--verdigris)] bg-[var(--verdigris)]/10"
                : "border-[var(--line-faint)]"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="type-mono-sm text-[var(--bone)] font-medium">1. Detent</span>
              <Badge variant="verdigris">1200 Hz Triangle</Badge>
            </div>
            <p className="type-meta text-[11px] text-[var(--dim)] mb-3">
              15 ms exponential decay, gain 0.03. Used for stepper complete, chip pop, and button detents.
            </p>
            <Button
              variant="ghost"
              onClick={handlePlayDetent}
              className="w-full"
              data-testid="specimen-play-detent"
            >
              Play Detent
            </Button>
          </div>

          {/* 2. Chime specimen */}
          <div
            className={`p-3 rounded-[var(--r-6)] border bg-[var(--ink-800)] transition-colors ${
              activeAudioSpecimen === "chime"
                ? "border-[var(--cornflower)] bg-[var(--cornflower)]/10"
                : "border-[var(--line-faint)]"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="type-mono-sm text-[var(--bone)] font-medium">2. Chime</span>
              <Badge variant="cornflower">660→990 Hz Pair</Badge>
            </div>
            <p className="type-meta text-[11px] text-[var(--dim)] mb-3">
              120 ms harmonic sine chord, gain 0.04. Used for answer done and job completion.
            </p>
            <Button
              variant="ghost"
              onClick={handlePlayChime}
              className="w-full"
              data-testid="specimen-play-chime"
            >
              Play Chime
            </Button>
          </div>

          {/* 3. Thud specimen */}
          <div
            className={`p-3 rounded-[var(--r-6)] border bg-[var(--ink-800)] transition-colors ${
              activeAudioSpecimen === "thud"
                ? "border-[var(--madder)] bg-[var(--madder)]/10"
                : "border-[var(--line-faint)]"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="type-mono-sm text-[var(--bone)] font-medium">3. Thud</span>
              <Badge variant="madder">220 Hz Sine</Badge>
            </div>
            <p className="type-meta text-[11px] text-[var(--dim)] mb-3">
              80 ms exponential decay, gain 0.03. Used for diagnostic refusal, quarantine, and error.
            </p>
            <Button
              variant="outline-danger"
              onClick={handlePlayThud}
              className="w-full"
              data-testid="specimen-play-thud"
            >
              Play Thud
            </Button>
          </div>
        </div>

        <div className="pt-2 text-center">
          <p className="type-meta text-[11px] text-[var(--dim)]">
            <strong>Gate 31 Compliance:</strong> Audio is strictly redundant. Every auditory event is paired with a visual badge, LED state, or text change and announced to screen readers via <code>aria-live</code>.
          </p>
        </div>
      </div>
    </section>
  );
};
