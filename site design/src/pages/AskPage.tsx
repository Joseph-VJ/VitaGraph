import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EvidenceSpanViewer, useToast } from "../components/gallery";
import { AgentThoughtTree } from "../components/agent/AgentThoughtTree";
import { ChatComposer, MAX_QUESTION_CHARS, MIN_QUESTION_CHARS, type AnswerMode } from "../components/agent/ChatComposer";
import { ChatTurn } from "../components/agent/ChatTurn";
import { DocumentPane } from "../components/agent/DocumentPane";
import type { TurnView } from "../components/agent/chatTypes";
import { useAgentStream } from "../hooks/useAgentStream";
import { useUser } from "../context/UserContext";
import { questionsApi } from "../api/questions";
import { reportsApi } from "../api/reports";
import { graphApi } from "../api/graph";
import type { Answer, EvidenceCard, Report } from "../types";
import { playChime, playThud, playDetent } from "../motion";
import { DetentPress } from "../motion/fx/DetentPress";

const SUGGESTED = [
  "What was my hemoglobin level?",
  "What were my fasting glucose and HbA1c values?",
  "Should I stop taking metformin based on my creatinine level?",
  "Diagnose my symptoms and prescribe an antibiotic",
];

const RESULT_POLL_MS = 400;
const RESULT_POLL_MAX = 10;
const STICK_THRESHOLD_PX = 80;

type SideTab = "document" | "activity";

interface LiveTurn {
  id: string;
  text: string;
  time: string;
}

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

export const AskPage: React.FC = () => {
  const { user } = useUser();
  const { addToast } = useToast();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";

  const stream = useAgentStream();
  const isStreaming = stream.status === "connecting" || stream.status === "streaming";

  const [searchParams, setSearchParams] = useSearchParams();
  const reportParam = searchParams.get("report");
  const [reports, setReports] = useState<Report[] | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [docSuggestions, setDocSuggestions] = useState<string[]>([]);
  const [mode, setMode] = useState<AnswerMode>("rag_ai");

  const [input, setInput] = useState("");
  // Finished questions are frozen copies; the newest one is "live" and reads straight from the stream.
  const [turns, setTurns] = useState<TurnView[]>([]);
  const [live, setLive] = useState<LiveTurn | null>(null);
  const [result, setResult] = useState<Answer | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [sideOpen, setSideOpen] = useState(isDesktop);
  const [sideTab, setSideTab] = useState<SideTab>("document");
  const [docTarget, setDocTarget] = useState<{ reportId: string | null; page: number }>({ reportId: null, page: 1 });
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceCard | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const reportsRef = useRef<Report[] | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearPoll, [clearPoll]);

  // Header search hands a question over as ?q=: prefill the composer, then drop q (keep report).
  const qParam = searchParams.get("q");
  useEffect(() => {
    if (!qParam) return;
    setInput(qParam);
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam]);

  // The user's documents feed both the document pane and the "chat with this PDF" scope.
  useEffect(() => {
    let cancelled = false;
    setReports(null);
    setReportsError(null);
    reportsApi
      .list(effectiveUserId)
      .then((list) => {
        if (cancelled) return;
        reportsRef.current = list;
        setReports(list);
      })
      .catch((err) => {
        if (!cancelled) setReportsError(err instanceof Error ? err.message : "Request failed");
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveUserId]);

  // "Chat with this PDF": ?report=<id> limits retrieval to that document.
  const scopeReport = useMemo(() => (reportParam ? reports?.find((r) => r.id === reportParam) ?? null : null), [reportParam, reports]);
  const scopeId = scopeReport?.id ?? null;

  // Suggested questions come from the document's real content (graph test names that appear in its pages).
  useEffect(() => {
    if (!scopeId) {
      setDocSuggestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [pages, graph] = await Promise.all([reportsApi.pages(scopeId), graphApi.getGraph(effectiveUserId)]);
        if (cancelled) return;
        const text = pages.map((p) => p.extracted_text ?? "").join(" ").toLowerCase();
        const labels = Array.from(
          new Set(
            graph.nodes
              .filter((n) => ["test", "biomarker"].includes(String(n.type)))
              .map((n) => String(n.label))
              .filter((l) => l.length > 2 && text.includes(l.toLowerCase()))
          )
        ).slice(0, 4);
        setDocSuggestions(labels.map((l) => `What does this report say about ${l}?`));
      } catch {
        if (!cancelled) setDocSuggestions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scopeId, effectiveUserId]);

  // Scoping to a PDF puts that PDF on screen.
  useEffect(() => {
    if (scopeId) setDocTarget({ reportId: scopeId, page: 1 });
  }, [scopeId]);

  // Pane document: an explicit pick, else the scoped PDF, else the newest ready report.
  const newestReady = useMemo(
    () => (reports ?? []).filter((r) => r.status === "ready").sort((a, b) => b.upload_time.localeCompare(a.upload_time))[0] ?? null,
    [reports]
  );
  const paneReportId = docTarget.reportId ?? scopeId ?? newestReady?.id ?? null;

  // The live turn as the UI shows it, derived from the stream and the persisted result.
  const isRefusal = result?.status === "refused";
  // If the backend safety check rejected the AI text, never show it: show the verified
  // evidence-only answer the backend persisted instead.
  const withheld = stream.answerWithheld || result?.ai_service_status === "replaced_by_fallback";
  const answerMarkdown = isRefusal ? "" : withheld ? result?.summary_text || "" : stream.finalAnswer || result?.summary_text || "";

  const liveView = useMemo<TurnView | null>(
    () =>
      live
        ? {
            id: live.id,
            text: live.text,
            time: live.time,
            answerMarkdown,
            result,
            withheld,
            isStreaming,
            stopped: stream.status === "idle" && !stream.finished,
            streamError: stream.status === "error" ? stream.error ?? "The stream failed." : null,
            streamEvidence: stream.evidence,
            trace: {
              thinkingLogs: stream.thinkingLogs,
              stageEvents: stream.stageEvents,
              toolCalls: stream.toolCalls,
              modelFallbacks: stream.modelFallbacks,
              error: stream.error,
              diagnostic: stream.diagnostic,
            },
          }
        : null,
    [
      live,
      answerMarkdown,
      result,
      withheld,
      isStreaming,
      stream.status,
      stream.finished,
      stream.error,
      stream.evidence,
      stream.thinkingLogs,
      stream.stageEvents,
      stream.toolCalls,
      stream.modelFallbacks,
      stream.diagnostic,
    ]
  );
  const liveRef = useRef<TurnView | null>(null);
  liveRef.current = liveView;

  const handleAsk = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length < MIN_QUESTION_CHARS || trimmed.length > MAX_QUESTION_CHARS || isStreaming) return;
      clearPoll();
      const previous = liveRef.current;
      if (previous) setTurns((t) => [...t, previous]);
      const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setLive({ id, text: trimmed, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
      setResult(null);
      setFocusId(null);
      setInput("");
      stickRef.current = true;
      setShowJump(false);
      stream.start(effectiveUserId, trimmed, id, { reportId: scopeReport?.id ?? null, mode });
    },
    [effectiveUserId, isStreaming, stream.start, clearPoll, scopeReport, mode]
  );

  const handleNewChat = useCallback(() => {
    clearPoll();
    stream.reset();
    setTurns([]);
    setLive(null);
    setResult(null);
    setFocusId(null);
    setInput("");
    stickRef.current = true;
    setShowJump(false);
  }, [clearPoll, stream.reset]);

  // After the terminal event, fetch the persisted answer: it carries full evidence
  // cards (report_id, offsets) and the refusal text, which is not streamed as deltas.
  useEffect(() => {
    if (!stream.finished || !live) return;
    let cancelled = false;
    let tries = 0;
    const poll = () => {
      questionsApi
        .result(live.id)
        .then((res) => {
          if (cancelled) return;
          if (res.result) {
            setResult(res.result);
            if (res.result.status === "refused" || stream.status === "error") playThud();
            else playChime(); // the answer on screen is the confirmation; no success toast
          } else if (++tries < RESULT_POLL_MAX) {
            pollTimerRef.current = setTimeout(poll, RESULT_POLL_MS);
          }
        })
        .catch(() => {
          if (!cancelled && ++tries < RESULT_POLL_MAX) pollTimerRef.current = setTimeout(poll, RESULT_POLL_MS);
        });
    };
    poll();
    return () => {
      cancelled = true;
      clearPoll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.finished, live?.id]);

  useEffect(() => {
    if (stream.status === "error") {
      playThud();
      addToast("failed", "Stream interrupted", stream.error ?? undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.status]);

  useEffect(() => {
    (window as any).__VG_TEST_ASK_QUESTION__ = handleAsk;
    return () => {
      delete (window as any).__VG_TEST_ASK_QUESTION__;
    };
  }, [handleAsk]);

  // Follow the conversation while the reader is at the bottom; leave them alone once they scroll up.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    stickRef.current = nearBottom;
    setShowJump((prev) => (prev === !nearBottom ? prev : !nearBottom));
  }, []);

  const scrollToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [turns.length, live?.id, answerMarkdown, result, stream.toolCalls.length, isStreaming]);

  // Citation chip -> EvidenceSpanViewer. Stream evidence lacks report_id, so resolve it from the reports list.
  const handleCite = useCallback(
    async (token: string, turn: TurnView) => {
      const t = token.toLowerCase();
      const pool: Array<Partial<EvidenceCard> & { chunk_id: string; report_filename: string }> = [
        ...(turn.result?.evidence ?? []),
        ...turn.streamEvidence,
      ];
      const match = pool
        .filter((e) => e.chunk_id.toLowerCase() === t || e.report_filename.toLowerCase() === t)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

      try {
        let reportId = match?.report_id;
        let filename = match?.report_filename ?? token;
        if (!reportId) {
          if (!reportsRef.current) reportsRef.current = await reportsApi.list(effectiveUserId);
          const rep = reportsRef.current.find((r) => r.original_filename.toLowerCase() === filename.toLowerCase());
          if (!rep) throw new Error(`No report named "${token}" found for this user.`);
          reportId = rep.id;
          filename = rep.original_filename;
        }
        setDocTarget({ reportId, page: match?.page_number ?? 1 });
        setSelectedEvidence({
          chunk_id: match?.chunk_id ?? "",
          report_id: reportId,
          report_filename: filename,
          report_date: match?.report_date ?? null,
          page_number: match?.page_number ?? 1,
          snippet: match?.snippet ?? "",
          score: match?.score ?? 0,
          char_start: match?.char_start ?? null,
          char_end: match?.char_end ?? null,
        });
        setViewerOpen(true);
        playDetent();
      } catch (err) {
        addToast("failed", "Citation unavailable", err instanceof Error ? err.message : undefined);
      }
    },
    [effectiveUserId, addToast]
  );

  const handleShowSteps = useCallback((turn: TurnView) => {
    setFocusId(turn.id);
    setSideTab("activity");
    setSideOpen(true);
  }, []);

  const handleScope = useCallback(
    (reportId: string | null) => {
      if (reportId) setSearchParams({ report: reportId });
      else setSearchParams({});
    },
    [setSearchParams]
  );

  const allTurns = liveView ? [...turns, liveView] : turns;
  const focused = (focusId && allTurns.find((t) => t.id === focusId)) || liveView || null;
  const suggestions = docSuggestions.length ? docSuggestions : SUGGESTED;
  const retrySuggestions = SUGGESTED.slice(0, 2);

  return (
    <div
      className="flex-1 min-h-[480px] min-w-0 flex relative overflow-hidden rounded-[var(--r-14)] border border-[var(--line-strong)] bg-[var(--ink-900)]"
      data-testid="ask-page"
    >
      {/* THE PAPER: conversation */}
      <section className="flex-1 min-w-0 flex flex-col" aria-label="Conversation">
        <header className="flex items-center justify-between gap-3 px-4 h-12 flex-shrink-0 border-b border-[var(--line-strong)]">
          <h2 className="m-0 type-card-title text-[16px] leading-[22px]">Conversation</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleNewChat}
              disabled={allTurns.length === 0}
              className="type-label whitespace-nowrap px-3 h-8 rounded-[var(--r-6)] text-[var(--bone)] hover:bg-[var(--ink-700)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
              data-testid="ask-new-chat"
            >
              New chat
            </button>
            {!sideOpen &&
              (["document", "activity"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setSideTab(tab);
                    setSideOpen(true);
                  }}
                  aria-expanded={false}
                  className="type-label whitespace-nowrap inline-flex items-center gap-2 px-3 h-8 rounded-[var(--r-6)] text-[var(--bone)] border border-[var(--line-control)] hover:bg-[var(--ink-700)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
                  data-testid={`ask-open-${tab}`}
                >
                  {tab === "activity" && isStreaming && <span className="w-2 h-2 rounded-full bg-[var(--solar-bronze)]" aria-hidden="true" />}
                  {tab === "document" ? "Document" : "Activity"}
                </button>
              ))}
          </div>
        </header>

        {reportParam && (
          <div
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 flex-shrink-0 bg-[var(--verdigris)]/10 border-b border-[var(--verdigris)]/50 px-4 py-2"
            data-testid="scope-chip"
          >
            <div className="min-w-0 text-[13px] text-[var(--text-main)]">
              <span className="text-[var(--dim)]">Chatting with </span>
              <strong className="font-semibold">{scopeReport?.original_filename ?? "your document"}</strong>
              {scopeReport && (
                <span className="text-[var(--dim)]">
                  {" "}({scopeReport.page_count === 1 ? "1 page" : `${scopeReport.page_count ?? "?"} pages`}). Answers use only this PDF.
                </span>
              )}
            </div>
            <button
              onClick={() => setSearchParams({})}
              className="text-[13px] text-[var(--link)] underline cursor-pointer flex-shrink-0 min-h-[24px]"
            >
              Use all my reports
            </button>
          </div>
        )}

        {/* Messages scroll here, not the page */}
        <div className="relative flex-1 min-h-0">
          <div ref={scrollRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto" data-testid="conversation-scroll">
            <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-6 min-h-full flex flex-col">
              {allTurns.length === 0 ? (
                <div className="my-auto py-8" data-testid="ask-empty">
                  <p className="type-card-title m-0">Ask about your reports</p>
                  <p className="type-body text-[var(--dim)] mt-2 mb-5 max-w-[52ch]">
                    Answers use only what is in your uploaded documents, and each one points to the page it came from. The agent&apos;s
                    steps appear in the activity panel as it works.
                  </p>
                  <span className="type-label text-[var(--dim)]">Try asking</span>
                  <ul className="list-none m-0 mt-2 p-0 flex flex-col gap-2 max-w-[520px]">
                    {suggestions.map((q) => (
                      <li key={q}>
                        <DetentPress>
                          <button
                            onClick={() => {
                              playDetent();
                              handleAsk(q);
                            }}
                            className="w-full px-3.5 py-2.5 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-control)] hover:border-[var(--accent)] text-[var(--bone)] type-body text-left transition-colors cursor-pointer"
                          >
                            {q}
                          </button>
                        </DetentPress>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex flex-col gap-8" data-testid="conversation-threads">
                  {allTurns.map((t) => (
                    <ChatTurn
                      key={t.id}
                      turn={t}
                      stepsFocused={sideOpen && sideTab === "activity" && focused?.id === t.id}
                      onCite={handleCite}
                      onAsk={handleAsk}
                      onShowSteps={handleShowSteps}
                      retrySuggestions={retrySuggestions}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {showJump && (
            <button
              type="button"
              onClick={scrollToLatest}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 type-label px-3.5 h-8 rounded-[var(--r-6)] bg-[var(--ink-800)] text-[var(--bone)] border border-[var(--line-control)] shadow-[var(--shadow-float)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
              data-testid="ask-jump-latest"
            >
              {isStreaming ? "Jump to latest" : "Back to latest"}
            </button>
          )}
        </div>

        {/* Composer docked to the bottom of the workspace */}
        <footer className="flex-shrink-0 border-t border-[var(--line-strong)] bg-[var(--ink-900)] px-4 sm:px-6 py-3">
          <div className="max-w-[760px] mx-auto">
            <ChatComposer
              value={input}
              onChange={setInput}
              onSend={handleAsk}
              onStop={stream.abort}
              isStreaming={isStreaming}
              mode={mode}
              onModeChange={setMode}
              scopeName={scopeReport?.original_filename}
            />
          </div>
        </footer>
      </section>

      {/* THE INSTRUMENT: the PDF being discussed and the agent's steps, inside the workspace */}
      {sideOpen && (
        <div
          className="chrome-dark absolute inset-0 z-20 flex flex-col bg-[var(--chrome)] lg:static lg:z-auto lg:w-[420px] xl:w-[460px] lg:flex-shrink-0 lg:border-l lg:border-[var(--chrome-line)]"
          data-testid="side-panel"
        >
          <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 flex-shrink-0">
            <div
              role="tablist"
              aria-label="Side panel"
              className="flex rounded-[var(--r-6)] border border-[var(--line-control)] overflow-hidden"
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  setSideTab((t) => (t === "document" ? "activity" : "document"));
                }
              }}
            >
              {(["document", "activity"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  id={`side-tab-${tab}`}
                  aria-selected={sideTab === tab}
                  aria-controls="side-panel-body"
                  tabIndex={sideTab === tab ? 0 : -1}
                  onClick={() => setSideTab(tab)}
                  className={`type-label inline-flex items-center gap-2 px-4 h-8 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus)] ${
                    sideTab === tab ? "bg-[var(--accent)] text-[var(--text-on-primary)]" : "bg-transparent text-[var(--dim)] hover:text-[var(--bone)]"
                  }`}
                  data-testid={`side-tab-${tab}`}
                >
                  {tab === "activity" && isStreaming && <span className="w-2 h-2 rounded-full bg-[var(--solar-bronze)]" aria-hidden="true" />}
                  {tab === "document" ? "Document" : "Activity"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSideOpen(false)}
              aria-label="Hide side panel"
              className="flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-[var(--r-6)] text-[var(--dim)] hover:text-[var(--bone)] hover:bg-[var(--steel-fog)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>

          <div id="side-panel-body" role="tabpanel" aria-labelledby={`side-tab-${sideTab}`} className="flex-1 min-h-0 flex flex-col">
            {sideTab === "document" ? (
              <DocumentPane
                reports={reports}
                loadError={reportsError}
                reportId={paneReportId}
                page={docTarget.page}
                onChange={(reportId, page) => setDocTarget({ reportId, page })}
                scopedReportId={scopeId}
                onScope={handleScope}
              />
            ) : (
              <AgentThoughtTree
                thinkingLogs={focused?.trace.thinkingLogs ?? []}
                stageEvents={focused?.trace.stageEvents ?? []}
                toolCalls={focused?.trace.toolCalls ?? []}
                modelFallbacks={focused?.trace.modelFallbacks ?? []}
                isStreaming={!!focused?.isStreaming}
                error={focused?.trace.error ?? null}
                diagnostic={focused?.trace.diagnostic ?? null}
                subtitle={focused?.text}
                className="flex-1 min-h-0"
              />
            )}
          </div>
        </div>
      )}

      <EvidenceSpanViewer evidence={selectedEvidence} isOpen={viewerOpen} onClose={() => setViewerOpen(false)} />
    </div>
  );
};
