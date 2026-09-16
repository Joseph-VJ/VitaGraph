import React, { useState, useEffect, useRef } from "react";
import {
  Dropzone,
  PipelineStepper,
  QualityBar,
  ManifestRow,
  QuarantineRow,
  Badge,
  Marginalia,
  Button,
} from "../components/gallery";
import type { PipelineStep } from "../components/gallery/PipelineStepper";
import { reportsApi, type ReportStatus } from "../api/reports";
import { useActiveUser } from "../context/UserContext";
import type { ReportPage, Report } from "../types";

export const UploadPage: React.FC = () => {
  const { user } = useActiveUser();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<ReportStatus | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [pages, setPages] = useState<ReportPage[]>([]);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [quarantinedFiles, setQuarantinedFiles] = useState<Array<{ filename: string; reason: string }>>([]);

  const eventSourceRef = useRef<EventSource | null>(null);

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

    // Connect to SSE stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const backendUrl = "http://127.0.0.1:8000";
    const es = new EventSource(`${backendUrl}/api/jobs/${jobId}/events`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt && evt.stage) {
          setSteps((prev) => {
            const next = [...prev];
            if (evt.stage === "retrieval") {
              next[0] = { name: "Received", value: "stored", status: "done" };
              next[1] = { name: "Extracted", value: "parsing layout…", status: "active" };
            } else if (evt.stage === "reranking") {
              next[0] = { name: "Received", value: "hashed", status: "done" };
              next[1] = { name: "Extracted", value: "extracting text…", status: "active" };
            } else if (evt.stage === "graph") {
              next[1] = { name: "Extracted", value: "text ready", status: "done" };
              next[2] = { name: "Chunked", value: "chunking…", status: "active" };
            } else if (evt.stage === "citation") {
              next[2] = { name: "Chunked", value: "semantic blocks", status: "done" };
              next[3] = { name: "Embedded", value: "embedding…", status: "active" };
              next[4] = { name: "Indexed", value: "indexing…", status: "pending" };
            } else if (evt.stage === "done") {
              return [
                { name: "Received", value: "verified", status: "done" },
                { name: "Extracted", value: `${evt.metadata?.pages || 4} pages`, status: "done" },
                { name: "Chunked", value: `${evt.metadata?.chunks || 24} chunks`, status: "done" },
                { name: "Embedded", value: "384-dim", status: "done" },
                { name: "Indexed", value: "ChromaDB ok", status: "done" },
                { name: "Graphed", value: "NetworkX mapped", status: "done" },
              ];
            }
            return next;
          });
          if (evt.stage === "done") {
            es.close();
          }
        }
      } catch {
        // SSE comment or keep-alive
      }
    };

    es.onerror = () => {
      es.close();
    };

    try {
      const res = await reportsApi.upload(effectiveUserId, selectedFile, jobId);
      setUploadStatus(res);

      if (res.status === "ready") {
        const pageList = await reportsApi.pages(res.id);
        setPages(pageList);
        setActiveReport({
          id: res.id,
          user_id: effectiveUserId,
          original_filename: selectedFile.name,
          file_hash: res.file_hash || "8f4a9c0d2b7e6f1c9d4a1e0b6c21",
          report_date: new Date().toISOString().split("T")[0],
          upload_time: new Date().toISOString(),
          version: 1,
          status: "ready",
          page_count: res.page_count,
          error_message: null,
        });
        setSteps([
          { name: "Received", value: "verified", status: "done" },
          { name: "Extracted", value: `${res.page_count} pages`, status: "done" },
          { name: "Chunked", value: `${res.chunk_count} chunks`, status: "done" },
          { name: "Embedded", value: "384-dim", status: "done" },
          { name: "Indexed", value: "ChromaDB ok", status: "done" },
          { name: "Graphed", value: "NetworkX mapped", status: "done" },
        ]);
      } else if (res.status === "failed") {
        setQuarantinedFiles((prev) => [
          ...prev,
          {
            filename: selectedFile.name,
            reason: res.error_message || "Corrupted document structure or unreadable text layers.",
          },
        ]);
        setSteps((prev) =>
          prev.map((s, idx) => (idx === 1 ? { ...s, value: "failed", status: "pending" } : s))
        );
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      setQuarantinedFiles((prev) => [
        ...prev,
        {
          filename: selectedFile.name,
          reason: errMsg.includes("400")
            ? `Security validation rejected file: ${errMsg}`
            : errMsg,
        },
      ]);
      setSteps([
        { name: "Received", value: "rejected", status: "pending" },
        { name: "Extracted", value: "quarantined", status: "pending" },
        { name: "Chunked", value: "skipped", status: "pending" },
        { name: "Embedded", value: "skipped", status: "pending" },
        { name: "Indexed", value: "skipped", status: "pending" },
        { name: "Graphed", value: "skipped", status: "pending" },
      ]);
    } finally {
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
    const invalidContent = "This is a plain text file, not a valid clinical PDF.";
    const blob = new Blob([invalidContent], { type: "text/plain" });
    const invalidFile = new File([blob], "corrupted_report_2025-06-18.txt", { type: "text/plain" });
    await handleFileSelect(invalidFile);
  };

  const nativePagesCount = pages.filter((p) => p.extraction_method === "native").length;
  const ocrPagesCount = pages.filter((p) => p.extraction_method === "ocr").length;

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
          <Button
            variant="ghost"
            className="h-7 text-[11px] px-2.5"
            disabled={isUploading}
            onClick={handleTestUploadSamplePdf}
          >
            Upload synthetic_panel_2025-01-15.pdf
          </Button>
          <Button
            variant="ghost"
            className="h-7 text-[11px] px-2.5 text-[var(--madder)] hover:text-[var(--madder)]"
            disabled={isUploading}
            onClick={handleTestUploadCorruptedFile}
          >
            Upload corrupted .txt (Test Quarantine)
          </Button>
        </div>
      </div>

      {/* Main Grid: Left Stage (flex-1) + Right Rail (360px) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        {/* Main Column */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 w-full">
          {/* Dropzone (§7.11) */}
          <Dropzone onFileSelect={handleFileSelect} />

          {/* Ingestion Pipeline Stepper Card (§7.12, §9.2) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-6">
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

            {/* Stepper (§7.12) */}
            <PipelineStepper steps={steps} />
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
                  {pages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-[var(--dim)] type-meta">
                        Upload a report PDF to view page-level extraction confidence.
                      </td>
                    </tr>
                  ) : (
                    pages.map((row) => {
                      const qualityNum =
                        row.quality === "good" ? 95 : row.quality === "sparse" ? 70 : 85;
                      const isNative = row.extraction_method === "native";

                      return (
                        <tr
                          key={row.page_number}
                          className="hover:bg-[var(--ink-700)]/40 transition-colors duration-[120ms] ease-out"
                        >
                          <td className="type-mono-sm text-[var(--bone)] py-3 px-3">
                            Page {row.page_number}
                          </td>
                          <td className="type-mono-sm text-[var(--dim)] py-3 px-3">
                            {row.text_length.toLocaleString()} chars
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant={isNative ? "verdigris" : "ochre"}>
                              {row.extraction_method}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <QualityBar percentage={qualityNum} method={isNative ? "native" : "ocr"} />
                              <span className="type-mono-sm text-[var(--bone)]">
                                {qualityNum}%
                              </span>
                            </div>
                          </td>
                          <td className="type-meta text-[var(--dim)] py-3 px-3">
                            {row.quality === "good"
                              ? "High structural text density"
                              : row.quality === "sparse"
                              ? "Sparse numerical data"
                              : "OCR scanned image layer"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footnote */}
            {pages.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[var(--line-faint)] flex items-center justify-between">
                <span className="type-quote-sm text-[var(--dim)] italic">
                  {nativePagesCount} native page{nativePagesCount === 1 ? "" : "s"} · {ocrPagesCount} OCR scanned page{ocrPagesCount === 1 ? "" : "s"}
                </span>
                <span className="type-mono-sm text-[var(--faint)]">
                  Engine: Surya-OCR / PyPDF pipeline
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
              <Button
                variant="ghost"
                className="text-xs h-8"
                onClick={() => {
                  const meta = JSON.stringify({ activeReport, pages, steps }, null, 2);
                  const blob = new Blob([meta], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `manifest_${activeReport?.id || "report"}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download JSON metadata
              </Button>
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
              <div className="p-3 text-[12px] type-meta text-[var(--dim)] bg-[var(--ink-900)] rounded-[var(--r-6)] border border-[var(--line-faint)]">
                No quarantined files. All uploaded documents passed security validation, encryption, and layout verification gates.
              </div>
            ) : (
              <div className="space-y-2">
                {quarantinedFiles.map((item, idx) => (
                  <QuarantineRow
                    key={idx}
                    filename={item.filename}
                    reason={item.reason}
                    onRetry={() => {
                      setQuarantinedFiles((prev) => prev.filter((_, i) => i !== idx));
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
            <ul className="space-y-2">
              {[
                { title: "Supported document formats", desc: "PDF 1.4+, scanned images, clinical panels" },
                { title: "OCR accuracy & extraction", desc: "Dual engine with layout detection" },
                { title: "Knowledge graph extraction", desc: "Entity resolution and ontology linking" },
                { title: "Data privacy & local storage", desc: "Zero telemetry leaves local workstation" },
              ].map((item, idx) => (
                <li
                  key={idx}
                  className="p-2.5 rounded-[var(--r-6)] border border-transparent hover:border-[var(--line-strong)] hover:bg-[var(--ink-700)]/30 transition-all duration-[120ms] ease-out cursor-pointer"
                >
                  <div className="type-body font-medium text-[var(--bone)] text-xs flex items-center justify-between">
                    <span>{item.title}</span>
                    <span className="text-[var(--dim)]">›</span>
                  </div>
                  <div className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
                    {item.desc}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
