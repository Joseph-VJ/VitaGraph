import React from "react";

export type PageStateKind = "loading" | "empty" | "error" | "offline";

export interface PageStateProps {
  kind: PageStateKind;
  title: string;
  detail?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  testId?: string;
}

export const PageState: React.FC<PageStateProps> = ({
  kind,
  title,
  detail,
  action,
  secondaryAction,
  testId,
}) => {
  const isAlert = kind === "error" || kind === "offline";
  const borderTopColor =
    kind === "loading"
      ? "var(--color-divider)"
      : kind === "empty"
      ? "var(--color-text)"
      : "var(--color-accent)";
  const backgroundColor = isAlert ? "var(--color-accent-100)" : "var(--color-surface)";
  const titleColor = isAlert ? "var(--color-accent-800)" : "var(--color-text)";

  return (
    <div
      data-state={kind}
      data-testid={testId ?? `page-state-${kind}`}
      role={isAlert ? "alert" : "status"}
      aria-live={kind === "loading" ? "polite" : undefined}
      style={{
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        alignItems: "flex-start",
        borderTop: `2px solid ${borderTopColor}`,
        background: backgroundColor,
      }}
    >
      <h3
        style={{
          fontSize: "1.25rem",
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: titleColor,
          margin: 0,
        }}
      >
        {title}
      </h3>

      {detail && (
        <p
          style={{
            fontSize: "0.9375rem",
            color: "var(--color-neutral-700)",
            maxWidth: "62ch",
            overflowWrap: "break-word",
            margin: 0,
          }}
        >
          {detail}
        </p>
      )}

      {(action || secondaryAction) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-2)",
            alignItems: "center",
          }}
        >
          {action && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
