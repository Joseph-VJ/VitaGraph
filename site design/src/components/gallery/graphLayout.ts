// Pure layout and camera maths for the knowledge graph. No React, no canvas.
//
// The goal is a graph you can read at a glance: every community gets its own region
// (circle packing), nodes settle inside it under a degree-aware force simulation, and
// the camera fits the whole thing to the frame.

export interface LayoutNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  community?: number;
  betweenness?: number;
  id?: string;
}

export interface LayoutEdge {
  source: number;
  target: number;
  relation: string;
}

export interface Anchor {
  x: number;
  y: number;
  radius: number;
}

export interface ForceContext {
  spacing: number;
  cx: number;
  cy: number;
  degree: number[];
  /** 0..1: how strongly a node resists its community pull (hubs sit between groups). */
  hubWeight: number[];
  anchors: Map<number, Anchor>;
}

export interface FitPads {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface CameraTarget {
  x: number;
  y: number;
  k: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Deterministic pseudo-random in [0,1) so the same graph always settles the same way. */
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

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Layout scale from the frame area, so the settled graph fills the frame at about 100% zoom. */
export function layoutSpacing(width: number, height: number, count: number): number {
  const area = Math.max(1, width * height);
  return clamp(Math.sqrt(area / (Math.max(count, 12) * 5200)), 0.55, 1.5);
}

/**
 * Pack one circle per community around the largest one. Greedy and deterministic: each circle
 * goes to the closest free spot, with a mild bias that spreads wide frames sideways.
 */
export function packCircles(radii: number[], gap: number, aspect: number): Array<{ x: number; y: number }> {
  const pos: Array<{ x: number; y: number }> = [];
  if (radii.length === 0) return pos;
  pos.push({ x: 0, y: 0 });
  const stretch = clamp(aspect, 0.8, 1.7);
  for (let i = 1; i < radii.length; i++) {
    let best = { x: 0, y: 0 };
    let bestScore = Infinity;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 36) {
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      for (let rad = radii[0] + radii[i] + gap; rad < 4000; rad += 5) {
        const px = cos * rad;
        const py = sin * rad;
        let free = true;
        for (let j = 0; j < i; j++) {
          if (Math.hypot(px - pos[j].x, py - pos[j].y) < radii[i] + radii[j] + gap) {
            free = false;
            break;
          }
        }
        if (free) {
          const score = Math.hypot(px / stretch, py);
          if (score < bestScore) {
            bestScore = score;
            best = { x: px, y: py };
          }
          break;
        }
      }
    }
    pos.push(best);
  }
  // Centre the packing on its area-weighted centroid
  let wx = 0;
  let wy = 0;
  let wsum = 0;
  pos.forEach((p, i) => {
    const w = radii[i] * radii[i];
    wx += p.x * w;
    wy += p.y * w;
    wsum += w;
  });
  const mx = wx / (wsum || 1);
  const my = wy / (wsum || 1);
  return pos.map((p) => ({ x: p.x - mx, y: p.y - my }));
}

export function buildDegree(count: number, edges: LayoutEdge[]): number[] {
  const degree = new Array<number>(count).fill(0);
  for (const e of edges) {
    if (degree[e.source] !== undefined) degree[e.source]++;
    if (degree[e.target] !== undefined) degree[e.target]++;
  }
  return degree;
}

/** One anchor per community, sized by how many nodes it holds. */
export function communityAnchors(
  nodes: LayoutNode[],
  width: number,
  height: number,
  spacing: number
): Map<number, Anchor> {
  const counts = new Map<number, number>();
  nodes.forEach((n) => {
    const c = n.community ?? -1;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  });
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const radii = ordered.map(([, n]) => spacing * (21 * Math.sqrt(n) + 20));
  const centers = packCircles(radii, 16 * spacing, width / Math.max(1, height));
  const anchors = new Map<number, Anchor>();
  ordered.forEach(([community], i) => {
    anchors.set(community, { x: width / 2 + centers[i].x, y: height / 2 + centers[i].y, radius: radii[i] });
  });
  return anchors;
}

/** Start every node inside its community region (deterministic jitter, no randomness). */
export function seedForce(
  nodes: LayoutNode[],
  anchors: Map<number, Anchor>,
  width: number,
  height: number,
  previous?: Map<string, { x: number; y: number }>
) {
  nodes.forEach((n, i) => {
    const prev = n.id ? previous?.get(n.id) : undefined;
    if (prev) {
      n.x = prev.x;
      n.y = prev.y;
    } else {
      const rnd = mulberry32(hashString(n.id ?? String(i)) + i);
      const anchor = anchors.get(n.community ?? -1) ?? { x: width / 2, y: height / 2, radius: 60 };
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * anchor.radius * 0.7;
      n.x = anchor.x + Math.cos(a) * d;
      n.y = anchor.y + Math.sin(a) * d;
    }
    n.vx = 0;
    n.vy = 0;
  });
}

/** Ring layout: communities occupy contiguous arcs, the most central nodes sit on an inner ring. */
export function seedCircular(nodes: LayoutNode[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.min(width, height) * 0.4;
  const order = nodes
    .map((_, i) => i)
    .sort((a, b) => {
      const ca = nodes[a].community ?? -1;
      const cb = nodes[b].community ?? -1;
      return ca - cb || (nodes[b].betweenness ?? 0) - (nodes[a].betweenness ?? 0);
    });
  const hubCount = Math.max(3, Math.round(nodes.length * 0.07));
  const hubSet = new Set(
    [...order].sort((a, b) => (nodes[b].betweenness ?? 0) - (nodes[a].betweenness ?? 0)).slice(0, hubCount)
  );
  const ring = order.filter((i) => !hubSet.has(i));
  ring.forEach((idx, pos) => {
    const angle = (pos / Math.max(1, ring.length)) * Math.PI * 2 - Math.PI / 2;
    nodes[idx].x = cx + Math.cos(angle) * outer;
    nodes[idx].y = cy + Math.sin(angle) * outer;
    nodes[idx].vx = 0;
    nodes[idx].vy = 0;
  });
  [...hubSet].forEach((idx, pos) => {
    const angle = (pos / hubSet.size) * Math.PI * 2 - Math.PI / 2;
    nodes[idx].x = cx + Math.cos(angle) * outer * 0.34;
    nodes[idx].y = cy + Math.sin(angle) * outer * 0.34;
    nodes[idx].vx = 0;
    nodes[idx].vy = 0;
  });
}

/** One simulation step. `pinned` is a node index held in place (being dragged), or -1. */
export function stepForce(nodes: LayoutNode[], edges: LayoutEdge[], ctx: ForceContext, alpha: number, pinned: number) {
  const n = nodes.length;
  const sp = ctx.spacing;
  const REPULSION = 1700 * sp * sp;
  const cutoff = 330 * sp;
  const cutoff2 = cutoff * cutoff;

  // Repulsion plus soft collision, so orbs never sit on top of each other
  for (let i = 0; i < n; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < n; j++) {
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 > cutoff2) continue;
      if (d2 < 0.5) {
        dx = (i % 2 ? 1 : -1) * 0.7;
        dy = (j % 2 ? 1 : -1) * 0.7;
        d2 = dx * dx + dy * dy;
      }
      const d = Math.sqrt(d2);
      const minD = a.r + b.r + 9 * sp;
      let f = ((REPULSION * (1 + 0.035 * (a.r + b.r))) / d2) * alpha;
      if (d < minD) f += (minD - d) * 0.5 * (0.25 + 0.75 * alpha);
      f = Math.min(f, 16);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      if (i !== pinned) {
        a.vx -= fx;
        a.vy -= fy;
      }
      if (j !== pinned) {
        b.vx += fx;
        b.vy += fy;
      }
    }
  }

  // Springs: short inside a community, long across, and the better-connected end moves less
  for (let e = 0; e < edges.length; e++) {
    const edge = edges[e];
    const s = nodes[edge.source];
    const t = nodes[edge.target];
    if (!s || !t) continue;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const same = s.community !== undefined && s.community === t.community;
    const rest = sp * (same ? 26 : 70) + (s.r + t.r) * 0.7;
    const degS = ctx.degree[edge.source] || 1;
    const degT = ctx.degree[edge.target] || 1;
    const strength = ((same ? 1 : 0.22) / Math.min(degS, degT)) * 0.55;
    const k = ((d - rest) / d) * alpha * strength;
    const moveS = degT / (degS + degT);
    const moveT = degS / (degS + degT);
    if (edge.source !== pinned) {
      s.vx += dx * k * moveS;
      s.vy += dy * k * moveS;
    }
    if (edge.target !== pinned) {
      t.vx -= dx * k * moveT;
      t.vy -= dy * k * moveT;
    }
  }

  // Community pull and a faint centre gravity
  for (let i = 0; i < n; i++) {
    if (i === pinned) continue;
    const node = nodes[i];
    const anchor = ctx.anchors.get(node.community ?? -1);
    if (anchor) {
      const pull = 0.09 * alpha * (1 - ctx.hubWeight[i]);
      node.vx += (anchor.x - node.x) * pull;
      node.vy += (anchor.y - node.y) * pull;
    }
    node.vx += (ctx.cx - node.x) * 0.012 * alpha;
    node.vy += (ctx.cy - node.y) * 0.012 * alpha;
  }

  // Integrate
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    node.vx *= 0.6;
    node.vy *= 0.6;
    if (i === pinned) continue;
    node.x += node.vx;
    node.y += node.vy;
  }
}

/** Run the simulation to rest before the first frame so the graph appears already composed. */
export function settle(nodes: LayoutNode[], edges: LayoutEdge[], ctx: ForceContext, iterations: number, startAlpha = 1) {
  let alpha = startAlpha;
  const decay = 1 - Math.pow(0.001, 1 / iterations);
  for (let i = 0; i < iterations; i++) {
    stepForce(nodes, edges, ctx, alpha, -1);
    alpha -= alpha * decay;
  }
}

/** Shift the layout so its centre of mass sits at the frame centre. */
export function recenter(nodes: LayoutNode[], width: number, height: number) {
  if (nodes.length === 0) return;
  let sx = 0;
  let sy = 0;
  let sw = 0;
  nodes.forEach((n) => {
    const w = n.r * n.r;
    sx += n.x * w;
    sy += n.y * w;
    sw += w;
  });
  const dx = width / 2 - sx / sw;
  const dy = height / 2 - sy / sw;
  nodes.forEach((n) => {
    n.x += dx;
    n.y += dy;
  });
}

/** Camera that fits the given nodes inside the frame, leaving room for the HUD and controls. */
export function fitView(
  nodes: LayoutNode[],
  width: number,
  height: number,
  pads: FitPads,
  kMin = 0.5,
  kMax = 1.6,
  labelPad = 24
): CameraTarget {
  if (nodes.length === 0) return { x: 0, y: 0, k: 1 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.r - 6);
    maxX = Math.max(maxX, n.x + n.r + 6);
    minY = Math.min(minY, n.y - n.r - 6);
    maxY = Math.max(maxY, n.y + n.r + labelPad);
  }
  const bw = Math.max(90, maxX - minX);
  const bh = Math.max(90, maxY - minY);
  const availW = Math.max(120, width - pads.left - pads.right);
  const availH = Math.max(120, height - pads.top - pads.bottom);
  const k = clamp(Math.min(availW / bw, availH / bh), kMin, kMax);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const sx = pads.left + availW / 2;
  const sy = pads.top + availH / 2;
  // screenX = (worldX - width/2 + cam.x) * k + width/2
  return { x: (sx - width / 2) / k - cx + width / 2, y: (sy - height / 2) / k - cy + height / 2, k };
}
