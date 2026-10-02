import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QuestionCard, RefusalCard, Button, EvidenceSpanViewer, useToast } from "../components/gallery";
import { AgentThoughtTree } from "../components/agent/AgentThoughtTree";
import { PaperAnswer } from "../components/agent/PaperAnswer";
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

export const AskPage: React.FC = () => {
  const { user } = useUser();
  const { addToast } = useToast();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";

  const stream = useAgentStream();
  const isStreaming = stream.status === "connecting" || stream.status === "streaming";

  const [searchParams, setSearchParams] = useSearchParams();
  const reportParam = searchParams.get("report");
  const [scopeReport, setScopeReport] = useState<Report | null>(null);
  const [docSuggestions, setDocSuggestions] = useState<string[]>([]);
  const [mode, setMode] = useState<"rag_ai" | "rag_only">("rag_ai");

  const [input, setInput] = useState("");
  const [question, setQuestion] = useState<{ text: string; time: string; jobId: string } | null>(null);
  const [result, setResult] = useState<Answer | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceCard | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const reportsRef = useRef<Report[] | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearPoll, [clearPoll]);

  // "Chat with this PDF": resolve the report from ?report=<id> and derive suggested questions
  // from the document's real content (graph test names that actually appear in its pages).
  useEffect(() => {
    if (!reportParam) {
      setScopeReport(null);
      setDocSuggestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const reports = await reportsApi.list(effectiveUserId);
        const rep = reports.find((r) => r.id === reportParam) ?? null;
        if (cancelled) return;
        setScopeReport(rep);
        if (!rep) return;
        reportsRef.current = reports;
        const [pages, graph] = await Promise.all([reportsApi.pages(rep.id), graphApi.getGraph(effectiveUserId)]);
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
        if (!cancelled) setScopeReport(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportParam, effectiveUserId]);

  const handleAsk = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      clearPoll();
      const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setQuestion({ text: trimmed, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), jobId });
      setResult(null);
      setInput("");
      stream.start(effectiveUserId, trimmed, jobId, { reportId: scopeReport?.id ?? null, mode });
    },
    [effectiveUserId, isStreaming, stream.start, clearPoll, scopeReport, mode]
  );

  // After the terminal event, fetch the persisted answer: it carries full evidence
  // cards (report_id, offsets) and the refusal text, which is not streamed as deltas.
  useEffect(() => {
    if (!stream.finished || !question) return;
    let cancelled = false;
    let tries = 0;
    const poll = () => {
      questionsApi
        .result(question.jobId)
        .then((res) => {
          if (cancelled) return;
          if (res.result) {
            setResult(res.result);
            if (res.result.status === "refused" || stream.status === "error") playThud();
            else {
              playChime();
              addToast("done", "Response complete", `${res.result.evidence?.length ?? 0} citations resolved`);
            }
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
  }, [stream.finished, question?.jobId]);

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

  const citations = useMemo(
    () => (result?.evidence?.length ? result.evidence : stream.evidence).map((e) => ({ chunk_id: e.chunk_id, report_filename: e.report_filename })),
    [result, stream.evidence]
  );

  // Citation chip -> EvidenceSpanViewer. Stream evidence lacks report_id, so resolve it from the reports list.
  const handleCite = useCallback(
    async (token: string) => {
      const t = token.toLowerCase();
      const pool: Array<Partial<EvidenceCard> & { chunk_id: string; report_filename: string }> = [
        ...(result?.evidence ?? []),
        ...stream.evidence,
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
    [result, stream.evidence, effectiveUserId, addToast]
  );

  const isRefusal = result?.status === "refused";
  // If the backend safety check rejected the AI text, never show it: show the verified
  // evidence-only answer the backend persisted instead.
  const withheld = stream.answerWithheld || result?.ai_service_status === "replaced_by_fallback";
  const answerMarkdown = isRefusal
    ? ""
    : withheld
    ? result?.summary_text || ""
    : stream.finalAnswer || result?.summary_text || "";
  const initial = user?.display_label ? user.display_label[0].toUpperCase() : "A";

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start w-full" data-testid="ask-page">
      {/* THE PAPER — answer column */}
      <div className="flex-1 flex flex-col gap-5 min-w-0 w-full">
        {reportParam && (
          <div
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[var(--r-10)] bg-[var(--verdigris)]/10 border border-[var(--verdigris)]/50 px-4 py-2.5 shadow-[var(--shadow-3d-sm)]"
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
              className="text-[13px] text-[var(--deep-petrol)] underline cursor-pointer flex-shrink-0 min-h-[24px]"
            >
              Use all my reports
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="type-label text-[var(--dim)] mr-1">Try asking</span>
          {(docSuggestions.length ? docSuggestions : SUGGESTED).map((q) => (
            <DetentPress key={q}>
              <button
                disabled={isStreaming}
                onClick={() => {
                  playDetent();
                  handleAsk(q);
                }}
                className="px-3 py-1.5 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-control)] hover:border-[var(--deep-petrol)] text-[var(--bone)] type-body text-[13px] leading-[18px] text-left transition-colors cursor-pointer disabled:opacity-50"
              >
                {q}
              </button>
            </DetentPress>
          ))}
        </div>

        {!question && (
          <div className="rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-8 sm:p-10">
            <p className="type-card-title m-0">Ask about your reports</p>
            <p className="type-body text-[var(--dim)] mt-2 mb-0 max-w-[52ch]">
              Answers use only what is in your uploaded documents, and each one points to the page it came from. The agent&apos;s steps appear beside the answer as it works.
            </p>
          </div>
        )}

        {question && (
          <div className="flex flex-col gap-5" data-testid="conversation-threads">
            <QuestionCard initial={initial} question={question.text} date={question.time} />

            {isRefusal && result && (
              <RefusalCard initial={initial} question={question.text} date={question.time} refusalText={result.summary_text} />
            )}

            {withheld && !isRefusal && (
              <div className="rounded-[var(--r-10)] border border-[var(--solar-bronze)] bg-[var(--solar-bronze)]/10 px-4 py-3 text-[13px] text-[var(--text-main)]" data-testid="withheld-note">
                <strong className="font-semibold">AI wording withheld.</strong> The safety check did not accept the AI&apos;s
                phrasing, so this is the verified evidence-only answer taken directly from your report.
              </div>
            )}

            {!isRefusal && answerMarkdown && (
              <PaperAnswer markdown={answerMarkdown} citations={citations} onCite={handleCite} isStreaming={isStreaming} />
            )}

            {!isRefusal && result?.evidence && result.evidence.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" data-testid="sources-row">
                <span className="type-label text-[var(--dim)]">Sources</span>
                {result.evidence.slice(0, 8).map((e) => (
                  <button
                    key={e.chunk_id}
                    onClick={() => handleCite(e.chunk_id)}
                    title={e.snippet}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--r-6)] bg-[var(--verdigris)] text-[var(--text-on-primary)] text-[12.5px] font-medium hover:brightness-110 cursor-pointer"
                  >
                    {e.report_filename}, page {e.page_number}, {(e.score * 100).toFixed(0)}% match
                  </button>
                ))}
              </div>
            )}

            {result?.status === "insufficient_evidence" && (
              <div className="rounded-[var(--r-10)] border border-[var(--solar-bronze)] bg-[var(--solar-bronze)]/10 p-4 text-[13px] text-[var(--text-main)]" data-testid="insufficient-note">
                <strong className="font-semibold">No AI answer was generated.</strong> None of your report passages matched this
                question above the 0.40 relevance floor, so VitaGraph did not call the AI rather than guess. Ask about a test or
                value in your reports, for example:
                <div className="flex flex-wrap gap-2 mt-2">
                  {SUGGESTED.slice(0, 2).map((q) => (
                    <button
                      key={q}
                      onClick={() => handleAsk(q)}
                      className="px-2.5 py-1 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)] shadow-[var(--shadow-3d-sm)] type-mono-sm text-[12px] cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isRefusal && !answerMarkdown && isStreaming && (
              <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-5 shadow-[var(--shadow-3d)] space-y-2.5" aria-busy="true">
                <div className="h-3.5 bg-[var(--ink-600)] rounded animate-pulse w-3/4" />
                <div className="h-3 bg-[var(--ink-600)] rounded animate-pulse w-1/2" />
                <div className="h-3 bg-[var(--ink-600)] rounded animate-pulse w-2/3" />
              </div>
            )}

            {stream.status === "error" && !answerMarkdown && (
              <div role="alert" className="rounded-[var(--r-10)] border border-[var(--madder)] bg-[var(--madder)]/10 p-4 text-[13px] text-[var(--madder)]">
                {stream.error ?? "The stream failed."} No answer was produced.
              </div>
            )}
          </div>
        )}

        <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-control)] shadow-[var(--shadow-float)] p-2.5 flex flex-wrap items-center gap-2 sticky bottom-14 sm:bottom-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk(input);
              }
            }}
            disabled={isStreaming}
            placeholder={isStreaming ? "Working on your question…" : "Ask about a result, a date or a trend in your reports"}
            className="flex-1 basis-full sm:basis-0 min-w-0 bg-transparent px-3 py-2 type-body text-[var(--bone)] placeholder-[var(--faint)] focus-visible:outline-2 focus-visible:outline-[var(--deep-petrol)] focus-visible:outline-offset-0 rounded-[var(--r-4)]"
            data-testid="ask-question-input"
          />
          <div role="radiogroup" aria-label="Answer mode" className="flex rounded-[var(--r-6)] border border-[var(--line-control)] overflow-hidden flex-shrink-0">
            {([
              ["rag_ai", "Evidence + AI", "Retrieve passages from your PDF, then the AI explains them"],
              ["rag_only", "Evidence only", "Show matching passages from your PDF without calling the AI"],
            ] as const).map(([value, label, hint]) => (
              <button
                key={value}
                role="radio"
                aria-checked={mode === value}
                title={hint}
                disabled={isStreaming}
                onClick={() => setMode(value)}
                className={`px-3 h-9 text-[13px] font-medium cursor-pointer transition-colors ${
                  mode === value ? "bg-[var(--deep-petrol)] text-[var(--text-on-primary)]" : "bg-transparent text-[var(--dim)] hover:text-[var(--bone)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {isStreaming && (
            <Button variant="ghost" className="h-9 px-3" onClick={stream.abort} data-testid="ask-stop-button">
              Stop
            </Button>
          )}
          <DetentPress>
            <Button
              variant="primary"
              className="h-9 px-4"
              disabled={isStreaming || !input.trim()}
              onClick={() => {
                playDetent();
                handleAsk(input);
              }}
              data-testid="ask-send-button"
            >
              {isStreaming ? "Working…" : "Send"}
            </Button>
          </DetentPress>
        </div>
      </div>

      {/* THE INSTRUMENT — telemetry column */}
      <AgentThoughtTree
        thinkingLogs={stream.thinkingLogs}
        stageEvents={stream.stageEvents}
        toolCalls={stream.toolCalls}
        modelFallbacks={stream.modelFallbacks}
        isStreaming={isStreaming}
        error={stream.error}
        diagnostic={stream.diagnostic}
      />

      <EvidenceSpanViewer evidence={selectedEvidence} isOpen={viewerOpen} onClose={() => setViewerOpen(false)} />
    </div>
  );
};
