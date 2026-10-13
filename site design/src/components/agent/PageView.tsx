import React, { useEffect, useId, useRef, useState } from "react";
import { chartsApi, isAbortError, type HighlightRect } from "../../api/charts";
import { BASE_URL } from "../../api/client";
import { reportsApi } from "../../api/reports";

type Zoom = "fit" | 50 | 100 | 150 | 200;
const ZOOMS: { value: Zoom; label: string }[] = [
  { value: "fit", label: "Fit width" },
  { value: 50, label: "50 %" },
  { value: 100, label: "100 %" },
  { value: 150, label: "150 %" },
  { value: 200, label: "200 %" },
];

type HighlightState =
  | { status: "loading" }
  | { status: "ready"; rects: HighlightRect[]; method: "text" | "ocr" | "none" }
  | { status: "failed" };

const NOT_MARKED = "The exact spot could not be marked on this page.";

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

interface PageViewProps {
  userId: string;
  reportId: string;
  page: number;
  charStart: number | null;
  charEnd: number | null;
  /** The file name, shown as "file name · page N". */
  label?: string;
}

/** One page of a stored report, with the cited characters boxed in translucent red. */
export const PageView: React.FC<PageViewProps> = ({ userId, reportId, page, charStart, charEnd, label }) => {
  const zoomName = useId();
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [highlight, setHighlight] = useState<HighlightState>({ status: "loading" });
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const firstBoxRef = useRef<HTMLDivElement | null>(null);

  const hasSpan = charStart !== null && charEnd !== null && charStart < charEnd;
  const src = `${BASE_URL}${reportsApi.pageImageUrl(userId, reportId, page)}`;

  // Boxes for the cited characters. Without a span there is nothing to fetch.
  useEffect(() => {
    if (!hasSpan) return;
    const controller = new AbortController();
    setHighlight({ status: "loading" });
    chartsApi
      .highlight(userId, reportId, page, charStart as number, charEnd as number, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setHighlight({ status: "ready", rects: result.rects ?? [], method: result.method });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) setHighlight({ status: "failed" });
      });
    return () => controller.abort();
  }, [userId, reportId, page, charStart, charEnd, hasSpan]);

  // A new picture starts unloaded.
  useEffect(() => {
    setImageReady(false);
    setImageFailed(false);
  }, [src]);

  // Scroll the first box into the middle of the view once the picture is there (and again after a zoom change).
  useEffect(() => {
    if (!imageReady || highlight.status !== "ready") return;
    const box = firstBoxRef.current;
    const scroller = scrollRef.current;
    if (!box || !scroller) return;
    const boxTop = box.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, boxTop - scroller.clientHeight / 2 + box.offsetHeight / 2) });
  }, [imageReady, highlight, zoom]);

  const rects = highlight.status === "ready" ? highlight.rects : [];
  const pending = hasSpan && highlight.status === "loading";
  const markedNothing = !hasSpan || highlight.status === "failed" || (highlight.status === "ready" && (highlight.method === "none" || rects.length === 0));

  const heading = label ? `${label} · page ${page}` : `Page ${page}`;

  return (
    <div data-testid="page-view" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <div style={{ fontWeight: 800, fontSize: "0.9375rem", minWidth: 0, overflowWrap: "anywhere" }}>{heading}</div>
        <div className="seg" role="radiogroup" aria-label="Zoom">
          {ZOOMS.map((option) => (
            <label key={String(option.value)} className="seg-opt" style={{ fontWeight: zoom === option.value ? 800 : 400 }}>
              <input
                type="radio"
                name={zoomName}
                value={String(option.value)}
                checked={zoom === option.value}
                onChange={() => setZoom(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {pending ? (
        <p role="status" style={{ margin: 0, fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>
          Marking the exact spot…
        </p>
      ) : null}
      {markedNothing && !pending ? (
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>{NOT_MARKED}</p>
      ) : null}

      <div
        ref={scrollRef}
        style={{ maxHeight: "70vh", overflow: "auto", background: "var(--color-surface)", border: "1px solid var(--color-divider)" }}
      >
        {imageFailed ? (
          <p style={{ margin: "var(--space-4)", fontSize: "0.9375rem" }}>The page image could not be loaded.</p>
        ) : (
          <div style={{ position: "relative", width: zoom === "fit" ? "100%" : `${zoom}%` }}>
            <img
              src={src}
              alt={label ? `Page ${page} of ${label}` : `Page ${page}`}
              onLoad={() => setImageReady(true)}
              onError={() => setImageFailed(true)}
              style={{ display: "block", width: "100%", height: "auto", background: "var(--color-bg)" }}
            />
            {imageReady
              ? rects.map((rect, i) => {
                  const x0 = clamp01(rect.x0);
                  const y0 = clamp01(rect.y0);
                  const x1 = clamp01(rect.x1);
                  const y1 = clamp01(rect.y1);
                  return (
                    <div
                      key={i}
                      ref={i === 0 ? firstBoxRef : undefined}
                      data-testid="page-highlight"
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: `${x0 * 100}%`,
                        top: `${y0 * 100}%`,
                        width: `${Math.max(0, x1 - x0) * 100}%`,
                        height: `${Math.max(0, y1 - y0) * 100}%`,
                        boxSizing: "border-box",
                        border: "2px solid var(--color-accent)",
                        background: "color-mix(in srgb, var(--color-accent) 18%, transparent)",
                        pointerEvents: "none",
                      }}
                    />
                  );
                })
              : null}
          </div>
        )}
      </div>
    </div>
  );
};
