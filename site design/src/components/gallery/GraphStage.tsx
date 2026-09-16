import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button, IconButton } from "./Buttons";
import { Select } from "./Input";
import type { GraphResponse, GraphNode } from "../../api/graph";

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

function getNodeColor(node: GraphNode): string {
  if (node.color && node.color.startsWith("#")) return node.color;
  const t = (node.type || "").toLowerCase();
  return CATEGORY_COLORS[t] || "#79B8A6";
}

// Plan §11.7 node stagger delays
const getNodeDelay = (n: SimNode, index: number): number => {
  const t = (n.type || "").toLowerCase();
  switch (t) {
    case "person":
      return 0;
    case "report":
      return 40;
    case "section":
      return 90;
    case "category":
      return 130;
    case "test":
    case "biomarker":
      return 170 + (index % 8) * 16;
    case "measurement":
      return 250 + (index % 8) * 16;
    case "date":
      return 330;
    case "chunk":
      return 370 + (index % 8) * 16;
    case "uncertainty":
      return 410;
    default:
      return 200 + (index % 8) * 16;
  }
};

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

  useEffect(() => {
    if (
      (activeConcepts && activeConcepts.length > 0) ||
      (activeNodeIds && activeNodeIds.length > 0)
    ) {
      pulseStartTimeRef.current = performance.now();
    } else {
      pulseStartTimeRef.current = null;
    }
  }, [activeConcepts, activeNodeIds]);

  // Simulation and camera state
  const cameraRef = useRef({ x: 0, y: 0, k: 1 });
  const simNodesRef = useRef<SimNode[]>([]);
  const simEdgesRef = useRef<SimEdge[]>([]);
  const animRef = useRef<number | null>(null);
  const dragRef = useRef<SimNode | null>(null);
  const panRef = useRef<{ isPanning: boolean; startX: number; startY: number } | null>(null);
  const hoveredNodeRef = useRef<SimNode | null>(null);

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

  // Initial node layout placement
  useEffect(() => {
    const width = containerRef.current?.clientWidth || 800;
    const height = 540;

    const initialSimNodes: SimNode[] = cappedNodes.map((n, i) => {
      let x = width / 2 + (Math.random() - 0.5) * 360;
      let y = height / 2 + (Math.random() - 0.5) * 260;

      if (layoutMode === "circular" && cappedNodes.length > 0) {
        const angle = (i / cappedNodes.length) * 2 * Math.PI;
        const radius = Math.min(width, height) * 0.35;
        x = width / 2 + Math.cos(angle) * radius;
        y = height / 2 + Math.sin(angle) * radius;
      }

      const radius = n.betweenness !== undefined
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
      };
    });

    simNodesRef.current = initialSimNodes;
    simEdgesRef.current = simEdges;
    mountTimeRef.current = performance.now();
  }, [cappedNodes, simEdges, layoutMode]);

  // Handle node selection
  const handleSelectNode = useCallback(
    (node: GraphNode | null) => {
      setInternalSelectedNode(node);
      onSelectNode?.(node);
    },
    [onSelectNode]
  );

  // Physics & Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isRunning = true;
    let alpha = 1.0; // Cooling factor

    const render = () => {
      if (!canvas || !ctx || !isRunning) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cam = cameraRef.current;
      ctx.translate(width / 2, height / 2);
      ctx.scale(cam.k, cam.k);
      ctx.translate(-width / 2 + cam.x, -height / 2 + cam.y);

      const nodes = simNodesRef.current;
      const edges = simEdgesRef.current;

      // Force physics step if layout is force-directed
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

          // Center gravity
          n1.vx += (width / 2 - n1.x) * 0.002 * alpha;
          n1.vy += (height / 2 - n1.y) * 0.002 * alpha;
        }

        // Spring attraction along edges
        edges.forEach((e) => {
          const s = nodes[e.source];
          const t = nodes[e.target];
          if (!s || !t) return;
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
        });

        // Update positions
        nodes.forEach((n) => {
          if (dragRef.current === n) return;
          n.x += n.vx;
          n.y += n.vy;
          n.vx *= DAMPING;
          n.vy *= DAMPING;
        });

        alpha *= 0.992;
      }

      const activeId = selectedNode?.id;
      const now = performance.now();
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

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Calculate staggered reveal progress per node (Plan §11.7)
      const getNodeRevealProgress = (n: SimNode, idx: number): number => {
        if (prefersReducedMotion) return 1.0;
        const delay = getNodeDelay(n, idx);
        const elapsed = now - mountTimeRef.current - delay;
        if (elapsed <= 0) return 0;
        const t = Math.min(1, elapsed / 240); // 240ms duration token
        return 1 - Math.pow(1 - t, 3); // ease-out cubic
      };

      // Draw Curved Edges with Edge Draw-In
      edges.forEach((e) => {
        const s = nodes[e.source];
        const t = nodes[e.target];
        if (!s || !t) return;

        const sProgress = getNodeRevealProgress(s, e.source);
        const tProgress = getNodeRevealProgress(t, e.target);
        if (sProgress <= 0.05 && tProgress <= 0.05) return;

        let edgeProgress = 1.0;
        if (!prefersReducedMotion) {
          const sDelay = getNodeDelay(s, e.source);
          const tDelay = getNodeDelay(t, e.target);
          const edgeStart = Math.max(sDelay, tDelay) + 30;
          const edgeElapsed = now - mountTimeRef.current - edgeStart;
          if (edgeElapsed <= 0) return;
          const ep = Math.min(1, edgeElapsed / 240);
          edgeProgress = 1 - Math.pow(1 - ep, 3);
        }

        const sActive = isNodeActive(s);
        const tActive = isNodeActive(t);
        const isQuestionActiveEdge = hasActiveQuestion && (sActive || tActive);
        const isSelectedEdge = activeId && (s.id === activeId || t.id === activeId);

        const midX = (s.x + t.x) / 2;
        const midY = (s.y + t.y) / 2;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Quadratic curve offset
        const curveOffset = Math.min(24, dist * 0.12);
        const cpx = midX - (dy / dist) * curveOffset;
        const cpy = midY + (dx / dist) * curveOffset;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);

        if (edgeProgress >= 0.99) {
          ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
        } else {
          // Truncated quadratic bezier sub-segment from 0 to edgeProgress
          const u = edgeProgress;
          const ctrlX = (1 - u) * s.x + u * cpx;
          const ctrlY = (1 - u) * s.y + u * cpy;
          const endX = (1 - u) * (1 - u) * s.x + 2 * (1 - u) * u * cpx + u * u * t.x;
          const endY = (1 - u) * (1 - u) * s.y + 2 * (1 - u) * u * cpy + u * u * t.y;
          ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
        }

        if (isQuestionActiveEdge || isSelectedEdge) {
          ctx.strokeStyle = `rgba(121, 184, 166, ${0.85 * edgeProgress})`;
          ctx.lineWidth = 1.8;
        } else if (hasActiveQuestion) {
          ctx.strokeStyle = `rgba(43, 52, 64, ${0.40 * edgeProgress})`;
          ctx.lineWidth = 0.8;
        } else if (activeId) {
          ctx.strokeStyle = `rgba(43, 52, 64, ${0.35 * edgeProgress})`;
          ctx.lineWidth = 0.8;
        } else {
          ctx.strokeStyle = `rgba(155, 161, 176, ${0.28 * edgeProgress})`;
          ctx.lineWidth = 1.0;
        }
        ctx.stroke();
      });

      // Draw Nodes with Staggered Scale-In
      nodes.forEach((n, idx) => {
        const revealScale = getNodeRevealProgress(n, idx);
        if (revealScale <= 0) return;

        const currentRadius = n.r * revealScale;
        const isSelected = selectedNode?.id === n.id;
        const isConceptActive = isNodeActive(n);

        // US-05 Acceptance: "active nodes pulse once, others dim to 40%"
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

        // Glow ring for active / selected
        if (isSelected || isConceptActive) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, currentRadius + 5, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected ? "rgba(121, 184, 166, 0.35)" : "rgba(134, 169, 217, 0.30)";
          ctx.fill();
        }

        // Inactive nodes dim to exactly 40% (US-05 specification)
        ctx.globalAlpha = (isDimmed ? 0.40 : 1.0) * revealScale;
        ctx.beginPath();
        ctx.arc(n.x, n.y, currentRadius, 0, 2 * Math.PI);
        ctx.fillStyle = n.color;
        ctx.fill();

        ctx.lineWidth = isSelected || isConceptActive ? 2.5 : 1.2;
        ctx.strokeStyle = isSelected ? "#FFFFFF" : isConceptActive ? "rgba(121, 184, 166, 0.9)" : "rgba(232, 226, 217, 0.45)";
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Proportional labels
        if (revealScale > 0.45 && (!isDimmed || isSelected)) {
          const fontSize = Math.max(9, Math.min(14, 8 + currentRadius * 0.45));
          ctx.font = `${isSelected || isConceptActive ? "600" : "500"} ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
          ctx.fillStyle = isSelected || isConceptActive ? "#FFFFFF" : isDimmed ? "rgba(155, 161, 176, 0.40)" : "#E6E4DE";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";

          const labelText = n.label || n.id;
          const displayLabel = labelText.length > 20 ? labelText.slice(0, 18) + "…" : labelText;
          ctx.fillText(displayLabel, n.x, n.y + currentRadius + 4);
        }
      });

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [layoutMode, selectedNode, activeConcepts, activeNodeIds]);

  // Pointer event handlers on canvas (Hit testing & dragging)
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
    const pt = getCanvasPoint(e);
    const nodes = simNodesRef.current;

    // Check hit
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
      panRef.current = { isPanning: true, startX: e.clientX, startY: e.clientY };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      const pt = getCanvasPoint(e);
      dragRef.current.x = pt.x;
      dragRef.current.y = pt.y;
      dragRef.current.vx = 0;
      dragRef.current.vy = 0;
      return;
    }

    if (panRef.current?.isPanning) {
      const dx = (e.clientX - panRef.current.startX) / cameraRef.current.k;
      const dy = (e.clientY - panRef.current.startY) / cameraRef.current.k;
      cameraRef.current.x += dx;
      cameraRef.current.y += dy;
      panRef.current.startX = e.clientX;
      panRef.current.startY = e.clientY;
      return;
    }

    // Hover cursor styling
    const pt = getCanvasPoint(e);
    const hit = simNodesRef.current.find((n) => {
      const dx = pt.x - n.x;
      const dy = pt.y - n.y;
      return Math.sqrt(dx * dx + dy * dy) <= n.r + 4;
    });

    if (canvasRef.current) {
      canvasRef.current.style.cursor = hit ? "pointer" : "grab";
    }
    hoveredNodeRef.current = hit || null;
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    if (panRef.current) panRef.current.isPanning = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    cameraRef.current.k = Math.max(0.4, Math.min(2.8, cameraRef.current.k * zoomFactor));
  };

  // View controls
  const handleZoom = (factor: number) => {
    cameraRef.current.k = Math.max(0.4, Math.min(2.8, cameraRef.current.k * factor));
  };

  const handleResetView = () => {
    cameraRef.current = { x: 0, y: 0, k: 1.0 };
    handleSelectNode(null);
  };

  // Metrics from live graphData
  const liveNodesCount = graphData?.metrics?.total_nodes ?? cappedNodes.length;
  const liveEdgesCount = graphData?.metrics?.total_edges ?? simEdges.length;
  const liveCommunitiesCount = graphData?.metrics?.communities_count ?? 0;
  const liveModularity = graphData?.metrics?.modularity ?? 0;

  // Animated metrics count-up from REAL values (Plan §11 / US-17)
  const [animatedMetrics, setAnimatedMetrics] = useState({
    nodes: 0,
    edges: 0,
    communities: 0,
    modularity: 0,
  });

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
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
    let animId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      setAnimatedMetrics({
        nodes: Math.round(ease * liveNodesCount),
        edges: Math.round(ease * liveEdgesCount),
        communities: Math.round(ease * liveCommunitiesCount),
        modularity: Number((ease * liveModularity).toFixed(2)),
      });

      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
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

        {/* Interactive Canvas */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
          className="w-full h-full relative z-10 block"
        />

        {/* Node Provenance Card (pops up when a node is clicked) (§7.16) */}
        {selectedNode && (
          <div className="absolute bottom-4 right-16 z-30 w-72 rounded-[var(--r-10)] bg-[var(--ink-800)]/95 backdrop-blur-md border border-[var(--line-strong)] p-3.5 shadow-xl flex flex-col gap-2 animate-fade-in">
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
