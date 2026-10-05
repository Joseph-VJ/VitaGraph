import React from "react";
import type { AgentEvidence } from "../../hooks/useAgentChat";

const labelStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-neutral-700)",
  marginBottom: "var(--space-2)",
};

const textStyle: React.CSSProperties = { fontSize: "0.8125rem", lineHeight: 1.5 };

interface EvidenceModulesProps {
  /** The evidence cards the answer actually cites, ascending by number. */
  cards: AgentEvidence[];
  openRefs: readonly number[];
  onToggle: (ref: number) => void;
}

/** Evidence, Limitations and Safety under a finished answer. */
export const EvidenceModules: React.FC<EvidenceModulesProps> = ({ cards, openRefs, onToggle }) => {
  const reportCount = new Set(cards.map((c) => c.report_id)).size;
  const limitations = `Built from ${cards.length === 1 ? "1 passage" : `${cards.length} passages`} in ${
    reportCount === 1 ? "1 report" : `${reportCount} reports`
  }. The AI Agent can misread a table or a scan, so check the highlighted passage.`;

  return (
    <div
      data-testid="agent-modules"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
        borderTop: "1px solid var(--color-divider)",
      }}
    >
      <div style={{ padding: "var(--space-3) var(--space-4) var(--space-3) 0" }}>
        <div style={labelStyle}>Evidence</div>
        {cards.map((card) => (
          <button
            key={card.ref}
            type="button"
            className="agent-evidence-row"
            aria-expanded={openRefs.includes(card.ref)}
            onClick={() => onToggle(card.ref)}
            style={{
              appearance: "none",
              cursor: "pointer",
              display: "flex",
              gap: "var(--space-2)",
              alignItems: "baseline",
              width: "100%",
              textAlign: "left",
              padding: "var(--space-1) 0",
              border: 0,
              background: "transparent",
              color: "var(--color-text)",
              fontSize: "0.8125rem",
            }}
          >
            <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--color-accent-700)" }}>{card.ref}</span>
            <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
              <span style={{ fontWeight: 800 }}>{card.report_filename}</span> · p.{card.page_number}
              {card.char_start !== null && card.char_end !== null ? ` · chars ${card.char_start}–${card.char_end}` : ""}
            </span>
          </button>
        ))}
      </div>
      <div style={{ padding: "var(--space-3) var(--space-4)", borderLeft: "1px solid var(--color-divider)" }}>
        <div style={labelStyle}>Limitations</div>
        <div style={textStyle}>{limitations}</div>
      </div>
      <div style={{ padding: "var(--space-3) 0 var(--space-3) var(--space-4)", borderLeft: "1px solid var(--color-divider)" }}>
        <div style={labelStyle}>Safety</div>
        <div style={textStyle}>No diagnosis, treatment or medication advice. This answer passed the check for diagnostic wording.</div>
      </div>
    </div>
  );
};
