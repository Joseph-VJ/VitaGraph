import React, { useEffect, useId, useRef } from "react";

export interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** A flat confirm box. Focus starts on the safe button, Tab stays inside, Esc and a click outside close it. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  body,
  confirmLabel,
  cancelLabel = "Keep it",
  busy = false,
  error,
  onConfirm,
  onCancel,
  testId,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!busy) onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const items = Array.from(boxRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="dialog-backdrop"
      style={{ zIndex: 100 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={boxRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-testid={testId ?? "data-confirm-dialog"}
        style={{ width: "min(520px, 100%)", gap: "var(--space-4)", padding: "var(--space-6)", borderTop: "2px solid var(--color-accent)" }}
      >
        <h2 id={titleId} className="dialog-title" style={{ margin: 0, overflowWrap: "anywhere" }}>
          {title}
        </h2>
        <p id={bodyId} className="dialog-body" style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.5, opacity: 1 }}>
          {body}
        </p>
        {error ? (
          <p role="alert" data-testid="data-confirm-error" style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-accent-800)", background: "var(--color-accent-100)", padding: "var(--space-3)" }}>
            {error}
          </p>
        ) : null}
        <div className="dialog-actions" style={{ flexWrap: "wrap" }}>
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy} style={{ minHeight: 44 }}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy} data-testid="data-confirm-yes" style={{ minHeight: 44 }}>
            {busy ? "Deleting" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
