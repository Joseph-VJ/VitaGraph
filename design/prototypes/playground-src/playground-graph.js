(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;
  const REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const outCubic = (t) => 1 - Math.pow(1 - t, 3);
  const inOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const rootCss = getComputedStyle(document.documentElement);
  const tok = (n, f) => rootCss.getPropertyValue(n).trim() || f;
  const C = { ink: tok("--color-text", "#201e1d"), bg: tok("--color-bg", "#f3f2f2"), acc: tok("--color-accent", "#ec3013"), n7: tok("--color-neutral-700", "#605d5d"), n5: tok("--color-neutral-500", "#9b9797"), sf: tok("--color-surface", "#eae9e9") };
  const FONT = "Archivo, system-ui, sans-serif";

  /* =====================================================================
     SAMPLE DATA: a made-up person with three reports. Nothing is real.
     ===================================================================== */
  const KINDS = {
    person: { ord: 0, base: 11, R: 0.0, word: "Subject", many: "people" },
    report: { ord: 1, base: 12, R: 1.0, word: "Report", many: "reports" },
    section: { ord: 2, base: 7, R: 1.6, word: "Section", many: "sections" },
    bio: { ord: 3, base: 9, R: 2.15, word: "Biomarker", many: "biomarkers" },
    meas: { ord: 4, base: 5, R: 2.6, word: "Value", many: "values" },
    unc: { ord: 5, base: 9, R: 2.7, word: "Uncertain passage", many: "uncertain passages" }
  };
  const DATES = ["15 January 2025", "20 June 2025", "02 October 2025"];
  const SHORT = ["Jan 2025", "Jun 2025", "Oct 2025"];
  const GROUP_ORDER = ["lip", "met", "thy", "cbc", "vit"];
  const SECTIONS = [
    { id: "lip", name: "Lipid Profile", first: 0, reports: [0, 1, 2], bios: [
      ["Total Cholesterol", "mg/dL", [212, 198, 187], [null, 200]], ["LDL Cholesterol", "mg/dL", [134, 121, 109], [null, 100]], ["HDL Cholesterol", "mg/dL", [52, 55, 58], [40, null]] ] },
    { id: "met", name: "Metabolic Panel", first: 0, reports: [0, 1, 2], bios: [
      ["Fasting Glucose", "mg/dL", [104, 98, 94], [70, 99]], ["HbA1c", "%", [5.8, 5.6, 5.5], [null, 5.7]], ["Creatinine", "mg/dL", [0.9, 0.9, 1.0], [0.7, 1.3]] ] },
    { id: "thy", name: "Thyroid Panel", first: 1, reports: [1, 2], bios: [["TSH", "uIU/mL", [null, 2.6, 2.4], [0.4, 4.0]]] },
    { id: "cbc", name: "Complete Blood Count", first: 0, reports: [0, 1, 2], bios: [
      ["Hemoglobin", "g/dL", [13.2, 13.8, 14.1], [13.0, 17.0]], ["Ferritin", "ng/mL", [null, 48, 55], [30, 400]] ] },
    { id: "vit", name: "Vitamin Panel", first: 0, reports: [0, 2], bios: [
      ["Vitamin D", "ng/mL", [18, null, 27], [30, 100]], ["Vitamin B12", "pg/mL", [310, null, 342], [200, 900]] ] }
  ];
  const flagOf = (v, r) => (r[1] !== null && v > r[1] ? "high" : r[0] !== null && v < r[0] ? "low" : "in");
  const fmt = (v) => (Number.isInteger(v) ? String(v) : String(+v.toFixed(2)));
  const rangeText = (r, u) => (r[0] !== null && r[1] !== null ? r[0] + " – " + r[1] + " " + u : r[1] !== null ? "below " + r[1] + " " + u : "above " + r[0] + " " + u);

  const nodes = [], edges = [], byId = {}, EKEY = {};
  function addNode(id, k, label, t, about, group, extra) {
    const n = Object.assign({ id, k, label, t, about: about || "", group: group || null, idx: nodes.length }, extra || {});
    nodes.push(n); byId[id] = n; return n;
  }
  function link(a, b) {
    const e = { a, b, dir: KINDS[byId[a].k].ord > KINDS[byId[b].k].ord, h: ((a.length * 7 + b.length * 13 + edges.length * 5) % 97) / 97, i: edges.length };
    edges.push(e); EKEY[a + "|" + b] = e; EKEY[b + "|" + a] = e;
  }
  addNode("p", "person", "Sample Person", 0, "The made-up person this preview is about.");
  DATES.forEach((d, i) => { addNode("r" + i, "report", d, i, "A report dated " + d + ".", null, { ri: i }); link("p", "r" + i); });
  SECTIONS.forEach((s) => {
    addNode("s_" + s.id, "section", s.name, s.first, "Appears in " + s.reports.length + " of 3 reports.", s.id);
    s.reports.forEach((ri) => link("r" + ri, "s_" + s.id));
    s.bios.forEach((b, bi) => {
      const bid = "b_" + s.id + bi, vals = b[2], first = vals.findIndex((v) => v !== null);
      addNode(bid, "bio", b[0], first, "Measured in " + vals.filter((v) => v !== null).length + " of 3 reports.", s.id, { name: b[0], unit: b[1], vals, range: b[3], k2: bi });
      link("s_" + s.id, bid);
      vals.forEach((v, ri) => {
        if (v === null) return;
        const mid = "m_" + s.id + bi + "_" + ri;
        addNode(mid, "meas", fmt(v) + " " + b[1], ri, b[0] + " " + fmt(v) + " " + b[1] + " in the report of " + DATES[ri] + ".", s.id, { val: v, unit: b[1], ri, bio: bid, flag: flagOf(v, b[3]), k2: bi });
        link(bid, mid); link(mid, "r" + ri);
      });
    });
  });
  addNode("u1", "unc", "Unreadable range, p. 2", 1, "Text the reader could not be sure of. A person should check the page.", "met", { ri: 1 });
  link("u1", "r1"); link("u1", "s_met");
  addNode("u2", "unc", "Low-confidence scan", 2, "A scanned page read at low confidence.", "vit", { ri: 2 });
  link("u2", "r2"); link("u2", "s_vit");

  const N = nodes.length;
  // a tidy tree through the graph: person → report → section → biomarker → value
  const TREE = [], TREEKEY = {};
  nodes.forEach((n) => {
    const up = n.k === "report" ? "p" : n.k === "section" ? "r" + n.t : n.k === "bio" ? "s_" + n.group : n.k === "meas" ? n.bio : n.k === "unc" ? "r" + n.ri : null;
    if (up) { TREE.push([up, n.id]); TREEKEY[up + "|" + n.id] = TREEKEY[n.id + "|" + up] = 1; }
  });
  const COUNT = {}; nodes.forEach((n) => (COUNT[n.k] = (COUNT[n.k] || 0) + 1));
  const adj = {}; nodes.forEach((n) => (adj[n.id] = []));
  edges.forEach((e) => { adj[e.a].push(e.b); adj[e.b].push(e.a); });
  nodes.forEach((n) => {
    if (n.k !== "bio") return;
    const idx = n.vals.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
    n.firstI = idx[0]; n.lastI = idx[idx.length - 1];
    n.latest = n.vals[n.lastI]; n.flag = flagOf(n.latest, n.range); n.firstFlag = flagOf(n.vals[n.firstI], n.range);
    n.delta = n.latest - n.vals[n.firstI];
  });

  // importance: betweenness centrality (Brandes)
  (function () {
    const bc = {}; nodes.forEach((n) => (bc[n.id] = 0));
    nodes.forEach((s) => {
      const stack = [], pred = {}, sigma = {}, dist = {}, delta = {};
      nodes.forEach((n) => { pred[n.id] = []; sigma[n.id] = 0; dist[n.id] = -1; delta[n.id] = 0; });
      sigma[s.id] = 1; dist[s.id] = 0;
      const q = [s.id];
      for (let h = 0; h < q.length; h++) {
        const v = q[h]; stack.push(v);
        adj[v].forEach((w) => {
          if (dist[w] < 0) { dist[w] = dist[v] + 1; q.push(w); }
          if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; pred[w].push(v); }
        });
      }
      while (stack.length) {
        const w = stack.pop();
        pred[w].forEach((v) => (delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])));
        if (w !== s.id) bc[w] += delta[w];
      }
    });
    let mx = 0; nodes.forEach((n) => (mx = Math.max(mx, bc[n.id])));
    nodes.forEach((n) => (n.imp = mx ? bc[n.id] / mx : 0));
  })();

  // build order: outward from the person, one node at a time
  const DELAY = {}, DEPTH = {};
  (function () {
    const step = clamp(5200 / N, 14, 110), seen = { p: 1 }, deg = (id) => adj[id].length, q = ["p"];
    let i = 0; DEPTH.p = 0;
    for (let h = 0; h < q.length; h++) {
      const id = q[h]; DELAY[id] = i++ * step;
      adj[id].filter((x) => !seen[x]).sort((x, y) => KINDS[byId[x].k].ord - KINDS[byId[y].k].ord || deg(y) - deg(x)).forEach((x) => { seen[x] = 1; DEPTH[x] = DEPTH[id] + 1; q.push(x); });
    }
  })();
  const MAXD = Math.max(...Object.values(DELAY));

  /* ---------- four layouts ---------- */
  const LAY = {};
  LAY.sphere = (function () {
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const P = nodes.map((n) => { const u = rnd() * 2 - 1, a = rnd() * TAU, q = Math.sqrt(Math.max(0, 1 - u * u)), r = KINDS[n.k].R || 0.05; return { x: q * Math.cos(a) * r, y: u * r, z: q * Math.sin(a) * r, vx: 0, vy: 0, vz: 0 }; });
    const iters = 900;
    for (let it = 0; it < iters; it++) {
      const cool = 1 - it / iters;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = P[i], b = P[j], dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z, d2 = dx * dx + dy * dy + dz * dz + 0.01, d = Math.sqrt(d2), f = 0.16 / d2;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f; a.vz += (dz / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f; b.vz -= (dz / d) * f;
      }
      edges.forEach((e) => {
        const A = P[byId[e.a].idx], B = P[byId[e.b].idx], dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001, f = (d - 0.7) * 0.05;
        A.vx += (dx / d) * f; A.vy += (dy / d) * f; A.vz += (dz / d) * f; B.vx -= (dx / d) * f; B.vy -= (dy / d) * f; B.vz -= (dz / d) * f;
      });
      for (let k = 0; k < N; k++) {
        const p = P[k], R = KINDS[nodes[k].k].R, r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) + 0.001, g = (R - r) * 0.04;
        p.vx += (p.x / r) * g; p.vy += (p.y / r) * g; p.vz += (p.z / r) * g;
        p.x += p.vx * cool * 0.55; p.y += p.vy * cool * 0.55; p.z += p.vz * cool * 0.55;
        p.vx *= 0.78; p.vy *= 0.78; p.vz *= 0.78;
      }
    }
    let mr = 0.001; P.forEach((p) => (mr = Math.max(mr, Math.hypot(p.x, p.y, p.z))));
    const sc = 1.18 / mr;
    return P.map((p) => [p.x * sc, p.y * sc * 0.82, p.z * sc]);
  })();
  const gi = (g) => Math.max(0, GROUP_ORDER.indexOf(g));
  const sibCount = (n) => nodes.filter((x) => x.k === "bio" && x.group === n.group).length;
  LAY.orbits = nodes.map((n) => {
    const RR = { person: 0, report: 0.4, unc: 0.62, section: 0.82, bio: 1.1, meas: 1.4 }, Y = { person: 0, report: -0.02, unc: 0, section: 0.02, bio: 0.04, meas: 0.06 };
    const ga = (g) => (gi(g) / 5) * TAU + 0.3;
    let a = 0;
    if (n.k === "report") a = (n.ri / 3) * TAU + 0.9;
    else if (n.k === "section") a = ga(n.group);
    else if (n.k === "bio") a = ga(n.group) + (n.k2 - (sibCount(n) - 1) / 2) * 0.3;
    else if (n.k === "meas") { const b = byId[n.bio]; a = ga(b.group) + (b.k2 - (sibCount(b) - 1) / 2) * 0.3 + (n.ri - 1) * 0.085; }
    else if (n.k === "unc") a = ga(n.group) + 0.4;
    const R = RR[n.k];
    return [R * Math.cos(a), Y[n.k], R * Math.sin(a)];
  });
  // timeline: a table in space. One row per biomarker, one column per report date.
  const BIOROW = {};
  nodes.filter((n) => n.k === "bio").sort((a, b) => gi(a.group) - gi(b.group) || a.k2 - b.k2).forEach((n, i) => (BIOROW[n.id] = i));
  const NB = Object.keys(BIOROW).length, rowY = (i) => -0.9 + (1.72 * i) / (NB - 1), TX = (ri) => -0.12 + ri * 0.5, laneOf = (g) => (gi(g) - 2) * 0.12;
  LAY.timeline = nodes.map((n) => {
    const lane = laneOf(n.group);
    if (n.k === "person") return [-1.38, 1.06, 0];
    if (n.k === "report") return [TX(n.ri), 1.06, 0];
    if (n.k === "section") { const ys = nodes.filter((b) => b.k === "bio" && b.group === n.group).map((b) => rowY(BIOROW[b.id])); return [-1.38, ys.reduce((a, b) => a + b, 0) / ys.length, lane]; }
    if (n.k === "bio") return [-0.72, rowY(BIOROW[n.id]), lane];
    if (n.k === "meas") return [TX(n.ri), rowY(BIOROW[n.bio]), lane];
    return [TX(n.ri) + 0.24, 0.93, lane];
  });
  LAY.columns = (function () {
    const col = { person: -1.45, report: -0.88, section: -0.3, unc: -0.3, bio: 0.3, meas: 0.95 }, out = new Array(N);
    const colOf = (n) => (n.k === "unc" ? "section" : n.k);
    ["person", "report", "section", "bio", "meas"].forEach((k) => {
      const list = nodes.filter((n) => colOf(n) === k).sort((a, b) => gi(a.group) - gi(b.group) || (a.k === "unc") - (b.k === "unc") || (a.k2 || 0) - (b.k2 || 0) || (a.ri || 0) - (b.ri || 0));
      list.forEach((n, i) => { const y = list.length === 1 ? 0 : -0.85 + (1.7 * i) / (list.length - 1); out[n.idx] = [col[n.k], y, 0]; });
    });
    return out;
  })();
  const CAM = { sphere: { rx: 0.4, spin: true }, orbits: { rx: 0.62, spin: true }, timeline: { rx: 0.1, ry: -0.1, spin: false }, columns: { rx: 0.05, ry: 0, spin: false } };

  /* =====================================================================
     THE GRAPH STAGE
     ===================================================================== */
  const cv = $("g"), cx = cv.getContext("2d"), stage = $("stage");
  const F = 3.4, FLOOR = 1.32;
  const near = (z) => clamp(1 - (z + 1.2) / 2.4, 0, 1);
  const opt = { size: true, breath: true, drop: true, hover: true, fly: true, clu: true, flow: true, lens: false, heat: false, ghost: true };
  const G = {
    rx: 0.4, ry: 0.7, zoom: 1, zoomT: 1, spin: true, drag: false, moved: false, userRot: false, lx: 0, ly: 0, hover: null,
    t0: 0, introT0: -1e9, selId: null, selT0: -1e9, h1: {}, h2: {}, off: [0, 0, 0],
    layout: "sphere", mt0: -1e9, hist: null, histI: -1, histPlay: false, histStart: 0, path: null, evid: null,
    kindOn: { person: 1, report: 1, section: 1, bio: 1, meas: 1, unc: 1 }, kindWant: { person: 1, report: 1, section: 1, bio: 1, meas: 1, unc: 1 },
    ink: true, W: 0, H: 0, dpr: 1, last: 0, mouse: { x: 0, y: 0, in: false }, hits: [], oxs: 0, oys: 0
  };
  nodes.forEach((n) => { n.from = LAY.sphere[n.idx].slice(); n.to = LAY.sphere[n.idx].slice(); n.md = 0; });
  const EVID = ["b_cbc0", "m_cbc0_2", "s_cbc", "r2"];
  const TH = () => (G.ink ? { fg: C.bg, bg: C.ink, mute: C.n5 } : { fg: C.ink, bg: C.bg, mute: C.n7 });

  function resizeG() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    G.W = w; G.H = h; G.dpr = dpr;
  }
  let PR = { cy: 1, sy: 0, c: 1, s: 0, S: 1, ox: 0, oy: 0 };
  function proj(q) {
    const x = q[0] - G.off[0], y = q[1] - G.off[1], z = q[2] - G.off[2];
    const x1 = x * PR.cy + z * PR.sy, z1 = -x * PR.sy + z * PR.cy, y2 = y * PR.c - z1 * PR.s, z2 = y * PR.s + z1 * PR.c, k = F / (F + z2);
    return [PR.ox + x1 * PR.S * k, PR.oy + y2 * PR.S * k, z2, k, 1];
  }
  function worldPos(n, now) {
    const t = REDUCE ? 1 : clamp((now - G.mt0 - n.md) / 1150, 0, 1), e = inOutCubic(t);
    return [lerp(n.from[0], n.to[0], e), lerp(n.from[1], n.to[1], e), lerp(n.from[2], n.to[2], e)];
  }
  function setLayout(name) {
    if (!LAY[name]) return;
    const now = performance.now();
    nodes.forEach((n) => { n.from = worldPos(n, now); n.to = LAY[name][n.idx].slice(); n.md = (DELAY[n.id] / MAXD) * 420; });
    G.layout = name; G.mt0 = now; G.userRot = false;
    document.querySelectorAll("[data-layout]").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-layout") === name)));
    G.spin = CAM[name].spin; $("spin").setAttribute("aria-pressed", String(!G.spin)); $("spin").textContent = G.spin ? "Pause" : "Rotate";
  }
  document.querySelectorAll("[data-layout]").forEach((b) => b.addEventListener("click", () => setLayout(b.getAttribute("data-layout"))));

  function vis(n, now) {
    let v;
    if (G.hist !== null) v = clamp((G.hist - n.t) * 3 + 1, 0, 1);
    else {
      const t = (now - G.t0 - (REDUCE ? DELAY[n.id] * 0.04 : DELAY[n.id])) / (REDUCE ? 120 : 420);
      v = t <= 0 ? 0 : t >= 1 ? 1 : outCubic(t);
    }
    return v * G.kindOn[n.k];
  }

  /* ---------- selection and the dossier ---------- */
  function select(id) {
    if (id === G.selId) return;
    G.selId = id; G.selT0 = performance.now(); G.h1 = {}; G.h2 = {};
    if (id) { adj[id].forEach((x) => (G.h1[x] = 1)); Object.keys(G.h1).forEach((a) => adj[a].forEach((b) => { if (b !== id && !G.h1[b]) G.h2[b] = 1; })); }
    buildDossier();
  }
  const dossier = $("dossier"), tip = $("tip"), bar = $("bar");
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function chip(id) { const b = el("button", "btn btn-secondary btn-small", byId[id].label); b.type = "button"; b.addEventListener("click", () => select(id)); return b; }
  const flagWords = (f) => (f === "high" ? "▲ Above the printed range" : f === "low" ? "▼ Below the printed range" : "● Inside the printed range");
  function sparkline(n) {
    // the view hugs the values; the printed range is shown only as far as it helps to read them
    const W = 268, H = 112, padL = 16, padR = 16, top = 20, bot = 22, vals = n.vals, r = n.range, nums = vals.filter((v) => v !== null);
    const dLo = Math.min(...nums), dHi = Math.max(...nums), span = Math.max(dHi - dLo, Math.abs(dHi) * 0.08, 1e-6);
    let lo = dLo, hi = dHi;
    r.forEach((b) => { if (b === null) return; lo = Math.min(lo, Math.max(b, dLo - span * 1.5)); hi = Math.max(hi, Math.min(b, dHi + span * 1.5)); });
    if (r[0] !== null && r[0] >= lo && r[0] <= hi) hi = Math.max(hi, Math.min(r[1] !== null ? r[1] : Infinity, r[0] + span * 0.5));
    if (r[1] !== null && r[1] >= lo && r[1] <= hi) lo = Math.min(lo, Math.max(r[0] !== null ? r[0] : -Infinity, r[1] - span * 0.5));
    const pad = (hi - lo) * 0.14; lo -= pad; hi += pad;
    const X = (i) => padL + (i / 2) * (W - padL - padR), Y = (v) => top + (1 - (clamp(v, lo, hi) - lo) / (hi - lo)) * (H - top - bot);
    const yTop = Y(r[1] !== null ? r[1] : hi), yBot = Y(r[0] !== null ? r[0] : lo);
    const pts = vals.map((v, i) => (v === null ? null : [X(i), Y(v)])).filter(Boolean);
    let s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + n.name + ' over time, with the printed range shaded">';
    if (yBot - yTop > 0.5) s += '<rect x="' + padL + '" y="' + yTop + '" width="' + (W - padL - padR) + '" height="' + (yBot - yTop) + '" fill="' + C.sf + '"/>';
    [r[0], r[1]].forEach((b) => { if (b === null || b < lo || b > hi) return; s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + Y(b) + '" y2="' + Y(b) + '" stroke="' + C.n5 + '" stroke-width="1" stroke-dasharray="3 3"/>'; });
    s += '<polyline points="' + pts.map((p) => p.join(",")).join(" ") + '" fill="none" stroke="' + C.ink + '" stroke-width="2"/>';
    vals.forEach((v, i) => {
      if (v === null) return;
      const f = flagOf(v, r), last = i === n.lastI;
      s += '<rect x="' + (X(i) - 4) + '" y="' + (Y(v) - 4) + '" width="8" height="8" fill="' + (f !== "in" ? C.acc : last ? C.ink : C.bg) + '" stroke="' + (f !== "in" ? C.acc : C.ink) + '" stroke-width="2"/>';
      s += '<text x="' + X(i) + '" y="' + (Y(v) - 9) + '" text-anchor="middle" font-size="11" font-weight="800" fill="' + C.ink + '">' + fmt(v) + "</text>";
    });
    ["JAN", "JUN", "OCT"].forEach((m, i) => (s += '<text x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9" font-weight="800" fill="' + C.n7 + '" letter-spacing=".8">' + m + "</text>"));
    return s + "</svg>";
  }
  /* ---------- the AI summary: what this dot is, written from the files it came from ----------
     In the app the backend gathers the passages behind the node, the model writes 2–3 sentences
     that cite them as [n], and the server drops any sentence whose numbers are not in a passage.
     Here the text is a fixed sample built from the sample data, streamed the same way. */
  const FILES = [
    { name: "lab-results-2025-01-15.md", kind: "Markdown file", md: true },
    { name: "lab-panel-2025-06-20.pdf", kind: "PDF with a text layer" },
    { name: "scan-2025-10-02.pdf", kind: "scanned PDF, read by OCR" }
  ];
  const DESC = {
    "Total Cholesterol": "the total amount of cholesterol, a fatty substance, carried in the blood",
    "LDL Cholesterol": "the part of the cholesterol in the blood that is often called “bad” cholesterol",
    "HDL Cholesterol": "the part of the cholesterol in the blood that is often called “good” cholesterol",
    "Fasting Glucose": "the amount of sugar in the blood after several hours without food",
    "HbA1c": "an average of blood sugar over roughly the last three months",
    "Creatinine": "a waste product that the kidneys filter out of the blood",
    "TSH": "a hormone that tells the thyroid gland how hard to work",
    "Hemoglobin": "the protein in red blood cells that carries oxygen",
    "Ferritin": "a protein that stores iron in the body",
    "Vitamin D": "a vitamin that helps the body use calcium",
    "Vitamin B12": "a vitamin the body needs for nerves and red blood cells"
  };
  const SDESC = { lip: "a group of tests about the fats in the blood", met: "a group of tests about blood sugar and the kidneys", thy: "a test of the thyroid gland", cbc: "a count of the cells in the blood and the iron that feeds them", vit: "a group of tests of vitamin levels" };
  const inRange = (r, u) => (r[0] !== null && r[1] !== null ? "of " + rangeText(r, u) : "(" + rangeText(r, u) + ")");
  const pageOf = (ri, g, k2) => (FILES[ri].md ? "line " + (6 + gi(g) * 9 + (k2 || 0) * 2) : "p. " + (gi(g) < 2 ? 1 : 2));
  const charsOf = (ri, g, k2, len) => { const s = 140 + gi(g) * 310 + (k2 || 0) * 58 + ri * 7; return "chars " + s + "–" + (s + len); };
  function srcMeas(m) {
    const b = byId[m.bio], hit = fmt(m.val) + " " + m.unit, md = FILES[m.ri].md;
    const pre = md ? "- " + b.name + ": " : b.name + "   ", post = md ? " (ref " + rangeText(b.range, b.unit) + ")" : "   Ref. " + rangeText(b.range, b.unit);
    return { ri: m.ri, where: pageOf(m.ri, b.group, b.k2), chars: charsOf(m.ri, b.group, b.k2, (pre + hit + post).length), pre, hit, post };
  }
  function srcSection(g, ri) {
    const s = SECTIONS[gi(g)], md = FILES[ri].md, hit = md ? "## " + s.name : s.name.toUpperCase(), post = "   " + s.bios.map((b) => b[0]).join(", ");
    return { ri, where: pageOf(ri, g, 0), chars: charsOf(ri, g, 0, (hit + post).length), pre: "", hit, post };
  }
  function srcHeader(ri) {
    const md = FILES[ri].md, pre = md ? "date: " : "Report date: ", post = md ? "" : "   Page 1 of 2";
    return { ri, where: md ? "line 2" : "p. 1", chars: "chars 0–" + (pre + DATES[ri] + post).length, pre, hit: DATES[ri], post };
  }
  function aiSummary(n) {
    const segs = [], srcs = [], t = (x) => segs.push({ t: x }), b = (x) => segs.push({ b: x });
    const cite = (src) => { srcs.push(src); segs.push({ c: srcs.length }); };
    if (n.k === "bio") {
      const ms = nodes.filter((m) => m.k === "meas" && m.bio === n.id).sort((a, c) => a.ri - c.ri);
      t(n.name + " is " + DESC[n.name] + ". ");
      if (ms.length > 1) { t((ms.length === FILES.length ? "It is in all " + ms.length + " of your files" : "It is in " + ms.length + " of your " + FILES.length + " files") + " and went from "); b(fmt(ms[0].val) + " to " + fmt(ms[ms.length - 1].val) + " " + n.unit); t(" between " + SHORT[ms[0].ri] + " and " + SHORT[ms[ms.length - 1].ri]); }
      else { t("It is in 1 of your " + FILES.length + " files, at "); b(fmt(ms[0].val) + " " + n.unit); t(" in " + SHORT[ms[0].ri]); }
      ms.forEach((m) => cite(srcMeas(m))); t(". ");
      if (n.flag !== "in") { t("The latest value is still "); b(n.flag === "high" ? "above the printed range" : "below the printed range"); t(" " + inRange(n.range, n.unit) + "."); }
      else if (n.firstFlag !== "in") { const m = ms.find((x) => x.flag === "in"); t("It moved "); b("into the printed range"); t(" by " + SHORT[m.ri] + " and stayed there."); }
      else t("Every value is inside the printed range " + inRange(n.range, n.unit) + ".");
    } else if (n.k === "meas") {
      const bio = byId[n.bio], prev = nodes.filter((m) => m.k === "meas" && m.bio === n.bio && m.ri < n.ri).sort((a, c) => c.ri - a.ri)[0];
      t("One " + bio.name + " reading: "); b(fmt(n.val) + " " + n.unit); t(", from " + FILES[n.ri].name + " dated " + DATES[n.ri]); cite(srcMeas(n)); t(". ");
      t((n.flag === "in" ? "It is inside" : n.flag === "high" ? "It is above" : "It is below") + " the printed range " + inRange(bio.range, bio.unit) + " on the same page. ");
      if (prev) { const d = n.val - prev.val; t(d === 0 ? "It is the same as in " + SHORT[prev.ri] + "." : "It is " + (d > 0 ? "up " : "down ") + fmt(+Math.abs(d).toFixed(2)) + " " + n.unit + " from " + SHORT[prev.ri]); if (d !== 0) { cite(srcMeas(prev)); t("."); } }
      else t("It is the first reading of this test in your files.");
    } else if (n.k === "section") {
      const s = SECTIONS[gi(n.group)], bios = nodes.filter((x) => x.k === "bio" && x.group === n.group), outs = bios.filter((x) => x.flag !== "in");
      t(s.name + " is " + SDESC[n.group] + ". It appears in " + s.reports.length + " of your files"); s.reports.forEach((ri) => cite(srcSection(n.group, ri)));
      t(" and holds " + bios.length + " test" + (bios.length === 1 ? "" : "s") + ": " + bios.map((x) => x.name).join(", ") + ". ");
      if (outs.length) { t("In the latest file, "); b(outs.length + " " + (outs.length === 1 ? "is" : "are") + " outside the printed range"); t(": " + outs.map((x) => x.name).join(" and ") + "."); }
      else t("In the latest file every value is inside the printed range.");
    } else if (n.k === "report") {
      const ms = nodes.filter((m) => m.k === "meas" && m.ri === n.ri), outs = ms.filter((m) => m.flag !== "in"), secs = adj[n.id].filter((id) => byId[id].k === "section").length;
      const unc = nodes.find((u) => u.k === "unc" && u.ri === n.ri);
      b(FILES[n.ri].name); t(" is a " + FILES[n.ri].kind + ", dated " + DATES[n.ri]); cite(srcHeader(n.ri));
      t(". It holds " + ms.length + " values in " + secs + " sections; "); b(outs.length + " " + (outs.length === 1 ? "is" : "are") + " outside the printed range");
      if (outs.length) t(": " + outs.map((m) => byId[m.bio].name).join(" and "));
      outs.slice(0, 2).forEach((m) => cite(srcMeas(m))); t(".");
      if (unc) t(" One passage could not be read with confidence and is left out of answers.");
    } else if (n.k === "person") {
      const bios = nodes.filter((x) => x.k === "bio"), fixed = bios.filter((x) => x.firstFlag !== "in" && x.flag === "in"), still = bios.filter((x) => x.flag !== "in").map((x) => x.name);
      t("Sample Person has "); b(FILES.length + " files"); t(" from January to October 2025: two PDFs and one Markdown file"); FILES.forEach((f, ri) => cite(srcHeader(ri)));
      t(". Together they hold " + COUNT.meas + " values for " + COUNT.bio + " tests. Since January, "); b(fixed.length + " values moved into the printed range"); t("; " + still.join(" and ") + (still.length === 1 ? " is" : " are") + " still outside it.");
    } else {
      const g = n.group, page = n.id === "u1" ? "p. 2" : "p. 1";
      t("Part of "); b(FILES[n.ri].name); t(" (" + page + ") could not be read with confidence");
      cite({ ri: n.ri, where: page, chars: "chars 618–664", pre: g === "met" ? "Fasting Glucose   " : "Vitamin D   ", hit: g === "met" ? "1?4 mg/dL" : "2? ng/mL", post: g === "met" ? "   Ref. 7? – 9?" : "   Ref. 3? – 1?0", low: true });
      t(". Nothing from it is used in answers or in the values in this graph, so a person should look at that page.");
    }
    return { segs, srcs, len: segs.reduce((a, s) => a + (s.c ? 1 : (s.t || s.b).length), 0) };
  }
  const AI = { seen: {}, run: 0 };
  function aiBlock(n) {
    const run = ++AI.run, sum = aiSummary(n), box = el("section", "ai"); box.setAttribute("aria-label", "AI summary");
    const head = el("div", "aih"), lab = el("span", "ail"); lab.appendChild(el("i")); lab.appendChild(document.createTextNode("AI summary"));
    const again = el("button", "btn btn-ghost btn-small", "Write again"); again.type = "button";
    head.appendChild(lab); head.appendChild(again); box.appendChild(head);
    const nfiles = new Set(sum.srcs.map((s) => s.ri)).size;
    const wait = el("p", "wait", "Reading " + sum.srcs.length + " passage" + (sum.srcs.length === 1 ? "" : "s") + " from " + nfiles + " file" + (nfiles === 1 ? "" : "s") + "…");
    const txt = el("p", "txt"); txt.setAttribute("aria-live", "polite");
    const list = el("div", "srcs"); list.hidden = true;
    list.appendChild(el("div", "sh", "Sources · " + sum.srcs.length + " passage" + (sum.srcs.length === 1 ? "" : "s") + " in " + nfiles + " file" + (nfiles === 1 ? "" : "s")));
    const rows = sum.srcs.map((s, i) => {
      const row = el("div", "src"), btn = el("button"); btn.type = "button"; btn.setAttribute("aria-expanded", "false");
      btn.appendChild(el("span", "n", String(i + 1))); btn.appendChild(el("span", "f", FILES[s.ri].name)); btn.appendChild(el("span", "w", s.where));
      const q = el("div", "quote"); q.hidden = true;
      q.appendChild(document.createTextNode(s.pre)); q.appendChild(el("mark", "", s.hit)); q.appendChild(document.createTextNode(s.post));
      q.appendChild(el("small", "", s.where + " · " + s.chars + (s.low ? " · low confidence" : "") + (FILES[s.ri].md ? "" : FILES[s.ri].kind.indexOf("OCR") >= 0 ? " · OCR" : "")));
      btn.addEventListener("click", () => openSrc(i, q.hidden));
      btn.addEventListener("mouseenter", () => mark(i, true)); btn.addEventListener("mouseleave", () => mark(i, false));
      row.appendChild(btn); row.appendChild(q); list.appendChild(row);
      return { row, btn, q };
    });
    function mark(i, on) { rows[i].row.classList.toggle("on", on); txt.querySelectorAll(".cite").forEach((c) => c.classList.toggle("on", on && +c.dataset.i === i)); }
    function openSrc(i, open) {
      rows[i].q.hidden = !open; rows[i].btn.setAttribute("aria-expanded", String(open));
      if (open) try { rows[i].row.scrollIntoView({ block: "nearest", behavior: REDUCE ? "auto" : "smooth" }); } catch (e) {}
    }
    function paint(k, caret) {
      txt.innerHTML = ""; let left = k, glue = null;
      for (const s of sum.segs) {
        if (left <= 0) break;
        if (!s.c && glue && /^[.,;:]/.test(s.t || "")) { glue.appendChild(document.createTextNode(s.t[0])); left -= 1; const rest = s.t.slice(1, 1 + Math.max(0, left)); left -= rest.length; if (rest) txt.appendChild(document.createTextNode(rest)); glue = null; continue; }
        if (s.c) {
          const c = el("button", "cite", String(s.c)); c.type = "button"; c.dataset.i = String(s.c - 1);
          c.setAttribute("aria-label", "Source " + s.c + ": " + FILES[sum.srcs[s.c - 1].ri].name + ", " + sum.srcs[s.c - 1].where);
          c.addEventListener("mouseenter", () => mark(s.c - 1, true)); c.addEventListener("mouseleave", () => mark(s.c - 1, false));
          c.addEventListener("click", () => { list.hidden = false; openSrc(s.c - 1, true); });
          if (!glue) { glue = el("span", "nw"); txt.appendChild(glue); }
          glue.appendChild(c); left -= 1;
        } else {
          glue = null;
          const str = (s.t || s.b).slice(0, left); left -= str.length;
          txt.appendChild(s.b ? el("b", "", str) : document.createTextNode(str));
        }
      }
      if (caret) txt.appendChild(el("span", "caret"));
    }
    function finish() { paint(sum.len, false); lab.classList.remove("busy"); wait.remove(); list.hidden = false; AI.seen[n.id] = 1; }
    function start() {
      if (REDUCE || AI.seen[n.id]) { box.insertBefore(txt, box.children[1]); finish(); return; }
      lab.classList.add("busy"); list.hidden = true; box.insertBefore(wait, box.children[1]); txt.remove();
      const t0 = performance.now() + 520;
      const step = (now) => {
        if (run !== AI.run) return;
        if (now < t0) { requestAnimationFrame(step); return; }
        if (wait.parentNode) { wait.remove(); box.insertBefore(txt, box.children[1]); }
        const k = Math.floor((now - t0) * 0.17);
        if (k >= sum.len) { finish(); return; }
        paint(k, true); requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    again.addEventListener("click", () => { delete AI.seen[n.id]; box.replaceWith(aiBlock(n)); });
    box.appendChild(list);
    box.appendChild(el("p", "note", "General information from your files, not medical advice. In this preview the text is a fixed sample."));
    start();
    return box;
  }

  function buildDossier() {
    const n = G.selId ? byId[G.selId] : null;
    AI.run++; // stops a summary that is still being written for the previous dot
    dossier.innerHTML = "";
    stage.classList.toggle("has-dossier", !!n);
    if (!n) { dossier.hidden = true; return; }
    const head = el("div", "dk"); head.appendChild(el("span", "label", KINDS[n.k].word));
    const x = el("button", "btn btn-ghost btn-small", "Close"); x.type = "button"; x.addEventListener("click", () => select(null)); head.appendChild(x);
    dossier.appendChild(head);
    dossier.appendChild(el("h3", "", n.k === "meas" ? byId[n.bio].name : n.label));
    dossier.appendChild(aiBlock(n));
    const big = (num, unit) => { const b = el("div", "big"); b.appendChild(el("span", "num", num)); b.appendChild(el("span", "unit", unit)); dossier.appendChild(b); };
    const chips = (ids) => { const c = el("div", "chips"); ids.forEach((id) => c.appendChild(chip(id))); dossier.appendChild(c); };
    if (n.k === "bio") {
      big(fmt(n.latest), n.unit + " · " + SHORT[n.lastI]);
      const d = n.delta, pct = (d / n.vals[n.firstI]) * 100;
      dossier.appendChild(el("p", "", n.firstI === n.lastI ? "Only one measurement so far." : (d >= 0 ? "+" : "") + fmt(+d.toFixed(2)) + " " + n.unit + " since " + SHORT[n.firstI] + " (" + (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%)"));
      dossier.appendChild(el("span", "flag" + (n.flag !== "in" ? " hot" : ""), flagWords(n.flag)));
      const sp = el("div"); sp.innerHTML = sparkline(n); dossier.appendChild(sp);
      dossier.appendChild(el("p", "muted", "Shaded band: the printed range, " + rangeText(n.range, n.unit) + ". Sample values."));
    } else if (n.k === "meas") {
      const b = byId[n.bio];
      big(fmt(n.val), n.unit);
      dossier.appendChild(el("span", "flag" + (n.flag !== "in" ? " hot" : ""), flagWords(n.flag)));
      dossier.appendChild(el("p", "muted", "From the report of " + DATES[n.ri] + ". Printed range: " + rangeText(b.range, b.unit) + "."));
      chips([n.bio, "r" + n.ri]);
    } else if (n.k === "section") {
      const rows = el("div", "rows");
      nodes.filter((b) => b.k === "bio" && b.group === n.group).forEach((b) => {
        const r = el("button"); r.type = "button";
        r.appendChild(el("span", "", b.name)); r.appendChild(el("b", "", fmt(b.latest) + " " + b.unit)); r.appendChild(el("span", "", b.flag === "high" ? "▲" : b.flag === "low" ? "▼" : "●"));
        r.addEventListener("click", () => select(b.id)); rows.appendChild(r);
      });
      dossier.appendChild(rows);
    } else if (n.k === "report") {
      const ms = nodes.filter((m) => m.k === "meas" && m.ri === n.ri), out = ms.filter((m) => m.flag !== "in").length;
      big(String(ms.length), "values, " + out + " outside the printed range");
      chips(adj[n.id].filter((id) => byId[id].k === "section"));
    } else if (n.k === "person") {
      big(String(COUNT.report), "reports · " + COUNT.bio + " biomarkers · " + COUNT.meas + " values");
      chips(["r0", "r1", "r2"]);
    } else {
      chips(adj[n.id]);
    }
    const deg = adj[n.id].length;
    dossier.appendChild(el("p", "muted", "Connected to " + deg + " node" + (deg === 1 ? "" : "s") + ". Its lines are red; the fainter ones go one step further."));
    dossier.hidden = false; dossier.scrollTop = 0;
  }

  /* ---------- input on the stage ---------- */
  function hitTest(x, y) {
    let best = null, bd = 1e9;
    G.hits.forEach((h) => { const d = Math.hypot(h.x - x, h.y - y); if (d < h.r + 7 && (d < bd || (best && h.z < best.z && d < bd + 6))) { bd = d; best = h; } });
    return best ? best.id : null;
  }
  cv.addEventListener("pointerdown", (e) => { G.drag = true; G.moved = false; G.lx = e.clientX; G.ly = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
  cv.addEventListener("pointermove", (e) => {
    const r = cv.getBoundingClientRect(); G.mouse.x = e.clientX - r.left; G.mouse.y = e.clientY - r.top; G.mouse.in = true;
    if (G.drag) {
      const dx = e.clientX - G.lx, dy = e.clientY - G.ly;
      if (Math.abs(dx) + Math.abs(dy) > 2) { G.moved = true; G.userRot = true; }
      G.ry += dx * 0.008; G.rx = clamp(G.rx + dy * 0.006, -1.3, 1.3); G.lx = e.clientX; G.ly = e.clientY;
    } else { G.hover = hitTest(G.mouse.x, G.mouse.y); cv.style.cursor = opt.lens ? "crosshair" : G.hover ? "pointer" : "grab"; }
  });
  cv.addEventListener("pointerleave", () => { G.hover = null; G.mouse.in = false; tip.hidden = true; });
  cv.addEventListener("pointerup", (e) => {
    if (G.drag && !G.moved) {
      const r = cv.getBoundingClientRect(), id = hitTest(e.clientX - r.left, e.clientY - r.top);
      if (e.shiftKey && id && G.selId && id !== G.selId) { $("pathFrom").value = G.selId; $("pathTo").value = id; showPath(); }
      else { clearPath(); setEvid(false); select(id); }
    }
    G.drag = false;
  });
  cv.addEventListener("wheel", (e) => { e.preventDefault(); G.zoomT = clamp(G.zoomT * (e.deltaY > 0 ? 0.93 : 1.07), 0.55, 2.2); }, { passive: false });

  /* ---------- the intro: the graph assembles, with a title sequence ---------- */
  const intro = $("intro");
  let introTimers = [];
  function startIntro() {
    const now = performance.now();
    G.t0 = now; G.introT0 = REDUCE ? -1e9 : now; G.hist = null; G.histI = -1; $("histdate").hidden = true; $("histRange").value = "200";
    introTimers.forEach(clearTimeout); introTimers = [];
    intro.className = "ov intro"; intro.innerHTML = "";
    if (REDUCE) return;
    intro.appendChild(el("div", "k", "Building the graph of Sample Person"));
    const firsts = {};
    nodes.forEach((n) => { if (n.k !== "person") firsts[n.k] = Math.min(firsts[n.k] === undefined ? Infinity : firsts[n.k], DELAY[n.id]); });
    const lines = Object.keys(firsts).sort((a, b) => firsts[a] - firsts[b]).map((kd) => ({ kd, t: firsts[kd], n: COUNT[kd] }));
    lines.push({ kd: "links", t: MAXD + 300, n: edges.length });
    introTimers.push(setTimeout(() => intro.classList.add("on"), 60));
    lines.forEach((L) => {
      const ln = el("div", "ln"); ln.appendChild(el("b", "", String(L.n)));
      ln.appendChild(document.createTextNode(" " + (L.kd === "links" ? "links" : L.n === 1 ? KINDS[L.kd].word.toLowerCase() : KINDS[L.kd].many)));
      intro.appendChild(ln);
      introTimers.push(setTimeout(() => ln.classList.add("on"), L.t + 120));
    });
    introTimers.push(setTimeout(() => intro.classList.add("out"), MAXD + 2600));
  }
  $("replay").addEventListener("click", () => { clearPath(); setEvid(false); select(null); stopHist(); startIntro(); });

  /* ---------- the frame ---------- */
  function lensMap(p, mx, my, R) {
    const dx = p[0] - mx, dy = p[1] - my, d = Math.hypot(dx, dy);
    if (d >= R || d < 0.001) return;
    const x = d / R, k = 2.4, f = ((1 + k) * x) / (1 + k * x);
    p[0] = mx + (dx / d) * f * R; p[1] = my + (dy / d) * f * R; p[4] = 1 + 0.75 * (1 - x);
  }
  function curvePt(A, B, t) {
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, qx = mx - (B[1] - A[1]) * 0.08, qy = my + (B[0] - A[0]) * 0.08;
    return [(1 - t) * (1 - t) * A[0] + 2 * (1 - t) * t * qx + t * t * B[0], (1 - t) * (1 - t) * A[1] + 2 * (1 - t) * t * qy + t * t * B[1]];
  }
  function frameG(now) {
    resizeG();
    const W = G.W, H = G.H, T = TH(), motion = !REDUCE;
    cx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0); cx.clearRect(0, 0, W, H);
    const dt = G.last ? Math.min(64, now - G.last) : 16.7; G.last = now;

    // camera
    const cam = CAM[G.layout];
    if (!G.drag && motion) {
      if (G.spin && !G.selId && !G.path && !G.evid) G.ry += (0.15 * dt) / 1000;
      if (!cam.spin && !G.spin && !G.userRot) { let d = cam.ry - G.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); G.ry += d * 0.05; }
      if (!G.userRot && now - G.mt0 < 1800) G.rx += (cam.rx - G.rx) * 0.06;
    }
    const introE = motion ? outCubic(clamp((now - G.introT0) / 3800, 0, 1)) : 1;
    const wantFly = opt.fly && G.selId && !G.path && !G.evid;
    const tgt = wantFly ? worldPos(byId[G.selId], now).map((v) => v * 0.62) : worldPos(byId.p, now).map((v) => v * (1 - introE));
    for (let i = 0; i < 3; i++) G.off[i] += (tgt[i] - G.off[i]) * (motion ? 0.085 : 1);
    const zt = G.zoomT * (wantFly ? 1.3 : 1) * (1 + 1.25 * (1 - introE));
    G.zoom += (zt - G.zoom) * (motion ? (introE < 1 ? 0.2 : 0.085) : 1);
    Object.keys(G.kindOn).forEach((k) => { G.kindOn[k] += (G.kindWant[k] - G.kindOn[k]) * (motion ? 0.2 : 1); if (Math.abs(G.kindWant[k] - G.kindOn[k]) < 0.01) G.kindOn[k] = G.kindWant[k]; });
    // make room: the graph slides right while the intro titles show, and away from the docked details card
    const introAge = now - G.introT0, introDur = MAXD + 2600;
    let ish = introAge < 0 ? 0 : introAge < 500 ? introAge / 500 : introAge < introDur ? 1 : 1 - (introAge - introDur) / 900;
    ish = motion && W > 700 ? inOutCubic(clamp(ish, 0, 1)) * W * 0.15 : 0;
    const dockOpen = !!G.selId && !dossier.hidden;
    const wantX = ish + (dockOpen && W >= 600 ? -(dossier.offsetWidth + 24) / 2 : 0), wantY = dockOpen && W < 600 ? -dossier.offsetHeight / 2 : 0;
    G.oxs += (wantX - G.oxs) * (motion ? 0.09 : 1); G.oys += (wantY - G.oys) * (motion ? 0.09 : 1);
    PR = { cy: Math.cos(G.ry), sy: Math.sin(G.ry), c: Math.cos(G.rx), s: Math.sin(G.rx), S: Math.min(W, H) * 0.34 * G.zoom, ox: W / 2 + G.oxs, oy: H / 2 + (W < 560 ? -30 : 0) + G.oys };

    // time machine
    if (G.histPlay) {
      G.hist = clamp(((now - G.histStart) / 7500) * 2, 0, 2);
      $("histRange").value = String(Math.round(G.hist * 100));
      if (G.hist >= 2) stopHist();
    }
    if (G.hist !== null) {
      const i = clamp(Math.round(G.hist), 0, 2), hd = $("histdate");
      if (i !== G.histI) { G.histI = i; hd.innerHTML = "<small>Time machine</small>"; hd.appendChild(document.createTextNode(DATES[i])); }
      hd.hidden = false;
    }

    // positions
    const P = {}, V = {}, WP = {};
    nodes.forEach((n) => {
      const q = worldPos(n, now);
      if (opt.breath && motion) { const s = now / 1000, a = n.idx * 1.7; q[0] += 0.014 * Math.sin(s * 0.9 + a); q[1] += 0.014 * Math.sin(s * 1.1 + a * 1.3); q[2] += 0.014 * Math.sin(s * 0.8 + a * 0.7); }
      WP[n.id] = q; P[n.id] = proj(q); V[n.id] = vis(n, now);
    });
    const lensOn = opt.lens && G.mouse.in && !G.drag, LR = Math.min(150, Math.min(W, H) * 0.22);
    if (lensOn) nodes.forEach((n) => lensMap(P[n.id], G.mouse.x, G.mouse.y, LR));

    // emphasis state
    const sel = G.selId, selOn = !!sel && !G.path && !G.evid;
    const pathIds = {}; let pathStep = 0;
    if (G.path) { pathStep = clamp(Math.floor((now - G.path.t0) / 480), 0, G.path.ids.length); G.path.ids.forEach((id, i) => (pathIds[id] = i)); }
    const evidSet = {}, evidOn = !!G.evid; if (evidOn) G.evid.forEach((id, i) => (evidSet[id] = i + 1));
    const hov = opt.hover && G.hover && !selOn && !G.path && !evidOn ? G.hover : null;
    const dimmed = (id) => (selOn && id !== sel && !G.h1[id] && !G.h2[id]) || (G.path && pathIds[id] === undefined) || (evidOn && !evidSet[id]);

    // 1. floor grid
    cx.strokeStyle = T.fg; cx.lineWidth = 1;
    for (let gI = -4; gI <= 4; gI++) {
      const t = gI * 0.4;
      [[[t, FLOOR, -1.6], [t, FLOOR, 1.6]], [[-1.6, FLOOR, t], [1.6, FLOOR, t]]].forEach((sg) => {
        const A = proj(sg[0]), B = proj(sg[1]);
        cx.globalAlpha = (G.ink ? 0.05 : 0.06) + 0.12 * near((A[2] + B[2]) / 2); cx.beginPath(); cx.moveTo(A[0], A[1]); cx.lineTo(B[0], B[1]); cx.stroke();
      });
    }

    // 2. guides for the layout: orbit rings, time ticks, column titles
    // small guide words are queued and drawn last, only where no node label already sits
    const late = [];
    const guide = REDUCE ? 1 : clamp((now - G.mt0 - 500) / 900, 0, 1);
    cx.font = "800 10px " + FONT; cx.fillStyle = T.fg;
    if (G.layout === "orbits") {
      [["report", 0.4, -0.02], ["unc", 0.62, 0], ["section", 0.82, 0.02], ["bio", 1.1, 0.04], ["meas", 1.4, 0.06]].forEach((r) => {
        cx.globalAlpha = 0.16 * guide; cx.strokeStyle = T.fg; cx.beginPath();
        for (let i = 0; i <= 72; i++) { const a = (i / 72) * TAU, p = proj([r[1] * Math.cos(a), r[2], r[1] * Math.sin(a)]); i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); }
        cx.stroke();
        const lp = proj([r[1], r[2], 0]); late.push({ txt: KINDS[r[0]].many.toUpperCase(), x: lp[0] + 6, y: lp[1] - 4, align: "left", alpha: 0.5 * guide, color: T.fg });
      });
    } else if (G.layout === "timeline") {
      nodes.forEach((n) => {
        if (n.k !== "bio") return;
        const y = rowY(BIOROW[n.id]), z = laneOf(n.group), a = proj([-0.66, y, z]), b = proj([TX(2) + 0.12, y, z]);
        cx.globalAlpha = 0.09 * guide * G.kindOn.bio; cx.strokeStyle = T.fg; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke();
      });
      DATES.forEach((d, i) => {
        const x = TX(i), a = proj([x, -1.0, 0]), b = proj([x, 0.98, 0]);
        cx.globalAlpha = 0.4 * guide; cx.strokeStyle = C.acc; cx.setLineDash([4, 4]); cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke(); cx.setLineDash([]);
        cx.globalAlpha = 0.9 * guide; cx.fillStyle = C.acc; cx.textAlign = "center"; cx.fillText(SHORT[i].toUpperCase(), a[0], a[1] - 9); cx.textAlign = "start";
      });
      // the time axis runs along the top, under the dates
      const a = proj([TX(0) - 0.16, -1.0, 0]), b = proj([TX(2) + 0.22, -1.0, 0]);
      cx.globalAlpha = 0.5 * guide; cx.strokeStyle = T.fg; cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke();
      cx.fillStyle = T.fg; cx.fillText("TIME →", b[0] + 8, b[1] + 4);
    } else if (G.layout === "columns") {
      [[-1.45, "Subject"], [-0.88, "Reports"], [-0.3, "Sections"], [0.3, "Biomarkers"], [0.95, "Values"]].forEach((c) => {
        const p = proj([c[0], -1.02, 0]); cx.globalAlpha = 0.6 * guide; cx.textAlign = "center"; cx.fillText(c[1].toUpperCase(), p[0], p[1]); cx.textAlign = "start";
      });
    }

    // 3. cluster outlines (the sphere and the orbits; the table layouts are already grouped)
    if (opt.clu && (G.layout === "sphere" || G.layout === "orbits")) {
      cx.setLineDash([5, 5]); cx.lineWidth = 1.1;
      GROUP_ORDER.forEach((g) => {
        const ms = nodes.filter((n) => n.group === g && V[n.id] > 0.5); if (ms.length < 3) return;
        let mx = 0, my = 0; ms.forEach((n) => { mx += P[n.id][0]; my += P[n.id][1]; }); mx /= ms.length; my /= ms.length;
        let rr = 0; ms.forEach((n) => (rr = Math.max(rr, Math.hypot(P[n.id][0] - mx, P[n.id][1] - my)))); rr = rr * 0.9 + 14;
        const a = selOn || G.path || evidOn ? 0.05 : 0.2;
        cx.globalAlpha = a; cx.strokeStyle = T.fg; cx.beginPath(); cx.arc(mx, my, rr, 0, TAU); cx.stroke();
        late.push({ txt: SECTIONS[gi(g)].name.toUpperCase(), x: mx, y: my - rr - 6, align: "center", alpha: a * 2.4, color: T.fg });
      });
      cx.setLineDash([]);
    }

    // 4. drop-lines
    if (opt.drop) {
      cx.lineWidth = 1;
      nodes.forEach((n) => {
        if (V[n.id] <= 0.05) return;
        const q = WP[n.id], f = proj([q[0], FLOOR, q[2]]), p = P[n.id], dim = dimmed(n.id);
        cx.globalAlpha = (dim ? 0.03 : 0.08 + 0.1 * near(p[2])) * V[n.id]; cx.strokeStyle = T.fg;
        cx.beginPath(); cx.moveTo(p[0], p[1]); cx.lineTo(f[0], f[1]); cx.stroke();
        cx.globalAlpha = (dim ? 0.05 : 0.3) * V[n.id]; cx.fillStyle = T.fg; cx.fillRect(f[0] - 1.5, f[1] - 1.5, 3, 3);
      });
    }

    // 5. edges, the data flow and the grow-in tip
    edges.forEach((e) => {
      const a = e.a, b = e.b, A = P[a], B = P[b], vv = Math.min(V[a], V[b]);
      if (vv <= 0.02) {
        if (G.hist !== null && opt.ghost && G.kindOn[byId[a].k] > 0.5 && G.kindOn[byId[b].k] > 0.5) { cx.globalAlpha = 0.06; cx.strokeStyle = T.fg; cx.lineWidth = 1; cx.setLineDash([2, 4]); cx.beginPath(); cx.moveTo(A[0], A[1]); cx.lineTo(B[0], B[1]); cx.stroke(); cx.setLineDash([]); }
        return;
      }
      let g, grow, fromA = DELAY[a] <= DELAY[b];
      if (G.hist !== null) { g = 1; grow = 1; }
      else {
        const start = Math.max(DELAY[a], DELAY[b]) - 200;
        g = REDUCE ? (now - G.t0 >= start * 0.04 ? 1 : 0) : clamp((now - G.t0 - start) / 380, 0, 1);
        grow = 1 - Math.pow(1 - g, 2);
      }
      if (g <= 0) return;
      let alpha = (G.ink ? 0.2 : 0.14) + 0.4 * near((A[2] + B[2]) / 2), hot = false, width = 1, direct = false, emph = false;
      const mFlag = opt.heat && ((byId[a].k === "meas" && byId[a].flag !== "in") || (byId[b].k === "meas" && byId[b].flag !== "in"));
      if (G.path) {
        const ia = pathIds[a], ib = pathIds[b];
        if (ia !== undefined && ib !== undefined && Math.abs(ia - ib) === 1 && Math.max(ia, ib) < pathStep) {
          hot = emph = true; width = 3; alpha = 1; fromA = ia < ib;
          const pg = clamp((now - G.path.t0 - Math.max(ia, ib) * 480 + 480) / 400, 0, 1); grow = Math.min(grow, 1 - Math.pow(1 - pg, 3));
        } else alpha = 0.04;
      } else if (evidOn) {
        if (evidSet[a] && evidSet[b]) { hot = emph = true; width = 2.4; alpha = 1; } else alpha = 0.05;
      } else if (selOn) {
        if (a === sel || b === sel) { direct = emph = hot = true; width = 2.4; alpha = 1; fromA = a === sel; grow = Math.min(grow, REDUCE ? 1 : 1 - Math.pow(1 - clamp((now - G.selT0) / 520, 0, 1), 3)); }
        else if ((G.h1[a] && G.h2[b]) || (G.h1[b] && G.h2[a])) { hot = true; width = 1.4; alpha = 0.55; fromA = !!G.h1[a]; grow = Math.min(grow, REDUCE ? 1 : 1 - Math.pow(1 - clamp((now - G.selT0 - 450) / 520, 0, 1), 3)); }
        else alpha = 0.05;
      } else if (hov && (a === hov || b === hov)) { hot = emph = true; width = 1.8; alpha = 0.9; }
      else if (mFlag) { hot = true; alpha = 0.75; width = 1.5; }
      if (grow <= 0) return;
      const t0 = fromA ? 0 : 1 - grow, t1 = fromA ? grow : 1, S0 = curvePt(A, B, t0), E0 = curvePt(A, B, t1);
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, qx = mx - (B[1] - A[1]) * 0.08, qy = my + (B[0] - A[0]) * 0.08, cw = (1 - t0) * t1 + t0 * (1 - t1);
      const kx = (1 - t0) * (1 - t1) * A[0] + cw * qx + t0 * t1 * B[0], ky = (1 - t0) * (1 - t1) * A[1] + cw * qy + t0 * t1 * B[1];
      cx.globalAlpha = alpha * Math.min(1, g * 2) * vv; cx.strokeStyle = hot ? C.acc : T.fg; cx.lineWidth = width;
      cx.beginPath(); cx.moveTo(S0[0], S0[1]); cx.quadraticCurveTo(kx, ky, E0[0], E0[1]); cx.stroke();
      if (grow < 1 && motion && G.hist === null) {
        const tp = fromA ? E0 : S0; cx.globalAlpha = 0.95; cx.fillStyle = C.acc; cx.beginPath(); cx.arc(tp[0], tp[1], 3, 0, TAU); cx.fill();
      } else if (opt.flow && motion && grow >= 1 && !((selOn || G.path || evidOn) && !emph)) {
        for (let k = 0; k < 2; k++) {
          const ph = ((now / 1000) * (emph ? 0.55 : 0.22) + e.h + k * 0.5) % 1, sp = curvePt(A, B, e.dir ? ph : 1 - ph);
          cx.globalAlpha = (emph || hot ? 0.95 : 0.5 + 0.4 * near((A[2] + B[2]) / 2)) * vv; cx.fillStyle = emph || hot ? C.acc : T.fg;
          const r = emph ? 2.6 : 1.5; cx.fillRect(sp[0] - r, sp[1] - r, r * 2, r * 2);
        }
      } else if (direct && motion && grow >= 1) {
        const ph = ((now - G.selT0) / 1500 + e.h) % 1, sp = curvePt(A, B, fromA ? ph : 1 - ph);
        cx.globalAlpha = 0.95; cx.fillStyle = C.acc; cx.beginPath(); cx.arc(sp[0], sp[1], 2.6, 0, TAU); cx.fill();
      }
    });

    // 5b. a comet that keeps running along a found path
    if (G.path && motion && pathStep >= G.path.ids.length) {
      const ids = G.path.ids, L = ids.length - 1, u0 = ((now - G.path.t0 - L * 480) / 1000) * 1.2;
      for (let s = 0; s < 14; s++) {
        let u = (u0 - s * 0.045) % L; if (u < 0) u += L;
        const seg = Math.min(L - 1, Math.floor(u)), t = u - seg, e = EKEY[ids[seg] + "|" + ids[seg + 1]];
        const p = curvePt(P[e.a], P[e.b], e.a === ids[seg] ? t : 1 - t), r = 4.4 * (1 - s / 16);
        cx.globalAlpha = (1 - s / 14) * 0.95; cx.fillStyle = C.acc; cx.fillRect(p[0] - r / 2, p[1] - r / 2, r, r);
      }
    }

    // 6. nodes, far to near
    const order = nodes.slice().sort((a, b) => P[b.id][2] - P[a.id][2]);
    G.hits.length = 0; const labels = [];
    order.forEach((n) => {
      const q = P[n.id], rv = V[n.id];
      const ghost = rv <= 0.01 && G.hist !== null && opt.ghost && G.kindOn[n.k] > 0.5;
      if (rv <= 0.01 && !ghost) return;
      const k = q[3] * (q[4] || 1), isSel = sel === n.id, isHov = G.hover === n.id;
      const base = KINDS[n.k].base * (opt.size ? 0.85 + 1.15 * Math.sqrt(n.imp) : 1);
      if (ghost) { cx.globalAlpha = 0.25; cx.strokeStyle = T.fg; cx.lineWidth = 1; cx.setLineDash([2, 3]); cx.beginPath(); cx.arc(q[0], q[1], base * q[3], 0, TAU); cx.stroke(); cx.setLineDash([]); return; }
      const l1 = selOn && (isSel || G.h1[n.id]), l2 = selOn && G.h2[n.id];
      const onPath = G.path && pathIds[n.id] !== undefined && pathIds[n.id] < pathStep, ev = evidOn && evidSet[n.id];
      const dim = dimmed(n.id) && !onPath;
      const alpha = (dim ? 0.13 : selOn && l2 ? 0.8 : 0.6 + 0.4 * near(q[2])) * rv;
      const heatHot = opt.heat && (n.k === "meas" || n.k === "bio") && n.flag !== "in";
      const hot = !!(l1 || onPath || ev || heatHot);
      const rad = base * k * (0.4 + 0.6 * rv);
      G.hits.push({ id: n.id, x: q[0], y: q[1], r: Math.max(rad, 8), z: q[2] });
      cx.globalAlpha = alpha; cx.lineWidth = 2.5; cx.fillStyle = hot ? C.acc : T.fg; cx.strokeStyle = hot ? C.acc : T.fg; cx.beginPath();
      if (n.k === "person") { cx.rect(q[0] - rad, q[1] - rad, rad * 2, rad * 2); cx.fill(); }
      else if (n.k === "report") { cx.arc(q[0], q[1], rad, 0, TAU); cx.fillStyle = T.bg; cx.fill(); cx.stroke(); }
      else if (n.k === "section") { cx.moveTo(q[0], q[1] - rad); cx.lineTo(q[0] + rad, q[1]); cx.lineTo(q[0], q[1] + rad); cx.lineTo(q[0] - rad, q[1]); cx.closePath(); cx.fillStyle = T.bg; cx.fill(); cx.lineWidth = 2; cx.stroke(); }
      else if (n.k === "bio") { cx.arc(q[0], q[1], rad, 0, TAU); cx.fill(); }
      else if (n.k === "meas") { cx.arc(q[0], q[1], rad, 0, TAU); cx.fillStyle = hot ? C.acc : T.mute; cx.fill(); }
      else { cx.setLineDash([3, 3]); cx.arc(q[0], q[1], rad, 0, TAU); cx.fillStyle = T.bg; cx.fill(); cx.strokeStyle = C.acc; cx.stroke(); cx.setLineDash([]); }
      if (opt.heat && n.k === "bio" && n.flag !== "in") { cx.globalAlpha = 0.9 * rv; cx.strokeStyle = C.acc; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(q[0], q[1], rad + 5, 0, TAU); cx.stroke(); }
      if (selOn && G.h1[n.id] && motion) {
        const rt = (now - G.selT0 - 520) / 900;
        if (rt >= 0 && rt < 1) { cx.globalAlpha = (1 - rt) * 0.8; cx.strokeStyle = C.acc; cx.lineWidth = 2; cx.beginPath(); cx.arc(q[0], q[1], rad + 4 + rt * 24, 0, TAU); cx.stroke(); }
      }
      if (G.hist !== null && motion) {
        const ht = (G.hist - n.t + 0.12) / 0.4;
        if (ht > 0 && ht < 1) { cx.globalAlpha = (1 - ht) * 0.8; cx.strokeStyle = C.acc; cx.lineWidth = 2; cx.beginPath(); cx.arc(q[0], q[1], rad + 3 + ht * 22, 0, TAU); cx.stroke(); }
      }
      if (isSel || (isHov && !opt.lens)) { cx.globalAlpha = 1; cx.strokeStyle = isSel ? C.acc : T.fg; cx.lineWidth = 2; cx.beginPath(); cx.arc(q[0], q[1], rad + 6, 0, TAU); cx.stroke(); }
      if (ev) {
        const bx = q[0] + rad * 0.7, by = q[1] - rad * 0.9 - 8; cx.globalAlpha = 1; cx.fillStyle = C.acc; cx.fillRect(bx - 9, by - 9, 18, 18);
        cx.fillStyle = C.bg; cx.font = "800 11px " + FONT; cx.textAlign = "center"; cx.fillText(String(evidSet[n.id]), bx, by + 4); cx.textAlign = "start";
      }
      const inLens = lensOn && q[4] > 1;
      const inFocus = selOn ? l1 || isHov || (l2 && n.k !== "meas" && n.k !== "unc") : G.path ? onPath : evidOn ? ev : true;
      const can = (inFocus || inLens) && rv > 0.6 && (n.k !== "meas" && n.k !== "unc" ? true : isSel || isHov || (selOn && G.h1[n.id]) || ev || onPath || inLens || G.zoom > 1.9 || (opt.heat && n.flag !== "in") || G.layout === "timeline");
      if (can) labels.push({ n, rad, alpha: Math.max(alpha, inLens ? 1 : 0), inLens: inLens ? 1 : 0, k, hot });
    });

    // 7. labels: priority (selected and path ends, then the lens, then anything red), then greedy overlap pruning
    const ends = G.path ? [G.path.ids[0], G.path.ids[G.path.ids.length - 1]] : [];
    const pri = (L) => (L.n.id === sel || ends.indexOf(L.n.id) >= 0 ? 0 : L.inLens ? 1 : L.hot ? 2 + KINDS[L.n.k].ord * 0.1 : 3 + KINDS[L.n.k].ord);
    labels.sort((a, b) => pri(a) - pri(b) || P[a.n.id][2] - P[b.n.id][2]);
    const boxes = [];
    labels.forEach((L) => {
      const n = L.n, q = P[n.id], fs = Math.min(22, Math.max(10, 12.5 * L.k));
      cx.font = (n.k === "report" || n.k === "person" ? "800 " : "600 ") + fs + "px " + FONT;
      let txt = n.k === "meas" && (G.layout === "timeline" || L.inLens) ? fmt(n.val) : n.label;
      if (opt.heat && n.k === "bio") txt = n.name + "  " + fmt(n.latest) + (n.delta > 0 ? " ↑" : n.delta < 0 ? " ↓" : "") + (n.flag === "high" ? " ▲" : n.flag === "low" ? " ▼" : "");
      if (txt.length > 30) txt = txt.slice(0, 29) + "…";
      const tw = cx.measureText(txt).width, tx = q[0] + L.rad + 7, ty = q[1] + fs * 0.35;
      const bx = { x0: tx - 3, y0: ty - fs, x1: tx + tw + 3, y1: ty + 3 };
      if (n.id !== sel) for (let i = 0; i < boxes.length; i++) { const o = boxes[i]; if (!(bx.x1 < o.x0 || bx.x0 > o.x1 || bx.y1 < o.y0 || bx.y0 > o.y1)) return; }
      boxes.push(bx);
      const hotL = (selOn && (G.h1[n.id] || n.id === sel)) || (G.path && pathIds[n.id] !== undefined) || (evidOn && evidSet[n.id]) || (opt.heat && n.flag && n.flag !== "in");
      cx.globalAlpha = Math.max(L.alpha, n.id === sel || n.id === G.hover ? 1 : 0); cx.lineWidth = 4; cx.strokeStyle = T.bg; cx.lineJoin = "round"; cx.strokeText(txt, tx, ty);
      cx.fillStyle = hotL ? C.acc : T.fg; cx.fillText(txt, tx, ty);
    });

    // 7b. the queued guide words, skipped where they would sit on a label or a big node
    cx.font = "800 10px " + FONT;
    late.forEach((t) => {
      if (t.alpha < 0.02) return;
      const w = cx.measureText(t.txt).width, x0 = t.align === "center" ? t.x - w / 2 : t.x;
      const bx = { x0: x0 - 2, y0: t.y - 10, x1: x0 + w + 2, y1: t.y + 3 };
      for (let i = 0; i < boxes.length; i++) { const o = boxes[i]; if (!(bx.x1 < o.x0 || bx.x0 > o.x1 || bx.y1 < o.y0 || bx.y0 > o.y1)) return; }
      for (let i = 0; i < G.hits.length; i++) { const h = G.hits[i]; if (h.r > 7 && !(bx.x1 < h.x - h.r || bx.x0 > h.x + h.r || bx.y1 < h.y - h.r || bx.y0 > h.y + h.r)) return; }
      boxes.push(bx);
      cx.globalAlpha = t.alpha; cx.fillStyle = t.color; cx.textAlign = t.align === "center" ? "center" : "start"; cx.fillText(t.txt, t.x, t.y); cx.textAlign = "start";
    });

    // 8. intro shockwaves from the person
    if (motion && now - G.introT0 < MAXD + 2500) {
      const pc = P.p;
      for (let d = 1; d <= 4; d++) {
        let first = Infinity; nodes.forEach((n) => { if (DEPTH[n.id] === d) first = Math.min(first, DELAY[n.id]); });
        if (!isFinite(first)) continue;
        const age = now - G.introT0 - first;
        if (age > 0 && age < 1500) { cx.globalAlpha = (1 - age / 1500) * 0.6; cx.strokeStyle = C.acc; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(pc[0], pc[1], age * 0.42, 0, TAU); cx.stroke(); }
      }
    }

    // 9. the lens ring
    if (lensOn) {
      cx.globalAlpha = 0.9; cx.strokeStyle = T.fg; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(G.mouse.x, G.mouse.y, LR, 0, TAU); cx.stroke();
      cx.globalAlpha = 0.35; cx.beginPath(); cx.arc(G.mouse.x, G.mouse.y, LR + 5, 0, TAU); cx.stroke();
      cx.globalAlpha = 1; cx.fillStyle = C.acc; cx.fillRect(G.mouse.x + LR * 0.7 - 3, G.mouse.y - LR * 0.7 - 3, 6, 6);
      cx.font = "800 10px " + FONT; cx.fillStyle = T.fg; cx.fillText("LENS", G.mouse.x + LR * 0.7 + 6, G.mouse.y - LR * 0.7 + 4);
    }
    cx.globalAlpha = 1;

    // 10. the dossier docks at the side of the stage (a bottom sheet on a phone) with a leader line to its node
    if (sel && !dossier.hidden) {
      const q = P[sel], dw = dossier.offsetWidth, dh = dossier.offsetHeight;
      if (W < 600) { dossier.style.left = "8px"; dossier.style.top = Math.max(8, H - dh - 8) + "px"; }
      else {
        const left = W - dw - 16, top = 60;
        dossier.style.left = left + "px"; dossier.style.top = top + "px";
        if (q[0] < left - 8) {
          const ey = clamp(q[1], top + 24, top + Math.min(dh, 220) - 12), mx = (q[0] + left) / 2;
          cx.globalAlpha = 0.95; cx.strokeStyle = C.acc; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(q[0], q[1]); cx.lineTo(mx, q[1]); cx.lineTo(mx, ey); cx.lineTo(left, ey); cx.stroke();
          cx.fillStyle = C.acc; cx.fillRect(left - 6, ey - 3, 6, 6); cx.globalAlpha = 1;
        }
      }
    }

    // tooltip
    if (hov && !G.drag && !opt.lens) {
      const hn = byId[hov], hp = P[hov], deg = adj[hn.id].length;
      tip.hidden = false; tip.innerHTML = "<em></em><b></b><span></span>";
      tip.querySelector("em").textContent = KINDS[hn.k].word; tip.querySelector("b").textContent = hn.k === "bio" ? hn.name + " · " + fmt(hn.latest) + " " + hn.unit : hn.label;
      tip.querySelector("span").textContent = deg + " connection" + (deg === 1 ? "" : "s") + " · click for details";
      let tx2 = hp[0] + 18; const ty2 = hp[1] - 14; if (tx2 + 250 > W) tx2 = hp[0] - 258;
      tip.style.left = Math.max(8, tx2) + "px"; tip.style.top = Math.max(8, ty2) + "px";
    } else tip.hidden = true;

    $("count").textContent = nodes.filter((n) => V[n.id] > 0.5).length + " nodes · " + edges.filter((e) => V[e.a] > 0.5 && V[e.b] > 0.5).length + " links";
  }

  /* ---------- panel behaviours ---------- */
  function stopHist() { G.histPlay = false; $("histPlay").textContent = "Play"; }
  $("histPlay").addEventListener("click", () => {
    clearPath(); setEvid(false); select(null);
    if (G.histPlay) { stopHist(); return; }
    G.histPlay = true; G.histStart = performance.now(); G.hist = 0; G.histI = -1; $("histPlay").textContent = "Pause";
  });
  $("histAll").addEventListener("click", () => { stopHist(); G.hist = null; G.t0 = performance.now() - 60000; $("histdate").hidden = true; $("histRange").value = "200"; });
  $("histRange").addEventListener("input", (e) => { stopHist(); clearPath(); select(null); G.hist = +e.target.value / 100; });

  (function fill() {
    const list = nodes.filter((n) => n.k === "bio" || n.k === "section" || n.k === "report");
    ["pathFrom", "pathTo"].forEach((id) => { const s = $(id); list.forEach((n) => { const o = document.createElement("option"); o.value = n.id; o.textContent = KINDS[n.k].word + ": " + n.label; s.appendChild(o); }); });
    $("pathFrom").value = "b_cbc0"; $("pathTo").value = "b_vit0";
    const dl = $("names"), seen = {};
    nodes.forEach((n) => { if (n.k === "meas" || seen[n.label]) return; seen[n.label] = 1; const o = document.createElement("option"); o.value = n.label; dl.appendChild(o); });
  })();
  function bfsPath(a, b) {
    const prev = { [a]: null }, q = [a];
    for (let h = 0; h < q.length; h++) { const v = q[h]; if (v === b) break; adj[v].forEach((w) => { if (!(w in prev)) { prev[w] = v; q.push(w); } }); }
    if (!(b in prev)) return null;
    const out = []; let c = b; while (c !== null) { out.push(c); c = prev[c]; } return out.reverse();
  }
  function showBar(node) { bar.innerHTML = ""; if (!node) { bar.hidden = true; return; } bar.appendChild(node); bar.hidden = false; }
  function heatCaption() {
    const bios = nodes.filter((n) => n.k === "bio");
    const fixed = bios.filter((n) => n.firstFlag !== "in" && n.flag === "in").map((n) => n.name), still = bios.filter((n) => n.flag !== "in").map((n) => n.name);
    const s = el("span"); s.appendChild(el("b", "", fixed.length + " values moved into the printed range since January")); s.appendChild(document.createTextNode(" (" + fixed.join(", ") + "). Still outside it: " + still.join(" and ") + "."));
    showBar(s);
  }
  function restoreBar() { if (G.path || G.evid) return; if (opt.heat) heatCaption(); else showBar(null); }
  function showPath() {
    const a = $("pathFrom").value, b = $("pathTo").value;
    if (a === b) { showBar(el("span", "", "Pick two different nodes.")); return; }
    const ids = bfsPath(a, b); if (!ids) { showBar(el("span", "", "These two are not connected.")); return; }
    stopHist(); G.hist = null; G.evid = null; $("evid").setAttribute("aria-pressed", "false"); select(null);
    G.path = { ids, t0: performance.now() };
    const s = el("span"); s.appendChild(el("b", "", ids.length - 1 + " steps: ")); s.appendChild(document.createTextNode(ids.map((id) => byId[id].label).join("  →  ")));
    showBar(s);
  }
  function clearPath() { G.path = null; restoreBar(); }
  $("pathGo").addEventListener("click", showPath);
  $("pathClear").addEventListener("click", clearPath);
  function setEvid(on) {
    G.evid = on ? EVID : null; $("evid").setAttribute("aria-pressed", String(on));
    if (on) { G.path = null; select(null); const s = el("span"); s.appendChild(el("b", "", "The last answer cited 4 passages")); s.appendChild(document.createTextNode(" about hemoglobin. Each red square is one of them.")); showBar(s); }
    else restoreBar();
  }
  $("evid").addEventListener("click", () => setEvid(!G.evid));
  $("spin").addEventListener("click", () => { G.spin = !G.spin; G.userRot = false; $("spin").textContent = G.spin ? "Pause" : "Rotate"; $("spin").setAttribute("aria-pressed", String(!G.spin)); });
  function setLens(on) { opt.lens = on; $("m-lens").checked = on; $("lensBtn").setAttribute("aria-pressed", String(on)); }
  $("lensBtn").addEventListener("click", () => setLens(!opt.lens));
  $("themeBtn").addEventListener("click", () => { G.ink = !G.ink; stage.classList.toggle("ink", G.ink); $("themeBtn").textContent = G.ink ? "Paper stage" : "Ink stage"; });
  $("search").addEventListener("change", (e) => {
    const q = e.target.value.trim().toLowerCase(); if (!q) return;
    const hit = nodes.find((n) => n.label.toLowerCase() === q) || nodes.find((n) => n.k !== "meas" && n.label.toLowerCase().includes(q));
    if (!hit) { showBar(el("span", "", "Nothing called “" + e.target.value + "” in this graph.")); return; }
    G.path = null; G.evid = null; $("evid").setAttribute("aria-pressed", "false"); stopHist(); G.hist = null; select(hit.id); restoreBar(); e.target.blur();
  });
  const OPT = { "m-flow": "flow", "m-lens": "lens", "m-heat": "heat", "m-ghost": "ghost", "u-size": "size", "u-breath": "breath", "u-drop": "drop", "u-hover": "hover", "u-fly": "fly", "u-clu": "clu" };
  Object.keys(OPT).forEach((id) => $(id).addEventListener("change", () => {
    opt[OPT[id]] = $(id).checked;
    if (id === "m-lens") setLens($(id).checked);
    if (id === "m-heat") { G.path = null; G.evid = null; $("evid").setAttribute("aria-pressed", "false"); restoreBar(); }
  }));
  $("snap").addEventListener("click", () => {
    const W = 1600, H = 1000, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"), T = TH();
    x.fillStyle = T.bg; x.fillRect(0, 0, W, H);
    const sc = Math.min(W / G.W, (H - 140) / G.H), dw = G.W * sc, dh = G.H * sc;
    x.drawImage(cv, 0, 0, cv.width, cv.height, (W - dw) / 2, 96, dw, dh);
    x.fillStyle = C.acc; x.fillRect(48, 36, 16, 16);
    x.fillStyle = T.fg; x.font = "800 34px " + FONT; x.fillText("Knowledge graph", 76, 54);
    x.font = "400 18px " + FONT; x.globalAlpha = 0.7; x.fillText("Sample data · " + N + " nodes · " + edges.length + " links · VitaGraph", 48, H - 30);
    $("snapimg").src = c.toDataURL("image/png"); $("modal").hidden = false; $("modalClose").focus();
  });
  $("modalClose").addEventListener("click", () => ($("modal").hidden = true));
  $("modal").addEventListener("click", (e) => { if (e.target === $("modal")) $("modal").hidden = true; });
  [["report", "Reports"], ["section", "Sections"], ["bio", "Biomarkers"], ["meas", "Values"], ["unc", "Uncertain"]].forEach((c) => {
    const b = el("button", "btn btn-secondary btn-small", c[1]); b.type = "button"; b.setAttribute("aria-pressed", "true");
    b.addEventListener("click", () => { const on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on)); G.kindWant[c[0]] = on ? 1 : 0; });
    $("chips").appendChild(b);
  });
  [["Subject", "background:var(--color-text)"], ["Report", "border:2.5px solid var(--color-text);border-radius:50%;background:var(--color-bg)"], ["Section", "border:2px solid var(--color-text);transform:rotate(45deg) scale(.8);background:var(--color-bg)"], ["Biomarker", "background:var(--color-text);border-radius:50%"], ["Value", "background:var(--color-neutral-700);border-radius:50%;width:8px;height:8px;margin:2px"], ["Uncertain", "border:2px dashed var(--color-accent);border-radius:50%"]]
    .forEach((l) => { const s = el("span"), i = el("i", "sym"); i.style.cssText = l[1]; s.appendChild(i); s.appendChild(document.createTextNode(l[0])); $("legend").appendChild(s); });

