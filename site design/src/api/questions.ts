// Question API calls.

import { api } from "./client";
import type { Answer, TimelineEvent } from "../types";

export const questionsApi = {
  ask: (userId: string, text: string, jobId?: string) =>
    api.post<Answer>("/api/questions", { user_id: userId, text, job_id: jobId }),
};

export const timelineApi = {
  events: (userId: string) => api.get<TimelineEvent[]>(`/api/timeline/${userId}`),
};
