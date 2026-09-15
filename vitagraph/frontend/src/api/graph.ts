import { api } from "./client";

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

export const graphApi = {
  getGraph: (userId: string) => api.get<GraphResponse>(`/api/graph/${userId}`),
  getSubgraph: (userId: string, chunkIds: string[]) =>
    api.post<GraphResponse>("/api/graph/subgraph", { user_id: userId, chunk_ids: chunkIds }),
};
