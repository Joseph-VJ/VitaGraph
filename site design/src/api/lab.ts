// RAG Lab API: the system grades itself on a fixed set of test questions (backend: /api/lab).

import { api, ApiError, BASE_URL } from "./client";
import { readSse } from "../lib/sse";

export type LabMode = "quick" | "full";
export type LabExpect = "answer" | "not_found" | "refuse";

export interface LabGoldQuestion {
  id: string;
  question: string;
  expect: LabExpect;
  files: string[];
  must_contain: string[];
  answer_must_contain: string[];
}

export interface LabGold {
  questions: LabGoldQuestion[];
  files: string[];
  identifiers: string[];
}

export interface LabHit {
  rank: number;
  file: string;
  page: number | null;
  score: number | null;
  snippet: string;
  relevant: boolean;
}

export interface LabCheck {
  name: string;
  pass: boolean;
  detail: string;
}

/** Every value is null when it does not apply to the run (for example answer scores in a quick run). */
export interface Scorecard {
  questions_total: number | null;
  passed: number | null;
  failed: number | null;
  answerable: number | null;
  retrieval_hits: number | null;
  retrieval_hit_rate: number | null;
  evidence_recall: number | null;
  mrr: number | null;
  context_precision: number | null;
  refusal_total: number | null;
  refusal_correct: number | null;
  false_refusals: number | null;
  not_found_total: number | null;
  not_found_ok: number | null;
  identifier_leaks: number | null;
  retrieval_ms_avg: number | null;
  duration_ms: number | null;
  answer_accuracy: number | null;
  citation_correctness: number | null;
  grounded_rate: number | null;
  avg_answer_s: number | null;
  max_answer_s: number | null;
  safety_passed_rate: number | null;
}

export interface LabRunSummary {
  id: string;
  created_at: string;
  mode: LabMode;
  chunk_size: number;
  top_k: number;
  status: string;
  duration_ms: number | null;
  scorecard: Scorecard | null;
}

export interface LabSavedRun extends LabRunSummary {
  results: unknown;
}

export interface LabStartBody {
  mode: LabMode;
  chunk_size: number;
  top_k: number;
}

/** One streamed frame. `type` is the SSE event type; the other fields are the frame's `metadata`. */
export type LabEvent =
  | {
      type: "setup";
      phase?: "start" | "ingest";
      file?: string;
      index?: number;
      total?: number;
      chunks?: number;
      ms?: number;
      mode?: LabMode;
      files?: number;
      questions?: number;
    }
  | { type: "question_started"; id: string; index?: number; total?: number }
  | { type: "gate"; id: string; refused: boolean }
  | {
      type: "retrieval";
      id: string;
      hits: LabHit[];
      found_terms: string[];
      missing_terms: string[];
      first_relevant_rank: number | null;
      ms: number | null;
    }
  | {
      type: "answer";
      id: string;
      status: string;
      text: string;
      cited_files: string[];
      safety_passed: boolean | null;
      seconds: number | null;
    }
  | { type: "question_finished"; id: string; pass: boolean; checks: LabCheck[]; ms?: number }
  | { type: "privacy_check"; identifiers: string[]; leaks: number; pass: boolean }
  | { type: "scorecard"; scorecard: Scorecard }
  | { type: "run_finished"; run_id: string; ms: number | null; status?: string }
  | { type: "error"; message: string };

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeGold(raw: unknown): LabGold {
  const record = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(raw) ? raw : asArray<Record<string, unknown>>(record.questions);
  const questions: LabGoldQuestion[] = list.map((q) => {
    const item = q as Record<string, unknown>;
    return {
      id: String(item.id ?? ""),
      question: String(item.question ?? ""),
      expect: (item.expect as LabExpect) ?? "answer",
      files: asArray<string>(item.files),
      must_contain: asArray<string>(item.must_contain),
      answer_must_contain: asArray<string>(item.answer_must_contain),
    };
  });
  const fileSet = new Set<string>(
    asArray<unknown>(record.files).map((f) =>
      typeof f === "string" ? f : String((f as Record<string, unknown>)?.name ?? ""),
    ),
  );
  fileSet.delete("");
  if (fileSet.size === 0) questions.forEach((q) => q.files.forEach((f) => fileSet.add(f)));
  return { questions, files: [...fileSet], identifiers: asArray<string>(record.identifiers) };
}

/** Frames carry the typed payload in `metadata`; fall back to the frame itself. */
function payloadOf(data: Record<string, unknown>): Record<string, unknown> {
  const metadata = data.metadata;
  return metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : data;
}

const EVENT_TYPES = new Set([
  "setup",
  "question_started",
  "gate",
  "retrieval",
  "answer",
  "question_finished",
  "privacy_check",
  "scorecard",
  "run_finished",
  "error",
]);

export const labApi = {
  gold: async (): Promise<LabGold> => normalizeGold(await api.get<unknown>("/api/lab/gold")),
  start: (body: LabStartBody) => api.post<{ run_id: string }>("/api/lab/runs", body),
  cancel: (runId: string) => api.post<{ cancelled: boolean }>(`/api/lab/runs/${encodeURIComponent(runId)}/cancel`, {}),
  active: () => api.get<{ run_id: string | null }>("/api/lab/active"),
  runs: (limit = 50) => api.get<LabRunSummary[]>(`/api/lab/runs?limit=${limit}`),
  run: (runId: string) => api.get<LabSavedRun>(`/api/lab/runs/${encodeURIComponent(runId)}`),
};

/**
 * Follow one run: the server replays every past event, then streams new ones until the run ends.
 * Resolves when the stream closes. An abort resolves quietly.
 */
export async function followRun(
  runId: string,
  onEvent: (event: LabEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/lab/runs/${encodeURIComponent(runId)}/events`, {
      headers: { Accept: "text/event-stream" },
      signal,
    });
  } catch (error) {
    if (signal.aborted) return;
    throw new ApiError(0, "Cannot reach the VitaGraph backend. Is it running on port 8000?");
  }
  if (!res.ok) throw new ApiError(res.status, `The run stream did not open (${res.status}).`);
  try {
    await readSse(res, (event, data) => {
      if (!EVENT_TYPES.has(event)) return;
      const payload = payloadOf(data);
      // The scorecard frame is the scorecard itself; every other frame spreads into the event.
      if (event === "scorecard") {
        onEvent({ type: "scorecard", scorecard: payload as unknown as Scorecard });
        return;
      }
      onEvent({ ...payload, type: event } as unknown as LabEvent);
    });
  } catch (error) {
    if (signal.aborted) return;
    throw error;
  }
}
