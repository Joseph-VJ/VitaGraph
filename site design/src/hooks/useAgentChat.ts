import { useCallback, useEffect, useRef, useState } from "react";
import { BASE_URL } from "../api/client";
import { agentApi } from "../api/agent";
import {
  applyFeedEvent,
  asRecord,
  closeRunning,
  evidenceFrom,
  numberOrNull,
  replaySavedFeed,
  settleItems,
} from "../lib/agentFeed";
import { setActivity } from "../lib/appActivity";
import { saveLastAnswer } from "../lib/lastAnswer";

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

export type TrajectoryKind = "status" | "step" | "reasoning" | "tool" | "model" | "note";
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
  /** Wall-clock start, for the live seconds counter (not set on a reopened conversation). */
  startedAt?: number;
  /** What a finished model call cost. */
  meta?: {
    ms: number | null;
    firstMs: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    toolCalls: number;
  };
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

function extractDistinctChunkIds(evidence: AgentEvidence[]): string[] {
  const sorted = [...evidence].sort((a, b) => (a.ref ?? 0) - (b.ref ?? 0));
  const seen = new Set<string>();
  const chunkIds: string[] = [];
  for (const card of sorted) {
    if (card.chunk_id && !seen.has(card.chunk_id)) {
      seen.add(card.chunk_id);
      chunkIds.push(card.chunk_id);
    }
  }
  return chunkIds;
}

// A saved turn keeps the backend's names (elapsed_ms, tool_calls); the page uses its own.
function savedStats(raw: unknown): AgentStats | null {
  const s = asRecord(raw);
  if (Object.keys(s).length === 0) return null;
  return {
    steps: numberOrNull(s.steps) ?? 0,
    toolCalls: numberOrNull(s.tool_calls ?? s.toolCalls) ?? 0,
    elapsedMs: numberOrNull(s.elapsed_ms ?? s.elapsedMs) ?? 0,
    inputTokens: numberOrNull(s.input_tokens ?? s.inputTokens),
    outputTokens: numberOrNull(s.output_tokens ?? s.outputTokens),
  };
}

function settle(entry: AgentEntry): AgentEntry {
  return { ...entry, trajectory: settleItems(entry.trajectory) };
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
  const userIdRef = useRef<string | null>(null);
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

  const feedContext = useCallback(
    () => ({ id: () => `feed_${stepSeqRef.current++}`, now: Date.now() }),
    []
  );

  // Move the words written so far into the feed as a note and clear the answer area.
  const narrate = useCallback(
    (id: string) => {
      flushNow();
      patch(id, (e) => {
        const text = e.answer.trim();
        if (!text) return e;
        return { ...e, answer: "", trajectory: applyFeedEvent(e.trajectory, "note", { text }, feedContext()) };
      });
    },
    [flushNow, patch, feedContext]
  );

  const handleEvent = useCallback(
    (id: string, event: string, data: unknown) => {
      const p = payloadOf(data);
      switch (event) {
        case "status":
        case "step":
        case "thinking":
          patch(id, (e) => ({ ...e, trajectory: applyFeedEvent(e.trajectory, event, p, feedContext()) }));
          break;
        case "model": {
          // The model finished a call that asked for tools: the words it wrote were narration, not the answer.
          if (p.phase === "end" && (numberOrNull(p.tool_calls) ?? 0) > 0) narrate(id);
          patch(id, (e) => ({ ...e, trajectory: applyFeedEvent(e.trajectory, event, p, feedContext()) }));
          break;
        }
        case "tool_call": {
          narrate(id); // without model events (chat format) the tool call is what ends the narration
          patch(id, (e) => ({ ...e, trajectory: applyFeedEvent(e.trajectory, event, p, feedContext()) }));
          break;
        }
        case "tool_result": {
          const tool = String(p.tool ?? "");
          const cards = evidenceFrom(tool, asRecord(p.result));
          patch(id, (e) => {
            const byRef = new Map(e.evidence.map((c) => [c.ref, c]));
            cards.forEach((c) => byRef.set(c.ref, c));
            return {
              ...e,
              trajectory: applyFeedEvent(e.trajectory, event, p, feedContext()),
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
          const status: EntryStatus =
            p.status === "refused" ? "refused" : p.status === "insufficient_evidence" ? "insufficient_evidence" : "answered";
          const incomingEv = Array.isArray(p.evidence) ? p.evidence.filter(isEvidence) : null;
          // Save the last answer once, here, and only for an answer that was not withheld by the safety gate.
          const current = entriesRef.current.find((x) => x.id === id);
          if (current && status === "answered" && p.safety_passed !== false && userIdRef.current) {
            const saveCards = incomingEv ?? current.evidence;
            const chunkIds = extractDistinctChunkIds(saveCards);
            if (chunkIds.length > 0) {
              saveLastAnswer({
                userId: userIdRef.current,
                question: current.question,
                chunkIds,
              });
            }
          }
          patch(id, (e) => {
            const evCards = incomingEv ?? e.evidence;
            return {
              ...e,
              status,
              answer: String(p.summary_text ?? "").trim() ? String(p.summary_text) : e.answer,
              evidence: evCards,
              withheld: p.safety_passed === false,
              safetyNote: typeof p.safety_note === "string" ? p.safety_note : null,
              aiStatus: typeof p.ai_status === "string" ? p.ai_status : null,
              title: typeof p.session_title === "string" && p.session_title.trim() ? p.session_title.trim() : null,
            };
          });
          break;
        }
        case "done": {
          flushNow();
          if (typeof p.conversation_id === "string" && p.conversation_id) {
            conversationIdRef.current = p.conversation_id;
            setConversationId(p.conversation_id);
          }
          patch(id, (e) => {
            const finalStatus: EntryStatus = e.status === "streaming" ? "answered" : e.status;
            return settle({ ...e, status: finalStatus, endedAt: e.endedAt ?? Date.now() });
          });
          break;
        }
        default:
          break;
      }
    },
    [patch, fail, flushNow, narrate, feedContext]
  );

  const send = useCallback(
    (userId: string, text: string, reportId?: string | null) => {
      const question = text.trim();
      if (!question || controllerRef.current) return;
      userIdRef.current = userId;

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
              if (event === "error" || event === "done" || (event === "completed" && record.stage === "done")) sawTerminal = true;
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
      userIdRef.current = userId;
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
              trajectory: next ? replaySavedFeed(next.trajectory) : [],
              stats: next ? savedStats(next.stats) : null,
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

  const isStreaming = entries.some((e) => e.status === "streaming");

  useEffect(() => {
    setActivity({ agentBusy: isStreaming });
    return () => {
      setActivity({ agentBusy: false });
    };
  }, [isStreaming]);

  return {
    entries,
    isStreaming,
    conversationId,
    load,
    send,
    stop,
    reset,
  };
}
