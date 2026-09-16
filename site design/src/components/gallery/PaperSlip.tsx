import React from "react";

interface PaperSlipProps {
  citation?: string;
  title?: string;
  quote: string;
  authors: string;
  journal?: string;
  similarity?: number; // 0 to 1 e.g. 0.89
  onCite?: () => void;
  onClick?: () => void;
  className?: string;
}

export const PaperSlip: React.FC<PaperSlipProps> = ({
  citation = "p. 4, §2.3",
  title,
  quote,
  authors,
  journal = "NEJM",
  similarity,
  onCite,
  onClick,
  className = "",
}) => {
  return (
    <figure
      onClick={onClick}
      className={`relative rounded-[var(--r-6)] bg-[var(--paper)] text-[var(--paper-ink)] p-4 paper-slip-grain shadow-sm overflow-hidden flex flex-col justify-between ${
        onClick ? "cursor-pointer hover:shadow-md hover:ring-1 hover:ring-[var(--verdigris)]/50 transition-all duration-[120ms]" : ""
      } ${className}`}
    >
      {/* Folded corner top-right 22px triangle */}
      <div
        className="absolute top-0 right-0 w-[22px] h-[22px] pointer-events-none"
        style={{
          background: "linear-gradient(135deg, transparent 50%, var(--paper-fold) 50%)",
        }}
      />

      {/* Top row: Title and/or Citation chip */}
      <div className="flex items-start justify-between gap-3 mb-2 pr-6">
        {title ? (
          <h4 className="font-['IBM_Plex_Sans'] text-[13px] font-semibold text-[var(--paper-ink)] leading-snug">
            {title}
          </h4>
        ) : <div />}
        <span className="type-mono-sm px-1.5 py-0.5 rounded-[var(--r-4)] bg-[var(--paper-fold)] text-[var(--paper-ink)] font-medium flex-shrink-0">
          {citation}
        </span>
      </div>

      {/* Blockquote in Spectral italic */}
      <blockquote className="font-['Spectral'] text-[14px] leading-[22px] italic text-[var(--paper-ink)] mb-3">
        “{quote}”
      </blockquote>

      {/* Footer row: Attribution, Similarity, Cite button */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[rgba(42,38,32,0.12)]">
        <div className="flex items-center gap-1.5 text-[12px] text-[rgba(42,38,32,0.75)]">
          <span className="font-medium font-['IBM_Plex_Sans']">{authors}</span>
          {journal && <span className="font-['Spectral'] italic font-medium">{journal}</span>}
        </div>

        <div className="flex items-center gap-3">
          {similarity !== undefined && (
            <div className="flex items-center gap-2">
              <span className="type-meta text-[rgba(42,38,32,0.65)]">Similarity</span>
              <div className="w-24 h-1 bg-[var(--paper-fold)] rounded-[2px] overflow-hidden">
                <div
                  style={{ width: `${similarity * 100}%` }}
                  className="h-full bg-[#4E8F7F] rounded-[2px]"
                />
              </div>
              <span className="type-mono-sm font-medium text-[var(--paper-ink)]">
                {similarity.toFixed(2)}
              </span>
            </div>
          )}

          <button
            onClick={onCite}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--r-4)] border border-[rgba(42,38,32,0.30)] hover:bg-[rgba(42,38,32,0.06)] active:bg-[rgba(42,38,32,0.12)] transition-colors duration-[120ms] text-[var(--paper-ink)] text-[12px] font-medium font-['IBM_Plex_Sans'] cursor-pointer"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
            <span>Cite</span>
          </button>
        </div>
      </div>
    </figure>
  );
};
