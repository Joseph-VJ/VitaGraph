import React from "react";

export type ActivityClass = "indexed" | "answered" | "graph" | "refusal" | "dataset";

interface ActivityRowProps {
  activityClass: ActivityClass;
  timestamp: string;
  eventName: string;
  details: string;
  objectName: string;
  className?: string;
}

export const ActivityRow: React.FC<ActivityRowProps> = ({
  activityClass,
  timestamp,
  eventName,
  details,
  objectName,
  className = "",
}) => {
  const classStyles: Record<ActivityClass, { border: string; iconColor: string; icon: React.ReactNode }> = {
    indexed: {
      border: "border-l-[var(--verdigris)]",
      iconColor: "text-[var(--verdigris)]",
      icon: (
        <svg className="w-4 h-4 text-[var(--verdigris)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      ),
    },
    answered: {
      border: "border-l-[var(--verdigris)]",
      iconColor: "text-[var(--verdigris)]",
      icon: (
        <svg className="w-4 h-4 text-[var(--verdigris)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      ),
    },
    graph: {
      border: "border-l-[var(--ochre)]",
      iconColor: "text-[var(--ochre)]",
      icon: (
        <svg className="w-4 h-4 text-[var(--ochre)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      ),
    },
    refusal: {
      border: "border-l-[var(--madder)]",
      iconColor: "text-[var(--madder)]",
      icon: (
        <svg className="w-4 h-4 text-[var(--madder)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    dataset: {
      border: "border-l-[var(--cornflower)]",
      iconColor: "text-[var(--cornflower)]",
      icon: (
        <svg className="w-4 h-4 text-[var(--cornflower)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        </svg>
      ),
    },
  };

  const current = classStyles[activityClass];

  return (
    <div
      className={`flex items-center justify-between py-2.5 px-3 border-l-2 ${current.border} bg-[var(--ink-800)]/40 hover:bg-[var(--ink-600)] transition-colors duration-[120ms] border-b border-[var(--line-faint)] last:border-b-0 ${className}`}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <span className="type-mono-sm text-[var(--dim)] w-36 flex-shrink-0">
          {timestamp}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0 w-40">
          {current.icon}
          <span className="type-body font-medium text-[var(--bone)] truncate">{eventName}</span>
        </div>
        <span className="type-body text-[var(--dim)] truncate flex-1 min-w-0">
          {details}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-700)] border border-[var(--line-strong)] text-[var(--bone)] flex-shrink-0 ml-3">
        <svg className="w-3.5 h-3.5 text-[var(--dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        </svg>
        <span className="type-mono-sm truncate max-w-[180px]">{objectName}</span>
      </div>
    </div>
  );
};
