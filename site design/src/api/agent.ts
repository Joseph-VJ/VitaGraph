import { api } from "./client";
import type { AgentEvidence, AgentStats, TrajectoryItem } from "../hooks/useAgentChat";

export interface ConversationSummary {
  id: string;
  title: string | null;
  updated_at: string;
  message_count: number;
}

export interface ConversationMessage {
  seq: number;
  role: "user" | "assistant" | string;
  content: string;
  status: string | null;
  ai_status: string | null;
  evidence: AgentEvidence[];
  trajectory: TrajectoryItem[];
  stats: AgentStats;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  messages: ConversationMessage[];
}

export const agentApi = {
  listConversations: (userId: string): Promise<ConversationSummary[]> =>
    api.get<ConversationSummary[]>(`/api/agent/conversations?user_id=${encodeURIComponent(userId)}`),

  getConversation: (userId: string, id: string): Promise<Conversation> =>
    api.get<Conversation>(`/api/agent/conversations/${encodeURIComponent(id)}?user_id=${encodeURIComponent(userId)}`),

  deleteConversation: (userId: string, id: string): Promise<{ deleted: string }> =>
    api.del<{ deleted: string }>(`/api/agent/conversations/${encodeURIComponent(id)}?user_id=${encodeURIComponent(userId)}`),
};
