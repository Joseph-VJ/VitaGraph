# VitaGraph: real-time build guide for the 3D graph and every animation

This guide is for an AI (or a person) that has **never built a software-3D canvas before**. It explains the math in small steps, gives complete TypeScript you can paste, and gives numbers you can use to check your work. Read Part A in full before writing code. The graph is **not WebGL and not three.js**. It is a 2D canvas that fakes 3D with about 30 lines of math. If you try to "improve" it with a 3D library, the look will change. Do not.

Companion file: `LOCAL_AI_BUILD_GUIDE.md` (layout, tokens, pages). This file covers only the hard, animated parts.

Contents
- Part A: the 3D knowledge graph (math, drawing, animation, interaction, React port, tests)
- Part B: the cinematic ingestion show
- Part C: the interactive frame stage (scroll or move to scrub an image sequence)
- Part D: the isometric bar charts
- Part E: graph analytics (betweenness centrality) and graph layout generation
- Part F: how to prompt a small local model, step by step, with acceptance tests
- Part G: common mistakes

---

# Part A. The 3D knowledge graph

## A1. The idea in one paragraph
Every node has a position `(x, y, z)` inside a unit sphere (all coordinates between about -0.9 and 0.9). Every frame we (1) rotate all points by two angles, (2) squash them onto the screen with a perspective formula, (3) draw the far things first and the near things last, and (4) make near things darker, bigger and sharper, far things lighter and smaller. Your brain reads that as depth. Nothing else is 3D.

## A2. Vocabulary
- **world point**: the stored position of a node, `[x, y, z]`. x is right, y is down (canvas style), z is toward the viewer's far side after rotation (larger z = farther away).
- **yaw ry**: spin around the vertical axis (the thing that auto-rotates). Starts at 0.7 rad.
- **pitch rx**: tilt up/down. Starts at 0.4 rad. Clamped to [-1.2, 1.2].
- **F = 3.4**: the "focal length" (camera distance). Bigger F = flatter, weaker perspective.
- **S**: pixels per world unit. `S = min(canvasWidth, canvasHeight) * 0.34 * zoom`.
- **(ox, oy)**: the screen center, `(w/2, h/2)`.
- **k**: the perspective scale of one point, `k = F / (F + z2)`. k is about 1.3 for the nearest points and 0.8 for the farthest.

## A3. Step 1: rotation (yaw, then pitch)
For a world point p = [x, y, z]:

~~~ts
// yaw: rotate around the vertical (y) axis by ry
const x1 =  x * Math.cos(ry) + z * Math.sin(ry);
const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
// pitch: rotate around the horizontal (x) axis by rx
const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
~~~

Order matters: yaw first, then pitch. If you swap them the graph tumbles instead of spinning. `z2` is the depth after both rotations. Keep it; you need it for sorting and for fading.

## A4. Step 2: perspective
~~~ts
const k  = F / (F + z2);          // closer (z2 negative) => k > 1 => bigger and further from center
const sx = ox + x1 * S * k;       // screen x in CSS pixels
const sy = oy + y2 * S * k;       // screen y in CSS pixels
~~~
Return `[sx, sy, z2, k]`. Everything else in the drawing uses these four numbers.

## A5. Check your math with numbers (canvas 1200 x 888, zoom 1, ry = 0.7, rx = 0.4)
S = 301.92, ox = 600, oy = 444, F = 3.4. Your code must reproduce this table to about 3 decimals:

| node | x1 | z1 | y2 | z2 | k | screen x | screen y | near(z2) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rf | 0.022 | 0.070 | 0.178 | 0.151 | 0.957 | 606.5 | 495.5 | 0.437 |
| bhb | 0.089 | -0.386 | -0.481 | -0.623 | 1.224 | 632.9 | 266.0 | 0.760 |
| p | -0.090 | -0.020 | -0.082 | -0.056 | 1.017 | 572.4 | 418.9 | 0.523 |
| u | -0.944 | 0.187 | -0.324 | 0.066 | 0.981 | 320.5 | 348.0 | 0.473 |

If your numbers differ, stop and fix the projection before drawing anything.

## A6. Step 3: depth cue helper
~~~ts
const near = (z: number) => Math.max(0, Math.min(1, 1 - (z + 1.2) / 2.4)); // 1 = nearest, 0 = farthest
~~~
Used for: node opacity (0.55 + 0.45 * near), edge opacity (0.14 + 0.4 * near of the mean depth of its two ends) and floor-grid opacity (0.07 + 0.16 * near).

## A7. Step 4: draw order (painter's algorithm)
Per frame, in this order, on one canvas:
1. `clearRect`.
2. The **floor grid** (behind everything).
3. All **edges**.
4. All **nodes**, sorted so the **farthest node is drawn first** (sort descending by z2). Near nodes overlap far ones. Labels are drawn together with each node, so near labels cover far labels.

## A8. The floor grid
A 9 by 9 line grid lying on the plane y = 1.3 (below the graph), from -1.6 to 1.6, one line every 0.4 in both directions. Each line is projected from its two end points and drawn with 1px ink color. Opacity per line = 0.07 + 0.16 * near(meanZ). This is what gives the "stage floor" look in the screenshot.

~~~ts
for (let i = -4; i <= 4; i++) {
  const t = i * 0.4;
  for (const [a, b] of [[[t, 1.3, -1.6], [t, 1.3, 1.6]], [[-1.6, 1.3, t], [1.6, 1.3, t]]] as const) {
    const A = project(a), B = project(b);
    ctx.globalAlpha = 0.07 + 0.16 * near((A[2] + B[2]) / 2);
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
  }
}
~~~

## A9. Edges are gentle curves, not straight lines
For an edge between screen points A and B: midpoint M, vector d = B - A. The quadratic control point is **M shifted sideways by 8% of d, rotated 90 degrees**:
~~~ts
const cx = Mx - dy * 0.08;
const cy = My + dx * 0.08;
ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(cx, cy, B.x, B.y);
~~~
(The original code writes `dy / L * L * 0.08`; L cancels, so it is `dy * 0.08`.) Example with the table above, edge Feb 2026 to Hemoglobin: A = (606.5, 495.5) B = (632.9, 266.0) control point = (638.1, 382.9).

Edge style:
- No focus active: opacity = (0.14 + 0.4 * near(meanZ)) * reveal, color ink, width 1.
- Focus active and **both ends active**: opacity 0.85 * reveal, color accent, width 1.8.
- Focus active otherwise: opacity 0.07 * reveal, ink, width 1.
- `reveal` of an edge = the smaller of its two node reveal values (A12).

## A10. Node shapes (by type)
Base radius in px before depth scaling: person 11, report 12, section 7, bio 9, meas 5, unc 9. Actual radius `r = base * k * (0.4 + 0.6 * reveal)`. Line width 2.5 (section 2).
- `person` (subject / document): **filled square**, side 2r, ink.
- `report`: **ring**: circle filled with the page background color, stroked in ink.
- `section`: **diamond** (rotated square) filled with background, stroked.
- `bio` (biomarker): **filled circle**, ink.
- `meas` (value): **small filled circle**, neutral-700 grey.
- `unc` (uncertainty): **dashed accent ring** (`setLineDash([3, 3])`) filled with background; reset the dash after.
When a focus is active and the node is in the active set, fill and stroke become **accent**.
Node opacity: no focus => `0.55 + 0.45 * near(z2)`; focus => 1 if active, **0.4 if not**. Multiply by reveal.

## A11. Labels
Draw after the shape. Font Archivo, weight 800 for person and report, 600 otherwise, size `max(10, 12.5 * k)` px. Position: x = node x + r + 7, y = node y + 0.35 * fontSize. **Halo**: first `strokeText` with the page background color, lineWidth 4, `lineJoin = "round"`, then `fillText` in ink (accent if highlighted). The halo keeps text readable on top of lines. Visibility: non-value nodes show a label when there is no focus, or when active/selected/hovered. Value nodes (meas) show a label only when selected/hovered, or (no focus) when in the front half (z2 < 0.1), or (focus) when active. Only label when reveal > 0.6.

## A12. The build-in animation (ontology reveal)
Each node has a delay in milliseconds: `delay = typeOrder * 340 + indexWithinType * 50`, where typeOrder = person 0, report 1, section 2, bio 3, meas 4, unc 5, and indexWithinType counts nodes of the same type in array order. Reveal progress:
~~~ts
const t = (nowMs - startMs - delay) / 420;
const reveal = t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);   // ease-out cubic over 420 ms
~~~
So the subject appears first, then reports, sections, biomarkers, values, uncertainty: the whole graph finishes in about 2.2 s. "Replay build" sets `startMs = now`.

## A13. Focus (subgraph) and the pulse ring
A "focus" is a set of node ids. While active: inactive nodes fade to 40%, inactive edges to 7%, active edges turn accent. **When the focus changes, store `focusStartMs = now`.** For every active node draw one expanding ring during 1200 ms:
~~~ts
const pulseT = (nowMs - focusStartMs) / 1200;            // 0 -> 1
if (pulseT >= 0 && pulseT < 1) {
  ctx.globalAlpha = (1 - pulseT) * 0.8; ctx.strokeStyle = accent; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r + 4 + pulseT * 26, 0, 2 * Math.PI); ctx.stroke();
}
~~~
At load, set focusStartMs to a huge negative number so nothing pulses.

## A14. Rotation and interaction
- **Auto-rotate**: ry += 0.0032 per frame at 60 fps = **0.192 rad per second**. Use delta time so 120 Hz screens are not twice as fast. Pause while dragging, and when "Pause rotation" is on, and when the user prefers reduced motion.
- **Drag**: on pointerdown remember the pointer, call `setPointerCapture`, cursor "grabbing". On pointermove while dragging: `ry += dx * 0.008; rx = clamp(rx + dy * 0.006, -1.2, 1.2)`. If |dx| + |dy| ever exceeds 2 px set `moved = true`.
- **Click vs drag**: on pointerup, if `moved` is false, it is a click: hit-test and select.
- **Zoom**: wheel with `preventDefault()` (needs a **non-passive** native listener): `zoom = clamp(zoom * (deltaY > 0 ? 0.94 : 1.06), 0.6, 1.9)`.
- **Hit test**: every frame store, for each drawn node, `{id, x, y, r: max(radius, 8), z}`. A pointer at (px, py) hits a node when distance < r + 7. Among several hits choose the nearest in screen distance; if two are within 6 px, prefer the one with the smaller z2 (closer to the viewer).
- **Hover**: on pointermove with no drag, update `hover` and set cursor "pointer" or "grab". Hovered and selected nodes get an extra ring of radius r + 6 (selected = accent, hover = ink) and always show their label.

## A15. HiDPI and resizing (blurry canvas is the #1 visual bug)
Each frame: read the CSS size with `getBoundingClientRect()`; `dpr = Math.min(devicePixelRatio, 2)`; if `canvas.width !== round(w * dpr)` then set canvas.width/height to the device-pixel size; then `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` and draw in CSS pixels. The canvas CSS must be `width: 100%; height: 100%; display: block` inside a positioned parent.

## A16. Complete React + TypeScript port (paste this)
~~~tsx
import { useEffect, useMemo, useRef } from "react";

export type NodeKind = "person" | "report" | "section" | "bio" | "meas" | "unc";
export interface GNode { id: string; k: NodeKind; label: string; pos: [number, number, number] }
export type GEdge = [string, string];

const F = 3.4;
const ORDER: Record<NodeKind, number> = { person: 0, report: 1, section: 2, bio: 3, meas: 4, unc: 5 };
const BASE: Record<NodeKind, number> = { person: 11, report: 12, section: 7, bio: 9, meas: 5, unc: 9 };
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const near = (z: number) => clamp(1 - (z + 1.2) / 2.4, 0, 1);

type P4 = [number, number, number, number]; // sx, sy, z2, k
interface Hit { id: string; x: number; y: number; r: number; z: number }
interface Colors { ink: string; acc: string; bg: string; n7: string }

export function revealDelays(nodes: GNode[]): Record<string, number> {
  const cnt: Partial<Record<NodeKind, number>> = {}; const out: Record<string, number> = {};
  for (const n of nodes) { const c = cnt[n.k] ?? 0; out[n.id] = ORDER[n.k] * 340 + c * 50; cnt[n.k] = c + 1; }
  return out;
}

interface Props {
  nodes: GNode[]; edges: GEdge[];
  focusIds: string[] | null;          // null = no focus
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  autoRotate?: boolean;
  replayToken?: number;               // change it to replay the build-in
}

export function GraphCanvas(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef(props); live.current = props;                         // newest props, no re-subscribing
  const delays = useMemo(() => revealDelays(props.nodes), [props.nodes]);
  const v = useRef({ rx: 0.4, ry: 0.7, zoom: 1, drag: false, moved: false, lx: 0, ly: 0,
    hover: null as string | null, t0: 0, focusT0: -1e9, focusKey: "all", last: 0, hits: [] as Hit[] });

  useEffect(() => { v.current.t0 = performance.now(); }, [props.nodes, props.replayToken]);

  useEffect(() => {
    const el = ref.current!; const s = v.current;
    const css = getComputedStyle(el); const g = (n: string, d: string) => css.getPropertyValue(n).trim() || d;
    const col: Colors = { ink: g("--color-text", "#201e1d"), acc: g("--color-accent", "#ec3013"), bg: g("--color-bg", "#f3f2f2"), n7: g("--color-neutral-700", "#605d5d") };
    const rect = () => el.getBoundingClientRect();
    const hitTest = (x: number, y: number) => {
      let best: Hit | null = null, bd = 1e9;
      for (const h of s.hits) { const d = Math.hypot(h.x - x, h.y - y);
        if (d < h.r + 7 && (d < bd || (best && h.z < best.z && d < bd + 6))) { bd = d; best = h; } }
      return best ? best.id : null;
    };
    const down = (e: PointerEvent) => { s.drag = true; s.moved = false; s.lx = e.clientX; s.ly = e.clientY; try { el.setPointerCapture(e.pointerId); } catch {} el.style.cursor = "grabbing"; };
    const move = (e: PointerEvent) => {
      if (s.drag) { const dx = e.clientX - s.lx, dy = e.clientY - s.ly; if (Math.abs(dx) + Math.abs(dy) > 2) s.moved = true;
        s.ry += dx * 0.008; s.rx = clamp(s.rx + dy * 0.006, -1.2, 1.2); s.lx = e.clientX; s.ly = e.clientY; }
      else { const r = rect(); s.hover = hitTest(e.clientX - r.left, e.clientY - r.top); el.style.cursor = s.hover ? "pointer" : "grab"; }
    };
    const up = (e: PointerEvent) => {
      if (s.drag && !s.moved) { const r = rect(); live.current.onSelect(hitTest(e.clientX - r.left, e.clientY - r.top)); }
      s.drag = false; el.style.cursor = s.hover ? "pointer" : "grab";
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); s.zoom = clamp(s.zoom * (e.deltaY > 0 ? 0.94 : 1.06), 0.6, 1.9); };
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
    el.addEventListener("wheel", wheel, { passive: false });

    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const p = live.current, dt = s.last ? Math.min(64, now - s.last) : 16.7; s.last = now;
      const r = rect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
      const ctx = el.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);

      const key = p.focusIds ? p.focusIds.join("|") : "all";
      if (key !== s.focusKey) { s.focusKey = key; s.focusT0 = now; }
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!s.drag && p.autoRotate !== false && !reduce) s.ry += 0.192 * dt / 1000;   // 0.0032 rad per frame at 60 fps

      const cy = Math.cos(s.ry), sy = Math.sin(s.ry), cx = Math.cos(s.rx), sx = Math.sin(s.rx);
      const S = Math.min(w, h) * 0.34 * s.zoom, ox = w / 2, oy = h / 2;
      const project = (q: readonly number[]): P4 => {
        const x1 = q[0] * cy + q[2] * sy, z1 = -q[0] * sy + q[2] * cy;
        const y2 = q[1] * cx - z1 * sx, z2 = q[1] * sx + z1 * cx, k = F / (F + z2);
        return [ox + x1 * S * k, oy + y2 * S * k, z2, k];
      };
      const act = p.focusIds ? new Set(p.focusIds) : null;

      // 1. floor grid
      ctx.strokeStyle = col.ink; ctx.lineWidth = 1;
      for (let i = -4; i <= 4; i++) { const t = i * 0.4;
        for (const [a, b] of [[[t, 1.3, -1.6], [t, 1.3, 1.6]], [[-1.6, 1.3, t], [1.6, 1.3, t]]] as const) {
          const A = project(a), B = project(b); ctx.globalAlpha = 0.07 + 0.16 * near((A[2] + B[2]) / 2);
          ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); } }

      // 2. project nodes, compute reveal
      const P: Record<string, P4> = {}, V: Record<string, number> = {};
      for (const n of p.nodes) { P[n.id] = project(n.pos); const t = (now - s.t0 - (delays[n.id] ?? 0)) / 420; V[n.id] = t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3); }

      // 3. edges
      for (const [a, b] of p.edges) {
        const A = P[a], B = P[b]; if (!A || !B) continue; const rv = Math.min(V[a], V[b]); if (rv <= 0) continue;
        const both = !!act && act.has(a) && act.has(b);
        const base = act ? (both ? 0.85 : 0.07) : 0.14 + 0.4 * near((A[2] + B[2]) / 2);
        ctx.globalAlpha = base * rv; ctx.strokeStyle = both ? col.acc : col.ink; ctx.lineWidth = both ? 1.8 : 1;
        const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, dx = B[0] - A[0], dy = B[1] - A[1];
        ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(mx - dy * 0.08, my + dx * 0.08, B[0], B[1]); ctx.stroke();
      }

      // 4. nodes, far to near
      const order = p.nodes.slice().sort((a, b) => P[b.id][2] - P[a.id][2]);
      s.hits.length = 0; const pulseT = (now - s.focusT0) / 1200;
      for (const n of order) {
        const q = P[n.id], rv = V[n.id]; if (rv <= 0) continue;
        const k = q[3], isAct = !act || act.has(n.id), sel = p.selectedId === n.id, hov = s.hover === n.id;
        const alpha = (act ? (isAct ? 1 : 0.4) : 0.55 + 0.45 * near(q[2])) * rv;
        const rad = BASE[n.k] * k * (0.4 + 0.6 * rv), hot = !!act && isAct;
        s.hits.push({ id: n.id, x: q[0], y: q[1], r: Math.max(rad, 8), z: q[2] });
        ctx.globalAlpha = alpha; ctx.lineWidth = 2.5; ctx.fillStyle = hot ? col.acc : col.ink; ctx.strokeStyle = hot ? col.acc : col.ink; ctx.beginPath();
        if (n.k === "person") { ctx.rect(q[0] - rad, q[1] - rad, rad * 2, rad * 2); ctx.fill(); }
        else if (n.k === "report") { ctx.arc(q[0], q[1], rad, 0, TAU); ctx.fillStyle = col.bg; ctx.fill(); ctx.stroke(); }
        else if (n.k === "section") { ctx.moveTo(q[0], q[1] - rad); ctx.lineTo(q[0] + rad, q[1]); ctx.lineTo(q[0], q[1] + rad); ctx.lineTo(q[0] - rad, q[1]); ctx.closePath(); ctx.fillStyle = col.bg; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
        else if (n.k === "bio") { ctx.arc(q[0], q[1], rad, 0, TAU); ctx.fill(); }
        else if (n.k === "meas") { ctx.arc(q[0], q[1], rad, 0, TAU); ctx.fillStyle = hot ? col.acc : col.n7; ctx.fill(); }
        else { ctx.setLineDash([3, 3]); ctx.arc(q[0], q[1], rad, 0, TAU); ctx.fillStyle = col.bg; ctx.fill(); ctx.strokeStyle = col.acc; ctx.stroke(); ctx.setLineDash([]); }
        if (hot && pulseT >= 0 && pulseT < 1) { ctx.globalAlpha = (1 - pulseT) * 0.8; ctx.strokeStyle = col.acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q[0], q[1], rad + 4 + pulseT * 26, 0, TAU); ctx.stroke(); }
        if (sel || hov) { ctx.globalAlpha = 1; ctx.strokeStyle = sel ? col.acc : col.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q[0], q[1], rad + 6, 0, TAU); ctx.stroke(); }
        const show = n.k !== "meas" ? (!act || isAct || sel || hov) : (sel || hov || (act ? isAct : q[2] < 0.1));
        if (show && rv > 0.6) {
          const fs = Math.max(10, 12.5 * k); ctx.font = (n.k === "report" || n.k === "person" ? "800 " : "600 ") + fs + "px Archivo, system-ui, sans-serif";
          ctx.globalAlpha = Math.max(alpha, sel || hov ? 1 : 0); ctx.lineWidth = 4; ctx.strokeStyle = col.bg; ctx.lineJoin = "round";
          const tx = q[0] + rad + 7, ty = q[1] + fs * 0.35; ctx.strokeText(n.label, tx, ty); ctx.fillStyle = hot ? col.acc : col.ink; ctx.fillText(n.label, tx, ty);
        }
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("wheel", wheel); };
  }, [delays]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "grab" }} />;
}
~~~

Usage: put it in a `position: relative` box with the 48px grid background (`linear-gradient(color-mix(in srgb, #201e1d 7%, transparent) 1px, transparent 1px)` in both directions, size 48px). Selecting a subgraph = pass its id list as `focusIds`; "All nodes" = `null`.

## A17. Rules for React specifically
1. **Never call setState inside the frame loop.** The loop reads everything from refs. Only user events call `onSelect`.
2. Subscribe to events once (the effect depends only on the delays map), and read changing props through `live.current`.
3. React 18/19 StrictMode runs effects twice in development. The cleanup above cancels the first loop, so you will not get two loops. Keep the cleanup.
4. Do not create arrays or objects inside the per-node loops if you can avoid it (allocations cause garbage-collection hitches). The code above only allocates the small `P` and `V` maps and a sorted copy per frame, which is fine for up to about 150 nodes (the repo caps at 120).
5. If the tab is hidden, `requestAnimationFrame` already pauses. Do not add timers.

## A18. Generating positions for a new graph
The hand-placed demo data came from this small 3D force layout (run it once, store the result, do not run it every frame). Nodes start at random points on a sphere; different node types are pulled toward different shell radii so the graph looks like an onion.

~~~ts
export function layout3D(nodes: { id: string; k: NodeKind }[], edges: [string, string][], iters = 1200) {
  const R: Record<NodeKind, number> = { person: 0, report: 1.0, section: 1.6, bio: 2.15, meas: 2.6, unc: 2.7 };
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;     // deterministic
  const idx: Record<string, number> = {}; nodes.forEach((n, i) => (idx[n.id] = i));
  const P = nodes.map((n) => { const u = rnd() * 2 - 1, a = rnd() * TAU, q = Math.sqrt(1 - u * u), r = R[n.k] || 0.1;
    return { x: q * Math.cos(a) * r, y: u * r, z: q * Math.sin(a) * r, vx: 0, vy: 0, vz: 0 }; });
  for (let it = 0; it < iters; it++) {
    const cool = 1 - it / iters;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {            // repulsion
      const a = P[i], b = P[j]; const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; const d2 = dx*dx + dy*dy + dz*dz + 0.01, d = Math.sqrt(d2), f = 0.16 / d2;
      a.vx += dx/d*f; a.vy += dy/d*f; a.vz += dz/d*f; b.vx -= dx/d*f; b.vy -= dy/d*f; b.vz -= dz/d*f; }
    for (const [ea, eb] of edges) {                                                         // springs, rest length 0.75
      const A = P[idx[ea]], B = P[idx[eb]]; const dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z; const d = Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.001, f = (d - 0.75) * 0.06;
      A.vx += dx/d*f; A.vy += dy/d*f; A.vz += dz/d*f; B.vx -= dx/d*f; B.vy -= dy/d*f; B.vz -= dz/d*f; }
    P.forEach((p, i) => {                                                                   // shell attraction + integrate
      const d = Math.sqrt(p.x*p.x + p.y*p.y + p.z*p.z) + 0.001, f = (R[nodes[i].k] - d) * 0.12, m = 0.06 * cool + 0.01;
      p.vx += p.x/d*f; p.vy += p.y/d*f; p.vz += p.z/d*f;
      p.x += p.vx*m; p.y += p.vy*m; p.z += p.vz*m; p.vx *= 0.55; p.vy *= 0.55; p.vz *= 0.55; });
  }
  const mx = Math.max(...P.map((p) => Math.hypot(p.x, p.y, p.z))) || 1;                    // normalise so max radius = 1
  return Object.fromEntries(nodes.map((n, i) => [n.id, [+(P[i].x / mx).toFixed(3), +(P[i].y / mx).toFixed(3), +(P[i].z / mx).toFixed(3)] as [number, number, number]]));
}
~~~
For tiny graphs (the Text to Graph tool) use the simpler **Fibonacci sphere**: for biomarker i of n, `y = 1 - 2 * (i + 0.5) / n`, `radius = sqrt(1 - y*y)`, `theta = i * 2.399963 + 0.4`, direction = `(cos(theta) * radius, y, sin(theta) * radius)`. Biomarkers at direction * 0.52, their value nodes at direction * 0.85, the document at the origin, the date at [0.05, -0.45, 0.25].

## A19. Visual acceptance checklist for the graph
1. At load the floor grid is visible and no node is. Within 0.8 s the square subject appears, then rings (reports), diamonds (sections), big dots (biomarkers), small grey dots (values), a dashed red ring last.
2. The graph turns slowly (about 11 degrees per second) and the near side is darker and bigger than the far side.
3. Drag spins it; releasing keeps auto-rotation going; the vertical tilt stops at about 69 degrees.
4. Wheel zooms between 0.6x and 1.9x.
5. Choosing "Hemoglobin trend": 7 nodes turn red, everything else drops to 40%, one red ring expands from each red node and fades within 1.2 s, only the lines between red nodes turn red.
6. Clicking a dot selects it (red ring, label forced on) and opens the detail card; clicking empty space clears it.
7. Zoom the browser to 200% and on a retina screen: edges stay crisp (DPR handling).
8. 60 fps with 23 nodes, and still smooth with 120.

---

# Part B. The cinematic ingestion show

## B1. Architecture (what to build)
One full-screen overlay containing **one canvas** plus a small DOM HUD. **One clock** drives everything. There are five stages with base durations `BASE = [8, 9, 8, 9, 8]` seconds, multiplied by a speed factor (Fast 0.5, Normal 1, Real-time 1.8, reduce-motion 0.4). Total at normal speed = 42 s.

~~~ts
const D = BASE.map(b => b * mult);
let stage = 0, acc = 0;
while (stage < 5 && t >= acc + D[stage]) { acc += D[stage]; stage++; }   // t = seconds since start
const finished = stage >= 5;
const p = finished ? 1 : (t - acc) / D[stage];       // 0..1 inside the stage
const u = finished ? 8 : p * BASE[stage];            // "authored seconds" inside the stage
~~~

**The trick:** write every animation in authored seconds `u` (as if the stage always lasted BASE seconds). When the user changes speed, only `p -> u` changes, so the choreography stretches without any other code changing.

## B2. Helpers
~~~ts
const cl = (v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const ez = (v:number)=>1-Math.pow(1-cl(v,0,1),3);            // ease-out cubic
const k = H/1000;                                             // scale everything by canvas height so it fits any screen
const L = W*0.06, RW = W*0.88, T0 = H*0.32;                   // content box: left, width, top (HUD sits above T0)
~~~
Background: fill ink; draw cream grid lines every 64*k px at 6% opacity.

## B3. What each stage draws (all positions use L, RW, T0, k)
1. **Parse (u 0 to 8)**: five cream pages, width RW*0.15, height H*0.38, evenly spaced. Page i rises in at `u = 0.3 + i*0.3` (offset (1-e)*60k, opacity e). Its scan bar sweeps top to bottom during `u in [1.2 + i*1.2, 2.2 + i*1.2]`. 14 text lines per page turn from ink 28% to accent as the bar passes (the line j is lit when `j/14 < sweep`). Page 5 (index 4) shows speckle dots, and after its sweep a red hatch and a box "NO TEXT LAYER". Counter = sum over pages of chars[i] * sweep_i with chars = [1284, 1102, 968, 1347, 0]. A ribbon under the pages fills accent by counter / 5013.
2. **OCR (u 0 to 9)**: a cream scan sheet (width RW*0.36, height H*0.56) rotated -0.018 rad, 8 grey bars as unreadable lines. A scan bar moves from 6% to 95% of the sheet height during `u in [1, 7.3]`. When it passes line i (time `1 + 6.3 * clamp((0.13 + 0.105*i - 0.06) / 0.89)`) an accent box appears around the line with a confidence tag, and the recognized text is typed on the right at 34 characters per second. Line index 5 has confidence 0.68 and is drawn in accent with "needs review". Counter = typed characters.
3. **Chunk (u 0 to 8)**: n = round(5013 / chunkSize) chunks. A ribbon at T0 gets accent cut lines; chunk cards (8 per row) drop in at `u = 0.8 + i * (5 / n)` with id, page, character span (`start = round(i * 5013 / n)`) and from u > 6 an entity count.
4. **Embed (u 0 to 9)**: a 48 by 8 grid (384 cells) fills in order during u in [0.8, 3.8]; then an n by 96 matrix fills row-major during u in [4, 8.2]. Cell value = a deterministic hash `v = fract(sin(a*127.1 + b*311.7) * 43758.5453) * 2 - 1`; positive = accent, negative = cream, alpha = 0.15 + 0.85*|v|.
5. **Index (u 0 to 8)**: three outlined boxes (collections). Only the first (accent, 5px) receives falling dots (dot i lands at `u = 0.6 + i * 2.6/n`). The other two are dashed with hatch and a "FILTERED OUT" label from u > 4.6. A cream query bar fades in at u 4, then three typed audit lines at u 5.2, 6.1, 7.0.
6. **Finished**: giant "Indexed." plus a summary line.

## B4. Syncing with React (important)
- The canvas loop runs on `requestAnimationFrame` and never uses React state.
- The HUD needs the stage number and the live counter. Write them to a ref, and call `setState` **at most every 160 ms** (a throttle). Also call it when the stage changes.
- On stage change update the pipeline list on the Upload page (Waiting, Running, Done). On finish mark the report as uploaded and enable "Open the report".
- "Skip ahead" sets the start time so that t = total + a little.
- Close the overlay = cancel the loop.

## B5. The reference implementation (verbatim, from the working prototype)
~~~js
  drawShow(now) {
    const el = this.shCv, sh = this.sh; if (!el || !sh) return;
    const r = el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    if (el.width !== Math.round(W * dpr) || el.height !== Math.round(H * dpr)) { el.width = Math.round(W * dpr); el.height = Math.round(H * dpr); }
    const x = el.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (sh.t0 == null) sh.t0 = now;
    const m = this.showMult(), BASE = [8, 9, 8, 9, 8], D = BASE.map(b => b * m), t = (now - sh.t0) / 1000;
    let st = 0, acc = 0; while (st < 5 && t >= acc + D[st]) { acc += D[st]; st++; }
    const fin = st >= 5, p = fin ? 1 : (t - acc) / D[st], u = fin ? 8 : p * BASE[st];
    sh.segP = [0, 1, 2, 3, 4].map(i => i < st ? 1 : i === st ? p : 0);
    if (st !== sh.stage) { sh.stage = st; if (!fin) { this.setState({ ingest: st, showStage: st }); this.log('stage ' + (st + 1), this.PIPE[st].name); } }
    if (fin && !sh.fin) { sh.fin = true; this.setState({ ingest: 5, busy: false, uploaded: true, showDone: true, showStage: 5 }); this.log('ingest', 'Report indexed and ready'); }
    const col = this.colors(), cr = col.bg, ink = col.ink, ac = col.acc, k = H / 1000, L = W * 0.06, RW = W * 0.88, T0 = H * 0.32;
    const cl = (v, a, b) => Math.min(b, Math.max(a, v)), ez = (v) => 1 - Math.pow(1 - cl(v, 0, 1), 3);
    const txt = (s, X, Y, sz, wt, color, al) => { x.font = wt + ' ' + (sz * k) + 'px Archivo, system-ui, sans-serif'; x.fillStyle = color; x.textAlign = al || 'left'; x.fillText(s, X, Y); };
    x.globalAlpha = 1; x.fillStyle = ink; x.fillRect(0, 0, W, H);
    x.strokeStyle = cr; x.lineWidth = 1; x.globalAlpha = 0.06;
    for (let g = 0; g < W; g += 64 * k) { x.beginPath(); x.moveTo(g, 0); x.lineTo(g, H); x.stroke(); }
    for (let g = 0; g < H; g += 64 * k) { x.beginPath(); x.moveTo(0, g); x.lineTo(W, g); x.stroke(); }
    x.globalAlpha = 1;
    const hatch = (X, Y, w, h, a) => { x.save(); x.beginPath(); x.rect(X, Y, w, h); x.clip(); x.strokeStyle = ac; x.globalAlpha = a; x.lineWidth = 3 * k; for (let g = -h; g < w; g += 16 * k) { x.beginPath(); x.moveTo(X + g, Y + h); x.lineTo(X + g + h, Y); x.stroke(); } x.restore(); x.globalAlpha = 1; };
    const nC = this.nChunks(), PC = [1284, 1102, 968, 1347, 312], TOT = 5013;
    if (st === 0) {
      const pw = RW * 0.15, gap = (RW - 5 * pw) / 4, ph = H * 0.38, y0 = T0 + H * 0.03; let got = 0;
      for (let i = 0; i < 5; i++) {
        const e = ez((u - 0.3 - i * 0.3) / 0.8), px = L + i * (pw + gap), py = y0 + (1 - e) * 60 * k, sw = cl((u - (1.2 + i * 1.2)) / 1.0, 0, 1), scan = i === 4, got1 = (scan ? 0 : PC[i]) * sw;
        x.globalAlpha = e; x.fillStyle = cr; x.fillRect(px, py, pw, ph);
        x.fillStyle = ink; x.fillRect(px + 12 * k, py + 12 * k, pw * 0.45, 10 * k);
        for (let j = 0; j < 14; j++) { const ly = py + 44 * k + j * (ph - 70 * k) / 14, lit = j / 14 < sw; x.globalAlpha = e * (lit ? 1 : 0.28); x.fillStyle = lit && !scan ? ac : ink; x.fillRect(px + 12 * k, ly, pw * (0.5 + 0.4 * Math.abs(Math.sin(j * 3.1 + i))) - 20 * k, 5 * k); }
        if (scan) { x.globalAlpha = e * 0.4; x.fillStyle = ink; for (let a = 0; a < 70; a++) x.fillRect(px + ((a * 37) % 100) / 100 * pw, py + ((a * 61) % 100) / 100 * ph, 2.5 * k, 2.5 * k); if (sw >= 1) { x.globalAlpha = e; hatch(px, py, pw, ph, 0.55); x.fillStyle = ink; x.fillRect(px + pw * 0.08, py + ph * 0.42, pw * 0.84, 40 * k); txt('NO TEXT LAYER', px + pw / 2, py + ph * 0.42 + 28 * k, 19, 800, ac, 'center'); } }
        if (sw > 0 && sw < 1) { x.globalAlpha = 1; x.fillStyle = ac; x.fillRect(px - 6 * k, py + sw * ph, pw + 12 * k, 4 * k); }
        x.globalAlpha = e; txt('p.' + (i + 1), px, py + ph + 40 * k, 30, 800, cr);
        if (sw > 0) txt(scan ? (sw >= 1 ? 'goes to OCR' : 'checking') : Math.round(got1).toLocaleString('en-US') + ' chars', px, py + ph + 74 * k, 22, 600, scan && sw >= 1 ? ac : cr);
        got += got1;
      }
      x.globalAlpha = 0.25; x.fillStyle = cr; x.fillRect(L, H * 0.88, RW, 12 * k); x.globalAlpha = 1; x.fillStyle = ac; x.fillRect(L, H * 0.88, RW * got / TOT, 12 * k);
      sh.stats = { label: 'Characters from the text layer', value: Math.round(got).toLocaleString('en-US') };
    } else if (st === 1) {
      const SW = RW * 0.36, SH = H * 0.56, OL = ['ADDENDUM — SCANNED ATTACHMENT', 'Date of collection 14 Feb 2026', 'Platelet count (manual) 245,000 /µL', 'Reference 150,000 - 450,000 /µL', 'Smear: normocytic, normochromic', 'Verified by: Lab Tech 0412', 'Remarks: no abnormal cells seen', 'End of report'], CF = [0.97, 0.96, 0.95, 0.97, 0.93, 0.68, 0.94, 0.99];
      const tl = (i) => 1.0 + 6.3 * cl(((0.13 + 0.105 * i) - 0.06) / 0.89, 0, 1); let chars = 0;
      x.save(); x.translate(L + SW / 2, T0 + SH / 2 + 10 * k); x.rotate(-0.018); x.translate(-SW / 2, -SH / 2);
      x.globalAlpha = 0.93; x.fillStyle = cr; x.fillRect(0, 0, SW, SH); x.globalAlpha = 0.35; x.fillStyle = ink; for (let a = 0; a < 260; a++) x.fillRect(((a * 53) % 100) / 100 * SW, ((a * 29) % 100) / 100 * SH, 2 * k, 2 * k);
      OL.forEach((s, i) => { const ly = SH * (0.10 + 0.105 * i), lw = Math.min(SW * 0.9, s.length * 13.5 * k), on = u >= tl(i); x.globalAlpha = 0.6; x.fillStyle = ink; x.fillRect(SW * 0.06, ly + 4 * k, lw, 16 * k); if (on) { x.globalAlpha = 1; x.strokeStyle = ac; x.lineWidth = 3 * k; x.strokeRect(SW * 0.06 - 6 * k, ly - 2 * k, lw + 12 * k, 30 * k); x.fillStyle = i === 5 ? ac : ink; x.fillRect(SW * 0.06 + lw - 36 * k, ly - 24 * k, 48 * k, 22 * k); txt(CF[i].toFixed(2), SW * 0.06 + lw - 12 * k, ly - 8 * k, 15, 800, cr, 'center'); } });
      const bf = cl((u - 1.0) / 6.3, 0, 1); if (bf > 0 && bf < 1) { x.globalAlpha = 1; x.fillStyle = ac; x.fillRect(-8 * k, SH * (0.06 + 0.89 * bf), SW + 16 * k, 5 * k); }
      x.restore(); x.globalAlpha = 1;
      const X2 = L + SW + RW * 0.06;
      OL.forEach((s, i) => { const n = Math.floor(cl((u - tl(i)) * 34, 0, s.length)); chars += n; const ry = T0 + 36 * k + i * (SH / 8.2); txt(s.slice(0, n), X2, ry, 30, 800, i === 5 ? ac : cr); if (n >= s.length) txt(i === 5 ? 'conf ' + CF[i].toFixed(2) + '  needs review' : 'conf ' + CF[i].toFixed(2), X2, ry + 26 * k, 19, 600, i === 5 ? ac : cr); });
      sh.stats = { label: 'Characters read by OCR', value: String(chars) };
    } else if (st === 2) {
      const cols = 8, rows = Math.ceil(nC / cols), gap = 14 * k, cw = (RW - 7 * gap) / cols, gt = T0 + H * 0.1, chh = Math.min(H * 0.15, (H * 0.9 - gt - (rows - 1) * gap) / rows), len = TOT / nC; let made = 0;
      x.globalAlpha = 0.9; x.fillStyle = cr; x.fillRect(L, T0, RW, 30 * k); x.globalAlpha = 0.5; x.fillStyle = ink; for (let a = 0; a < RW; a += 7 * k) x.fillRect(L + a, T0 + 6 * k, 2 * k, 18 * k);
      for (let i = 0; i < nC; i++) {
        const ti = 0.8 + i * (5 / nC), e = ez((u - ti) / 0.5), col2 = i % cols, row = Math.floor(i / cols), cx0 = L + col2 * (cw + gap), cy0 = gt + row * (chh + gap) - (1 - e) * 50 * k;
        if (e > 0) made++;
        if (i < nC - 1 && u >= ti) { x.globalAlpha = 1; x.fillStyle = ac; x.fillRect(L + RW * (i + 1) / nC - 1.5 * k, T0 - 6 * k, 3 * k, 42 * k); }
        if (e <= 0) continue;
        x.globalAlpha = e; x.fillStyle = cr; x.fillRect(cx0, cy0, cw, chh);
        const s0 = Math.round(i * len), s1 = Math.min(TOT - 1, Math.round((i + 1) * len) - 1), pg = s0 < 1284 ? 1 : s0 < 2386 ? 2 : s0 < 3354 ? 3 : s0 < 4701 ? 4 : 5;
        txt('c' + String(i + 1).padStart(2, '0'), cx0 + 12 * k, cy0 + 34 * k, 26, 800, ink); txt('p.' + pg, cx0 + cw - 12 * k, cy0 + 34 * k, 20, 800, ink, 'right'); txt(s0 + '–' + s1, cx0 + 12 * k, cy0 + 64 * k, 20, 600, ink);
        if (u > 6) { x.globalAlpha = e; txt((1 + (i * 7) % 4) + ' entities', cx0 + 12 * k, cy0 + chh - 14 * k, 19, 800, ac); }
      }
      sh.stats = { label: 'Chunks with page and character spans', value: made + ' / ' + nC };
    } else if (st === 3) {
      const cs = Math.min(RW * 0.5 / 48, H * 0.035), sx = L + RW * 0.2, nF = Math.floor(cl((u - 0.8) / 3.0, 0, 1) * 384), hv = (a, b) => { const q = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return (q - Math.floor(q)) * 2 - 1; };
      txt('c07', L, T0 + 4 * k + cs * 2.2, 54, 800, cr); txt('384 numbers', L, T0 + cs * 2.2 + 40 * k, 22, 600, cr);
      for (let i = 0; i < 384; i++) { const px = sx + (i % 48) * cs, py = T0 + Math.floor(i / 48) * cs; if (i < nF) { const v = hv(6, i); x.globalAlpha = 0.2 + 0.8 * Math.abs(v); x.fillStyle = v > 0 ? ac : cr; x.fillRect(px, py, cs - 2 * k, cs - 2 * k); } else { x.globalAlpha = 0.12; x.strokeStyle = cr; x.lineWidth = 1; x.strokeRect(px + 0.5, py + 0.5, cs - 3 * k, cs - 3 * k); } }
      const my = T0 + 8 * cs + H * 0.07, cwm = RW / 96, chm = Math.min(H * 0.022, (H * 0.9 - my) / nC), nM = Math.floor(cl((u - 4.0) / 4.2, 0, 1) * nC * 96);
      for (let rr = 0; rr < nC; rr++) for (let kk = 0; kk < 96; kk++) { const px = L + kk * cwm, py = my + rr * chm; if (rr * 96 + kk < nM) { const v = hv(rr, kk * 4); x.globalAlpha = 0.15 + 0.85 * Math.abs(v); x.fillStyle = v > 0 ? ac : cr; x.fillRect(px, py, cwm - 1, chm - 1.5); } else { x.globalAlpha = 0.08; x.fillStyle = cr; x.fillRect(px, py, cwm - 1, chm - 1.5); } }
      sh.stats = { label: 'Floats written', value: (Math.max(nF, 0) + nM * 4).toLocaleString('en-US') };
    } else if (st === 4) {
      const gap = 24 * k, bw = (RW - 2 * gap) / 3, bh = H * 0.32; let placed = 0;
      for (let b = 0; b < 3; b++) {
        const bx = L + b * (bw + gap), mine = b === 0, n = mine ? nC : 18;
        x.globalAlpha = 1; x.strokeStyle = mine ? ac : cr; x.lineWidth = (mine ? 5 : 2) * k; if (!mine) x.setLineDash([8 * k, 8 * k]); x.strokeRect(bx, T0, bw, bh); x.setLineDash([]);
        txt('user_id ' + ['VG-2026-001', 'VG-2026-014', 'VG-2026-027'][b], bx + 16 * k, T0 + 36 * k, 24, 800, mine ? ac : cr);
        const dc = Math.max(6, Math.floor((bw - 32 * k) / (34 * k)));
        for (let i = 0; i < n; i++) { const ti = 0.6 + i * (2.6 / n), e = mine ? ez((u - ti) / 0.5) : 1, dx = bx + 24 * k + (i % dc) * 34 * k, dy = T0 + 70 * k + Math.floor(i / dc) * 34 * k - (1 - e) * 120 * k; if (mine && e > 0) placed++; const hit = mine && u > 4.6 && [3, 7, 8, 14, 19].includes(i); x.globalAlpha = (mine ? e : 0.5); x.fillStyle = hit ? ac : (mine ? cr : cr); x.beginPath(); x.arc(dx, dy, hit ? 10 * k : 8 * k, 0, 6.2832); x.fill(); }
        if (!mine) { hatch(bx, T0, bw, bh, cl((u - 4.2) / 0.6, 0, 1) * 0.35); if (u > 4.6) { x.globalAlpha = 1; x.fillStyle = cr; x.fillRect(bx + 16 * k, T0 + bh - 46 * k, 190 * k, 32 * k); txt('FILTERED OUT', bx + 24 * k, T0 + bh - 23 * k, 20, 800, ink); } }
      }
      const qy = T0 + bh + 40 * k; x.globalAlpha = cl((u - 4.0) / 0.5, 0, 1); x.fillStyle = cr; x.fillRect(L, qy, RW, 52 * k); txt('query(where={"user_id": "VG-2026-001"}, n_results=5)', L + 20 * k, qy + 35 * k, 26, 800, ink);
      const AU = ['audit_log  upload.accepted       sha256 9f2c…e41a', 'audit_log  chunks.indexed        ' + nC + ' · user_id VG-2026-001', 'audit_log  embeddings.upserted   ' + nC + ' × 384']; x.globalAlpha = 1;
      AU.forEach((s2, i) => { const n = Math.floor(cl((u - (5.2 + i * 0.9)) * 40, 0, s2.length)); txt(s2.slice(0, n), L, qy + 110 * k + i * 40 * k, 24, 600, cr); });
      sh.stats = { label: 'Vectors in the user collection', value: placed + ' / ' + nC };
    } else {
      x.globalAlpha = 1; txt('Indexed.', L, H * 0.7, 230, 800, cr); txt(nC + ' chunks · ' + nC + ' × 384 vectors · scoped to VG-2026-001', L, H * 0.8, 34, 600, ac); txt('Ready for questions, the graph and the timeline.', L, H * 0.87, 28, 600, cr);
      sh.stats = { label: 'Status', value: 'Ready' };
    }
    x.globalAlpha = 1;
    if (now - sh.tick > 160) { sh.tick = now; this.setState({ showTick: Math.floor(now) }); }
  }
~~~

---

# Part C. The interactive frame stage (move or scroll to scrub)

Purpose: a large area on the Upload page that shows an image sequence (exported from a video). The pointer or the wheel moves a "playhead" through the frames.

Rules:
1. Files: `assets/frames/frame_0001.jpg` and up (4-digit, 1-based). Props: `frameCount` (default 120) and `framePath` (default `assets/frames/frame_{n}.jpg`).
2. Load frame 1 first. If it fails, show the placeholder text and do nothing else. If it works, create `Image` objects for all others (the browser fetches them in the background).
3. Target playhead `ftar` in [0, 1]: pointer x / width on pointermove, and `+= deltaY * 0.0009` on wheel (non-passive listener, preventDefault only when frames exist).
4. Current playhead eases toward the target each frame: `fcur += (ftar - fcur) * 0.14`. Redraw only when the difference is above 0.0004.
5. Frame index = `round(fcur * (count - 1))`. If that image has not finished loading, walk backwards to the nearest loaded one.
6. Draw "cover": `scale = max(W / iw, H / ih)`, centered.
7. Dropping several images onto the stage replaces the frames (sorted by name, natural order).
8. Export tip for the video: `ffmpeg -i in.mp4 -vf "fps=24,scale=1600:-1" -q:v 3 assets/frames/frame_%04d.jpg` (keep the total under about 15 MB; 60 to 150 frames is plenty).

Reference code (verbatim):
~~~js
  frameUrl(i) { return (this.props.framePath || 'assets/frames/frame_{n}.jpg').replace('{n}', String(i + 1).padStart(4, '0')); }
  loadFrames() { const N = Math.max(2, +this.props.frameCount || 120); this.frames = []; const first = new Image(); first.onload = () => { this.frames[0] = first; this.setState({ framesReady: true }); for (let i = 1; i < N; i++) { const im = new Image(); im.src = this.frameUrl(i); this.frames[i] = im; } this.fdirty = 1; }; first.onerror = () => { this.frames = null; this.setState({ framesReady: false }); }; first.src = this.frameUrl(0); }
  paintFrame() {
    const el = this.fCv; if (!el || !this.frames || !this.frames.length) return;
    let j = Math.round(this.fcur * (this.frames.length - 1)), im = this.frames[j]; while ((!im || !im.complete || !im.naturalWidth) && j > 0) { j--; im = this.frames[j]; }
    if (!im || !im.naturalWidth) return;
    const r = el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    if (el.width !== Math.round(W * dpr) || el.height !== Math.round(H * dpr)) { el.width = Math.round(W * dpr); el.height = Math.round(H * dpr); }
    const x = el.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); const sc = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * sc, h = im.naturalHeight * sc; x.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  }
  setFrameCv = (el) => {
    if (this.fCv === el) return;
    if (this.fOff) this.fOff(); this.fOff = null; this.fCv = el; if (!el) return;
    this.ftar = this.ftar || 0; this.fcur = this.fcur || 0;
    const mv = (e) => { const r = el.getBoundingClientRect(); this.ftar = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
    const wh = (e) => { if (!this.frames) return; e.preventDefault(); this.ftar = Math.min(1, Math.max(0, this.ftar + e.deltaY * 0.0009)); };
    const dov = (e) => e.preventDefault();
    const drp = (e) => { e.preventDefault(); const fs = Array.from(e.dataTransfer.files || []).filter(f => /^image\//.test(f.type)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })); if (fs.length > 1) { this.frames = fs.map(f => { const im = new Image(); im.src = URL.createObjectURL(f); return im; }); this.setState({ framesReady: true }); this.fdirty = 1; this.log('stage', fs.length + ' frames loaded'); } };
    let raf = 0; const loop = () => { raf = requestAnimationFrame(loop); const d = this.ftar - this.fcur; if (Math.abs(d) > 0.0004) { this.fcur += d * 0.14; this.paintFrame(); } else if (this.fdirty) { this.fdirty = 0; this.paintFrame(); } };
    el.addEventListener('pointermove', mv); el.addEventListener('wheel', wh, { passive: false }); el.addEventListener('dragover', dov); el.addEventListener('drop', drp);
    raf = requestAnimationFrame(loop); this.fdirty = 1; if (!this.frames) this.loadFrames();
    this.fOff = () => { cancelAnimationFrame(raf); el.removeEventListener('pointermove', mv); el.removeEventListener('wheel', wh); el.removeEventListener('dragover', dov); el.removeEventListener('drop', drp); };
  };
~~~

---

# Part D. The isometric bar charts

True isometric projection with a fixed formula. A 3D point (x, y, z) becomes a screen point:
~~~ts
const c = 0.866;                                   // cos 30 degrees
const P = (x:number, y:number, z:number) => [ox + (x - y) * c, oy + (x + y) * 0.5 - z];
~~~
The chart is a floor (a parallelogram), a back wall and a left wall, a translucent band between the reference-range minimum and maximum on both walls, 8 vertical grid lines on the floor, and one box per report. Each box has three polygons: **top (lightest), front (base color), right side (darkest)**. Highlight the latest bar in accent (top accent-400, front accent, side accent-700), others neutral (400, 700, 900). Bar height = `min(1, value / axisMax) * 120`. The value label and date label are **HTML elements positioned with percentages** over the SVG (`left = x / 400 * 100%`, `top = y / 320 * 100%`), because SVG text breaks in some wrappers. The full `iso()` function is in LOCAL_AI_BUILD_GUIDE.md section 7; copy it as is.

---

# Part E. Graph analytics

**Betweenness centrality (Brandes, unweighted, undirected)** for the Insights page; normalise by (n - 1)(n - 2) (not divided by 2 again; the code divides the raw sum by n-1 times n-2 after the usual undirected handling used in the prototype). Reference:
~~~ts
function betweenness(ids: string[], edges: [string, string][]) {
  const n = ids.length, idx = new Map(ids.map((id, i) => [id, i])), adj: number[][] = ids.map(() => []);
  for (const [a, b] of edges) { adj[idx.get(a)!].push(idx.get(b)!); adj[idx.get(b)!].push(idx.get(a)!); }
  const C = new Array(n).fill(0);
  for (let s = 0; s < n; s++) {
    const S: number[] = [], Pp: number[][] = ids.map(() => []), sig = new Array(n).fill(0), d = new Array(n).fill(-1);
    sig[s] = 1; d[s] = 0; const Q = [s];
    while (Q.length) { const v = Q.shift()!; S.push(v); for (const w of adj[v]) { if (d[w] < 0) { d[w] = d[v] + 1; Q.push(w); } if (d[w] === d[v] + 1) { sig[w] += sig[v]; Pp[w].push(v); } } }
    const del = new Array(n).fill(0);
    while (S.length) { const w = S.pop()!; for (const v of Pp[w]) del[v] += (sig[v] / sig[w]) * (1 + del[w]); if (w !== s) C[w] += del[w]; }
  }
  const norm = (n - 1) * (n - 2);
  return ids.map((id, i) => ({ id, value: C[i] / norm })).sort((a, b) => b.value - a.value);
}
~~~

---

# Part F. How to drive a small local model through this (step by step)

Small models fail when given the whole job. Give **one task at a time**, each with an acceptance test, and paste only the relevant section of this guide with it.

1. **Task 1: projection only.** Paste A2 to A5. Ask for a pure function `project(p, ry, rx, S, ox, oy)` and a unit test that reproduces the table in A5 within 0.002. Do not continue until the test passes.
2. **Task 2: static picture.** Paste A6 to A11 and the types. Draw the grid, edges and nodes with ry = 0.7, rx = 0.4 and no animation. Compare with a screenshot of the reference (shapes, sizes, label halos).
3. **Task 3: reveal animation.** Paste A12. Add `nowMs`, delays and the 420 ms ease-out. Acceptance: at 100 ms only the subject exists; at 2.3 s everything is visible.
4. **Task 4: rotation and pointer.** Paste A14, A15. Acceptance: items 3 and 4 and 7 of A19.
5. **Task 5: focus and pulse.** Paste A13. Acceptance: items 5 and 6 of A19.
6. **Task 6: React wrapper.** Paste A16 and A17. Acceptance: no setState in the loop; StrictMode does not double the speed.
7. **Task 7: layouts.** Paste A18 for the Text to Graph tool.
8. **Task 8: the ingestion show.** Paste Part B and the reference code. Build stage by stage (Parse, then OCR, and so on), checking each against the description before the next.
9. **Task 9: frame stage.** Paste Part C.
10. **Task 10: charts.** Paste Part D and the iso() code.

Prompt template for each task:
> You are porting an existing design. Do not redesign. Do not add libraries. Implement ONLY the task below, in TypeScript, in the file I name. Use these exact constants and formulas. When finished, run the acceptance test and show the output. If a number differs from the table, fix the code, not the table.

---

# Part G. Common mistakes (each one changes the look)
1. Using three.js, d3-force or SVG for the graph. The look comes from the exact formulas above.
2. Swapping yaw and pitch, or using the wrong sign in `z1`.
3. Sorting nodes near-to-far (the near nodes then get hidden). It must be far first.
4. Forgetting the label halo: labels become unreadable on lines.
5. Forgetting DPR handling: a blurry graph.
6. Calling setState or React state in the frame loop: the graph stutters.
7. Auto-rotating by a fixed amount per frame on 120 Hz screens: it spins twice as fast. Use delta time.
8. Using a passive wheel listener: the page scrolls while zooming.
9. Changing the focus without resetting the pulse start time: no ring appears.
10. Writing animation times in real seconds in the show: changing speed then breaks the timing. Use authored seconds `u`.
11. Putting SVG `<text>` inside a wrapper that re-wraps text: labels collapse to one corner. Use HTML labels over the SVG.
12. Rounded corners, gradients, extra shadows or purple anywhere: forbidden by the design system.
