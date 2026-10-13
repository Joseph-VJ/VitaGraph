// Chart rendering and passage highlight calls. Both are read-only: the numbers come from the person's stored reports.

import { ApiError, BASE_URL } from "./client";
import type { ChartSpec } from "../lib/chartSpec";

export interface ChartPoint {
  report_id: string;
  label: string; // e.g. "Jan 2025" or "Undated"
  date_iso: string | null;
  value: number;
  flag: string;
  range_low: number | null;
  range_high: number | null;
  page_number: number;
  chunk_id: string;
  char_start: number;
  char_end: number;
}

export interface ChartSeries {
  test: string;
  unit: string;
  points: ChartPoint[];
}

export interface ChartResult {
  kind: string;
  title: string;
  svg: string;
  series: ChartSeries[];
  notes: string[];
}

export interface HighlightRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface HighlightResult {
  rects: HighlightRect[];
  method: "text" | "ocr" | "none";
}

export function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}

/** Same error rules as the shared client: the backend's plain `detail` sentence is kept. Aborts pass through. */
async function call<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, init);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError(0, "Cannot reach the VitaGraph backend. Is it running on port 8000?");
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body?.detail === "string" && body.detail.trim()) detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export const chartsApi = {
  /** Draw a chart from a spec (names only). Rejects with the backend's sentence on 422 or 404. */
  render: (userId: string, spec: ChartSpec, signal?: AbortSignal): Promise<ChartResult> =>
    call<ChartResult>("/api/agent/chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, spec }),
      signal,
    }),

  /** Where the cited characters sit on one page image, as boxes normalised to 0..1. */
  highlight: (
    userId: string,
    reportId: string,
    page: number,
    charStart: number,
    charEnd: number,
    signal?: AbortSignal
  ): Promise<HighlightResult> =>
    call<HighlightResult>(
      `/api/reports/${encodeURIComponent(reportId)}/pages/${page}/highlight?user_id=${encodeURIComponent(userId)}&char_start=${charStart}&char_end=${charEnd}`,
      { method: "GET", signal }
    ),
};
