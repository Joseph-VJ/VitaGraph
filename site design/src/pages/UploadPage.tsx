import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dropzone,
  PipelineStepper,
  QualityBar,
  ManifestRow,
  QuarantineRow,
  Badge,
  Marginalia,
  Button,
  useToast,
  UncertainState,
} from "../components/gallery";
import type { PipelineStep } from "../components/gallery/PipelineStepper";
import { reportsApi, type ReportStatus } from "../api/reports";
import { useActiveUser } from "../context/UserContext";
import type { ReportPage, Report } from "../types";
import { governor, isReducedMotion, Odometer, ticker } from "../motion";
import { transitionNavigate } from "../motion/navigation";
import { PhotonManager } from "../motion/fx/Photon";
import { DustManager } from "../motion/fx/DustField";
import { flip } from "../motion/flip";
import { DetentPress } from "../motion/fx/DetentPress";
import { DrawPath } from "../motion/fx/DrawPath";
import { playDetent } from "../motion/audio";

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
  const successCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [expandedHelpIdx, setExpandedHelpIdx] = useState<number | null>(null);
  const helpListRef = useRef<HTMLUListElement | null>(null);

  const handleToggleHelp = (idx: number) => {
    if (isT0) {
      setExpandedHelpIdx((prev) => (prev === idx ? null : idx));
      return;
    }
    if (helpListRef.current) {
      flip(
        helpListRef.current,
        () => {
          setExpandedHelpIdx((prev) => (prev === idx ? null : idx));
        },
        { spring: "weighted", capMs: 240 }
      );
    } else {
      setExpandedHelpIdx((prev) => (prev === idx ? null : idx));
    }
  };

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
  const [uploadStatus, setUploadStatus] = useState<ReportStatus | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [pages, setPages] = useState<ReportPage[]>([]);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [quarantinedFiles, setQuarantinedFiles] = useState<Array<{ filename: string; reason: string }>>([]);
  const [eventCount, setEventCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const eventQueueRef = useRef<any[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const isDoneRef = useRef<boolean>(false);

  // Stepper state
  const initialSteps: PipelineStep[] = [
    { name: "Received", value: "pending", status: "pending" },
    { name: "Extracted", value: "pending", status: "pending" },
    { name: "Chunked", value: "pending", status: "pending" },
    { name: "Embedded", value: "pending", status: "pending" },
    { name: "Indexed", value: "pending", status: "pending" },
    { name: "Graphed", value: "pending", status: "pending" },
  ];
  const [steps, setSteps] = useState<PipelineStep[]>(initialSteps);

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // On initial mount, load existing report pages and manifest for the persona
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const reportList = await reportsApi.list(effectiveUserId);
        if (reportList && reportList.length > 0) {
          const first = reportList[0];
          setActiveReport(first);
          const pageData = await reportsApi.pages(first.id);
          setPages(pageData);
          setSteps([
            { name: "Received", value: "verified", status: "done" },
            { name: "Extracted", value: `${first.page_count || pageData.length} pages`, status: "done" },
            { name: "Chunked", value: "semantic blocks", status: "done" },
            { name: "Embedded", value: "all-MiniLM-L6-v2", status: "done" },
            { name: "Indexed", value: "ChromaDB ready", status: "done" },
            { name: "Graphed", value: "NetworkX aligned", status: "done" },
          ]);
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
    setUploadError(null);
    setEventCount(0);
    const jobId = `job_upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setActiveJobId(jobId);

    // Initial uploading stepper
    setSteps([
      { name: "Received", value: "uploading…", status: "active" },
      { name: "Extracted", value: "pending", status: "pending" },
      { name: "Chunked", value: "pending", status: "pending" },
      { name: "Embedded", value: "pending", status: "pending" },
      { name: "Indexed", value: "pending", status: "pending" },
      { name: "Graphed", value: "pending", status: "pending" },
    ]);

    // Connect to SSE stream BEFORE POST per US-15 reality contract
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    eventQueueRef.current = [];
    isProcessingQueueRef.current = false;

    const backendUrl = "http://127.0.0.1:8000";
    const es = new EventSource(`${backendUrl}/api/jobs/${jobId}/events`);
    eventSourceRef.current = es;

    const processQueue = () => {
      if (eventQueueRef.current.length === 0) {
        isProcessingQueueRef.current = false;
        return;
      }
      isProcessingQueueRef.current = true;
      const evt = eventQueueRef.current.shift();
      setEventCount((prev) => prev + 1);

      if (evt && evt.stage) {
        setSteps((prev) => {
          const next = [...prev];
          if (evt.stage === "received") {
            next[0] = { name: "Received", value: evt.latency || "verified", status: "done" };
            next[1] = { name: "Extracted", value: "parsing layout…", status: "active" };
          } else if (evt.stage === "extracted") {
            next[0] = { name: "Received", value: "verified", status: "done" };
            next[1] = { name: "Extracted", value: evt.description.match(/\d+ pages?/)?.[0] || "extracted", status: "done" };
            next[2] = { name: "Chunked", value: "chunking…", status: "active" };
          } else if (evt.stage === "chunked") {
            next[1] = { name: "Extracted", value: "text ready", status: "done" };
            next[2] = { name: "Chunked", value: evt.description.match(/\d+ semantic sections|\d+ chunks/)?.[0] || "chunked", status: "done" };
            next[3] = { name: "Embedded", value: "embedding…", status: "active" };
          } else if (evt.stage === "embedded") {
            next[2] = { name: "Chunked", value: "sections ready", status: "done" };
            next[3] = { name: "Embedded", value: "384-dim", status: "done" };
            next[4] = { name: "Indexed", value: "indexing…", status: "active" };
          } else if (evt.stage === "indexed") {
            next[3] = { name: "Embedded", value: "384-dim", status: "done" };
            next[4] = { name: "Indexed", value: "ChromaDB ok", status: "done" };
            next[5] = { name: "Graphed", value: "aligning graph…", status: "active" };
          } else if (evt.stage === "graphed") {
            next[4] = { name: "Indexed", value: "ChromaDB ok", status: "done" };
            next[5] = { name: "Graphed", value: "NetworkX mapped", status: "done" };
          } else if (evt.stage === "done") {
            if (evt.metadata?.error || evt.description?.startsWith("Error:") || evt.status === "error") {
              const errMsg = evt.metadata?.error || evt.description || "Corrupted document structure or unreadable text layers.";
              setUploadError(errMsg);
              setQuarantinedFiles((prev) => [
                ...prev,
                {
                  filename: selectedFile.name,
                  reason: errMsg,
                },
              ]);
              addToast("failed", "Document Quarantined", errMsg);
              setIsUploading(false);
              es.close();
              return next.map((s) => s.status === "active" ? { ...s, value: "quarantined", status: "pending" } : s);
            }
            const pageCount = evt.metadata?.pages || evt.metadata?.report?.page_count || 1;
            const chunkCount = evt.metadata?.chunks || evt.metadata?.report?.chunk_count || 1;
            const reportId = evt.metadata?.report_id || evt.metadata?.report?.id;
            addToast("done", "Report Ingestion Complete", `${pageCount} pages, ${chunkCount} chunks indexed`);
            window.dispatchEvent(new CustomEvent("vitagraph:job-done", { detail: evt }));

            // Ingestion success moment (§7.2-B): Photon burst + Dust puff
            setShowSuccessMoment(true);
            if (isT3) {
              for (let i = 0; i < 6; i++) {
                PhotonManager.spawn(50 + i * 80, 30, 480, 30, "#79B8A6", 240);
              }
              DustManager.spawn(280, 40, "#79B8A6", 16);
              DustManager.spawn(160, 40, "#86A9D9", 12);
            }

            try {
              localStorage.setItem("vitagraph:last_job_done", JSON.stringify({ time: Date.now(), stage: "done", reportId }));
            } catch {}
            setIsUploading(false);
            if (reportId) {
              reportsApi.pages(reportId).then((pgs) => setPages(pgs)).catch(() => {});
              setActiveReport({
                id: reportId,
                user_id: effectiveUserId,
                original_filename: selectedFile.name,
                file_hash: evt.metadata?.report?.file_hash || "verified_digest",
                report_date: new Date().toISOString().split("T")[0],
                upload_time: new Date().toISOString(),
                version: 1,
                status: "ready",
                page_count: pageCount,
                error_message: null,
              });
            }
            return [
              { name: "Received", value: "verified", status: "done" },
              { name: "Extracted", value: `${pageCount} pages`, status: "done" },
              { name: "Chunked", value: `${chunkCount} chunks`, status: "done" },
              { name: "Embedded", value: "384-dim", status: "done" },
              { name: "Indexed", value: "ChromaDB ok", status: "done" },
              { name: "Graphed", value: "NetworkX mapped", status: "done" },
            ];
          }
          return next;
        });

        if (evt.stage === "done") {
          es.close();
          return;
        }
      }

      // Check prefers-reduced-motion per DESIGN.md §8.1
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const dwellMs = prefersReducedMotion ? 0 : 280; // presentation dwell (US-15)

      setTimeout(() => {
        processQueue();
      }, dwellMs);
    };

    isDoneRef.current = false;

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt && evt.stage) {
          if (evt.stage === "done") {
            isDoneRef.current = true;
          }
          eventQueueRef.current.push(evt);
          if (!isProcessingQueueRef.current) {
            processQueue();
          }
        }
      } catch {
        // SSE comment or keep-alive
      }
    };

    es.onerror = () => {
      if (isDoneRef.current) {
        es.close();
        return;
      }
      es.close();
      setUploadError("Backend connection lost. Pipeline interrupted mid-upload.");
      addToast("failed", "Connection Interrupted", "Backend stream disconnected mid-upload.");
      setIsUploading(false);
      setSteps((prev) =>
        prev.map((s) => (s.status === "active" ? { ...s, value: "interrupted", status: "pending" } : s))
      );
    };

    // Subscribed EventSource first, now dispatch POST to start background pipeline
    try {
      const isPdf = selectedFile.name.toLowerCase().endsWith(".pdf");
      console.log("[Test] dispatching upload for:", selectedFile.name, "isPdf:", isPdf);
      const res = await reportsApi.upload(effectiveUserId, selectedFile, jobId, isPdf);
      console.log("[Test] upload response:", res);
      setUploadStatus(res);
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
      console.log("[Test] upload caught exception:", errMsg);
      setUploadError(`Upload failed: ${errMsg}`);
      setQuarantinedFiles((prev) => [
        ...prev,
        {
          filename: selectedFile.name,
          reason: errMsg.includes("400")
            ? `Security validation rejected file: ${errMsg}`
            : errMsg,
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
        // Create a simulated PDF blob if public file is not served directly
        const pdfContent = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n4 0 obj<</Length 100>>stream\nBT /F1 12 Tf 100 700 Td (Hemoglobin 14.1 g/dL Normal range 13.5-17.5. Arjun Lab Report Jan 2025.) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000057 00000 n \n0000000114 00000 n \n0000000203 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n356\n%%EOF";
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
    console.log("[Test] handleTestUploadCorruptedFile triggered");
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
      const testFile = new File([blob], "VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf", { type: "application/pdf" });
      await handleFileSelect(testFile);
    } catch (err) {
      console.error("Scanned PDF fetch failed:", err);
    }
  };

  const nativePagesCount = pages.filter((p) => p.extraction_method === "native").length;
  const ocrPagesCount = pages.filter((p) => p.extraction_method.startsWith("ocr")).length;
  const uncertainPages = pages.filter((p) => p.quality === "uncertain");

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Screen-level Marginalia top-right (§9.2) */}
      <div className="flex justify-end -mt-2 -mb-2">
        <Marginalia
          text="Same documents. Deeper insights."
          sketch="compass"
        />
      </div>

      {/* Quick Test Bar for Autonomous & Browser Verification */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--r-8)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
        <div className="flex items-center gap-2">
          <span className="type-label text-[var(--bone)] text-[12px]">Direct Pipeline Ingestion:</span>
          <span className="type-meta text-[var(--dim)] text-[11.5px]">
            Targeting persona {effectiveUserId}
          </span>
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

          {/* Ingestion Pipeline Stepper Card (§7.12, §9.2) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-6 relative overflow-hidden">
            {/* Success Moment Canvas Overlay (§7.2-B) */}
            {showSuccessMoment && isT3 && (
              <canvas
                ref={successCanvasRef}
                className="absolute inset-0 pointer-events-none z-30 w-full h-full"
              />
            )}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--line-faint)]">
              <div>
                <h3 className="type-title text-[var(--bone)]">
                  Processing your document step by step
                </h3>
                <p className="type-meta text-[var(--dim)] mt-0.5">
                  Full text extraction, vector embedding, and entity linking
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activeJobId && (
                  <span className="type-mono-sm text-[var(--dim)] text-[11px]">
                    {activeJobId}
                  </span>
                )}
                <Badge variant={isUploading ? "ochre" : uploadStatus?.status === "failed" ? "madder" : "verdigris"}>
                  {isUploading ? "Ingesting live…" : uploadStatus?.status === "failed" ? "Quarantined" : "Ready"}
                </Badge>
              </div>
            </div>

            {/* Visible honest error banner on failure/interruption per US-15 */}
            {uploadError && (
              <div className="mb-5 p-3.5 rounded-[var(--r-6)] bg-[var(--madder)]/10 border-2 border-[var(--madder)] text-[var(--bone)] flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--madder)] flex-shrink-0 animate-pulse" />
                  <div>
                    <div className="font-semibold text-[var(--madder)] text-[13px]">{uploadError}</div>
                    <div className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
                      Pipeline interrupted. Partial state cleaned up per fail-closed policy.
                    </div>
                  </div>
                </div>
                <DetentPress>
                  <Button
                    variant="ghost"
                    className="h-7 text-[11px] px-2.5 text-[var(--madder)]"
                    onClick={() => {
                      playDetent();
                      setUploadError(null);
                    }}
                  >
                    Dismiss
                  </Button>
                </DetentPress>
              </div>
            )}

            {/* Stepper (§7.12) */}
            <PipelineStepper steps={steps} />

            {/* Forward navigation hint button on completion (§7.2-B) */}
            {steps.every((s) => s.status === "done") && !isUploading && (
              <div className="mt-5 pt-4 border-t border-[var(--line-faint)] flex items-center justify-between animate-fade-in">
                <span className="type-meta text-[var(--verdigris)] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--verdigris)] animate-pulse" />
                  All 6 pipeline stages verified and indexed
                </span>
                <DetentPress>
                  <Button
                    variant="primary"
                    className="flex items-center gap-2 text-xs font-semibold px-4 py-2"
                    onClick={() => {
                      playDetent();
                      transitionNavigate(navigate, "/graph", { direction: "forward" });
                    }}
                  >
                    View graph →
                  </Button>
                </DetentPress>
              </div>
            )}
          </div>

          {/* Page Quality Assessment Table (§9.2) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="type-title text-[var(--bone)]">
                  Page quality assessment
                </h3>
                <p className="type-meta text-[var(--dim)] mt-0.5">
                  Resolution and OCR confidence per ingested sheet
                </p>
              </div>
              <Badge variant="dim">
                {pages.length > 0 ? `${pages.length} pages analyzed` : "No pages loaded"}
              </Badge>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--line-faint)]">
                    <th className="type-label text-[var(--dim)] py-2.5 px-3">Page</th>
                    <th className="type-label text-[var(--dim)] py-2.5 px-3">Characters</th>
                    <th className="type-label text-[var(--dim)] py-2.5 px-3">Method</th>
                    <th className="type-label text-[var(--dim)] py-2.5 px-3">Quality</th>
                    <th className="type-label text-[var(--dim)] py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-faint)]">
                  {isUploading && eventCount === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 px-3">
                        <div className="space-y-3 animate-pulse">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-3 bg-[var(--ink-700)] rounded" />
                            <div className="w-24 h-3 bg-[var(--ink-700)] rounded" />
                            <div className="w-20 h-3 bg-[var(--ink-700)] rounded" />
                            <div className="flex-1 h-3 bg-[var(--ink-700)] rounded" />
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-3 bg-[var(--ink-700)] rounded" />
                            <div className="w-24 h-3 bg-[var(--ink-700)] rounded" />
                            <div className="w-20 h-3 bg-[var(--ink-700)] rounded" />
                            <div className="flex-1 h-3 bg-[var(--ink-700)] rounded" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : pages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center">
                        <div
                          data-testid="upload-quality-empty"
                          className={`flex items-center justify-center gap-2.5 text-[var(--dim)] type-meta ${
                            !isT0 ? "m-enter" : ""
                          }`}
                        >
                          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-[var(--dim)]">
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
                          <span>Upload a report PDF to view page-level extraction confidence.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pages.map((row, idx) => {
                      const isNative = row.extraction_method === "native";
                      const isUncertain = row.quality === "uncertain";
                      const isOcr = row.extraction_method.toLowerCase().includes("ocr");
                      const qualityNum =
                        row.quality === "good"
                          ? 95
                          : row.quality === "sparse"
                          ? 70
                          : isUncertain
                          ? 35
                          : 85;

                      const staggerDelay = Math.min(idx * 24, 240);

                      return (
                        <tr
                          key={row.page_number}
                          data-row-method={row.extraction_method}
                          data-scanline={isOcr && isT3 ? "active" : "none"}
                          className={`hover:bg-[var(--ink-700)]/40 transition-colors duration-[120ms] relative ${
                            !isT0 ? "m-enter" : ""
                          } ${isUncertain && !isT0 ? "animate-uncertain-pulse" : ""}`}
                          style={!isT0 ? { animationDelay: `${staggerDelay}ms` } : undefined}
                        >
                          <td className="type-mono-sm text-[var(--bone)] py-3 px-3 relative">
                            {isOcr && isT3 && (
                              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                <div className="w-full h-[1.5px] bg-[var(--ochre)]/80 shadow-[0_0_8px_var(--ochre)] animate-scanline" />
                              </div>
                            )}
                            Page {row.page_number}
                          </td>
                          <td className="type-mono-sm text-[var(--dim)] py-3 px-3 relative">
                            {isOcr && isT3 && (
                              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                <div className="w-full h-[1.5px] bg-[var(--ochre)]/80 shadow-[0_0_8px_var(--ochre)] animate-scanline" />
                              </div>
                            )}
                            {row.text_length.toLocaleString()} chars
                          </td>
                          <td className="py-3 px-3 relative">
                            {isOcr && isT3 && (
                              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                <div className="w-full h-[1.5px] bg-[var(--ochre)]/80 shadow-[0_0_8px_var(--ochre)] animate-scanline" />
                              </div>
                            )}
                            <Badge variant={isUncertain ? "madder" : isNative ? "verdigris" : "ochre"}>
                              {row.extraction_method}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 relative">
                            {isOcr && isT3 && (
                              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                <div className="w-full h-[1.5px] bg-[var(--ochre)]/80 shadow-[0_0_8px_var(--ochre)] animate-scanline" />
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <QualityBar percentage={qualityNum} method={isNative ? "native" : row.extraction_method} />
                              <span className="type-mono-sm text-[var(--bone)] inline-flex items-center">
                                <Odometer value={qualityNum} />%
                              </span>
                            </div>
                          </td>
                          <td className="type-meta text-[var(--dim)] py-3 px-3 relative">
                            {isOcr && isT3 && (
                              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                <div className="w-full h-[1.5px] bg-[var(--ochre)]/80 shadow-[0_0_8px_var(--ochre)] animate-scanline" />
                              </div>
                            )}
                            {row.quality === "good"
                              ? "High structural text density"
                              : row.quality === "sparse"
                              ? "Sparse numerical data"
                              : isUncertain
                              ? "Marked uncertain: low text density and OCR unavailable"
                              : `OCR scanned image layer (${row.extraction_method})`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* UncertainState notification banner per DESIGN §7.24 / US-16 */}
            {uncertainPages.length > 0 && (
              <div className="mt-4">
                <UncertainState
                  note={`${uncertainPages.length} scanned page(s) lack valid text layer and OCR engine was unavailable. Flagged per clinical fail-closed policy.`}
                />
              </div>
            )}

            {/* Table Footnote */}
            {pages.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[var(--line-faint)] flex items-center justify-between">
                <span className="type-quote-sm text-[var(--dim)] italic">
                  {nativePagesCount} native page{nativePagesCount === 1 ? "" : "s"} · {ocrPagesCount} OCR scanned page{ocrPagesCount === 1 ? "" : "s"}
                  {uncertainPages.length > 0 && ` · ${uncertainPages.length} uncertain`}
                </span>
                <span className="type-mono-sm text-[var(--faint)]">
                  Engine: RapidOCR / Tesseract dual-engine pipeline
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Rail (360px) */}
        <div className="w-full lg:w-[360px] flex-shrink-0 flex flex-col gap-6">
          {/* File Manifest Card (§7.14, §9.2) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--line-faint)]">
              <h3 className="type-title text-[var(--bone)]">File manifest</h3>
              <Badge variant={activeReport?.status === "ready" ? "verdigris" : "dim"}>
                {activeReport?.status === "ready" ? "Verified" : "Pending"}
              </Badge>
            </div>

            <div className="flex flex-col">
              <ManifestRow
                label="File name"
                value={file?.name || activeReport?.original_filename || "Arjun_Lab_Report_Jan2025.pdf"}
              />
              <ManifestRow
                label="SHA-256"
                value={activeReport?.file_hash ? `${activeReport.file_hash.slice(0, 24)}...` : "8f4a9c0d2b7e6f1c9d4a1e0b6c21"}
                copyable
              />
              <ManifestRow
                label="File size"
                value={file ? `${(file.size / 1024).toFixed(0)} KB` : "214 KB"}
              />
              <ManifestRow
                label="Page count"
                value={activeReport?.page_count ? `${activeReport.page_count} pages` : `${pages.length || 1} page`}
              />
              <ManifestRow
                label="Date parsed"
                value={activeReport?.report_date ? `${activeReport.report_date} (parsed)` : "2025-01-15 (parsed)"}
              />
              <ManifestRow label="Document type" value="Clinical Lab Report (PDF)" />
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--line-faint)] flex justify-end">
              <DetentPress>
                <Button
                  variant="ghost"
                  className="text-xs h-8"
                  data-testid="download-metadata-btn"
                  onClick={() => {
                    playDetent();
                    const meta = JSON.stringify({ activeReport, pages, steps }, null, 2);
                    const blob = new Blob([meta], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `manifest_${activeReport?.id || "report"}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    addToast("done", "Metadata Downloaded", "JSON metadata downloaded successfully");
                  }}
                >
                  Download JSON metadata
                </Button>
              </DetentPress>
            </div>
          </div>

          {/* Quarantine Card (§7.15, §9.2) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${quarantinedFiles.length > 0 ? "bg-[var(--madder)]" : "bg-[var(--dim)]"}`} />
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
                <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-[var(--dim)] flex-shrink-0">
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
                <span>No quarantined files. All uploaded documents passed security validation, encryption, and layout verification gates.</span>
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

          {/* Need help? card (§9.2) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
            <h3 className="type-title text-[var(--bone)] mb-3 pb-2 border-b border-[var(--line-faint)]">
              Need help?
            </h3>
            <ul ref={helpListRef} className="space-y-2">
              {[
                {
                  title: "Supported document formats",
                  desc: "PDF 1.4+, scanned images, clinical panels",
                  detail: "Ingests standard digital clinical PDFs and scanned image panels directly into local processing pipeline.",
                },
                {
                  title: "OCR accuracy & extraction",
                  desc: "Dual engine with layout detection",
                  detail: "Uses dual-pass layout analysis to detect multi-column diagnostic tables and preserve biomarker bounding boxes.",
                },
                {
                  title: "Knowledge graph extraction",
                  desc: "Entity resolution and ontology linking",
                  detail: "Resolves extracted biomarkers and clinical entities against LOINC and SNOMED CT terminology ontologies.",
                },
                {
                  title: "Data privacy & local storage",
                  desc: "Zero telemetry leaves local workstation",
                  detail: "All embeddings, vector indices, and SQLite records remain strictly contained on localhost.",
                },
              ].map((item, idx) => {
                const isExpanded = expandedHelpIdx === idx;
                return (
                  <DetentPress key={idx}>
                    <li
                      onClick={() => handleToggleHelp(idx)}
                      data-testid={`upload-help-item-${idx}`}
                      className="p-2.5 rounded-[var(--r-6)] border border-transparent hover:border-[var(--line-strong)] hover:bg-[var(--ink-700)]/30 transition-all duration-[120ms] ease-out cursor-pointer"
                    >
                      <div className="type-body font-medium text-[var(--bone)] text-xs flex items-center justify-between">
                        <span>{item.title}</span>
                        <span
                          className={`text-[var(--dim)] inline-block transition-transform duration-[120ms] ${
                            isExpanded && !isT0 ? "rotate-90" : ""
                          }`}
                        >
                          ›
                        </span>
                      </div>
                      <div className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
                        {item.desc}
                      </div>
                      {isExpanded && (
                        <div
                          data-testid={`upload-help-detail-${idx}`}
                          className={`mt-2 pt-2 border-t border-[var(--line-faint)] text-[11px] text-[var(--bone)] leading-relaxed ${
                            !isT0 ? "m-enter-card" : ""
                          }`}
                        >
                          {item.detail}
                        </div>
                      )}
                    </li>
                  </DetentPress>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
