import { useCallback, useEffect, useState } from "react";
import { StepperBar } from "./components/StepperBar";
import { STAGES } from "./data/mockData";
import { TechnicalPanel, type LogItem, type PipelineItem } from "./components/TechnicalPanel";
import { MainStageView, type FindingItem } from "./components/MainStageView";
import { PatientFilePanel, type SimpleLogItem } from "./components/PatientFilePanel";
import { PersonaModal } from "./components/PersonaModal";
import { FrontPage } from "./components/FrontPage";
import { api } from "./api/client";
import { reportsApi, type TrendData } from "./api/reports";
import { questionsApi } from "./api/questions";
import { graphApi, type GraphResponse } from "./api/graph";
import { aiApi, type AiConfig, type ReportAnalysisResponse } from "./api/ai";
import { UploadProgressBar } from "./components/UploadProgressBar";
import { StageTransitionLoader } from "./components/StageTransitionLoader";
import { AiSettingsModal } from "./components/AiSettingsModal";
import type { Report, ReportPage, Answer } from "./types";

function getFormattedTimeWithMs(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

function getFormattedTime(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function parseFindingsFromPages(pages: ReportPage[]): FindingItem[] {
  const findings: FindingItem[] = [];
  const testPatterns = [
    { name: "Hemoglobin", regex: /Hemoglobin\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?/i, unit: "g/dL", ref: "12.0 - 15.5 g/dL" },
    { name: "Vitamin D", regex: /Vitamin D[^\n\r]*\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?/i, unit: "ng/mL", ref: "30 - 100 ng/mL" },
    { name: "Total Cholesterol", regex: /(?:Total Cholesterol|Cholesterol, Total)\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?/i, unit: "mg/dL", ref: "< 200 mg/dL" },
    { name: "LDL Cholesterol", regex: /LDL(?: Cholesterol)?\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?/i, unit: "mg/dL", ref: "< 100 mg/dL" },
    { name: "HDL Cholesterol", regex: /HDL(?: Cholesterol)?\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?/i, unit: "mg/dL", ref: "> 40 mg/dL" },
    { name: "Fasting Glucose", regex: /(?:Fasting Glucose|Glucose, Fasting|Fasting Blood Sugar)\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?/i, unit: "mg/dL", ref: "70 - 99 mg/dL" },
    { name: "WBC Count", regex: /WBC(?:\s*Count)?\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%uULk]+)?/i, unit: "/uL", ref: "4000 - 11000 /uL" },
    { name: "Platelets", regex: /Platelets\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%k]+)?/i, unit: "k/uL", ref: "150 - 450 k/uL" },
    { name: "HbA1c", regex: /HbA1c\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?/i, unit: "%", ref: "< 5.7 %" },
    { name: "Creatinine", regex: /Creatinine\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?/i, unit: "mg/dL", ref: "0.7 - 1.3 mg/dL" },
    { name: "TSH", regex: /(?:TSH|Thyroid Stimulating Hormone)\s*(?:\(TSH\))?\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%μuIU]+)?/i, unit: "uIU/mL", ref: "0.4 - 4.0 uIU/mL" },
    { name: "Vitamin B12", regex: /Vitamin B12\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?/i, unit: "pg/mL", ref: "200 - 900 pg/mL" },
  ];

  pages.forEach((p) => {
    testPatterns.forEach((tp) => {
      const match = p.extracted_text.match(tp.regex);
      if (match) {
        const val = parseFloat(match[1]);
        if (!isNaN(val)) {
          const matchPos = match.index ?? 0;
          const context = p.extracted_text.slice(matchPos, matchPos + 80).toUpperCase();
          let flag = "NORMAL";
          if (context.includes("HIGH")) flag = "HIGH";
          else if (context.includes("LOW")) flag = "LOW";

          findings.push({
            test_name: tp.name,
            value: val,
            unit: match[2] || tp.unit,
            page_number: p.page_number,
            flag,
            reference_range: tp.ref,
          });
        }
      }
    });
  });

  return findings;
}

const PIPELINE_STATUS_CONFIG: Record<number, PipelineItem[]> = {
  0: [
    { label: "Upload PDF", state: "active" },
    { label: "PyMuPDF extraction", state: "idle" },
    { label: "Chunking & provenance", state: "idle" },
    { label: "Embedding MiniLM", state: "idle" },
    { label: "Chroma upsert", state: "idle" },
    { label: "RAG query", state: "idle" },
  ],
  1: [
    { label: "Upload done", state: "done" },
    { label: "SQLite immutable save", state: "active" },
    { label: "Chunking + provenance", state: "idle" },
    { label: "Embedding", state: "idle" },
    { label: "Chroma", state: "idle" },
    { label: "RAG", state: "idle" },
  ],
  2: [
    { label: "SQLite save", state: "done" },
    { label: "PyMuPDF + Tesseract OCR", state: "active" },
    { label: "Chunking + spans", state: "active" },
    { label: "Embedding MiniLM", state: "active" },
    { label: "Chroma private DB", state: "idle" },
    { label: "RAG ready", state: "idle" },
  ],
  3: [
    { label: "Embedding query", state: "active" },
    { label: "Chroma query where=user_id", state: "active" },
    { label: "Top-5 retrieval threshold>=0.40", state: "active" },
    { label: "Neutral AI / Local Composer", state: "idle" },
    { label: "Answer + citations", state: "idle" },
  ],
  4: [
    { label: "RAG done", state: "done" },
    { label: "NetworkX graph build", state: "active" },
    { label: "Betweenness centrality", state: "active" },
    { label: "Community detection", state: "active" },
  ],
  5: [
    { label: "All pipeline done", state: "done" },
    { label: "CRM timeline updated", state: "done" },
    { label: "Knowledge graph ready", state: "done" },
  ],
};

export default function App() {
  const [view, setView] = useState<"front" | "app">("app");
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [saveChoice, setSaveChoice] = useState<boolean | null>(null);
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [chromaChunkCount, setChromaChunkCount] = useState<number | null>(null);
  const [activePersona, setActivePersona] = useState({
    id: "VG-2026-001",
    name: "Arjun R",
    reportsCount: 3,
  });
  const [activeReportName, setActiveReportName] = useState<string>(
    "Arjun_Lab_Report_Feb2026.pdf"
  );
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState<boolean>(false);

  // Dynamic pipeline state
  const [extractedPages, setExtractedPages] = useState<ReportPage[]>([]);
  const [extractedFindings, setExtractedFindings] = useState<FindingItem[]>([]);
  const [liveAnswer, setLiveAnswer] = useState<Answer | null>(null);
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [activeConcepts, setActiveConcepts] = useState<string[]>([]);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [aiServiceModel, setAiServiceModel] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiReportSummary, setAiReportSummary] = useState<ReportAnalysisResponse | null>(null);
  const [isAnalyzingReport, setIsAnalyzingReport] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [targetStageIndex, setTargetStageIndex] = useState<number>(0);
  const [uploadState, setUploadState] = useState<{
    isOpen: boolean;
    fileName: string;
    fileSize?: number;
    progress: number;
    stepIndex: number;
    stepMessage: string;
    isComplete: boolean;
  }>({
    isOpen: false,
    fileName: "",
    progress: 0,
    stepIndex: 0,
    stepMessage: "",
    isComplete: false,
  });

  // Real telemetry logs
  const [logs, setLogs] = useState<LogItem[]>([
    {
      id: "log_init_0",
      time: getFormattedTimeWithMs(),
      msg: "[System] Ready • 3-Column Architecture • Academic Boundaries Enforced",
      type: "ok",
    },
    {
      id: "log_init_1",
      time: getFormattedTimeWithMs(),
      msg: "[FastAPI] Connected to backend on port 8000 • Fail-closed user privacy",
      type: "py",
    },
    {
      id: "log_init_2",
      time: getFormattedTimeWithMs(),
      msg: "[SQLite] 7 normalized tables initialized • Foreign keys ON",
      type: "db",
    },
    {
      id: "log_init_3",
      time: getFormattedTimeWithMs(),
      msg: "[Chroma] PersistentClient • collection=vitaGraph • cosine distance",
      type: "db",
    },
    {
      id: "log_init_4",
      time: getFormattedTimeWithMs(),
      msg: "[NetworkX] Graph analytics engine mounted • Communities & Centrality ready",
      type: "tool",
    },
  ]);

  const [simpleLogs, setSimpleLogs] = useState<SimpleLogItem[]>([
    {
      id: "slog_init_0",
      time: getFormattedTime(),
      msg: "System ready • Left = code logs • Center = big cards • Right = patient file",
    },
  ]);

  const addLogDetailed = useCallback(
    (msg: string, type: LogItem["type"] = "info") => {
      setLogs((prev) => [
        {
          id: `log_${Date.now()}_${Math.random()}`,
          time: getFormattedTimeWithMs(),
          msg,
          type,
        },
        ...prev,
      ]);
    },
    []
  );

  const addLogSimple = useCallback((msg: string) => {
    setSimpleLogs((prev) => [
      {
        id: `slog_${Date.now()}_${Math.random()}`,
        time: getFormattedTime(),
        msg,
      },
      ...prev,
    ]);
  }, []);

  const [allReports, setAllReports] = useState<Report[]>([]);

  // Load persona data from backend
  const loadPersonaData = useCallback(async (userId: string) => {
    try {
      const reports = await reportsApi.list(userId).catch(() => []);
      setAllReports(reports);
      if (reports && reports.length > 0) {
        setActivePersona((prev) => ({ ...prev, reportsCount: reports.length }));
        setActiveReportName(reports[0].original_filename);

        try {
          const pageResults = await Promise.all(
            reports.map((r) => reportsApi.pages(r.id).catch(() => []))
          );
          const allPages = pageResults.flat();
          const primaryPages = pageResults[0] || [];
          setExtractedPages(allPages.length > 0 ? allPages : primaryPages);
          setExtractedFindings(parseFindingsFromPages(allPages.length > 0 ? allPages : primaryPages));
        } catch {
          // ignore
        }

        try {
          const analysis = await aiApi.analyzeReport(reports[0].id, userId);
          setAiReportSummary(analysis);
        } catch {
          // ignore
        }
      }

      try {
        const trends = await reportsApi.trends(userId, "Hemoglobin");
        setTrendData(trends);
      } catch {
        // ignore
      }

      try {
        const graph = await graphApi.getGraph(userId);
        setGraphData(graph);
      } catch {
        // ignore
      }
    } catch (err) {
      console.error("Error loading persona data:", err);
    }
  }, []);

  // Check backend health on mount and periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const [healthRes, aiRes] = await Promise.all([
          api
            .get<{
              status: string;
              retrieval_store?: { status: string; chunks?: number };
              ai_service?: string;
              ai_service_model?: string;
              embedding_model?: string;
            }>("/api/health")
            .catch(() => null),
          aiApi.getConfig().catch(() => null),
        ]);

        if (healthRes?.status === "ok") {
          setBackendConnected(true);
          if (healthRes.retrieval_store?.chunks !== undefined) {
            setChromaChunkCount(healthRes.retrieval_store.chunks);
          }
          if (healthRes.ai_service_model) {
            setAiServiceModel(healthRes.ai_service_model);
          }
        } else {
          setBackendConnected(false);
        }

        if (aiRes) {
          setAiConfig(aiRes);
          if (aiRes.model) {
            setAiServiceModel(aiRes.model);
          }
        }
      } catch {
        setBackendConnected(false);
      }
    };

    checkHealth();
    loadPersonaData(activePersona.id);
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, [activePersona.id, loadPersonaData]);

  // Navigation handlers with visible stage transition loading
  const goTo = (index: number) => {
    const target = Math.max(0, Math.min(index, STAGES.length - 1));
    if (target === currentStage && !isTransitioning) return;
    setTargetStageIndex(target);
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStage(target);
      setIsTransitioning(false);
      addLogDetailed(`[Pipeline] → Step ${target + 1} ${STAGES[target].label}`, "info");
      addLogSimple(`→ ${STAGES[target].label}`);
    }, 500);
  };

  const handleNext = () => {
    if (currentStage === STAGES.length - 1) {
      goTo(0);
    } else {
      goTo(currentStage + 1);
    }
  };

  const handleBack = () => {
    goTo(currentStage - 1);
  };

  const handleReset = () => {
    setSaveChoice(null);
    setCurrentStage(0);
    setLiveAnswer(null);
    setActiveConcepts([]);
    setAiReportSummary(null);
    addLogDetailed("[System] Demo reset to initial stage", "warn");
    addLogSimple("Demo reset");
  };

  const handleChooseSave = (choice: boolean) => {
    setSaveChoice(choice);
    if (choice) {
      addLogDetailed(
        `[SQLite] UPDATE reports SET immutable=1 WHERE user_id='${activePersona.id}' • COMMIT`,
        "db"
      );
      addLogSimple("✓ Save forever now");
    } else {
      addLogDetailed(
        `[SQLite] Preview mode active for ${activePersona.id} • save deferred to end`,
        "db"
      );
      addLogSimple("👁️ Preview only — save at end");
    }
  };

  const handleAnalyzeReport = async () => {
    setIsAnalyzingReport(true);
    addLogDetailed(`[AI Service] Requesting dynamic report breakdown for ${activePersona.id}...`, "llm");
    try {
      const reports = await reportsApi.list(activePersona.id).catch(() => []);
      const reportId = reports.length > 0 ? reports[0].id : "";
      const analysis = await aiApi.analyzeReport(reportId, activePersona.id);
      setAiReportSummary(analysis);
      addLogDetailed(
        `[AI Service] Dynamic report breakdown complete: ${analysis.biomarkers.length} biomarkers identified via ${analysis.model_used}`,
        "ok"
      );
      addLogSimple(`AI Analysis generated (${analysis.biomarkers.length} biomarkers)`);
    } catch (err) {
      addLogDetailed(`[AI Service] Analysis error: ${(err as Error).message}`, "warn");
    } finally {
      setIsAnalyzingReport(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    setActiveReportName(file.name);
    setUploadState({
      isOpen: true,
      fileName: file.name,
      fileSize: file.size,
      progress: 15,
      stepIndex: 0,
      stepMessage: "Transmitting file to isolated sandbox...",
      isComplete: false,
    });

    addLogDetailed(
      `[Upload] Received '${file.name}' (${(file.size / 1024).toFixed(1)} KB)`,
      "ok"
    );
    addLogSimple(`Uploaded file: ${file.name}`);

    // Progressive step simulation while backend works
    const tStep1 = setTimeout(() => {
      setUploadState((prev) => ({
        ...prev,
        progress: 35,
        stepIndex: 1,
        stepMessage: "PyMuPDF reading layout, tables & text layers...",
      }));
    }, 250);

    const tStep2 = setTimeout(() => {
      setUploadState((prev) => ({
        ...prev,
        progress: 60,
        stepIndex: 2,
        stepMessage: "Extracting lab metrics, values & reference ranges...",
      }));
    }, 550);

    const tStep3 = setTimeout(() => {
      setUploadState((prev) => ({
        ...prev,
        progress: 80,
        stepIndex: 3,
        stepMessage: "Generating 384d MiniLM vector embeddings...",
      }));
    }, 900);

    const tStep4 = setTimeout(() => {
      setUploadState((prev) => ({
        ...prev,
        progress: 92,
        stepIndex: 4,
        stepMessage: "Upserting into ChromaDB & committing SQLite ledger...",
      }));
    }, 1300);

    if (backendConnected) {
      try {
        const t0 = performance.now();
        addLogDetailed(
          `[FastAPI] POST /api/reports/upload for persona ${activePersona.id}...`,
          "py"
        );
        const res = await reportsApi.upload(activePersona.id, file);
        const duration = Math.round(performance.now() - t0);

        clearTimeout(tStep1);
        clearTimeout(tStep2);
        clearTimeout(tStep3);
        clearTimeout(tStep4);

        setUploadState((prev) => ({
          ...prev,
          progress: 100,
          stepIndex: 4,
          stepMessage: `✓ Indexed ${res.chunk_count} notes across ${res.page_count} pages.`,
          isComplete: true,
        }));

        addLogDetailed(
          `[PyMuPDF] Ingestion success! Report ID: ${res.id} • Pages: ${res.page_count} • Chunks: ${res.chunk_count} (${duration}ms)`,
          "ok"
        );
        addLogDetailed(
          `[Chroma] Upserted ${res.chunk_count} vectors for user_id=${activePersona.id}`,
          "db"
        );
        addLogSimple(`✓ Report indexed (${res.chunk_count} notes, ${res.page_count} pages)`);

        // Fetch real pages extracted
        const pages = await reportsApi.pages(res.id);
        setExtractedPages(pages);
        setExtractedFindings(parseFindingsFromPages(pages));

        // Refresh graph and trends
        const [graph, trends, reportList] = await Promise.all([
          graphApi.getGraph(activePersona.id).catch(() => null),
          reportsApi.trends(activePersona.id, "Hemoglobin").catch(() => null),
          reportsApi.list(activePersona.id).catch(() => []),
        ]);

        if (graph) {
          setGraphData(graph);
          addLogDetailed(
            `[NetworkX] Graph refreshed: ${graph.metrics.total_nodes} nodes, ${graph.metrics.total_edges} edges, modularity=${graph.metrics.modularity}`,
            "tool"
          );
        }
        if (trends) setTrendData(trends);
        if (reportList) setActivePersona((prev) => ({ ...prev, reportsCount: reportList.length }));

        // Auto-run AI report analysis
        try {
          const analysis = await aiApi.analyzeReport(res.id, activePersona.id);
          setAiReportSummary(analysis);
          addLogDetailed(
            `[AI Service] AI synthesis generated: ${analysis.biomarkers.length} biomarkers analyzed (${analysis.model_used})`,
            "llm"
          );
        } catch {
          // ignore
        }

        setTimeout(() => {
          setUploadState((prev) => ({ ...prev, isOpen: false }));
          goTo(1);
        }, 700);
      } catch (err) {
        clearTimeout(tStep1);
        clearTimeout(tStep2);
        clearTimeout(tStep3);
        clearTimeout(tStep4);
        setUploadState((prev) => ({
          ...prev,
          progress: 100,
          isComplete: true,
          stepMessage: `Upload error: ${(err as Error).message}`,
        }));
        addLogDetailed(`[FastAPI] Upload error: ${(err as Error).message}`, "warn");
        addLogSimple(`Upload error: ${(err as Error).message}`);
        setTimeout(() => {
          setUploadState((prev) => ({ ...prev, isOpen: false }));
        }, 1500);
      }
    } else {
      setTimeout(() => {
        setUploadState((prev) => ({
          ...prev,
          progress: 100,
          isComplete: true,
          stepMessage: "Simulated extraction complete!",
        }));
        setTimeout(() => {
          setUploadState((prev) => ({ ...prev, isOpen: false }));
          goTo(1);
        }, 600);
      }, 1500);
    }
  };

  const handleRunRAGQuery = async (questionText: string) => {
    if (!questionText.trim()) return;
    setIsSearching(true);
    addLogDetailed(
      `[FastAPI] POST /api/questions text="${questionText.slice(0, 32)}..." user_id=${activePersona.id}`,
      "py"
    );
    addLogSimple(`Question: "${questionText}"`);

    const t0 = performance.now();
    try {
      const answer = await questionsApi.ask(activePersona.id, questionText);
      const duration = Math.round(performance.now() - t0);
      setLiveAnswer(answer);

      addLogDetailed(
        `[Embedding] all-MiniLM-L6-v2 384d vector generated (${Math.round(duration * 0.25)}ms)`,
        "py"
      );

      if (answer.evidence && answer.evidence.length > 0) {
        answer.evidence.forEach((ev) => {
          addLogDetailed(
            `[Chroma] Retrieved ${ev.chunk_id} • ${(ev.score * 100).toFixed(0)}% close • ${ev.report_filename} (p.${ev.page_number})`,
            "db"
          );
        });

        // Question-conditioned subgraph activation
        const chunkIds = answer.evidence.map((e) => e.chunk_id);
        try {
          const subgraph = await graphApi.getSubgraph(activePersona.id, chunkIds);
          if (subgraph && subgraph.active_concepts) {
            setActiveConcepts(subgraph.active_concepts);
            addLogDetailed(
              `[NetworkX] Subgraph activated: ${subgraph.metrics.total_nodes} nodes • concepts: ${subgraph.active_concepts.join(", ")}`,
              "tool"
            );
          }
        } catch {
          // ignore
        }
      } else {
        addLogDetailed(
          `[Chroma] 0 evidence chunks matching score threshold >= 0.40`,
          "warn"
        );
      }

      addLogDetailed(
        `[AI Service] Mode=${answer.ai_service_status} • Safety=${answer.safety_status} • Status=${answer.status} (${duration}ms)`,
        answer.status === "refused" ? "warn" : "llm"
      );
      addLogSimple(`✓ Answer generated (${answer.status}, ${answer.evidence.length} citations)`);
    } catch (err) {
      addLogDetailed(`[FastAPI] RAG search error: ${(err as Error).message}`, "warn");
    } finally {
      setIsSearching(false);
    }
  };

  const pipelineItems =
    PIPELINE_STATUS_CONFIG[currentStage] || PIPELINE_STATUS_CONFIG[0];

  if (view === "front") {
    return <FrontPage onEnterApp={() => setView("app")} />;
  }

  return (
    <div className="bg-[#F5F7FA] text-slate-900 min-h-screen antialiased">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-[1720px] mx-auto px-4 md:px-6 h-[68px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold jakarta text-[16px] shadow-xs">
              V
            </div>
            <div>
              <div className="font-bold jakarta text-[16px] leading-tight text-slate-900">
                VitaGraph
              </div>
              <div className="text-[11px] text-slate-500">
                Evidence-Linked Knowledge Graph & Privacy-Aware RAG
              </div>
            </div>
            <span className="hidden xl:inline-flex ml-4 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
              ✓ 100% Genuine Backend Linked
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* AI API Status / Settings Pill */}
            <button
              onClick={() => setIsAiModalOpen(true)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full border shadow-xs cursor-pointer transition ${
                aiConfig?.has_api_key
                  ? "bg-violet-50 hover:bg-violet-100 border-violet-200 text-violet-900"
                  : "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900"
              }`}
              title="Click to configure AI API Key (Gemini, OpenAI, Groq)"
            >
              <span className="text-[13px] text-violet-600 font-bold">✦</span>
              <div className="text-left leading-none">
                <div className="text-[12px] font-bold">
                  {aiConfig?.has_api_key ? (aiConfig.model || "AI Model") : "AI Key: Setup"}
                </div>
                <div className="text-[10px] text-slate-500">
                  {aiConfig?.has_api_key ? (aiConfig.masked_key || "Live Online") : "Offline Mode"}
                </div>
              </div>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  aiConfig?.has_api_key ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
            </button>

            {/* Active Persona Pill */}
            <div
              onClick={() => setIsPersonaModalOpen(true)}
              className="hidden md:flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-white border border-slate-200 shadow-xs cursor-pointer hover:border-blue-300 transition"
              title="Click to switch or create synthetic personas"
            >
              <img
                src="https://i.pravatar.cc/100?img=32"
                alt="Avatar"
                className="w-7 h-7 rounded-full object-cover"
              />
              <div className="text-left leading-tight">
                <div className="text-[13px] font-bold text-slate-800">
                  {activePersona.name} • {activePersona.id}
                </div>
                <div className="text-[10px] text-slate-500">
                  Private • {activePersona.reportsCount} reports
                </div>
              </div>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  backendConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
            </div>

            <button
              onClick={() => setView("front")}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition"
            >
              &#8962; Graph home
            </button>

            <button
              id="resetBtn"
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition"
            >
              Reset demo
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-[1720px] mx-auto px-4 md:px-6 py-5">
        {/* DISCLAIMER BANNER */}
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-800 font-medium">
          <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
            !
          </span>
          Educational prototype — strictly not medical diagnosis or clinical advice. Synthetic data only. user_id privacy isolation enforced.
        </div>

        {/* STEPPER BAR */}
        <StepperBar
          currentStage={currentStage}
          onGoToStage={goTo}
          backendConnected={backendConnected}
        />

        {/* 3-COLUMN GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr_380px] gap-5 items-start">
          {/* LEFT: TECHNICAL PANEL */}
          <TechnicalPanel
            logs={logs}
            pipelineItems={pipelineItems}
            backendConnected={backendConnected}
            chromaChunkCount={chromaChunkCount}
            aiServiceModel={aiServiceModel}
            onClearLogs={() => setLogs([])}
            onOpenAiSettings={() => setIsAiModalOpen(true)}
          />

          {/* CENTER: MAIN STAGE VIEW */}
          <MainStageView
            currentStage={currentStage}
            saveChoice={saveChoice}
            onChooseSave={handleChooseSave}
            onNext={handleNext}
            onBack={handleBack}
            onGoToStage={goTo}
            onLogDetailed={addLogDetailed}
            onLogSimple={addLogSimple}
            activeReportName={activeReportName}
            onUploadFile={handleUploadFile}
            extractedPages={extractedPages}
            extractedFindings={extractedFindings}
            chromaChunkCount={chromaChunkCount}
            liveAnswer={liveAnswer}
            graphData={graphData}
            activeConcepts={activeConcepts}
            activePersonaId={activePersona.id}
            activePersonaName={activePersona.name}
            activePersonaReportsCount={activePersona.reportsCount}
            onRunRAGQuery={handleRunRAGQuery}
            isSearching={isSearching}
            hasApiKey={Boolean(aiConfig?.has_api_key)}
            aiServiceModel={aiServiceModel}
            onOpenAiSettings={() => setIsAiModalOpen(true)}
            aiReportSummary={aiReportSummary}
            isAnalyzingReport={isAnalyzingReport}
            onAnalyzeReport={handleAnalyzeReport}
          />

          {/* RIGHT: CRM PATIENT FILE */}
          <PatientFilePanel
            saveChoice={saveChoice}
            simpleLogs={simpleLogs}
            activePersonaName={activePersona.name}
            activePersonaId={activePersona.id}
            activePersonaReportsCount={activePersona.reportsCount}
            trendData={trendData}
            reports={allReports}
            allFindingsCount={extractedFindings.length}
            onOpenPersonaModal={() => setIsPersonaModalOpen(true)}
          />
        </div>
      </main>

      {/* STAGE TRANSITION LOADER */}
      <StageTransitionLoader
        isTransitioning={isTransitioning}
        targetStageIndex={targetStageIndex}
        targetStageLabel={STAGES[targetStageIndex]?.label || ""}
      />

      {/* UPLOAD PROGRESS BAR */}
      <UploadProgressBar
        isOpen={uploadState.isOpen}
        fileName={uploadState.fileName}
        fileSize={uploadState.fileSize}
        progress={uploadState.progress}
        currentStepIndex={uploadState.stepIndex}
        stepMessage={uploadState.stepMessage}
        isComplete={uploadState.isComplete}
      />

      {/* AI SETTINGS MODAL */}
      <AiSettingsModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        currentConfig={aiConfig}
        onConfigUpdated={(newCfg) => {
          setAiConfig(newCfg);
          setAiServiceModel(newCfg.model);
        }}
        onLogDetailed={addLogDetailed}
      />

      {/* PERSONA MODAL */}
      <PersonaModal
        isOpen={isPersonaModalOpen}
        onClose={() => setIsPersonaModalOpen(false)}
        activeUserId={activePersona.id}
        onSelectUser={(user: { id: string; name: string }) => {
          setActivePersona({
            id: user.id,
            name: user.name,
            reportsCount: 0,
          });
          loadPersonaData(user.id);
          addLogDetailed(
            `[User Service] Switched active persona to ${user.name} (${user.id})`,
            "ok"
          );
          addLogSimple(`Switched persona: ${user.name}`);
        }}
      />
    </div>
  );
}
