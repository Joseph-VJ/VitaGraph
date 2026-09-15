// The mandatory four-part answer view (plan Section 10):
// what the reports say, evidence used, what cannot be concluded, safety.

import type { Answer } from "../types";
import { EvidenceCard } from "./EvidenceCard";

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  answered: { text: "Answered from your reports", className: "text-emerald-300" },
  refused: { text: "Outside project boundary — refused", className: "text-amber-300" },
  insufficient_evidence: {
    text: "Insufficient evidence in your reports",
    className: "text-sky-300",
  },
  error: { text: "Request failed", className: "text-rose-300" },
};

export function AnswerView({ answer }: { answer: Answer }) {
  const badge = STATUS_LABEL[answer.status] ?? STATUS_LABEL.error;

  return (
    <div className="space-y-4">
      <div className={`text-sm font-medium ${badge.className}`}>
        {badge.text}
        <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
          AI service: {answer.ai_service_status}
        </span>
      </div>

      {/* Part 1: what the reports say */}
      <section>
        <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-slate-400">
          What the reports say
        </h3>
        <p className="whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm leading-relaxed text-slate-200">
          {answer.summary_text}
        </p>
      </section>

      {/* Part 2: evidence used */}
      {answer.evidence.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Evidence used
          </h3>
          <div className="grid gap-2">
            {answer.evidence.map((card) => (
              <EvidenceCard key={card.chunk_id} evidence={card} />
            ))}
          </div>
        </section>
      )}

      {/* Part 3: what cannot be concluded */}
      <section>
        <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-slate-400">
          What cannot be concluded
        </h3>
        <p className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm leading-relaxed text-slate-400">
          {answer.limitations_text}
        </p>
      </section>

      {/* Part 4: safety guidance */}
      <section>
        <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Safety guidance
        </h3>
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-200">
          {answer.safety_text}
        </p>
      </section>
    </div>
  );
}
