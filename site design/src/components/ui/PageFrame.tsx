import React from "react";

export type PageWidth = "wide" | "narrow" | "full";

export interface PageFrameProps {
  label: string;
  width?: PageWidth;
  gap?: string;
  testId?: string;
  children?: React.ReactNode;
}

export const PageFrame: React.FC<PageFrameProps> = ({
  label,
  width = "wide",
  gap = "var(--space-8)",
  testId,
  children,
}) => {
  const maxWidth = width === "wide" ? "1280px" : width === "narrow" ? "960px" : "none";

  return (
    <div
      className="vg-page"
      data-screen-label={label}
      data-testid={testId}
      style={{
        maxWidth,
        display: "flex",
        flexDirection: "column",
        gap,
      }}
    >
      {children}
    </div>
  );
};
