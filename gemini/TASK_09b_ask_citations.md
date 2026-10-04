# TASK 09b: citations, the highlighted passage, and the Evidence / Limitations / Safety columns

Read `gemini/RULES.md` first (branch guard 3b, report format 5, **work report file 5b**, **quality bar 5c**). Read `gemini/reviews/TASK_09a_review.md` and obey it. Then LOOK at `design/reference/screens/02_Ask.png` and read `design/reference/app-v3-source.html` lines 530-570 (the answer, the three columns and the passage slip).

This task is frontend only. Do not touch `vitagraph/backend/`.

## What this task delivers
1. **Part 0, two fixes from the 09a review**: no steps panel for a turn that has no steps (refusal, failed turn); no empty quotes like `Looked up "" in the knowledge graph`.
2. **Citation chips**: every `[1]`, `[2]` (also `[1, 2]`) in an answer that matches a real evidence card becomes a small dark red numbered chip. Numbers that match no evidence stay as plain text.
3. **The passage slip**: clicking a chip opens, under the answer, the stored page text with the cited characters highlighted, a header `Reference n`, file name, `Page p`, `Characters a to b`. The text comes from `GET /api/reports/{id}/pages` and the character range from the evidence card, so it is the real text at the real position. Clicking the chip again closes it; several slips can be open.
4. **Evidence / Limitations / Safety** columns under a finished answer: the Evidence column lists the cited passages (click opens the same slip), Limitations states how many passages in how many reports the answer is built from, Safety states the check that was passed. The columns only appear for a finished, answered, not withheld answer that cites at least one real passage.

## Files you may change (closed list)
1. `site design/src/components/ask/AnswerMarkdown.tsx` : REPLACE the whole file
2. NEW `site design/src/components/ask/PassageSlip.tsx`
3. NEW `site design/src/components/ask/EvidenceModules.tsx`
4. `site design/src/pages/AskPage.tsx` : REPLACE the whole file
5. `site design/src/components/ask/StepsPanel.tsx` : ONE added line (Part 0a)
6. `site design/src/hooks/useChatStream.ts` : ONE replaced block (Part 0b)
7. `site design/src/index.css` : one block appended at the end
8. NEW `gemini/reports/TASK_09b_report.md`
9. screenshots in `gemini/shots/` named `task09b-*.png`

Everything else is forbidden. Do not delete any file.

## Step 0: guard and baseline
```
git branch --show-current
cd "F:\kiruthika\kiruthika final project\site design"
npm run build
```
Branch must be `redesign/modernist-app`; the build must exit 0. (Never stage `site design/tsconfig.tsbuildinfo`.)

## Step 1: Part 0a, `site design/src/components/ask/StepsPanel.tsx`
Find this line (exists once):
```tsx
  const label = streaming
```
and put this line directly ABOVE it (same indentation):
```tsx
  if (entry.steps.length === 0 && !streaming && !entry.fallbackNotice) return null;
```

## Step 2: Part 0b, `site design/src/hooks/useChatStream.ts`
Find this block (exists once, inside `toolLabel`):
```ts
  if (tool === "search_chroma") {
    return { kind: "search", label: `Searched your reports for "${String(args.query ?? "").slice(0, 80)}"` };
  }
  if (tool === "query_networkx_graph") {
    return { kind: "graph", label: `Looked up "${String(args.concept ?? "").slice(0, 80)}" in the knowledge graph` };
  }
```
and replace it with exactly:
```ts
  if (tool === "search_chroma") {
    const query = String(args.query ?? "").trim().slice(0, 80);
    return { kind: "search", label: query ? `Searched your reports for "${query}"` : "Searched your reports" };
  }
  if (tool === "query_networkx_graph") {
    const concept = String(args.concept ?? "").trim().slice(0, 80);
    return { kind: "graph", label: concept ? `Looked up "${concept}" in the knowledge graph` : "Looked through the knowledge graph" };
  }
```

## Step 3: replace `site design/src/components/ask/AnswerMarkdown.tsx`
Replace the ENTIRE file with exactly:
```tsx
import React, { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const bodyText: React.CSSProperties = {
  maxWidth: "62ch",
  fontSize: "1.3125rem",
  lineHeight: 1.5,
  fontWeight: 400,
};

// "[1, 2]" is written as "[1][2]" so every number can become its own chip.
function spreadCitationLists(text: string): string {
  return text.replace(/\[(\d{1,2}(?:\s*,\s*\d{1,2})+)\]/g, (_match, list: string) =>
    list
      .split(",")
      .map((n) => `[${n.trim()}]`)
      .join("")
  );
}

/** The evidence numbers the answer actually cites (only those that exist), ascending. */
export function citedRefs(text: string, available: ReadonlySet<number>): number[] {
  const found = new Set<number>();
  for (const match of spreadCitationLists(text).matchAll(/\[(\d{1,2})\](?!\()/g)) {
    const n = Number(match[1]);
    if (available.has(n)) found.add(n);
  }
  return Array.from(found).sort((a, b) => a - b);
}

// A citation [n] becomes the Markdown link [n](#cite-n); the renderer below turns that link into a chip.
function linkCitations(text: string, available: ReadonlySet<number>): string {
  return spreadCitationLists(text).replace(/\[(\d{1,2})\](?!\()/g, (match, n: string) =>
    available.has(Number(n)) ? `[${n}](#cite-${n})` : match
  );
}

interface AnswerMarkdownProps {
  text: string;
  /** Evidence numbers that exist for this answer; only these become chips. */
  refs: ReadonlySet<number>;
  onCite: (ref: number) => void;
}

export const AnswerMarkdown: React.FC<AnswerMarkdownProps> = ({ text, refs, onCite }) => {
  const components = useMemo<Components>(
    () => ({
      p: ({ children }) => <p style={{ ...bodyText, margin: "0 0 var(--space-3)" }}>{children}</p>,
      ul: ({ children }) => <ul style={{ ...bodyText, margin: "0 0 var(--space-3)", paddingLeft: "1.4em" }}>{children}</ul>,
      ol: ({ children }) => <ol style={{ ...bodyText, margin: "0 0 var(--space-3)", paddingLeft: "1.4em" }}>{children}</ol>,
      li: ({ children }) => <li style={{ marginBottom: "var(--space-1)" }}>{children}</li>,
      h1: ({ children }) => <h3 style={{ margin: "var(--space-4) 0 var(--space-2)", fontSize: "1.125rem", fontWeight: 800 }}>{children}</h3>,
      h2: ({ children }) => <h3 style={{ margin: "var(--space-4) 0 var(--space-2)", fontSize: "1.125rem", fontWeight: 800 }}>{children}</h3>,
      h3: ({ children }) => <h3 style={{ margin: "var(--space-4) 0 var(--space-2)", fontSize: "1.125rem", fontWeight: 800 }}>{children}</h3>,
      strong: ({ children }) => <strong style={{ fontWeight: 800 }}>{children}</strong>,
      code: ({ children }) => (
        <code style={{ fontFamily: "inherit", fontWeight: 600, background: "var(--color-surface)", padding: "0 var(--space-1)" }}>{children}</code>
      ),
      a: ({ href, children }) => {
        const cite = /^#cite-(\d{1,2})$/.exec(href ?? "");
        if (!cite) return <span>{children}</span>; // the model's text is data, never navigation
        const n = Number(cite[1]);
        return (
          <button
            type="button"
            className="ask-cite"
            aria-label={`Open reference ${n}`}
            onClick={() => onCite(n)}
            style={{
              appearance: "none",
              cursor: "pointer",
              display: "inline-block",
              margin: "0 2px",
              padding: "0 6px",
              border: 0,
              background: "var(--color-accent-700)",
              color: "var(--color-bg)",
              fontSize: "0.75rem",
              fontWeight: 800,
              lineHeight: 1.5,
              verticalAlign: "0.3em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {children}
          </button>
        );
      },
      table: ({ children }) => (
        <div style={{ overflowX: "auto", margin: "0 0 var(--space-3)" }}>
          <table className="table">{children}</table>
        </div>
      ),
    }),
    [onCite]
  );

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {linkCitations(text, refs)}
    </ReactMarkdown>
  );
};
```

## Step 4: create `site design/src/components/ask/PassageSlip.tsx`
Copy exactly:
```tsx
import React, { useEffect, useState } from "react";
import type { ReportPage } from "../../types";
import type { ChatEvidence } from "../../hooks/useChatStream";

const CONTEXT_CHARS = 160;

const headStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-4)",
  fontSize: "0.6875rem",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-neutral-700)",
};

const bodyStyle: React.CSSProperties = {
  marginTop: "var(--space-3)",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  fontSize: "0.9375rem",
  lineHeight: 1.75,
  fontVariantNumeric: "tabular-nums",
};

type SlipState = { kind: "loading" } | { kind: "ready"; text: string } | { kind: "failed" };

interface PassageSlipProps {
  card: ChatEvidence;
  getPages: (reportId: string) => Promise<ReportPage[]>;
}

/** The cited passage as it stands on the stored page, the cited characters marked. */
export const PassageSlip: React.FC<PassageSlipProps> = ({ card, getPages }) => {
  const [state, setState] = useState<SlipState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    getPages(card.report_id)
      .then((pages) => {
        if (cancelled) return;
        const page = pages.find((p) => p.page_number === card.page_number);
        setState(page ? { kind: "ready", text: page.extracted_text ?? "" } : { kind: "failed" });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [card.report_id, card.page_number, getPages]);

  const start = card.char_start;
  const end = card.char_end;
  const exact =
    state.kind === "ready" && start !== null && end !== null && start >= 0 && start < end && end <= state.text.length;

  return (
    <div
      data-testid="ask-slip"
      style={{ marginTop: "var(--space-3)", background: "var(--color-surface)", borderTop: "2px solid var(--color-text)", padding: "var(--space-4)" }}
    >
      <div style={headStyle}>
        <span>Reference {card.ref}</span>
        <span>{card.report_filename}</span>
        <span>Page {card.page_number}</span>
        {start !== null && end !== null ? (
          <span>
            Characters {start}–{end}
          </span>
        ) : null}
      </div>
      {state.kind === "loading" ? (
        <div style={{ ...bodyStyle, color: "var(--color-neutral-700)" }}>Loading the passage</div>
      ) : exact && state.kind === "ready" && start !== null && end !== null ? (
        <div style={bodyStyle}>
          <span>{state.text.slice(Math.max(0, start - CONTEXT_CHARS), start)}</span>
          <mark
            style={{
              background: "var(--color-accent-200)",
              color: "var(--color-text)",
              boxShadow: "inset 0 -2px 0 var(--color-accent)",
              padding: "0 2px",
            }}
          >
            {state.text.slice(start, end)}
          </mark>
          <span>{state.text.slice(end, end + CONTEXT_CHARS)}</span>
        </div>
      ) : (
        <>
          <div style={bodyStyle}>{card.snippet}</div>
          <div style={{ ...bodyStyle, marginTop: "var(--space-2)", color: "var(--color-neutral-700)", fontSize: "0.8125rem" }}>
            The exact position on the page could not be loaded, so the saved excerpt is shown.
          </div>
        </>
      )}
    </div>
  );
};
```

## Step 5: create `site design/src/components/ask/EvidenceModules.tsx`
Copy exactly:
```tsx
import React from "react";
import type { ChatEvidence } from "../../hooks/useChatStream";

const labelStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-neutral-700)",
  marginBottom: "var(--space-2)",
};

const textStyle: React.CSSProperties = { fontSize: "0.8125rem", lineHeight: 1.5 };

interface EvidenceModulesProps {
  /** The evidence cards the answer actually cites, ascending by number. */
  cards: ChatEvidence[];
  openRefs: readonly number[];
  onToggle: (ref: number) => void;
}

/** Evidence, Limitations and Safety under a finished answer. */
export const EvidenceModules: React.FC<EvidenceModulesProps> = ({ cards, openRefs, onToggle }) => {
  const reportCount = new Set(cards.map((c) => c.report_id)).size;
  const limitations = `Built from ${cards.length === 1 ? "1 passage" : `${cards.length} passages`} in ${
    reportCount === 1 ? "1 report" : `${reportCount} reports`
  }. The assistant can misread a table or a scan, so check the highlighted passage.`;

  return (
    <div
      data-testid="ask-modules"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
        borderTop: "1px solid var(--color-divider)",
      }}
    >
      <div style={{ padding: "var(--space-3) var(--space-4) var(--space-3) 0" }}>
        <div style={labelStyle}>Evidence</div>
        {cards.map((card) => (
          <button
            key={card.ref}
            type="button"
            className="ask-evidence-row"
            aria-expanded={openRefs.includes(card.ref)}
            onClick={() => onToggle(card.ref)}
            style={{
              appearance: "none",
              cursor: "pointer",
              display: "flex",
              gap: "var(--space-2)",
              alignItems: "baseline",
              width: "100%",
              textAlign: "left",
              padding: "var(--space-1) 0",
              border: 0,
              background: "transparent",
              color: "var(--color-text)",
              fontSize: "0.8125rem",
            }}
          >
            <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--color-accent-700)" }}>{card.ref}</span>
            <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
              <span style={{ fontWeight: 800 }}>{card.report_filename}</span> · p.{card.page_number}
              {card.char_start !== null && card.char_end !== null ? ` · chars ${card.char_start}–${card.char_end}` : ""}
            </span>
          </button>
        ))}
      </div>
      <div style={{ padding: "var(--space-3) var(--space-4)", borderLeft: "1px solid var(--color-divider)" }}>
        <div style={labelStyle}>Limitations</div>
        <div style={textStyle}>{limitations}</div>
      </div>
      <div style={{ padding: "var(--space-3) 0 var(--space-3) var(--space-4)", borderLeft: "1px solid var(--color-divider)" }}>
        <div style={labelStyle}>Safety</div>
        <div style={textStyle}>No diagnosis, treatment or medication advice. This answer passed the check for diagnostic wording.</div>
      </div>
    </div>
  );
};
```

## Step 6: replace `site design/src/pages/AskPage.tsx`
Replace the ENTIRE file with exactly:
```tsx
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useActiveUser } from "../context/UserContext";
import { reportsApi } from "../api/reports";
import { graphApi } from "../api/graph";
import type { Report, ReportPage } from "../types";
import { useChatStream, type ChatEntry } from "../hooks/useChatStream";
import { AnswerMarkdown, citedRefs } from "../components/ask/AnswerMarkdown";
import { EvidenceModules } from "../components/ask/EvidenceModules";
import { PassageSlip } from "../components/ask/PassageSlip";
import { StepsPanel } from "../components/ask/StepsPanel";

const MIN_QUESTION_CHARS = 2;
const MAX_QUESTION_CHARS = 2000;
const STICK_THRESHOLD_PX = 80;

const GENERIC_SUGGESTIONS = [
  "Are any of my values outside their printed reference range?",
  "Summarize my latest report",
];
const SCOPED_SUGGESTIONS = ["Summarize this report", "Are any values in this report outside their printed reference range?"];

type ReportsState = "loading" | "ready" | "failed";

const Arrow: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}
    aria-hidden="true"
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const cardBase: React.CSSProperties = { padding: "var(--space-4)", marginBottom: "var(--space-4)" };

const NoteCard: React.FC<{ tone: "accent" | "neutral"; tag: string; children: React.ReactNode }> = ({ tone, tag, children }) => (
  <div
    style={
      tone === "accent"
        ? { ...cardBase, background: "var(--color-accent-100)", borderTop: "2px solid var(--color-accent)" }
        : { ...cardBase, background: "var(--color-surface)", borderTop: "2px solid var(--color-text)" }
    }
  >
    <span
      className={tone === "accent" ? "tag tag-accent" : "tag tag-neutral"}
      style={{ fontWeight: 800, ...(tone === "accent" ? { background: "var(--color-accent-200)" } : {}) }}
    >
      {tag}
    </span>
    <div
      style={{
        margin: "var(--space-3) 0 0",
        fontSize: "1.0625rem",
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        color: tone === "accent" ? "var(--color-accent-800)" : "var(--color-text)",
      }}
    >
      {children}
    </div>
  </div>
);

interface EntryViewProps {
  n: number;
  entry: ChatEntry;
  onRetry: (question: string) => void;
  canRetry: boolean;
  getPages: (reportId: string) => Promise<ReportPage[]>;
}

const EntryView: React.FC<EntryViewProps> = ({ n, entry, onRetry, canRetry, getPages }) => {
  const [openRefs, setOpenRefs] = useState<number[]>([]);
  const slipsRef = useRef<HTMLDivElement>(null);
  const openedBefore = useRef(0);
  const byRef = useMemo(() => new Map(entry.evidence.map((card) => [card.ref, card])), [entry.evidence]);
  const available = useMemo(() => new Set(byRef.keys()), [byRef]);
  const cited = useMemo(() => citedRefs(entry.answer, available), [entry.answer, available]);
  const toggleRef = useCallback(
    (ref: number) => setOpenRefs((current) => (current.includes(ref) ? current.filter((r) => r !== ref) : [...current, ref])),
    []
  );

  // A newly opened passage scrolls into view.
  useEffect(() => {
    if (openRefs.length > openedBefore.current) slipsRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
    openedBefore.current = openRefs.length;
  }, [openRefs]);

  const openCards = openRefs.flatMap((ref) => {
    const card = byRef.get(ref);
    return card ? [card] : [];
  });
  const citedCards = cited.flatMap((ref) => {
    const card = byRef.get(ref);
    return card ? [card] : [];
  });

  let body: React.ReactNode = null;
  if (entry.status === "refused") {
    body = (
      <NoteCard tone="accent" tag="Declined by policy">
        {entry.answer}
      </NoteCard>
    );
  } else if (entry.status === "insufficient_evidence") {
    body = (
      <NoteCard tone="neutral" tag="No supporting passage">
        {entry.answer}
      </NoteCard>
    );
  } else if (entry.withheld) {
    body = (
      <NoteCard tone="neutral" tag="Answer withheld">
        The safety check held this answer back because it read like a diagnosis. Please rephrase the question, or take it to a clinician.
      </NoteCard>
    );
  } else if (entry.answer.trim()) {
    body = (
      <div style={{ paddingBottom: "var(--space-4)" }} data-testid="ask-answer">
        <AnswerMarkdown text={entry.answer} refs={available} onCite={toggleRef} />
      </div>
    );
  }

  return (
    <article style={{ paddingBottom: "var(--space-6)" }} data-testid="ask-entry">
      <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: "var(--space-3)" }}>
        <div
          style={{
            maxWidth: "72%",
            background: "var(--color-surface)",
            borderTop: "2px solid var(--color-text)",
            padding: "var(--space-3) var(--space-4)",
          }}
        >
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 800,
              letterSpacing: "0.1em",
              color: "var(--color-accent-700)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Q{n}
          </div>
          <div style={{ fontSize: "1.125rem", fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.3, overflowWrap: "anywhere" }}>
            {entry.question}
          </div>
        </div>
      </div>
      <StepsPanel entry={entry} />
      {body}
      {entry.status === "answered" && !entry.withheld && citedCards.length > 0 ? (
        <EvidenceModules cards={citedCards} openRefs={openRefs} onToggle={toggleRef} />
      ) : null}
      {openCards.length > 0 ? (
        <div ref={slipsRef}>
          {openCards.map((card) => (
            <PassageSlip key={card.ref} card={card} getPages={getPages} />
          ))}
        </div>
      ) : null}
      {entry.status === "stopped" ? (
        <div style={{ paddingBottom: "var(--space-4)" }}>
          <span className="tag tag-neutral" style={{ fontWeight: 800 }}>
            Stopped
          </span>
        </div>
      ) : null}
      {entry.status === "error" ? (
        <div role="alert" style={{ ...cardBase, background: "var(--color-accent-100)", borderTop: "2px solid var(--color-accent)" }}>
          <span className="tag tag-accent" style={{ fontWeight: 800, background: "var(--color-accent-200)" }}>
            Could not finish
          </span>
          <p style={{ margin: "var(--space-3) 0", fontSize: "1.0625rem", lineHeight: 1.5, color: "var(--color-accent-800)" }}>
            {entry.error}
          </p>
          <button type="button" className="btn btn-secondary" disabled={!canRetry} onClick={() => onRetry(entry.question)}>
            Try again
          </button>
        </div>
      ) : null}
    </article>
  );
};

export const AskPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useActiveUser();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";
  const chat = useChatStream();
  const [searchParams, setSearchParams] = useSearchParams();
  const reportParam = searchParams.get("report");
  const qParam = searchParams.get("q");

  const [input, setInput] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsState, setReportsState] = useState<ReportsState>("loading");
  const [topTests, setTopTests] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const pagesCache = useRef(new Map<string, Promise<ReportPage[]>>());

  // Each report's pages are fetched once and shared by every passage slip.
  const getPages = useCallback((reportId: string) => {
    let pending = pagesCache.current.get(reportId);
    if (!pending) {
      pending = reportsApi.pages(reportId);
      pagesCache.current.set(reportId, pending);
      pending.catch(() => pagesCache.current.delete(reportId));
    }
    return pending;
  }, []);

  // Header search hands a question over as ?q=: prefill the composer, then drop q (keep report).
  useEffect(() => {
    if (!qParam) return;
    setInput(qParam);
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam]);

  // A different persona starts a fresh conversation.
  useEffect(() => {
    chat.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  // The persona's reports: they decide the empty state and the "chat with this report" scope.
  useEffect(() => {
    let cancelled = false;
    setReportsState("loading");
    reportsApi
      .list(effectiveUserId)
      .then((list) => {
        if (cancelled) return;
        setReports(list);
        setReportsState("ready");
      })
      .catch(() => {
        if (!cancelled) setReportsState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveUserId]);

  // Suggested questions name the most central tests of the persona's real graph.
  useEffect(() => {
    if (reportsState !== "ready" || reports.length === 0) {
      setTopTests([]);
      return;
    }
    let cancelled = false;
    graphApi
      .getGraph(effectiveUserId)
      .then((graph) => {
        if (cancelled) return;
        const labels = graph.nodes
          .filter((n) => n.type === "test")
          .sort((a, b) => (b.betweenness ?? 0) - (a.betweenness ?? 0))
          .map((n) => String(n.label));
        setTopTests(Array.from(new Set(labels)).slice(0, 2));
      })
      .catch(() => {
        if (!cancelled) setTopTests([]);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveUserId, reportsState, reports.length]);

  const scope = reportParam ? reports.find((r) => r.id === reportParam) ?? null : null;
  const hasReports = reportsState === "ready" && reports.length > 0;
  const composerReady = hasReports;

  const suggestions = scope
    ? SCOPED_SUGGESTIONS
    : [
        ...(topTests[0] ? [`What does my ${topTests[0]} trend show over time?`] : []),
        ...GENERIC_SUGGESTIONS,
        ...(topTests[1] ? [`What was my ${topTests[1]} value in each report?`] : []),
      ];

  const submit = (text: string) => {
    const question = text.trim();
    if (question.length < MIN_QUESTION_CHARS || chat.isStreaming || !composerReady) return;
    stickRef.current = true;
    chat.send(effectiveUserId, question, scope?.id ?? null);
    setInput("");
  };

  // Follow the answer while the reader is at the bottom; leave them alone once they scroll up.
  useEffect(() => {
    const scroller = bottomRef.current?.closest("main");
    if (!scroller) return;
    const onScroll = () => {
      stickRef.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < STICK_THRESHOLD_PX;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const scroller = bottomRef.current?.closest("main");
    if (scroller && stickRef.current) scroller.scrollTop = scroller.scrollHeight;
  }, [chat.entries]);

  const placeholder = composerReady ? "Ask about a value, a trend or a report" : "Upload a report to start asking";

  return (
    <div data-screen-label="Ask" data-testid="ask-page" style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          flex: 1,
          maxWidth: "960px",
          width: "100%",
          boxSizing: "border-box",
          margin: "0 auto",
          padding: "var(--space-8) var(--space-8) var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        {reportParam ? (
          <div
            data-testid="scope-chip"
            style={{
              background: "var(--color-surface)",
              borderTop: "2px solid var(--color-text)",
              padding: "var(--space-3) var(--space-4)",
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-3)",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: "0.9375rem" }}>
              {scope ? (
                <>
                  <span style={{ fontWeight: 800 }}>Chatting with {scope.original_filename}.</span>{" "}
                  <span style={{ color: "var(--color-neutral-700)" }}>Answers use only this report.</span>
                </>
              ) : reportsState === "ready" ? (
                <span style={{ fontWeight: 800 }}>That report was not found. Answers use all your reports.</span>
              ) : (
                <span style={{ fontWeight: 800 }}>Loading the report</span>
              )}
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setSearchParams({})}>
              Use all my reports
            </button>
          </div>
        ) : null}

        {chat.entries.length === 0 ? (
          <div data-testid="ask-empty" style={{ padding: "var(--space-8) 0", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {reportsState === "failed" ? (
              <>
                <h2 style={{ margin: 0, fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em" }}>Cannot reach the backend</h2>
                <p style={{ margin: 0, color: "var(--color-neutral-700)" }}>Your reports could not be loaded. Check that the backend is running, then reload this page.</p>
              </>
            ) : reportsState === "ready" && reports.length === 0 ? (
              <>
                <h2 style={{ margin: 0, fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em" }}>No reports yet</h2>
                <p style={{ margin: 0, color: "var(--color-neutral-700)" }}>Upload a report first, then ask about it here.</p>
                <div>
                  <button type="button" className="btn btn-primary" onClick={() => navigate("/upload")}>
                    Upload a report
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ margin: 0, fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em" }}>What would you like to know?</h2>
                <div>
                  {suggestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => submit(q)}
                      disabled={!composerReady}
                      className="ask-suggestion"
                      style={{
                        appearance: "none",
                        width: "100%",
                        cursor: composerReady ? "pointer" : "not-allowed",
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        padding: "var(--space-3) var(--space-2)",
                        border: 0,
                        borderTop: "1px solid var(--color-divider)",
                        background: "transparent",
                        color: "var(--color-text)",
                        fontSize: "1rem",
                        fontWeight: 600,
                        opacity: composerReady ? 1 : 0.45,
                      }}
                    >
                      <span>{q}</span>
                      <Arrow size={16} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div data-testid="conversation-threads">
            {chat.entries.map((entry, index) => (
              <EntryView key={entry.id} n={index + 1} entry={entry} onRetry={submit} canRetry={composerReady && !chat.isStreaming} getPages={getPages} />
            ))}
            {!chat.isStreaming ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={chat.reset} data-testid="ask-new-chat">
                  New chat
                </button>
              </div>
            ) : null}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        data-testid="ask-composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--color-bg)",
          borderTop: "2px solid var(--color-divider)",
          padding: "var(--space-4) var(--space-8)",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: "960px", margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <input
            data-testid="ask-input"
            className="input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={MAX_QUESTION_CHARS}
            disabled={!composerReady}
            aria-label="Your question"
            placeholder={placeholder}
            style={{ flex: "1 1 320px", minHeight: 52, fontSize: "1.0625rem", fontWeight: 600, padding: "var(--space-3) var(--space-4)" }}
          />
          {chat.isStreaming ? (
            <button type="button" className="btn btn-secondary" onClick={chat.stop} style={{ minWidth: 140, justifyContent: "space-between" }}>
              Stop
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!composerReady || input.trim().length < MIN_QUESTION_CHARS}
              style={{ minWidth: 140, justifyContent: "space-between" }}
            >
              Send
              <Arrow size={18} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
```

## Step 7: `site design/src/index.css`
Append this block at the very end (after one blank line):
```css
/* Ask page: hover states of the citation chips and the evidence rows. */
.ask-cite:hover {
  background: var(--color-text);
}
.ask-evidence-row:hover {
  color: var(--color-accent-700);
}
```

## Step 8: static checks (paste the output)
1. `npm run build` exits 0 (paste the last 3 lines).
2. `grep -n "rounded\|Spectral\|backdrop\|#[0-9a-fA-F]\{3,6\}" src/pages/AskPage.tsx src/hooks/useChatStream.ts src/components/ask/*.tsx` prints nothing.
3. `grep -n -i "gemini\|agentrouter\|deepseek\|claude\|gpt\|openai" src/pages/AskPage.tsx src/hooks/useChatStream.ts src/components/ask/*.tsx` prints nothing.
4. `git diff --stat` lists only the files of the closed list (plus `tsconfig.tsbuildinfo`, never staged).

## Step 9: live check in the browser (REAL backend, REAL AI gateway)
Use ONLY the throwaway persona **"Empty Test Persona"** (id `usr_51f14542d71a`). It asks real questions and costs a few AI calls.
1. Start the backend (`cd vitagraph\backend; .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`, background) and the frontend (`cd "site design"; npm run dev -- --port 5173`, background). Wait 12 s.
2. Save the script below as `$env:TEMP\ask_live_check_t09b.py` (NOT in the repo):
```python
import json, re, sys, urllib.request
from playwright.sync_api import sync_playwright

SHOTS = sys.argv[1]
USER_ID = sys.argv[2]
BASE = "http://localhost:5173"
API = "http://127.0.0.1:8000"
COMPOSER = '[data-testid="ask-composer"]'
INPUT = '[data-testid="ask-input"]'
SEND = COMPOSER + ' button[type="submit"]'
SLIP = '[data-testid="ask-slip"]'
LAST_DONE = """(() => { const e = document.querySelectorAll('[data-testid="ask-entry"]'); const l = e[e.length - 1];
  return !!l && (/Thought for/.test(l.innerText) || !!l.querySelector('[role="alert"]') || /Declined by policy/.test(l.innerText)); })()"""
SLIP_PARTS = """() => { const s = document.querySelector('[data-testid="ask-slip"]'); const m = s.querySelector('mark');
  return { parts: Array.from(s.firstElementChild.children).map(c => c.textContent), mark: m ? m.textContent : null, text: s.innerText.replace(/\\n/g, ' | ') }; }"""


def get_json(url):
    with urllib.request.urlopen(url) as res:
        return json.loads(res.read().decode("utf-8"))


def ask(page, text):
    page.fill(INPUT, text)
    page.click(SEND)
    page.wait_for_function(LAST_DONE, timeout=150000)
    page.wait_for_timeout(600)


def stored_text(parts, reports_by_name):
    filename = next(x for x in parts if x.lower().endswith(".pdf"))
    page_no = int(re.search(r"(\d+)", next(x for x in parts if x.startswith("Page"))).group(1))
    a, b = [int(x) for x in re.search(r"(\d+)–(\d+)", next(x for x in parts if x.startswith("Characters"))).groups()]
    pages = get_json(f"{API}/api/reports/{reports_by_name[filename]['id']}/pages")
    return next(pg for pg in pages if pg["page_number"] == page_no)["extracted_text"][a:b]


reports = get_json(f"{API}/api/reports?user_id={USER_ID}")
by_name = {r["original_filename"]: r for r in reports}

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script(f"localStorage.setItem('vitagraph_user_id','{USER_ID}')")
    page = ctx.new_page()
    console = []
    page.on("console", lambda m: console.append((m.type, m.text[:160])) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: console.append(("pageerror", str(e)[:160])))

    page.goto(BASE + "/ask")
    page.wait_for_selector('[data-testid="ask-empty"]')

    # A. chips and the three columns under a finished answer
    ask(page, "What was my hemoglobin and my vitamin D?")
    info = page.evaluate("""() => ({
      chips: Array.from(document.querySelectorAll('.ask-cite')).map(c => c.innerText),
      rawBrackets: (document.querySelector('[data-testid="ask-answer"]').innerText.match(/\\[\\d{1,2}\\]/g) || []).length,
      columns: Array.from(document.querySelectorAll('[data-testid="ask-modules"] > div')).map(d => d.firstElementChild.textContent),
      evidenceRows: Array.from(document.querySelectorAll('.ask-evidence-row')).map(r => r.innerText.replace(/\\n/g, ' ')),
      limitations: document.querySelectorAll('[data-testid="ask-modules"] > div')[1].innerText.replace(/\\n/g, ' '),
      safety: document.querySelectorAll('[data-testid="ask-modules"] > div')[2].innerText.replace(/\\n/g, ' '),
      chip: (() => { const c = document.querySelector('.ask-cite'); const s = getComputedStyle(c); return { bg: s.backgroundColor, fontSize: s.fontSize, weight: s.fontWeight, paddingX: s.paddingLeft }; })(),
    })""")
    print("A chips:", info["chips"], "| raw [n] left in the answer text:", info["rawBrackets"])
    print("A columns:", info["columns"])
    print("A evidence rows:", info["evidenceRows"])
    print("A limitations:", info["limitations"])
    print("A safety:", info["safety"])
    print("A chip style:", info["chip"])

    # B. the slip cannot load the page: honest fallback, and a later click retries
    page.route("**/api/reports/*/pages", lambda r: r.abort())
    page.click(".ask-cite >> nth=0")
    page.wait_for_selector(SLIP)
    page.wait_for_timeout(800)
    print("B failed slip shows the excerpt and the notice:", page.evaluate(SLIP_PARTS)["text"][:330])
    page.unroute("**/api/reports/*/pages")
    page.click(".ask-cite >> nth=0")  # close
    page.click(".ask-cite >> nth=0")  # open again: the failed load must not be cached
    page.wait_for_selector(SLIP + " mark", timeout=10000)
    print("B retry after the network is back highlights the passage: True")

    # C. the highlighted text equals the stored page text at exactly those characters
    slip = page.evaluate(SLIP_PARTS)
    print("C slip head:", " | ".join(slip["parts"]))
    expected = stored_text(slip["parts"], by_name)
    print("C highlighted text equals stored page text:", expected == slip["mark"], "| length", len(slip["mark"]), "| starts:", repr(slip["mark"][:50]))
    page.screenshot(path=SHOTS + r"\task09b-ask-slip.png")

    # D. toggling: chip again closes; an evidence row opens the same slip
    page.click(".ask-cite >> nth=0")
    page.wait_for_timeout(300)
    print("D slips after closing:", page.locator(SLIP).count())
    page.click(".ask-evidence-row >> nth=0")
    page.wait_for_selector(SLIP)
    print("D evidence row opens a slip:", page.locator(SLIP).count(), "| aria-expanded:", page.get_attribute(".ask-evidence-row >> nth=0", "aria-expanded"))
    rows = page.locator(".ask-evidence-row").count()
    if rows >= 2:
        page.click(".ask-evidence-row >> nth=1")
        page.wait_for_timeout(500)
        print("D two slips open at once:", page.locator(SLIP).count(), "| cited passages:", rows)
    else:
        print("D only one passage was cited, so the two-slips check is skipped | cited passages:", rows)
    page.screenshot(path=SHOTS + r"\task09b-ask-modules.png")

    # E. a refusal and a failed turn show no steps panel
    ask(page, "Do I have diabetes?")
    print("E refusal entry:", page.evaluate("""() => { const e = document.querySelectorAll('[data-testid="ask-entry"]'); const l = e[e.length - 1]; return { stepsPanels: l.querySelectorAll('[data-testid="ask-steps"]').length, thoughtFor: /Thought for/.test(l.innerText) }; }"""))
    page.route("**/api/chat/stream", lambda r: r.abort())
    ask(page, "What was my glucose?")
    print("E failed entry:", page.evaluate("""() => { const e = document.querySelectorAll('[data-testid="ask-entry"]'); const l = e[e.length - 1]; return { stepsPanels: l.querySelectorAll('[data-testid="ask-steps"]').length, alert: !!l.querySelector('[role="alert"]') }; }"""))
    page.unroute("**/api/chat/stream")

    # F. no empty quotes in any step label
    page.click('[data-testid="ask-new-chat"]')
    ask(page, "Compare everything in my reports")
    page.click('[data-testid="ask-steps"] button')
    print("F empty quotes in the steps:", '""' in page.eval_on_selector('[data-testid="ask-steps"]', "e => e.innerText"))

    # G. narrow screen with an open slip
    page.click('[data-testid="ask-new-chat"]')
    ask(page, "What was my hemoglobin?")
    page.set_viewport_size({"width": 820, "height": 1100})
    page.click(".ask-cite >> nth=0")
    page.wait_for_selector(SLIP + " mark", timeout=10000)
    print("G overflow:", page.evaluate("({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })"))
    page.screenshot(path=SHOTS + r"\task09b-ask-820.png")

    print("console (errors and warnings):", [m for m in console if "net::" not in m[1]])
    browser.close()
```
3. Run: `$env:PYTHONIOENCODING="utf-8"; python $env:TEMP\ask_live_check_t09b.py "F:\kiruthika\kiruthika final project\gemini\shots" usr_51f14542d71a` . It saves `task09b-ask-slip.png`, `task09b-ask-modules.png`, `task09b-ask-820.png` in `gemini/shots/`.
4. **Paste the whole raw output** in section 4 of your report. Required (AI wording and the number of cited passages vary; the checks below must not):
   - **A**: at least one chip; `raw [n] left in the answer text: 0`; columns `['Evidence', 'Limitations', 'Safety']`; each evidence row reads `N file.pdf · p.1 · chars a–b`; the limitations sentence counts passages and reports correctly (compare with the evidence rows); chip style `bg rgb(174, 24, 0)`, `fontSize 12px`, `weight 800`.
   - **B**: with the page-text request blocked, the slip shows the saved excerpt AND the sentence `The exact position on the page could not be loaded, so the saved excerpt is shown.`; after the network is back the same chip loads the highlighted passage (`True`): a failed load is not remembered.
   - **C**: `highlighted text equals stored page text: True`. This is the most important line of the task.
   - **D**: `slips after closing: 0`; the evidence row opens a slip with `aria-expanded: true`; if two or more passages were cited, two slips are open at once.
   - **E**: the refusal entry and the failed entry both have `stepsPanels: 0`.
   - **F**: `empty quotes in the steps: False`.
   - **G**: `scrollWidth` equals `innerWidth` (820).
   - **console**: an EMPTY list.
5. Look at the three screenshots next to `02_Ask.png`: the chips are small dark red squares with a light number, the three columns have thin vertical rules, the slip has a 2px dark top rule on a grey surface and the highlighted lines have a pale red fill with a red underline. Compare what each screenshot SAYS with the footer, the header and the API, and list EVERY visual oddity you notice (even ones the checklist does not ask about) in section 6.
6. Manual checks (one line each in the report): (a) press Tab until a chip has focus, then Enter: the slip opens (keyboard works); (b) with the backend stopped, a chip click on an already loaded answer still shows its slip (the page text is cached) and does not crash the page.
7. Stop both servers; confirm `Get-NetTCPConnection -LocalPort 5173,8000 -State Listen` prints nothing; delete the temp script.

## Step 10: work report
Write `gemini/reports/TASK_09b_report.md` (nine headings, RULES 5b). Copy line counts from `git diff --stat`.

## COMMIT
Stage ONLY these paths by explicit path:
```
git add "site design/src/components/ask/AnswerMarkdown.tsx" "site design/src/components/ask/PassageSlip.tsx" "site design/src/components/ask/EvidenceModules.tsx" "site design/src/components/ask/StepsPanel.tsx" "site design/src/hooks/useChatStream.ts" "site design/src/pages/AskPage.tsx" "site design/src/index.css" gemini/reports/TASK_09b_report.md
git add gemini/shots/task09b-ask-slip.png gemini/shots/task09b-ask-modules.png gemini/shots/task09b-ask-820.png
git commit -m "feat(redesign): T09b Ask citations, highlighted passage slip, evidence columns"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```

## ACCEPTANCE (PASS/FAIL each with evidence)
- Build exits 0; greps 8.2 and 8.3 print nothing; only closed-list files in the commit.
- Live check A to G as required; line C is `True`; console list empty.
- Screenshots compared with the reference; every visual oddity listed; no contradiction with footer, header or API.
- Keyboard and backend-stopped manual checks done.
- Servers stopped; temp script deleted; branch correct; report has all nine headings.
