import React, { useEffect, useState } from "react";
import type { ReportPage } from "../../types";
import type { AgentEvidence } from "../../hooks/useAgentChat";

const CONTEXT_CHARS = 160;

const headStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-4)",
  fontSize: "0.6875rem",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-neutral-700)",
};

const bodyStyle: React.CSSProperties = {
  marginTop: "var(--space-3)",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  fontSize: "0.9375rem",
  lineHeight: 1.75,
  fontVariantNumeric: "tabular-nums",
};

type SlipState = { kind: "loading" } | { kind: "ready"; text: string } | { kind: "failed" };

interface PassageSlipProps {
  card: AgentEvidence;
  getPages: (reportId: string) => Promise<ReportPage[]>;
}

/** The cited passage as it stands on the stored page, the cited characters marked. */
export const PassageSlip: React.FC<PassageSlipProps> = ({ card, getPages }) => {
  const [state, setState] = useState<SlipState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    getPages(card.report_id)
      .then((pages) => {
        if (cancelled) return;
        const page = pages.find((p) => p.page_number === card.page_number);
        setState(page ? { kind: "ready", text: page.extracted_text ?? "" } : { kind: "failed" });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [card.report_id, card.page_number, getPages]);

  const start = card.char_start;
  const end = card.char_end;
  const exact =
    state.kind === "ready" && start !== null && end !== null && start >= 0 && start < end && end <= state.text.length;

  return (
    <div
      data-testid="agent-slip"
      style={{ marginTop: "var(--space-3)", background: "var(--color-surface)", borderTop: "2px solid var(--color-text)", padding: "var(--space-4)" }}
    >
      <div style={headStyle}>
        <span>Reference {card.ref}</span>
        <span>{card.report_filename}</span>
        <span>Page {card.page_number}</span>
        {start !== null && end !== null ? (
          <span>
            Characters {start}–{end}
          </span>
        ) : null}
      </div>
      {state.kind === "loading" ? (
        <div style={{ ...bodyStyle, color: "var(--color-neutral-700)" }}>Loading the passage</div>
      ) : exact && state.kind === "ready" && start !== null && end !== null ? (
        <div style={bodyStyle}>
          <span>{state.text.slice(Math.max(0, start - CONTEXT_CHARS), start)}</span>
          <mark
            style={{
              background: "var(--color-accent-200)",
              color: "var(--color-text)",
              boxShadow: "inset 0 -2px 0 var(--color-accent)",
              padding: "0 2px",
            }}
          >
            {state.text.slice(start, end)}
          </mark>
          <span>{state.text.slice(end, end + CONTEXT_CHARS)}</span>
        </div>
      ) : (
        <>
          <div style={bodyStyle}>{card.snippet}</div>
          <div style={{ ...bodyStyle, marginTop: "var(--space-2)", color: "var(--color-neutral-700)", fontSize: "0.8125rem" }}>
            The exact position on the page could not be loaded, so the saved excerpt is shown.
          </div>
        </>
      )}
    </div>
  );
};
