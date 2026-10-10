(function () {
const { useRef, useLayoutEffect } = React;
const E = window.Easing;
const useComposition = window.useComposition;
const cl = (v, a, b) => Math.min(b, Math.max(a, v));
const pr = (T, a, d) => cl((T - a) / d, 0, 1);
const MOTION = {
  enter: (T, a, d = 0.7) => E.easeOutCubic(pr(T, a, d)),
  draw: (T, a, d) => E.easeInOutCubic(pr(T, a, d)),
  pop: (T, a, d = 0.5) => E.easeOutBack(pr(T, a, d)),
};
const win = (T, a, b, f = 0.5) => cl((T - a) / f, 0, 1) * cl((b - T) / f, 0, 1);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const ty = (s, t, a, cps) => s.slice(0, Math.floor(cl((t - a) * cps, 0, s.length)));
const pad = (n) => String(n).padStart(2, '0');

const INK = 'var(--color-text)', BGc = 'var(--color-bg)', ACC = 'var(--color-accent)', DIV = 'var(--color-divider)';
const SURF = 'var(--color-surface)', N7 = 'var(--color-neutral-700)', N8 = 'var(--color-neutral-800)', N2 = 'var(--color-neutral-200)';
const A7 = 'var(--color-accent-700)', A8 = 'var(--color-accent-800)', A1 = 'var(--color-accent-100)', A2 = 'var(--color-accent-200)';
const mix = (c, p) => `color-mix(in srgb, ${c} ${p}%, transparent)`;
const GRID = { backgroundImage: `linear-gradient(${mix(INK, 7)} 1px, transparent 1px), linear-gradient(90deg, ${mix(INK, 7)} 1px, transparent 1px)`, backgroundSize: '48px 48px' };
const HATCH = `repeating-linear-gradient(45deg, ${mix(ACC, 30)} 0 6px, transparent 6px 16px)`;
const CAPS = { fontSize: 20, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: N7 };

let _col = null;
function cols() {
  if (_col) return _col;
  const cs = getComputedStyle(document.documentElement), g = (n) => cs.getPropertyValue(n).trim();
  const o = { ink: g('--color-text'), acc: g('--color-accent'), bg: g('--color-bg'), n7: g('--color-neutral-700'), n5: g('--color-neutral-500') };
  if (o.ink && o.acc && o.bg) { _col = o; return o; }
  return { ink: '#201e1d', acc: '#ec3013', bg: '#f3f2f2', n7: '#605d5d', n5: '#9b9797' };
}

function Cv({ w, h, draw, on = true, style }) {
  const r = useRef(null);
  useLayoutEffect(() => {
    const c = r.current; if (!c || !on) return;
    const d = 2; if (c.width !== w * d) { c.width = w * d; c.height = h * d; }
    const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, w, h); draw(x, cols());
  });
  return <canvas ref={r} style={{ width: w, height: h, display: 'block', ...style }} />;
}

const Tag = ({ k = 'ink', children, style }) => {
  const m = { ink: { background: INK, color: BGc }, acc: { background: ACC, color: BGc }, soft: { background: N2, color: N8 }, line: { border: `2px solid ${INK}`, color: INK, lineHeight: '24px' } }[k];
  return <span style={{ display: 'inline-block', padding: '3px 12px', fontSize: 20, fontWeight: 800, letterSpacing: '0.04em', lineHeight: '28px', whiteSpace: 'nowrap', ...m, ...style }}>{children}</span>;
};
const Box = ({ T, a, b, children }) => {
  const o = win(T, a, b, 0.4);
  return <div style={{ position: 'absolute', inset: 0, opacity: o, display: o > 0 ? 'block' : 'none' }}>{children}</div>;
};
const At = ({ x, y, w, h, style, children }) => <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, ...style }}>{children}</div>;

/* ───────────── data ───────────── */
const NAMES = ['Opening', 'Parse', 'OCR', 'Chunk', 'Embed', 'Index', 'Ask', 'Graph', 'Stream', 'Guard', 'Numbers', 'Close'];
const NAV = ['Open', 'Parse', 'OCR', 'Chunk', 'Embed', 'Index', 'Ask', 'Graph', 'Stream', 'Guard', 'Count', 'End'];
const PG = [{ c: 1284, q: 0.98 }, { c: 1102, q: 0.97 }, { c: 968, q: 0.99 }, { c: 1347, q: 0.96 }, { c: 0, q: null }];
const OL = ['ADDENDUM — SCANNED ATTACHMENT', 'Date of collection 14 Feb 2026', 'Platelet count (manual) 245,000 /µL', 'Reference 150,000 - 450,000 /µL', 'Smear: normocytic, normochromic', 'Verified by: Lab Tech 0412', 'Remarks: no abnormal cells seen', 'End of report'];
const OC = [0.97, 0.96, 0.95, 0.97, 0.93, 0.68, 0.94, 0.99];
const OCR_CH = OL.reduce((a, s) => a + s.length, 0);
const MEAN = OC.reduce((a, b) => a + b, 0) / OC.length;
const TOTAL = PG.reduce((a, p) => a + p.c, 0) + OCR_CH;
const CH = (() => {
  const pc = PG.map((p, i) => (i === 4 ? OCR_CH : p.c));
  let lens = []; for (let i = 0; i < 24; i++) { const r = Math.sin(i * 12.9898 + 1.7) * 43758.5453; lens.push(0.75 + 0.5 * (r - Math.floor(r))); }
  const sum = lens.reduce((a, b) => a + b, 0); lens = lens.map((v) => Math.round(v / sum * TOTAL)); lens[23] += TOTAL - lens.reduce((a, b) => a + b, 0);
  let s = 0;
  return lens.map((l, i) => {
    const st = s; s += l; let off = 0, pg = 5;
    for (let k = 0; k < 5; k++) { if (st < off + pc[k]) { pg = k + 1; break; } off += pc[k]; }
    return { id: 'c' + pad(i + 1), st, en: s - 1, pg, ent: 1 + Math.floor((Math.sin(i * 7.77) * 0.5 + 0.5) * 3.99) };
  });
})();
const ENT_SUM = CH.reduce((a, c) => a + c.ent, 0);

const SCN = {
  Parse: { k: '02 / Parse', h: 'Read every page.', b: 'Each page is tested for a text layer before anything else touches it.', pts: [['Text-layer detection', 'PyMuPDF, page by page'], ['Scan detection', 'Pages without text are routed to OCR'], ['Table normalization', 'Rows and columns kept intact'], ['Quality score per page', 'Stored in SQLite report_pages']] },
  OCR: { k: '03 / OCR', h: 'Read the scan.', b: 'Page 5 has no text layer, so a second engine reads the image.', pts: [['Dual OCR path', 'rapidocr-onnxruntime fallback'], ['Word boxes kept', 'Pixel coordinates for every line'], ['Confidence per read', 'Weak reads are flagged for review'], ['Offsets mapped back', "OCR text joins the page's character stream"]] },
  Chunk: { k: '04 / Chunk', h: 'Cut with memory.', b: 'Text is split at sentence boundaries, and each piece keeps its address.', pts: [['Sentence-aware chunker', 'No chunk ends mid-sentence'], ['char_start / char_end', 'Exact span inside the source'], ['Page and report ids', 'Every chunk traces back to a PDF'], ['Entity extraction', 'Mentions feed the knowledge graph']] },
  Embed: { k: '05 / Embed', h: 'Meaning as numbers.', b: 'Each chunk becomes a vector, so similar passages sit close together.', pts: [['all-MiniLM-L6-v2', '384 dimensions per chunk'], ['Normalised vectors', 'Cosine similarity as the metric'], ['Runs locally', 'Report text is embedded on the machine'], ['Batch encoding', 'All 24 chunks in one pass']] },
  Index: { k: '06 / Index', h: 'Store it twice.', b: 'Vectors go to a search index. Facts and history go to a database.', pts: [['ChromaDB collection', 'Cosine vector store'], ['user_id on every vector', 'Filter applied to every query'], ['SQLite system of record', 'Foreign keys, SHA-256, audit trail'], ['Consent and deletion', 'Deleting a user cascades everywhere']] },
  Ask: { k: '07 / Ask', h: 'Answer with receipts.', b: "A question is matched against the user's passages only, then answered in four parts.", pts: [['Question embedding', 'Same model, same space'], ['Top-5 retrieval', 'Ranked by cosine similarity'], ['Four-part answer', 'Summary, evidence, limitations, safety'], ['Citations', 'Report, page and character range']] },
  Graph: { k: '08 / Graph', h: 'Connect the dots.', b: 'The same chunks become a knowledge graph you can rotate and question.', pts: [['NetworkX graph', '23 nodes, 34 edges in this demo'], ['Six-type ontology', 'Person, report, section, biomarker, value, uncertainty'], ['Question subgraph', 'Active concepts pulse, the rest dims to 40%'], ['Graph analytics', 'Betweenness centrality, Louvain modularity']] },
  Stream: { k: '09 / Stream', h: 'Show the work live.', b: 'The interface moves only when the server says something happened.', pts: [['Server-Sent Events', '/api/jobs/{id}/events'], ['Broadcast broker', 'Multiple subscribers, replay buffer'], ['One 60 fps ticker', 'Springs and FLIP, no animation library'], ['Adaptive quality', 'Governor drops a tier before frames drop']] },
  Guard: { k: '10 / Guard', h: 'Fail closed.', b: 'When the system is unsure or broken, it says so instead of guessing.', pts: [['Policy refusals', 'Diagnosis and medication questions declined'], ['Failure injection', 'A backend drop shows a global banner'], ['Isolated failures', 'Vector store down, uploads still saved'], ['Honest labels', 'REPLAY MODE and allow_api are visible']] },
};

const CAP = [
  ['Opening', 0.6, 'Every lab report is pages of numbers nobody can search.'], ['Opening', 3.3, 'Follow one PDF from upload to answer.'],
  ['Parse', 0.6, 'Every page is checked for a real text layer.'], ['Parse', 6.4, 'Page 5 is a scan. It is routed to OCR.'],
  ['OCR', 0.6, 'The scan is read line by line, each with a box and a confidence.'], ['OCR', 7.2, 'Weak reads are flagged, not trusted.'],
  ['Chunk', 0.6, 'The text is cut at sentence boundaries. Each chunk remembers where it came from.'], ['Chunk', 6.4, 'Entities found in each chunk become graph nodes later.'],
  ['Embed', 0.6, 'Every chunk becomes 384 numbers.'], ['Embed', 4.6, 'Similar meaning ends up as nearby vectors.'],
  ['Index', 0.6, 'Vectors go into ChromaDB. Every query is filtered to one user.'], ['Index', 6.3, 'Reports, hashes and an audit trail go into SQLite.'],
  ['Ask', 0.6, 'The question is embedded the same way and matched by cosine similarity.'], ['Ask', 6.6, 'The answer has four parts. Each claim points to a page and a character range.'],
  ['Graph', 0.6, 'The same chunks build a knowledge graph.'], ['Graph', 5.2, 'A question lights up its own subgraph. The rest dims to 40%.'], ['Graph', 12.2, 'Centrality is computed on the graph itself.'],
  ['Stream', 0.6, 'Progress comes from real server events, not timers.'], ['Stream', 5.0, 'A governor lowers render quality before frames drop.'],
  ['Guard', 0.4, 'Clinical questions are declined by policy.'], ['Guard', 3.2, 'When a service fails, the interface says so.'],
  ['Numbers', 0.6, 'This is what sits behind one upload button.'],
  ['Close', 0.6, 'Questions are welcome. The live demo is one click away.'],
];

/* ───────────── knowledge graph (same model and renderer as the live demo) ───────────── */
const NODES = [
  { id: 'p', k: 'person', label: 'Arjun R', pos: [-0.056, -0.097, -0.073] }, { id: 'rj', k: 'report', label: 'Jan 2024', pos: [-0.056, -0.298, 0.32] },
  { id: 'ra', k: 'report', label: 'Aug 2024', pos: [0.064, -0.198, -0.47] }, { id: 'rf', k: 'report', label: 'Feb 2026', pos: [-0.028, 0.223, 0.068] },
  { id: 'sc', k: 'section', label: 'CBC', pos: [0.426, -0.177, -0.1] }, { id: 'sm', k: 'section', label: 'Metabolic', pos: [0.238, 0.525, -0.208] },
  { id: 'sv', k: 'section', label: 'Vitamins', pos: [-0.365, 0.056, 0.398] }, { id: 'bhb', k: 'bio', label: 'Hemoglobin', pos: [0.317, -0.686, -0.238] },
  { id: 'bwbc', k: 'bio', label: 'WBC', pos: [0.751, -0.021, 0.291] }, { id: 'bplt', k: 'bio', label: 'Platelets', pos: [0.544, 0.101, -0.588] },
  { id: 'bvd', k: 'bio', label: 'Vitamin D', pos: [-0.776, -0.111, -0.011] }, { id: 'bb12', k: 'bio', label: 'Vitamin B12', pos: [-0.271, 0.292, 0.778] },
  { id: 'bglu', k: 'bio', label: 'Glucose', pos: [0.429, 0.828, -0.08] }, { id: 'mhbj', k: 'meas', label: '13.1', pos: [0.293, -0.77, 0.279] },
  { id: 'mhba', k: 'meas', label: '13.2', pos: [0.133, -0.571, -0.728] }, { id: 'mhbf', k: 'meas', label: '14.0', pos: [-0.141, -0.691, -0.159] },
  { id: 'mvdj', k: 'meas', label: '18', pos: [-0.792, -0.048, 0.403] }, { id: 'mvdf', k: 'meas', label: '32.0', pos: [-0.602, -0.42, 0.241] },
  { id: 'mb12f', k: 'meas', label: '480', pos: [-0.275, 0.632, 0.5] }, { id: 'mwbcf', k: 'meas', label: '6,200', pos: [0.521, 0.313, 0.514] },
  { id: 'mpltf', k: 'meas', label: '245,000', pos: [0.121, 0.386, -0.679] }, { id: 'mgluf', k: 'meas', label: '94', pos: [-0.008, 0.869, 0.019] },
  { id: 'u', k: 'unc', label: 'Cause not stated', pos: [-0.842, -0.273, -0.465] },
];
const EDGES = [['p','rj'],['p','ra'],['p','rf'],['rj','sc'],['rj','sv'],['ra','sc'],['rf','sc'],['rf','sm'],['rf','sv'],['sc','bhb'],['sc','bwbc'],['sc','bplt'],['sm','bglu'],['sv','bvd'],['sv','bb12'],['bhb','mhbj'],['bhb','mhba'],['bhb','mhbf'],['bvd','mvdj'],['bvd','mvdf'],['bb12','mb12f'],['bwbc','mwbcf'],['bplt','mpltf'],['bglu','mgluf'],['mhbj','rj'],['mhba','ra'],['mhbf','rf'],['mvdj','rj'],['mvdf','rf'],['mb12f','rf'],['mwbcf','rf'],['mpltf','rf'],['mgluf','rf'],['u','bvd']];
const FOCUS = {
  hb: ['bhb', 'mhbj', 'mhba', 'mhbf', 'rj', 'ra', 'rf'],
  vit: ['bvd', 'mvdj', 'mvdf', 'bb12', 'mb12f', 'rj', 'rf', 'u'],
  feb: ['rf', 'mhbf', 'mvdf', 'mb12f', 'mwbcf', 'mpltf', 'mgluf', 'bhb', 'bvd', 'bb12', 'bwbc', 'bplt', 'bglu'],
};
const IDX = {}; NODES.forEach((n, i) => { IDX[n.id] = i; });
(() => { const ord = { person: 0, report: 1, section: 2, bio: 3, meas: 4, unc: 5 }, cnt = {}; NODES.forEach((n) => { cnt[n.k] = cnt[n.k] || 0; n.delay = ord[n.k] * 340 + cnt[n.k] * 50; cnt[n.k]++; }); })();
const BTW = (() => {
  const n = NODES.length, adj = NODES.map(() => []); EDGES.forEach(([a, b]) => { adj[IDX[a]].push(IDX[b]); adj[IDX[b]].push(IDX[a]); });
  const C = new Array(n).fill(0);
  for (let s = 0; s < n; s++) {
    const S = [], Pp = NODES.map(() => []), sig = new Array(n).fill(0), d = new Array(n).fill(-1); sig[s] = 1; d[s] = 0; const Q = [s];
    while (Q.length) { const v = Q.shift(); S.push(v); adj[v].forEach((w) => { if (d[w] < 0) { d[w] = d[v] + 1; Q.push(w); } if (d[w] === d[v] + 1) { sig[w] += sig[v]; Pp[w].push(v); } }); }
    const del = new Array(n).fill(0);
    while (S.length) { const w = S.pop(); Pp[w].forEach((v) => { del[v] += sig[v] / sig[w] * (1 + del[w]); }); if (w !== s) C[w] += del[w]; }
  }
  const norm = (n - 1) * (n - 2);
  return NODES.map((nd, i) => ({ label: nd.label, v: C[i] / norm })).sort((a, b) => b.v - a.v).slice(0, 5);
})();

function drawGraph(x, w, h, tMs, ry, focus, focusT0, c) {
  const rx = 0.4, cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
  const S = Math.min(w, h) * 0.33, F = 3.4, ox = w * 0.45, oy = h / 2, K = 1.3;
  const proj = (p) => { const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy; const y2 = p[1] * cx - z1 * sx, z2 = p[1] * sx + z1 * cx; const k = F / (F + z2); return [ox + x1 * S * k, oy + y2 * S * k, z2, k]; };
  const act = focus === 'all' ? null : new Set(FOCUS[focus]);
  const near = (z) => Math.max(0, Math.min(1, 1 - (z + 1.2) / 2.4));
  x.strokeStyle = c.ink; x.lineWidth = 1;
  for (let i = -4; i <= 4; i++) {
    const t = i * 0.4;
    [[[t, 1.3, -1.6], [t, 1.3, 1.6]], [[-1.6, 1.3, t], [1.6, 1.3, t]]].forEach(([a, b]) => { const A = proj(a), B = proj(b); x.globalAlpha = 0.07 + 0.16 * near((A[2] + B[2]) / 2); x.beginPath(); x.moveTo(A[0], A[1]); x.lineTo(B[0], B[1]); x.stroke(); });
  }
  const P = {}, V = {}; NODES.forEach((n) => { P[n.id] = proj(n.pos); const t = (tMs - 800 - n.delay) / 420; V[n.id] = t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3); });
  EDGES.forEach(([a, b]) => {
    const A = P[a], B = P[b], v = Math.min(V[a], V[b]); if (v <= 0) return;
    const both = act && act.has(a) && act.has(b);
    const base = act ? (both ? 0.85 : 0.07) : 0.14 + 0.4 * near((A[2] + B[2]) / 2);
    x.globalAlpha = base * v; x.strokeStyle = both ? c.acc : c.ink; x.lineWidth = both ? 2.4 : 1.3;
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
    x.beginPath(); x.moveTo(A[0], A[1]); x.quadraticCurveTo(mx - dy / L * L * 0.08, my + dx / L * L * 0.08, B[0], B[1]); x.stroke();
  });
  const order = NODES.slice().sort((a, b) => P[b.id][2] - P[a.id][2]);
  const pulseT = (tMs - focusT0) / 1200;
  order.forEach((n) => {
    const p = P[n.id], v = V[n.id]; if (v <= 0) return;
    const k = p[3], isAct = !act || act.has(n.id);
    const a = (act ? (isAct ? 1 : 0.4) : 0.55 + 0.45 * near(p[2])) * v;
    const base = { person: 11, report: 12, section: 7, bio: 9, meas: 5, unc: 9 }[n.k] * k * (0.4 + 0.6 * v) * K;
    const hot = act && isAct;
    x.globalAlpha = a; x.lineWidth = 3; x.fillStyle = hot ? c.acc : c.ink; x.strokeStyle = hot ? c.acc : c.ink; x.beginPath();
    if (n.k === 'person') { x.rect(p[0] - base, p[1] - base, base * 2, base * 2); x.fill(); }
    else if (n.k === 'report') { x.arc(p[0], p[1], base, 0, 6.2832); x.fillStyle = c.bg; x.fill(); x.stroke(); }
    else if (n.k === 'section') { x.moveTo(p[0], p[1] - base); x.lineTo(p[0] + base, p[1]); x.lineTo(p[0], p[1] + base); x.lineTo(p[0] - base, p[1]); x.closePath(); x.fillStyle = c.bg; x.fill(); x.lineWidth = 2.4; x.stroke(); }
    else if (n.k === 'bio') { x.arc(p[0], p[1], base, 0, 6.2832); x.fill(); }
    else if (n.k === 'meas') { x.arc(p[0], p[1], base, 0, 6.2832); x.fillStyle = hot ? c.acc : c.n7; x.fill(); }
    else { x.setLineDash([4, 4]); x.arc(p[0], p[1], base, 0, 6.2832); x.fillStyle = c.bg; x.fill(); x.strokeStyle = c.acc; x.stroke(); x.setLineDash([]); }
    if (act && isAct && pulseT >= 0 && pulseT < 1) { x.globalAlpha = (1 - pulseT) * 0.8; x.strokeStyle = c.acc; x.lineWidth = 2.4; x.beginPath(); x.arc(p[0], p[1], base + 5 + pulseT * 34, 0, 6.2832); x.stroke(); }
    const showLabel = n.k !== 'meas' ? (!act || isAct) : (act ? isAct : p[2] < 0.1);
    if (showLabel && v > 0.6) {
      const fs = Math.max(14, 12.5 * k * 1.55); x.font = (n.k === 'report' || n.k === 'person' ? '800 ' : '600 ') + fs + 'px Archivo, system-ui, sans-serif';
      x.globalAlpha = a; x.lineWidth = 5; x.strokeStyle = c.bg; x.lineJoin = 'round';
      const tx = p[0] + base + 8, ty2 = p[1] + fs * 0.35; x.strokeText(n.label, tx, ty2); x.fillStyle = hot ? c.acc : c.ink; x.fillText(n.label, tx, ty2);
    }
  });
  x.globalAlpha = 1;
}

/* ───────────── chrome ───────────── */
function Nav({ T, C, tot }) {
  let idx = 0; NAMES.forEach((n, i) => { if (T >= C[n]) idx = i; });
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 88, borderBottom: `2px solid ${DIV}`, background: BGc, display: 'flex', alignItems: 'stretch', zIndex: 5 }}>
      <div style={{ width: 420, paddingLeft: 64, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 22, height: 22, background: ACC }} />
        <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>VitaGraph</span>
      </div>
      <div style={{ display: 'flex', flex: 1 }}>
        {NAV.map((n, i) => (
          <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 14, borderLeft: `2px solid ${DIV}`, background: i === idx ? INK : 'transparent', color: i === idx ? BGc : i < idx ? INK : N7 }}>
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums', color: i === idx ? 'var(--color-accent-400)' : i < idx ? A7 : N7 }}>{pad(i + 1)}</span>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>{n}</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 0, bottom: -2, height: 4, width: `${cl(T / tot, 0, 1) * 100}%`, background: ACC }} />
    </div>
  );
}

function Left({ T, a, b, s }) {
  const o = win(T, a, b, 0.6), t = T - a, e0 = MOTION.enter(t, 0, 0.8);
  return (
    <div style={{ position: 'absolute', left: 0, top: 88, width: 720, height: 888, boxSizing: 'border-box', padding: '56px 56px 0 64px', opacity: o, display: o > 0 ? 'block' : 'none', transform: `translateX(${-(1 - e0) * 40}px)` }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: A7 }}>{s.k}</div>
      <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 0.98, letterSpacing: '-0.035em', margin: '14px 0 16px' }}>{s.h}</div>
      <div style={{ fontSize: 26, lineHeight: 1.4, color: N8, marginBottom: 28 }}>{s.b}</div>
      {s.pts.map((p, i) => {
        const e = MOTION.enter(t, 0.9 + i * 0.5, 0.6);
        return (
          <div key={i} style={{ borderTop: `2px solid ${DIV}`, padding: '14px 0 12px', opacity: e, transform: `translateY(${(1 - e) * 18}px)` }}>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.01em' }}>{p[0]}</div>
            <div style={{ fontSize: 24, color: N8, lineHeight: 1.3 }}>{p[1]}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── scenes (right panel, 1200 × 888) ───────────── */
const lineTex = (c, op) => ({ backgroundImage: `repeating-linear-gradient(to bottom, ${c} 0 3px, transparent 3px 14px)`, backgroundSize: 'calc(100% - 28px) calc(100% - 80px)', backgroundPosition: '14px 56px', backgroundRepeat: 'no-repeat', opacity: op });

function Parse({ T, c, b }) {
  const t = T - c, cols5 = '140px 280px 260px 260px 180px';
  return (
    <Box T={T} a={c} b={b}>
      {PG.map((p, i) => {
        const en = MOTION.enter(t, 0.3 + i * 0.2, 0.8), s0 = 1.2 + i * 1.1, sw = MOTION.draw(t, s0, 0.9), done = t > s0 + 0.9, scan = i === 4;
        return (
          <At key={i} x={60 + i * 224} y={56 + (1 - en) * 40} w={190} h={254} style={{ opacity: en, boxSizing: 'border-box', border: `2px solid ${scan && done ? ACC : INK}`, background: BGc, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 14, top: 14, width: '46%', height: 14, background: INK, opacity: 0.35 }} />
            <div style={{ position: 'absolute', inset: 0, ...lineTex(N7, scan ? 0.5 : 0.3) }} />
            {!scan && <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 0 ${(1 - sw) * 100}% 0)` }}><div style={{ position: 'absolute', inset: 0, ...lineTex(INK, 1) }} /><div style={{ position: 'absolute', left: 14, top: 14, width: '46%', height: 14, background: INK }} /></div>}
            {scan && <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle, ${mix(INK, 45)} 1.4px, transparent 1.8px)`, backgroundSize: '9px 9px', opacity: 0.55 }} />}
            {scan && done && <div style={{ position: 'absolute', inset: 0, background: HATCH }} />}
            {sw > 0 && sw < 1 && <div style={{ position: 'absolute', left: 0, right: 0, top: sw * 250, height: 5, background: ACC }} />}
            <div style={{ position: 'absolute', left: 10, bottom: 8, fontSize: 22, fontWeight: 800, background: BGc, padding: '0 6px' }}>p.{i + 1}</div>
          </At>
        );
      })}
      <At x={40} y={344} w={1120} h={44} style={{ display: 'grid', gridTemplateColumns: cols5, alignItems: 'center', borderBottom: `2px solid ${INK}`, ...CAPS }}>
        <span>Page</span><span>Text layer</span><span>Characters</span><span>Quality score</span><span>Route</span>
      </At>
      {PG.map((p, i) => {
        const re = 1.9 + i * 1.1, e = MOTION.enter(t, re, 0.6), n = Math.round(p.c * pr(t, re, 0.9)), scan = i === 4;
        return (
          <At key={i} x={40} y={396 + i * 76} w={1120} h={76} style={{ display: 'grid', gridTemplateColumns: cols5, alignItems: 'center', borderBottom: `1px solid ${DIV}`, background: scan ? A1 : 'transparent', opacity: e, transform: `translateY(${(1 - e) * 14}px)` }}>
            <span style={{ fontSize: 32, fontWeight: 800 }}>p.{i + 1}</span>
            <span>{scan ? <Tag k="acc">None found</Tag> : <Tag k="line">Found</Tag>}</span>
            <span style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(n)}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {p.q ? <><span style={{ width: 150, height: 12, background: N2, position: 'relative' }}><span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${p.q * 100 * pr(t, re + 0.2, 0.8)}%`, background: INK }} /></span><span style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{(p.q * pr(t, re + 0.2, 0.8)).toFixed(2)}</span></> : <span style={{ fontSize: 26, color: N7 }}>not scored</span>}
            </span>
            <span>{scan ? <Tag k="acc">OCR</Tag> : <Tag k="soft">Native</Tag>}</span>
          </At>
        );
      })}
      {(() => { const e = MOTION.enter(t, 7.0, 0.7); return (
        <At x={40} y={796} w={1120} h={70} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: e, borderTop: `2px solid ${INK}` }}>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.01em' }}>{fmt(PG.reduce((a, q) => a + q.c, 0))} characters from 4 native pages</span>
          <span style={{ fontSize: 30, fontWeight: 800, color: A7 }}>1 page sent to OCR →</span>
        </At>); })()}
    </Box>
  );
}

function OCR({ T, c, b }) {
  const t = T - c, tl = (i) => 1.55 + i * 0.636;
  const barY = 60 + cl((t - 1.0) / 5.6, 0, 1) * 740;
  return (
    <Box T={T} a={c} b={b}>
      <At x={40} y={36} w={520} h={816} style={{ transform: 'rotate(-1.2deg)', background: 'var(--color-neutral-200)', border: `2px solid ${INK}`, boxSizing: 'border-box', overflow: 'hidden', opacity: MOTION.enter(t, 0.1, 0.7) }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle, ${mix(INK, 40)} 1.2px, transparent 1.6px)`, backgroundSize: '8px 8px', opacity: 0.45 }} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(115deg, transparent 0 40%, ${mix(INK, 8)} 55%, transparent 70%)` }} />
        {OL.map((s, i) => {
          const w = Math.min(424, s.length * 13.6), y = 120 + i * 84, e = MOTION.enter(t, tl(i), 0.3), d = i === 0 ? 10 : 0;
          return (
            <React.Fragment key={i}>
              <div style={{ position: 'absolute', left: 48, top: y + 3, width: w, height: 18, background: N7, opacity: 0.72, filter: 'blur(0.7px)', transform: `skewX(${-1 + (i % 3) * 0.7}deg)` }} />
              <div style={{ position: 'absolute', left: 40, top: y - 6 - d * 0, width: w + 16, height: 36, boxSizing: 'border-box', border: `3px solid ${i === 5 ? ACC : ACC}`, background: i === 5 ? mix(ACC, 14) : 'transparent', opacity: e, transform: `scale(${1 + (1 - e) * 0.06})` }}>
                <span style={{ position: 'absolute', right: -3, top: -27, background: i === 5 ? ACC : INK, color: BGc, fontSize: 17, fontWeight: 800, padding: '0 6px', lineHeight: '24px', fontVariantNumeric: 'tabular-nums' }}>{OC[i].toFixed(2)}</span>
              </div>
            </React.Fragment>
          );
        })}
        {t > 1 && t < 6.7 && <div style={{ position: 'absolute', left: 0, right: 0, top: barY - 3, height: 6, background: ACC }} />}
      </At>
      <At x={620} y={30} w={540} h={64} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${INK}` }}>
        <span style={CAPS}>Recognized text</span><Tag k="line">rapidocr-onnxruntime</Tag>
      </At>
      {OL.map((s, i) => {
        const st = tl(i), txt = ty(s, t, st, 38), e = MOTION.enter(t, st, 0.3), full = txt.length >= s.length, flag = i === 5;
        const x0 = 96, y0 = (120 + i * 84 - 6) * 2, x1 = 2 * (40 + Math.min(424, s.length * 13.6) + 16), y1 = y0 + 72;
        return (
          <At key={i} x={620} y={104 + i * 84} w={540} h={84} style={{ boxSizing: 'border-box', padding: '8px 0', borderBottom: `1px solid ${DIV}`, opacity: e, background: flag ? A1 : 'transparent' }}>
            <div style={{ fontSize: 25, fontWeight: 800, lineHeight: '34px', display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{txt}</span>{flag && full && <Tag k="acc">Review</Tag>}</div>
            <div style={{ fontSize: 20, color: N8, opacity: full ? 1 : 0, fontVariantNumeric: 'tabular-nums' }}>box {x0},{y0} to {x1},{y1} · conf {OC[i].toFixed(2)}</div>
          </At>
        );
      })}
      {(() => { const e = MOTION.enter(t, 7.4, 0.7); return (
        <At x={620} y={788} w={540} h={80} style={{ opacity: e, borderTop: `2px solid ${INK}`, paddingTop: 10, boxSizing: 'border-box' }}>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{OCR_CH} characters · mean conf {MEAN.toFixed(2)}</div>
          <div style={{ fontSize: 24, color: A7, fontWeight: 800 }}>1 read below 0.70 flagged</div>
        </At>); })()}
    </Box>
  );
}

function Chunk({ T, c, b }) {
  const t = T - c, te = (i) => 1.2 + i * 0.18;
  return (
    <Box T={T} a={c} b={b}>
      <At x={40} y={44} w={1120} h={52} style={{ border: `2px solid ${INK}`, boxSizing: 'border-box', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `repeating-linear-gradient(to right, ${mix(INK, 40)} 0 2px, transparent 2px 7px)`, opacity: 0.5 }} />
        {CH.map((q, i) => { const f = t >= te(i) ? 1 - pr(t, te(i), 0.8) : 0; return <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: q.st / TOTAL * 1116, width: (q.en - q.st + 1) / TOTAL * 1116, background: mix(ACC, f * 75) }} />; })}
        {CH.slice(0, 23).map((q, i) => <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: (q.en + 1) / TOTAL * 1116, width: 3, background: ACC, opacity: t >= te(i) ? 1 : 0 }} />)}
      </At>
      {(() => { let off = 0; return PG.map((p, i) => { const n = i === 4 ? OCR_CH : p.c, x = 40 + off / TOTAL * 1120; off += n; return <At key={i} x={x} y={102} w={60} h={28} style={{ fontSize: 20, fontWeight: 800, color: N7 }}>p.{i + 1}</At>; }); })()}
      {CH.map((q, i) => {
        const e = MOTION.enter(t, te(i), 0.5), col = i % 6, row = Math.floor(i / 6), ent = Math.round(q.ent * pr(t, 6.4 + i * 0.05, 0.4));
        return (
          <At key={i} x={40 + col * 190} y={170 + row * 166} w={170} h={150} style={{ boxSizing: 'border-box', padding: 12, background: SURF, borderTop: `2px solid ${INK}`, opacity: e, transform: `translateY(${(1 - e) * -26}px)` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontSize: 28, fontWeight: 800 }}>{q.id}</span><span style={{ fontSize: 22, fontWeight: 800, color: N7 }}>p.{q.pg}</span></div>
            <div style={{ fontSize: 22, color: N8, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{q.st}–{q.en}</div>
            <div style={{ height: 3, width: '70%', background: INK, opacity: 0.4, marginTop: 12 }} /><div style={{ height: 3, width: '90%', background: INK, opacity: 0.4, marginTop: 6 }} /><div style={{ height: 3, width: '55%', background: INK, opacity: 0.4, marginTop: 6 }} />
            <div style={{ fontSize: 22, fontWeight: 800, color: A7, marginTop: 8, opacity: ent > 0 ? 1 : 0 }}>{ent} entit{ent === 1 ? 'y' : 'ies'}</div>
          </At>
        );
      })}
      {(() => { const e = MOTION.enter(t, 7.6, 0.7); return (
        <At x={40} y={822} w={1120} h={40} style={{ opacity: e, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 32, fontWeight: 800 }}>{fmt(TOTAL)} characters → 24 chunks</span><span style={{ fontSize: 28, fontWeight: 800, color: A7 }}>{ENT_SUM} entity mentions → graph</span>
        </At>); })()}
    </Box>
  );
}

const vv = (r, k) => { const x = Math.sin(r * 127.1 + k * 311.7) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
function Embed({ T, c, b }) {
  const t = T - c, on = T >= c - 0.1 && T < b + 0.1;
  const stats = [[384, 'dimensions per chunk'], [9216, 'floats stored for this report'], [1, 'vector length after L2'], [0, 'cosine distance in Chroma']];
  return (
    <Box T={T} a={c} b={b}>
      <Cv w={1200} h={888} on={on} draw={(x, col) => {
        const n = Math.floor(pr(t, 0.9, 2.2) * 384);
        for (let i = 0; i < 384; i++) {
          const cx0 = 300 + (i % 48) * 18, cy0 = 48 + Math.floor(i / 48) * 18;
          if (i < n) { const v = vv(6, i); x.globalAlpha = 0.18 + 0.82 * Math.abs(v); x.fillStyle = v > 0 ? col.acc : col.ink; x.fillRect(cx0, cy0, 16, 16); }
          else { x.globalAlpha = 0.14; x.strokeStyle = col.ink; x.lineWidth = 1; x.strokeRect(cx0 + 0.5, cy0 + 0.5, 15, 15); }
        }
        const m = Math.floor(pr(t, 3.6, 2.6) * 2304);
        for (let r = 0; r < 24; r++) for (let k = 0; k < 96; k++) {
          const px = 110 + k * 10.8, py = 250 + r * 19;
          if (r * 96 + k < m) { const v = vv(r, k * 4); x.globalAlpha = 0.15 + 0.85 * Math.abs(v); x.fillStyle = v > 0 ? col.acc : col.ink; x.fillRect(px, py, 9.6, 17); }
          else { x.globalAlpha = 0.1; x.fillStyle = col.ink; x.fillRect(px, py, 9.6, 17); }
        }
        x.globalAlpha = 1; x.font = '700 16px Archivo, system-ui, sans-serif'; x.fillStyle = col.n7;
        for (let r = 0; r < 24; r++) x.fillText('c' + pad(r + 1), 40, 250 + r * 19 + 14);
        if (t > 6.2) { x.strokeStyle = col.acc; x.lineWidth = 3; x.strokeRect(106, 250 + 6 * 19 - 2, 1046, 21); }
      }} />
      <At x={40} y={48} w={236} h={144} style={{ boxSizing: 'border-box', background: SURF, borderTop: `2px solid ${INK}`, padding: 14, opacity: MOTION.enter(t, 0.1, 0.6) }}>
        <div style={{ ...CAPS, color: A7 }}>c07 · p.1</div>
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, marginTop: 6 }}>Platelet count 245,000 /µL</div>
      </At>
      <At x={278} y={112} w={20} h={4} style={{ background: ACC, transform: `scaleX(${MOTION.draw(t, 0.6, 0.4)})`, transformOrigin: '0 50%' }} />
      <At x={300} y={206} w={860} h={30} style={{ ...CAPS, fontSize: 20, opacity: MOTION.enter(t, 3.3, 0.5) }}>24 chunks × 384 dimensions (each column folds 4 dimensions)</At>
      {stats.map((s, i) => {
        const e = MOTION.enter(t, 6.2 + i * 0.3, 0.6), v = i === 0 ? 384 : i === 1 ? 9216 * pr(t, 6.5, 1.2) : i === 2 ? 1 : 0;
        return (
          <At key={i} x={40 + i * 285} y={730} w={265} h={110} style={{ borderTop: `2px solid ${INK}`, paddingTop: 10, boxSizing: 'border-box', opacity: e, transform: `translateY(${(1 - e) * 14}px)` }}>
            <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{i === 2 ? '1.00' : i === 3 ? 'cosine' : fmt(v)}</div>
            <div style={{ fontSize: 22, color: N8, lineHeight: 1.25 }}>{s[1]}</div>
          </At>
        );
      })}
    </Box>
  );
}

function Index({ T, c, b }) {
  const t = T - c;
  const parts = [{ id: 'VG-2026-001', n: 24, mine: true }, { id: 'VG-2026-014', n: 18 }, { id: 'VG-2026-027', n: 21 }];
  const hits = [3, 7, 8, 14, 19];
  const rows = [['users', '1', 'Consent flag, cascade delete'], ['reports', '3', 'SHA-256 per file, append-only'], ['report_pages', '14', 'OCR flag, quality score'], ['report_chunks', '24', 'char_start, char_end, entities']];
  const audit = ['upload.accepted    sha256 9f2c…e41a', 'chunks.indexed     24 · user_id VG-2026-001', 'embeddings.upserted 24 × 384'];
  return (
    <Box T={T} a={c} b={b}>
      {parts.map((p, pi) => {
        const q = MOTION.enter(t, 5.3, 0.6);
        return (
          <At key={pi} x={40 + pi * 380} y={44} w={360} h={340} style={{ boxSizing: 'border-box', border: p.mine ? `4px solid ${ACC}` : `2px dashed ${DIV}`, background: p.mine ? 'transparent' : SURF }}>
            <div style={{ padding: '10px 14px', borderBottom: p.mine ? `2px solid ${ACC}` : `1px solid ${DIV}` }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>user_id {p.id}</div>
              <div style={{ fontSize: 20, color: N8 }}>{p.n} vectors</div>
            </div>
            {Array.from({ length: p.n }).map((_, i) => {
              const e = MOTION.enter(t, 0.6 + i * 0.09, 0.5), hit = p.mine && hits.includes(i) && t > 5.0;
              return <div key={i} style={{ position: 'absolute', left: 24 + (i % 6) * 52, top: 94 + Math.floor(i / 6) * 52 - (1 - e) * 120, width: 26, height: 26, borderRadius: '50%', background: hit ? ACC : p.mine ? INK : 'var(--color-neutral-500)', opacity: e * (p.mine ? 1 : 0.6), boxShadow: hit ? `0 0 0 ${3 + 5 * Math.abs(Math.sin(t * 5))}px ${mix(ACC, 25)}` : 'none' }} />;
            })}
            {!p.mine && <div style={{ position: 'absolute', inset: 0, background: HATCH, opacity: q }} />}
            {!p.mine && <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, opacity: q }}><Tag k="ink">Filtered out</Tag></div>}
          </At>
        );
      })}
      <At x={40} y={438} w={1120} h={60} style={{ background: INK, color: BGc, display: 'flex', alignItems: 'center', paddingLeft: 20, fontSize: 25, fontWeight: 800, opacity: MOTION.enter(t, 4.3, 0.6) }}>query(where={'{'}"user_id": "VG-2026-001"{'}'}, n_results=5)</At>
      <At x={218} y={384} w={6} h={54} style={{ background: ACC, transformOrigin: '50% 100%', transform: `scaleY(${MOTION.draw(t, 4.7, 0.4)})` }} />
      <At x={40} y={528} w={1120} h={34} style={{ ...CAPS, display: 'flex', justifyContent: 'space-between', opacity: MOTION.enter(t, 6.0, 0.5) }}><span>SQLite · system of record</span><span>foreign keys on</span></At>
      {rows.map((r, i) => {
        const e = MOTION.enter(t, 6.3 + i * 0.35, 0.5);
        return (
          <At key={i} x={40} y={566 + i * 48} w={1120} h={48} style={{ display: 'grid', gridTemplateColumns: '280px 100px 1fr', alignItems: 'center', borderTop: `1px solid ${DIV}`, opacity: e, transform: `translateX(${(1 - e) * 30}px)` }}>
            <span style={{ fontSize: 26, fontWeight: 800 }}>{r[0]}</span><span style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: A7 }}>{r[1]}</span><span style={{ fontSize: 24, color: N8 }}>{r[2]}</span>
          </At>
        );
      })}
      <At x={40} y={772} w={1120} h={112} style={{ background: INK, color: BGc, boxSizing: 'border-box', padding: '8px 20px', opacity: MOTION.enter(t, 7.6, 0.6) }}>
        {audit.map((a, i) => <div key={i} style={{ fontSize: 24, lineHeight: '32px', fontVariantNumeric: 'tabular-nums', opacity: MOTION.enter(t, 7.8 + i * 0.35, 0.4) }}><span style={{ color: 'var(--color-accent-400)', fontWeight: 800 }}>audit_log </span>{a}</div>)}
      </At>
    </Box>
  );
}

function Ask({ T, c, b }) {
  const t = T - c, q = 'What does my hemoglobin trend show over time?';
  const R = [['Jan 2024 · p.2 · chars 203–212', 0.86], ['Aug 2024 · p.2 · chars 188–197', 0.83], ['Feb 2026 · p.1 · chars 412–421', 0.81], ['Feb 2026 · p.1 · chars 455–464', 0.52], ['Jan 2024 · p.4 · chars 301–309', 0.44]];
  const slot = [3, 0, 4, 1, 2];
  const words = ['Hemoglobin', 'rose', 'across', 'three', 'visits:', '13.1', 'g/dL', 'in', 'Jan', '2024', '#1', '13.2', 'in', 'Aug', '2024', '#2', 'and', '14.0', 'in', 'Feb', '2026', '#3', 'The', 'latest', 'value', 'is', 'inside', 'the', 'printed', '13.0–17.0', 'g/dL', 'range.'];
  const nShow = Math.floor(pr(t, 6.9, 2.6) * words.length), sort = MOTION.draw(t, 4.6, 0.8);
  return (
    <Box T={T} a={c} b={b}>
      <At x={40} y={36} w={1120} h={76} style={{ boxSizing: 'border-box', border: `2px solid ${INK}`, background: SURF, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', opacity: MOTION.enter(t, 0.1, 0.5) }}>
        <span style={{ fontSize: 31, fontWeight: 800, letterSpacing: '-0.01em' }}>{ty(q, t, 0.6, 20)}{t < 3 && Math.sin(t * 9) > 0 ? '|' : ''}</span>
        <Tag k={t > 3 ? 'acc' : 'soft'}>{t > 3.1 ? 'query vector · 384-d' : 'Send'}</Tag>
      </At>
      <At x={40} y={128} w={1120} h={36} style={{ ...CAPS, opacity: MOTION.enter(t, 3.3, 0.5) }}>Top 5 of 24 · cosine similarity · user_id = VG-2026-001</At>
      {R.map((r, i) => {
        const e = MOTION.enter(t, 3.4 + i * 0.1, 0.5), y = 172 + (slot[i] + (i - slot[i]) * sort) * 64, sc = r[1] * pr(t, 3.8, 0.8);
        return (
          <At key={i} x={40} y={y} w={1120} h={64} style={{ display: 'grid', gridTemplateColumns: '70px 520px 1fr', alignItems: 'center', borderTop: `1px solid ${DIV}`, opacity: e, background: i < 3 && sort >= 1 ? mix(ACC, 7) : 'transparent' }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: i < 3 ? A7 : N7 }}>{sort >= 1 ? i + 1 : '·'}</span>
            <span style={{ fontSize: 26, fontWeight: 800 }}>{r[0]}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}><span style={{ position: 'relative', width: 380, height: 14, background: N2 }}><span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${sc * 100}%`, background: i < 3 ? ACC : INK }} /></span><span style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{sc.toFixed(2)}</span></span>
          </At>
        );
      })}
      <At x={40} y={512} w={1120} h={196} style={{ boxSizing: 'border-box', borderTop: `2px solid ${INK}`, paddingTop: 12, opacity: MOTION.enter(t, 6.4, 0.5) }}>
        <div style={CAPS}>1 · Summary</div>
        <div style={{ fontSize: 31, lineHeight: 1.42, marginTop: 6 }}>
          {words.slice(0, nShow).map((w, i) => w[0] === '#'
            ? <span key={i} style={{ display: 'inline-block', margin: '0 8px 0 2px', padding: '0 8px', background: A7, color: BGc, fontSize: 22, fontWeight: 800, verticalAlign: '0.2em', lineHeight: '30px' }}>{w.slice(1)}</span>
            : <span key={i}>{w} </span>)}
        </div>
      </At>
      {[['2 · Evidence', '1 Jan 2024 · p.2 · 203–212\n2 Aug 2024 · p.2 · 188–197\n3 Feb 2026 · p.1 · 412–421'], ['3 · Limitations', 'Three data points. Ranges are the ones printed on each report.'], ['4 · Safety', 'Educational summary of report text. Discuss any decision with a clinician.']].map((m, i) => {
        const e = MOTION.enter(t, 9.4 + i * 0.35, 0.6);
        return (
          <At key={i} x={40 + i * 380} y={716} w={360} h={160} style={{ boxSizing: 'border-box', borderTop: `2px solid ${INK}`, paddingTop: 10, paddingRight: 14, opacity: e, transform: `translateY(${(1 - e) * 16}px)` }}>
            <div style={CAPS}>{m[0]}</div>
            <div style={{ fontSize: 23, lineHeight: 1.3, marginTop: 4, whiteSpace: 'pre-line', fontVariantNumeric: 'tabular-nums' }}>{m[1]}</div>
          </At>
        );
      })}
    </Box>
  );
}

function Graph({ T, c, b }) {
  const t = T - c, on = T >= c - 0.1 && T < b + 0.1;
  const seg = t < 5.0 ? ['all', 0, 'Ask a question to light up a subgraph.', 23] : t < 8.6 ? ['hb', 5000, 'What does my hemoglobin trend show over time?', 7] : t < 11.8 ? ['vit', 8600, 'Are there any low vitamin levels in my records?', 8] : ['feb', 11800, 'Summarize my latest Feb 2026 lab report', 13];
  const leg = [['Subject', { width: 14, height: 14, background: INK }], ['Report', { width: 14, height: 14, borderRadius: '50%', border: `3px solid ${INK}` }], ['Section', { width: 11, height: 11, border: `3px solid ${INK}`, transform: 'rotate(45deg)', margin: 2 }], ['Biomarker', { width: 14, height: 14, borderRadius: '50%', background: INK }], ['Value', { width: 10, height: 10, borderRadius: '50%', background: N7, margin: 2 }], ['Uncertainty', { width: 14, height: 14, borderRadius: '50%', border: `3px dashed ${ACC}` }]];
  const mx = BTW[0].v;
  return (
    <Box T={T} a={c} b={b}>
      <Cv w={1200} h={888} on={on} draw={(x, col) => drawGraph(x, 1200, 888, t * 1000, 0.7 + 0.19 * t, seg[0], seg[1], col)} />
      <At x={28} y={28} w={400} h={70} style={{ opacity: MOTION.enter(t, 0.3, 0.5) }}><div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>23 nodes · 34 edges</div><div style={{ fontSize: 22, color: N8 }}>NetworkX · 3D projection</div></At>
      <At x={840} y={28} w={332} h={236} style={{ boxSizing: 'border-box', background: BGc, borderTop: `2px solid ${INK}`, padding: '12px 16px', opacity: MOTION.enter(t, 4.6, 0.6) }}>
        <div style={CAPS}>Question</div>
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, margin: '6px 0 10px' }}>{seg[2]}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: seg[0] === 'all' ? N7 : A7, fontVariantNumeric: 'tabular-nums' }}>{seg[3]} of 23 nodes active</div>
      </At>
      <At x={840} y={440} w={332} h={300} style={{ boxSizing: 'border-box', background: BGc, borderTop: `2px solid ${INK}`, padding: '12px 16px', opacity: MOTION.enter(t, 3.6, 0.6) }}>
        <div style={CAPS}>Betweenness centrality</div>
        {BTW.map((r, i) => { const e = MOTION.enter(t, 3.9 + i * 0.25, 0.6); return (
          <div key={i} style={{ marginTop: 9, opacity: e }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 23, fontWeight: 800 }}><span>{r.label}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{(r.v * e).toFixed(2)}</span></div>
            <div style={{ height: 8, background: N2, marginTop: 2 }}><div style={{ height: 8, width: `${r.v / mx * 100 * e}%`, background: i === 0 ? ACC : INK }} /></div>
          </div>); })}
      </At>
      <At x={28} y={740} w={640} h={120} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 12px', alignContent: 'end', opacity: MOTION.enter(t, 2.4, 0.6) }}>
        {leg.map((l, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 22 }}><span style={{ display: 'inline-block', ...l[1] }} />{l[0]}</div>)}
      </At>
    </Box>
  );
}

const EVT = [['00.00', 'job.created', 'id=7f3a'], ['00.31', 'stage.start', 'parse'], ['01.12', 'stage.done', 'parse'], ['01.15', 'stage.start', 'ocr'], ['02.04', 'stage.done', 'ocr'], ['02.10', 'stage.start', 'chunk'], ['02.38', 'stage.done', 'chunk'], ['02.41', 'stage.start', 'embed'], ['03.77', 'stage.done', 'embed'], ['03.78', 'stage.start', 'index'], ['03.82', 'stage.done', 'index'], ['03.82', 'job.complete', 'ok']];
function Stream({ T, c, b }) {
  const t = T - c, on = T >= c - 0.1 && T < b + 0.1, te = (k) => 0.8 + k * 0.5;
  const stg = [['Parse', 'PyMuPDF', 1, 2], ['OCR', 'rapidocr-onnxruntime', 3, 4], ['Chunk', 'Sentence chunker', 5, 6], ['Embed', 'MiniLM-L6-v2', 7, 8], ['Index', 'ChromaDB upsert', 9, 10]];
  const tier = t >= 6.2 && t < 7.6 ? 1 : 0;
  const ft = (u) => 7 + 1.4 * Math.sin(u * 9) + 1.1 * Math.sin(u * 23.7) + (u < 6.2 ? 15 * Math.exp(-Math.pow((u - 5.6) / 0.45, 2)) : 3 * Math.exp(-Math.pow((u - 6.4) / 0.6, 2)));
  return (
    <Box T={T} a={c} b={b}>
      {stg.map((s, i) => {
        const run = t >= te(s[2]) && t < te(s[3]), done = t >= te(s[3]), blink = Math.sin(t * 12) > 0;
        return (
          <At key={i} x={40} y={44 + i * 100} w={430} h={92} style={{ display: 'flex', alignItems: 'center', gap: 18, borderTop: `2px solid ${DIV}`, opacity: MOTION.enter(t, 0.2 + i * 0.1, 0.5) }}>
            <span style={{ width: 30, height: 30, flex: 'none', background: done ? INK : run ? (blink ? ACC : A2) : N2, border: `2px solid ${run ? ACC : INK}`, boxSizing: 'border-box' }} />
            <span><span style={{ display: 'block', fontSize: 34, fontWeight: 800, letterSpacing: '-0.01em' }}>{s[0]}</span><span style={{ display: 'block', fontSize: 22, color: N8 }}>{done ? 'done' : run ? 'running' : s[1]}</span></span>
          </At>
        );
      })}
      <At x={500} y={44} w={660} h={512} style={{ background: INK, color: BGc, boxSizing: 'border-box', padding: '12px 22px', overflow: 'hidden' }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--color-accent-400)', marginBottom: 6 }}>GET /api/jobs/7f3a/events · text/event-stream</div>
        {EVT.map((e, k) => t >= te(k) && <div key={k} style={{ fontSize: 24, lineHeight: '36px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', opacity: MOTION.enter(t, te(k), 0.25) }}><span style={{ color: 'var(--color-neutral-400)' }}>{e[0]}  </span><span style={{ fontWeight: 800, color: e[1] === 'job.complete' ? 'var(--color-accent-400)' : BGc }}>{e[1]}</span><span style={{ color: 'var(--color-neutral-300)' }}>  {e[2]}</span></div>)}
      </At>
      <At x={40} y={596} w={1120} h={32} style={{ ...CAPS, opacity: MOTION.enter(t, 3.4, 0.5) }}>Frame time · adaptive quality governor</At>
      <Cv w={600} h={170} on={on} style={{ position: 'absolute', left: 40, top: 636, opacity: MOTION.enter(t, 3.4, 0.5) }} draw={(x, col) => {
        const y = (ms) => 160 - ms * 4.6;
        x.strokeStyle = col.ink; x.globalAlpha = 0.5; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, y(16.7)); x.lineTo(600, y(16.7)); x.stroke();
        x.strokeStyle = col.acc; x.globalAlpha = 0.9; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(0, y(33)); x.lineTo(600, y(33)); x.stroke(); x.setLineDash([]);
        x.globalAlpha = 1; x.font = '700 18px Archivo, system-ui, sans-serif'; x.fillStyle = col.n7; x.fillText('16.7 ms · 60 fps', 8, y(16.7) - 6); x.fillStyle = col.acc; x.fillText('33 ms', 8, y(33) - 6);
        x.strokeStyle = col.ink; x.lineWidth = 3; x.beginPath();
        const end = cl((t - 3.4) / 4.6, 0, 1) * 8;
        for (let u = 0; u <= end; u += 0.04) { const px = u / 8 * 600; if (u === 0) x.moveTo(px, y(ft(u))); else x.lineTo(px, y(ft(u))); } x.stroke();
      }} />
      {['T0', 'T1', 'T2'].map((k, i) => (
        <At key={k} x={680 + i * 160} y={636} w={150} h={104} style={{ boxSizing: 'border-box', padding: 12, border: `2px solid ${i === tier ? INK : DIV}`, background: i === tier ? INK : 'transparent', color: i === tier ? BGc : INK, opacity: MOTION.enter(t, 3.6 + i * 0.2, 0.5) }}>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{k}</div><div style={{ fontSize: 22 }}>DPR cap {['2.0', '1.5', '1.0'][i]}</div>
        </At>
      ))}
      <At x={680} y={756} w={480} h={110} style={{ fontSize: 26, lineHeight: 1.35, fontWeight: 800, opacity: MOTION.enter(t, 4.4, 0.5) }}>60 fps · 0 frames over 33 ms<br />JS ≤ 4 ms · layout shift 0.00</At>
    </Box>
  );
}

function Guard({ T, c, b }) {
  const t = T - c, q = 'Should I stop taking my medication?';
  const ban = MOTION.enter(t, 3.4, 0.6), blink = Math.sin(t * 2 * Math.PI * 1.667) > 0;
  const flow = [['Upload', 'ink', 0], ['SQLite', 'ink', 1], ['ChromaDB', 'bad', 2], ['Search', 'bad', 3]];
  const lbl = (n, h, y, tt) => <At x={40} y={y} w={200} h={200} style={{ opacity: MOTION.enter(t, tt, 0.5) }}><div style={{ ...CAPS, color: A7 }}>{n}</div><div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', marginTop: 6 }}>{h}</div></At>;
  return (
    <Box T={T} a={c} b={b}>
      {lbl('Case 1', 'Clinical advice', 56, 0.1)}
      <At x={260} y={44} w={900} h={236} style={{ borderTop: `2px solid ${INK}`, paddingTop: 14 }}>
        <div style={{ boxSizing: 'border-box', border: `2px solid ${INK}`, background: SURF, padding: '12px 18px', fontSize: 28, fontWeight: 800, opacity: MOTION.enter(t, 0.3, 0.4) }}>{ty(q, t, 0.5, 22)}</div>
        <div style={{ marginTop: 14, background: A1, borderTop: `3px solid ${ACC}`, padding: '12px 18px', opacity: MOTION.enter(t, 2.5, 0.5), transform: `translateY(${(1 - MOTION.enter(t, 2.5, 0.5)) * 12}px)` }}>
          <Tag k="acc">Declined by policy</Tag>
          <div style={{ fontSize: 25, lineHeight: 1.35, color: A8, marginTop: 8 }}>VitaGraph does not diagnose, recommend treatment or advise on medication. Please take this question to a clinician.</div>
        </div>
      </At>
      {lbl('Case 2', 'Backend drops', 336, 3.0)}
      <At x={260} y={324} w={900} h={236} style={{ borderTop: `2px solid ${INK}`, paddingTop: 14, opacity: MOTION.enter(t, 3.0, 0.4) }}>
        <div style={{ position: 'relative', height: 200, border: `2px solid ${INK}`, boxSizing: 'border-box', overflow: 'hidden', background: SURF }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 74, transform: `translateY(${-(1 - ban) * 80}px)`, background: A1, backgroundImage: HATCH, borderBottom: `3px solid ${ACC}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', boxSizing: 'border-box' }}>
            <span style={{ fontSize: 27, fontWeight: 800, color: A8, background: A1, padding: '2px 8px' }}>Backend unreachable. Showing the last saved state.</span>
            <span style={{ display: 'flex', gap: 8 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 18, height: 18, background: blink ? ACC : A2, border: `2px solid ${ACC}`, boxSizing: 'border-box' }} />)}</span>
          </div>
          <div style={{ position: 'absolute', left: 18, top: 100, width: 520, height: 14, background: INK, opacity: 0.22 }} /><div style={{ position: 'absolute', left: 18, top: 128, width: 380, height: 14, background: INK, opacity: 0.22 }} />
          <div style={{ position: 'absolute', right: 18, bottom: 14, opacity: ban }}><Tag k="ink">REPLAY MODE</Tag></div>
        </div>
      </At>
      {lbl('Case 3', 'Vector store fails', 616, 5.0)}
      <At x={260} y={604} w={900} h={236} style={{ borderTop: `2px solid ${INK}`, paddingTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>
          {flow.map(([n, k, i]) => {
            const e = MOTION.enter(t, 5.2 + i * 0.5, 0.5), bad = k === 'bad' && t > 6.6;
            return (
              <React.Fragment key={n}>
                <div style={{ flex: 1, boxSizing: 'border-box', border: `2px solid ${bad ? ACC : INK}`, background: bad ? A1 : i === 1 ? INK : SURF, backgroundImage: bad ? HATCH : 'none', color: i === 1 && !bad ? BGc : INK, padding: '14px 14px', opacity: e, transform: `translateY(${(1 - e) * 16}px)` }}>
                  <div style={{ fontSize: 30, fontWeight: 800, background: bad ? A1 : 'transparent', display: 'inline-block', padding: bad ? '0 6px' : 0 }}>{n}</div>
                  <div style={{ fontSize: 23, lineHeight: 1.25, marginTop: 6, background: bad ? A1 : 'transparent', padding: bad ? '0 6px' : 0 }}>{['File accepted', 'Report saved', bad ? 'Unavailable' : 'Indexing', bad ? 'Disabled, no guessed answer' : 'Waiting'][i]}</div>
                </div>
                {i < 3 && <span style={{ alignSelf: 'center', fontSize: 34, fontWeight: 800, opacity: e }}>→</span>}
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, marginTop: 18, color: A7, opacity: MOTION.enter(t, 7.0, 0.5) }}>The upload is still saved. Nothing is made up.</div>
      </At>
    </Box>
  );
}

function Numbers({ T, c, b }) {
  const t = T - c;
  const cells = [[19, '', 'functional user stories, all passing'], [11, '/12', 'motion stories shipped'], [54, '', 'backend unit and integration tests'], [32, '', 'verification gates passed'], [12, '', 'API endpoints'], [5, '', 'ingestion stages, each streamed live'], [75, '', 'commits'], [60, ' fps', 'steady, 0 frames over 33 ms'], [0, '.00', 'layout shift (CLS)'], [6, '', 'engines wired together'], [4, ' ms', 'maximum JS time per frame'], [0, '', 'real patients, all data synthetic']];
  const stack = ['FastAPI', 'SQLite', 'ChromaDB', 'NetworkX', 'MiniLM-L6-v2', 'PyMuPDF', 'rapidocr', 'React 19', 'TypeScript 5.8', 'Vite 8.2', 'Tailwind 4', 'Pytest', 'Playwright'];
  const o = win(T, c, b, 0.5);
  return (
    <div style={{ position: 'absolute', left: 0, top: 88, width: 1920, height: 888, background: BGc, opacity: o, display: o > 0 ? 'block' : 'none', zIndex: 3 }}>
      <At x={64} y={36} w={900} h={170} style={{ opacity: MOTION.enter(t, 0.1, 0.6) }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: A7 }}>11 / The work, counted</div>
        <div style={{ fontSize: 104, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', marginTop: 8 }}>Behind one button.</div>
      </At>
      <At x={1000} y={44} w={856} h={160} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignContent: 'flex-start', opacity: MOTION.enter(t, 0.6, 0.6) }}>
        {stack.map((s, i) => <Tag key={s} k={i % 4 === 0 ? 'ink' : 'line'} style={{ fontSize: 22, lineHeight: '30px' }}>{s}</Tag>)}
      </At>
      <At x={64} y={226} w={1792} h={660} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', borderTop: `2px solid ${DIV}` }}>
        {cells.map((cl2, i) => {
          const e = MOTION.enter(t, 0.8 + i * 0.18, 0.6), v = cl2[0] * pr(t, 0.8 + i * 0.18, 1.1);
          const txt = i === 8 ? '0.00' : fmt(v);
          return (
            <div key={i} style={{ boxSizing: 'border-box', borderBottom: `2px solid ${DIV}`, borderRight: i % 4 < 3 ? `2px solid ${DIV}` : 'none', padding: '22px 26px', opacity: e, transform: `translateY(${(1 - e) * 20}px)` }}>
              <div style={{ fontSize: 118, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', color: i === 7 ? A7 : INK }}>{txt}{i !== 8 && <span style={{ fontSize: 50, letterSpacing: '-0.02em', color: N7 }}>{cl2[1]}</span>}</div>
              <div style={{ fontSize: 26, lineHeight: 1.25, color: N8, marginTop: 8 }}>{cl2[2]}</div>
            </div>
          );
        })}
      </At>
    </div>
  );
}

function Close({ T, c, b }) {
  const t = T - c, w = MOTION.draw(t, 0, 0.8);
  return (
    <div style={{ position: 'absolute', left: 0, top: 88, width: 1920, height: 888, background: ACC, color: BGc, zIndex: 4, transform: `translateY(${(1 - w) * 100}%)`, overflow: 'hidden', display: w > 0 ? 'block' : 'none' }}>
      <At x={64} y={56} w={900} h={40} style={{ fontSize: 26, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: MOTION.enter(t, 0.6, 0.5) }}>VitaGraph</At>
      {['Upload a PDF.', 'Ask a question.', 'Open the evidence.'].map((s, i) => { const e = MOTION.enter(t, 0.8 + i * 0.35, 0.7); return <At key={i} x={64} y={130 + i * 168} w={1700} h={168} style={{ fontSize: 158, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.04, opacity: e, transform: `translateY(${(1 - e) * 40}px)` }}>{s}</At>; })}
      <At x={64} y={724} w={1100} h={140} style={{ opacity: MOTION.enter(t, 2.4, 0.6) }}>
        <a href="VitaGraph.dc.html" style={{ color: BGc, fontSize: 40, fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: 8 }}>Open the live demo →</a>
        <div style={{ fontSize: 26, marginTop: 18 }}>Synthetic data only. An educational evidence organiser, not a diagnostic tool.</div>
      </At>
    </div>
  );
}

function Opening({ T, c, b }) {
  const t = T - c, ex = MOTION.draw(t, 5.15, 0.85);
  if (ex >= 1) return null;
  const sheetE = MOTION.enter(t, 0.4, 0.9), tt = MOTION.draw(t, 0.5, 1.3);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 976, background: INK, color: BGc, zIndex: 20, overflow: 'hidden', transform: `translateY(${-ex * 100}%)` }}>
      <At x={64} y={56} w={1000} h={40} style={{ fontSize: 28, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: MOTION.enter(t, 0.2, 0.6) }}>Final-year B.Tech project</At>
      <At x={1480} y={56 - (1 - sheetE) * 500} w={340} h={430} style={{ background: BGc, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 24, top: 28, width: '45%', height: 18, background: INK }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `repeating-linear-gradient(to bottom, ${INK} 0 4px, transparent 4px 20px)`, backgroundSize: 'calc(100% - 48px) calc(100% - 110px)', backgroundPosition: '24px 80px', backgroundRepeat: 'no-repeat', opacity: 0.4 }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: ((t * 0.45) % 1) * 424, height: 6, background: ACC }} />
      </At>
      <At x={64} y={250} w={1300} h={110} style={{ fontSize: 86, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-accent-400)', opacity: MOTION.enter(t, 3.0, 0.6), transform: `translateY(${(1 - MOTION.enter(t, 3.0, 0.6)) * 24}px)` }}>Nothing up my sleeve.</At>
      <At x={50} y={510} w={1800} h={330} style={{ fontSize: 330, fontWeight: 800, letterSpacing: '-0.055em', lineHeight: 1, clipPath: `inset(0 ${(1 - tt) * 100}% 0 0)`, whiteSpace: 'nowrap' }}>VitaGraph</At>
      <At x={64} y={860} w={1700} h={70} style={{ fontSize: 44, fontWeight: 600, opacity: MOTION.enter(t, 1.9, 0.7) }}>From a lab-report PDF to a question-answering knowledge graph.</At>
    </div>
  );
}

function Piece() {
  const { T, CUES: C, authoredTotal: tot } = useComposition();
  const endOf = (n) => { const i = NAMES.indexOf(n); return i + 1 < NAMES.length ? C[NAMES[i + 1]] : tot; };
  const frame = win(T, C.Parse, C.Numbers + 0.2, 0.4);
  const caps = CAP.map(([sc, at, text], i, arr) => ({ at: C[sc] + at, until: arr[i + 1] && arr[i + 1][0] === sc ? C[sc] + arr[i + 1][1] : endOf(sc) - 0.15, text }));
  const sceneProps = (n) => ({ T, c: C[n], b: endOf(n) });
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: 'var(--font-body)', color: INK, background: BGc }}>
      <Nav T={T} C={C} tot={tot} />
      <div style={{ position: 'absolute', left: 720, top: 88, width: 1200, height: 888, boxSizing: 'border-box', borderLeft: `2px solid ${DIV}`, overflow: 'hidden', opacity: frame, ...GRID }}>
        <Parse {...sceneProps('Parse')} /><OCR {...sceneProps('OCR')} /><Chunk {...sceneProps('Chunk')} /><Embed {...sceneProps('Embed')} /><Index {...sceneProps('Index')} />
        <Ask {...sceneProps('Ask')} /><Graph {...sceneProps('Graph')} /><Stream {...sceneProps('Stream')} /><Guard {...sceneProps('Guard')} />
      </div>
      {Object.keys(SCN).map((k) => <Left key={k} T={T} a={C[k]} b={endOf(k)} s={SCN[k]} />)}
      <Numbers {...sceneProps('Numbers')} /><Close {...sceneProps('Close')} /><Opening {...sceneProps('Opening')} />
      <div style={{ position: 'absolute', left: 0, top: 976, width: 1920, height: 104, background: BGc, borderTop: `2px solid ${DIV}`, zIndex: 30 }} />
      <window.Captions items={caps} style={{ left: 64, right: 64, bottom: 30, textAlign: 'left', font: '700 36px/1.2 Archivo, system-ui, sans-serif', color: INK, textShadow: 'none', zIndex: 31 }} />
    </div>
  );
}

function VitaStory() {
  return <window.CompositionStage width={1920} height={1080} bg="var(--color-bg)" scenes={window.OM_SCENES} playback={window.OM_PLAYBACK}><Piece /></window.CompositionStage>;
}
window.VitaStory = VitaStory;
})();
