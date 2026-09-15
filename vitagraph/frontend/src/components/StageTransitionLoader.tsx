import { useEffect, useState } from "react";

interface StageTransitionLoaderProps {
  isTransitioning: boolean;
  targetStageIndex: number;
  targetStageLabel: string;
}

const STAGE_TRANSITION_ACTIONS: Record<number, { title: string; detail: string; icon: string }> = {
  0: {
    title: "Document Ingestion Gateway",
    detail: "Initializing PDF parser & user isolation sandbox...",
    icon: "📄",
  },
  1: {
    title: "Provenance & Archive Policy",
    detail: "Configuring immutable SQLite ledger & preview gate...",
    icon: "🔒",
  },
  2: {
    title: "AI Findings & Biomarker Extraction",
    detail: "Synthesizing lab metrics, reference ranges & OCR text...",
    icon: "🔬",
  },
  3: {
    title: "VitaGraph AI Chat Assistant",
    detail: "Mounting RAG vector retriever & neutral AI generation...",
    icon: "🤖",
  },
  4: {
    title: "Topological Knowledge Graph",
    detail: "Computing NetworkX modularity, betweenness & communities...",
    icon: "🕸️",
  },
  5: {
    title: "Longitudinal Patient File (CRM)",
    detail: "Finalizing patient health ledger & multi-report timeline...",
    icon: "📋",
  },
};

export function StageTransitionLoader({
  isTransitioning,
  targetStageIndex,
  targetStageLabel,
}: StageTransitionLoaderProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isTransitioning) {
      setProgress(0);
      return;
    }

    setProgress(15);
    const t1 = setTimeout(() => setProgress(55), 180);
    const t2 = setTimeout(() => setProgress(90), 380);
    const t3 = setTimeout(() => setProgress(100), 550);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isTransitioning]);

  if (!isTransitioning) return null;

  const info = STAGE_TRANSITION_ACTIONS[targetStageIndex] || {
    title: targetStageLabel,
    detail: "Transitioning pipeline stage...",
    icon: "⚡",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 pointer-events-none animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-2xl px-6 py-5 max-w-[420px] w-full pointer-events-auto transform scale-100 transition-all">
        <div className="flex items-center gap-3.5 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl shadow-xs">
            {info.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              Step {targetStageIndex + 1} of 6 • {targetStageLabel}
            </div>
            <div className="font-bold text-slate-900 text-[15px] truncate">
              {info.title}
            </div>
          </div>
        </div>

        <div className="text-[12px] text-slate-600 mb-3 leading-tight">
          {info.detail}
        </div>

        {/* Loading Progress Bar */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-0.5 shadow-inner">
          <div
            className="h-full bg-linear-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
