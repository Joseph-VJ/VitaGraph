// A chart the AI Agent asks for in a ```chart block. The block holds only names and ids, never values:
// the server looks the numbers up in the person's stored reports.

export type ChartSpec =
  | { kind: "trend"; tests: string[]; title?: string }
  | { kind: "compare"; tests: string[]; reports?: string[]; title?: string }
  | { kind: "values"; report_id: string; title?: string };

const MAX_BLOCK_CHARS = 2000;
const MAX_NAME_CHARS = 80;
const MAX_TITLE_CHARS = 120;

const KEYS_BY_KIND: Record<ChartSpec["kind"], readonly string[]> = {
  trend: ["kind", "tests", "title"],
  compare: ["kind", "tests", "reports", "title"],
  values: ["kind", "report_id", "title"],
};

/** A short, trimmed, non-empty string, or null. */
function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= max ? trimmed : null;
}

/** A list of 1 to `max` names, each a short string, or null. */
function names(value: unknown, min: number, max: number): string[] | null {
  if (!Array.isArray(value) || value.length < min || value.length > max) return null;
  const out: string[] = [];
  for (const item of value) {
    const name = text(item, MAX_NAME_CHARS);
    if (name === null) return null;
    out.push(name);
  }
  return out;
}

/**
 * Reads the JSON body of a ```chart block. Returns null (never throws) when the body is not valid JSON,
 * names an unknown kind or key, or holds anything other than strings and string lists (so no numbers, ever).
 */
export function parseChartSpec(source: string): ChartSpec | null {
  if (typeof source !== "string" || source.length === 0 || source.length > MAX_BLOCK_CHARS) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const kind = obj.kind;
  if (kind !== "trend" && kind !== "compare" && kind !== "values") return null;
  const allowed = KEYS_BY_KIND[kind];
  if (Object.keys(obj).some((key) => !allowed.includes(key))) return null;

  let title: string | undefined;
  if ("title" in obj) {
    const parsed = text(obj.title, MAX_TITLE_CHARS);
    if (parsed === null) return null;
    title = parsed;
  }

  if (kind === "values") {
    const reportId = text(obj.report_id, MAX_NAME_CHARS);
    if (reportId === null) return null;
    return title === undefined ? { kind, report_id: reportId } : { kind, report_id: reportId, title };
  }

  const tests = names(obj.tests, 1, 4);
  if (tests === null) return null;

  if (kind === "trend") {
    return title === undefined ? { kind, tests } : { kind, tests, title };
  }

  let reports: string[] | undefined;
  if ("reports" in obj) {
    const parsed = names(obj.reports, 2, 6);
    if (parsed === null) return null;
    reports = parsed;
  }
  const spec: ChartSpec = { kind, tests };
  if (reports !== undefined) spec.reports = reports;
  if (title !== undefined) spec.title = title;
  return spec;
}
