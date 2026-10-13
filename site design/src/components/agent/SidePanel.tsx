import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { agentApi, type ReportSummary, type SavedReport } from "../../api/agent";
import type { ChartSpec } from "../../lib/chartSpec";
import { ConfirmDialog } from "../data/ConfirmDialog";
import { ChartView } from "./ChartView";
import { PageView } from "./PageView";
import { usePreferences } from "../../lib/preferences";
import { reportForDisplay } from "../../lib/displayTheme";

/* ------------------------------------------------------------------ tabs */

export type PanelTab =
  | { key: string; kind: "report"; title: string; reportId: string | null; report?: SavedReport; error?: string }
  | { key: string; kind: "chart"; title: string; spec: ChartSpec }
  | {
      key: string;
      kind: "page";
      title: string;
      reportId: string;
      page: number;
      charStart: number | null;
      charEnd: number | null;
      label?: string;
    }
  | { key: "reports"; kind: "reports"; title: string };

export const REPORTS_TAB_KEY = "reports";
export const reportTabKey = (reportId: string): string => `report:${reportId}`;
export const chartTabKey = (spec: ChartSpec): string => `chart:${JSON.stringify(spec)}`;
export const pageTabKey = (reportId: string, page: number, charStart: number | null, charEnd: number | null): string =>
  `page:${reportId}:${page}:${charStart ?? ""}:${charEnd ?? ""}`;

/** A plain title for a chart tab. */
export function chartTabTitle(spec: ChartSpec): string {
  if (spec.title) return spec.title;
  if (spec.kind === "trend") return `Trend of ${spec.tests.join(", ")}`;
  if (spec.kind === "compare") return `Comparison of ${spec.tests.join(", ")}`;
  return "All values of one report";
}

const KIND_LABEL: Record<PanelTab["kind"], string> = {
  report: "Report",
  chart: "Chart",
  page: "Page",
  reports: "Saved reports",
};

/* ------------------------------------------------------------- the width */

export const PANEL_WIDTH_KEY = "vitagraph_agent_panel_width";
export const PANEL_MIN_WIDTH = 360;
const PANEL_DEFAULT_WIDTH = 520;
const PANEL_KEY_STEP = 24;
/** The chat keeps at least this much room beside the panel. */
const CHAT_MIN_WIDTH = 320;

function readWidth(): number {
  try {
    const raw = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    return Number.isFinite(raw) && raw >= PANEL_MIN_WIDTH ? raw : PANEL_DEFAULT_WIDTH;
  } catch {
    return PANEL_DEFAULT_WIDTH;
  }
}

function storeWidth(width: number): void {
  try {
    localStorage.setItem(PANEL_WIDTH_KEY, String(Math.round(width)));
  } catch {
    /* a blocked store only means the width is not remembered */
  }
}

/* --------------------------------------------------------------- helpers */

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

const Icon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2, strokeLinecap: "square" }} aria-hidden="true">
    {children}
  </svg>
);

/* ----------------------------------------------------------- report tab */

interface ReportTabProps {
  userId: string;
  tab: Extract<PanelTab, { kind: "report" }>;
  cache: React.MutableRefObject<Map<string, SavedReport>>;
  onOpenList: () => void;
}

const ReportTabBody: React.FC<ReportTabProps> = ({ userId, tab, cache, onOpenList }) => {
  const { theme } = usePreferences();
  const reportId = tab.reportId;
  const given = tab.report ?? (reportId ? cache.current.get(reportId) : undefined);
  const [report, setReport] = useState<SavedReport | null>(given ?? null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const previewHtml = useMemo(() => reportForDisplay(report?.html ?? ""), [report?.html]);

  useEffect(() => {
    if (tab.report) {
      cache.current.set(tab.report.id, tab.report);
      setReport(tab.report);
    }
  }, [tab.report, cache]);

  useEffect(() => {
    if (!reportId || report) return;
    let cancelled = false;
    setError(null);
    agentApi
      .getReport(userId, reportId)
      .then((saved) => {
        if (cancelled) return;
        cache.current.set(saved.id, saved);
        setReport(saved);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not open this report.");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reportId, report, cache]);

  const pdfUrl = reportId ? agentApi.reportPdfUrl(userId, reportId) : "";

  // The original PDF opens in its viewer so printing is independent of the screen theme.
  const print = async () => {
    setNote(null);
    // Print the original PDF, never the themed presentation copy.
    if (!pdfUrl) return;
    const opened = window.open("", "_blank");
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error("pdf");
      const blob = new Blob([await response.blob()], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (opened) opened.location.href = url;
      else window.open(url, "_blank");
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch {
      opened?.close();
      setNote("The PDF could not be opened. Press Download PDF and print it from there.");
    }
  };

  const failure = tab.error ?? error;
  if (failure) {
    return (
      <div role="alert" className="vg-agent-note vg-agent-note-error" style={{ margin: "var(--space-4)" }}>
        {failure}
      </div>
    );
  }
  if (!report) {
    return (
      <div role="status" className="vg-agent-note" style={{ padding: "var(--space-6) var(--space-4)" }}>
        {reportId ? "Opening the report…" : "Building the report and its PDF…"}
      </div>
    );
  }
  return (
    <>
      <div className="vg-agent-toolbar">
        <a className="btn btn-primary" data-testid="agent-report-pdf" href={pdfUrl} download>
          Download PDF
        </a>
        <button type="button" className="btn btn-secondary" data-testid="agent-report-print" onClick={() => void print()}>
          Print
        </button>
        <button type="button" className="vg-action" onClick={onOpenList}>
          All reports
        </button>
      </div>
      {note ? (
        <div role="status" className="vg-agent-note" style={{ padding: "0 var(--space-4) var(--space-2)" }}>
          {note}
        </div>
      ) : null}
      {/* Locked down: no scripts, no forms, no popups, no same-origin access. The text is data. */}
      <iframe
        ref={frameRef}
        title="Report preview"
        data-testid="agent-report-frame"
        sandbox=""
        srcDoc={previewHtml}
        style={{ colorScheme: theme }}
        className="vg-agent-frame"
      />
      <div className="vg-agent-foot">Saved {when(report.created_at)}. The PDF is made from this same document.</div>
    </>
  );
};

/* ----------------------------------------------------- saved reports list */

interface ListTabProps {
  userId: string;
  version: number;
  onOpen: (id: string, title: string) => void;
  onDeleted: (id: string) => void;
}

const ReportsListBody: React.FC<ListTabProps> = ({ userId, version, onOpen, onDeleted }) => {
  const [items, setItems] = useState<ReportSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ReportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await agentApi.listReports(userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your saved reports.");
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const doDelete = async () => {
    if (!confirm) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await agentApi.deleteReport(userId, confirm.id);
      setItems((current) => (current ?? []).filter((r) => r.id !== confirm.id));
      onDeleted(confirm.id);
      setConfirm(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete this report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vg-agent-listbody">
      {error ? (
        <div role="alert" className="vg-agent-note vg-agent-note-error">
          {error}{" "}
          <button type="button" className="vg-action" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : items === null ? (
        <div role="status" className="vg-agent-note">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="vg-agent-note" style={{ maxWidth: "46ch" }}>
          No saved reports yet. Ask the AI Agent for a report, or press &ldquo;Save as report&rdquo; under any answer.
        </p>
      ) : (
        items.map((item) => (
          <div key={item.id} data-testid="agent-report-row" className="vg-agent-reportrow">
            <button type="button" className="vg-agent-reportrow-open" onClick={() => onOpen(item.id, item.title)}>
              <span className="vg-agent-reportrow-title">{item.title}</span>
              <span className="vg-agent-reportrow-date">{when(item.created_at)}</span>
            </button>
            <button type="button" className="vg-action" onClick={() => setConfirm(item)} aria-label={`Delete ${item.title}`}>
              Delete
            </button>
          </div>
        ))
      )}
      {confirm ? (
        <ConfirmDialog
          testId="agent-report-confirm"
          title={`Delete "${confirm.title}"?`}
          body="This removes the saved report and its PDF. The chat it came from stays."
          confirmLabel="Delete report"
          busy={busy}
          error={deleteError}
          onConfirm={() => void doDelete()}
          onCancel={() => {
            setConfirm(null);
            setDeleteError(null);
          }}
        />
      ) : null}
    </div>
  );
};

/* ---------------------------------------------------------------- panel */

export interface SidePanelProps {
  userId: string;
  tabs: PanelTab[];
  activeKey: string | null;
  onActivate: (key: string) => void;
  onCloseTab: (key: string) => void;
  /** Hide the whole panel (the tabs stay for next time). */
  onClose: () => void;
  onOpenReport: (reportId: string, title: string) => void;
  onOpenList: () => void;
  /** A saved report was deleted from the list: its tab (if any) should go. */
  onReportDeleted: (reportId: string) => void;
  /** Changes when a report is saved, so the list reloads. */
  reportsVersion: number;
  full: boolean;
  onToggleFull: () => void;
  /** Below 1024 px: always full screen, with "Back to chat". */
  narrow: boolean;
  /** Width the History column takes beside the panel (it is not hidden). */
  reserve: number;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  userId,
  tabs,
  activeKey,
  onActivate,
  onCloseTab,
  onClose,
  onOpenReport,
  onOpenList,
  onReportDeleted,
  reportsVersion,
  full,
  onToggleFull,
  narrow,
  reserve,
}) => {
  const asideRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const reportCache = useRef(new Map<string, SavedReport>());
  const [width, setWidth] = useState<number>(readWidth);
  const [maxWidth, setMaxWidth] = useState<number>(900);
  const [dragging, setDragging] = useState(false);
  const isFull = full || narrow;

  // The room the panel may take: 60 % of the window, and the chat keeps its minimum.
  useLayoutEffect(() => {
    const parent = asideRef.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      const byWindow = Math.floor(window.innerWidth * 0.6);
      const byRoom = parent.clientWidth - reserve - CHAT_MIN_WIDTH;
      setMaxWidth(Math.max(PANEL_MIN_WIDTH, Math.min(byWindow, byRoom)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [reserve]);

  const shownWidth = Math.min(Math.max(width, PANEL_MIN_WIDTH), maxWidth);

  const commit = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, PANEL_MIN_WIDTH), maxWidth);
      setWidth(clamped);
      return clamped;
    },
    [maxWidth]
  );

  const onResizeDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const right = asideRef.current?.getBoundingClientRect().right ?? window.innerWidth;
    commit(right - event.clientX);
  };
  const onResizeUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    storeWidth(shownWidth);
  };
  const onResizeKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = shownWidth + PANEL_KEY_STEP;
    else if (event.key === "ArrowRight") next = shownWidth - PANEL_KEY_STEP;
    else if (event.key === "Home") next = PANEL_MIN_WIDTH;
    else if (event.key === "End") next = maxWidth;
    if (next === null) return;
    event.preventDefault();
    storeWidth(commit(next));
  };

  // Esc leaves full screen (on a narrow screen it goes back to the chat).
  useEffect(() => {
    if (!isFull) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (narrow) onClose();
      else onToggleFull();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFull, narrow, onClose, onToggleFull]);

  // Tabs: arrow keys move between them, Home and End jump, Delete closes.
  const onTabKey = (event: React.KeyboardEvent<HTMLElement>, index: number) => {
    let target = -1;
    if (event.key === "ArrowRight") target = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") target = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = tabs.length - 1;
    else if (event.key === "Delete") {
      event.preventDefault();
      onCloseTab(tabs[index].key);
      return;
    }
    if (target < 0) return;
    event.preventDefault();
    const next = tabs[target];
    onActivate(next.key);
    tabRefs.current.get(next.key)?.focus();
  };

  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0] ?? null;

  const style: React.CSSProperties = isFull ? {} : { width: shownWidth, flex: `0 0 ${shownWidth}px` };

  return (
    <aside
      ref={asideRef}
      data-testid="agent-report-panel"
      aria-label="Side panel"
      className={`vg-agent-panel${isFull ? " is-full" : ""}${dragging ? " is-dragging" : ""}`}
      style={style}
    >
      {!isFull ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the side panel"
          aria-valuemin={PANEL_MIN_WIDTH}
          aria-valuemax={Math.round(maxWidth)}
          aria-valuenow={Math.round(shownWidth)}
          tabIndex={0}
          data-testid="agent-panel-resize"
          className="vg-agent-resize"
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          onPointerCancel={onResizeUp}
          onKeyDown={onResizeKey}
          onDoubleClick={() => storeWidth(commit(PANEL_DEFAULT_WIDTH))}
        />
      ) : null}

      <header className="vg-agent-panel-head">
        {narrow ? (
          <button type="button" className="btn btn-secondary vg-agent-back" data-testid="agent-panel-back" onClick={onClose}>
            <Icon>
              <path d="M19 12H5" />
              <path d="m12 5-7 7 7 7" />
            </Icon>
            Back to chat
          </button>
        ) : null}
        <div role="tablist" aria-label="Open items" className="vg-agent-tabs">
          {tabs.map((tab, index) => {
            const selected = active?.key === tab.key;
            return (
              <div key={tab.key} className={`vg-agent-tab${selected ? " is-active" : ""}`}>
                <button
                  type="button"
                  role="tab"
                  id={`vg-agent-tab-${index}`}
                  aria-selected={selected}
                  aria-controls={`vg-agent-pane-${index}`}
                  tabIndex={selected ? 0 : -1}
                  title={`${KIND_LABEL[tab.kind]}: ${tab.title}`}
                  data-testid="agent-panel-tab"
                  className="vg-agent-tab-btn"
                  ref={(el) => {
                    if (el) tabRefs.current.set(tab.key, el);
                    else tabRefs.current.delete(tab.key);
                  }}
                  onClick={() => onActivate(tab.key)}
                  onKeyDown={(e) => onTabKey(e, index)}
                >
                  <span className="vg-agent-tab-kind">{KIND_LABEL[tab.kind]}</span>
                  <span className="vg-agent-tab-title">{tab.kind === "reports" ? "" : tab.title}</span>
                </button>
                <button
                  type="button"
                  className="vg-agent-tab-x"
                  aria-label={`Close ${KIND_LABEL[tab.kind]}${tab.kind === "reports" ? "" : ` ${tab.title}`}`}
                  data-testid="agent-panel-tab-close"
                  onClick={() => onCloseTab(tab.key)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        <div className="vg-agent-panel-tools">
          {!narrow ? (
            <button
              type="button"
              className="vg-action"
              data-testid="agent-panel-fullscreen"
              aria-pressed={full}
              aria-label={full ? "Leave full screen" : "Full screen"}
              title={full ? "Leave full screen (Esc)" : "Full screen"}
              onClick={onToggleFull}
            >
              <Icon>
                {full ? (
                  <>
                    <path d="M9 4v5H4" />
                    <path d="M15 4v5h5" />
                    <path d="M9 20v-5H4" />
                    <path d="M15 20v-5h5" />
                  </>
                ) : (
                  <>
                    <path d="M4 9V4h5" />
                    <path d="M20 9V4h-5" />
                    <path d="M4 15v5h5" />
                    <path d="M20 15v5h-5" />
                  </>
                )}
              </Icon>
              {full ? "Leave full screen" : "Full screen"}
            </button>
          ) : null}
          {!narrow ? (
            <button type="button" className="vg-action" aria-label="Close panel" data-testid="agent-report-close" onClick={onClose}>
              ×
            </button>
          ) : null}
        </div>
      </header>

      <div className="vg-agent-panel-body">
        {tabs.length === 0 ? (
          <p className="vg-agent-note" style={{ padding: "var(--space-6) var(--space-4)", maxWidth: "46ch" }}>
            Nothing is open. Save an answer as a report, open a chart, or press &ldquo;See it on the page&rdquo; under a source to see it here.
          </p>
        ) : null}
        {tabs.map((tab, index) => {
          const selected = active?.key === tab.key;
          return (
            <div
              key={tab.key}
              role="tabpanel"
              id={`vg-agent-pane-${index}`}
              aria-labelledby={`vg-agent-tab-${index}`}
              className="vg-agent-pane"
              hidden={!selected}
            >
              {tab.kind === "report" ? (
                <ReportTabBody userId={userId} tab={tab} cache={reportCache} onOpenList={onOpenList} />
              ) : tab.kind === "chart" ? (
                <div className="vg-agent-scrollpane">
                  <ChartView userId={userId} spec={tab.spec} />
                </div>
              ) : tab.kind === "page" ? (
                <div className="vg-agent-scrollpane">
                  <PageView userId={userId} reportId={tab.reportId} page={tab.page} charStart={tab.charStart} charEnd={tab.charEnd} label={tab.label} />
                </div>
              ) : (
                <div className="vg-agent-scrollpane">
                  <ReportsListBody
                    userId={userId}
                    version={reportsVersion}
                    onOpen={onOpenReport}
                    onDeleted={(id) => {
                      reportCache.current.delete(id);
                      onReportDeleted(id);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
