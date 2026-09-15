import React from "react";
import { Badge } from "./Badge";
import { PaperSlip } from "./PaperSlip";

interface EvidenceItem {
  id: string;
  title: string;
  citation: string;
  quote: string;
  authors: string;
  journal?: string;
  similarity: number;
}

interface AnswerBlockProps {
  elapsedTime?: string;
  onEvidenceClick?: (term: string) => void;
  className?: string;
}

const defaultEvidences: EvidenceItem[] = [
  {
    id: "ev1",
    title: "Dapagliflozin in Heart Failure with Reduced Ejection Fraction",
    citation: "p. 2, span 310–355",
    quote: "Dapagliflozin reduced the risk of hospitalization for heart failure by 26% compared with placebo (HR 0.74, 95% CI 0.62–0.88).",
    authors: "McMurray et al. (2019)",
    journal: "NEJM",
    similarity: 0.89,
  },
  {
    id: "ev2",
    title: "Empagliflozin in Patients with HFpEF",
    citation: "p. 5, span 112–168",
    quote: "Empagliflozin led to a significant reduction in the composite of cardiovascular death or hospitalization for heart failure (HR 0.79, 95% CI 0.69–0.90).",
    authors: "Anker et al. (2021)",
    journal: "NEJM",
    similarity: 0.86,
  },
];

export const AnswerBlock: React.FC<AnswerBlockProps> = ({
  elapsedTime = "4.8 s",
  onEvidenceClick,
  className = "",
}) => {
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
          <Badge variant="answered">answered</Badge>
        </div>

        <span className="type-mono-sm text-[var(--dim)]">{elapsedTime}</span>
      </div>

      {/* Four Part Rows (§7.22) */}
      <div className="divide-y divide-[var(--line-faint)]">
        {/* Part 1: What the reports say */}
        <div className="py-3.5 flex flex-col sm:flex-row gap-3">
          <div className="w-[180px] type-body font-medium text-[var(--bone)] flex-shrink-0">
            What the reports say
          </div>
          <div className="type-reading text-[var(--bone)] leading-[21px] flex-1">
            Across the provided reports, SGLT2 inhibitors are associated with a significant reduction in the risk of hospitalization for heart failure{" "}
            <button
              onClick={() => onEvidenceClick?.("compared")}
              className="border-b border-dotted border-[var(--dim)] hover:border-[var(--verdigris)] hover:text-[var(--verdigris)] transition-colors cursor-pointer inline"
            >
              compared
            </button>{" "}
            to placebo or standard care, in both HFrEF and HFpEF populations.
          </div>
        </div>

        {/* Part 2: Evidence used */}
        <div className="py-3.5 flex flex-col sm:flex-row gap-3">
          <div className="w-[180px] type-body font-medium text-[var(--bone)] flex-shrink-0">
            Evidence used
          </div>
          <div className="type-reading text-[var(--bone)] leading-[21px] flex-1">
            We used 4 sources, including randomized controlled trials and meta-analyses, with consistent findings showing ~25–30% relative risk reduction in heart failure{" "}
            <button
              onClick={() => onEvidenceClick?.("hospitalization")}
              className="border-b border-dotted border-[var(--dim)] hover:border-[var(--verdigris)] hover:text-[var(--verdigris)] transition-colors cursor-pointer inline"
            >
              hospitalization
            </button>
            .
          </div>
        </div>

        {/* Part 3: What cannot be concluded */}
        <div className="py-3.5 flex flex-col sm:flex-row gap-3">
          <div className="w-[180px] type-body font-medium text-[var(--bone)] flex-shrink-0">
            What cannot be concluded
          </div>
          <div className="type-reading text-[var(--bone)] leading-[21px] flex-1">
            The reports do not establish long-term effects beyond the studied follow-up periods, nor do they directly compare all SGLT2 inhibitors head-to-head in every{" "}
            <button
              onClick={() => onEvidenceClick?.("patient subgroup")}
              className="border-b border-dotted border-[var(--dim)] hover:border-[var(--verdigris)] hover:text-[var(--verdigris)] transition-colors cursor-pointer inline"
            >
              patient subgroup
            </button>
            .
          </div>
        </div>

        {/* Part 4: Safety guidance */}
        <div className="py-3.5 flex flex-col sm:flex-row gap-3">
          <div className="w-[180px] type-body font-medium text-[var(--bone)] flex-shrink-0">
            Safety guidance
          </div>
          <div className="type-reading text-[var(--bone)] leading-[21px] flex-1">
            These findings apply to adults as studied in the included reports. Always consider individual patient factors (e.g., renal function, comorbidities) and follow{" "}
            <button
              onClick={() => onEvidenceClick?.("clinical guidelines")}
              className="border-b border-dotted border-[var(--dim)] hover:border-[var(--verdigris)] hover:text-[var(--verdigris)] transition-colors cursor-pointer inline"
            >
              clinical guidelines
            </button>
            .
          </div>
        </div>
      </div>

      {/* Embedded Evidence Cards (2 slips) */}
      <div className="mt-4 pt-4 border-t border-[var(--line-faint)]">
        <div className="flex items-center justify-between mb-3">
          <h4 className="type-card-title text-[var(--bone)] text-[15px]">
            Evidence used (4)
          </h4>
          <button className="type-mono-sm text-[var(--dim)] hover:text-[var(--bone)] cursor-pointer">
            View all
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {defaultEvidences.map((ev) => (
            <PaperSlip
              key={ev.id}
              title={ev.title}
              citation={ev.citation}
              quote={ev.quote}
              authors={ev.authors}
              journal={ev.journal}
              similarity={ev.similarity}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
