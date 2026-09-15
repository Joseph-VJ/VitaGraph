import { useEffect, useRef } from "react";

/**
 * ForceGraph - dependency-free force-directed graph canvas.
 * Low-end friendly: DPR capped, repulsion cutoff, fixed-step physics,
 * label culling, ambient motion skipped under prefers-reduced-motion.
 * Auto-sizes to its container (ResizeObserver); props width/height are
 * only fallbacks for the initial frame.
 */

export interface ForceGraphNodeInput {
  id: string;
  label?: string;
  color: string;
  r: number;
  active?: boolean;
  importance?: number;
}

export interface ForceGraphEdgeInput {
  source: number; // index into nodes array
  target: number;
  weight?: number;
}

interface SimNode extends ForceGraphNodeInput {
  x: number;
  y: number;
  vx: number;
  vy: number;
  revealed: boolean;
}

interface SimState {
  nodes: SimNode[];
  edges: ForceGraphEdgeInput[];
  cam: { x: number; y: number; k: number };
  alpha: number;
  dragNode: SimNode | null;
  panning: boolean;
  lastPan: { x: number; y: number } | null;
  hover: SimNode | null;
  raf: number;
  revealIdx: number;
  revealTimer: number | null;
}

const REPULSION = 2600;
const REPULSION_CUTOFF = 240; // px - skip long-range repulsion (CPU saver)
const SPRING_REST = 95;
const SPRING_K = 0.02;
const GRAVITY = 0.0016;
const DAMPING = 0.86;
const STEP_MS = 33;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function ForceGraph({
  nodes,
  edges,
  width = 740,
  height = 420,
  theme = "light",
  ambient = true,
  revealMs = 600,
  curve = 0.16,
  className = "",
  onHoverChange,
}: {
  nodes: ForceGraphNodeInput[];
  edges: ForceGraphEdgeInput[];
  width?: number;
  height?: number;
  theme?: "light" | "dark";
  ambient?: boolean;
  revealMs?: number;
  curve?: number;
  className?: string;
  onHoverChange?: (node: ForceGraphNodeInput | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<SimState | null>(null);
  const sizeRef = useRef<{ w: number; h: number }>({ w: width, h: height });
  const hoverCbRef = useRef(onHoverChange);
  hoverCbRef.current = onHoverChange;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Resize the backing store to the container and keep world dims in sync.
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width || width));
      const h = Math.max(1, Math.round(rect.height || height));
      sizeRef.current = { w, h };
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
    };
    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(wrap);

    // Preserve positions of nodes that already exist (continuity across rebuilds)
    const prev = stateRef.current;
    const prevById = new Map<string, SimNode>();
    if (prev) prev.nodes.forEach((n) => prevById.set(n.id, n));

    const simNodes: SimNode[] = nodes.map((n, i) => {
      const old = prevById.get(n.id);
      if (old) {
        return { ...n, x: old.x, y: old.y, vx: 0, vy: 0, revealed: old.revealed };
      }
      const w = sizeRef.current.w;
      const h = sizeRef.current.h;
      const ang = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      const rad = Math.min(w, h) * 0.34 * (0.45 + Math.random() * 0.55);
      return {
        ...n,
        x: w / 2 + Math.cos(ang) * rad,
        y: h / 2 + Math.sin(ang) * rad,
        vx: 0,
        vy: 0,
        revealed: false,
      };
    });

    const st: SimState = {
      nodes: simNodes,
      edges,
      cam: prev ? prev.cam : { x: 0, y: 0, k: 1 },
      alpha: 1,
      dragNode: null,
      panning: false,
      lastPan: null,
      hover: null,
      raf: 0,
      revealIdx: 0,
      revealTimer: null,
    };
    stateRef.current = st;

    if (revealMs > 0) {
      const per = Math.max(8, Math.floor(revealMs / Math.max(1, simNodes.length)));
      st.revealTimer = window.setInterval(() => {
        if (st.revealIdx < st.nodes.length) {
          st.nodes[st.revealIdx].revealed = true;
          st.revealIdx++;
        } else if (st.revealTimer !== null) {
          window.clearInterval(st.revealTimer);
          st.revealTimer = null;
        }
      }, per);
    } else {
      simNodes.forEach((n) => (n.revealed = true));
    }

    const edgeStroke = (hi: boolean) =>
      theme === "dark"
        ? hi
          ? "rgba(147,197,253,0.75)"
          : "rgba(148,163,184,0.22)"
        : hi
        ? "rgba(37,99,235,0.45)"
        : "rgba(148,163,184,0.4)";
    const labelColor = (focus: boolean, active: boolean) =>
      theme === "dark"
        ? focus && active
          ? "#FFFFFF"
          : "#DDE6F2"
        : active
        ? "#1E3A8A"
        : "#0F172A";

    const step = () => {
      const N = st.nodes;
      const a = st.alpha;
      const { w, h } = sizeRef.current;
      if (N.length === 0) return;
      for (let i = 0; i < N.length; i++) {
        const p = N[i];
        if (!p.revealed) continue;
        for (let j = i + 1; j < N.length; j++) {
          const q = N[j];
          if (!q.revealed) continue;
          let dx = p.x - q.x;
          let dy = p.y - q.y;
          let d2 = dx * dx + dy * dy;
          if (d2 > REPULSION_CUTOFF * REPULSION_CUTOFF) continue;
          if (d2 < 1) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d2 = 1;
          }
          const d = Math.sqrt(d2);
          const f = (REPULSION * a * (p.r + q.r)) / d2;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          p.vx += fx;
          p.vy += fy;
          q.vx -= fx;
          q.vy -= fy;
        }
        p.vx += (w / 2 - p.x) * GRAVITY * a;
        p.vy += (h / 2 - p.y) * GRAVITY * a;
      }
      for (const e of st.edges) {
        const s = st.nodes[e.source];
        const t = st.nodes[e.target];
        if (!s || !t || !s.revealed || !t.revealed) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const wt = Math.min(e.weight ?? 1, 4);
        const f = (d - SPRING_REST) * SPRING_K * a * (wt / 2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      }
      for (const n of N) {
        if (!n.revealed) continue;
        if (n === st.dragNode) continue;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += clamp(n.vx, -8, 8);
        n.y += clamp(n.vy, -8, 8);
        if (!reduced && ambient && st.alpha < 0.1) {
          n.vx += (Math.random() - 0.5) * 0.06;
          n.vy += (Math.random() - 0.5) * 0.06;
        }
        if (n.x < n.r) { n.x = n.r; n.vx *= -0.5; }
        if (n.x > w - n.r) { n.x = w - n.r; n.vx *= -0.5; }
        if (n.y < n.r) { n.y = n.r; n.vy *= -0.5; }
        if (n.y > h - n.r) { n.y = h - n.r; n.vy *= -0.5; }
      }
      st.alpha = Math.max(0.02, st.alpha * 0.994);
    };

    const render = () => {
      const { w, h } = sizeRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(st.cam.k * dpr, st.cam.k * dpr);
      ctx.translate(-w / 2 + st.cam.x, -h / 2 + st.cam.y);

      const focus = st.hover;
      const neighborSet = new Set<string>();
      if (focus) {
        neighborSet.add(focus.id);
        for (const e of st.edges) {
          if (st.nodes[e.source] === focus) neighborSet.add(st.nodes[e.target].id);
          if (st.nodes[e.target] === focus) neighborSet.add(st.nodes[e.source].id);
        }
      }

      for (const e of st.edges) {
        const s = st.nodes[e.source];
        const t = st.nodes[e.target];
        if (!s || !t || !s.revealed || !t.revealed) continue;
        const hi = focus ? neighborSet.has(s.id) && neighborSet.has(t.id) : false;
        if (focus && !hi) continue;
        const mx = (s.x + t.x) / 2;
        const my = (s.y + t.y) / 2;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const off = clamp(d * curve, -36, 36);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.quadraticCurveTo(mx - (dy / d) * off, my + (dx / d) * off, t.x, t.y);
        ctx.strokeStyle = edgeStroke(hi);
        ctx.lineWidth = hi ? 1.8 : 0.8 + Math.min(e.weight ?? 1, 5) * 0.2;
        ctx.stroke();
      }

      for (const n of st.nodes) {
        if (!n.revealed) continue;
        const dimmed = focus ? !neighborSet.has(n.id) : false;
        if (focus && !dimmed && n !== focus) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2);
          ctx.fillStyle = n.color + "33";
          ctx.fill();
        }
        if (n.active) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 7, 0, Math.PI * 2);
          ctx.fillStyle = theme === "dark" ? "rgba(96,165,250,0.22)" : "rgba(37,99,235,0.18)";
          ctx.fill();
        }
        ctx.globalAlpha = dimmed ? 0.25 : n === focus ? 1 : 0.92;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();
        ctx.lineWidth = n === focus ? 2.2 : 1.1;
        ctx.strokeStyle = theme === "dark" ? "rgba(255,255,255,0.4)" : "#FFFFFF";
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const sorted = st.nodes
        .filter((n) => n.revealed && (n.label || n.active || n === focus))
        .sort((x, y) => (y.importance ?? 0) - (x.importance ?? 0));
      const labelSet = new Set<SimNode>();
      for (const n of sorted) {
        if (labelSet.size >= 30) break;
        labelSet.add(n);
      }
      if (focus) labelSet.add(focus);
      for (const e of st.edges) {
        if (!focus) break;
        if (st.nodes[e.source] === focus) labelSet.add(st.nodes[e.target]);
        if (st.nodes[e.target] === focus) labelSet.add(st.nodes[e.source]);
      }
      labelSet.forEach((n) => {
        if (!n.label) return;
        const dimmed = focus ? !neighborSet.has(n.id) : false;
        const size = clamp(8 + n.r * 0.62, 9, 19);
        ctx.font = `${n === focus || n.active ? "700" : "600"} ${size}px 'Plus Jakarta Sans','Inter',sans-serif`;
        ctx.globalAlpha = dimmed ? 0.15 : n === focus ? 1 : 0.85;
        ctx.fillStyle = labelColor(n === focus, n.active || n === focus);
        ctx.shadowColor = theme === "dark" ? "rgba(5,9,18,0.9)" : "rgba(255,255,255,0.9)";
        ctx.shadowBlur = 4;
        ctx.fillText(n.label, n.x, n.y - n.r - size * 0.7 - 3);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      });

      ctx.restore();
    };

    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const { w, h } = sizeRef.current;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      return {
        x: (px - w / 2) / st.cam.k + w / 2 - st.cam.x,
        y: (py - h / 2) / st.cam.k + h / 2 - st.cam.y,
      };
    };
    const hitTest = (wx: number, wy: number) => {
      for (let i = st.nodes.length - 1; i >= 0; i--) {
        const n = st.nodes[i];
        if (!n.revealed) continue;
        const dx = n.x - wx;
        const dy = n.y - wy;
        const rr = Math.max(12, n.r + 5);
        if (dx * dx + dy * dy <= rr * rr) return n;
      }
      return null;
    };
    const onDown = (ev: PointerEvent) => {
      const p = toWorld(ev.clientX, ev.clientY);
      const hit = hitTest(p.x, p.y);
      if (hit) {
        st.dragNode = hit;
        st.alpha = Math.max(st.alpha, 0.3);
      } else {
        st.panning = true;
        st.lastPan = { x: ev.clientX, y: ev.clientY };
      }
      try {
        canvas.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    };
    const onMove = (ev: PointerEvent) => {
      const p = toWorld(ev.clientX, ev.clientY);
      if (st.dragNode) {
        st.dragNode.x = p.x;
        st.dragNode.y = p.y;
        st.dragNode.vx = 0;
        st.dragNode.vy = 0;
        return;
      }
      if (st.panning && st.lastPan) {
        st.cam.x += (ev.clientX - st.lastPan.x) / st.cam.k;
        st.cam.y += (ev.clientY - st.lastPan.y) / st.cam.k;
        st.lastPan = { x: ev.clientX, y: ev.clientY };
        return;
      }
      const hit = hitTest(p.x, p.y);
      if (hit !== st.hover) {
        st.hover = hit;
        hoverCbRef.current?.(hit ?? null);
      }
      canvas.style.cursor = hit ? "pointer" : "grab";
    };
    const onUp = () => {
      st.dragNode = null;
      st.panning = false;
      st.lastPan = null;
    };
    const onLeave = () => {
      if (st.hover) {
        st.hover = null;
        hoverCbRef.current?.(null);
      }
      onUp();
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      st.cam.k = clamp(st.cam.k * (ev.deltaY < 0 ? 1.1 : 0.9), 0.5, 2.5);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    let last = performance.now();
    let acc = 0;
    const loop = () => {
      const now = performance.now();
      acc += now - last;
      last = now;
      let steps = 0;
      while (acc >= STEP_MS && steps < 3) {
        step();
        acc -= STEP_MS;
        steps++;
      }
      if (acc > STEP_MS * 3) acc = 0;
      render();
      st.raf = requestAnimationFrame(loop);
    };
    st.raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(st.raf);
      if (st.revealTimer !== null) window.clearInterval(st.revealTimer);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, theme, ambient, revealMs, curve]);

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        className={className}
        style={{ display: "block", cursor: "grab" }}
      />
    </div>
  );
}
