import React, { useState } from "react";
import { Button, IconButton } from "./Buttons";
import { PaperSlip } from "./PaperSlip";

interface DocumentPanelProps {
  className?: string;
}

export const DocumentPanel: React.FC<DocumentPanelProps> = ({ className = "" }) => {
  const [activeTab, setActiveTab] = useState("Overview");

  const tabs = ["Overview", "Evidence (8)", "Related nodes (6)"];

  return (
    <div
      className={`rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--line-faint)] mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[var(--r-6)] bg-[var(--ink-700)] border border-[var(--line-strong)] flex items-center justify-center text-[var(--bone)] flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
            </div>
            <div>
              <h3 className="font-['Spectral'] text-[16px] leading-[22px] font-semibold text-[var(--bone)] truncate max-w-[240px]">
                NEJM_2023_HeartFailure.pdf
              </h3>
              <div className="type-meta text-[var(--dim)] mt-0.5">
                New England Journal of Medicine · 2023 · 18 pages
              </div>
            </div>
          </div>

          <IconButton size={28} title="Actions">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </IconButton>
        </div>

        {/* Tab Row (underline-active §7.19) */}
        <div className="flex border-b border-[var(--line-faint)] mb-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-3.5 type-label transition-colors duration-[120ms] relative cursor-pointer ${
                  isActive
                    ? "text-[var(--bone)] border-b-2 border-b-[var(--verdigris)] -mb-[1px]"
                    : "text-[var(--dim)] hover:text-[var(--bone)]"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Key-info rows */}
        <div className="space-y-2 mb-5">
          <div className="flex justify-between type-body text-[12.5px]">
            <span className="text-[var(--dim)]">Document type</span>
            <span className="text-[var(--bone)]">Journal article</span>
          </div>
          <div className="flex justify-between type-body text-[12.5px]">
            <span className="text-[var(--dim)]">Domain</span>
            <span className="text-[var(--bone)]">Cardiology</span>
          </div>
          <div className="flex justify-between type-body text-[12.5px]">
            <span className="text-[var(--dim)]">Population</span>
            <span className="text-[var(--bone)] text-right">Adults with heart failure (n = 4,372)</span>
          </div>
          <div className="flex justify-between type-body text-[12.5px]">
            <span className="text-[var(--dim)]">Methods</span>
            <span className="text-[var(--bone)]">Randomized controlled trial</span>
          </div>
          <div className="flex justify-between type-body text-[12.5px]">
            <span className="text-[var(--dim)]">Published</span>
            <span className="text-[var(--bone)]">Mar 2, 2023</span>
          </div>
          <div className="flex justify-between type-body text-[12.5px]">
            <span className="text-[var(--dim)]">DOI</span>
            <a
              href="#"
              className="type-mono-sm text-[var(--verdigris)] hover:underline flex items-center gap-1"
            >
              <span>10.1056/NEJMoa2211931</span>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>

        {/* AI summary */}
        <div className="mb-5">
          <h4 className="type-card-title text-[var(--bone)] mb-1.5">AI summary</h4>
          <p className="type-reading text-[var(--bone)] opacity-90 leading-[21px]">
            This study evaluated the effect of an SGLT2 inhibitor in patients with heart failure and reduced ejection fraction. The results show a significant reduction in the composite outcome of cardiovascular death or hospitalization, with consistent benefits across key subgroups.
          </p>
        </div>

        {/* Key evidence from this document (Paper slip) */}
        <div className="mb-5">
          <h4 className="type-card-title text-[var(--bone)] mb-2">Key evidence from this document</h4>
          <PaperSlip
            citation="p. 4, §2.3"
            quote="Treatment with the SGLT2 inhibitor resulted in a 26% lower risk of the composite of cardiovascular death or hospitalization for heart failure compared with placebo (hazard ratio 0.74, 95% CI 0.62–0.88)."
            authors="McMurray et al. (2023)"
            journal="NEJM"
          />
        </div>

        {/* Related insights */}
        <div className="mb-4">
          <h4 className="type-card-title text-[var(--bone)] mb-2.5">Related insights</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 p-2 rounded-[var(--r-6)] bg-[var(--ink-700)]/50 border border-[var(--line-faint)]">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="w-5 h-5 rounded-[var(--r-4)] bg-[var(--ink-700)] text-[var(--dim)] type-mono-sm flex items-center justify-center flex-shrink-0">
                  1
                </span>
                <span className="type-body text-[var(--bone)] text-[12.5px] truncate">
                  SGLT2 inhibitors reduce hospitalization risk in heart failure
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded-[var(--r-4)] bg-[rgba(121,184,166,0.12)] text-[var(--verdigris)] type-mono-sm font-medium flex-shrink-0">
                0.94
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 p-2 rounded-[var(--r-6)] bg-[var(--ink-700)]/50 border border-[var(--line-faint)]">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="w-5 h-5 rounded-[var(--r-4)] bg-[var(--ink-700)] text-[var(--dim)] type-mono-sm flex items-center justify-center flex-shrink-0">
                  2
                </span>
                <span className="type-body text-[var(--bone)] text-[12.5px] truncate">
                  Lower eGFR is associated with higher adverse event rates
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded-[var(--r-4)] bg-[rgba(121,184,166,0.12)] text-[var(--verdigris)] type-mono-sm font-medium flex-shrink-0">
                0.87
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 p-2 rounded-[var(--r-6)] bg-[var(--ink-700)]/50 border border-[var(--line-faint)]">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="w-5 h-5 rounded-[var(--r-4)] bg-[var(--ink-700)] text-[var(--dim)] type-mono-sm flex items-center justify-center flex-shrink-0">
                  3
                </span>
                <span className="type-body text-[var(--bone)] text-[12.5px] truncate">
                  Benefit consistent across age groups
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded-[var(--r-4)] bg-[rgba(121,184,166,0.12)] text-[var(--verdigris)] type-mono-sm font-medium flex-shrink-0">
                0.82
              </span>
            </div>
          </div>
        </div>

        {/* Ghost button */}
        <Button variant="ghost" className="w-full justify-center">
          <svg className="w-4 h-4 mr-1.5 text-[var(--dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span>View all related nodes (6)</span>
        </Button>
      </div>

      {/* Marginalia bottom-right */}
      <div className="mt-4 pt-3 border-t border-[var(--line-faint)] flex items-center justify-end gap-2 text-right">
        <span className="type-marginalia text-[13px]">
          Better Questions Healthier People
        </span>
        <svg className="w-4 h-4 text-[var(--verdigris)] opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
    </div>
  );
};
