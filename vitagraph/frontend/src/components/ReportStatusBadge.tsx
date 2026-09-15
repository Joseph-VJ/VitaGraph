// Status badge for the report lifecycle: received -> extracting ->
// indexing -> ready | failed.

const STYLES: Record<string, string> = {
  received: "bg-slate-700 text-slate-200",
  extracting: "bg-sky-600/30 text-sky-300 border border-sky-500/40",
  indexing: "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40",
  ready: "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40",
  failed: "bg-rose-600/30 text-rose-300 border border-rose-500/40",
};

export function ReportStatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.received;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
