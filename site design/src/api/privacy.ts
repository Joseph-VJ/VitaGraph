// Privacy Shield API: summary, live preview, "always hide" words and the tamper-evident ledger.

import { api, ApiError, BASE_URL } from "./client";

export type LedgerScope = "persona" | "tools";

export interface PrivacySummary {
  covered: boolean;
  calls: number;
  removed_total: number;
  chars_sent: number;
  by_type: Record<string, number>;
  last_call_at: string | null;
}

export interface PreviewSpan {
  type: string;
  placeholder: string;
  /** Offsets into the ORIGINAL text. */
  start: number;
  end: number;
}

export interface PreviewResult {
  masked: string;
  spans: PreviewSpan[];
  counts: Record<string, number>;
}

export interface PrivacyTerm {
  id: string;
  term: string;
  created_at: string;
}

export interface LedgerRow {
  id: string;
  seq: number;
  purpose: string;
  created_at: string;
  chars_original: number;
  chars_sent: number;
  removed_total: number;
  removed_by_type: Record<string, number>;
  prev_hash: string;
  row_hash: string;
}

export interface LedgerRowFull extends LedgerRow {
  sent_text: string;
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  broken_at_seq: number | null;
  message: string;
}

export interface TamperResult {
  changed_seq: number;
  detected_at_seq: number | null;
  detected: boolean;
  checked: number;
}

const q = (params: Record<string, string | number>): string =>
  Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");

export const privacyApi = {
  summary: (userId: string) => api.get<PrivacySummary>(`/api/privacy/summary?${q({ user_id: userId })}`),

  /** No model call and nothing saved; pass a signal so a newer keystroke cancels this request. */
  preview: async (userId: string, text: string, signal?: AbortSignal): Promise<PreviewResult> => {
    try {
      const response = await fetch(`${BASE_URL}/api/privacy/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, text }),
        signal,
      });
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
      return (await response.json()) as PreviewResult;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new ApiError(0, "Cannot reach the VitaGraph backend. Is it running on port 8000?");
    }
  },

  terms: (userId: string) => api.get<PrivacyTerm[]>(`/api/privacy/terms?${q({ user_id: userId })}`),
  addTerm: (userId: string, term: string) => api.post<PrivacyTerm>("/api/privacy/terms", { user_id: userId, term }),
  deleteTerm: (userId: string, termId: string) =>
    api.del<{ deleted: string }>(`/api/privacy/terms/${encodeURIComponent(termId)}?${q({ user_id: userId })}`),

  ledger: (userId: string, scope: LedgerScope, limit = 50) =>
    api.get<LedgerRow[]>(`/api/privacy/ledger?${q({ user_id: userId, scope, limit })}`),
  ledgerRow: (userId: string, rowId: string, scope: LedgerScope = "persona") =>
    api.get<LedgerRowFull>(`/api/privacy/ledger/${encodeURIComponent(rowId)}?${q({ user_id: userId, scope })}`),
  verify: (userId: string, scope: LedgerScope) =>
    api.post<VerifyResult>("/api/privacy/ledger/verify", { user_id: userId, scope }),
  tamperTest: (userId: string, scope: LedgerScope) =>
    api.post<TamperResult>("/api/privacy/ledger/tamper-test", { user_id: userId, scope }),
};
