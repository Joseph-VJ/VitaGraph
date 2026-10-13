import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useActiveUser } from "../context/UserContext";
import { agentRuns, historyMessages } from "../lib/agentRuns";

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

export type TrajectoryKind = "status" | "step" | "reasoning" | "tool" | "model" | "note" | "privacy";
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
  /** What the Privacy Shield did for one model call (kind "privacy"). */
  privacy?: {
    ledgerId: string;
    charsSent: number;
    removed: number;
    byType: Record<string, number>;
  };
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
  /** The viewed chat has an answer being written. */
  isStreaming: boolean;
  /** The viewed chat's id; set at once when a new chat sends its first question. */
  conversationId: string | null;
  /** Show a saved chat. Never stops an answer that is still being written. */
  load: (userId: string, conversationId: string) => Promise<void>;
  send: (userId: string, text: string, reportId?: string | null) => void;
  /** Stop the viewed chat's answer. */
  stop: () => void;
  /** Start a new empty chat. Never stops an answer that is still being written. */
  reset: () => void;
  /** What was typed and not sent, kept per chat (memory and sessionStorage). */
  draft: string;
  setDraft: (text: string) => void;
  /** Chats with an answer being written (any chat of this person). */
  runningIds: string[];
  /** Some other chat is answering, so Send must wait. */
  isRunningElsewhere: boolean;
}

const MAX_TURN_CHARS = 8000;
const NEW_CHAT_DRAFT_KEY = "new";

/**
 * A thin view over the run store (src/lib/agentRuns.ts) for ONE viewed chat.
 * The store keeps every answer running when this page unmounts or the person opens another chat.
 */
export function useAgentChat(): UseAgentChatReturn {
  const { user } = useActiveUser();
  const activeUserId = user?.id ?? null;
  const [viewedId, setViewedId] = useState<string | null>(null);
  const viewedRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const [, bumpDraft] = useState(0);

  const entries = useSyncExternalStore(
    agentRuns.subscribe,
    () => agentRuns.getEntries(viewedId),
    () => agentRuns.getEntries(viewedId)
  );
  const runningIds = useSyncExternalStore(agentRuns.subscribe, agentRuns.getRunningIds, agentRuns.getRunningIds);

  useEffect(() => {
    agentRuns.setUser(activeUserId);
  }, [activeUserId]);

  // The store needs to know which chat is on screen: a chat that finishes there is not "ready".
  useEffect(() => {
    agentRuns.setViewing(viewedId);
  }, [viewedId]);
  useEffect(() => () => agentRuns.setViewing(null), []);

  const view = useCallback((id: string | null) => {
    viewedRef.current = id;
    setViewedId(id);
    agentRuns.setViewing(id);
  }, []);

  const load = useCallback(
    async (userId: string, targetConvId: string) => {
      userIdRef.current = userId;
      view(targetConvId);
      await agentRuns.open(userId, targetConvId);
    },
    [view]
  );

  const send = useCallback(
    (userId: string, text: string, reportId?: string | null) => {
      const question = text.trim();
      if (!question || agentRuns.getRunningIds().length > 0) return;
      userIdRef.current = userId;

      const previous = viewedRef.current;
      const conversationId = previous ?? `conv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const messages = [
        ...historyMessages(agentRuns.getEntries(previous)),
        { role: "user", content: question.slice(0, MAX_TURN_CHARS) },
      ];
      if (!agentRuns.start(userId, conversationId, messages, reportId)) return;
      agentRuns.setDraftFor(previous ?? NEW_CHAT_DRAFT_KEY, "");
      agentRuns.setDraftFor(conversationId, "");
      view(conversationId);
      bumpDraft((n) => n + 1);
    },
    [view]
  );

  const stop = useCallback(() => {
    const id = viewedRef.current;
    const userId = userIdRef.current ?? activeUserId;
    if (id && userId) void agentRuns.stop(userId, id);
  }, [activeUserId]);

  const reset = useCallback(() => {
    view(null);
  }, [view]);

  const draftKey = viewedId ?? NEW_CHAT_DRAFT_KEY;
  const draft = agentRuns.getDraft(draftKey);
  const setDraft = useCallback(
    (text: string) => {
      agentRuns.setDraftFor(viewedRef.current ?? NEW_CHAT_DRAFT_KEY, text);
      bumpDraft((n) => n + 1);
    },
    []
  );

  const isStreaming = entries.some((e) => e.status === "streaming");
  const isRunningElsewhere = runningIds.some((id) => id !== viewedId);

  return {
    entries,
    isStreaming,
    conversationId: viewedId,
    load,
    send,
    stop,
    reset,
    draft,
    setDraft,
    runningIds,
    isRunningElsewhere,
  };
}
