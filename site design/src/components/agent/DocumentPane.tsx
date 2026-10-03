import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BASE_URL } from "../../api/client";
import type { Report } from "../../types";

interface DocumentPaneProps {
  /** null while the list is loading */
  reports: Report[] | null;
  loadError: string | null;
  reportId: string | null;
  page: number;
  onChange: (reportId: string, page: number) => void;
  /** The report the chat is limited to, if any. */
  scopedReportId: string | null;
  onScope: (reportId: string | null) => void;
}

const DPI_FIT = 110;
const DPI_ZOOM = 170;

const navBtn =
  "w-8 h-8 inline-flex items-center justify-center rounded-[var(--r-6)] border border-[var(--line-control)] bg-[var(--ink-800)] text-[var(--bone)] hover:bg-[var(--ink-700)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--focus)]";

export const DocumentPane: React.FC<DocumentPaneProps> = ({ reports, loadError, reportId, page, onChange, scopedReportId, onScope }) => {
  const [zoomed, setZoomed] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Re-uploads of the same file share a hash: list each document once (newest), but never drop the one on screen.
  const ready = React.useMemo(() => {
    const seen = new Set<string>();
    return (reports ?? [])
      .filter((r) => r.status === "ready")
      .sort((a, b) => b.upload_time.localeCompare(a.upload_time))
      .filter((r) => {
        if (r.id === reportId) {
          seen.add(r.file_hash);
          return true;
        }
        if (seen.has(r.file_hash)) return false;
        seen.add(r.file_hash);
        return true;
      });
  }, [reports, reportId]);
  const report = ready.find((r) => r.id === reportId) ?? null;
  const pageCount = Math.max(report?.page_count ?? 1, 1);
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const src = report
    ? `${BASE_URL}/api/reports/${encodeURIComponent(report.id)}/pages/${safePage}/image?dpi=${zoomed ? DPI_ZOOM : DPI_FIT}&r=${attempt}`
    : null;

  // A new page or zoom level is a new image: show the loading state until it arrives.
  useEffect(() => {
    setState("loading");
    scrollRef.current?.scrollTo({ top: 0 });
  }, [src]);

  if (reports === null && !loadError) {
    return (
      <div className="flex-1 grid place-items-center p-6 type-body text-[var(--dim)]" role="status" aria-busy="true">
        Loading your documents
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="m-4 rounded-[var(--r-10)] border border-[var(--madder)] bg-[var(--madder)]/10 p-4 text-[13px] text-[var(--madder)]">
        Could not load your documents: {loadError}
      </div>
    );
  }

  if (ready.length === 0) {
    return (
      <div className="flex-1 grid place-items-center p-6 text-center" data-testid="doc-empty">
        <div>
          <p className="type-card-title text-[16px] m-0">No documents to show yet</p>
          <p className="type-body text-[var(--dim)] mt-2 mb-3 max-w-[32ch] mx-auto">
            Upload a PDF and its pages appear here while you ask about it.
          </p>
          <Link to="/upload" className="text-[13px] text-[var(--link)] underline">
            Go to upload
          </Link>
        </div>
      </div>
    );
  }

  const isScoped = !!report && scopedReportId === report.id;

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-testid="document-pane">
      <div className="flex flex-col gap-2 px-4 pb-3">
        <label className="flex flex-col gap-1">
          <span className="type-label text-[var(--dim)]">Document</span>
          <select
            value={report?.id ?? ""}
            onChange={(e) => onChange(e.target.value, 1)}
            className="h-9 w-full rounded-[var(--r-6)] border border-[var(--line-control)] bg-[var(--ink-800)] px-2 type-body text-[var(--bone)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
            data-testid="doc-select"
          >
            {!report && <option value="">Choose a document</option>}
            {ready.map((r) => (
              <option key={r.id} value={r.id}>
                {r.original_filename}
                {r.report_date ? ` (${r.report_date})` : ""}
              </option>
            ))}
          </select>
        </label>

        {report && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button type="button" className={navBtn} disabled={safePage <= 1} onClick={() => onChange(report.id, safePage - 1)} aria-label="Previous page">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="15 6 9 12 15 18" />
                </svg>
              </button>
              <span className="type-meta min-w-[84px] text-center" aria-live="polite" data-testid="doc-page-label">
                Page {safePage} of {pageCount}
              </span>
              <button type="button" className={navBtn} disabled={safePage >= pageCount} onClick={() => onChange(report.id, safePage + 1)} aria-label="Next page">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              aria-pressed={zoomed}
              className="type-label px-3 h-8 rounded-[var(--r-6)] border border-[var(--line-control)] bg-[var(--ink-800)] text-[var(--bone)] hover:bg-[var(--ink-700)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
            >
              {zoomed ? "Fit to width" : "Zoom in"}
            </button>
          </div>
        )}

        {report && (
          <button
            type="button"
            onClick={() => onScope(isScoped ? null : report.id)}
            className="type-label self-start text-[var(--link)] underline cursor-pointer min-h-[24px]"
            data-testid="doc-scope-toggle"
          >
            {isScoped ? "Answers use only this PDF. Use all my reports" : "Limit answers to this PDF"}
          </button>
        )}
      </div>

      {/* The page itself: a real render of the stored PDF page, on a paper sheet */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto bg-[var(--ink-900)] p-3 border-t border-[var(--chrome-line)]">
        {src && (
          <div className="relative mx-auto" style={{ width: zoomed ? "170%" : "100%" }}>
            {state === "loading" && (
              <div className="absolute inset-0 grid place-items-center bg-[var(--ink-800)] min-h-[320px]" role="status" aria-busy="true">
                <span className="type-body text-[var(--dim)]">Loading page {safePage}</span>
              </div>
            )}
            {state === "failed" ? (
              <div role="alert" className="rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--madder)] p-4 text-[13px] text-[var(--madder)]">
                Could not render page {safePage}.{" "}
                <button type="button" onClick={() => setAttempt((a) => a + 1)} className="underline cursor-pointer">
                  Try again
                </button>
              </div>
            ) : (
              <img
                key={src}
                src={src}
                alt={`${report?.original_filename ?? "Report"}, page ${safePage}`}
                onLoad={() => setState("ready")}
                onError={() => setState("failed")}
                className="block w-full h-auto bg-white shadow-[var(--shadow-3d)]"
                data-testid="doc-page-image"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
