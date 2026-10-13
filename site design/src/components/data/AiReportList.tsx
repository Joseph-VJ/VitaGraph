import React from "react";
import { Link } from "react-router-dom";
import { agentApi } from "../../api/agent";
import type { OverviewChat, OverviewSavedReport } from "../../api/overview";
import { formatWhen } from "../../lib/privacyFormat";
import { chatTitle } from "./ChatRow";
import { bodyStyle, mutedStyle } from "./helpers";

export interface AiReportListProps {
  userId: string;
  items: OverviewSavedReport[];
  chats: OverviewChat[];
}

/** Reports the AI Agent wrote and the person saved. Each one can be downloaded as a PDF. */
export const AiReportList: React.FC<AiReportListProps> = ({ userId, items, chats }) => (
  <ul style={{ listStyle: "none", margin: 0, padding: 0 }} data-testid="data-ai-report-list">
    {items.map((item) => {
      const chat = item.conversation_id ? chats.find((c) => c.id === item.conversation_id) : undefined;
      return (
        <li
          key={item.id}
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", padding: "var(--space-4)", borderBottom: "1px solid var(--color-divider)" }}
          data-testid="data-ai-report-row"
        >
          <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ fontSize: "1.0625rem", fontWeight: 800, overflowWrap: "anywhere" }}>{item.title}</span>
            <span style={mutedStyle}>Saved {formatWhen(item.created_at)}</span>
            {chat ? (
              <Link
                to={`/agent?c=${encodeURIComponent(chat.id)}`}
                style={{ ...bodyStyle, fontWeight: 800, color: "var(--color-accent-700)", display: "inline-block", padding: "var(--space-1) 0" }}
              >
                From the chat "{chatTitle(chat)}"
              </Link>
            ) : null}
          </span>
          <a
            href={agentApi.reportPdfUrl(userId, item.id)}
            download
            className="btn btn-secondary"
            style={{ minHeight: 44, textDecoration: "none" }}
            data-testid="data-download-pdf"
          >
            Download PDF
          </a>
        </li>
      );
    })}
  </ul>
);
