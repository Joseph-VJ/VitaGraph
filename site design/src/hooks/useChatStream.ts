import { useCallback, useEffect, useRef, useState } from "react";

// Consumes POST /api/chat/stream. EventSource is GET-only, so the stream is read through fetch + ReadableStream
// and torn down with an AbortController (same cleanup discipline as useAgentStream / useJobStream).
// The hook owns the whole conversation: every call to send() appends one entry and streams into it, and the
// earlier answered entries are sent back to the backend as the conversation memory.

import { BASE_URL } from "../api/client";

export interface ChatEvidence {
  ref: number;
  chunk_id: string;
  report_id: string;
  report_filename: string;
  report_date: string | null;
  page_number: number;
  snippet: string;
  score: number;
  char_start: number | null;
  char_end: number | null;
}

export type StepKind = "thinking" | "search" | "graph" | "tool";
export type StepStatus = "running" | "done" | "failed";

export interface ChatStep {
  id: string;
  kind: StepKind;
  label: string;
  detail: string;
  status: StepStatus;
}

export type EntryStatus = "streaming" | "answered" | "refused" | "insufficient_evidence" | "error" | "stopped";

export interface ChatEntry {
  id: string;
  question: string;
  startedAt: number;
  endedAt: number | null;
  status: EntryStatus;
  answer: string;
  steps: ChatStep[];
  evidence: ChatEvidence[];
  fallbackNotice: boolean;
  withheld: boolean;
  safetyNote: string | null;
  error: string | null;
}

export interface UseChatStreamReturn {
  entries: ChatEntry[];
  isStreaming: boolean;
  send: (userId: string, text: string, reportId?: string | null) => void;
  stop: () => void;
  reset: () => void;
}

type Json = Record<string, unknown>;

const MAX_HISTORY_MESSAGES = 40;
const MAX_TURN_CHARS = 8000;

function asRecord(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

// The typed payload lives in `metadata` on broker events.
function payloadOf(data: unknown): Json {
  const record = asRecord(data);
  const metadata = record.metadata;
  return metadata && typeof metadata === "object" ? (metadata as Json) : record;
}

function isEvidence(value: unknown): value is ChatEvidence {
  const record = asRecord(value);
  return typeof record.ref === "number" && typeof record.chunk_id === "string";
}

function toolLabel(tool: string, args: Json): { kind: StepKind; label: string } {
  if (tool === "search_chroma") {
    return { kind: "search", label: `Searched your reports for "${String(args.query ?? "").slice(0, 80)}"` };
  }
  if (tool === "query_networkx_graph") {
    return { kind: "graph", label: `Looked up "${String(args.concept ?? "").slice(0, 80)}" in the knowledge graph` };
  }
  return { kind: "tool", label: "Used a tool" };
}

function toolDetail(tool: string, result: Json): { detail: string; failed: boolean } {
  if (typeof result.error === "string") return { detail: result.error, failed: true };
  if (tool === "search_chroma") {
    const count = Array.isArray(result.evidence) ? result.evidence.length : 0;
    return { detail: count === 1 ? "1 passage found" : `${count} passages found`, failed: false };
  }
  return { detail: "Done", failed: false };
}

function closeThinking(entry: ChatEntry): ChatEntry {
  if (!entry.steps.some((s) => s.kind === "thinking" && s.status === "running")) return entry;
  return {
    ...entry,
    steps: entry.steps.map((s) => (s.kind === "thinking" && s.status === "running" ? { ...s, status: "done" as const } : s)),
  };
}

function settleSteps(entry: ChatEntry): ChatEntry {
  return { ...entry, steps: entry.steps.map((s) => (s.status === "running" ? { ...s, status: "done" as const } : s)) };
}

export function useChatStream(): UseChatStreamReturn {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const entriesRef = useRef<ChatEntry[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const thinkingOpenRef = useRef(false);
  const stepSeqRef = useRef(0);
  // text_delta tokens arrive many times per frame; coalesce them into one state write per frame.
  const bufferRef = useRef("");
  const rafRef = useRef<number | null>(null);

  const commit = useCallback((next: ChatEntry[]) => {
    entriesRef.current = next;
    if (mountedRef.current) setEntries(next);
  }, []);

  const patch = useCallback(
    (id: string, change: (entry: ChatEntry) => ChatEntry) => {
      commit(entriesRef.current.map((e) => (e.id === id ? change(e) : e)));
    },
    [commit]
  );

  const flushNow = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const id = activeIdRef.current;
    if (!id || !bufferRef.current) return;
    const chunk = bufferRef.current;
    bufferRef.current = "";
    patch(id, (e) => ({ ...e, answer: e.answer + chunk }));
  }, [patch]);

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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
  }, [teardown]);

  const fail = useCallback(
    (id: string, message: string) => {
      patch(id, (e) => settleSteps({ ...e, status: "error", error: e.error ?? message, endedAt: e.endedAt ?? Date.now() }));
    },
    [patch]
  );

  const handleEvent = useCallback(
    (id: string, event: string, data: unknown) => {
      const p = payloadOf(data);
      switch (event) {
        case "thinking": {
          const text = String(p.thinking ?? "");
          if (!text) break;
          patch(id, (e) => {
            const steps = e.steps.slice();
            const last = steps[steps.length - 1];
            if (thinkingOpenRef.current && last && last.kind === "thinking") {
              steps[steps.length - 1] = { ...last, detail: last.detail + text };
            } else {
              thinkingOpenRef.current = true;
              steps.push({ id: `think_${stepSeqRef.current++}`, kind: "thinking", label: "Reasoning", detail: text, status: "running" });
            }
            return { ...e, steps };
          });
          break;
        }
        case "tool_call": {
          thinkingOpenRef.current = false;
          const callId = String(p.id ?? `call_${stepSeqRef.current++}`);
          const { kind, label } = toolLabel(String(p.tool ?? ""), asRecord(p.arguments));
          patch(id, (e) => {
            const closed = closeThinking(e);
            if (closed.steps.some((s) => s.id === callId)) return closed;
            return { ...closed, steps: [...closed.steps, { id: callId, kind, label, detail: "", status: "running" }] };
          });
          break;
        }
        case "tool_result": {
          const callId = String(p.id ?? "");
          const tool = String(p.tool ?? "");
          const result = asRecord(p.result);
          const { detail, failed } = toolDetail(tool, result);
          const cards = tool === "search_chroma" && Array.isArray(result.evidence) ? result.evidence.filter(isEvidence) : [];
          patch(id, (e) => {
            const byRef = new Map(e.evidence.map((c) => [c.ref, c]));
            cards.forEach((c) => byRef.set(c.ref, c));
            return {
              ...e,
              steps: e.steps.map((s) => (s.id === callId ? { ...s, detail, status: failed ? ("failed" as const) : ("done" as const) } : s)),
              evidence: Array.from(byRef.values()).sort((a, b) => a.ref - b.ref),
            };
          });
          break;
        }
        case "text_delta": {
          const delta = String(p.delta ?? "");
          if (!delta) break;
          if (thinkingOpenRef.current) {
            thinkingOpenRef.current = false;
            patch(id, closeThinking);
          }
          bufferRef.current += delta;
          if (rafRef.current === null) rafRef.current = requestAnimationFrame(flushNow);
          break;
        }
        case "model_fallback": {
          // Provider and model names are never shown; the UI only says that a backup engine took over.
          patch(id, (e) => ({ ...e, fallbackNotice: true }));
          break;
        }
        case "error": {
          flushNow();
          fail(id, String(p.message ?? p.error ?? "The assistant could not finish this answer."));
          break;
        }
        case "completed": {
          flushNow();
          if (asRecord(data).stage === "done") {
            patch(id, (e) =>
              settleSteps({ ...e, status: e.status === "streaming" ? "answered" : e.status, endedAt: e.endedAt ?? Date.now() })
            );
          } else {
            const status: EntryStatus =
              p.status === "refused" ? "refused" : p.status === "insufficient_evidence" ? "insufficient_evidence" : "answered";
            patch(id, (e) => ({
              ...e,
              status,
              answer: e.answer.trim() ? e.answer : String(p.summary_text ?? ""),
              evidence: Array.isArray(p.evidence) ? p.evidence.filter(isEvidence) : e.evidence,
              withheld: p.safety_passed === false,
              safetyNote: typeof p.safety_note === "string" ? p.safety_note : null,
            }));
          }
          break;
        }
        default:
          break;
      }
    },
    [patch, fail, flushNow]
  );

  const send = useCallback(
    (userId: string, text: string, reportId?: string | null) => {
      const question = text.trim();
      if (!question || controllerRef.current) return;

      const prior = entriesRef.current
        .filter((e) => e.status === "answered" && !e.withheld && e.answer.trim())
        .flatMap((e) => [
          { role: "user", content: e.question.slice(0, MAX_TURN_CHARS) },
          { role: "assistant", content: e.answer.slice(0, MAX_TURN_CHARS) },
        ])
        .slice(-MAX_HISTORY_MESSAGES);
      const messages = [...prior, { role: "user", content: question.slice(0, MAX_TURN_CHARS) }];

      const id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const controller = new AbortController();
      controllerRef.current = controller;
      activeIdRef.current = id;
      bufferRef.current = "";
      thinkingOpenRef.current = false;
      commit([
        ...entriesRef.current,
        {
          id,
          question,
          startedAt: Date.now(),
          endedAt: null,
          status: "streaming",
          answer: "",
          steps: [],
          evidence: [],
          fallbackNotice: false,
          withheld: false,
          safetyNote: null,
          error: null,
        },
      ]);

      (async () => {
        try {
          const res = await fetch(`${BASE_URL}/api/chat/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
            body: JSON.stringify({ user_id: userId, messages, job_id: id, ...(reportId ? { report_id: reportId } : {}) }),
            signal: controller.signal,
          });
          if (!res.ok || !res.body) throw new Error(`The assistant could not start (HTTP ${res.status}).`);

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
              let data: unknown;
              try {
                data = JSON.parse(dataLines.join("\n"));
              } catch {
                continue;
              }
              const record = asRecord(data);
              if (event === "message" && typeof record.event_type === "string") event = record.event_type;
              if (event === "error" || (event === "completed" && record.stage === "done")) sawTerminal = true;
              handleEvent(id, event, data);
            }
          }

          if (!sawTerminal && !controller.signal.aborted) {
            flushNow();
            fail(id, "The connection ended before the answer was complete.");
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          flushNow();
          fail(id, err instanceof TypeError ? "Cannot reach the VitaGraph backend. Is it running?" : err instanceof Error ? err.message : "The connection was lost.");
        } finally {
          if (controllerRef.current === controller) {
            controllerRef.current = null;
            activeIdRef.current = null;
          }
        }
      })();
    },
    [commit, handleEvent, flushNow, fail]
  );

  const stop = useCallback(() => {
    const id = activeIdRef.current;
    flushNow();
    teardown();
    activeIdRef.current = null;
    if (id) {
      patch(id, (e) => (e.status === "streaming" ? settleSteps({ ...e, status: "stopped", endedAt: Date.now() }) : e));
    }
  }, [flushNow, teardown, patch]);

  const reset = useCallback(() => {
    teardown();
    activeIdRef.current = null;
    thinkingOpenRef.current = false;
    commit([]);
  }, [teardown, commit]);

  return { entries, isStreaming: entries.some((e) => e.status === "streaming"), send, stop, reset };
}
