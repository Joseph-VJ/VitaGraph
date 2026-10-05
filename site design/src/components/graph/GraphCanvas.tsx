import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import type { NodeKind } from "./layout3d";

export type { NodeKind };

export interface GNode {
  id: string;
  k: NodeKind;
  label: string;
  pos: [number, number, number];
}

export type GEdge = [string, string];

const F = 3.4;
const ORDER: Record<NodeKind, number> = {
  person: 0,
  report: 1,
  section: 2,
  bio: 3,
  meas: 4,
  unc: 5,
};
const BASE: Record<NodeKind, number> = {
  person: 11,
  report: 12,
  section: 7,
  bio: 9,
  meas: 5,
  unc: 9,
};
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const near = (z: number) => clamp(1 - (z + 1.2) / 2.4, 0, 1);

type P4 = [number, number, number, number]; // sx, sy, z2, k
interface Hit {
  id: string;
  x: number;
  y: number;
  r: number;
  z: number;
}
interface Colors {
  ink: string;
  acc: string;
  bg: string;
  n7: string;
}

export function revealDelays(nodes: GNode[]): Record<string, number> {
  const cnt: Partial<Record<NodeKind, number>> = {};
  const out: Record<string, number> = {};
  for (const n of nodes) {
    const c = cnt[n.k] ?? 0;
    out[n.id] = ORDER[n.k] * 340 + c * 50;
    cnt[n.k] = c + 1;
  }
  return out;
}

export interface GraphCanvasHandle {
  replay: () => void;
}

export interface GraphCanvasProps {
  nodes: GNode[];
  edges: GEdge[];
  focusIds: string[] | null; // null = no focus
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  autoRotate?: boolean;
  reducedMotion?: boolean;
  replayToken?: number;
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(
  function GraphCanvas(props, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const live = useRef(props);
    live.current = props;

    const delays = useMemo(() => revealDelays(props.nodes), [props.nodes]);
    const v = useRef({
      rx: 0.4,
      ry: 0.7,
      zoom: 1,
      drag: false,
      moved: false,
      lx: 0,
      ly: 0,
      hover: null as string | null,
      t0: 0,
      focusT0: -1e9,
      focusKey: "all",
      last: 0,
      hits: [] as Hit[],
    });

    useImperativeHandle(ref, () => ({
      replay: () => {
        v.current.t0 = performance.now();
      },
    }));

    useEffect(() => {
      v.current.t0 = performance.now();
    }, [props.nodes, props.replayToken]);

    useEffect(() => {
      const el = canvasRef.current;
      if (!el) return;
      const s = v.current;

      const css = getComputedStyle(el);
      const g = (n: string) => css.getPropertyValue(n).trim();
      const col: Colors = {
        ink: g("--color-text") || "currentColor",
        acc: g("--color-accent") || "currentColor",
        bg: g("--color-bg") || "transparent",
        n7: g("--color-neutral-700") || "gray",
      };

      const rect = () => el.getBoundingClientRect();
      const hitTest = (x: number, y: number) => {
        let best: Hit | null = null;
        let bd = 1e9;
        for (const h of s.hits) {
          const d = Math.hypot(h.x - x, h.y - y);
          if (d < h.r + 7 && (d < bd || (best && h.z < best.z && d < bd + 6))) {
            bd = d;
            best = h;
          }
        }
        return best ? best.id : null;
      };

      const down = (e: PointerEvent) => {
        s.drag = true;
        s.moved = false;
        s.lx = e.clientX;
        s.ly = e.clientY;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {}
        el.style.cursor = "grabbing";
      };

      const move = (e: PointerEvent) => {
        if (s.drag) {
          const dx = e.clientX - s.lx;
          const dy = e.clientY - s.ly;
          if (Math.abs(dx) + Math.abs(dy) > 2) s.moved = true;
          s.ry += dx * 0.008;
          s.rx = clamp(s.rx + dy * 0.006, -1.2, 1.2);
          s.lx = e.clientX;
          s.ly = e.clientY;
        } else {
          const r = rect();
          s.hover = hitTest(e.clientX - r.left, e.clientY - r.top);
          el.style.cursor = s.hover ? "pointer" : "grab";
        }
      };

      const up = (e: PointerEvent) => {
        if (s.drag && !s.moved) {
          const r = rect();
          live.current.onSelect(hitTest(e.clientX - r.left, e.clientY - r.top));
        }
        s.drag = false;
        el.style.cursor = s.hover ? "pointer" : "grab";
      };

      const wheel = (e: WheelEvent) => {
        e.preventDefault();
        s.zoom = clamp(s.zoom * (e.deltaY > 0 ? 0.94 : 1.06), 0.6, 1.9);
      };

      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("wheel", wheel, { passive: false });

      const ro = new ResizeObserver(() => {
        // Triggers canvas resize if needed on parent bounds change
      });
      ro.observe(el);

      let raf = 0;
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const p = live.current;
        const dt = s.last ? Math.min(64, now - s.last) : 16.7;
        s.last = now;

        const r = rect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(r.width));
        const h = Math.max(1, Math.round(r.height));
        if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
          el.width = Math.round(w * dpr);
          el.height = Math.round(h * dpr);
        }

        const ctx = el.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const key = p.focusIds ? p.focusIds.slice().sort().join("|") : "all";
        if (key !== s.focusKey) {
          s.focusKey = key;
          s.focusT0 = now;
        }

        const reduce =
          p.reducedMotion ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!s.drag && p.autoRotate !== false && !reduce) {
          s.ry += (0.192 * dt) / 1000; // 0.0032 rad per frame at 60 fps
        }

        const cy = Math.cos(s.ry);
        const sy = Math.sin(s.ry);
        const cx = Math.cos(s.rx);
        const sx = Math.sin(s.rx);
        const S = Math.min(w, h) * 0.34 * s.zoom;
        const ox = w / 2;
        const oy = h / 2;

        const project = (q: readonly number[]): P4 => {
          const x1 = q[0] * cy + q[2] * sy;
          const z1 = -q[0] * sy + q[2] * cy;
          const y2 = q[1] * cx - z1 * sx;
          const z2 = q[1] * sx + z1 * cx;
          const k = F / (F + z2);
          return [ox + x1 * S * k, oy + y2 * S * k, z2, k];
        };

        const act = p.focusIds ? new Set(p.focusIds) : null;

        // 1. floor grid
        ctx.strokeStyle = col.ink;
        ctx.lineWidth = 1;
        for (let i = -4; i <= 4; i++) {
          const t = i * 0.4;
          for (const [a, b] of [
            [
              [t, 1.3, -1.6],
              [t, 1.3, 1.6],
            ],
            [
              [-1.6, 1.3, t],
              [1.6, 1.3, t],
            ],
          ] as const) {
            const A = project(a);
            const B = project(b);
            ctx.globalAlpha = 0.07 + 0.16 * near((A[2] + B[2]) / 2);
            ctx.beginPath();
            ctx.moveTo(A[0], A[1]);
            ctx.lineTo(B[0], B[1]);
            ctx.stroke();
          }
        }

        // 2. project nodes, compute reveal
        const P: Record<string, P4> = {};
        const V: Record<string, number> = {};
        const revealDuration = reduce ? 120 : 420;
        for (const n of p.nodes) {
          P[n.id] = project(n.pos);
          const t = (now - s.t0 - (delays[n.id] ?? 0)) / revealDuration;
          V[n.id] = t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
        }

        // 3. edges
        for (const [a, b] of p.edges) {
          const A = P[a];
          const B = P[b];
          if (!A || !B) continue;
          const rv = Math.min(V[a], V[b]);
          if (rv <= 0) continue;
          const both = !!act && act.has(a) && act.has(b);
          const base = act
            ? both
              ? 0.85
              : 0.07
            : 0.14 + 0.4 * near((A[2] + B[2]) / 2);
          ctx.globalAlpha = base * rv;
          ctx.strokeStyle = both ? col.acc : col.ink;
          ctx.lineWidth = both ? 1.8 : 1;
          const mx = (A[0] + B[0]) / 2;
          const my = (A[1] + B[1]) / 2;
          const dx = B[0] - A[0];
          const dy = B[1] - A[1];
          ctx.beginPath();
          ctx.moveTo(A[0], A[1]);
          ctx.quadraticCurveTo(mx - dy * 0.08, my + dx * 0.08, B[0], B[1]);
          ctx.stroke();
        }

        // 4. nodes, far to near
        const order = p.nodes.slice().sort((a, b) => P[b.id][2] - P[a.id][2]);
        s.hits.length = 0;
        const pulseT = (now - s.focusT0) / 1200;

        for (const n of order) {
          const q = P[n.id];
          const rv = V[n.id];
          if (rv <= 0) continue;
          const k = q[3];
          const isAct = !act || act.has(n.id);
          const sel = p.selectedId === n.id;
          const hov = s.hover === n.id;
          const alpha = (act ? (isAct ? 1 : 0.4) : 0.55 + 0.45 * near(q[2])) * rv;
          const rad = BASE[n.k] * k * (0.4 + 0.6 * rv);
          const hot = !!act && isAct;

          s.hits.push({
            id: n.id,
            x: q[0],
            y: q[1],
            r: Math.max(rad, 8),
            z: q[2],
          });

          ctx.globalAlpha = alpha;
          ctx.lineWidth = 2.5;
          ctx.fillStyle = hot ? col.acc : col.ink;
          ctx.strokeStyle = hot ? col.acc : col.ink;
          ctx.beginPath();

          if (n.k === "person") {
            ctx.rect(q[0] - rad, q[1] - rad, rad * 2, rad * 2);
            ctx.fill();
          } else if (n.k === "report") {
            ctx.arc(q[0], q[1], rad, 0, TAU);
            ctx.fillStyle = col.bg;
            ctx.fill();
            ctx.stroke();
          } else if (n.k === "section") {
            ctx.moveTo(q[0], q[1] - rad);
            ctx.lineTo(q[0] + rad, q[1]);
            ctx.lineTo(q[0], q[1] + rad);
            ctx.lineTo(q[0] - rad, q[1]);
            ctx.closePath();
            ctx.fillStyle = col.bg;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (n.k === "bio") {
            ctx.arc(q[0], q[1], rad, 0, TAU);
            ctx.fill();
          } else if (n.k === "meas") {
            ctx.arc(q[0], q[1], rad, 0, TAU);
            ctx.fillStyle = hot ? col.acc : col.n7;
            ctx.fill();
          } else {
            // unc
            ctx.setLineDash([3, 3]);
            ctx.arc(q[0], q[1], rad, 0, TAU);
            ctx.fillStyle = col.bg;
            ctx.fill();
            ctx.strokeStyle = col.acc;
            ctx.stroke();
            ctx.setLineDash([]);
          }

          if (hot && pulseT >= 0 && pulseT < 1) {
            ctx.globalAlpha = (1 - pulseT) * 0.8;
            ctx.strokeStyle = col.acc;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(q[0], q[1], rad + 4 + pulseT * 26, 0, TAU);
            ctx.stroke();
          }

          if (sel || hov) {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = sel ? col.acc : col.ink;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(q[0], q[1], rad + 6, 0, TAU);
            ctx.stroke();
          }

          const show =
            n.k !== "meas"
              ? !act || isAct || sel || hov
              : sel || hov || (act ? isAct : q[2] < 0.1);

          if (show && rv > 0.6) {
            const fs = Math.max(10, 12.5 * k);
            ctx.font =
              (n.k === "report" || n.k === "person" ? "800 " : "600 ") +
              fs +
              "px Archivo, system-ui, sans-serif";
            ctx.globalAlpha = Math.max(alpha, sel || hov ? 1 : 0);
            ctx.lineWidth = 4;
            ctx.strokeStyle = col.bg;
            ctx.lineJoin = "round";
            const tx = q[0] + rad + 7;
            const ty = q[1] + fs * 0.35;
            ctx.strokeText(n.label, tx, ty);
            ctx.fillStyle = hot ? col.acc : col.ink;
            ctx.fillText(n.label, tx, ty);
          }
        }
        ctx.globalAlpha = 1;
      };

      raf = requestAnimationFrame(frame);
      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        el.removeEventListener("pointerdown", down);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("wheel", wheel);
      };
    }, [delays]);

    return (
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "none",
          cursor: "grab",
        }}
      />
    );
  }
);
