import React, { createContext, useContext, useState, useCallback, useRef } from "react";
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

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Floating Toast Container */}
      <div
        ref={containerRef}
        data-testid="toast-container"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
      >
        {toasts.map((toast) => {
          const isExiting = exitingIds.includes(toast.id);
          const borderClass =
            toast.type === "done"
              ? "border-l-4 border-l-[var(--verdigris)]"
              : toast.type === "failed"
              ? "border-l-4 border-l-[var(--madder)]"
              : "border-l-4 border-l-[var(--ochre)]";

          return (
            <div
              key={toast.id}
              role="alert"
              data-testid={`toast-${toast.id}`}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)] ${borderClass} shadow-lg transition-all duration-[120ms] ${
                isExiting ? "m-exit" : "animate-fade-in"
              }`}
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {toast.type === "done" && (
                  <svg className="w-4 h-4 text-[var(--verdigris)]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {toast.type === "failed" && (
                  <svg className="w-4 h-4 text-[var(--madder)]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
                {toast.type === "info" && (
                  <svg className="w-4 h-4 text-[var(--ochre)]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="type-label text-[var(--bone)] font-medium text-[13px] truncate">
                    {toast.title}
                  </span>
                  <span className="type-mono-sm text-[var(--faint)] text-[10px] flex-shrink-0">
                    {toast.timestamp}
                  </span>
                </div>
                {toast.detail && (
                  <p className="type-meta text-[var(--dim)] text-[11px] mt-0.5 break-words line-clamp-2">
                    {toast.detail}
                  </p>
                )}
              </div>

              {/* Dismiss button */}
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 text-[var(--faint)] hover:text-[var(--bone)] p-0.5 rounded transition-colors"
                aria-label="Dismiss toast"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
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
