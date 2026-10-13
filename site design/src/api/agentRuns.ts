// Fetch helpers for the AI Agent run endpoints (plan R, section 1.1).
// A run lives on the backend: the browser only follows it, and can follow it again after a page change.

import { api, BASE_URL } from "./client";

export interface ActiveRun {
  conversation_id: string;
  question: string;
  /** Epoch milliseconds. */
  started_at: number;
  status: "running";
}

export interface StreamRequestBody {
  user_id: string;
  messages: { role: string; content: string }[];
  conversation_id: string;
  report_id?: string;
}

function query(userId: string, extra = ""): string {
  return `?user_id=${encodeURIComponent(userId)}${extra}`;
}

export const agentRunsApi = {
  /** Answers that are still being written for this person. Empty when idle. */
  active: (userId: string): Promise<ActiveRun[]> =>
    api.get<ActiveRun[]>(`/api/agent/runs/active${query(userId)}`),

  /** Cancel a run. `stopped` is false when it had already finished. */
  stop: (userId: string, conversationId: string): Promise<{ stopped: boolean }> =>
    api.post<{ stopped: boolean }>(
      `/api/agent/runs/${encodeURIComponent(conversationId)}/stop${query(userId)}`,
      {}
    ),

  /** Start a run and follow it (Server-Sent Events). The first frame is `run`. */
  openStream: (body: StreamRequestBody, signal: AbortSignal): Promise<Response> =>
    fetch(`${BASE_URL}/api/agent/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal,
    }),

  /** Follow a run again: frames with index above `after` are replayed, then live ones follow. 404 when there is no such run. */
  openEvents: (userId: string, conversationId: string, after: number, signal: AbortSignal): Promise<Response> =>
    fetch(
      `${BASE_URL}/api/agent/runs/${encodeURIComponent(conversationId)}/events${query(userId, `&after=${Math.max(0, Math.floor(after))}`)}`,
      { headers: { Accept: "text/event-stream" }, signal }
    ),
};
