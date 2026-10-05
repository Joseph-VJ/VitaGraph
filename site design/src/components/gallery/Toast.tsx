import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { Sequence } from "../../motion/sequence";
import { flip } from "../../motion/flip";
import { governor } from "../../motion/quality";
import { isReducedMotion } from "../../motion/features";

export type ToastType = "done" | "failed" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  detail?: string;
  timestamp: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (type: ToastType, title: string, detail?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const RULE: Record<ToastType, string> = {
  done: "var(--color-text)",
  failed: "var(--color-accent)",
  info: "var(--color-neutral-500)",
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [exitingIds, setExitingIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const removeToast = useCallback((id: string) => {
    const isT0 = governor.getState().tier === "T0" || isReducedMotion();
    if (isT0) {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      return;
    }
    setExitingIds((prev) => [...prev, id]);
    new Sequence()
      .wait(180)
      .addAction(() => {
        if (containerRef.current) {
          flip(containerRef.current, () => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
            setExitingIds((prev) => prev.filter((i) => i !== id));
          }, { spring: "weighted", capMs: 240 });
        } else {
          setToasts((prev) => prev.filter((t) => t.id !== id));
          setExitingIds((prev) => prev.filter((i) => i !== id));
        }
      })
      .play();
  }, []);

  const addToast = useCallback((type: ToastType, title: string, detail?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const newToast: ToastItem = { id, type, title, detail, timestamp };

    setToasts((prev) => [...prev.slice(-4), newToast]); // keep at most 5 toasts

    // presentation dwell (US-15, Gate 18: Sequence timer)
    new Sequence()
      .wait(4000)
      .addAction(() => {
        removeToast(id);
      })
      .play();
  }, [removeToast]);

  useEffect(() => {
    (window as Window & { __VG_ADD_TOAST__?: ToastContextValue["addToast"] }).__VG_ADD_TOAST__ = addToast;
    return () => {
      delete (window as Window & { __VG_ADD_TOAST__?: ToastContextValue["addToast"] }).__VG_ADD_TOAST__;
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Floating toasts sit above the 40 px status strip */}
      <div
        ref={containerRef}
        data-testid="toast-container"
        className="fixed z-50 flex flex-col gap-2 pointer-events-none"
        style={{
          right: "var(--space-4)",
          bottom: "calc(40px + var(--space-4))",
          width: "min(360px, calc(100vw - 2 * var(--space-4)))",
        }}
      >
        {toasts.map((toast) => {
          const isExiting = exitingIds.includes(toast.id);
          const isFailed = toast.type === "failed";

          return (
            <div
              key={toast.id}
              role={isFailed ? "alert" : "status"}
              data-testid={`toast-${toast.id}`}
              data-toast-type={toast.type}
              className={`pointer-events-auto flex items-start gap-[var(--space-3)] transition-all duration-[120ms] ${
                isExiting ? "m-exit" : "animate-fade-in"
              }`}
              style={{
                padding: "var(--space-3) var(--space-4)",
                background: "var(--color-bg)",
                borderTop: `2px solid ${RULE[toast.type]}`,
                boxShadow: "var(--shadow-md)",
              }}
            >
              {/* Content */}
              <div className="flex-1 min-w-0" style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 800,
                      color: isFailed ? "var(--color-accent-700)" : "var(--color-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {toast.title}
                  </span>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      color: "var(--color-neutral-700)",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {toast.timestamp}
                  </span>
                </div>
                {toast.detail && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.8125rem",
                      color: "var(--color-neutral-700)",
                      overflowWrap: "break-word",
                    }}
                  >
                    {toast.detail}
                  </p>
                )}
              </div>

              {/* Dismiss button */}
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="btn btn-ghost flex-shrink-0"
                style={{ padding: "var(--space-1)", color: "var(--color-neutral-700)" }}
                aria-label="Dismiss notification"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
