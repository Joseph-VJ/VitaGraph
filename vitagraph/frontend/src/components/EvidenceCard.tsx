// One cited evidence card: report, date, page, snippet, relevance score.

import type { EvidenceCard as EvidenceCardType } from "../types";

export function EvidenceCard({ evidence }: { evidence: EvidenceCardType }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        <span className="font-medium text-slate-200">{evidence.report_filename}</span>
        {evidence.report_date && <span>{evidence.report_date}</span>}
        <span>page {evidence.page_number}</span>
        <span className="rounded bg-slate-800 px-1.5 py-0.5">relevance {evidence.score.toFixed(2)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-slate-300">{evidence.snippet}</p>
    </div>
  );
}
