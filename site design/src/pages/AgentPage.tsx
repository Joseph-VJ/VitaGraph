import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useActiveUser } from "../context/UserContext";
import { reportsApi } from "../api/reports";
import { graphApi } from "../api/graph";
import type { Report, ReportPage } from "../types";
import { useAgentChat, type AgentEntry } from "../hooks/useAgentChat";
import { AnswerMarkdown, citedRefs } from "../components/agent/AnswerMarkdown";
import { EvidenceModules } from "../components/agent/EvidenceModules";
import { PassageSlip } from "../components/agent/PassageSlip";
import { TrajectoryPanel } from "../components/agent/TrajectoryPanel";

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
  entry: AgentEntry;
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
      <div style={{ paddingBottom: "var(--space-4)" }} data-testid="agent-answer">
        <AnswerMarkdown text={entry.answer} refs={available} onCite={toggleRef} />
      </div>
    );
  }

  return (
    <article style={{ paddingBottom: "var(--space-6)" }} data-testid="agent-entry">
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
      <TrajectoryPanel entry={entry} />
      {entry.status === "answered" && entry.aiStatus === "not_used" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "baseline", paddingBottom: "var(--space-3)" }}>
          <span className="tag tag-neutral" style={{ fontWeight: 800 }}>Evidence only</span>
          <span style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>{entry.safetyNote ?? "The AI Agent was not used for this answer."}</span>
        </div>
      ) : null}
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

export const AgentPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useActiveUser();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";
  const chat = useAgentChat();
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

  const placeholder = composerReady ? "Ask the AI Agent about a value, a trend or a report" : "Upload a report to start asking";

  return (
    <div data-screen-label="AI Agent" data-testid="agent-page" style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
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
            data-testid="agent-scope-chip"
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
          <div data-testid="agent-empty" style={{ padding: "var(--space-8) 0", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
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
                <p style={{ margin: 0, color: "var(--color-neutral-700)", maxWidth: "62ch" }}>
                  The AI Agent reads only your own reports. It searches them, shows each step it takes, and cites the passages behind every answer.
                </p>
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
          <div data-testid="agent-threads">
            {chat.entries.map((entry, index) => (
              <EntryView key={entry.id} n={index + 1} entry={entry} onRetry={submit} canRetry={composerReady && !chat.isStreaming} getPages={getPages} />
            ))}
            {!chat.isStreaming ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={chat.reset} data-testid="agent-new-chat">
                  New chat
                </button>
              </div>
            ) : null}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        data-testid="agent-composer"
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
            data-testid="agent-input"
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
