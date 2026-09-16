// Jobs API client for plan Section 12 SSE streaming.

import { api } from "./client";

export interface JobEvent {
  index: string;
  stage: "retrieval" | "reranking" | "graph" | "generation" | "safety" | "citation" | "done";
  description: string;
  subDescription?: string;
  latency?: string;
  timestamp?: number;
}

export interface JobStatus {
  job_id: string;
  status: "running" | "completed" | "error";
  events: JobEvent[];
  event_count: number;
}

export const jobsApi = {
  create: () => api.post<{ job_id: string; status: string }>("/api/jobs", {}),
  getStatus: (jobId: string) => api.get<JobStatus>(`/api/jobs/${jobId}`),
  getEventsUrl: (jobId: string) => `http://127.0.0.1:8000/api/jobs/${jobId}/events`,
};
