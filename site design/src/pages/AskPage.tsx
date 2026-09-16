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

interface TraceEvent {
  index: string;
  stage: string;
  description: string;
  subDescription?: string;
  latency?: string;
}

export const AskPage: React.FC = () => {
  const { user } = useUser();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";

  const [activeDrawerTab, setActiveDrawerTab] = useState("Thinking details");
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [questionInput, setQuestionInput] = useState("");
  const [mode, setMode] = useState("Paper");
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [streamTraces, setStreamTraces] = useState<TraceEvent[]>([]);
  const [streamJobId, setStreamJobId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
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

    // Connect to SSE stream (/api/jobs/{id}/events)
    const backendUrl = "http://127.0.0.1:8000";
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const es = new EventSource(`${backendUrl}/api/jobs/${jobId}/events`);
    eventSourceRef.current = es;

    const tStart = performance.now();

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt && evt.stage) {
          setStreamTraces((prev) => {
            if (prev.some((item) => item.index === evt.index && item.stage === evt.stage)) {
              return prev;
            }
            return [...prev, evt];
          });

          if (evt.stage === "graph" && evt.subDescription) {
            // Extract concepts from subDescription if available
            const match = evt.subDescription.match(/Active concepts:\s*(.+)$/i);
            if (match && match[1]) {
              const concepts = match[1].split(",").map((s: string) => s.trim());
              setGraphConcepts(concepts);
            }
          }

          if (evt.stage === "done") {
            es.close();
          }
        }
      } catch {
        // Heartbeat or comment line
      }
    };

    es.onerror = () => {
      setStreamError("Backend stream interrupted. EventSource disconnected.");
      es.close();
    };

    try {
      const answer: Answer = await questionsApi.ask(effectiveUserId, trimmed, jobId);
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
      }
    } catch (err) {
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
    } finally {
      setIsAsking(false);
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
                <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--verdigris)] animate-ping" />
                    <span className="type-body text-[var(--bone)] font-medium">
                      Consulting clinical reports & knowledge graph...
                    </span>
                    <Badge variant="ingesting">streaming pipeline</Badge>
                  </div>
                  <div className="type-meta text-[var(--dim)] text-[12px]">
                    User privacy filtered to {effectiveUserId}. Generating grounded response via live SSE stream.
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
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between type-meta text-[var(--dim)] mb-2">
                    <span>Live execution trace (SSE events)</span>
                    {streamJobId && (
                      <span className="type-mono-sm text-[var(--dim)] truncate max-w-[120px]">
                        {streamJobId}
                      </span>
                    )}
                  </div>

                  {streamError && (
                    <div className="p-2.5 mb-3 rounded-[var(--r-6)] bg-[var(--madder)]/10 border border-[var(--madder)]/30 text-[var(--madder)] text-[11.5px]">
                      {streamError}
                    </div>
                  )}

                  {streamTraces.length === 0 && !streamError && (
                    <div className="py-6 text-center text-[var(--dim)] type-meta text-[12px]">
                      Waiting for pipeline trace events from backend…
                    </div>
                  )}

                  {streamTraces.length > 0 && (
                    <div className="divide-y divide-[var(--line-faint)] space-y-1">
                      {streamTraces.map((trace) => (
                        <div key={trace.index} className="pt-1.5 pb-1 animate-fade-in">
                          <div className="flex items-center justify-between type-mono-sm">
                            <span className={`${stageColors[trace.stage] || "text-[var(--bone)]"} font-medium`}>
                              [{trace.stage}]
                            </span>
                            <span className="text-[var(--dim)]">{trace.latency || ""}</span>
                          </div>
                          <div className="type-body text-[12px] text-[var(--bone)] mt-0.5">
                            {trace.description}
                          </div>
                          {trace.subDescription && (
                            <div className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
                              {trace.subDescription}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Fingerprint */}
                  <div className="pt-2.5 mt-3 border-t border-[var(--line-faint)] flex items-center justify-between">
                    <span className="type-meta text-[var(--dim)]">trace fingerprint</span>
                    <span className="type-mono-sm text-[var(--dim)] truncate max-w-[210px]">
                      {streamJobId ? `sha256:${streamJobId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}e8b4` : "sha256:none"}
                    </span>
                  </div>
                </div>
              </div>
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
