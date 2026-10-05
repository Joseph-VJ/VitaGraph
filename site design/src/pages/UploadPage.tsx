import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CinematicPipelinePopup } from "../components/gallery/CinematicPipelinePopup";
import { useToast } from "../components/gallery/Toast";
import { reportsApi } from "../api/reports";
import { useActiveUser } from "../context/UserContext";
import type { ReportPage, Report } from "../types";
import { transitionNavigate } from "../motion/navigation";
import { useJobStream } from "../hooks/useJobStream";
import { getPreferences } from "../lib/preferences";
import { PageFrame, PersonaState, SectionHead, Tag, type TagTone } from "../components/ui";

const fmtSize = (bytes: number) =>
  bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

/** How a page was read. An uncertain page stays Uncertain (plan rule 4). */
function sourceTag(page: ReportPage): { label: string; tone: TagTone } {
  const m = (page.extraction_method || "").toLowerCase();
  if (m === "native") return { label: "Native text", tone: "neutral" };
  if (m.includes("ocr")) return { label: "OCR", tone: "hot" };
  if (m === "uncertain") return { label: "Uncertain", tone: "uncertain" };
  return { label: page.extraction_method || "Unknown", tone: "neutral" };
}

function qualityTag(page: ReportPage): { label: string; tone: TagTone } {
  const q = (page.quality || "").toLowerCase();
  if (q === "uncertain") return { label: "Uncertain", tone: "uncertain" };
  const label = page.quality ? page.quality.charAt(0).toUpperCase() + page.quality.slice(1) : "";
  return { label, tone: "neutral" };
}

const arrowIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    aria-hidden="true"
    style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: personaLoading, refreshUsers } = useActiveUser();
  const userId = user?.id ?? null;
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
      const res = await reportsApi.upload(userId, selectedFile, jobId, isPdf);
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
    {
      name: "Parse digital text",
      step: "Extracted",
      out:
        done && pages.length > 0
          ? `${pages.length} pages, ${nativePagesCount} with a text layer`
          : "Reads the text layer of each page",
    },
    {
      name: "Read scanned pages (OCR)",
      step: "Extracted",
      out:
        done && pages.length > 0
          ? ocrPagesCount > 0
            ? `${ocrPagesCount} ${ocrPagesCount === 1 ? "page" : "pages"} read by OCR`
            : "No scanned pages"
          : "Scanned pages are read by OCR",
    },
    {
      name: "Chunk with provenance",
      step: "Chunked",
      out:
        done && totalChunks > 0
          ? `${totalChunks} chunks, page and character spans kept`
          : "Page and character spans are kept",
    },
    {
      name: "Embed passages",
      step: "Embedded",
      out: done && totalChunks > 0 ? `${totalChunks} vectors, 384 dimensions` : "384 dimensions",
    },
    {
      name: "Index, scoped to user",
      step: "Indexed",
      out:
        done && totalChunks > 0
          ? `${totalChunks} upserts where user_id = ${userId}`
          : "Scoped to the active persona",
    },
  ];

  const fileIsQuarantined = !!file && quarantinedFiles.some((q) => q.filename === file.name);
  const fileTag: { label: string; tone: TagTone } = fileIsQuarantined
    ? { label: "Quarantined", tone: "failed" }
    : done
    ? { label: "Indexed", tone: "done" }
    : isUploading
    ? { label: "Ingesting", tone: "running" }
    : { label: "Selected", tone: "waiting" };

  if (!userId) {
    return (
      <PageFrame label="Upload">
        <PersonaState loading={personaLoading} onRetry={refreshUsers} />
      </PageFrame>
    );
  }

  return (
    <PageFrame label="Upload">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-8)", alignItems: "flex-start" }}>
        {/* Left column: 320px-720px */}
        <div
          style={{
            flex: "1 1 320px",
            maxWidth: 720,
            minWidth: 0,
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
              <Tag tone={fileTag.tone}>{fileTag.label}</Tag>
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
              <Tag tone="failed">Quarantined</Tag>
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
            {pipeRows.map((r, i) => {
              const st = stepStatus(r.step);
              const tone: TagTone = stepStopped(r.step)
                ? "failed"
                : st === "done"
                ? "done"
                : st === "active"
                ? "running"
                : "waiting";
              const label =
                tone === "done" ? "Done" : tone === "running" ? "Running" : tone === "failed" ? "Failed" : "Waiting";
              return (
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
                  <Tag tone={tone}>{label}</Tag>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {pages.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <SectionHead
            title="Pages"
            aside={
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                <button
                  className="btn btn-primary"
                  style={{ gap: "var(--space-2)" }}
                  onClick={() =>
                    transitionNavigate(
                      navigate,
                      activeReport ? `/agent?report=${encodeURIComponent(activeReport.id)}` : "/agent",
                      { direction: "forward" }
                    )
                  }
                >
                  Ask about this report
                  {arrowIcon}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => transitionNavigate(navigate, "/library", { direction: "forward" })}
                >
                  Open library
                </button>
              </div>
            }
          />
          <div className="vg-scroll-x">
            <table className="table" data-testid="upload-pages-table" style={{ minWidth: 420 }}>
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
                  const src = sourceTag(p);
                  const qlt = qualityTag(p);
                  return (
                    <tr key={p.page_number}>
                      <td style={{ fontWeight: 800 }}>p.{p.page_number}</td>
                      <td>
                        <Tag tone={src.tone}>{src.label}</Tag>
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.text_length.toLocaleString("en-US")}</td>
                      <td>
                        <Tag tone={qlt.tone}>{qlt.label}</Tag>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <CinematicPipelinePopup
        isOpen={isPopupOpen}
        filename={file?.name || "Report"}
        jobStream={jobStream}
        userId={userId ?? undefined}
        onContinueToAsk={() => {
          setIsPopupOpen(false);
          const rid = jobStream.finalMetadata?.reportId;
          transitionNavigate(
            navigate,
            rid ? `/agent?report=${encodeURIComponent(String(rid))}` : "/agent",
            { direction: "forward" }
          );
        }}
        onClose={() => setIsPopupOpen(false)}
        onContinueToLibrary={() => {
          setIsPopupOpen(false);
          transitionNavigate(navigate, "/library", { direction: "forward" });
        }}
      />
    </PageFrame>
  );
};
