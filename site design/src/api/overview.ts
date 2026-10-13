// My Data: one call that lists everything a persona added and asked (files, chats, saved AI reports, activity).

import { ApiError, BASE_URL } from "./client";

export interface OverviewPersona {
  id: string;
  display_label: string;
  created_at: string;
  consent_accepted: boolean;
}

export interface OverviewTotals {
  reports: number;
  reports_ready: number;
  pages: number;
  chunks: number;
  chats: number;
  questions: number;
  saved_reports: number;
  ai_messages_sent: number;
  details_hidden: number;
}

export interface OverviewReport {
  id: string;
  original_filename: string;
  file_hash: string;
  report_date: string | null;
  upload_time: string;
  version: number;
  status: string; // received | extracting | indexing | ready | failed
  error_message: string | null;
  page_count: number | null;
  chunk_count: number | null;
  pages_typed: number;
  pages_scanned: number;
  pages_failed: number;
  pages_weak: number;
  chat_ids: string[];
}

export interface OverviewReportUsed {
  id: string;
  filename: string | null;
  deleted: boolean;
}

export interface OverviewChat {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  questions: number;
  answered: number;
  refused: number;
  first_question: string | null;
  reports_used: OverviewReportUsed[];
}

export interface OverviewSavedReport {
  id: string;
  title: string;
  created_at: string;
  conversation_id: string | null;
}

export interface OverviewActivity {
  id: string;
  timestamp: string;
  kind: string;
  text: string;
  report_id: string | null;
  conversation_id: string | null;
}

export interface Overview {
  persona: OverviewPersona;
  allow_api: boolean;
  totals: OverviewTotals;
  reports: OverviewReport[];
  chats: OverviewChat[];
  saved_reports: OverviewSavedReport[];
  activity: OverviewActivity[];
}

export const overviewApi = {
  /** Pass a signal so leaving the page (or a newer request) cancels the call. */
  get: async (userId: string, signal?: AbortSignal): Promise<Overview> => {
    try {
      const response = await fetch(`${BASE_URL}/api/overview/${encodeURIComponent(userId)}`, { signal });
      if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try {
          const body = await response.json();
          if (body?.detail) detail = String(body.detail);
        } catch {
          /* non-JSON error body */
        }
        throw new ApiError(response.status, detail);
      }
      return (await response.json()) as Overview;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new ApiError(0, "Cannot reach the VitaGraph backend. Is it running on port 8000?");
    }
  },
};
