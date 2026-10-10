import { api, BASE_URL } from "./client";
import { readSse } from "../lib/sse";

export interface AiGraphNode {
  id: string;
  label: string;
  type: string;
  start: number;
  end: number;
  quote: string;
}

export interface AiGraphEdge {
  source: string;
  target: string;
  label: string;
  start: number;
  end: number;
  quote: string;
}

export interface AiGraph {
  title: string;
  nodes: AiGraphNode[];
  edges: AiGraphEdge[];
}

export interface AiGraphStreamHandlers {
  onStatus?: (phase: "reading" | "writing") => void;
  onTitle?: (title: string) => void;
  onNode?: (node: AiGraphNode) => void;
  onEdge?: (edge: AiGraphEdge) => void;
  onCompleted?: (meta: { status: string; title: string; nodes: number; edges: number; dropped: number }) => void;
  onError?: (err: { message: string; status?: number }) => void;
}

export const toolsApi = {
  /** Ask the AI model for entities and labelled relations of a text. Rejects with a message fit to show. */
  graph: (text: string): Promise<AiGraph> => api.post<AiGraph>("/api/tools/graph", { text }),

  /**
   * Stream the AI graph in real time over SSE.
   * Emits events as each entity and relation is generated and validated.
   */
  graphStream: async (
    text: string,
    handlers: AiGraphStreamHandlers,
    signal?: AbortSignal
  ): Promise<void> => {
    const res = await fetch(`${BASE_URL}/api/tools/graph/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ text }),
      signal,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error((detail && typeof detail.detail === "string" && detail.detail) || `HTTP ${res.status}`);
    }
    await readSse(res, (event, data) => {
      const m = (data.metadata ?? {}) as Record<string, unknown>;
      if (event === "status") {
        handlers.onStatus?.(m.phase as "reading" | "writing");
      } else if (event === "title") {
        handlers.onTitle?.(String(m.title ?? ""));
      } else if (event === "node") {
        handlers.onNode?.({
          id: String(m.id ?? ""),
          label: String(m.label ?? ""),
          type: String(m.type ?? ""),
          start: Number(m.start ?? 0),
          end: Number(m.end ?? 0),
          quote: String(m.quote ?? ""),
        });
      } else if (event === "edge") {
        handlers.onEdge?.({
          source: String(m.source ?? ""),
          target: String(m.target ?? ""),
          label: String(m.label ?? ""),
          start: Number(m.start ?? 0),
          end: Number(m.end ?? 0),
          quote: String(m.quote ?? ""),
        });
      } else if (event === "completed") {
        handlers.onCompleted?.({
          status: String(m.status ?? "ai"),
          title: String(m.title ?? ""),
          nodes: Number(m.nodes ?? 0),
          edges: Number(m.edges ?? 0),
          dropped: Number(m.dropped ?? 0),
        });
      } else if (event === "error") {
        handlers.onError?.({
          message: String(m.message ?? "The AI could not build the graph."),
          status: typeof m.status === "number" ? m.status : 500,
        });
      }
    });
  },
};
