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

export const reportsApi = {
  upload: (userId: string, file: File, jobId?: string) => {
    const form = new FormData();
    form.append("user_id", userId);
    form.append("file", file);
    if (jobId) {
      form.append("job_id", jobId);
    }
    return api.upload<ReportStatus>("/api/reports/upload", form);
  },
  list: (userId: string) => api.get<Report[]>(`/api/reports?user_id=${userId}`),
  pages: (reportId: string) => api.get<ReportPage[]>(`/api/reports/${reportId}/pages`),
  trends: (userId: string, test: string = "Hemoglobin") =>
    api.get<TrendData>(`/api/reports/${userId}/trends?test=${encodeURIComponent(test)}`),
};
