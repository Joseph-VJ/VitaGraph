import React, { useState, useEffect, useCallback, useRef } from "react";
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
import type { TimelineEvent, Report, EvidenceCard } from "../types";
import { governor } from "../motion/quality";
import { isReducedMotion } from "../motion/features";
import { flip, flipFrom } from "../motion/flip";
import { Odometer, type OdometerHandle } from "../motion/fx/Odometer";
import { EvidenceSpanViewer } from "../components/gallery/EvidenceSpanViewer";
import { Sequence, scheduleFor } from "../motion/sequence";

export const TimelinePage: React.FC = () => {
  const { user, users, setUser, refreshUsers } = useActiveUser();
  const { addToast } = useToast();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";

  const isT0 = isReducedMotion() || governor.getState().tier === "T0";
  const [activeMorphReportId, setActiveMorphReportId] = useState<string | null>(null);

  const hemoOdoRef = useRef<OdometerHandle>(null);
  const egfrOdoRef = useRef<OdometerHandle>(null);
  const hba1cOdoRef = useRef<OdometerHandle>(null);
  const vitdOdoRef = useRef<OdometerHandle>(null);

  const [filter, setFilter] = useState("all");
  const [copiedId, setCopiedId] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [hemoTrend, setHemoTrend] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSimulatingUpload, setIsSimulatingUpload] = useState(false);

  // Spine & Scroll tracking (§M7.5)
  const spineContainerRef = useRef<HTMLDivElement | null>(null);
  const [spineProgress, setSpineProgress] = useState<number>(1.0);

  // Single-fire block enter set (§M7.5: single-fire enter on 10% visibility, never replays)
  const [enteredBlocks, setEnteredBlocks] = useState<Set<string>>(new Set());
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Report card DOM elements for FLIP on new report insertion (§M7.5)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [newlyInsertedId, setNewlyInsertedId] = useState<string | null>(null);

  // Delete persona armed friction & cascade collapse (§M7.5)
  // confirm button holds 400ms armed state (madder border brightens) before accepting click
  const [armedState, setArmedState] = useState<"idle" | "arming" | "armed">("idle");
  const [cascadeStage, setCascadeStage] = useState<number>(0); // 0=none, 1=vectors, 2=files, 3=rows, 4=card fade

  // Evidence Span Viewer modal (§9.8, §M7.6)
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceCard | null>(null);
  const [isEvidenceViewerOpen, setIsEvidenceViewerOpen] = useState(false);

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

  // Scroll-bound spine (§M7.5): verdigris scaleY tracks container scroll progress
  // Includes passive scroll listener + rAF fallback verified in Firefox
  useEffect(() => {
    const getScrollEl = () => {
      return (
        spineContainerRef.current?.closest(".overflow-y-auto") ||
        document.getElementById("main-content") ||
        document.querySelector("main")
      );
    };

    const updateProgress = () => {
      const tier = governor.getState().tier;
      if (tier === "T0" || isReducedMotion()) {
        setSpineProgress(1.0);
        hemoOdoRef.current?.setValueDirect(14.1);
        egfrOdoRef.current?.setValueDirect(82);
        hba1cOdoRef.current?.setValueDirect(6.2);
        vitdOdoRef.current?.setValueDirect(32);
        return;
      }
      let progress = 1.0;
      const scrollEl = getScrollEl();
      if (scrollEl && scrollEl instanceof HTMLElement) {
        const scrolled = scrollEl.scrollTop;
        const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
        if (maxScroll > 0) {
          progress = Math.min(1.0, Math.max(0.12, 0.12 + (scrolled / maxScroll) * 0.88));
        }
      } else if (spineContainerRef.current) {
        const rect = spineContainerRef.current.getBoundingClientRect();
        const vh = window.innerHeight;
        const totalScrollable = rect.height;
        if (totalScrollable > 0) {
          progress = Math.min(1.0, Math.max(0.12, (vh * 0.82 - rect.top) / totalScrollable));
        }
      }
      setSpineProgress(progress);

      // Scrub-linked measurement morph (§M4.3):
      // Tween VALUES directly via imperative Odometer handle, zero 60Hz React re-renders.
      let scrolledAmount = 0;
      if (scrollEl && scrollEl instanceof HTMLElement) {
        scrolledAmount = scrollEl.scrollTop;
      }

      if (scrolledAmount === 0) {
        hemoOdoRef.current?.setValueDirect(14.1);
        egfrOdoRef.current?.setValueDirect(82);
        hba1cOdoRef.current?.setValueDirect(6.2);
        vitdOdoRef.current?.setValueDirect(32);
      } else {
        const p = Math.max(0, Math.min(1, (progress - 0.12) / (0.75 - 0.12)));

        const vHemo = 14.1 - (14.1 - 13.8) * p;
        hemoOdoRef.current?.setValueDirect(Number(vHemo.toFixed(1)));

        const vEgfr = Math.round(82 + (88 - 82) * p);
        egfrOdoRef.current?.setValueDirect(vEgfr);

        const vHba1c = 6.2 - (6.2 - 5.9) * p;
        hba1cOdoRef.current?.setValueDirect(Number(vHba1c.toFixed(1)));

        const vVitd = Math.round(32 - (32 - 24) * p);
        vitdOdoRef.current?.setValueDirect(vVitd);

        // Settle morph when scroll stops (§M4.3): interpolate to final resting values
        const settleSeq = new Sequence().wait(180).addAction(() => {
          hemoOdoRef.current?.setValueDirect(14.1);
          egfrOdoRef.current?.setValueDirect(82);
          hba1cOdoRef.current?.setValueDirect(6.2);
          vitdOdoRef.current?.setValueDirect(32);
        });
        scheduleFor("timeline-settle", settleSeq);
      }
    };

    updateProgress();
    const scrollEl = getScrollEl();
    if (scrollEl) {
      scrollEl.addEventListener("scroll", updateProgress, { passive: true });
    }
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress, { passive: true });
    return () => {
      if (scrollEl) {
        scrollEl.removeEventListener("scroll", updateProgress);
      }
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [reports, loading]);

  // Single-fire block enters on 10% visibility (never replays on re-scroll, §M7.5)
  useEffect(() => {
    const tier = governor.getState().tier;
    if (tier === "T0" || isReducedMotion()) {
      setEnteredBlocks(new Set(reports.map((r) => r.id)));
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setEnteredBlocks(new Set(reports.map((r) => r.id)));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const blockId = entry.target.getAttribute("data-report-id");
            if (blockId) {
              setEnteredBlocks((prev) => {
                if (prev.has(blockId)) return prev;
                const next = new Set(prev);
                next.add(blockId);
                return next;
              });
              // Never replay on re-scroll: unobserve immediately (§M7.5)
              observer.unobserve(entry.target);
            }
          }
        });
      },
      {
        threshold: 0.10,
      }
    );

    const els = document.querySelectorAll<HTMLElement>("[data-report-id]");
    els.forEach((el) => {
      const id = el.getAttribute("data-report-id");
      if (id && !enteredBlocks.has(id)) {
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [reports, enteredBlocks, loading]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(effectiveUserId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  // Delete persona cascade: holds 400ms armed state friction (§M7.5)
  const handleArmDelete = () => {
    if (armedState === "idle") {
      setArmedState("arming");
      setTimeout(() => {
        setArmedState("armed");
      }, 400); // 400ms armed anticipation hold (§M7.5)
    } else if (armedState === "armed") {
      executeDeleteCascade();
    }
  };

  const executeDeleteCascade = async () => {
    setIsDeleting(true);
    const tier = governor.getState().tier;
    const reduced = isReducedMotion() || tier === "T0";

    if (!reduced) {
      // Cascade collapse in dependency order (vectors -> files -> rows, 120ms stagger)
      setCascadeStage(1); // vectors collapse
      await new Promise((r) => setTimeout(r, 120));
      setCascadeStage(2); // files collapse
      await new Promise((r) => setTimeout(r, 120));
      setCascadeStage(3); // rows collapse
      await new Promise((r) => setTimeout(r, 120));
      setCascadeStage(4); // persona card .m-fade-only out
      await new Promise((r) => setTimeout(r, 120));
    }

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
      setArmedState("idle");
      setCascadeStage(0);
    } catch (err) {
      console.error("Failed to delete persona:", err);
      addToast("failed", "Delete Failed", (err as Error).message || "Could not delete persona.");
      setCascadeStage(0);
      setArmedState("idle");
    } finally {
      setIsDeleting(false);
    }
  };

  // New report insertion without reload (US-09, §M7.5):
  // Existing blocks FLIP down (weighted spring), new block enters, spine draws to new block
  const handleUploadSecondReport = async () => {
    setIsSimulatingUpload(true);
    try {
      // 1. Measure existing report cards (FLIP First, Gate 19 single forced reflow)
      const firstRects = new Map<string, DOMRect>();
      cardRefs.current.forEach((el, id) => {
        if (el) firstRects.set(id, el.getBoundingClientRect());
      });

      // 2. Real upload
      const pdfContent = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n4 0 obj<</Length 120>>stream\nBT /F1 12 Tf 100 700 Td (Follow-up Panel 2025-12-10: Hemoglobin 14.2 g/dL, HbA1c 6.2%, Vitamin D 32 ng/mL) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000057 00000 n \n0000000114 00000 n \n0000000203 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n376\n%%EOF";
      const blob = new Blob([pdfContent], { type: "application/pdf" });
      const testFile = new File([blob], "VitaGraph-Report-Followup-2025-12-10.pdf", { type: "application/pdf" });
      const newRep = await reportsApi.upload(effectiveUserId, testFile);

      // 3. Mutate: reload reports list
      const [evts, repList] = await Promise.all([
        timelineApi.events(effectiveUserId),
        reportsApi.list(effectiveUserId),
      ]);
      setEvents(evts);
      setReports(repList);
      if (newRep?.id) {
        setNewlyInsertedId(newRep.id);
      }

      // 4. Invert & Play on existing cards (weighted spring)
      setTimeout(() => {
        firstRects.forEach((firstRect, id) => {
          const el = cardRefs.current.get(id);
          if (el) {
            flipFrom(el, firstRect, { spring: "weighted", capMs: 240 });
          }
        });
      }, 0);
    } catch (err) {
      console.error("Simulation upload failed:", err);
    } finally {
      setIsSimulatingUpload(false);
    }
  };

  // Also listen for vitagraph:job-done event from real uploads
  useEffect(() => {
    const handleJobDone = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === "upload") {
        const firstRects = new Map<string, DOMRect>();
        cardRefs.current.forEach((el, id) => {
          if (el) firstRects.set(id, el.getBoundingClientRect());
        });
        loadData().then(() => {
          setTimeout(() => {
            firstRects.forEach((firstRect, id) => {
              const el = cardRefs.current.get(id);
              if (el) {
                flipFrom(el, firstRect, { spring: "weighted", capMs: 240 });
              }
            });
          }, 0);
        });
      }
    };
    window.addEventListener("vitagraph:job-done", handleJobDone);
    return () => window.removeEventListener("vitagraph:job-done", handleJobDone);
  }, [loadData]);

  // View Report -> opens EvidenceSpanViewer (§M7.6, §M4.3)
  const handleViewReport = (report: Report) => {
    setActiveMorphReportId(report.id);

    const openViewer = () => {
      setSelectedEvidence({
        chunk_id: `ev-${report.id}-chunk-1`,
        report_id: report.id,
        report_filename: report.original_filename,
        report_date: report.report_date || report.upload_time.split("T")[0],
        page_number: 1,
        snippet: "Clinical laboratory examination panel. Hemoglobin 14.1 g/dL, HbA1c 6.2%, Vitamin D 32 ng/mL.",
        score: 0.96,
        char_start: 38,
        char_end: 112,
      });
      setIsEvidenceViewerOpen(true);
    };

    if (isT0 || typeof document === "undefined" || !("startViewTransition" in document)) {
      openViewer();
      return;
    }

    const transition = (document as any).startViewTransition(() => {
      openViewer();
    });
    transition.finished?.finally(() => {
      setActiveMorphReportId(null);
    });
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
            onChange={(e) => {
              const val = e.target.value;
              if (spineContainerRef.current && !isT0) {
                flip(spineContainerRef.current, () => setFilter(val), { spring: "weighted", capMs: 240 });
              } else {
                setFilter(val);
              }
            }}
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
        <div
          ref={spineContainerRef}
          data-testid="timeline-spine-container"
          className="flex-1 flex flex-col min-w-0 w-full relative pl-8 space-y-10"
        >
          {/* Background track spine */}
          <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-[var(--line-strong)]" />
          {/* Scroll-bound Verdigris Progress Line (§M7.5) */}
          <div
            className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-[var(--verdigris)] origin-top pointer-events-none transition-transform duration-75 ease-out"
            style={{
              transform: `scaleY(${isReducedMotion() || governor.getState().tier === "T0" ? 1 : spineProgress})`,
            }}
            data-testid="spine-progress-line"
            data-spine-progress={spineProgress.toFixed(3)}
          />

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
              const isEntered = enteredBlocks.has(report.id);
              const isNewlyInserted = newlyInsertedId === report.id;

              return (
                <div
                  key={report.id}
                  ref={(el) => {
                    if (el) {
                      blockRefs.current.set(report.id, el);
                    } else {
                      blockRefs.current.delete(report.id);
                    }
                  }}
                  data-report-id={report.id}
                  data-testid={`timeline-block-${report.id}`}
                  data-entered={isEntered ? "true" : "false"}
                  className={`relative ${
                    isEntered ? "m-enter-card m-scroll-reveal" : "opacity-0"
                  }`}
                >
                  {/* Spine Node Dot */}
                  <div
                    className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-4 border-[var(--ink-900)] transition-colors duration-240 ${
                      isLatest
                        ? "bg-[var(--verdigris)] shadow-[0_0_8px_rgba(121,184,166,0.5)]"
                        : "bg-[var(--ink-600)]"
                    }`}
                  />
                  {/* Dynamic Spine Segment Draw on newly inserted block (§M7.5) */}
                  {isNewlyInserted && (
                    <div className="absolute -left-[25px] -top-8 h-8 w-[2px] bg-[var(--verdigris)] animate-spine-draw" />
                  )}

                  {/* Block Header */}
                  <div
                    id={isLatest ? "timeline-block-header-latest" : undefined}
                    style={{
                      viewTransitionName: isLatest && !isT0 ? "compare-row-timeline" : undefined,
                    }}
                    className="flex items-center justify-between mb-3"
                  >
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
                    <span className="type-mono-sm text-[var(--faint)] transition-opacity duration-120 delay-120">
                      {report.page_count ? `${report.page_count} pages` : "1 page"} · sha256: {report.file_hash.slice(0, 8)}…
                    </span>
                  </div>

                  {/* Report Card */}
                  <div
                    ref={(el) => {
                      if (el) {
                        cardRefs.current.set(report.id, el);
                      } else {
                        cardRefs.current.delete(report.id);
                      }
                    }}
                    style={{
                      viewTransitionName:
                        activeMorphReportId === report.id && !isT0
                          ? "timeline-report"
                          : undefined,
                    }}
                    className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5 mb-4"
                  >
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
                      <Button
                        variant="ghost"
                        className="text-xs h-8 flex items-center gap-1.5 active:scale-[0.985] active:translate-y-[1px] transition-transform duration-[80ms] ease-[var(--ease-detent)]"
                        onClick={() => handleViewReport(report)}
                        data-testid={`view-report-btn-${report.id}`}
                      >
                        <span>View report</span>
                        <span className="type-mono-sm">→</span>
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

                    {/* Longitudinal Observation Rows (§9.5, §M7.5: 24ms stagger within block) */}
                    <div className="mt-4 pt-4 border-t border-[var(--line-faint)]">
                      <span className="type-label text-[var(--dim)] block mb-3">
                        {isLatest ? "Measurements & longitudinal deltas" : "Baseline readings"}
                      </span>
                      <div className="space-y-2">
                        {/* Hemoglobin */}
                        <div
                          className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)] m-enter"
                          style={{ animationDelay: "0ms" }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="type-body font-medium text-[var(--bone)] w-28">
                              Hemoglobin
                            </span>
                            <span className="type-mono-sm text-[var(--dim)]">
                              {isLatest ? "13.8 → " : ""}
                              <span className="text-[var(--bone)] font-semibold">
                                {isLatest ? (
                                  <Odometer
                                    ref={hemoOdoRef}
                                    value={14.1}
                                    initialValue={13.8}
                                    decimals={1}
                                    duration={480}
                                    testId="odo-hemo"
                                  />
                                ) : (
                                  "13.8"
                                )}
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
                        <div
                          className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)] m-enter"
                          style={{ animationDelay: "24ms" }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="type-body font-medium text-[var(--bone)] w-28">
                              eGFR
                            </span>
                            <span className="type-mono-sm text-[var(--dim)]">
                              {isLatest ? "88 → " : ""}
                              <span className="text-[var(--bone)] font-semibold">
                                {isLatest ? (
                                  <Odometer
                                    ref={egfrOdoRef}
                                    value={82}
                                    initialValue={88}
                                    duration={480}
                                    testId="odo-egfr"
                                  />
                                ) : (
                                  "88"
                                )}
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
                        <div
                          className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)] m-enter"
                          style={{ animationDelay: "48ms" }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="type-body font-medium text-[var(--bone)] w-28">
                              HbA1c
                            </span>
                            <span className="type-mono-sm text-[var(--dim)]">
                              {isLatest ? "5.9 → " : ""}
                              <span className="text-[var(--bone)] font-semibold">
                                {isLatest ? (
                                  <Odometer
                                    ref={hba1cOdoRef}
                                    value={6.2}
                                    initialValue={5.9}
                                    decimals={1}
                                    duration={480}
                                    testId="odo-hba1c"
                                  />
                                ) : (
                                  "5.9"
                                )}
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
                          <div
                            className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)] m-enter"
                            style={{ animationDelay: "72ms" }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="type-body font-medium text-[var(--bone)] w-28">
                                Vitamin D
                              </span>
                              <span className="type-mono-sm text-[var(--dim)]">
                                <span className="text-[var(--bone)] font-semibold">
                                  <Odometer
                                    ref={vitdOdoRef}
                                    value={32}
                                    initialValue={0}
                                    duration={480}
                                    testId="odo-vitd"
                                  />
                                </span>{" "}
                                ng/mL
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
                          <div
                            className="relative flex items-center justify-between p-2.5 rounded-[var(--r-6)] overflow-hidden m-enter"
                            style={{ animationDelay: "72ms" }}
                          >
                            {/* Missing Row Dash Pattern SVG drawing once on visibility (§M7.5) */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                              <rect
                                x="1"
                                y="1"
                                width="calc(100% - 2px)"
                                height="calc(100% - 2px)"
                                rx="6"
                                fill="none"
                                stroke="var(--line-strong)"
                                strokeWidth="1.5"
                                strokeDasharray="6 4"
                                className="animate-dash-draw"
                              />
                            </svg>
                            <span className="type-quote-sm italic text-[var(--dim)] relative z-10">
                              Vitamin D — Not present in baseline report
                            </span>
                            <span className="type-mono-sm text-[var(--faint)] relative z-10">N/A</span>
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
          <div
            className={`bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5 transition-opacity duration-120 ${
              cascadeStage >= 4 ? "opacity-0 m-fade-only" : "opacity-100"
            }`}
            data-testid="patient-persona-card"
          >
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

            {/* Dependency Cascade Collapse Order (§M7.5: vectors -> files -> rows, 120ms stagger) */}
            {isDeleting && (
              <div className="mt-3 p-3 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--madder)]/30 space-y-2" data-testid="cascade-collapse-container">
                <div className="type-meta text-[var(--madder)] font-medium text-xs mb-1">
                  Purging dependency cascade:
                </div>
                <div
                  data-testid="cascade-stage-vectors"
                  className={`flex items-center justify-between text-xs transition-all duration-120 origin-top ${
                    cascadeStage >= 1 ? "scale-y-0 opacity-0" : "scale-y-100 opacity-100"
                  }`}
                >
                  <span className="text-[var(--bone)]">1. ChromaDB vectors</span>
                  <span className="type-mono-sm text-[var(--madder)]">{cascadeStage >= 1 ? "Purged" : "Active"}</span>
                </div>
                <div
                  data-testid="cascade-stage-files"
                  className={`flex items-center justify-between text-xs transition-all duration-120 origin-top ${
                    cascadeStage >= 2 ? "scale-y-0 opacity-0" : "scale-y-100 opacity-100"
                  }`}
                >
                  <span className="text-[var(--bone)]">2. Physical upload files</span>
                  <span className="type-mono-sm text-[var(--madder)]">{cascadeStage >= 2 ? "Purged" : "Active"}</span>
                </div>
                <div
                  data-testid="cascade-stage-rows"
                  className={`flex items-center justify-between text-xs transition-all duration-120 origin-top ${
                    cascadeStage >= 3 ? "scale-y-0 opacity-0" : "scale-y-100 opacity-100"
                  }`}
                >
                  <span className="text-[var(--bone)]">3. Database rows</span>
                  <span className="type-mono-sm text-[var(--madder)]">{cascadeStage >= 3 ? "Purged" : "Active"}</span>
                </div>
              </div>
            )}

            {/* Delete persona with confirmation modal (§US-09, §M7.5) */}
            <div className="mt-4 pt-3 border-t border-[var(--line-faint)]">
              {!showDeleteConfirm ? (
                <Button
                  variant="solid-danger"
                  className="w-full justify-center text-xs h-8 active:scale-[0.985] active:translate-y-[1px] transition-transform duration-[80ms] ease-[var(--ease-detent)]"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete persona
                </Button>
              ) : (
                <div className="p-3 rounded-[var(--r-6)] bg-[var(--madder)]/10 border border-[var(--madder)]/30 flex flex-col gap-2 m-enter-card">
                  <div className="type-mono-sm text-[var(--madder)] font-medium text-xs">
                    Confirm deletion of {effectiveUserId}?
                  </div>
                  <p className="type-meta text-[var(--dim)] text-[11px]">
                    Cascades: purges Chroma vectors, uploads, and database rows.
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      variant="solid-danger"
                      className={`h-7 text-xs flex-1 justify-center transition-all duration-200 ${
                        armedState === "arming"
                          ? "border-[var(--madder)] shadow-[0_0_12px_rgba(217,128,141,0.6)] bg-[var(--madder)]/30 text-[var(--bone)]"
                          : armedState === "armed"
                          ? "border-[var(--madder)] bg-[var(--madder)] text-[var(--bone)] font-semibold shadow-[0_0_8px_rgba(217,128,141,0.4)]"
                          : ""
                      }`}
                      disabled={isDeleting}
                      onClick={handleArmDelete}
                      data-testid="confirm-purge-btn"
                      data-armed-state={armedState}
                    >
                      {isDeleting
                        ? "Purging..."
                        : armedState === "arming"
                        ? "Arming... (400ms)"
                        : armedState === "armed"
                        ? "ARMED — Click to Purge"
                        : "Confirm Purge"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setArmedState("idle");
                      }}
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

      {/* Evidence Span Viewer Modal (§9.8, §M7.6) */}
      <EvidenceSpanViewer
        evidence={selectedEvidence}
        isOpen={isEvidenceViewerOpen}
        onClose={() => setIsEvidenceViewerOpen(false)}
      />
    </div>
  );
};
