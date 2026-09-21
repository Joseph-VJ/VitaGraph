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
  DetentPress,
} from "../../motion";
import { PhotonManager } from "../../motion/fx/Photon";
import { Button, IconButton } from "./Buttons";
import { Badge } from "./Badge";
import { LED } from "./LED";
import { EmptyState } from "./StateSet";

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

  // M5.15 Node -> Detail Shared-Element Morph state
  const [node15Expanded, setNode15Expanded] = useState(false);
  const node15Ref = useRef<HTMLDivElement>(null);
  const handleNode15Toggle = () => {
    playDetent();
    if (node15Ref.current && !isT0) {
      flip(node15Ref.current, () => setNode15Expanded((v) => !v), {
        spring: "weighted",
        capMs: 240,
      });
    } else {
      setNode15Expanded((v) => !v);
    }
  };

  // M5.16 Question Subgraph Activation state
  const [subgraph16Active, setSubgraph16Active] = useState(false);
  const handleSubgraph16Toggle = () => {
    setSubgraph16Active((v) => !v);
    playDetent();
  };

  // M5.17 Directed Edge Photon Flow state
  const [photon17Count, setPhoton17Count] = useState(0);
  const handleFirePhotons17 = () => {
    if (isT0) return;
    playDetent();
    setPhoton17Count((c) => c + 1);
    for (let i = 0; i < 8; i++) {
      PhotonManager.spawn(30 + i * 12, 50, 240, 50, "#79B8A6", 320);
    }
  };

  // M5.18 Community Hull Breathing state
  const [hull18Breathing, setHull18Breathing] = useState(true);

  // M5.19 Dynamic Camera Pan & Zoom Spring state
  const [camera19Target, setCamera19Target] = useState<"center" | "nodeA" | "nodeB">("center");
  const handleCamera19Focus = (tgt: "center" | "nodeA" | "nodeB") => {
    setCamera19Target(tgt);
    playDetent();
  };

  // M5.20 Live Graph Statistics Odometers state
  const stats20Presets = [
    { name: "Panel A (Baseline)", nodes: 86, edges: 97, comm: 6, mod: 0.64 },
    { name: "Panel B (Scanned)", nodes: 177, edges: 240, comm: 14, mod: 0.71 },
    { name: "Panel C (Cohort)", nodes: 275, edges: 645, comm: 10, mod: 0.66 },
  ];
  const [stats20Idx, setStats20Idx] = useState(0);
  const currentStats20 = stats20Presets[stats20Idx];
  const handleCycleStats20 = () => {
    setStats20Idx((i) => (i + 1) % stats20Presets.length);
    playDetent();
  };

  // M5.21 Compare Data Tween state
  const [compare21Idx, setCompare21Idx] = useState(0);
  const compare21Presets = [
    { name: "Cohort A vs B", improved: 5, declined: 2, stable: 11, propImp: 0.28, propDec: 0.11, propStb: 0.61 },
    { name: "Cohort B vs C", improved: 9, declined: 1, stable: 8, propImp: 0.50, propDec: 0.06, propStb: 0.44 },
  ];
  const compare21Current = compare21Presets[compare21Idx];
  const barImpRef = useRef<HTMLDivElement>(null);
  const barDecRef = useRef<HTMLDivElement>(null);
  const barStbRef = useRef<HTMLDivElement>(null);
  const prevProps21Ref = useRef(compare21Presets[0]);

  const handleToggleCompare21 = () => {
    playDetent();
    const nextIdx = (compare21Idx + 1) % compare21Presets.length;
    const next = compare21Presets[nextIdx];
    const prev = prevProps21Ref.current;
    prevProps21Ref.current = next;
    setCompare21Idx(nextIdx);

    if (!isT0) {
      const animateScale = (el: HTMLElement | null, from: number, to: number) => {
        if (!el) return;
        el.animate(
          [
            { transform: `scaleX(${from})` },
            { transform: `scaleX(${to})` }
          ],
          { duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
        );
      };
      animateScale(barImpRef.current, prev.propImp, next.propImp);
      animateScale(barDecRef.current, prev.propDec, next.propDec);
      animateScale(barStbRef.current, prev.propStb, next.propStb);
    }
  };

  // M5.22 Insights Refresh Rig state
  const [insights22Score, setInsights22Score] = useState(0.64);
  const [insights22Rank, setInsights22Rank] = useState(0.85);
  const ring22Ref = useRef<SVGCircleElement>(null);
  const rankBar22Ref = useRef<HTMLDivElement>(null);
  const prevRingOffset22Ref = useRef(76.9);

  const handleRefreshInsights22 = () => {
    playDetent();
    const nextScore = insights22Score === 0.64 ? 0.82 : 0.64;
    const nextRank = insights22Rank === 0.85 ? 0.45 : 0.85;
    const circumference = 213.6;
    const nextOffset = circumference * (1 - nextScore);
    const prevOffset = prevRingOffset22Ref.current;
    prevRingOffset22Ref.current = nextOffset;

    setInsights22Score(nextScore);
    setInsights22Rank(nextRank);

    if (!isT0) {
      if (ring22Ref.current) {
        ring22Ref.current.animate(
          [
            { strokeDashoffset: `${prevOffset}` },
            { strokeDashoffset: `${nextOffset}` }
          ],
          { duration: 480, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" }
        );
      }
      if (rankBar22Ref.current) {
        rankBar22Ref.current.animate(
          [
            { transform: `scaleX(${insights22Rank})` },
            { transform: `scaleX(${nextRank})` }
          ],
          { duration: 480, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" }
        );
      }
    }
  };

  // M5.23 Timeline Scrub Morph state
  const [scrub23Val, setScrub23Val] = useState(0.35); // 0.0 to 1.0
  const scrub23Hemo = (13.8 + (14.8 - 13.8) * scrub23Val).toFixed(1);
  const scrub23VitD = Math.round(28 + (46 - 28) * scrub23Val);

  // M5.24 Filter FLIP List state
  const allList24 = [
    { id: "hemo", name: "Hemoglobin", cat: "Lab" },
    { id: "chol", name: "Total Cholesterol", cat: "Cardio" },
    { id: "gluc", name: "Fasting Glucose", cat: "Endo" },
    { id: "vitd", name: "Vitamin D, 25-OH", cat: "Lab" },
    { id: "bnp", name: "NT-proBNP", cat: "Cardio" },
  ];
  const [filter24Cat, setFilter24Cat] = useState<string>("All");
  const [exiting24Ids, setExiting24Ids] = useState<string[]>([]);
  const list24ContainerRef = useRef<HTMLDivElement>(null);

  const handleFilter24Change = (cat: string) => {
    if (cat === filter24Cat) return;
    playDetent();
    if (isT0) {
      setFilter24Cat(cat);
      return;
    }
    const survivors = allList24.filter((item) => cat === "All" || item.cat === cat).map((i) => i.id);
    const removed = allList24.filter((item) => (filter24Cat === "All" || item.cat === filter24Cat) && !survivors.includes(item.id)).map((i) => i.id);
    
    if (removed.length > 0) {
      setExiting24Ids(removed);
      new Sequence()
        .wait(180)
        .addAction(() => {
          if (list24ContainerRef.current) {
            flip(list24ContainerRef.current, () => {
              setFilter24Cat(cat);
              setExiting24Ids([]);
            }, { spring: "weighted", capMs: 240 });
          } else {
            setFilter24Cat(cat);
            setExiting24Ids([]);
          }
        })
        .play();
    } else {
      if (list24ContainerRef.current) {
        flip(list24ContainerRef.current, () => setFilter24Cat(cat), { spring: "weighted", capMs: 240 });
      } else {
        setFilter24Cat(cat);
      }
    }
  };

  // M5.25 KPI Impulse Tile state
  const [kpi25Value, setKpi25Value] = useState(128);
  const [kpi25Impulse, setKpi25Impulse] = useState(false);
  const handleKpi25Increment = () => {
    playDetent();
    setKpi25Value((v) => v + 12);
    if (!isT0) {
      setKpi25Impulse(true);
      new Sequence()
        .wait(360)
        .addAction(() => setKpi25Impulse(false))
        .play();
    }
  };

  // M5.26 Verify-Integrity Ritual state
  const [integrity26Verified, setIntegrity26Verified] = useState(false);
  const [integrity26Running, setIntegrity26Running] = useState(false);
  const [integrity26Wash, setIntegrity26Wash] = useState(false);
  const handleVerify26 = () => {
    playDetent();
    if (isT0) {
      setIntegrity26Verified(true);
      return;
    }
    setIntegrity26Running(true);
    setIntegrity26Wash(true);
    new Sequence()
      .wait(240)
      .addAction(() => {
        setIntegrity26Verified(true);
        setIntegrity26Running(false);
        setIntegrity26Wash(false);
        playChime();
      })
      .play();
  };

  // M5.27 Skeleton Crossfade state
  const [skeleton27Loading, setSkeleton27Loading] = useState(false);
  const handleSkeleton27Toggle = () => {
    playDetent();
    setSkeleton27Loading((v) => !v);
  };

  // M5.28 Run-Notebook Ritual state
  const [notebook28Running, setNotebook28Running] = useState(false);
  const [notebook28Step, setNotebook28Step] = useState(0);
  const [notebook28Wash, setNotebook28Wash] = useState(false);
  const handleRunNotebook28 = () => {
    playDetent();
    if (isT0) {
      setNotebook28Step(3);
      return;
    }
    setNotebook28Running(true);
    setNotebook28Step(0);
    setNotebook28Wash(true);
    new Sequence()
      .wait(120)
      .addAction(() => {
        setNotebook28Step(1);
        playDetent();
      })
      .wait(120)
      .addAction(() => {
        setNotebook28Step(2);
        playDetent();
      })
      .wait(120)
      .addAction(() => {
        setNotebook28Step(3);
        setNotebook28Running(false);
        setNotebook28Wash(false);
        playChime();
      })
      .play();
  };

  // M5.30 Toast Stack FLIP state
  interface SpecimenToast {
    id: string;
    text: string;
    variant: "verdigris" | "ochre" | "madder";
  }
  const [toasts30, setToasts30] = useState<SpecimenToast[]>([
    { id: "t1", text: "Graph metrics synchronized", variant: "verdigris" },
    { id: "t2", text: "Longitudinal observation extracted", variant: "ochre" },
  ]);
  const [exitingToast30Ids, setExitingToast30Ids] = useState<string[]>([]);
  const toast30ContainerRef = useRef<HTMLDivElement>(null);
  const handleDismissToast30 = (id: string) => {
    playDetent();
    if (isT0) {
      setToasts30((ts) => ts.filter((t) => t.id !== id));
      return;
    }
    setExitingToast30Ids((prev) => [...prev, id]);
    new Sequence()
      .wait(180)
      .addAction(() => {
        if (toast30ContainerRef.current) {
          flip(toast30ContainerRef.current, () => {
            setToasts30((ts) => ts.filter((t) => t.id !== id));
            setExitingToast30Ids((prev) => prev.filter((i) => i !== id));
          }, { spring: "weighted", capMs: 240 });
        } else {
          setToasts30((ts) => ts.filter((t) => t.id !== id));
          setExitingToast30Ids((prev) => prev.filter((i) => i !== id));
        }
      })
      .play();
  };
  const handleSpawnToast30 = () => {
    playDetent();
    const newId = `t${Date.now()}`;
    const variants: Array<"verdigris" | "ochre" | "madder"> = ["verdigris", "ochre", "madder"];
    const v = variants[toasts30.length % 3];
    setToasts30((ts) => [...ts, { id: newId, text: `Event dispatch #${ts.length + 1}`, variant: v }]);
  };

  // M5.31 Modal Sheet Choreography state
  const [modal31Open, setModal31Open] = useState(false);
  const handleToggleModal31 = () => {
    playDetent();
    setModal31Open((v) => !v);
  };

  // M5.32 Dual Container state
  const [dual32Loading, setDual32Loading] = useState(false);
  const handleDual32Toggle = () => {
    playDetent();
    setDual32Loading((v) => !v);
  };

  // M5.33 Empty State Loop replay
  const [empty33Key, setEmpty33Key] = useState(0);
  const handleReplayEmpty33 = () => {
    playDetent();
    setEmpty33Key((k) => k + 1);
  };

  // Specimen MG.1: Inline Expand Drawer (§G1, Dead Controls)
  const [mg1Expanded, setMg1Expanded] = useState<boolean>(false);
  const mg1ContainerRef = useRef<HTMLDivElement>(null);
  const handleToggleMg1 = () => {
    playDetent();
    if (isT0) {
      setMg1Expanded((v) => !v);
      return;
    }
    if (mg1ContainerRef.current) {
      flip(mg1ContainerRef.current, () => {
        setMg1Expanded((v) => !v);
      }, { spring: "weighted", capMs: 240 });
    } else {
      setMg1Expanded((v) => !v);
    }
  };

  // Specimen MG.2: Chip-Pop on Select Change (§G1, Dead Controls)
  const [mg2Mode, setMg2Mode] = useState<string>("Paper");
  const [mg2Key, setMg2Key] = useState<number>(0);
  const handleMg2Select = (val: string) => {
    setMg2Mode(val);
    setMg2Key(Date.now());
    playDetent();
  };

  // Specimen MG.3: DetentPress Sweep Proof-Board (§G4, Press Feedback)
  const [mg3LastPressed, setMg3LastPressed] = useState<string>("none");
  const handleMg3Press = (label: string) => {
    setMg3LastPressed(label);
    playDetent();
  };

  // Specimen MG.4: Confirm-Panel Exit (§G4, Press Feedback & Dialog Exit)
  const [mg4ShowConfirm, setMg4ShowConfirm] = useState<boolean>(false);
  const [mg4Exiting, setMg4Exiting] = useState<boolean>(false);
  const handleMg4Open = () => {
    playDetent();
    setMg4ShowConfirm(true);
    setMg4Exiting(false);
  };
  const handleMg4Cancel = () => {
    playDetent();
    if (isT0) {
      setMg4ShowConfirm(false);
      setMg4Exiting(false);
      return;
    }
    setMg4Exiting(true);
    new Sequence()
      .wait(120)
      .addAction(() => {
        setMg4ShowConfirm(false);
        setMg4Exiting(false);
      })
      .play();
  };

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

        {/* Specimen M5.15: Node -> Detail Shared-Element Morph */}
        <div
          data-testid="specimen-node-detail-morph"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.15 Node → Detail Morph
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                ViewTransition / FLIP weighted
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Shared-element handoff from canvas node selection into detail drawer with physical weighted spring morph.
            </p>

            <div className="h-32 flex items-center justify-center bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 relative overflow-hidden">
              <div
                ref={node15Ref}
                style={{ viewTransitionName: "specimen-node-header" }}
                className={`transition-colors rounded-[var(--r-6)] border ${
                  node15Expanded
                    ? "w-full p-3 bg-[var(--ink-900)] border-[var(--verdigris)] space-y-1.5 shadow-md"
                    : "px-3 py-1.5 bg-[var(--ink-700)] border-[var(--line-strong)] flex items-center gap-2 cursor-pointer hover:border-[var(--verdigris)]"
                }`}
                onClick={!node15Expanded ? handleNode15Toggle : undefined}
              >
                {node15Expanded ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <LED color="verdigris" />
                        <span className="type-mono-sm text-xs text-[var(--bone)] font-semibold">
                          Hemoglobin (HGB)
                        </span>
                      </div>
                      <Badge variant="verdigris">14.1 g/dL</Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--dim)] font-mono pt-1 border-t border-[var(--line-faint)]">
                      <span>Ref: 13.5 - 17.5</span>
                      <span>Degree: 8 edges</span>
                      <span>Page: 1</span>
                    </div>
                  </>
                ) : (
                  <>
                    <LED color="verdigris" />
                    <span className="type-mono-sm text-xs text-[var(--bone)] font-medium">
                      HGB
                    </span>
                    <Badge variant="dim">Node #42</Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              View Transition: {node15Expanded ? "Detail Sheet" : "Canvas Chip"}
            </span>
            <Button variant="ghost" onClick={handleNode15Toggle}>
              {node15Expanded ? "Deselect (Collapse)" : "Select Node (Morph)"}
            </Button>
          </div>
        </div>

        {/* Specimen M5.16: Question Subgraph Activation (Pulse + Dim) */}
        <div
          data-testid="specimen-subgraph-activation"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.16 Subgraph Activation
              </span>
              <span className="type-mono-sm text-[var(--ochre)]">
                PulseRing 1.2s + Dim 0.40
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Single 1200ms PulseRing on evidence concepts; non-evidence vertices smoothly dim to exact 0.40 alpha.
            </p>

            <div className="h-32 flex items-center justify-around bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 relative">
              {/* Node 1: Activated Biomarker */}
              <div className="flex flex-col items-center gap-1 relative">
                {subgraph16Active && (
                  <PulseRing color="verdigris" />
                )}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-xs border ${
                    subgraph16Active
                      ? "bg-[var(--ink-900)] border-[var(--verdigris)] text-[var(--verdigris)] shadow-[0_0_12px_rgba(121,184,166,0.4)]"
                      : "bg-[var(--ink-700)] border-[var(--line-strong)] text-[var(--bone)]"
                  }`}
                >
                  HGB
                </div>
                <span className="type-meta text-[9px] text-[var(--dim)] font-mono">Active</span>
              </div>

              {/* Edge */}
              <svg width="40" height="4" viewBox="0 0 40 4" className="overflow-visible">
                <line
                  x1="0"
                  y1="2"
                  x2="40"
                  y2="2"
                  stroke={subgraph16Active ? "var(--verdigris)" : "var(--line-strong)"}
                  strokeWidth="2"
                  style={{ opacity: subgraph16Active ? 1 : 0.4 }}
                />
              </svg>

              {/* Node 2: Distal concept (Dims to 0.40) */}
              <div
                className="flex flex-col items-center gap-1 transition-opacity duration-[240ms]"
                style={{ opacity: subgraph16Active ? 0.4 : 1 }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-mono text-xs border bg-[var(--ink-700)] border-[var(--line-strong)] text-[var(--dim)]">
                  GLU
                </div>
                <span className="type-meta text-[9px] text-[var(--dim)] font-mono">Distal (0.40)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              State: {subgraph16Active ? "Activated (0.40 Dim)" : "Resting"}
            </span>
            <Button variant="ghost" onClick={handleSubgraph16Toggle}>
              {subgraph16Active ? "Reset Activation" : "Trigger Subgraph Activation"}
            </Button>
          </div>
        </div>

        {/* Specimen M5.17: Directed Edge Photon Flow */}
        <div
          data-testid="specimen-photon-edge-flow"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.17 Directed Edge Photon Flow
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                PhotonManager pool ≤ 24
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              6–12 photons traveling curved bezier paths from source chunk to evidence concept; speed ∝ 1/latency.
            </p>

            <div className="h-32 flex items-center justify-between bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-4 relative overflow-hidden">
              <div className="flex flex-col items-center gap-1 z-10">
                <div className="w-8 h-8 rounded-full bg-[var(--ink-700)] border border-[var(--line-strong)] flex items-center justify-center font-mono text-[10px] text-[var(--dim)]">
                  Chunk
                </div>
                <span className="type-meta text-[9px] text-[var(--dim)]">p. 1 §4</span>
              </div>

              <div className="flex-1 mx-3 relative h-12 flex items-center">
                <svg className="w-full h-full overflow-visible">
                  <path
                    d="M 0 24 Q 60 4, 120 24"
                    fill="none"
                    stroke="var(--line-strong)"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  {photon17Count > 0 && (
                    <circle cx="60" cy="14" r="3" fill="var(--verdigris)" className="animate-pulse" />
                  )}
                </svg>
              </div>

              <div className="flex flex-col items-center gap-1 z-10">
                <div className="w-8 h-8 rounded-full bg-[var(--verdigris)] text-[var(--ink-900)] flex items-center justify-center font-mono text-[10px] font-bold">
                  HGB
                </div>
                <span className="type-meta text-[9px] text-[var(--verdigris)]">Concept</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Photons fired: {photon17Count * 8} (T3 lane L1)
            </span>
            <Button variant="ghost" onClick={handleFirePhotons17}>
              Spawn Photon Burst
            </Button>
          </div>
        </div>

        {/* Specimen M5.18: Community Hull Breathing */}
        <div
          data-testid="specimen-hull-breathing"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.18 Community Hull Breathing
              </span>
              <span className="type-mono-sm text-[var(--lilac)]">
                9s sine (0.111 Hz ≤ 2Hz)
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Gentle sine oscillation on community hulls: 9s period, opacity 0.05 → 0.08. Pauses when off-screen.
            </p>

            <div className="h-32 flex items-center justify-center bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 relative">
              <div
                className={`w-36 h-20 rounded-[var(--r-14)] border border-dashed border-[var(--lilac)] flex items-center justify-center ${
                  hull18Breathing && !isT0 ? "animate-breathe" : ""
                }`}
                style={{
                  backgroundColor: "rgba(169, 146, 208, 0.06)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--lilac)]" />
                  <span className="type-mono-sm text-xs text-[var(--bone)]">
                    Community #2
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Frequency: 0.111 Hz (Gate 24 pass)
            </span>
            <Button variant="ghost" onClick={() => setHull18Breathing((b) => !b)}>
              {hull18Breathing ? "Pause Breathing" : "Resume Breathing"}
            </Button>
          </div>
        </div>

        {/* Specimen M5.19: Dynamic Zoom & Camera Pan */}
        <div
          data-testid="specimen-camera-spring"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.19 Dynamic Camera Pan & Zoom
              </span>
              <span className="type-mono-sm text-[var(--ochre)]">
                Preset (90/20/1.2)
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Spring-based camera framing (stiffness 90, damping 20, mass 1.2) centering on selected entity with momentum handoff.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 relative overflow-hidden flex items-center justify-center">
              <div
                className="w-48 h-24 border border-[var(--line-strong)] rounded-[var(--r-6)] bg-[var(--ink-900)] relative transition-transform duration-[360ms] ease-[cubic-bezier(0.32,0,0.24,1)] flex items-center justify-center"
                style={{
                  transform:
                    camera19Target === "nodeA"
                      ? "scale(1.2) translate(-20px, -10px)"
                      : camera19Target === "nodeB"
                      ? "scale(1.2) translate(20px, 10px)"
                      : "scale(1.0) translate(0px, 0px)",
                }}
              >
                <div className="flex items-center gap-6">
                  <div
                    onClick={() => handleCamera19Focus("nodeA")}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center font-mono text-[10px] cursor-pointer ${
                      camera19Target === "nodeA"
                        ? "border-[var(--verdigris)] text-[var(--verdigris)] bg-[var(--verdigris)]/10"
                        : "border-[var(--line-strong)] text-[var(--bone)]"
                    }`}
                  >
                    A
                  </div>
                  <div
                    onClick={() => handleCamera19Focus("nodeB")}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center font-mono text-[10px] cursor-pointer ${
                      camera19Target === "nodeB"
                        ? "border-[var(--ochre)] text-[var(--ochre)] bg-[var(--ochre)]/10"
                        : "border-[var(--line-strong)] text-[var(--bone)]"
                    }`}
                  >
                    B
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Target: {camera19Target}
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" className="h-7 text-xs px-2" onClick={() => handleCamera19Focus("nodeA")}>
                Focus A
              </Button>
              <Button variant="ghost" className="h-7 text-xs px-2" onClick={() => handleCamera19Focus("nodeB")}>
                Focus B
              </Button>
              <Button variant="ghost" className="h-7 text-xs px-2" onClick={() => handleCamera19Focus("center")}>
                Reset
              </Button>
            </div>
          </div>
        </div>

        {/* Specimen M5.20: Live Graph Statistics Odometers */}
        <div
          data-testid="specimen-stats-odometers"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.20 Live Graph Statistics
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                Odometer count-up (Gate 27)
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Numeric count-up Odometers with needle easing for nodes, edges, communities, and modularity Q.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 grid grid-cols-2 gap-2 content-center">
              <div className="p-2 rounded-[var(--r-4)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
                <div className="type-meta text-[10px] text-[var(--dim)] uppercase">Nodes</div>
                <div className="type-mono text-base font-semibold text-[var(--bone)]">
                  <Odometer value={currentStats20.nodes} duration={480} testId="specimen-odo-nodes" />
                </div>
              </div>

              <div className="p-2 rounded-[var(--r-4)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
                <div className="type-meta text-[10px] text-[var(--dim)] uppercase">Edges</div>
                <div className="type-mono text-base font-semibold text-[var(--bone)]">
                  <Odometer value={currentStats20.edges} duration={480} testId="specimen-odo-edges" />
                </div>
              </div>

              <div className="p-2 rounded-[var(--r-4)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
                <div className="type-meta text-[10px] text-[var(--dim)] uppercase">Communities</div>
                <div className="type-mono text-base font-semibold text-[var(--bone)]">
                  <Odometer value={currentStats20.comm} duration={480} testId="specimen-odo-comm" />
                </div>
              </div>

              <div className="p-2 rounded-[var(--r-4)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
                <div className="type-meta text-[10px] text-[var(--dim)] uppercase">Modularity Q</div>
                <div className="type-mono text-base font-semibold text-[var(--bone)]">
                  <Odometer
                    value={currentStats20.mod}
                    decimals={2}
                    format={(v) => v.toFixed(2)}
                    duration={480}
                    testId="specimen-odo-mod"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Preset: {currentStats20.name}
            </span>
            <Button variant="ghost" onClick={handleCycleStats20}>
              Cycle Cohort Presets
            </Button>
          </div>
        </div>

        {/* Specimen M5.21: Compare Data Tween */}
        <div
          data-testid="specimen-compare-tween"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.21 Compare Data Tween
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-deliberate (360ms) WAAPI
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Proportion segment scaleX WAAPI tween + Odometer retween on cohort diff switch without layout remount.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 flex flex-col justify-between">
              <div>
                <div className="type-meta text-[10px] text-[var(--dim)] mb-1.5 flex justify-between">
                  <span>Proportional Diff Balance</span>
                  <span className="font-mono text-[var(--bone)]">{compare21Current.name}</span>
                </div>
                <div className="h-3.5 w-full bg-[var(--ink-900)] rounded-full overflow-hidden flex">
                  <div
                    ref={barImpRef}
                    style={{ transform: `scaleX(${compare21Current.propImp})`, transformOrigin: "left" }}
                    className="h-full w-1/3 bg-[var(--verdigris)]"
                  />
                  <div
                    ref={barDecRef}
                    style={{ transform: `scaleX(${compare21Current.propDec})`, transformOrigin: "left" }}
                    className="h-full w-1/3 bg-[var(--madder)]"
                  />
                  <div
                    ref={barStbRef}
                    style={{ transform: `scaleX(${compare21Current.propStb})`, transformOrigin: "left" }}
                    className="h-full w-1/3 bg-[var(--cornflower)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--line-faint)]">
                <div className="text-center">
                  <span className="type-meta text-[10px] text-[var(--verdigris)] block">Improved</span>
                  <span className="type-mono text-sm font-semibold text-[var(--bone)]">
                    <Odometer value={compare21Current.improved} duration={360} testId="specimen-odo-compare-imp" />
                  </span>
                </div>
                <div className="text-center">
                  <span className="type-meta text-[10px] text-[var(--madder)] block">Declined</span>
                  <span className="type-mono text-sm font-semibold text-[var(--bone)]">
                    <Odometer value={compare21Current.declined} duration={360} testId="specimen-odo-compare-dec" />
                  </span>
                </div>
                <div className="text-center">
                  <span className="type-meta text-[10px] text-[var(--cornflower)] block">Stable</span>
                  <span className="type-mono text-sm font-semibold text-[var(--bone)]">
                    <Odometer value={compare21Current.stable} duration={360} testId="specimen-odo-compare-stb" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Mode: WAAPI transform-only
            </span>
            <Button variant="ghost" onClick={handleToggleCompare21} data-testid="specimen-compare-toggle">
              Switch Cohort Diff
            </Button>
          </div>
        </div>

        {/* Specimen M5.22: Insights Refresh Rig */}
        <div
          data-testid="specimen-insights-rig"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.22 Insights Refresh Rig
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-settle (480ms) WAAPI
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              WAAPI stroke-dashoffset tween on modularity ring + scaleX rank bars without CSS class re-mounting.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 flex items-center justify-around">
              <div className="flex items-center gap-3">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 80 80">
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke="var(--line-strong)"
                    strokeWidth="5"
                    fill="none"
                  />
                  <circle
                    ref={ring22Ref}
                    cx="40"
                    cy="40"
                    r="34"
                    stroke="var(--verdigris)"
                    strokeWidth="5"
                    fill="none"
                    strokeDasharray={213.6}
                    strokeDashoffset={213.6 * (1 - insights22Score)}
                    strokeLinecap="round"
                  />
                </svg>
                <div>
                  <span className="type-meta text-[10px] text-[var(--dim)] block">Modularity Q</span>
                  <span className="type-mono text-base font-semibold text-[var(--bone)]">
                    <Odometer
                      value={insights22Score}
                      decimals={2}
                      format={(v) => v.toFixed(2)}
                      duration={480}
                      testId="specimen-odo-insights-q"
                    />
                  </span>
                </div>
              </div>

              <div className="w-32">
                <div className="type-meta text-[10px] text-[var(--dim)] mb-1 flex justify-between">
                  <span>Hub Rank</span>
                  <span className="font-mono text-[var(--bone)]">{Math.round(insights22Rank * 100)}%</span>
                </div>
                <div className="h-2 w-full bg-[var(--ink-900)] rounded-full overflow-hidden">
                  <div
                    ref={rankBar22Ref}
                    style={{ transform: `scaleX(${insights22Rank})`, transformOrigin: "left" }}
                    className="h-full w-full bg-[var(--cornflower)]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Gate 18: No class remount
            </span>
            <Button variant="ghost" onClick={handleRefreshInsights22} data-testid="specimen-insights-refresh-btn">
              Refresh Analytics
            </Button>
          </div>
        </div>

        {/* Specimen M5.23: Timeline Scrub Morph */}
        <div
          data-testid="specimen-timeline-scrub"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.23 Timeline Scrub Morph
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                ticker-L0 scrub binding
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Spine scrubber interpolates lab observation values continuously with zero React render thrash.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <span className="type-meta text-[10px] text-[var(--dim)] block">Hemoglobin (g/dL)</span>
                  <span
                    data-testid="specimen-scrub-hemo"
                    className="type-mono text-base font-semibold text-[var(--bone)]"
                  >
                    {scrub23Hemo}
                  </span>
                </div>
                <div>
                  <span className="type-meta text-[10px] text-[var(--dim)] block">Vitamin D (ng/mL)</span>
                  <span
                    data-testid="specimen-scrub-vitd"
                    className="type-mono text-base font-semibold text-[var(--bone)]"
                  >
                    {scrub23VitD}
                  </span>
                </div>
                <div>
                  <span className="type-meta text-[10px] text-[var(--dim)] block">Spine Depth</span>
                  <span className="type-mono text-xs text-[var(--verdigris)] font-mono">
                    {Math.round(scrub23Val * 100)}%
                  </span>
                </div>
              </div>

              <div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={scrub23Val}
                  onChange={(e) => setScrub23Val(parseFloat(e.target.value))}
                  data-testid="specimen-scrub-input"
                  className="w-full accent-[var(--verdigris)] cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Scrub: baseline → follow-up
            </span>
            <Button
              variant="ghost"
              onClick={() => {
                playDetent();
                setScrub23Val((v) => (v < 0.5 ? 1.0 : 0.0));
              }}
            >
              {scrub23Val < 0.5 ? "Jump to Latest" : "Jump to Baseline"}
            </Button>
          </div>
        </div>

        {/* Specimen M5.24: Filter FLIP List */}
        <div
          data-testid="specimen-filter-flip"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.24 Filter FLIP List
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-quick (180ms) exit → FLIP
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Exit-aware FLIP: removed items play .m-exit via Sequence (180ms), container reconciles survivors via flipFrom.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-2.5 flex flex-col justify-between overflow-hidden">
              <div
                ref={list24ContainerRef}
                data-testid="specimen-filter-list"
                className="flex flex-col gap-1 overflow-y-auto max-h-24 pr-1"
              >
                {allList24
                  .filter((item) => filter24Cat === "All" || item.cat === filter24Cat || exiting24Ids.includes(item.id))
                  .map((item) => {
                    const isExiting = exiting24Ids.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        data-testid={`specimen-filter-item-${item.id}`}
                        className={`flex items-center justify-between px-2 py-1 rounded-[var(--r-4)] bg-[var(--ink-900)] border border-[var(--line-faint)] text-xs ${
                          isExiting ? "m-exit" : "m-enter"
                        }`}
                      >
                        <span className="type-body text-[var(--bone)] text-[11px]">{item.name}</span>
                        <Badge variant={item.cat === "Lab" ? "verdigris" : item.cat === "Cardio" ? "madder" : "cornflower"}>
                          {item.cat}
                        </Badge>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <div className="flex gap-1">
              {["All", "Lab", "Cardio", "Endo"].map((c) => (
                <button
                  key={c}
                  onClick={() => handleFilter24Change(c)}
                  data-testid={`specimen-filter-tab-${c.toLowerCase()}`}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded-[var(--r-4)] transition-colors ${
                    filter24Cat === c
                      ? "bg-[var(--verdigris)] text-[var(--ink-950)] font-medium"
                      : "bg-[var(--ink-800)] text-[var(--dim)] hover:text-[var(--bone)]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Active: {filter24Cat}
            </span>
          </div>
        </div>

        {/* Specimen M5.25: KPI Value-Change Impulse Tile (§7.1-A) */}
        <div
          data-testid="specimen-kpi-impulse-tile"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between relative overflow-hidden"
        >
          {kpi25Impulse && <WashSweep color="var(--verdigris)" />}
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.25 KPI Impulse Tile
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                --m-settle (480ms) + WashSweep
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Retween Odometer count-up, trend arrow nudge, and WashSweep impulse on value change.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 flex flex-col justify-between">
              <div>
                <span className="type-meta text-[10px] text-[var(--dim)] block">Fasting Glucose (mg/dL)</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="type-mono text-2xl font-bold text-[var(--bone)]">
                    <Odometer value={kpi25Value} duration={480} testId="specimen-odo-kpi" />
                  </span>
                  <span className={`text-xs text-[var(--verdigris)] ${kpi25Impulse ? "animate-arrow-nudge-up" : ""}`}>
                    ↑ +12
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[var(--line-faint)]">
                <span className="type-meta text-[10px] text-[var(--dim)]">Norm: 70–99</span>
                <Badge variant="verdigris">Normal</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Impulse: {kpi25Impulse ? "Active" : "Idle"}
            </span>
            <DetentPress>
              <Button variant="ghost" onClick={handleKpi25Increment} data-testid="specimen-btn-kpi-impulse">
                Increment KPI
              </Button>
            </DetentPress>
          </div>
        </div>

        {/* Specimen M5.26: Verify-Integrity Ritual (§7.7-A, Datasets) */}
        <div
          data-testid="specimen-verify-integrity"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between relative overflow-hidden"
        >
          {integrity26Wash && <WashSweep color="var(--verdigris)" />}
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.26 Verify-Integrity Ritual
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                DrawPath + WashSweep + LED
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              DrawPath checkmark, verdigris wash, and LED ring-once choreography for dataset integrity.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <span className="type-label text-[13px] text-[var(--bone)] font-semibold block">Blood Panel Longitudinal</span>
                  <span className="type-mono text-[10px] text-[var(--dim)]">sha256: 7e2f...91a4</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <LED color={integrity26Verified ? "verdigris" : "ochre"} live={integrity26Running} />
                  <span className="type-meta text-[11px] text-[var(--bone)]">
                    {integrity26Verified ? "Verified" : integrity26Running ? "Checking..." : "Unverified"}
                  </span>
                </div>
              </div>

              {integrity26Verified && (
                <div className="flex items-center gap-2 p-2 rounded-[var(--r-4)] bg-[var(--verdigris)]/10 border border-[var(--verdigris)]/30 m-enter">
                  <svg className="w-4 h-4 text-[var(--verdigris)] flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <DrawPath d="M4 12l5 5L20 6" stroke="var(--verdigris)" strokeWidth={2.5} durationMs={480} />
                  </svg>
                  <span className="type-meta text-[11px] text-[var(--verdigris)] font-mono">
                    SHA-256 matched canonical registry
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Status: {integrity26Verified ? "Canonical OK" : "Pending"}
            </span>
            <DetentPress>
              <Button
                variant="ghost"
                onClick={handleVerify26}
                disabled={integrity26Running}
                data-testid="specimen-verify-integrity-btn"
              >
                {integrity26Verified ? "Re-verify Integrity" : "Verify Integrity"}
              </Button>
            </DetentPress>
          </div>
        </div>

        {/* Specimen M5.27: Skeleton Crossfade Helper (§7.14-C) */}
        <div
          data-testid="specimen-skeleton-crossfade"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.27 Skeleton Crossfade
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                CrossfadeContainer (.m-exit → .m-enter)
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Chained .m-exit on skeleton → .m-enter on content via Sequence with zero layout shift (CLS = 0).
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 overflow-hidden">
              <CrossfadeContainer
                loading={skeleton27Loading}
                skeleton={
                  <div className="space-y-2.5 animate-pulse">
                    <div className="h-3.5 bg-[var(--ink-700)] rounded w-3/4" />
                    <div className="h-3 bg-[var(--ink-700)] rounded w-1/2" />
                    <div className="h-3 bg-[var(--ink-700)] rounded w-5/6" />
                  </div>
                }
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="type-body text-[13px] font-semibold text-[var(--bone)]">
                      Longitudinal Hemoglobin
                    </span>
                    <Badge variant="verdigris">14.1 g/dL</Badge>
                  </div>
                  <p className="type-meta text-xs text-[var(--dim)] mb-2">
                    Observation confirmed across 2 longitudinal panels with optimal reference range.
                  </p>
                  <span className="type-mono text-[10px] text-[var(--verdigris)] font-medium">
                    Extraction confidence: 99.4%
                  </span>
                </div>
              </CrossfadeContainer>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              State: {skeleton27Loading ? "Skeleton" : "Populated"}
            </span>
            <DetentPress>
              <Button variant="ghost" onClick={handleSkeleton27Toggle} data-testid="specimen-skeleton-toggle">
                {skeleton27Loading ? "Reveal Content" : "Show Skeleton"}
              </Button>
            </DetentPress>
          </div>
        </div>

        {/* Specimen M5.28: Run-Notebook Ritual (§7.9, Notebooks) */}
        <div
          data-testid="specimen-run-notebook"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between relative overflow-hidden"
        >
          {notebook28Wash && <WashSweep color="var(--cornflower)" />}
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.28 Run-Notebook Ritual
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                Staged cell execution (80ms)
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Staged cell execution shimmer, step rows staggered entrance via Sequence, and audio detent ticks.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-2.5 flex flex-col justify-between">
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className={`flex items-center justify-between px-2 py-1 rounded bg-[var(--ink-900)] ${notebook28Step >= 1 ? "m-enter text-[var(--bone)]" : "text-[var(--faint)]"}`}>
                  <span>[1] load_patient_graph()</span>
                  {notebook28Step >= 1 && <span className="text-[var(--verdigris)]">✓ 12ms</span>}
                </div>
                <div className={`flex items-center justify-between px-2 py-1 rounded bg-[var(--ink-900)] ${notebook28Step >= 2 ? "m-enter text-[var(--bone)]" : "text-[var(--faint)]"}`}>
                  <span>[2] louvain_modularity()</span>
                  {notebook28Step >= 2 && <span className="text-[var(--verdigris)]">✓ Q=0.67</span>}
                </div>
                <div className={`flex items-center justify-between px-2 py-1 rounded bg-[var(--ink-900)] ${notebook28Step >= 3 ? "m-enter text-[var(--bone)]" : "text-[var(--faint)]"}`}>
                  <span>[3] export_cytoscape()</span>
                  {notebook28Step >= 3 && <span className="text-[var(--verdigris)]">✓ Done</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Steps: {notebook28Step}/3 executed
            </span>
            <DetentPress>
              <Button
                variant="ghost"
                onClick={handleRunNotebook28}
                disabled={notebook28Running}
                data-testid="specimen-run-notebook-btn"
              >
                {notebook28Running ? "Executing..." : "Run Notebook"}
              </Button>
            </DetentPress>
          </div>
        </div>

        {/* Specimen M5.29: Tier Preview Strip (§7.12, Settings) */}
        <div
          data-testid="specimen-tier-preview-strip"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.29 Tier Preview Strip
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                Live governor state ({motion.tier})
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Miniature specimens responding dynamically to governor tiers (T3=full FX, T2=capped DPR, T1/T0=zero ambient).
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 grid grid-cols-3 gap-2 text-center items-center">
              <div className="p-2 bg-[var(--ink-900)] rounded-[var(--r-4)] border border-[var(--line-faint)]">
                <span className="type-meta text-[10px] text-[var(--dim)] block mb-1">LED Breathe</span>
                <div className="flex justify-center">
                  <LED color="verdigris" live={!isT0} />
                </div>
              </div>
              <div className="p-2 bg-[var(--ink-900)] rounded-[var(--r-4)] border border-[var(--line-faint)]">
                <span className="type-meta text-[10px] text-[var(--dim)] block mb-1">Odometer</span>
                <span className="type-mono text-xs font-bold text-[var(--bone)]">
                  <Odometer value={motion.tier === "T3" ? 60 : motion.tier === "T2" ? 30 : 0} duration={360} />
                </span>
              </div>
              <div className="p-2 bg-[var(--ink-900)] rounded-[var(--r-4)] border border-[var(--line-faint)]">
                <span className="type-meta text-[10px] text-[var(--dim)] block mb-1">Particles</span>
                <span className="type-mono text-[10px] text-[var(--verdigris)] font-medium">
                  {motion.tier === "T3" ? "Active (24)" : "Suppressed"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Active Tier: {motion.tier} ({motion.mode})
            </span>
            <span className="type-meta text-[11px] text-[var(--bone)] font-mono">
              {isT0 ? "Instant Settle" : "Physical Motion"}
            </span>
          </div>
        </div>

        {/* Specimen M5.30: Toast Stack FLIP (§7.14-C1, Shell) */}
        <div
          data-testid="specimen-toast-stack"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.30 Toast Stack FLIP
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                .m-exit + flipFrom stack collapse
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Toast enter animation, .m-exit slide out on dismiss, and FLIP stack reordering on removal.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-2.5 overflow-hidden">
              <div ref={toast30ContainerRef} className="space-y-1.5 max-h-28 overflow-y-auto">
                {toasts30.map((t) => {
                  const isExiting = exitingToast30Ids.includes(t.id);
                  return (
                    <div
                      key={t.id}
                      data-testid={`specimen-toast-${t.id}`}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-[var(--r-4)] bg-[var(--ink-900)] border border-[var(--line-strong)] text-xs ${
                        isExiting ? "m-exit" : "m-enter"
                      }`}
                    >
                      <span className="type-body text-[11px] text-[var(--bone)] truncate">{t.text}</span>
                      <button
                        onClick={() => handleDismissToast30(t.id)}
                        data-testid={`specimen-toast-dismiss-${t.id}`}
                        className="text-[var(--faint)] hover:text-[var(--bone)] text-xs ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Stack: {toasts30.length} items
            </span>
            <DetentPress>
              <Button variant="ghost" onClick={handleSpawnToast30} data-testid="specimen-btn-toast-spawn">
                Spawn Toast
              </Button>
            </DetentPress>
          </div>
        </div>

        {/* Specimen M5.31: Modal Sheet Choreography (§7.14-C2, Shell) */}
        <div
          data-testid="specimen-modal-sheet"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between relative"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.31 Modal Sheet Choreography
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                .animate-sheet-settle
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Backdrop wash fade, paper spring sheet settle, corner brackets draw, and smooth reverse close.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 flex items-center justify-center relative overflow-hidden">
              {modal31Open ? (
                <div
                  data-testid="specimen-modal-sheet-inner"
                  className="w-full h-full p-2.5 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between animate-sheet-settle"
                >
                  <div className="flex items-center justify-between">
                    <span className="type-body text-xs font-semibold text-[var(--bone)]">Modal Inspection Sheet</span>
                    <Badge variant="verdigris">Settled</Badge>
                  </div>
                  <span className="type-meta text-[10px] text-[var(--dim)] font-mono">
                    Spring: stiffness 240, damping 28
                  </span>
                  <div className="flex justify-end">
                    <DetentPress>
                      <Button variant="ghost" onClick={handleToggleModal31} data-testid="specimen-btn-modal-close">
                        Dismiss
                      </Button>
                    </DetentPress>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <span className="type-meta text-xs text-[var(--dim)] block mb-2">Modal sheet is closed</span>
                  <DetentPress>
                    <Button variant="ghost" onClick={handleToggleModal31} data-testid="specimen-btn-modal-open">
                      Open Modal Sheet
                    </Button>
                  </DetentPress>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              State: {modal31Open ? "Open" : "Closed"}
            </span>
            <span className="type-meta text-[11px] text-[var(--bone)] font-mono">
              Paper spring
            </span>
          </div>
        </div>

        {/* Specimen M5.32: Skeleton Crossfade Dual Container (§7.14-C3) */}
        <div
          data-testid="specimen-skeleton-dual"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.32 Skeleton Dual Container
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                Dual box reservation
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Synchronized crossfade across multiple reserved cards with zero cumulative layout shift.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 grid grid-cols-2 gap-2 overflow-hidden">
              <CrossfadeContainer
                loading={dual32Loading}
                skeleton={<div className="h-16 bg-[var(--ink-700)] rounded animate-pulse" />}
              >
                <div className="p-2 bg-[var(--ink-900)] rounded border border-[var(--line-faint)]">
                  <span className="type-mono text-[10px] text-[var(--dim)] block">Entity A</span>
                  <span className="type-body text-xs font-semibold text-[var(--bone)]">Arjun R.</span>
                </div>
              </CrossfadeContainer>
              <CrossfadeContainer
                loading={dual32Loading}
                skeleton={<div className="h-16 bg-[var(--ink-700)] rounded animate-pulse" />}
              >
                <div className="p-2 bg-[var(--ink-900)] rounded border border-[var(--line-faint)]">
                  <span className="type-mono text-[10px] text-[var(--dim)] block">Entity B</span>
                  <span className="type-body text-xs font-semibold text-[var(--bone)]">Sarah L.</span>
                </div>
              </CrossfadeContainer>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              CLS: 0.0000
            </span>
            <DetentPress>
              <Button variant="ghost" onClick={handleDual32Toggle} data-testid="specimen-dual-toggle">
                {dual32Loading ? "Populate Dual" : "Skeleton Dual"}
              </Button>
            </DetentPress>
          </div>
        </div>

        {/* Specimen M5.33: Empty-State Illustrated Loop (§7.14-C5, Shell) */}
        <div
          data-testid="specimen-empty-state-loop"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.33 Empty State Loop
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                DrawPath --m-cinematic (720ms)
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Gallery EmptyState component with DrawPath decorative loop that draws on mount.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-2 overflow-hidden flex items-center justify-center">
              <EmptyState
                key={empty33Key}
                quote="No longitudinal records found."
                actionLabel="Inspect"
                onAction={() => playDetent()}
                className="scale-75 p-2 bg-transparent border-0"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Replay: #{empty33Key}
            </span>
            <DetentPress>
              <Button variant="ghost" onClick={handleReplayEmpty33} data-testid="specimen-btn-empty-replay">
                Replay Sketch
              </Button>
            </DetentPress>
          </div>
        </div>

        {/* Specimen M5.34: Scroll-Timeline Reveal (§7.14-C6, Shell) */}
        <div
          data-testid="specimen-scroll-reveal"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                M5.34 Scroll Reveal
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                .m-scroll-reveal utility
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Scroll-driven CSS animation timeline with translateY glide and opacity reveal.
            </p>

            <div className="h-32 bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-2.5 overflow-y-auto space-y-2">
              <div className="p-2 rounded bg-[var(--ink-900)] border border-[var(--line-faint)] m-scroll-reveal">
                <span className="type-body text-xs font-semibold text-[var(--bone)] block">Scroll Item 1: Biomarkers</span>
                <span className="type-meta text-[10px] text-[var(--dim)]">Glides into view as spine scrolls</span>
              </div>
              <div className="p-2 rounded bg-[var(--ink-900)] border border-[var(--line-faint)] m-scroll-reveal">
                <span className="type-body text-xs font-semibold text-[var(--bone)] block">Scroll Item 2: Centrality Rank</span>
                <span className="type-meta text-[10px] text-[var(--dim)]">Betweenness hub measurement</span>
              </div>
              <div className="p-2 rounded bg-[var(--ink-900)] border border-[var(--line-faint)] m-scroll-reveal">
                <span className="type-body text-xs font-semibold text-[var(--bone)] block">Scroll Item 3: Louvain Partition</span>
                <span className="type-meta text-[10px] text-[var(--dim)]">Community hull boundary detection</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Utility: .m-scroll-reveal
            </span>
            <span className="type-meta text-[11px] text-[var(--verdigris)] font-mono">
              view() / IO
            </span>
          </div>
        </div>

        {/* Specimen MG.1: Inline Expand Drawer (§G1, Dead Controls) */}
        <div
          data-testid="specimen-mg1-drawer"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                MG.1 Inline Expand Drawer
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                .m-enter-card + FLIP
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Click toggles inline detail drawer with DetentPress, rotating chevron, and sibling FLIP shift.
            </p>

            <div ref={mg1ContainerRef} className="bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3">
              <DetentPress>
                <div
                  onClick={handleToggleMg1}
                  data-testid="specimen-mg1-trigger"
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <span className="type-body text-xs font-semibold text-[var(--bone)]">
                    Supported document formats
                  </span>
                  <span className={`text-[var(--dim)] text-xs transition-transform duration-[120ms] ${mg1Expanded && !isT0 ? "rotate-90 text-[var(--verdigris)]" : ""}`}>
                    ›
                  </span>
                </div>
              </DetentPress>
              {mg1Expanded && (
                <div
                  data-testid="specimen-mg1-body"
                  className={`mt-2.5 pt-2 border-t border-[var(--line-faint)] text-xs text-[var(--dim)] ${!isT0 ? "m-enter-card" : ""}`}
                >
                  Accepts multi-page clinical lab panels and PDF reports up to 50 MB, parsed chunk-by-chunk with SHA-256 integrity verification.
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              State: {mg1Expanded ? "Expanded" : "Collapsed"}
            </span>
            <span className="type-meta text-[11px] text-[var(--verdigris)] font-mono">
              DetentPress + 120ms
            </span>
          </div>
        </div>

        {/* Specimen MG.2: Chip-Pop on Select Change (§G1, Dead Controls) */}
        <div
          data-testid="specimen-mg2-chippop"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                MG.2 Chip-Pop on Select
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                .animate-chip-pop + detent
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Selecting a mode triggers an immediate key-remount .animate-chip-pop and synthesized audio detent.
            </p>

            <div className="bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="type-label text-xs text-[var(--dim)]">Active mode:</span>
                <span
                  key={mg2Key}
                  data-testid="specimen-mg2-chip"
                  className={`px-2 py-0.5 rounded-[var(--r-4)] type-mono text-[10px] font-semibold border ${
                    mg2Mode === "Paper"
                      ? "bg-[var(--verdigris)]/10 text-[var(--verdigris)] border-[var(--verdigris)]/30"
                      : "bg-[var(--cornflower)]/10 text-[var(--cornflower)] border-[var(--cornflower)]/30"
                  } ${!isT0 ? "animate-chip-pop" : ""}`}
                >
                  mode: {mg2Mode.toLowerCase()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {["Paper", "Graph"].map((m) => (
                  <DetentPress key={m}>
                    <button
                      onClick={() => handleMg2Select(m)}
                      data-testid={`specimen-mg2-btn-${m.toLowerCase()}`}
                      className={`px-2 py-1 text-xs rounded-[var(--r-4)] border font-mono transition-colors ${
                        mg2Mode === m
                          ? "bg-[var(--ink-700)] border-[var(--verdigris)] text-[var(--bone)]"
                          : "border-transparent text-[var(--dim)] hover:text-[var(--bone)]"
                      }`}
                    >
                      {m}
                    </button>
                  </DetentPress>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Selected: {mg2Mode}
            </span>
            <span className="type-meta text-[11px] text-[var(--bone)] font-mono">
              Key remount
            </span>
          </div>
        </div>

        {/* Specimen MG.3: DetentPress Sweep Proof-Board (§G4, Press Feedback) */}
        <div
          data-testid="specimen-mg3-detentpress"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                MG.3 DetentPress Sweep Board
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                scale-[0.985] + detent
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Standardized tactile scale feedback across buttons, chips, links, and icon actions. Hard-disabled in T0.
            </p>

            <div className="bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 flex flex-wrap items-center gap-3">
              <DetentPress>
                <Button
                  variant="primary"
                  className="h-7 text-xs px-3"
                  onClick={() => handleMg3Press("Button")}
                  data-testid="specimen-mg3-btn"
                >
                  Action Button
                </Button>
              </DetentPress>

              <DetentPress>
                <button
                  type="button"
                  onClick={() => handleMg3Press("Chip")}
                  data-testid="specimen-mg3-chip"
                  className="px-2.5 py-1 text-xs rounded-full border border-[var(--line-strong)] bg-[var(--ink-700)] text-[var(--bone)] cursor-pointer"
                >
                  Filter Chip
                </button>
              </DetentPress>

              <DetentPress>
                <IconButton
                  size={28}
                  onClick={() => handleMg3Press("Icon")}
                  data-testid="specimen-mg3-icon"
                  className="border border-[var(--line-faint)] text-[var(--dim)] hover:text-[var(--bone)]"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </IconButton>
              </DetentPress>

              <DetentPress>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => handleMg3Press("Link")}
                  data-testid="specimen-mg3-link"
                  className="text-xs text-[var(--verdigris)] underline cursor-pointer hover:text-[var(--bone)]"
                >
                  Inline Link
                </span>
              </DetentPress>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Last press: {mg3LastPressed}
            </span>
            <span className="type-meta text-[11px] text-[var(--verdigris)] font-mono">
              DetentPress + 80ms
            </span>
          </div>
        </div>

        {/* Specimen MG.4: Confirm-Panel Exit (§G4, Confirm-Panel Exit) */}
        <div
          data-testid="specimen-mg4-confirmexit"
          className="p-4 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-strong)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line-faint)]">
              <span className="type-mono-sm text-[var(--bone)] font-medium">
                MG.4 Confirm-Panel Exit
              </span>
              <span className="type-mono-sm text-[var(--verdigris)]">
                m-enter-card / m-exit 120ms
              </span>
            </div>
            <p className="type-meta text-xs text-[var(--dim)] mb-3">
              Confirm dialog mounts with .m-enter-card and unmounts cleanly with .m-exit 120ms before DOM destruction.
            </p>

            <div className="bg-[var(--ink-800)] rounded-[var(--r-6)] border border-[var(--line-faint)] p-3 min-h-[92px] flex items-center justify-center">
              {!mg4ShowConfirm ? (
                <DetentPress>
                  <Button
                    variant="solid-danger"
                    className="h-8 text-xs px-3"
                    onClick={handleMg4Open}
                    data-testid="specimen-mg4-trigger"
                  >
                    Delete record...
                  </Button>
                </DetentPress>
              ) : (
                <div
                  data-testid="specimen-mg4-panel"
                  className={`w-full p-3 rounded-[var(--r-6)] bg-[var(--madder)]/10 border border-[var(--madder)]/30 flex items-center justify-between gap-3 ${
                    !isT0 ? (mg4Exiting ? "m-exit" : "m-enter-card") : ""
                  }`}
                >
                  <span className="type-body text-xs text-[var(--bone)]">
                    Are you sure?
                  </span>
                  <div className="flex items-center gap-2">
                    <DetentPress>
                      <Button
                        variant="solid-danger"
                        className="h-7 text-xs px-2.5"
                        onClick={() => {
                          playDetent();
                          setMg4ShowConfirm(false);
                          setMg4Exiting(false);
                        }}
                        data-testid="specimen-mg4-confirm"
                      >
                        Delete
                      </Button>
                    </DetentPress>
                    <DetentPress>
                      <Button
                        variant="ghost"
                        className="h-7 text-xs px-2.5"
                        onClick={handleMg4Cancel}
                        data-testid="specimen-mg4-cancel"
                      >
                        Cancel
                      </Button>
                    </DetentPress>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[11px] text-[var(--dim)] font-mono">
              Status: {mg4ShowConfirm ? (mg4Exiting ? "Exiting (120ms)" : "Mounted") : "Idle"}
            </span>
            <span className="type-meta text-[11px] text-[var(--bone)] font-mono">
              Sequence.wait(120)
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
