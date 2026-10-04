import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const bodyText: React.CSSProperties = {
  maxWidth: "62ch",
  fontSize: "1.3125rem",
  lineHeight: 1.5,
  fontWeight: 400,
};

const components: Components = {
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
  // The model's text is data, never navigation: links are shown as plain text.
  a: ({ children }) => <span>{children}</span>,
  table: ({ children }) => (
    <div style={{ overflowX: "auto", margin: "0 0 var(--space-3)" }}>
      <table className="table">{children}</table>
    </div>
  ),
};

export const AnswerMarkdown: React.FC<{ text: string }> = ({ text }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
    {text}
  </ReactMarkdown>
);
