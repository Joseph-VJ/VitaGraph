import type { EngineContext, BackgroundEngineInstance } from "./types";

const TAU = Math.PI * 2;
const F = 3.4;
const STAGES = ["Parse", "Read scans", "Cut", "Embed", "Index"];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const FONT = "Archivo, system-ui, sans-serif";

interface StarPart {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  tx: number;
  ty: number;
  flash: number;
  node: number;
}

interface StarRipple {
  x: number;
  y: number;
  t0: number;
}

// Fixed orbit graph structure for constellation's "Tidy into graph" layout
interface SimpleNode {
  id: string;
  k: "person" | "report" | "section" | "bio" | "meas" | "unc";
  idx: number;
}

interface SimpleEdge {
  a: string;
  b: string;
}

function buildOrbitGraph() {
  const nodes: SimpleNode[] = [];
  const byId: Record<string, SimpleNode> = {};
  const edges: SimpleEdge[] = [];
  const tree: [string, string][] = [];
  const treeKey: Record<string, number> = {};

  function add(id: string, k: SimpleNode["k"]) {
    const n: SimpleNode = { id, k, idx: nodes.length };
    nodes.push(n);
    byId[id] = n;
    return n;
  }

  function link(a: string, b: string, inTree: boolean = false) {
    edges.push({ a, b });
    if (inTree) {
      tree.push([a, b]);
      treeKey[a + "|" + b] = 1;
      treeKey[b + "|" + a] = 1;
    }
  }

  add("p", "person");
  // 3 reports
  for (let i = 0; i < 3; i++) {
    const rid = "r" + i;
    add(rid, "report");
    link("p", rid, true);
  }

  const sections = ["lip", "met", "thy", "cbc"];
  sections.forEach((s) => {
    const sid = "s_" + s;
    add(sid, "section");
    link("r0", sid, true);
    link("r1", sid, false);
    link("r2", sid, false);

    // 2 biomarkers per section
    for (let bi = 0; bi < 2; bi++) {
      const bid = "b_" + s + bi;
      add(bid, "bio");
      link(sid, bid, true);

      // 2 measurements per bio
      for (let ri = 0; ri < 2; ri++) {
        const mid = "m_" + s + bi + "_" + ri;
        add(mid, "meas");
        link(bid, mid, true);
        link(mid, "r" + ri, false);
      }
    }
  });

  // Orbit layout angles and radiuses
  const orbits: [number, number, number][] = nodes.map((n) => {
    const RR: Record<string, number> = {
      person: 0,
      report: 0.4,
      unc: 0.62,
      section: 0.82,
      bio: 1.1,
      meas: 1.4,
    };
    const Y: Record<string, number> = {
      person: 0,
      report: -0.02,
      unc: 0,
      section: 0.02,
      bio: 0.04,
      meas: 0.06,
    };
    let a = (n.idx / nodes.length) * TAU;
    if (n.k === "report") a = (n.idx / 3) * TAU + 0.9;
    const R = RR[n.k] || 1.0;
    return [R * Math.cos(a), Y[n.k] || 0, R * Math.sin(a)];
  });

  return { nodes, byId, edges, tree, treeKey, orbits, N: nodes.length };
}

const GRAPH_DATA = buildOrbitGraph();

export function createStarsEngine(ctx: EngineContext): BackgroundEngineInstance {
  const parts: StarPart[] = [];
  let form: "free" | "graph" = "free";
  let drag: StarPart | null = null;
  let ripples: StarRipple[] = [];
  let lastThink = 0;
  let pj: (q: [number, number, number]) => [number, number] = () => [0, 0];

  function target() {
    return Math.round((ctx.bg.playing ? 150 : ctx.bg.str === "full" ? 120 : 64) * ctx.areaK());
  }

  function mk(x: number, y: number): StarPart {
    const a = Math.random() * TAU;
    const s = 0.1 + Math.random() * 0.3;
    return {
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: 2.0 + Math.random() * 2.0,
      tx: x,
      ty: y,
      flash: 0,
      node: -1,
    };
  }

  function graph() {
    while (parts.length < GRAPH_DATA.N + 10) {
      parts.push(mk(Math.random() * ctx.bg.W, Math.random() * ctx.bg.H));
    }
    const f = ctx.freeArea();
    const cxm = (f.x0 + f.x1) / 2;
    const cym = (f.y0 + f.y1) / 2;
    const S = Math.min((f.x1 - f.x0) / 3.2, (f.y1 - f.y0) / 2.9);
    const c = Math.cos(0.62);
    const s = Math.sin(0.62);
    const cy = Math.cos(0.3);
    const sy = Math.sin(0.3);

    pj = (q: [number, number, number]): [number, number] => {
      const x1 = q[0] * cy + q[2] * sy;
      const z1 = -q[0] * sy + q[2] * cy;
      const y2 = q[1] * c - z1 * s;
      const z2 = q[1] * s + z1 * c;
      const k = F / (F + z2);
      return [cxm + x1 * S * k, cym + y2 * S * k];
    };

    GRAPH_DATA.nodes.forEach((_, i) => {
      const t = pj(GRAPH_DATA.orbits[i]);
      const p = parts[i];
      p.node = i;
      p.tx = t[0];
      p.ty = t[1];
    });

    for (let i = GRAPH_DATA.N; i < parts.length; i++) {
      const e = GRAPH_DATA.tree[Math.floor(Math.random() * GRAPH_DATA.tree.length)];
      const A = parts[GRAPH_DATA.byId[e[0]].idx];
      const B = parts[GRAPH_DATA.byId[e[1]].idx];
      const t = 0.15 + Math.random() * 0.7;
      const p = parts[i];
      p.node = -1;
      p.tx = A.tx + (B.tx - A.tx) * t;
      p.ty = A.ty + (B.ty - A.ty) * t;
    }
    form = "graph";
  }

  function setCount() {
    const want = ctx.bg.playing ? Math.max(target(), parts.length) : target();
    while (parts.length < want) parts.push(mk(Math.random() * ctx.bg.W, Math.random() * ctx.bg.H));
    while (parts.length > want) parts.pop();
    if (form === "graph") graph();
  }

  const engine: BackgroundEngineInstance = {
    text: "Dots that link to their neighbours, like a sky of data. They can line up as the shape of your real graph, and during an upload they gather at the five stages.",
    play: "The pointer pulls the dots and a click adds one. In play mode you can drag and fling them, or tidy them into the graph.",
    get form() {
      return form;
    },
    set form(v: "free" | "graph") {
      form = v;
    },
    setCount,
    reset() {
      setCount();
    },
    resize() {
      if (form === "graph") graph();
    },
    count() {
      return parts.length + " dots";
    },
    event(kind) {
      if (kind !== "done") return;
      const f = ctx.freeArea();
      const ccx = (f.x0 + f.x1) / 2;
      const ccy = (f.y0 + f.y1) / 2;
      form = "free";
      ripples.push({ x: ccx, y: ccy, t0: performance.now() });
      parts.forEach((p) => {
        p.flash = 1;
        p.vx += (p.x - ccx) * 0.004;
        p.vy += (p.y - ccy) * 0.004;
      });
    },
    click(x, y) {
      if (ctx.bg.playing) {
        let best: StarPart | null = null;
        let bd = 18;
        parts.forEach((p) => {
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < bd) {
            bd = d;
            best = p;
          }
        });
        if (best) {
          drag = best;
          (best as StarPart).flash = 1;
          return;
        }
      }
      if (parts.length < 200) {
        const p = mk(x, y);
        p.flash = 1;
        parts.push(p);
        ripples.push({ x, y, t0: performance.now() });
      }
    },
    frame(now, s, dt) {
      const k = dt / 16.7;
      const m = ctx.bg.mouse;
      const f = ctx.freeArea();
      const stageX = (g: number) => f.x0 + ((f.x1 - f.x0) * (g + 0.6)) / 5.4;

      if (ctx.ev.think && now - lastThink > 650 && parts.length) {
        lastThink = now;
        const p0 = parts[Math.floor(Math.random() * parts.length)];
        ripples.push({ x: p0.x, y: p0.y, t0: now });
      }

      parts.forEach((p, i) => {
        if (drag === p) {
          if (m.down) {
            p.vx = (m.x - p.x) * 0.6;
            p.vy = (m.y - p.y) * 0.6;
            p.x = m.x;
            p.y = m.y;
          } else {
            drag = null;
          }
          return;
        }
        if (ctx.ev.upload) {
          const g = i % 5;
          const tx = stageX(g);
          const ty = f.y0 + 60 + (((i * 37) % 100) / 100) * (f.y1 - f.y0 - 120);
          p.vx += (tx - p.x) * 0.012 * k;
          p.vy += (ty - p.y) * 0.012 * k;
          p.vx *= Math.pow(0.88, k);
          p.vy *= Math.pow(0.88, k);
          if (g === ctx.ev.stage) p.flash = Math.max(p.flash, 0.5);
        } else if (form === "graph") {
          p.vx += (p.tx - p.x) * 0.012 * k;
          p.vy += (p.ty - p.y) * 0.012 * k;
          p.vx *= Math.pow(0.88, k);
          p.vy *= Math.pow(0.88, k);
        } else {
          p.vx += (Math.random() - 0.5) * 0.03 * k;
          p.vy += (Math.random() - 0.5) * 0.03 * k;
          const sp = Math.hypot(p.vx, p.vy);
          const mx = ctx.bg.playing ? 0.8 : 0.45;
          if (sp > mx) {
            p.vx *= mx / sp;
            p.vy *= mx / sp;
          }
        }
        if (m.on) {
          const dx = m.x - p.x;
          const dy = m.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 160 && d > 1) {
            const fo =
              (1 - d / 160) *
              0.5 *
              (ctx.bg.playing ? 2 : 1) *
              (ctx.bg.force === "attract" ? 1 : -1) *
              k;
            p.vx += (dx / d) * fo;
            p.vy += (dy / d) * fo;
          }
        }
        p.x += p.vx * k;
        p.y += p.vy * k;
        if (form === "free" && !ctx.ev.upload) {
          if (p.x < -20) p.x = ctx.bg.W + 20;
          else if (p.x > ctx.bg.W + 20) p.x = -20;
          if (p.y < -20) p.y = ctx.bg.H + 20;
          else if (p.y > ctx.bg.H + 20) p.y = -20;
        }
        p.flash *= Math.pow(0.97, k);
      });

      ripples = ripples.filter((r) => now - r.t0 < 1600);
      ripples.forEach((r) => {
        const rad = Math.max(0, (now - r.t0) * 0.22);
        parts.forEach((p) => {
          if (Math.abs(Math.hypot(p.x - r.x, p.y - r.y) - rad) < 14) {
            p.flash = Math.max(p.flash, 0.9);
          }
        });
      });

      const fx = ctx.ctx;
      fx.setTransform(ctx.bg.dpr, 0, 0, ctx.bg.dpr, 0, 0);
      fx.clearRect(0, 0, ctx.bg.W, ctx.bg.H);
      fx.lineWidth = 1;

      const L = ctx.bg.playing ? 150 : 125;
      const la = 0.42 * s;

      if (form === "graph" && !ctx.ev.upload) {
        fx.strokeStyle = ctx.colors.ink;
        fx.globalAlpha = Math.min(1, la * 0.5);
        [0.4, 0.82, 1.1, 1.4].forEach((R) => {
          fx.beginPath();
          for (let i = 0; i <= 72; i++) {
            const a = (i / 72) * TAU;
            const p = pj([R * Math.cos(a), 0.02, R * Math.sin(a)]);
            if (i) fx.lineTo(p[0], p[1]);
            else fx.moveTo(p[0], p[1]);
          }
          fx.stroke();
        });
        fx.globalAlpha = Math.min(1, la * 0.45);
        fx.beginPath();
        GRAPH_DATA.edges.forEach((e) => {
          if (GRAPH_DATA.treeKey[e.a + "|" + e.b]) return;
          const A = parts[GRAPH_DATA.byId[e.a].idx];
          const B = parts[GRAPH_DATA.byId[e.b].idx];
          if (A && B) {
            fx.moveTo(A.x, A.y);
            fx.lineTo(B.x, B.y);
          }
        });
        fx.stroke();
        fx.globalAlpha = Math.min(1, la * 2.2);
        fx.lineWidth = 1.2;
        fx.beginPath();
        GRAPH_DATA.tree.forEach((e) => {
          const A = parts[GRAPH_DATA.byId[e[0]].idx];
          const B = parts[GRAPH_DATA.byId[e[1]].idx];
          if (A && B) {
            fx.moveTo(A.x, A.y);
            fx.lineTo(B.x, B.y);
          }
        });
        fx.stroke();
        fx.lineWidth = 1;
      } else {
        for (let i = 0; i < parts.length; i++) {
          for (let j = i + 1; j < parts.length; j++) {
            const dx = parts[i].x - parts[j].x;
            const dy = parts[i].y - parts[j].y;
            const d2 = dx * dx + dy * dy;
            if (d2 < L * L) {
              const a = 1 - Math.sqrt(d2) / L;
              const hot = parts[i].flash > 0.4 && parts[j].flash > 0.4;
              fx.globalAlpha = Math.min(1, a * (hot ? 0.75 : la));
              fx.strokeStyle = hot ? ctx.colors.acc : ctx.colors.ink;
              fx.beginPath();
              fx.moveTo(parts[i].x, parts[i].y);
              fx.lineTo(parts[j].x, parts[j].y);
              fx.stroke();
            }
          }
        }
      }

      ripples.forEach((r) => {
        const t = clamp((now - r.t0) / 1600, 0, 1);
        fx.globalAlpha = (1 - t) * 0.75;
        fx.strokeStyle = ctx.colors.acc;
        fx.lineWidth = 1.8;
        fx.beginPath();
        fx.arc(r.x, r.y, Math.max(0, (now - r.t0) * 0.22), 0, TAU);
        fx.stroke();
      });

      parts.forEach((p, i) => {
        const red = p.flash > 0.25 || i === 0;
        fx.globalAlpha = clamp(red ? 0.98 : 0.7 * s, 0, 1);
        fx.fillStyle = red ? ctx.colors.acc : ctx.colors.ink;
        const r = p.r * (i === 0 ? 2.4 : 1) * (1 + p.flash * 0.8);
        if (form === "graph" && p.node >= 0 && GRAPH_DATA.nodes[p.node]?.k === "section") {
          fx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        } else {
          fx.beginPath();
          fx.arc(p.x, p.y, r, 0, TAU);
          fx.fill();
        }
      });

      if (ctx.ev.upload) {
        fx.font = "800 11px " + FONT;
        fx.textAlign = "center";
        STAGES.forEach((n, g) => {
          fx.globalAlpha = g === ctx.ev.stage ? 0.95 : 0.4;
          fx.fillStyle = g === ctx.ev.stage ? ctx.colors.acc : ctx.colors.ink;
          fx.fillText(n.toUpperCase(), stageX(g), f.y0 + 30);
        });
        fx.textAlign = "start";
      }
      fx.globalAlpha = 1;
    },
    still() {
      engine.frame(performance.now(), ctx.strength(), 16.7);
    },
  };

  return engine;
}
