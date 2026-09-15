import { useEffect, useRef } from "react";
import type { TrendData } from "../api/reports";
import type { Report } from "../types";

export interface SimpleLogItem {
  id: string;
  time: string;
  msg: string;
}

export function PatientFilePanel({
  saveChoice,
  simpleLogs,
  activePersonaName = "Arjun R",
  activePersonaId = "VG-2026-001",
  activePersonaReportsCount = 3,
  trendData = null,
  reports = [],
  allFindingsCount = 0,
  onOpenPersonaModal,
}: {
  saveChoice: boolean | null;
  simpleLogs: SimpleLogItem[];
  activePersonaName?: string;
  activePersonaId?: string;
  activePersonaReportsCount?: number;
  trendData?: TrendData | null;
  reports?: Report[];
  allFindingsCount?: number;
  onOpenPersonaModal?: () => void;
}) {
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [simpleLogs.length]);

  const displayReportsCount = reports.length > 0 ? reports.length : activePersonaReportsCount;

  return (
    <div className="order-3 space-y-4 xl:sticky xl:top-[152px]">
      {/* Patient File (CRM) */}
      <div className="bg-white rounded-[22px] border-2 border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold jakarta text-[14px]">Patient File (CRM)</h3>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] border-2 border-emerald-200 font-bold">
            Active • Patient/customer
          </span>
        </div>

        {/* Patient Bio */}
        <div
          onClick={onOpenPersonaModal}
          className="flex gap-3 mb-4 items-center p-2 rounded-xl hover:bg-slate-50 transition cursor-pointer"
          title="Click to switch or manage personas"
        >
          <img
            src="https://i.pravatar.cc/100?img=32"
            alt="Patient"
            className="w-12 h-12 rounded-2xl border-2 border-slate-200 object-cover shadow-sm shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[14px] truncate flex items-center gap-1.5">
              <span>{activePersonaName}</span>
              <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                switch
              </span>
            </div>
            <div className="text-[12px] text-slate-500">24y • Male • Chennai</div>
            <div className="text-[11px] text-slate-400 truncate">
              ID: {activePersonaId} • {displayReportsCount} reports forever
            </div>
          </div>
        </div>

        {/* 3 Metric Badges */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-slate-50 border-2 border-slate-100 p-2.5 text-center">
            <div className="text-[20px] font-bold text-slate-800">
              {displayReportsCount}
            </div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Reports forever
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 border-2 border-slate-100 p-2.5 text-center">
            <div className="text-[20px] font-bold text-slate-800">
              {allFindingsCount > 0 ? allFindingsCount : 24}
            </div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Notes
            </div>
          </div>
          <div className="rounded-xl bg-blue-50 border-2 border-blue-200 p-2.5 text-center">
            <div className="text-[20px] font-bold text-blue-700">100%</div>
            <div className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">
              Private
            </div>
          </div>
        </div>

        {/* Timeline of Reports */}
        <div id="timeline" className="space-y-2 text-[11px]">
          {reports.length > 0 ? (
            reports.map((r, idx) => {
              const isLatest = idx === 0;
              return (
                <div key={r.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <div
                      className={`rounded-full mt-1 ${
                        isLatest
                          ? "w-3.5 h-3.5 bg-emerald-500 ring-4 ring-emerald-100"
                          : idx === 1
                          ? "w-2.5 h-2.5 bg-blue-500"
                          : "w-2.5 h-2.5 bg-slate-300"
                      }`}
                    />
                    {idx < reports.length - 1 && <div className="w-px h-8 bg-slate-200" />}
                  </div>
                  <div className="pb-3">
                    <div className="font-bold text-[12px] text-slate-800">
                      {r.report_date || "Dated Report"} {isLatest ? (saveChoice === false ? "• (Preview only)" : "• (Immutable)") : `• Version ${r.version}`}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[240px]">
                      {r.original_filename} • {r.page_count ?? 1} pg
                    </div>
                    <div className="mt-1 flex gap-1 items-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-bold">
                        ✓ SQLite
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {r.file_hash.slice(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-3 text-slate-400 text-xs">
              No reports indexed yet.
            </div>
          )}
        </div>

        {/* Longitudinal Hemoglobin Trend Curve */}
        <div className="mt-4 p-3 rounded-xl bg-blue-50 border-2 border-blue-200">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-bold text-blue-800">
              {trendData?.test_name || "Hemoglobin"} trend
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border-2 font-bold ${
                trendData?.trend_direction === "improving"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : trendData?.trend_direction === "declining"
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-white border-blue-200 text-blue-700"
              }`}
            >
              {trendData?.trend_direction === "improving"
                ? "↑ improving"
                : trendData?.trend_direction === "declining"
                ? "↓ declining"
                : "→ stable"}
            </span>
          </div>

          {trendData && trendData.points && trendData.points.length > 0 ? (
            (() => {
              const pts = trendData.points;
              const vals = pts.map((p) => p.value);
              const minV = Math.min(...vals);
              const maxV = Math.max(...vals);
              const rangeV = maxV - minV === 0 ? 1 : maxV - minV;
              const coords = pts.map((p, i) => ({
                x: pts.length === 1 ? 100 : 15 + (i / (pts.length - 1)) * 170,
                y: 32 - ((p.value - minV) / rangeV) * 22,
                v: p.value,
                d: p.date,
              }));
              const pathStr = coords.reduce(
                (acc, c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`),
                ""
              );

              return (
                <>
                  <svg width="100%" height="36" viewBox="0 0 200 40">
                    <path
                      d={pathStr}
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {coords.map((c, i) => (
                      <circle
                        key={i}
                        cx={c.x}
                        cy={c.y}
                        r={i === coords.length - 1 ? 4.5 : 3.5}
                        fill="#2563EB"
                        stroke="white"
                        strokeWidth={i === coords.length - 1 ? 2.5 : 2}
                      />
                    ))}
                  </svg>
                  <div className="flex justify-between text-[10px] text-slate-600 font-medium">
                    <span>
                      {trendData.start_value ?? vals[0]} → {trendData.latest_value ?? vals[vals.length - 1]}{" "}
                      {trendData.unit}
                    </span>
                    <span>
                      {pts[0].date} → {pts[pts.length - 1].date}
                    </span>
                  </div>
                </>
              );
            })()
          ) : (
            <>
              <svg width="100%" height="36" viewBox="0 0 200 40">
                <path
                  d="M0 28 Q 60 22, 100 14 T 200 6"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="100" cy="14" r="3.5" fill="#2563EB" stroke="white" strokeWidth="2" />
                <circle cx="200" cy="6" r="5" fill="#2563EB" stroke="white" strokeWidth="2.5" />
              </svg>
              <div className="flex justify-between text-[10px] text-slate-600 font-medium">
                <span>13.1 → 14.0 g/dL</span>
                <span>Jan → Feb 2026</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SIMPLE LOG (for doctors) */}
      <div className="bg-white rounded-[20px] border-2 border-slate-200 p-4 shadow-sm">
        <div className="text-[11px] font-bold tracking-widest text-slate-400">
          SIMPLE LOG (for doctors)
        </div>
        <div
          ref={logRef}
          id="simpleLog"
          className="mt-2 space-y-1.5 text-[11px] max-h-[160px] overflow-y-auto"
        >
          {simpleLogs.map((item) => (
            <div key={item.id} className="flex gap-2">
              <span className="text-slate-400 shrink-0 font-mono text-[10px]">
                {item.time}
              </span>
              <span className="text-slate-700">{item.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
