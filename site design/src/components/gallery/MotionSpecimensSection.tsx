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
  governor,
  ticker,
  Sequence,
  DrawPath,
  PulseRing,
  UnderlineDraw,
  CrossfadeContainer,
} from "../../motion";
import { Button } from "./Buttons";
import { Badge } from "./Badge";
import { LED } from "./LED";

interface ReasoningStep {
  id: string;
  label: string;
  badgeVariant: "verdigris" | "cornflower" | "ochre" | "dim";
  meta: string;
}

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

  // M5.7 Node -> Detail Morph state
  const [nodeMorphExpanded, setNodeMorphExpanded] = useState(false);
  const nodeMorphRef = useRef<HTMLDivElement>(null);

  // M5.8 Stepper stage state
  const [stepperStage, setStepperStage] = useState(0);

  // M5.9 Reasoning reveal state
  const [reasoningRows, setReasoningRows] = useState<ReasoningStep[]>([]);
  const [reasoningStreaming, setReasoningStreaming] = useState(false);

  // M5.10 Chart tween state
  const [chartPreset, setChartPreset] = useState<"A" | "B" | "C">("A");
  const [chartRingPct, setChartRingPct] = useState(52);
  const [chartRingOffset, setChartRingOffset] = useState(126);
  const [chartBarPct, setChartBarPct] = useState(78);

  // M5.11 KPI counter state
  const [kpiValue, setKpiValue] = useState(142);
  const [kpiTrend, setKpiTrend] = useState<"up" | "down" | "none">("none");
  const [kpiWashActive, setKpiWashActive] = useState(false);

  // M5.12 Skeleton crossfade state
  const [skeletonLoading, setSkeletonLoading] = useState(false);

  // M5.13 Focus+Context state
  const [evidenceHighlight, setEvidenceHighlight] = useState(false);

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

  const handleNodeMorphToggle = () => {
    if (nodeMorphRef.current && !isT0) {
      flip(
        nodeMorphRef.current,
        () => {
          setNodeMorphExpanded((prev) => !prev);
        },
        { spring: "weighted", capMs: 240 }
      );
    } else {
      setNodeMorphExpanded((prev) => !prev);
    }
    playDetent();
  };

  const handleAdvanceStepper = () => {
    setStepperStage((s) => (s + 1) % 3);
    playDetent();
  };

  const handleSimulateReasoning = () => {
    setReasoningRows([]);
    setReasoningStreaming(true);

    const steps: ReasoningStep[] = [
      { id: "1", label: "Vector Index Scan", badgeVariant: "verdigris", meta: "1,024 vectors" },
      { id: "2", label: "Cross-Encoder Rerank", badgeVariant: "cornflower", meta: "top-5 chunks" },
      { id: "3", label: "Graph Traversal", badgeVariant: "ochre", meta: "+8 entities" },
      { id: "4", label: "Evidence Grounding", badgeVariant: "dim", meta: "98.4% grounded" },
    ];

    if (isT0) {
      setReasoningRows(steps);
      setReasoningStreaming(false);
      return;
    }

    const seq = new Sequence();
    steps.forEach((step, idx) => {
      seq.addAction(() => {
        setReasoningRows((prev) => [...prev, step]);
        playDetent();
      }, idx === 0 ? 0 : 90);
    });

    seq.addAction(() => {
      setReasoningStreaming(false);
      playChime();
    }, 60);

    seq.play();
  };

  const handleChartPreset = (p: "A" | "B" | "C") => {
    setChartPreset(p);
    playDetent();
    if (p === "A") {
      setChartRingPct(52);
      setChartRingOffset(126);
      setChartBarPct(78);
    } else if (p === "B") {
      setChartRingPct(80);
      setChartRingOffset(53);
      setChartBarPct(42);
    } else {
      setChartRingPct(24);
      setChartRingOffset(200);
      setChartBarPct(95);
    }
  };

  const handleKpiShift = (delta: number, trend: "up" | "down") => {
    setKpiValue((v) => Math.max(10, v + delta));
    setKpiTrend(trend);
    setKpiWashActive(true);
    playDetent();
    setTimeout(() => setKpiWashActive(false), 240);
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

        <div className="flex flex-wrap items-center gap-3">
          {/* Interactive Tier Override Controller (§7.13-C) */}
          <div className="flex items-center gap-1 bg-[var(--ink-900)] p-1 rounded-[var(--r-6)] border border-[var(--line-strong)]">
            <span className="type-meta text-[11px] text-[var(--dim)] px-1.5 font-mono">Tier:</span>
            {(["auto", "T3", "T2", "T1", "T0"] as const).map((t) => (
              <button
                key={t}
                type="button"
                data-testid={`gallery-tier-${t.toLowerCase()}`}
                onClick={() => {
                  governor.setOverride(t);
                  playDetent();
                }}
                className={`px-2 py-0.5 rounded-[var(--r-4)] text-[11px] font-mono transition-colors cursor-pointer ${
                  motion.mode === (t === "auto" ? "auto" : "manual") && (t === "auto" || motion.tier === t)
                    ? "bg-[var(--verdigris)] text-[var(--ink-900)] font-bold"
                    : "text-[var(--dim)] hover:text-[var(--bone)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 rounded-[var(--r-4)] bg-[var(--ink-900)] border border-[var(--line-strong)]">
            <LED color="verdigris" live={motion.tier === "T3"} />
            <span className="type-mono-sm text-[var(--bone)] text-xs">
              {motion.tier} · {Math.round(ticker.getRollingFps())} fps
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

        {/* Specimen M5.7: Node -> Detail Morph (FLIP) */}
        <div
          data-testid="specimen-node-morph"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.7 Node → Detail Morph
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-base (240ms) weighted spring
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Shared-element FLIP morph between graph node anchor and expanded entity sheet without layout reflows.
            </p>

            <div className="h-32 flex items-center justify-center bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 overflow-hidden">
              <div
                ref={nodeMorphRef}
                className={`transition-colors rounded-[var(--r-6)] border ${
                  nodeMorphExpanded
                    ? "w-full p-3 bg-[var(--ink-900)] border-[var(--verdigris)] space-y-1.5"
                    : "px-3 py-1.5 bg-[var(--ink-700)] border-[var(--line-strong)] flex items-center gap-2 cursor-pointer"
                }`}
                onClick={!nodeMorphExpanded ? handleNodeMorphToggle : undefined}
              >
                {nodeMorphExpanded ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <LED color="verdigris" />
                        <span className="type-mono-sm text-xs text-[var(--bone)] font-semibold">
                          EGFR (Epidermal Growth Factor)
                        </span>
                      </div>
                      <Badge variant="verdigris">Biomarker</Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--dim)] font-mono pt-1 border-t border-[var(--line-faint)]">
                      <span>Conf: 99.4%</span>
                      <span>Degree: 14 edges</span>
                      <span>Chr: 7p11.2</span>
                    </div>
                  </>
                ) : (
                  <>
                    <LED color="verdigris" />
                    <span className="type-mono-sm text-xs text-[var(--bone)]">
                      EGFR
                    </span>
                    <Badge variant="dim">Node #14</Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)]">
              State: {nodeMorphExpanded ? "Expanded Sheet" : "Collapsed Node"}
            </span>
            <Button
              variant="ghost"
              onClick={handleNodeMorphToggle}
            >
              {nodeMorphExpanded ? "Collapse to Node" : "Expand to Sheet"}
            </Button>
          </div>
        </div>

        {/* Specimen M5.8: Stepper Stage Handoff */}
        <div
          data-testid="specimen-stepper-handoff"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.8 Stepper Stage Handoff
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-deliberate / PulseRing
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Choreographed pipeline stage handoff: connector fill, arriving node PulseRing, and state transition.
            </p>

            <div className="h-32 flex items-center justify-around bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3">
              {[
                { label: "Received", idx: 0 },
                { label: "Extracting", idx: 1 },
                { label: "Indexed", idx: 2 },
              ].map((step, idx) => {
                const isPassed = stepperStage > step.idx;
                const isCurrent = stepperStage === step.idx;
                return (
                  <React.Fragment key={step.idx}>
                    {idx > 0 && (
                      <div className="flex-1 h-0.5 mx-1 relative bg-[var(--ink-700)] overflow-hidden">
                        <div
                          className={`h-full bg-[var(--verdigris)] origin-left transition-transform duration-[360ms] ${
                            stepperStage >= step.idx ? "scale-x-100" : "scale-x-0"
                          }`}
                        />
                      </div>
                    )}
                    <div className="relative flex flex-col items-center gap-1.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center border font-mono text-xs relative ${
                          isPassed
                            ? "bg-[var(--verdigris)] border-[var(--verdigris)] text-[var(--ink-950)]"
                            : isCurrent
                            ? "bg-[var(--ink-900)] border-[var(--verdigris)] text-[var(--verdigris)]"
                            : "bg-[var(--ink-900)] border-[var(--line-strong)] text-[var(--dim)]"
                        }`}
                      >
                        {isCurrent && !isT0 && (
                          <PulseRing color="verdigris" className="absolute -inset-1" />
                        )}
                        {isPassed ? "✓" : step.idx + 1}
                      </div>
                      <span className="type-meta text-[10px] text-[var(--dim)] font-mono">
                        {step.label}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Stage: {stepperStage + 1} of 3
            </span>
            <Button
              variant="ghost"
              onClick={handleAdvanceStepper}
            >
              Advance Stage
            </Button>
          </div>
        </div>

        {/* Specimen M5.9: Staged Reasoning Reveal */}
        <div
          data-testid="specimen-reasoning-reveal"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.9 Staged Reasoning Reveal
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                Sequence (60ms) + UnderlineDraw
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Event-gated Sequence execution: staggered row reveals with chip pops and precision evidence underlines.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-2.5 overflow-y-auto space-y-1.5">
              {reasoningRows.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-[var(--dim)] font-mono">
                  Press simulate to stream reasoning steps
                </div>
              ) : (
                reasoningRows.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between px-2 py-1 rounded-[var(--r-4)] bg-[var(--ink-900)] border border-[var(--line-faint)] animate-chip-pop"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={r.badgeVariant}>{`0${r.id}`}</Badge>
                      <UnderlineDraw color={r.badgeVariant === "dim" ? "var(--dim)" : `var(--${r.badgeVariant})`}>
                        <span className="type-mono-sm text-xs text-[var(--bone)]">
                          {r.label}
                        </span>
                      </UnderlineDraw>
                    </div>
                    <span className="type-meta text-[11px] text-[var(--dim)] font-mono tabular-nums">
                      {r.meta}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              {reasoningStreaming ? "Streaming..." : `${reasoningRows.length} steps resolved`}
            </span>
            <Button
              variant="ghost"
              disabled={reasoningStreaming}
              onClick={handleSimulateReasoning}
            >
              Simulate Stream
            </Button>
          </div>
        </div>

        {/* Specimen M5.10: Chart & Data Tweening */}
        <div
          data-testid="specimen-chart-tween"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.10 Chart & Data Tweening
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-settle (480ms) needle
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              SVG progress ring strokeDashoffset and horizontal bar scaleX tween across presets without DOM destruction.
            </p>

            <div className="h-32 flex items-center justify-around bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3">
              {/* Radial Meter */}
              <div className="flex flex-col items-center gap-1">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="var(--ink-700)"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="var(--verdigris)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray="264"
                      strokeDashoffset={chartRingOffset}
                      style={{
                        transition: isT0 ? "none" : "stroke-dashoffset var(--m-settle) var(--ease-needle)",
                      }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-semibold text-[var(--bone)] tabular-nums">
                    <Odometer value={chartRingPct} />%
                  </div>
                </div>
                <span className="type-meta text-[10px] text-[var(--dim)] font-mono">Modularity Q</span>
              </div>

              {/* Bar Meter */}
              <div className="flex-1 max-w-[120px] flex flex-col gap-1.5">
                <div className="flex justify-between type-meta text-[10px] text-[var(--dim)] font-mono">
                  <span>Hub Density</span>
                  <span className="tabular-nums"><Odometer value={chartBarPct} />%</span>
                </div>
                <div className="w-full h-2 bg-[var(--ink-700)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--cornflower)] rounded-full origin-left"
                    style={{
                      transform: `scaleX(${chartBarPct / 100})`,
                      transition: isT0 ? "none" : "transform var(--m-settle) var(--ease-needle)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Preset: {chartPreset}
            </span>
            <div className="flex items-center gap-1">
              {(["A", "B", "C"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleChartPreset(p)}
                  className={`h-7 px-2.5 rounded-[var(--r-4)] text-xs font-mono transition-colors cursor-pointer border ${
                    chartPreset === p
                      ? "bg-[var(--verdigris)] text-[var(--ink-900)] border-[var(--verdigris)] font-semibold"
                      : "bg-[var(--ink-700)] text-[var(--bone)] border-[var(--line-strong)] hover:bg-[var(--ink-600)]"
                  }`}
                >
                  Preset {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Specimen M5.11: KPI Value Impulse */}
        <div
          data-testid="specimen-kpi-impulse"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.11 KPI Value Impulse
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-settle needle + WashSweep
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Value change triggers digit roll, single-pass WashSweep highlight, and directional glyph nudge.
            </p>

            <div className="h-32 relative flex flex-col items-center justify-center bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 overflow-hidden">
              <WashSweep
                active={kpiWashActive}
                color={kpiTrend === "up" ? "var(--verdigris)" : "var(--madder)"}
              />
              <div className="flex items-baseline gap-2">
                <span className="type-mono text-2xl font-bold text-[var(--bone)] tabular-nums">
                  <Odometer value={kpiValue} />
                </span>
                <span className="type-mono text-sm text-[var(--dim)] font-mono">ms</span>
                {kpiTrend !== "none" && (
                  <span
                    key={`${kpiValue}-${kpiTrend}`}
                    className={`font-mono text-sm font-bold ${
                      kpiTrend === "up"
                        ? "text-[var(--verdigris)] animate-arrow-nudge-up"
                        : "text-[var(--madder)] animate-arrow-nudge-down"
                    }`}
                  >
                    {kpiTrend === "up" ? "↑" : "↓"}
                  </span>
                )}
              </div>
              <span className="type-meta text-[10px] text-[var(--dim)] font-mono mt-1">
                P95 Latency Telemetry
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Trend: {kpiTrend.toUpperCase()}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleKpiShift(15, "up")}
                className="h-7 px-2.5 rounded-[var(--r-4)] text-xs font-mono text-[var(--bone)] border border-[var(--line-strong)] bg-[var(--ink-700)] hover:bg-[var(--ink-600)] cursor-pointer"
              >
                +15 ms
              </button>
              <button
                type="button"
                onClick={() => handleKpiShift(-20, "down")}
                className="h-7 px-2.5 rounded-[var(--r-4)] text-xs font-mono text-[var(--bone)] border border-[var(--line-strong)] bg-[var(--ink-700)] hover:bg-[var(--ink-600)] cursor-pointer"
              >
                -20 ms
              </button>
            </div>
          </div>
        </div>

        {/* Specimen M5.12: Skeleton Crossfade */}
        <div
          data-testid="specimen-skeleton-crossfade"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.12 Skeleton Crossfade
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-base CrossfadeContainer
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Zero-layout-shift crossfade from skeleton shimmer to loaded entity surface using unified CrossfadeContainer.
            </p>

            <div className="h-32 flex items-center justify-center bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3">
              <CrossfadeContainer
                loading={skeletonLoading}
                className="w-full"
                skeleton={
                  <div className="space-y-2 p-2 rounded-[var(--r-4)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
                    <div className="h-3 w-3/4 rounded skeleton-shimmer" />
                    <div className="h-2.5 w-1/2 rounded skeleton-shimmer" />
                    <div className="h-2 w-full rounded skeleton-shimmer" />
                  </div>
                }
              >
                <div className="p-2 rounded-[var(--r-4)] bg-[var(--ink-900)] border border-[var(--line-strong)] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="type-mono-sm text-xs text-[var(--bone)] font-semibold">
                      Chroma Vector Partition
                    </span>
                    <Badge variant="verdigris">Active</Badge>
                  </div>
                  <p className="type-meta text-[11px] text-[var(--dim)] font-mono">
                    1,024 chunks embedded with all-MiniLM-L6-v2
                  </p>
                </div>
              </CrossfadeContainer>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Status: {skeletonLoading ? "Loading" : "Loaded"}
            </span>
            <Button
              variant="ghost"
              onClick={() => {
                setSkeletonLoading((l) => !l);
                playDetent();
              }}
            >
              Toggle Loading
            </Button>
          </div>
        </div>

        {/* Specimen M5.13: Focus + Context Graph Fade */}
        <div
          data-testid="specimen-focus-context"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.13 Focus + Context Graph Fade
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-base weighted spring (0.40 dim)
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Evidence activation dims non-evidence nodes/edges to exactly 0.40 opacity while highlighting the focal subgraph.
            </p>

            <div className="h-32 flex items-center justify-around bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3">
              {/* Evidence Node A */}
              <div className="relative flex flex-col items-center gap-1">
                {evidenceHighlight && !isT0 && (
                  <PulseRing color="verdigris" className="absolute -inset-1" />
                )}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs border transition-opacity duration-[240ms] ${
                    evidenceHighlight
                      ? "bg-[var(--ink-900)] border-[var(--verdigris)] text-[var(--verdigris)] shadow-[0_0_10px_rgba(121,184,166,0.3)]"
                      : "bg-[var(--ink-900)] border-[var(--line-strong)] text-[var(--bone)]"
                  }`}
                >
                  EGFR
                </div>
                <span className="type-meta text-[9px] text-[var(--dim)] font-mono">Focal</span>
              </div>

              {/* Connector with DrawPath retracing */}
              <div className="w-12 h-2 relative flex items-center justify-center">
                <svg width="48" height="4" viewBox="0 0 48 4" className="overflow-visible">
                  <line x1="0" y1="2" x2="48" y2="2" stroke="var(--ink-700)" strokeWidth="2" />
                  {evidenceHighlight ? (
                    <DrawPath
                      key="active-edge"
                      d="M 0 2 L 48 2"
                      stroke="var(--verdigris)"
                      strokeWidth={2}
                      durationMs={240}
                    />
                  ) : (
                    <line x1="0" y1="2" x2="48" y2="2" stroke="var(--verdigris)" strokeWidth="2" opacity="0.4" />
                  )}
                </svg>
              </div>

              {/* Evidence Node B */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs border transition-opacity duration-[240ms] ${
                    evidenceHighlight
                      ? "bg-[var(--ink-900)] border-[var(--verdigris)] text-[var(--verdigris)]"
                      : "bg-[var(--ink-900)] border-[var(--line-strong)] text-[var(--bone)]"
                  }`}
                >
                  ERBB2
                </div>
                <span className="type-meta text-[9px] text-[var(--dim)] font-mono">Linked</span>
              </div>

              {/* Distant Node C (Dims to 0.40) */}
              <div
                className="flex flex-col items-center gap-1 transition-opacity duration-[240ms]"
                style={{ opacity: evidenceHighlight ? 0.4 : 1 }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs border bg-[var(--ink-900)] border-[var(--line-strong)] text-[var(--dim)]">
                  TP53
                </div>
                <span className="type-meta text-[9px] text-[var(--dim)] font-mono">Distal</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Focal Subgraph: {evidenceHighlight ? "Active (Dim 0.40)" : "Resting"}
            </span>
            <Button
              variant="ghost"
              onClick={() => {
                setEvidenceHighlight((h) => !h);
                playDetent();
              }}
            >
              Toggle Evidence Focus
            </Button>
          </div>
        </div>

        {/* Specimen M5.14: Scroll-Driven Reveal */}
        <div
          data-testid="specimen-scroll-reveal"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.14 Scroll-Driven Reveal
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                animation-timeline: view()
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Progress-driven reveal bounded by viewport scroll; cards glide into place with linear interpolation.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-2.5 overflow-y-auto space-y-2">
              {[
                { title: "Report #1042 — Histopathology", desc: "Immunohistochemistry EGFR positive" },
                { title: "Report #1043 — Molecular Panel", desc: "Exon 19 in-frame deletion detected" },
                { title: "Report #1044 — Computed Tomography", desc: "Target lesion baseline measurement 24mm" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="scroll-reveal p-2 rounded-[var(--r-4)] bg-[var(--ink-900)] border border-[var(--line-faint)] space-y-0.5"
                >
                  <div className="type-mono-sm text-xs text-[var(--bone)] font-medium">
                    {item.title}
                  </div>
                  <div className="type-meta text-[10px] text-[var(--dim)] font-mono">
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Timeline: CSS view()
            </span>
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Scroll container above ↑
            </span>
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
