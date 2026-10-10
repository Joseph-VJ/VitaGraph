import type { EngineContext, BackgroundEngineInstance } from "./types";
import { noise2 } from "./noise";

const TAU = Math.PI * 2;
const STAGES = ["Parse", "Read scans", "Cut", "Embed", "Index"];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const FONT = "Archivo, system-ui, sans-serif";

export function createFlowEngine(ctx: EngineContext): BackgroundEngineInstance {
  const max = 4200;
  let n = 0;
  let storm = false;
  let paint = false;
  let red = false;

  const x = new Float32Array(max);
  const y = new Float32Array(max);
  const vx = new Float32Array(max);
  const vy = new Float32Array(max);
  const life = new Float32Array(max);
  const hot = new Uint8Array(max);
  const seg = new Float32Array(max * 4);

  const buf = document.createElement("canvas");
  const bx = buf.getContext("2d")!;
  let fr = { cx: 0, cy: 0 };

  function spawn(i: number, anywhere: boolean) {
    x[i] = Math.random() * ctx.bg.W;
    y[i] = Math.random() * ctx.bg.H;
    vx[i] = 0;
    vy[i] = 0;
    life[i] = anywhere ? Math.random() * 300 : 120 + Math.random() * 260;
    hot[i] = Math.random() < (red ? 0.5 : 0.04) ? 1 : 0;
  }

  function setCount() {
    const base = ctx.bg.playing ? 3400 : ctx.bg.str === "full" ? 2400 : 1000;
    n = Math.min(max, Math.round(base * ctx.areaK()));
    for (let i = 0; i < n; i++) spawn(i, true);
  }

  function angle(px: number, py: number, now: number) {
    let a = noise2(px * 0.0016 + now * 0.000012, py * 0.0016 - now * 0.000008) * TAU * 1.15;
    if (ctx.ev.think) {
      const dx = px - fr.cx;
      const dy = py - fr.cy;
      const d = Math.hypot(dx, dy);
      const w = clamp(1 - d / 520, 0, 1) * 0.92;
      const va = Math.atan2(dy, dx) + Math.PI / 2 + 0.42;
      a = Math.atan2(Math.sin(a) * (1 - w) + Math.sin(va) * w, Math.cos(a) * (1 - w) + Math.cos(va) * w);
    }
    if (ctx.ev.upload) {
      a = Math.atan2(Math.sin(a) * 0.14, Math.cos(a) * 0.14 + 0.86);
    }
    return a;
  }

  const engine: BackgroundEngineInstance = {
    text: "Thousands of ink threads on a slow current. The pointer stirs a whirlpool and a click throws ink outward. While the agent thinks, the current curls into a vortex; during an upload it streams through the five stages.",
    play: "Stir the current with the pointer, click to throw ink. In play mode, Storm speeds it up, Paint lets you drag the current where you want, and Red ink colours what you paint.",
    get storm() {
      return storm;
    },
    set storm(v: boolean) {
      storm = v;
    },
    get paint() {
      return paint;
    },
    set paint(v: boolean) {
      paint = v;
    },
    get red() {
      return red;
    },
    set red(v: boolean) {
      red = v;
    },
    init() {
      engine.resize?.();
      setCount();
    },
    resize() {
      buf.width = ctx.canvas.width;
      buf.height = ctx.canvas.height;
      setCount();
    },
    setCount,
    reset() {
      bx.setTransform(1, 0, 0, 1, 0, 0);
      bx.clearRect(0, 0, buf.width, buf.height);
      setCount();
    },
    count() {
      return n + " threads";
    },
    event(kind) {
      if (kind !== "done") return;
      const f = ctx.freeArea();
      const ccx = (f.x0 + f.x1) / 2;
      const ccy = (f.y0 + f.y1) / 2;
      for (let i = 0; i < n; i++) {
        const dx = x[i] - ccx;
        const dy = y[i] - ccy;
        const d = Math.hypot(dx, dy) + 1;
        if (d < 520) {
          const p = (1 - d / 520) * 9;
          vx[i] += (dx / d) * p;
          vy[i] += (dy / d) * p;
          if (Math.random() < 0.4) hot[i] = 1;
        }
      }
    },
    click(cxPos, cyPos) {
      for (let i = 0; i < n; i++) {
        const dx = x[i] - cxPos;
        const dy = y[i] - cyPos;
        const d = Math.hypot(dx, dy) + 1;
        if (d < 180) {
          const p = (1 - d / 180) * 7;
          vx[i] += (dx / d) * p;
          vy[i] += (dy / d) * p;
          if (Math.random() < 0.3) hot[i] = 1;
        }
      }
    },
    frame(now, s, dt) {
      const k = dt / 16.7;
      const m = ctx.bg.mouse;
      const W = ctx.bg.W;
      const H = ctx.bg.H;
      const maxV = (storm ? 3.4 : 1.4) * (ctx.bg.playing ? 1.2 : 1);
      const f = ctx.freeArea();
      fr = { cx: (f.x0 + f.x1) / 2, cy: (f.y0 + f.y1) / 2 };

      bx.setTransform(ctx.bg.dpr, 0, 0, ctx.bg.dpr, 0, 0);
      bx.globalCompositeOperation = "destination-out";
      bx.globalAlpha = storm ? 0.045 : 0.07;
      bx.fillRect(0, 0, W, H);
      bx.globalCompositeOperation = "source-over";

      const gates = ctx.ev.upload
        ? STAGES.map((_, i) => f.x0 + ((f.x1 - f.x0) * (i + 0.6)) / 5.4)
        : null;

      let ni = 0;
      const hotSeg: number[] = [];
      const damp = Math.pow(0.93, k);

      for (let i = 0; i < n; i++) {
        const px = x[i];
        const py = y[i];
        const a = angle(px, py, now);
        vx[i] += Math.cos(a) * 0.13 * k;
        vy[i] += Math.sin(a) * 0.13 * k;
        if (m.on) {
          const ex = px - m.x;
          const ey = py - m.y;
          const d = Math.hypot(ex, ey) + 1;
          if (paint && m.down && d < 90) {
            vx[i] += m.vx * 0.12;
            vy[i] += m.vy * 0.12;
            if (red) hot[i] = 1;
          } else if (d < 190) {
            const fo = (1 - d / 190) * 0.5 * (ctx.bg.force === "attract" ? 1 : -1);
            vx[i] += (-ey / d) * fo - (ex / d) * fo * 0.25;
            vy[i] += (ex / d) * fo - (ey / d) * fo * 0.25;
          }
        }
        vx[i] *= damp;
        vy[i] *= damp;
        const sp = Math.hypot(vx[i], vy[i]);
        const lim = maxV * 5;
        if (sp > lim) {
          vx[i] *= lim / sp;
          vy[i] *= lim / sp;
        }
        const vs = sp > maxV ? Math.max(maxV, sp * 0.96) / sp : 1;
        x[i] += vx[i] * vs * k;
        y[i] += vy[i] * vs * k;
        life[i] -= k;

        if (gates && ctx.ev.stage >= 0 && px < gates[ctx.ev.stage] && x[i] >= gates[ctx.ev.stage]) {
          hot[i] = 1;
        }
        if (life[i] <= 0 || x[i] < -10 || x[i] > W + 10 || y[i] < -10 || y[i] > H + 10) {
          spawn(i, false);
          continue;
        }
        if (hot[i]) {
          hotSeg.push(px, py, x[i], y[i]);
        } else {
          seg[ni++] = px;
          seg[ni++] = py;
          seg[ni++] = x[i];
          seg[ni++] = y[i];
        }
      }

      bx.lineWidth = 1;
      bx.strokeStyle = ctx.colors.ink;
      bx.globalAlpha = 0.45 * Math.min(1.5, s);
      bx.beginPath();
      for (let j = 0; j < ni; j += 4) {
        bx.moveTo(seg[j], seg[j + 1]);
        bx.lineTo(seg[j + 2], seg[j + 3]);
      }
      bx.stroke();

      bx.strokeStyle = ctx.colors.acc;
      bx.globalAlpha = Math.min(1, 0.95 * s);
      bx.lineWidth = 1.4;
      bx.beginPath();
      for (let j = 0; j < hotSeg.length; j += 4) {
        bx.moveTo(hotSeg[j], hotSeg[j + 1]);
        bx.lineTo(hotSeg[j + 2], hotSeg[j + 3]);
      }
      bx.stroke();

      const fx = ctx.ctx;
      fx.setTransform(1, 0, 0, 1, 0, 0);
      fx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      fx.globalAlpha = 1;
      fx.drawImage(buf, 0, 0);
      fx.setTransform(ctx.bg.dpr, 0, 0, ctx.bg.dpr, 0, 0);

      if (gates) {
        fx.font = "800 11px " + FONT;
        fx.textAlign = "center";
        gates.forEach((gx, g) => {
          const act = g === ctx.ev.stage;
          const done = g < ctx.ev.stage;
          fx.globalAlpha = act ? 0.9 : done ? 0.45 : 0.2;
          fx.strokeStyle = act ? ctx.colors.acc : ctx.colors.ink;
          fx.lineWidth = act ? 2 : 1;
          fx.beginPath();
          fx.moveTo(gx, f.y0 + 40);
          fx.lineTo(gx, f.y1 - 30);
          fx.stroke();
          fx.fillStyle = act ? ctx.colors.acc : ctx.colors.ink;
          fx.fillText(STAGES[g].toUpperCase(), gx, f.y0 + 30);
        });
        fx.textAlign = "start";
      }
      if (ctx.ev.think) {
        fx.globalAlpha = 0.9;
        fx.fillStyle = ctx.colors.acc;
        fx.fillRect(fr.cx - 4, fr.cy - 4, 8, 8);
      }
      fx.globalAlpha = 1;
    },
    still() {
      const f = ctx.freeArea();
      fr = { cx: (f.x0 + f.x1) / 2, cy: (f.y0 + f.y1) / 2 };
      const fx = ctx.ctx;
      fx.setTransform(ctx.bg.dpr, 0, 0, ctx.bg.dpr, 0, 0);
      fx.clearRect(0, 0, ctx.bg.W, ctx.bg.H);
      fx.strokeStyle = ctx.colors.ink;
      fx.globalAlpha = 0.38 * ctx.strength();
      fx.lineWidth = 1;
      fx.beginPath();
      for (let i = 0; i < 700; i++) {
        let px = Math.random() * ctx.bg.W;
        let py = Math.random() * ctx.bg.H;
        fx.moveTo(px, py);
        for (let st = 0; st < 34; st++) {
          const a = angle(px, py, 0);
          px += Math.cos(a) * 4;
          py += Math.sin(a) * 4;
          fx.lineTo(px, py);
        }
      }
      fx.stroke();
      fx.globalAlpha = 1;
    },
  };

  return engine;
}
