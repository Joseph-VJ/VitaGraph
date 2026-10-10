import type { EngineContext, BackgroundEngineInstance } from "./types";

const TAU = Math.PI * 2;
const STAGES = ["Parse", "Read scans", "Cut", "Embed", "Index"];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const FONT = "Archivo, system-ui, sans-serif";

interface Ripple {
  x: number;
  y: number;
  t0: number;
  amp: number;
  life: number;
}

interface Well {
  x: number;
  y: number;
}

export function createWarpEngine(ctx: EngineContext): BackgroundEngineInstance {
  const ripples: Ripple[] = [];
  const wells: Well[] = [];
  let pin = false;
  let flashT = -1e9;
  let fr = { cx: 0, cy: 0 };
  const outCoord: [number, number] = [0, 0];

  function disp(x: number, y: number, now: number, out: [number, number]) {
    let dx = 0;
    let dy = 0;
    const m = ctx.bg.mouse;
    const sgn = ctx.bg.force === "attract" ? 1 : -0.8;
    if (m.on) {
      const ex = x - m.x;
      const ey = y - m.y;
      const f = 0.42 * Math.exp(-(ex * ex + ey * ey) / 45000) * sgn;
      dx -= ex * f;
      dy -= ey * f;
    }
    for (let i = 0; i < wells.length; i++) {
      const w = wells[i];
      const ex = x - w.x;
      const ey = y - w.y;
      const f = 0.55 * Math.exp(-(ex * ex + ey * ey) / 24200);
      dx -= ex * f;
      dy -= ey * f;
    }
    if (ctx.ev.think) {
      for (let k = 0; k < 3; k++) {
        const a = now * 0.0011 + (k * TAU) / 3;
        const ex = x - (fr.cx + Math.cos(a) * 110);
        const ey = y - (fr.cy + Math.sin(a) * 110);
        const f = 0.4 * Math.exp(-(ex * ex + ey * ey) / 12800);
        dx -= ex * f;
        dy -= ey * f;
      }
    }
    for (let i = 0; i < ripples.length; i++) {
      const r = ripples[i];
      const age = now - r.t0;
      if (age < 0 || age > r.life) continue;
      const ex = x - r.x;
      const ey = y - r.y;
      const d = Math.hypot(ex, ey) + 0.001;
      const w = d - age * 0.34;
      const a = r.amp * Math.exp(-(w * w) / 3200) * (1 - age / r.life) * Math.sin(w / 15);
      dx += (ex / d) * a;
      dy += (ey / d) * a;
    }
    out[0] = x + dx;
    out[1] = y + dy;
  }

  const engine: BackgroundEngineInstance = {
    text: "The page's own 48 px grid, made of rubber. The pointer bends it and a click sends a wave through it. During an upload a scanner sweeps across and fills the cells it has read.",
    play: "Move the pointer and the grid bends. Click to send a wave. In play mode you can pin up to six gravity wells.",
    get pin() {
      return pin;
    },
    set pin(v: boolean) {
      pin = v;
    },
    get wells() {
      return wells;
    },
    set wells(v: Well[]) {
      wells.length = 0;
      wells.push(...v);
    },
    reset() {
      ctx.ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    },
    count() {
      return (
        Math.ceil(ctx.bg.W / 48) +
        Math.ceil(ctx.bg.H / 48) +
        " lines" +
        (wells.length ? ", " + wells.length + " wells" : "")
      );
    },
    event(kind) {
      if (kind !== "done") return;
      const f = ctx.freeArea();
      const cxm = (f.x0 + f.x1) / 2;
      const cym = (f.y0 + f.y1) / 2;
      const now = performance.now();
      ripples.push(
        { x: cxm, y: cym, t0: now, amp: 30, life: 2400 },
        { x: cxm, y: cym, t0: now + 260, amp: 18, life: 2000 }
      );
      flashT = now;
    },
    click(x, y) {
      if (ctx.bg.playing && pin) {
        if (wells.length < 6) wells.push({ x, y });
        return;
      }
      ripples.push({ x, y, t0: performance.now(), amp: 18, life: 1700 });
    },
    frame(now, s) {
      const W = ctx.bg.W;
      const H = ctx.bg.H;
      const gap = 48;
      const seg = 12;
      const f = ctx.freeArea();
      fr = { cx: (f.x0 + f.x1) / 2, cy: (f.y0 + f.y1) / 2 };
      for (let i = ripples.length - 1; i >= 0; i--) {
        if (now - ripples[i].t0 >= ripples[i].life) {
          ripples.splice(i, 1);
        }
      }
      const fx = ctx.ctx;
      fx.setTransform(ctx.bg.dpr, 0, 0, ctx.bg.dpr, 0, 0);
      fx.clearRect(0, 0, W, H);
      const flash = clamp(1 - (now - flashT) / 900, 0, 1);
      fx.lineWidth = ctx.bg.playing || ctx.bg.str === "full" ? 1.5 : 1;
      fx.strokeStyle = flash > 0 ? ctx.colors.acc : ctx.colors.ink;
      fx.globalAlpha = Math.min(1, (0.72 + flash * 0.28) * s);
      fx.beginPath();
      for (let x = 0; x <= W + gap; x += gap) {
        for (let y = -gap; y <= H + gap; y += seg) {
          disp(x, y, now, outCoord);
          if (y === -gap) fx.moveTo(outCoord[0], outCoord[1]);
          else fx.lineTo(outCoord[0], outCoord[1]);
        }
      }
      for (let y = 0; y <= H + gap; y += gap) {
        for (let x = -gap; x <= W + gap; x += seg) {
          disp(x, y, now, outCoord);
          if (x === -gap) fx.moveTo(outCoord[0], outCoord[1]);
          else fx.lineTo(outCoord[0], outCoord[1]);
        }
      }
      fx.stroke();
      const m = ctx.bg.mouse;
      if (m.on) {
        fx.strokeStyle = ctx.colors.ink;
        fx.lineWidth = 1.2;
        const gx0 = Math.floor((m.x - 200) / gap) * gap;
        const gy0 = Math.floor((m.y - 200) / gap) * gap;
        for (let x = gx0; x <= m.x + 200; x += gap) {
          for (let y = gy0; y <= m.y + 200; y += gap) {
            const d = Math.hypot(x - m.x, y - m.y);
            if (d > 200) continue;
            disp(x, y, now, outCoord);
            fx.globalAlpha = (1 - d / 200) * 0.85 * Math.min(1, s);
            fx.beginPath();
            fx.moveTo(outCoord[0] - 4, outCoord[1]);
            fx.lineTo(outCoord[0] + 4, outCoord[1]);
            fx.moveTo(outCoord[0], outCoord[1] - 4);
            fx.lineTo(outCoord[0], outCoord[1] + 4);
            fx.stroke();
          }
        }
      }
      if (ctx.ev.upload) {
        const p = clamp((now - ctx.ev.upload.t0) / 6500, 0, 1);
        const bx = f.x0 + (f.x1 - f.x0) * p;
        for (let x = Math.floor(f.x0 / gap) * gap; x < bx; x += gap) {
          for (let y = Math.floor(f.y0 / gap) * gap; y < f.y1; y += gap) {
            const hsh = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            const rr = hsh - Math.floor(hsh);
            if (rr < 0.24) {
              disp(x + gap / 2, y + gap / 2, now, outCoord);
              const fresh = bx - x < gap * 1.5;
              fx.globalAlpha = (fresh ? 0.9 : 0.35) * Math.min(1, s);
              fx.fillStyle = fresh ? ctx.colors.acc : ctx.colors.ink;
              fx.fillRect(outCoord[0] - 8, outCoord[1] - 8, 16, 16);
            }
          }
        }
        fx.globalAlpha = 0.9;
        fx.strokeStyle = ctx.colors.acc;
        fx.lineWidth = 2;
        fx.beginPath();
        fx.moveTo(bx, f.y0);
        fx.lineTo(bx, f.y1);
        fx.stroke();
        fx.font = "800 11px " + FONT;
        fx.fillStyle = ctx.colors.acc;
        fx.fillText(
          ("Reading · " + STAGES[Math.max(0, ctx.ev.stage)]).toUpperCase(),
          Math.min(bx + 8, f.x1 - 170),
          f.y0 + 20
        );
      }
      if (ctx.ev.think) {
        for (let k = 0; k < 3; k++) {
          const a = now * 0.0011 + (k * TAU) / 3;
          fx.globalAlpha = 0.95;
          fx.fillStyle = ctx.colors.acc;
          fx.fillRect(fr.cx + Math.cos(a) * 110 - 4, fr.cy + Math.sin(a) * 110 - 4, 8, 8);
        }
      }
      wells.forEach((w) => {
        fx.globalAlpha = 1;
        fx.fillStyle = ctx.colors.acc;
        fx.fillRect(w.x - 4, w.y - 4, 8, 8);
      });
      ripples.forEach((r) => {
        const age = now - r.t0;
        if (age < 0) return;
        fx.globalAlpha = (1 - age / r.life) * 0.65 * Math.min(1, s);
        fx.strokeStyle = ctx.colors.acc;
        fx.lineWidth = 1.5;
        fx.beginPath();
        fx.arc(r.x, r.y, age * 0.34, 0, TAU);
        fx.stroke();
      });
      fx.globalAlpha = 1;
    },
    still() {
      engine.frame(performance.now(), ctx.strength(), 16.7);
    },
  };

  return engine;
}
