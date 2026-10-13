// State of the RAG Lab: one run at a time on the server, followed live over SSE.
// Everything here comes from real events; the progress fraction is counted from them.

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  followRun,
  labApi,
  type LabCheck,
  type LabEvent,
  type LabHit,
  type LabMode,
  type LabRunSummary,
  type Scorecard,
} from "../api/lab";

export type RunStatus = "idle" | "running" | "finished" | "failed" | "stopped";

export interface RowState {
  id: string;
  status: "waiting" | "running" | "done";
  refused: boolean | null;
  hits: LabHit[];
  foundTerms: string[];
  missingTerms: string[];
  firstRelevantRank: number | null;
  retrievalMs: number | null;
  hasRetrieval: boolean;
  answer: {
    status: string;
    text: string;
    citedFiles: string[];
    safetyPassed: boolean | null;
    seconds: number | null;
  } | null;
  pass: boolean | null;
  checks: LabCheck[];
  ms: number | null;
}

export interface PrivacyCheck {
  identifiers: string[];
  leaks: number;
  pass: boolean;
}

export interface LabState {
  runId: string | null;
  status: RunStatus;
  mode: LabMode | null;
  files: Record<string, number>;
  filesTotal: number | null;
  rows: Record<string, RowState>;
  privacy: PrivacyCheck | null;
  scorecard: Scorecard | null;
  durationMs: number | null;
  error: string | null;
  startedAt: number | null;
}

export const SWEEP_SIZES = [120, 200, 300, 450, 600];

const INITIAL: LabState = {
  runId: null,
  status: "idle",
  mode: null,
  files: {},
  filesTotal: null,
  rows: {},
  privacy: null,
  scorecard: null,
  durationMs: null,
  error: null,
  startedAt: null,
};

export function emptyRow(id: string): RowState {
  return {
    id,
    status: "waiting",
    refused: null,
    hits: [],
    foundTerms: [],
    missingTerms: [],
    firstRelevantRank: null,
    retrievalMs: null,
    hasRetrieval: false,
    answer: null,
    pass: null,
    checks: [],
    ms: null,
  };
}

type Action =
  | { type: "begin"; mode: LabMode | null; runId: string | null }
  | { type: "event"; event: LabEvent }
  | { type: "end"; status: "failed" | "stopped"; error?: string };

function reducer(state: LabState, action: Action): LabState {
  if (action.type === "begin") {
    return { ...INITIAL, status: "running", mode: action.mode, runId: action.runId, startedAt: Date.now() };
  }
  if (action.type === "end") {
    if (state.status !== "running") return state;
    return { ...state, status: action.status, error: action.error ?? state.error };
  }
  const ev = action.event;
  const withRow = (id: string, patch: (row: RowState) => RowState): LabState => ({
    ...state,
    rows: { ...state.rows, [id]: patch(state.rows[id] ?? emptyRow(id)) },
  });
  switch (ev.type) {
    case "setup":
      if (ev.phase === "start" || !ev.file) {
        return { ...state, mode: ev.mode ?? state.mode, filesTotal: ev.files ?? state.filesTotal };
      }
      return {
        ...state,
        files: { ...state.files, [ev.file]: ev.chunks ?? 0 },
        filesTotal: ev.total ?? state.filesTotal,
      };
    case "question_started":
      return withRow(ev.id, (r) => ({ ...r, status: "running" }));
    case "gate":
      return withRow(ev.id, (r) => ({ ...r, refused: Boolean(ev.refused) }));
    case "retrieval":
      return withRow(ev.id, (r) => ({
        ...r,
        hasRetrieval: true,
        hits: ev.hits ?? [],
        foundTerms: ev.found_terms ?? [],
        missingTerms: ev.missing_terms ?? [],
        firstRelevantRank: ev.first_relevant_rank ?? null,
        retrievalMs: ev.ms ?? null,
      }));
    case "answer":
      return {
        ...withRow(ev.id, (r) => ({
          ...r,
          answer: {
            status: ev.status,
            text: ev.text ?? "",
            citedFiles: ev.cited_files ?? [],
            safetyPassed: ev.safety_passed ?? null,
            seconds: ev.seconds ?? null,
          },
        })),
        mode: "full",
      };
    case "question_finished":
      return withRow(ev.id, (r) => ({
        ...r,
        status: "done",
        pass: Boolean(ev.pass),
        checks: ev.checks ?? [],
        ms: typeof ev.ms === "number" ? ev.ms : (r.retrievalMs ?? 0) + (r.answer?.seconds ?? 0) * 1000,
      }));
    case "privacy_check":
      return { ...state, privacy: { identifiers: ev.identifiers ?? [], leaks: ev.leaks, pass: ev.pass } };
    case "scorecard":
      return { ...state, scorecard: ev.scorecard };
    case "run_finished":
      return { ...state, status: ev.status === "stopped" ? "stopped" : "finished", durationMs: ev.ms ?? state.durationMs, runId: ev.run_id || state.runId };
    case "error":
      return { ...state, status: "failed", error: ev.message };
    default:
      return state;
  }
}

/** Real fraction of the run: files read + questions finished + the privacy check, over the total of all three. */
export function progressOf(state: LabState, filesTotal: number, questionsTotal: number): number {
  if (state.status === "finished") return 1;
  const files = Math.max(filesTotal, state.filesTotal ?? 0);
  const total = files + questionsTotal + 1;
  if (total <= 0) return 0;
  const done =
    Object.keys(state.files).length +
    Object.values(state.rows).filter((r) => r.status === "done").length +
    (state.privacy ? 1 : 0);
  return Math.min(1, done / total);
}

type Outcome = "finished" | "failed" | "stopped" | "detached";

export interface UseLabRun {
  state: LabState;
  history: LabRunSummary[];
  historyError: string | null;
  sweep: { active: boolean; index: number; total: number; size: number | null };
  start: (mode: LabMode, chunkSize: number, topK: number) => Promise<void>;
  stop: () => void;
  runSweep: (topK: number, sizes?: number[]) => Promise<void>;
  refreshHistory: () => Promise<void>;
}

export function useLabRun(): UseLabRun {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [history, setHistory] = useState<LabRunSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [sweep, setSweep] = useState({ active: false, index: 0, total: 0, size: null as number | null });

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);
  const stopRequestedRef = useRef(false);

  const refreshHistory = useCallback(async () => {
    try {
      const rows = await labApi.runs(50);
      if (!mountedRef.current) return;
      setHistory(rows);
      setHistoryError(null);
    } catch (error) {
      if (mountedRef.current) {
        setHistoryError(error instanceof Error ? error.message : "Could not load the saved runs.");
      }
    }
  }, []);

  /** Follow one run until its stream ends. Resolves with how it ended. */
  const follow = useCallback(
    async (runId: string): Promise<Outcome> => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      runIdRef.current = runId;
      let terminal: Outcome | null = null;
      try {
        await followRun(
          runId,
          (event) => {
            if (!mountedRef.current) return;
            dispatch({ type: "event", event });
            if (event.type === "run_finished") terminal = event.status === "stopped" ? "stopped" : "finished";
            else if (event.type === "error") terminal = "failed";
          },
          controller.signal,
        );
      } catch (error) {
        if (!controller.signal.aborted && mountedRef.current) {
          dispatch({
            type: "end",
            status: "failed",
            error: error instanceof Error ? error.message : "The run stream broke.",
          });
          terminal = "failed";
        }
      }
      if (terminal) return terminal;
      if (controller.signal.aborted) return stopRequestedRef.current ? "stopped" : "detached";
      // The stream closed without a final event: ask the server what happened to the run.
      try {
        const saved = await labApi.run(runId);
        if (mountedRef.current) {
          if (saved.status === "finished" || saved.status === "completed") {
            if (saved.scorecard) dispatch({ type: "event", event: { type: "scorecard", scorecard: saved.scorecard } });
            dispatch({
              type: "event",
              event: { type: "run_finished", run_id: saved.id, ms: saved.duration_ms ?? null },
            });
            return "finished";
          }
          dispatch({
            type: "end",
            status: "failed",
            error: "The run stream ended before the run was finished.",
          });
        }
      } catch {
        if (mountedRef.current) {
          dispatch({ type: "end", status: "failed", error: "The run stream ended before the run was finished." });
        }
      }
      return "failed";
    },
    [],
  );

  const runOnce = useCallback(
    async (mode: LabMode, chunkSize: number, topK: number): Promise<Outcome> => {
      stopRequestedRef.current = false;
      runIdRef.current = null;
      dispatch({ type: "begin", mode, runId: null });
      let runId: string;
      try {
        runId = (await labApi.start({ mode, chunk_size: chunkSize, top_k: topK })).run_id;
      } catch (error) {
        dispatch({
          type: "end",
          status: "failed",
          error: error instanceof Error ? error.message : "The run could not start.",
        });
        return "failed";
      }
      if (stopRequestedRef.current) {
        void labApi.cancel(runId).catch(() => undefined);
        dispatch({ type: "end", status: "stopped" });
        return "stopped";
      }
      dispatch({ type: "begin", mode, runId });
      const outcome = await follow(runId);
      void refreshHistory();
      return outcome;
    },
    [follow, refreshHistory],
  );

  const start = useCallback(
    async (mode: LabMode, chunkSize: number, topK: number) => {
      await runOnce(mode, chunkSize, topK);
    },
    [runOnce],
  );

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    const runId = runIdRef.current;
    if (runId) void labApi.cancel(runId).catch(() => undefined);
    abortRef.current?.abort();
    dispatch({ type: "end", status: "stopped" });
  }, []);

  const runSweep = useCallback(
    async (topK: number, sizes: number[] = SWEEP_SIZES) => {
      stopRequestedRef.current = false;
      for (let i = 0; i < sizes.length; i += 1) {
        if (stopRequestedRef.current || !mountedRef.current) break;
        setSweep({ active: true, index: i, total: sizes.length, size: sizes[i] });
        const outcome = await runOnce("quick", sizes[i], topK);
        if (outcome !== "finished") break;
      }
      if (mountedRef.current) setSweep({ active: false, index: 0, total: 0, size: null });
    },
    [runOnce],
  );

  // On entering the page: load the saved runs and re-follow a run that is still going.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    void refreshHistory();
    labApi
      .active()
      .then(({ run_id }) => {
        if (cancelled || !run_id) return;
        stopRequestedRef.current = false;
        dispatch({ type: "begin", mode: null, runId: run_id });
        void follow(run_id).then((outcome) => {
          if (outcome !== "detached") void refreshHistory();
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [follow, refreshHistory]);

  return { state, history, historyError, sweep, start, stop, runSweep, refreshHistory };
}

/** Rebuild table rows from a saved run's `results` (array of question results, or an object holding them). */
export function rowsFromSaved(results: unknown): Record<string, RowState> {
  const record = (results && typeof results === "object" ? results : {}) as Record<string, unknown>;
  const list = Array.isArray(results)
    ? results
    : Array.isArray(record.questions)
      ? (record.questions as unknown[])
      : Array.isArray(record.results)
        ? (record.results as unknown[])
        : [];
  const rows: Record<string, RowState> = {};
  for (const item of list) {
    const r = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const id = String(r.id ?? r.question_id ?? "");
    if (!id) continue;
    const retrievalRaw = r.retrieval && typeof r.retrieval === "object" ? (r.retrieval as Record<string, unknown>) : null;
    const retrieval = retrievalRaw ?? {};
    const seenForbidden = Array.isArray(retrieval.seen_forbidden) ? (retrieval.seen_forbidden as string[]) : [];
    const gate = (r.gate && typeof r.gate === "object" ? r.gate : null) as Record<string, unknown> | null;
    const answer = (r.answer && typeof r.answer === "object" ? r.answer : null) as Record<string, unknown> | null;
    const hits = Array.isArray(retrieval.hits) ? (retrieval.hits as LabHit[]) : [];
    const refused = gate ? gate.refused : r.refused;
    rows[id] = {
      id,
      status: "done",
      refused: typeof refused === "boolean" ? refused : null,
      hits,
      foundTerms: Array.isArray(retrieval.found_terms) ? (retrieval.found_terms as string[]) : seenForbidden,
      missingTerms: Array.isArray(retrieval.missing_terms) ? (retrieval.missing_terms as string[]) : [],
      firstRelevantRank:
        typeof retrieval.first_relevant_rank === "number" ? retrieval.first_relevant_rank : null,
      retrievalMs: typeof retrieval.ms === "number" ? retrieval.ms : null,
      hasRetrieval: retrievalRaw !== null,
      answer: answer
        ? {
            status: String(answer.status ?? ""),
            text: String(answer.text ?? ""),
            citedFiles: Array.isArray(answer.cited_files) ? (answer.cited_files as string[]) : [],
            safetyPassed: typeof answer.safety_passed === "boolean" ? answer.safety_passed : null,
            seconds: typeof answer.seconds === "number" ? answer.seconds : null,
          }
        : null,
      pass: typeof r.pass === "boolean" ? r.pass : null,
      checks: Array.isArray(r.checks) ? (r.checks as LabCheck[]) : [],
      ms:
        (typeof retrieval.ms === "number" ? retrieval.ms : 0) +
        (answer && typeof answer.seconds === "number" ? answer.seconds * 1000 : 0),
    };
  }
  return rows;
}
