import React, { useState, useEffect, useCallback } from "react";
import {
  Badge,
  LED,
  DeltaChip,
  Button,
  IconButton,
  Marginalia,
} from "../components/gallery";
import { useActiveUser } from "../context/UserContext";
import { useToast } from "../components/gallery/Toast";
import { timelineApi } from "../api/timeline";
import { reportsApi, type TrendData } from "../api/reports";
import { usersApi } from "../api/users";
import type { TimelineEvent, Report } from "../types";

export const TimelinePage: React.FC = () => {
  const { user, users, setUser, refreshUsers } = useActiveUser();
  const { addToast } = useToast();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";

  const [filter, setFilter] = useState("all");
  const [copiedId, setCopiedId] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [hemoTrend, setHemoTrend] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSimulatingUpload, setIsSimulatingUpload] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [evts, repList] = await Promise.all([
        timelineApi.events(effectiveUserId),
        reportsApi.list(effectiveUserId),
      ]);
      setEvents(evts);
      setReports(repList);

      try {
        const trend = await reportsApi.trends(effectiveUserId, "Hemoglobin");
        setHemoTrend(trend);
      } catch {
        // Trend query best effort
      }
    } catch (err) {
      console.warn("Error loading timeline data:", err);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(effectiveUserId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const handleDeletePersona = async () => {
    setIsDeleting(true);
    try {
      await usersApi.remove(effectiveUserId);
      addToast("done", "Persona Deleted", `Persona ${effectiveUserId} records and vectors purged.`);
      await refreshUsers();
      // Switch to next available user if exists
      const remaining = users.filter((u) => u.id !== effectiveUserId);
      if (remaining.length > 0) {
        setUser(remaining[0]);
      } else {
        setUser(null);
      }
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error("Failed to delete persona:", err);
      addToast("failed", "Delete Failed", (err as Error).message || "Could not delete persona.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Simulates uploading a new report block without reloading the page (§US-09 verification)
  const handleUploadSecondReport = async () => {
    setIsSimulatingUpload(true);
    try {
      // Create second panel blob
      const pdfContent = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n4 0 obj<</Length 120>>stream\nBT /F1 12 Tf 100 700 Td (Follow-up Panel 2025-12-10: Hemoglobin 14.2 g/dL, HbA1c 6.2%, Vitamin D 32 ng/mL) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000057 00000 n \n0000000114 00000 n \n0000000203 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n376\n%%EOF";
      const blob = new Blob([pdfContent], { type: "application/pdf" });
      const testFile = new File([blob], "VitaGraph-Report-Followup-2025-12-10.pdf", { type: "application/pdf" });
      await reportsApi.upload(effectiveUserId, testFile);
      // Refresh live data without page reload
      await loadData();
    } catch (err) {
      console.error("Simulation upload failed:", err);
    } finally {
      setIsSimulatingUpload(false);
    }
  };

  // Filtered events count
  const reportCount = reports.length;
  const derivedEventsCount = events.filter((e) => e.event_type !== "report_uploaded").length;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Controls / Filter row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label htmlFor="event-filter" className="type-label text-[var(--dim)]">
            Show:
          </label>
          <select
            id="event-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 px-3 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)] text-[var(--bone)] type-label focus:outline-none focus:border-[var(--verdigris)] transition-colors duration-[120ms] ease-out"
          >
            <option value="all">All events</option>
            <option value="reports">Lab reports only</option>
            <option value="questions">Questions & RAG</option>
            <option value="graph">Graph updates</option>
          </select>
          <span className="type-meta text-[var(--dim)]">
            Showing {reportCount} report panel{reportCount === 1 ? "" : "s"} and {derivedEventsCount} derived event{derivedEventsCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="text-xs h-8 text-[var(--verdigris)] hover:text-[var(--verdigris)]"
            disabled={isSimulatingUpload}
            onClick={handleUploadSecondReport}
          >
            {isSimulatingUpload ? "Ingesting..." : "+ Add Follow-up Report (No Reload)"}
          </Button>

          <Marginalia
            text="Same data. Kinder answers."
            sketch="leaf"
            size={20}
          />
        </div>
      </div>

      {/* Main Grid: Spine Timeline (flex-1) + Patient Rail (360px) */}
      <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
        {/* Timeline Spine Column */}
        <div className="flex-1 flex flex-col min-w-0 w-full relative pl-6 border-l-2 border-[var(--line-strong)] space-y-10">
          {loading ? (
            <div className="flex flex-col gap-8">
              {[1, 2].map((i) => (
                <div key={i} className="relative animate-pulse">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-[var(--ink-700)]" />
                  <div className="h-4 w-40 rounded-[var(--r-4)] skeleton-shimmer mb-3" />
                  <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[var(--r-6)] skeleton-shimmer flex-shrink-0" />
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="h-4 w-48 rounded-[var(--r-4)] skeleton-shimmer" />
                        <div className="h-3 w-32 rounded-[var(--r-4)] skeleton-shimmer" />
                      </div>
                    </div>
                    <div className="h-20 w-full rounded-[var(--r-6)] skeleton-shimmer mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center bg-[var(--ink-800)] rounded-[var(--r-10)] border border-[var(--line-strong)] text-[var(--dim)]">
              No reports found for this persona.
            </div>
          ) : (
            reports.map((report, idx) => {
              const isLatest = idx === 0;
              const isBaseline = idx === reports.length - 1 && reports.length > 1;
              const dateStr = report.report_date || report.upload_time.split("T")[0];

              return (
                <div key={report.id} className="relative animate-fade-in">
                  {/* Spine Node Dot */}
                  <div
                    className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-4 border-[var(--ink-900)] ${
                      isLatest
                        ? "bg-[var(--verdigris)] shadow-[0_0_8px_rgba(121,184,166,0.5)]"
                        : "bg-[var(--ink-600)]"
                    }`}
                  />

                  {/* Block Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="type-mono text-[var(--bone)] font-medium text-base">
                        {dateStr}
                      </span>
                      {isLatest && <Badge variant="verdigris">Latest panel</Badge>}
                      {isBaseline && <Badge variant="dim">Baseline panel</Badge>}
                      <span className="type-meta text-[var(--dim)]">
                        {isLatest ? "Follow-up evaluation" : isBaseline ? "Initial enrollment checkup" : "Periodic panel"}
                      </span>
                    </div>
                    <span className="type-mono-sm text-[var(--faint)]">
                      {report.page_count ? `${report.page_count} pages` : "1 page"} · sha256: {report.file_hash.slice(0, 8)}…
                    </span>
                  </div>

                  {/* Report Card */}
                  <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5 mb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-[var(--r-6)] bg-[var(--ink-700)] flex items-center justify-center flex-shrink-0 ${
                            isLatest ? "text-[var(--verdigris)]" : "text-[var(--dim)]"
                          }`}
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="type-title text-[var(--bone)]">
                              {report.original_filename.replace(/\.pdf$/i, "").replace(/_/g, " ")}
                            </h4>
                            <Badge variant={report.status === "ready" ? "verdigris" : "ochre"}>
                              {report.status}
                            </Badge>
                          </div>
                          <p className="type-meta text-[var(--dim)] mt-0.5">
                            {report.original_filename} · {report.page_count || 1} page · Parsed by PyPDF/Surya-OCR
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" className="text-xs h-8">
                        View report
                      </Button>
                    </div>

                    {/* Sub-events inside this report block */}
                    <div className="mt-4 pt-4 border-t border-[var(--line-faint)] flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 type-meta text-[var(--dim)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--verdigris)]" />
                        <span className="type-label text-[var(--bone)]">Graph updated</span>
                        <span>—</span>
                        <span>Extracted entities & relations linked to knowledge graph topology</span>
                      </div>

                      <div className="p-3 bg-[var(--ink-900)] rounded-[var(--r-6)] border border-[var(--line-faint)] flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="type-label text-[var(--dim)] text-[11px] block mb-0.5">
                            Clinical inquiry
                          </span>
                          <p className="type-reading italic text-[var(--bone)] text-sm">
                            {isLatest
                              ? "“What is my hemoglobin level and how does it compare to previous readings?”"
                              : "“What does elevated creatinine indicate in this panel?”"}
                          </p>
                        </div>
                        <Button variant="ghost" className="text-[11px] h-7 px-2.5 flex-shrink-0">
                          Show answer
                        </Button>
                      </div>
                    </div>

                    {/* Longitudinal Observation Rows (§9.5) */}
                    <div className="mt-4 pt-4 border-t border-[var(--line-faint)]">
                      <span className="type-label text-[var(--dim)] block mb-3">
                        {isLatest ? "Measurements & longitudinal deltas" : "Baseline readings"}
                      </span>
                      <div className="space-y-2">
                        {/* Hemoglobin */}
                        <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)]">
                          <div className="flex items-center gap-3">
                            <span className="type-body font-medium text-[var(--bone)] w-28">
                              Hemoglobin
                            </span>
                            <span className="type-mono-sm text-[var(--dim)]">
                              {isLatest ? "13.8 → " : ""}
                              <span className="text-[var(--bone)] font-semibold">
                                {isLatest ? "14.1" : "13.8"}
                              </span>{" "}
                              {hemoTrend?.unit || "g/dL"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {isLatest ? (
                              <DeltaChip type="improving" label="+0.3 improving" />
                            ) : (
                              <Badge variant="verdigris">Normal</Badge>
                            )}
                            <span className="type-meta text-[var(--faint)] text-xs">
                              Ref: 13.5–17.5
                            </span>
                          </div>
                        </div>

                        {/* eGFR */}
                        <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)]">
                          <div className="flex items-center gap-3">
                            <span className="type-body font-medium text-[var(--bone)] w-28">
                              eGFR
                            </span>
                            <span className="type-mono-sm text-[var(--dim)]">
                              {isLatest ? "88 → " : ""}
                              <span className="text-[var(--bone)] font-semibold">
                                {isLatest ? "82" : "88"}
                              </span>{" "}
                              mL/min
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {isLatest ? (
                              <DeltaChip type="decrease" label="-6 slight decrease" />
                            ) : (
                              <Badge variant="verdigris">Normal</Badge>
                            )}
                            <span className="type-meta text-[var(--faint)] text-xs">
                              Ref: &gt; 60
                            </span>
                          </div>
                        </div>

                        {/* HbA1c */}
                        <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)]">
                          <div className="flex items-center gap-3">
                            <span className="type-body font-medium text-[var(--bone)] w-28">
                              HbA1c
                            </span>
                            <span className="type-mono-sm text-[var(--dim)]">
                              {isLatest ? "5.9 → " : ""}
                              <span className="text-[var(--bone)] font-semibold">
                                {isLatest ? "6.2" : "5.9"}
                              </span>{" "}
                              %
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {isLatest ? (
                              <DeltaChip type="increase" label="+0.3 increase" />
                            ) : (
                              <Badge variant="verdigris">Normal</Badge>
                            )}
                            <span className="type-meta text-[var(--faint)] text-xs">
                              Ref: &lt; 5.7
                            </span>
                          </div>
                        </div>

                        {/* Vitamin D */}
                        {isLatest ? (
                          <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)]">
                            <div className="flex items-center gap-3">
                              <span className="type-body font-medium text-[var(--bone)] w-28">
                                Vitamin D
                              </span>
                              <span className="type-mono-sm text-[var(--dim)]">
                                <span className="text-[var(--bone)] font-semibold">32</span> ng/mL
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <DeltaChip type="new" label="New result" />
                              <span className="type-meta text-[var(--faint)] text-xs">
                                Ref: 30–100
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] border border-dashed border-[var(--line-strong)] bg-transparent">
                            <span className="type-quote-sm italic text-[var(--dim)]">
                              Vitamin D — Not present in baseline report
                            </span>
                            <span className="type-mono-sm text-[var(--faint)]">N/A</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Rail (360px): Patient / Persona & Summary */}
        <div className="w-full lg:w-[360px] flex-shrink-0 flex flex-col gap-6">
          {/* Patient Persona Card (§9.5) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
              <h3 className="type-title text-[var(--bone)]">Patient persona</h3>
              <Badge variant="verdigris">{user?.status || "Active"}</Badge>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[var(--ink-700)] border border-[var(--line-strong)] flex items-center justify-center text-lg font-medium text-[var(--verdigris)]">
                {user?.display_label ? user.display_label.slice(0, 2).toUpperCase() : "AR"}
              </div>
              <div>
                <h4 className="type-title text-[var(--bone)]">
                  {user?.display_label || "Arjun R"}
                </h4>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="type-mono-sm text-[var(--dim)]">{effectiveUserId}</span>
                  <IconButton
                    size={20}
                    title={copiedId ? "Copied" : "Copy ID"}
                    onClick={handleCopyId}
                    className="border-transparent bg-transparent hover:bg-[var(--ink-700)] text-[var(--dim)] hover:text-[var(--bone)]"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </IconButton>
                </div>
              </div>
            </div>

            <div className="space-y-2 py-2 border-y border-[var(--line-faint)]">
              <div className="flex items-center justify-between">
                <span className="type-label text-[var(--dim)]">Registered</span>
                <span className="type-mono-sm text-[var(--bone)]">
                  {user?.created_at ? user.created_at.split("T")[0] : "2026-02-10"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="type-label text-[var(--dim)]">Sex</span>
                <span className="type-mono-sm text-[var(--bone)]">Male</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="type-label text-[var(--dim)]">Consent</span>
                <div className="flex items-center gap-1.5">
                  <LED status={user?.consent_accepted ? "online" : "offline"} size={7} />
                  <span className="type-mono-sm text-[var(--verdigris)]">
                    {user?.consent_accepted ? "Accepted · Valid" : "Pending"}
                  </span>
                </div>
              </div>
            </div>

            {/* Note box */}
            <div className="mt-4 p-2.5 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
              <p className="type-quote-sm italic text-[var(--dim)] text-xs">
                "Synthetic clinical persona for longitudinal research."
              </p>
            </div>

            {/* Delete persona with confirmation modal (§US-09) */}
            <div className="mt-4 pt-3 border-t border-[var(--line-faint)]">
              {!showDeleteConfirm ? (
                <Button
                  variant="solid-danger"
                  className="w-full justify-center text-xs h-8"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete persona
                </Button>
              ) : (
                <div className="p-3 rounded-[var(--r-6)] bg-[var(--madder)]/10 border border-[var(--madder)]/30 flex flex-col gap-2">
                  <div className="type-mono-sm text-[var(--madder)] font-medium text-xs">
                    Confirm deletion of {effectiveUserId}?
                  </div>
                  <p className="type-meta text-[var(--dim)] text-[11px]">
                    Cascades: purges Chroma vectors, uploads, and database rows.
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      variant="solid-danger"
                      className="h-7 text-xs flex-1 justify-center"
                      disabled={isDeleting}
                      onClick={handleDeletePersona}
                    >
                      {isDeleting ? "Purging..." : "Confirm Purge"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-7 text-xs px-2"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Report Versions Table (§9.5) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
            <h3 className="type-title text-[var(--bone)] mb-3 pb-2 border-b border-[var(--line-faint)]">
              Report versions ({reports.length})
            </h3>
            <div className="space-y-2">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-2 rounded-[var(--r-6)] bg-[var(--ink-700)]/40 border border-[var(--line-faint)]"
                >
                  <div>
                    <span className="type-mono-sm text-[var(--bone)] block">
                      {r.report_date || r.upload_time.split("T")[0]}
                    </span>
                    <span className="type-meta text-[var(--dim)] text-[11px] truncate max-w-[180px] block">
                      {r.original_filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <LED status="online" size={6} />
                    <span className="type-label text-[var(--verdigris)] text-xs">Indexed</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Observations Summary Card (§9.5) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
            <div className="mb-3 pb-2 border-b border-[var(--line-faint)]">
              <h3 className="type-title text-[var(--bone)]">Key observations</h3>
              <p className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
                Longitudinal shifts across panels
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="type-body text-xs text-[var(--dim)]">Hemoglobin</span>
                <span className="type-mono-sm text-[var(--verdigris)]">+0.3 g/dL Improving</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="type-body text-xs text-[var(--dim)]">eGFR</span>
                <span className="type-mono-sm text-[var(--ochre)]">−6 mL/min Decreasing</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="type-body text-xs text-[var(--dim)]">HbA1c</span>
                <span className="type-mono-sm text-[var(--madder)]">+0.3 % Increasing</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="type-body text-xs text-[var(--dim)]">Vitamin D</span>
                <span className="type-mono-sm text-[var(--cornflower)]">28 ng/mL New</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--line-faint)]">
              <Button variant="ghost" className="w-full justify-center text-xs h-8">
                View in graph
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
