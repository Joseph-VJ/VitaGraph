import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useActiveUser } from "../context/UserContext";
import { reportsApi } from "../api/reports";
import { graphApi } from "../api/graph";
import type { Report, ReportPage } from "../types";
import { useAgentChat, type AgentEntry, type AgentEvidence } from "../hooks/useAgentChat";
import { AnswerMarkdown, citedRefs } from "../components/agent/AnswerMarkdown";
import { EvidenceModules } from "../components/agent/EvidenceModules";
import { PassageSlip } from "../components/agent/PassageSlip";
import { TrajectoryPanel } from "../components/agent/TrajectoryPanel";
import { ConversationList, useConversationList } from "../components/agent/ConversationList";
import { ScopePicker } from "../components/agent/ScopePicker";
import { SidePanel, chartTabKey, chartTabTitle, pageTabKey, reportTabKey, REPORTS_TAB_KEY, type PanelTab } from "../components/agent/SidePanel";
import type { ChartSpec } from "../lib/chartSpec";
import { useAgentActivity } from "../hooks/useAgentActivity";
import { agentRuns } from "../lib/agentRuns";
import { PageState, PersonaState } from "../components/ui";
import { clearLoadedReport, getLoadedReportId } from "../lib/loadedReport";
import { extractReport, reportTitle, splitFollowUps, stabilizeMarkdown, verifiedFacts } from "../lib/answerFormat";
import { agentApi, type ReportRequest } from "../api/agent";
import { LedgerDrawer } from "../components/privacy/LedgerDrawer";
import { formatNumber } from "../lib/privacyFormat";

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

/** A report title from the question: whole words only, with an ellipsis when it was shortened. */
function shortTitle(question: string, limit = 80): string {
  const text = question.trim().replace(/\s+/g, " ");
  if (text.length <= limit) return text;
  let cut = text.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  if (space > limit / 2) cut = cut.slice(0, space);
  return `${cut.replace(/[\s,.;:-]+$/, "")}…`;
}

interface EntryViewProps {
  entry: AgentEntry;
  isLast: boolean;
  onRetry: (question: string) => void;
  onAsk: (question: string) => void;
  onSaveReport: (payload: Pick<ReportRequest, "title" | "markdown" | "refs">) => void;
  canRetry: boolean;
  getPages: (reportId: string) => Promise<ReportPage[]>;
  userId: string;
  onOpenChart: (spec: ChartSpec) => void;
  onOpenPage: (card: AgentEvidence) => void;
}

const CopyIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" />
    <path d="M5 15V5h10" />
  </svg>
);

const EntryView: React.FC<EntryViewProps> = ({ entry, isLast, onRetry, onAsk, onSaveReport, canRetry, getPages, userId, onOpenChart, onOpenPage }) => {
  const [showSent, setShowSent] = useState(false);
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
    const shortQuestion = shortTitle(entry.question);
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
        <AnswerMarkdown text={shown} cards={byRef} facts={facts} onCite={toggleRef} onReport={(markdown) => saveReport(markdown)} emphasizeLede={!streaming} userId={userId} onChart={onOpenChart} streaming={streaming} />
      </div>
    );
  }

  const answered = entry.status === "answered" && !entry.withheld && shown.trim().length > 0;

  // What the Privacy Shield did for this answer, summed over its model calls.
  const privacyItems = entry.trajectory.filter((i) => i.kind === "privacy" && i.privacy);
  const privacyCalls = privacyItems.length;
  const privacyRemoved = privacyItems.reduce((sum, i) => sum + (i.privacy?.removed ?? 0), 0);
  const privacyChars = privacyItems.reduce((sum, i) => sum + (i.privacy?.charsSent ?? 0), 0);
  const privacyIds = privacyItems.map((i) => i.privacy?.ledgerId ?? "").filter(Boolean);

  return (
    <article style={{ paddingBottom: "var(--space-8)" }} data-testid="agent-entry">
      <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: "var(--space-6)" }}>
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
            color: "var(--agent-on-accent, var(--color-bg))",
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

          {!streaming && privacyCalls > 0 ? (
            <div data-testid="agent-privacy" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-1) 0" }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, flex: "none", background: "var(--color-accent)" }} />
              <span style={{ fontSize: "0.8125rem", color: "var(--color-neutral-700)", fontVariantNumeric: "tabular-nums" }}>
                Privacy Shield ·{" "}
                {privacyRemoved > 0
                  ? `${privacyRemoved} ${privacyRemoved === 1 ? "detail" : "details"} hidden in ${privacyCalls} AI ${privacyCalls === 1 ? "call" : "calls"} · ${formatNumber(privacyChars)} characters sent`
                  : `nothing personal found in ${privacyCalls} AI ${privacyCalls === 1 ? "call" : "calls"} · ${formatNumber(privacyChars)} characters sent`}
              </span>
              {privacyIds.length > 0 && userId ? (
                <button type="button" className="vg-action" onClick={() => setShowSent(true)} data-testid="agent-privacy-open">
                  See what was sent
                </button>
              ) : null}
            </div>
          ) : null}
          {showSent && userId ? <LedgerDrawer userId={userId} scope="persona" rowIds={privacyIds} onClose={() => setShowSent(false)} /> : null}

          {answered && showDetails && citedCards.length > 0 ? (
            <EvidenceModules cards={citedCards} openRefs={openRefs} onToggle={toggleRef} aiUsed={entry.aiStatus === "ok"} />
          ) : null}
          {openCards.length > 0 ? (
            <div ref={slipsRef}>
              {openCards.map((card) => (
                <PassageSlip key={card.ref} card={card} getPages={getPages} onOpenPage={() => onOpenPage(card)} />
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

const CHART_PREFILL = "Show a chart of ";
const REPORT_PREFILL = "Write a report about ";
const HISTORY_WIDTH = 264;

const Glyph: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2, strokeLinecap: "square" }} aria-hidden="true">
    {children}
  </svg>
);

export const AgentPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: personaLoading, refreshUsers } = useActiveUser();
  const effectiveUserId = user?.id ?? "";
  const chat = useAgentChat();
  const activity = useAgentActivity();
  const [searchParams, setSearchParams] = useSearchParams();
  const reportParam = searchParams.get("report");
  const qParam = searchParams.get("q");

  const [reports, setReports] = useState<Report[]>([]);
  const [reportsState, setReportsState] = useState<ReportsState>("loading");
  const [reportsTick, setReportsTick] = useState(0);
  const [topTests, setTopTests] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
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
  const input = chat.draft;
  const setInput = chat.setDraft;

  /* ---------- the chat list (History and the title in the top bar) ---------- */
  const [refreshSignal, setRefreshSignal] = useState(0);
  const convs = useConversationList(effectiveUserId, refreshSignal);
  // A new chat shows in History as soon as it starts, and the list refreshes whenever any answer starts or ends.
  const runningKey = chat.runningIds.join(",");
  useEffect(() => {
    setRefreshSignal((s) => s + 1);
  }, [chat.conversationId, runningKey, activity.running.length, activity.ready.length]);

  const runningIds = useMemo(
    () => Array.from(new Set([...activity.running.map((r) => r.conversationId), ...chat.runningIds])),
    [activity.running, chat.runningIds]
  );
  const readyIds = useMemo(() => activity.ready.map((r) => r.conversationId), [activity.ready]);

  // Looking at a chat whose answer finished clears its "ready" mark.
  const { markSeen } = activity;
  useEffect(() => {
    if (chat.conversationId && readyIds.includes(chat.conversationId)) markSeen(chat.conversationId);
  }, [chat.conversationId, readyIds, markSeen]);

  /* ---------- the side panel ---------- */
  const [tabs, setTabs] = useState<PanelTab[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelFull, setPanelFull] = useState(false);
  const [reportsVersion, setReportsVersion] = useState(0);
  const pendingSeq = useRef(0);

  // Opening something that is already open focuses its tab instead of adding a copy.
  const openTab = useCallback((tab: PanelTab) => {
    setTabs((current) => (current.some((t) => t.key === tab.key) ? current : [...current, tab]));
    setActiveKey(tab.key);
    setPanelOpen(true);
    setShowMobileList(false);
  }, []);

  const closeTab = useCallback((key: string) => {
    setTabs((current) => {
      const index = current.findIndex((t) => t.key === key);
      if (index < 0) return current;
      const next = current.filter((t) => t.key !== key);
      setActiveKey((active) => (active === key ? next[Math.min(index, next.length - 1)]?.key ?? null : active));
      if (next.length === 0) setPanelOpen(false);
      return next;
    });
  }, []);

  const openReportsList = useCallback(() => openTab({ key: REPORTS_TAB_KEY, kind: "reports", title: "Saved reports" }), [openTab]);
  const openSavedReport = useCallback(
    (id: string, title: string) => openTab({ key: reportTabKey(id), kind: "report", title, reportId: id }),
    [openTab]
  );
  const openChart = useCallback(
    (spec: ChartSpec) => openTab({ key: chartTabKey(spec), kind: "chart", title: chartTabTitle(spec), spec }),
    [openTab]
  );
  const openPage = useCallback(
    (card: AgentEvidence) =>
      openTab({
        key: pageTabKey(card.report_id, card.page_number, card.char_start, card.char_end),
        kind: "page",
        title: `${card.report_filename} · p.${card.page_number}`,
        reportId: card.report_id,
        page: card.page_number,
        charStart: card.char_start,
        charEnd: card.char_end,
        label: card.report_filename,
      }),
    [openTab]
  );

  // A report the agent wrote, or an answer turned into a report. The server saves it once; saving again
  // returns the same report, so its tab is focused rather than doubled.
  const saveReport = async (payload: Pick<ReportRequest, "title" | "markdown" | "refs">) => {
    const pendingKey = `pending:${++pendingSeq.current}`;
    openTab({ key: pendingKey, kind: "report", title: payload.title, reportId: null });
    try {
      const saved = await agentApi.createReport({ ...payload, user_id: effectiveUserId, conversation_id: chat.conversationId });
      const key = reportTabKey(saved.id);
      const tab: PanelTab = { key, kind: "report", title: saved.title, reportId: saved.id, report: saved };
      setTabs((current) => {
        if (current.some((t) => t.key === key)) return current.filter((t) => t.key !== pendingKey);
        return current.map((t) => (t.key === pendingKey ? tab : t));
      });
      setActiveKey(key);
      setReportsVersion((v) => v + 1);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setTabs((current) => current.map((t) => (t.key === pendingKey && t.kind === "report" ? { ...t, error: message } : t)));
    }
  };

  const panelNarrow = !isDesktop;
  const panelShown = panelOpen && tabs.length > 0;
  const togglePanel = () => {
    if (panelShown) {
      setPanelOpen(false);
    } else if (tabs.length > 0) {
      setPanelOpen(true);
      setShowMobileList(false);
    } else {
      openReportsList();
    }
  };
  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setPanelFull(false);
  }, []);
  const toggleFull = useCallback(() => setPanelFull((v) => !v), []);

  /* ---------- opening, starting and switching chats ---------- */
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
    setShowMobileList(false);
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
      setShowMobileList(false);
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

  // A different persona starts a fresh conversation and an empty panel.
  const prevUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevUserRef.current && prevUserRef.current !== effectiveUserId) {
      chat.reset();
      pagesCache.current.clear();
      loadedRef.current = null;
      setTabs([]);
      setActiveKey(null);
      setPanelOpen(false);
      setPanelFull(false);
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

  const setScope = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) {
      next.set("report", id);
    } else {
      next.delete("report");
      clearLoadedReport();
    }
    setSearchParams(next, { replace: true });
  };

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

  const waiting = chat.isRunningElsewhere;

  const submit = (text: string) => {
    const question = text.trim();
    if (question.length < MIN_QUESTION_CHARS || chat.isStreaming || waiting || !composerReady) return;
    stickRef.current = true;
    chat.send(effectiveUserId, question, scope?.id ?? null);
    setInput("");
  };

  // "Chart" and "Write a report" only put the start of a request into the box.
  const prefill = (prefix: string) => {
    const rest = [CHART_PREFILL, REPORT_PREFILL].reduce((text, p) => (text.startsWith(p) ? text.slice(p.length) : text), input);
    setInput(prefix + rest);
    window.requestAnimationFrame(() => {
      const el = composerRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(prefix.length, prefix.length);
    });
  };

  // Follow the answer while the reader is at the bottom; leave them alone once they scroll up.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onScroll = () => {
      stickRef.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < STICK_THRESHOLD_PX;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [effectiveUserId]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (scroller && stickRef.current) scroller.scrollTop = scroller.scrollHeight;
  }, [chat.entries]);

  /* ---------- the chat title in the top bar ---------- */
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleButtonRef = useRef<HTMLButtonElement>(null);
  const currentItem = convs.items.find((i) => i.id === chat.conversationId) ?? null;
  const firstEntry = chat.entries[0];
  const chatTitle =
    currentItem?.title || firstEntry?.title || (firstEntry ? firstEntry.question.trim().slice(0, 70) : "") || "New chat";
  const canRename = Boolean(chat.conversationId) && chat.entries.length > 0;

  const saveTitle = async () => {
    const title = titleDraft.trim().slice(0, 120);
    setEditingTitle(false);
    titleButtonRef.current?.focus();
    const id = chat.conversationId;
    if (!id || !title || title === chatTitle) return;
    setTitleError(null);
    try {
      convs.replace(await agentApi.updateConversation(effectiveUserId, id, { title }));
      setRefreshSignal((s) => s + 1);
    } catch (e) {
      setTitleError(e instanceof Error ? e.message : "Could not rename this chat.");
    }
  };

  useEffect(() => {
    setEditingTitle(false);
    setTitleError(null);
  }, [chat.conversationId]);

  if (!effectiveUserId) {
    return (
      <div
        data-screen-label="AI Agent"
        data-testid="agent-page"
        className="vg-agent-page vg-agent-persona-state"
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <PersonaState loading={personaLoading} onRetry={refreshUsers} />
        </div>
      </div>
    );
  }

  const placeholder = composerReady
    ? "Ask about a value, a trend or a report"
    : reportsState === "loading"
    ? "Loading your reports"
    : "Upload a report to start asking";
  const canSend = composerReady && !waiting && input.trim().length >= MIN_QUESTION_CHARS;
  const historyShown = isDesktop && historyOpen;

  const list = (
    <ConversationList
      userId={effectiveUserId}
      currentId={chat.conversationId || c}
      items={convs.items}
      loading={convs.loading}
      error={convs.error}
      onReload={() => void convs.reload()}
      onUpdated={convs.replace}
      onRemoved={(id) => {
        agentRuns.forget(id);
        convs.remove(id);
      }}
      onOpen={handleOpen}
      onNew={handleNew}
      runningIds={runningIds}
      readyIds={readyIds}
    />
  );

  return (
    <div data-screen-label="AI Agent" data-testid="agent-page" className="vg-agent-page">
      {/* History column (desktop) */}
      {historyShown ? (
        <aside className="vg-agent-history-col" style={{ width: HISTORY_WIDTH, flex: `0 0 ${HISTORY_WIDTH}px` }}>
          {list}
        </aside>
      ) : null}

      {/* History drawer (narrow screens) */}
      {!isDesktop && showMobileList ? (
        <>
          <div className="vg-agent-scrim" aria-hidden="true" onClick={() => setShowMobileList(false)} />
          <aside
            className="vg-agent-drawer"
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowMobileList(false);
            }}
          >
            {list}
          </aside>
        </>
      ) : null}

      {/* The chat */}
      <div className="vg-agent-chat">
        <div className="vg-agent-topbar" data-testid="agent-topbar">
          <div className="vg-agent-titlewrap">
            {editingTitle ? (
              <input
                autoFocus
                className="input vg-agent-titleinput"
                data-testid="agent-title-input"
                aria-label="Chat name"
                value={titleDraft}
                maxLength={120}
                onChange={(e) => setTitleDraft(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveTitle();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setEditingTitle(false);
                    titleButtonRef.current?.focus();
                  }
                }}
                onBlur={() => setEditingTitle(false)}
              />
            ) : (
              <>
                <h2 className="vg-agent-title" data-testid="agent-title" title={chatTitle}>
                  {chatTitle}
                </h2>
                {canRename ? (
                  <button
                    ref={titleButtonRef}
                    type="button"
                    className="vg-action"
                    aria-label="Rename this chat"
                    title="Rename this chat"
                    data-testid="agent-title-edit"
                    onClick={() => {
                      setTitleDraft(chatTitle);
                      setEditingTitle(true);
                    }}
                  >
                    <Glyph>
                      <path d="M4 20h4L19 9l-4-4L4 16z" />
                      <path d="m13 7 4 4" />
                    </Glyph>
                  </button>
                ) : null}
              </>
            )}
            {reportParam ? (
              <span data-testid="agent-scope-chip" className="tag tag-neutral vg-agent-chip">
                <span className="vg-agent-chip-text">
                  {scope ? `Report: ${scope.original_filename}` : reportsState === "ready" ? "Report not found" : "Loading the report"}
                </span>
                <button type="button" className="vg-action" aria-label="Use all my reports" title="Use all my reports" onClick={() => setScope(null)} style={{ padding: "0 var(--space-1)" }}>
                  ×
                </button>
              </span>
            ) : null}
          </div>
          <div className="vg-agent-topactions">
            <button
              type="button"
              className="vg-action"
              data-testid="agent-history-toggle"
              aria-expanded={isDesktop ? historyOpen : showMobileList}
              onClick={() => (isDesktop ? toggleHistory() : setShowMobileList((prev) => !prev))}
            >
              <Glyph>
                <path d="M4 6h16M4 12h16M4 18h10" />
              </Glyph>
              History
            </button>
            <button type="button" className="vg-action" data-testid="agent-reports-toggle" aria-expanded={panelShown} onClick={togglePanel}>
              <Glyph>
                <path d="M3 4h18v16H3z" />
                <path d="M15 4v16" />
              </Glyph>
              Panel
            </button>
            <button type="button" className="vg-action" onClick={handleNew} data-testid="agent-new-chat">
              + New chat
            </button>
          </div>
          {titleError ? (
            <div role="alert" className="vg-agent-note vg-agent-note-error" style={{ flexBasis: "100%" }}>
              {titleError}
            </div>
          ) : null}
        </div>

        <div ref={scrollRef} className="vg-agent-scroll">
          <div className="vg-agent-thread">
            {chat.entries.length === 0 ? (
              <div data-testid="agent-empty" style={{ padding: "var(--space-8) 0", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
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
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(260px,100%),1fr))", gap: "var(--space-3)" }}>
                      {suggestions.slice(0, 4).map((q) => (
                        <button key={q} type="button" onClick={() => submit(q)} className="vg-card" disabled={waiting}>
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
                    canRetry={composerReady && !chat.isStreaming && !waiting}
                    getPages={getPages}
                    userId={effectiveUserId}
                    onOpenChart={openChart}
                    onOpenPage={openPage}
                  />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <form
          data-testid="agent-composer"
          className="vg-agent-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSend) submit(input);
          }}
        >
          <div className="vg-agent-composer-inner">
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
              <div className="vg-agent-composer-bar">
                <div className="vg-agent-tools" role="group" aria-label="Question helpers">
                  <ScopePicker reports={reports} value={reportParam} loading={reportsState === "loading"} disabled={!composerReady && reportsState !== "ready"} onChange={setScope} />
                  <button type="button" className="vg-agent-tool" data-testid="agent-prefill-chart" disabled={!composerReady} onClick={() => prefill(CHART_PREFILL)}>
                    <Glyph>
                      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
                    </Glyph>
                    Chart
                  </button>
                  <button type="button" className="vg-agent-tool" data-testid="agent-prefill-report" disabled={!composerReady} onClick={() => prefill(REPORT_PREFILL)}>
                    <Glyph>
                      <path d="M7 3h8l4 4v14H7z" />
                      <path d="M10 13h6M10 17h6" />
                    </Glyph>
                    Write a report
                  </button>
                </div>
                {chat.isStreaming ? (
                  <button type="button" className="btn btn-secondary vg-agent-sendbtn" onClick={chat.stop} aria-label="Stop" style={{ gap: "var(--space-2)" }}>
                    Stop
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <rect x="4" y="4" width="16" height="16" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="btn btn-primary vg-agent-sendbtn"
                    aria-label="Send"
                    aria-disabled={!canSend}
                    onClick={(e) => {
                      if (!canSend) e.preventDefault();
                    }}
                    style={{ opacity: canSend ? 1 : 0.45 }}
                  >
                    <Arrow size={18} />
                  </button>
                )}
              </div>
            </div>
            {waiting ? (
              <div role="status" data-testid="agent-waiting" className="vg-agent-hint" style={{ color: "var(--color-accent-800)", fontWeight: 600 }}>
                Another chat is still answering.
              </div>
            ) : null}
            <div className="vg-agent-hint">Enter to send · Shift+Enter for a new line. Educational tool. Not a diagnosis. Check the cited passage.</div>
          </div>
        </form>
      </div>

      {/* The side panel */}
      {panelShown ? (
        <SidePanel
          userId={effectiveUserId}
          tabs={tabs}
          activeKey={activeKey}
          onActivate={setActiveKey}
          onCloseTab={closeTab}
          onClose={closePanel}
          onOpenReport={openSavedReport}
          onOpenList={openReportsList}
          onReportDeleted={(id) => closeTab(reportTabKey(id))}
          reportsVersion={reportsVersion}
          full={panelFull}
          onToggleFull={toggleFull}
          narrow={panelNarrow}
          reserve={historyShown ? HISTORY_WIDTH : 0}
        />
      ) : null}
    </div>
  );
};
