import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button, IconButton } from "./Buttons";
import { Select } from "./Input";
import type { GraphResponse, GraphNode } from "../../api/graph";
import { ticker } from "../../motion/ticker";
import { governor, isReducedMotion } from "../../motion";
import { Spring } from "../../motion/spring";

export interface GraphStageProps {
  graphData?: GraphResponse | null;
  activeConcepts?: string[];
  activeNodeIds?: string[];
  subgraphMetrics?: {
    total_nodes: number;
    total_edges: number;
  } | null;
  selectedNode?: GraphNode | null;
  onSelectNode?: (node: GraphNode | null) => void;
  className?: string;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  revealDelay: number;
}

interface SimEdge {
  source: number;
  target: number;
  relation: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  person: "#86A9D9",      // cornflower
  condition: "#86A9D9",   // cornflower
  report: "#86A9D9",      // cornflower
  test: "#79B8A6",        // verdigris (biomarker)
  biomarker: "#79B8A6",   // verdigris
  date: "#79B8A6",        // verdigris
  measurement: "#D9A441", // ochre
  section: "#A992D0",     // lilac
  category: "#A992D0",    // lilac
  treatment: "#A992D0",   // lilac
  chunk: "#6B7683",       // faint
  uncertainty: "#D9808D", // madder
  outcome: "#D9808D",     // madder
};

// Glow sprite cache (§M8.1: one pre-rendered radial-gradient sprite per category color, 5 total, 64x64 offscreen)
const GLOW_COLORS = ["#86a9d9", "#79b8a6", "#d9a441", "#a992d0", "#d9808d"] as const;
const glowSpriteMap = new Map<string, HTMLCanvasElement>();

function getGlowSprite(hexColor: string, size = 64): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = hexColor.toLowerCase();
  let sprite = glowSpriteMap.get(key);
  if (sprite) return sprite;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, hexColor);
    grad.addColorStop(0.35, hexColor + "66"); // 40% alpha
    grad.addColorStop(0.70, hexColor + "1A"); // 10% alpha
    grad.addColorStop(1, hexColor + "00");   // 0% alpha
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(half, half, half, 0, Math.PI * 2);
    ctx.fill();
  }
  glowSpriteMap.set(key, canvas);
  return canvas;
}

// Pre-warm glow sprites on module load
if (typeof document !== "undefined") {
  GLOW_COLORS.forEach((c) => getGlowSprite(c));
}

function getNodeColor(node: GraphNode): string {
  if (node.color && node.color.startsWith("#")) return node.color;
  const t = (node.type || "").toLowerCase();
  return CATEGORY_COLORS[t] || "#79B8A6";
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

// Convex hull computation for community boundaries (§M8.6)
interface Point {
  x: number;
  y: number;
}
function crossProduct(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}
function computeConvexHull(points: Point[]): Point[] {
  if (points.length <= 2) return points.slice();
  const sorted = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const lower: Point[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
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
}) => {
  const [internalSelectedNode, setInternalSelectedNode] = useState<GraphNode | null>(null);
  const selectedNode = externalSelectedNode !== undefined ? externalSelectedNode : internalSelectedNode;

  const [layoutMode, setLayoutMode] = useState<string>("force");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Staggered node reveal and edge draw-in timing ref
  const mountTimeRef = useRef<number>(performance.now());

  // Single-pulse animation tracker for question-conditioned activation
  const pulseStartTimeRef = useRef<number | null>(null);

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
      color: "#79B8A6",
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
      color: "#79B8A6",
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

  const simNodesRef = useRef<SimNode[]>([]);
  const simEdgesRef = useRef<SimEdge[]>([]);
  const dragRef = useRef<SimNode | null>(null);
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

  // Focus node at 38% viewport height (§M8.4)
  const focusNode = useCallback((node: GraphNode | null) => {
    if (!node) return;
    const simNode = simNodesRef.current.find((n) => n.id === node.id);
    if (!simNode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const isT0 = governor.getState().tier === "T0" || isReducedMotion();

    const targetX = width / 2 - simNode.x;
    const targetY = height / 2 - simNode.y - (0.12 * height) / cameraRef.current.k;

    if (isT0) {
      cameraRef.current.x = targetX;
      cameraRef.current.y = targetY;
      cameraRef.current.vx = 0;
      cameraRef.current.vy = 0;
      targetCamRef.current.active = false;
      momentumRef.current.active = false;
    } else {
      targetCamRef.current = {
        x: targetX,
        y: targetY,
        k: cameraRef.current.k,
        active: true,
      };
      momentumRef.current.active = false;
    }
  }, []);

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

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < activeNodes.length; i++) {
      const an = activeNodes[i];
      if (an.x < minX) minX = an.x;
      if (an.x > maxX) maxX = an.x;
      if (an.y < minY) minY = an.y;
      if (an.y > maxY) maxY = an.y;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const spanX = Math.max(120, maxX - minX + 120);
    const spanY = Math.max(120, maxY - minY + 120);
    const fitK = Math.max(0.5, Math.min(2.0, Math.min(width / spanX, height / spanY)));

    const targetX = width / 2 - cx;
    const targetY = height / 2 - cy;

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
      targetCamRef.current = {
        x: targetX,
        y: targetY,
        k: fitK,
        active: true,
      };
      momentumRef.current.active = false;
    }
  }, [activeConcepts, activeNodeIds]);

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

    // 2. Photons (§M8.3: <= 24 pooled dots travel beziers chunk -> active concept, speed ∝ 1/latency)
    const candidateEdges: { edgeIdx: number; reverse: boolean; color: string }[] = [];
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const s = nodes[e.source];
      const t = nodes[e.target];
      if (!s || !t) continue;
      const sIsChunk = (s.type || "").toLowerCase() === "chunk" || s.id.startsWith("chunk");
      const tIsChunk = (t.type || "").toLowerCase() === "chunk" || t.id.startsWith("chunk");
      const sActive = isNodeActiveConcept(s);
      const tActive = isNodeActiveConcept(t);

      if (sIsChunk && tActive) {
        candidateEdges.push({ edgeIdx: i, reverse: false, color: t.color });
      } else if (tIsChunk && sActive) {
        candidateEdges.push({ edgeIdx: i, reverse: true, color: s.color });
      } else if (sActive || tActive) {
        candidateEdges.push({ edgeIdx: i, reverse: sActive, color: sActive ? s.color : t.color });
      }
    }

    const photonPool = photonPoolRef.current;
    console.assert(photonPool.length <= MAX_PHOTONS, "Photon pool must not exceed 24");
    const countToSpawn = Math.min(MAX_PHOTONS, candidateEdges.length);
    for (let i = 0; i < MAX_PHOTONS; i++) {
      if (i < countToSpawn) {
        const ce = candidateEdges[i % candidateEdges.length];
        photonPool[i].active = true;
        photonPool[i].edgeIndex = ce.edgeIdx;
        photonPool[i].reverse = ce.reverse;
        photonPool[i].t = 0;
        photonPool[i].duration = 340; // nominal speed ∝ 1/latency
        photonPool[i].delay = (i % 12) * 20; // staggered departure
        photonPool[i].color = ce.color;
        photonPool[i].vanishElapsed = 0;
      } else {
        photonPool[i].active = false;
      }
    }
  }, [activeConcepts, activeNodeIds]);

  // Handle question-conditioned activation (§M8.3)
  useEffect(() => {
    const hasActive =
      (activeConcepts && activeConcepts.length > 0) ||
      (activeNodeIds && activeNodeIds.length > 0);

    const isT0 = governor.getState().tier === "T0" || isReducedMotion();

    if (hasActive) {
      if (isT0) {
        dimSpringRef.current.reset(0.40);
      } else {
        dimSpringRef.current.setTarget(0.40);
      }
      pulseStartTimeRef.current = performance.now();
      const now = performance.now();
      if (now - lastUserPanTimeRef.current > 4000) {
        fitSubgraph();
      }

      const tier = governor.getState().tier;
      if (tier === "T3" && !isT0) {
        spawnPhotonsAndDust();
      }
    } else {
      if (isT0) {
        dimSpringRef.current.reset(1.0);
      } else {
        dimSpringRef.current.setTarget(1.0);
      }
      pulseStartTimeRef.current = null;
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
        if (isT0) {
          dimSpringRef.current.reset(0.40);
        } else {
          dimSpringRef.current.setTarget(0.40);
        }
        pulseStartTimeRef.current = performance.now();
        if (tier === "T3" && !isT0) {
          spawnPhotonsAndDust();
        }
      };
    }
  }, [spawnPhotonsAndDust]);

  // 1. Process & cap nodes at ≤ 120 nodes per US-04 specification
  const { cappedNodes, simEdges } = useMemo(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return { cappedNodes: [], simEdges: [] };
    }

    // Sort by betweenness or connectivity to keep most salient ≤ 120 nodes
    const sorted = [...graphData.nodes].sort(
      (a, b) => (b.betweenness ?? 0) - (a.betweenness ?? 0)
    );
    const nodesSlice = sorted.slice(0, 120);

    const indexMap = new Map<string, number>();
    nodesSlice.forEach((n, i) => indexMap.set(n.id, i));

    const edges: SimEdge[] = [];
    (graphData.edges || []).forEach((e) => {
      const sIdx = indexMap.get(e.source);
      const tIdx = indexMap.get(e.target);
      if (sIdx !== undefined && tIdx !== undefined) {
        edges.push({ source: sIdx, target: tIdx, relation: e.relation || "" });
      }
    });

    return { cappedNodes: nodesSlice, simEdges: edges };
  }, [graphData]);

  // Initial node layout placement & ontology reveal delays (§M8.2)
  useEffect(() => {
    const width = containerRef.current?.clientWidth || 800;
    const height = 540;

    // Ontology-ordered reveal: Report -> Category -> Test -> Measurement -> Chunk (§M8.2)
    const sortedIndices = cappedNodes
      .map((n, i) => ({ i, rank: getOntologyRank(n.type) }))
      .sort((a, b) => a.rank - b.rank || a.i - b.i);

    const revealDelays = new Float32Array(cappedNodes.length);
    sortedIndices.forEach((item, orderIndex) => {
      // 24 ms stagger, capped at 480 ms total (beyond cap, batch by type)
      const delay = Math.min(480, orderIndex * 24);
      revealDelays[item.i] = delay;
    });

    const initialSimNodes: SimNode[] = cappedNodes.map((n, i) => {
      let x = width / 2 + (Math.random() - 0.5) * 360;
      let y = height / 2 + (Math.random() - 0.5) * 260;

      if (layoutMode === "circular" && cappedNodes.length > 0) {
        const angle = (i / cappedNodes.length) * 2 * Math.PI;
        const radius = Math.min(width, height) * 0.35;
        x = width / 2 + Math.cos(angle) * radius;
        y = height / 2 + Math.sin(angle) * radius;
      }

      const radius =
        n.betweenness !== undefined
          ? Math.max(7, Math.min(18, 8 + n.betweenness * 22))
          : (n.r || 10);

      return {
        ...n,
        x,
        y,
        vx: 0,
        vy: 0,
        r: radius,
        color: getNodeColor(n),
        revealDelay: revealDelays[i],
      };
    });

    simNodesRef.current = initialSimNodes;
    simEdgesRef.current = simEdges;
    if (typeof window !== "undefined") {
      (window as any).__VG_SIM_NODES__ = initialSimNodes;
    }

    // Unchanged refetch diff by node ID set (§M8.2)
    const newIds = new Set(cappedNodes.map((n) => n.id));
    const isSameSet =
      prevNodeIdsRef.current.size > 0 &&
      prevNodeIdsRef.current.size === newIds.size &&
      [...newIds].every((id) => prevNodeIdsRef.current.has(id));

    if (!isSameSet) {
      prevNodeIdsRef.current = newIds;
      mountTimeRef.current = performance.now();
    }
  }, [cappedNodes, simEdges, layoutMode]);

  // Handle node selection
  const handleSelectNode = useCallback(
    (node: GraphNode | null) => {
      setInternalSelectedNode(node);
      onSelectNode?.(node);
      if (node) {
        focusNode(node);
      }
    },
    [onSelectNode, focusNode]
  );

  // Physics & Canvas Render Loop via single Ticker (§M4.1, Gate 29)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let alpha = 1.0; // Cooling factor

    const unsub = ticker.subscribe("L0", (dtMs, now) => {
      if (!canvas || !ctx) return;

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

      // 1. Camera spring solver (§M8.4, camera preset: stiffness 60, damping 14)
      if (targetCamRef.current.active) {
        const dt = Math.min(dtMs / 1000, 0.05);
        const cam = cameraRef.current;
        const tgt = targetCamRef.current;

        const ax = -60 * (cam.x - tgt.x) - 14 * cam.vx;
        const ay = -60 * (cam.y - tgt.y) - 14 * cam.vy;
        const ak = -60 * (cam.k - tgt.k) - 14 * cam.vk;

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

      // 2. Hover state interpolation (120ms §M8.5)
      const hs = hoverStateRef.current;
      if (hs.hoveredNode) {
        hs.progress = Math.min(1, hs.progress + dtMs / 120);
      } else if (hs.progress > 0) {
        hs.progress = Math.max(0, hs.progress - dtMs / 80);
      }

      // 3. Canvas setup
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cam = cameraRef.current;
      ctx.translate(width / 2, height / 2);
      ctx.scale(cam.k, cam.k);
      ctx.translate(-width / 2 + cam.x, -height / 2 + cam.y);

      // Viewport bounds in world space (+24px margin for culling, §M8.1)
      const margin = 24 / cam.k;
      const worldLeft = (0 - width / 2) / cam.k + width / 2 - cam.x - margin;
      const worldRight = (width - width / 2) / cam.k + width / 2 - cam.x + margin;
      const worldTop = (0 - height / 2) / cam.k + height / 2 - cam.y - margin;
      const worldBottom = (height - height / 2) / cam.k + height / 2 - cam.y + margin;

      const minX = Math.min(worldLeft, worldRight);
      const maxX = Math.max(worldLeft, worldRight);
      const minY = Math.min(worldTop, worldBottom);
      const maxY = Math.max(worldTop, worldBottom);

      const nodes = simNodesRef.current;
      const edges = simEdgesRef.current;

      // 4. Force physics step
      if (layoutMode === "force" && alpha > 0.01) {
        const REPULSION = 1400;
        const SPRING_K = 0.04;
        const SPRING_LEN = 85;
        const DAMPING = 0.82;

        for (let i = 0; i < nodes.length; i++) {
          const n1 = nodes[i];
          if (dragRef.current === n1) continue;

          for (let j = i + 1; j < nodes.length; j++) {
            const n2 = nodes[j];
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 260) {
              const f = (REPULSION / (dist * dist)) * alpha;
              n1.vx -= (dx / dist) * f;
              n1.vy -= (dy / dist) * f;
              if (dragRef.current !== n2) {
                n2.vx += (dx / dist) * f;
                n2.vy += (dy / dist) * f;
              }
            }
          }

          n1.vx += (width / 2 - n1.x) * 0.002 * alpha;
          n1.vy += (height / 2 - n1.y) * 0.002 * alpha;
        }

        for (let i = 0; i < edges.length; i++) {
          const e = edges[i];
          const s = nodes[e.source];
          const t = nodes[e.target];
          if (!s || !t) continue;
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - SPRING_LEN) * SPRING_K * alpha;
          if (dragRef.current !== s) {
            s.vx += (dx / dist) * force;
            s.vy += (dy / dist) * force;
          }
          if (dragRef.current !== t) {
            t.vx -= (dx / dist) * force;
            t.vy -= (dy / dist) * force;
          }
        }

        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (dragRef.current === n) continue;
          n.x += n.vx;
          n.y += n.vy;
          n.vx *= DAMPING;
          n.vy *= DAMPING;
        }

        alpha *= 0.992;
      }

      const activeId = selectedNode?.id;
      const pulseElapsed = pulseStartTimeRef.current ? now - pulseStartTimeRef.current : 99999;
      const isPulsing = pulseElapsed < 1200;

      const hasActiveQuestion =
        (activeConcepts && activeConcepts.length > 0) ||
        (activeNodeIds && activeNodeIds.length > 0);

      const isNodeActive = (n: SimNode) => {
        if (activeNodeIds && activeNodeIds.length > 0 && activeNodeIds.includes(n.id)) {
          return true;
        }
        if (activeConcepts && activeConcepts.length > 0) {
          return activeConcepts.some(
            (c) =>
              (n.label && n.label.toLowerCase().includes(c.toLowerCase())) ||
              (n.id && n.id.toLowerCase().includes(c.toLowerCase()))
          );
        }
        return false;
      };

      const prefersReducedMotion = isReducedMotion() || isT0;

      // Closed-form snappy spring reveal progress solver (§M8.2)
      const getNodeRevealProgress = (n: SimNode): number => {
        if (prefersReducedMotion) return 1.0;
        const elapsed = now - (mountTimeRef.current + n.revealDelay);
        return snappyProgress(elapsed);
      };

      // Exact dim-to-40% via weighted spring solver (§M8.3)
      const currentDim = isT0
        ? (hasActiveQuestion ? 0.40 : 1.0)
        : dimSpringRef.current.step(dtMs);
      const exactDim = dimSpringRef.current.isAtRest ? dimSpringRef.current.target : currentDim;

      if (typeof window !== "undefined") {
        (window as any).__VG_GRAPH_DIM_ALPHA__ = exactDim;
      }

      // 4b. Draw Community Hulls (T3: 9s sine breathe 0.05->0.08, T2: static 0.06, T1/T0: none §M8.6)
      if (!isT0 && tier !== "T1") {
        const commMap = new Map<number, Point[]>();
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (n.community !== undefined && n.community >= 0) {
            let pts = commMap.get(n.community);
            if (!pts) {
              pts = [];
              commMap.set(n.community, pts);
            }
            pts.push({ x: n.x, y: n.y });
          }
        }

        let hullIdx = 0;
        commMap.forEach((pts) => {
          if (pts.length >= 2) {
            const hull = computeConvexHull(pts);
            if (hull.length >= 2) {
              let hullOpacity = 0.06;
              if (tier === "T3" && !isOffscreenRef.current) {
                // 9s sine oscillation (0.05 -> 0.08) with phase offset hullIndex / 7 (§M8.6)
                const phase = hullIdx / 7;
                hullOpacity = 0.065 + 0.015 * Math.sin((2 * Math.PI * now) / 9000 + phase);
              }

              let cx = 0;
              let cy = 0;
              for (let j = 0; j < hull.length; j++) {
                cx += hull[j].x;
                cy += hull[j].y;
              }
              cx /= hull.length;
              cy /= hull.length;

              ctx.save();
              ctx.beginPath();
              for (let j = 0; j < hull.length; j++) {
                const hp = hull[j];
                const dx = hp.x - cx;
                const dy = hp.y - cy;
                const dist = Math.hypot(dx, dy) || 1;
                const px = hp.x + (dx / dist) * 24;
                const py = hp.y + (dy / dist) * 24;
                if (j === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
              }
              ctx.closePath();
              ctx.setLineDash([6, 4]);
              ctx.strokeStyle = `rgba(155, 161, 176, ${hullOpacity})`;
              ctx.lineWidth = 1.2;
              ctx.stroke();
              ctx.restore();
            }
          }
          hullIdx++;
        });
      }

      // 5. Draw Curved Edges with Viewport Culling & Incident Edge Emphasis (§M8.5)
      const hasHover = hs.hoveredId !== null;
      const hp = hs.progress;

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
          const ep = Math.min(1, edgeElapsed / 240);
          edgeProgress = servoEase(ep);
        }

        const sActive = isNodeActive(s);
        const tActive = isNodeActive(t);
        const isQuestionActiveEdge = hasActiveQuestion && (sActive || tActive);
        const isSelectedEdge = activeId && (s.id === activeId || t.id === activeId);
        const isIncident = hs.incidentEdgeIndices.has(i);

        const midX = (s.x + t.x) / 2;
        const midY = (s.y + t.y) / 2;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const curveOffset = Math.min(24, dist * 0.12);
        const cpx = midX - (dy / dist) * curveOffset;
        const cpy = midY + (dx / dist) * curveOffset;

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

        if (isIncident) {
          // Incident edge emphasis: alpha rises to 0.85, width 1.8px (§M8.5)
          const edgeAlpha = 0.45 + 0.40 * hp;
          ctx.strokeStyle = `rgba(121, 184, 166, ${edgeAlpha * edgeProgress})`;
          ctx.lineWidth = 1.0 + 0.8 * hp;
        } else if (hasHover) {
          // Non-incident edges dim to 0.30 (§M8.5)
          ctx.strokeStyle = `rgba(43, 52, 64, ${0.30 * edgeProgress})`;
          ctx.lineWidth = 0.8;
        } else if (isQuestionActiveEdge || isSelectedEdge) {
          ctx.strokeStyle = `rgba(121, 184, 166, ${0.85 * edgeProgress})`;
          ctx.lineWidth = 1.8;
        } else if (hasActiveQuestion) {
          // Inactive edges dim to exactDim via weighted spring (§M8.3)
          ctx.strokeStyle = `rgba(43, 52, 64, ${exactDim * edgeProgress})`;
          ctx.lineWidth = 0.8;
        } else if (activeId) {
          ctx.strokeStyle = `rgba(43, 52, 64, ${0.35 * edgeProgress})`;
          ctx.lineWidth = 0.8;
        } else {
          ctx.strokeStyle = `rgba(155, 161, 176, ${0.28 * edgeProgress})`;
          ctx.lineWidth = 1.0;
        }
        ctx.stroke();
      }

      // 5b. Draw Photons (T3 only, <= 24 pooled dots travel beziers, vanish 120ms fade, §M8.3)
      let activePhotonsCount = 0;
      if (tier === "T3" && !prefersReducedMotion) {
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

          const alpha = p.t < 1.0 ? 0.50 : Math.max(0, 0.50 * (1 - p.vanishElapsed / 120));

          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, 2 * Math.PI);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha;
          ctx.fill();
          ctx.restore();
        }
      }
      if (typeof window !== "undefined") {
        (window as any).__VG_ACTIVE_PHOTONS__ = activePhotonsCount;
      }

      // 6. Draw Nodes with Viewport Culling, Glow Sprites, and Hover Scale (§M8.1, §M8.5)
      for (let idx = 0; idx < nodes.length; idx++) {
        const n = nodes[idx];

        // Viewport culling for node
        if (
          n.x + n.r < minX ||
          n.x - n.r > maxX ||
          n.y + n.r < minY ||
          n.y - n.r > maxY
        ) {
          continue;
        }

        const revealProgress = getNodeRevealProgress(n);
        if (revealProgress <= 0) continue;

        const isSelected = selectedNode?.id === n.id;
        const isConceptActive = isNodeActive(n);
        const isHovered = hs.hoveredId === n.id;
        const isNeighbor = hs.neighborNodeIds.has(n.id);

        // Hover scale: 1 -> 1.06 (120ms §M8.5)
        const scaleMultiplier = isHovered ? 1.0 + 0.06 * hp : 1.0;
        // Node scale: 0.6 -> 1 via snappy spring (§M8.2)
        const snappyScale = 0.6 + 0.4 * revealProgress;
        const currentRadius = n.r * snappyScale * scaleMultiplier;

        const isDimmed =
          (hasActiveQuestion && !isConceptActive && !isSelected) ||
          (!hasActiveQuestion && selectedNode && !isSelected && !edges.some((e) => {
            const s = nodes[e.source];
            const t = nodes[e.target];
            return (s?.id === selectedNode.id && t?.id === n.id) || (t?.id === selectedNode.id && s?.id === n.id);
          }));

        // Single pulse animation on activation (duration 1200ms)
        if (isPulsing && isConceptActive) {
          const pulseProgress = pulseElapsed / 1200;
          const pulseRadius = currentRadius + pulseProgress * 26;
          const pulseAlpha = Math.max(0, (1 - pulseProgress) * 0.85);

          ctx.beginPath();
          ctx.arc(n.x, n.y, pulseRadius, 0, 2 * Math.PI);
          ctx.strokeStyle = `rgba(121, 184, 166, ${pulseAlpha})`;
          ctx.lineWidth = Math.max(1, 2.5 * (1 - pulseProgress));
          ctx.stroke();
        }

        // Glow sprite cache (T3 / T2 §M8.1: replaces per-frame gradients)
        const glowSprite = getGlowSprite(n.color);
        if (glowSprite && (isSelected || isConceptActive) && tier !== "T1" && tier !== "T0") {
          ctx.save();
          ctx.globalAlpha = (isSelected ? 0.35 : 0.30) * revealProgress;
          const glowD = (currentRadius + 8) * 2;
          ctx.drawImage(glowSprite, n.x - glowD / 2, n.y - glowD / 2, glowD, glowD);
          ctx.restore();
        }

        // Hover glow sprite (alpha 0 -> 0.35 §M8.5)
        if (glowSprite && isHovered && hp > 0.01 && tier !== "T1" && tier !== "T0") {
          ctx.save();
          ctx.globalAlpha = 0.35 * hp * revealProgress;
          const hoverGlowD = (currentRadius + 10) * 2;
          ctx.drawImage(glowSprite, n.x - hoverGlowD / 2, n.y - hoverGlowD / 2, hoverGlowD, hoverGlowD);
          ctx.restore();
        }

        // Inactive nodes dim to exactly 40% via weighted spring (§M8.3)
        ctx.globalAlpha = (isDimmed ? exactDim : 1.0) * revealProgress;
        ctx.beginPath();
        ctx.arc(n.x, n.y, currentRadius, 0, 2 * Math.PI);
        ctx.fillStyle = n.color;
        ctx.fill();

        ctx.lineWidth = isSelected || isConceptActive || isHovered ? 2.5 : 1.2;
        ctx.strokeStyle = isSelected || isHovered ? "#FFFFFF" : isConceptActive ? "rgba(121, 184, 166, 0.9)" : "rgba(232, 226, 217, 0.45)";
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Measurement chips & Flag tags (§M8.7)
        const isMeasurement = (n.type || "").toLowerCase() === "measurement" || n.value !== undefined;
        if (isMeasurement && revealProgress > 0.4) {
          const hairlineProgress = prefersReducedMotion ? 1.0 : Math.min(1.0, Math.max(0, (revealProgress - 0.4) / 0.6));
          const hairlineEase = servoEase(hairlineProgress);
          const hairlineLen = 12 * hairlineEase;

          ctx.save();
          ctx.strokeStyle = "rgba(217, 164, 65, 0.50)";
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y - currentRadius);
          ctx.lineTo(n.x, n.y - currentRadius - hairlineLen);
          ctx.stroke();

          if (hairlineProgress > 0.8) {
            const chipAlpha = (hairlineProgress - 0.8) / 0.2;
            const chipX = n.x;
            const chipY = n.y - currentRadius - 12 - 8;
            const valText = n.value !== undefined ? `${n.value} ${n.unit || ""}` : (n.label || "");
            const hasHighFlag = n.flag && n.flag.toUpperCase() === "HIGH";

            ctx.font = "600 10px 'JetBrains Mono', monospace";
            const textW = ctx.measureText(valText).width;
            const flagW = hasHighFlag ? 32 : 0;
            const chipW = textW + flagW + 12;
            const chipH = 16;
            const rectX = chipX - chipW / 2;
            const rectY = chipY - chipH / 2;

            ctx.globalAlpha = (isDimmed ? exactDim : 1.0) * chipAlpha;
            ctx.fillStyle = "rgba(26, 31, 38, 0.92)";
            ctx.beginPath();
            ctx.roundRect(rectX, rectY, chipW, chipH, 4);
            ctx.fill();

            ctx.strokeStyle = "rgba(217, 164, 65, 0.45)";
            ctx.lineWidth = 1.0;
            ctx.stroke();

            // Value text
            ctx.fillStyle = "#D9A441";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(valText, rectX + 6, chipY);

            // HIGH flag tag with single 240ms madder wash (§M8.7)
            if (hasHighFlag) {
              const flagX = rectX + textW + 8;
              const flagTagW = 26;
              const flagTagH = 12;
              const flagTagY = chipY - flagTagH / 2;

              // Check 240ms madder wash on first reveal (once, never looping)
              const nodeRevealTime = mountTimeRef.current + n.revealDelay;
              const washElapsed = now - (nodeRevealTime + 180);
              if (washElapsed >= 0 && washElapsed < 240 && !prefersReducedMotion) {
                const washAlpha = 0.35 * (1 - washElapsed / 240);
                ctx.save();
                ctx.fillStyle = `rgba(217, 128, 141, ${washAlpha})`;
                ctx.beginPath();
                ctx.roundRect(flagX - 2, flagTagY, flagTagW, flagTagH, 2);
                ctx.fill();
                ctx.restore();
              }

              ctx.fillStyle = "#D9808D";
              ctx.fillText("HIGH", flagX, chipY);
            }
          }
          ctx.restore();
        }

        // Proportional labels with neighbor emphasis (§M8.5)
        if (revealProgress > 0.45 && (!isDimmed || isSelected || isHovered || isNeighbor)) {
          const fontSize = Math.max(9, Math.min(14, 8 + currentRadius * 0.45));
          ctx.font = `${isSelected || isConceptActive || isHovered ? "600" : "500"} ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
          if (isSelected || isConceptActive || isHovered) {
            ctx.fillStyle = "#FFFFFF"; // label alpha -> 1
          } else if (isNeighbor) {
            ctx.fillStyle = "rgba(230, 228, 222, 0.80)"; // neighbor labels alpha -> 0.8
          } else if (isDimmed) {
            ctx.fillStyle = "rgba(155, 161, 176, 0.40)";
          } else {
            ctx.fillStyle = "#E6E4DE";
          }
          ctx.textAlign = "center";
          ctx.textBaseline = "top";

          const labelText = n.label || n.id;
          const displayLabel = labelText.length > 20 ? labelText.slice(0, 18) + "…" : labelText;
          ctx.fillText(displayLabel, n.x, n.y + currentRadius + 4);
        }
      }

      // 7. Draw Evidence Dust Particles (T3 only, <= 40 pooled, drift <= 12px, §M8.3)
      let activeDustCount = 0;
      if (tier === "T3" && !prefersReducedMotion) {
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
      }
      if (typeof window !== "undefined") {
        (window as any).__VG_ACTIVE_DUST__ = activeDustCount;
      }

      ctx.restore();
    });

    return () => {
      unsub();
    };
  }, [layoutMode, selectedNode, activeConcepts, activeNodeIds]);

  // Pointer event handlers on canvas (Hit testing, dragging, and momentum §M8.4, §M8.5)
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const worldX = (clientX - canvas.clientWidth / 2) / cam.k + canvas.clientWidth / 2 - cam.x;
    const worldY = (clientY - canvas.clientHeight / 2) / cam.k + canvas.clientHeight / 2 - cam.y;
    return { x: worldX, y: worldY };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // User interaction interrupts running camera spring (§M8.4)
    targetCamRef.current.active = false;
    momentumRef.current.active = false;

    const pt = getCanvasPoint(e);
    const nodes = simNodesRef.current;

    let hitNode: SimNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = pt.x - n.x;
      const dy = pt.y - n.y;
      if (Math.sqrt(dx * dx + dy * dy) <= n.r + 4) {
        hitNode = n;
        break;
      }
    }

    if (hitNode) {
      dragRef.current = hitNode;
      handleSelectNode(hitNode);
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
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const now = performance.now();

    if (dragRef.current) {
      const pt = getCanvasPoint(e);
      dragRef.current.x = pt.x;
      dragRef.current.y = pt.y;
      dragRef.current.vx = 0;
      dragRef.current.vy = 0;
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
    const pt = getCanvasPoint(e);
    const nodes = simNodesRef.current;
    let hit: SimNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = pt.x - n.x;
      const dy = pt.y - n.y;
      if (Math.sqrt(dx * dx + dy * dy) <= n.r + 4) {
        hit = n;
        break;
      }
    }

    if (canvasRef.current) {
      canvasRef.current.style.cursor = hit ? "pointer" : "grab";
    }

    if (hit !== hoverStateRef.current.hoveredNode) {
      hoverStateRef.current.hoveredNode = hit;
      hoverStateRef.current.hoveredId = hit ? hit.id : null;
      hoverStateRef.current.incidentEdgeIndices.clear();
      hoverStateRef.current.neighborNodeIds.clear();

      if (hit) {
        const edges = simEdgesRef.current;
        for (let i = 0; i < edges.length; i++) {
          const e = edges[i];
          const s = nodes[e.source];
          const t = nodes[e.target];
          if (s?.id === hit.id) {
            hoverStateRef.current.incidentEdgeIndices.add(i);
            if (t) hoverStateRef.current.neighborNodeIds.add(t.id);
          } else if (t?.id === hit.id) {
            hoverStateRef.current.incidentEdgeIndices.add(i);
            if (s) hoverStateRef.current.neighborNodeIds.add(s.id);
          }
        }
      }
    }
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    if (panRef.current?.isPanning) {
      // Momentum hand-off on release (§M8.4)
      const speed = Math.hypot(panRef.current.vx, panRef.current.vy);
      if (speed > 0.4) {
        momentumRef.current = {
          active: true,
          vx: panRef.current.vx,
          vy: panRef.current.vy,
        };
      }
      panRef.current = null;
    }
  };

  const handlePointerLeave = () => {
    handlePointerUp();
    // Hover cancelled immediately on leave (§M8.5)
    hoverStateRef.current.hoveredNode = null;
    hoverStateRef.current.hoveredId = null;
    hoverStateRef.current.progress = 0;
    hoverStateRef.current.incidentEdgeIndices.clear();
    hoverStateRef.current.neighborNodeIds.clear();
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    targetCamRef.current.active = false; // user wheel interrupts camera spring (§M8.4)
    momentumRef.current.active = false;
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    cameraRef.current.k = Math.max(0.4, Math.min(2.8, cameraRef.current.k * zoomFactor));
  };

  // View controls
  const handleZoom = (factor: number) => {
    const isT0 = governor.getState().tier === "T0" || isReducedMotion();
    const nextK = Math.max(0.4, Math.min(2.8, cameraRef.current.k * factor));
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

  const handleResetView = () => {
    const isT0 = governor.getState().tier === "T0" || isReducedMotion();
    if (isT0) {
      cameraRef.current = { x: 0, y: 0, k: 1.0, vx: 0, vy: 0, vk: 0 };
      targetCamRef.current.active = false;
      momentumRef.current.active = false;
    } else {
      targetCamRef.current = { x: 0, y: 0, k: 1.0, active: true };
      momentumRef.current.active = false;
    }
    handleSelectNode(null);
  };

  // Metrics from live graphData
  const liveNodesCount = graphData?.metrics?.total_nodes ?? cappedNodes.length;
  const liveEdgesCount = graphData?.metrics?.total_edges ?? simEdges.length;
  const liveCommunitiesCount = graphData?.metrics?.communities_count ?? 0;
  const liveModularity = graphData?.metrics?.modularity ?? 0;

  // Animated metrics count-up via single Ticker L1 lane (§M4.1, Gate 29)
  const [animatedMetrics, setAnimatedMetrics] = useState({
    nodes: 0,
    edges: 0,
    communities: 0,
    modularity: 0,
  });

  useEffect(() => {
    const isT0 = governor.getState().tier === "T0" || isReducedMotion();
    if (isT0) {
      setAnimatedMetrics({
        nodes: liveNodesCount,
        edges: liveEdgesCount,
        communities: liveCommunitiesCount,
        modularity: liveModularity,
      });
      return;
    }

    const duration = 650;
    const startTime = performance.now();

    const unsub = ticker.subscribe("L1", (_dtMs, now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      setAnimatedMetrics({
        nodes: Math.round(ease * liveNodesCount),
        edges: Math.round(ease * liveEdgesCount),
        communities: Math.round(ease * liveCommunitiesCount),
        modularity: Number((ease * liveModularity).toFixed(2)),
      });

      if (progress >= 1) {
        return false; // auto-unsubscribe
      }
    });

    return () => unsub();
  }, [liveNodesCount, liveEdgesCount, liveCommunitiesCount, liveModularity]);

  return (
    <div ref={containerRef} className={`w-full flex flex-col ${className}`}>
      {/* Stats row & Controls above frame (§7.16) */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        {/* Live Metrics */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--cornflower)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <div>
              <span className="type-mono font-medium text-[var(--bone)]">{animatedMetrics.nodes}</span>
              <span className="type-meta text-[var(--dim)] ml-1.5">nodes</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--ochre)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
            <div>
              <span className="type-mono font-medium text-[var(--bone)]">{animatedMetrics.edges}</span>
              <span className="type-meta text-[var(--dim)] ml-1.5">edges</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--lilac)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12a4 4 0 018 0" />
            </svg>
            <div>
              <span className="type-mono font-medium text-[var(--bone)]">{animatedMetrics.communities}</span>
              <span className="type-meta text-[var(--dim)] ml-1.5">communities</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--verdigris)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 22h20L12 2z" />
            </svg>
            <div>
              <span className="type-mono font-medium text-[var(--bone)]">{animatedMetrics.modularity.toFixed(2)}</span>
              <span className="type-meta text-[var(--dim)] ml-1.5">modularity</span>
            </div>
          </div>

          {/* Activated Subgraph Chip (§20.1) */}
          {activeConcepts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-[var(--r-6)] bg-[var(--verdigris)]/10 border border-[var(--verdigris)]/30 text-[var(--verdigris)] text-[12px] type-mono">
              <span className="w-2 h-2 rounded-full bg-[var(--verdigris)] animate-pulse" />
              <span>Activated concepts: {activeConcepts.join(", ")}</span>
              {subgraphMetrics && (
                <span className="text-[var(--bone)] text-[11px] font-medium ml-1">
                  ({subgraphMetrics.total_nodes} nodes • {subgraphMetrics.total_edges} edges)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Select
            value={layoutMode}
            onChange={(e) => setLayoutMode(e.target.value)}
            options={[
              { value: "force", label: "Force-directed" },
              { value: "circular", label: "Circular" },
            ]}
          />
          <Button variant="ghost" onClick={handleResetView}>
            <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            <span>Reset view</span>
          </Button>
        </div>
      </div>

      {/* Frame: radius 14, line-strong, canvas-grid (§7.16) */}
      <div className="relative w-full h-[540px] rounded-[var(--r-14)] border border-[var(--line-strong)] bg-[var(--ink-900)] overflow-hidden canvas-grid select-none">
        {/* Radial vignette overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: "radial-gradient(circle at center, transparent 40%, rgba(14,17,22,0.85) 100%)",
          }}
        />

        {/* Legend chips top-right (§7.16) */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-3 bg-[var(--ink-800)]/85 backdrop-blur-sm px-3 py-1.5 rounded-[var(--r-6)] border border-[var(--line-strong)]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--cornflower)]" />
            <span className="type-label text-[var(--dim)]">Condition</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--verdigris)]" />
            <span className="type-label text-[var(--dim)]">Biomarker</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--ochre)]" />
            <span className="type-label text-[var(--dim)]">Measurement</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--lilac)]" />
            <span className="type-label text-[var(--dim)]">Category</span>
          </div>
        </div>

        {/* Skeleton shimmer before first graph data arrives (§US-18) */}
        {!graphData && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[var(--ink-900)]/80 backdrop-blur-sm pointer-events-none">
            <div className="w-16 h-16 rounded-full skeleton-shimmer" />
            <div className="h-4 w-48 rounded-[var(--r-4)] skeleton-shimmer" />
            <div className="h-3 w-32 rounded-[var(--r-4)] skeleton-shimmer opacity-75" />
          </div>
        )}

        {/* Interactive Canvas */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onWheel={handleWheel}
          className="w-full h-full relative z-10 block"
        />

        {/* Node Provenance Card (pops up when a node is clicked) (§7.16, §M8.5) */}
        {selectedNode && (
          <div className="absolute bottom-4 right-16 z-30 w-72 rounded-[var(--r-10)] bg-[var(--ink-800)]/95 backdrop-blur-md border border-[var(--line-strong)] p-3.5 shadow-xl flex flex-col gap-2 m-enter">
            <div className="flex items-center justify-between pb-1.5 border-b border-[var(--line-faint)]">
              <span className="type-card-title text-[var(--bone)] truncate max-w-[200px]">
                {selectedNode.label || selectedNode.id}
              </span>
              <button
                type="button"
                onClick={() => handleSelectNode(null)}
                className="text-[var(--dim)] hover:text-[var(--bone)] p-1 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between type-body text-[12px]">
                <span className="text-[var(--dim)]">Type</span>
                <span className="type-mono-sm text-[var(--bone)] capitalize">
                  {selectedNode.type || "Concept"}
                </span>
              </div>
              {selectedNode.report_id && (
                <div className="flex justify-between type-body text-[12px]">
                  <span className="text-[var(--dim)]">Source Report</span>
                  <span className="type-mono-sm text-[var(--bone)] truncate max-w-[140px]">
                    {selectedNode.report_id}
                  </span>
                </div>
              )}
              {selectedNode.page !== undefined && (
                <div className="flex justify-between type-body text-[12px]">
                  <span className="text-[var(--dim)]">Location</span>
                  <span className="type-mono-sm text-[var(--bone)]">
                    Page {selectedNode.page}
                  </span>
                </div>
              )}
              {selectedNode.value !== undefined && (
                <div className="flex justify-between type-body text-[12px]">
                  <span className="text-[var(--dim)]">Value</span>
                  <span className="type-mono-sm text-[var(--verdigris)]">
                    {selectedNode.value} {selectedNode.unit || ""}
                  </span>
                </div>
              )}
              {selectedNode.betweenness !== undefined && (
                <div className="flex justify-between type-body text-[12px]">
                  <span className="text-[var(--dim)]">Centrality</span>
                  <span className="type-mono-sm text-[var(--ochre)]">
                    {selectedNode.betweenness.toFixed(3)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Zoom cluster (§7.16) */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1">
          <IconButton size={28} title="Zoom in" onClick={() => handleZoom(1.2)}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </IconButton>
          <IconButton size={28} title="Zoom out" onClick={() => handleZoom(0.8)}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </IconButton>
          <IconButton size={28} title="Reset view" onClick={handleResetView}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </IconButton>
        </div>
      </div>
    </div>
  );
};
