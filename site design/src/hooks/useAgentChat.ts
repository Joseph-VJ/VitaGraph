import { useCallback, useEffect, useRef, useState } from "react";
import { BASE_URL } from "../api/client";
import { agentApi } from "../api/agent";

export interface AgentEvidence {
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

export type TrajectoryKind = "status" | "step" | "reasoning" | "tool";
export type TrajectoryStatus = "running" | "done" | "failed";

export interface TrajectoryItem {
  id: string;
  kind: TrajectoryKind;
  label: string;
  detail: string;
  status: TrajectoryStatus;
  tool?: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  durationMs?: number | null;
}

export interface AgentStats {
  steps: number;
  toolCalls: number;
  elapsedMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
}

export type EntryStatus = "streaming" | "answered" | "refused" | "insufficient_evidence" | "error" | "stopped";

export interface AgentEntry {
  id: string;
  question: string;
  startedAt: number;
  endedAt: number | null;
  status: EntryStatus;
  answer: string;
  trajectory: TrajectoryItem[];
  stats: AgentStats | null;
  evidence: AgentEvidence[];
  withheld: boolean;
  safetyNote: string | null;
  aiStatus: string | null;
  title: string | null;
  error: string | null;
}

export interface UseAgentChatReturn {
  entries: AgentEntry[];
  isStreaming: boolean;
  conversationId: string | null;
  load: (userId: string, conversationId: string) => Promise<void>;
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

function isEvidence(value: unknown): value is AgentEvidence {
  const record = asRecord(value);
  return typeof record.ref === "number" && typeof record.chunk_id === "string";
}

function clip(value: unknown): string {
  return String(value ?? "").trim().slice(0, 80);
}

// Plain words for each tool; never an empty quote.
function toolLabel(tool: string, args: Json): string {
  switch (tool) {
    case "search_reports":
    case "search_chroma": {
      const query = clip(args.query);
      return query ? `Searched your reports for "${query}"` : "Searched your reports";
    }
    case "list_reports":
      return "Listed your reports";
    case "get_measurements":
      return "Read the values of a report";
    case "graph_lookup":
    case "query_networkx_graph": {
      const concept = clip(args.concept);
      return concept ? `Looked up "${concept}" in the knowledge graph` : "Looked through the knowledge graph";
    }
    default:
      return "Used a tool";
  }
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

function toolSummary(tool: string, result: Json): { detail: string; failed: boolean } {
  if (typeof result.error === "string") return { detail: result.error, failed: true };
  if (tool === "search_reports" || tool === "search_chroma") {
    return { detail: plural(Array.isArray(result.evidence) ? result.evidence.length : 0, "passage found", "passages found"), failed: false };
  }
  if (tool === "list_reports") {
    return { detail: plural(Array.isArray(result.reports) ? result.reports.length : 0, "report", "reports"), failed: false };
  }
  if (tool === "get_measurements") {
    return { detail: plural(Array.isArray(result.measurements) ? result.measurements.length : 0, "value", "values"), failed: false };
  }
  return { detail: "Done", failed: false };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// A running reasoning or status row is finished as soon as something else happens.
function closeRunning(items: TrajectoryItem[], kinds: TrajectoryKind[]): TrajectoryItem[] {
  if (!items.some((i) => i.status === "running" && kinds.includes(i.kind))) return items;
  return items.map((i) => (i.status === "running" && kinds.includes(i.kind) ? { ...i, status: "done" as const } : i));
}

function settle(entry: AgentEntry): AgentEntry {
  return { ...entry, trajectory: entry.trajectory.map((i) => (i.status === "running" ? { ...i, status: "done" as const } : i)) };
}

export function useAgentChat(): UseAgentChatReturn {
  const [entries, setEntries] = useState<AgentEntry[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const entriesRef = useRef<AgentEntry[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const conversationIdRef = useRef<string | null>(null);
  const stepSeqRef = useRef(0);
  // text_delta tokens arrive many times per frame; coalesce them into one state write per frame.
  const bufferRef = useRef("");
  const rafRef = useRef<number | null>(null);

  const commit = useCallback((next: AgentEntry[]) => {
    entriesRef.current = next;
    if (mountedRef.current) setEntries(next);
  }, []);

  const patch = useCallback(
    (id: string, change: (entry: AgentEntry) => AgentEntry) => {
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
      patch(id, (e) => settle({ ...e, status: "error", error: e.error ?? message, endedAt: e.endedAt ?? Date.now() }));
    },
    [patch]
  );

  const handleEvent = useCallback(
    (id: string, event: string, data: unknown) => {
      const p = payloadOf(data);
      switch (event) {
        case "status": {
          const phase = String(p.phase ?? "");
          const message = String(p.message ?? "");
          if (!message) break;
          patch(id, (e) => {
            if (phase === "starting") {
              return { ...e, trajectory: [...e.trajectory, { id: `status_${stepSeqRef.current++}`, kind: "status", label: message, detail: "", status: "running" }] };
            }
            const closed = closeRunning(e.trajectory, ["status"]);
            if (phase === "retrying") {
              const attempt = numberOrNull(p.attempt);
              const label = attempt === null ? message : `${message} (attempt ${attempt})`;
              return { ...e, trajectory: [...closed, { id: `status_${stepSeqRef.current++}`, kind: "status", label, detail: "", status: "done" }] };
            }
            return { ...e, trajectory: closed };
          });
          break;
        }
        case "step": {
          const step = numberOrNull(p.step);
          if (step === null) break;
          const rowId = `step_${step}`;
          if (p.phase === "start") {
            patch(id, (e) => {
              const closed = closeRunning(e.trajectory, ["status", "reasoning"]);
              if (closed.some((i) => i.id === rowId)) return { ...e, trajectory: closed };
              return { ...e, trajectory: [...closed, { id: rowId, kind: "step", label: `Step ${step}`, detail: "", status: "running" }] };
            });
          } else {
            patch(id, (e) => ({
              ...e,
              trajectory: closeRunning(e.trajectory, ["reasoning"]).map((i) => (i.id === rowId ? { ...i, status: "done" as const } : i)),
            }));
          }
          break;
        }
        case "thinking": {
          const text = String(p.thinking ?? "");
          if (!text) break;
          patch(id, (e) => {
            const items = e.trajectory.slice();
            const last = items[items.length - 1];
            if (last && last.kind === "reasoning" && last.status === "running") {
              items[items.length - 1] = { ...last, detail: last.detail + text };
            } else {
              items.push({ id: `think_${stepSeqRef.current++}`, kind: "reasoning", label: "Reasoning", detail: text, status: "running" });
            }
            return { ...e, trajectory: items };
          });
          break;
        }
        case "tool_call": {
          const callId = String(p.id ?? `call_${stepSeqRef.current++}`);
          const tool = String(p.tool ?? "");
          const args = asRecord(p.arguments);
          patch(id, (e) => {
            const closed = closeRunning(e.trajectory, ["status", "reasoning"]);
            if (closed.some((i) => i.id === callId)) return { ...e, trajectory: closed };
            return {
              ...e,
              trajectory: [...closed, { id: callId, kind: "tool", label: toolLabel(tool, args), detail: "", status: "running", tool, args, result: null, durationMs: null }],
            };
          });
          break;
        }
        case "tool_result": {
          const callId = String(p.id ?? "");
          const tool = String(p.tool ?? "");
          const result = asRecord(p.result);
          const { detail, failed } = toolSummary(tool, result);
          const failedFlag = failed || p.is_error === true;
          const cards = (tool === "search_reports" || tool === "search_chroma") && Array.isArray(result.evidence) ? result.evidence.filter(isEvidence) : [];
          const durationMs = numberOrNull(p.duration_ms);
          patch(id, (e) => {
            const byRef = new Map(e.evidence.map((c) => [c.ref, c]));
            cards.forEach((c) => byRef.set(c.ref, c));
            return {
              ...e,
              trajectory: e.trajectory.map((i) =>
                i.id === callId ? { ...i, detail, result, durationMs, status: failedFlag ? ("failed" as const) : ("done" as const) } : i
              ),
              evidence: Array.from(byRef.values()).sort((a, b) => a.ref - b.ref),
            };
          });
          break;
        }
        case "text_delta": {
          const delta = String(p.delta ?? "");
          if (!delta) break;
          patch(id, (e) => ({ ...e, trajectory: closeRunning(e.trajectory, ["status", "reasoning"]) }));
          bufferRef.current += delta;
          if (rafRef.current === null) rafRef.current = requestAnimationFrame(flushNow);
          break;
        }
        case "stats": {
          patch(id, (e) => ({
            ...e,
            stats: {
              steps: numberOrNull(p.steps) ?? 0,
              toolCalls: numberOrNull(p.tool_calls) ?? 0,
              elapsedMs: numberOrNull(p.elapsed_ms) ?? 0,
              inputTokens: numberOrNull(p.input_tokens),
              outputTokens: numberOrNull(p.output_tokens),
            },
          }));
          break;
        }
        case "error": {
          flushNow();
          fail(id, String(p.message ?? "The AI Agent could not finish this answer."));
          break;
        }
        case "completed": {
          flushNow();
          if (asRecord(data).stage === "done") {
            if (typeof p.conversation_id === "string" && p.conversation_id) {
              conversationIdRef.current = p.conversation_id;
              setConversationId(p.conversation_id);
            }
            patch(id, (e) => settle({ ...e, status: e.status === "streaming" ? "answered" : e.status, endedAt: e.endedAt ?? Date.now() }));
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
              aiStatus: typeof p.ai_status === "string" ? p.ai_status : null,
              title: typeof p.session_title === "string" && p.session_title.trim() ? p.session_title.trim() : null,
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

      if (!conversationIdRef.current) {
        conversationIdRef.current = `conv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      }
      setConversationId(conversationIdRef.current);

      const id = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const controller = new AbortController();
      controllerRef.current = controller;
      activeIdRef.current = id;
      bufferRef.current = "";
      commit([
        ...entriesRef.current,
        {
          id,
          question,
          startedAt: Date.now(),
          endedAt: null,
          status: "streaming",
          answer: "",
          trajectory: [],
          stats: null,
          evidence: [],
          withheld: false,
          safetyNote: null,
          aiStatus: null,
          title: null,
          error: null,
        },
      ]);

      (async () => {
        try {
          const res = await fetch(`${BASE_URL}/api/agent/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
            body: JSON.stringify({
              user_id: userId,
              messages,
              conversation_id: conversationIdRef.current,
              ...(reportId ? { report_id: reportId } : {}),
            }),
            signal: controller.signal,
          });
          if (!res.ok || !res.body) throw new Error(`The AI Agent could not start (HTTP ${res.status}).`);

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
      patch(id, (e) => (e.status === "streaming" ? settle({ ...e, status: "stopped", endedAt: Date.now() }) : e));
    }
  }, [flushNow, teardown, patch]);

  const load = useCallback(
    async (userId: string, targetConvId: string) => {
      teardown();
      activeIdRef.current = null;
      conversationIdRef.current = targetConvId;
      setConversationId(targetConvId);

      try {
        const conv = await agentApi.getConversation(userId, targetConvId);
        conversationIdRef.current = conv.id;
        setConversationId(conv.id);

        const loadedEntries: AgentEntry[] = [];
        const msgs = conv.messages || [];
        for (let i = 0; i < msgs.length; i++) {
          const m = msgs[i];
          if (m.role === "user") {
            const next = msgs[i + 1]?.role === "assistant" ? msgs[i + 1] : null;
            if (next) i++;

            const startedAt = m.created_at ? new Date(m.created_at).getTime() : Date.now();
            const endedAt = next?.created_at ? new Date(next.created_at).getTime() : startedAt;
            const status = (next?.status as EntryStatus) || "answered";

            loadedEntries.push({
              id: `loaded_${m.seq}`,
              question: m.content,
              startedAt,
              endedAt,
              status,
              answer: next ? next.content : "",
              trajectory: next && Array.isArray(next.trajectory) ? next.trajectory : [],
              stats: next && next.stats && typeof next.stats === "object" ? next.stats : null,
              evidence: next && Array.isArray(next.evidence) ? next.evidence : [],
              withheld: false,
              safetyNote: null,
              aiStatus: next?.ai_status ?? null,
              title: conv.title ?? null,
              error: null,
            });
          }
        }
        commit(loadedEntries);
      } catch (err) {
        // Keep current state on load error
      }
    },
    [teardown, commit]
  );

  const reset = useCallback(() => {
    teardown();
    activeIdRef.current = null;
    conversationIdRef.current = null;
    setConversationId(null);
    commit([]);
  }, [teardown, commit]);

  return {
    entries,
    isStreaming: entries.some((e) => e.status === "streaming"),
    conversationId,
    load,
    send,
    stop,
    reset,
  };
}
