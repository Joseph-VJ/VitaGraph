import React, { useEffect, useMemo, useState } from "react";
import { tokenize, type Token } from "../../lib/codeTokens";

// Colours code inside the Modernist palette: keywords bold, strings red, comments grey. It never runs the code.

const KIND_STYLE: Record<Token["kind"], React.CSSProperties> = {
  plain: {},
  keyword: { fontWeight: 800 },
  string: { color: "var(--color-accent-700)" },
  comment: { color: "var(--color-neutral-700)", fontStyle: "italic" },
  number: { fontVariantNumeric: "tabular-nums", fontWeight: 600 },
};

export const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);
  const tokens = useMemo(() => tokenize(code, language), [code, language]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /* clipboard can be blocked */
    }
  };

  return (
    <figure data-testid="agent-code" style={{ margin: "0 0 var(--space-3)", maxWidth: "100%", border: "1px solid var(--color-divider)" }}>
      <figcaption
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-1) var(--space-3)",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <span style={{ fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-700)" }}>
          {language || "code"}
        </span>
        <button type="button" className="vg-action" onClick={copy} data-testid="agent-code-copy">
          {copied ? "Copied" : "Copy code"}
        </button>
      </figcaption>
      <pre
        tabIndex={0}
        style={{
          margin: 0,
          padding: "var(--space-3)",
          overflowX: "auto",
          fontFamily: "inherit",
          fontSize: "0.875rem",
          lineHeight: 1.6,
          whiteSpace: "pre",
          tabSize: 4,
          background: "var(--color-bg)",
        }}
      >
        <code style={{ fontFamily: "inherit" }}>
          {tokens.map((t, i) => (
            <span key={i} style={KIND_STYLE[t.kind]}>
              {t.text}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
};
