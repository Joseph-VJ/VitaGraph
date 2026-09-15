// Shared TypeScript types mirroring the backend schemas.

export interface User {
  id: string;
  display_label: string;
  created_at: string;
  status: string;
  consent_accepted: boolean;
}

export interface Report {
  id: string;
  user_id: string;
  original_filename: string;
  file_hash: string;
  report_date: string | null;
  upload_time: string;
  version: number;
  status: string; // received | extracting | indexing | ready | failed
  page_count: number | null;
  error_message: string | null;
}

export interface ReportPage {
  page_number: number;
  extraction_method: string; // native | ocr | failed
  text_length: number;
  quality: string;
  extracted_text: string;
}

export interface EvidenceCard {
  chunk_id: string;
  report_id: string;
  report_filename: string;
  report_date: string | null;
  page_number: number;
  snippet: string;
  score: number;
}

export interface Answer {
  question_id: string;
  classification: string;
  status: string; // answered | refused | insufficient_evidence | error
  summary_text: string;
  evidence: EvidenceCard[];
  limitations_text: string;
  safety_text: string;
  ai_service_status: string; // ok | disabled | error | not_used
  safety_status: string;
}

export interface TimelineEvent {
  id: string;
  user_id: string;
  event_type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}
