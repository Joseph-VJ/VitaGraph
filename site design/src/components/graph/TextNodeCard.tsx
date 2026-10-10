// TextNodeCard.tsx: Docked detail card for selected node in Text to Graph.
// Docked exactly like NodeDossier (340px, 3px red top rule, red Close, 1.25rem 800 title).
// No AI summary box.

import React, { useMemo } from "react";
import type { StageEdge, StageNode } from "./stage/GraphStageEngine";

export interface TextNodeCardProps {
  node: StageNode;
  allNodes: StageNode[];
  edges: StageEdge[];
  fullText: string;
  onSelectNode: (id: string) => void;
  onClose: () => void;
}

/**
 * Finds the sentence enclosing start..end in rawText.
 */
function extractSentenceWithQuote(
  text: string,
  start: number | undefined,
  end: number | undefined,
  fallbackQuote: string
): { before: string; quote: string; after: string; start: number; end: number } | null {
  if (start == null || end == null || !text) {
    if (!fallbackQuote) return null;
    return { before: "", quote: fallbackQuote, after: "", start: 0, end: fallbackQuote.length };
  }

  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.max(s, Math.min(end, text.length));

  // Find sentence start (look backwards for '.', '!', '?', or '\n')
  let sentStart = 0;
  for (let i = s - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "\n" || ((ch === "." || ch === "!" || ch === "?") && i + 1 < s && text[i + 1] === " ")) {
      sentStart = ch === "\n" ? i + 1 : i + 2;
      break;
    }
  }

  // Find sentence end (look forward for '.', '!', '?', or '\n')
  let sentEnd = text.length;
  for (let i = e; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n" || ch === "." || ch === "!" || ch === "?") {
      sentEnd = ch === "\n" ? i : i + 1;
      break;
    }
  }

  const sent = text.slice(sentStart, sentEnd);
  const relStart = s - sentStart;
  const relEnd = e - sentStart;

  const before = sent.slice(0, relStart);
  const quote = text.slice(s, e) || fallbackQuote;
  const after = sent.slice(relEnd);

  return { before, quote, after, start: s, end: e };
}

export const TextNodeCard: React.FC<TextNodeCardProps> = ({
  node,
  allNodes,
  edges,
  fullText,
  onSelectNode,
  onClose,
}) => {
  const isHub = node.id === "hub" || node.group === "document";
  const typeWord = (node.group || node.k).toUpperCase();

  // Find connected relations and neighbors
  const connections = useMemo(() => {
    const byId = new Map(allNodes.map((n) => [n.id, n]));
    const list: Array<{ id: string; chipLabel: string }> = [];

    for (const e of edges) {
      if (e.a === node.id) {
        const other = byId.get(e.b);
        if (other) {
          const chipLabel = e.label ? `${e.label} → ${other.label}` : other.label;
          list.push({ id: other.id, chipLabel });
        }
      } else if (e.b === node.id) {
        const other = byId.get(e.a);
        if (other) {
          const chipLabel = e.label ? `${other.label} → ${e.label}` : other.label;
          list.push({ id: other.id, chipLabel });
        }
      }
    }
    return list;
  }, [node.id, allNodes, edges]);

  // Sentence and quote snippet
  const snippet = useMemo(() => {
    return extractSentenceWithQuote(fullText, node.start, node.end, node.quote || "");
  }, [fullText, node.start, node.end, node.quote]);

  return (
    <aside
      className="dossier text-node-card"
      role="dialog"
      aria-label="Details of the selected node"
      data-testid="graph-dossier"
    >
      {/* Header with kind in small caps and red Close */}
      <div className="dk">
        <span className="label">{typeWord}</span>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={onClose}
          style={{ color: "var(--color-accent)", fontWeight: 700 }}
        >
          Close
        </button>
      </div>

      {/* Title 1.25 rem 800 */}
      <h3>{node.label}</h3>

      {/* Entity type word */}
      <div
        style={{
          fontSize: "0.875rem",
          fontWeight: 700,
          color: "var(--color-neutral-700)",
          textTransform: "capitalize",
        }}
      >
        {node.group || node.k}
      </div>

      {/* Sentence from text with exact quote highlighted */}
      {isHub ? (
        <p style={{ fontSize: "0.875rem", lineHeight: 1.5, margin: 0 }}>
          The text as a whole. Root hub keeping all entities and connections unified.
        </p>
      ) : snippet ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.5, margin: 0 }}>
            {snippet.before}
            <mark
              style={{
                backgroundColor: "rgba(236, 48, 19, 0.15)",
                color: "inherit",
                padding: "1px 4px",
                borderRadius: 0,
                fontWeight: 700,
              }}
            >
              {snippet.quote}
            </mark>
            {snippet.after}
          </p>
          <span className="muted" style={{ fontSize: "0.8125rem" }}>
            characters {snippet.start} to {snippet.end}
          </span>
        </div>
      ) : node.quote ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.5, margin: 0 }}>
            “{node.quote}”
          </p>
          {node.start != null && node.end != null && (
            <span className="muted" style={{ fontSize: "0.8125rem" }}>
              characters {node.start} to {node.end}
            </span>
          )}
        </div>
      ) : null}

      {/* Connections chips list with relation labels */}
      {connections.length > 0 && (
        <div style={{ marginTop: "var(--space-2)" }}>
          <div
            className="label"
            style={{ marginBottom: "var(--space-2)", fontSize: "0.6875rem" }}
          >
            Connections
          </div>
          <div className="chips">
            {connections.map((c, i) => (
              <button
                key={`${c.id}-${i}`}
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => onSelectNode(c.id)}
              >
                {c.chipLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Connection count sentence */}
      <p
        className="muted"
        data-testid="graph-connections"
        style={{ marginTop: "var(--space-2)" }}
      >
        Connected to {connections.length} node{connections.length === 1 ? "" : "s"}.
        Its lines are red; the fainter ones go one step further.
      </p>
    </aside>
  );
};
