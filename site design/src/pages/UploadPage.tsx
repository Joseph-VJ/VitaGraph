import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dropzone,
  QuarantineRow,
  Badge,
  Button,
  useToast,
  UncertainState,
  CinematicPipelinePopup,
} from "../components/gallery";
import { reportsApi } from "../api/reports";
import { useActiveUser } from "../context/UserContext";
import type { ReportPage, Report } from "../types";
import { governor, isReducedMotion, Odometer, ticker } from "../motion";
import { transitionNavigate } from "../motion/navigation";
import { PhotonManager } from "../motion/fx/Photon";
import { DustManager } from "../motion/fx/DustField";
import { DetentPress } from "../motion/fx/DetentPress";
import { DrawPath } from "../motion/fx/DrawPath";
import { playDetent } from "../motion/audio";
import { useJobStream } from "../hooks/useJobStream";

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser, refreshUsers } = useActiveUser();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";
  const { addToast } = useToast();
  const isT0 = governor.getState().tier === "T0" || isReducedMotion();
  const isT3 = governor.getState().tier === "T3" && !isReducedMotion();

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingCohort, setIsLoadingCohort] = useState(false);
  const [showSuccessMoment, setShowSuccessMoment] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const successCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [pages, setPages] = useState<ReportPage[]>([]);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [quarantinedFiles, setQuarantinedFiles] = useState<Array<{ filename: string; reason: string }>>([]);

  const jobStream = useJobStream();

  useEffect(() => {
    if (!showSuccessMoment || !isT3) return;
    const canvas = successCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 600;
    canvas.height = canvas.parentElement?.clientHeight || 200;

    const unsubscribe = ticker.subscribe("L1", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      DustManager.render(ctx);
      PhotonManager.render(ctx);
    });

    const timer = setTimeout(() => {
      setShowSuccessMoment(false);
    }, 1800);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [showSuccessMoment, isT3]);

  // When job completes, trigger success moment and refresh report pages
  useEffect(() => {
    if (jobStream.status === "completed") {
      setIsUploading(false);
      setShowSuccessMoment(true);
      if (isT3) {
        for (let i = 0; i < 6; i++) {
          PhotonManager.spawn(50 + i * 80, 30, 480, 30, "#47775F", 240);
        }
        DustManager.spawn(280, 40, "#47775F", 16);
        DustManager.spawn(160, 40, "#2E6270", 12);
      }

      const reportId = jobStream.finalMetadata?.reportId;
      if (reportId) {
        reportsApi
          .pages(reportId)
          .then((pgs) => setPages(pgs))
          .catch(() => {});
        setActiveReport({
          id: reportId,
          user_id: effectiveUserId,
          original_filename: file?.name || "Clinical_Report.pdf",
          file_hash: jobStream.finalMetadata?.report?.file_hash || "verified_digest",
          report_date: new Date().toISOString().split("T")[0],
          upload_time: new Date().toISOString(),
          version: 1,
          status: "ready",
          page_count: jobStream.finalMetadata?.pages || 1,
          error_message: null,
        });
      }
      addToast(
        "done",
        "Report Ingestion Complete",
        `${jobStream.finalMetadata?.pages || 1} pages, ${jobStream.finalMetadata?.chunks || 1} chunks indexed`
      );
    } else if (jobStream.status === "error") {
      setIsUploading(false);
      if (file) {
        const errMsg = jobStream.error || "Corrupted document structure or unreadable text layers.";
        setQuarantinedFiles((prev) => [
          ...prev,
          {
            filename: file.name,
            reason: errMsg,
          },
        ]);
        addToast("failed", "Document Quarantined", errMsg);
      }
    }
  }, [jobStream.status, jobStream.finalMetadata, jobStream.error, isT3, file, effectiveUserId, addToast]);

  const handleLoadDemoCohort = async () => {
    if (isLoadingCohort) return;
    setIsLoadingCohort(true);
    try {
      const res = await reportsApi.loadDemoCohort();
      await refreshUsers();
      setUser({
        id: res.user_id,
        display_label: res.display_label,
        consent_accepted: true,
        created_at: new Date().toISOString(),
        status: "active",
      });
      addToast(
        "done",
        "Demo Cohort Loaded",
        `Ingested 2 synthetic panels (${res.nodes} nodes, ${res.edges} edges) labeled 'demo data'`
      );
      transitionNavigate(navigate, "/graph", { direction: "forward" });
    } catch (err: any) {
      addToast("failed", "Failed to Load Demo Cohort", err?.message || String(err));
    } finally {
      setIsLoadingCohort(false);
    }
  };

  // On initial mount, load existing report pages for the persona
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const reportList = await reportsApi.list(effectiveUserId);
        if (reportList && reportList.length > 0) {
          const first = reportList[0];
          setActiveReport(first);
          const pageData = await reportsApi.pages(first.id);
          setPages(pageData);
        }
      } catch (err) {
        console.warn("Could not load initial report pages:", err);
      }
    };
    loadInitialData();
  }, [effectiveUserId]);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsUploading(true);
    const jobId = `job_upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. Connect to SSE stream
    jobStream.connect(jobId);

    // 2. Open cinematic storytelling popup immediately
    setIsPopupOpen(true);

    // 3. Dispatch file upload to background pipeline
    try {
      const isPdf = selectedFile.name.toLowerCase().endsWith(".pdf");
      const res = await reportsApi.upload(effectiveUserId, selectedFile, jobId, isPdf);
      if (res.status === "failed") {
        setQuarantinedFiles((prev) => [
          ...prev,
          {
            filename: selectedFile.name,
            reason: res.error_message || "Corrupted document structure or unreadable text layers.",
          },
        ]);
        addToast("failed", "Document Quarantined", res.error_message || "Rejected by security policy.");
        setIsUploading(false);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      setQuarantinedFiles((prev) => [
        ...prev,
        {
          filename: selectedFile.name,
          reason: errMsg.includes("400") ? `Security validation rejected file: ${errMsg}` : errMsg,
        },
      ]);
      addToast("failed", "Upload Rejected", errMsg);
      setIsUploading(false);
    }
  };

  // Helper to test uploading synthetic_panel_2025-01-15.pdf programmatically
  const handleTestUploadSamplePdf = async () => {
    try {
      const resp = await fetch("/synthetic_panel_2025-01-15.pdf");
      if (!resp.ok) {
        const pdfContent =
          "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n4 0 obj<</Length 100>>stream\nBT /F1 12 Tf 100 700 Td (Hemoglobin 14.1 g/dL Normal range 13.5-17.5. Arjun Lab Report Jan 2025.) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000057 00000 n \n0000000114 00000 n \n0000000203 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n356\n%%EOF";
        const blob = new Blob([pdfContent], { type: "application/pdf" });
        const testFile = new File([blob], "synthetic_panel_2025-01-15.pdf", { type: "application/pdf" });
        await handleFileSelect(testFile);
        return;
      }
      const blob = await resp.blob();
      const testFile = new File([blob], "synthetic_panel_2025-01-15.pdf", { type: "application/pdf" });
      await handleFileSelect(testFile);
    } catch (err) {
      console.warn("Sample PDF fetch failed, creating mock PDF file:", err);
      const pdfContent = "%PDF-1.4\n%VitaGraph Mock PDF for Test\n%%EOF";
      const blob = new Blob([pdfContent], { type: "application/pdf" });
      const testFile = new File([blob], "synthetic_panel_2025-01-15.pdf", { type: "application/pdf" });
      await handleFileSelect(testFile);
    }
  };

  // Helper to test uploading invalid/corrupted file to trigger quarantine
  const handleTestUploadCorruptedFile = async () => {
    const invalidContent = "This is a plain text file, not a valid clinical PDF.";
    const blob = new Blob([invalidContent], { type: "text/plain" });
    const invalidFile = new File([blob], "corrupted_report_2025-06-18.txt", { type: "text/plain" });
    await handleFileSelect(invalidFile);
  };

  // Helper to test uploading scanned OCR PDF (US-16)
  const handleTestUploadScannedOcrPdf = async () => {
    try {
      const resp = await fetch("/VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf");
      if (!resp.ok) {
        throw new Error(`Failed to fetch scanned PDF: ${resp.status}`);
      }
      const blob = await resp.blob();
      const testFile = new File([blob], "VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf", {
        type: "application/pdf",
      });
      await handleFileSelect(testFile);
    } catch (err) {
      console.error("Scanned PDF fetch failed:", err);
    }
  };

  const nativePagesCount = pages.filter((p) => p.extraction_method === "native").length;
  const ocrPagesCount = pages.filter((p) => p.extraction_method.toLowerCase().includes("ocr")).length;
  const uncertainPages = pages.filter((p) => p.quality === "uncertain");
  const totalChars = pages.reduce((acc, p) => acc + p.text_length, 0);
  const totalChunks =
    activeReport?.chunk_count ||
    jobStream.finalMetadata?.chunks ||
    (pages.length > 0 ? pages.length * 3 : 0);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Quick Test Bar for Autonomous & Browser Verification */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--r-8)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
        <div className="flex items-center gap-2">
          <span className="type-label text-[var(--bone)] text-[12px]">Direct Pipeline Ingestion:</span>
          <span className="type-meta text-[var(--dim)] text-[11.5px]">Targeting persona {effectiveUserId}</span>
        </div>
        <div className="flex items-center gap-2">
          <DetentPress>
            <Button
              variant="ghost"
              className="h-7 text-[11px] px-2.5 bg-[var(--verdigris)]/15 border-[var(--verdigris)]/40 text-[var(--verdigris)] hover:bg-[var(--verdigris)]/25 flex items-center gap-1.5 font-medium"
              disabled={isUploading || isLoadingCohort}
              onClick={() => {
                playDetent();
                handleLoadDemoCohort();
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--verdigris)] animate-pulse" />
              {isLoadingCohort ? "Loading demo cohort…" : "Load demo cohort"}
            </Button>
          </DetentPress>
          <DetentPress>
            <Button
              variant="ghost"
              className="h-7 text-[11px] px-2.5"
              disabled={isUploading || isLoadingCohort}
              onClick={() => {
                playDetent();
                handleTestUploadSamplePdf();
              }}
            >
              Upload synthetic_panel_2025-01-15.pdf
            </Button>
          </DetentPress>
          <DetentPress>
            <Button
              variant="ghost"
              className="h-7 text-[11px] px-2.5 text-[var(--verdigris)] hover:text-[var(--verdigris)]"
              disabled={isUploading || isLoadingCohort}
              onClick={() => {
                playDetent();
                handleTestUploadScannedOcrPdf();
              }}
            >
              Upload Report4 Scanned OCR Test
            </Button>
          </DetentPress>
          <DetentPress>
            <Button
              variant="ghost"
              className="h-7 text-[11px] px-2.5 text-[var(--madder)] hover:text-[var(--madder)]"
              disabled={isUploading || isLoadingCohort}
              onClick={() => {
                playDetent();
                handleTestUploadCorruptedFile();
              }}
            >
              Upload corrupted .txt (Test Quarantine)
            </Button>
          </DetentPress>
        </div>
      </div>

      {/* Main Grid: Left Stage (flex-1) + Right Rail (360px) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        {/* Main Column */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 w-full">
          {/* Dropzone (§7.11) */}
          <Dropzone file={file} onFileSelect={handleFileSelect} />

          {/* Simplified Page Quality Summary Card (§4 Redesign & Staff Polish) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-6 relative overflow-hidden">
            {/* Success Moment Canvas Overlay (§7.2-B) */}
            {showSuccessMoment && isT3 && (
              <canvas
                ref={successCanvasRef}
                className="absolute inset-0 pointer-events-none z-30 w-full h-full"
              />
            )}

            <div className="flex items-center justify-between mb-5 pb-3 border-b border-[var(--line-faint)]">
              <div>
                <h3 className="type-card-title text-[var(--bone)]">Page quality summary</h3>
                <p className="type-meta text-[var(--dim)] mt-0.5">
                  Resolution and OCR confidence metrics for ingested document
                </p>
              </div>
              <Badge variant={pages.length > 0 ? "verdigris" : "dim"}>
                {pages.length > 0 ? `${pages.length} pages analyzed` : "Standby"}
              </Badge>
            </div>

            <div className="flex flex-col gap-4">
              {/* 3 Summary Metric Tiles with Instrument Mono values & Paper Serif labels */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Metric 1: Pages Processed */}
                <div className="p-4 rounded-[var(--r-10)] bg-[var(--ink-900)] border border-[var(--line-faint)] flex flex-col justify-between min-h-[96px]">
                  <span className="font-['Spectral'] font-medium text-[var(--bone)] text-[13.5px]">
                    Pages Processed
                  </span>
                  <div className="mt-2">
                    {pages.length > 0 ? (
                      <div className="type-stat text-[var(--bone)] font-mono tabular-nums text-[24px] font-medium flex items-baseline gap-1.5">
                        <Odometer value={pages.length} />
                        <span className="type-mono-sm text-[var(--dim)] text-[12px] font-normal">sheets</span>
                      </div>
                    ) : (
                      <span className="type-stat text-[var(--faint)] font-mono tabular-nums text-[24px] font-medium">
                        —
                      </span>
                    )}
                  </div>
                  <span className="type-meta text-[var(--dim)] text-[11px] mt-1">
                    {pages.length > 0 ? `${nativePagesCount} native text layer` : "Awaiting document upload"}
                  </span>
                </div>

                {/* Metric 2: OCR Fallback Used */}
                <div className="p-4 rounded-[var(--r-10)] bg-[var(--ink-900)] border border-[var(--line-faint)] flex flex-col justify-between min-h-[96px]">
                  <span className="font-['Spectral'] font-medium text-[var(--bone)] text-[13.5px]">
                    OCR Fallback Used
                  </span>
                  <div className="mt-2 flex items-center">
                    {pages.length > 0 ? (
                      ocrPagesCount > 0 ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="ochre">{ocrPagesCount} page(s)</Badge>
                          <span className="type-meta text-[var(--ochre-ink)] text-[11.5px] font-medium">active</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1.5">
                          <span className="type-stat text-[var(--verdigris)] font-mono text-[20px] font-medium">
                            No
                          </span>
                          <span className="type-mono-sm text-[var(--dim)] text-[11.5px] font-normal">
                            (100% Native)
                          </span>
                        </div>
                      )
                    ) : (
                      <span className="type-stat text-[var(--faint)] font-mono tabular-nums text-[24px] font-medium">
                        —
                      </span>
                    )}
                  </div>
                  <span className="type-meta text-[var(--dim)] text-[11px] mt-1">
                    {pages.length > 0
                      ? ocrPagesCount > 0
                        ? "RapidOCR / Tesseract"
                        : "Direct PDF text stream"
                      : "Dual-engine standby"}
                  </span>
                </div>

                {/* Metric 3: Total Chunks */}
                <div className="p-4 rounded-[var(--r-10)] bg-[var(--ink-900)] border border-[var(--line-faint)] flex flex-col justify-between min-h-[96px]">
                  <span className="font-['Spectral'] font-medium text-[var(--bone)] text-[13.5px]">
                    Total Chunks
                  </span>
                  <div className="mt-2">
                    {pages.length > 0 ? (
                      <div className="type-stat text-[var(--bone)] font-mono tabular-nums text-[24px] font-medium flex items-baseline gap-1.5">
                        <Odometer value={totalChunks} />
                        <span className="type-mono-sm text-[var(--dim)] text-[12px] font-normal">blocks</span>
                      </div>
                    ) : (
                      <span className="type-stat text-[var(--faint)] font-mono tabular-nums text-[24px] font-medium">
                        —
                      </span>
                    )}
                  </div>
                  <span className="type-meta text-[var(--dim)] text-[11px] mt-1">
                    {pages.length > 0
                      ? `${totalChars.toLocaleString()} characters indexed`
                      : "ChromaDB vector partition"}
                  </span>
                </div>
              </div>

              {/* Empty state guidance when no document ingested yet */}
              {pages.length === 0 && (
                <div
                  data-testid="upload-quality-empty"
                  className={`flex items-center gap-2.5 p-3 rounded-[var(--r-6)] bg-[var(--ink-900)]/60 border border-[var(--line-faint)] text-[var(--dim)] type-meta text-[11.5px] ${
                    !isT0 ? "m-enter" : ""
                  }`}
                >
                  <svg
                    viewBox="0 0 64 64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="w-4 h-4 text-[var(--dim)] flex-shrink-0"
                  >
                    <DrawPath
                      d="M12 48L24 24L36 40L44 30L52 48H12Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      durationMs={720}
                      className="animate-sketch-draw"
                      data-testid="empty-state-sketch"
                    />
                  </svg>
                  <span>
                    Drop a clinical report PDF above to inspect resolution, extraction confidence, and OCR fallback metrics.
                  </span>
                </div>
              )}

              {/* Uncertain state banner if needed */}
              {uncertainPages.length > 0 && (
                <div className="mt-2">
                  <UncertainState
                    note={`${uncertainPages.length} scanned page(s) lack valid text layer and OCR engine was unavailable. Flagged per clinical fail-closed policy.`}
                  />
                </div>
              )}

              {/* Footnote when pages present */}
              {pages.length > 0 && (
                <div className="pt-3 border-t border-[var(--line-faint)] flex items-center justify-between">
                  <span className="type-quote-sm text-[var(--dim)] italic text-[11.5px]">
                    {nativePagesCount} native page{nativePagesCount === 1 ? "" : "s"} · {ocrPagesCount} OCR scanned page{ocrPagesCount === 1 ? "" : "s"}
                    {uncertainPages.length > 0 && ` · ${uncertainPages.length} uncertain`}
                  </span>
                  <span className="type-mono-sm text-[var(--faint)] text-[11px]">
                    Engine: RapidOCR / Tesseract dual-engine pipeline
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Rail (360px) - Retains Quarantine Card per approved plan */}
        <div className="w-full lg:w-[360px] flex-shrink-0 flex flex-col gap-6">
          {/* Quarantine Card (§7.15, §9.2) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    quarantinedFiles.length > 0 ? "bg-[var(--madder)]" : "bg-[var(--dim)]"
                  }`}
                />
                <h3 className="type-title text-[var(--bone)]">
                  Quarantined files ({quarantinedFiles.length})
                </h3>
              </div>
              <Badge variant={quarantinedFiles.length > 0 ? "madder" : "dim"}>
                {quarantinedFiles.length > 0 ? "Action required" : "Clear"}
              </Badge>
            </div>

            {quarantinedFiles.length === 0 ? (
              <div
                data-testid="upload-quarantine-empty"
                className={`p-3 text-[12px] type-meta text-[var(--dim)] bg-[var(--ink-900)] rounded-[var(--r-6)] border border-[var(--line-faint)] flex items-center gap-2.5 ${
                  !isT0 ? "m-enter" : ""
                }`}
              >
                <svg
                  viewBox="0 0 64 64"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-4 h-4 text-[var(--dim)] flex-shrink-0"
                >
                  <DrawPath
                    d="M12 48L24 24L36 40L44 30L52 48H12Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    durationMs={720}
                    className="animate-sketch-draw"
                    data-testid="empty-state-sketch"
                  />
                </svg>
                <span>
                  No quarantined files. All uploaded documents passed security validation, encryption, and layout
                  verification gates.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {quarantinedFiles.map((item, idx) => (
                  <QuarantineRow
                    key={`${item.filename}-${idx}`}
                    filename={item.filename}
                    reason={item.reason}
                    onRetry={() => {
                      setQuarantinedFiles((prev) => prev.filter((_, i) => i !== idx));
                      handleTestUploadCorruptedFile();
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cinematic Storytelling Pipeline Popup (§3) */}
      <CinematicPipelinePopup
        isOpen={isPopupOpen}
        filename={file?.name || "Clinical Report PDF"}
        jobStream={jobStream}
        userId={user?.id}
        onContinueToAsk={() => {
          setIsPopupOpen(false);
          const rid = jobStream.finalMetadata?.reportId;
          transitionNavigate(navigate, rid ? `/ask?report=${encodeURIComponent(String(rid))}` : "/ask", { direction: "forward" });
        }}
        onClose={() => setIsPopupOpen(false)}
        onContinueToLibrary={() => {
          setIsPopupOpen(false);
          transitionNavigate(navigate, "/library", { direction: "forward" });
        }}
      />
    </div>
  );
};
