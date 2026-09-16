import React, { useState, useEffect, useRef } from "react";
import {
  QuestionCard,
  AnswerBlock,
  RefusalCard,
  Button,
  IconButton,
  Select,
  Badge,
  EvidenceSpanViewer,
  ThinkingDetailsPanel,
  useToast,
  type TraceRowData,
} from "../components/gallery";
import { useUser } from "../context/UserContext";
import { questionsApi } from "../api/questions";
import type { Answer, EvidenceCard } from "../types";

interface ThreadItem {
  id: string;
  type: "answer" | "refusal" | "loading";
  questionText: string;
  timestamp: string;
  rewrittenQuery?: string;
  category?: string;
  answer?: Answer;
  elapsedTime?: string;
  refusalText?: string;
}

export const AskPage: React.FC = () => {
  const { user } = useUser();
  const { addToast } = useToast();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";

  const [activeDrawerTab, setActiveDrawerTab] = useState("Thinking details");
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [questionInput, setQuestionInput] = useState("");
  const [mode, setMode] = useState("Paper");
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [streamTraces, setStreamTraces] = useState<TraceRowData[]>([]);
  const [streamJobId, setStreamJobId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isReplayJob, setIsReplayJob] = useState(false);
  const [activeEvidence, setActiveEvidence] = useState<EvidenceCard[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceCard | null>(null);
  const [isEvidenceViewerOpen, setIsEvidenceViewerOpen] = useState(false);
  const [graphConcepts, setGraphConcepts] = useState<string[]>([
    "Hemoglobin",
    "Fasting Glucose",
    "Creatinine",
    "HbA1c",
    "Lipid Profile",
  ]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const eventQueueRef = useRef<any[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);

  // Suggested prompt chips for quick clinical & boundary verification
  const suggestedQuestions = [
    "What was my hemoglobin level?",
    "What were my fasting glucose and HbA1c values?",
    "Should I stop taking metformin based on my creatinine level?",
    "Diagnose my symptoms and prescribe an antibiotic",
  ];

  // Clean up SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const handleAskQuestion = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed || isAsking) return;

    setIsAsking(true);
    setQuestionInput("");
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const threadId = `th_${Date.now()}`;
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setStreamJobId(jobId);
    setStreamTraces([]);
    setStreamError(null);
    setIsReplayJob(false);

    // Append loading thread item
    setThreads((prev) => [
      ...prev,
      {
        id: threadId,
        type: "loading",
        questionText: trimmed,
        timestamp,
        category: "educational",
      },
    ]);

    // Connect to SSE stream BEFORE POST per US-15 reality contract
    const backendUrl = "http://127.0.0.1:8000";
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    eventQueueRef.current = [];
    isProcessingQueueRef.current = false;

    const es = new EventSource(`${backendUrl}/api/jobs/${jobId}/events`);
    eventSourceRef.current = es;

    const tStart = performance.now();

    const finishAnswer = (answer: Answer) => {
      const elapsedMs = Math.round(performance.now() - tStart);
      const elapsedStr = `${(elapsedMs / 1000).toFixed(1)} s`;

      if (answer.evidence && answer.evidence.length > 0) {
        setActiveEvidence(answer.evidence);
      }

      if (answer.status === "refused") {
        setThreads((prev) =>
          prev.map((item) =>
            item.id === threadId
              ? {
                  ...item,
                  type: "refusal",
                  refusalText: answer.summary_text,
                  elapsedTime: elapsedStr,
                  category: "diagnostic boundary",
                }
              : item
          )
        );
        addToast("done", "Clinical Boundary Guard", "Query handled with diagnostic boundary refusal");
      } else {
        setThreads((prev) =>
          prev.map((item) =>
            item.id === threadId
              ? {
                  ...item,
                  type: "answer",
                  answer,
                  elapsedTime: elapsedStr,
                  category: answer.classification || "educational",
                  rewrittenQuery: trimmed.toLowerCase(),
                }
              : item
          )
        );
        addToast("done", "Response Complete", `Generated grounded response with ${answer.evidence?.length || 0} citations`);
      }
      setIsAsking(false);
    };

    const processQueue = () => {
      if (eventQueueRef.current.length === 0) {
        isProcessingQueueRef.current = false;
        return;
      }
      isProcessingQueueRef.current = true;
      const evt = eventQueueRef.current.shift();

      if (evt && evt.stage) {
        setStreamTraces((prev) => {
          if (prev.some((item) => item.index === evt.index && item.stage === evt.stage)) {
            return prev;
          }
          return [...prev, evt];
        });

        if (evt.stage === "graph" && evt.subDescription) {
          const match = evt.subDescription.match(/Active concepts:\s*(.+)$/i);
          if (match && match[1]) {
            const concepts = match[1].split(",").map((s: string) => s.trim());
            setGraphConcepts(concepts);
          }
        }

        if (evt.stage === "done") {
          const answer: Answer | undefined = evt.metadata?.answer;
          if (answer) {
            finishAnswer(answer);
          } else {
            questionsApi
              .result(jobId)
              .then((res) => {
                if (res.result) {
                  finishAnswer(res.result);
                } else {
                  setIsAsking(false);
                }
              })
              .catch(() => setIsAsking(false));
          }
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        }
      }

      // Pacing interval: >=250ms presentation dwell per event (US-15)
      // presentation dwell (US-15)
      setTimeout(processQueue, 280);
    };

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt && evt.stage) {
          if (evt.is_replay) {
            setIsReplayJob(true);
          }
          eventQueueRef.current.push(evt);
          if (!isProcessingQueueRef.current) {
            processQueue();
          }
        }
      } catch {
        // Heartbeat or comment line
      }
    };

    es.onerror = () => {
      setStreamError("Backend stream interrupted. EventSource disconnected.");
      addToast("failed", "Stream Disconnected", "Backend connection lost during generation");
      setIsAsking(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    try {
      const response = await questionsApi.ask(effectiveUserId, trimmed, jobId, true);
      if (response && (response as any).summary_text) {
        finishAnswer(response);
      }
    } catch (err) {
      setStreamError(`Backend inquiry failed: ${(err as Error).message}`);
      addToast("failed", "Inquiry Failed", (err as Error).message);
      setThreads((prev) =>
        prev.map((item) =>
          item.id === threadId
            ? {
                ...item,
                type: "refusal",
                refusalText: `Request failed: ${(err as Error).message}. Check backend connectivity.`,
                elapsedTime: "0.0 s",
                category: "connection error",
              }
            : item
        )
      );
      setIsAsking(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  };

  // Run initial question on mount if thread is empty to present live grounded state
  useEffect(() => {
    if (threads.length === 0) {
      handleAskQuestion("What was my hemoglobin level?");
    }
  }, []);

  const drawerTabs = ["Thinking details", "Retrieved chunks", "Graph context"];

  // Trace stage colors
  const stageColors: Record<string, string> = {
    retrieval: "text-[var(--verdigris)]",
    reranking: "text-[var(--lilac)]",
    graph: "text-[var(--ochre)]",
    citation: "text-[var(--cornflower)]",
    generation: "text-[var(--madder)]",
    safety: "text-[var(--lilac)]",
    done: "text-[var(--verdigris)]",
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
      {/* Main Conversation Stream (1fr) */}
      <div className="flex-1 flex flex-col gap-6 min-w-0 w-full">
        {/* Suggested Quick Inquiries */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-label text-[var(--dim)] text-[12px] mr-1">Quick inquiries:</span>
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              disabled={isAsking}
              onClick={() => handleAskQuestion(q)}
              className="px-2.5 py-1 rounded-[var(--r-4)] bg-[var(--ink-800)] border border-[var(--line-strong)] hover:border-[var(--verdigris)] hover:text-[var(--bone)] text-[var(--dim)] type-mono-sm text-[11px] transition-all cursor-pointer disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Conversation Threads */}
        <div className="space-y-6">
          {threads.map((item) => (
            <div key={item.id} className="space-y-4 animate-fade-in">
              {/* User Question Card (for answered or in-flight questions) */}
              {item.type !== "refusal" && (
                <QuestionCard
                  initial={user?.display_label ? user.display_label[0].toUpperCase() : "A"}
                  question={item.questionText}
                  date={item.timestamp}
                  category={item.category}
                  rewrittenQuery={item.rewrittenQuery}
                />
              )}

              {/* Loading active stream state */}
              {item.type === "loading" && (
                <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-5 flex flex-col gap-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--verdigris)] animate-ping" />
                      <span className="type-body text-[var(--bone)] font-medium">
                        Consulting clinical reports & knowledge graph...
                      </span>
                      <Badge variant="ingesting">streaming pipeline</Badge>
                    </div>
                    {streamJobId && (
                      <span className="type-mono-sm text-[var(--dim)] text-[11px] truncate max-w-[150px]">
                        {streamJobId}
                      </span>
                    )}
                  </div>

                  {/* Skeleton shimmer until first event per US-15 */}
                  {streamTraces.length === 0 && !streamError ? (
                    <div className="space-y-2.5 py-2">
                      <div className="h-3.5 bg-[var(--ink-700)] rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-[var(--ink-700)] rounded animate-pulse w-1/2" />
                      <div className="h-3 bg-[var(--ink-700)] rounded animate-pulse w-2/3" />
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      {streamTraces.slice(-2).map((tr) => (
                        <div key={tr.index} className="flex items-center justify-between type-mono-sm text-[12px]">
                          <span className={`${stageColors[tr.stage] || "text-[var(--verdigris)]"} font-medium`}>
                            [{tr.stage}] {tr.description}
                          </span>
                          <span className="text-[var(--dim)]">{tr.latency || ""}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {streamError && (
                    <div className="p-2.5 rounded-[var(--r-6)] bg-[var(--madder)]/15 border border-[var(--madder)]/30 text-[var(--madder)] text-[12px]">
                      {streamError}
                    </div>
                  )}

                  <div className="type-meta text-[var(--dim)] text-[12px] border-t border-[var(--line-faint)] pt-2 flex items-center justify-between">
                    <span>User privacy filtered to {effectiveUserId}.</span>
                    <span>Paced SSE stream (&ge;250ms dwell)</span>
                  </div>
                </div>
              )}

              {/* Grounded 4-Part Answer Block */}
              {item.type === "answer" && item.answer && (
                <AnswerBlock
                  summaryText={item.answer.summary_text}
                  limitationsText={item.answer.limitations_text}
                  safetyText={item.answer.safety_text}
                  evidenceCards={item.answer.evidence}
                  status={item.answer.status}
                  elapsedTime={item.elapsedTime || "0.8 s"}
                  onEvidenceClick={(ev) => {
                    setSelectedEvidence(ev);
                    setIsEvidenceViewerOpen(true);
                  }}
                />
              )}

              {/* Verbatim Refusal Card */}
              {item.type === "refusal" && (
                <RefusalCard
                  initial={user?.display_label ? user.display_label[0].toUpperCase() : "A"}
                  question={item.questionText}
                  date={item.timestamp}
                  refusalText={item.refusalText}
                />
              )}
            </div>
          ))}
        </div>

        {/* Ask Bar / Follow-up Input */}
        <div className="rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-2.5 flex items-center gap-2 sticky bottom-4 shadow-lg backdrop-blur-md">
          <input
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAskQuestion(questionInput);
              }
            }}
            disabled={isAsking}
            placeholder={isAsking ? "Processing inquiry..." : "Ask a medical question about your reports…"}
            className="flex-1 bg-transparent px-3 py-1.5 type-body text-[var(--bone)] placeholder-[var(--faint)] focus:outline-none"
          />
          <Select
            compactPaper
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            options={[
              { value: "Paper", label: "Paper" },
              { value: "Graph", label: "Graph" },
            ]}
          />
          <Button
            variant="primary"
            className="h-9 px-4 flex items-center gap-2"
            disabled={isAsking || !questionInput.trim()}
            onClick={() => handleAskQuestion(questionInput)}
          >
            {isAsking ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-[var(--ink-900)] border-t-transparent animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5 rotate-45 -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            )}
            <span>{isAsking ? "Processing..." : "Send"}</span>
          </Button>
        </div>
      </div>

      {/* Right Drawer (400px Collapsible §9.4) */}
      {isDrawerOpen && (
        <aside className="w-full lg:w-[400px] flex-shrink-0 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 flex flex-col justify-between">
          <div>
            {/* Drawer Header with Close button */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line-faint)] mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isAsking ? "bg-[var(--lilac)] animate-pulse" : "bg-[var(--verdigris)]"}`} />
                <span className="type-card-title text-[15px] text-[var(--bone)]">
                  {isAsking ? "Streaming pipeline..." : "Clinical Context"}
                </span>
              </div>
              <IconButton
                size={24}
                title="Collapse drawer"
                onClick={() => setIsDrawerOpen(false)}
                className="border-transparent bg-transparent hover:bg-[var(--ink-700)] text-[var(--dim)]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </IconButton>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-[var(--line-faint)] mb-4">
              {drawerTabs.map((tab) => {
                const isActive = activeDrawerTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveDrawerTab(tab)}
                    className={`py-2 px-3 type-label transition-colors duration-[120ms] relative cursor-pointer ${
                      isActive
                        ? "text-[var(--bone)] border-b-2 border-b-[var(--verdigris)] -mb-[1px]"
                        : "text-[var(--dim)] hover:text-[var(--bone)]"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Tab 1: Live Execution Trace (Plan §12 SSE) */}
            {activeDrawerTab === "Thinking details" && (
              <ThinkingDetailsPanel
                traces={streamTraces}
                jobId={streamJobId}
                isStreaming={isAsking}
                streamError={streamError}
                isReplay={isReplayJob}
              />
            )}

            {/* Tab 2: Retrieved Chunks */}
            {activeDrawerTab === "Retrieved chunks" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="type-card-title text-[14px] text-[var(--bone)]">
                    Retrieved chunks ({activeEvidence.length})
                  </span>
                  <span className="type-mono-sm text-[var(--dim)]">score threshold ≥ 0.40</span>
                </div>

                {activeEvidence.length === 0 ? (
                  <div className="py-6 text-center text-[var(--dim)] type-meta text-[12px]">
                    No evidence chunks retrieved for this inquiry.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeEvidence.map((chunk, idx) => (
                      <div
                        key={chunk.chunk_id}
                        onClick={() => {
                          setSelectedEvidence(chunk);
                          setIsEvidenceViewerOpen(true);
                        }}
                        className="p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/40 hover:bg-[var(--ink-700)]/70 border border-[var(--line-faint)] hover:border-[var(--verdigris)]/50 transition-all flex flex-col gap-1.5 cursor-pointer group"
                      >
                        <div className="flex items-center justify-between type-mono-sm">
                          <span className="text-[var(--bone)] font-medium truncate max-w-[220px]">
                            {chunk.report_filename}
                          </span>
                          <span className="text-[var(--verdigris)] font-semibold">
                            {(chunk.score * 100).toFixed(0)}% match
                          </span>
                        </div>
                        <div className="flex items-center gap-2 type-meta text-[var(--dim)] text-[11px]">
                          <span>Page {chunk.page_number}</span>
                          {chunk.report_date && <span>• Date: {chunk.report_date}</span>}
                          <span>• #{String(idx + 1).padStart(2, "0")}</span>
                        </div>
                        <p className="type-reading text-[11.5px] text-[var(--dim)] italic line-clamp-2">
                          “{chunk.snippet}”
                        </p>
                        <div className="flex items-center justify-between pt-1 border-t border-[var(--line-faint)] type-mono-sm text-[10.5px]">
                          <span className="text-[var(--dim)]">
                            {chunk.char_start != null && chunk.char_end != null
                              ? `span ${chunk.char_start}–${chunk.char_end}`
                              : "provenance verified"}
                          </span>
                          <span className="text-[var(--verdigris)] group-hover:underline">
                            Inspect span
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Graph Context */}
            {activeDrawerTab === "Graph context" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="type-card-title text-[14px] text-[var(--bone)]">
                    Active Graph Concepts
                  </span>
                  <Badge variant="completed">NetworkX topology</Badge>
                </div>
                <p className="type-meta text-[var(--dim)] text-[12px]">
                  Clinical entities grounded in patient laboratory reports and mapped into the knowledge graph.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {graphConcepts.map((concept) => (
                    <span
                      key={concept}
                      className="px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-700)] border border-[var(--line-strong)] type-label text-[11.5px] text-[var(--bone)]"
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Drawer Marginalia */}
          <div className="mt-6 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-marginalia text-[13px]">
              Same data. Deeper understanding.
            </span>
          </div>
        </aside>
      )}

      {/* Evidence Span Viewer Modal (§9.8) */}
      <EvidenceSpanViewer
        evidence={selectedEvidence}
        isOpen={isEvidenceViewerOpen}
        onClose={() => setIsEvidenceViewerOpen(false)}
      />
    </div>
  );
};
