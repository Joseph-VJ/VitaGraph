import React, { useState, useEffect, useRef } from "react";
import { IconButton, Button, Badge } from "./index";
import { reportsApi } from "../../api/reports";
import type { EvidenceCard, ReportPage } from "../../types";
import { governor } from "../../motion/quality";
import { isReducedMotion } from "../../motion/features";
import { Odometer } from "../../motion/fx/Odometer";

export interface EvidenceSpanViewerProps {
  evidence: EvidenceCard | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EvidenceSpanViewer: React.FC<EvidenceSpanViewerProps> = ({
  evidence,
  isOpen,
  onClose,
}) => {
  const [pages, setPages] = useState<ReportPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [isRetracting, setIsRetracting] = useState<boolean>(false);

  const highlightRef = useRef<HTMLElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const isT0 = isReducedMotion() || governor.getState().tier === "T0";

  // Fetch report pages when evidence card changes
  useEffect(() => {
    if (!isOpen || !evidence?.report_id) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    reportsApi
      .pages(evidence.report_id)
      .then((data) => {
        if (!isMounted) return;
        setPages(data);

        // Find page index matching evidence.page_number (1-indexed)
        const targetPageNum = evidence.page_number || 1;
        const pageIdx = data.findIndex((p) => p.page_number === targetPageNum);
        setCurrentPageIndex(pageIdx >= 0 ? pageIdx : 0);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load report pages.");
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, evidence?.report_id, evidence?.page_number]);

  // Handle graceful close with reverse morph and T3 bracket retraction (§M7.6)
  const handleClose = () => {
    if (isClosing) return;
    const tier = governor.getState().tier;
    if (tier === "T3" && !isReducedMotion()) {
      setIsRetracting(true);
      setTimeout(() => {
        setIsClosing(true);
        setTimeout(() => {
          onClose();
          setIsClosing(false);
          setIsRetracting(false);
        }, 288); // 60% of 480ms (--m-settle) = 288ms
      }, 168); // retract duration 168ms
    } else if (tier !== "T0" && !isReducedMotion()) {
      setIsClosing(true);
      setTimeout(() => {
        onClose();
        setIsClosing(false);
      }, 288);
    } else {
      onClose();
    }
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Smooth scroll to highlight once rendered
  useEffect(() => {
    if (highlightRef.current && scrollContainerRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [currentPageIndex, pages, isLoading]);

  if (!isOpen || !evidence) return null;

  const activePage = pages[currentPageIndex] || null;
  const pageText = activePage?.extracted_text || "";

  // Compute character spans:
  // Use explicit char_start & char_end when available; otherwise locate snippet within pageText.
  let charStart = evidence.char_start ?? -1;
  let charEnd = evidence.char_end ?? -1;

  if ((charStart < 0 || charEnd < 0) && pageText && evidence.snippet) {
    const cleanSnippet = evidence.snippet.trim();
    // Search first 50 chars for robust matching
    const sample = cleanSnippet.slice(0, Math.min(50, cleanSnippet.length));
    const foundIdx = pageText.indexOf(sample);
    if (foundIdx >= 0) {
      charStart = foundIdx;
      charEnd = Math.min(pageText.length, foundIdx + cleanSnippet.length);
    }
  }

  const isValidSpan =
    charStart >= 0 &&
    charEnd > charStart &&
    charStart < pageText.length;

  const textBefore = isValidSpan ? pageText.slice(0, charStart) : "";
  const highlightedSpan = isValidSpan
    ? pageText.slice(charStart, Math.min(pageText.length, charEnd))
    : evidence.snippet;
  const textAfter = isValidSpan ? pageText.slice(charEnd) : pageText;

  // Verify whether highlight text matches evidence snippet
  const isExactMatch =
    isValidSpan &&
    (highlightedSpan.trim() === evidence.snippet.trim() ||
      highlightedSpan.includes(evidence.snippet.trim()) ||
      evidence.snippet.trim().includes(highlightedSpan.trim()));

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(evidence.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-modal-title"
    >
      <div
        ref={sheetRef}
        style={{
          viewTransitionName: evidence.chunk_id ? `ev-${evidence.chunk_id}` : undefined,
        }}
        className={`max-w-5xl w-full max-h-[92vh] flex flex-col rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] shadow-2xl overflow-hidden ${
          isClosing ? "animate-sheet-close" : "animate-sheet-settle"
        }`}
      >
        {/* Header Bar (§9.8, §M4.3) */}
        <div
          style={{
            viewTransitionName: !isT0 ? "timeline-report" : undefined,
          }}
          className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--line-strong)] bg-[var(--ink-850,var(--ink-800))]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-[var(--r-6)] bg-[var(--ink-700)] border border-[var(--line-strong)] flex items-center justify-center text-[var(--bone)] flex-shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3
                  id="evidence-modal-title"
                  className="font-['Spectral'] text-[17px] font-semibold text-[var(--bone)] truncate"
                >
                  {evidence.report_filename}
                </h3>
                <Badge variant="answered">evidence span</Badge>
              </div>
              <div className="flex items-center gap-2 type-meta text-[var(--dim)] text-[12px] mt-0.5">
                <span>Page {evidence.page_number} of {pages.length || 1}</span>
                <span>•</span>
                <span className="type-mono-sm text-[var(--bone)]">
                  char_start:{" "}
                  {charStart >= 0 ? (
                    <Odometer
                      value={charStart}
                      duration={180}
                      testId="odo-char-start-hdr"
                    />
                  ) : (
                    "—"
                  )}{" "}
                  · char_end:{" "}
                  {charEnd >= 0 ? (
                    <Odometer
                      value={charEnd}
                      duration={180}
                      testId="odo-char-end-hdr"
                    />
                  ) : (
                    "—"
                  )}
                </span>
                <span>•</span>
                <span>{activePage?.extraction_method || "native"} extraction</span>
              </div>
            </div>
          </div>

          <IconButton
            size={28}
            title="Close evidence viewer (Esc)"
            onClick={handleClose}
            className="border-transparent bg-transparent hover:bg-[var(--ink-700)] text-[var(--dim)]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </IconButton>
        </div>

        {/* Modal Main Body: Split Grid (§9.8 PDF sheet + chunk card) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[var(--line-strong)]">
          {/* Main Area: Extracted Page Text (PDF Sheet) */}
          <div className="lg:col-span-8 flex flex-col min-h-0 bg-[var(--ink-900)]">
            {/* Sheet Control Bar */}
            <div className="flex items-center justify-between px-5 py-2.5 bg-[var(--ink-800)] border-b border-[var(--line-faint)]">
              <div className="flex items-center gap-2">
                <span className="type-label text-[12px] text-[var(--dim)]">Source endpoint:</span>
                <code className="type-mono-sm text-[11.5px] px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-700)] text-[var(--bone)]">
                  /api/reports/{evidence.report_id}/pages
                </code>
              </div>

              {pages.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPageIndex <= 0}
                    onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                    className="px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-700)] border border-[var(--line-strong)] hover:text-[var(--bone)] text-[var(--dim)] type-mono-sm text-[11px] disabled:opacity-40 cursor-pointer"
                  >
                    Prev
                  </button>
                  <span className="type-mono-sm text-[11.5px] text-[var(--dim)] px-1">
                    {currentPageIndex + 1} / {pages.length}
                  </span>
                  <button
                    disabled={currentPageIndex >= pages.length - 1}
                    onClick={() => setCurrentPageIndex((p) => Math.min(pages.length - 1, p + 1))}
                    className="px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-700)] border border-[var(--line-strong)] hover:text-[var(--bone)] text-[var(--dim)] type-mono-sm text-[11px] disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable PDF Sheet View */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto p-5 sm:p-6 bg-[var(--ink-900)] flex justify-center"
            >
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--dim)]">
                  <span className="w-5 h-5 rounded-full border-2 border-[var(--verdigris)] border-t-transparent animate-spin" />
                  <span className="type-mono-sm text-[12px]">Loading extracted page provenance...</span>
                </div>
              ) : error ? (
                <div className="p-4 rounded-[var(--r-6)] bg-[var(--madder)]/10 border border-[var(--madder)] text-[var(--madder)] type-body text-[13px] my-auto max-w-md text-center">
                  {error}
                </div>
              ) : (
                <div className="w-full max-w-2xl bg-[var(--paper)] text-[var(--paper-ink)] rounded-[var(--r-6)] p-6 sm:p-8 paper-slip-grain shadow-md border border-[var(--paper-fold)] select-text">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-[rgba(42,38,32,0.14)] text-[12px]">
                    <span className="font-['IBM_Plex_Sans'] font-medium text-[rgba(42,38,32,0.65)] uppercase tracking-wider text-[10px]">
                      Extracted Laboratory Text — Page {activePage?.page_number || 1}
                    </span>
                    <span className="type-mono-sm text-[rgba(42,38,32,0.65)]">
                      {activePage?.text_length || pageText.length} characters
                    </span>
                  </div>

                  {/* Verbatim Page Text with Verdigris Bounding Box Highlight (§9.8, §M7.6) */}
                  <div className="font-mono text-[13px] leading-[22px] whitespace-pre-wrap">
                    {isValidSpan ? (
                      <>
                        <span>{textBefore}</span>
                        <span
                          className="relative inline-block my-0.5 px-1.5 py-0.5"
                          data-testid="evidence-highlight-container"
                        >
                          {/* 4 Clockwise Corner Brackets (§M7.6: verdigris, 60ms stagger, 280ms each) */}
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            data-testid="evidence-corner-brackets"
                          >
                            {/* 1. Top-Left: clockwise #1 */}
                            <path
                              d="M 0,14 L 0,0 L 14,0"
                              vectorEffect="non-scaling-stroke"
                              fill="none"
                              stroke="var(--verdigris)"
                              strokeWidth="2.5"
                              strokeDasharray="24"
                              className={isRetracting ? "animate-bracket-retract" : "animate-bracket-draw"}
                              style={{ animationDelay: isRetracting ? "0ms" : "120ms" }}
                            />
                            {/* 2. Top-Right: clockwise #2 */}
                            <path
                              d="M 86,0 L 100,0 L 100,14"
                              vectorEffect="non-scaling-stroke"
                              fill="none"
                              stroke="var(--verdigris)"
                              strokeWidth="2.5"
                              strokeDasharray="24"
                              className={isRetracting ? "animate-bracket-retract" : "animate-bracket-draw"}
                              style={{ animationDelay: isRetracting ? "0ms" : "180ms" }}
                            />
                            {/* 3. Bottom-Right: clockwise #3 */}
                            <path
                              d="M 100,86 L 100,100 L 86,100"
                              vectorEffect="non-scaling-stroke"
                              fill="none"
                              stroke="var(--verdigris)"
                              strokeWidth="2.5"
                              strokeDasharray="24"
                              className={isRetracting ? "animate-bracket-retract" : "animate-bracket-draw"}
                              style={{ animationDelay: isRetracting ? "0ms" : "240ms" }}
                            />
                            {/* 4. Bottom-Left: clockwise #4 */}
                            <path
                              d="M 14,100 L 0,100 L 0,86"
                              vectorEffect="non-scaling-stroke"
                              fill="none"
                              stroke="var(--verdigris)"
                              strokeWidth="2.5"
                              strokeDasharray="24"
                              className={isRetracting ? "animate-bracket-retract" : "animate-bracket-draw"}
                              style={{ animationDelay: isRetracting ? "0ms" : "300ms" }}
                            />
                          </svg>

                          {/* Interior Wash: fades to 10% verdigris and holds (§M7.6) */}
                          <span
                            data-testid="evidence-interior-wash"
                            className={`absolute inset-0 rounded-[var(--r-4)] pointer-events-none ${
                              isReducedMotion() || governor.getState().tier === "T0"
                                ? "bg-[rgba(121,184,166,0.10)]"
                                : "animate-wash-hold"
                            }`}
                            style={{ animationDelay: "360ms" }}
                          />

                          <mark
                            ref={highlightRef}
                            id="evidence-highlight"
                            data-testid="evidence-highlight"
                            className="bg-transparent text-[var(--paper-ink)] font-semibold relative z-10"
                          >
                            {highlightedSpan}
                          </mark>
                        </span>
                        <span>{textAfter}</span>
                      </>
                    ) : (
                      <mark
                        ref={highlightRef}
                        id="evidence-highlight"
                        data-testid="evidence-highlight"
                        className="bg-[rgba(63,185,80,0.22)] border-2 border-[var(--verdigris)] text-[var(--paper-ink)] font-semibold rounded-[var(--r-4)] px-1 py-0.5 shadow-sm inline"
                      >
                        {highlightedSpan}
                      </mark>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Rail: Chunk Provenance Card (340px) */}
          <div className="lg:col-span-4 p-5 flex flex-col justify-between bg-[var(--ink-800)] gap-5 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="type-card-title text-[14px] text-[var(--bone)]">
                  Chunk Provenance
                </h4>
                <span className="type-mono-sm text-[var(--verdigris)] font-semibold">
                  {(evidence.score * 100).toFixed(0)}% match
                </span>
              </div>

              {/* Chunk ID & Metadata */}
              <div className="p-3 rounded-[var(--r-6)] bg-[var(--ink-700)]/50 border border-[var(--line-strong)] space-y-2">
                <div className="flex items-center justify-between type-mono-sm text-[12px]">
                  <span className="text-[var(--dim)]">Chunk ID</span>
                  <span className="text-[var(--bone)] font-medium select-all">
                    {evidence.chunk_id}
                  </span>
                </div>
                <div className="flex items-center justify-between type-mono-sm text-[12px]">
                  <span className="text-[var(--dim)]">Character span</span>
                  <span className="text-[var(--bone)]">
                    {charStart >= 0 && charEnd >= 0 ? (
                      <>
                        <Odometer
                          value={charStart}
                          duration={180}
                          testId="odo-char-start-card"
                        />
                        –
                        <Odometer
                          value={charEnd}
                          duration={180}
                          testId="odo-char-end-card"
                        />
                      </>
                    ) : (
                      "Full chunk"
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between type-mono-sm text-[12px]">
                  <span className="text-[var(--dim)]">Span length</span>
                  <span className="text-[var(--bone)]">
                    {charStart >= 0 && charEnd >= 0 ? `${charEnd - charStart} chars` : `${evidence.snippet.length} chars`}
                  </span>
                </div>
              </div>

              {/* Exact Snippet Match Verification Badge */}
              <div className="p-3 rounded-[var(--r-6)] bg-[var(--verdigris)]/10 border border-[var(--verdigris)]/30 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[var(--verdigris)] mt-1.5 flex-shrink-0" />
                <div>
                  <div className="type-body text-[12.5px] font-medium text-[var(--bone)]">
                    {isExactMatch ? "Highlight matches snippet" : "Span verified in document"}
                  </div>
                  <div className="type-meta text-[11px] text-[var(--dim)] mt-0.5">
                    Character offsets match extracted report text from SQLite database and vector index.
                  </div>
                </div>
              </div>

              {/* Quoted Snippet Box */}
              <div>
                <div className="type-meta text-[var(--dim)] text-[11.5px] mb-1.5 flex items-center justify-between">
                  <span>Quoted snippet</span>
                  <button
                    onClick={handleCopySnippet}
                    className="type-mono-sm text-[11px] text-[var(--dim)] hover:text-[var(--bone)] underline cursor-pointer"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="p-3.5 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-strong)]">
                  <blockquote className="font-['Spectral'] italic text-[13.5px] leading-[20px] text-[var(--bone)]">
                    “{evidence.snippet}”
                  </blockquote>
                </div>
              </div>

              {/* Clinical boundary / provenance footnote */}
              <div className="pt-2 border-t border-[var(--line-faint)]">
                <p className="type-meta text-[var(--dim)] text-[11.5px] leading-[17px]">
                  VitaGraph preserves character-accurate spans to ensure non-hallucinated citation trails. All evidence is scoped strictly to user consent boundaries.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-[var(--line-strong)] flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={handleCopySnippet}
                className="h-8 px-3 text-[12px]"
              >
                {copied ? "Copied" : "Copy snippet"}
              </Button>
              <Button
                variant="primary"
                onClick={handleClose}
                className="h-8 px-4 text-[12px]"
              >
                Done inspecting
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
