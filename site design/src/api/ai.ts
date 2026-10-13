// AI configuration and dynamic report analysis API calls.

import { api } from "./client";

export interface AiConfig {
  allow_api: boolean;
  provider: string;
  model: string;
  url: string;
  has_api_key: boolean;
  masked_key: string;
  status: "connected" | "error" | "configured" | "offline";
  message?: string;
}

export interface AiConfigUpdatePayload {
  provider: string;
  api_key: string;
  model: string;
  url: string;
  allow_api: boolean;
}

export interface HealthInfo {
  status: string;
  allow_api: boolean;
  embedding_model: string;
  chunk_target_chars: number;
  chunk_max_chars: number;
}

export interface BiomarkerItem {
  test_name: string;
  value: number;
  unit: string;
  reference_range: string;
  flag: string;
}

export interface ReportAnalysisResponse {
  report_id: string;
  filename: string;
  report_date: string;
  page_count: number;
  summary: string;
  biomarkers: BiomarkerItem[];
  ai_insights: string[];
  model_used: string;
  is_ai_generated: boolean;
  generated_at: string;
}

export type ModelFormat = "auto" | "responses" | "chat";
export type ModelReasoning = "minimal" | "low" | "medium" | "high" | "default";

/** What the backend remembers about the model connection. It never contains the key. */
export interface ModelConnection {
  url: string;
  model: string;
  api_format: "responses" | "chat";
  reasoning: ModelReasoning;
  has_key: boolean;
  masked_key: string;
  allow_api: boolean;
  shield_covered: boolean;
  can_edit: boolean;
  message: string;
}

export interface ModelConnectionInput {
  url: string;
  key: string;
  model: string;
  api_format: ModelFormat;
  reasoning: ModelReasoning;
  skip_test?: boolean;
}

export interface ModelTestResult {
  ok: boolean;
  message: string;
  api_format: "responses" | "chat";
}

export const aiApi = {
  getConfig: () => api.get<AiConfig>("/api/ai/config"),
  setConfig: (payload: AiConfigUpdatePayload) =>
    api.post<AiConfig>("/api/ai/config", payload),
  setPrivacy: (allowApi: boolean) => api.post<AiConfig>("/api/ai/privacy", { allow_api: allowApi }),
  getModel: () => api.get<ModelConnection>("/api/ai/model"),
  testModel: (input: ModelConnectionInput) => api.post<ModelTestResult>("/api/ai/model/test", input),
  saveModel: (input: ModelConnectionInput) => api.post<ModelConnection>("/api/ai/model", input),
  removeModelKey: () => api.post<ModelConnection>("/api/ai/model/remove-key", {}),
  getHealth: () => api.get<HealthInfo>("/api/health"),
  analyzeReport: (reportId: string, userId: string) =>
    api.post<ReportAnalysisResponse>("/api/ai/analyze-report", {
      report_id: reportId,
      user_id: userId,
    }),
};
