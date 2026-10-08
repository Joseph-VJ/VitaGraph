  /* =====================================================================
     THE LIVING BACKGROUND: four engines
     ===================================================================== */
  const fc = $("field"), fx = fc.getContext("2d");
  const BG = { W: 0, H: 0, dpr: 1, engine: "warp", str: "soft", playing: false, force: "attract", lastDraw: 0, frames: 0, fpsT: 0, fps: 0, mouse: { x: -9999, y: -9999, on: false, down: false, vx: 0, vy: 0 } };
  const EV = { think: false, upload: null, stage: -1 };
  const STAGES = ["Parse", "Read scans", "Cut", "Embed", "Index"];
  const strength = () => (BG.playing ? 1.35 : BG.str === "full" ? 1 : BG.str === "soft" ? 0.55 : 0);
  const areaK = () => clamp((BG.W * BG.H) / 1300000, 0.35, 1.5);
  function freeArea() {
    if (BG.playing || BG.W <= 960) return { x0: 0, x1: BG.W, y0: 0, y1: BG.H };
    const v = $("v-bg"); let left = !v.hidden ? v.getBoundingClientRect().right + 24 : BG.W * 0.45;
    left = Math.min(left, BG.W * 0.72);
    return { x0: left, x1: BG.W, y0: 76, y1: BG.H - 40 };
  }

  // smooth 2D noise (Perlin) for the currents
  const perm = new Uint8Array(512);
  (function () { const p = []; for (let i = 0; i < 256; i++) p.push(i); let s = 7; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); const t = p[i]; p[i] = p[j]; p[j] = t; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; })();
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function grad(h, x, y) { switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } }
  function noise2(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y), a = perm[X] + Y, b = perm[X + 1] + Y;
    return lerp(lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u), lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u), v);
  }

  /* ---- engine 1: the rubber grid ---- */
  const Warp = {
    ripples: [], wells: [], pin: false, flashT: -1e9,
    text: "The page's own 48 px grid, made of rubber. The pointer bends it and a click sends a wave through it. During an upload a scanner sweeps across and fills the cells it has read.",
    play: "Move the pointer and the grid bends. Click to send a wave. In play mode you can pin up to six gravity wells.",
    reset() { fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, fc.width, fc.height); },
    count() { return Math.ceil(BG.W / 48) + Math.ceil(BG.H / 48) + " lines" + (this.wells.length ? ", " + this.wells.length + " wells" : ""); },
    event(kind) {
      if (kind !== "done") return;
      const f = freeArea(), cxm = (f.x0 + f.x1) / 2, cym = (f.y0 + f.y1) / 2, now = performance.now();
      this.ripples.push({ x: cxm, y: cym, t0: now, amp: 30, life: 2400 }, { x: cxm, y: cym, t0: now + 260, amp: 18, life: 2000 }); this.flashT = now;
    },
    click(x, y) {
      if (BG.playing && this.pin) { if (this.wells.length < 6) this.wells.push({ x, y }); return; }
      this.ripples.push({ x, y, t0: performance.now(), amp: 18, life: 1700 });
    },
    disp(x, y, now, out) {
      let dx = 0, dy = 0;
      const m = BG.mouse, sgn = BG.force === "attract" ? 1 : -0.8;
      if (m.on) { const ex = x - m.x, ey = y - m.y, f = 0.42 * Math.exp(-(ex * ex + ey * ey) / 45000) * sgn; dx -= ex * f; dy -= ey * f; }
      for (let i = 0; i < this.wells.length; i++) { const w = this.wells[i], ex = x - w.x, ey = y - w.y, f = 0.55 * Math.exp(-(ex * ex + ey * ey) / 24200); dx -= ex * f; dy -= ey * f; }
      if (EV.think) {
        const fr = this.fr;
        for (let k = 0; k < 3; k++) { const a = now * 0.0011 + (k * TAU) / 3, ex = x - (fr.cx + Math.cos(a) * 110), ey = y - (fr.cy + Math.sin(a) * 110), f = 0.4 * Math.exp(-(ex * ex + ey * ey) / 12800); dx -= ex * f; dy -= ey * f; }
      }
      for (let i = 0; i < this.ripples.length; i++) {
        const r = this.ripples[i], age = now - r.t0; if (age < 0 || age > r.life) continue;
        const ex = x - r.x, ey = y - r.y, d = Math.hypot(ex, ey) + 0.001, w = d - age * 0.34, a = r.amp * Math.exp(-(w * w) / 3200) * (1 - age / r.life) * Math.sin(w / 15);
        dx += (ex / d) * a; dy += (ey / d) * a;
      }
      out[0] = x + dx; out[1] = y + dy;
    },
    frame(now, s) {
      const W = BG.W, H = BG.H, gap = 48, seg = 12, o = [0, 0], f = freeArea();
      this.fr = { cx: (f.x0 + f.x1) / 2, cy: (f.y0 + f.y1) / 2 };
      this.ripples = this.ripples.filter((r) => now - r.t0 < r.life);
      fx.setTransform(BG.dpr, 0, 0, BG.dpr, 0, 0); fx.clearRect(0, 0, W, H);
      const flash = clamp(1 - (now - this.flashT) / 900, 0, 1);
      fx.lineWidth = 1; fx.strokeStyle = flash > 0 ? C.acc : C.ink; fx.globalAlpha = (0.17 + flash * 0.25) * s;
      fx.beginPath();
      for (let x = 0; x <= W + gap; x += gap) for (let y = -gap; y <= H + gap; y += seg) { this.disp(x, y, now, o); y === -gap ? fx.moveTo(o[0], o[1]) : fx.lineTo(o[0], o[1]); }
      for (let y = 0; y <= H + gap; y += gap) for (let x = -gap; x <= W + gap; x += seg) { this.disp(x, y, now, o); x === -gap ? fx.moveTo(o[0], o[1]) : fx.lineTo(o[0], o[1]); }
      fx.stroke();
      const m = BG.mouse;
      if (m.on) {
        fx.strokeStyle = C.ink; fx.lineWidth = 1.2;
        const gx0 = Math.floor((m.x - 200) / gap) * gap, gy0 = Math.floor((m.y - 200) / gap) * gap;
        for (let x = gx0; x <= m.x + 200; x += gap) for (let y = gy0; y <= m.y + 200; y += gap) {
          const d = Math.hypot(x - m.x, y - m.y); if (d > 200) continue;
          this.disp(x, y, now, o); fx.globalAlpha = (1 - d / 200) * 0.7 * Math.min(1, s * 1.3);
          fx.beginPath(); fx.moveTo(o[0] - 4, o[1]); fx.lineTo(o[0] + 4, o[1]); fx.moveTo(o[0], o[1] - 4); fx.lineTo(o[0], o[1] + 4); fx.stroke();
        }
      }
      if (EV.upload) {
        const p = clamp((now - EV.upload.t0) / 6500, 0, 1), bx = f.x0 + (f.x1 - f.x0) * p;
        for (let x = Math.floor(f.x0 / gap) * gap; x < bx; x += gap) for (let y = Math.floor(f.y0 / gap) * gap; y < f.y1; y += gap) {
          const hsh = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, rr = hsh - Math.floor(hsh);
          if (rr < 0.24) { this.disp(x + gap / 2, y + gap / 2, now, o); const fresh = bx - x < gap * 1.5; fx.globalAlpha = (fresh ? 0.75 : 0.2) * Math.min(1, s * 1.5); fx.fillStyle = fresh ? C.acc : C.ink; fx.fillRect(o[0] - 8, o[1] - 8, 16, 16); }
        }
        fx.globalAlpha = 0.9; fx.strokeStyle = C.acc; fx.lineWidth = 2; fx.beginPath(); fx.moveTo(bx, f.y0); fx.lineTo(bx, f.y1); fx.stroke();
        fx.font = "800 11px " + FONT; fx.fillStyle = C.acc; fx.fillText(("Reading · " + STAGES[Math.max(0, EV.stage)]).toUpperCase(), Math.min(bx + 8, f.x1 - 170), f.y0 + 20);
      }
      if (EV.think) for (let k = 0; k < 3; k++) { const a = now * 0.0011 + (k * TAU) / 3; fx.globalAlpha = 0.95; fx.fillStyle = C.acc; fx.fillRect(this.fr.cx + Math.cos(a) * 110 - 4, this.fr.cy + Math.sin(a) * 110 - 4, 8, 8); }
      this.wells.forEach((w) => { fx.globalAlpha = 1; fx.fillStyle = C.acc; fx.fillRect(w.x - 4, w.y - 4, 8, 8); });
      this.ripples.forEach((r) => { const age = now - r.t0; if (age < 0) return; fx.globalAlpha = (1 - age / r.life) * 0.35 * Math.min(1, s * 1.5); fx.strokeStyle = C.acc; fx.lineWidth = 1; fx.beginPath(); fx.arc(r.x, r.y, age * 0.34, 0, TAU); fx.stroke(); });
      fx.globalAlpha = 1;
    },
    still() { this.frame(performance.now(), strength()); }
  };

  /* ---- engine 2: ink currents ---- */
  const Flow = {
    max: 4200, n: 0, storm: false, paint: false, red: false,
    text: "Thousands of ink threads on a slow current. The pointer stirs a whirlpool and a click throws ink outward. While the agent thinks, the current curls into a vortex; during an upload it streams through the five stages.",
    play: "Stir the current with the pointer, click to throw ink. In play mode, Storm speeds it up, Paint lets you drag the current where you want, and Red ink colours what you paint.",
    init() {
      this.x = new Float32Array(this.max); this.y = new Float32Array(this.max); this.vx = new Float32Array(this.max); this.vy = new Float32Array(this.max);
      this.life = new Float32Array(this.max); this.hot = new Uint8Array(this.max); this.seg = new Float32Array(this.max * 4);
      this.buf = document.createElement("canvas"); this.bx = this.buf.getContext("2d");
    },
    resize() { this.buf.width = fc.width; this.buf.height = fc.height; this.setCount(); },
    setCount() { const base = BG.playing ? 3400 : BG.str === "full" ? 2400 : 1000; this.n = Math.min(this.max, Math.round(base * areaK())); for (let i = 0; i < this.n; i++) this.spawn(i, true); },
    reset() { this.bx.setTransform(1, 0, 0, 1, 0, 0); this.bx.clearRect(0, 0, this.buf.width, this.buf.height); this.setCount(); },
    count() { return this.n + " threads"; },
    spawn(i, anywhere) { this.x[i] = Math.random() * BG.W; this.y[i] = Math.random() * BG.H; this.vx[i] = 0; this.vy[i] = 0; this.life[i] = anywhere ? Math.random() * 300 : 120 + Math.random() * 260; this.hot[i] = Math.random() < (this.red ? 0.5 : 0.04) ? 1 : 0; },
    angle(x, y, now) {
      let a = noise2(x * 0.0016 + now * 0.000012, y * 0.0016 - now * 0.000008) * TAU * 1.15;
      if (EV.think) { const dx = x - this.fr.cx, dy = y - this.fr.cy, d = Math.hypot(dx, dy), w = clamp(1 - d / 520, 0, 1) * 0.92, va = Math.atan2(dy, dx) + Math.PI / 2 + 0.42; a = Math.atan2(Math.sin(a) * (1 - w) + Math.sin(va) * w, Math.cos(a) * (1 - w) + Math.cos(va) * w); }
      if (EV.upload) a = Math.atan2(Math.sin(a) * 0.14, Math.cos(a) * 0.14 + 0.86);
      return a;
    },
    event(kind) {
      if (kind !== "done") return;
      const f = freeArea(), ccx = (f.x0 + f.x1) / 2, ccy = (f.y0 + f.y1) / 2;
      for (let i = 0; i < this.n; i++) { const dx = this.x[i] - ccx, dy = this.y[i] - ccy, d = Math.hypot(dx, dy) + 1; if (d < 520) { const p = (1 - d / 520) * 9; this.vx[i] += (dx / d) * p; this.vy[i] += (dy / d) * p; if (Math.random() < 0.4) this.hot[i] = 1; } }
    },
    click(x, y) { for (let i = 0; i < this.n; i++) { const dx = this.x[i] - x, dy = this.y[i] - y, d = Math.hypot(dx, dy) + 1; if (d < 180) { const p = (1 - d / 180) * 7; this.vx[i] += (dx / d) * p; this.vy[i] += (dy / d) * p; if (Math.random() < 0.3) this.hot[i] = 1; } } },
    frame(now, s, dt) {
      const b = this.bx, k = dt / 16.7, m = BG.mouse, W = BG.W, H = BG.H, maxV = (this.storm ? 3.4 : 1.4) * (BG.playing ? 1.2 : 1), f = freeArea();
      this.fr = { cx: (f.x0 + f.x1) / 2, cy: (f.y0 + f.y1) / 2 };
      b.setTransform(BG.dpr, 0, 0, BG.dpr, 0, 0);
      b.globalCompositeOperation = "destination-out"; b.globalAlpha = this.storm ? 0.045 : 0.07; b.fillRect(0, 0, W, H); b.globalCompositeOperation = "source-over";
      const gates = EV.upload ? STAGES.map((n, i) => f.x0 + ((f.x1 - f.x0) * (i + 0.6)) / 5.4) : null;
      let ni = 0; const seg = this.seg, hotSeg = [], damp = Math.pow(0.93, k);
      for (let i = 0; i < this.n; i++) {
        const px = this.x[i], py = this.y[i], a = this.angle(px, py, now);
        this.vx[i] += Math.cos(a) * 0.13 * k; this.vy[i] += Math.sin(a) * 0.13 * k;
        if (m.on) {
          const ex = px - m.x, ey = py - m.y, d = Math.hypot(ex, ey) + 1;
          if (this.paint && m.down && d < 90) { this.vx[i] += m.vx * 0.12; this.vy[i] += m.vy * 0.12; if (this.red) this.hot[i] = 1; }
          else if (d < 190) { const fo = (1 - d / 190) * 0.5 * (BG.force === "attract" ? 1 : -1); this.vx[i] += (-ey / d) * fo - (ex / d) * fo * 0.25; this.vy[i] += (ex / d) * fo - (ey / d) * fo * 0.25; }
        }
        this.vx[i] *= damp; this.vy[i] *= damp;
        const sp = Math.hypot(this.vx[i], this.vy[i]), lim = maxV * 5; if (sp > lim) { this.vx[i] *= lim / sp; this.vy[i] *= lim / sp; }
        const vs = sp > maxV ? Math.max(maxV, sp * 0.96) / sp : 1;
        this.x[i] += this.vx[i] * vs * k; this.y[i] += this.vy[i] * vs * k; this.life[i] -= k;
        if (gates && px < gates[EV.stage] && this.x[i] >= gates[EV.stage]) this.hot[i] = 1;
        if (this.life[i] <= 0 || this.x[i] < -10 || this.x[i] > W + 10 || this.y[i] < -10 || this.y[i] > H + 10) { this.spawn(i, false); continue; }
        if (this.hot[i]) hotSeg.push(px, py, this.x[i], this.y[i]); else { seg[ni++] = px; seg[ni++] = py; seg[ni++] = this.x[i]; seg[ni++] = this.y[i]; }
      }
      b.lineWidth = 1; b.strokeStyle = C.ink; b.globalAlpha = 0.3 * Math.min(1.2, s); b.beginPath();
      for (let j = 0; j < ni; j += 4) { b.moveTo(seg[j], seg[j + 1]); b.lineTo(seg[j + 2], seg[j + 3]); }
      b.stroke();
      b.strokeStyle = C.acc; b.globalAlpha = 0.85 * Math.min(1, s * 1.4); b.lineWidth = 1.2; b.beginPath();
      for (let j = 0; j < hotSeg.length; j += 4) { b.moveTo(hotSeg[j], hotSeg[j + 1]); b.lineTo(hotSeg[j + 2], hotSeg[j + 3]); }
      b.stroke();
      fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, fc.width, fc.height); fx.globalAlpha = 1; fx.drawImage(this.buf, 0, 0);
      fx.setTransform(BG.dpr, 0, 0, BG.dpr, 0, 0);
      if (gates) {
        fx.font = "800 11px " + FONT; fx.textAlign = "center";
        gates.forEach((gx, g) => {
          const act = g === EV.stage, done = g < EV.stage;
          fx.globalAlpha = act ? 0.9 : done ? 0.45 : 0.2; fx.strokeStyle = act ? C.acc : C.ink; fx.lineWidth = act ? 2 : 1;
          fx.beginPath(); fx.moveTo(gx, f.y0 + 40); fx.lineTo(gx, f.y1 - 30); fx.stroke();
          fx.fillStyle = act ? C.acc : C.ink; fx.fillText(STAGES[g].toUpperCase(), gx, f.y0 + 30);
        });
        fx.textAlign = "start";
      }
      if (EV.think) { fx.globalAlpha = 0.9; fx.fillStyle = C.acc; fx.fillRect(this.fr.cx - 4, this.fr.cy - 4, 8, 8); }
      fx.globalAlpha = 1;
    },
    still() {
      const f = freeArea(); this.fr = { cx: (f.x0 + f.x1) / 2, cy: (f.y0 + f.y1) / 2 };
      fx.setTransform(BG.dpr, 0, 0, BG.dpr, 0, 0); fx.clearRect(0, 0, BG.W, BG.H);
      fx.strokeStyle = C.ink; fx.globalAlpha = 0.18 * strength(); fx.lineWidth = 1; fx.beginPath();
      for (let i = 0; i < 700; i++) { let x = Math.random() * BG.W, y = Math.random() * BG.H; fx.moveTo(x, y); for (let s = 0; s < 34; s++) { const a = this.angle(x, y, 0); x += Math.cos(a) * 4; y += Math.sin(a) * 4; fx.lineTo(x, y); } }
      fx.stroke(); fx.globalAlpha = 1;
    }
  };

  /* ---- engine 3: constellation ---- */
  const Stars = {
    parts: [], form: "free", drag: null, ripples: [], lastThink: 0,
    text: "Dots that link to their neighbours, like a sky of data. They can line up as the shape of your real graph, and during an upload they gather at the five stages.",
    play: "The pointer pulls the dots and a click adds one. In play mode you can drag and fling them, or tidy them into the graph.",
    target() { return Math.round((BG.playing ? 150 : BG.str === "full" ? 120 : 64) * areaK()); },
    mk(x, y) { const a = Math.random() * TAU, s = 0.1 + Math.random() * 0.3; return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 1.6 + Math.random() * 1.8, tx: x, ty: y, flash: 0, node: -1 }; },
    setCount() { const want = BG.playing ? Math.max(this.target(), this.parts.length) : this.target(); while (this.parts.length < want) this.parts.push(this.mk(Math.random() * BG.W, Math.random() * BG.H)); while (this.parts.length > want) this.parts.pop(); if (this.form === "graph") this.graph(); },
    reset() { this.setCount(); }, resize() { if (this.form === "graph") this.graph(); },
    count() { return this.parts.length + " dots"; },
    graph() {
      while (this.parts.length < N + 10) this.parts.push(this.mk(Math.random() * BG.W, Math.random() * BG.H));
      // the orbit layout, tilted: rings of reports, sections, biomarkers and values around the person
      const f = freeArea(), cxm = (f.x0 + f.x1) / 2, cym = (f.y0 + f.y1) / 2, S = Math.min((f.x1 - f.x0) / 3.2, (f.y1 - f.y0) / 2.9), c = Math.cos(0.62), s = Math.sin(0.62), cy = Math.cos(0.3), sy = Math.sin(0.3);
      this.pj = (q) => { const x1 = q[0] * cy + q[2] * sy, z1 = -q[0] * sy + q[2] * cy, y2 = q[1] * c - z1 * s, z2 = q[1] * s + z1 * c, k = F / (F + z2); return [cxm + x1 * S * k, cym + y2 * S * k]; };
      nodes.forEach((n, i) => { const t = this.pj(LAY.orbits[i]), p = this.parts[i]; p.node = i; p.tx = t[0]; p.ty = t[1]; });
      for (let i = N; i < this.parts.length; i++) { const e = TREE[Math.floor(Math.random() * TREE.length)], A = this.parts[byId[e[0]].idx], B = this.parts[byId[e[1]].idx], t = 0.15 + Math.random() * 0.7, p = this.parts[i]; p.node = -1; p.tx = A.tx + (B.tx - A.tx) * t; p.ty = A.ty + (B.ty - A.ty) * t; }
      this.form = "graph";
    },
    event(kind) {
      if (kind !== "done") return;
      const f = freeArea(), ccx = (f.x0 + f.x1) / 2, ccy = (f.y0 + f.y1) / 2;
      this.form = "free"; this.ripples.push({ x: ccx, y: ccy, t0: performance.now() });
      this.parts.forEach((p) => { p.flash = 1; p.vx += (p.x - ccx) * 0.004; p.vy += (p.y - ccy) * 0.004; });
    },
    click(x, y) {
      if (BG.playing) { let best = null, bd = 18; this.parts.forEach((p) => { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }); if (best) { this.drag = best; best.flash = 1; return; } }
      if (this.parts.length < 200) { const p = this.mk(x, y); p.flash = 1; this.parts.push(p); this.ripples.push({ x, y, t0: performance.now() }); }
    },
    frame(now, s, dt) {
      const k = dt / 16.7, m = BG.mouse, P = this.parts, f = freeArea(), stageX = (g) => f.x0 + ((f.x1 - f.x0) * (g + 0.6)) / 5.4;
      if (EV.think && now - this.lastThink > 650 && P.length) { this.lastThink = now; const p0 = P[Math.floor(Math.random() * P.length)]; this.ripples.push({ x: p0.x, y: p0.y, t0: now }); }
      P.forEach((p, i) => {
        if (this.drag === p) return;
        if (EV.upload) { const g = i % 5, tx = stageX(g), ty = f.y0 + 60 + (((i * 37) % 100) / 100) * (f.y1 - f.y0 - 120); p.vx += (tx - p.x) * 0.012 * k; p.vy += (ty - p.y) * 0.012 * k; p.vx *= Math.pow(0.88, k); p.vy *= Math.pow(0.88, k); if (g === EV.stage) p.flash = Math.max(p.flash, 0.5); }
        else if (this.form === "graph") { p.vx += (p.tx - p.x) * 0.012 * k; p.vy += (p.ty - p.y) * 0.012 * k; p.vx *= Math.pow(0.88, k); p.vy *= Math.pow(0.88, k); }
        else { p.vx += (Math.random() - 0.5) * 0.03 * k; p.vy += (Math.random() - 0.5) * 0.03 * k; const sp = Math.hypot(p.vx, p.vy), mx = BG.playing ? 0.8 : 0.45; if (sp > mx) { p.vx *= mx / sp; p.vy *= mx / sp; } }
        if (m.on) { const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy); if (d < 160 && d > 1) { const fo = (1 - d / 160) * 0.5 * (BG.playing ? 2 : 1) * (BG.force === "attract" ? 1 : -1) * k; p.vx += (dx / d) * fo; p.vy += (dy / d) * fo; } }
        p.x += p.vx * k; p.y += p.vy * k;
        if (this.form === "free" && !EV.upload) { if (p.x < -20) p.x = BG.W + 20; else if (p.x > BG.W + 20) p.x = -20; if (p.y < -20) p.y = BG.H + 20; else if (p.y > BG.H + 20) p.y = -20; }
        p.flash *= Math.pow(0.97, k);
      });
      this.ripples = this.ripples.filter((r) => now - r.t0 < 1600);
      this.ripples.forEach((r) => { const rad = Math.max(0, (now - r.t0) * 0.22); P.forEach((p) => { if (Math.abs(Math.hypot(p.x - r.x, p.y - r.y) - rad) < 14) p.flash = Math.max(p.flash, 0.9); }); });
      fx.setTransform(BG.dpr, 0, 0, BG.dpr, 0, 0); fx.clearRect(0, 0, BG.W, BG.H); fx.lineWidth = 1;
      const L = BG.playing ? 150 : 125, la = 0.32 * s;
      if (this.form === "graph" && !EV.upload) {
        // faint orbit rings, the cross-links barely there, and the tree that holds it together drawn firmly
        fx.strokeStyle = C.ink; fx.globalAlpha = Math.min(1, la * 0.5);
        [0.4, 0.82, 1.1, 1.4].forEach((R) => { fx.beginPath(); for (let i = 0; i <= 72; i++) { const a = (i / 72) * TAU, p = this.pj([R * Math.cos(a), 0.02, R * Math.sin(a)]); i ? fx.lineTo(p[0], p[1]) : fx.moveTo(p[0], p[1]); } fx.stroke(); });
        fx.globalAlpha = Math.min(1, la * 0.45); fx.beginPath();
        edges.forEach((e) => { if (TREEKEY[e.a + "|" + e.b]) return; const A = P[byId[e.a].idx], B = P[byId[e.b].idx]; fx.moveTo(A.x, A.y); fx.lineTo(B.x, B.y); }); fx.stroke();
        fx.globalAlpha = Math.min(1, la * 2.2); fx.lineWidth = 1.2; fx.beginPath();
        TREE.forEach((e) => { const A = P[byId[e[0]].idx], B = P[byId[e[1]].idx]; fx.moveTo(A.x, A.y); fx.lineTo(B.x, B.y); }); fx.stroke(); fx.lineWidth = 1;
      } else {
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
          const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d2 = dx * dx + dy * dy;
          if (d2 < L * L) { const a = 1 - Math.sqrt(d2) / L, hot = P[i].flash > 0.4 && P[j].flash > 0.4; fx.globalAlpha = Math.min(1, a * (hot ? 0.75 : la)); fx.strokeStyle = hot ? C.acc : C.ink; fx.beginPath(); fx.moveTo(P[i].x, P[i].y); fx.lineTo(P[j].x, P[j].y); fx.stroke(); }
        }
      }
      this.ripples.forEach((r) => { const t = clamp((now - r.t0) / 1600, 0, 1); fx.globalAlpha = (1 - t) * 0.5; fx.strokeStyle = C.acc; fx.lineWidth = 1.5; fx.beginPath(); fx.arc(r.x, r.y, Math.max(0, (now - r.t0) * 0.22), 0, TAU); fx.stroke(); });
      P.forEach((p, i) => {
        const red = p.flash > 0.25 || i === 0; fx.globalAlpha = clamp(red ? 0.95 : 0.55 * s, 0, 1); fx.fillStyle = red ? C.acc : C.ink;
        const r = p.r * (i === 0 ? 2.4 : 1) * (1 + p.flash * 0.8);
        if (this.form === "graph" && p.node >= 0 && nodes[p.node].k === "section") fx.fillRect(p.x - r, p.y - r, r * 2, r * 2); else { fx.beginPath(); fx.arc(p.x, p.y, r, 0, TAU); fx.fill(); }
      });
      if (EV.upload) { fx.font = "800 11px " + FONT; fx.textAlign = "center"; STAGES.forEach((n, g) => { fx.globalAlpha = g === EV.stage ? 0.95 : 0.4; fx.fillStyle = g === EV.stage ? C.acc : C.ink; fx.fillText(n.toUpperCase(), stageX(g), f.y0 + 30); }); fx.textAlign = "start"; }
      fx.globalAlpha = 1;
    },
    still() { this.frame(performance.now(), strength(), 16.7); }
  };

  /* ---- engine 4: living type ---- */
  const TYPE_SPLIT = { VITAGRAPH: ["VITA", "GRAPH"], THINKING: ["THINK", "ING"], PARSING: ["PARS", "ING"], READING: ["READ", "ING"], CUTTING: ["CUT", "TING"], EMBEDDING: ["EMBED", "DING"], INDEXING: ["INDEX", "ING"], HEMOGLOBIN: ["HEMO", "GLOBIN"], CHOLESTEROL: ["CHOLES", "TEROL"] };
  const TypeE = {
    max: 3600, n: 0, word: "VITAGRAPH", ripple: [], gap: 4,
    text: "The dots spell what the app is doing: THINKING while the agent works, then PARSING, READING, CUTTING, EMBEDDING and INDEXING during an upload, and READY at the end.",
    play: "Push through the letters and watch them heal. Click for a shockwave. In play mode you can type your own word.",
    init() { this.x = new Float32Array(this.max); this.y = new Float32Array(this.max); this.vx = new Float32Array(this.max); this.vy = new Float32Array(this.max); this.tx = new Float32Array(this.max); this.ty = new Float32Array(this.max); this.has = new Uint8Array(this.max); this.hot = new Uint8Array(this.max); this.oc = document.createElement("canvas"); },
    setCount() { const nn = Math.min(this.max, Math.round((BG.playing ? 3200 : BG.str === "full" ? 2000 : 1000) * areaK())); for (let i = this.n; i < nn; i++) { this.x[i] = Math.random() * BG.W; this.y[i] = Math.random() * BG.H; this.vx[i] = 0; this.vy[i] = 0; this.hot[i] = Math.random() < 0.05 ? 1 : 0; } this.n = nn; this.sample(); },
    reset() { this.setCount(); }, resize() { this.sample(); },
    count() { return this.n + " dots"; },
    setWord(w) { this.word = (w || "VITAGRAPH").toUpperCase().slice(0, 12); this.sample(); },
    sample() {
      if (!this.n) return;
      const f = freeArea(), fw = Math.max(80, Math.floor(f.x1 - f.x0 - 40)), fh = Math.max(80, Math.floor(f.y1 - f.y0 - 40));
      this.oc.width = fw; this.oc.height = fh; const o = this.oc.getContext("2d", { willReadFrequently: true });
      // in a tall, narrow space a long word goes on two lines so the letters stay big
      const wd = this.word, half = Math.ceil(wd.length / 2);
      const lines = fh / fw > 1.05 && wd.length > 5 ? TYPE_SPLIT[wd] || [wd.slice(0, half), wd.slice(half)] : [wd];
      let fs = Math.min(fh * 0.42, (fh * 0.8) / (lines.length * 0.92)); o.font = "800 " + fs + "px " + FONT;
      const w = Math.max(...lines.map((l) => o.measureText(l).width));
      if (w > fw * 0.9) fs *= (fw * 0.9) / w;
      o.clearRect(0, 0, fw, fh); o.fillStyle = "#000"; o.font = "800 " + fs + "px " + FONT; o.textAlign = "center"; o.textBaseline = "middle";
      lines.forEach((l, i) => o.fillText(l, fw / 2, fh / 2 + (i - (lines.length - 1) / 2) * fs * 0.92));
      const data = o.getImageData(0, 0, fw, fh).data;
      let gap = 3, pts = [];
      for (; gap < 14; gap++) { pts = []; for (let y = 0; y < fh; y += gap) for (let x = 0; x < fw; x += gap) if (data[(y * fw + x) * 4 + 3] > 128) pts.push(x, y); if (pts.length / 2 <= this.n * 0.92) break; }
      const cnt = pts.length / 2, order = Array.from({ length: cnt }, (_, i) => i);
      for (let i = cnt - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
      for (let i = 0; i < this.n; i++) {
        if (i < cnt) { const p = order[i]; this.has[i] = 1; this.tx[i] = f.x0 + 20 + pts[p * 2]; this.ty[i] = f.y0 + 20 + pts[p * 2 + 1]; } else this.has[i] = 0;
      }
      this.gap = gap;
    },
    event(kind) {
      if (kind === "think") this.setWord(EV.think ? "THINKING" : "VITAGRAPH");
      if (kind === "stage") this.setWord(["PARSING", "READING", "CUTTING", "EMBEDDING", "INDEXING"][EV.stage] || "READING");
      if (kind === "done") { this.setWord("READY"); const f = freeArea(); this.click((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, 2.2); setTimeout(() => { if (!EV.think && !EV.upload && BG.engine === "type" && !BG.playing) this.setWord("VITAGRAPH"); }, 3600); }
    },
    click(x, y, power) {
      const pw = power || 1, R = 260 * pw;
      for (let i = 0; i < this.n; i++) { const dx = this.x[i] - x, dy = this.y[i] - y, d = Math.hypot(dx, dy) + 1; if (d < R) { const p = (1 - d / R) * 14 * pw; this.vx[i] += (dx / d) * p; this.vy[i] += (dy / d) * p; } }
      this.ripple.push({ x, y, t0: performance.now() });
    },
    frame(now, s, dt) {
      const k = dt / 16.7, m = BG.mouse, R = BG.playing ? 130 : 100;
      fx.setTransform(BG.dpr, 0, 0, BG.dpr, 0, 0); fx.clearRect(0, 0, BG.W, BG.H);
      const ink = new Path2D(), red = new Path2D(), dust = new Path2D(), sz = Math.max(1.6, Math.min(4.5, this.gap * 0.6)), damp = Math.pow(0.82, k);
      for (let i = 0; i < this.n; i++) {
        let x = this.x[i], y = this.y[i];
        if (this.has[i]) { this.vx[i] += (this.tx[i] - x) * 0.05 * k; this.vy[i] += (this.ty[i] - y) * 0.05 * k; this.vx[i] *= damp; this.vy[i] *= damp; if (EV.think) { this.vx[i] += (Math.random() - 0.5) * 0.4; this.vy[i] += (Math.random() - 0.5) * 0.4; } }
        else { const a = noise2(x * 0.004 + now * 0.00005, y * 0.004) * TAU; this.vx[i] += Math.cos(a) * 0.02 * k; this.vy[i] += Math.sin(a) * 0.02 * k; this.vx[i] *= 0.98; this.vy[i] *= 0.98; }
        if (m.on) { const dx = x - m.x, dy = y - m.y, d = Math.hypot(dx, dy) + 1; if (d < R) { const fo = (1 - d / R) * 3.2 * k; this.vx[i] += (dx / d) * fo; this.vy[i] += (dy / d) * fo; } }
        x += this.vx[i] * k; y += this.vy[i] * k;
        if (!this.has[i]) { if (x < 0) x += BG.W; if (x > BG.W) x -= BG.W; if (y < 0) y += BG.H; if (y > BG.H) y -= BG.H; }
        this.x[i] = x; this.y[i] = y;
        (this.has[i] ? (this.hot[i] ? red : ink) : dust).rect(x - sz / 2, y - sz / 2, sz, sz);
      }
      fx.globalAlpha = 0.16 * s; fx.fillStyle = C.ink; fx.fill(dust);
      fx.globalAlpha = Math.min(1, 0.9 * s); fx.fill(ink);
      fx.globalAlpha = Math.min(1, 1.3 * s); fx.fillStyle = C.acc; fx.fill(red);
      this.ripple = this.ripple.filter((r) => now - r.t0 < 1400);
      this.ripple.forEach((r) => { const t = (now - r.t0) / 1400; fx.globalAlpha = (1 - t) * 0.5; fx.strokeStyle = C.acc; fx.lineWidth = 1.5; fx.beginPath(); fx.arc(r.x, r.y, Math.max(0, (now - r.t0) * 0.3), 0, TAU); fx.stroke(); });
      fx.globalAlpha = 1;
    },
    still() { for (let i = 0; i < this.n; i++) if (this.has[i]) { this.x[i] = this.tx[i]; this.y[i] = this.ty[i]; this.vx[i] = 0; this.vy[i] = 0; } this.frame(performance.now(), strength(), 0); }
  };

  const ENG = { warp: Warp, flow: Flow, stars: Stars, type: TypeE };
  Flow.init(); TypeE.init();
  const eng = () => ENG[BG.engine];
  function resizeF() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5), w = window.innerWidth, h = window.innerHeight;
    BG.dpr = dpr; BG.W = w; BG.H = h;
    if (fc.width !== Math.round(w * dpr) || fc.height !== Math.round(h * dpr)) { fc.width = Math.round(w * dpr); fc.height = Math.round(h * dpr); }
    Flow.resize(); TypeE.resize(); Stars.resize();
  }

  /* ---- events from the app (simulated here) ---- */
  const say = (t) => ($("evstate").textContent = t);
  function ensureOn() { if (BG.str === "off" && !BG.playing) setStrength("soft"); }
  function evThink(force) {
    EV.think = force !== undefined ? force : !EV.think; EV.upload = null; EV.stage = -1;
    $("ev-think").setAttribute("aria-pressed", String(EV.think)); say(EV.think ? "The agent is thinking" : "Idle");
    ensureOn(); if (eng().event) eng().event("think"); if (REDUCE) eng().still();
  }
  function evUpload() {
    if (EV.think) evThink(false);
    EV.upload = { t0: performance.now() }; EV.stage = 0; say("Upload: " + STAGES[0]); ensureOn();
    if (eng().event) eng().event("stage"); if (REDUCE) eng().still();
  }
  function evDone() {
    if (EV.think) evThink(false);
    EV.upload = null; EV.stage = -1; ensureOn(); if (eng().event) eng().event("done"); say("Scan finished");
    setTimeout(() => { if (!EV.think && !EV.upload) say("Idle"); }, 3400);
    if (REDUCE) eng().still();
  }
  $("ev-think").addEventListener("click", () => evThink());
  $("ev-up").addEventListener("click", evUpload);
  $("ev-done").addEventListener("click", evDone);

  /* ---- switches ---- */
  function status() {
    $("pb-count").textContent = eng().count();
    const names = { warp: "Rubber grid", flow: "Ink currents", stars: "Constellation", type: "Living type" };
    $("fps").textContent = "Background: " + names[BG.engine] + " · " + (BG.str === "off" && !BG.playing ? "Off" : (BG.playing ? "Play" : BG.str === "full" ? "Full" : "Soft") + " · " + eng().count() + (REDUCE ? " · still (reduced motion)" : BG.fps ? " · " + BG.fps + " frames a second" : ""));
  }
  function setEngine(name) {
    BG.engine = name;
    document.querySelectorAll("[data-engine]").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-engine") === name)));
    document.querySelectorAll("[data-pengine]").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-pengine") === name)));
    document.querySelectorAll("[data-tools]").forEach((t) => (t.hidden = t.getAttribute("data-tools") !== name));
    $("engDesc").textContent = eng().text; $("engPlay").textContent = eng().play;
    fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, fc.width, fc.height);
    eng().reset();
    if (name === "type") TypeE.setWord(EV.think ? "THINKING" : EV.upload ? "READING" : BG.playing ? $("pb-word").value || "VITAGRAPH" : "VITAGRAPH");
    status(); if (REDUCE) eng().still();
  }
  document.querySelectorAll("[data-engine]").forEach((b) => b.addEventListener("click", () => setEngine(b.getAttribute("data-engine"))));
  document.querySelectorAll("[data-pengine]").forEach((b) => b.addEventListener("click", () => setEngine(b.getAttribute("data-pengine"))));
  function setStrength(s) {
    BG.str = s;
    document.querySelectorAll("[data-str]").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-str") === s)));
    fc.style.display = s === "off" && !BG.playing ? "none" : "block";
    if (eng().setCount) eng().setCount();
    status(); if (REDUCE) eng().still();
  }
  document.querySelectorAll("[data-str]").forEach((b) => b.addEventListener("click", () => setStrength(b.getAttribute("data-str"))));
  function setForce(f) {
    BG.force = f;
    $("pt-attract").setAttribute("aria-pressed", String(f === "attract")); $("pt-repel").setAttribute("aria-pressed", String(f === "repel"));
    $("pb-pull").textContent = f === "attract" ? "Pull" : "Push";
  }
  $("pt-attract").addEventListener("click", () => setForce("attract"));
  $("pt-repel").addEventListener("click", () => setForce("repel"));
  $("pb-pull").addEventListener("click", () => setForce(BG.force === "attract" ? "repel" : "attract"));
  const toggle = (id, obj, key) => $(id).addEventListener("click", () => { obj[key] = !obj[key]; $(id).setAttribute("aria-pressed", String(obj[key])); });
  toggle("pb-wells", Warp, "pin"); toggle("pb-storm", Flow, "storm"); toggle("pb-paint", Flow, "paint"); toggle("pb-red", Flow, "red");
  $("pb-clear").addEventListener("click", () => { Warp.wells = []; status(); });
  $("pb-tidy").addEventListener("click", () => Stars.graph());
  $("pb-free").addEventListener("click", () => (Stars.form = "free"));
  $("pb-add").addEventListener("click", () => { for (let i = 0; i < 10; i++) Stars.parts.push(Stars.mk(BG.W * (0.2 + Math.random() * 0.6), BG.H * (0.2 + Math.random() * 0.6))); status(); });
  $("pb-form").addEventListener("click", () => TypeE.setWord($("pb-word").value));
  $("pb-word").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); TypeE.setWord(e.target.value); } });

  function enterPlay() {
    if (BG.playing) return; BG.playing = true; document.body.classList.add("playing"); fc.style.display = "block";
    if (eng().setCount) eng().setCount();
    if (BG.engine === "type") TypeE.setWord($("pb-word").value || "VITAGRAPH");
    if (BG.engine === "stars" && Stars.form === "graph") Stars.graph();
    status(); $("pb-exit").focus(); if (REDUCE) eng().still();
  }
  function exitPlay() {
    if (!BG.playing) return; BG.playing = false; document.body.classList.remove("playing"); Stars.drag = null;
    fc.style.display = BG.str === "off" ? "none" : "block";
    if (eng().setCount) eng().setCount();
    if (BG.engine === "type") TypeE.setWord(EV.think ? "THINKING" : "VITAGRAPH");
    status(); $("playBtn").focus(); if (REDUCE) eng().still();
  }
  $("playBtn").addEventListener("click", enterPlay); $("playBtn2").addEventListener("click", enterPlay); $("pb-exit").addEventListener("click", exitPlay);

  // the pointer is followed everywhere; a click on empty page (or anywhere in play mode) goes to the engine
  window.addEventListener("pointermove", (e) => {
    const m = BG.mouse; m.vx = e.clientX - m.x; m.vy = e.clientY - m.y; m.x = e.clientX; m.y = e.clientY; m.on = true;
    if (Stars.drag) { const p = Stars.drag; p.vx = (e.clientX - p.x) * 0.6; p.vy = (e.clientY - p.y) * 0.6; p.x = e.clientX; p.y = e.clientY; }
  });
  document.documentElement.addEventListener("mouseleave", () => (BG.mouse.on = false));
  window.addEventListener("pointerdown", (e) => {
    BG.mouse.down = true;
    if (BG.str === "off" && !BG.playing) return;
    const hit = (sel) => e.target && e.target.closest && e.target.closest(sel);
    if (!BG.playing) { if (hit("button, a, input, select, label, textarea, summary, .box2, .panel, .stage, table, .head, .foot, .side, .tip, .dossier, .modal, .playbar")) return; }
    else if (hit(".playbar")) return;
    if (eng().click) eng().click(e.clientX, e.clientY);
    status(); if (REDUCE) eng().still();
  });
  window.addEventListener("pointerup", () => { BG.mouse.down = false; Stars.drag = null; });

  function bgFrame(now) {
    if (document.hidden || REDUCE) return;
    if (BG.str === "off" && !BG.playing) return;
    if (!BG.playing && !$("v-graph").hidden) return; // the graph view covers the page: no need to draw behind it
    const cap = BG.playing || BG.str === "full" ? 60 : 30;
    if (now - BG.lastDraw < 1000 / cap - 2) return;
    const dt = BG.lastDraw ? Math.min(50, now - BG.lastDraw) : 16.7; BG.lastDraw = now;
    if (EV.upload) {
      const st = Math.min(4, Math.floor((now - EV.upload.t0) / 1300));
      if (st !== EV.stage) { EV.stage = st; say("Upload: " + STAGES[st]); if (eng().event) eng().event("stage"); }
      if (now - EV.upload.t0 > 6800) evDone();
    }
    eng().frame(now, strength(), dt);
    BG.frames++; if (now - BG.fpsT > 1000) { BG.fps = BG.frames; BG.frames = 0; BG.fpsT = now; status(); }
  }

  /* ---------- views and keys ---------- */
  const VIEWS = { graph: ["Knowledge Graph", "Click any dot. Try the layouts at the bottom of the stage."], bg: ["Living background", "Four playable layers for the space around the content."] };
  function show(name) {
    $("v-graph").hidden = name !== "graph"; $("v-bg").hidden = name !== "bg";
    $("nav-graph").setAttribute("aria-current", name === "graph" ? "page" : "false"); $("nav-bg").setAttribute("aria-current", name === "bg" ? "page" : "false");
    $("title").textContent = VIEWS[name][0]; $("subtitle").textContent = VIEWS[name][1];
    try { history.replaceState(null, "", "#" + name); } catch (e) {}
    if (name === "graph") startIntro();
    else { fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, fc.width, fc.height); if (BG.engine === "type") TypeE.sample(); if (Stars.form === "graph") Stars.graph(); if (REDUCE) eng().still(); }
  }
  $("nav-graph").addEventListener("click", () => show("graph"));
  $("nav-bg").addEventListener("click", () => show("bg"));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (BG.playing) exitPlay(); else if (!$("modal").hidden) $("modal").hidden = true; else { clearPath(); setEvid(false); select(null); } return; }
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if ((e.key === "l" || e.key === "L") && !$("v-graph").hidden && !BG.playing) setLens(!opt.lens);
  });
  window.addEventListener("resize", () => { resizeF(); if (REDUCE) eng().still(); });
  document.addEventListener("visibilitychange", () => { G.last = 0; BG.lastDraw = 0; });

  function loop(now) {
    requestAnimationFrame(loop);
    if (!document.hidden && !$("v-graph").hidden && !BG.playing) frameG(now);
    bgFrame(now);
  }

  resizeF(); setForce("attract"); setStrength("soft"); setEngine("warp");
  if (document.fonts && document.fonts.load) document.fonts.load("800 80px Archivo").then(() => TypeE.sample()).catch(() => {});
  show(/bg|background/.test(location.hash) ? "bg" : "graph");
  requestAnimationFrame(loop);
  window.__pg = { G, BG, EV, ENG, nodes, edges, opt };
