import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useActiveUser } from "../context/UserContext";
import { agentRuns, type ReadySummary, type RunSummary } from "../lib/agentRuns";

export interface UseAgentActivityReturn {
  /** Answers being written right now. */
  running: RunSummary[];
  /** Answers that finished while the person was not looking at that chat. */
  ready: ReadySummary[];
  /** The person has seen (or opened) that chat's answer. */
  markSeen: (conversationId: string) => void;
}

/** What the AI Agent is doing in the background, for the sidebar and the "Your answer is ready" toast. */
export function useAgentActivity(): UseAgentActivityReturn {
  const { user } = useActiveUser();
  const userId = user?.id ?? null;

  // On app start and on persona change the store joins every answer the backend is still writing.
  useEffect(() => {
    agentRuns.setUser(userId);
  }, [userId]);

  const activity = useSyncExternalStore(agentRuns.subscribe, agentRuns.getActivitySnapshot, agentRuns.getActivitySnapshot);
  const markSeen = useCallback((conversationId: string) => agentRuns.markSeen(conversationId), []);

  return useMemo(() => ({ running: activity.running, ready: activity.ready, markSeen }), [activity, markSeen]);
}
