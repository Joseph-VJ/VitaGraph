import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { OverviewChat, OverviewReport } from "../../api/overview";
import { reportsApi, type MeasurementRow } from "../../api/reports";
import { formatWhen, shortHash } from "../../lib/privacyFormat";
import type { ReportPage } from "../../types";
import { Tag } from "../ui";
import {
  Fact,
  bodyStyle,
  errorText,
  howPageWasRead,
  isBeingRead,
  kickerStyle,
  mutedStyle,
  pageClarity,
  plural,
  reportDateText,
  valueStatus,
  valueText,
} from "./helpers";

const VALUES_SHOWN = 8;
const PAGES_SHOWN = 12;

export const actionStyle: React.CSSProperties = { minHeight: 44, textDecoration: "none" };

export interface ReportDetailProps {
  userId: string;
  report: OverviewReport;
  chats: OverviewChat[];
  onDelete: (report: OverviewReport) => void;
}

const subHead: React.CSSProperties = { ...kickerStyle, margin: 0, paddingBottom: "var(--space-2)", borderBottom: "1px solid var(--color-divider)" };

/** Everything inside one report: facts, how each page was read, the values found, the chats that used it, the actions. */
export const ReportDetail: React.FC<ReportDetailProps> = ({ userId, report, chats, onDelete }) => {
  const [pages, setPages] = useState<ReportPage[] | null>(null);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [values, setValues] = useState<MeasurementRow[] | null>(null);
  const [valuesError, setValuesError] = useState<string | null>(null);
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");

  const ready = report.status === "ready";
  const reading = isBeingRead(report.status);

  useEffect(() => {
    let alive = true;
    setPages(null);
    setPagesError(null);
    setValues(null);
    setValuesError(null);
    setCopy("idle");
    if (report.status !== "received") {
      reportsApi
        .pages(userId, report.id)
        .then((list) => alive && setPages(list))
        .catch((error: unknown) => alive && setPagesError(errorText(error, "The pages could not be loaded.")));
    }
    if (ready) {
      reportsApi
        .measurements(userId, report.id)
        .then((rows) => alive && setValues(rows))
        .catch((error: unknown) => alive && setValuesError(errorText(error, "The values could not be loaded.")));
    }
    return () => {
      alive = false;
    };
  }, [userId, report.id, ready, report.status]);

  const copyFingerprint = async () => {
    try {
      await navigator.clipboard.writeText(report.file_hash);
      setCopy("done");
    } catch {
      setCopy("failed");
    }
  };

  const usedBy = report.chat_ids
    .map((id) => chats.find((chat) => chat.id === id))
    .filter((chat): chat is OverviewChat => chat !== undefined);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: "var(--space-4) var(--space-4) var(--space-6)", background: "var(--color-surface)", borderTop: "1px solid var(--color-divider)" }}
      data-testid="data-report-detail"
    >
      {report.status === "failed" || report.error_message ? (
        <p role="alert" style={{ ...bodyStyle, fontWeight: 600, color: "var(--color-accent-800)", background: "var(--color-accent-100)", padding: "var(--space-3)" }}>
          {report.status === "failed" ? "This report could not be read." : "A problem was reported."}
          {report.error_message ? ` ${report.error_message}` : ""}
        </p>
      ) : null}

      {/* Facts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
        <Fact label="Added on">{formatWhen(report.upload_time)}</Fact>
        <Fact label="Report date">{reportDateText(report)}</Fact>
        <Fact label="Version">{report.version > 1 ? `Version ${report.version} (the same file was added again)` : "Version 1"}</Fact>
        <Fact label="File fingerprint">
          <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)" }}>
            <span title={report.file_hash} style={{ fontVariantNumeric: "tabular-nums" }}>
              {shortHash(report.file_hash, 12)}
            </span>
            <button type="button" className="btn btn-secondary" onClick={() => void copyFingerprint()} style={{ minHeight: 36 }} aria-label="Copy the file fingerprint">
              Copy
            </button>
            <span role="status" aria-live="polite" style={{ ...mutedStyle, fontSize: "0.8125rem" }}>
              {copy === "done" ? "Copied" : copy === "failed" ? "Could not copy" : ""}
            </span>
          </span>
          <span style={{ ...mutedStyle, display: "block", fontSize: "0.8125rem", marginTop: "var(--space-1)" }}>
            The same file always gives the same fingerprint.
          </span>
        </Fact>
      </div>

      {/* Pages */}
      <section aria-label="How each page was read" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h3 style={subHead}>How each page was read</h3>
        <p style={mutedStyle}>
          {plural(report.pages_typed, "page", "pages")} typed text · {plural(report.pages_scanned, "page", "pages")} scanned ·{" "}
          {plural(report.pages_failed, "page", "pages")} could not be read
          {report.pages_weak > 0 ? ` · ${plural(report.pages_weak, "page has", "pages have")} little or hard-to-read text` : ""}
        </p>
        {pagesError ? (
          <p role="alert" style={{ ...bodyStyle, color: "var(--color-accent-800)" }}>{pagesError}</p>
        ) : pages === null ? (
          report.status === "received" ? null : <p style={mutedStyle}>Loading the pages</p>
        ) : pages.length === 0 ? (
          <p style={mutedStyle}>No pages were stored for this report.</p>
        ) : (
          <>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {pages.slice(0, PAGES_SHOWN).map((page) => (
                <li
                  key={page.page_number}
                  style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2) var(--space-4)", padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-divider)", fontSize: "0.9375rem" }}
                >
                  <span style={{ fontWeight: 800, minWidth: "4.5rem" }}>Page {page.page_number}</span>
                  <span>{howPageWasRead(page.extraction_method)}</span>
                  <span style={{ color: "var(--color-neutral-700)" }}>
                    {pageClarity(page.quality)} · {plural(page.text_length, "character", "characters")}
                  </span>
                </li>
              ))}
            </ul>
            {pages.length > PAGES_SHOWN ? (
              <p style={mutedStyle}>and {plural(pages.length - PAGES_SHOWN, "more page", "more pages")}</p>
            ) : null}
          </>
        )}
      </section>

      {/* Values */}
      <section aria-label="Values found in this report" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h3 style={subHead}>Values found in this report</h3>
        {!ready ? (
          <p style={mutedStyle}>{reading ? "Values appear here once the report is read." : "No values, because the report could not be read."}</p>
        ) : valuesError ? (
          <p role="alert" style={{ ...bodyStyle, color: "var(--color-accent-800)" }}>{valuesError}</p>
        ) : values === null ? (
          <p style={mutedStyle}>Loading the values</p>
        ) : values.length === 0 ? (
          <p style={mutedStyle}>No lab values were found in this file.</p>
        ) : (
          <>
            <p style={mutedStyle}>
              {plural(values.length, "value was", "values were")} found. A range is only shown when it was read from the report; if one is missing here, it may still be printed in the file.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ fontSize: "0.9375rem" }} data-testid="data-report-values">
                <thead>
                  <tr>
                    <th scope="col">Test</th>
                    <th scope="col">Value</th>
                    <th scope="col">Range in the report</th>
                    <th scope="col">Where it sits</th>
                  </tr>
                </thead>
                <tbody>
                  {values.slice(0, VALUES_SHOWN).map((row) => {
                    const status = valueStatus(row);
                    return (
                      <tr key={`${row.chunk_id}-${row.test_name}-${row.char_start}`}>
                        <td style={{ fontWeight: 800 }}>{row.test_name}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{valueText(row)}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{row.reference_range ?? "Not found"}</td>
                        <td>
                          <Tag tone={status.tone}>{status.label}</Tag>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {values.length > VALUES_SHOWN ? (
              <Link to={`/library?report=${encodeURIComponent(report.id)}`} style={{ ...bodyStyle, fontWeight: 800, color: "var(--color-accent-700)" }}>
                See all {values.length} values in the Library
              </Link>
            ) : null}
          </>
        )}
      </section>

      {/* Chats that used it */}
      <section aria-label="Chats that used this report" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h3 style={subHead}>Chats that used this report</h3>
        {usedBy.length === 0 ? (
          <p style={mutedStyle}>No chat has used this report yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            {usedBy.map((chat) => (
              <li key={chat.id}>
                <Link
                  to={`/agent?c=${encodeURIComponent(chat.id)}`}
                  style={{ ...bodyStyle, fontWeight: 800, color: "var(--color-accent-700)", display: "inline-block", padding: "var(--space-1) 0" }}
                >
                  {chat.title || chat.first_question || "Untitled chat"}
                </Link>
                <span style={{ ...mutedStyle, fontSize: "0.8125rem" }}> · {formatWhen(chat.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
        <Link to={`/agent?report=${encodeURIComponent(report.id)}`} className="btn btn-primary" style={actionStyle}>
          Ask the AI about this report
        </Link>
        <Link to={`/library?report=${encodeURIComponent(report.id)}`} className="btn btn-secondary" style={actionStyle}>
          Open in Library
        </Link>
        <a
          href={reportsApi.fileUrl(userId, report.id)}
          download={report.original_filename}
          className="btn btn-secondary"
          style={actionStyle}
          data-testid="data-download-original"
        >
          Download original
        </a>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ ...actionStyle, borderColor: "var(--color-accent)", color: "var(--color-accent-700)" }}
          onClick={() => onDelete(report)}
          disabled={reading}
          title={reading ? "Wait until the report has been read." : undefined}
          data-testid="data-delete-report"
        >
          Delete report
        </button>
      </div>
    </div>
  );
};
