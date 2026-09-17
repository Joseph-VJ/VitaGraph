import React from "react";
import { LED } from "./LED";

export type BadgeVariant =
  | "answered"
  | "refused"
  | "insufficient_evidence"
  | "educational"
  | "rejected"
  | "ingesting"
  | "completed"
  | "verdigris"
  | "ochre"
  | "madder"
  | "cornflower"
  | "dim";

interface BadgeProps {
  variant?: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
  testId?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "verdigris",
  children,
  className = "",
  testId,
}) => {
  if (variant === "completed") {
    return (
      <span data-testid={testId} className={`inline-flex items-center gap-1.5 type-mono-sm text-[var(--bone)] ${className}`}>
        <LED color="verdigris" live={false} />
        <span>{children || "Completed in 4.8 s"}</span>
      </span>
    );
  }

  if (variant === "ingesting") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-[var(--r-4)] px-2 py-0.5 type-mono-sm bg-[rgba(121,184,166,0.12)] text-[var(--verdigris)] border border-[rgba(121,184,166,0.25)] ${className}`}
      >
        <svg
          className="animate-spin w-3 h-3 text-[var(--verdigris)]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span>{children || "Ingesting…"}</span>
      </span>
    );
  }

  const styles: Record<BadgeVariant, string> = {
    answered:
      "bg-[rgba(121,184,166,0.12)] text-[var(--verdigris)] border border-[rgba(121,184,166,0.25)]",
    educational:
      "bg-[rgba(121,184,166,0.12)] text-[var(--verdigris)] border border-[rgba(121,184,166,0.25)]",
    verdigris:
      "bg-[rgba(121,184,166,0.12)] text-[var(--verdigris)] border border-[rgba(121,184,166,0.25)]",
    refused:
      "bg-[rgba(217,128,141,0.12)] text-[var(--madder)] border border-[rgba(217,128,141,0.25)]",
    rejected:
      "bg-[rgba(217,128,141,0.12)] text-[var(--madder)] border border-[rgba(217,128,141,0.25)]",
    madder:
      "bg-[rgba(217,128,141,0.12)] text-[var(--madder)] border border-[rgba(217,128,141,0.25)]",
    insufficient_evidence:
      "bg-[rgba(217,164,65,0.12)] text-[var(--ochre)] border border-[rgba(217,164,65,0.25)]",
    ochre:
      "bg-[rgba(217,164,65,0.12)] text-[var(--ochre)] border border-[rgba(217,164,65,0.25)]",
    cornflower:
      "bg-[rgba(134,169,217,0.12)] text-[var(--cornflower)] border border-[rgba(134,169,217,0.25)]",
    dim:
      "bg-[var(--ink-700)] text-[var(--dim)] border border-[var(--line-strong)]",
    completed: "",
    ingesting: "",
  };

  const defaultText: Partial<Record<BadgeVariant, string>> = {
    answered: "answered",
    refused: "refused — diagnostic boundary",
    insufficient_evidence: "insufficient evidence",
    educational: "educational",
    rejected: "1 file rejected",
  };

  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded-[var(--r-4)] px-2 py-0.5 type-mono-sm ${styles[variant]} ${className}`}
    >
      {children || defaultText[variant] || ""}
    </span>
  );
};
