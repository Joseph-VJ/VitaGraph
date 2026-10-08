import React, { useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AgentEvidence } from "../../hooks/useAgentChat";
import { markVerified, reportTitle, type Fact } from "../../lib/answerFormat";
import { CodeBlock } from "./CodeBlock";
import { linkCitations } from "../../lib/linkCitations";

export { citedRefs } from "../../lib/linkCitations";

const MEASURE = "66ch";
const GENERAL_LABEL = "General information (not from your reports):";

const bodyText: React.CSSProperties = {
  maxWidth: MEASURE,
  fontSize: "1.0625rem",
  lineHeight: 1.65,
  fontWeight: 400,
};

/** The first paragraph when it is plain prose, so it can be set larger than the rest. */
export function splitLede(text: string): { lede: string; rest: string } {
  const trimmed = text.trimStart();
  const cut = trimmed.search(/\n\s*\n/);
  const first = cut < 0 ? trimmed : trimmed.slice(0, cut);
  if (!first || /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|\||>|```)/.test(first) || first.startsWith(GENERAL_LABEL)) {
    return { lede: "", rest: text };
  }
  return { lede: first, rest: cut < 0 ? "" : trimmed.slice(cut) };
}

const FLAGS: Record<string, { symbol: string; word: string }> = {
  high: { symbol: "▲", word: "High" },
  low: { symbol: "▼", word: "Low" },
  normal: { symbol: "●", word: "In range" },
  abnormal: { symbol: "◆", word: "Abnormal" },
  critical: { symbol: "◆", word: "Critical" },
};

function plainText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : ""))
    .join("");
}

// A citation chip; hovering or focusing it previews the quoted passage, clicking opens the full page.
const CiteChip: React.FC<{ n: number; card: AgentEvidence | undefined; onCite: (ref: number) => void; children: React.ReactNode }> = ({
  n,
  card,
  onCite,
  children,
}) => {
  const [show, setShow] = useState(false);
  const [flip, setFlip] = useState(false);
  const open = (el: HTMLElement) => {
    setFlip(el.getBoundingClientRect().left + 340 > window.innerWidth - 16);
    setShow(true);
  };
  return (
    <span style={{ position: "relative", display: "inline-block" }} onMouseEnter={(e) => open(e.currentTarget)} onMouseLeave={() => setShow(false)}>
      <button
        type="button"
        className="agent-cite"
        aria-label={card ? `Open reference ${n}: ${card.report_filename}, page ${card.page_number}` : `Open reference ${n}`}
        onClick={() => onCite(n)}
        onFocus={(e) => open(e.currentTarget)}
        onBlur={() => setShow(false)}
        style={{
          appearance: "none",
          cursor: "pointer",
          display: "inline-block",
          margin: "0 2px",
          padding: "0 6px",
          border: 0,
          background: "var(--color-accent-700)",
          color: "var(--color-bg)",
          fontSize: "0.75rem",
          fontWeight: 800,
          lineHeight: 1.5,
          verticalAlign: "0.3em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {children}
      </button>
      {show && card ? (
        <span
          role="tooltip"
          data-testid="agent-cite-preview"
          style={{
            position: "absolute",
            zIndex: 5,
            ...(flip ? { right: 0 } : { left: 0 }),
            bottom: "calc(100% + 4px)",
            width: 320,
            maxWidth: "70vw",
            padding: "var(--space-2) var(--space-3)",
            background: "var(--color-text)",
            color: "var(--color-bg)",
            fontSize: "0.8125rem",
            lineHeight: 1.45,
            fontWeight: 400,
            textAlign: "left",
            pointerEvents: "none",
          }}
        >
          <span style={{ display: "block", fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8 }}>
            {card.report_filename} · page {card.page_number}
          </span>
          “{card.snippet.length > 220 ? `${card.snippet.slice(0, 220).trimEnd()}…` : card.snippet}”
        </span>
      ) : null}
    </span>
  );
};

interface AnswerMarkdownProps {
  text: string;
  /** Evidence cards for this answer; only these numbers become chips. */
  cards: ReadonlyMap<number, AgentEvidence>;
  /** Numbers with units that a tool really returned; only these are highlighted. */
  facts: readonly Fact[];
  onCite: (ref: number) => void;
  /** Open a report the agent wrote in a ```report block. */
  onReport?: (markdown: string) => void;
  /** Set the first sentence larger. Off while the answer streams, so narration is not shown at answer size. */
  emphasizeLede?: boolean;
}

export const AnswerMarkdown: React.FC<AnswerMarkdownProps> = ({ text, cards, facts, onCite, onReport, emphasizeLede = true }) => {
  const refs = useMemo(() => new Set(cards.keys()), [cards]);

  const make = useMemo(
    () =>
      (lede: boolean): Components => {
        // Plain text pieces: numbers that match a returned value get the key-value marker.
        const inline = (children: React.ReactNode): React.ReactNode =>
          React.Children.map(children, (child) => {
            if (typeof child !== "string") return child;
            const segments = markVerified(child, facts);
            if (segments.length === 1 && !segments[0].verified) return child;
            return segments.map((s, i) =>
              s.verified ? (
                <mark key={i} className="vg-key" title="This value matches your report">
                  {s.text}
                </mark>
              ) : (
                <React.Fragment key={i}>{s.text}</React.Fragment>
              )
            );
          });

        return {
          p: ({ children }) => {
            const first = plainText(children).trimStart();
            if (first.startsWith(GENERAL_LABEL)) {
              const kids = React.Children.toArray(children);
              const rest = typeof kids[0] === "string" ? [(kids[0] as string).replace(GENERAL_LABEL, "").trimStart(), ...kids.slice(1)] : kids;
              return (
                <aside className="vg-general" style={{ maxWidth: MEASURE }}>
                  <span className="tag tag-neutral" style={{ fontWeight: 800 }}>General information</span>
                  <p style={{ ...bodyText, margin: "var(--space-2) 0 0", fontSize: "1rem" }}>
                    {inline(rest)}
                    <span style={{ display: "block", marginTop: "var(--space-1)", fontSize: "0.8125rem", color: "var(--color-neutral-700)" }}>
                      Not taken from your reports.
                    </span>
                  </p>
                </aside>
              );
            }
            return (
              <p
                style={
                  lede
                    ? { ...bodyText, fontSize: "1.3125rem", lineHeight: 1.45, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 var(--space-4)" }
                    : { ...bodyText, margin: "0 0 var(--space-3)" }
                }
              >
                {inline(children)}
              </p>
            );
          },
          ul: ({ children }) => <ul style={{ ...bodyText, margin: "0 0 var(--space-3)", paddingLeft: "1.3em", listStyle: "square" }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ ...bodyText, margin: "0 0 var(--space-3)", paddingLeft: "1.5em", listStyle: "decimal" }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: "var(--space-2)", paddingLeft: "0.2em" }}>{inline(children)}</li>,
          h1: ({ children }) => <h3 className="vg-answer-h">{children}</h3>,
          h2: ({ children }) => <h3 className="vg-answer-h">{children}</h3>,
          h3: ({ children }) => <h3 className="vg-answer-h">{children}</h3>,
          strong: ({ children }) => <strong style={{ fontWeight: 800 }}>{inline(children)}</strong>,
          em: ({ children }) => <em>{inline(children)}</em>,
          // A fenced block becomes a code card; it is only ever shown, never run.
          pre: ({ children }) => {
            const child = React.Children.toArray(children)[0] as React.ReactElement<{ className?: string; children?: React.ReactNode }> | undefined;
            const language = /language-([\w+-]+)/.exec(child?.props?.className ?? "")?.[1] ?? "";
            const code = plainText(child?.props?.children).replace(/\n$/, "");
            if (language === "report" && onReport) {
              const title = reportTitle(code, "Report");
              return (
                <div data-testid="agent-report-card" className="vg-general" style={{ maxWidth: MEASURE, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", margin: "0 0 var(--space-3)" }}>
                  <div style={{ minWidth: 0 }}>
                    <span className="tag tag-neutral" style={{ fontWeight: 800 }}>Report</span>
                    <div style={{ fontWeight: 800, fontSize: "1.0625rem", marginTop: "var(--space-1)", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => onReport(code)} style={{ flex: "none" }}>
                    Open report
                  </button>
                </div>
              );
            }
            return <CodeBlock code={code} language={language} />;
          },
          code: ({ children }) => (
            <code style={{ fontFamily: "inherit", fontWeight: 600, background: "var(--color-surface)", padding: "0 var(--space-1)" }}>{children}</code>
          ),
          a: ({ href, children }) => {
            const cite = /^#cite-(\d{1,2})$/.exec(href ?? "");
            if (!cite) return <span>{children}</span>; // the model's text is data, never navigation
            const n = Number(cite[1]);
            return (
              <CiteChip n={n} card={cards.get(n)} onCite={onCite}>
                {children}
              </CiteChip>
            );
          },
          table: ({ children }) => (
            <div style={{ overflowX: "auto", margin: "0 0 var(--space-4)", maxWidth: "100%" }}>
              <table className="table vg-answer-table">{children}</table>
            </div>
          ),
          td: ({ children }) => {
            const key = plainText(children).trim().toLowerCase();
            const flag = FLAGS[key];
            return <td>{flag ? <span style={{ fontWeight: 800 }}>{flag.symbol} {flag.word}</span> : inline(children)}</td>;
          },
        };
      },
    [cards, facts, onCite, onReport]
  );

  const linked = linkCitations(text, refs);
  const { lede, rest } = emphasizeLede ? splitLede(linked) : { lede: "", rest: linked };
  const ledeComponents = useMemo(() => make(true), [make]);
  const restComponents = useMemo(() => make(false), [make]);

  return (
    <div className="vg-answer">
      {lede ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={ledeComponents}>
          {lede}
        </ReactMarkdown>
      ) : null}
      {rest.trim() ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={restComponents}>
          {rest}
        </ReactMarkdown>
      ) : null}
    </div>
  );
};
