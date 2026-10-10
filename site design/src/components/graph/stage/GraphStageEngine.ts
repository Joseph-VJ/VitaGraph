// GraphStageEngine.ts: Pure TypeScript 3D canvas stage engine for VitaGraph Knowledge Graph.
// Ported from VitaGraph-Playground.html (lines 616-1348).

export type NodeKind = "person" | "report" | "section" | "bio" | "meas" | "unc";

export interface StageNode {
  id: string;
  idx: number;
  k: NodeKind;
  label: string;
  name: string;
  group: string;
  unit: string;
  val: number | null;
  latest: number | null;
  delta: number | null;
  flag: "in" | "high" | "low" | "critical" | string;
  firstFlag: "in" | "high" | "low" | string;
  vals: (number | null)[];
  range: [number | null, number | null];
  ri: number; // report index / order
  firstI: number;
  lastI: number;
  imp: number; // betweenness importance
  from: [number, number, number];
  to: [number, number, number];
  md: number; // layout morph delay
  t: number; // appearance time 0..N
  k2: number; // index within sibling group
  bioId?: string; // for meas: parent bio id
  reportId?: string;
  quote?: string;
  start?: number;
  end?: number;
}

export interface StageEdge {
  a: string;
  b: string;
  h: number;
  dir: boolean;
  label?: string;
}

export interface StageReportInfo {
  id: string;
  order: number;
  date: string | null;
  label: string;
  filename?: string;
}

export interface StageOptions {
  size: boolean; // size by importance
  breath: boolean; // gentle idle motion
  drop: boolean; // floor drop-lines
  hover: boolean; // hover preview
  fly: boolean; // fly to node
  clu: boolean; // cluster outlines
  flow: boolean; // data flow dots
  lens: boolean; // lens magnifier
  heat: boolean; // what changed mode
  ghost: boolean; // ghosts in time machine
  hideTimeline?: boolean; // Text to Graph: Sphere, Orbits, Columns only
}

export interface EngineCallbacks {
  onSelect: (id: string | null) => void;
  onHover: (id: string | null, point?: { x: number; y: number } | null) => void;
  onFrameInfo: (visibleNodes: number, visibleLinks: number, fps: number) => void;
  onIntroFinished?: () => void;
  onPan?: (pan: { x: number; y: number }) => void;
}

const TAU = Math.PI * 2;
const FONT = 'Archivo, system-ui, -apple-system, "Segoe UI", sans-serif';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function outCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function inOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function curvePt(A: [number, number, ...number[]], B: [number, number, ...number[]], t: number): [number, number] {
  const mx = (A[0] + B[0]) / 2;
  const my = (A[1] + B[1]) / 2;
  const qx = mx - (B[1] - A[1]) * 0.08;
  const qy = my + (B[0] - A[0]) * 0.08;
  return [
    (1 - t) * (1 - t) * A[0] + 2 * (1 - t) * t * qx + t * t * B[0],
    (1 - t) * (1 - t) * A[1] + 2 * (1 - t) * t * qy + t * t * B[1],
  ];
}

const KINDS: Record<NodeKind, { word: string; many: string; ord: number; base: number; R: number }> = {
  person: { word: "Subject", many: "subjects", ord: 0, base: 14, R: 0.05 },
  report: { word: "Report", many: "reports", ord: 1, base: 11, R: 0.4 },
  section: { word: "Section", many: "sections", ord: 2, base: 10, R: 0.82 },
  bio: { word: "Biomarker", many: "biomarkers", ord: 3, base: 9.5, R: 1.1 },
  meas: { word: "Value", many: "values", ord: 4, base: 5.2, R: 1.4 },
  unc: { word: "Uncertain", many: "uncertainties", ord: 5, base: 8.5, R: 0.62 },
};

export class GraphStageEngine {
  private cv: HTMLCanvasElement;
  private cx: CanvasRenderingContext2D;
  private stage: HTMLElement;
  private callbacks: EngineCallbacks;

  // Data
  public nodes: StageNode[] = [];
  public edges: StageEdge[] = [];
  public byId: Map<string, StageNode> = new Map();
  public adj: Map<string, string[]> = new Map();
  public ekey: Map<string, StageEdge> = new Map();
  public reports: StageReportInfo[] = [];
  public groups: string[] = [];
  public groupOrder: Map<string, number> = new Map();
  public delays: Map<string, number> = new Map();
  public maxDelay = 1000;

  // Layouts
  public layouts: Record<string, [number, number, number][]> = {};
  public camDefaults: Record<string, { rx: number; ry?: number; spin: boolean }> = {
    sphere: { rx: 0.4, spin: true },
    orbits: { rx: 0.62, spin: true },
    timeline: { rx: 0.1, ry: -0.1, spin: false },
    columns: { rx: 0.05, ry: 0, spin: false },
  };

  // State
  public rx = 0.4;
  public ry = 0.7;
  public zoom = 1;
  public zoomT = 1;
  public spin = true;
  public drag = false;
  public moved = false;
  public userRot = false;
  public lx = 0;
  public ly = 0;
  public hover: string | null = null;
  public t0 = 0;
  public introT0 = -1e9;
  public selId: string | null = null;
  public selT0 = -1e9;
  public h1: Set<string> = new Set();
  public h2: Set<string> = new Set();
  public off: [number, number, number] = [0, 0, 0];
  public oxs = 0;
  public oys = 0;
  // Pan state (P5)
  public panX = 0;
  public panY = 0;
  public panTX = 0;
  public panTY = 0;
  private dragMode: "none" | "rotate" | "pan" = "none";
  private dragButton = -1;
  public spaceDown = false;
  private activePointers: Map<number, { x: number; y: number }> = new Map();
  private touchStartDist = 0;
  private touchStartZoom = 1;
  public layout = "sphere";
  public mt0 = -1e9;
  public hist: number | null = null;
  public histI = -1;
  public histPlay = false;
  public histStart = 0;
  public path: { ids: string[]; t0: number } | null = null;
  public evid: string[] | null = null;
  public focusIds: Set<string> | null = null;

  public kindOn: Record<NodeKind, number> = { person: 1, report: 1, section: 1, bio: 1, meas: 1, unc: 1 };
  public kindWant: Record<NodeKind, number> = { person: 1, report: 1, section: 1, bio: 1, meas: 1, unc: 1 };
  public ink = true;
  public W = 0;
  public H = 0;
  public dpr = 1;
  public last = 0;
  public mouse = { x: 0, y: 0, in: false };
  public hits: { id: string; x: number; y: number; r: number; z: number }[] = [];
  public reduceMotion = false;

  public options: StageOptions = {
    size: true,
    breath: true,
    drop: true,
    hover: true,
    fly: true,
    clu: true,
    flow: true,
    lens: false,
    heat: false,
    ghost: true,
  };

  private rafId: number | null = null;
  private fpsFrames = 0;
  private fpsLastTime = performance.now();
  private currentFps = 60;
  // Width of a label in the current canvas font. Measuring text is the most expensive call in the label pass
  // (it ran for every label on every frame), and the same label in the same font always has the same width.
  private textWidths = new Map<string, number>();
  private lastInfoAt = 0;
  private lastInfo = { nodes: -1, links: -1, fps: -1 };
  private destroyed = false;

  // DPR & Proj
  private F = 3.4;
  private FLOOR = 1.32;
  private PR = { cy: 1, sy: 0, c: 1, s: 0, S: 1, ox: 0, oy: 0 };

  constructor(cv: HTMLCanvasElement, stage: HTMLElement, callbacks: EngineCallbacks) {
    this.cv = cv;
    const ctx = cv.getContext("2d");
    if (!ctx) throw new Error("2D canvas not supported");
    this.cx = ctx;
    this.stage = stage;
    this.callbacks = callbacks;

    this.bindEvents();
  }

  public setData(
    nodes: StageNode[],
    edges: StageEdge[],
    reports: StageReportInfo[],
    reduceMotion: boolean,
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.reports = reports;
    this.reduceMotion = reduceMotion;
    this.byId.clear();
    this.adj.clear();
    this.ekey.clear();
    this.delays.clear();

    nodes.forEach((n) => {
      this.byId.set(n.id, n);
      this.adj.set(n.id, []);
    });

    edges.forEach((e) => {
      const la = this.adj.get(e.a);
      if (la) la.push(e.b);
      const lb = this.adj.get(e.b);
      if (lb) lb.push(e.a);
      this.ekey.set(e.a + "|" + e.b, e);
      this.ekey.set(e.b + "|" + e.a, e);
    });

    // Groups
    const groupSet = new Set<string>();
    nodes.forEach((n) => {
      if (n.group) groupSet.add(n.group);
    });
    this.groups = Array.from(groupSet);
    this.groupOrder.clear();
    this.groups.forEach((g, i) => this.groupOrder.set(g, i));

    // Delays from person outward
    const person = nodes.find((n) => n.k === "person") || nodes[0];
    const pid = person ? person.id : "";
    let maxD = 0;

    if (pid) {
      const dist: Record<string, number> = { [pid]: 0 };
      const q = [pid];
      while (q.length > 0) {
        const u = q.shift()!;
        const d = dist[u];
        const nbs = this.adj.get(u) || [];
        for (const v of nbs) {
          if (dist[v] === undefined) {
            dist[v] = d + 1;
            q.push(v);
          }
        }
      }
      nodes.forEach((n) => {
        const step = dist[n.id] ?? 3;
        const d = step * 180 + (n.idx % 5) * 35;
        this.delays.set(n.id, d);
        if (d > maxD) maxD = d;
      });
    } else {
      nodes.forEach((n, i) => {
        const d = i * 15;
        this.delays.set(n.id, d);
        if (d > maxD) maxD = d;
      });
    }
    this.maxDelay = Math.max(1, maxD);

    // Compute layouts
    this.computeLayouts();

    nodes.forEach((n) => {
      const initP = this.layouts.sphere[n.idx] || [0, 0, 0];
      n.from = [...initP];
      n.to = [...initP];
      n.md = 0;
    });

    this.startLoop();
  }

  public appendData(newNodes: StageNode[], newEdges: StageEdge[]) {
    const nodesToAdd = newNodes.filter((n) => !this.byId.has(n.id));
    const edgesToAdd = newEdges.filter((e) => !this.ekey.has(e.a + "|" + e.b));

    if (nodesToAdd.length === 0 && edgesToAdd.length === 0) return;

    const now = performance.now();
    const startIndex = this.nodes.length;

    // 1. Prepare new nodes
    nodesToAdd.forEach((n, idx) => {
      n.idx = startIndex + idx;
      // Find position of linked existing node if any
      let parentPos: [number, number, number] | null = null;
      for (const e of edgesToAdd) {
        if (e.a === n.id && this.byId.has(e.b)) {
          parentPos = this.worldPos(this.byId.get(e.b)!, now);
          break;
        }
        if (e.b === n.id && this.byId.has(e.a)) {
          parentPos = this.worldPos(this.byId.get(e.a)!, now);
          break;
        }
      }
      if (!parentPos && this.nodes.length > 0) {
        const pNode = this.nodes.find((item) => item.k === "person") || this.nodes[0];
        parentPos = pNode ? this.worldPos(pNode, now) : [0, 0, 0];
      }
      const startP = parentPos ? [...parentPos] : [0, 0, 0];
      n.from = [startP[0], startP[1], startP[2]];
      n.to = [startP[0], startP[1], startP[2]];
      n.md = 0;

      // Appear delay: relative to this.t0 so appearance ripple begins at `now`
      const d = this.reduceMotion ? 0 : Math.max(0, now - this.t0);
      this.delays.set(n.id, d);

      this.nodes.push(n);
      this.byId.set(n.id, n);
      this.adj.set(n.id, []);

      if (n.group && !this.groupOrder.has(n.group)) {
        this.groups.push(n.group);
        this.groupOrder.set(n.group, this.groups.length - 1);
      }
    });

    // 2. Prepare new edges
    edgesToAdd.forEach((e) => {
      this.edges.push(e);
      const la = this.adj.get(e.a);
      if (la && !la.includes(e.b)) la.push(e.b);
      const lb = this.adj.get(e.b);
      if (lb && !lb.includes(e.a)) lb.push(e.a);
      this.ekey.set(e.a + "|" + e.b, e);
      this.ekey.set(e.b + "|" + e.a, e);
    });

    // 3. Update selection rings if a node is selected
    if (this.selId) {
      this.h1.clear();
      this.h2.clear();
      const neighbors = this.adj.get(this.selId) || [];
      neighbors.forEach((nid) => this.h1.add(nid));
      this.h1.forEach((a) => {
        const secondHop = this.adj.get(a) || [];
        secondHop.forEach((b) => {
          if (b !== this.selId && !this.h1.has(b)) this.h2.add(b);
        });
      });
    }

    // 4. Compute layouts incrementally (sphere keeps reference positions and nudges gently)
    this.computeLayouts(true);

    // 5. Morph existing and new nodes to updated layout targets
    const newIds = new Set(nodesToAdd.map((n) => n.id));
    this.nodes.forEach((n) => {
      n.from = this.worldPos(n, now);
      const targetLayout = this.layouts[this.layout] || this.layouts.sphere;
      n.to = [...(targetLayout[n.idx] || [0, 0, 0])];
      const isNew = newIds.has(n.id);
      n.md = isNew ? (this.reduceMotion ? 0 : 40) : 0;
      if (this.reduceMotion) {
        n.from = [...n.to];
      }
    });
    this.mt0 = now;
  }

  private computeLayouts(incremental = false) {
    const N = this.nodes.length;
    if (N === 0) return;

    // 1. Sphere
    let seed = 11;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    let P: { x: number; y: number; z: number; vx: number; vy: number; vz: number }[];
    const prevSphere = this.layouts.sphere || [];

    if (incremental && prevSphere.length > 0) {
      P = this.nodes.map((n) => {
        if (n.idx < prevSphere.length && prevSphere[n.idx]) {
          const old = prevSphere[n.idx];
          return {
            x: old[0],
            y: old[1] / 0.82,
            z: old[2],
            vx: 0,
            vy: 0,
            vz: 0,
          };
        }
        const nbs = this.adj.get(n.id) || [];
        const oldNb = nbs.map((id) => this.byId.get(id)).find((nb) => nb && nb.idx < prevSphere.length);
        if (oldNb && prevSphere[oldNb.idx]) {
          const p = prevSphere[oldNb.idx];
          const a = rnd() * TAU;
          const u = rnd() * 2 - 1;
          return {
            x: p[0] + 0.08 * Math.cos(a),
            y: p[1] / 0.82 + 0.08 * u,
            z: p[2] + 0.08 * Math.sin(a),
            vx: 0,
            vy: 0,
            vz: 0,
          };
        }
        const u = rnd() * 2 - 1;
        const a = rnd() * TAU;
        const q = Math.sqrt(Math.max(0, 1 - u * u));
        const r = KINDS[n.k]?.R || 0.05;
        return {
          x: q * Math.cos(a) * r,
          y: u * r,
          z: q * Math.sin(a) * r,
          vx: 0,
          vy: 0,
          vz: 0,
        };
      });
    } else {
      P = this.nodes.map((n) => {
        const u = rnd() * 2 - 1;
        const a = rnd() * TAU;
        const q = Math.sqrt(Math.max(0, 1 - u * u));
        const r = KINDS[n.k]?.R || 0.05;
        return {
          x: q * Math.cos(a) * r,
          y: u * r,
          z: q * Math.sin(a) * r,
          vx: 0,
          vy: 0,
          vz: 0,
        };
      });
    }

    const iters = incremental ? 80 : Math.min(450, 300 + N * 2);
    for (let it = 0; it < iters; it++) {
      const cool = 1 - it / iters;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = P[i];
          const b = P[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dz = a.z - b.z;
          const d2 = dx * dx + dy * dy + dz * dz + 0.01;
          const d = Math.sqrt(d2);
          const f = 0.16 / d2;
          a.vx += (dx / d) * f;
          a.vy += (dy / d) * f;
          a.vz += (dz / d) * f;
          b.vx -= (dx / d) * f;
          b.vy -= (dy / d) * f;
          b.vz -= (dz / d) * f;
        }
      }
      this.edges.forEach((e) => {
        const na = this.byId.get(e.a);
        const nb = this.byId.get(e.b);
        if (!na || !nb) return;
        const A = P[na.idx];
        const B = P[nb.idx];
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const dz = B.z - A.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;
        const f = (d - 0.7) * 0.05;
        A.vx += (dx / d) * f;
        A.vy += (dy / d) * f;
        A.vz += (dz / d) * f;
        B.vx -= (dx / d) * f;
        B.vy -= (dy / d) * f;
        B.vz -= (dz / d) * f;
      });
      for (let k = 0; k < N; k++) {
        const p = P[k];
        const R = KINDS[this.nodes[k].k]?.R || 0.1;
        const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) + 0.001;
        const g = (R - r) * 0.04;
        p.vx += (p.x / r) * g;
        p.vy += (p.y / r) * g;
        p.vz += (p.z / r) * g;
        p.x += p.vx * cool * 0.55;
        p.y += p.vy * cool * 0.55;
        p.z += p.vz * cool * 0.55;
        p.vx *= 0.78;
        p.vy *= 0.78;
        p.vz *= 0.78;
      }
    }
    let mr = 0.001;
    P.forEach((p) => {
      mr = Math.max(mr, Math.hypot(p.x, p.y, p.z));
    });
    const sc = 1.18 / mr;
    this.layouts.sphere = P.map((p) => [p.x * sc, p.y * sc * 0.82, p.z * sc]);

    // 2. Orbits
    const RR: Record<NodeKind, number> = { person: 0, report: 0.4, unc: 0.62, section: 0.82, bio: 1.1, meas: 1.4 };
    const YR: Record<NodeKind, number> = { person: 0, report: -0.02, unc: 0, section: 0.02, bio: 0.04, meas: 0.06 };
    const groupCount = Math.max(1, this.groups.length);
    const repCount = Math.max(1, this.reports.length);

    this.layouts.orbits = this.nodes.map((n) => {
      const gi = this.groupOrder.get(n.group) ?? 0;
      const ga = (gi / groupCount) * TAU + 0.3;
      let a = 0;
      if (n.k === "report") {
        a = (n.ri / repCount) * TAU + 0.9;
      } else if (n.k === "section") {
        a = ga;
      } else if (n.k === "bio") {
        a = ga + (n.k2 - 1) * 0.28;
      } else if (n.k === "meas") {
        const b = n.bioId ? this.byId.get(n.bioId) : null;
        const bK2 = b ? b.k2 : 0;
        a = ga + (bK2 - 1) * 0.28 + (n.ri - 1) * 0.085;
      } else if (n.k === "unc") {
        a = ga + 0.4;
      }
      const R = RR[n.k] || 0.5;
      return [R * Math.cos(a), YR[n.k] || 0, R * Math.sin(a)];
    });

    // 3. Timeline
    const bioNodes = this.nodes.filter((n) => n.k === "bio");
    bioNodes.sort((a, b) => {
      const ga = this.groupOrder.get(a.group) ?? 0;
      const gb = this.groupOrder.get(b.group) ?? 0;
      return ga - gb || a.label.localeCompare(b.label);
    });
    const bioRow = new Map<string, number>();
    bioNodes.forEach((n, i) => bioRow.set(n.id, i));
    const NB = Math.max(1, bioNodes.length);
    const rowY = (i: number) => (NB <= 1 ? 0 : -0.9 + (1.72 * i) / (NB - 1));
    const colSpacing = repCount > 1 ? Math.min(0.5, 1.6 / (repCount - 1)) : 0.5;
    const TX = (ri: number) => -0.12 + ri * colSpacing;
    const laneSpacing = groupCount > 1 ? Math.min(0.12, 0.6 / groupCount) : 0.12;
    const laneOf = (g: string) => ((this.groupOrder.get(g) ?? 0) - (groupCount - 1) / 2) * laneSpacing;

    this.layouts.timeline = this.nodes.map((n) => {
      const lane = laneOf(n.group);
      if (n.k === "person") return [-1.38, 1.06, 0];
      if (n.k === "report") return [TX(n.ri), 1.06, 0];
      if (n.k === "section") {
        const siblingBios = bioNodes.filter((b) => b.group === n.group);
        const avgY =
          siblingBios.length > 0
            ? siblingBios.reduce((acc, b) => acc + rowY(bioRow.get(b.id) ?? 0), 0) / siblingBios.length
            : 0;
        return [-1.38, avgY, lane];
      }
      if (n.k === "bio") return [-0.72, rowY(bioRow.get(n.id) ?? 0), lane];
      if (n.k === "meas") {
        const pBioId = n.bioId || "";
        const bRow = bioRow.has(pBioId) ? bioRow.get(pBioId)! : 0;
        return [TX(n.ri), rowY(bRow), lane];
      }
      return [TX(n.ri) + 0.24, 0.93, lane];
    });

    // 4. Columns
    const colX: Record<string, number> = { person: -1.45, report: -0.88, section: -0.3, bio: 0.3, meas: 0.95 };
    const outCols: [number, number, number][] = new Array(N);
    const colOf = (n: StageNode) => (n.k === "unc" ? "section" : n.k);

    ["person", "report", "section", "bio", "meas"].forEach((kd) => {
      const list = this.nodes
        .filter((n) => colOf(n) === kd)
        .sort((a, b) => {
          const ga = this.groupOrder.get(a.group) ?? 0;
          const gb = this.groupOrder.get(b.group) ?? 0;
          return ga - gb || (a.ri || 0) - (b.ri || 0) || a.label.localeCompare(b.label);
        });
      list.forEach((n, i) => {
        const y = list.length === 1 ? 0 : -0.85 + (1.7 * i) / (list.length - 1);
        outCols[n.idx] = [colX[kd] ?? 0, y, 0];
      });
    });
    this.layouts.columns = outCols;
  }

  public setLayout(name: string) {
    if (this.options.hideTimeline && name === "timeline") return;
    if (!this.layouts[name]) return;
    const now = performance.now();
    this.nodes.forEach((n) => {
      n.from = this.worldPos(n, now);
      n.to = [...this.layouts[name][n.idx]];
      const d = this.delays.get(n.id) ?? 0;
      n.md = (d / this.maxDelay) * 420;
    });
    this.layout = name;
    this.mt0 = now;
    this.userRot = false;

    const cam = this.camDefaults[name];
    if (cam) {
      this.spin = cam.spin;
    }
  }

  public select(id: string | null) {
    if (id === this.selId) return;
    this.selId = id;
    this.selT0 = performance.now();
    this.h1.clear();
    this.h2.clear();

    if (id) {
      const neighbors = this.adj.get(id) || [];
      neighbors.forEach((nid) => this.h1.add(nid));
      this.h1.forEach((a) => {
        const secondHop = this.adj.get(a) || [];
        secondHop.forEach((b) => {
          if (b !== id && !this.h1.has(b)) this.h2.add(b);
        });
      });
    }

    this.callbacks.onSelect(id);
  }

  public panBy(dx: number, dy: number, instant = false) {
    const maxPanX = (this.W || 800) * 0.6;
    const maxPanY = (this.H || 600) * 0.6;
    this.panTX = clamp(this.panTX + dx, -maxPanX, maxPanX);
    this.panTY = clamp(this.panTY + dy, -maxPanY, maxPanY);
    if (instant || this.reduceMotion) {
      this.panX = this.panTX;
      this.panY = this.panTY;
    }
    if (this.callbacks.onPan) {
      this.callbacks.onPan({ x: this.panTX, y: this.panTY });
    }
  }

  public resetPan(instant = false) {
    this.panTX = 0;
    this.panTY = 0;
    if (instant || this.reduceMotion) {
      this.panX = 0;
      this.panY = 0;
    }
    if (this.callbacks.onPan) {
      this.callbacks.onPan({ x: 0, y: 0 });
    }
  }

  public getPan(): { x: number; y: number } {
    return { x: this.panTX, y: this.panTY };
  }

  public setSpaceDown(down: boolean) {
    if (this.spaceDown === down) return;
    this.spaceDown = down;
    if (!this.drag) {
      this.cv.style.cursor = down
        ? "grab"
        : this.options.lens
        ? "crosshair"
        : this.hover
        ? "pointer"
        : "grab";
    }
  }

  public isNodeInView(nodeId: string, margin = 20): boolean {
    const n = this.byId.get(nodeId);
    if (!n) return true;
    const q = this.worldPos(n, performance.now());
    const p = this.proj(q);
    return p[0] >= margin && p[0] <= this.W - margin && p[1] >= margin && p[1] <= this.H - margin;
  }

  public replayIntro() {
    this.clearPath();
    this.evid = null;
    this.select(null);
    this.stopHist();
    this.resetPan();
    this.t0 = performance.now();
    this.introT0 = this.reduceMotion ? -1e9 : this.t0;
    this.hist = null;
    this.histI = -1;
  }

  public stopHist() {
    this.histPlay = false;
  }

  public startHist() {
    this.clearPath();
    this.evid = null;
    this.select(null);
    this.histPlay = true;
    this.histStart = performance.now();
    this.hist = 0;
    this.histI = -1;
  }

  public setHistRange(ratio: number) {
    this.stopHist();
    this.clearPath();
    this.select(null);
    this.hist = ratio;
  }

  public showAllHist() {
    this.stopHist();
    this.hist = null;
    this.t0 = performance.now() - 60000;
  }

  public showPath(fromId: string, toId: string): string[] | null {
    const ids = this.bfsPath(fromId, toId);
    if (!ids) return null;
    this.stopHist();
    this.hist = null;
    this.evid = null;
    this.select(null);
    if (!this.isNodeInView(fromId) || !this.isNodeInView(toId)) {
      this.resetPan();
    }
    this.path = { ids, t0: performance.now() };
    return ids;
  }

  public clearPath() {
    this.path = null;
  }

  public setEvidence(evidenceNodeIds: string[] | null) {
    this.evid = evidenceNodeIds;
    if (evidenceNodeIds) {
      this.path = null;
      this.select(null);
    }
  }

  public setFocusIds(ids: string[] | null) {
    this.focusIds = ids ? new Set(ids) : null;
  }

  public setKindVisibility(kind: NodeKind, visible: boolean) {
    this.kindWant[kind] = visible ? 1 : 0;
  }

  private bfsPath(a: string, b: string): string[] | null {
    const prev: Record<string, string | null> = { [a]: null };
    const q: string[] = [a];
    while (q.length > 0) {
      const v = q.shift()!;
      if (v === b) break;
      const nbs = this.adj.get(v) || [];
      for (const w of nbs) {
        if (!(w in prev)) {
          prev[w] = v;
          q.push(w);
        }
      }
    }
    if (!(b in prev)) return null;
    const out: string[] = [];
    let c: string | null = b;
    while (c !== null) {
      out.push(c);
      c = prev[c];
    }
    return out.reverse();
  }

  private worldPos(n: StageNode, now: number): [number, number, number] {
    const t = this.reduceMotion ? 1 : clamp((now - this.mt0 - n.md) / 1150, 0, 1);
    const e = inOutCubic(t);
    return [
      lerp(n.from[0], n.to[0], e),
      lerp(n.from[1], n.to[1], e),
      lerp(n.from[2], n.to[2], e),
    ];
  }

  private near(z: number): number {
    return clamp(1 - (z + 1.2) / 2.4, 0, 1);
  }

  private proj(q: [number, number, number]): [number, number, number, number, number] {
    const x = q[0] - this.off[0];
    const y = q[1] - this.off[1];
    const z = q[2] - this.off[2];
    const x1 = x * this.PR.cy + z * this.PR.sy;
    const z1 = -x * this.PR.sy + z * this.PR.cy;
    const y2 = y * this.PR.c - z1 * this.PR.s;
    const z2 = y * this.PR.s + z1 * this.PR.c;
    const k = this.F / (this.F + z2);
    return [this.PR.ox + x1 * this.PR.S * k, this.PR.oy + y2 * this.PR.S * k, z2, k, 1];
  }

  private vis(n: StageNode, now: number): number {
    let v: number;
    if (this.hist !== null) {
      v = clamp((this.hist - n.t) * 3 + 1, 0, 1);
    } else {
      const d = this.delays.get(n.id) ?? 0;
      const t = (now - this.t0 - (this.reduceMotion ? d * 0.04 : d)) / (this.reduceMotion ? 120 : 420);
      v = t <= 0 ? 0 : t >= 1 ? 1 : outCubic(t);
    }
    return v * (this.kindOn[n.k] ?? 1);
  }

  private lensMap(p: [number, number, number, number, number], mx: number, my: number, R: number) {
    const dx = p[0] - mx;
    const dy = p[1] - my;
    const d = Math.hypot(dx, dy);
    if (d >= R || d < 0.001) return;
    const x = d / R;
    const k = 2.4;
    const f = ((1 + k) * x) / (1 + k * x);
    p[0] = mx + (dx / d) * f * R;
    p[1] = my + (dy / d) * f * R;
    p[4] = 1 + 0.75 * (1 - x);
  }

  private hitTest(x: number, y: number): string | null {
    let best: { id: string; x: number; y: number; r: number; z: number } | null = null;
    let bd = 1e9;
    for (const h of this.hits) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < h.r + 7 && (d < bd || (best && h.z < best.z && d < bd + 6))) {
        bd = d;
        best = h;
      }
    }
    return best ? best.id : null;
  }

  private resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (this.cv.width !== Math.round(w * dpr) || this.cv.height !== Math.round(h * dpr)) {
      this.cv.width = Math.round(w * dpr);
      this.cv.height = Math.round(h * dpr);
    }
    this.W = w;
    this.H = h;
    this.dpr = dpr;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.activePointers.size === 1) {
        this.dragMode = "rotate";
        this.drag = true;
        this.moved = false;
        this.dragButton = 0;
        this.lx = e.clientX;
        this.ly = e.clientY;
      } else if (this.activePointers.size === 2) {
        this.dragMode = "pan";
        this.drag = true;
        this.moved = true;
        const pts = Array.from(this.activePointers.values());
        this.lx = (pts[0].x + pts[1].x) / 2;
        this.ly = (pts[0].y + pts[1].y) / 2;
        this.touchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        this.touchStartZoom = this.zoomT;
      }
    } else {
      if (e.button === 1 || e.button === 2) {
        this.dragMode = "pan";
        this.drag = true;
        this.moved = false;
        this.dragButton = e.button;
        this.lx = e.clientX;
        this.ly = e.clientY;
        this.cv.style.cursor = "grabbing";
      } else if (e.button === 0) {
        if (this.spaceDown) {
          this.dragMode = "pan";
          this.drag = true;
          this.moved = false;
          this.dragButton = 0;
          this.lx = e.clientX;
          this.ly = e.clientY;
          this.cv.style.cursor = "grabbing";
        } else {
          this.dragMode = "rotate";
          this.drag = true;
          this.moved = false;
          this.dragButton = 0;
          this.lx = e.clientX;
          this.ly = e.clientY;
        }
      }
    }

    try {
      this.cv.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const r = this.cv.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left;
    this.mouse.y = e.clientY - r.top;
    this.mouse.in = true;

    if (e.pointerType === "touch") {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        const mx = (pts[0].x + pts[1].x) / 2;
        const my = (pts[0].y + pts[1].y) / 2;
        const dx = mx - this.lx;
        const dy = my - this.ly;
        this.panBy(dx, dy, true);
        this.lx = mx;
        this.ly = my;
        this.moved = true;
        const currDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        if (this.touchStartDist > 10) {
          const scale = currDist / this.touchStartDist;
          this.zoomT = clamp(this.touchStartZoom * scale, 0.55, 2.2);
        }
        return;
      }
    }

    if (this.drag) {
      const dx = e.clientX - this.lx;
      const dy = e.clientY - this.ly;
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        this.moved = true;
      }
      if (this.dragMode === "rotate") {
        this.userRot = true;
        this.ry += dx * 0.008;
        this.rx = clamp(this.rx + dy * 0.006, -1.3, 1.3);
        this.cv.style.cursor = "grabbing";
      } else if (this.dragMode === "pan") {
        this.panBy(dx, dy, true);
        this.cv.style.cursor = "grabbing";
      }
      this.lx = e.clientX;
      this.ly = e.clientY;
    } else {
      this.hover = this.hitTest(this.mouse.x, this.mouse.y);
      this.callbacks.onHover(this.hover, this.hover ? { x: this.mouse.x, y: this.mouse.y } : null);
      if (this.spaceDown) {
        this.cv.style.cursor = "grab";
      } else if (this.options.lens) {
        this.cv.style.cursor = "crosshair";
      } else if (this.hover) {
        this.cv.style.cursor = "pointer";
      } else {
        this.cv.style.cursor = "grab";
      }
    }
  };

  private onPointerLeave = () => {
    this.hover = null;
    this.mouse.in = false;
    this.callbacks.onHover(null);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size === 1) {
        const rem = Array.from(this.activePointers.values())[0];
        this.lx = rem.x;
        this.ly = rem.y;
        this.dragMode = "rotate";
        return;
      }
    }

    if (this.drag && !this.moved && this.dragMode === "rotate" && this.dragButton === 0) {
      const r = this.cv.getBoundingClientRect();
      const id = this.hitTest(e.clientX - r.left, e.clientY - r.top);
      if (e.shiftKey && id && this.selId && id !== this.selId) {
        this.showPath(this.selId, id);
      } else {
        this.clearPath();
        this.evid = null;
        this.select(id);
      }
    }

    this.drag = false;
    this.dragMode = "none";
    this.dragButton = -1;

    if (this.spaceDown) {
      this.cv.style.cursor = "grab";
    } else if (this.options.lens) {
      this.cv.style.cursor = "crosshair";
    } else if (this.hover) {
      this.cv.style.cursor = "pointer";
    } else {
      this.cv.style.cursor = "grab";
    }
  };

  private onPointerCancel = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      this.activePointers.delete(e.pointerId);
    }
    this.drag = false;
    this.dragMode = "none";
    this.dragButton = -1;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoomT = clamp(this.zoomT * (e.deltaY > 0 ? 0.93 : 1.07), 0.55, 2.2);
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onDblClick = (e: MouseEvent) => {
    const r = this.cv.getBoundingClientRect();
    const id = this.hitTest(e.clientX - r.left, e.clientY - r.top);
    if (!id) {
      this.resetPan();
    }
  };

  private bindEvents() {
    const cv = this.cv;
    cv.addEventListener("pointerdown", this.onPointerDown);
    cv.addEventListener("pointermove", this.onPointerMove);
    cv.addEventListener("pointerleave", this.onPointerLeave);
    cv.addEventListener("pointerup", this.onPointerUp);
    cv.addEventListener("pointercancel", this.onPointerCancel);
    cv.addEventListener("wheel", this.onWheel, { passive: false });
    cv.addEventListener("contextmenu", this.onContextMenu);
    cv.addEventListener("dblclick", this.onDblClick);
  }

  private startLoop() {
    if (this.rafId !== null) return;
    // Draw at most about 60 times a second: on a 120 or 144 Hz screen every extra frame costs the same work
    // for no visible gain (all motion is time-based, so skipping frames never changes the speed).
    const interval = 1000 / 60;
    let lastDraw = -1e9;
    const loop = (now: number) => {
      if (this.destroyed) return;
      const elapsed = now - lastDraw;
      if (elapsed >= interval - 1) {
        lastDraw = now - (elapsed < interval * 2 ? elapsed % interval : 0);
        this.renderFrame(now);
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private renderFrame(now: number) {
    this.resize();
    const W = this.W;
    const H = this.H;
    const cx = this.cx;
    const motion = !this.reduceMotion;

    // Theme colors
    const T = this.ink
      ? {
          fg: "rgb(243, 242, 242)",
          bg: "rgb(32, 30, 29)",
          mute: "rgb(155, 151, 151)",
          acc: "rgb(236, 48, 19)",
          sf: "rgb(42, 39, 38)",
        }
      : {
          fg: "rgb(32, 30, 29)",
          bg: "rgb(243, 242, 242)",
          mute: "rgb(96, 93, 93)",
          acc: "rgb(236, 48, 19)",
          sf: "rgb(234, 233, 233)",
        };

    cx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    cx.clearRect(0, 0, W, H);

    const dt = this.last ? Math.min(64, now - this.last) : 16.7;
    this.last = now;

    // FPS calculation
    this.fpsFrames++;
    if (now - this.fpsLastTime >= 1000) {
      this.currentFps = Math.round((this.fpsFrames * 1000) / (now - this.fpsLastTime));
      this.fpsFrames = 0;
      this.fpsLastTime = now;
    }

    // Camera physics
    const cam = this.camDefaults[this.layout] || { rx: 0.4, spin: true };
    if (!this.drag && motion) {
      if (this.spin && !this.selId && !this.path && !this.evid) {
        this.ry += (0.15 * dt) / 1000;
      }
      if (!cam.spin && !this.spin && !this.userRot && cam.ry !== undefined) {
        let d = cam.ry - this.ry;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.ry += d * 0.05;
      }
      if (!this.userRot && now - this.mt0 < 1800) {
        this.rx += (cam.rx - this.rx) * 0.06;
      }
    }

    const introE = motion ? outCubic(clamp((now - this.introT0) / 3800, 0, 1)) : 1;
    const wantFly = this.options.fly && this.selId && !this.path && !this.evid;
    const selNode = this.selId ? this.byId.get(this.selId) : null;
    const personNode = this.nodes.find((n) => n.k === "person") || this.nodes[0];

    const tgt = wantFly && selNode
      ? this.worldPos(selNode, now).map((v) => v * 0.62)
      : personNode
      ? this.worldPos(personNode, now).map((v) => v * (1 - introE))
      : [0, 0, 0];

    for (let i = 0; i < 3; i++) {
      this.off[i] += (tgt[i] - this.off[i]) * (motion ? 0.085 : 1);
    }

    const zt = this.zoomT * (wantFly ? 1.3 : 1) * (1 + 1.25 * (1 - introE));
    this.zoom += (zt - this.zoom) * (motion ? (introE < 1 ? 0.2 : 0.085) : 1);

    // Kind transitions
    (Object.keys(this.kindOn) as NodeKind[]).forEach((k) => {
      this.kindOn[k] += (this.kindWant[k] - this.kindOn[k]) * (motion ? 0.2 : 1);
      if (Math.abs(this.kindWant[k] - this.kindOn[k]) < 0.01) this.kindOn[k] = this.kindWant[k];
    });

    // Make room: slide left when docked card is open, slide right during intro
    const introAge = now - this.introT0;
    const introDur = this.maxDelay + 2600;
    let ish = introAge < 0 ? 0 : introAge < 500 ? introAge / 500 : introAge < introDur ? 1 : 1 - (introAge - introDur) / 900;
    ish = motion && W > 700 ? inOutCubic(clamp(ish, 0, 1)) * W * 0.15 : 0;

    const dockOpen = !!this.selId;
    const dossierWidth = 340;
    const wantX = ish + (dockOpen && W >= 600 ? -(dossierWidth + 24) / 2 : 0);
    const wantY = dockOpen && W < 600 ? -120 : 0;
    this.oxs += (wantX - this.oxs) * (motion ? 0.09 : 1);
    this.oys += (wantY - this.oys) * (motion ? 0.09 : 1);

    // Pan easing (P5)
    if (this.reduceMotion) {
      this.panX = this.panTX;
      this.panY = this.panTY;
    } else {
      this.panX += (this.panTX - this.panX) * 0.2;
      this.panY += (this.panTY - this.panY) * 0.2;
      if (Math.abs(this.panTX - this.panX) < 0.05) this.panX = this.panTX;
      if (Math.abs(this.panTY - this.panY) < 0.05) this.panY = this.panTY;
    }

    this.PR = {
      cy: Math.cos(this.ry),
      sy: Math.sin(this.ry),
      c: Math.cos(this.rx),
      s: Math.sin(this.rx),
      S: Math.min(W, H) * 0.34 * this.zoom,
      ox: W / 2 + this.oxs + this.panX,
      oy: H / 2 + (W < 560 ? -30 : 0) + this.oys + this.panY,
    };

    // Time machine progression
    const repCount = Math.max(1, this.reports.length);
    if (this.histPlay) {
      this.hist = clamp(((now - this.histStart) / 7500) * (repCount - 1), 0, repCount - 1);
      if (this.hist >= repCount - 1) this.stopHist();
    }

    // World positions and projections
    const P: Record<string, [number, number, number, number, number]> = {};
    const V: Record<string, number> = {};
    const WP: Record<string, [number, number, number]> = {};

    this.nodes.forEach((n) => {
      const q = this.worldPos(n, now);
      if (this.options.breath && motion) {
        const s = now / 1000;
        const a = n.idx * 1.7;
        q[0] += 0.014 * Math.sin(s * 0.9 + a);
        q[1] += 0.014 * Math.sin(s * 1.1 + a * 1.3);
        q[2] += 0.014 * Math.sin(s * 0.8 + a * 0.7);
      }
      WP[n.id] = q;
      P[n.id] = this.proj(q);
      V[n.id] = this.vis(n, now);
    });

    const lensOn = this.options.lens && this.mouse.in && !this.drag;
    const LR = Math.min(150, Math.min(W, H) * 0.22);
    if (lensOn) {
      this.nodes.forEach((n) => this.lensMap(P[n.id], this.mouse.x, this.mouse.y, LR));
    }

    // Emphasis
    const sel = this.selId;
    const selOn = !!sel && !this.path && !this.evid;
    const pathIds: Record<string, number> = {};
    let pathStep = 0;
    if (this.path) {
      pathStep = clamp(Math.floor((now - this.path.t0) / 480), 0, this.path.ids.length);
      this.path.ids.forEach((id, i) => (pathIds[id] = i));
    }
    const evidSet: Record<string, number> = {};
    const evidOn = !!this.evid;
    if (evidOn && this.evid) {
      this.evid.forEach((id, i) => (evidSet[id] = i + 1));
    }
    const hov = this.options.hover && this.hover && !selOn && !this.path && !evidOn ? this.hover : null;
    const focusDim = (id: string) => this.focusIds !== null && !this.focusIds.has(id);
    const dimmed = (id: string) =>
      focusDim(id) ||
      (selOn && id !== sel && !this.h1.has(id) && !this.h2.has(id)) ||
      (this.path && pathIds[id] === undefined) ||
      (evidOn && !evidSet[id]);

    // 1. Floor grid
    cx.strokeStyle = T.fg;
    cx.lineWidth = 1;
    for (let gI = -4; gI <= 4; gI++) {
      const t = gI * 0.4;
      [
        [
          [t, this.FLOOR, -1.6],
          [t, this.FLOOR, 1.6],
        ],
        [
          [-1.6, this.FLOOR, t],
          [1.6, this.FLOOR, t],
        ],
      ].forEach((sg) => {
        const A = this.proj(sg[0] as [number, number, number]);
        const B = this.proj(sg[1] as [number, number, number]);
        cx.globalAlpha = (this.ink ? 0.05 : 0.06) + 0.12 * this.near((A[2] + B[2]) / 2);
        cx.beginPath();
        cx.moveTo(A[0], A[1]);
        cx.lineTo(B[0], B[1]);
        cx.stroke();
      });
    }

    // 2. Guides for layouts
    const late: { txt: string; x: number; y: number; align: "center" | "left"; alpha: number; color: string }[] = [];
    const guide = this.reduceMotion ? 1 : clamp((now - this.mt0 - 500) / 900, 0, 1);
    cx.font = "800 10px " + FONT;
    cx.fillStyle = T.fg;

    if (this.layout === "orbits") {
      [
        ["report", 0.4, -0.02],
        ["unc", 0.62, 0],
        ["section", 0.82, 0.02],
        ["bio", 1.1, 0.04],
        ["meas", 1.4, 0.06],
      ].forEach((r) => {
        cx.globalAlpha = 0.16 * guide;
        cx.strokeStyle = T.fg;
        cx.beginPath();
        for (let i = 0; i <= 72; i++) {
          const a = (i / 72) * TAU;
          const p = this.proj([(r[1] as number) * Math.cos(a), r[2] as number, (r[1] as number) * Math.sin(a)]);
          if (i === 0) cx.moveTo(p[0], p[1]);
          else cx.lineTo(p[0], p[1]);
        }
        cx.stroke();
        const lp = this.proj([r[1] as number, r[2] as number, 0]);
        late.push({
          txt: KINDS[r[0] as NodeKind]?.many.toUpperCase() || "",
          x: lp[0] + 6,
          y: lp[1] - 4,
          align: "left",
          alpha: 0.5 * guide,
          color: T.fg,
        });
      });
    } else if (this.layout === "timeline") {
      const bioNodes = this.nodes.filter((n) => n.k === "bio");
      const NB = Math.max(1, bioNodes.length);
      const rowY = (i: number) => (NB <= 1 ? 0 : -0.9 + (1.72 * i) / (NB - 1));
      const colSpacing = repCount > 1 ? Math.min(0.5, 1.6 / (repCount - 1)) : 0.5;
      const TX = (ri: number) => -0.12 + ri * colSpacing;
      const groupCount = Math.max(1, this.groups.length);
      const laneSpacing = groupCount > 1 ? Math.min(0.12, 0.6 / groupCount) : 0.12;
      const laneOf = (g: string) => ((this.groupOrder.get(g) ?? 0) - (groupCount - 1) / 2) * laneSpacing;

      bioNodes.forEach((n, i) => {
        const y = rowY(i);
        const z = laneOf(n.group);
        const a = this.proj([-0.66, y, z]);
        const b = this.proj([TX(repCount - 1) + 0.12, y, z]);
        cx.globalAlpha = 0.09 * guide * this.kindOn.bio;
        cx.strokeStyle = T.fg;
        cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(a[0], a[1]);
        cx.lineTo(b[0], b[1]);
        cx.stroke();
      });

      // Headers thinned by measured text width (keep first and last, 8px gap; multiple reports on same date draw one header)
      interface HeaderCandidate {
        order: number;
        label: string;
        x3d: number;
      }

      // Group reports by unique date label to draw one header per date at group center
      const labelGroups = new Map<string, number[]>();
      const orderedLabels: string[] = [];
      this.reports.forEach((r) => {
        const lbl = (r.label || `R${r.order + 1}`).toUpperCase();
        if (!labelGroups.has(lbl)) {
          labelGroups.set(lbl, [r.order]);
          orderedLabels.push(lbl);
        } else {
          labelGroups.get(lbl)!.push(r.order);
        }
      });

      const uniqueCandidates: HeaderCandidate[] = orderedLabels.map((lbl) => {
        const ords = labelGroups.get(lbl)!;
        const centerOrder = (ords[0] + ords[ords.length - 1]) / 2;
        return {
          order: Math.round(centerOrder),
          label: lbl,
          x3d: TX(centerOrder),
        };
      });

      const keptHeaders: HeaderCandidate[] = [];
      if (uniqueCandidates.length === 1) {
        keptHeaders.push(uniqueCandidates[0]);
      } else if (uniqueCandidates.length >= 2) {
        cx.font = "800 11px " + FONT;
        const first = uniqueCandidates[0];
        const last = uniqueCandidates[uniqueCandidates.length - 1];
        keptHeaders.push(first);

        const pFirst = this.proj([first.x3d, -1.0, 0]);
        const wFirst = this.textWidth(cx, first.label);
        let lastDrawnRight = pFirst[0] + wFirst / 2;

        const pLast = this.proj([last.x3d, -1.0, 0]);
        const wLast = this.textWidth(cx, last.label);
        const lastLeft = pLast[0] - wLast / 2;

        for (let idx = 1; idx < uniqueCandidates.length - 1; idx++) {
          const cand = uniqueCandidates[idx];
          const p = this.proj([cand.x3d, -1.0, 0]);
          const w = this.textWidth(cx, cand.label);
          const candLeft = p[0] - w / 2;
          const candRight = p[0] + w / 2;

          if (candLeft >= lastDrawnRight + 8 && candRight + 8 <= lastLeft) {
            keptHeaders.push(cand);
            lastDrawnRight = candRight;
          }
        }

        keptHeaders.push(last);
      }

      // Draw vertical guide lines (B6: only for dates that get a header when reports > 12; below 12 keep all)
      const guideXPositions: number[] =
        this.reports.length > 12
          ? keptHeaders.map((h) => h.x3d)
          : this.reports.map((r) => TX(r.order));

      guideXPositions.forEach((x) => {
        const a = this.proj([x, -1.0, 0]);
        const b = this.proj([x, 0.98, 0]);
        cx.globalAlpha = 0.25 * guide;
        cx.strokeStyle = T.acc;
        cx.setLineDash([4, 4]);
        cx.beginPath();
        cx.moveTo(a[0], a[1]);
        cx.lineTo(b[0], b[1]);
        cx.stroke();
        cx.setLineDash([]);
      });

      cx.globalAlpha = 0.9 * guide;
      cx.fillStyle = T.acc;
      cx.textAlign = "center";
      keptHeaders.forEach((h) => {
        const a = this.proj([h.x3d, -1.0, 0]);
        cx.fillText(h.label, a[0], a[1] - 9);
      });
      cx.textAlign = "start";

      const a = this.proj([TX(0) - 0.16, -1.0, 0]);
      const b = this.proj([TX(repCount - 1) + 0.22, -1.0, 0]);
      cx.globalAlpha = 0.5 * guide;
      cx.strokeStyle = T.fg;
      cx.beginPath();
      cx.moveTo(a[0], a[1]);
      cx.lineTo(b[0], b[1]);
      cx.stroke();
      cx.fillStyle = T.fg;
      cx.fillText("TIME →", b[0] + 8, b[1] + 4);
    } else if (this.layout === "columns") {
      [
        [-1.45, "Subject"],
        [-0.88, "Reports"],
        [-0.3, "Sections"],
        [0.3, "Biomarkers"],
        [0.95, "Values"],
      ].forEach((c) => {
        const p = this.proj([c[0] as number, -1.02, 0]);
        cx.globalAlpha = 0.6 * guide;
        cx.textAlign = "center";
        cx.fillText((c[1] as string).toUpperCase(), p[0], p[1]);
        cx.textAlign = "start";
      });
    }

    // 3. Cluster outlines
    if (this.options.clu && (this.layout === "sphere" || this.layout === "orbits")) {
      cx.setLineDash([5, 5]);
      cx.lineWidth = 1.1;
      this.groups.forEach((g) => {
        const ms = this.nodes.filter((n) => n.group === g && V[n.id] > 0.5);
        if (ms.length < 3) return;
        let mx = 0;
        let my = 0;
        ms.forEach((n) => {
          mx += P[n.id][0];
          my += P[n.id][1];
        });
        mx /= ms.length;
        my /= ms.length;
        let rr = 0;
        ms.forEach((n) => {
          rr = Math.max(rr, Math.hypot(P[n.id][0] - mx, P[n.id][1] - my));
        });
        rr = rr * 0.9 + 14;
        const a = selOn || this.path || evidOn ? 0.05 : 0.2;
        cx.globalAlpha = a;
        cx.strokeStyle = T.fg;
        cx.beginPath();
        cx.arc(mx, my, rr, 0, TAU);
        cx.stroke();
        late.push({
          txt: g.toUpperCase(),
          x: mx,
          y: my - rr - 6,
          align: "center",
          alpha: a * 2.4,
          color: T.fg,
        });
      });
      cx.setLineDash([]);
    }

    // 4. Drop-lines
    if (this.options.drop) {
      cx.lineWidth = 1;
      this.nodes.forEach((n) => {
        if (V[n.id] <= 0.05) return;
        const q = WP[n.id];
        const f = this.proj([q[0], this.FLOOR, q[2]]);
        const p = P[n.id];
        const dim = dimmed(n.id);
        cx.globalAlpha = (dim ? 0.03 : 0.08 + 0.1 * this.near(p[2])) * V[n.id];
        cx.strokeStyle = T.fg;
        cx.beginPath();
        cx.moveTo(p[0], p[1]);
        cx.lineTo(f[0], f[1]);
        cx.stroke();
        cx.globalAlpha = (dim ? 0.05 : 0.3) * V[n.id];
        cx.fillStyle = T.fg;
        cx.fillRect(f[0] - 1.5, f[1] - 1.5, 3, 3);
      });
    }

    // 5. Edges, data flow and grow-in tip
    this.edges.forEach((e) => {
      const a = e.a;
      const b = e.b;
      const A = P[a];
      const B = P[b];
      const na = this.byId.get(a);
      const nb = this.byId.get(b);
      if (!A || !B || !na || !nb) return;
      const vv = Math.min(V[a], V[b]);

      if (vv <= 0.02) {
        if (this.hist !== null && this.options.ghost && (this.kindOn[na.k] ?? 1) > 0.5 && (this.kindOn[nb.k] ?? 1) > 0.5) {
          cx.globalAlpha = 0.06;
          cx.strokeStyle = T.fg;
          cx.lineWidth = 1;
          cx.setLineDash([2, 4]);
          cx.beginPath();
          cx.moveTo(A[0], A[1]);
          cx.lineTo(B[0], B[1]);
          cx.stroke();
          cx.setLineDash([]);
        }
        return;
      }

      const da = this.delays.get(a) ?? 0;
      const db = this.delays.get(b) ?? 0;
      let g: number;
      let grow: number;
      const fromA = da <= db;

      if (this.hist !== null) {
        g = 1;
        grow = 1;
      } else {
        const start = Math.max(da, db) - 200;
        g = this.reduceMotion
          ? now - this.t0 >= start * 0.04 ? 1 : 0
          : clamp((now - this.t0 - start) / 380, 0, 1);
        grow = 1 - Math.pow(1 - g, 2);
      }
      if (g <= 0) return;

      let alpha = (this.ink ? 0.2 : 0.14) + 0.4 * this.near((A[2] + B[2]) / 2);
      let hot = false;
      let width = 1;
      let direct = false;
      let emph = false;
      const mFlag = this.options.heat && ((na.k === "meas" && na.flag !== "in") || (nb.k === "meas" && nb.flag !== "in"));

      if (this.path) {
        const ia = pathIds[a];
        const ib = pathIds[b];
        if (ia !== undefined && ib !== undefined && Math.abs(ia - ib) === 1 && Math.max(ia, ib) < pathStep) {
          hot = emph = true;
          width = 3;
          alpha = 1;
          const pg = clamp((now - this.path.t0 - Math.max(ia, ib) * 480 + 480) / 400, 0, 1);
          grow = Math.min(grow, 1 - Math.pow(1 - pg, 3));
        } else {
          alpha = 0.04;
        }
      } else if (evidOn) {
        if (evidSet[a] && evidSet[b]) {
          hot = emph = true;
          width = 2.4;
          alpha = 1;
        } else {
          alpha = 0.05;
        }
      } else if (selOn) {
        if (a === sel || b === sel) {
          direct = emph = hot = true;
          width = 2.4;
          alpha = 1;
          grow = Math.min(
            grow,
            this.reduceMotion ? 1 : 1 - Math.pow(1 - clamp((now - this.selT0) / 520, 0, 1), 3)
          );
        } else if ((this.h1.has(a) && this.h2.has(b)) || (this.h1.has(b) && this.h2.has(a))) {
          hot = true;
          width = 1.4;
          alpha = 0.55;
          grow = Math.min(
            grow,
            this.reduceMotion ? 1 : 1 - Math.pow(1 - clamp((now - this.selT0 - 450) / 520, 0, 1), 3)
          );
        } else {
          alpha = 0.05;
        }
      } else if (hov && (a === hov || b === hov)) {
        hot = emph = true;
        width = 1.8;
        alpha = 0.9;
      } else if (mFlag) {
        hot = true;
        alpha = 0.75;
        width = 1.5;
      }

      if (focusDim(a) || focusDim(b)) {
        alpha *= 0.15;
      }

      if (grow <= 0) return;

      const t0 = fromA ? 0 : 1 - grow;
      const t1 = fromA ? grow : 1;
      const S0 = curvePt(A, B, t0);
      const E0 = curvePt(A, B, t1);
      const mx = (A[0] + B[0]) / 2;
      const my = (A[1] + B[1]) / 2;
      const qx = mx - (B[1] - A[1]) * 0.08;
      const qy = my + (B[0] - A[0]) * 0.08;
      const cw = (1 - t0) * t1 + t0 * (1 - t1);
      const kx = (1 - t0) * (1 - t1) * A[0] + cw * qx + t0 * t1 * B[0];
      const ky = (1 - t0) * (1 - t1) * A[1] + cw * qy + t0 * t1 * B[1];

      cx.globalAlpha = alpha * Math.min(1, g * 2) * vv;
      cx.strokeStyle = hot ? T.acc : T.fg;
      cx.lineWidth = width;
      cx.beginPath();
      cx.moveTo(S0[0], S0[1]);
      cx.quadraticCurveTo(kx, ky, E0[0], E0[1]);
      cx.stroke();

      if (grow < 1 && motion && this.hist === null) {
        const tp = fromA ? E0 : S0;
        cx.globalAlpha = 0.95;
        cx.fillStyle = T.acc;
        cx.beginPath();
        cx.arc(tp[0], tp[1], 3, 0, TAU);
        cx.fill();
      } else if (this.options.flow && motion && grow >= 1 && !((selOn || this.path || evidOn) && !emph)) {
        for (let k = 0; k < 2; k++) {
          const ph = ((now / 1000) * (emph ? 0.55 : 0.22) + e.h + k * 0.5) % 1;
          const sp = curvePt(A, B, e.dir ? ph : 1 - ph);
          cx.globalAlpha = (emph || hot ? 0.95 : 0.5 + 0.4 * this.near((A[2] + B[2]) / 2)) * vv;
          cx.fillStyle = emph || hot ? T.acc : T.fg;
          const r = emph ? 2.6 : 1.5;
          cx.fillRect(sp[0] - r, sp[1] - r, r * 2, r * 2);
        }
      } else if (direct && motion && grow >= 1) {
        const ph = ((now - this.selT0) / 1500 + e.h) % 1;
        const sp = curvePt(A, B, fromA ? ph : 1 - ph);
        cx.globalAlpha = 0.95;
        cx.fillStyle = T.acc;
        cx.beginPath();
        cx.arc(sp[0], sp[1], 2.6, 0, TAU);
        cx.fill();
      }
    });

    // 5b. Comet on found path
    if (this.path && motion && pathStep >= this.path.ids.length) {
      const ids = this.path.ids;
      const L = ids.length - 1;
      const u0 = ((now - this.path.t0 - L * 480) / 1000) * 1.2;
      for (let s = 0; s < 14; s++) {
        let u = (u0 - s * 0.045) % L;
        if (u < 0) u += L;
        const seg = Math.min(L - 1, Math.floor(u));
        const t = u - seg;
        const e = this.ekey.get(ids[seg] + "|" + ids[seg + 1]);
        if (e && P[e.a] && P[e.b]) {
          const p = curvePt(P[e.a], P[e.b], e.a === ids[seg] ? t : 1 - t);
          const r = 4.4 * (1 - s / 16);
          cx.globalAlpha = (1 - s / 14) * 0.95;
          cx.fillStyle = T.acc;
          cx.fillRect(p[0] - r / 2, p[1] - r / 2, r, r);
        }
      }
    }

    // 6. Nodes (far to near)
    const order = this.nodes.slice().sort((a, b) => (P[b.id]?.[2] ?? 0) - (P[a.id]?.[2] ?? 0));
    this.hits.length = 0;
    const labels: { n: StageNode; rad: number; alpha: number; inLens: number; k: number; hot: boolean }[] = [];

    order.forEach((n) => {
      const q = P[n.id];
      if (!q) return;
      const rv = V[n.id];
      const ghost = rv <= 0.01 && this.hist !== null && this.options.ghost && (this.kindOn[n.k] ?? 1) > 0.5;
      if (rv <= 0.01 && !ghost) return;

      const k = q[3] * (q[4] || 1);
      const isSel = sel === n.id;
      const isHov = this.hover === n.id;
      const base = (KINDS[n.k]?.base || 8) * (this.options.size ? 0.85 + 1.15 * Math.sqrt(n.imp) : 1);

      if (ghost) {
        cx.globalAlpha = 0.25;
        cx.strokeStyle = T.fg;
        cx.lineWidth = 1;
        cx.setLineDash([2, 3]);
        cx.beginPath();
        cx.arc(q[0], q[1], base * q[3], 0, TAU);
        cx.stroke();
        cx.setLineDash([]);
        return;
      }

      const l1 = selOn && (isSel || this.h1.has(n.id));
      const l2 = selOn && this.h2.has(n.id);
      const onPath = this.path && pathIds[n.id] !== undefined && pathIds[n.id] < pathStep;
      const ev = evidOn && evidSet[n.id];
      const dim = dimmed(n.id) && !onPath;
      const alpha = (dim ? 0.13 : selOn && l2 ? 0.8 : 0.6 + 0.4 * this.near(q[2])) * rv;
      const heatHot = this.options.heat && (n.k === "meas" || n.k === "bio") && n.flag !== "in";
      const hot = !!(l1 || onPath || ev || heatHot);
      const rad = base * k * (0.4 + 0.6 * rv);

      this.hits.push({ id: n.id, x: q[0], y: q[1], r: Math.max(rad, 8), z: q[2] });

      cx.globalAlpha = alpha;
      cx.lineWidth = 2.5;
      cx.fillStyle = hot ? T.acc : T.fg;
      cx.strokeStyle = hot ? T.acc : T.fg;
      cx.beginPath();

      if (n.k === "person") {
        cx.rect(q[0] - rad, q[1] - rad, rad * 2, rad * 2);
        cx.fill();
      } else if (n.k === "report") {
        cx.arc(q[0], q[1], rad, 0, TAU);
        cx.fillStyle = T.bg;
        cx.fill();
        cx.stroke();
      } else if (n.k === "section") {
        cx.moveTo(q[0], q[1] - rad);
        cx.lineTo(q[0] + rad, q[1]);
        cx.lineTo(q[0], q[1] + rad);
        cx.lineTo(q[0] - rad, q[1]);
        cx.closePath();
        cx.fillStyle = T.bg;
        cx.fill();
        cx.lineWidth = 2;
        cx.stroke();
      } else if (n.k === "bio") {
        cx.arc(q[0], q[1], rad, 0, TAU);
        cx.fill();
      } else if (n.k === "meas") {
        cx.arc(q[0], q[1], rad, 0, TAU);
        cx.fillStyle = hot ? T.acc : T.mute;
        cx.fill();
      } else {
        cx.setLineDash([3, 3]);
        cx.arc(q[0], q[1], rad, 0, TAU);
        cx.fillStyle = T.bg;
        cx.fill();
        cx.strokeStyle = T.acc;
        cx.stroke();
        cx.setLineDash([]);
      }

      if (this.options.heat && n.k === "bio" && n.flag !== "in") {
        cx.globalAlpha = 0.9 * rv;
        cx.strokeStyle = T.acc;
        cx.lineWidth = 1.5;
        cx.beginPath();
        cx.arc(q[0], q[1], rad + 5, 0, TAU);
        cx.stroke();
      }

      if (selOn && this.h1.has(n.id) && motion) {
        const rt = (now - this.selT0 - 520) / 900;
        if (rt >= 0 && rt < 1) {
          cx.globalAlpha = (1 - rt) * 0.8;
          cx.strokeStyle = T.acc;
          cx.lineWidth = 2;
          cx.beginPath();
          cx.arc(q[0], q[1], rad + 4 + rt * 24, 0, TAU);
          cx.stroke();
        }
      }

      if (this.hist !== null && motion) {
        const ht = (this.hist - n.t + 0.12) / 0.4;
        if (ht > 0 && ht < 1) {
          cx.globalAlpha = (1 - ht) * 0.8;
          cx.strokeStyle = T.acc;
          cx.lineWidth = 2;
          cx.beginPath();
          cx.arc(q[0], q[1], rad + 3 + ht * 22, 0, TAU);
          cx.stroke();
        }
      }

      if (isSel || (isHov && !this.options.lens)) {
        cx.globalAlpha = 1;
        cx.strokeStyle = isSel ? T.acc : T.fg;
        cx.lineWidth = 2;
        cx.beginPath();
        cx.arc(q[0], q[1], rad + 6, 0, TAU);
        cx.stroke();
      }

      if (ev) {
        const bx = q[0] + rad * 0.7;
        const by = q[1] - rad * 0.9 - 8;
        cx.globalAlpha = 1;
        cx.fillStyle = T.acc;
        cx.fillRect(bx - 9, by - 9, 18, 18);
        cx.fillStyle = T.bg;
        cx.font = "800 11px " + FONT;
        cx.textAlign = "center";
        cx.fillText(String(evidSet[n.id]), bx, by + 4);
        cx.textAlign = "start";
      }

      const inLens = lensOn && q[4] > 1;
      const inFocus = selOn
        ? l1 || isHov || (l2 && n.k !== "meas" && n.k !== "unc")
        : this.path
        ? onPath
        : evidOn
        ? ev
        : true;
      const can =
        (inFocus || inLens) &&
        rv > 0.6 &&
        (n.k !== "meas" && n.k !== "unc"
          ? true
          : isSel ||
            isHov ||
            (selOn && this.h1.has(n.id)) ||
            ev ||
            onPath ||
            inLens ||
            this.zoom > 1.9 ||
            (this.options.heat && n.flag !== "in") ||
            this.layout === "timeline");

      if (can) {
        labels.push({ n, rad, alpha: Math.max(alpha, inLens ? 1 : 0), inLens: inLens ? 1 : 0, k, hot });
      }
    });

    // 7. Labels with priority & greedy overlap pruning
    const ends = this.path ? [this.path.ids[0], this.path.ids[this.path.ids.length - 1]] : [];
    const pri = (L: { n: StageNode; inLens: number; hot: boolean }) =>
      L.n.id === sel || ends.indexOf(L.n.id) >= 0
        ? 0
        : L.inLens
        ? 1
        : L.hot
        ? 2 + (KINDS[L.n.k]?.ord || 0) * 0.1
        : 3 + (KINDS[L.n.k]?.ord || 0);

    // Priority and depth are computed once per label (the comparator used to recompute them on every comparison).
    const ranked = labels.map((L) => ({ L, p: pri(L), z: P[L.n.id]?.[2] ?? 0 }));
    ranked.sort((a, b) => a.p - b.p || a.z - b.z);
    for (let i = 0; i < ranked.length; i++) labels[i] = ranked[i].L;
    const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];

    labels.forEach((L) => {
      const n = L.n;
      const q = P[n.id];
      if (!q) return;
      // Half-pixel steps: invisible, but the canvas can reuse a parsed font instead of parsing a new one per label per frame.
      const fs = Math.round(Math.min(22, Math.max(10, 12.5 * L.k)) * 2) / 2;
      const weight = n.k === "report" || n.k === "person" ? "800 " : "600 ";
      const labelFont = weight + fs + "px " + FONT;
      if (cx.font !== labelFont) cx.font = labelFont;

      let txt = n.k === "meas" && (this.layout === "timeline" || L.inLens) ? String(n.val ?? n.label) : n.label;
      if (this.options.heat && n.k === "bio") {
        txt =
          n.name +
          " " +
          (n.latest ?? "") +
          (n.delta && n.delta > 0 ? " ↑" : n.delta && n.delta < 0 ? " ↓" : "") +
          (n.flag === "high" ? " ▲" : n.flag === "low" ? " ▼" : "");
      }
      if (txt.length > 30) txt = txt.slice(0, 29) + "…";

      const tw = this.labelWidth(cx, weight, txt, fs, labelFont);
      const tx = q[0] + L.rad + 7;
      const ty = q[1] + fs * 0.35;
      const bx = { x0: tx - 3, y0: ty - fs, x1: tx + tw + 3, y1: ty + 3 };

      if (n.id !== sel) {
        for (let i = 0; i < boxes.length; i++) {
          const o = boxes[i];
          if (!(bx.x1 < o.x0 || bx.x0 > o.x1 || bx.y1 < o.y0 || bx.y0 > o.y1)) return;
        }
      }
      boxes.push(bx);

      const hotL =
        (selOn && (this.h1.has(n.id) || n.id === sel)) ||
        (this.path && pathIds[n.id] !== undefined) ||
        (evidOn && evidSet[n.id]) ||
        (this.options.heat && n.flag && n.flag !== "in");

      cx.globalAlpha = Math.max(L.alpha, n.id === sel || n.id === this.hover ? 1 : 0);
      cx.lineWidth = 4;
      cx.strokeStyle = T.bg;
      cx.lineJoin = "round";
      cx.strokeText(txt, tx, ty);
      cx.fillStyle = hotL ? T.acc : T.fg;
      cx.fillText(txt, tx, ty);
    });

    // 7b. Guide words
    cx.font = "800 10px " + FONT;
    late.forEach((t) => {
      if (t.alpha < 0.02) return;
      const w = this.textWidth(cx, t.txt);
      const x0 = t.align === "center" ? t.x - w / 2 : t.x;
      const bx = { x0: x0 - 2, y0: t.y - 10, x1: x0 + w + 2, y1: t.y + 3 };
      for (let i = 0; i < boxes.length; i++) {
        const o = boxes[i];
        if (!(bx.x1 < o.x0 || bx.x0 > o.x1 || bx.y1 < o.y0 || bx.y0 > o.y1)) return;
      }
      boxes.push(bx);
      cx.globalAlpha = t.alpha;
      cx.fillStyle = t.color;
      cx.textAlign = t.align === "center" ? "center" : "start";
      cx.fillText(t.txt, t.x, t.y);
      cx.textAlign = "start";
    });

    // 7c. Edge labels for selected node (and second ring fainter)
    if (selOn && sel) {
      cx.font = "600 10px " + FONT;
      this.edges.forEach((e) => {
        if (!e.label) return;
        const A = P[e.a];
        const B = P[e.b];
        if (!A || !B) return;
        const isDirect = e.a === sel || e.b === sel;
        const isRing2 = (this.h1.has(e.a) && this.h2.has(e.b)) || (this.h1.has(e.b) && this.h2.has(e.a));
        if (!isDirect && !isRing2) return;

        const alpha = isDirect ? 1.0 : 0.55;
        const mid = curvePt(A, B, 0.5);
        const tx = mid[0];
        const ty = mid[1] + 3;

        const tw = this.textWidth(cx, e.label);
        const bx = { x0: tx - tw / 2 - 3, y0: ty - 10, x1: tx + tw / 2 + 3, y1: ty + 3 };

        for (let i = 0; i < boxes.length; i++) {
          const o = boxes[i];
          if (!(bx.x1 < o.x0 || bx.x0 > o.x1 || bx.y1 < o.y0 || bx.y0 > o.y1)) return;
        }
        boxes.push(bx);

        cx.globalAlpha = alpha;
        cx.lineWidth = 3;
        cx.strokeStyle = T.bg;
        cx.lineJoin = "round";
        cx.textAlign = "center";
        cx.strokeText(e.label, tx, ty);
        cx.fillStyle = isDirect ? T.acc : T.fg;
        cx.fillText(e.label, tx, ty);
        cx.textAlign = "start";
      });
    }

    // 8. Intro shockwaves
    if (motion && now - this.introT0 < this.maxDelay + 2500) {
      const pc = personNode ? P[personNode.id] : null;
      if (pc) {
        for (let d = 1; d <= 4; d++) {
          let first = Infinity;
          this.nodes.forEach((n) => {
            const delay = this.delays.get(n.id) ?? 0;
            if (Math.round(delay / 180) === d) first = Math.min(first, delay);
          });
          if (Number.isFinite(first)) {
            const age = now - this.introT0 - first;
            if (age > 0 && age < 1500) {
              cx.globalAlpha = (1 - age / 1500) * 0.6;
              cx.strokeStyle = T.acc;
              cx.lineWidth = 1.5;
              cx.beginPath();
              cx.arc(pc[0], pc[1], age * 0.42, 0, TAU);
              cx.stroke();
            }
          }
        }
      }
    }

    // 9. Lens ring
    if (lensOn) {
      cx.globalAlpha = 0.9;
      cx.strokeStyle = T.fg;
      cx.lineWidth = 1.5;
      cx.beginPath();
      cx.arc(this.mouse.x, this.mouse.y, LR, 0, TAU);
      cx.stroke();
      cx.globalAlpha = 0.35;
      cx.beginPath();
      cx.arc(this.mouse.x, this.mouse.y, LR + 5, 0, TAU);
      cx.stroke();
      cx.globalAlpha = 1;
      cx.fillStyle = T.acc;
      cx.fillRect(this.mouse.x + LR * 0.7 - 3, this.mouse.y - LR * 0.7 - 3, 6, 6);
      cx.font = "800 10px " + FONT;
      cx.fillStyle = T.fg;
      cx.fillText("LENS", this.mouse.x + LR * 0.7 + 6, this.mouse.y - LR * 0.7 + 4);
    }
    cx.globalAlpha = 1;

    // 10. Red elbow leader line to the docked dossier card!
    if (sel && P[sel]) {
      const q = P[sel];
      const dossierEl = this.stage.querySelector(".dossier") as HTMLElement | null;
      if (dossierEl && !dossierEl.hidden) {
        const dw = dossierEl.offsetWidth || 340;
        const dh = dossierEl.offsetHeight || 380;
        if (W >= 600) {
          const left = dossierEl.offsetLeft > 0 ? dossierEl.offsetLeft : W - dw - 16;
          const top = dossierEl.offsetTop > 0 ? dossierEl.offsetTop : 60;
          if (q[0] < left - 8) {
            const ey = clamp(q[1], top + 24, top + Math.min(dh, 220) - 12);
            const mx = (q[0] + left) / 2;
            cx.globalAlpha = 0.95;
            cx.strokeStyle = T.acc;
            cx.lineWidth = 1.5;
            cx.beginPath();
            cx.moveTo(q[0], q[1]);
            cx.lineTo(mx, q[1]);
            cx.lineTo(mx, ey);
            cx.lineTo(left, ey);
            cx.stroke();
            cx.fillStyle = T.acc;
            cx.fillRect(left - 6, ey - 3, 6, 6);
            cx.globalAlpha = 1;
          }
        }
      }
    }

    // Report the visible counts and the frame rate to the page. They only matter to the person at a glance,
    // so they are computed about four times a second and sent only when a number changed (a call per frame
    // re-rendered the whole React stage around 100 times a second).
    if (now - this.lastInfoAt >= 250) {
      this.lastInfoAt = now;
      const visNodeCount = this.nodes.filter((n) => (V[n.id] ?? 0) > 0.5).length;
      const visEdgeCount = this.edges.filter((e) => (V[e.a] ?? 0) > 0.5 && (V[e.b] ?? 0) > 0.5).length;
      const info = this.lastInfo;
      if (info.nodes !== visNodeCount || info.links !== visEdgeCount || info.fps !== this.currentFps) {
        info.nodes = visNodeCount;
        info.links = visEdgeCount;
        info.fps = this.currentFps;
        this.callbacks.onFrameInfo(visNodeCount, visEdgeCount, this.currentFps);
      }
    }
  }

  private labelWidth(cx: CanvasRenderingContext2D, weight: string, txt: string, size: number, currentFont: string): number {
    const key = weight + "|" + txt;
    let w = this.textWidths.get(key);
    if (w === undefined) {
      if (this.textWidths.size > 4000) this.textWidths.clear();
      cx.font = weight + "100px " + FONT;
      w = cx.measureText(txt).width;
      cx.font = currentFont;
      this.textWidths.set(key, w);
    }
    return (w * size) / 100;
  }

  private textWidth(cx: CanvasRenderingContext2D, txt: string): number {
    // Label sizes change on every frame while the graph turns (perspective), so the cache is keyed by the font
    // at a fixed 100 px and the width is scaled to the real size; text width is linear in the font size.
    const font = cx.font;
    const m = /(\d+(?:\.\d+)?)px/.exec(font);
    if (!m) return cx.measureText(txt).width;
    const size = parseFloat(m[1]);
    const refFont = font.replace(m[0], "100px");
    const key = refFont + "|" + txt;
    let w = this.textWidths.get(key);
    if (w === undefined) {
      if (this.textWidths.size > 4000) this.textWidths.clear();
      cx.font = refFont;
      w = cx.measureText(txt).width;
      cx.font = font;
      this.textWidths.set(key, w);
    }
    return (w * size) / 100;
  }

  public getSnapshotDataUrl(): string {
    const W = 1600;
    const H = 1000;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return "";

    const T = this.ink
      ? { fg: "rgb(243, 242, 242)", bg: "rgb(32, 30, 29)", acc: "rgb(236, 48, 19)" }
      : { fg: "rgb(32, 30, 29)", bg: "rgb(243, 242, 242)", acc: "rgb(236, 48, 19)" };

    ctx.fillStyle = T.bg;
    ctx.fillRect(0, 0, W, H);

    const sc = Math.min(W / this.W, (H - 140) / this.H);
    const dw = this.W * sc;
    const dh = this.H * sc;
    ctx.drawImage(this.cv, 0, 0, this.cv.width, this.cv.height, (W - dw) / 2, 96, dw, dh);

    ctx.fillStyle = T.acc;
    ctx.fillRect(48, 36, 16, 16);
    ctx.fillStyle = T.fg;
    ctx.font = "800 34px " + FONT;
    ctx.fillText("Knowledge graph", 76, 54);
    ctx.font = "400 18px " + FONT;
    ctx.globalAlpha = 0.7;
    ctx.fillText(
      `${this.nodes.length} nodes · ${this.edges.length} links · VitaGraph`,
      48,
      H - 30
    );

    return c.toDataURL("image/png");
  }

  public destroy() {
    this.destroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    const cv = this.cv;
    cv.removeEventListener("pointerdown", this.onPointerDown);
    cv.removeEventListener("pointermove", this.onPointerMove);
    cv.removeEventListener("pointerleave", this.onPointerLeave);
    cv.removeEventListener("pointerup", this.onPointerUp);
    cv.removeEventListener("pointercancel", this.onPointerCancel);
    cv.removeEventListener("wheel", this.onWheel);
    cv.removeEventListener("contextmenu", this.onContextMenu);
    cv.removeEventListener("dblclick", this.onDblClick);
    this.activePointers.clear();
  }
}
