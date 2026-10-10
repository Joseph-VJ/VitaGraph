# VitaGraph: build guide for a local AI

You are a local coding AI. Rebuild the approved VitaGraph interface inside the repository `Joseph-VJ/VitaGraph` (frontend in `site design/`: React 19, TypeScript 5.8, Vite 8.2, Tailwind 4) **exactly as designed**. The reference is `VitaGraph App.dc.html` in this project. Read it as a specification; do not try to run it.

## 0. Rules that cannot be broken

1. **Do not change the layout.** Sidebar width, header height, status strip, page structure and spacing below are fixed.
2. **Do not change the 3D knowledge graph.** The renderer in section 6 is copied verbatim. Port it line by line into a React component with a canvas. Same projection, node shapes, dimming, pulse ring, depth fade and floor grid. No libraries (no three.js, no d3).
3. Work on a new branch: git switch -c redesign/modernist-app. Never commit to main. Never force-push.
4. Do not touch vitagraph/backend. Keep every API call and response shape the existing pages use; replace only presentation. Keep data-testid and ARIA labels that existing tests use.
5. Use only the tokens in section 1. No raw hex in components, no rounded corners, no gradients, no shadows except the three tokens, no emoji, no purple.
6. No invented numbers. Show real values from the API, or label them as demo values.
7. Font: Archivo 400/600/800, self-hosted so the app works offline.

## 1. Design tokens (src/redesign/tokens.css)

~~~css
:root{
  --color-bg:#f3f2f2; --color-surface:#eae9e9; --color-text:#201e1d; --color-accent:#ec3013;
  --color-divider:color-mix(in srgb,#201e1d 40%,transparent);
  --color-neutral-100:#f8f4f4; --color-neutral-200:#eae7e7; --color-neutral-300:#d7d3d3; --color-neutral-400:#bab6b6;
  --color-neutral-500:#9b9797; --color-neutral-600:#7d7979; --color-neutral-700:#605d5d; --color-neutral-800:#444141; --color-neutral-900:#2d2b2b;
  --color-accent-100:#fff2ef; --color-accent-200:#ffe0d9; --color-accent-300:#ffc4b8; --color-accent-400:#ff9783; --color-accent-500:#ff563c;
  --color-accent-600:#dd2b0f; --color-accent-700:#ae1800; --color-accent-800:#7c1405; --color-accent-900:#4d170e;
  --font-body:"Archivo",system-ui,sans-serif; --font-heading:"Archivo",system-ui,sans-serif; --font-heading-weight:800;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px; --space-8:32px;
  --radius-sm:0; --radius-md:0; --radius-lg:0;
  --shadow-sm:0 1px 2px color-mix(in srgb,#2d2b2b 14%,transparent);
  --shadow-md:0 3px 10px color-mix(in srgb,#2d2b2b 16%,transparent);
  --shadow-lg:0 12px 32px color-mix(in srgb,#2d2b2b 22%,transparent);
}
~~~

Base: body 15px/1.55; headings weight 800, letter-spacing -0.015em. Buttons: 14px weight 800, padding 8px 14px, labels left-aligned; primary = accent fill with bg-colored text (hover accent-600, active accent-700); secondary = 1px divider border, 7% ink tint on hover; ghost = accent text. Tags 11px, padding 3px 10px. Tables: 11px uppercase letter-spaced header with 2px divider under it, 1px row rules. Focus ring: outline 2px solid var(--color-accent), offset 2px. Section rules are 2px, never hairlines.

## 2. App shell (fixed layout)

- Root: flex row, height 100vh, overflow hidden.
- **Sidebar**: 244px wide, 2px right border. Brand row 76px high (16px accent square + "VitaGraph" 20px/800). Group labels 11px uppercase. Item = 18px Lucide icon + label (15px/800) + sub-label (12px, neutral-700). Active item: ink background, bg-colored text, 5px accent bar on the left edge, sub-label neutral-400. Bottom: ghost "Reset demo" and an 11px disclaimer.
- Groups, in order:
  - **Workspace**: Upload & Ingest ("Add a report"), Library ("Your reports")
  - **Analyze**: Ask ("Questions with evidence"), Knowledge Graph ("Explore connections"), Timeline ("Changes over time"), Compare ("Two reports side by side"), Insights ("Graph analytics")
  - **Tools**: Image to Text ("Picture to text"), PDF to Text ("Digital text layer"), Text to Graph ("Entities and links")
  - **System**: Settings ("Ingestion, privacy")
- **Main column**: flex column, 100vh.
  - Optional backend-offline banner: 45° accent hatch, 2px accent bottom border.
  - **Header**: min-height 76px, 2px bottom rule, padding 12px 32px. Left: page title (24px/800) and sub line (14px neutral-700). Right: search input 300px ("Ask a question about your reports"; Enter opens Ask), optional tag "AI explanations off", model button opening a dialog, persona chip (32px accent square with initial, name, id).
  - **Main**: flex 1, overflow auto. Pages are centered, max-width 1280px, padding 32px. The Graph page is full-bleed.
  - **Status strip**: 40px, 2px top rule: 10px square (ink online, accent offline) with "Backend online/offline", "ChromaDB · N chunks", "N reports", last log line (ellipsized), ghost button "Simulate outage".

## 3. Pages

### Upload & Ingest
Two columns, top aligned, gap 32px.
- **Left, 320px (small)**: compact dashed drop zone (2px dashed divider, surface fill, padding 16px 24px): 28px upload icon, "Drop a PDF here" (18px/800), buttons "Choose file" (primary) and "Run the full show" (secondary). Below it, when a file exists, a row with file name, meta and status tag. Below that the five-step pipeline list (number, name, one-line output, tag Waiting/Running/Done): 01 Parse digital text, 02 Read scanned pages (OCR), 03 Chunk with provenance, 04 Embed passages, 05 Index, scoped to user.
- **Right, fills the rest**: the **interactive stage**: height min(74vh,760px), min 420px, 2px divider border, surface fill with faint 45° stripes. A canvas fills it and shows an image sequence from assets/frames/frame_0001.jpg onward (pattern and count are props framePath, frameCount; default 120). **Moving the pointer left to right, or scrolling the wheel over it, scrubs through the frames**, eased: current += (target - current) * 0.14 each animation frame. Images are drawn cover-fit. If frame 1 does not load, show "Interactive stage" and "Frames go in assets/frames. Move or scroll here to scrub through them." Dropping several image files onto it loads them as the frames, sorted by name. When frames exist show a small "Move · Scroll" tag bottom right. Never call it a video in the UI.
- After ingestion: a "Pages" table (page, source Native/OCR, characters, quality) and buttons "Ask about this report" and "Open library".

### Cinematic ingestion show
When ingestion starts (setting "Cinematic ingestion" on) open a full-screen overlay: ink background, faint 64px cream grid at 6% opacity, one canvas. HUD in the DOM: top-left the stage number (clamp 3rem to 8rem; "/05" in neutral-600), stage name (clamp 1.75rem to 3.5rem) and a one-line description; top-right a live counter label and value (accent-400, clamp 2.5rem to 6rem). Bottom: five progress segments with labels, the file name, buttons "Skip ahead", "Close" and (when done) "Open the report". Durations at normal speed: Parse 8 s, OCR 9 s, Chunk 8 s, Embed 9 s, Index 8 s; the speed setting multiplies by 0.5 / 1 / 1.8; reduce motion uses 0.4.
1. **Parse**: five page sheets rise in; a scan bar sweeps each; lines turn accent as text is extracted; page 5 gets speckle, hatch and "NO TEXT LAYER"; characters counter; a ribbon fills.
2. **OCR**: a tilted scan sheet and scan bar; accent boxes with a confidence label per line; recognized text typed on the right; one low-confidence line (0.68) in accent marked "needs review".
3. **Chunk**: a ribbon is cut by accent lines; cards (8 per row) drop in with id, page, character range and entity count.
4. **Embed**: a 48 by 8 strip (one chunk, 384 values) fills, then an N by 96 matrix fills row by row. Cell colour: positive = accent, negative = cream, alpha = magnitude.
5. **Index**: three collections side by side; only user_id VG-2026-001 is accent-outlined and receives dots; the other two are dashed, hatched and tagged FILTERED OUT; a query bar and three typed audit_log lines.
Chunk count = round(5013 / chunk size); default chunk size 210 gives 24.

### Library
Table of reports (date, description, pages, chunks, SHA-256, status). Selecting a row lists that report's values: name, page, value, a range bar (grey band = reference range, 4px accent marker = value), In range / Below range tag. Clicking a value expands its source passage with the match highlighted (accent-200 background, 2px accent underline), page and character span.

### Ask
Chat layout, centered column, max-width 960px. Empty state: "What would you like to know?" and four suggestion rows. Each turn: the question right-aligned in a surface bubble (2px ink top rule); a "Thinking…" panel (2px divider border) with three steps (Retrieve, Rank, Compose; square markers: outline, accent while running, ink when done) that collapses to "Thought for 1.3 s · 3 steps" with Show/Hide; then the answer: summary text with numbered citation chips (accent-700 fill) and three columns Evidence / Limitations / Safety. Chips and evidence lines open the passage slip. Clinical questions get the verbatim refusal card (accent-100 fill, 3px accent top rule, tag "Declined by policy"); unknown questions get "No supporting passage". The composer is sticky at the bottom with a 2px top rule: input (min-height 52px) and a primary Send button.

### Knowledge Graph
Full-bleed. Canvas on the left over a 48px grid background; a 340px right panel with a 2px left rule containing the **Subgraph** list (All nodes, Hemoglobin trend, Vitamin D and B12, Feb 2026 summary, Platelets and WBC; active row inverted), the selected node card (kind, label, text, neighbour buttons, source passage) and a legend. Buttons "Replay build" and "Pause rotation" top right, node and edge count top left, hint bottom left. Renderer in section 6.

### Timeline
Left column 380px: report list (date, description, status tag). Right: two isometric 3D bar charts (Hemoglobin g/dL, Vitamin D ng/mL), geometry in section 7. Put value and date labels in HTML positioned over the SVG (percent positions), not in SVG text elements.

### Compare
Three pair buttons (Jan 2024 to Aug 2024, Aug 2024 to Feb 2026, Jan 2024 to Feb 2026; active = primary) and a table: biomarker, value A, value B, change, tag (Higher / Lower / Unchanged / One report).

### Insights
Three columns: Graph size (nodes, edges, per-type counts), Betweenness centrality (top 8 bars, Brandes' algorithm on the graph, normalised by (n-1)(n-2)), Edge types (counts by node-type pair).

### Tools
- **Image to Text** (image files only, English only, no language selector): top = a dashed input bar (label "Input", "Choose an image", primary "Choose image", secondary "Use sample scan") and a status line. Below it, once a result exists, a stats row (lines, characters, mean confidence) with "Copy text" and "Download .md". Under that a two-column grid: left panel **Original** (the source image on a canvas; recognition boxes hidden by default) and right panel **Text** (recognized text). Both panels show an empty-state hint before a file is chosen. Engine: Tesseract.js in the browser. The .md file = "# Image to text", source name, line count, mean confidence, then the text.
- **PDF to Text** (separate tool, same layout): top input bar ("Choose a PDF", "Choose PDF", "Use sample report"), status line, stats row (characters, pages) with "Copy all" and "Download .md". Two columns: left **Original** (each PDF page rendered as an image at scale 0.9 with a "p.N" caption, scrollable), right **Text** (per page: "p.N", character count, tag Native text / No text layer in accent, then the text). pdf.js reads the text layer. The .md file = "# file name" then "## Page N" sections.
- **Text to Graph**: uses **the same Knowledge Graph page and the same 3D renderer**. The right panel shows a dashed "Upload a text file" bar (button "Choose file"; accepts .txt and .md, also drag and drop, loads the file into the textarea and rebuilds the graph), a textarea, "Build graph", a summary line, a compact entities table and "Download JSON". Extraction: the date by regex; measurements by this regex: ([A-Za-z][A-Za-z0-9 ()\-]{1,34}?)\s*[:=]?\s*(\d[\d,]*\.?\d*)\s*(g\/dL|mg\/dL|ng\/mL|pg\/mL|\/µL|\/uL|mmol\/L|U\/L|IU\/L|fL|pg|%) . Nodes: Document (type person, square, at the origin), Date (type report, ring), Biomarker (type bio, filled), Value (type meas, small grey). Biomarkers sit on a Fibonacci sphere of radius 0.52 and their values at radius 0.85 in the same direction. Legend labels become Document, Date, Biomarker, Value. Edges: Document to Date, Document to each Biomarker, Biomarker to its Value.

### Settings
Rows with a 2px ink rule under each group heading (11px uppercase accent-700): Ingestion (Cinematic ingestion On/Off; Process speed Fast/Normal/Real-time; Chunk size range 120 to 600 step 10), Reading (embedding model note: all-MiniLM-L6-v2, 384 dimensions, local), Privacy and answers (send retrieved passages to the AI model On/Off; vector filter note, not changeable), Display (Reduce motion; model provider opens the dialog).

## 4. Motion rules
Use the repo's motion engine where possible. Respect prefers-reduced-motion. Budgets: 60 fps, no frame over 33 ms. Pages do not animate content in; the only large motion is the ingestion show and the graph.

## 5. Data
Demo persona: Arjun R, VG-2026-001, synthetic data. Reports: Jan 2024 (5 pages, 21 chunks), Aug 2024 (4, 18), Feb 2026 (5, 24). Feb 2026 values: Hemoglobin 14.0 g/dL (13.0-17.0), WBC 6,200 /µL (4,500-11,000), Platelets 245,000 /µL (150,000-450,000), Vitamin D 32.0 ng/mL (30-100; 18 in Jan 2024), Vitamin B12 480 pg/mL (200-900), Fasting glucose 94 mg/dL (70-99); Hemoglobin was 13.1 (Jan 2024) and 13.2 (Aug 2024). In production bind everything to the real endpoints: /api/reports, /api/reports/{id}/pages, /api/reports/{uid}/trends, /api/reports/compare, /api/questions, /api/jobs/{id}/events, /api/graph/{uid}, /api/graph/subgraph, /api/timeline/{uid}, /api/health.

## 6. The 3D knowledge graph (copy exactly, do not change)

Demo data. Node fields: id, k (person | report | section | bio | meas | unc), label, pos [x,y,z], about, ev.

~~~js
  NODES = [
    { id: 'p', k: 'person', label: 'Arjun R', pos: [-0.056, -0.097, -0.073], about: 'Subject. Every report and passage is scoped to VG-2026-001.' },
    { id: 'rj', k: 'report', label: 'Jan 2024', pos: [-0.056, -0.298, 0.32], about: 'Baseline report. 5 pages: blood count and vitamins.' },
    { id: 'ra', k: 'report', label: 'Aug 2024', pos: [0.064, -0.198, -0.47], about: 'Follow-up report. 4 pages.' },
    { id: 'rf', k: 'report', label: 'Feb 2026', pos: [-0.028, 0.223, 0.068], about: 'Latest report. 5 pages; page 5 was read by OCR.' },
    { id: 'sc', k: 'section', label: 'CBC', pos: [0.426, -0.177, -0.1], about: 'Complete blood count section.' },
    { id: 'sm', k: 'section', label: 'Metabolic', pos: [0.238, 0.525, -0.208], about: 'Metabolic panel section.' },
    { id: 'sv', k: 'section', label: 'Vitamins', pos: [-0.365, 0.056, 0.398], about: 'Vitamin panel section.' },
    { id: 'bhb', k: 'bio', label: 'Hemoglobin', pos: [0.317, -0.686, -0.238], about: 'Reference range 13.0–17.0 g/dL.', ev: 'e1' },
    { id: 'bwbc', k: 'bio', label: 'WBC', pos: [0.751, -0.021, 0.291], about: 'Reference range 4,500–11,000 /µL.', ev: 'e8' },
    { id: 'bplt', k: 'bio', label: 'Platelets', pos: [0.544, 0.101, -0.588], about: 'Reference range 150,000–450,000 /µL.', ev: 'e7' },
    { id: 'bvd', k: 'bio', label: 'Vitamin D', pos: [-0.776, -0.111, -0.011], about: 'Reference range 30–100 ng/mL.', ev: 'e4' },
    { id: 'bb12', k: 'bio', label: 'Vitamin B12', pos: [-0.271, 0.292, 0.778], about: 'Reference range 200–900 pg/mL.', ev: 'e6' },
    { id: 'bglu', k: 'bio', label: 'Glucose', pos: [0.429, 0.828, -0.08], about: 'Reference range 70–99 mg/dL.', ev: 'e9' },
    { id: 'mhbj', k: 'meas', label: '13.1', pos: [0.293, -0.77, 0.279], about: 'Hemoglobin, Jan 2024, g/dL.', ev: 'e3' },
    { id: 'mhba', k: 'meas', label: '13.2', pos: [0.133, -0.571, -0.728], about: 'Hemoglobin, Aug 2024, g/dL.', ev: 'e2' },
    { id: 'mhbf', k: 'meas', label: '14.0', pos: [-0.141, -0.691, -0.159], about: 'Hemoglobin, Feb 2026, g/dL.', ev: 'e1' },
    { id: 'mvdj', k: 'meas', label: '18', pos: [-0.792, -0.048, 0.403], about: 'Vitamin D, Jan 2024, ng/mL.', ev: 'e5' },
    { id: 'mvdf', k: 'meas', label: '32.0', pos: [-0.602, -0.42, 0.241], about: 'Vitamin D, Feb 2026, ng/mL.', ev: 'e4' },
    { id: 'mb12f', k: 'meas', label: '480', pos: [-0.275, 0.632, 0.5], about: 'Vitamin B12, Feb 2026, pg/mL.', ev: 'e6' },
    { id: 'mwbcf', k: 'meas', label: '6,200', pos: [0.521, 0.313, 0.514], about: 'WBC, Feb 2026, /µL.', ev: 'e8' },
    { id: 'mpltf', k: 'meas', label: '245,000', pos: [0.121, 0.386, -0.679], about: 'Platelets, Feb 2026, /µL.', ev: 'e7' },
    { id: 'mgluf', k: 'meas', label: '94', pos: [-0.008, 0.869, 0.019], about: 'Fasting glucose, Feb 2026, mg/dL.', ev: 'e9' },
    { id: 'u', k: 'unc', label: 'Cause not stated', pos: [-0.842, -0.273, -0.465], about: 'The reports record the Vitamin D change but do not state a cause.' }
  ];
  EDGES = [['p','rj'],['p','ra'],['p','rf'],['rj','sc'],['rj','sv'],['ra','sc'],['rf','sc'],['rf','sm'],['rf','sv'],['sc','bhb'],['sc','bwbc'],['sc','bplt'],['sm','bglu'],['sv','bvd'],['sv','bb12'],['bhb','mhbj'],['bhb','mhba'],['bhb','mhbf'],['bvd','mvdj'],['bvd','mvdf'],['bb12','mb12f'],['bwbc','mwbcf'],['bplt','mpltf'],['bglu','mgluf'],['mhbj','rj'],['mhba','ra'],['mhbf','rf'],['mvdj','rj'],['mvdf','rf'],['mb12f','rf'],['mwbcf','rf'],['mpltf','rf'],['mgluf','rf'],['u','bvd']];
  FOCUS = {
    hb: ['bhb', 'mhbj', 'mhba', 'mhbf', 'rj', 'ra', 'rf'],
    vit: ['bvd', 'mvdj', 'mvdf', 'bb12', 'mb12f', 'rj', 'rf', 'u'],
    feb: ['rf', 'mhbf', 'mvdf', 'mb12f', 'mwbcf', 'mpltf', 'mgluf', 'bhb', 'bvd', 'bb12', 'bwbc', 'bplt', 'bglu'],
    plt: ['bplt', 'mpltf', 'bwbc', 'mwbcf', 'rf']
  };
  KIND = { person: 'Subject', report: 'Report', section: 'Section', bio: 'Biomarker', meas: 'Measurement', unc: 'Uncertainty' };
~~~

Setup, interaction (drag to rotate, wheel to zoom 0.6 to 1.9, click to select, hover cursor) and render loop:

~~~js
  setCanvas = (el) => {
    if (this.cv === el) return;
    this.teardown(); this.cv = el;
    if (!el) { this.g = null; return; }
    const css = getComputedStyle(el);
    const v = (n, d) => css.getPropertyValue(n).trim() || d;
    this.col = { ink: v('--color-text', '#201e1d'), acc: v('--color-accent', '#ec3013'), bg: v('--color-bg', '#f3f2f2'), n7: v('--color-neutral-700', '#605d5d'), n4: v('--color-neutral-400', '#bab6b6') };
    const g = this.g = { rx: 0.4, ry: 0.7, zoom: 1, drag: null, moved: false, hover: null, t0: performance.now(), focusT0: -9999, lastFocus: this.state.focus, proj: {} };
    this.idx = {}; this.NODES.forEach((n, i) => { this.idx[n.id] = i; });
    const ord = { person: 0, report: 1, section: 2, bio: 3, meas: 4, unc: 5 }, cnt = {};
    this.NODES.forEach(n => { cnt[n.k] = (cnt[n.k] || 0); n.delay = ord[n.k] * 340 + cnt[n.k] * 50; cnt[n.k]++; });
    const loc = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const hit = (x, y) => { let best = null, bd = 1e9; for (const id in g.proj) { const p = g.proj[id]; const d = Math.hypot(p.x - x, p.y - y); if (d < p.r + 7 && (d < bd || (best && p.z < g.proj[best].z && d < bd + 6))) { bd = d; best = id; } } return best; };
    const down = (e) => { g.drag = { x: e.clientX, y: e.clientY }; g.moved = false; try { el.setPointerCapture(e.pointerId); } catch (x) {} el.style.cursor = 'grabbing'; };
    const move = (e) => {
      if (g.drag) { const dx = e.clientX - g.drag.x, dy = e.clientY - g.drag.y; if (Math.abs(dx) + Math.abs(dy) > 2) g.moved = true; g.ry += dx * 0.008; g.rx = Math.max(-1.2, Math.min(1.2, g.rx + dy * 0.006)); g.drag.x = e.clientX; g.drag.y = e.clientY; }
      else { const [x, y] = loc(e); g.hover = hit(x, y); el.style.cursor = g.hover ? 'pointer' : 'grab'; }
    };
    const up = (e) => {
      if (g.drag && !g.moved) { const [x, y] = loc(e); const h = hit(x, y); this.setState({ node: h }); if (h) this.log('graph', 'Inspect ' + this.NODES[this.idx[h]].label); }
      g.drag = null; el.style.cursor = g.hover ? 'pointer' : 'grab';
    };
    const wheel = (e) => { e.preventDefault(); g.zoom = Math.max(0.6, Math.min(1.9, g.zoom * (e.deltaY > 0 ? 0.94 : 1.06))); };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('wheel', wheel, { passive: false });
    this.off = () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('wheel', wheel); };
    const loop = (now) => { this.raf = requestAnimationFrame(loop); this.draw(now); };
    this.raf = requestAnimationFrame(loop);
  };
~~~

The renderer (projection, ground grid, curved edges, ontology reveal, dimming to 40%, 1200 ms pulse ring, labels):

~~~js
  draw(now) {
    const g = this.g, el = this.cv; if (!g || !el) return;
    const r = el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
    const ctx = el.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const c = this.col, st = this.state;
    if (st.focus !== g.lastFocus) { g.lastFocus = st.focus; g.focusT0 = now; }
    if (!g.drag && this.props.autoRotate !== false && st.auto) g.ry += 0.0032;
    const cy = Math.cos(g.ry), sy = Math.sin(g.ry), cx = Math.cos(g.rx), sx = Math.sin(g.rx);
    const S = Math.min(w, h) * 0.34 * g.zoom, F = 3.4, ox = w / 2, oy = h / 2;
    const proj = (p) => { const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy; const y2 = p[1] * cx - z1 * sx, z2 = p[1] * sx + z1 * cx; const k = F / (F + z2); return [ox + x1 * S * k, oy + y2 * S * k, z2, k]; };
    const act = st.focus === 'all' ? null : new Set(this.FOCUS[st.focus]);
    const near = (z) => Math.max(0, Math.min(1, 1 - (z + 1.2) / 2.4));
    // ground grid
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      const t = i * 0.4;
      [[[t, 1.3, -1.6], [t, 1.3, 1.6]], [[-1.6, 1.3, t], [1.6, 1.3, t]]].forEach(([a, b]) => {
        const A = proj(a), B = proj(b); ctx.globalAlpha = 0.07 + 0.16 * near((A[2] + B[2]) / 2); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      });
    }
    const P = {}; this.NODES.forEach(n => { P[n.id] = proj(n.pos); });
    const vis = (n) => { const t = (now - g.t0 - n.delay) / 420; return t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3); };
    const V = {}; this.NODES.forEach(n => { V[n.id] = vis(n); });
    // edges
    this.EDGES.forEach(([a, b]) => {
      const A = P[a], B = P[b], v = Math.min(V[a], V[b]); if (v <= 0) return;
      const both = act && act.has(a) && act.has(b);
      const base = act ? (both ? 0.85 : 0.07) : 0.14 + 0.4 * near((A[2] + B[2]) / 2);
      ctx.globalAlpha = base * v; ctx.strokeStyle = both ? c.acc : c.ink; ctx.lineWidth = both ? 1.8 : 1;
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(mx - dy / L * L * 0.08, my + dx / L * L * 0.08, B[0], B[1]); ctx.stroke();
    });
    // nodes far -> near
    const order = this.NODES.slice().sort((a, b) => P[b.id][2] - P[a.id][2]);
    g.proj = {};
    const pulseT = (now - g.focusT0) / 1200;
    order.forEach(n => {
      const p = P[n.id], v = V[n.id]; if (v <= 0) return;
      const k = p[3], isAct = !act || act.has(n.id), sel = st.node === n.id, hov = g.hover === n.id;
      const a = (act ? (isAct ? 1 : 0.4) : 0.55 + 0.45 * near(p[2])) * v;
      const base = { person: 11, report: 12, section: 7, bio: 9, meas: 5, unc: 9 }[n.k] * k * (0.4 + 0.6 * v);
      g.proj[n.id] = { x: p[0], y: p[1], r: Math.max(base, 8), z: p[2] };
      const hot = act && isAct;
      ctx.globalAlpha = a; ctx.lineWidth = 2.5;
      ctx.fillStyle = hot ? c.acc : c.ink; ctx.strokeStyle = hot ? c.acc : c.ink;
      ctx.beginPath();
      if (n.k === 'person') { ctx.rect(p[0] - base, p[1] - base, base * 2, base * 2); ctx.fill(); }
      else if (n.k === 'report') { ctx.arc(p[0], p[1], base, 0, 6.2832); ctx.fillStyle = c.bg; ctx.fill(); ctx.stroke(); }
      else if (n.k === 'section') { ctx.moveTo(p[0], p[1] - base); ctx.lineTo(p[0] + base, p[1]); ctx.lineTo(p[0], p[1] + base); ctx.lineTo(p[0] - base, p[1]); ctx.closePath(); ctx.fillStyle = c.bg; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
      else if (n.k === 'bio') { ctx.arc(p[0], p[1], base, 0, 6.2832); ctx.fill(); }
      else if (n.k === 'meas') { ctx.arc(p[0], p[1], base, 0, 6.2832); ctx.fillStyle = hot ? c.acc : c.n7; ctx.fill(); }
      else { ctx.setLineDash([3, 3]); ctx.arc(p[0], p[1], base, 0, 6.2832); ctx.fillStyle = c.bg; ctx.fill(); ctx.strokeStyle = c.acc; ctx.stroke(); ctx.setLineDash([]); }
      if (act && isAct && pulseT >= 0 && pulseT < 1) { ctx.globalAlpha = (1 - pulseT) * 0.8; ctx.strokeStyle = c.acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], base + 4 + pulseT * 26, 0, 6.2832); ctx.stroke(); }
      if (sel || hov) { ctx.globalAlpha = 1; ctx.strokeStyle = sel ? c.acc : c.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], base + 6, 0, 6.2832); ctx.stroke(); }
      const showLabel = n.k !== 'meas' ? (!act || isAct || sel || hov) : (sel || hov || (act ? isAct : p[2] < 0.1));
      if (showLabel && v > 0.6) {
        const fs = Math.max(10, 12.5 * k); ctx.font = (n.k === 'report' || n.k === 'person' ? '800 ' : '600 ') + fs + 'px Archivo, system-ui, sans-serif';
        ctx.globalAlpha = Math.max(a, sel || hov ? 1 : 0); ctx.lineWidth = 4; ctx.strokeStyle = c.bg; ctx.lineJoin = 'round';
        const tx = p[0] + base + 7, ty = p[1] + fs * 0.35; ctx.strokeText(n.label, tx, ty); ctx.fillStyle = hot ? c.acc : c.ink; ctx.fillText(n.label, tx, ty);
      }
    });
    ctx.globalAlpha = 1;
  }
~~~

Notes: perspective F = 3.4; scale S = min(w,h) * 0.34 * zoom; auto-rotate adds 0.0032 rad per frame; initial rotation rx = 0.4, ry = 0.7; reveal order person, report, section, biomarker, measurement, uncertainty (340 ms between types, 50 ms between nodes of a type, 420 ms ease-out cubic). Shapes: person = filled square, report = ring on bg fill, section = diamond, biomarker = filled circle, measurement = small grey circle, uncertainty = dashed accent ring. Canvas colours come from the CSS variables --color-text, --color-accent, --color-bg, --color-neutral-700.

## 7. Isometric bar chart (Timeline)

~~~js
  iso(bars, o) {
    const c = 0.866, LX = 260, LY = 70, LZ = 120, ox = 100, oy = 135;
    const P = (x, y, z) => [ox + (x - y) * c, oy + (x + y) * 0.5 - z];
    const pt = (a) => a.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
    const f = (v) => Math.min(1, v / o.max) * LZ;
    const out = { floor: pt([P(0, 0, 0), P(LX, 0, 0), P(LX, LY, 0), P(0, LY, 0)]), back: pt([P(0, 0, 0), P(LX, 0, 0), P(LX, 0, LZ), P(0, 0, LZ)]), left: pt([P(0, 0, 0), P(0, LY, 0), P(0, LY, LZ), P(0, 0, LZ)]) };
    const zl = f(o.lo), zh = f(o.hi);
    out.bandBack = pt([P(0, 0, zl), P(LX, 0, zl), P(LX, 0, zh), P(0, 0, zh)]);
    out.bandLeft = pt([P(0, 0, zl), P(0, LY, zl), P(0, LY, zh), P(0, 0, zh)]);
    out.grid = []; for (let i = 1; i < 8; i++) { const x = LX * i / 8, a = P(x, 0, 0), b = P(x, LY, 0); out.grid.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] }); }
    const l1 = P(0, LY, zl), l2 = P(0, LY, zh);
    const lab = (x, y, text, size, color, tx, ls) => ({ text, css: 'position:absolute;left:' + (x / 400 * 100).toFixed(2) + '%;top:' + (y / 320 * 100).toFixed(2) + '%;transform:translate(' + tx + ',-50%);font-size:' + size + 'px;font-weight:800;line-height:1;white-space:nowrap;pointer-events:none;color:' + color + ';font-variant-numeric:tabular-nums;letter-spacing:' + (ls || 0) + 'em' });
    out.labels = [lab(l1[0] - 6, l1[1], o.loText, 11, 'var(--color-accent-700)', '-100%'), lab(l2[0] - 6, l2[1], o.hiText, 11, 'var(--color-accent-700)', '-100%')];
    const bw = 34, bd = 34, y0 = (LY - bd) / 2, y1 = y0 + bd;
    out.bars = bars.map(b => {
      const x0 = 20 + b.t * (LX - 40 - bw), x1 = x0 + bw, hh = Math.max(2, f(b.v));
      const tp = P(x0 + bw / 2, y0 + bd / 2, hh), bp = P(x0 + bw / 2, y1, 0);
      const ft = b.hot ? 'var(--color-accent-400)' : 'var(--color-neutral-400)', ff = b.hot ? 'var(--color-accent)' : 'var(--color-neutral-700)', rf = b.hot ? 'var(--color-accent-700)' : 'var(--color-neutral-900)';
      return {
        top: pt([P(x0, y0, hh), P(x1, y0, hh), P(x1, y1, hh), P(x0, y1, hh)]),
        front: pt([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, hh), P(x0, y1, hh)]),
        right: pt([P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, hh), P(x1, y0, hh)]),
        tfCss: 'fill:' + ft + ';stroke:var(--color-text);stroke-width:1', ffCss: 'fill:' + ff + ';stroke:var(--color-text);stroke-width:1', rfCss: 'fill:' + rf + ';stroke:var(--color-text);stroke-width:1',
        _l: [lab(tp[0], tp[1] - 14, b.val, 17, 'var(--color-text)', '-50%'), lab(bp[0] - 10, bp[1] + 24, b.date, 11, 'var(--color-neutral-800)', '-50%', 0.04)]
      };
    });
    out.bars.forEach(b => { out.labels.push(...b._l); });
    return out;
  }
~~~

## 8. Order of work and checks

1. Read the repo (AGENTS.md, CLAUDE.md, GEMINI.md, README.md, site design/src) and write redesign/NOTES.md: routes, components, endpoints used.
2. Add tokens, the shell, then one page at a time in the order of section 3. After each page npm run build must pass.
3. Port the graph renderer next and compare it side by side with the reference: same positions, same dimming, same pulse.
4. Run python -m pytest tests -q in vitagraph/backend (54 pass) and the existing Playwright checks.
5. Commit in small steps on redesign/modernist-app. Push that branch only. Write redesign/REPORT.md listing what was ported and what is still a demo value.
