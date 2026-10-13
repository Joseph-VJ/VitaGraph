import React from "react";
import type { OverviewChat, OverviewReport } from "../../api/overview";
import { formatWhen } from "../../lib/privacyFormat";
import { Tag } from "../ui";
import { bodyStyle, mutedStyle, plural, readingStatus, reportDateText, sizeText } from "./helpers";
import { ReportDetail } from "./ReportDetail";

export interface ReportRowProps {
  userId: string;
  report: OverviewReport;
  chats: OverviewChat[];
  open: boolean;
  onToggle: () => void;
  onDelete: (report: OverviewReport) => void;
}

/** One uploaded file. The header is a button; opening it shows everything inside the report. */
export const ReportRow: React.FC<ReportRowProps> = ({ userId, report, chats, open, onToggle, onDelete }) => {
  const status = readingStatus(report.status);
  const panelId = `data-report-panel-${report.id}`;
  return (
    <li style={{ borderBottom: "1px solid var(--color-divider)", listStyle: "none" }} data-testid="data-report-row" data-report-id={report.id}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        style={{
          appearance: "none",
          width: "100%",
          minHeight: 64,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          alignItems: "center",
          gap: "var(--space-3)",
          textAlign: "left",
          font: "inherit",
          color: "var(--color-text)",
          background: open ? "var(--color-surface)" : "transparent",
          border: 0,
          borderLeft: open ? "5px solid var(--color-accent)" : "5px solid transparent",
          padding: "var(--space-4)",
          cursor: "pointer",
        }}
      >
        <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <span style={{ fontSize: "1.0625rem", fontWeight: 800, overflowWrap: "anywhere" }}>{report.original_filename}</span>
          <span style={{ ...mutedStyle }}>
            {reportDateText(report)} · {sizeText(report)} · added {formatWhen(report.upload_time)}
          </span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
            <Tag tone={status.tone}>{status.label}</Tag>
            {report.pages_scanned > 0 ? (
              <Tag tone="neutral" title="OCR turns a picture of text into text the computer can read.">
                Scanned pages read by OCR
              </Tag>
            ) : null}
            <span style={{ ...bodyStyle, fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>
              {report.chat_ids.length === 0 ? "Not used in a chat yet" : `Used in ${plural(report.chat_ids.length, "chat", "chats")}`}
            </span>
          </span>
        </span>
        <span aria-hidden="true" style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--color-neutral-700)", whiteSpace: "nowrap" }}>
          {open ? "Hide" : "Open"}
        </span>
      </button>
      {open ? (
        <div id={panelId}>
          <ReportDetail userId={userId} report={report} chats={chats} onDelete={onDelete} />
        </div>
      ) : null}
    </li>
  );
};
