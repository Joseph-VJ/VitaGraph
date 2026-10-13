// Plain-word helpers and small pieces shared by the My Data page.

import React from "react";
import type { MeasurementRow } from "../../api/reports";
import type { OverviewReport } from "../../api/overview";
import { formatReportDate } from "../../lib/reportLabels";
import type { TagTone } from "../ui";

export const kickerStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-neutral-700)",
};

export const bodyStyle: React.CSSProperties = {
  fontSize: "0.9375rem",
  lineHeight: 1.5,
  color: "var(--color-text)",
  margin: 0,
};

export const mutedStyle: React.CSSProperties = {
  fontSize: "0.9375rem",
  lineHeight: 1.5,
  color: "var(--color-neutral-700)",
  margin: 0,
};

/** "1 page", "3 pages". */
export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** The date printed inside the report, or a plain sentence when the file has none. */
export function reportDateText(report: Pick<OverviewReport, "report_date">): string {
  const text = formatReportDate(report);
  return text === "Undated" ? "No date printed in the file" : text;
}

export function isBeingRead(status: string): boolean {
  return status === "received" || status === "extracting" || status === "indexing";
}

export function readingStatus(status: string): { label: string; tone: TagTone } {
  if (status === "ready") return { label: "Ready", tone: "done" };
  if (status === "failed") return { label: "Could not be read", tone: "failed" };
  if (isBeingRead(status)) return { label: "Being read", tone: "running" };
  return { label: status || "Unknown", tone: "neutral" };
}

/** "3 pages · 14 passages" */
export function sizeText(report: Pick<OverviewReport, "page_count" | "chunk_count">): string {
  const pages = report.page_count === null ? "Pages not counted yet" : plural(report.page_count, "page", "pages");
  return `${pages} · ${plural(report.chunk_count ?? 0, "passage", "passages")}`;
}

export function howPageWasRead(method: string): string {
  if (method === "native") return "Typed text";
  if (method === "ocr") return "Scanned picture, read by OCR";
  if (method === "failed") return "Could not be read";
  return method || "Unknown";
}

export function pageClarity(quality: string): string {
  if (quality === "good") return "Clear";
  if (quality === "sparse") return "Little text";
  if (quality === "uncertain") return "Hard to read";
  if (quality === "failed") return "Not readable";
  return quality || "Unknown";
}

/** Where a value sits against the range printed in the report itself. Never a judgement of ours. */
export function valueStatus(row: MeasurementRow): { label: string; tone: TagTone } {
  // A range can have both ends ("12 - 15.5") or one ("< 200", "> 40").
  if (row.range_low !== null || row.range_high !== null) {
    if (row.range_low !== null && row.value < row.range_low) return { label: "Below the printed range", tone: "hot" };
    if (row.range_high !== null && row.value > row.range_high) return { label: "Above the printed range", tone: "hot" };
    return { label: "Inside the printed range", tone: "neutral" };
  }
  const flag = row.flag.toUpperCase();
  if (flag === "LOW") return { label: "Below the printed range", tone: "hot" };
  if (flag === "HIGH") return { label: "Above the printed range", tone: "hot" };
  if (flag && flag !== "NORMAL") return { label: `Marked ${row.flag.toLowerCase()} by the lab`, tone: "hot" };
  return { label: "No range found", tone: "neutral" };
}

export function valueText(row: Pick<MeasurementRow, "value" | "unit">): string {
  const value = row.value.toLocaleString("en-US", { maximumFractionDigits: 3 });
  return row.unit ? `${value} ${row.unit}` : value;
}

/** A small filled square, the app's marker for a state. */
export const Square: React.FC<{ red?: boolean }> = ({ red }) => (
  <span
    aria-hidden="true"
    style={{ display: "inline-block", width: 10, height: 10, flex: "none", background: red ? "var(--color-accent)" : "var(--color-text)" }}
  />
);

/** One labelled fact: a small caption above the value. */
export const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
    <div style={kickerStyle}>{label}</div>
    <div style={{ ...bodyStyle, fontWeight: 600, overflowWrap: "anywhere" }}>{children}</div>
  </div>
);

export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
