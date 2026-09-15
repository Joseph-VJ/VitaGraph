import { STAGES } from "../data/mockData";

export function StepperBar({
  currentStage,
  onGoToStage,
  backendConnected,
}: {
  currentStage: number;
  onGoToStage: (index: number) => void;
  backendConnected: boolean;
}) {
  const stage = STAGES[currentStage] || STAGES[0];

  return (
    <div className="bg-white rounded-[20px] border-2 border-slate-200 p-4 mb-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        {/* Horizontal scrollable stepper buttons */}
        <div id="stepper" className="flex items-center gap-1 flex-1 overflow-x-auto pb-1">
          {STAGES.map((s, i) => {
            const active = i === currentStage;
            const done = i < currentStage;
            return (
              <div key={s.id} className="flex items-center shrink-0">
                <button
                  onClick={() => onGoToStage(i)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left shrink-0 transition cursor-pointer ${
                    active
                      ? "bg-blue-600 text-white shadow-md"
                      : done
                      ? "bg-emerald-50 border-2 border-emerald-200 text-emerald-800"
                      : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-white"
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold ${
                      active
                        ? "bg-white/20"
                        : done
                        ? "bg-emerald-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    {done ? "✓" : s.icon}
                  </span>
                  <span className="hidden md:block">
                    <span className="block text-[12px] font-bold leading-none">
                      {s.label}
                    </span>
                    <span className="block text-[10px] opacity-70 mt-0.5">
                      {s.sub}
                    </span>
                  </span>
                </button>

                {i < STAGES.length - 1 && (
                  <span className="hidden md:block w-4 lg:w-6 h-px bg-slate-200 shrink-0 mx-1"></span>
                )}
              </div>
            );
          })}
        </div>

        {/* Status Pills on right */}
        <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-500 shrink-0 ml-4 pl-4 border-l border-slate-200">
          <span className="flex items-center gap-1.5 font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                backendConnected ? "bg-emerald-500 animate-pulse" : "bg-blue-500"
              }`}
            ></span>{" "}
            FastAPI {backendConnected ? "(live :8000)" : "(sim)"}
          </span>
          <span className="font-medium text-slate-600">Chroma private DB</span>
          <span className="font-medium text-slate-600">Colab LLM (sim)</span>
        </div>
      </div>

      {/* Sub-bar with stage description & counter */}
      <div className="mt-3 flex items-center gap-2 text-[11px] flex-wrap">
        <span
          id="stageBadge"
          className="px-3 py-1 rounded-full bg-blue-600 text-white font-bold shrink-0"
        >
          Step {currentStage + 1} of {STAGES.length} • {stage.label}
        </span>
        <span id="stageDesc" className="text-slate-600 font-medium">
          {stage.desc}
        </span>
        <span className="ml-auto text-[11px] text-slate-400 shrink-0">
          Step <span id="stepCounter">{currentStage + 1}</span>/{STAGES.length} •
          Doctor view • Big cards • Easy words + Left technical
        </span>
      </div>
    </div>
  );
}
