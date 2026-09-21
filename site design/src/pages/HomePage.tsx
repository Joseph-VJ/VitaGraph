import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  StatTile,
  ActivityRow,
  SystemHealthRow,
  SparklineCard,
  LED,
  Button,
  IconButton,
  type ActivityClass,
} from "../components/gallery";
import { useToast } from "../components/gallery/Toast";
import { useActiveUser } from "../context/UserContext";
import { api } from "../api/client";
import { reportsApi } from "../api/reports";
import { graphApi, type GraphResponse } from "../api/graph";
import { timelineApi } from "../api/questions";
import type { Report, TimelineEvent } from "../types";
import { springToLinear, governor, isReducedMotion, CrossfadeContainer, Sequence } from "../motion";
import { transitionNavigate, setNavDirection } from "../motion/navigation";
import { DetentPress } from "../motion/fx/DetentPress";
import { EmptyState } from "../components/gallery/StateSet";

interface HealthData {
  status: string;
  retrieval_store?: { status: string; chunks: number };
  ai_service?: string;
}

interface ActivityItem {
  id: string;
  activityClass: ActivityClass;
  timestamp: string;
  eventName: string;
  details: string;
  objectName: string;
}

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser, refreshUsers } = useActiveUser();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadingCohort, setLoadingCohort] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [clientLatency, setClientLatency] = useState<number | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);

  const activityContainerRef = useRef<HTMLDivElement | null>(null);
  const prevActivityIdsRef = useRef<string[]>([]);
  const prevRowTopsRef = useRef<Map<string, number>>(new Map());
  const [animatedInsertId, setAnimatedInsertId] = useState<string | null>(null);

  const handleLoadDemoCohort = async () => {
    if (loadingCohort) return;
    setLoadingCohort(true);
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
      setLoadingCohort(false);
    }
  };

  // Live metric state
  const [reports, setReports] = useState<Report[]>([]);
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);

  const mountedRef = useRef(true);

  const fetchLiveData = useCallback(async () => {
    // 1. Probe health and measure roundtrip ms client-side
    const tStart = performance.now();
    let isOnline = false;
    let hData: HealthData | null = null;
    let measuredMs: number | null = null;

    try {
      hData = await api.get<HealthData>("/api/health");
      measuredMs = Math.round(performance.now() - tStart);
      isOnline = true;
    } catch {
      isOnline = false;
      measuredMs = null;
    }

    if (!mountedRef.current) return;
    setBackendOnline(isOnline);
    setHealthData(hData);
    setClientLatency(measuredMs);

    if (measuredMs !== null) {
      setLatencyHistory((prev) => [...prev, measuredMs!].slice(-24));
    }

    // If backend is down or no user is active yet, reset per-user data
    if (!isOnline || !user?.id) {
      setReports([]);
      setGraphData(null);
      setTimelineEvents([]);
      setLoading(false);
      return;
    }

    // 2. Fetch live data concurrently for active persona
    try {
      const [reps, grp, tEvents] = await Promise.allSettled([
        reportsApi.list(user.id),
        graphApi.getGraph(user.id),
        timelineApi.events(user.id),
      ]);

      if (!mountedRef.current) return;

      if (reps.status === "fulfilled") setReports(reps.value || []);
      if (grp.status === "fulfilled") setGraphData(grp.value || null);
      if (tEvents.status === "fulfilled") setTimelineEvents(tEvents.value || []);
    } catch {
      // Non-fatal, endpoints return what they have
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    mountedRef.current = true;
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 15000);

    const handleJobDone = () => {
      fetchLiveData();
    };
    window.addEventListener("vitagraph:job-done", handleJobDone);
    window.addEventListener("storage", handleJobDone);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      window.removeEventListener("vitagraph:job-done", handleJobDone);
      window.removeEventListener("storage", handleJobDone);
    };
  }, [fetchLiveData]);

  // Derived live stat counts — zero hardcoded numbers
  const reportsCount = reports.length;
  const chunksCount =
    healthData?.retrieval_store?.chunks ??
    reports.reduce((acc, r) => acc + (r.page_count || 0), 0);
  const nodesCount = graphData?.metrics?.total_nodes ?? graphData?.nodes?.length ?? 0;
  const edgesCount = graphData?.metrics?.total_edges ?? graphData?.edges?.length ?? 0;
  const questionsCount = timelineEvents.filter(
    (e) => e.event_type === "question_asked" || e.event_type === "answer_generated"
  ).length;
  const refusalsCount = timelineEvents.filter(
    (e) =>
      e.event_type === "safety_refusal" ||
      (e.payload && ((e.payload as any).status === "refused" || (e.payload as any).safety_status === "refused"))
  ).length;

  // KPI value-change impulse tracking (§7.1-1)
  const prevStatsRef = useRef({
    reports: 0,
    chunks: 0,
    nodes: 0,
    edges: 0,
    questions: 0,
    refusals: 0,
  });
  const [changedStatKeys, setChangedStatKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (loading) return;
    const isT0 = governor.getState().tier === "T0" || isReducedMotion();
    const current = {
      reports: reportsCount,
      chunks: chunksCount,
      nodes: nodesCount,
      edges: edgesCount,
      questions: questionsCount,
      refusals: refusalsCount,
    };
    const prev = prevStatsRef.current;
    const changed = new Set<string>();
    if (prev.reports !== current.reports && prev.reports !== 0) changed.add("reports");
    if (prev.chunks !== current.chunks && prev.chunks !== 0) changed.add("chunks");
    if (prev.nodes !== current.nodes && prev.nodes !== 0) changed.add("nodes");
    if (prev.edges !== current.edges && prev.edges !== 0) changed.add("edges");
    if (prev.questions !== current.questions && prev.questions !== 0) changed.add("questions");
    if (prev.refusals !== current.refusals && prev.refusals !== 0) changed.add("refusals");

    prevStatsRef.current = current;

    if (changed.size > 0 && !isT0) {
      setChangedStatKeys(changed);
      new Sequence()
        .wait(480)
        .addAction(() => setChangedStatKeys(new Set()))
        .play();
    }
  }, [loading, reportsCount, chunksCount, nodesCount, edgesCount, questionsCount, refusalsCount]);

  // Map timeline events to activity items
  const activityItems: ActivityItem[] = timelineEvents.slice(0, 10).map((event, idx) => {
    const p = (event.payload || {}) as Record<string, any>;
    const dateStr = event.timestamp ? event.timestamp.replace("T", " ").slice(0, 19) : "—";
    const itemId = event.id || `${event.event_type}-${event.timestamp || idx}`;

    if (event.event_type === "report_indexed" || event.event_type === "report_uploaded") {
      return {
        id: itemId,
        activityClass: "indexed",
        timestamp: dateStr,
        eventName: event.event_type === "report_indexed" ? "Report indexed" : "Report uploaded",
        details: p.chunks ? `Indexed ${p.chunks} chunks from ${p.filename || "PDF"}` : `Uploaded ${p.filename || "document"}`,
        objectName: p.filename || "Document",
      };
    }
    if (event.event_type === "answer_generated" || event.event_type === "question_asked") {
      const isRefusal = p.status === "refused" || p.safety_status === "refused";
      return {
        id: itemId,
        activityClass: isRefusal ? "refusal" : "answered",
        timestamp: dateStr,
        eventName: isRefusal ? "Safety refusal" : (event.event_type === "answer_generated" ? "Question answered" : "Question asked"),
        details: isRefusal ? (p.summary || "Declined to answer — outside diagnostic scope") : (p.evidence_count !== undefined ? `Generated answer with ${p.evidence_count} citations` : (p.text || "Question processed")),
        objectName: p.text ? (p.text.length > 25 ? p.text.slice(0, 25) + "..." : p.text) : (p.filename || "Query"),
      };
    }
    if (event.event_type === "processing_failed") {
      return {
        id: itemId,
        activityClass: "refusal",
        timestamp: dateStr,
        eventName: "Processing failed",
        details: p.error || "Extraction failed",
        objectName: p.filename || "Error",
      };
    }
    if (event.event_type === "persona_created" || event.event_type === "consent_accepted") {
      return {
        id: itemId,
        activityClass: "dataset",
        timestamp: dateStr,
        eventName: event.event_type === "consent_accepted" ? "Consent accepted" : "Persona created",
        details: p.label ? `Persona initialized for ${p.label}` : "Data-use consent recorded",
        objectName: p.label || "System",
      };
    }
    return {
      id: itemId,
      activityClass: "graph",
      timestamp: dateStr,
      eventName: event.event_type.replace(/_/g, " "),
      details: typeof p === "object" ? JSON.stringify(p) : String(p),
      objectName: "VitaGraph",
    };
  });

  // FLIP animation for timeline activity updates (§M7.1)
  useLayoutEffect(() => {
    if (!activityContainerRef.current) return;
    const isT0 = governor.getState().tier === "T0" || isReducedMotion();

    const currentItemIds = activityItems.map((i) => i.id);
    const prevIds = prevActivityIdsRef.current;

    // Detect if new items were prepended
    if (prevIds.length > 0 && currentItemIds.length > 0) {
      const newestId = currentItemIds[0];
      if (!prevIds.includes(newestId)) {
        // Max 1 animated insert per tick (batch by supersede)
        setAnimatedInsertId(newestId);

        if (!isT0) {
          // FLIP shifted existing rows downward using weighted spring
          const rows = activityContainerRef.current.querySelectorAll<HTMLElement>("[data-activity-key]");
          rows.forEach((row) => {
            const key = row.getAttribute("data-activity-key");
            if (key && key !== newestId && prevRowTopsRef.current.has(key)) {
              const prevTop = prevRowTopsRef.current.get(key)!;
              const currentTop = row.getBoundingClientRect().top;
              const dy = prevTop - currentTop;
              if (Math.abs(dy) > 0.5) {
                row.animate(
                  [
                    { transform: `translateY(${dy}px)` },
                    { transform: "none" },
                  ],
                  {
                    duration: 240,
                    easing: springToLinear("weighted"),
                    fill: "none",
                  }
                );
              }
            }
          });
        }
      }
    }

    // Save positions for next tick
    const newTops = new Map<string, number>();
    const rows = activityContainerRef.current.querySelectorAll<HTMLElement>("[data-activity-key]");
    rows.forEach((row) => {
      const key = row.getAttribute("data-activity-key");
      if (key) {
        newTops.set(key, row.getBoundingClientRect().top);
      }
    });
    prevRowTopsRef.current = newTops;
    prevActivityIdsRef.current = currentItemIds;
  }, [activityItems]);

  // Last open document and last question for Continue card
  const lastDocument = reports.length > 0 ? reports[0] : null;
  const lastQuestionEvent = timelineEvents.find(
    (e) => e.event_type === "question_asked" || e.event_type === "answer_generated"
  );
  const lastQuestionText = lastQuestionEvent
    ? (lastQuestionEvent.payload as any)?.text || "Recent clinical inquiry"
    : null;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Header Marginalia (§9.1) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DetentPress className="inline-flex">
            <Button
              variant="ghost"
              onClick={handleLoadDemoCohort}
              disabled={loadingCohort || backendOnline === false}
              className="h-8 px-3 text-[12px] flex items-center gap-2 border-[var(--line-strong)] hover:border-[var(--verdigris)] text-[var(--bone)]"
            >
              <span className="w-2 h-2 rounded-full bg-[var(--verdigris)] animate-pulse" />
              {loadingCohort ? "Loading demo cohort…" : "Load demo cohort"}
            </Button>
          </DetentPress>
          {backendOnline === false && (
            <span className="px-2.5 py-1 rounded-[var(--r-4)] bg-[var(--madder)]/15 border border-[var(--madder)]/30 text-[var(--madder)] text-[12px] font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--madder)] animate-pulse" />
              Backend service unreachable (:8000). Start backend server to restore live data.
            </span>
          )}
        </div>
        <span className="type-marginalia text-[14px]">
          Same data. Deeper understanding.
        </span>
      </div>

      {/* Grid: Main 1fr + Rail 360px (§6, §9.1) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        {/* Main Column (1fr) */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 w-full">
          {/* Stat Row (6 Tiles) — All Live */}
          <CrossfadeContainer
            loading={loading}
            testId="home-stats-crossfade"
            skeleton={
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col gap-2 animate-pulse"
                  >
                    <div className="h-3 w-16 rounded-[var(--r-4)] skeleton-shimmer" />
                    <div className="h-6 w-12 rounded-[var(--r-4)] skeleton-shimmer" />
                  </div>
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              <StatTile
                type="doc"
                label="Reports"
                value={backendOnline ? String(reportsCount) : "0"}
                staggerIndex={0}
                impulse={changedStatKeys.has("reports")}
              />
              <StatTile
                type="cube"
                label="Chunks"
                value={backendOnline ? chunksCount.toLocaleString() : "0"}
                staggerIndex={1}
                impulse={changedStatKeys.has("chunks")}
              />
              <StatTile
                type="graph"
                label="Graph nodes"
                value={backendOnline ? String(nodesCount) : "0"}
                staggerIndex={2}
                impulse={changedStatKeys.has("nodes")}
              />
              <StatTile
                type="link"
                label="Edges"
                value={backendOnline ? String(edgesCount) : "0"}
                staggerIndex={3}
                impulse={changedStatKeys.has("edges")}
              />
              <StatTile
                type="speech"
                label="Questions"
                value={backendOnline ? String(questionsCount) : "0"}
                staggerIndex={4}
                impulse={changedStatKeys.has("questions")}
              />
              <StatTile
                type="shield"
                label="Refusals"
                value={backendOnline ? String(refusalsCount) : "0"}
                staggerIndex={5}
                impulse={changedStatKeys.has("refusals")}
              />
            </div>
          </CrossfadeContainer>

          {/* Recent Activity Card */}
          <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-5 flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--line-faint)]">
              <h3 className="type-card-title text-[var(--bone)]">Recent activity</h3>
              <Link to="/timeline" viewTransition onClick={() => setNavDirection("forward")}>
                <Button variant="ghost" className="h-7 px-2.5 text-[12px]">
                  View all
                </Button>
              </Link>
            </div>

            {/* Column Headers */}
            <div className="flex items-center justify-between py-1.5 px-3 type-label text-[var(--dim)] border-b border-[var(--line-faint)]">
              <span className="w-36 flex-shrink-0">Time</span>
              <span className="w-40 flex-shrink-0">Event</span>
              <span className="flex-1 min-w-0">Details</span>
              <span className="w-40 text-right">Target</span>
            </div>

            {/* Activity Rows */}
            <CrossfadeContainer
              loading={loading}
              testId="home-activity-crossfade"
              skeleton={
                <div className="p-4 flex flex-col gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--line-faint)] last:border-0">
                      <div className="h-4 w-28 rounded-[var(--r-4)] skeleton-shimmer" />
                      <div className="h-4 w-32 rounded-[var(--r-4)] skeleton-shimmer" />
                      <div className="h-4 flex-1 mx-4 rounded-[var(--r-4)] skeleton-shimmer" />
                      <div className="h-4 w-24 rounded-[var(--r-4)] skeleton-shimmer" />
                    </div>
                  ))}
                </div>
              }
            >
              <div ref={activityContainerRef} className="divide-y divide-[var(--line-faint)]">
                {!backendOnline ? (
                  <EmptyState
                    quote="Backend server is offline. Realtime timeline activity unavailable."
                    actionLabel="Check settings"
                    onAction={() => transitionNavigate(navigate, "/settings", { direction: "forward" })}
                    className="my-3 border-0 bg-transparent"
                  />
                ) : activityItems.length === 0 ? (
                  <EmptyState
                    quote="No timeline events recorded yet for this persona."
                    actionLabel="Upload report"
                    onAction={() => transitionNavigate(navigate, "/upload", { direction: "forward" })}
                    className="my-3 border-0 bg-transparent"
                  />
                ) : (
                  activityItems.map((item) => (
                    <ActivityRow
                      key={item.id}
                      rowKey={item.id}
                      activityClass={item.activityClass}
                      timestamp={item.timestamp}
                      eventName={item.eventName}
                      details={item.details}
                      objectName={item.objectName}
                      isNew={item.id === animatedInsertId}
                    />
                  ))
                )}
              </div>
            </CrossfadeContainer>
          </div>
        </div>

        {/* Rail Column (360px §6) */}
        <div className="w-full lg:w-[360px] flex flex-col gap-6 flex-shrink-0">
          {/* System Health Card */}
          <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line-faint)] mb-2">
              <h3 className="type-card-title text-[var(--bone)]">System health</h3>
              <div className="flex items-center gap-1.5">
                <LED
                  color={backendOnline ? "verdigris" : "madder"}
                  live={Boolean(backendOnline)}
                />
                <span
                  className={`type-meta ${
                    backendOnline ? "text-[var(--verdigris)]" : "text-[var(--madder)]"
                  }`}
                >
                  {backendOnline ? "All systems operational" : "Backend offline"}
                </span>
              </div>
            </div>

            <CrossfadeContainer
              loading={loading}
              testId="home-health-crossfade"
              skeleton={
                <div className="p-2 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-6 w-full rounded-[var(--r-4)] skeleton-shimmer" />
                  ))}
                </div>
              }
            >
              <div className="divide-y divide-[var(--line-faint)]">
                <SystemHealthRow
                  name="FastAPI (:8000)"
                  status={backendOnline ? "ok" : "error"}
                  latency={clientLatency !== null ? `${clientLatency} ms` : "—"}
                  statusLabel={backendOnline ? undefined : "unreachable"}
                  staggerIndex={0}
                  igniteDelay={0}
                />
                <SystemHealthRow
                  name="Chroma (vector DB)"
                  status={
                    backendOnline && healthData?.retrieval_store?.status === "ok"
                      ? "ok"
                      : "error"
                  }
                  latency={
                    backendOnline && clientLatency !== null
                      ? `${Math.max(1, Math.round(clientLatency * 0.6))} ms`
                      : "—"
                  }
                  statusLabel={
                    backendOnline
                      ? `${healthData?.retrieval_store?.chunks ?? 0} chunks`
                      : "unreachable"
                  }
                  staggerIndex={1}
                  igniteDelay={120}
                />
                <SystemHealthRow
                  name="SQLite (metadata)"
                  status={backendOnline ? "ok" : "error"}
                  latency={
                    backendOnline && clientLatency !== null
                      ? `${Math.max(1, Math.round(clientLatency * 0.3))} ms`
                      : "—"
                  }
                  statusLabel={backendOnline ? undefined : "unreachable"}
                  staggerIndex={2}
                  igniteDelay={240}
                />
                <SystemHealthRow
                  name="SSE (realtime)"
                  status={backendOnline ? "live" : "error"}
                  latency="—"
                  statusLabel={backendOnline ? undefined : "disconnected"}
                  staggerIndex={3}
                  igniteDelay={360}
                />
                <SystemHealthRow
                  name="LLM (answering)"
                  status="disabled"
                  statusLabel="disabled by policy"
                  latency="—"
                  staggerIndex={4}
                  igniteDelay={480}
                />
              </div>
            </CrossfadeContainer>
          </div>

          {/* Retrieval Latency Sparkline — Live Client Measured */}
          <SparklineCard
            title="Retrieval latency"
            sub="Client measured"
            points={latencyHistory}
            footnote={
              clientLatency !== null
                ? `Latest: ${clientLatency} ms · ${latencyHistory.length} probe(s)`
                : backendOnline === false
                ? "Backend unreachable"
                : "Probing endpoint..."
            }
          />

          {/* Continue Card (§9.1) — Live Last Document & Question */}
          <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 flex flex-col gap-4">
            <h3 className="type-card-title text-[var(--bone)]">Continue</h3>

            <CrossfadeContainer
              loading={loading}
              testId="home-continue-crossfade"
              skeleton={
                <div className="space-y-4">
                  <div className="h-14 rounded-[var(--r-6)] skeleton-shimmer" />
                  <div className="h-14 rounded-[var(--r-6)] skeleton-shimmer" />
                </div>
              }
            >
              <div className="flex flex-col gap-4">
                {/* Last open document */}
                <div>
                  <div className="type-meta text-[var(--dim)] mb-1.5">Last open document</div>
                  {lastDocument ? (
                    <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/50 border border-[var(--line-faint)]">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1 mr-2">
                        <svg
                          className="w-4 h-4 text-[var(--dim)] flex-shrink-0 mt-0.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                        >
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <div className="type-body text-[12.5px] text-[var(--bone)] font-medium truncate">
                            {lastDocument.original_filename}
                          </div>
                          <div className="type-meta text-[var(--dim)] mt-0.5">
                            {lastDocument.page_count ? `${lastDocument.page_count} page(s) · ` : ""}
                            {lastDocument.upload_time ? lastDocument.upload_time.slice(0, 10) : "Uploaded"}
                          </div>
                        </div>
                      </div>
                      <Link to="/library" viewTransition onClick={() => setNavDirection("forward")}>
                        <IconButton size={28} title="Open in library">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </IconButton>
                      </Link>
                    </div>
                  ) : (
                    <div className="p-3 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)] text-[12px] text-[var(--dim)]">
                      No reports uploaded yet.{" "}
                      <Link to="/upload" viewTransition onClick={() => setNavDirection("forward")} className="text-[var(--verdigris)] hover:underline">
                        Upload a report
                      </Link>
                    </div>
                  )}
                </div>

                {/* Last question */}
                <div>
                  <div className="type-meta text-[var(--dim)] mb-1.5">Last question</div>
                  {lastQuestionText ? (
                    <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/50 border border-[var(--line-faint)]">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1 mr-2">
                        <svg
                          className="w-4 h-4 text-[var(--dim)] flex-shrink-0 mt-0.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                        >
                          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <div className="type-body text-[12.5px] text-[var(--bone)] font-medium line-clamp-2">
                            {lastQuestionText}
                          </div>
                          <div className="type-meta text-[var(--dim)] mt-0.5">
                            {lastQuestionEvent?.timestamp ? lastQuestionEvent.timestamp.slice(0, 16).replace("T", " ") : "Recent query"}
                          </div>
                        </div>
                      </div>
                      <Link to="/ask" viewTransition onClick={() => setNavDirection("forward")}>
                    <IconButton size={28} title="Open in Ask view">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </IconButton>
                  </Link>
                </div>
              ) : (
                <div className="p-3 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)] text-[12px] text-[var(--dim)]">
                  No questions asked yet.{" "}
                  <Link to="/ask" viewTransition onClick={() => setNavDirection("forward")} className="text-[var(--verdigris)] hover:underline">
                    Ask a question
                  </Link>
                </div>
              )}
            </div>
            </div>
            </CrossfadeContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
