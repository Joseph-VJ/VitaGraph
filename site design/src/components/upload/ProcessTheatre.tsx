import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePreferences } from "../../lib/preferences";

export type StageState = "done" | "running" | "waiting" | "failed";

interface ProcessStage {
  key: string;
  name: string;
  line: string;
  detail: string;
}

/** The seven stages, in the order the backend really runs them (plus the Answer the upload makes possible). */
export const PROCESS_STAGES: ProcessStage[] = [
  {
    key: "received",
    name: "Received",
    line: "PDF uploaded",
    detail: "Your file is stored exactly as it arrived and stamped so it can never be changed. Nothing is thrown away.",
  },
  {
    key: "extracted",
    name: "Extracted",
    line: "Text pulled from every page",
    detail: "Each page is checked. Real text is copied out, and pages that are only pictures are read with OCR.",
  },
  {
    key: "chunked",
    name: "Chunked",
    line: "Text split into small chunks",
    detail: "Long text is cut into short passages. Each passage remembers its page and where it starts and ends.",
  },
  {
    key: "embedded",
    name: "Embedded",
    line: "Chunks become vectors",
    detail: "The meaning of each chunk becomes a long row of numbers. Chunks with similar meaning get similar rows.",
  },
  {
    key: "indexed",
    name: "Indexed",
    line: "Stored for search, only for you",
    detail: "The rows are filed by similarity in your own collection, so a search finds the closest ones fast and never looks anywhere else.",
  },
  {
    key: "graphed",
    name: "Graphed",
    line: "Facts and links mapped",
    detail: "Key facts such as measurements become dots, and related dots are joined into a knowledge graph.",
  },
  {
    key: "answer",
    name: "Answer",
    line: "Answered with real evidence",
    detail: "Ask a question and the closest passages are found. The answer shows exactly where each statement came from.",
  },
];

const LAST = PROCESS_STAGES.length - 1;
const VIDEO_SRC = "/assets/stages/process.mp4";
const POSTER_SRC = "/assets/stages/process-poster.jpg";
const MIN_DWELL_MS = 2500;
const PLAYBACK_RATE = 1.5; // the film plays a little faster than it was made

const tagStyle = (kind: StageState): React.CSSProperties =>
  kind === "done"
    ? { background: "var(--color-text)", color: "var(--color-bg)", fontWeight: 800 }
    : kind === "running"
    ? { background: "var(--color-accent)", color: "var(--color-bg)", fontWeight: 800 }
    : kind === "failed"
    ? { background: "var(--color-accent-100)", color: "var(--color-accent-800)", fontWeight: 800 }
    : { background: "var(--color-neutral-200)", color: "var(--color-neutral-800)" };

const barColor = (kind: StageState | undefined): string =>
  kind === "done"
    ? "var(--color-text)"
    : kind === "running"
    ? "var(--color-accent)"
    : kind === "failed"
    ? "var(--color-accent-700)"
    : "var(--color-divider)";

interface ProcessTheatreProps {
  /** Stage (0-6) the real upload has reached; null when nothing is being processed. */
  liveIndex: number | null;
  /** Progress of each stage for the real upload. */
  states?: StageState[];
  /** A finished report is on screen and nothing is being processed: show the finished state. */
  settled?: boolean;
  /** Called with the stage the film is showing while it follows an upload, and null when it is not following one. */
  onPace?: (stage: number | null) => void;
}

/**
 * Shows what the backend is really doing with the uploaded report. It has no controls: it follows the
 * job, one stage at a time and never skipping a stage, then rests on the finished state.
 */
export const ProcessTheatre: React.FC<ProcessTheatreProps> = ({ liveIndex, states, settled = false, onPace }) => {
  const prefs = usePreferences();
  const reduce =
    prefs.reduceMotion ||
    (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageLen = useRef(0);
  const play = useRef<{ stopAt: number | null; loopFrom: number | null; raf: number }>({ stopAt: null, loopFrom: null, raf: 0 });
  const lastSwitch = useRef(0);

  const [ready, setReady] = useState(false);
  const [failedLoad, setFailedLoad] = useState(false);
  const [liveShown, setLiveShown] = useState<number | null>(null);

  // Following the upload until the Answer stage has been shown.
  const following = liveIndex !== null && liveShown !== LAST;
  // If the film cannot load, nothing should wait for it.
  const pace: number | null = following && !failedLoad ? (liveShown ?? 0) : null;
  useEffect(() => {
    onPace?.(pace);
  }, [pace, onPace]);

  // watcher: stops (or loops) the film at the end of the stage being shown
  const watch = useCallback(() => {
    const p = play.current;
    p.raf = 0;
    const v = videoRef.current;
    if (!v) return;
    if (p.stopAt !== null && v.currentTime >= p.stopAt - 0.04) {
      if (p.loopFrom !== null) {
        v.currentTime = p.loopFrom;
      } else {
        v.pause();
        return;
      }
    }
    if (!v.paused) p.raf = requestAnimationFrame(watch);
  }, []);

  const seekTo = useCallback((time: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = time;
  }, []);

  /** Show one stage: play it (looping while the backend is still in it) or, for reduced motion, a still frame. */
  const showStage = useCallback(
    (i: number, loop: boolean) => {
      const v = videoRef.current;
      const len = stageLen.current;
      if (!v || len <= 0) return;
      const start = i * len;
      play.current.stopAt = (i + 1) * len;
      play.current.loopFrom = loop ? start : null;
      if (reduce) {
        v.pause();
        seekTo(start + len * 0.55);
        return;
      }
      seekTo(start);
      void v.play().catch(() => undefined);
    },
    [reduce, seekTo]
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      stageLen.current = v.duration / PROCESS_STAGES.length;
      v.defaultPlaybackRate = PLAYBACK_RATE;
      v.playbackRate = PLAYBACK_RATE;
      setReady(true);
    };
    const onPlay = () => {
      if (!play.current.raf) play.current.raf = requestAnimationFrame(watch);
    };
    const onError = () => setFailedLoad(true);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("error", onError);
    if (v.readyState >= 1) onMeta();
    const playState = play.current;
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("error", onError);
      if (playState.raf) cancelAnimationFrame(playState.raf);
      v.pause();
    };
  }, [watch]);

  // Follow the real upload: every stage in order, each shown for a readable moment, never skipping.
  useEffect(() => {
    if (liveIndex === null || !ready) return;
    if (liveShown !== null && liveIndex < liveShown) {
      setLiveShown(null); // a new upload started
      return;
    }
    if (liveShown !== null && liveShown >= liveIndex) return; // caught up with the backend
    const next = liveShown === null ? 0 : liveShown + 1;
    const wait = liveShown === null ? 0 : Math.max(0, MIN_DWELL_MS - (Date.now() - lastSwitch.current));
    const id = window.setTimeout(() => {
      lastSwitch.current = Date.now();
      setLiveShown(next);
      showStage(next, next < LAST);
    }, wait);
    return () => window.clearTimeout(id);
  }, [liveIndex, liveShown, ready, showStage]);

  // Nothing is being processed: rest on the poster, or on the finished state when a report is ready.
  useEffect(() => {
    if (liveIndex !== null || !ready) return;
    setLiveShown(null);
    const v = videoRef.current;
    if (!v) return;
    play.current.loopFrom = null;
    play.current.stopAt = null;
    v.pause();
    seekTo(settled ? LAST * stageLen.current + stageLen.current * 0.6 : 0);
  }, [liveIndex, settled, ready, seekTo]);

  const shown: number | null = liveIndex !== null ? (liveShown ?? 0) : settled ? LAST : null;
  const stage = shown === null ? null : PROCESS_STAGES[shown];
  const shownState = shown === null ? undefined : states?.[shown];
  const labelOf = (i: number, st: StageState): string =>
    i === LAST && st === "done" ? "Ready" : st === "done" ? "Done" : st === "running" ? "Running" : st === "failed" ? "Failed" : "Waiting";

  return (
    <div
      data-testid="process-theatre"
      style={{ display: "flex", flexDirection: "column", background: "var(--color-surface)", border: "2px solid var(--color-divider)", minHeight: 420 }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "1280 / 614", overflow: "hidden" }}>
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          muted
          playsInline
          preload="auto"
          aria-label="How an uploaded report is processed, stage by stage"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
        />
        {failedLoad && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "var(--space-6)", pointerEvents: "none" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>
              Process film
            </span>
            <span style={{ fontSize: "1rem", fontWeight: 600 }}>The film goes in assets/stages.</span>
          </div>
        )}
        {ready && following && (
          <div style={{ position: "absolute", right: "var(--space-4)", bottom: "var(--space-4)", pointerEvents: "none" }}>
            <span className="tag tag-neutral" style={{ fontWeight: 800 }}>Following your upload</span>
          </div>
        )}
      </div>

      <div
        role="list"
        aria-label="Stages"
        style={{ display: "grid", gridTemplateColumns: `repeat(${PROCESS_STAGES.length}, minmax(0, 1fr))`, borderTop: "2px solid var(--color-divider)" }}
      >
        {PROCESS_STAGES.map((s, i) => {
          const active = shown === i;
          const st = states?.[i];
          return (
            <div
              key={s.key}
              role="listitem"
              data-testid={`stage-tile-${s.key}`}
              aria-current={active ? "step" : undefined}
              style={{
                borderLeft: i === 0 ? 0 : "1px solid var(--color-divider)",
                borderTop: `4px solid ${st ? barColor(st) : "transparent"}`,
                background: active ? "var(--color-text)" : "transparent",
                color: active ? "var(--color-bg)" : "var(--color-text)",
                minWidth: 0,
              }}
            >
              <img
                src={`/assets/stages/thumbs/${s.key}.jpg`}
                alt=""
                loading="lazy"
                style={{ display: "block", width: "100%", height: "auto", opacity: st === "waiting" && !active ? 0.55 : 1 }}
              />
              <span
                style={{
                  display: "block",
                  padding: "var(--space-2)",
                  fontSize: "10.5px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {s.name}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "var(--space-4) var(--space-6) var(--space-6)", borderTop: "2px solid var(--color-divider)", display: "flex", flexDirection: "column", gap: "var(--space-2)", minHeight: 112 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-3)" }}>
          <h3 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 800, letterSpacing: "-0.02em" }} aria-live="polite">
            {stage ? stage.name : "Waiting for a report"}
            <span style={{ fontWeight: 600, color: "var(--color-neutral-700)", fontSize: "1rem", letterSpacing: 0 }}>
              {" "}
              · {stage ? stage.line : "Upload a PDF to start"}
            </span>
          </h3>
          {shown !== null && shownState && (
            <span className="tag" style={{ ...tagStyle(shownState), whiteSpace: "nowrap" }}>{labelOf(shown, shownState)}</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: "0.9375rem", maxWidth: "62ch" }}>
          {stage
            ? stage.detail
            : "Each stage of the real processing plays here as it happens: received, extracted, chunked, embedded, indexed and graphed, ending with the answer you can ask for."}
        </p>
      </div>
    </div>
  );
};
