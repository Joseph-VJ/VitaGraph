import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CinematicIngestionShow } from "../components/upload/CinematicIngestionShow";
import { useToast } from "../components/gallery/Toast";
import { reportsApi } from "../api/reports";
import { useActiveUser } from "../context/UserContext";
import type { ReportPage, Report } from "../types";
import { transitionNavigate } from "../motion/navigation";
import { useJobStream } from "../hooks/useJobStream";
import { getPreferences } from "../lib/preferences";
import { FrameStage } from "../components/upload/FrameStage";

const fmtSize = (bytes: number) =>
  bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

const tagStyle = (kind: "done" | "running" | "waiting" | "failed"): React.CSSProperties =>
  kind === "done"
    ? { background: "var(--color-text)", color: "var(--color-bg)", fontWeight: 800 }
    : kind === "running"
    ? { background: "var(--color-accent)", color: "var(--color-bg)", fontWeight: 800 }
    : kind === "failed"
    ? { background: "var(--color-accent-100)", color: "var(--color-accent-800)", fontWeight: 800 }
    : { background: "var(--color-neutral-200)", color: "var(--color-neutral-800)" };

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUsers } = useActiveUser();
  const userId = user?.id || (typeof localStorage !== "undefined" ? localStorage.getItem("vitagraph_user_id") : null) || "usr_51f14542d71a";
  const { addToast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingCohort, setIsLoadingCohort] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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
      if (reportId && userId) {
        reportsApi
          .pages(reportId)
          .then((pgs) => setPages(pgs))
          .catch(() => setPages([]));
        reportsApi
          .list(userId)
          .then((list) => {
            const found = list.find((r) => r.id === reportId) ?? null;
            setActiveReport(found);
          })
          .catch(() => {
            setActiveReport(null);
          });
      }
    } else if (jobStream.status === "error") {
      setIsUploading(false);
      if (file) {
        const reason = jobStream.error || "The report could not be processed.";
        setQuarantinedFiles((prev) => [
          ...prev,
          {
            filename: file.name,
            reason,
          },
        ]);
        addToast("failed", "Report quarantined", reason);
      }
    }
  }, [jobStream.status, jobStream.finalMetadata, jobStream.error, file, userId, addToast]);

  const handleLoadDemoCohort = async () => {
    if (isLoadingCohort) return;
    setIsLoadingCohort(true);
    try {
      const res = await reportsApi.loadDemoCohort();
      try {
        localStorage.setItem("vitagraph_user_id", res.user_id);
      } catch {
        /* storage unavailable */
      }
      await refreshUsers();
      addToast(
        "done",
        "Demo cohort loaded",
        `${res.reports_ingested} synthetic reports labelled demo data: ${res.nodes} nodes, ${res.edges} edges.`
      );
      transitionNavigate(navigate, "/graph", { direction: "forward" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast("failed", "Demo cohort not loaded", msg);
    } finally {
      setIsLoadingCohort(false);
    }
  };

  // On initial mount or userId change, load existing report pages for the persona
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setPages([]);
    setActiveReport(null);

    reportsApi
      .list(userId)
      .then(async (reportList) => {
        if (cancelled) return;
        if (reportList && reportList.length > 0) {
          const first = reportList[0];
          setActiveReport(first);
          try {
            const pageData = await reportsApi.pages(first.id);
            if (!cancelled) setPages(pageData);
          } catch {
            if (!cancelled) setPages([]);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setPages([]);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleFileSelect = async (selectedFile: File) => {
    if (!userId) return;
    setFile(selectedFile);
    setIsUploading(true);
    const jobId = `job_upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. Subscribe to the job's event stream before the upload starts.
    jobStream.connect(jobId);

    // 2. Open the full-screen show, unless "Cinematic ingestion" is off in Settings.
    if (getPreferences().cinematic) setIsPopupOpen(true);

    // 3. Send the file; the backend runs the pipeline in the background.
    try {
      const isPdf = selectedFile.name.toLowerCase().endsWith(".pdf");
      const currentChunkSize = getPreferences().chunkSize;
      const res = await reportsApi.upload(userId, selectedFile, jobId, isPdf, currentChunkSize);
      if (res.status === "failed") {
        const reason = res.error_message || "Corrupted document structure or unreadable text layers.";
        setQuarantinedFiles((prev) => [
          ...prev,
          {
            filename: selectedFile.name,
            reason,
          },
        ]);
        addToast("failed", "Report quarantined", reason);
        jobStream.reset();
        setIsUploading(false);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setQuarantinedFiles((prev) => [
        ...prev,
        {
          filename: selectedFile.name,
          reason: errMsg,
        },
      ]);
      addToast("failed", "Upload rejected", errMsg);
      jobStream.reset();
      setIsUploading(false);
    }
  };

  const isDone = jobStream.status === "completed";
  const isFailed = jobStream.status === "error";

  const extEvt = jobStream.events.find((e) => e.stage === "extracted");
  const chunkEvt = jobStream.events.find((e) => e.stage === "chunked");
  const embedEvt = jobStream.events.find((e) => e.stage === "embedded");
  const idxEvt = jobStream.events.find((e) => e.stage === "indexed");

  const hasExtracted = !!extEvt || isDone || (pages.length > 0 && !isUploading);
  const hasChunked = !!chunkEvt || isDone || (!!activeReport && !isUploading);
  const hasEmbedded = !!embedEvt || isDone || (!!activeReport && !isUploading);
  const hasIndexed = !!idxEvt || isDone || (!!activeReport && !isUploading);

  const stageStatus = (index: number): { kind: "done" | "running" | "waiting" | "failed"; label: string } => {
    if (isFailed) {
      if (index === 0 && !hasExtracted) return { kind: "failed", label: "Failed" };
      if (index === 1 && !hasExtracted) return { kind: "failed", label: "Failed" };
      if (index === 2 && hasExtracted && !hasChunked) return { kind: "failed", label: "Failed" };
      if (index === 3 && hasChunked && !hasEmbedded) return { kind: "failed", label: "Failed" };
      if (index === 4 && hasEmbedded && !hasIndexed) return { kind: "failed", label: "Failed" };
    }
    if (index === 0) {
      if (hasExtracted) return { kind: "done", label: "Done" };
      if (isUploading) return { kind: "running", label: "Running" };
      return { kind: "waiting", label: "Waiting" };
    }
    if (index === 1) {
      if (hasExtracted) return { kind: "done", label: "Done" };
      if (isUploading && jobStream.currentStage === "extracting") return { kind: "running", label: "Running" };
      return { kind: "waiting", label: "Waiting" };
    }
    if (index === 2) {
      if (hasChunked) return { kind: "done", label: "Done" };
      if (isUploading && hasExtracted && !hasChunked) return { kind: "running", label: "Running" };
      return { kind: "waiting", label: "Waiting" };
    }
    if (index === 3) {
      if (hasEmbedded) return { kind: "done", label: "Done" };
      if (isUploading && hasChunked && !hasEmbedded) return { kind: "running", label: "Running" };
      return { kind: "waiting", label: "Waiting" };
    }
    if (index === 4) {
      if (hasIndexed) return { kind: "done", label: "Done" };
      if (isUploading && hasEmbedded && !hasIndexed) return { kind: "running", label: "Running" };
      return { kind: "waiting", label: "Waiting" };
    }
    return { kind: "waiting", label: "Waiting" };
  };

  const metaPages = Array.isArray(extEvt?.metadata?.pages)
    ? (extEvt?.metadata?.pages as Array<{ page_number: number; method: string; quality: string; chars: number }>)
    : null;

  const totalPageCount =
    metaPages?.length ??
    (typeof extEvt?.metadata?.page_count === "number" ? extEvt.metadata.page_count : null) ??
    (pages.length > 0 ? pages.length : 0);

  const nativeCount =
    metaPages && metaPages.length > 0
      ? metaPages.filter((p) => p.method === "native" || p.method === "Native text").length
      : pages.filter((p) => p.extraction_method === "native").length;

  const ocrPagesList =
    metaPages && metaPages.length > 0
      ? metaPages.filter((p) => String(p.method || "").toLowerCase().includes("ocr"))
      : pages.filter((p) => p.extraction_method.toLowerCase().includes("ocr"));

  const chunkCount =
    (typeof chunkEvt?.metadata?.total_chunks === "number" ? chunkEvt.metadata.total_chunks : null) ??
    (typeof chunkEvt?.metadata?.chunks === "number" ? chunkEvt.metadata.chunks : null) ??
    jobStream.finalMetadata?.chunks ??
    activeReport?.chunk_count ??
    0;

  const embedCount =
    (typeof embedEvt?.metadata?.count === "number" ? embedEvt.metadata.count : null) ?? chunkCount;
  const embedDim =
    (typeof embedEvt?.metadata?.dim === "number" ? embedEvt.metadata.dim : null) ?? 384;

  const indexCount =
    (typeof idxEvt?.metadata?.indexed === "number" ? idxEvt.metadata.indexed : null) ?? chunkCount;

  const s0 = stageStatus(0);
  const s1 = stageStatus(1);
  const s2 = stageStatus(2);
  const s3 = stageStatus(3);
  const s4 = stageStatus(4);

  const pipeRows = [
    {
      name: "Parse digital text",
      out: s0.kind === "done" && totalPageCount > 0 ? `${totalPageCount} page${totalPageCount === 1 ? "" : "s"}, ${nativeCount} with a text layer` : "",
      ...s0,
    },
    {
      name: "Read scanned pages (OCR)",
      out:
        s1.kind === "done" && totalPageCount > 0
          ? ocrPagesList.length === 1
            ? `Page ${ocrPagesList[0].page_number} read by OCR`
            : ocrPagesList.length > 1
            ? `${ocrPagesList.length} pages read by OCR`
            : "No scanned pages"
          : "",
      ...s1,
    },
    {
      name: "Chunk with provenance",
      out: s2.kind === "done" && chunkCount > 0 ? `${chunkCount} chunks, page and character spans kept` : "",
      ...s2,
    },
    {
      name: "Embed passages",
      out: s3.kind === "done" && embedCount > 0 ? `${embedCount} vectors, ${embedDim} dimensions` : "",
      ...s3,
    },
    {
      name: "Index, scoped to user",
      out: s4.kind === "done" && indexCount > 0 ? `${indexCount} upserts where user_id = ${userId || "user"}` : "",
      ...s4,
    },
  ];

  const fileIsQuarantined = !!file && quarantinedFiles.some((q) => q.filename === file.name);
  const fileTag: { label: string; kind: "done" | "running" | "waiting" | "failed" } = fileIsQuarantined
    ? { label: "Quarantined", kind: "failed" }
    : isDone
    ? { label: "Indexed", kind: "done" }
    : isUploading
    ? { label: "Ingesting", kind: "running" }
    : { label: "Ready", kind: "waiting" };

  return (
    <div
      data-screen-label="Upload"
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "var(--space-8)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-8)",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-8)", alignItems: "flex-start" }}>
        {/* Left column: 320px */}
        <div
          style={{
            flex: "0 0 320px",
            maxWidth: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <div
            data-testid="upload-dropzone"
            role="region"
            aria-label="Upload a report"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f && !isUploading) handleFileSelect(f);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
              gap: "var(--space-3)",
              padding: "var(--space-4) var(--space-6)",
              minHeight: 0,
              boxSizing: "border-box",
              border: `2px dashed ${dragOver ? "var(--color-accent)" : "var(--color-divider)"}`,
              background: dragOver ? "var(--color-accent-100)" : "var(--color-surface)",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
              style={{ strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}
            >
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
              <button
                className="btn btn-secondary"
                disabled={isUploading || isLoadingCohort}
                onClick={handleLoadDemoCohort}
              >
                {isLoadingCohort ? "Loading demo cohort" : "Load demo cohort"}
              </button>
            </div>
          </div>

          {file && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-2) 0",
                borderTop: "2px solid var(--color-divider)",
                borderBottom: "2px solid var(--color-divider)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, overflowWrap: "anywhere", fontSize: "0.9375rem" }}>{file.name}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>
                  PDF · {fmtSize(file.size)} · scoped to {user?.display_label ?? userId}
                </div>
              </div>
              <span className="tag" style={tagStyle(fileTag.kind)}>{fileTag.label}</span>
            </div>
          )}

          {quarantinedFiles.map((q, idx) => (
            <div
              key={`${q.filename}-${idx}`}
              data-testid="upload-quarantine-row"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--space-3)",
                padding: "var(--space-2) 0",
                borderTop: "2px solid var(--color-accent)",
                borderBottom: "1px solid var(--color-divider)",
              }}
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

          <div data-testid="upload-pipeline">
            {pipeRows.map((r, i) => (
              <div
                key={r.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.75rem minmax(0,1fr) auto",
                  gap: "var(--space-2)",
                  alignItems: "baseline",
                  padding: "var(--space-2) 0",
                  borderTop: "1px solid var(--color-divider)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--color-neutral-700)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 800, fontSize: "0.9375rem" }}>{r.name}</span>
                  <span style={{ display: "block", fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>
                    {r.out}
                  </span>
                </span>
                <span className="tag" style={tagStyle(r.kind)}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: 560px min */}
        <div style={{ flex: "1 1 560px", minWidth: 0 }}>
          <FrameStage />
        </div>
      </div>

      {pages.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--space-3)",
              paddingBottom: "var(--space-2)",
              borderBottom: "2px solid var(--color-divider)",
            }}
          >
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--color-neutral-700)",
              }}
            >
              Pages
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                className="btn btn-primary"
                style={{ gap: "var(--space-6)" }}
                onClick={() =>
                  transitionNavigate(
                    navigate,
                    activeReport ? `/agent?report=${encodeURIComponent(activeReport.id)}` : "/agent",
                    { direction: "forward" }
                  )
                }
              >
                Ask about this report
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => transitionNavigate(navigate, "/library", { direction: "forward" })}
              >
                Open library
              </button>
            </div>
          </div>
          <table className="table" data-testid="upload-pages-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Source</th>
                <th>Characters</th>
                <th>Quality</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => {
                const m = (p.extraction_method || "").toLowerCase();
                const isNative = m === "native";
                const isOcr = m.includes("ocr");
                const isUncertain = m === "uncertain" || (p.quality || "").toLowerCase() === "uncertain";
                const srcLabel = isNative ? "Native text" : isOcr ? "OCR" : isUncertain ? "Uncertain" : "No text";
                const tagCss: React.CSSProperties = isNative
                  ? { background: "var(--color-neutral-200)", color: "var(--color-neutral-800)" }
                  : { background: "var(--color-accent)", color: "var(--color-bg)", fontWeight: 800 };
                return (
                  <tr key={p.page_number}>
                    <td style={{ fontWeight: 800 }}>p.{p.page_number}</td>
                    <td>
                      <span className="tag" style={tagCss}>
                        {srcLabel}
                      </span>
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.text_length.toLocaleString("en-US")}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {!isNaN(Number(p.quality)) && p.quality !== "" ? Number(p.quality).toFixed(2) : p.quality}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CinematicIngestionShow
        isOpen={isPopupOpen}
        filename={file?.name || "Report"}
        jobStream={jobStream}
        userId={userId ?? undefined}
        onClose={() => setIsPopupOpen(false)}
        onContinueToLibrary={() => {
          setIsPopupOpen(false);
          transitionNavigate(navigate, "/library", { direction: "forward" });
        }}
      />
    </div>
  );
};
