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

export const aiApi = {
  getConfig: () => api.get<AiConfig>("/api/ai/config"),
  setConfig: (payload: AiConfigUpdatePayload) =>
    api.post<AiConfig>("/api/ai/config", payload),
  analyzeReport: (reportId: string, userId: string) =>
    api.post<ReportAnalysisResponse>("/api/ai/analyze-report", {
      report_id: reportId,
      user_id: userId,
    }),
};
