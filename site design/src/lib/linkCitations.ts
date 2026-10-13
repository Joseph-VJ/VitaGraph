// Citation helpers for answers: "[1, 2]" becomes separate chips, and nothing inside code is touched.

// "[1, 2]" is written as "[1][2]" so every number can become its own chip.
export function spreadCitationLists(text: string): string {
  return text.replace(/\[(\d{1,2}(?:\s*,\s*\d{1,2})+)\]/g, (_match, list: string) =>
    list
      .split(",")
      .map((n) => `[${n.trim()}]`)
      .join("")
  );
}

export interface Segment {
  /** A fenced block (code, a ```report or a ```chart), as opposed to prose. */
  code: boolean;
  /** Lower-case language of a fenced block, "" for prose. */
  lang: string;
  text: string;
}

/**
 * Splits an answer into prose and fenced blocks. A fence closes on a line with at least as many backticks as
 * its opening line (CommonMark), so a ```report can hold ```chart blocks when it is written with four backticks.
 * A block still being typed runs to the end of the text.
 */
export function splitFences(text: string): Segment[] {
  const segments: Segment[] = [];
  const opener = /^ {0,3}(`{3,})([^`\n]*)$/gm;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(text)) !== null) {
    const start = match.index;
    const ticks = match[1].length;
    const lang = match[2].trim().split(/\s+/)[0].toLowerCase();
    const lineEnd = text.indexOf("\n", start);
    let end = text.length;
    if (lineEnd >= 0) {
      const closer = new RegExp(`^ {0,3}\`{${ticks},}[ \\t]*$`, "gm");
      closer.lastIndex = lineEnd + 1;
      const close = closer.exec(text);
      if (close) end = close.index + close[0].length;
    }
    segments.push({ code: false, lang: "", text: text.slice(cursor, start) });
    segments.push({ code: true, lang, text: text.slice(start, end) });
    cursor = end;
    opener.lastIndex = end;
  }
  segments.push({ code: false, lang: "", text: text.slice(cursor) });
  return segments;
}

/** The evidence numbers the answer actually cites (only those that exist), ascending. */
export function citedRefs(text: string, available: ReadonlySet<number>): number[] {
  // Code is not a citation, except a ```report block, whose citations belong to the answer. A ```chart is never one.
  const visible = splitFences(text)
    .map((segment) => (segment.code && segment.lang !== "report" ? "" : segment.text))
    .join("")
    .replace(/`[^`\n]*`/g, "");
  const found = new Set<number>();
  for (const match of spreadCitationLists(visible).matchAll(/\[(\d{1,2})\](?!\()/g)) {
    const n = Number(match[1]);
    if (available.has(n)) found.add(n);
  }
  return Array.from(found).sort((a, b) => a - b);
}

// A citation [n] becomes the Markdown link [n](#cite-n); the renderer below turns that link into a chip.
function linkCitationsIn(text: string, available: ReadonlySet<number>): string {
  return spreadCitationLists(text).replace(/\[(\d{1,2})\](?!\()/g, (match, n: string) =>
    available.has(Number(n)) ? `[${n}](#cite-${n})` : match
  );
}

/** Links the citations in prose, leaving `inline code` alone. */
function linkProse(text: string, available: ReadonlySet<number>): string {
  const out: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    const tick = rest.indexOf("`");
    if (tick < 0) {
      out.push(linkCitationsIn(rest, available));
      break;
    }
    out.push(linkCitationsIn(rest.slice(0, tick), available));
    const close = rest.indexOf("`", tick + 1);
    const end = close < 0 ? rest.length : close + 1;
    out.push(rest.slice(tick, end));
    rest = rest.slice(end);
  }
  return out.join("");
}

/** Links citations everywhere except inside code: fenced blocks (even one still being typed), the report and chart blocks and `inline code`. */
export function linkCitations(text: string, available: ReadonlySet<number>): string {
  return splitFences(text)
    .map((segment) => (segment.code ? segment.text : linkProse(segment.text, available)))
    .join("");
}
