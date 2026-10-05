import type { Report } from "../types";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** The date printed in the report itself. Never falls back to the upload time. */
export function parseReportDate(r: Pick<Report, "report_date">): Date | null {
  const raw = r.report_date?.trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const dmy = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(raw);
  if (dmy) {
    const m = MONTHS.indexOf(dmy[2].toLowerCase());
    if (m >= 0) return new Date(Date.UTC(Number(dmy[3]), m, Number(dmy[1])));
  }
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t);
}

/** Oldest dated report first; reports without a date go last, in upload order. */
export function sortReports(list: Report[]): Report[] {
  return [...list].sort((a, b) => {
    const da = parseReportDate(a);
    const db = parseReportDate(b);
    if (da && db) return da.getTime() - db.getTime() || a.upload_time.localeCompare(b.upload_time);
    if (da) return -1;
    if (db) return 1;
    return a.upload_time.localeCompare(b.upload_time);
  });
}

const monthYear = (d: Date) => d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** "Jan 2025", or "Undated". If two reports would get the same label, the filename is appended. */
export function makeLabeler(reports: Report[]): (r: Report) => string {
  const base = (r: Report) => {
    const d = parseReportDate(r);
    return d ? monthYear(d) : "Undated";
  };
  const counts: Record<string, number> = {};
  reports.forEach((r) => {
    counts[base(r)] = (counts[base(r)] ?? 0) + 1;
  });
  return (r: Report) => (counts[base(r)] > 1 ? `${base(r)} · ${r.original_filename}` : base(r));
}

/** The status tag of a report row: Indexed, Failed, or the pipeline state exactly as stored. */
export function reportStatus(r: { status: string }): { label: string; tone: "done" | "failed" | "waiting" } {
  if (r.status === "ready") {
    return { label: "Indexed", tone: "done" };
  }
  if (r.status === "failed") {
    return { label: "Failed", tone: "failed" };
  }
  const s = r.status || "";
  const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : "Waiting";
  return { label, tone: "waiting" };
}
