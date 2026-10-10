import { api, BASE_URL } from "./client";
import { readSse } from "../lib/sse";

export interface GraphNode {
  id: string;
  label: string;
  type: "report" | "test" | "measurement" | "chunk" | "category" | string;
  color: string;
  r?: number;
  betweenness?: number;
  community?: number;
  active?: boolean;
  test_name?: string;
  category?: string;
  value?: number;
  unit?: string;
  flag?: string;
  date?: string;
  page?: number;
  chunk_id?: string;
  report_id?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface GraphMetrics {
  total_nodes: number;
  total_edges: number;
  communities_count: number;
  modularity: number;
  density: number;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metrics: GraphMetrics;
  active_concepts?: string[];
}

export interface NodeSource {
  n: number;
  report_id: string;
  chunk_id: string | null;
  filename: string;
  report_date: string | null;
  page_number: number;
  char_start: number;
  char_end: number;
  text: string;
  hit_start: number;
  hit_end: number;
  method: string; // native | ocr | text
  quality: string;
}

export type NodeSummaryStatus = "ai" | "cached" | "off" | "fallback";

export type NodeSummaryEvent =
  | { type: "status"; phase: "reading" | "writing" | "checking" }
  | { type: "sources"; sources: NodeSource[]; passages: number; files: number }
  | { type: "delta"; delta: string }
  | { type: "completed"; status: NodeSummaryStatus; text: string; reason: string | null }
  | { type: "error"; message: string };

export interface SeriesReport {
  report_id: string;
  filename: string;
  date: string | null;
  date_iso: string | null;
  order: number;
}

export type SeriesPointFlag = "NORMAL" | "HIGH" | "LOW" | "CRITICAL" | "ABNORMAL" | string;

export interface SeriesPoint {
  report_id: string;
  order: number;
  date: string | null;
  value: number;
  flag: SeriesPointFlag;
  range_text: string | null;
  range_low: number | null;
  range_high: number | null;
  page_number: number;
  chunk_id: string | null;
  char_start: number | null;
  char_end: number | null;
}

export interface SeriesTest {
  node_id: string;
  name: string;
  unit: string;
  category: string;
  points: SeriesPoint[];
}

export interface SeriesResponse {
  reports: SeriesReport[];
  tests: SeriesTest[];
}

export const graphApi = {
  getGraph: (userId: string) => api.get<GraphResponse>(`/api/graph/${userId}`),
  getSubgraph: (userId: string, chunkIds: string[]) =>
    api.post<GraphResponse>("/api/graph/subgraph", { user_id: userId, chunk_ids: chunkIds }),

  series: (userId: string): Promise<SeriesResponse> =>
    api.get<SeriesResponse>(`/api/graph/${userId}/series`),

  /** Stream the AI summary of one node. Resolves when the stream ends; abort with `signal`. */
  streamNodeSummary: async (
    userId: string,
    nodeId: string,
    opts: { refresh?: boolean; signal?: AbortSignal },
    onEvent: (e: NodeSummaryEvent) => void,
  ): Promise<void> => {
    const res = await fetch(`${BASE_URL}/api/graph/node-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ user_id: userId, node_id: nodeId, refresh: !!opts.refresh }),
      signal: opts.signal,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error((detail && typeof detail.detail === "string" && detail.detail) || `HTTP ${res.status}`);
    }
    await readSse(res, (event, data) => {
      const m = (data.metadata ?? {}) as Record<string, unknown>;
      if (event === "status") onEvent({ type: "status", phase: m.phase as "reading" | "writing" | "checking" });
      else if (event === "sources") onEvent({ type: "sources", sources: (m.sources as NodeSource[]) ?? [], passages: Number(m.passages ?? 0), files: Number(m.files ?? 0) });
      else if (event === "text_delta") onEvent({ type: "delta", delta: String(m.delta ?? "") });
      else if (event === "completed") onEvent({ type: "completed", status: m.status as NodeSummaryStatus, text: String(m.text ?? ""), reason: (m.reason as string) ?? null });
      else if (event === "error") onEvent({ type: "error", message: String(m.message ?? "The summary could not be written.") });
    });
  },
};

