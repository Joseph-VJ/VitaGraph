// Question API calls.

import { api } from "./client";
import type { Answer, TimelineEvent } from "../types";

export const questionsApi = {
  ask: (userId: string, text: string, jobId?: string, background: boolean = true, retrievalMode?: string) =>
    api.post<Answer>("/api/questions", {
      user_id: userId,
      text,
      job_id: jobId,
      background,
      ...(retrievalMode ? { retrieval_mode: retrievalMode } : {}),
    }),
  result: (jobId: string) =>
    api.get<{ status: string; result?: Answer; error?: string }>(`/api/jobs/${jobId}/result`),
};

export const timelineApi = {
  events: (userId: string) => api.get<TimelineEvent[]>(`/api/timeline/${userId}`),
};
