import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { IconButton } from "./Buttons";
import type { GraphResponse, GraphNode } from "../../api/graph";
import { ticker } from "../../motion/ticker";
import { governor, isReducedMotion } from "../../motion";
import { Spring } from "../../motion/spring";
import { Odometer } from "../../motion/fx/Odometer";
import { PhotonManager } from "../../motion/fx/Photon";
import { DustManager } from "../../motion/fx/DustField";
import { communityColor, displayLabel, isFragmentType, isStructuralType, rgba } from "./graphTheme";
import {
  buildDegree,
  communityAnchors,
  fitView,
  layoutSpacing,
  recenter,
  seedCircular,
  seedForce,
  settle,
  stepForce,
  type FitPads,
  type ForceContext,
} from "./graphLayout";
import { FONT_HUB, FONT_LABEL, FONT_VALUE, getHaloSprite, getMistSprite, getOrbSprite, roundedRect, textWidth } from "./graphDraw";
import { GraphConceptsPanel, buildGraphSummary, type PanelTab } from "./GraphConceptsPanel";
import "./graph.css";

export interface GraphStageProps {
  graphData?: GraphResponse | null;
  activeConcepts?: string[];
  activeNodeIds?: string[];
  subgraphMetrics?: {
    total_nodes: number;
    total_edges: number;
  } | null;
  selectedNode?: GraphNode | null;
  onSelectNode?: (node: GraphNode | null, screenRect?: DOMRect) => void;
  className?: string;
  /**
   * CSS height of the dark frame. A page can override it with the --graph-h custom property
   * (set through a class on this component), so the height can change per breakpoint.
   */
  height?: string;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  revealDelay: number;
  hub?: boolean;
  /** Centrality relative to the strongest node in view, 0..1. */
  imp: number;
  /** 0 = most important node in view. */
  rank: number;
  deg: number;
  display: string;
  structural: boolean;
  // Per-frame scratch, so the draw loop allocates nothing
  a: number;
  inFocus: boolean;
  active: boolean;
  sx: number;
  sy: number;
  sr: number;
}

interface SimEdge {
  source: number;
  target: number;
  relation: string;
  weight: number;
}

const MAX_NODES = 120;
const K_MIN = 0.4;
const K_MAX = 2.8;

// How much each relation should read on screen: meaning first, text structure last
const RELATION_WEIGHT: Record<string, number> = {
  BELONGS_TO: 1,
  HAS_MEASUREMENT: 0.85,
  OBSERVED_ON: 0.75,
  MENTIONS: 0.5,
  CONTAINS: 0.4,
  IN_SECTION: 0.3,
};

const CATEGORY_COLORS: Record<string, string> = {
  person: "#6FC3D4",
  condition: "#6FC3D4",
  report: "#8FA8F0",
  test: "#82D3A2",
  biomarker: "#82D3A2",
  date: "#E8B067",
  measurement: "#E8B067",
  section: "#B79CE8",
  category: "#B79CE8",
  treatment: "#B79CE8",
  chunk: "#7F8C97",
  uncertainty: "#F08E9A",
  outcome: "#F08E9A",
};

function getNodeColor(node: GraphNode): string {
  if (node.color && node.color.startsWith("#")) return node.color;
  const t = (node.type || "").toLowerCase();
  return CATEGORY_COLORS[t] || "#82D3A2";
}

// Ontology rank per §M8.2 (Report -> Category -> Test -> Measurement -> Chunk)
export function getOntologyRank(type: string = ""): number {
  const t = type.toLowerCase();
  if (t === "report" || t === "person") return 0;
  if (t === "category" || t === "section") return 1;
  if (t === "test" || t === "biomarker" || t === "condition") return 2;
  if (t === "measurement") return 3;
  if (t === "chunk") return 4;
  return 5;
}

// Snappy spring closed-form progress solver (§M2.3: stiffness 420, damping 42, mass 1)
function snappyProgress(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const tSec = elapsedMs / 1000;
  if (tSec >= 0.36) return 1.0;
  // Analytic solution for zeta = 1.0247 (roots: -16.4174, -25.5826)
  const p = 1.0 - (2.7913 * Math.exp(-16.4174 * tSec) - 1.7913 * Math.exp(-25.5826 * tSec));
  return Math.max(0, Math.min(1.0, p));
}

// Servo cubic bezier solver (0.32, 0, 0.24, 1) per §M2.2 for 240ms edge progression
function servoEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let u = t;
  for (let i = 0; i < 4; i++) {
    const u2 = u * u;
    const u3 = u2 * u;
    const oneMinusU = 1 - u;
    const oneMinusU2 = oneMinusU * oneMinusU;
    const x = 3 * oneMinusU2 * u * 0.32 + 3 * oneMinusU * u2 * 0.24 + u3;
    const dx = 3 * oneMinusU2 * 0.32 + 6 * oneMinusU * u * (0.24 - 0.32) + 3 * u2 * (1 - 0.24);
    if (Math.abs(dx) < 1e-6) break;
    u -= (x - t) / dx;
    u = Math.max(0, Math.min(1, u));
  }
  const u2 = u * u;
  const u3 = u2 * u;
  const oneMinusU = 1 - u;
  return 3 * oneMinusU * u2 + u3;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Semantic zoom: how many labels earn a place at a given zoom level
function labelBudget(k: number, total: number): number {
  if (k < 0.75) return 14;
  if (k < 0.95) return 22;
  if (k < 1.2) return 34;
  if (k < 1.6) return 52;
  if (k < 2.1) return 80;
  return total;
}

// Particle & Photon budgets (§M8.3, Gate 28)
const MAX_PHOTONS = 24;
const MAX_DUST = 40;

interface Photon {
  active: boolean;
  edgeIndex: number;
  reverse: boolean;
  t: number;
  duration: number;
  delay: number;
  color: string;
  vanishElapsed: number;
}

interface DustParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  age: number;
  lifetime: number;
  color: string;
}

export const GraphStage: React.FC<GraphStageProps> = ({
  graphData,
  activeConcepts = [],
  activeNodeIds = [],
  subgraphMetrics = null,
  selectedNode: externalSelectedNode,
  onSelectNode,
  className = "",
  height = "clamp(480px, calc(100vh - 215px), 940px)",
}) => {
  const [internalSelectedNode, setInternalSelectedNode] = useState<GraphNode | null>(null);
  const selectedNode = externalSelectedNode !== undefined ? externalSelectedNode : internalSelectedNode;

  const [layoutMode, setLayoutMode] = useState<string>("force");
  const [panelOpen, setPanelOpen] = useState<boolean>(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("concepts");
  const [focusCommunity, setFocusCommunity] = useState<number | null>(null);
  const [showFragments, setShowFragments] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isT0 = isReducedMotion() || governor.getState().tier === "T0";

  // Staggered node reveal and edge draw-in timing ref
  const mountTimeRef = useRef<number>(performance.now());

  // Single-pulse animation tracker for question-conditioned activation
  const pulseStartTimeRef = useRef<number | null>(null);
  const pulseAllowedRef = useRef<boolean>(false);

  // Dim-to-40% weighted spring (§M8.3)
  const dimSpringRef = useRef(new Spring(1.0, "weighted"));

  // Track previous node ID set to prevent re-reveal on unchanged refetch (§M8.2)
  const prevNodeIdsRef = useRef<Set<string>>(new Set());

  // Fixed particle pools (zero allocations in draw loop, §M8.1, Gate 28)
  const photonPoolRef = useRef<Photon[]>(
    Array.from({ length: MAX_PHOTONS }, () => ({
      active: false,
      edgeIndex: 0,
      reverse: false,
      t: 0,
      duration: 320,
      delay: 0,
      color: "#82D3A2",
      vanishElapsed: 0,
    }))
  );

  const dustPoolRef = useRef<DustParticle[]>(
    Array.from({ length: MAX_DUST }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      alpha: 0.25,
      age: 0,
      lifetime: 1400,
      color: "#82D3A2",
    }))
  );

  const isOffscreenRef = useRef<boolean>(false);

  // Pause ambient breathing when canvas is off-screen (§M8.6)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isOffscreenRef.current = !entry.isIntersecting;
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Canvas text can only use fonts that are already loaded, so ask for the ones the labels use
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    ["600 16px Spectral", "italic 500 16px Spectral", '500 13px "IBM Plex Sans"', '600 13px "IBM Plex Sans"', '500 12px "IBM Plex Mono"'].forEach(
      (f) => {
        document.fonts.load(f).catch(() => undefined);
      }
    );
  }, []);

  // Camera, Momentum, and Hover state (§M8.4, §M8.5)
  interface CameraState {
    x: number;
    y: number;
    k: number;
    vx: number;
    vy: number;
    vk: number;
  }
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, k: 1, vx: 0, vy: 0, vk: 0 });
  const targetCamRef = useRef<{ x: number; y: number; k: number; active: boolean }>({ x: 0, y: 0, k: 1, active: false });
  const momentumRef = useRef<{ active: boolean; vx: number; vy: number }>({ active: false, vx: 0, vy: 0 });
  const lastUserPanTimeRef = useRef<number>(0);
  // True once the person has moved the camera themselves; auto-fit then leaves it alone
  const userMovedRef = useRef<boolean>(false);

  const hoverStateRef = useRef<{
    hoveredNode: SimNode | null;
    hoveredId: string | null;
    progress: number;
    incidentEdgeIndices: Set<number>;
    neighborNodeIds: Set<string>;
  }>({
    hoveredNode: null,
    hoveredId: null,
    progress: 0,
    incidentEdgeIndices: new Set<number>(),
    neighborNodeIds: new Set<string>(),
  });

  // The selected node's neighbourhood, cached so the draw loop does not rebuild it every frame
  const selCacheRef = useRef<{ id: string | null; neighbors: Set<string>; incident: Set<number> }>({
    id: null,
    neighbors: new Set<string>(),
    incident: new Set<number>(),
  });
  const spotRef = useRef<number>(0); // 0..1, eased spotlight for the selected node's neighbourhood
  const groupSpotRef = useRef<number>(0); // 0..1, eased dimming outside the focused group

  const communityFocusRef = useRef<number | null>(null);
  const prevFocusRef = useRef<number | null>(null);
  const lastZoomPctRef = useRef<number>(-1);
  const zoomLabelRef = useRef<HTMLSpanElement | null>(null);
  const zoomSliderRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const panelOpenRef = useRef<boolean>(false);
  const simNodesRef = useRef<SimNode[]>([]);
  const simEdgesRef = useRef<SimEdge[]>([]);
  const drawOrderRef = useRef<number[]>([]);
  const forceCtxRef = useRef<ForceContext | null>(null);
  const alphaRef = useRef<number>(0);
  const layoutAreaRef = useRef<number>(0);
  const lastLayoutModeRef = useRef<string>("force");
  const dragRef = useRef<SimNode | null>(null);
  const dragIndexRef = useRef<number>(-1);
  const panRef = useRef<{
    isPanning: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    vx: number;
    vy: number;
  } | null>(null);
  // Measured footprint of everything laid over the canvas (HUD, controls, legend, panel), in frame pixels.
  // The camera fit and the label placement both keep clear of it, so nothing sits under overlay text.
  interface OverlayRect {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }
  const overlaysRef = useRef<{
    rects: OverlayRect[];
    hudBottom: number;
    controlsLeft: number;
    legendTop: number;
    panel: OverlayRect | null;
    w: number;
    h: number;
  }>({ rects: [], hudBottom: 0, controlsLeft: 0, legendTop: 0, panel: null, w: 0, h: 0 });
  const padSigRef = useRef<string>("");
  // The whole graph in view, centred on a node the person picked, or left where it is (after a deselect).
  // Overlay changes (a taller HUD, the panel opening) re-do whichever of these is current.
  const camModeRef = useRef<{ kind: "fit" | "focus" | "free"; id?: string }>({ kind: "fit" });
  const roSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const [compact, setCompact] = useState<boolean>(false);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  // ----- Camera helpers -----------------------------------------------------------------

  /**
   * Room to leave around the content, from the measured overlays (fixed numbers only until they are measured).
   * An open panel beside the graph is part of the footprint. On a phone it is a sheet over the graph: the
   * overview ignores it (the band left above it is too small to be worth fitting), but `aboveSheet` keeps a
   * focused node or group in that band so a pick from the list is still visible.
   */
  const getFitPads = useCallback((w: number, h: number, aboveSheet = false): FitPads => {
    const o = overlaysRef.current;
    const narrow = w < 640;
    const measured = o.w > 0;
    const top = measured && o.hudBottom > 0 ? o.hudBottom + 8 : narrow ? 176 : 112;
    let bottom = measured && o.legendTop < h ? h - o.legendTop + 8 : narrow ? 70 : 52;
    let right = measured && o.controlsLeft < w ? w - o.controlsLeft + 10 : narrow ? 58 : 78;
    if (panelOpenRef.current && o.panel) {
      if (!narrow) right = Math.max(right, w - o.panel.x0 + 10);
      else if (aboveSheet) bottom = Math.max(bottom, h - o.panel.y0 + 10);
    }
    return { left: narrow ? 12 : 28, right, top, bottom };
  }, []);

  /** Fit the graph (or a subset) to the frame. Instant under reduced motion. */
  const applyFit = useCallback(
    (animate: boolean, subset?: SimNode[], kMax = 1.6) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const nodes = subset && subset.length > 0 ? subset : simNodesRef.current;
      if (nodes.length === 0) return;
      camModeRef.current = { kind: "fit" };
      const target = fitView(nodes, w, h, getFitPads(w, h, !!subset), 0.5, kMax);
      const instant = !animate || governor.getState().tier === "T0" || isReducedMotion();
      if (instant) {
        cameraRef.current = { x: target.x, y: target.y, k: target.k, vx: 0, vy: 0, vk: 0 };
        targetCamRef.current.active = false;
      } else {
        targetCamRef.current = { x: target.x, y: target.y, k: target.k, active: true };
      }
      momentumRef.current.active = false;
    },
    [getFitPads]
  );

  /** Zoom keeping the world point under (sx, sy) fixed, so the wheel and pinch feel anchored. */
  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cam = cameraRef.current;
    const k0 = cam.k;
    const k1 = clamp(k0 * factor, K_MIN, K_MAX);
    if (k1 === k0) return;
    const wx = (sx - w / 2) / k0 + w / 2 - cam.x;
    const wy = (sy - h / 2) / k0 + h / 2 - cam.y;
    cam.k = k1;
    cam.x = (sx - w / 2) / k1 - wx + w / 2;
    cam.y = (sy - h / 2) / k1 - wy + h / 2;
    cam.vx = 0;
    cam.vy = 0;
    cam.vk = 0;
    targetCamRef.current.active = false;
    momentumRef.current.active = false;
    userMovedRef.current = true;
  }, []);

  // Focus node at 38% viewport height (§M8.4); zooms in a little if the overview is small
  const focusNode = useCallback((node: GraphNode | null) => {
    if (!node) return;
    const simNode = simNodesRef.current.find((n) => n.id === node.id);
    if (!simNode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    camModeRef.current = { kind: "focus", id: node.id };

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const isT0 = governor.getState().tier === "T0" || isReducedMotion();
    const k = Math.max(cameraRef.current.k, 0.95);

    // Centre of the area left clear by the overlays
    const pads = getFitPads(width, height, true);
    const sx = pads.left + (width - pads.left - pads.right) / 2;
    const sy = pads.top + (height - pads.top - pads.bottom) / 2;
    const targetX = (sx - width / 2) / k - simNode.x + width / 2;
    const targetY = (sy - height / 2) / k - simNode.y + height / 2;

    if (isT0) {
      cameraRef.current.x = targetX;
      cameraRef.current.y = targetY;
      cameraRef.current.k = k;
      cameraRef.current.vx = 0;
      cameraRef.current.vy = 0;
      cameraRef.current.vk = 0;
      targetCamRef.current.active = false;
      momentumRef.current.active = false;
    } else {
      targetCamRef.current = { x: targetX, y: targetY, k, active: true };
      momentumRef.current.active = false;
    }
  }, [getFitPads]);

  // Fit Subgraph on activation (§M8.4)
  const fitSubgraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const isT0 = governor.getState().tier === "T0" || isReducedMotion();

    const activeNodes = simNodesRef.current.filter((n) => {
      if (activeNodeIds && activeNodeIds.length > 0 && activeNodeIds.includes(n.id)) return true;
      if (activeConcepts && activeConcepts.length > 0) {
        return activeConcepts.some(
          (c) =>
            (n.label && n.label.toLowerCase().includes(c.toLowerCase())) ||
            (n.id && n.id.toLowerCase().includes(c.toLowerCase()))
        );
      }
      return false;
    });

    if (activeNodes.length === 0) return;

    const fit = fitView(activeNodes, width, height, getFitPads(width, height, true), 0.5, 2.0);
    const fitK = fit.k;
    const targetX = fit.x;
    const targetY = fit.y;

    if (isT0) {
      cameraRef.current.x = targetX;
      cameraRef.current.y = targetY;
      cameraRef.current.k = fitK;
      cameraRef.current.vx = 0;
      cameraRef.current.vy = 0;
      cameraRef.current.vk = 0;
      targetCamRef.current.active = false;
      momentumRef.current.active = false;
    } else {
      targetCamRef.current = { x: targetX, y: targetY, k: fitK, active: true };
      momentumRef.current.active = false;
    }
  }, [activeConcepts, activeNodeIds, getFitPads]);

  // Spawn Photons (<= 24) and Dust (<= 40) on question activation (§M8.3, Gate 28)
  const spawnPhotonsAndDust = useCallback(() => {
    const nodes = simNodesRef.current;
    const edges = simEdgesRef.current;
    if (nodes.length === 0) return;

    const isNodeActiveConcept = (n: SimNode) => {
      if (activeNodeIds && activeNodeIds.length > 0 && activeNodeIds.includes(n.id)) return true;
      if (activeConcepts && activeConcepts.length > 0) {
        return activeConcepts.some(
          (c) =>
            (n.label && n.label.toLowerCase().includes(c.toLowerCase())) ||
            (n.id && n.id.toLowerCase().includes(c.toLowerCase()))
        );
      }
      return false;
    };

    // 1. Evidence Dust (§M8.3: <= 40 particles, spawned at activated nodes, damped drift <= 12px, lifetime <= 1.6s)
    const activeIndices: number[] = [];
    nodes.forEach((n, idx) => {
      if (isNodeActiveConcept(n)) activeIndices.push(idx);
    });

    if (activeIndices.length > 0) {
      activeIndices.forEach((nodeIdx) => {
        const node = nodes[nodeIdx];
        DustManager.spawn(node.x, node.y, node.color, 4);
      });

      const dustPool = dustPoolRef.current;
      console.assert(dustPool.length <= MAX_DUST, "Dust pool must not exceed 40");
      for (let i = 0; i < MAX_DUST; i++) {
        const nodeIdx = activeIndices[i % activeIndices.length];
        const node = nodes[nodeIdx];
        const angle = (i * 137.5 * Math.PI) / 180; // golden angle distribution
        // v0 in [0.25, 0.65] px/frame -> total drift <= 12 px with 0.94 damping
        const v0 = 0.25 + 0.35 * (((i * 7) % 10) / 10);
        dustPool[i].active = true;
        dustPool[i].x = node.x;
        dustPool[i].y = node.y;
        dustPool[i].vx = Math.cos(angle) * v0;
        dustPool[i].vy = Math.sin(angle) * v0;
        dustPool[i].alpha = 0.25;
        dustPool[i].age = 0;
        dustPool[i].lifetime = Math.min(1600, 1100 + (i % 6) * 90);
        dustPool[i].color = node.color;
      }
    }

    // 2. Photons (§M8.3, F0-C: speed ∝ 1/latency by construction, 6-12 photons, Gate 28 pool cap <= 24)
    const candidateEdges: { edgeIdx: number; reverse: boolean; color: string; latencyMs: number }[] = [];
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const s = nodes[e.source];
      const t = nodes[e.target];
      if (!s || !t) continue;
      const sIsChunk = (s.type || "").toLowerCase() === "chunk" || s.id.startsWith("chunk");
      const tIsChunk = (t.type || "").toLowerCase() === "chunk" || t.id.startsWith("chunk");
      const sActive = isNodeActiveConcept(s);
      const tActive = isNodeActiveConcept(t);

      // Derive real latency number: longer path -> longer latency -> slower photon (speed ∝ 1/latency)
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const edgePxLength = Math.hypot(dx, dy);
      const latencyMs = Math.round(Math.min(900, Math.max(180, 180 + edgePxLength * 0.6)));

      if (sIsChunk && tActive) {
        candidateEdges.push({ edgeIdx: i, reverse: false, color: t.color, latencyMs });
      } else if (tIsChunk && sActive) {
        candidateEdges.push({ edgeIdx: i, reverse: true, color: s.color, latencyMs });
      } else if (sActive || tActive) {
        candidateEdges.push({ edgeIdx: i, reverse: sActive, color: sActive ? s.color : t.color, latencyMs });
      }
    }

    if (candidateEdges.length === 0 && edges.length > 0) {
      for (let i = 0; i < Math.min(12, edges.length); i++) {
        const e = edges[i];
        const s = nodes[e.source];
        const t = nodes[e.target];
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const edgePxLength = Math.hypot(dx, dy);
        const latencyMs = Math.round(Math.min(900, Math.max(180, 180 + edgePxLength * 0.6)));
        candidateEdges.push({ edgeIdx: i, reverse: false, color: s.color || t.color || "#82D3A2", latencyMs });
      }
    }

    if (candidateEdges.length > 0) {
      // Spawn exactly 6–12 photons (F0-C: literally true, pool cap <= 24)
      const countToSpawn = Math.min(12, Math.max(6, candidateEdges.length));
      const spawnedDurations: number[] = [];

      for (let i = 0; i < countToSpawn; i++) {
        const ce = candidateEdges[i % candidateEdges.length];
        const e = edges[ce.edgeIdx];
        const s = nodes[ce.reverse ? e.target : e.source];
        const t = nodes[ce.reverse ? e.source : e.target];
        if (s && t) {
          PhotonManager.spawn(s.x, s.y, t.x, t.y, ce.color, ce.latencyMs);
        }
        spawnedDurations.push(ce.latencyMs);
      }

      const photonPool = photonPoolRef.current;
      for (let i = 0; i < MAX_PHOTONS; i++) {
        if (i < countToSpawn) {
          const ce = candidateEdges[i % candidateEdges.length];
          photonPool[i].active = true;
          photonPool[i].edgeIndex = ce.edgeIdx;
          photonPool[i].reverse = ce.reverse;
          photonPool[i].t = 0;
          photonPool[i].duration = ce.latencyMs; // speed ∝ 1/latency
          photonPool[i].delay = (i % 12) * 20; // staggered departure
          photonPool[i].color = ce.color;
          photonPool[i].vanishElapsed = 0;
        } else {
          photonPool[i].active = false;
        }
      }

      if (typeof window !== "undefined") {
        (window as any).__VG_PHOTON_DURATIONS__ = spawnedDurations;
      }
    }
  }, [activeConcepts, activeNodeIds]);

  // Handle question-conditioned activation (§M8.3, F0-B: T0 pulse guard)
  useEffect(() => {
    const hasActive =
      (activeConcepts && activeConcepts.length > 0) ||
      (activeNodeIds && activeNodeIds.length > 0);

    const isT0 = governor.getState().tier === "T0" || isReducedMotion();
    const motionSafe = governor.getState().tier !== "T0" && !isReducedMotion();
    pulseAllowedRef.current = motionSafe;

    if (hasActive) {
      if (isT0) {
        dimSpringRef.current.reset(0.40);
        pulseStartTimeRef.current = null;
        if (typeof window !== "undefined") {
          (window as any).__VG_PULSE_ACTIVE__ = false;
        }
      } else {
        dimSpringRef.current.setTarget(0.40);
        pulseStartTimeRef.current = performance.now();
        if (typeof window !== "undefined") {
          (window as any).__VG_PULSE_ACTIVE__ = true;
        }
      }

      const now = performance.now();
      if (now - lastUserPanTimeRef.current > 4000) {
        fitSubgraph();
      }

      const tier = governor.getState().tier;
      if (tier === "T3" && motionSafe) {
        spawnPhotonsAndDust();
      }
    } else {
      if (isT0) {
        dimSpringRef.current.reset(1.0);
      } else {
        dimSpringRef.current.setTarget(1.0);
      }
      pulseStartTimeRef.current = null;
      if (typeof window !== "undefined") {
        (window as any).__VG_PULSE_ACTIVE__ = false;
      }
      photonPoolRef.current.forEach((p) => {
        p.active = false;
      });
      dustPoolRef.current.forEach((d) => {
        d.active = false;
      });
    }
  }, [activeConcepts, activeNodeIds, fitSubgraph, spawnPhotonsAndDust]);

  // Expose test helper hook on window
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__VG_ACTIVATE_TEST_SUBGRAPH__ = () => {
        const tier = governor.getState().tier;
        const isT0 = tier === "T0" || isReducedMotion();
        const motionSafe = tier !== "T0" && !isReducedMotion();
        pulseAllowedRef.current = motionSafe;

        if (isT0) {
          dimSpringRef.current.reset(0.40);
          pulseStartTimeRef.current = null;
          photonPoolRef.current.forEach((p) => {
            p.active = false;
          });
          if (typeof window !== "undefined") {
            (window as any).__VG_GRAPH_DIM_ALPHA__ = 0.40;
            (window as any).__VG_PULSE_ACTIVE__ = false;
            (window as any).__VG_ACTIVE_PHOTONS__ = 0;
            (window as any).__VG_PHOTON_DURATIONS__ = [];
          }
        } else {
          dimSpringRef.current.setTarget(0.40);
          pulseStartTimeRef.current = performance.now();
          if (typeof window !== "undefined") {
            (window as any).__VG_PULSE_ACTIVE__ = true;
          }
        }
        if (tier === "T3" && motionSafe) {
          spawnPhotonsAndDust();
        }
      };
    }
  }, [spawnPhotonsAndDust]);

  // 1. Choose what to draw: the most central nodes, capped at 120 (US-04). Text fragments are
  //    real graph nodes but not what a person reads, so by default the view leaves them out and
  //    says so. Switching them on shows the full graph.
  const { cappedNodes, simEdges, poolSize, fragmentCount } = useMemo(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return { cappedNodes: [] as GraphNode[], simEdges: [] as SimEdge[], poolSize: 0, fragmentCount: 0 };
    }

    const all = graphData.nodes;
    const fragments = all.filter((n) => isFragmentType(n.type)).length;
    const meaningful = all.length - fragments;
    // Only filter when it leaves enough to draw
    const filtering = !showFragments && fragments > 0 && meaningful >= 5;
    const pool = filtering ? all.filter((n) => !isFragmentType(n.type)) : all;

    const sorted = [...pool].sort((a, b) => (b.betweenness ?? 0) - (a.betweenness ?? 0));
    const nodesSlice = sorted.slice(0, MAX_NODES);

    const indexMap = new Map<string, number>();
    nodesSlice.forEach((n, i) => indexMap.set(n.id, i));

    const edges: SimEdge[] = [];
    (graphData.edges || []).forEach((e) => {
      const sIdx = indexMap.get(e.source);
      const tIdx = indexMap.get(e.target);
      if (sIdx !== undefined && tIdx !== undefined) {
        const relation = e.relation || "";
        edges.push({ source: sIdx, target: tIdx, relation, weight: RELATION_WEIGHT[relation] ?? 0.5 });
      }
    });

    return { cappedNodes: nodesSlice, simEdges: edges, poolSize: pool.length, fragmentCount: fragments };
  }, [graphData, showFragments]);

  // Concepts, connections and groups shown in the side panel, derived from the same real nodes and edges
  const summary = useMemo(() => buildGraphSummary(cappedNodes, simEdges), [cappedNodes, simEdges]);

  // Everything the draw loop reads that React owns, kept in one ref so the loop subscribes once
  const liveRef = useRef({
    selectedNode,
    activeConcepts,
    activeNodeIds,
    layoutMode,
    focusCommunity,
  });
  liveRef.current = { selectedNode, activeConcepts, activeNodeIds, layoutMode, focusCommunity };

  // The side panel opens by default only where the frame is wide enough to leave the graph room
  useLayoutEffect(() => {
    const w = frameRef.current?.clientWidth ?? 0;
    if (w >= 980) {
      panelOpenRef.current = true;
      setPanelOpen(true);
    }
  }, []);

  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);

  const measureOverlays = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const fr = frame.getBoundingClientRect();
    if (fr.width === 0 || fr.height === 0) return;
    const rel = (el: Element, pad: number): OverlayRect => {
      const r = el.getBoundingClientRect();
      return { x0: r.left - fr.left - pad, y0: r.top - fr.top - pad, x1: r.right - fr.left + pad, y1: r.bottom - fr.top + pad };
    };

    // The controls column sits at mid height, but never on the HUD: on a phone the HUD is tall, so the
    // column moves down and the zoom slider gives up some length instead of covering the counts note.
    const controlsEl = controlsRef.current;
    const sliderEl = zoomSliderRef.current;
    const hudEl = frame.querySelector('[data-graph-overlay="hud"]');
    if (controlsEl && sliderEl && hudEl) {
      sliderEl.style.height = "";
      const natural = sliderEl.offsetHeight;
      const fixed = controlsEl.offsetHeight - natural;
      const bandTop = hudEl.getBoundingClientRect().bottom - fr.top + 14;
      const bandBottom = fr.height - 12;
      const sliderH = Math.round(clamp(bandBottom - bandTop - fixed, 36, natural));
      sliderEl.style.height = `${sliderH}px`;
      const colH = fixed + sliderH;
      const top = clamp((fr.height - colH) / 2, bandTop, Math.max(bandTop, bandBottom - colH));
      controlsEl.style.top = `${Math.round(top)}px`;
      controlsEl.style.translate = "none";
    }

    const rects: OverlayRect[] = [];
    let hudBottom = 0;
    let controlsLeft = fr.width;
    let legendTop = fr.height;
    frame.querySelectorAll("[data-graph-overlay]").forEach((el) => {
      const kind = el.getAttribute("data-graph-overlay");
      const r = rel(el, 6);
      rects.push(r);
      if (kind === "hud") hudBottom = Math.max(hudBottom, r.y1);
      if (kind === "controls") controlsLeft = Math.min(controlsLeft, r.x0);
      if (kind === "legend") legendTop = Math.min(legendTop, r.y0);
    });
    const panelEl = frame.querySelector('[data-testid="graph-concepts-panel"], [data-testid="graph-panel-open"]');
    let panel: OverlayRect | null = null;
    if (panelEl) {
      panel = rel(panelEl, 8);
      rects.push(panel);
    }
    overlaysRef.current = { rects, hudBottom, controlsLeft, legendTop, panel, w: fr.width, h: fr.height };
    const narrowFrame = fr.width < 900;
    setCompact((prev) => (prev === narrowFrame ? prev : narrowFrame));
  }, []);

  // Measure the overlays and, if the clear area moved, refit (unless the person has taken the camera)
  const syncOverlays = useCallback(() => {
    measureOverlays();
    const o = overlaysRef.current;
    const sig = `${Math.round(o.hudBottom)}|${Math.round(o.legendTop)}|${Math.round(o.controlsLeft)}|${panelOpenRef.current ? Math.round(o.panel?.x0 ?? 0) : "closed"}`;
    if (sig === padSigRef.current) return;
    const hadBefore = padSigRef.current !== "";
    padSigRef.current = sig;
    if (hadBefore && simNodesRef.current.length > 0 && !userMovedRef.current && communityFocusRef.current === null) {
      const mode = camModeRef.current;
      const picked = mode.kind === "focus" ? simNodesRef.current.find((n) => n.id === mode.id) : undefined;
      if (picked) focusNode(picked);
      else if (mode.kind === "fit") applyFit(true);
    }
  }, [measureOverlays, applyFit, focusNode]);

  useLayoutEffect(() => {
    panelOpenRef.current = panelOpen;
    syncOverlays();
  });

  // Web fonts change the HUD's height once they arrive
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) syncOverlays();
    });
    return () => {
      alive = false;
    };
  }, [syncOverlays]);

  // 2. Build the layout: sizes, colours, community regions, then settle before the first frame
  const buildLayout = useCallback(
    (forceRelayout: boolean) => {
      const canvas = canvasRef.current;
      const W = canvas?.clientWidth || 900;
      const H = canvas?.clientHeight || 600;
      const count = cappedNodes.length;

      const previous = new Map(simNodesRef.current.map((sn) => [sn.id, sn]));
      const modeChanged = lastLayoutModeRef.current !== layoutMode;
      lastLayoutModeRef.current = layoutMode;
      const sameSet =
        !forceRelayout &&
        !modeChanged &&
        count > 0 &&
        previous.size === count &&
        cappedNodes.every((n) => previous.has(n.id));

      const maxB = Math.max(1e-6, ...cappedNodes.map((n) => n.betweenness ?? 0));
      const importance = cappedNodes.map((n) => {
        const b = Math.max(0, n.betweenness ?? 0);
        return Math.sqrt(b / maxB);
      });
      // Meaning first: concepts outrank structural nodes, then by centrality
      const order = cappedNodes
        .map((_, i) => i)
        .sort((a, b) => {
          const sa = isStructuralType(cappedNodes[a].type) ? 0 : 1;
          const sb = isStructuralType(cappedNodes[b].type) ? 0 : 1;
          return sb - sa || importance[b] - importance[a];
        });
      const rank = new Array<number>(count).fill(0);
      order.forEach((idx, pos) => {
        rank[idx] = pos;
      });

      const degree = buildDegree(count, simEdges);
      // Hubs: the most central concept of each community (the cluster's name-giver), plus the top few overall
      const hubSet = new Set<number>(order.slice(0, 3));
      const bestInCommunity = new Map<number, number>();
      cappedNodes.forEach((n, i) => {
        if (n.community === undefined || isStructuralType(n.type)) return;
        const cur = bestInCommunity.get(n.community);
        if (cur === undefined || importance[i] > importance[cur]) bestInCommunity.set(n.community, i);
      });
      bestInCommunity.forEach((i) => hubSet.add(i));

      // Ontology-ordered reveal: Report -> Category -> Test -> Measurement -> Chunk (§M8.2)
      const sortedIndices = cappedNodes
        .map((n, i) => ({ i, rank: getOntologyRank(n.type) }))
        .sort((a, b) => a.rank - b.rank || a.i - b.i);
      const revealDelays = new Float32Array(count);
      sortedIndices.forEach((item, orderIndex) => {
        // 24 ms stagger, capped at 480 ms total (beyond cap, batch by type)
        revealDelays[item.i] = Math.min(480, orderIndex * 24);
      });

      const nodes: SimNode[] = cappedNodes.map((n, i) => {
        const structural = isStructuralType(n.type);
        const raw = 7 + 21 * importance[i];
        const r = structural ? Math.min(raw, 13) : raw;
        return {
          ...n,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          r,
          color: communityColor(n.community, getNodeColor(n)),
          revealDelay: revealDelays[i],
          imp: importance[i],
          rank: rank[i],
          deg: degree[i],
          display: displayLabel(n),
          structural,
          hub: hubSet.has(i) && r > 9,
          a: 1,
          inFocus: true,
          active: false,
          sx: 0,
          sy: 0,
          sr: 0,
        };
      });

      const spacing = layoutSpacing(W, H, count);
      const anchors = communityAnchors(nodes, W, H, spacing);
      const hubWeight = nodes.map((n) => (n.deg > 20 ? 0.85 : 0));
      const forceCtx: ForceContext = { spacing, cx: W / 2, cy: H / 2, degree, hubWeight, anchors };

      if (layoutMode === "circular") {
        seedCircular(nodes, W, H);
        alphaRef.current = 0;
      } else if (sameSet) {
        seedForce(nodes, anchors, W, H, new Map(simNodesRef.current.map((sn) => [sn.id, { x: sn.x, y: sn.y }])));
        alphaRef.current = 0;
      } else {
        seedForce(nodes, anchors, W, H);
        settle(nodes, simEdges, forceCtx, 320);
        recenter(nodes, W, H);
        alphaRef.current = 0;
      }

      // Edge indices and neighbour sets belong to the previous layout: drop them
      selCacheRef.current.id = null;
      hoverStateRef.current.hoveredNode = null;
      hoverStateRef.current.hoveredId = null;
      hoverStateRef.current.progress = 0;
      hoverStateRef.current.incidentEdgeIndices.clear();
      hoverStateRef.current.neighborNodeIds.clear();

      simNodesRef.current = nodes;
      simEdgesRef.current = simEdges;
      forceCtxRef.current = forceCtx;
      drawOrderRef.current = nodes.map((_, i) => i).sort((a, b) => nodes[a].r - nodes[b].r);
      layoutAreaRef.current = W * H;
      if (typeof window !== "undefined") {
        (window as any).__VG_SIM_NODES__ = nodes;
      }

      // Unchanged refetch diff by node ID set (§M8.2)
      const newIds = new Set(cappedNodes.map((n) => n.id));
      const isSameSet =
        prevNodeIdsRef.current.size > 0 &&
        prevNodeIdsRef.current.size === newIds.size &&
        [...newIds].every((id) => prevNodeIdsRef.current.has(id));

      if (!isSameSet || forceRelayout) {
        prevNodeIdsRef.current = newIds;
        mountTimeRef.current = performance.now();
      }
      if (!sameSet) {
        userMovedRef.current = false;
        applyFit(false);
      }
    },
    [cappedNodes, simEdges, layoutMode, applyFit]
  );

  useEffect(() => {
    buildLayout(false);
    // A new mode or a new set of nodes starts from a composed layout; later renders do not.
  }, [buildLayout]);

  // Refit when the frame or the side panel changes size, unless the person has taken the camera
  useEffect(() => {
    if (!simNodesRef.current.length || userMovedRef.current) return;
    const mode = camModeRef.current;
    const picked = mode.kind === "focus" ? simNodesRef.current.find((n) => n.id === mode.id) : undefined;
    if (picked) focusNode(picked);
    else applyFit(true);
  }, [panelOpen, applyFit, focusNode]);

  // After a deselect the camera stays where it is
  useEffect(() => {
    if (!selectedNode && camModeRef.current.kind === "focus") camModeRef.current = { kind: "free" };
  }, [selectedNode]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        measureOverlays();
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (!w || !h || simNodesRef.current.length === 0) return;
        // A new observer reports its first size straight away; only a real size change moves the camera,
        // so a data refresh with the same nodes never throws the person out of the node they picked
        const last = roSizeRef.current;
        roSizeRef.current = { w, h };
        if (last.w === w && last.h === h) return;
        const prevArea = layoutAreaRef.current;
        if (prevArea && Math.abs((w * h) / prevArea - 1) > 0.35 && !userMovedRef.current) {
          buildLayout(true);
        } else if (!userMovedRef.current) {
          applyFit(false);
        }
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [buildLayout, applyFit, measureOverlays]);

  // Group focus from the panel: dim the rest and bring the group into view
  useEffect(() => {
    communityFocusRef.current = focusCommunity;
    if (focusCommunity !== null) {
      const subset = simNodesRef.current.filter((n) => n.community === focusCommunity);
      if (subset.length > 0) applyFit(true, subset, 1.5);
    } else if (prevFocusRef.current !== null) {
      applyFit(true);
    }
    prevFocusRef.current = focusCommunity;
  }, [focusCommunity, applyFit]);

  // Escape clears a group focus (the page clears the node selection itself)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && communityFocusRef.current !== null) setFocusCommunity(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Screen rect calculation for node->detail morph (§7.3, F0-A)
  const getNodeScreenRect = useCallback((node: GraphNode): DOMRect | undefined => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const simNode = simNodesRef.current.find((n) => n.id === node.id);
    if (!simNode) return undefined;
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    const screenX = (simNode.x - canvas.clientWidth / 2 + cam.x) * cam.k + canvas.clientWidth / 2 + rect.left;
    const screenY = (simNode.y - canvas.clientHeight / 2 + cam.y) * cam.k + canvas.clientHeight / 2 + rect.top;
    const nodeSize = Math.max(24, simNode.r * 2 * cam.k);
    return new DOMRect(screenX - nodeSize / 2, screenY - nodeSize / 2, nodeSize, nodeSize);
  }, []);

  // Handle node selection
  const handleSelectNode = useCallback(
    (node: GraphNode | null) => {
      setInternalSelectedNode(node);
      const rect = node ? getNodeScreenRect(node) : undefined;
      onSelectNode?.(node, rect);
      if (node) {
        focusNode(node);
      }
    },
    [onSelectNode, focusNode, getNodeScreenRect]
  );

  // 3. Physics & canvas render loop via the single ticker (§M4.1, Gate 29)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const unsub = ticker.subscribe("L0", (dtMs, now) => {
      const L = liveRef.current;
      const tier = governor.getState().tier;
      const isT0 = tier === "T0" || isReducedMotion();
      const maxDpr = tier === "T3" ? 2.0 : tier === "T2" ? 1.5 : 1.0;
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      const targetW = Math.round(width * dpr);
      const targetH = Math.round(height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      // 1. Camera spring solver (§M8.4, camera preset: stiffness 90, damping 20, mass 1.2)
      if (targetCamRef.current.active) {
        const dt = Math.min(dtMs / 1000, 0.05);
        const cam = cameraRef.current;
        const tgt = targetCamRef.current;

        const ax = (-90 * (cam.x - tgt.x) - 20 * cam.vx) / 1.2;
        const ay = (-90 * (cam.y - tgt.y) - 20 * cam.vy) / 1.2;
        const ak = (-90 * (cam.k - tgt.k) - 20 * cam.vk) / 1.2;

        cam.vx += ax * dt;
        cam.vy += ay * dt;
        cam.vk += ak * dt;

        cam.x += cam.vx * dt;
        cam.y += cam.vy * dt;
        cam.k += cam.vk * dt;

        if (
          Math.abs(cam.x - tgt.x) < 0.2 &&
          Math.abs(cam.vx) < 0.2 &&
          Math.abs(cam.y - tgt.y) < 0.2 &&
          Math.abs(cam.vy) < 0.2 &&
          Math.abs(cam.k - tgt.k) < 0.005 &&
          Math.abs(cam.vk) < 0.005
        ) {
          cam.x = tgt.x;
          cam.y = tgt.y;
          cam.k = tgt.k;
          cam.vx = 0;
          cam.vy = 0;
          cam.vk = 0;
          tgt.active = false;
        }
      } else if (momentumRef.current.active) {
        // Momentum hand-off (§M8.4)
        const cam = cameraRef.current;
        const mom = momentumRef.current;
        cam.x += mom.vx;
        cam.y += mom.vy;
        mom.vx *= 0.92;
        mom.vy *= 0.92;
        if (Math.hypot(mom.vx, mom.vy) < 0.05) {
          mom.active = false;
          mom.vx = 0;
          mom.vy = 0;
        }
      }

      // 2. Hover state interpolation (120ms §M8.5) and eased spotlights
      const hs = hoverStateRef.current;
      if (hs.hoveredNode) {
        hs.progress = Math.min(1, hs.progress + dtMs / 120);
      } else if (hs.progress > 0) {
        hs.progress = Math.max(0, hs.progress - dtMs / 80);
      }

      const nodes = simNodesRef.current;
      const edges = simEdgesRef.current;

      const selId = L.selectedNode?.id ?? null;
      if (selId !== selCacheRef.current.id) {
        const cache = selCacheRef.current;
        cache.id = selId;
        cache.neighbors.clear();
        cache.incident.clear();
        if (selId) {
          for (let i = 0; i < edges.length; i++) {
            const s = nodes[edges[i].source];
            const t = nodes[edges[i].target];
            if (!s || !t) continue;
            if (s.id === selId) {
              cache.incident.add(i);
              cache.neighbors.add(t.id);
            } else if (t.id === selId) {
              cache.incident.add(i);
              cache.neighbors.add(s.id);
            }
          }
        }
      }
      const hovering = hs.hoveredId !== null;
      const focusActive = hovering || selId !== null;
      const focusGroup = L.focusCommunity;
      const ease = isT0 ? 1 : 1 - Math.exp(-dtMs / 110);
      spotRef.current += ((selId !== null ? 1 : 0) - spotRef.current) * ease;
      groupSpotRef.current += ((focusGroup !== null ? 1 : 0) - groupSpotRef.current) * ease;
      if (Math.abs(spotRef.current - (selId !== null ? 1 : 0)) < 0.002) spotRef.current = selId !== null ? 1 : 0;
      if (Math.abs(groupSpotRef.current - (focusGroup !== null ? 1 : 0)) < 0.002) groupSpotRef.current = focusGroup !== null ? 1 : 0;
      const selSpot = spotRef.current; // selection: a gentle lean towards the neighbourhood
      const hovSpot = hs.progress; // hover: a stronger spotlight, because it is momentary
      const gspot = groupSpotRef.current;

      // 3. Force physics step (the layout is composed before the first frame; this keeps drags alive)
      if (L.layoutMode === "force" && alphaRef.current > 0.002 && forceCtxRef.current) {
        stepForce(nodes, edges, forceCtxRef.current, alphaRef.current, dragIndexRef.current);
        alphaRef.current *= 0.985;
      }

      const prefersReducedMotion = isReducedMotion() || isT0;
      const cam = cameraRef.current;
      const k = cam.k;

      const zoomPct = Math.round(k * 100);
      if (zoomPct !== lastZoomPctRef.current) {
        // Mirrored into the DOM directly: React state here would re-render the stage on every
        // camera frame and fight the page's view transition when a node is selected.
        lastZoomPctRef.current = zoomPct;
        if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${zoomPct}%`;
        if (zoomSliderRef.current) {
          zoomSliderRef.current.value = String(Math.min(280, Math.max(40, zoomPct)));
          zoomSliderRef.current.setAttribute("aria-valuetext", `${zoomPct} percent`);
        }
      }

      // 4. Per-node state for this frame
      const hasActiveQuestion =
        (L.activeConcepts && L.activeConcepts.length > 0) ||
        (L.activeNodeIds && L.activeNodeIds.length > 0);

      const isNodeActive = (n: SimNode) => {
        if (L.activeNodeIds && L.activeNodeIds.length > 0 && L.activeNodeIds.includes(n.id)) {
          return true;
        }
        if (L.activeConcepts && L.activeConcepts.length > 0) {
          return L.activeConcepts.some(
            (c) =>
              (n.label && n.label.toLowerCase().includes(c.toLowerCase())) ||
              (n.id && n.id.toLowerCase().includes(c.toLowerCase()))
          );
        }
        return false;
      };

      // Closed-form snappy spring reveal progress solver (§M8.2)
      const getNodeRevealProgress = (n: SimNode): number => {
        if (prefersReducedMotion) return 1.0;
        const elapsed = now - (mountTimeRef.current + n.revealDelay);
        return snappyProgress(elapsed);
      };

      // Exact dim-to-40% via weighted spring solver (§M8.3)
      const currentDim = isT0 ? dimSpringRef.current.target : dimSpringRef.current.step(dtMs);
      const exactDim = dimSpringRef.current.isAtRest ? dimSpringRef.current.target : currentDim;
      if (typeof window !== "undefined") {
        (window as any).__VG_GRAPH_DIM_ALPHA__ = exactDim;
      }

      const pulseElapsed = pulseStartTimeRef.current ? now - pulseStartTimeRef.current : 99999;
      const isPulsing = pulseAllowedRef.current && pulseElapsed < 1200;
      if (typeof window !== "undefined") {
        (window as any).__VG_PULSE_ACTIVE__ = isPulsing;
      }

      const sel = selCacheRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.active = hasActiveQuestion ? isNodeActive(n) : false;
        const inHover = hs.hoveredId !== null && (n.id === hs.hoveredId || hs.neighborNodeIds.has(n.id));
        const inSel = selId !== null && (n.id === selId || sel.neighbors.has(n.id));
        n.inFocus = !focusActive || inHover || inSel;
        const hoverFade = hovering && !inHover ? 1 - 0.72 * hovSpot : 1;
        const selFade = selId !== null && !inSel ? 1 - 0.4 * selSpot : 1;
        const focusFade = Math.min(hoverFade, selFade);
        const groupFade = focusGroup !== null && n.community !== focusGroup ? 1 - 0.84 * gspot : 1;
        const questionFade = hasActiveQuestion && !n.active && n.id !== selId ? exactDim : 1;
        n.a = Math.min(focusFade, groupFade, questionFade);
        n.sx = (n.x - width / 2 + cam.x) * k + width / 2;
        n.sy = (n.y - height / 2 + cam.y) * k + height / 2;
      }

      // 5. Canvas setup: world transform
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.translate(width / 2, height / 2);
      ctx.scale(k, k);
      ctx.translate(-width / 2 + cam.x, -height / 2 + cam.y);

      // Viewport bounds in world space (+24px margin for culling, §M8.1)
      const margin = 24 / k;
      const worldLeft = (0 - width / 2) / k + width / 2 - cam.x - margin;
      const worldRight = (width - width / 2) / k + width / 2 - cam.x + margin;
      const worldTop = (0 - height / 2) / k + height / 2 - cam.y - margin;
      const worldBottom = (height - height / 2) / k + height / 2 - cam.y + margin;
      const minX = Math.min(worldLeft, worldRight);
      const maxX = Math.max(worldLeft, worldRight);
      const minY = Math.min(worldTop, worldBottom);
      const maxY = Math.max(worldTop, worldBottom);

      const additive = (tier === "T3" || tier === "T2") && !prefersReducedMotion;

      // 6. Community mist (T3 breathes 0.9..1.1 over 9s, T2 static, T1/T0 none, §M8.6)
      if (!isT0 && tier !== "T1") {
        const mistFade = prefersReducedMotion ? 1 : clamp((now - mountTimeRef.current - 150) / 700, 0, 1);
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          let breathe = 1;
          if (tier === "T3" && !isOffscreenRef.current) {
            breathe = 1 + 0.1 * Math.sin((2 * Math.PI * now) / 9000 + (n.community ?? 0) / 7);
          }
          const size = (n.r * 6 + 76) * breathe;
          if (n.x + size < minX || n.x - size > maxX || n.y + size < minY || n.y - size > maxY) continue;
          const sprite = getMistSprite(n.color);
          if (!sprite) continue;
          ctx.globalAlpha = 0.15 * (0.45 + 0.55 * n.imp) * mistFade * n.a;
          ctx.drawImage(sprite, n.x - size / 2, n.y - size / 2, size, size);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }

      // 7. Edges: curved, luminous, weighted by meaning and by how central their ends are
      const hp = hs.progress;
      ctx.globalCompositeOperation = additive ? "lighter" : "source-over";
      const edgeScale = 1 / clamp(k, 0.6, 1.6);

      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const s = nodes[e.source];
        const t = nodes[e.target];
        if (!s || !t) continue;

        // Viewport culling for edge
        if (
          (s.x < minX && t.x < minX) ||
          (s.x > maxX && t.x > maxX) ||
          (s.y < minY && t.y < minY) ||
          (s.y > maxY && t.y > maxY)
        ) {
          continue;
        }

        const sProgress = getNodeRevealProgress(s);
        const tProgress = getNodeRevealProgress(t);
        if (sProgress <= 0.01 || tProgress <= 0.01) continue;

        let edgeProgress = 1.0;
        if (!prefersReducedMotion) {
          // Edges draw after both endpoints exist: 240 ms servo curve (§M8.2)
          const edgeStart = Math.max(s.revealDelay, t.revealDelay);
          const edgeElapsed = now - (mountTimeRef.current + edgeStart);
          if (edgeElapsed <= 0) continue;
          edgeProgress = servoEase(Math.min(1, edgeElapsed / 240));
        }

        const hovInc = hs.incidentEdgeIndices.has(i);
        const selInc = sel.incident.has(i);

        const midX = (s.x + t.x) / 2;
        const midY = (s.y + t.y) / 2;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const curveOffset = Math.min(24, dist * 0.12);
        const cpx = midX - (dy / dist) * curveOffset;
        const cpy = midY + (dx / dist) * curveOffset;

        // Resting look: importance and relation decide how loudly an edge speaks
        const impAvg = (s.imp + t.imp) / 2;
        const spoke = Math.max(s.deg, t.deg) > 26 ? 0.5 : 1;
        const rest = (0.1 + 0.34 * e.weight * (0.35 + 0.65 * Math.sqrt(impAvg))) * spoke;
        let alphaEdge = rest;
        let lineW = 0.8 + 0.9 * e.weight;

        if (hovering) {
          // Hover: the hovered node's edges light up, the rest recede
          const target = hovInc ? 0.85 : selInc ? rest : rest * 0.15;
          alphaEdge = rest + (target - rest) * hovSpot;
          if (hovInc) lineW += 0.8 * hovSpot;
        } else if (selId !== null) {
          // Selection: its edges are brighter, the rest dim only a little
          const target = selInc ? 0.62 : rest * 0.55;
          alphaEdge = rest + (target - rest) * selSpot;
          if (selInc) lineW += 0.5 * selSpot;
        }
        if (hasActiveQuestion) {
          if (s.active || t.active) {
            alphaEdge = Math.max(alphaEdge, 0.85);
            lineW = Math.max(lineW, 1.8);
          } else {
            alphaEdge *= exactDim;
          }
        }
        if (focusGroup !== null && (s.community !== focusGroup || t.community !== focusGroup)) {
          alphaEdge *= 1 - 0.84 * gspot;
        }
        alphaEdge *= edgeProgress;
        if (alphaEdge < 0.01) continue;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        if (edgeProgress >= 0.99) {
          ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
        } else {
          const u = edgeProgress;
          const ctrlX = (1 - u) * s.x + u * cpx;
          const ctrlY = (1 - u) * s.y + u * cpy;
          const endX = (1 - u) * (1 - u) * s.x + 2 * (1 - u) * u * cpx + u * u * t.x;
          const endY = (1 - u) * (1 - u) * s.y + 2 * (1 - u) * u * cpy + u * u * t.y;
          ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
        }

        if (s.color === t.color) {
          ctx.strokeStyle = rgba(s.color, alphaEdge);
        } else {
          const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
          grad.addColorStop(0, rgba(s.color, alphaEdge));
          grad.addColorStop(1, rgba(t.color, alphaEdge));
          ctx.strokeStyle = grad;
        }
        ctx.lineWidth = lineW * edgeScale;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";

      // 7b. Draw Photons (T3 only, <= 24 pooled dots travel beziers, vanish 120ms fade, §M8.3)
      let activePhotonsCount = 0;
      if (tier === "T3" && !prefersReducedMotion) {
        PhotonManager.update(dtMs);
        PhotonManager.render(ctx);
        const photons = photonPoolRef.current;
        for (let i = 0; i < MAX_PHOTONS; i++) {
          const p = photons[i];
          if (!p.active) continue;
          if (p.delay > 0) {
            p.delay -= dtMs;
            continue;
          }

          if (p.t < 1.0) {
            p.t = Math.min(1.0, p.t + dtMs / p.duration);
          } else {
            p.vanishElapsed += dtMs;
            if (p.vanishElapsed >= 120) {
              p.active = false;
              continue;
            }
          }

          activePhotonsCount++;

          const e = edges[p.edgeIndex];
          if (!e) continue;
          const sNode = nodes[p.reverse ? e.target : e.source];
          const tNode = nodes[p.reverse ? e.source : e.target];
          if (!sNode || !tNode) continue;

          const midX = (sNode.x + tNode.x) / 2;
          const midY = (sNode.y + tNode.y) / 2;
          const dx = tNode.x - sNode.x;
          const dy = tNode.y - sNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const curveOffset = Math.min(24, dist * 0.12);
          const cpx = midX - (dy / dist) * (p.reverse ? -curveOffset : curveOffset);
          const cpy = midY + (dx / dist) * (p.reverse ? -curveOffset : curveOffset);

          const u = p.t;
          const px = (1 - u) * (1 - u) * sNode.x + 2 * (1 - u) * u * cpx + u * u * tNode.x;
          const py = (1 - u) * (1 - u) * sNode.y + 2 * (1 - u) * u * cpy + u * u * tNode.y;

          const alpha = p.t < 1.0 ? 0.5 : Math.max(0, 0.5 * (1 - p.vanishElapsed / 120));

          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, 2 * Math.PI);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha;
          ctx.fill();
          ctx.restore();
        }
        activePhotonsCount = Math.max(activePhotonsCount, PhotonManager.getActiveCount());
      }
      if (typeof window !== "undefined") {
        (window as any).__VG_ACTIVE_PHOTONS__ = activePhotonsCount;
      }

      // 8. Nodes: lit spheres. Small ones first so hubs sit on top; the focused neighbourhood last.
      const order = drawOrderRef.current;
      const passes = focusActive ? 2 : 1;
      const hoverId = hs.hoveredId;
      for (let pass = 0; pass < passes; pass++) {
        for (let q = 0; q < order.length; q++) {
          const n = nodes[order[q]];
          if (focusActive && (pass === 0) === n.inFocus) continue;

          if (n.x + n.r < minX || n.x - n.r > maxX || n.y + n.r < minY || n.y - n.r > maxY) continue;

          const reveal = getNodeRevealProgress(n);
          if (reveal <= 0) continue;

          const isSelected = selId === n.id;
          const isHovered = hoverId === n.id;

          // Hover scale: 1 -> 1.08 (120ms §M8.5); node scale 0.6 -> 1 via snappy spring (§M8.2)
          const hoverScale = isHovered ? 1.0 + 0.08 * hp : 1.0;
          const snappyScale = 0.6 + 0.4 * reveal;
          const cr = n.r * snappyScale * hoverScale;
          n.sr = cr * k;

          // Single pulse animation on activation (duration 1200ms, F0-B: pulseAllowedRef guard)
          if (isPulsing && n.active && pulseAllowedRef.current) {
            const pulseProgress = pulseElapsed / 1200;
            const pulseRadius = cr + pulseProgress * 26;
            const pulseAlpha = Math.max(0, (1 - pulseProgress) * 0.85);
            ctx.beginPath();
            ctx.arc(n.x, n.y, pulseRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(130,211,162, ${pulseAlpha})`;
            ctx.lineWidth = Math.max(1, 2.5 * (1 - pulseProgress)) / k;
            ctx.stroke();
          }

          // Halo: hubs, the hovered or selected node, activated concepts. Nothing else glows.
          const wantsHalo = isSelected || isHovered || (n.active && hasActiveQuestion) || n.hub;
          if (wantsHalo && tier !== "T0") {
            const halo = getHaloSprite(n.color);
            if (halo && (tier !== "T1" || isSelected || isHovered)) {
              const strength = isSelected ? 0.55 : isHovered ? 0.5 * hp + 0.2 : n.active ? 0.42 : 0.26;
              const d = (cr + (isSelected ? 22 : 17)) * 2;
              ctx.globalAlpha = strength * reveal * n.a;
              ctx.drawImage(halo, n.x - d / 2, n.y - d / 2, d, d);
            }
          }

          // The sphere itself
          const orb = getOrbSprite(n.color);
          ctx.globalAlpha = n.a * reveal;
          if (orb) {
            ctx.drawImage(orb, n.x - cr, n.y - cr, cr * 2, cr * 2);
          } else {
            ctx.beginPath();
            ctx.arc(n.x, n.y, cr, 0, 2 * Math.PI);
            ctx.fillStyle = n.color;
            ctx.fill();
          }

          // Rim light, and a clear ring on the selected node
          ctx.beginPath();
          ctx.arc(n.x, n.y, cr, 0, 2 * Math.PI);
          ctx.strokeStyle = isSelected || isHovered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.2)";
          ctx.lineWidth = (isSelected || isHovered ? 2.2 : 1) / k;
          ctx.stroke();
          if (isSelected) {
            ctx.beginPath();
            ctx.arc(n.x, n.y, cr + 5 / k + 1, 0, 2 * Math.PI);
            ctx.strokeStyle = "rgba(255,255,255,0.4)";
            ctx.lineWidth = 1 / k;
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }

      // 9. Evidence Dust Particles (T3 only, <= 40 pooled, drift <= 12px, §M8.3)
      let activeDustCount = 0;
      if (tier === "T3" && !prefersReducedMotion) {
        DustManager.update(dtMs);
        DustManager.render(ctx);
        const dust = dustPoolRef.current;
        const dtScale = dtMs / 16.67;
        for (let i = 0; i < MAX_DUST; i++) {
          const d = dust[i];
          if (!d.active) continue;

          d.x += d.vx * dtScale;
          d.y += d.vy * dtScale;
          d.vx *= Math.pow(0.94, dtScale);
          d.vy *= Math.pow(0.94, dtScale);
          d.age += dtMs;

          if (d.age >= d.lifetime) {
            d.active = false;
            continue;
          }

          activeDustCount++;
          const lifeProgress = d.age / d.lifetime;
          d.alpha = Math.max(0, 0.25 * (1 - lifeProgress));

          ctx.save();
          ctx.fillStyle = d.color;
          ctx.globalAlpha = d.alpha;
          ctx.beginPath();
          ctx.arc(d.x, d.y, 1.3, 0, 2 * Math.PI);
          ctx.fill();
          ctx.restore();
        }
        activeDustCount = Math.max(activeDustCount, DustManager.getActiveCount());
      }
      if (typeof window !== "undefined") {
        (window as any).__VG_ACTIVE_DUST__ = activeDustCount;
      }

      // 10. Screen-space pass: group captions, labels and value chips keep one size at every zoom
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      const revealAll = prefersReducedMotion ? 1 : clamp((now - mountTimeRef.current - 350) / 500, 0, 1);


      // Which measurement nodes carry a value chip this frame
      const showsChip = (n: SimNode) => {
        const isMeasurement = (n.type || "").toLowerCase() === "measurement" || n.value !== undefined;
        if (!isMeasurement) return false;
        return selId === n.id || hoverId === n.id || (n.active && hasActiveQuestion) || k >= 1.5;
      };

      // 10b. Labels: importance decides who gets a place; a label never covers another or a node
      const budget = labelBudget(k, nodes.length);
      const overlays = overlaysRef.current.rects;
      const placed: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
      const labelOrder = order;
      const candidates: number[] = [];
      for (let q = labelOrder.length - 1; q >= 0; q--) candidates.push(labelOrder[q]);
      candidates.sort((ia, ib) => {
        const a = nodes[ia];
        const b = nodes[ib];
        const ea = (selId === a.id || hoverId === a.id ? 2 : 0) + (a.inFocus && focusActive ? 1 : 0);
        const eb = (selId === b.id || hoverId === b.id ? 2 : 0) + (b.inFocus && focusActive ? 1 : 0);
        return eb - ea || a.rank - b.rank;
      });

      for (let c = 0; c < candidates.length; c++) {
        const n = nodes[candidates[c]];
        const reveal = getNodeRevealProgress(n);
        if (reveal < 0.5 || revealAll <= 0) continue;
        if (showsChip(n)) continue;
        const isSelected = selId === n.id;
        const isHovered = hoverId === n.id;
        const emphasised = isSelected || isHovered || (n.active && hasActiveQuestion);
        const spotlit = focusActive && n.inFocus;
        // Outside the budget a label only appears when it is the focus of attention
        if (n.rank >= budget && !emphasised && !spotlit) continue;
        if (n.a < 0.3 && !emphasised) continue;
        if (n.sx < -40 || n.sx > width + 40 || n.sy < -40 || n.sy > height + 40) continue;

        const tierIdx = n.hub ? 0 : n.rank < 14 ? 1 : 2;
        let font: string;
        let size: number;
        if (tierIdx === 0) {
          size = clamp(14 + n.r * 0.3, 15, 21);
          font = FONT_HUB(size);
        } else if (tierIdx === 1) {
          size = 13.5;
          font = FONT_LABEL(size, 600);
        } else {
          size = 12;
          font = FONT_LABEL(size, 500);
        }
        if (emphasised && tierIdx > 0) {
          size = 14;
          font = FONT_LABEL(size, 600);
        }
        const text = n.display.length > 26 ? n.display.slice(0, 24) + "…" : n.display;
        const w = textWidth(ctx, font, text);
        const sr = n.sr || n.r * k;
        const gap = isSelected ? 12 : 5; // the selection ring sits about 6px outside the node
        const h = size * 1.2;

        // Try right, below, left, above
        const spots: Array<[number, number, CanvasTextAlign]> = [
          [n.sx + sr + gap, n.sy, "left"],
          [n.sx, n.sy + sr + gap + h / 2, "center"],
          [n.sx - sr - gap, n.sy, "right"],
          [n.sx, n.sy - sr - gap - h / 2, "center"],
        ];
        let chosen = -1;
        let box = { x0: 0, y0: 0, x1: 0, y1: 0 };
        // Pass 0 respects everything. Pass 1 (focus of attention only) still keeps clear of overlays
        // but may touch other labels and nodes, so the selected node always gets a readable label.
        for (let pass = 0; pass < 2 && chosen < 0; pass++) {
          if (pass === 1 && !emphasised) break;
          for (let si = 0; si < spots.length; si++) {
            const [px, py, align] = spots[si];
            const x0 = align === "left" ? px : align === "right" ? px - w : px - w / 2;
            const b = { x0: x0 - 3, x1: x0 + w + 3, y0: py - h / 2 - 1, y1: py + h / 2 + 1 };
            let clash = false;
            if (b.x0 < 6 || b.x1 > width - 6 || b.y0 < 6 || b.y1 > height - 6) clash = true;
            for (let oi = 0; oi < overlays.length && !clash; oi++) {
              const r = overlays[oi];
              if (b.x0 < r.x1 && b.x1 > r.x0 && b.y0 < r.y1 && b.y1 > r.y0) clash = true;
            }
            if (pass === 0) {
              for (let pi = 0; pi < placed.length && !clash; pi++) {
                const r = placed[pi];
                if (b.x0 < r.x1 && b.x1 > r.x0 && b.y0 < r.y1 && b.y1 > r.y0) clash = true;
              }
              for (let ni = 0; ni < nodes.length && !clash; ni++) {
                const o = nodes[ni];
                if (o === n || o.a < 0.3) continue;
                const orad = (o.sr || o.r * k) + 1;
                const nx = clamp(o.sx, b.x0, b.x1);
                const ny = clamp(o.sy, b.y0, b.y1);
                if ((nx - o.sx) * (nx - o.sx) + (ny - o.sy) * (ny - o.sy) < orad * orad) clash = true;
              }
            }
            if (!clash) {
              chosen = si;
              box = b;
              break;
            }
          }
        }
        if (chosen < 0) {
          if (!emphasised) continue;
          chosen = 0; // the focus of attention always gets its label, even if every spot is crowded
          const [px, py, align] = spots[0];
          const x0 = align === "left" ? px : px - w;
          box = { x0: x0 - 3, x1: x0 + w + 3, y0: py - h / 2 - 1, y1: py + h / 2 + 1 };
        }
        placed.push(box);
        const [lx, ly, lalign] = spots[chosen];

        const baseAlpha = tierIdx === 0 ? 0.97 : tierIdx === 1 ? 0.9 : 0.72;
        const alphaLabel = (emphasised ? 1 : spotlit && focusActive ? 0.97 : baseAlpha) * n.a * revealAll;
        ctx.font = font;
        ctx.textAlign = lalign;
        ctx.globalAlpha = alphaLabel;
        ctx.strokeStyle = "rgba(12,14,16,0.88)"; // halo keeps text legible over edges
        ctx.lineWidth = 3.5;
        ctx.strokeText(text, lx, ly);
        ctx.fillStyle = emphasised ? "#FFFFFF" : "#F3F6F6";
        ctx.fillText(text, lx, ly);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";

      // 10c. Measured values, in mono because they are machine output
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!showsChip(n) || n.a < 0.4) continue;
        const reveal = getNodeRevealProgress(n);
        if (reveal < 0.8) continue;
        if (n.sx < 0 || n.sx > width || n.sy < 0 || n.sy > height) continue;
        const valText = n.value !== undefined ? `${n.value} ${n.unit || ""}`.trim() : n.display;
        const high = !!n.flag && n.flag.toUpperCase() === "HIGH";
        const font = FONT_VALUE(11);
        const tw = textWidth(ctx, font, valText) + (high ? 34 : 0);
        const cw = tw + 14;
        const ch = 18;
        const cx = n.sx - cw / 2;
        const cy = n.sy - (n.sr || n.r * k) - ch - 5;
        const must = selId === n.id || hoverId === n.id;
        const box = { x0: cx - 2, x1: cx + cw + 2, y0: cy - 2, y1: cy + ch + 2 };
        if (!must && placed.some((r) => box.x0 < r.x1 && box.x1 > r.x0 && box.y0 < r.y1 && box.y1 > r.y0)) continue;
        if (overlays.some((r) => box.x0 < r.x1 && box.x1 > r.x0 && box.y0 < r.y1 && box.y1 > r.y0)) continue;
        placed.push(box);
        ctx.globalAlpha = n.a * reveal;
        ctx.fillStyle = "rgba(18,20,22,0.94)";
        roundedRect(ctx, cx, cy, cw, ch, 5);
        ctx.fill();
        ctx.strokeStyle = "rgba(240,200,138,0.55)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = font;
        ctx.textAlign = "left";
        ctx.fillStyle = "#F0C88A";
        ctx.fillText(valText, cx + 7, cy + ch / 2 + 0.5);
        if (high) {
          ctx.fillStyle = "#F08E9A";
          ctx.fillText("HIGH", cx + 7 + tw - 30, cy + ch / 2 + 0.5);
        }
        ctx.textAlign = "center";
      }
      ctx.globalAlpha = 1;
    });

    return () => {
      unsub();
    };
  }, []);

  // ----- Pointer interaction -------------------------------------------------------------

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    return {
      x: (px - canvas.clientWidth / 2) / cam.k + canvas.clientWidth / 2 - cam.x,
      y: (py - canvas.clientHeight / 2) / cam.k + canvas.clientHeight / 2 - cam.y,
    };
  };

  /** Topmost node under a world point (hubs are drawn last, so they win). */
  const hitTest = (wx: number, wy: number): { node: SimNode; index: number } | null => {
    const nodes = simNodesRef.current;
    const order = drawOrderRef.current;
    const slack = 5 / Math.max(cameraRef.current.k, 0.6);
    for (let q = order.length - 1; q >= 0; q--) {
      const n = nodes[order[q]];
      if (n.a < 0.25) continue;
      const dx = wx - n.x;
      const dy = wy - n.y;
      if (Math.sqrt(dx * dx + dy * dy) <= n.r + slack) return { node: n, index: order[q] };
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    // User interaction interrupts running camera spring (§M8.4)
    targetCamRef.current.active = false;
    momentumRef.current.active = false;
    userMovedRef.current = true;

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      canvas?.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }

    // Second finger: switch from drag or pan to pinch zoom
    if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      pinchRef.current = {
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1,
        cx: (p1.x + p2.x) / 2,
        cy: (p1.y + p2.y) / 2,
      };
      dragRef.current = null;
      dragIndexRef.current = -1;
      panRef.current = null;
      return;
    }

    const pt = getCanvasPoint(e.clientX, e.clientY);
    const hit = hitTest(pt.x, pt.y);

    if (hit) {
      dragRef.current = hit.node;
      dragIndexRef.current = hit.index;
      alphaRef.current = Math.max(alphaRef.current, 0.3); // wake the layout so neighbours follow
      handleSelectNode(hit.node);
    } else {
      panRef.current = {
        isPanning: true,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        lastTime: performance.now(),
        vx: 0,
        vy: 0,
      };
      lastUserPanTimeRef.current = performance.now();
      if (canvas) canvas.style.cursor = "grabbing";
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const now = performance.now();
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Pinch: zoom around the midpoint and follow it
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const [p1, p2] = [...pointersRef.current.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const rect = canvas.getBoundingClientRect();
      zoomAt(cx - rect.left, cy - rect.top, dist / pinchRef.current.dist);
      const cam = cameraRef.current;
      cam.x += (cx - pinchRef.current.cx) / cam.k;
      cam.y += (cy - pinchRef.current.cy) / cam.k;
      pinchRef.current = { dist, cx, cy };
      return;
    }

    if (dragRef.current) {
      const pt = getCanvasPoint(e.clientX, e.clientY);
      dragRef.current.x = pt.x;
      dragRef.current.y = pt.y;
      dragRef.current.vx = 0;
      dragRef.current.vy = 0;
      alphaRef.current = Math.max(alphaRef.current, 0.18);
      return;
    }

    if (panRef.current?.isPanning) {
      targetCamRef.current.active = false; // User drag interrupts camera spring (§M8.4)
      lastUserPanTimeRef.current = now;

      const dt = Math.max(1, now - panRef.current.lastTime);
      const dx = (e.clientX - panRef.current.lastX) / cameraRef.current.k;
      const dy = (e.clientY - panRef.current.lastY) / cameraRef.current.k;

      cameraRef.current.x += dx;
      cameraRef.current.y += dy;

      const frameScale = 16.67 / dt;
      panRef.current.vx = dx * frameScale;
      panRef.current.vy = dy * frameScale;
      panRef.current.lastX = e.clientX;
      panRef.current.lastY = e.clientY;
      panRef.current.lastTime = now;
      return;
    }

    // Fast spatial hit-test for hover (< 1-frame response §M8.5)
    const pt = getCanvasPoint(e.clientX, e.clientY);
    const hit = hitTest(pt.x, pt.y);
    const hitNode = hit ? hit.node : null;
    const nodes = simNodesRef.current;

    if (canvasRef.current) {
      canvasRef.current.style.cursor = hitNode ? "pointer" : "grab";
    }

    if (hitNode !== hoverStateRef.current.hoveredNode) {
      hoverStateRef.current.hoveredNode = hitNode;
      hoverStateRef.current.hoveredId = hitNode ? hitNode.id : null;
      hoverStateRef.current.incidentEdgeIndices.clear();
      hoverStateRef.current.neighborNodeIds.clear();

      if (hitNode) {
        const edges = simEdgesRef.current;
        for (let i = 0; i < edges.length; i++) {
          const ed = edges[i];
          const s = nodes[ed.source];
          const t = nodes[ed.target];
          if (s?.id === hitNode.id) {
            hoverStateRef.current.incidentEdgeIndices.add(i);
            if (t) hoverStateRef.current.neighborNodeIds.add(t.id);
          } else if (t?.id === hitNode.id) {
            hoverStateRef.current.incidentEdgeIndices.add(i);
            if (s) hoverStateRef.current.neighborNodeIds.add(s.id);
          }
        }
      }
    }
  };

  const releasePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    if (pinchRef.current && pointersRef.current.size < 2) {
      pinchRef.current = null;
      const rest = [...pointersRef.current.values()][0];
      if (rest) {
        // Carry on as a pan with the finger that is left, without a jump
        panRef.current = {
          isPanning: true,
          startX: rest.x,
          startY: rest.y,
          lastX: rest.x,
          lastY: rest.y,
          lastTime: performance.now(),
          vx: 0,
          vy: 0,
        };
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    releasePointer(e);
    dragRef.current = null;
    dragIndexRef.current = -1;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    if (panRef.current?.isPanning) {
      // Momentum hand-off on release (§M8.4)
      const speed = Math.hypot(panRef.current.vx, panRef.current.vy);
      if (speed > 0.4 && pointersRef.current.size === 0) {
        momentumRef.current = {
          active: true,
          vx: panRef.current.vx,
          vy: panRef.current.vy,
        };
      }
      if (pointersRef.current.size === 0) panRef.current = null;
    }
  };

  const handlePointerLeave = () => {
    // Hover cancelled immediately on leave (§M8.5)
    hoverStateRef.current.hoveredNode = null;
    hoverStateRef.current.hoveredId = null;
    hoverStateRef.current.progress = 0;
    hoverStateRef.current.incidentEdgeIndices.clear();
    hoverStateRef.current.neighborNodeIds.clear();
  };

  // The wheel listener is native and non-passive so it can stop the page from scrolling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0016));
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // View controls
  const handleZoom = (factor: number) => {
    const isT0 = governor.getState().tier === "T0" || isReducedMotion();
    const nextK = clamp(cameraRef.current.k * factor, K_MIN, K_MAX);
    userMovedRef.current = true;
    if (isT0) {
      cameraRef.current.k = nextK;
      targetCamRef.current.active = false;
    } else {
      targetCamRef.current = {
        x: cameraRef.current.x,
        y: cameraRef.current.y,
        k: nextK,
        active: true,
      };
      momentumRef.current.active = false;
    }
  };

  const handleZoomTo = (k: number) => {
    cameraRef.current.k = clamp(k, K_MIN, K_MAX);
    targetCamRef.current.active = false;
    momentumRef.current.active = false;
    userMovedRef.current = true;
  };

  const handleFit = () => {
    userMovedRef.current = false;
    setFocusCommunity(null);
    applyFit(true);
    if (selectedNode) handleSelectNode(null);
  };

  // Metrics from live graphData
  const liveNodesCount = graphData?.metrics?.total_nodes ?? cappedNodes.length;
  const liveEdgesCount = graphData?.metrics?.total_edges ?? simEdges.length;
  const liveCommunitiesCount = graphData?.metrics?.communities_count ?? 0;
  const liveModularity = graphData?.metrics?.modularity ?? 0;

  const totalNodes = graphData?.nodes?.length ?? 0;
  const filtering = !showFragments && fragmentCount > 0 && totalNodes - fragmentCount >= 5;
  const hiddenCount = filtering ? fragmentCount : 0;
  const showingText =
    cappedNodes.length === 0
      ? ""
      : poolSize > cappedNodes.length
      ? `Showing the ${cappedNodes.length} most central of ${poolSize.toLocaleString()} ${filtering ? "concepts, documents and values" : "nodes"}.`
      : `Showing all ${cappedNodes.length} ${filtering ? "concepts, documents and values" : "nodes"}.`;

  const groupCount = summary.groups.length;

  return (
    <div ref={containerRef} className={`w-full flex flex-col ${className}`}>
      {/* Frame: dark viewport. Local tokens (.graph-dark) re-skin everything inside it. */}
      <div
        ref={frameRef}
        data-testid="graph-frame"
        className="graph-dark graph-frame relative w-full rounded-[var(--r-14)] overflow-hidden select-none"
        style={{ height: `var(--graph-h, ${height})` }}
      >
        {/* Interactive Canvas */}
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Knowledge graph showing ${cappedNodes.length} nodes in ${groupCount} groups. Use the concepts panel to browse and select nodes with the keyboard.`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          style={{ touchAction: "none", cursor: "grab" }}
          className="w-full h-full relative z-10 block"
        />

        <div className="graph-vignette" aria-hidden="true" />

        {/* Skeleton shimmer before first graph data arrives (§US-18) */}
        {!graphData && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 pointer-events-none">
            <div className="w-16 h-16 rounded-full skeleton-shimmer" />
            <div className="h-4 w-48 rounded-[var(--r-4)] skeleton-shimmer" />
            <div className="h-3 w-32 rounded-[var(--r-4)] skeleton-shimmer opacity-75" />
          </div>
        )}

        {graphData && cappedNodes.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-8 text-center pointer-events-none">
            <div>
              <p className="type-card-title m-0">Nothing to draw yet</p>
              <p className="type-body text-[var(--dim)] mt-2 mb-0 max-w-[40ch]">
                Upload a report and VitaGraph will map its tests, dates and values here.
              </p>
            </div>
          </div>
        )}

        {/* Cluster hull morph target (§M4.2) */}
        <div
          data-testid="graph-cluster-hull-target"
          style={{ viewTransitionName: !isT0 ? "cluster-hull" : undefined }}
          className="pointer-events-none absolute inset-0"
        />

        {/* HUD: four real counts from the backend, the selected node, and an honest note about what is on screen */}
        <div className="graph-scrim-top absolute top-0 left-0 right-0 z-20 px-4 pt-3 pb-14 pointer-events-none">
          <div data-graph-overlay="hud">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5">
            <dl className="flex flex-wrap items-end gap-x-6 gap-y-2 m-0">
              <div className="graph-stat">
                <dt>nodes</dt>
                <dd>
                  <Odometer value={liveNodesCount} duration={480} testId="graph-odo-nodes" />
                </dd>
              </div>
              <div className="graph-stat">
                <dt>links</dt>
                <dd>
                  <Odometer value={liveEdgesCount} duration={480} testId="graph-odo-edges" />
                </dd>
              </div>
              <div className="graph-stat">
                <dt>groups</dt>
                <dd>
                  <Odometer value={liveCommunitiesCount} duration={480} testId="graph-odo-comm" />
                </dd>
              </div>
              <div className="graph-stat" title="How clearly the graph separates into groups, from 0 to 1">
                <dt>modularity</dt>
                <dd>
                  <Odometer
                    value={liveModularity}
                    decimals={2}
                    format={(v) => v.toFixed(2)}
                    duration={480}
                    testId="graph-odo-mod"
                  />
                </dd>
              </div>
            </dl>

            {/* Node card (appears when a node is selected) (§7.16, §M8.5). The full detail lives in the
                panel beside the graph; this chip says what is selected without covering the graph. */}
            {selectedNode && (
              <div
                data-testid="graph-node-provenance-card"
                className="pointer-events-auto flex items-center gap-2.5 min-w-0 max-w-full rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] pl-3 pr-1 py-1 m-enter"
              >
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: communityColor(selectedNode.community, "#9BA1B0") }}
                />
                <span className="font-['Spectral'] font-semibold text-[15px] leading-5 truncate min-w-[5ch] flex-1">
                  {selectedNode.label || selectedNode.id}
                </span>
                <span className="type-meta whitespace-nowrap flex-shrink-0 hidden min-[420px]:inline">
                  <span className="capitalize">{selectedNode.type || "Concept"}</span>
                  {selectedNode.community !== undefined && summary.groupNames.has(selectedNode.community)
                    ? `, ${summary.groupNames.get(selectedNode.community)}`
                    : ""}
                </span>
                {selectedNode.value !== undefined && (
                  <span className="type-mono-sm text-[var(--ochre-ink)] whitespace-nowrap flex-shrink-0">
                    {selectedNode.value} {selectedNode.unit || ""}
                  </span>
                )}
                {selectedNode.page !== undefined && (
                  <span className="type-meta whitespace-nowrap flex-shrink-0">Page {selectedNode.page}</span>
                )}
                {selectedNode.betweenness !== undefined && (
                  <span className="type-mono-sm text-[var(--dim)] whitespace-nowrap flex-shrink-0 hidden sm:inline" title="Centrality">
                    {selectedNode.betweenness.toFixed(3)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleSelectNode(null)}
                  aria-label="Clear selection"
                  className="text-[var(--dim)] hover:text-[var(--bone)] w-7 h-7 inline-flex items-center justify-center rounded-[var(--r-6)] cursor-pointer flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {showingText && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 pointer-events-auto">
              <p className="m-0 type-meta text-[var(--dim)]" data-testid="graph-cap-note">
                {showingText}
              </p>
              {fragmentCount > 0 && totalNodes - fragmentCount >= 5 && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={showFragments}
                  data-testid="graph-fragments-toggle"
                  onClick={() => setShowFragments((v) => !v)}
                  className="graph-switch"
                >
                  <span className="graph-switch-track" aria-hidden="true">
                    <span className="graph-switch-thumb" />
                  </span>
                  <span>
                    Text fragments
                    <span className="text-[var(--dim)]"> ({fragmentCount.toLocaleString()}{hiddenCount > 0 ? " hidden" : " shown"})</span>
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Activated Subgraph Chip (§20.1) */}
          {activeConcepts.length > 0 && (
            <div className="mt-2 inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-[var(--r-6)] bg-[var(--verdigris)]/12 border border-[var(--verdigris)]/40 text-[var(--verdigris)] text-[13px] pointer-events-auto">
              <span className="w-2 h-2 rounded-full bg-[var(--verdigris)]" aria-hidden="true" />
              <span>Activated concepts: {activeConcepts.join(", ")}</span>
              {subgraphMetrics && (
                <span className="text-[var(--bone)] font-medium">
                  ({subgraphMetrics.total_nodes} nodes, {subgraphMetrics.total_edges} edges)
                </span>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Concepts, connections and groups (bottom right) */}
        <GraphConceptsPanel
          compact={compact}
          open={panelOpen}
          onToggle={setPanelOpen}
          tab={panelTab}
          onTab={setPanelTab}
          summary={summary}
          selectedId={selectedNode?.id}
          onSelectNode={handleSelectNode}
          focusCommunity={focusCommunity}
          onFocusCommunity={setFocusCommunity}
        />

        {/* Controls (right edge): zoom slider, fit to screen, layout switch */}
        <div ref={controlsRef} data-testid="graph-controls" data-graph-overlay="controls" className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2">
          <IconButton size={32} title="Zoom in" aria-label="Zoom in" onClick={() => handleZoom(1.2)}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </IconButton>
          <input
            type="range"
            aria-label="Zoom"
            data-testid="graph-zoom-slider"
            className="graph-zoom-slider"
            min={40}
            max={280}
            step={1}
            defaultValue={100}
            ref={zoomSliderRef}
            onChange={(e) => handleZoomTo(Number(e.target.value) / 100)}
          />
          <span ref={zoomLabelRef} className="type-meta tabular-nums text-[var(--dim)]" data-testid="graph-zoom-percent">
            100%
          </span>
          <IconButton size={32} title="Zoom out" aria-label="Zoom out" onClick={() => handleZoom(0.8)}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </IconButton>
          <IconButton size={32} title="Fit to screen" aria-label="Fit to screen" data-testid="graph-fit" onClick={handleFit}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </IconButton>
          <IconButton
            size={32}
            data-testid="graph-layout-toggle"
            title={layoutMode === "force" ? "Switch to circular layout" : "Switch to force layout"}
            aria-label={layoutMode === "force" ? "Switch to circular layout" : "Switch to force layout"}
            aria-pressed={layoutMode === "circular"}
            onClick={() => setLayoutMode((m) => (m === "force" ? "circular" : "force"))}
          >
            {layoutMode === "force" ? (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="4" r="1.5" fill="currentColor" />
                <circle cx="19" cy="14" r="1.5" fill="currentColor" />
                <circle cx="6" cy="17" r="1.5" fill="currentColor" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="6" cy="7" r="2" />
                <circle cx="17" cy="6" r="2" />
                <circle cx="12" cy="17" r="2" />
                <line x1="7.6" y1="8.2" x2="10.6" y2="15.4" />
                <line x1="15.8" y1="7.8" x2="13.2" y2="15.2" />
              </svg>
            )}
          </IconButton>
        </div>

        {/* Legend: what size and colour mean, in one honest line */}
        <div className="graph-scrim-bottom absolute bottom-0 left-0 right-0 z-[19] px-4 pt-8 pb-2.5 pointer-events-none">
          <p data-graph-overlay="legend" className="m-0 type-meta text-[var(--dim)] max-w-[calc(100%-10rem)] sm:max-w-none w-fit" data-testid="graph-legend">
            Size shows how central a node is. Colour shows its group.
          </p>
        </div>
      </div>
    </div>
  );
};
