import { useCallback, useEffect, useRef, useState } from "react";
import { graphApi, type NodeSource, type NodeSummaryStatus } from "../api/graph";

export type SummaryPhase = "reading" | "writing" | "checking" | "done" | "error";
export interface NodeSummaryState {
  phase: SummaryPhase;
  text: string;
  sources: NodeSource[];
  files: number;
  status: NodeSummaryStatus | null;
  reason: string | null;
  error: string | null;
}

const memory = new Map<string, Omit<NodeSummaryState, "phase" | "error">>(); // per tab, per person + node
const EMPTY: NodeSummaryState = { phase: "reading", text: "", sources: [], files: 0, status: null, reason: null, error: null };

export function useNodeSummary(userId: string, nodeId: string) {
  const [state, setState] = useState<NodeSummaryState>(EMPTY);
  const [nonce, setNonce] = useState(0);
  const refresh = useRef(false);

  useEffect(() => {
    const key = `${userId}|${nodeId}`;
    const hit = memory.get(key);
    if (hit && !refresh.current) {
      setState({ ...hit, phase: "done", error: null });
      return;
    }
    const controller = new AbortController();
    const wantFresh = refresh.current;
    refresh.current = false;
    setState(EMPTY);

    const startStream = () => {
      graphApi
        .streamNodeSummary(userId, nodeId, { refresh: wantFresh, signal: controller.signal }, (e) => {
          setState((s) => {
            switch (e.type) {
              case "status": return { ...s, phase: e.phase };
              case "sources": return { ...s, sources: e.sources, files: e.files };
              case "delta": return { ...s, phase: "writing", text: s.text + e.delta };
              case "completed": {
                const done = { ...s, phase: "done" as const, text: e.text, status: e.status, reason: e.reason };
                memory.set(key, { text: done.text, sources: done.sources, files: done.files, status: done.status, reason: done.reason });
                return done;
              }
              case "error": return { ...s, phase: "error", error: e.message };
              default: return s;
            }
          });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setState((s) => ({ ...s, phase: "error", error: err instanceof Error ? err.message : "The summary could not be written." }));
        });
    };

    let timer: number | undefined;
    if (wantFresh) {
      startStream();
    } else {
      timer = window.setTimeout(startStream, 250);
    }

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      controller.abort();
    };
  }, [userId, nodeId, nonce]);

  const again = useCallback(() => {
    memory.delete(`${userId}|${nodeId}`);
    refresh.current = true;
    setNonce((n) => n + 1);
  }, [userId, nodeId]);

  return { ...state, again };
}
