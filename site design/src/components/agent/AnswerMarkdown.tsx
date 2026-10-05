import React, { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const bodyText: React.CSSProperties = {
  maxWidth: "62ch",
  fontSize: "1.3125rem",
  lineHeight: 1.5,
  fontWeight: 400,
};

// "[1, 2]" is written as "[1][2]" so every number can become its own chip.
function spreadCitationLists(text: string): string {
  return text.replace(/\[(\d{1,2}(?:\s*,\s*\d{1,2})+)\]/g, (_match, list: string) =>
    list
      .split(",")
      .map((n) => `[${n.trim()}]`)
      .join("")
  );
}

/** The evidence numbers the answer actually cites (only those that exist), ascending. */
export function citedRefs(text: string, available: ReadonlySet<number>): number[] {
  const found = new Set<number>();
  for (const match of spreadCitationLists(text).matchAll(/\[(\d{1,2})\](?!\()/g)) {
    const n = Number(match[1]);
    if (available.has(n)) found.add(n);
  }
  return Array.from(found).sort((a, b) => a - b);
}

// A citation [n] becomes the Markdown link [n](#cite-n); the renderer below turns that link into a chip.
function linkCitations(text: string, available: ReadonlySet<number>): string {
  return spreadCitationLists(text).replace(/\[(\d{1,2})\](?!\()/g, (match, n: string) =>
    available.has(Number(n)) ? `[${n}](#cite-${n})` : match
  );
}

interface AnswerMarkdownProps {
  text: string;
  /** Evidence numbers that exist for this answer; only these become chips. */
  refs: ReadonlySet<number>;
  onCite: (ref: number) => void;
}

export const AnswerMarkdown: React.FC<AnswerMarkdownProps> = ({ text, refs, onCite }) => {
  const components = useMemo<Components>(
    () => ({
      p: ({ children }) => <p style={{ ...bodyText, margin: "0 0 var(--space-3)" }}>{children}</p>,
      ul: ({ children }) => <ul style={{ ...bodyText, margin: "0 0 var(--space-3)", paddingLeft: "1.4em" }}>{children}</ul>,
      ol: ({ children }) => <ol style={{ ...bodyText, margin: "0 0 var(--space-3)", paddingLeft: "1.4em" }}>{children}</ol>,
      li: ({ children }) => <li style={{ marginBottom: "var(--space-1)" }}>{children}</li>,
      h1: ({ children }) => <h3 style={{ margin: "var(--space-4) 0 var(--space-2)", fontSize: "1.125rem", fontWeight: 800 }}>{children}</h3>,
      h2: ({ children }) => <h3 style={{ margin: "var(--space-4) 0 var(--space-2)", fontSize: "1.125rem", fontWeight: 800 }}>{children}</h3>,
      h3: ({ children }) => <h3 style={{ margin: "var(--space-4) 0 var(--space-2)", fontSize: "1.125rem", fontWeight: 800 }}>{children}</h3>,
      strong: ({ children }) => <strong style={{ fontWeight: 800 }}>{children}</strong>,
      code: ({ children }) => (
        <code style={{ fontFamily: "inherit", fontWeight: 600, background: "var(--color-surface)", padding: "0 var(--space-1)" }}>{children}</code>
      ),
      a: ({ href, children }) => {
        const cite = /^#cite-(\d{1,2})$/.exec(href ?? "");
        if (!cite) return <span>{children}</span>; // the model's text is data, never navigation
        const n = Number(cite[1]);
        return (
          <button
            type="button"
            className="agent-cite"
            aria-label={`Open reference ${n}`}
            onClick={() => onCite(n)}
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
        );
      },
      table: ({ children }) => (
        <div style={{ overflowX: "auto", margin: "0 0 var(--space-3)" }}>
          <table className="table">{children}</table>
        </div>
      ),
    }),
    [onCite]
  );

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {linkCitations(text, refs)}
    </ReactMarkdown>
  );
};
