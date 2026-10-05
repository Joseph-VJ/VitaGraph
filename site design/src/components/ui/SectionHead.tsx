import React from "react";

export interface SectionHeadProps {
  title: string;
  aside?: React.ReactNode;
  accent?: boolean;
  testId?: string;
}

export const SectionHead: React.FC<SectionHeadProps> = ({
  title,
  aside,
  accent = false,
  testId,
}) => {
  return (
    <div
      data-testid={testId}
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "var(--space-3)",
        paddingBottom: "var(--space-2)",
        borderBottom: "2px solid var(--color-divider)",
      }}
    >
      <h2
        style={{
          fontSize: "0.6875rem",
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: accent ? "var(--color-accent-700)" : "var(--color-neutral-700)",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {aside && (
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--color-neutral-700)",
          }}
        >
          {aside}
        </div>
      )}
    </div>
  );
};
