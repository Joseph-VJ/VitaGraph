import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import "./graphStage.css";
import {
  GraphStageEngine,
  type StageNode,
  type StageEdge,
  type StageReportInfo,
  type StageOptions,
  type NodeKind,
} from "./GraphStageEngine";
import { NodeDossier } from "./NodeDossier";
import type { SeriesTest } from "../../../api/graph";

export interface GraphStageHandle {
  setLayout: (layout: string) => void;
  replayIntro: () => void;
  setLens: (on: boolean) => void;
  setTheme: (ink: boolean) => void;
  setOptions: (opts: Partial<StageOptions>) => void;
  setKindVisibility: (kind: NodeKind, visible: boolean) => void;
  setHistRange: (ratio: number) => void;
  startHist: () => void;
  stopHist: () => void;
  showAllHist: () => void;
  showPath: (fromId: string, toId: string) => string[] | null;
  clearPath: () => void;
  setEvidence: (nodeIds: string[] | null) => void;
  setFocusIds: (ids: string[] | null) => void;
  getSnapshotDataUrl: () => string;
  selectNode: (id: string | null) => void;
  panBy: (dx: number, dy: number) => void;
  resetPan: () => void;
  getPan: () => { x: number; y: number };
  appendData: (nodes: StageNode[], edges: StageEdge[]) => void;
  setData: (nodes: StageNode[], edges: StageEdge[]) => void;
}

interface GraphStageProps {
  userId: string;
  personName: string;
  nodes: StageNode[];
  edges: StageEdge[];
  reports: StageReportInfo[];
  seriesTests?: SeriesTest[];
  selectedId: string | null;
  onSelectNode: (id: string | null) => void;
  focusIds: string[] | null;
  activeLayout: string;
  onLayoutChange: (layout: string) => void;
  lensOn: boolean;
  onToggleLens: (on: boolean) => void;
  themeInk: boolean;
  onToggleTheme: (ink: boolean) => void;
  stageOptions: StageOptions;
  barMessage: React.ReactNode | null;
  onClearBarMessage?: () => void;
  reduceMotion?: boolean;
  hideTimeline?: boolean;
  isGrowing?: boolean;
  customCard?: (props: {
    node: StageNode;
    neighbors: Array<{ id: string; label: string }>;
    totalNeighborCount: number;
    onSelectNode: (id: string) => void;
    onClose: () => void;
  }) => React.ReactNode;
  customIntroTitle?: string;
  /** Placeholder of the search box; the Knowledge Graph keeps its own wording. */
  searchPlaceholder?: string;
}

export const GraphStage = forwardRef<GraphStageHandle, GraphStageProps>(
  (
    {
      userId,
      personName,
      nodes,
      edges,
      reports,
      seriesTests = [],
      selectedId,
      onSelectNode,
      focusIds,
      activeLayout,
      onLayoutChange,
      lensOn,
      onToggleLens,
      themeInk,
      onToggleTheme,
      stageOptions,
      barMessage,
      reduceMotion = false,
      hideTimeline = false,
      isGrowing = false,
      customCard,
      customIntroTitle,
      searchPlaceholder = "Find a test, section or report",
    },
    ref
  ) => {
    const stageRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const engineRef = useRef<GraphStageEngine | null>(null);

    const [counts, setCounts] = useState({ nodes: 0, links: 0, fps: 60 });
    const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSpinning, setIsSpinning] = useState(true);
    const [histReport, setHistReport] = useState<{ dateLabel: string; filename: string | null } | null>(null);
    const [panState, setPanState] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const isCentered = panState.x === 0 && panState.y === 0;

    const repeatTimerRef = useRef<{ delay: number | null; interval: number | null }>({
      delay: null,
      interval: null,
    });

    const clearRepeat = useCallback(() => {
      if (repeatTimerRef.current.delay !== null) {
        window.clearTimeout(repeatTimerRef.current.delay);
        repeatTimerRef.current.delay = null;
      }
      if (repeatTimerRef.current.interval !== null) {
        window.clearInterval(repeatTimerRef.current.interval);
        repeatTimerRef.current.interval = null;
      }
    }, []);

    const startRepeat = useCallback(
      (action: () => void) => {
        clearRepeat();
        action();
        repeatTimerRef.current.delay = window.setTimeout(() => {
          repeatTimerRef.current.interval = window.setInterval(() => {
            action();
          }, 60);
        }, 300);
      },
      [clearRepeat]
    );

    useEffect(() => {
      return () => {
        clearRepeat();
      };
    }, [clearRepeat]);

    // Intro lines & single managed timer effect
    const [introActive, setIntroActive] = useState(false);
    const [introOut, setIntroOut] = useState(false);
    const [introLinesVisible, setIntroLinesVisible] = useState(false);
    const [introRun, setIntroRun] = useState(0);

    const initialRunRef = useRef(false);
    useEffect(() => {
      if (nodes.length > 0 && !initialRunRef.current) {
        initialRunRef.current = true;
        setIntroRun(1);
      }
    }, [nodes.length]);

    useEffect(() => {
      if (reduceMotion || introRun === 0) {
        setIntroActive(false);
        return;
      }

      setIntroActive(true);
      setIntroOut(false);
      setIntroLinesVisible(false);

      const t1 = window.setTimeout(() => setIntroLinesVisible(true), 150);
      const t2 = window.setTimeout(() => setIntroOut(true), 3200);
      const t3 = window.setTimeout(() => setIntroActive(false), 4200);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }, [introRun, reduceMotion]);

    // Create & initialize engine
    useEffect(() => {
      if (!canvasRef.current || !stageRef.current) return;

      const engine = new GraphStageEngine(canvasRef.current, stageRef.current, {
        onSelect: (id) => {
          onSelectNode(id);
        },
        onHover: (id, pt) => {
          setHoverNodeId(id);
          setHoverPos(pt || null);
        },
        onFrameInfo: (vNodes, vLinks, fps) => {
          // Bail out when nothing changed so the stage does not re-render for identical numbers.
          setCounts((prev) => (prev.nodes === vNodes && prev.links === vLinks && prev.fps === fps ? prev : { nodes: vNodes, links: vLinks, fps }));
          if (engineRef.current && engineRef.current.hist !== null) {
            const ord = Math.round(engineRef.current.hist);
            const rpt = engineRef.current.reports[ord];
            const next = rpt
              ? { dateLabel: rpt.label || `R${ord + 1}`, filename: rpt.filename || null }
              : { dateLabel: `Report ${ord + 1}`, filename: null };
            setHistReport((prev) => (prev && prev.dateLabel === next.dateLabel && prev.filename === next.filename ? prev : next));
          } else {
            setHistReport((prev) => (prev === null ? prev : null));
          }
        },
        onPan: (pan) => {
          setPanState({ x: pan.x, y: pan.y });
        },
      });

      engine.ink = themeInk;
      engine.options = { ...stageOptions, hideTimeline };
      engine.reduceMotion = reduceMotion;
      engineRef.current = engine;
      if (typeof window !== "undefined") {
        (window as any).__graphStage = engine;
      }

      return () => {
        if (typeof window !== "undefined" && (window as any).__graphStage === engine) {
          delete (window as any).__graphStage;
        }
        engine.destroy();
        engineRef.current = null;
      };
    }, []);

    const wasGrowingRef = useRef(false);
    // Update data when nodes/edges/reports change
    useEffect(() => {
      if (!engineRef.current || nodes.length === 0) return;
      if (isGrowing) {
        if (engineRef.current.nodes.length === 0) {
          engineRef.current.setData(nodes, edges, reports, reduceMotion);
          engineRef.current.setLayout(activeLayout);
          setIsSpinning(engineRef.current.spin);
        }
        wasGrowingRef.current = true;
        return;
      }
      if (wasGrowingRef.current) {
        wasGrowingRef.current = false;
        return;
      }
      engineRef.current.setData(nodes, edges, reports, reduceMotion);
      engineRef.current.setLayout(activeLayout);
      setIsSpinning(engineRef.current.spin);
    }, [nodes, edges, reports, reduceMotion, activeLayout, isGrowing]);

    // Synchronize options & state to engine
    useEffect(() => {
      if (!engineRef.current) return;
      engineRef.current.options = { ...stageOptions, hideTimeline };
      engineRef.current.options.lens = lensOn;
    }, [stageOptions, lensOn, hideTimeline]);

    useEffect(() => {
      if (!engineRef.current) return;
      engineRef.current.ink = themeInk;
    }, [themeInk]);

    useEffect(() => {
      if (!engineRef.current) return;
      engineRef.current.setFocusIds(focusIds);
    }, [focusIds]);

    useEffect(() => {
      if (!engineRef.current) return;
      if (engineRef.current.selId !== selectedId) {
        engineRef.current.select(selectedId);
      }
    }, [selectedId]);

    // Handle replay intro
    const handleReplayIntro = useCallback(() => {
      if (!engineRef.current) return;
      engineRef.current.replayIntro();
      if (!reduceMotion) {
        setIntroRun((r) => r + 1);
      }
    }, [reduceMotion]);

    // Toggle pause/rotate
    const handleToggleSpin = useCallback(() => {
      if (!engineRef.current) return;
      const nextSpin = !engineRef.current.spin;
      engineRef.current.spin = nextSpin;
      engineRef.current.userRot = false;
      setIsSpinning(nextSpin);
    }, []);

    // Layout switch
    const handleLayoutClick = useCallback(
      (layoutName: string) => {
        if (!engineRef.current) return;
        if (hideTimeline && layoutName === "timeline") return;
        engineRef.current.setLayout(layoutName);
        setIsSpinning(engineRef.current.spin);
        onLayoutChange(layoutName);
      },
      [onLayoutChange, hideTimeline]
    );

    // Search options with unambiguous report names and duplicate suffixes (B4)
    const searchOptions = useMemo(() => {
      const counts = new Map<string, number>();
      return nodes
        .filter((n) => n.k !== "meas")
        .map((n) => {
          const base =
            n.k === "report"
              ? `Report: ${n.label} · ${n.name || "report"}`
              : n.label;
          const seen = counts.get(base) ?? 0;
          counts.set(base, seen + 1);
          const text = seen === 0 ? base : `${base} (${seen + 1})`;
          return { id: n.id, text, node: n };
        });
    }, [nodes]);

    // Search select
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const q = val.trim().toLowerCase();
      setSearchQuery(val);
      if (!q) return;

      const optHit = searchOptions.find((opt) => opt.text.toLowerCase() === q);
      const hit =
        optHit?.node ||
        nodes.find((n) =>
          n.k === "report"
            ? (n.name?.toLowerCase() === q || n.label.toLowerCase() === q)
            : n.label.toLowerCase() === q
        ) ||
        nodes.find(
          (n) =>
            n.k !== "meas" &&
            ((n.name && n.name.toLowerCase().includes(q)) || n.label.toLowerCase().includes(q))
        );

      if (hit && engineRef.current) {
        if (!engineRef.current.isNodeInView(hit.id)) {
          engineRef.current.resetPan();
        }
        engineRef.current.select(hit.id);
        onSelectNode(hit.id);
        setSearchQuery("");
      }
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return;
        const optHit = searchOptions.find((opt) => opt.text.toLowerCase() === q);
        const hit =
          optHit?.node ||
          nodes.find((n) =>
            n.k === "report"
              ? (n.name?.toLowerCase() === q || n.label.toLowerCase() === q)
              : n.label.toLowerCase() === q
          ) ||
          nodes.find(
            (n) =>
              n.k !== "meas" &&
              ((n.name && n.name.toLowerCase().includes(q)) || n.label.toLowerCase().includes(q))
          );

        if (hit && engineRef.current) {
          if (!engineRef.current.isNodeInView(hit.id)) {
            engineRef.current.resetPan();
          }
          engineRef.current.select(hit.id);
          onSelectNode(hit.id);
          setSearchQuery("");
          (e.target as HTMLInputElement).blur();
        }
      }
    };

    // Keyboard shortcuts & pan controls (P5, F1, F2)
    useEffect(() => {
      const isInteractiveControl = (el: HTMLElement | null) => {
        if (!el || el === stageRef.current || el === canvasRef.current) return false;
        if (el.isContentEditable) return true;
        const tag = el.tagName.toLowerCase();
        if (["button", "a", "select", "input", "textarea", "summary"].includes(tag)) return true;
        const role = el.getAttribute("role");
        if (role === "button" || role === "slider") return true;
        return false;
      };

      const onKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        const activeEl = document.activeElement as HTMLElement | null;
        if (isInteractiveControl(target) || isInteractiveControl(activeEl)) {
          return;
        }

        if (e.key === "l" || e.key === "L") {
          onToggleLens(!lensOn);
          return;
        }

        if (e.key === "Escape") {
          // If modal is open, let page-level handler close modal without deselecting node (F1)
          if (document.querySelector(".graph-modal")) {
            return;
          }
          onSelectNode(null);
          if (engineRef.current) {
            engineRef.current.clearPath();
            engineRef.current.select(null);
          }
          return;
        }

        const isModalOpen = !!document.querySelector(".graph-modal:not([hidden])");
        if (isModalOpen) {
          return;
        }

        const isStageFocused = stageRef.current
          ? stageRef.current === activeEl || stageRef.current.contains(activeEl)
          : false;
        const isStageHovered = engineRef.current ? engineRef.current.mouse.in : false;

        if (!isStageFocused && !isStageHovered) {
          return;
        }

        if (e.code === "Space" || e.key === " ") {
          e.preventDefault();
          engineRef.current?.setSpaceDown(true);
          return;
        }

        const step = e.shiftKey ? 120 : 40;
        if (e.key === "ArrowUp" || e.key === "Up") {
          e.preventDefault();
          engineRef.current?.panBy(0, -step);
          return;
        }
        if (e.key === "ArrowDown" || e.key === "Down") {
          e.preventDefault();
          engineRef.current?.panBy(0, step);
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "Left") {
          e.preventDefault();
          engineRef.current?.panBy(-step, 0);
          return;
        }
        if (e.key === "ArrowRight" || e.key === "Right") {
          e.preventDefault();
          engineRef.current?.panBy(step, 0);
          return;
        }
        if (e.key === "Home" || e.key === "0") {
          e.preventDefault();
          engineRef.current?.resetPan();
          return;
        }
      };

      const onKeyUp = (e: KeyboardEvent) => {
        if (e.code === "Space" || e.key === " ") {
          engineRef.current?.setSpaceDown(false);
        }
      };

      const onBlur = () => {
        engineRef.current?.setSpaceDown(false);
        clearRepeat();
      };

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onBlur);
        clearRepeat();
      };
    }, [lensOn, onToggleLens, onSelectNode, clearRepeat]);

    // Imperative handle
    useImperativeHandle(
      ref,
      () => ({
        setLayout: (l) => handleLayoutClick(l),
        replayIntro: () => handleReplayIntro(),
        setLens: (on) => {
          if (engineRef.current) engineRef.current.options.lens = on;
        },
        setTheme: (ink) => {
          if (engineRef.current) engineRef.current.ink = ink;
        },
        setOptions: (opts) => {
          if (engineRef.current) Object.assign(engineRef.current.options, opts);
        },
        setKindVisibility: (k, v) => {
          if (engineRef.current) engineRef.current.setKindVisibility(k, v);
        },
        setHistRange: (ratio) => {
          if (engineRef.current) engineRef.current.setHistRange(ratio);
        },
        startHist: () => {
          if (engineRef.current) engineRef.current.startHist();
        },
        stopHist: () => {
          if (engineRef.current) engineRef.current.stopHist();
        },
        showAllHist: () => {
          if (engineRef.current) engineRef.current.showAllHist();
        },
        showPath: (f, t) => {
          return engineRef.current ? engineRef.current.showPath(f, t) : null;
        },
        clearPath: () => {
          if (engineRef.current) engineRef.current.clearPath();
        },
        setEvidence: (ids) => {
          if (engineRef.current) engineRef.current.setEvidence(ids);
        },
        setFocusIds: (ids) => {
          if (engineRef.current) engineRef.current.setFocusIds(ids);
        },
        getSnapshotDataUrl: () => {
          return engineRef.current ? engineRef.current.getSnapshotDataUrl() : "";
        },
        selectNode: (id) => {
          if (engineRef.current) engineRef.current.select(id);
        },
        panBy: (dx, dy) => {
          engineRef.current?.panBy(dx, dy);
        },
        resetPan: () => {
          engineRef.current?.resetPan();
        },
        getPan: () => {
          return engineRef.current ? engineRef.current.getPan() : { x: 0, y: 0 };
        },
        appendData: (newNodes, newEdges) => {
          if (engineRef.current) engineRef.current.appendData(newNodes, newEdges);
        },
        setData: (newNodes, newEdges) => {
          if (engineRef.current) {
            engineRef.current.setData(newNodes, newEdges, reports, reduceMotion);
            engineRef.current.setLayout(activeLayout);
            setIsSpinning(engineRef.current.spin);
          }
        },
      }),
      [handleLayoutClick, handleReplayIntro, reports, reduceMotion, activeLayout]
    );

    // Selected node detail calculation for NodeDossier
    const selNode = selectedId ? nodes.find((n) => n.id === selectedId) : null;
    const neighborIds = selNode && engineRef.current ? engineRef.current.adj.get(selNode.id) || [] : [];
    const neighbors = neighborIds
      .map((id) => {
        const nb = nodes.find((n) => n.id === id);
        return nb ? { id: nb.id, label: nb.label } : null;
      })
      .filter((n): n is { id: string; label: string } => n !== null);

    const seriesTest = selNode ? seriesTests.find((t) => t.node_id === selNode.id) : null;
    const siblingBios = selNode && selNode.k === "section" ? nodes.filter((n) => n.k === "bio" && n.group === selNode.group) : [];

    const summaryCounts = {
      reports: reports.length,
      bios: nodes.filter((n) => n.k === "bio").length,
      meas: nodes.filter((n) => n.k === "meas").length,
    };

    // Hover tooltip
    const hovNode = hoverNodeId && !lensOn ? nodes.find((n) => n.id === hoverNodeId) : null;
    const hovDeg = hovNode && engineRef.current ? (engineRef.current.adj.get(hovNode.id) || []).length : 0;

    return (
      <div
        ref={stageRef}
        className={`stage ${themeInk ? "ink" : ""} ${selNode ? "has-dossier" : ""}`}
        data-testid="graph-stage"
        tabIndex={0}
      >
        <canvas
          ref={canvasRef}
          className="stage-canvas"
          role="img"
          aria-label="Three-dimensional knowledge graph of health reports. Drag to rotate, scroll to zoom, click a node for its details."
        />

        {/* Top-left: counts and search */}
        <div className="ov tl">
          <div className="count">
            {counts.nodes} {counts.nodes === 1 ? "node" : "nodes"} · {counts.links} {counts.links === 1 ? "link" : "links"}
          </div>
          <input
            className="search"
            list="graph-names-list"
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            autoComplete="off"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
          />
          <datalist id="graph-names-list">
            {searchOptions.map((opt) => (
              <option key={opt.id} value={opt.text} />
            ))}
          </datalist>
        </div>

        {/* Top-right: Replay, Pause/Rotate, Lens, Paper/Ink */}
        <div className="ov tr">
          <button
            type="button"
            className="btn btn-small"
            id="replay"
            onClick={handleReplayIntro}
          >
            Replay intro
          </button>
          <button
            type="button"
            className="btn btn-small"
            id="spin"
            aria-pressed={!isSpinning}
            onClick={handleToggleSpin}
          >
            {isSpinning ? "Pause" : "Rotate"}
          </button>
          <button
            type="button"
            className="btn btn-small"
            id="lensBtn"
            aria-pressed={lensOn}
            onClick={() => onToggleLens(!lensOn)}
            data-testid="graph-lens"
          >
            Lens
          </button>
          <button
            type="button"
            className="btn btn-small"
            id="themeBtn"
            onClick={() => onToggleTheme(!themeInk)}
            data-testid="graph-theme"
          >
            {themeInk ? "Paper stage" : "Ink stage"}
          </button>
        </div>

        {/* Opening Intro Sequence */}
        {introActive && !isGrowing && (
          <div className={`ov intro ${introLinesVisible ? "on" : ""} ${introOut ? "out" : ""}`}>
            <div className="k">{customIntroTitle || `Building the graph of ${personName || "Person"}`}</div>
            {reports.length > 0 ? (
              <>
                <div className={`ln ${introLinesVisible ? "on" : ""}`}>
                  <b>{reports.length}</b> {reports.length === 1 ? "report" : "reports"}
                </div>
                <div className={`ln ${introLinesVisible ? "on" : ""}`}>
                  <b>{summaryCounts.bios}</b> biomarkers
                </div>
                <div className={`ln ${introLinesVisible ? "on" : ""}`}>
                  <b>{summaryCounts.meas}</b> values
                </div>
                <div className={`ln ${introLinesVisible ? "on" : ""}`}>
                  <b>{edges.length}</b> links
                </div>
              </>
            ) : (
              <>
                <div className={`ln ${introLinesVisible ? "on" : ""}`}>
                  <b>{nodes.length}</b> {nodes.length === 1 ? "node" : "nodes"}
                </div>
                <div className={`ln ${introLinesVisible ? "on" : ""}`}>
                  <b>{edges.length}</b> {edges.length === 1 ? "link" : "links"}
                </div>
              </>
            )}
          </div>
        )}

        {/* Message bar */}
        {barMessage && (
          <div className="ov bar" role="status">
            {barMessage}
          </div>
        )}

        {/* Time machine date display */}
        {histReport && (
          <div className="ov histdate" aria-live="polite">
            <small>Time machine</small>
            <div className="histdate-title">{histReport.dateLabel}</div>
            {histReport.filename && (
              <div className="histdate-file">{histReport.filename}</div>
            )}
          </div>
        )}

        {/* Move pad (P5, F3) */}
        <div
          className={`ov move-pad ${introActive ? "intro-dim" : ""}`}
          aria-label="Pan controls"
          data-testid="graph-move-pad"
        >
          <div className="move-pad-head">
            <div className="move-pad-title">Move</div>
            <div className="move-pad-hint">Right-drag or Space + drag</div>
          </div>
          <div className="move-pad-grid" role="group" aria-label="Move graph directions">
            <div className="move-pad-cell" />
            <button
              type="button"
              className="move-btn move-btn-up"
              aria-label="Move the graph up"
              title="Move up (Up arrow)"
              onPointerDown={(e) => {
                if (e.button === 0) startRepeat(() => engineRef.current?.panBy(0, -40));
              }}
              onPointerUp={clearRepeat}
              onPointerLeave={clearRepeat}
              onPointerCancel={clearRepeat}
              onBlur={clearRepeat}
              onContextMenu={(e) => e.preventDefault()}
              data-testid="graph-move-up"
            >
              ↑
            </button>
            <div className="move-pad-cell" />

            <button
              type="button"
              className="move-btn move-btn-left"
              aria-label="Move the graph left"
              title="Move left (Left arrow)"
              onPointerDown={(e) => {
                if (e.button === 0) startRepeat(() => engineRef.current?.panBy(-40, 0));
              }}
              onPointerUp={clearRepeat}
              onPointerLeave={clearRepeat}
              onPointerCancel={clearRepeat}
              onBlur={clearRepeat}
              onContextMenu={(e) => e.preventDefault()}
              data-testid="graph-move-left"
            >
              ←
            </button>
            <button
              type="button"
              className="move-btn"
              aria-label="Centre the graph"
              title="Centre (Home or 0)"
              disabled={isCentered}
              onClick={() => engineRef.current?.resetPan()}
              data-testid="graph-move-centre"
            >
              <span className="centre-glyph" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="move-btn move-btn-right"
              aria-label="Move the graph right"
              title="Move right (Right arrow)"
              onPointerDown={(e) => {
                if (e.button === 0) startRepeat(() => engineRef.current?.panBy(40, 0));
              }}
              onPointerUp={clearRepeat}
              onPointerLeave={clearRepeat}
              onPointerCancel={clearRepeat}
              onBlur={clearRepeat}
              onContextMenu={(e) => e.preventDefault()}
              data-testid="graph-move-right"
            >
              →
            </button>

            <div className="move-pad-cell" />
            <button
              type="button"
              className="move-btn move-btn-down"
              aria-label="Move the graph down"
              title="Move down (Down arrow)"
              onPointerDown={(e) => {
                if (e.button === 0) startRepeat(() => engineRef.current?.panBy(0, 40));
              }}
              onPointerUp={clearRepeat}
              onPointerLeave={clearRepeat}
              onPointerCancel={clearRepeat}
              onBlur={clearRepeat}
              onContextMenu={(e) => e.preventDefault()}
              data-testid="graph-move-down"
            >
              ↓
            </button>
            <div className="move-pad-cell" />
          </div>
        </div>

        {/* Layout bar at bottom center */}
        <div className="ov seg layoutbar" role="group" aria-label="Layout of the graph">
          <button
            type="button"
            data-layout="sphere"
            aria-pressed={activeLayout === "sphere"}
            onClick={() => handleLayoutClick("sphere")}
            data-testid="graph-layout-sphere"
          >
            Sphere
          </button>
          <button
            type="button"
            data-layout="orbits"
            aria-pressed={activeLayout === "orbits"}
            onClick={() => handleLayoutClick("orbits")}
            data-testid="graph-layout-orbits"
          >
            Orbits
          </button>
          {!hideTimeline && (
            <button
              type="button"
              data-layout="timeline"
              aria-pressed={activeLayout === "timeline"}
              onClick={() => handleLayoutClick("timeline")}
              data-testid="graph-layout-timeline"
            >
              Timeline
            </button>
          )}
          <button
            type="button"
            data-layout="columns"
            aria-pressed={activeLayout === "columns"}
            onClick={() => handleLayoutClick("columns")}
            data-testid="graph-layout-columns"
          >
            Columns
          </button>
        </div>

        {/* Docked Card: Custom Card or NodeDossier */}
        {selNode && (
          customCard ? (
            customCard({
              node: selNode,
              neighbors,
              totalNeighborCount: neighborIds.length,
              onSelectNode: (id) => {
                if (engineRef.current) engineRef.current.select(id);
                onSelectNode(id);
              },
              onClose: () => {
                if (engineRef.current) engineRef.current.select(null);
                onSelectNode(null);
              },
            })
          ) : (
            <NodeDossier
              userId={userId}
              node={selNode}
              neighbors={neighbors}
              totalNeighborCount={neighborIds.length}
              onSelectNode={(id) => {
                if (engineRef.current) engineRef.current.select(id);
                onSelectNode(id);
              }}
              onClose={() => {
                if (engineRef.current) engineRef.current.select(null);
                onSelectNode(null);
              }}
              seriesTest={seriesTest}
              reports={reports}
              siblingBios={siblingBios}
              summaryCounts={summaryCounts}
            />
          )
        )}

        {/* Hover Tooltip */}
        {hovNode && hoverPos && (
          <div
            className="tip"
            style={{
              left: Math.max(8, hoverPos.x + 18 + 250 > (stageRef.current?.offsetWidth || 800) ? hoverPos.x - 258 : hoverPos.x + 18),
              top: Math.max(8, hoverPos.y - 14),
            }}
          >
            <em>{hovNode.k.toUpperCase()}</em>
            <b>
              {hovNode.k === "bio"
                ? `${hovNode.name || hovNode.label} · ${hovNode.latest ?? ""} ${hovNode.unit}`
                : hovNode.k === "report"
                ? (hovNode.name || hovNode.label)
                : hovNode.label}
            </b>
            <span>
              {hovDeg} connection{hovDeg === 1 ? "" : "s"} · click for details
            </span>
          </div>
        )}
      </div>
    );
  }
);
