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
import { ConversationList } from "../components/agent/ConversationList";
import { PageState, PersonaState } from "../components/ui";
import { clearLoadedReport, getLoadedReportId } from "../lib/loadedReport";
import { extractReport, reportTitle, splitFollowUps, stabilizeMarkdown, verifiedFacts } from "../lib/answerFormat";
import { ReportPanel, type ReportView } from "../components/agent/ReportPanel";
import { agentApi, type ReportRequest } from "../api/agent";

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
  entry: AgentEntry;
  isLast: boolean;
  onRetry: (question: string) => void;
  onAsk: (question: string) => void;
  onSaveReport: (payload: Pick<ReportRequest, "title" | "markdown" | "refs">) => void;
  canRetry: boolean;
  getPages: (reportId: string) => Promise<ReportPage[]>;
}

const CopyIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" />
    <path d="M5 15V5h10" />
  </svg>
);

const EntryView: React.FC<EntryViewProps> = ({ entry, isLast, onRetry, onAsk, onSaveReport, canRetry, getPages }) => {
  const [openRefs, setOpenRefs] = useState<number[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const slipsRef = useRef<HTMLDivElement>(null);
  const openedBefore = useRef(0);
  const streaming = entry.status === "streaming";

  // The closing "FOLLOW-UPS: a | b" line becomes chips; half-typed markdown never flickers while streaming.
  const { body: answerBody, followUps } = useMemo(() => splitFollowUps(entry.answer), [entry.answer]);
  const shown = streaming ? stabilizeMarkdown(answerBody) : answerBody;

  const byRef = useMemo(() => new Map(entry.evidence.map((card) => [card.ref, card])), [entry.evidence]);
  const cited = useMemo(() => citedRefs(answerBody, new Set(byRef.keys())), [answerBody, byRef]);
  const facts = useMemo(() => verifiedFacts(entry.trajectory, entry.evidence.map((c) => c.snippet)), [entry.trajectory, entry.evidence]);
  const toggleRef = useCallback(
    (ref: number) => setOpenRefs((current) => (current.includes(ref) ? current.filter((r) => r !== ref) : [...current, ref])),
    []
  );

  // A newly opened passage scrolls into view.
  useEffect(() => {
    if (openRefs.length > openedBefore.current) slipsRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
    openedBefore.current = openRefs.length;
  }, [openRefs]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const openCards = openRefs.flatMap((ref) => {
    const card = byRef.get(ref);
    return card ? [card] : [];
  });
  const citedCards =
    cited.length > 0
      ? cited.flatMap((ref) => {
          const card = byRef.get(ref);
          return card ? [card] : [];
        })
      : entry.aiStatus === "not_used"
        ? entry.evidence
        : [];

  // A report the agent wrote, or else this answer turned into a report, is rendered and saved by the server.
  const saveReport = (markdown?: string) => {
    const written = markdown ?? extractReport(answerBody);
    const shortQuestion = entry.question.trim().slice(0, 80);
    const text = written ?? `# ${shortQuestion}\n\n${answerBody}`;
    onSaveReport({
      title: reportTitle(text, shortQuestion),
      markdown: text,
      refs: citedCards.map((c) => ({ ref: c.ref, chunk_id: c.chunk_id, report_id: c.report_id })),
    });
  };

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(answerBody);
      setCopied(true);
    } catch {
      /* clipboard can be blocked; nothing else to do */
    }
  };

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
  } else if (shown.trim()) {
    body = (
      <div style={{ paddingBottom: "var(--space-3)" }} data-testid="agent-answer">
        <AnswerMarkdown text={shown} cards={byRef} facts={facts} onCite={toggleRef} onReport={(markdown) => saveReport(markdown)} emphasizeLede={!streaming} />
      </div>
    );
  }

  const answered = entry.status === "answered" && !entry.withheld && shown.trim().length > 0;

  return (
    <article style={{ paddingBottom: "var(--space-8)" }} data-testid="agent-entry">
      <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: "var(--space-5)" }}>
        <div
          data-testid="agent-question"
          style={{
            maxWidth: "78%",
            background: "var(--color-surface)",
            padding: "var(--space-3) var(--space-4)",
            fontSize: "1.0625rem",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {entry.question}
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
        <span
          aria-hidden="true"
          style={{
            width: 26,
            height: 26,
            flex: "none",
            marginTop: 2,
            display: "grid",
            placeItems: "center",
            background: "var(--color-accent)",
            color: "var(--color-bg)",
            fontSize: "0.75rem",
            fontWeight: 800,
          }}
        >
          V
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-700)", paddingBottom: "var(--space-1)" }}>
            AI Agent
          </div>
          <TrajectoryPanel entry={entry} />
          {entry.status === "answered" && entry.aiStatus === "not_used" ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "baseline", paddingBottom: "var(--space-3)" }}>
              <span className="tag tag-neutral" style={{ fontWeight: 800 }}>Evidence only</span>
              <span style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>{entry.safetyNote ?? "The AI Agent was not used for this answer."}</span>
            </div>
          ) : null}
          {body}

          {answered ? (
            <div data-testid="agent-actions" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-1)", marginLeft: "calc(var(--space-2) * -1)" }}>
              <button type="button" className="vg-action" onClick={copyAnswer} data-testid="agent-copy">
                <CopyIcon />
                {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" className="vg-action" onClick={() => saveReport()} data-testid="agent-save-report">
                Save as report
              </button>
              {citedCards.length > 0 ? (
                <button type="button" className="vg-action" onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}>
                  {showDetails ? "Hide evidence" : "Evidence and limits"}
                </button>
              ) : null}
            </div>
          ) : null}

          {answered && citedCards.length > 0 ? (
            <div data-testid="agent-sources" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-2) 0 var(--space-1)" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-700)" }}>Sources</span>
              {citedCards.map((card) => (
                <button
                  key={card.ref}
                  type="button"
                  className="vg-chip"
                  aria-expanded={openRefs.includes(card.ref)}
                  onClick={() => toggleRef(card.ref)}
                  style={{ fontSize: "0.8125rem", padding: "2px var(--space-2)" }}
                >
                  <span style={{ fontWeight: 800, color: "var(--color-accent-700)" }}>{card.ref}</span> {card.report_filename} · p.{card.page_number}
                </button>
              ))}
            </div>
          ) : null}

          {answered && showDetails && citedCards.length > 0 ? (
            <EvidenceModules cards={citedCards} openRefs={openRefs} onToggle={toggleRef} aiUsed={entry.aiStatus === "ok"} />
          ) : null}
          {openCards.length > 0 ? (
            <div ref={slipsRef}>
              {openCards.map((card) => (
                <PassageSlip key={card.ref} card={card} getPages={getPages} />
              ))}
            </div>
          ) : null}

          {answered && isLast && followUps.length > 0 ? (
            <div data-testid="agent-followups" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", paddingTop: "var(--space-3)" }}>
              {followUps.map((q) => (
                <button key={q} type="button" className="vg-chip" onClick={() => onAsk(q)} disabled={!canRetry}>
                  {q}
                </button>
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
        </div>
      </div>
    </article>
  );
};

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  );

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}

export const AgentPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: personaLoading, refreshUsers } = useActiveUser();
  const effectiveUserId = user?.id ?? "";
  const chat = useAgentChat();
  const [searchParams, setSearchParams] = useSearchParams();
  const reportParam = searchParams.get("report");
  const qParam = searchParams.get("q");

  const [input, setInput] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsState, setReportsState] = useState<ReportsState>("loading");
  const [reportsTick, setReportsTick] = useState(0);
  const [topTests, setTopTests] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const pagesCache = useRef(new Map<string, Promise<ReportPage[]>>());

  const isDesktop = useIsDesktop();
  const [showMobileList, setShowMobileList] = useState(false);
  const [historyOpen, setHistoryOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem("vitagraph_agent_history") !== "closed";
    } catch {
      return true;
    }
  });
  const toggleHistory = () =>
    setHistoryOpen((open) => {
      try {
        localStorage.setItem("vitagraph_agent_history", open ? "closed" : "open");
      } catch {
        /* a blocked store only means the choice is not remembered */
      }
      return !open;
    });
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // The report beside the chat.
  const [reportView, setReportView] = useState<ReportView | null>(null);
  const fail = (e: unknown): ReportView => ({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong." });
  const saveReport = async (payload: Pick<ReportRequest, "title" | "markdown" | "refs">) => {
    setReportView({ kind: "loading", title: payload.title });
    try {
      const saved = await agentApi.createReport({ ...payload, user_id: effectiveUserId, conversation_id: chat.conversationId });
      setReportView({ kind: "ready", report: saved });
    } catch (e) {
      setReportView(fail(e));
    }
  };
  const showReportList = async () => {
    setReportView({ kind: "list", items: [], loading: true });
    try {
      setReportView({ kind: "list", items: await agentApi.listReports(effectiveUserId), loading: false });
    } catch (e) {
      setReportView(fail(e));
    }
  };
  const openSavedReport = async (id: string) => {
    setReportView({ kind: "loading", title: "Opening" });
    try {
      setReportView({ kind: "ready", report: await agentApi.getReport(effectiveUserId, id) });
    } catch (e) {
      setReportView(fail(e));
    }
  };
  const deleteSavedReport = async (id: string) => {
    try {
      await agentApi.deleteReport(effectiveUserId, id);
      await showReportList();
    } catch (e) {
      setReportView(fail(e));
    }
  };
  const [refreshSignal, setRefreshSignal] = useState(0);
  const prevStreaming = useRef(chat.isStreaming);

  useEffect(() => {
    if (prevStreaming.current && !chat.isStreaming && chat.entries.length > 0) {
      setRefreshSignal((s) => s + 1);
    }
    prevStreaming.current = chat.isStreaming;
  }, [chat.isStreaming, chat.entries.length]);

  const c = searchParams.get("c");
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!c) {
      loadedRef.current = null;
      return;
    }
    if (!effectiveUserId || loadedRef.current === c || c === chat.conversationId) return;
    loadedRef.current = c;
    void chat.load(effectiveUserId, c);
  }, [effectiveUserId, c, chat]);

  useEffect(() => {
    const id = chat.conversationId;
    if (!id || searchParams.get("c") === id) return;
    loadedRef.current = id;
    const next = new URLSearchParams(searchParams);
    next.set("c", id);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.conversationId]);

  const handleNew = useCallback(() => {
    chat.reset();
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("c");
        return next;
      },
      { replace: true }
    );
  }, [chat, setSearchParams]);

  const handleOpen = useCallback(
    (id: string) => {
      if (id === chat.conversationId) return;
      loadedRef.current = id;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("c", id);
          return next;
        },
        { replace: true }
      );
      void chat.load(effectiveUserId, id);
    },
    [chat, effectiveUserId, setSearchParams]
  );

  // Each report's pages are fetched once and shared by every passage slip.
  const getPages = useCallback((reportId: string) => {
    let pending = pagesCache.current.get(reportId);
    if (!pending) {
      pending = reportsApi.pages(effectiveUserId, reportId);
      pagesCache.current.set(reportId, pending);
      pending.catch(() => pagesCache.current.delete(reportId));
    }
    return pending;
  }, [effectiveUserId]);

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
  const prevUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevUserRef.current && prevUserRef.current !== effectiveUserId) {
      chat.reset();
      pagesCache.current.clear();
      loadedRef.current = null;
      const next = new URLSearchParams(searchParams);
      if (next.has("c")) {
        next.delete("c");
        setSearchParams(next, { replace: true });
      }
    }
    prevUserRef.current = effectiveUserId || null;
  }, [effectiveUserId, chat, searchParams, setSearchParams]);

  // The persona's reports: they decide the empty state and the "chat with this report" scope.
  useEffect(() => {
    if (!effectiveUserId) return;
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
  }, [effectiveUserId, reportsTick]);

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

  // Start the agent while the person is reading the page, so the first question is not slowed by start-up.
  useEffect(() => {
    if (effectiveUserId) void agentApi.warm(effectiveUserId);
  }, [effectiveUserId]);

  // A report that was just uploaded is loaded into the agent: open scoped to it unless the
  // person already chose a report or reopened a conversation.
  useEffect(() => {
    if (reportParam || c || reportsState !== "ready" || !effectiveUserId) return;
    const loadedId = getLoadedReportId(effectiveUserId);
    if (!loadedId || !reports.some((r) => r.id === loadedId)) return;
    const next = new URLSearchParams(searchParams);
    next.set("report", loadedId);
    setSearchParams(next, { replace: true });
  }, [reportParam, c, reportsState, reports, effectiveUserId, searchParams, setSearchParams]);

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

  // The question box grows with what is typed, up to six lines.
  useLayoutEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [input]);

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
  }, [effectiveUserId]);

  useLayoutEffect(() => {
    const scroller = bottomRef.current?.closest("main");
    if (scroller && stickRef.current) scroller.scrollTop = scroller.scrollHeight;
  }, [chat.entries]);

  if (!effectiveUserId) {
    return (
      <div
        data-screen-label="AI Agent"
        data-testid="agent-page"
        className="vg-pad"
        style={{ maxWidth: 960, margin: "0 auto" }}
      >
        <PersonaState loading={personaLoading} onRetry={refreshUsers} />
      </div>
    );
  }

  const placeholder = composerReady
    ? "Ask about a value, a trend or a report"
    : reportsState === "loading"
    ? "Loading your reports"
    : "Upload a report to start asking";
  const canSend = composerReady && input.trim().length >= MIN_QUESTION_CHARS;
  const historyShown = isDesktop && historyOpen && !reportView;

  return (
    <div
      data-screen-label="AI Agent"
      data-testid="agent-page"
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: isDesktop ? "row" : "column",
        alignItems: "stretch",
      }}
    >
      {/* History column (desktop) */}
      {historyShown ? (
        <aside
          style={{
            width: 280,
            flex: "0 0 280px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            position: "sticky",
            top: 0,
            height: "calc(100vh - 114px)",
            maxHeight: "calc(100vh - 114px)",
            alignSelf: "flex-start",
          }}
        >
          <ConversationList
            userId={effectiveUserId}
            currentId={chat.conversationId || c}
            onOpen={handleOpen}
            onNew={handleNew}
            refreshSignal={refreshSignal}
          />
        </aside>
      ) : null}

      {/* Conversation column (hidden behind the report on narrow screens) */}
      <div style={{ flex: 1, minWidth: 0, display: !isDesktop && reportView ? "none" : "flex", flexDirection: "column", minHeight: "100%" }}>
        <div
          className="vg-gutter"
          style={{
            paddingTop: "var(--space-3)",
            paddingBottom: "var(--space-3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
          }}
        >
          <button
            type="button"
            className="vg-action"
            data-testid="agent-history-toggle"
            aria-expanded={isDesktop ? historyOpen : showMobileList}
            onClick={() => (isDesktop ? toggleHistory() : setShowMobileList((prev) => !prev))}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
            {isDesktop && historyOpen ? "Hide history" : "History"}
          </button>
          <button type="button" className="vg-action" data-testid="agent-reports-toggle" onClick={showReportList} style={{ marginRight: "auto" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
              <path d="M7 3h8l4 4v14H7z" />
              <path d="M15 3v4h4" />
            </svg>
            Reports
          </button>
          {chat.entries.length > 0 && !chat.isStreaming ? (
            <button type="button" className="vg-action" onClick={handleNew} data-testid="agent-new-chat">
              + New chat
            </button>
          ) : null}
        </div>

        {/* History panel (narrow screens) */}
        {!isDesktop && showMobileList ? (
          <div style={{ borderBottom: "2px solid var(--color-divider)", background: "var(--color-surface)", maxHeight: "50vh", overflowY: "auto" }}>
            <ConversationList
              userId={effectiveUserId}
              currentId={chat.conversationId || c}
              onOpen={(id) => {
                handleOpen(id);
                setShowMobileList(false);
              }}
              onNew={() => {
                handleNew();
                setShowMobileList(false);
              }}
              refreshSignal={refreshSignal}
            />
          </div>
        ) : null}

        <div
          className="vg-gutter"
          style={{
            flex: 1,
            maxWidth: "760px",
            width: "100%",
            boxSizing: "border-box",
            margin: "0 auto",
            paddingTop: "var(--space-4)",
            paddingBottom: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {chat.entries.length === 0 ? (
            <div data-testid="agent-empty" style={{ padding: "var(--space-8) 0", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
              {reportsState === "failed" ? (
                <PageState
                  kind="error"
                  title="Could not load your reports"
                  detail="Check that the backend is running, then try again."
                  action={{ label: "Try again", onClick: () => setReportsTick((t) => t + 1) }}
                />
              ) : reportsState === "ready" && reports.length === 0 ? (
                <PageState
                  kind="empty"
                  title="No reports yet"
                  detail="Upload a report first, then ask about it here."
                  action={{ label: "Upload a report", onClick: () => navigate("/upload") }}
                />
              ) : reportsState === "loading" ? (
                <PageState kind="loading" title="Loading your reports" />
              ) : (
                <>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em" }}>What would you like to know?</h2>
                    <p style={{ margin: "var(--space-2) 0 0", fontSize: "1rem", color: "var(--color-neutral-700)", maxWidth: "52ch" }}>
                      Ask about your reports. Every answer shows how it was found and cites the page it came from.
                    </p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "var(--space-3)" }}>
                    {suggestions.slice(0, 4).map((q) => (
                      <button key={q} type="button" onClick={() => submit(q)} className="vg-card">
                        <span style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.4 }}>{q}</span>
                        <span style={{ color: "var(--color-accent-700)" }}>
                          <Arrow size={16} />
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div data-testid="agent-threads" role="log" aria-live="polite" aria-relevant="additions">
              {chat.entries.map((entry, index) => (
                <EntryView
                  key={entry.id}
                  entry={entry}
                  isLast={index === chat.entries.length - 1}
                  onRetry={submit}
                  onAsk={submit}
                  onSaveReport={saveReport}
                  canRetry={composerReady && !chat.isStreaming}
                  getPages={getPages}
                />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          data-testid="agent-composer"
          className="vg-gutter"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSend) submit(input);
          }}
          style={{
            position: "sticky",
            bottom: 0,
            background: "var(--color-bg)",
            paddingTop: "var(--space-2)",
            paddingBottom: "var(--space-3)",
            margin: 0,
          }}
        >
          <div style={{ maxWidth: "760px", margin: "0 auto" }}>
            {reportParam ? (
              <div data-testid="agent-scope-chip" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)", paddingBottom: "var(--space-2)" }}>
                <span className="tag tag-neutral" style={{ fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                  {scope ? `Report: ${scope.original_filename}` : reportsState === "ready" ? "Report not found" : "Loading the report"}
                  <button
                    type="button"
                    className="vg-action"
                    aria-label="Use all my reports"
                    title="Use all my reports"
                    onClick={() => {
                      clearLoadedReport();
                      setSearchParams({});
                    }}
                    style={{ padding: "0 var(--space-1)" }}
                  >
                    ×
                  </button>
                </span>
                <span style={{ fontSize: "0.8125rem", color: "var(--color-neutral-700)" }}>
                  {scope ? "Answers use only this report." : "Answers use all your reports."}
                </span>
              </div>
            ) : null}
            <div className="vg-composer-box">
              <textarea
                ref={composerRef}
                data-testid="agent-input"
                value={input}
                rows={1}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    if (canSend && !chat.isStreaming) submit(input);
                  }
                }}
                maxLength={MAX_QUESTION_CHARS}
                disabled={!composerReady}
                aria-label="Your question"
                placeholder={placeholder}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-2) var(--space-2) var(--space-2) var(--space-4)" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>Enter to send · Shift+Enter for a new line</span>
                {chat.isStreaming ? (
                  <button type="button" className="btn btn-secondary" onClick={chat.stop} aria-label="Stop" style={{ minWidth: 0, padding: "var(--space-2) var(--space-3)", gap: "var(--space-2)" }}>
                    Stop
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <rect x="4" y="4" width="16" height="16" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    aria-label="Send"
                    aria-disabled={!canSend}
                    onClick={(e) => {
                      if (!canSend) e.preventDefault();
                    }}
                    style={{ minWidth: 0, padding: "var(--space-2) var(--space-3)", opacity: canSend ? 1 : 0.45 }}
                  >
                    <Arrow size={18} />
                  </button>
                )}
              </div>
            </div>
            <div style={{ paddingTop: "var(--space-2)", fontSize: "0.75rem", color: "var(--color-neutral-700)", textAlign: "center" }}>
              Educational tool. Not a diagnosis. Check the cited passage.
            </div>
          </div>
        </form>
      </div>

      {/* The report beside the chat */}
      {reportView ? (
        <aside
          style={
            isDesktop
              ? {
                  width: 520,
                  flex: "0 0 520px",
                  boxSizing: "border-box",
                  position: "sticky",
                  top: 0,
                  height: "calc(100vh - 114px)",
                  alignSelf: "flex-start",
                  borderLeft: "2px solid var(--color-divider)",
                }
              : { height: "calc(100vh - 114px)", borderTop: "2px solid var(--color-divider)" }
          }
        >
          <ReportPanel
            view={reportView}
            pdfUrl={(id) => agentApi.reportPdfUrl(effectiveUserId, id)}
            onClose={() => setReportView(null)}
            onOpen={openSavedReport}
            onDelete={deleteSavedReport}
            onList={showReportList}
          />
        </aside>
      ) : null}
    </div>
  );
};
