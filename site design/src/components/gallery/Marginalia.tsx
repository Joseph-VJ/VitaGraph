import React from "react";

export type MarginaliaSketch = "mountains" | "quill" | "leaf" | "compass" | "none";

interface MarginaliaProps {
  text: string;
  sketch?: MarginaliaSketch;
  size?: number;
  className?: string;
}

export const Marginalia: React.FC<MarginaliaProps> = ({
  text,
  sketch = "none",
  className = "",
}) => {
  const renderSketch = (s: MarginaliaSketch) => {
    switch (s) {
      case "mountains":
        return (
          <svg className="w-16 h-8 text-[var(--bone)] opacity-50 mt-1" viewBox="0 0 64 32" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M4 28L18 8L28 20L38 12L52 28H4Z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22 28L32 16L42 28" strokeLinecap="round" opacity="0.6" />
          </svg>
        );
      case "quill":
        return (
          <svg className="w-6 h-6 text-[var(--bone)] opacity-50 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M20.24 12.24a6 6 0 00-8.49-8.49L3 11.5V21h9.5z" />
            <line x1="16" y1="8" x2="2" y2="22" />
          </svg>
        );
      case "leaf":
        return (
          <svg className="w-6 h-6 text-[var(--verdigris)] opacity-60 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        );
      case "compass":
        return (
          <svg className="w-6 h-6 text-[var(--verdigris)] opacity-60 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="12" cy="12" r="9" />
            <polygon points="12 4 15 12 12 20 9 12 12 4" fill="currentColor" opacity="0.4" />
          </svg>
        );
      case "none":
      default:
        return null;
    }
  };

  return (
    <div className={`type-marginalia select-none flex flex-col items-start ${className}`}>
      <span>{text}</span>
      {renderSketch(sketch)}
    </div>
  );
};
