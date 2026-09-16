import React from "react";
import { Badge } from "./Badge";
import { PaperSlip } from "./PaperSlip";
import type { EvidenceCard } from "../../types";

export interface AnswerBlockProps {
  summaryText?: string;
  limitationsText?: string;
  safetyText?: string;
  evidenceCards?: EvidenceCard[];
  status?: string; // answered | refused | insufficient_evidence | error
  elapsedTime?: string;
  onEvidenceClick?: (evidence: EvidenceCard) => void;
  className?: string;
}

const defaultEvidences: EvidenceCard[] = [
  {
    chunk_id: "ev1",
    report_id: "rep1",
    report_filename: "Arjun_Lab_Report_Jan2025.pdf",
    report_date: "2025-01-15",
    page_number: 1,
    snippet: "Hemoglobin: 14.1 g/dL (Reference 13.5 - 17.5 g/dL). Normal range. RBC count: 4.8 million/mcL.",
    score: 0.89,
  },
  {
    chunk_id: "ev2",
    report_id: "rep2",
    report_filename: "Arjun_Lab_Report_Jun2025.pdf",
    report_date: "2025-06-20",
    page_number: 1,
    snippet: "Hemoglobin: 13.8 g/dL (Reference 13.5 - 17.5 g/dL). Normal range.",
    score: 0.84,
  },
];

export const AnswerBlock: React.FC<AnswerBlockProps> = ({
  summaryText,
  limitationsText,
  safetyText,
  evidenceCards,
  status = "answered",
  elapsedTime = "0.8 s",
  onEvidenceClick,
  className = "",
}) => {
  // Use provided evidenceCards if explicitly passed; otherwise fallback to defaultEvidences only if summaryText is also empty
  const activeCards =
    evidenceCards !== undefined
      ? evidenceCards
      : summaryText !== undefined
      ? []
      : defaultEvidences;

  const displaySummary =
    summaryText ||
    "Across the provided reports, clinical biomarkers are within expected baseline ranges with consistent topological alignment.";
  const displayLimitations =
    limitationsText ||
    "The reports reflect discrete point-in-time measurements. Long-term trends require serial longitudinal verification with a qualified clinician.";
  const displaySafety =
    safetyText ||
    "VitaGraph is an educational decision-support tool and does not provide diagnostic or therapeutic instructions. Consult your physician for medical decisions.";

  return (
    <div
      className={`rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-5 flex flex-col ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--line-faint)]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-[var(--verdigris)] text-[var(--ink-900)] flex items-center justify-center font-bold flex-shrink-0">
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="font-['Spectral'] text-[20px] leading-[26px] font-semibold text-[var(--bone)]">
            Answer
          </h3>
          {status === "answered" && <Badge variant="answered">answered</Badge>}
          {status === "insufficient_evidence" && <Badge variant="dim">insufficient evidence</Badge>}
          {status === "refused" && <Badge variant="refused">refused</Badge>}
          {status === "error" && <Badge variant="madder">error</Badge>}
        </div>

        <span className="type-mono-sm text-[var(--dim)]">{elapsedTime}</span>
      </div>

      {/* Four Part Rows (§7.22 & Plan §10) */}
      <div className="divide-y divide-[var(--line-faint)]">
        {/* Part 1: What the reports say */}
        <div className="py-3.5 flex flex-col sm:flex-row gap-3">
          <div className="w-[180px] type-body font-medium text-[var(--bone)] flex-shrink-0">
            What the reports say
          </div>
          <div className="type-reading text-[var(--bone)] leading-[21px] flex-1">
            {displaySummary}
          </div>
        </div>

        {/* Part 2: Evidence used */}
        <div className="py-3.5 flex flex-col sm:flex-row gap-3">
          <div className="w-[180px] type-body font-medium text-[var(--bone)] flex-shrink-0">
            Evidence used
          </div>
          <div className="type-reading text-[var(--bone)] leading-[21px] flex-1">
            {activeCards.length > 0
              ? `Referenced ${activeCards.length} verified laboratory evidence chunk${activeCards.length === 1 ? "" : "s"} extracted from patient reports with semantic vector similarity.`
              : "No specific clinical document chunks met the retrieval confidence threshold for this query."}
          </div>
        </div>

        {/* Part 3: What cannot be concluded */}
        <div className="py-3.5 flex flex-col sm:flex-row gap-3">
          <div className="w-[180px] type-body font-medium text-[var(--bone)] flex-shrink-0">
            What cannot be concluded
          </div>
          <div className="type-reading text-[var(--bone)] leading-[21px] flex-1">
            {displayLimitations}
          </div>
        </div>

        {/* Part 4: Safety guidance */}
        <div className="py-3.5 flex flex-col sm:flex-row gap-3">
          <div className="w-[180px] type-body font-medium text-[var(--bone)] flex-shrink-0">
            Safety guidance
          </div>
          <div className="type-reading text-[var(--bone)] leading-[21px] flex-1">
            {displaySafety}
          </div>
        </div>
      </div>

      {/* Embedded Evidence Cards (§7.22 PaperSlips) */}
      {activeCards.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--line-faint)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="type-card-title text-[var(--bone)] text-[15px]">
              Evidence used ({activeCards.length})
            </h4>
            <span className="type-mono-sm text-[var(--dim)]">
              provenance verified
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeCards.map((ev) => (
              <PaperSlip
                key={ev.chunk_id}
                title={ev.report_filename}
                citation={`p. ${ev.page_number}`}
                quote={ev.snippet}
                authors="Clinical Laboratory Report"
                journal={ev.report_date ? `Date: ${ev.report_date}` : undefined}
                similarity={ev.score}
                onCite={() => onEvidenceClick?.(ev)}
                onClick={() => onEvidenceClick?.(ev)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
