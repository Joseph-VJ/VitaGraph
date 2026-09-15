// Friendly empty state used across pages.

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
