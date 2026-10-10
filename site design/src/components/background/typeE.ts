import type { EngineContext, BackgroundEngineInstance } from "./types";
import { noise2 } from "./noise";

const TAU = Math.PI * 2;
const FONT = "Archivo, system-ui, sans-serif";

const TYPE_SPLIT: Record<string, [string, string]> = {
  VITAGRAPH: ["VITA", "GRAPH"],
  THINKING: ["THINK", "ING"],
  PARSING: ["PARS", "ING"],
  READING: ["READ", "ING"],
  CUTTING: ["CUT", "TING"],
  EMBEDDING: ["EMBED", "DING"],
  INDEXING: ["INDEX", "ING"],
  HEMOGLOBIN: ["HEMO", "GLOBIN"],
  CHOLESTEROL: ["CHOLES", "TEROL"],
};

interface TypeRipple {
  x: number;
  y: number;
  t0: number;
}

export function createTypeEngine(ctx: EngineContext): BackgroundEngineInstance {
  const max = 3600;
  let n = 0;
  let word = "VITAGRAPH";
  let ripples: TypeRipple[] = [];
  let gap = 4;

  const x = new Float32Array(max);
  const y = new Float32Array(max);
  const vx = new Float32Array(max);
  const vy = new Float32Array(max);
  const tx = new Float32Array(max);
  const ty = new Float32Array(max);
  const has = new Uint8Array(max);
  const hot = new Uint8Array(max);
  const oc = document.createElement("canvas");

  function sample() {
    if (!n) return;
    const f = ctx.freeArea();
    const fw = Math.max(80, Math.floor(f.x1 - f.x0 - 40));
    const fh = Math.max(80, Math.floor(f.y1 - f.y0 - 40));
    oc.width = fw;
    oc.height = fh;
    const o = oc.getContext("2d", { willReadFrequently: true });
    if (!o) return;

    const wd = word;
    const half = Math.ceil(wd.length / 2);
    const lines =
      fh / fw > 1.05 && wd.length > 5
        ? TYPE_SPLIT[wd] || [wd.slice(0, half), wd.slice(half)]
        : [wd];

    let fs = Math.min(fh * 0.42, (fh * 0.8) / (lines.length * 0.92));
    o.font = "800 " + fs + "px " + FONT;
    const w = Math.max(...lines.map((l) => o.measureText(l).width));
    if (w > fw * 0.9) fs *= (fw * 0.9) / w;

    o.clearRect(0, 0, fw, fh);
    o.fillStyle = "black";
    o.font = "800 " + fs + "px " + FONT;
    o.textAlign = "center";
    o.textBaseline = "middle";

    lines.forEach((l, i) =>
      o.fillText(l, fw / 2, fh / 2 + (i - (lines.length - 1) / 2) * fs * 0.92)
    );

    const data = o.getImageData(0, 0, fw, fh).data;
    let localGap = 3;
    let pts: number[] = [];
    for (; localGap < 14; localGap++) {
      pts = [];
      for (let py = 0; py < fh; py += localGap) {
        for (let px = 0; px < fw; px += localGap) {
          if (data[(py * fw + px) * 4 + 3] > 128) {
            pts.push(px, py);
          }
        }
      }
      if (pts.length / 2 <= n * 0.92) break;
    }

    const cnt = Math.floor(pts.length / 2);
    const order = Array.from({ length: cnt }, (_, i) => i);
    for (let i = cnt - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
    }

    for (let i = 0; i < n; i++) {
      if (i < cnt) {
        const p = order[i];
        has[i] = 1;
        tx[i] = f.x0 + 20 + pts[p * 2];
        ty[i] = f.y0 + 20 + pts[p * 2 + 1];
      } else {
        has[i] = 0;
      }
    }
    gap = localGap;
  }

  function setCount() {
    const nn = Math.min(
      max,
      Math.round((ctx.bg.playing ? 3200 : ctx.bg.str === "full" ? 2000 : 1000) * ctx.areaK())
    );
    for (let i = n; i < nn; i++) {
      x[i] = Math.random() * ctx.bg.W;
      y[i] = Math.random() * ctx.bg.H;
      vx[i] = 0;
      vy[i] = 0;
      hot[i] = Math.random() < 0.05 ? 1 : 0;
    }
    n = nn;
    sample();
  }

  function setWord(w: string) {
    word = (w || "VITAGRAPH").toUpperCase().slice(0, 12);
    sample();
  }

  function click(cx: number, cy: number, power?: number) {
    const pw = power || 1;
    const R = 260 * pw;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - cx;
      const dy = y[i] - cy;
      const d = Math.hypot(dx, dy) + 1;
      if (d < R) {
        const p = (1 - d / R) * 14 * pw;
        vx[i] += (dx / d) * p;
        vy[i] += (dy / d) * p;
      }
    }
    ripples.push({ x: cx, y: cy, t0: performance.now() });
  }

  const engine: BackgroundEngineInstance = {
    text: "The dots spell what the app is doing: THINKING while the agent works, then PARSING, READING, CUTTING, EMBEDDING and INDEXING during an upload, and READY at the end.",
    play: "Push through the letters and watch them heal. Click for a shockwave. In play mode you can type your own word.",
    init() {
      setCount();
    },
    setCount,
    setWord,
    reset() {
      setCount();
    },
    resize() {
      sample();
    },
    count() {
      return n + " dots";
    },
    event(kind) {
      if (kind === "think") {
        setWord(ctx.ev.think ? "THINKING" : "VITAGRAPH");
      }
      if (kind === "stage") {
        const stageNames = ["PARSING", "READING", "CUTTING", "EMBEDDING", "INDEXING"];
        setWord(stageNames[ctx.ev.stage] || "READING");
      }
      if (kind === "done") {
        setWord("READY");
        const f = ctx.freeArea();
        click((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, 2.2);
        setTimeout(() => {
          if (!ctx.ev.think && !ctx.ev.upload && ctx.bg.engine === "type" && !ctx.bg.playing) {
            setWord("VITAGRAPH");
          }
        }, 3600);
      }
    },
    click,
    frame(now, s, dt) {
      const k = dt / 16.7;
      const m = ctx.bg.mouse;
      const R = ctx.bg.playing ? 130 : 100;
      const fx = ctx.ctx;

      fx.setTransform(ctx.bg.dpr, 0, 0, ctx.bg.dpr, 0, 0);
      fx.clearRect(0, 0, ctx.bg.W, ctx.bg.H);

      const ink = new Path2D();
      const red = new Path2D();
      const dust = new Path2D();
      const sz = Math.max(2.0, Math.min(5.0, gap * 0.65));
      const damp = Math.pow(0.82, k);

      for (let i = 0; i < n; i++) {
        let px = x[i];
        let py = y[i];
        if (has[i]) {
          vx[i] += (tx[i] - px) * 0.05 * k;
          vy[i] += (ty[i] - py) * 0.05 * k;
          vx[i] *= damp;
          vy[i] *= damp;
          if (ctx.ev.think) {
            vx[i] += (Math.random() - 0.5) * 0.4;
            vy[i] += (Math.random() - 0.5) * 0.4;
          }
        } else {
          const a = noise2(px * 0.004 + now * 0.00005, py * 0.004) * TAU;
          vx[i] += Math.cos(a) * 0.02 * k;
          vy[i] += Math.sin(a) * 0.02 * k;
          vx[i] *= 0.98;
          vy[i] *= 0.98;
        }
        if (m.on) {
          const dx = px - m.x;
          const dy = py - m.y;
          const d = Math.hypot(dx, dy) + 1;
          if (d < R) {
            const fo = (1 - d / R) * 3.2 * k;
            vx[i] += (dx / d) * fo;
            vy[i] += (dy / d) * fo;
          }
        }
        px += vx[i] * k;
        py += vy[i] * k;
        if (!has[i]) {
          if (px < 0) px += ctx.bg.W;
          if (px > ctx.bg.W) px -= ctx.bg.W;
          if (py < 0) py += ctx.bg.H;
          if (py > ctx.bg.H) py -= ctx.bg.H;
        }
        x[i] = px;
        y[i] = py;

        (has[i] ? (hot[i] ? red : ink) : dust).rect(px - sz / 2, py - sz / 2, sz, sz);
      }

      fx.globalAlpha = Math.min(0.6, 0.28 * s);
      fx.fillStyle = ctx.colors.ink;
      fx.fill(dust);

      fx.globalAlpha = Math.min(1, 0.85 * s);
      fx.fill(ink);

      fx.globalAlpha = Math.min(1, 1.4 * s);
      fx.fillStyle = ctx.colors.acc;
      fx.fill(red);

      ripples = ripples.filter((r) => now - r.t0 < 1400);
      ripples.forEach((r) => {
        const t = (now - r.t0) / 1400;
        fx.globalAlpha = (1 - t) * 0.75;
        fx.strokeStyle = ctx.colors.acc;
        fx.lineWidth = 1.8;
        fx.beginPath();
        fx.arc(r.x, r.y, Math.max(0, (now - r.t0) * 0.3), 0, TAU);
        fx.stroke();
      });
      fx.globalAlpha = 1;
    },
    still() {
      for (let i = 0; i < n; i++) {
        if (has[i]) {
          x[i] = tx[i];
          y[i] = ty[i];
          vx[i] = 0;
          vy[i] = 0;
        }
      }
      engine.frame(performance.now(), ctx.strength(), 0);
    },
  };

  return engine;
}
