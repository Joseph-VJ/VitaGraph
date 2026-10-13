import { api, ApiError, BASE_URL } from "./client";
import type { AgentEvidence, AgentStats, TrajectoryItem } from "../hooks/useAgentChat";

export interface ConversationSummary {
  id: string;
  title: string | null;
  updated_at: string;
  message_count: number;
  /** Number of questions asked (not messages). */
  turns?: number;
  pinned?: boolean;
  /** An answer for this chat is still being written. */
  running?: boolean;
}

export interface ConversationPatch {
  title?: string;
  pinned?: boolean;
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

export interface ReportSummary {
  id: string;
  title: string;
  created_at: string;
  conversation_id: string | null;
}

export interface SavedReport extends ReportSummary {
  html: string;
}

export interface ReportRequest {
  user_id: string;
  conversation_id?: string | null;
  title: string;
  markdown: string;
  refs: { ref: number; chunk_id: string; report_id: string }[];
}

// client.ts has no PATCH helper, so the one PATCH call lives here with the same error handling.
async function patchJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Cannot reach the VitaGraph backend. Is it running on port 8000?");
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data?.detail) detail = String(data.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export const agentApi = {
  /** Render and save a report (HTML and PDF) from Markdown written by the agent. */
  createReport: (payload: ReportRequest): Promise<SavedReport> => api.post<SavedReport>("/api/agent/reports", payload),

  listReports: (userId: string): Promise<ReportSummary[]> =>
    api.get<ReportSummary[]>(`/api/agent/reports?user_id=${encodeURIComponent(userId)}`),

  getReport: (userId: string, id: string): Promise<SavedReport> =>
    api.get<SavedReport>(`/api/agent/reports/${encodeURIComponent(id)}?user_id=${encodeURIComponent(userId)}`),

  deleteReport: (userId: string, id: string): Promise<{ deleted: string }> =>
    api.del<{ deleted: string }>(`/api/agent/reports/${encodeURIComponent(id)}?user_id=${encodeURIComponent(userId)}`),

  /** Address of the PDF; opening it downloads the file. */
  reportPdfUrl: (userId: string, id: string): string =>
    `${BASE_URL}/api/agent/reports/${encodeURIComponent(id)}/pdf?user_id=${encodeURIComponent(userId)}`,

  /** Start this person's agent in the background so the first question does not wait for it. Never throws. */
  warm: (userId: string): Promise<unknown> =>
    api.post<unknown>("/api/agent/warm", { user_id: userId }).catch(() => undefined),

  listConversations: (userId: string): Promise<ConversationSummary[]> =>
    api.get<ConversationSummary[]>(`/api/agent/conversations?user_id=${encodeURIComponent(userId)}`),

  getConversation: (userId: string, id: string): Promise<Conversation> =>
    api.get<Conversation>(`/api/agent/conversations/${encodeURIComponent(id)}?user_id=${encodeURIComponent(userId)}`),

  /** Rename and/or pin a chat. Returns the updated list item. */
  updateConversation: (userId: string, id: string, patch: ConversationPatch): Promise<ConversationSummary> =>
    patchJson<ConversationSummary>(
      `/api/agent/conversations/${encodeURIComponent(id)}?user_id=${encodeURIComponent(userId)}`,
      patch
    ),

  deleteConversation: (userId: string, id: string): Promise<{ deleted: string }> =>
    api.del<{ deleted: string }>(`/api/agent/conversations/${encodeURIComponent(id)}?user_id=${encodeURIComponent(userId)}`),
};
