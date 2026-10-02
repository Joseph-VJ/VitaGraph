import { useState, useRef, useEffect, useCallback } from "react";

// Consumes POST /api/questions/stream (CLAUDE.md §3 contract).
// EventSource is GET-only, so the stream is read via fetch + ReadableStream
// and torn down through an AbortController (same cleanup discipline as useJobStream).

import { BASE_URL } from "../api/client";

export type AgentStreamStatus = "idle" | "connecting" | "streaming" | "completed" | "error";

export interface ThinkingLog {
  id: number; // shared monotonic sequence with ToolCall.seq
  text: string;
}

export type ToolStatus = "pending" | "completed" | "failed";

export interface ToolCall {
  id: string;
  seq: number;
  tool: string;
  arguments: Record<string, unknown>;
  status: ToolStatus;
  result?: unknown;
}

export interface StageEvent {
  id: number; // shared monotonic sequence with ToolCall.seq / ThinkingLog.id
  stage: string;
  description: string;
  detail: string;
  latency: string;
}

export interface ToolResult {
  id: string;
  tool: string;
  result: unknown;
}

export interface ModelFallback {
  id: number;
  reason: string;
}

export interface AgentEvidenceRef {
  chunk_id: string;
  snippet: string;
  report_filename: string;
  report_date: string | null;
  page_number: number;
  score: number;
}

export interface AgentStreamOptions {
  /** Restrict retrieval to one report ("chat with this PDF"). */
  reportId?: string | null;
  /** rag_ai = retrieve evidence then let the AI compose; rag_only = evidence without calling the AI. */
  mode?: "rag_ai" | "rag_only";
}

export interface UseAgentStreamReturn {
  status: AgentStreamStatus;
  /** true once the terminal `completed`/done event arrived, even if an error event preceded it */
  finished: boolean;
  /** true when the backend's safety check rejected the streamed AI text (it was replaced server-side) */
  answerWithheld: boolean;
  thinkingLogs: ThinkingLog[];
  stageEvents: StageEvent[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  finalAnswer: string;
  modelFallbacks: ModelFallback[];
  evidence: AgentEvidenceRef[];
  error: string | null;
  diagnostic: string | null;
  start: (userId: string, text: string, jobId?: string, opts?: AgentStreamOptions) => void;
  abort: () => void;
  reset: () => void;
}

interface RawEvent {
  event: string;
  data: any;
}

// Typed payload lives in `metadata` on broker events, or at top level in raw contract form.
function payloadOf(data: any): Record<string, any> {
  if (data && typeof data === "object" && data.metadata && typeof data.metadata === "object") {
    return data.metadata;
  }
  return data && typeof data === "object" ? data : {};
}

export function useAgentStream(): UseAgentStreamReturn {
  const [status, setStatus] = useState<AgentStreamStatus>("idle");
  const [thinkingLogs, setThinkingLogs] = useState<ThinkingLog[]>([]);
  const [stageEvents, setStageEvents] = useState<StageEvent[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [modelFallbacks, setModelFallbacks] = useState<ModelFallback[]>([]);
  const [evidence, setEvidence] = useState<AgentEvidenceRef[]>([]);
  const [finished, setFinished] = useState(false);
  const [answerWithheld, setAnswerWithheld] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const idRef = useRef(0);
  const thinkingOpenRef = useRef(false);
  // text_delta tokens arrive many times per frame; coalesce into one state write per frame.
  const bufferRef = useRef("");
  const rafRef = useRef<number | null>(null);

  const flushBuffer = useCallback(() => {
    rafRef.current = null;
    if (!isMountedRef.current || !bufferRef.current) return;
    const chunk = bufferRef.current;
    bufferRef.current = "";
    setFinalAnswer((prev) => prev + chunk);
  }, []);

  const teardown = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    bufferRef.current = "";
  }, []);

  // Public stop: tear down and leave the UI idle (partial answer text is kept).
  const abort = useCallback(() => {
    teardown();
    if (isMountedRef.current) {
      setStatus((s) => (s === "connecting" || s === "streaming" ? "idle" : s));
    }
  }, [teardown]);

  const reset = useCallback(() => {
    teardown();
    if (!isMountedRef.current) return;
    thinkingOpenRef.current = false;
    setStatus("idle");
    setFinished(false);
    setAnswerWithheld(false);
    setThinkingLogs([]);
    setStageEvents([]);
    setToolCalls([]);
    setToolResults([]);
    setFinalAnswer("");
    setModelFallbacks([]);
    setEvidence([]);
    setError(null);
    setDiagnostic(null);
  }, [teardown]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      teardown();
    };
  }, [teardown]);

  const handleEvent = useCallback(
    ({ event, data }: RawEvent) => {
      if (!isMountedRef.current) return;
      const p = payloadOf(data);

      switch (event) {
        case "thinking": {
          // The backend streams reasoning token by token; merge consecutive tokens into one log line.
          // A tool call in between starts a new line (thinkingOpenRef is cleared there).
          const text = String(p.thinking ?? data?.description ?? "");
          if (!text) break;
          if (thinkingOpenRef.current) {
            setThinkingLogs((prev) => {
              if (prev.length === 0) return [{ id: idRef.current++, text }];
              const next = prev.slice();
              next[next.length - 1] = { ...next[next.length - 1], text: next[next.length - 1].text + text };
              return next;
            });
          } else {
            thinkingOpenRef.current = true;
            setThinkingLogs((prev) => [...prev, { id: idRef.current++, text }]);
          }
          break;
        }
        case "tool_call": {
          thinkingOpenRef.current = false;
          const id = String(p.id ?? `call_${idRef.current++}`);
          setToolCalls((prev) =>
            prev.some((t) => t.id === id)
              ? prev
              : [...prev, { id, seq: idRef.current++, tool: String(p.tool ?? "tool"), arguments: p.arguments ?? {}, status: "pending" }]
          );
          break;
        }
        case "tool_result": {
          const id = String(p.id ?? "");
          const failed = !!(p.result && typeof p.result === "object" && (p.result as any).error);
          setToolResults((prev) => [...prev, { id, tool: String(p.tool ?? ""), result: p.result }]);
          setToolCalls((prev) => {
            // Match by id; fall back to the oldest pending call of the same tool.
            let idx = prev.findIndex((t) => t.id === id);
            if (idx < 0) idx = prev.findIndex((t) => t.tool === p.tool && t.status === "pending");
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = { ...next[idx], status: failed ? "failed" : "completed", result: p.result };
            return next;
          });
          const ev = p.result?.evidence;
          if (p.tool === "search_chroma" && Array.isArray(ev)) {
            setEvidence((prev) => {
              const seen = new Set(prev.map((e) => e.chunk_id));
              return [...prev, ...(ev as AgentEvidenceRef[]).filter((e) => e.chunk_id && !seen.has(e.chunk_id))];
            });
          }
          break;
        }
        case "text_delta": {
          const delta = String(p.delta ?? "");
          if (!delta) break;
          bufferRef.current += delta;
          if (rafRef.current === null) rafRef.current = requestAnimationFrame(flushBuffer);
          break;
        }
        case "model_fallback": {
          // Provider/model names are never surfaced in UI (AGENTS.md); keep only a neutral reason.
          setModelFallbacks((prev) => [
            ...prev,
            { id: idRef.current++, reason: "Primary engine unavailable; continued on a backup engine." },
          ]);
          break;
        }
        case "error": {
          setError(String(p.message ?? p.error ?? data?.description ?? "Stream failed"));
          setDiagnostic(p.diagnostic ? String(p.diagnostic) : null);
          setStatus("error");
          break;
        }
        case "completed": {
          // Terminal broker event carries stage "done"; the model-level one precedes it.
          if (data?.stage === "done") {
            if (rafRef.current !== null) {
              cancelAnimationFrame(rafRef.current);
              flushBuffer();
            }
            setFinished(true);
            setStatus((s) => (s === "error" ? s : "completed"));
          } else if (p.safety_passed === false) {
            setAnswerWithheld(true);
          } else if (typeof p.summary_text === "string" && p.summary_text) {
            // No deltas were streamed: fall back to the finalized text.
            setFinalAnswer((prev) => (prev || bufferRef.current ? prev : String(p.summary_text)));
          }
          break;
        }
        case "message": {
          // Untyped pipeline stage events (retrieval, reranking, graph, safety, citation).
          // The terminal "done" marker is not a pipeline step.
          if (data?.stage && data.stage !== "done") {
            setStageEvents((prev) => [
              ...prev,
              {
                id: idRef.current++,
                stage: String(data.stage),
                description: String(data.description ?? ""),
                detail: String(data.subDescription ?? ""),
                latency: String(data.latency ?? ""),
              },
            ]);
          }
          break;
        }
        default:
          break;
      }
    },
    [flushBuffer]
  );

  const start = useCallback(
    (userId: string, text: string, jobId?: string, opts?: AgentStreamOptions) => {
      teardown();
      const controller = new AbortController();
      controllerRef.current = controller;

      setStatus("connecting");
      setFinished(false);
      setAnswerWithheld(false);
      setThinkingLogs([]);
      setStageEvents([]);
      setToolCalls([]);
      setToolResults([]);
      setFinalAnswer("");
      setModelFallbacks([]);
      setEvidence([]);
      setError(null);
      setDiagnostic(null);
      bufferRef.current = "";
      thinkingOpenRef.current = false;

      (async () => {
        try {
          const res = await fetch(`${BASE_URL}/api/questions/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
            body: JSON.stringify({
              user_id: userId,
              text,
              ...(jobId ? { job_id: jobId } : {}),
              ...(opts?.reportId ? { report_id: opts.reportId } : {}),
              ...(opts?.mode ? { mode: opts.mode } : {}),
            }),
            signal: controller.signal,
          });
          if (!res.ok || !res.body) {
            throw new Error(`Stream request failed (${res.status})`);
          }
          if (isMountedRef.current) setStatus("streaming");

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          let sawTerminal = false;

          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });

            let sep: number;
            while ((sep = buf.search(/\r?\n\r?\n/)) >= 0) {
              const block = buf.slice(0, sep);
              buf = buf.slice(sep).replace(/^\r?\n\r?\n/, "");
              let event = "message";
              const dataLines: string[] = [];
              for (const line of block.split(/\r?\n/)) {
                if (line.startsWith(":")) continue; // comment / keep-alive
                if (line.startsWith("event:")) event = line.slice(6).trim();
                else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
              }
              if (dataLines.length === 0) continue;
              let data: any;
              try {
                data = JSON.parse(dataLines.join("\n"));
              } catch {
                continue;
              }
              if (event === "message" && data?.event_type) event = data.event_type;
              if (event === "error" || (event === "completed" && data?.stage === "done")) sawTerminal = true;
              handleEvent({ event, data });
            }
          }

          if (!sawTerminal && isMountedRef.current && !controller.signal.aborted) {
            setError("Backend stream ended unexpectedly.");
            setStatus("error");
          }
        } catch (err) {
          if (controller.signal.aborted || !isMountedRef.current) return;
          setError(err instanceof Error ? err.message : "Backend connection lost.");
          setStatus("error");
        } finally {
          if (controllerRef.current === controller) controllerRef.current = null;
        }
      })();
    },
    [teardown, handleEvent]
  );

  return {
    status,
    finished,
    answerWithheld,
    thinkingLogs,
    stageEvents,
    toolCalls,
    toolResults,
    finalAnswer,
    modelFallbacks,
    evidence,
    error,
    diagnostic,
    start,
    abort,
    reset,
  };
}
