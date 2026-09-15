// Internal persona timeline (plan Workflow I): chronological system events
// for the active persona — identifiers, statuses, and counts only.

import { useCallback, useEffect, useState } from "react";
import { timelineApi } from "../api/questions";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useActiveUser } from "../context/UserContext";
import type { TimelineEvent } from "../types";

const EVENT_LABELS: Record<string, string> = {
  persona_created: "Persona created",
  report_uploaded: "Report uploaded",
  report_indexed: "Report indexed",
  question_asked: "Question asked",
  answer_generated: "Answer generated",
  processing_failed: "Processing failed",
};

function describe(event: TimelineEvent): string {
  const payload = event.payload as Record<string, unknown>;
  switch (event.event_type) {
    case "report_uploaded":
      return `${String(payload.filename)} (v${String(payload.version)})`;
    case "report_indexed":
      return `${String(payload.pages)} page(s), ${String(payload.chunks)} evidence chunk(s)`;
    case "question_asked":
      return `classified ${String(payload.classification)} · ${String(payload.status)}`;
    case "answer_generated":
      return `${String(payload.evidence_count)} evidence card(s) · service ${String(payload.ai_service_status)}`;
    case "processing_failed":
      return String(payload.error ?? "");
    default:
      return "";
  }
}

export function TimelinePage() {
  const { user } = useActiveUser();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!user) return;
    timelineApi
      .events(user.id)
      .then(setEvents)
      .catch((e) => setError((e as Error).message));
  }, [user]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000); // lightweight local polling
    return () => clearInterval(interval);
  }, [refresh]);

  if (!user) {
    return <EmptyState title="No persona selected" hint="Pick or create a persona first." />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-100">Persona timeline</h2>
      {error && <ErrorState message={error} />}
      {events.length === 0 && !error && (
        <EmptyState title="No events yet" hint="Upload a report or ask a question." />
      )}
      <ol className="space-y-2">
        {events.map((event) => (
          <li
            key={event.id}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-slate-200">
                {EVENT_LABELS[event.event_type] ?? event.event_type}
              </p>
              <p className="shrink-0 text-xs text-slate-500">{event.timestamp}</p>
            </div>
            {describe(event) && <p className="mt-0.5 text-xs text-slate-400">{describe(event)}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
