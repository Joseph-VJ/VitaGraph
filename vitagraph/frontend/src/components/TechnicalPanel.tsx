import { useEffect, useRef } from "react";

export interface LogItem {
  id: string;
  time: string;
  msg: string;
  type: "tool" | "py" | "db" | "llm" | "ok" | "warn" | "info";
}

export interface PipelineItem {
  label: string;
  state: "done" | "active" | "idle";
}

export function TechnicalPanel({
  logs,
  pipelineItems,
  backendConnected,
  chromaChunkCount,
  aiServiceModel,
  onClearLogs,
  onOpenAiSettings,
}: {
  logs: LogItem[];
  pipelineItems: PipelineItem[];
  backendConnected: boolean;
  chromaChunkCount: number | null;
  aiServiceModel?: string | null;
  onClearLogs: () => void;
  onOpenAiSettings?: () => void;
}) {
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to top when a new log arrives since it prepends, or stay scrolled
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs.length]);

  const colorForType = (type: LogItem["type"]) => {
    switch (type) {
      case "tool":
        return "text-cyan-300";
      case "py":
        return "text-blue-300";
      case "db":
        return "text-violet-300";
      case "llm":
        return "text-fuchsia-300";
      case "ok":
        return "text-emerald-300";
      case "warn":
        return "text-amber-300";
      case "info":
      default:
        return "text-white/60";
    }
  };

  return (
    <div className="order-2 xl:order-1 space-y-4 xl:sticky xl:top-[152px]">
      <div className="bg-[#0B1220] rounded-[20px] border border-slate-800 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              ⚡
            </div>
            <div>
              <div className="font-bold text-white text-[13px]">
                BACKGROUND CODE • LIVE
              </div>
              <div className="text-[11px] text-white/50">
                Tools running & processing
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold animate-pulse">
            ● LIVE
          </span>
        </div>

        {/* 7 Tech Tool Cards */}
        <div className="p-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/[0.05] border border-white/10 p-2.5">
            <div className="text-[10px] text-white/40 font-bold tracking-widest">
              FRONTEND
            </div>
            <div className="text-[12px] font-bold text-white">React 19 + TS</div>
            <div className="text-[10px] text-emerald-300">● Running</div>
          </div>

          <div className="rounded-xl bg-white/[0.05] border border-white/10 p-2.5">
            <div className="text-[10px] text-white/40 font-bold tracking-widest">
              BACKEND
            </div>
            <div className="text-[12px] font-bold text-white">FastAPI</div>
            <div className={`text-[10px] ${backendConnected ? "text-emerald-300 font-medium" : "text-blue-300"}`}>
              ● {backendConnected ? "Live (:8000)" : "Simulated/Offline"}
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.05] border border-white/10 p-2.5">
            <div className="text-[10px] text-white/40 font-bold tracking-widest">
              EXTRACTION
            </div>
            <div className="text-[12px] font-bold text-white">PyMuPDF</div>
            <div className="text-[10px] text-amber-300">+ Tesseract OCR</div>
          </div>

          <div className="rounded-xl bg-white/[0.05] border border-white/10 p-2.5">
            <div className="text-[10px] text-white/40 font-bold tracking-widest">
              EMBEDDING
            </div>
            <div className="text-[12px] font-bold text-white">MiniLM-L6-v2</div>
            <div className="text-[10px] text-violet-300">384d/768d vectors</div>
          </div>

          <div className="rounded-xl bg-white/[0.05] border border-white/10 p-2.5">
            <div className="text-[10px] text-white/40 font-bold tracking-widest">
              VECTOR DB
            </div>
            <div className="text-[12px] font-bold text-white">Chroma</div>
            <div className="text-[10px] text-emerald-300">
              user_id isolated ✓ {chromaChunkCount !== null && `(${chromaChunkCount} chk)`}
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.05] border border-white/10 p-2.5">
            <div className="text-[10px] text-white/40 font-bold tracking-widest">
              SQL
            </div>
            <div className="text-[12px] font-bold text-white">SQLite</div>
            <div className="text-[10px] text-white/60">Immutable forever</div>
          </div>

          <div className="rounded-xl bg-white/[0.05] border border-white/10 p-2.5 col-span-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-white/40 font-bold tracking-widest">
                LLM / AI GENERATION SERVICE
              </div>
              {onOpenAiSettings && (
                <button
                  type="button"
                  onClick={onOpenAiSettings}
                  className="text-[10px] text-violet-300 hover:text-violet-100 underline cursor-pointer"
                >
                  ⚙️ Configure AI Key
                </button>
              )}
            </div>
            <div className="flex justify-between items-center mt-1">
              <div className="text-[12px] font-bold text-white">
                {aiServiceModel ? `Model: ${aiServiceModel}` : "Offline Fallback Composer"}
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300">
                RAG • Grounded
              </span>
            </div>
            <div className="text-[10px] text-white/50 mt-1">
              Embedding: sentence-transformers/all-MiniLM-L6-v2 (384d)
            </div>
          </div>
        </div>

        {/* Live Processing Log */}
        <div className="px-3 pb-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-bold tracking-widest text-white/40">
              LIVE PROCESSING LOG • CODE WORDS
            </span>
            <button
              onClick={onClearLogs}
              className="text-[10px] px-2 py-1 rounded-full bg-white/10 border border-white/10 text-white/60 hover:text-white hover:bg-white/20 transition cursor-pointer"
            >
              Clear
            </button>
          </div>
          <div
            ref={logContainerRef}
            id="detailedLog"
            className="mono text-[11px] leading-[1.6] bg-black/40 border border-white/10 rounded-xl p-3 h-[380px] overflow-y-auto space-y-1.5"
          >
            {logs.length === 0 ? (
              <div className="text-white/30 italic text-center pt-8">
                Log cleared. Actions will appear here live.
              </div>
            ) : (
              logs.map((item) => (
                <div key={item.id} className="flex gap-2">
                  <span className="text-white/30 shrink-0 text-[10px] select-none">
                    {item.time}
                  </span>
                  <span className={colorForType(item.type)}>{item.msg}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pipeline Status */}
        <div className="p-3 border-t border-white/10">
          <div className="text-[11px] font-bold tracking-widest text-white/40 mb-2">
            PIPELINE STATUS
          </div>
          <div className="space-y-2">
            {pipelineItems.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2.5">
                <div
                  className={`w-2 h-2 rounded-full transition-colors ${
                    it.state === "done"
                      ? "bg-emerald-400"
                      : it.state === "active"
                      ? "bg-amber-400 animate-pulse"
                      : "bg-white/20"
                  }`}
                />
                <div
                  className={`text-[11px] ${
                    it.state === "active"
                      ? "text-white font-bold"
                      : it.state === "done"
                      ? "text-white/80"
                      : "text-white/40"
                  }`}
                >
                  {it.label}{" "}
                  {it.state === "active" ? "• RUNNING" : it.state === "done" ? "• done" : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
