// Visible failure state — errors are always shown, never hidden
// (plan Section 20: UI error-state coverage).

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
      <strong className="font-semibold">Something failed.</strong> {message}
    </div>
  );
}
