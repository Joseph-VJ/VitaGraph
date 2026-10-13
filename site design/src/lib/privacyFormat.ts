// Plain-word helpers shared by the Privacy Shield page, the ledger drawer and the AI Agent answer line.

export const PLACEHOLDER_RE = /\[(?:PERSON|DOCTOR|ID|DOB|PHONE|EMAIL|ADDRESS|GOV_ID|CUSTOM)_\d{1,4}\]/g;

const PURPOSE_LABELS: Record<string, string> = {
  agent: "AI Agent",
  node_summary: "Node summary",
  text_to_graph: "Text to Graph",
  chat: "Chat",
  ask: "Ask",
  connection_test: "Connection test",
  other: "Other",
};

export function purposeLabel(purpose: string): string {
  return PURPOSE_LABELS[purpose] ?? "Other";
}

const TYPE_WORDS: Record<string, [string, string]> = {
  PERSON: ["name", "names"],
  DOCTOR: ["doctor name", "doctor names"],
  ID: ["ID", "IDs"],
  DOB: ["date of birth", "dates of birth"],
  PHONE: ["phone number", "phone numbers"],
  EMAIL: ["email", "emails"],
  ADDRESS: ["address", "addresses"],
  GOV_ID: ["government ID", "government IDs"],
  CUSTOM: ["own word", "own words"],
};

export function typeWord(type: string, count: number): string {
  const words = TYPE_WORDS[type];
  if (!words) return count === 1 ? "detail" : "details";
  return count === 1 ? words[0] : words[1];
}

/** "2 names" style list in a stable order. */
export function countParts(counts: Record<string, number>): string[] {
  return Object.keys(TYPE_WORDS)
    .filter((type) => (counts[type] ?? 0) > 0)
    .map((type) => `${counts[type]} ${typeWord(type, counts[type])}`);
}

/** The backend sends counts as an object; tolerate a JSON string too. */
export function toCounts(raw: unknown): Record<string, number> {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, n] of Object.entries(value as Record<string, unknown>)) {
    if (typeof n === "number" && Number.isFinite(n)) out[key] = n;
  }
  return out;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** "1 message" / "2 messages": the count and the right word, for sentences a person reads. */
export function countWord(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

/** One plain sentence about everything sent so far (numbers come from the summary, nothing is invented). */
export function sentSummaryLine(calls: number, hidden: number): string {
  if (calls === 0) return "No questions have been sent to the AI yet.";
  const sent = `${countWord(calls, "message", "messages")} went to the AI.`;
  if (hidden === 0) return `${sent} Nothing personal was found in them.`;
  return `${sent} ${countWord(hidden, "private detail was", "private details were")} hidden first.`;
}

/** How many details one message hid, in words ("3 details hidden", "Nothing to hide"). */
export function hiddenLine(removed: number): string {
  return removed === 0 ? "Nothing personal found" : `${countWord(removed, "detail", "details")} hidden`;
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} ${time}`;
}

export function shortHash(hash: string, length: number, ellipsis = true): string {
  if (!hash) return "";
  return hash.length > length ? `${hash.slice(0, length)}${ellipsis ? "…" : ""}` : hash;
}
