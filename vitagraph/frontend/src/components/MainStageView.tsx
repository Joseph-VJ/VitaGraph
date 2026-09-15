import { useState } from "react";
import { KnowledgeGraphCanvas } from "./KnowledgeGraphCanvas";
import { AiChatAssistant } from "./AiChatAssistant";
import { DEMO_QUESTIONS } from "../data/mockData";
import type { ReportPage, Answer } from "../types";
import type { GraphResponse } from "../api/graph";
import type { ReportAnalysisResponse } from "../api/ai";

export interface FindingItem {
  test_name: string;
  value: number;
  unit: string;
  page_number: number;
  flag?: string;
  reference_range?: string;
}

export function MainStageView({
  currentStage,
  saveChoice,
  onChooseSave,
  onNext,
  onBack,
  onGoToStage,
  onLogDetailed,
  onLogSimple: _onLogSimple,
  activeReportName = "Arjun_Lab_Report_Feb2026.pdf",
  onUploadFile,
  extractedPages = [],
  extractedFindings = [],
  chromaChunkCount = null,
  liveAnswer = null,
  graphData = null,
  activeConcepts = [],
  activePersonaId = "VG-2026-001",
  activePersonaName = "Arjun R",
  activePersonaReportsCount = 3,
  onRunRAGQuery,
  isSearching = false,
  hasApiKey = false,
  aiServiceModel = null,
  onOpenAiSettings,
  aiReportSummary = null,
  isAnalyzingReport = false,
  onAnalyzeReport,
}: {
  currentStage: number;
  saveChoice: boolean | null;
  onChooseSave: (val: boolean) => void;
  onNext: () => void;
  onBack: () => void;
  onGoToStage: (index: number) => void;
  onLogDetailed: (msg: string, type?: "tool" | "py" | "db" | "llm" | "ok" | "warn" | "info") => void;
  onLogSimple: (msg: string) => void;
  activeReportName?: string;
  onUploadFile?: (file: File) => void;
  extractedPages?: ReportPage[];
  extractedFindings?: FindingItem[];
  chromaChunkCount?: number | null;
  liveAnswer?: Answer | null;
  graphData?: GraphResponse | null;
  activeConcepts?: string[];
  activePersonaId?: string;
  activePersonaName?: string;
  activePersonaReportsCount?: number;
  onRunRAGQuery?: (question: string) => void;
  isSearching?: boolean;
  hasApiKey?: boolean;
  aiServiceModel?: string | null;
  onOpenAiSettings?: () => void;
  aiReportSummary?: ReportAnalysisResponse | null;
  isAnalyzingReport?: boolean;
  onAnalyzeReport?: () => void;
}) {
  const [graphKey, setGraphKey] = useState(0);
  const [brainStep, setBrainStep] = useState(5);

  const q = DEMO_QUESTIONS[0];

  const handleWatchGraphAgain = () => {
    setGraphKey((k) => k + 1);
    if (graphData) {
      onLogDetailed(
        `[NetworkX] build_user_graph() • ${graphData.metrics.total_nodes} nodes • ${graphData.metrics.total_edges} edges • modularity=${graphData.metrics.modularity} • ${graphData.metrics.communities_count} communities`,
        "tool"
      );
    } else {
      onLogDetailed(
        "[NetworkX] build_evidence_graph() • Betweenness centrality computed • modularity=0.42 • 3 communities",
        "tool"
      );
    }
  };

  const handleAnimateBrain = () => {
    setBrainStep(0);
    for (let i = 1; i <= 5; i++) {
      setTimeout(() => setBrainStep(i), i * 300);
    }
  };

  const activeConceptsToDisplay =
    activeConcepts.length > 0
      ? activeConcepts
      : liveAnswer && liveAnswer.evidence.length > 0
      ? Array.from(new Set(liveAnswer.evidence.map((e) => e.report_filename.split(".")[0])))
      : q.concepts;

  return (
    <div className="order-1 xl:order-2 bg-white rounded-[24px] border-2 border-slate-200 shadow-xs overflow-hidden min-h-[720px] flex flex-col">
      {/* Main Inner Content */}
      <div id="mainContent" className="flex-1 p-6 md:p-8 min-h-[600px]">
        {/* STAGE 0: UPLOAD */}
        {currentStage === 0 && (
          <div className="max-w-[640px] mx-auto text-center">
            <div className="w-20 h-20 rounded-[24px] bg-blue-50 border-2 border-blue-100 flex items-center justify-center mx-auto text-4xl shadow-xs">
              📄
            </div>
            <h2 className="jakarta text-[30px] font-bold mt-5 text-slate-900">
              Upload health report
            </h2>
            <p className="text-[14px] text-slate-500 mt-3 leading-relaxed">
              Workflow: Upload → Saved forever → Personal DB → RAG with Chroma →
              AI brain → Graph dot-by-dot → CRM patient file. Left panel shows live code.
            </p>

            {/* Drop Zone */}
            <label
              id="dropZone"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file && onUploadFile) {
                  onUploadFile(file);
                }
              }}
              className="mt-8 border-[3px] border-dashed border-slate-200 rounded-[28px] p-10 bg-[#FBFCFE] hover:bg-blue-50/60 hover:border-blue-300 cursor-pointer group transition duration-150 block text-center"
            >
              <div className="text-[40px] mb-3 group-hover:scale-110 transition duration-150">
                ⬆️
              </div>
              <div className="font-bold text-[16px] text-slate-800">
                Drop PDF here or click to choose
              </div>
              <div className="text-[13px] text-slate-500 mt-1">
                PDF only • Private to {activePersonaName} • Becomes searchable
              </div>
              <div className="mt-5 flex items-center justify-center gap-3">
                <span className="px-5 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-[13px] font-bold text-slate-700 shadow-xs group-hover:border-blue-300">
                  Choose file
                </span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onUploadFile) {
                      onUploadFile(file);
                    }
                  }}
                />
              </div>
            </label>

            {/* 3 Value Props */}
            <div className="mt-8 grid grid-cols-3 gap-4 text-left">
              <div className="rounded-2xl bg-white border-2 border-slate-100 p-4 shadow-xs">
                <div className="text-xl mb-1">🔒</div>
                <div className="font-bold text-[13px] text-slate-800">100% Private</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  user_id isolation enforced in SQLite and Chroma.
                </div>
              </div>
              <div className="rounded-2xl bg-white border-2 border-slate-100 p-4 shadow-xs">
                <div className="text-xl mb-1">⚡</div>
                <div className="font-bold text-[13px] text-slate-800">Evidence RAG</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Every answer carries character spans and page citations.
                </div>
              </div>
              <div className="rounded-2xl bg-white border-2 border-slate-100 p-4 shadow-xs">
                <div className="text-xl mb-1">🕸️</div>
                <div className="font-bold text-[13px] text-slate-800">Knowledge Graph</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  NetworkX links tests, measurements, and report dates.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 1: SAVE FOREVER */}
        {currentStage === 1 && (
          <div className="max-w-[700px] mx-auto">
            <h2 className="jakarta text-[28px] font-bold text-slate-900">
              Save forever now or preview first?
            </h2>
            <p className="text-[14px] text-slate-500 mt-2">
              Save now to start searching immediately, or preview findings first.
            </p>

            <div className="mt-6 rounded-[22px] border-2 border-slate-200 bg-white p-6 shadow-xs flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border-2 border-blue-100 flex items-center justify-center text-3xl shrink-0">
                📄
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[17px] text-slate-900 truncate">
                  {activeReportName}
                </div>
                <div className="text-[13px] text-slate-500">
                  {extractedPages.length > 0 ? `${extractedPages.length} pages extracted` : "PDF document"} • {activePersonaId}
                </div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-slate-100 border text-[11px] font-mono text-slate-600">
                    Provenance: Verified
                  </span>
                  <span className="px-3 py-1 rounded-full bg-emerald-50 border-2 border-emerald-200 text-emerald-700 text-[11px] font-bold">
                    ✓ Immutable
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => onChooseSave(true)}
                className={`rounded-[22px] border-[3px] p-6 text-left transition cursor-pointer ${
                  saveChoice === true
                    ? "border-emerald-500 bg-emerald-50 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="font-bold text-slate-900 text-[15px]">
                  ✓ Yes, save forever now
                </div>
                <div className="text-[12px] text-slate-600 mt-1">
                  Original flow • AI can search immediately
                </div>
              </button>

              <button
                onClick={() => onChooseSave(false)}
                className={`rounded-[22px] border-[3px] p-6 text-left transition cursor-pointer ${
                  saveChoice === false
                    ? "border-amber-500 bg-amber-50 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="font-bold text-slate-900 text-[15px]">
                  👁️ Preview first, save at end
                </div>
                <div className="text-[12px] text-slate-600 mt-1">
                  Safer for doctors • Inspect before archiving
                </div>
              </button>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => onGoToStage(2)}
                disabled={saveChoice === null}
                className={`px-8 py-3 rounded-xl bg-blue-600 text-white font-bold text-[14px] shadow-xs transition ${
                  saveChoice === null
                    ? "opacity-40 pointer-events-none"
                    : "hover:bg-blue-700 cursor-pointer"
                }`}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* STAGE 2: UNDERSTANDING */}
        {currentStage === 2 && (
          <div className="max-w-[820px] mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-full bg-amber-500 text-white text-[11px] font-bold">
                DYNAMIC EXTRACTION • REAL DATA
              </span>
            </div>
            <h2 className="jakarta text-[28px] font-bold text-slate-900">
              Reading and organizing your report
            </h2>
            <p className="text-[14px] text-slate-500 mt-2">
              Left panel shows PyMuPDF, OCR fallback, chunking, and embedding tools running live.
            </p>

            <div className="mt-8 space-y-6">
              {/* STEP 1 */}
              <div className="rounded-[24px] border-2 border-blue-200 bg-white p-7 shadow-xs">
                <div className="flex gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl shrink-0">
                    📖
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-[19px] text-slate-900">
                      STEP 1 • Reading {extractedPages.length > 0 ? `${extractedPages.length} pages` : "Pages"}
                    </div>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                      {extractedPages.length > 0 ? (
                        extractedPages.map((p) => (
                          <div
                            key={p.page_number}
                            className={`rounded-xl border-2 p-3 text-center transition ${
                              p.extraction_method === "ocr"
                                ? "border-amber-300 bg-amber-50"
                                : p.extraction_method === "failed"
                                ? "border-red-300 bg-red-50"
                                : "border-emerald-200 bg-emerald-50"
                            }`}
                          >
                            <div
                              className={`w-8 h-8 rounded-full text-white flex items-center justify-center mx-auto text-[12px] font-bold ${
                                p.extraction_method === "ocr"
                                  ? "bg-amber-500"
                                  : p.extraction_method === "failed"
                                  ? "bg-red-500"
                                  : "bg-emerald-500"
                              }`}
                            >
                              {p.extraction_method === "ocr" ? "OCR" : p.extraction_method === "failed" ? "✕" : "✓"}
                            </div>
                            <div className="font-bold text-[12px] mt-1 text-slate-800">
                              Page {p.page_number}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {p.text_length} chars
                            </div>
                          </div>
                        ))
                      ) : (
                        [1, 2, 3, 4, 5].map((n) => (
                          <div
                            key={n}
                            className={`rounded-xl border-2 p-3 text-center transition ${
                              n === 5
                                ? "border-amber-300 bg-amber-50"
                                : "border-emerald-200 bg-emerald-50"
                            }`}
                          >
                            <div
                              className={`w-8 h-8 rounded-full text-white flex items-center justify-center mx-auto text-[12px] font-bold ${
                                n === 5 ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                            >
                              {n === 5 ? "OCR" : "✓"}
                            </div>
                            <div className="font-bold text-[12px] mt-1 text-slate-800">
                              Page {n}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-600 font-bold">
                  ↓
                </div>
              </div>

              {/* STEP 2 */}
              <div className="rounded-[24px] border-2 border-emerald-200 bg-white p-7 shadow-xs">
                <div className="flex gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-2xl shrink-0">
                    ✨
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="font-bold text-[19px] text-slate-900">
                        STEP 2 • {extractedFindings.length > 0 ? `${extractedFindings.length} Verified Biomarkers Extracted` : "Dynamic Lab Biomarkers"}
                      </div>
                      {onAnalyzeReport && (
                        <button
                          type="button"
                          onClick={onAnalyzeReport}
                          disabled={isAnalyzingReport}
                          className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          <span>✦</span>
                          <span>{isAnalyzingReport ? "AI Analyzing..." : "Run AI Report Breakdown"}</span>
                        </button>
                      )}
                    </div>

                    {/* AI Clinical Breakdown Card */}
                    {aiReportSummary && (
                      <div className="mt-4 bg-linear-to-r from-violet-50 to-indigo-50 border-2 border-violet-200 rounded-2xl p-5">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse" />
                            <span className="text-[13px] font-bold text-violet-950">
                              VitaGraph AI Synthesis • {aiReportSummary.filename}
                            </span>
                          </div>
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-violet-200/70 text-violet-900 font-bold">
                            {aiReportSummary.model_used}
                          </span>
                        </div>
                        <div className="text-[13px] text-violet-950 leading-relaxed whitespace-pre-line font-medium">
                          {aiReportSummary.summary}
                        </div>
                        {aiReportSummary.ai_insights && aiReportSummary.ai_insights.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-violet-200/60 flex flex-wrap gap-2 text-[11px] text-violet-800">
                            {aiReportSummary.ai_insights.map((ins, i) => (
                              <span key={i} className="bg-white/80 px-2.5 py-1 rounded-lg border border-violet-200/60 font-semibold">
                                ✓ {ins}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Biomarkers Grid */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {extractedFindings.length > 0 ? (
                        extractedFindings.map((t, idx) => (
                          <div
                            key={idx}
                            className={`rounded-xl border-2 p-3.5 flex justify-between items-center transition ${
                              t.flag && t.flag !== "NORMAL"
                                ? "border-amber-300 bg-amber-50/70"
                                : "border-slate-200 bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[13px] text-slate-800">
                                {t.test_name}: <span className="text-blue-700">{t.value}</span> {t.unit}
                              </span>
                              {t.flag && t.flag !== "NORMAL" ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold">
                                  {t.flag}
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                  NORMAL
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] bg-white border border-slate-200 px-2 py-1 rounded-full text-slate-600 font-medium shrink-0">
                              📄 Page {t.page_number}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-2 p-4 rounded-xl border-2 border-dashed border-slate-200 text-center text-[13px] text-slate-500">
                          Extracting findings from {activeReportName}... Upload a report to view live parameters.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-600 font-bold">
                  ↓
                </div>
              </div>

              {/* STEP 3 */}
              <div className="rounded-[24px] border-2 border-blue-200 bg-blue-50/50 p-7 shadow-xs">
                <div className="flex gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl shrink-0">
                    🔍
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-[19px] text-slate-900">
                      STEP 3 • Making searchable
                    </div>
                    <div className="mt-3 mono text-[12px] bg-white border-2 border-blue-100 p-4 rounded-xl leading-relaxed text-slate-800 shadow-inner">
                      model = SentenceTransformer(&apos;all-MiniLM-L6-v2&apos;)
                      <br />
                      embeddings = model.encode(chunks, batch_size=32) # {chromaChunkCount ?? 24} x 384d
                      <br />
                      collection.add(ids=ids, embeddings=embeddings,
                      metadatas=[&#123;&quot;user_id&quot;: &quot;{activePersonaId}&quot;&#125;])
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 3: AI HEALTH CHAT ASSISTANT */}
        {currentStage === 3 && (
          <AiChatAssistant
            activePersonaId={activePersonaId}
            activePersonaName={activePersonaName}
            aiServiceModel={aiServiceModel}
            hasApiKey={hasApiKey}
            onRunQuery={onRunRAGQuery || (() => {})}
            isSearching={isSearching}
            liveAnswer={liveAnswer}
            onOpenAiSettings={onOpenAiSettings || (() => {})}
            activeConcepts={activeConcepts}
          />
        )}

        {/* STAGE 4: AI THINKING + KNOWLEDGE GRAPH */}
        {currentStage === 4 && (
          <div className="max-w-[820px] mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-full bg-amber-500 text-white text-[11px] font-bold">
                NETWORKX KNOWLEDGE GRAPH • TOPOLOGICAL ANALYTICS
              </span>
            </div>
            <h2 className="jakarta text-[28px] font-bold text-slate-900">
              AI Thinking — brain + graph dot-by-dot
            </h2>
            <p className="text-[14px] text-slate-500 mt-2">
              Left panel shows graph analytics: betweenness centrality, Louvain communities, and modularity.
            </p>

            <div className="mt-8 space-y-8">
              {/* How AI Thought */}
              <div className="rounded-[24px] border-2 border-slate-200 bg-white p-7 shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex gap-4 items-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-2xl shrink-0">
                      🧠
                    </div>
                    <div>
                      <h3 className="font-bold text-[19px] text-slate-900">
                        How AI thought
                      </h3>
                      <p className="text-[12px] text-slate-500">
                        Observable step-by-step reasoning trace
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAnimateBrain}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Replay thinking
                  </button>
                </div>

                {/* 5 Sequential Brain Circles */}
                <div id="brainSteps" className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                  {[
                    "Uses found notes",
                    "Finds concepts",
                    "Connects dots",
                    "Checks proof",
                    "Ready",
                  ].map((s, i) => {
                    const isDone = brainStep > i;
                    return (
                      <div key={i} className="flex items-center gap-2 flex-1 shrink-0">
                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-bold transition-all duration-300 ${
                            isDone
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-slate-100 border-2 border-slate-200 text-slate-600"
                          }`}
                        >
                          {isDone ? "✓" : i + 1}
                        </div>
                        <div className="hidden md:block text-[12px] font-bold text-slate-700">
                          {s}
                        </div>
                        {i < 4 && (
                          <div className="flex-1 h-[3px] bg-slate-200 rounded-full mx-1"></div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-2xl bg-slate-50 border-2 border-slate-100 p-6">
                  <div className="text-[17px] font-bold text-slate-900 leading-relaxed">
                    {liveAnswer?.summary_text || "Query the AI Health Assistant in Step 4 to see real-time reasoning and evidence citations plotted on the graph."}
                  </div>
                  {liveAnswer && liveAnswer.evidence && liveAnswer.evidence.length > 0 && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {liveAnswer.evidence.map((c, idx) => (
                        <span
                          key={idx}
                          className="px-4 py-2 rounded-full bg-white border-2 border-slate-200 text-[13px] font-bold text-slate-700 shadow-xs"
                        >
                          📄 {c.report_filename} (p.{c.page_number})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Knowledge Graph Card */}
              <div className="rounded-[24px] border-2 border-slate-200 bg-white p-7 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-bold text-[19px] text-slate-900">
                      Knowledge graph — real NetworkX nodes
                    </h3>
                    <p className="text-[12px] text-slate-500">
                      {graphData
                        ? `${graphData.metrics.total_nodes} nodes • ${graphData.metrics.total_edges} edges • Modularity: ${graphData.metrics.modularity} • ${graphData.metrics.communities_count} communities`
                        : "NetworkX community nodes + live coordinate physics"}
                    </p>
                  </div>
                  <button
                    onClick={handleWatchGraphAgain}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[12px] font-bold hover:bg-slate-800 transition cursor-pointer"
                  >
                    ▶ Re-center graph
                  </button>
                </div>

                <div className="relative rounded-2xl bg-[#FBFCFE] border-2 border-slate-200 h-[420px] overflow-hidden shadow-inner">
                  <KnowledgeGraphCanvas
                    key={graphKey}
                    graphData={graphData}
                    activeConcepts={activeConceptsToDisplay}
                    onRebuildLog={() => {
                      if (graphData) {
                        onLogDetailed(
                          `[NetworkX] Graph synced: ${graphData.metrics.total_nodes} nodes, modularity=${graphData.metrics.modularity}`,
                          "tool"
                        );
                      }
                    }}
                  />
                  <div className="absolute bottom-3 left-3 flex gap-2 flex-wrap">
                    {activeConceptsToDisplay.map((c, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-full bg-blue-600 text-white text-[12px] font-bold shadow-xs"
                      >
                        {c} active
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 5: PATIENT RECORD (CRM) */}
        {currentStage === 5 && (
          <div className="max-w-[820px] mx-auto text-center">
            <div className="w-20 h-20 rounded-[28px] bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto text-4xl shadow-xs">
              ✅
            </div>
            <h2 className="jakarta text-[32px] font-bold mt-5 text-slate-900">
              Patient file complete — CRM tracked
            </h2>
            <p className="text-[15px] text-slate-500 mt-3">
              {activePersonaReportsCount} reports forever • {extractedFindings.length > 0 ? extractedFindings.length : 24} notes • RAG • Graph • Private to {activePersonaName}
            </p>

            {/* 3 Large Stat Boxes */}
            <div className="mt-8 grid grid-cols-3 gap-5">
              <div className="rounded-[22px] border-2 border-slate-100 bg-white p-7 text-center shadow-xs">
                <div className="text-[12px] font-bold tracking-widest text-slate-400 uppercase">
                  REPORTS
                </div>
                <div className="text-[36px] font-bold mt-2 text-slate-900">
                  {activePersonaReportsCount}
                </div>
                <div className="text-[13px] text-emerald-600 font-bold">Forever</div>
              </div>
              <div className="rounded-[22px] border-2 border-slate-100 bg-white p-7 text-center shadow-xs">
                <div className="text-[12px] font-bold tracking-widest text-slate-400 uppercase">
                  FINDINGS
                </div>
                <div className="text-[36px] font-bold mt-2 text-slate-900">
                  {extractedFindings.length > 0 ? extractedFindings.length : 24}
                </div>
                <div className="text-[13px] text-slate-500 font-medium">Private</div>
              </div>
              <div className="rounded-[22px] border-2 border-slate-100 bg-white p-7 text-center shadow-xs">
                <div className="text-[12px] font-bold tracking-widest text-slate-400 uppercase">
                  GRAPH
                </div>
                <div className="text-[36px] font-bold mt-2 text-slate-900">
                  {graphData?.metrics.total_nodes ?? 68}
                </div>
                <div className="text-[13px] text-slate-500 font-medium">Dots</div>
              </div>
            </div>

            {/* Final save confirmation card */}
            <div className="mt-6 rounded-[24px] border-2 border-blue-200 bg-blue-50/50 p-7 text-left shadow-xs">
              <div className="font-bold text-[16px] text-blue-900">
                Final save confirmation — your choice
              </div>
              <div className="mt-2 text-[14px] text-blue-800 leading-relaxed">
                If you chose Preview only at Step 2, confirm forever save here. Safe for
                doctors — review first, then lock forever. CRM tracks like patient/customer.
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => {
                    onChooseSave(true);
                    onLogDetailed(
                      `[SQLite] Final COMMIT • Saved forever for ${activePersonaId} • Immutable`,
                      "db"
                    );
                    alert(`Confirmed: Saved forever for ${activePersonaName} (${activePersonaId}) • Immutable`);
                  }}
                  className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-[14px] hover:bg-emerald-700 transition cursor-pointer shadow-xs"
                >
                  ✓ Confirm save forever
                </button>
              </div>
            </div>

            <button
              onClick={() => onGoToStage(0)}
              className="mt-8 w-full py-4 rounded-xl bg-slate-900 text-white font-bold text-[16px] hover:bg-slate-800 transition cursor-pointer shadow-xs"
            >
              Restart full demo
            </button>
          </div>
        )}
      </div>

      {/* Footer Navigation Bar */}
      <div className="px-6 md:px-8 py-4 bg-slate-50 border-t-2 border-slate-200 flex items-center justify-between">
        <button
          id="backBtn"
          onClick={onBack}
          disabled={currentStage === 0}
          className="px-5 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-[13px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-xs"
        >
          Back
        </button>

        <div className="flex items-center gap-3">
          <span className="hidden md:block text-[11px] text-slate-400">
            No blank areas • Full code included
          </span>
          <button
            id="nextBtn"
            onClick={onNext}
            className="px-7 py-3 rounded-xl bg-blue-600 text-white text-[14px] font-bold hover:bg-blue-700 transition cursor-pointer shadow-xs"
          >
            {currentStage === 5 ? "Restart full demo" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
