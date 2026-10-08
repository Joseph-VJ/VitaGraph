import { api } from "./client";

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

export const toolsApi = {
  /** Ask the AI model for entities and labelled relations of a text. Rejects with a message fit to show. */
  graph: (text: string): Promise<AiGraph> => api.post<AiGraph>("/api/tools/graph", { text }),
};
