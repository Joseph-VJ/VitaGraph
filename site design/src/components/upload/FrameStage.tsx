import React, { useEffect, useRef, useState } from "react";

interface FrameStageProps {
  /** URL pattern; {n} becomes a 4-digit frame number starting at 0001. */
  framePath?: string;
  frameCount?: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const FrameStage: React.FC<FrameStageProps> = ({
  framePath = "/assets/frames/frame_{n}.jpg",
  frameCount = 120,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = Math.max(2, frameCount);
    const frameUrl = (i: number) => framePath.replace("{n}", String(i + 1).padStart(4, "0"));

    let frames: HTMLImageElement[] | null = null;
    let objectUrls: string[] = [];
    let target = 0;
    let current = 0;
    let dirty = true;
    let raf = 0;
    let disposed = false;

    const paint = () => {
      if (!frames || frames.length === 0) return;
      let j = Math.round(current * (frames.length - 1));
      let im: HTMLImageElement | undefined = frames[j];
      while ((!im || !im.complete || !im.naturalWidth) && j > 0) {
        j -= 1;
        im = frames[j];
      }
      if (!im || !im.naturalWidth) return;
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(1, Math.round(rect.width));
      const H = Math.max(1, Math.round(rect.height));
      if (el.width !== Math.round(W * dpr) || el.height !== Math.round(H * dpr)) {
        el.width = Math.round(W * dpr);
        el.height = Math.round(H * dpr);
      }
      const ctx = el.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(W / im.naturalWidth, H / im.naturalHeight);
      const w = im.naturalWidth * scale;
      const h = im.naturalHeight * scale;
      ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    };

    const step = () => {
      raf = 0;
      const d = target - current;
      if (Math.abs(d) > 0.0004) {
        current += reduce ? d : d * 0.14;
        paint();
        raf = requestAnimationFrame(step);
      } else if (dirty) {
        dirty = false;
        paint();
      }
    };
    const kick = () => {
      if (!raf && !disposed) raf = requestAnimationFrame(step);
    };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target = clamp01((e.clientX - r.left) / r.width);
      kick();
    };
    const onWheel = (e: WheelEvent) => {
      if (!frames) return;
      e.preventDefault();
      target = clamp01(target + e.deltaY * 0.0009);
      kick();
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? [])
        .filter((f) => /^image\//.test(f.type))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      if (files.length < 2) return;
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
      objectUrls = files.map((f) => URL.createObjectURL(f));
      frames = objectUrls.map((u) => {
        const im = new Image();
        im.onload = () => {
          dirty = true;
          kick();
        };
        im.src = u;
        return im;
      });
      setReady(true);
      dirty = true;
      kick();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);

    const ro = new ResizeObserver(() => {
      dirty = true;
      kick();
    });
    ro.observe(el);

    // Probe frame 1 quietly via HEAD; only if it exists, request the images.
    let probeCancelled = false;
    fetch(frameUrl(0), { method: "HEAD" })
      .then((res) => {
        if (probeCancelled || disposed || !res.ok) {
          if (!probeCancelled && !disposed) {
            frames = null;
            setReady(false);
          }
          return;
        }
        const first = new Image();
        first.onload = () => {
          if (probeCancelled || disposed) return;
          const list: HTMLImageElement[] = [first];
          for (let i = 1; i < count; i += 1) {
            const im = new Image();
            im.onload = () => {
              dirty = true;
              kick();
            };
            im.src = frameUrl(i);
            list.push(im);
          }
          frames = list;
          setReady(true);
          dirty = true;
          kick();
        };
        first.onerror = () => {
          if (probeCancelled || disposed) return;
          frames = null;
          setReady(false);
        };
        first.src = frameUrl(0);
      })
      .catch(() => {
        if (!probeCancelled && !disposed) {
          frames = null;
          setReady(false);
        }
      });

    return () => {
      disposed = true;
      probeCancelled = true;
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
      ro.disconnect();
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [framePath, frameCount]);

  return (
    <div
      style={{
        position: "relative", width: "100%", height: "min(74vh,760px)", minHeight: 420,
        background: "var(--color-surface)", border: "2px solid var(--color-divider)", overflow: "hidden",
        backgroundImage:
          "repeating-linear-gradient(45deg,color-mix(in srgb,var(--color-text) 6%,transparent) 0 8px,transparent 8px 20px)",
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Interactive frame stage"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", cursor: "ew-resize" }}
      />
      {!ready && (
        <div
          style={{
            position: "absolute", left: 0, right: 0, bottom: 0, padding: "var(--space-6)", display: "flex",
            flexDirection: "column", gap: "var(--space-1)", pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>
            Interactive stage
          </span>
          <span style={{ fontSize: "1rem", fontWeight: 600 }}>
            Frames go in assets/frames. Move or scroll here to scrub through them.
          </span>
        </div>
      )}
      {ready && (
        <div style={{ position: "absolute", right: "var(--space-4)", bottom: "var(--space-4)", pointerEvents: "none" }}>
          <span className="tag tag-neutral" style={{ fontWeight: 800 }}>Move · Scroll</span>
        </div>
      )}
    </div>
  );
};
