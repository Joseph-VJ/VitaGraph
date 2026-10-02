import React, { memo, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export interface CitationRef {
  chunk_id: string;
  report_filename: string;
}

interface PaperAnswerProps {
  markdown: string;
  citations: CitationRef[];
  onCite: (token: string) => void;
  isStreaming: boolean;
}

interface Section {
  key: string;
  kind: "summary" | "evidence" | "limitations" | "safety" | "other";
  body: string;
}

const HEADING_RE = /^#{1,3}\s+/;
const BARE_HEADING_RE = /^\*{0,2}(\d)\.\s*(SUMMARY|EVIDENCE|LIMITATIONS|SAFETY)\b\**:?\**\s*/i;

function kindOf(heading: string): Section["kind"] {
  const h = heading.toLowerCase();
  if (h.includes("safety")) return "safety";
  if (h.includes("evidence")) return "evidence";
  if (h.includes("limitation")) return "limitations";
  if (h.includes("summary")) return "summary";
  return "other";
}

function splitSections(rawMd: string): Section[] {
  // The model sometimes starts a heading mid-line ("...documents.# 1. SUMMARY"); put it on its own line.
  const md = rawMd.replace(/([^\n#])(#{1,3}\s+\d\.\s)/g, "$1\n\n$2");
  const lines = md.split("\n");
  const sections: Section[] = [];
  let cur: { heading: string; lines: string[] } | null = null;
  const preamble: string[] = [];

  const push = () => {
    if (cur) sections.push({ key: `s${sections.length}`, kind: kindOf(cur.heading), body: cur.lines.join("\n") });
  };

  for (const raw of lines) {
    const bare = raw.match(BARE_HEADING_RE);
    if (bare) {
      push();
      const rest = raw.replace(BARE_HEADING_RE, "");
      cur = { heading: bare[2], lines: [`## ${bare[1]}. ${bare[2].toUpperCase()}`, ...(rest ? [rest] : [])] };
    } else if (HEADING_RE.test(raw)) {
      push();
      cur = { heading: raw, lines: [raw] };
    } else if (cur) {
      cur.lines.push(raw);
    } else {
      preamble.push(raw);
    }
  }
  push();
  if (preamble.join("").trim()) sections.unshift({ key: "pre", kind: "other", body: preamble.join("\n") });
  return sections;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Turn filenames / chunk ids in the Evidence section into cite: links.
function linkCitations(body: string, citations: CitationRef[]): string {
  const known = Array.from(
    new Set(citations.flatMap((c) => [c.chunk_id, c.report_filename]).filter((t) => t && t.length > 3))
  ).sort((a, b) => b.length - a.length);
  const parts = known.map(escapeRe);
  parts.push("[\\w][\\w\\-. ]*?\\.pdf");
  const re = new RegExp(`\`?(${parts.join("|")})\`?`, "gi");
  return body
    .split("\n")
    .map((line) => (/^\s*\|?\s*:?-{2,}/.test(line) ? line : line.replace(re, (_m, tok: string) => `[${tok}](cite:${encodeURIComponent(tok)})`)))
    .join("\n");
}

// The model writes headings like "1. SUMMARY"; show them in sentence case.
function sentenceCase(node: React.ReactNode): React.ReactNode {
  if (typeof node === "string") {
    return node.replace(/([A-Z]{2,})/g, (w) => w.charAt(0) + w.slice(1).toLowerCase());
  }
  if (Array.isArray(node)) return node.map((n, i) => <React.Fragment key={i}>{sentenceCase(n)}</React.Fragment>);
  return node;
}

const SectionView = memo(function SectionView({
  section,
  citations,
  onCite,
}: {
  section: Section;
  citations: CitationRef[];
  onCite: (token: string) => void;
}) {
  const body = useMemo(
    () => (section.kind === "evidence" ? linkCitations(section.body, citations) : section.body),
    [section, citations]
  );

  const components: Components = useMemo(
    () => ({
      h1: ({ children }) => <h2>{sentenceCase(children)}</h2>,
      h2: ({ children }) => <h2>{sentenceCase(children)}</h2>,
      h3: ({ children }) => <h3>{sentenceCase(children)}</h3>,
      table: ({ children }) => (
        <div className="paper-table-wrap">
          <table>{children}</table>
        </div>
      ),
      a: ({ href, children }) => {
        if (href?.startsWith("cite:")) {
          const token = decodeURIComponent(href.slice(5));
          return (
            <button
              type="button"
              onClick={() => onCite(token)}
              data-testid="citation-chip"
              title="Open in Evidence Span Viewer"
              className="inline-flex items-center gap-1 align-baseline mx-0.5 px-2 py-[1px] rounded-[var(--r-4)] bg-[var(--verdigris)] text-[var(--text-on-primary)] text-[12.5px] font-medium leading-[20px] hover:brightness-110 cursor-pointer"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
                <polyline points="14 3 14 9 20 9" />
              </svg>
              {children}
            </button>
          );
        }
        return (
          <a href={href} target="_blank" rel="noreferrer noopener" className="text-[var(--deep-petrol)] underline">
            {children}
          </a>
        );
      },
    }),
    [onCite]
  );

  const isSafety = section.kind === "safety";
  return (
    <section
      data-testid={`answer-section-${section.kind}`}
      className={`rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] px-5 py-4 ${
        isSafety ? "border-l-[4px] border-l-[var(--solar-bronze)]" : ""
      }`}
    >
      <div className="paper-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={(u) => u} components={components}>
          {body}
        </ReactMarkdown>
      </div>
    </section>
  );
});

export const PaperAnswer: React.FC<PaperAnswerProps> = ({ markdown, citations, onCite, isStreaming }) => {
  const sections = useMemo(() => splitSections(markdown), [markdown]);
  return (
    <div className="flex flex-col gap-4" data-testid="paper-answer" aria-live="polite" aria-busy={isStreaming}>
      {sections.map((s) => (
        <SectionView key={s.key} section={s} citations={citations} onCite={onCite} />
      ))}
      {isStreaming && <span className="vg-caret self-start" aria-hidden="true" />}
    </div>
  );
};
