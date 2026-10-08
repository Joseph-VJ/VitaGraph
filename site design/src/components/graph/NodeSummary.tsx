import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useNodeSummary } from "../../hooks/useNodeSummary";
import { usePreferences } from "../../lib/preferences";
import type { NodeSource } from "../../api/graph";

const SEG = /(\*\*[^*]+\*\*|\[\d+\])/g;

function cleanUnclosedBold(text: string): string {
  let s = text;
  const matches = [...s.matchAll(/\*\*/g)];
  if (matches.length % 2 !== 0) {
    const last = matches[matches.length - 1];
    s = s.slice(0, last.index) + s.slice(last.index + 2);
  }
  if (s.endsWith("*") && !s.endsWith("**")) {
    s = s.slice(0, -1);
  }
  return s;
}

/** **bold** -> <b class="vg-key">, [n] -> citation chip; a half-written "**" at the end of a stream is hidden. */
function renderSummary(
  text: string,
  active: number | null,
  onCite: (n: number) => void,
  onHover: (n: number | null) => void,
): ReactNode[] {
  const safe = cleanUnclosedBold(text);
  return safe.split(SEG).filter(Boolean).map((part, i) => {
    const bold = /^\*\*(.+)\*\*$/.exec(part);
    if (bold) return <b key={i} className="vg-key">{bold[1]}</b>;
    const cite = /^\[(\d+)\]$/.exec(part);
    if (cite) {
      const n = Number(cite[1]);
      return (
        <button
          key={i}
          type="button"
          className={`vg-ai-cite${active === n ? " is-on" : ""}`}
          aria-label={`Source ${n}`}
          onClick={() => onCite(n)}
          onMouseEnter={() => onHover(n)}
          onMouseLeave={() => onHover(null)}
        >
          {n}
        </button>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function where(s: NodeSource): string {
  return s.method === "text" ? `line ${s.page_number}` : `p. ${s.page_number}`;
}

function waitMessage(phase: string, sourcesCount: number, filesCount: number): string {
  if (phase === "reading") {
    return sourcesCount > 0
      ? `Reading ${sourcesCount} passage${sourcesCount === 1 ? "" : "s"} from ${filesCount} file${filesCount === 1 ? "" : "s"}…`
      : "Finding the passages behind this dot…";
  }
  if (phase === "writing") {
    return `Writing the summary from ${sourcesCount} passage${sourcesCount === 1 ? "" : "s"}…`;
  }
  if (phase === "checking") {
    return "Checking it against your files…";
  }
  return "";
}

export function NodeSummary({ userId, nodeId }: { userId: string; nodeId: string }) {
  const s = useNodeSummary(userId, nodeId);
  const prefs = usePreferences();
  const rootRef = useRef<HTMLElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());

  useEffect(() => {
    const reduceMotion =
      prefs.reduceMotion ||
      (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    rootRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [prefs.reduceMotion]);

  const busy = s.phase !== "done" && s.phase !== "error";
  const fromAi = s.status === "ai" || s.status === "cached";
  const label = s.phase === "done" && !fromAi ? "Summary from your files" : "AI summary";
  const toggle = (n: number, force?: boolean) =>
    setOpen((o) => {
      const next = new Set(o);
      if (force ?? !next.has(n)) next.add(n);
      else next.delete(n);
      return next;
    });

  return (
    <section ref={rootRef} className="vg-ai" aria-label={label} aria-busy={busy} data-testid="node-summary">
      <div className="vg-ai-head">
        <span className={`vg-ai-label${busy ? " is-busy" : ""}`}>
          <i aria-hidden="true" />
          {label}
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={s.again}
          disabled={busy}
          data-testid="node-summary-again"
        >
          Write again
        </button>
      </div>

      {!s.text && (s.phase === "reading" || s.phase === "writing" || s.phase === "checking") && (
        <p className="vg-ai-wait" data-testid="node-summary-wait">
          {waitMessage(s.phase, s.sources.length, s.files)}
        </p>
      )}
      {s.text && (
        <p className="vg-ai-text" aria-live="polite" data-testid="node-summary-text">
          {renderSummary(s.text, hover, (n) => toggle(n, true), setHover)}
          {busy && <span className="vg-ai-caret" aria-hidden="true" />}
        </p>
      )}
      {s.phase === "error" && (
        <p className="vg-ai-wait" data-testid="node-summary-wait">
          {s.error}
        </p>
      )}

      {s.sources.length > 0 && (
        <div className="vg-ai-sources" data-testid="node-summary-sources">
          <div className="vg-ai-sh">
            Sources · {s.sources.length} passage{s.sources.length === 1 ? "" : "s"} in {s.files} file{s.files === 1 ? "" : "s"}
          </div>
          {s.sources.map((src) => (
            <div key={src.n} className={`vg-ai-src${hover === src.n ? " is-on" : ""}`}>
              <button
                type="button"
                aria-expanded={open.has(src.n)}
                onClick={() => toggle(src.n)}
                onMouseEnter={() => setHover(src.n)}
                onMouseLeave={() => setHover(null)}
                data-testid="node-summary-source"
              >
                <span className="vg-ai-n">{src.n}</span>
                <span className="vg-ai-f">{src.filename}</span>
                <span className="vg-ai-w">{where(src)}</span>
              </button>
              {open.has(src.n) && (
                <div className="vg-ai-quote" data-testid="node-summary-quote">
                  {src.text.slice(0, src.hit_start)}
                  <mark>{src.text.slice(src.hit_start, src.hit_end)}</mark>
                  {src.text.slice(src.hit_end)}
                  <small>
                    {where(src)} · chars {src.char_start}–{src.char_end}
                    {src.method.startsWith("ocr") ? " · OCR" : ""}
                    {src.quality !== "good" ? ` · ${src.quality}` : ""}
                  </small>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {s.phase === "done" && s.reason && s.status === "fallback" && <p className="vg-ai-note">{s.reason}</p>}
      <p className="vg-ai-note">General information from your files, not medical advice.</p>
    </section>
  );
}
