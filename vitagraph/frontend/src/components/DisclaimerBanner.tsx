// Non-diagnostic disclaimer, visible on every screen (plan Section 15.2).

export function DisclaimerBanner() {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
      <strong className="font-semibold">Educational tool.</strong> VitaGraph organizes and
      explains uploaded reports with citations. It does not diagnose, treat, or replace
      advice from a qualified healthcare professional.
    </div>
  );
}
