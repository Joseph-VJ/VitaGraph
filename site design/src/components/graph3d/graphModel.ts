// Pure graph model functions for selection, 3D/2D layouts, styles, and token colours.
// No React, no three.js imports, no DOM access except in readTokenColours.

import type { GraphNode, GraphResponse } from "../../api/graph";
import {
  type ForceContext,
  type LayoutNode,
  communityAnchors,
  layoutSpacing,
  recenter,
  seedForce,
  settle,
} from "../gallery/graphLayout";
import { communityColor } from "../gallery/graphTheme";

export const NODE_CAP = 120;
export const NODE_CAP_WITH_FRAGMENTS = 400;

export const FRAGMENT_TYPES = new Set(["chunk", "section", "uncertainty"]);
export const STRUCTURAL_TYPES = new Set(["chunk", "section", "uncertainty", "report"]);

export const isFragmentType = (type?: string) => FRAGMENT_TYPES.has((type || "").toLowerCase());
export const isStructuralType = (type?: string) => STRUCTURAL_TYPES.has((type || "").toLowerCase());

export interface SelectedEdge {
  source: number;
  target: number;
  relation: string;
}

export interface SelectedNodesResult {
  nodes: GraphNode[];
  edges: SelectedEdge[];
  poolSize: number;
  fragmentCount: number;
  hiddenFragments: boolean;
}

export function selectNodes(
  graph: GraphResponse | null | undefined,
  options?: { showFragments?: boolean; cap?: number }
): SelectedNodesResult {
  const showFragments = options?.showFragments ?? false;
  const cap = options?.cap ?? (showFragments ? NODE_CAP_WITH_FRAGMENTS : NODE_CAP);

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      poolSize: 0,
      fragmentCount: 0,
      hiddenFragments: false,
    };
  }

  const all = graph.nodes;
  const fragments = all.filter((n) => isFragmentType(n.type)).length;
  const meaningful = all.length - fragments;
  const filtering = !showFragments && fragments > 0 && meaningful >= 5;
  const pool = filtering ? all.filter((n) => !isFragmentType(n.type)) : all;

  const sorted = [...pool].sort((a, b) => (b.betweenness ?? 0) - (a.betweenness ?? 0));
  const nodesSlice = sorted.slice(0, cap);

  const indexMap = new Map<string, number>();
  nodesSlice.forEach((n, i) => indexMap.set(n.id, i));

  const edges: SelectedEdge[] = [];
  (graph.edges || []).forEach((e) => {
    const sIdx = indexMap.get(e.source);
    const tIdx = indexMap.get(e.target);
    if (sIdx !== undefined && tIdx !== undefined) {
      const relation = e.relation || "";
      edges.push({ source: sIdx, target: tIdx, relation });
    }
  });

  return {
    nodes: nodesSlice,
    edges,
    poolSize: pool.length,
    fragmentCount: fragments,
    hiddenFragments: filtering,
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function layout3d(nodes: GraphNode[], edges: SelectedEdge[]): Float32Array {
  const count = nodes.length;
  const pos = new Float32Array(count * 3);
  if (count === 0) return pos;

  const commSet = new Set<number>();
  for (let i = 0; i < count; i++) {
    commSet.add(nodes[i].community ?? 0);
  }
  const commList = Array.from(commSet).sort((a, b) => a - b);
  const commCount = commList.length;

  const anchorX = new Map<number, number>();
  const anchorY = new Map<number, number>();
  const anchorZ = new Map<number, number>();
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

  for (let c = 0; c < commCount; c++) {
    const commId = commList[c];
    if (commCount === 1) {
      anchorX.set(commId, 0);
      anchorY.set(commId, 0);
      anchorZ.set(commId, 0);
    } else {
      const yNorm = 1 - (2 * c) / (commCount - 1);
      const radiusAtY = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));
      const theta = c * GOLDEN_ANGLE;
      anchorX.set(commId, Math.cos(theta) * radiusAtY * 60);
      anchorY.set(commId, yNorm * 60);
      anchorZ.set(commId, Math.sin(theta) * radiusAtY * 60);
    }
  }

  for (let i = 0; i < count; i++) {
    const node = nodes[i];
    const commId = node.community ?? 0;
    const ax = anchorX.get(commId) ?? 0;
    const ay = anchorY.get(commId) ?? 0;
    const az = anchorZ.get(commId) ?? 0;

    const seed = (hashString(node.id) + i) >>> 0;
    const rnd = mulberry32(seed);

    const theta = rnd() * Math.PI * 2;
    const phi = (rnd() - 0.5) * Math.PI;
    const dist = rnd() * 15;

    pos[i * 3 + 0] = ax + Math.cos(phi) * Math.cos(theta) * dist;
    pos[i * 3 + 1] = ay + Math.sin(phi) * dist;
    pos[i * 3 + 2] = az + Math.cos(phi) * Math.sin(theta) * dist;
  }

  const velX = new Float32Array(count);
  const velY = new Float32Array(count);
  const velZ = new Float32Array(count);

  const nodeComm = new Int32Array(count);
  const nodeAnchorX = new Float32Array(count);
  const nodeAnchorY = new Float32Array(count);
  const nodeAnchorZ = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const cid = nodes[i].community ?? 0;
    nodeComm[i] = cid;
    nodeAnchorX[i] = anchorX.get(cid) ?? 0;
    nodeAnchorY[i] = anchorY.get(cid) ?? 0;
    nodeAnchorZ[i] = anchorZ.get(cid) ?? 0;
  }

  const edgeSources = new Int32Array(edges.length);
  const edgeTargets = new Int32Array(edges.length);
  for (let e = 0; e < edges.length; e++) {
    edgeSources[e] = edges[e].source;
    edgeTargets[e] = edges[e].target;
  }
  const edgeCount = edges.length;

  for (let iter = 0; iter < 300; iter++) {
    const alpha = (300 - iter) / 300;

    for (let i = 0; i < count; i++) {
      velX[i] = 0;
      velY[i] = 0;
      velZ[i] = 0;
    }

    for (let e = 0; e < edgeCount; e++) {
      const u = edgeSources[e];
      const v = edgeTargets[e];
      const dx = pos[v * 3 + 0] - pos[u * 3 + 0];
      const dy = pos[v * 3 + 1] - pos[u * 3 + 1];
      const dz = pos[v * 3 + 2] - pos[u * 3 + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;
      const targetDist = 20;
      const spring = (dist - targetDist) * 0.04 * alpha;
      const fx = (dx / dist) * spring;
      const fy = (dy / dist) * spring;
      const fz = (dz / dist) * spring;

      velX[u] += fx;
      velY[u] += fy;
      velZ[u] += fz;
      velX[v] -= fx;
      velY[v] -= fy;
      velZ[v] -= fz;
    }

    for (let i = 0; i < count; i++) {
      const ci = nodeComm[i];
      const px = pos[i * 3 + 0];
      const py = pos[i * 3 + 1];
      const pz = pos[i * 3 + 2];
      for (let j = i + 1; j < count; j++) {
        if (nodeComm[j] !== ci) continue;
        const dx = px - pos[j * 3 + 0];
        const dy = py - pos[j * 3 + 1];
        const dz = pz - pos[j * 3 + 2];
        const d2 = dx * dx + dy * dy + dz * dz + 0.01;
        if (d2 < 2500) {
          const rep = (60 / d2) * alpha;
          const invD = 1 / Math.sqrt(d2);
          const fx = dx * invD * rep;
          const fy = dy * invD * rep;
          const fz = dz * invD * rep;
          velX[i] += fx;
          velY[i] += fy;
          velZ[i] += fz;
          velX[j] -= fx;
          velY[j] -= fy;
          velZ[j] -= fz;
        }
      }
    }

    for (let i = 0; i < count; i++) {
      const dx = nodeAnchorX[i] - pos[i * 3 + 0];
      const dy = nodeAnchorY[i] - pos[i * 3 + 1];
      const dz = nodeAnchorZ[i] - pos[i * 3 + 2];
      const pull = 0.02 * alpha;
      velX[i] += dx * pull;
      velY[i] += dy * pull;
      velZ[i] += dz * pull;
    }

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] += velX[i] * 0.5;
      pos[i * 3 + 1] += velY[i] * 0.5;
      pos[i * 3 + 2] += velZ[i] * 0.5;
    }
  }

  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (let i = 0; i < count; i++) {
    sx += pos[i * 3 + 0];
    sy += pos[i * 3 + 1];
    sz += pos[i * 3 + 2];
  }
  const meanX = sx / count;
  const meanY = sy / count;
  const meanZ = sz / count;
  for (let i = 0; i < count; i++) {
    pos[i * 3 + 0] -= meanX;
    pos[i * 3 + 1] -= meanY;
    pos[i * 3 + 2] -= meanZ;
  }

  return pos;
}

export interface Point2D {
  x: number;
  y: number;
}

export function layout2d(
  nodes: GraphNode[],
  edges: SelectedEdge[],
  width: number,
  height: number
): Point2D[] {
  const count = nodes.length;
  if (count === 0) return [];

  const degree = new Array(count).fill(0);
  edges.forEach((e) => {
    if (e.source >= 0 && e.source < count) degree[e.source]++;
    if (e.target >= 0 && e.target < count) degree[e.target]++;
  });

  const layoutNodes: LayoutNode[] = nodes.map((n) => {
    const s = nodeStyle(n).size;
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: s * 2.5,
      community: n.community,
      betweenness: n.betweenness,
      id: n.id,
    };
  });

  const spacing = layoutSpacing(width, height, count);
  const anchors = communityAnchors(layoutNodes, width, height, spacing);
  const hubWeight = degree.map((d) => (d > 20 ? 0.85 : 0));
  const forceCtx: ForceContext = {
    spacing,
    cx: width / 2,
    cy: height / 2,
    degree,
    hubWeight,
    anchors,
  };

  seedForce(layoutNodes, anchors, width, height);
  settle(layoutNodes, edges as any, forceCtx, 300);
  recenter(layoutNodes, width, height);

  return layoutNodes.map((n) => ({ x: n.x, y: n.y }));
}

export type NodeSizeClass = "largest" | "medium" | "small" | "smallest";
export type NodeColorRole = "accent" | "text" | "neutral" | "uncertain" | "community";

export interface NodeStyleResult {
  sizeClass: NodeSizeClass;
  size: number;
  colorRole: NodeColorRole;
  color: string;
}

export function nodeStyle(
  node: GraphNode,
  options?: { selected?: boolean; active?: boolean }
): NodeStyleResult {
  const type = (node.type || "").toLowerCase();

  let sizeClass: NodeSizeClass;
  let size: number;
  if (type === "report" || type === "person") {
    sizeClass = "largest";
    size = 4.5;
  } else if (type === "test" || type === "category" || type === "condition" || type === "biomarker") {
    sizeClass = "medium";
    size = 3.2;
  } else if (type === "measurement") {
    sizeClass = "small";
    size = 2.4;
  } else if (FRAGMENT_TYPES.has(type)) {
    sizeClass = "smallest";
    size = 1.6;
  } else {
    sizeClass = "medium";
    size = 3.0;
  }

  let colorRole: NodeColorRole;
  let color: string;

  if (options?.selected || options?.active || node.active) {
    colorRole = "accent";
    color = "var(--color-accent)";
  } else if (type === "report") {
    colorRole = "text";
    color = "var(--color-text)";
  } else if (type === "uncertainty") {
    colorRole = "uncertain";
    color = "var(--ochre)";
  } else if (STRUCTURAL_TYPES.has(type)) {
    colorRole = "neutral";
    color = "var(--color-neutral-400)";
  } else {
    colorRole = "community";
    color = communityColor(node.community, "var(--color-neutral-600)");
  }

  return {
    sizeClass,
    size,
    colorRole,
    color,
  };
}

export interface TokenColours {
  text: string;
  accent: string;
  neutral400: string;
  neutral600: string;
  divider: string;
  ochre: string;
  bg: string;
}

export function readTokenColours(): TokenColours {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      text: "rgb(32, 30, 29)",
      accent: "rgb(236, 48, 19)",
      neutral400: "rgb(186, 182, 182)",
      neutral600: "rgb(125, 121, 121)",
      divider: "rgba(32, 30, 29, 0.4)",
      ochre: "rgb(197, 138, 67)",
      bg: "rgb(243, 242, 242)",
    };
  }
  const style = getComputedStyle(document.documentElement);
  return {
    text: style.getPropertyValue("--color-text").trim() || "rgb(32, 30, 29)",
    accent: style.getPropertyValue("--color-accent").trim() || "rgb(236, 48, 19)",
    neutral400: style.getPropertyValue("--color-neutral-400").trim() || "rgb(186, 182, 182)",
    neutral600: style.getPropertyValue("--color-neutral-600").trim() || "rgb(125, 121, 121)",
    divider: style.getPropertyValue("--color-divider").trim() || "rgba(32, 30, 29, 0.4)",
    ochre: style.getPropertyValue("--ochre").trim() || "rgb(197, 138, 67)",
    bg: style.getPropertyValue("--color-bg").trim() || "rgb(243, 242, 242)",
  };
}
