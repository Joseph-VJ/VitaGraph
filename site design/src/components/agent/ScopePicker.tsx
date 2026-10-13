import React, { useEffect, useRef, useState } from "react";
import type { Report } from "../../types";

interface ScopePickerProps {
  reports: Report[];
  /** The chosen report id, or null for all reports. */
  value: string | null;
  /** The chosen id is not in the list (yet). */
  loading: boolean;
  disabled?: boolean;
  onChange: (reportId: string | null) => void;
}

/** "Report": choose which report the next question may use. Opens upward, above the composer. */
export const ScopePicker: React.FC<ScopePickerProps> = ({ reports, value, loading, disabled, onChange }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const usable = reports.filter((r) => r.status === "ready");
  const chosen = value ? reports.find((r) => r.id === value) ?? null : null;
  const label = value ? (chosen ? chosen.original_filename : loading ? "Loading" : "Not found") : "All my reports";

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]');
    const checked = Array.from(items ?? []).find((el) => el.getAttribute("aria-checked") === "true");
    (checked ?? items?.[0])?.focus();
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(at + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(at - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === "Tab") {
      close(false);
    }
  };

  const pick = (id: string | null) => {
    onChange(id);
    close(true);
  };

  return (
    <div ref={wrapRef} className="vg-agent-scope">
      <button
        ref={triggerRef}
        type="button"
        className="vg-agent-tool"
        data-testid="agent-scope-picker"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        title={value ? `Answers use only: ${label}` : "Answers use all your reports"}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2, strokeLinecap: "square" }} aria-hidden="true">
          <path d="M7 3h8l4 4v14H7z" />
          <path d="M15 3v4h4" />
        </svg>
        <span className="vg-agent-tool-label">Report: {label}</span>
      </button>
      {open ? (
        <div ref={menuRef} role="menu" aria-label="Choose a report" className="vg-agent-popover" onKeyDown={onKeyDown}>
          <button type="button" role="menuitemradio" aria-checked={value === null} tabIndex={-1} className="vg-agent-menu-item" onClick={() => pick(null)}>
            All my reports
          </button>
          {usable.length === 0 ? <div className="vg-agent-menu-info">No finished reports yet.</div> : null}
          {usable.map((r) => (
            <button
              key={r.id}
              type="button"
              role="menuitemradio"
              aria-checked={value === r.id}
              tabIndex={-1}
              className="vg-agent-menu-item"
              title={r.original_filename}
              onClick={() => pick(r.id)}
            >
              <span className="vg-agent-menu-text">{r.original_filename}</span>
              {r.report_date ? <span className="vg-agent-menu-date">{r.report_date}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
