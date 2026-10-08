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

/** The evidence numbers the answer actually cites (only those that exist), ascending. */
export function citedRefs(text: string, available: ReadonlySet<number>): number[] {
  // Code is not a citation, except a ```report block, whose citations belong to the answer.
  const visible = text
    .replace(/```(\w*)[ \t]*\n[\s\S]*?(?:```|$)/g, (block, lang: string) => (lang.toLowerCase() === "report" ? block : ""))
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

/** Links citations everywhere except inside code: fenced blocks (even one still being typed), the report block and `inline code`. */
export function linkCitations(text: string, available: ReadonlySet<number>): string {
  const out: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    const fence = rest.indexOf("```");
    const tick = rest.indexOf("`");
    if (fence < 0 && tick < 0) {
      out.push(linkCitationsIn(rest, available));
      break;
    }
    if (fence >= 0 && fence <= tick) {
      out.push(linkCitationsIn(rest.slice(0, fence), available));
      const close = rest.indexOf("```", fence + 3);
      const end = close < 0 ? rest.length : close + 3; // an unclosed block runs to the end
      out.push(rest.slice(fence, end));
      rest = rest.slice(end);
    } else {
      out.push(linkCitationsIn(rest.slice(0, tick), available));
      const close = rest.indexOf("`", tick + 1);
      const end = close < 0 ? rest.length : close + 1;
      out.push(rest.slice(tick, end));
      rest = rest.slice(end);
    }
  }
  return out.join("");
}

