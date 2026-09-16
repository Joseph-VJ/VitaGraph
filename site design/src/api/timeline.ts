// Timeline and AI calls API client
import { api } from "./client";
import type { TimelineEvent } from "../types";

export interface AICallAudit {
  id: string;
  question_id: string;
  user_id: string;
  workflow_id: string;
  request_id: string;
  status: string;
  used_ai: number;
  error: string | null;
  created_at: string;
}

export const timelineApi = {
  events: (userId: string) => api.get<TimelineEvent[]>(`/api/timeline/${userId}`),
  aiCalls: (userId: string) => api.get<AICallAudit[]>(`/api/timeline/${userId}/ai-calls`),
};
