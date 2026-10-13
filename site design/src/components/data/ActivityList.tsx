import React from "react";
import { Link } from "react-router-dom";
import type { OverviewActivity, OverviewChat, OverviewReport } from "../../api/overview";
import { formatWhen } from "../../lib/privacyFormat";
import { chatTitle } from "./ChatRow";
import { Square, bodyStyle, mutedStyle } from "./helpers";

const linkStyle: React.CSSProperties = { ...bodyStyle, fontWeight: 800, color: "var(--color-accent-700)", display: "inline-block", padding: "var(--space-1) 0" };

export interface ActivityListProps {
  items: OverviewActivity[];
  reports: OverviewReport[];
  chats: OverviewChat[];
}

/** What happened, newest first. One plain sentence per row; names that still exist are links. */
export const ActivityList: React.FC<ActivityListProps> = ({ items, reports, chats }) => (
  <ol style={{ listStyle: "none", margin: 0, padding: 0 }} data-testid="data-activity-list">
    {items.map((item) => {
      const report = item.report_id ? reports.find((r) => r.id === item.report_id) : undefined;
      const chat = item.conversation_id ? chats.find((c) => c.id === item.conversation_id) : undefined;
      const bad = /fail|delete/i.test(item.kind);
      return (
        <li
          key={item.id}
          style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "var(--space-3)", alignItems: "start", padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-divider)" }}
          data-testid="data-activity-row"
        >
          <span style={{ paddingTop: 6 }}>
            <Square red={bad} />
          </span>
          <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ ...bodyStyle, fontWeight: 600, overflowWrap: "anywhere" }}>{item.text}</span>
            <span style={{ ...mutedStyle, fontSize: "0.8125rem" }}>{formatWhen(item.timestamp)}</span>
            {report ? (
              <Link to={`/library?report=${encodeURIComponent(report.id)}`} style={linkStyle}>
                Open {report.original_filename} in the Library
              </Link>
            ) : null}
            {chat ? (
              <Link to={`/agent?c=${encodeURIComponent(chat.id)}`} style={linkStyle}>
                Open the chat "{chatTitle(chat)}"
              </Link>
            ) : null}
          </span>
        </li>
      );
    })}
  </ol>
);
