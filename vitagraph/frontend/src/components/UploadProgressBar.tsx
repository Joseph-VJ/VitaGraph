import { useEffect, useState } from "react";

interface UploadProgressBarProps {
  isOpen: boolean;
  fileName: string;
  fileSize?: number;
  progress: number;
  currentStepIndex: number;
  stepMessage: string;
  isComplete: boolean;
}

const UPLOAD_STEPS = [
  { label: "Upload & Verify", desc: "Transmitting file to isolated sandbox" },
  { label: "PyMuPDF Extraction", desc: "Reading layout, tables & text layers" },
  { label: "Biomarker Parsing", desc: "Extracting lab metrics & flags" },
  { label: "Semantic Embeddings", desc: "Generating 384d MiniLM vector representations" },
  { label: "Chroma & SQLite Index", desc: "Committing immutable provenance ledger" },
];

export function UploadProgressBar({
  isOpen,
  fileName,
  fileSize,
  progress,
  currentStepIndex,
  stepMessage,
  isComplete,
}: UploadProgressBarProps) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setSecondsElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 0.1);
    }, 100);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeFormatted = fileSize
    ? fileSize > 1024 * 1024
      ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
      : `${(fileSize / 1024).toFixed(1)} KB`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[28px] border-2 border-slate-200 shadow-2xl max-w-[560px] w-full p-7 overflow-hidden relative">
        {/* Top Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border-2 border-blue-100 flex items-center justify-center text-2xl shrink-0">
            📄
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-[18px] truncate">
                {fileName || "Health_Report.pdf"}
              </h3>
              <span className="text-[12px] font-mono text-slate-500 font-bold ml-2 shrink-0">
                {secondsElapsed.toFixed(1)}s
              </span>
            </div>
            <div className="text-[12px] text-slate-500 flex items-center gap-2">
              <span>{sizeFormatted || "PDF Document"}</span>
              <span>•</span>
              <span className="text-emerald-600 font-semibold">User Privacy Isolated</span>
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="mb-6 bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-[13px] font-bold mb-2">
            <span className="text-slate-800 flex items-center gap-2">
              {!isComplete ? (
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping inline-block" />
              ) : (
                <span className="text-emerald-600">✓</span>
              )}
              {stepMessage || "Processing report..."}
            </span>
            <span className="text-blue-600 font-mono font-bold text-[14px]">
              {Math.min(100, Math.round(progress))}%
            </span>
          </div>

          <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden p-0.5 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isComplete
                  ? "bg-emerald-500"
                  : "bg-linear-to-r from-blue-600 to-indigo-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
            />
          </div>
        </div>

        {/* 5 Sequential Pipeline Steps */}
        <div className="space-y-3 mb-6">
          <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
            Ingestion Pipeline Stages
          </div>
          {UPLOAD_STEPS.map((step, idx) => {
            const isDone = currentStepIndex > idx || isComplete;
            const isCurrent = currentStepIndex === idx && !isComplete;
            return (
              <div
                key={idx}
                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 ${
                  isCurrent
                    ? "bg-blue-50 border-blue-200 text-blue-950 font-medium"
                    : isDone
                    ? "bg-slate-50 border-slate-200 text-slate-700"
                    : "bg-white border-transparent text-slate-400"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
                    isDone
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                      ? "bg-blue-600 text-white animate-pulse"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}
                >
                  {isDone ? "✓" : idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold leading-tight">
                    {step.label}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {step.desc}
                  </div>
                </div>
                {isCurrent && (
                  <span className="text-[11px] text-blue-600 font-bold px-2 py-0.5 rounded-full bg-blue-100 shrink-0">
                    Running...
                  </span>
                )}
                {isDone && (
                  <span className="text-[11px] text-emerald-600 font-bold shrink-0">
                    Done
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Banner */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-100">
          <span>VitaGraph Fail-Closed Processing</span>
          <span>Zero external telemetry</span>
        </div>
      </div>
    </div>
  );
}
