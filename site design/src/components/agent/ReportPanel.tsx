import React from "react";
import type { ReportSummary, SavedReport } from "../../api/agent";

export type ReportView =
  | { kind: "list"; items: ReportSummary[]; loading: boolean }
  | { kind: "loading"; title: string }
  | { kind: "ready"; report: SavedReport }
  | { kind: "error"; message: string };

interface ReportPanelProps {
  view: ReportView;
  pdfUrl: (id: string) => string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onList: () => void;
}

const labelStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-neutral-700)",
};

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

/** The report beside the chat: a preview in a locked iframe, with Download PDF. */
export const ReportPanel: React.FC<ReportPanelProps> = ({ view, pdfUrl, onClose, onOpen, onDelete, onList }) => {
  return (
    <section
      data-testid="agent-report-panel"
      aria-label="Report"
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "var(--color-bg)" }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-4)",
          borderBottom: "2px solid var(--color-divider)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={labelStyle}>{view.kind === "list" ? "Saved reports" : "Report"}</div>
          <div style={{ fontSize: "1rem", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {view.kind === "ready" ? view.report.title : view.kind === "loading" ? view.title : view.kind === "list" ? "Your reports" : "Could not open"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flex: "none" }}>
          {view.kind === "ready" ? (
            <>
              <a className="btn btn-primary" data-testid="agent-report-pdf" href={pdfUrl(view.report.id)} download style={{ textDecoration: "none" }}>
                Download PDF
              </a>
              <button type="button" className="vg-action" onClick={onList}>
                All reports
              </button>
            </>
          ) : null}
          <button type="button" className="vg-action" aria-label="Close report" data-testid="agent-report-close" onClick={onClose}>
            ×
          </button>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {view.kind === "ready" ? (
          <>
            {/* Locked down: no scripts, no forms, no popups, no same-origin access. The text is data. */}
            <iframe
              title="Report preview"
              data-testid="agent-report-frame"
              sandbox=""
              srcDoc={view.report.html}
              style={{ flex: 1, width: "100%", border: 0, background: "var(--color-bg)" }}
            />
            <div style={{ padding: "var(--space-2) var(--space-4)", borderTop: "1px solid var(--color-divider)", fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>
              Saved {when(view.report.created_at)}. The PDF is made from this same document.
            </div>
          </>
        ) : view.kind === "loading" ? (
          <div role="status" style={{ padding: "var(--space-6) var(--space-4)", color: "var(--color-neutral-700)" }}>
            Building the report and its PDF…
          </div>
        ) : view.kind === "error" ? (
          <div role="alert" style={{ padding: "var(--space-4)", color: "var(--color-accent-800)", background: "var(--color-accent-100)", margin: "var(--space-4)" }}>
            {view.message}
          </div>
        ) : (
          <div style={{ overflowY: "auto", padding: "var(--space-2) var(--space-4)" }}>
            {view.loading ? (
              <div role="status" style={{ padding: "var(--space-3) 0", color: "var(--color-neutral-700)" }}>Loading…</div>
            ) : view.items.length === 0 ? (
              <p style={{ color: "var(--color-neutral-700)", maxWidth: "46ch" }}>
                No saved reports yet. Ask the AI Agent for a report, or press &ldquo;Save as report&rdquo; under any answer.
              </p>
            ) : (
              view.items.map((item) => (
                <div
                  key={item.id}
                  data-testid="agent-report-row"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-divider)" }}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(item.id)}
                    style={{ appearance: "none", cursor: "pointer", border: 0, background: "transparent", textAlign: "left", color: "var(--color-text)", padding: 0, minWidth: 0 }}
                  >
                    <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--color-neutral-700)" }}>{when(item.created_at)}</div>
                  </button>
                  <button type="button" className="vg-action" onClick={() => onDelete(item.id)} aria-label={`Delete ${item.title}`}>
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
};
