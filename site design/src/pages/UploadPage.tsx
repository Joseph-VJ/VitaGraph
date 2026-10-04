import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CinematicPipelinePopup, useToast } from "../components/gallery";
import { reportsApi } from "../api/reports";
import { useActiveUser } from "../context/UserContext";
import type { ReportPage, Report } from "../types";
import { transitionNavigate } from "../motion/navigation";
import { useJobStream } from "../hooks/useJobStream";
import { FrameStage } from "../components/upload/FrameStage";
import { getPreferences } from "../lib/preferences";

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser, refreshUsers } = useActiveUser();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";
  const { addToast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingCohort, setIsLoadingCohort] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const [pages, setPages] = useState<ReportPage[]>([]);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [quarantinedFiles, setQuarantinedFiles] = useState<Array<{ filename: string; reason: string }>>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jobStream = useJobStream();

  // When job completes, refresh report pages
  useEffect(() => {
    if (jobStream.status === "completed") {
      setIsUploading(false);
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
  }, [jobStream.status, jobStream.finalMetadata, jobStream.error, file, effectiveUserId, addToast]);

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast("failed", "Failed to Load Demo Cohort", msg);
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

    // 2. Open the full-screen show immediately, unless the user turned "Cinematic ingestion" off in Settings
    if (getPreferences().cinematic) setIsPopupOpen(true);

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
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
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

  const [dragOver, setDragOver] = useState(false);

  const fmtSize = (bytes: number) =>
    bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

  const nativePagesCount = pages.filter((p) => p.extraction_method === "native").length;
  const ocrPagesCount = pages.filter((p) => p.extraction_method.toLowerCase().includes("ocr")).length;
  const totalChunks = jobStream.finalMetadata?.chunks ?? activeReport?.chunk_count ?? 0;
  const done = jobStream.status === "completed";

  const stepStatus = (stepName: string): "done" | "active" | "pending" =>
    jobStream.steps.find((s) => s.name === stepName)?.status ?? "pending";
  const stepStopped = (stepName: string) => {
    const s = jobStream.steps.find((x) => x.name === stepName);
    return jobStream.status === "error" && s?.status === "pending" && /quarantined|interrupted/.test(s.value);
  };

  const pipeRows: { name: string; out: string; step: string }[] = [
    { name: "Parse digital text", step: "Extracted",
      out: done && pages.length > 0 ? `${pages.length} pages, ${nativePagesCount} with a text layer` : "Reads the text layer of each page" },
    { name: "Read scanned pages (OCR)", step: "Extracted",
      out: done && pages.length > 0 ? (ocrPagesCount > 0 ? `${ocrPagesCount} ${ocrPagesCount === 1 ? "page" : "pages"} read by OCR` : "No scanned pages") : "Scanned pages are read by OCR" },
    { name: "Chunk with provenance", step: "Chunked",
      out: done && totalChunks > 0 ? `${totalChunks} chunks, page and character spans kept` : "Page and character spans are kept" },
    { name: "Embed passages", step: "Embedded",
      out: done && totalChunks > 0 ? `${totalChunks} vectors, 384 dimensions` : "384 dimensions" },
    { name: "Index, scoped to user", step: "Indexed",
      out: done && totalChunks > 0 ? `${totalChunks} upserts where user_id = ${effectiveUserId}` : "Scoped to the active persona" },
  ];

  const tagStyle = (kind: "done" | "running" | "waiting" | "failed"): React.CSSProperties =>
    kind === "done" ? { background: "var(--color-text)", color: "var(--color-bg)", fontWeight: 800 }
    : kind === "running" ? { background: "var(--color-accent)", color: "var(--color-bg)", fontWeight: 800 }
    : kind === "failed" ? { background: "var(--color-accent-100)", color: "var(--color-accent-800)", fontWeight: 800 }
    : { background: "var(--color-neutral-200)", color: "var(--color-neutral-800)" };

  const fileIsQuarantined = !!file && quarantinedFiles.some((q) => q.filename === file.name);
  const fileTag: { label: string; kind: "done" | "running" | "waiting" | "failed" } =
    fileIsQuarantined ? { label: "Quarantined", kind: "failed" }
    : done ? { label: "Indexed", kind: "done" }
    : isUploading ? { label: "Ingesting", kind: "running" }
    : { label: "Selected", kind: "waiting" };

  return (
    <div
      data-screen-label="Upload"
      style={{ maxWidth: 1280, margin: "0 auto", padding: "var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-8)", alignItems: "flex-start" }}>
        {/* Left column: 320px */}
        <div style={{ flex: "0 0 320px", maxWidth: "100%", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div
            data-testid="upload-dropzone"
            role="region"
            aria-label="Upload a report"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f && !isUploading) handleFileSelect(f);
            }}
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: "var(--space-3)",
              padding: "var(--space-4) var(--space-6)", minHeight: 0, boxSizing: "border-box",
              border: `2px dashed ${dragOver ? "var(--color-accent)" : "var(--color-divider)"}`,
              background: dragOver ? "var(--color-accent-100)" : "var(--color-surface)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"
              style={{ strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <div style={{ fontSize: "1.125rem", fontWeight: 800, letterSpacing: "-0.01em" }}>Drop a PDF here</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              <label
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!isUploading) fileInputRef.current?.click();
                  }
                }}
                className="btn btn-primary"
                style={{ cursor: isUploading ? "not-allowed" : "pointer", opacity: isUploading ? 0.45 : 1 }}
              >
                Choose file
                <input
                  ref={fileInputRef}
                  data-testid="upload-file-input"
                  type="file"
                  accept="application/pdf"
                  disabled={isUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </label>
              <button className="btn btn-secondary" disabled={isUploading || isLoadingCohort} onClick={handleLoadDemoCohort}>
                {isLoadingCohort ? "Loading demo cohort" : "Load demo cohort"}
              </button>
            </div>
          </div>

          {file && (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) 0", borderTop: "2px solid var(--color-divider)", borderBottom: "2px solid var(--color-divider)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, overflowWrap: "anywhere", fontSize: "0.9375rem" }}>{file.name}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>
                  PDF · {fmtSize(file.size)} · scoped to {user?.display_label ?? effectiveUserId}
                </div>
              </div>
              <span className="tag" style={tagStyle(fileTag.kind)}>{fileTag.label}</span>
            </div>
          )}

          {quarantinedFiles.map((q, idx) => (
            <div
              key={`${q.filename}-${idx}`}
              data-testid="upload-quarantine-row"
              style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", padding: "var(--space-2) 0", borderTop: "2px solid var(--color-accent)", borderBottom: "1px solid var(--color-divider)" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, overflowWrap: "anywhere", fontSize: "0.9375rem" }}>{q.filename}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--color-accent-800)" }}>{q.reason}</div>
              </div>
              <span className="tag" style={tagStyle("failed")}>Quarantined</span>
              <button
                className="btn btn-ghost"
                style={{ fontSize: "0.75rem" }}
                onClick={() => setQuarantinedFiles((prev) => prev.filter((_, i) => i !== idx))}
              >
                Dismiss
              </button>
            </div>
          ))}

          <div>
            {pipeRows.map((r, i) => {
              const st = stepStatus(r.step);
              const kind: "done" | "running" | "waiting" | "failed" =
                stepStopped(r.step) ? "failed" : st === "done" ? "done" : st === "active" ? "running" : "waiting";
              const label = kind === "done" ? "Done" : kind === "running" ? "Running" : kind === "failed" ? "Failed" : "Waiting";
              return (
                <div
                  key={r.name}
                  style={{ display: "grid", gridTemplateColumns: "1.75rem minmax(0,1fr) auto", gap: "var(--space-2)", alignItems: "baseline", padding: "var(--space-2) 0", borderTop: "1px solid var(--color-divider)" }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--color-neutral-700)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 800, fontSize: "0.9375rem" }}>{r.name}</span>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>{r.out}</span>
                  </span>
                  <span className="tag" style={tagStyle(kind)}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: interactive stage */}
        <div style={{ flex: "1 1 560px", minWidth: 0 }}>
          <FrameStage />
        </div>
      </div>

      {pages.length > 0 && (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", paddingBottom: "var(--space-2)", borderBottom: "2px solid var(--color-divider)" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-700)" }}>Pages</div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                className="btn btn-primary"
                style={{ gap: "var(--space-6)" }}
                onClick={() =>
                  transitionNavigate(navigate, activeReport ? `/ask?report=${encodeURIComponent(activeReport.id)}` : "/ask", { direction: "forward" })
                }
              >
                Ask about this report
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"
                  style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </button>
              <button className="btn btn-secondary" onClick={() => transitionNavigate(navigate, "/library", { direction: "forward" })}>
                Open library
              </button>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr><th>Page</th><th>Source</th><th>Characters</th><th>Quality</th></tr>
            </thead>
            <tbody>
              {pages.map((p) => {
                const native = p.extraction_method === "native";
                return (
                  <tr key={p.page_number}>
                    <td style={{ fontWeight: 800 }}>p.{p.page_number}</td>
                    <td>
                      <span
                        className="tag"
                        style={native
                          ? { background: "var(--color-neutral-200)", color: "var(--color-neutral-800)" }
                          : { background: "var(--color-accent)", color: "var(--color-bg)", fontWeight: 800 }}
                      >
                        {native ? "Native text" : p.extraction_method.toLowerCase().includes("ocr") ? "OCR" : "No text"}
                      </span>
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.text_length.toLocaleString("en-US")}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums", textTransform: "capitalize" }}>{p.quality}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CinematicPipelinePopup
        isOpen={isPopupOpen}
        filename={file?.name || "Report"}
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
