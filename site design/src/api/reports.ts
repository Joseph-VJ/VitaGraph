// Report API calls: upload, listing, and page provenance.

import { api } from "./client";
import type { Report, ReportPage } from "../types";

export interface ReportStatus {
  id: string;
  status: string;
  page_count: number | null;
  chunk_count: number;
  error_message: string | null;
  file_hash?: string | null;
  job_id?: string | null;
}

export interface TrendPoint {
  date: string;
  value: number;
  flag: string;
  report_id?: string;
  page_number?: number;
}

export interface TrendData {
  test_name: string;
  unit: string;
  points: TrendPoint[];
  trend_direction: string;
  start_value: number | null;
  latest_value: number | null;
}

export interface ComparisonRow {
  test: string;
  category: string;
  unit: string;
  baseline: string | number | null;
  followup: string | number | null;
  delta_type: "improving" | "decrease" | "increase" | "new" | "stable";
  delta_label: string;
  status: "improved" | "declined" | "stable" | "unavailable";
  citation: string;
}

export interface ComparisonSummary {
  improved: number;
  declined: number;
  stable: number;
  unavailable: number;
  total: number;
}

export interface ComparisonData {
  baseline_report_id: string | null;
  followup_report_id: string | null;
  baseline_filename: string | null;
  followup_filename: string | null;
  baseline_date: string | null;
  followup_date: string | null;
  rows: ComparisonRow[];
  summary: ComparisonSummary;
}

export interface DemoCohortResult {
  user_id: string;
  display_label: string;
  reports_ingested: number;
  report_ids: string[];
  nodes: number;
  edges: number;
  communities: number;
  modularity: number;
}

export interface MeasurementRow {
  test_name: string;
  category: string;
  value: number;
  unit: string;
  reference_range: string | null;
  range_low: number | null;
  range_high: number | null;
  flag: string;
  page_number: number;
  chunk_id: string;
  char_start: number;
  char_end: number;
  span_exact: boolean;
}

export const reportsApi = {
  upload: (userId: string, file: File, jobId?: string, background: boolean = true, chunkSize?: number) => {
    const form = new FormData();
    form.append("user_id", userId);
    form.append("file", file);
    if (jobId) {
      form.append("job_id", jobId);
    }
    form.append("background", background ? "true" : "false");
    if (chunkSize !== undefined && chunkSize !== null) {
      form.append("chunk_size", String(chunkSize));
    }
    return api.upload<ReportStatus>("/api/reports/upload", form);
  },
  list: (userId: string) => api.get<Report[]>(`/api/reports?user_id=${userId}`),
  pages: (reportId: string) => api.get<ReportPage[]>(`/api/reports/${reportId}/pages`),
  measurements: (reportId: string) => api.get<MeasurementRow[]>(`/api/reports/${reportId}/measurements`),
  trends: (userId: string, test: string = "Hemoglobin") =>
    api.get<TrendData>(`/api/reports/${userId}/trends?test=${encodeURIComponent(test)}`),
  compare: (userId: string, baselineId?: string, followupId?: string) => {
    let url = `/api/reports/compare?user_id=${encodeURIComponent(userId)}`;
    if (baselineId) url += `&baseline_id=${encodeURIComponent(baselineId)}`;
    if (followupId) url += `&followup_id=${encodeURIComponent(followupId)}`;
    return api.get<ComparisonData>(url);
  },
  loadDemoCohort: () => api.post<DemoCohortResult>("/api/demo/cohort", {}),
};
