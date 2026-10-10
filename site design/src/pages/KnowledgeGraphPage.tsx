import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  type GraphResponse,
  type SeriesResponse,
  type SeriesTest,
  graphApi,
} from "../api/graph";
import { reportsApi } from "../api/reports";
import {
  processGraphData,
  mapNodeKind,
  type ProcessedGraph,
} from "../components/graph/graphData";
import {
  GraphStage,
  type GraphStageHandle,
} from "../components/graph/stage/GraphStage";
import {
  type StageNode,
  type StageEdge,
  type StageReportInfo,
  type StageOptions,
  type NodeKind,
} from "../components/graph/stage/GraphStageEngine";
import { PageState, PersonaState } from "../components/ui";
import { useActiveUser } from "../context/UserContext";
import { usePreferences } from "../lib/preferences";
import { sortReports, formatReportDate, formatReportMonthYear } from "../lib/reportLabels";
import { readLastAnswer } from "../lib/lastAnswer";
import type { Report } from "../types";

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const KINDS_LABELS: Record<string, string> = {
  person: "Subject",
  report: "Report",
  section: "Section",
  bio: "Biomarker",
  meas: "Value",
  unc: "Uncertain",
};

const LEGEND_ITEMS = [
  { label: "Subject", css: { width: 12, height: 12, background: "var(--color-text)", display: "inline-block", flexShrink: 0 } },
  { label: "Report", css: { width: 12, height: 12, borderRadius: "var(--r-circle, 50%)", border: "2.5px solid var(--color-text)", background: "var(--color-bg)", boxSizing: "border-box" as const, display: "inline-block", flexShrink: 0 } },
  { label: "Section", css: { width: 9, height: 9, border: "2px solid var(--color-text)", background: "var(--color-bg)", boxSizing: "border-box" as const, transform: "rotate(45deg)", display: "inline-block", margin: 2, flexShrink: 0 } },
  { label: "Biomarker", css: { width: 12, height: 12, borderRadius: "var(--r-circle, 50%)", background: "var(--color-text)", display: "inline-block", flexShrink: 0 } },
  { label: "Value", css: { width: 8, height: 8, borderRadius: "var(--r-circle, 50%)", background: "var(--color-neutral-700)", display: "inline-block", margin: 2, flexShrink: 0 } },
  { label: "Uncertain", css: { width: 12, height: 12, borderRadius: "var(--r-circle, 50%)", border: "2px dashed var(--color-accent)", background: "var(--color-bg)", boxSizing: "border-box" as const, display: "inline-block", flexShrink: 0 } },
];

export const KnowledgeGraphPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: personaLoading, refreshUsers } = useActiveUser();
  const prefs = usePreferences();

  const stageHandleRef = useRef<GraphStageHandle>(null);

  const [rawGraph, setRawGraph] = useState<GraphResponse | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [seriesData, setSeriesData] = useState<SeriesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  // Stage state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeLayout, setActiveLayout] = useState<string>("sphere");
  const [lensOn, setLensOn] = useState<boolean>(false);
  const [themeInk, setThemeInk] = useState<boolean>(true);
  const [activeFocus, setActiveFocus] = useState<string>("all");
  const [barMessage, setBarMessage] = useState<React.ReactNode | null>(null);

  // Time machine
  const [histPlaying, setHistPlaying] = useState<boolean>(false);
  const [histRangeVal, setHistRangeVal] = useState<number>(0);

  // Path finder
  const [pathFrom, setPathFrom] = useState<string>("");
  const [pathTo, setPathTo] = useState<string>("");

  // Evidence
  const [evidenceOn, setEvidenceOn] = useState<boolean>(false);

  // Snapshot modal
  const [modalImage, setModalImage] = useState<string | null>(null);
  const saveBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Kind filter switches
  const [kindFilters, setKindFilters] = useState<Record<NodeKind, boolean>>({
    report: true,
    section: true,
    bio: true,
    meas: true,
    unc: true,
    person: true,
  });

  // Stage fine-tune options
  const [stageOptions, setStageOptions] = useState<StageOptions>({
    size: true,
    breath: true,
    drop: true,
    hover: true,
    fly: true,
    clu: true,
    flow: true,
    lens: false,
    heat: false,
    ghost: true,
  });

  const systemReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isReducedMotion = prefs.reduceMotion || systemReduced;

  // Data fetching
  useEffect(() => {
    if (!user?.id) {
      setRawGraph(null);
      setReports([]);
      setSeriesData(null);
      setLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    Promise.all([
      graphApi.getGraph(user.id),
      reportsApi.list(user.id),
      graphApi.series(user.id).catch(() => null),
    ])
      .then(([g, r, s]) => {
        if (cancelled) return;
        setRawGraph(g);
        setReports(r);
        setSeriesData(s);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Network error");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, retryTick]);

  // Process reports into chronological StageReportInfo
  const stageReports: StageReportInfo[] = useMemo(() => {
    if (!reports || reports.length === 0) return [];
    const sorted = sortReports(reports);
    return sorted.map((r, i) => ({
      id: r.id,
      order: i,
      date: r.report_date ? formatReportDate(r) : null,
      label: formatReportMonthYear(r),
      filename: r.original_filename,
    }));
  }, [reports]);

  // Set initial slider max
  useEffect(() => {
    const maxVal = Math.max(0, (stageReports.length - 1) * 100);
    setHistRangeVal(maxVal);
  }, [stageReports.length]);

  // Process graph data with standard betweenness cap
  const processed: ProcessedGraph | null = useMemo(() => {
    if (!rawGraph) return null;
    return processGraphData(rawGraph);
  }, [rawGraph]);

  // Map graph data to StageNode and StageEdge
  const { stageNodes, stageEdges, pathNodeList } = useMemo(() => {
    if (!rawGraph || !processed) {
      return { stageNodes: [], stageEdges: [], pathNodeList: [] };
    }

    const allRawNodes = rawGraph.nodes || [];
    const allRawEdges = rawGraph.edges || [];

    // Map report ID and report date to chronological order
    const repIdToOrder = new Map<string, number>();
    const repDateToOrder = new Map<string, number>();
    stageReports.forEach((r) => {
      repIdToOrder.set(r.id, r.order);
      if (r.date) {
        repDateToOrder.set(r.date.trim().toLowerCase(), r.order);
      }
      if (r.label) {
        repDateToOrder.set(r.label.trim().toLowerCase(), r.order);
      }
    });
    reports?.forEach((r, idx) => {
      if (r.report_date) {
        const ord = stageReports.find((sr) => sr.id === r.id)?.order ?? idx;
        repDateToOrder.set(r.report_date.trim().toLowerCase(), ord);
      }
    });

    const reportIdOf = (id: string) => (id.startsWith("rep_") ? id.slice(4) : id);

    // Measurement to parent test map
    const measToParentTest = new Map<string, string>();
    for (const e of allRawEdges) {
      if (e.relation === "HAS_MEASUREMENT") {
        measToParentTest.set(e.target, e.source);
      }
    }

    // Node adjacency in raw graph for report finding
    const rawAdjacency = new Map<string, string[]>();
    for (const e of allRawEdges) {
      const la = rawAdjacency.get(e.source) || [];
      la.push(e.target);
      rawAdjacency.set(e.source, la);

      const lb = rawAdjacency.get(e.target) || [];
      lb.push(e.source);
      rawAdjacency.set(e.target, lb);
    }

    // Top raw nodes up to 120 (same as processGraphData)
    const candidates = allRawNodes.filter((n) => n.type.toLowerCase() !== "chunk");
    candidates.sort((a, b) => (b.betweenness ?? 0) - (a.betweenness ?? 0));
    const topRawNodes = candidates.slice(0, 120);
    const keptNodeIds = new Set(topRawNodes.map((n) => n.id));

    // Map of series tests by node_id
    const seriesTestsByNodeId = new Map<string, SeriesTest>();
    if (seriesData?.tests) {
      seriesData.tests.forEach((t) => seriesTestsByNodeId.set(t.node_id, t));
    }

    // Sibling counter for groups
    const groupCountMap = new Map<string, number>();

    const nodesOut: StageNode[] = topRawNodes.map((n, idx) => {
      const k = mapNodeKind(n.type);
      const group = n.category || "";
      const k2 = groupCountMap.get(group) ?? 0;
      groupCountMap.set(group, k2 + 1);

      // Determine report order ri
      let ri = 0;
      if (k === "person") {
        ri = 0;
      } else if (k === "report") {
        const ownRid = n.report_id ?? reportIdOf(n.id);
        if (repIdToOrder.has(ownRid)) {
          ri = repIdToOrder.get(ownRid)!;
        } else if (n.date && repDateToOrder.has(n.date.trim().toLowerCase())) {
          ri = repDateToOrder.get(n.date.trim().toLowerCase())!;
        }
      } else if (k === "meas") {
        if (n.report_id && repIdToOrder.has(n.report_id)) {
          ri = repIdToOrder.get(n.report_id)!;
        } else if (n.date && repDateToOrder.has(n.date.trim().toLowerCase())) {
          ri = repDateToOrder.get(n.date.trim().toLowerCase())!;
        } else {
          // Look at neighbors for a report
          const nbs = rawAdjacency.get(n.id) || [];
          for (const nb of nbs) {
            if (repIdToOrder.has(reportIdOf(nb))) {
              ri = repIdToOrder.get(reportIdOf(nb))!;
              break;
            }
          }
        }
      } else if (k === "unc") {
        if (n.report_id && repIdToOrder.has(n.report_id)) {
          ri = repIdToOrder.get(n.report_id)!;
        } else if (n.date && repDateToOrder.has(n.date.trim().toLowerCase())) {
          ri = repDateToOrder.get(n.date.trim().toLowerCase())!;
        } else {
          const nbs = rawAdjacency.get(n.id) || [];
          for (const nb of nbs) {
            if (repIdToOrder.has(reportIdOf(nb))) {
              ri = repIdToOrder.get(reportIdOf(nb))!;
              break;
            }
          }
        }
      } else {
        // test / section: appears at first order where any neighbor report appears
        const nbs = rawAdjacency.get(n.id) || [];
        let minOrder = stageReports.length > 0 ? stageReports.length - 1 : 0;
        let found = false;
        for (const nb of nbs) {
          if (repIdToOrder.has(reportIdOf(nb))) {
            minOrder = Math.min(minOrder, repIdToOrder.get(reportIdOf(nb))!);
            found = true;
          }
        }
        ri = found ? minOrder : 0;
      }

      let label = n.label;
      let name = n.test_name || n.label;

      if (k === "report") {
        const repObj = reports?.find((r) => r.id === (n.report_id ?? reportIdOf(n.id)) || r.original_filename === n.label || r.original_filename === n.id);
        label = formatReportDate(repObj || (n.date ? { report_date: n.date } : null));
        name = repObj ? repObj.original_filename : n.label;
      }

      // Series data for biomarker
      const seriesT = seriesTestsByNodeId.get(n.id);
      let vals: (number | null)[] = [];
      let latest: number | null = n.value ?? null;
      let delta: number | null = null;
      let flag = n.flag === "NORMAL" ? "in" : n.flag?.toLowerCase() || "in";
      let firstFlag = "in";
      let unit = n.unit || "";
      let range: [number | null, number | null] = [null, null];
      let firstI = 0;
      let lastI = 0;

      if (seriesT && seriesT.points.length > 0) {
        const pts = seriesT.points;
        unit = seriesT.unit || unit;
        const datedPts = pts.filter((p) => p.date !== null && p.date.trim() !== "");
        if (datedPts.length > 0) {
          const firstPt = datedPts[0];
          const lastPt = datedPts[datedPts.length - 1];
          firstI = firstPt.order;
          lastI = lastPt.order;
          latest = lastPt.value;
          delta = datedPts.length > 1 ? lastPt.value - firstPt.value : null;
          flag = lastPt.flag === "NORMAL" ? "in" : lastPt.flag.toLowerCase();
          firstFlag = firstPt.flag === "NORMAL" ? "in" : firstPt.flag.toLowerCase();
          range = [lastPt.range_low ?? null, lastPt.range_high ?? null];
        } else {
          const lastPt = pts[pts.length - 1];
          firstI = lastPt.order;
          lastI = lastPt.order;
          latest = lastPt.value;
          delta = null;
          flag = lastPt.flag === "NORMAL" ? "in" : lastPt.flag.toLowerCase();
          range = [lastPt.range_low ?? null, lastPt.range_high ?? null];
        }

        // Fill vals array across all reports
        vals = stageReports.map((r) => {
          const p = pts.find((x) => x.report_id === r.id);
          return p ? p.value : null;
        });
      } else if (n.value != null) {
        vals = [n.value];
      }

      const bioId = k === "meas" ? measToParentTest.get(n.id) : undefined;

      return {
        id: n.id,
        idx,
        k,
        label,
        name,
        group,
        unit,
        val: n.value ?? null,
        latest,
        delta,
        flag,
        firstFlag,
        vals,
        range,
        ri,
        firstI,
        lastI,
        imp: n.betweenness ?? 0,
        from: [0, 0, 0],
        to: [0, 0, 0],
        md: 0,
        t: ri,
        k2,
        bioId,
        reportId: n.report_id,
      };
    });

    // Kept edges
    const edgesOut: StageEdge[] = allRawEdges
      .filter((e) => keptNodeIds.has(e.source) && keptNodeIds.has(e.target))
      .map((e) => ({
        a: e.source,
        b: e.target,
        h: (simpleHash(e.source + e.target) % 1000) / 1000,
        dir: true,
      }));

    const pathNodes = nodesOut.filter(
      (n) => n.k === "bio" || n.k === "section" || n.k === "report"
    );

    return { stageNodes: nodesOut, stageEdges: edgesOut, pathNodeList: pathNodes };
  }, [rawGraph, processed, stageReports, seriesData]);

  // Set default path from / to nodes
  useEffect(() => {
    if (pathNodeList.length >= 2 && !pathFrom && !pathTo) {
      setPathFrom(pathNodeList[0].id);
      setPathTo(pathNodeList[pathNodeList.length - 1].id);
    }
  }, [pathNodeList, pathFrom, pathTo]);

  // Active focus IDs for Subgraph community dimming
  const activeFocusIds = useMemo(() => {
    if (!processed || activeFocus === "all") return null;
    const item = processed.focuses.find((f) => f.id === activeFocus);
    return item?.ids ?? null;
  }, [processed, activeFocus]);

  const handleSelectNode = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  // Path finder options with unambiguous report names and duplicate suffixes (B4)
  const pathOptions = useMemo(() => {
    const counts = new Map<string, number>();
    return pathNodeList.map((n) => {
      let base: string;
      if (n.k === "report") {
        base = `Report: ${n.label} · ${n.name || "report"}`;
      } else {
        base = `${KINDS_LABELS[n.k] || n.k}: ${n.label}`;
      }
      const seen = counts.get(base) ?? 0;
      counts.set(base, seen + 1);
      const text = seen === 0 ? base : `${base} (${seen + 1})`;
      return { id: n.id, text, node: n };
    });
  }, [pathNodeList]);

  // Modal close with focus restoration to Save as image button (B2)
  const handleCloseModal = useCallback(() => {
    setModalImage(null);
    requestAnimationFrame(() => {
      saveBtnRef.current?.focus();
    });
  }, []);

  // When modal opens, move focus to Close button (B2)
  useEffect(() => {
    if (modalImage) {
      requestAnimationFrame(() => {
        closeBtnRef.current?.focus();
      });
    }
  }, [modalImage]);

  // Global Esc key handler: closes modal or deselects node (B2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput = (el: HTMLElement | null) => {
        if (!el) return false;
        const tag = el.tagName.toLowerCase();
        return tag === "input" || tag === "select" || tag === "textarea" || el.isContentEditable;
      };
      if (isInput(target) || isInput(activeEl)) return;

      if (modalImage) {
        e.preventDefault();
        handleCloseModal();
        return;
      }

      if (selectedId) {
        e.preventDefault();
        handleSelectNode(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalImage, selectedId, handleCloseModal, handleSelectNode]);

  const handleFocusClick = (focusId: string) => {
    setActiveFocus(focusId);
    stageHandleRef.current?.setFocusIds(
      focusId === "all" ? null : processed?.focuses.find((f) => f.id === focusId)?.ids ?? null
    );
  };

  const handleOptionChange = (key: keyof StageOptions, val: boolean) => {
    setStageOptions((prev) => ({ ...prev, [key]: val }));
    stageHandleRef.current?.setOptions({ [key]: val });
  };

  // What Changed heat toggle
  const handleHeatToggle = (checked: boolean) => {
    handleOptionChange("heat", checked);
    if (checked) {
      stageHandleRef.current?.clearPath();
      setEvidenceOn(false);
      stageHandleRef.current?.setEvidence(null);

      // Compute summary
      const bios = stageNodes.filter((n) => n.k === "bio");
      const fixed = bios.filter((n) => n.firstFlag !== "in" && n.flag === "in").map((n) => n.name);
      const still = bios.filter((n) => n.flag !== "in").map((n) => n.name);
      const firstDate = stageReports[0]?.label || "the first report";

      setBarMessage(
        <span>
          <b>
            {fixed.length} value{fixed.length === 1 ? "" : "s"} moved into the printed range since {firstDate}
          </b>
          {fixed.length > 0 ? ` (${fixed.join(", ")})` : ""}. Still outside it:{" "}
          {still.length > 0 ? still.join(" and ") : "none"}.
        </span>
      );
    } else {
      setBarMessage(null);
    }
  };

  // Time machine handlers
  const handleHistPlay = () => {
    if (histPlaying) {
      stageHandleRef.current?.stopHist();
      setHistPlaying(false);
    } else {
      setBarMessage(null);
      setEvidenceOn(false);
      stageHandleRef.current?.setEvidence(null);
      stageHandleRef.current?.startHist();
      setHistPlaying(true);
    }
  };

  const handleHistAll = () => {
    stageHandleRef.current?.stopHist();
    setHistPlaying(false);
    stageHandleRef.current?.showAllHist();
    setHistRangeVal(Math.max(0, (stageReports.length - 1) * 100));
  };

  const handleHistRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setHistRangeVal(val);
    stageHandleRef.current?.stopHist();
    setHistPlaying(false);
    stageHandleRef.current?.setHistRange(val / 100);
  };

  // Path finder
  const handleShowPath = () => {
    if (!pathFrom || !pathTo) return;
    if (pathFrom === pathTo) {
      setBarMessage(<span>Pick two different nodes.</span>);
      return;
    }
    const ids = stageHandleRef.current?.showPath(pathFrom, pathTo);
    if (!ids) {
      setBarMessage(<span>These two are not connected.</span>);
      return;
    }
    const nodeMap = new Map<string, StageNode>(stageNodes.map((n) => [n.id, n]));
    const names = ids.map((id) => nodeMap.get(id)?.label || id).join("  →  ");
    setBarMessage(
      <span>
        <b>{ids.length - 1} steps: </b>
        {names}
      </span>
    );
  };

  const handleClearPath = () => {
    stageHandleRef.current?.clearPath();
    if (stageOptions.heat) {
      handleHeatToggle(true);
    } else {
      setBarMessage(null);
    }
  };

  // Last answer evidence
  const lastAnswer = useMemo(() => {
    return user?.id ? readLastAnswer(user.id) : null;
  }, [user?.id]);

  const handleToggleEvidence = () => {
    if (!lastAnswer || !rawGraph) return;
    const nextOn = !evidenceOn;
    setEvidenceOn(nextOn);

    if (nextOn) {
      stageHandleRef.current?.clearPath();
      setSelectedId(null);

      // Find shown nodes that are raw neighbors of cited chunks
      const chunkIdsSet = new Set(lastAnswer.chunkIds);
      const stageNodeIdSet = new Set(stageNodes.map((n) => n.id));
      const citedIds = new Set<string>();

      for (const e of rawGraph.edges || []) {
        const sChunk = e.source.startsWith("chunk_") ? e.source.replace(/^chunk_/, "") : null;
        const tChunk = e.target.startsWith("chunk_") ? e.target.replace(/^chunk_/, "") : null;

        if (sChunk && chunkIdsSet.has(sChunk) && stageNodeIdSet.has(e.target)) {
          citedIds.add(e.target);
        }
        if (tChunk && chunkIdsSet.has(tChunk) && stageNodeIdSet.has(e.source)) {
          citedIds.add(e.source);
        }
      }

      const list = Array.from(citedIds).slice(0, 9);
      stageHandleRef.current?.setEvidence(list);

      setBarMessage(
        <span>
          <b>The last answer cited {list.length} passage{list.length === 1 ? "" : "s"}</b>. Each red square is one of them.
        </span>
      );
    } else {
      stageHandleRef.current?.setEvidence(null);
      if (stageOptions.heat) {
        handleHeatToggle(true);
      } else {
        setBarMessage(null);
      }
    }
  };

  // Kind filter chips toggle
  const handleToggleKind = (k: NodeKind) => {
    const next = !kindFilters[k];
    setKindFilters((prev) => ({ ...prev, [k]: next }));
    stageHandleRef.current?.setKindVisibility(k, next);
  };

  // Save image snapshot
  const handleSaveImage = () => {
    const dataUrl = stageHandleRef.current?.getSnapshotDataUrl();
    if (dataUrl) {
      setModalImage(dataUrl);
    }
  };

  // Thinned ticks for Time Machine slider
  const sliderTicks = useMemo(() => {
    if (stageReports.length <= 1) return [];
    if (stageReports.length <= 4) {
      return stageReports.map((r) => r.label);
    }
    // Thin out ticks so they never overlap
    const first = stageReports[0].label;
    const mid = stageReports[Math.floor(stageReports.length / 2)].label;
    const last = stageReports[stageReports.length - 1].label;
    return [first, mid, last];
  }, [stageReports]);

  if (!user) {
    return (
      <div data-screen-label="Graph" style={{ height: "100%", display: "flex", flexWrap: "wrap" }}>
        <div style={{ flex: 1, padding: "var(--space-8)" }}>
          <PersonaState loading={personaLoading} onRetry={refreshUsers} />
        </div>
      </div>
    );
  }

  const isEmpty = !loading && !loadError && (!processed || processed.nodes.length === 0);

  return (
    <div
      data-screen-label="Graph"
      className="graph-page-container"
      id="v-graph"
    >
      {loading ? (
        <div style={{ position: "relative", minHeight: 460, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PageState kind="loading" title="Loading the graph" />
        </div>
      ) : loadError ? (
        <div style={{ position: "relative", minHeight: 460, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-6)" }}>
          <PageState
            kind="error"
            title="Could not load the graph"
            detail={loadError}
            action={{
              label: "Try again",
              onClick: () => setRetryTick((t) => t + 1),
            }}
          />
        </div>
      ) : isEmpty ? (
        <div style={{ position: "relative", minHeight: 460, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-6)" }}>
          <PageState
            kind="empty"
            title="No graph yet"
            action={{
              label: "Upload a report",
              onClick: () => navigate("/upload"),
            }}
          />
        </div>
      ) : (
        <GraphStage
          ref={stageHandleRef}
          userId={user.id}
          personName={user.display_label || "Subject"}
          nodes={stageNodes}
          edges={stageEdges}
          reports={stageReports}
          seriesTests={seriesData?.tests || []}
          selectedId={selectedId}
          onSelectNode={handleSelectNode}
          focusIds={activeFocusIds}
          activeLayout={activeLayout}
          onLayoutChange={setActiveLayout}
          lensOn={lensOn}
          onToggleLens={setLensOn}
          themeInk={themeInk}
          onToggleTheme={setThemeInk}
          stageOptions={stageOptions}
          barMessage={barMessage}
          onClearBarMessage={() => setBarMessage(null)}
          reduceMotion={isReducedMotion}
        />
      )}

      {/* Right Panel matching preview .panel */}
      <aside className="panel" aria-label="Graph options">
        {/* Section 1: Subgraph communities */}
        <section>
          <h2 className="label">Subgraph</h2>
          <div className="focus-list">
            {processed?.focuses.map((f) => {
              const isActive = activeFocus === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`focus-row ${isActive ? "is-active" : ""}`}
                  onClick={() => handleFocusClick(f.id)}
                >
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {f.label}
                  </span>
                  <span className="focus-row-count">{f.count}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 2: Modes */}
        <section>
          <h2 className="label">Modes</h2>
          <label className="sw">
            <input
              type="checkbox"
              id="m-flow"
              checked={stageOptions.flow}
              onChange={(e) => handleOptionChange("flow", e.target.checked)}
            />
            <span className="box"></span>
            <span>
              <b>Data flow</b>
              <small>Small dots travel along every line, from the values up to the person.</small>
            </span>
          </label>

          <label className="sw">
            <input
              type="checkbox"
              id="m-lens"
              checked={lensOn}
              onChange={(e) => setLensOn(e.target.checked)}
            />
            <span className="box"></span>
            <span>
              <b>Lens</b>
              <small>A magnifier follows the pointer and names everything under it. Key: L.</small>
            </span>
          </label>

          <label className="sw">
            <input
              type="checkbox"
              id="m-heat"
              data-testid="graph-heat"
              checked={stageOptions.heat}
              onChange={(e) => handleHeatToggle(e.target.checked)}
            />
            <span className="box"></span>
            <span>
              <b>What changed</b>
              <small>Values outside the printed range turn red; arrows show the direction since the first reading.</small>
            </span>
          </label>

          <label className="sw">
            <input
              type="checkbox"
              id="m-ghost"
              checked={stageOptions.ghost}
              onChange={(e) => handleOptionChange("ghost", e.target.checked)}
            />
            <span className="box"></span>
            <span>
              <b>Ghosts in the time machine</b>
              <small>What is still to come shows as faint dotted outlines.</small>
            </span>
          </label>
        </section>

        {/* Section 3: Time machine */}
        <section>
          <h2 className="label">Time machine</h2>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary btn-small"
              id="histPlay"
              onClick={handleHistPlay}
            >
              {histPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              id="histAll"
              onClick={handleHistAll}
            >
              Show all
            </button>
          </div>
          <input
            type="range"
            id="histRange"
            min="0"
            max={Math.max(1, (stageReports.length - 1) * 100)}
            step="1"
            value={histRangeVal}
            aria-label="Point in time"
            data-testid="graph-time"
            onChange={handleHistRangeChange}
          />
          <div className="ticks">
            {sliderTicks.map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        </section>

        {/* Section 4: Find a connection */}
        <section>
          <h2 className="label">Find a connection</h2>
          <label className="muted" htmlFor="pathFrom">
            From
          </label>
          <select
            className="select"
            id="pathFrom"
            value={pathFrom}
            onChange={(e) => setPathFrom(e.target.value)}
          >
            {pathOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.text}
              </option>
            ))}
          </select>

          <label className="muted" htmlFor="pathTo">
            To
          </label>
          <select
            className="select"
            id="pathTo"
            value={pathTo}
            onChange={(e) => setPathTo(e.target.value)}
          >
            {pathOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.text}
              </option>
            ))}
          </select>

          <div className="row">
            <button
              type="button"
              className="btn btn-secondary btn-small"
              id="pathGo"
              data-testid="graph-path-go"
              onClick={handleShowPath}
            >
              Show the path
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              id="pathClear"
              onClick={handleClearPath}
            >
              Clear
            </button>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Or click one dot, then Shift-click another.
          </p>
        </section>

        {/* Section 5: Agent link and filters */}
        <section>
          <h2 className="label">Agent link and filters</h2>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            id="evid"
            data-testid="graph-evidence"
            aria-pressed={evidenceOn}
            disabled={!lastAnswer}
            onClick={handleToggleEvidence}
          >
            {lastAnswer
              ? "Show what the last answer cited"
              : "No answer to show yet. Ask the AI Agent first."}
          </button>

          <div className="row" id="chips" role="group" aria-label="Show or hide node types">
            {(
              [
                ["report", "Reports"],
                ["section", "Sections"],
                ["bio", "Biomarkers"],
                ["meas", "Values"],
                ["unc", "Uncertain"],
              ] as const
            ).map(([kd, lab]) => {
              const on = kindFilters[kd];
              return (
                <button
                  key={kd}
                  type="button"
                  className="btn btn-secondary btn-small"
                  aria-pressed={on}
                  onClick={() => handleToggleKind(kd)}
                >
                  {lab}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-small"
            id="snap"
            data-testid="graph-save"
            ref={saveBtnRef}
            onClick={handleSaveImage}
          >
            Save as image
          </button>
        </section>

        {/* Section 6: Fine-tune */}
        <section>
          <details className="fine">
            <summary className="label">Fine-tune</summary>
            <div className="inner">
              <label className="sw">
                <input
                  type="checkbox"
                  id="u-size"
                  checked={stageOptions.size}
                  onChange={(e) => handleOptionChange("size", e.target.checked)}
                />
                <span className="box"></span>
                <span>
                  <b>Size by importance</b>
                  <small>Hubs are drawn bigger (betweenness centrality).</small>
                </span>
              </label>

              <label className="sw">
                <input
                  type="checkbox"
                  id="u-breath"
                  checked={stageOptions.breath}
                  onChange={(e) => handleOptionChange("breath", e.target.checked)}
                />
                <span className="box"></span>
                <span>
                  <b>Gentle idle motion</b>
                  <small>Nodes breathe a little.</small>
                </span>
              </label>

              <label className="sw">
                <input
                  type="checkbox"
                  id="u-drop"
                  checked={stageOptions.drop}
                  onChange={(e) => handleOptionChange("drop", e.target.checked)}
                />
                <span className="box"></span>
                <span>
                  <b>Floor drop-lines</b>
                  <small>A thin line from each node to the grid.</small>
                </span>
              </label>

              <label className="sw">
                <input
                  type="checkbox"
                  id="u-hover"
                  checked={stageOptions.hover}
                  onChange={(e) => handleOptionChange("hover", e.target.checked)}
                />
                <span className="box"></span>
                <span>
                  <b>Hover preview</b>
                  <small>Hover lights a node's lines and shows a tooltip.</small>
                </span>
              </label>

              <label className="sw">
                <input
                  type="checkbox"
                  id="u-fly"
                  checked={stageOptions.fly}
                  onChange={(e) => handleOptionChange("fly", e.target.checked)}
                />
                <span className="box"></span>
                <span>
                  <b>Fly to node</b>
                  <small>Clicking glides the camera to the node.</small>
                </span>
              </label>

              <label className="sw">
                <input
                  type="checkbox"
                  id="u-clu"
                  checked={stageOptions.clu}
                  onChange={(e) => handleOptionChange("clu", e.target.checked)}
                />
                <span className="box"></span>
                <span>
                  <b>Cluster outlines</b>
                  <small>A dashed outline and name around each group.</small>
                </span>
              </label>
            </div>
          </details>
        </section>

        {/* Section 7: Legend */}
        <section>
          <h2 className="label">Legend</h2>
          <div className="legend" id="legend">
            {LEGEND_ITEMS.map((item) => (
              <span key={item.label}>
                <i className="sym" style={item.css}></i>
                {item.label}
              </span>
            ))}
          </div>
        </section>
      </aside>

      {/* Snapshot Image Preview Modal */}
      {modalImage && (
        <div
          className="graph-modal"
          role="dialog"
          aria-label="Knowledge graph snapshot"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div className="sheet">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="label">Graph Snapshot</span>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <a
                  href={modalImage}
                  download={`knowledge-graph-${user.id}.png`}
                  className="btn btn-primary btn-small"
                >
                  Download PNG
                </a>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  ref={closeBtnRef}
                  onClick={handleCloseModal}
                >
                  Close
                </button>
              </div>
            </div>
            <img src={modalImage} alt="Knowledge graph snapshot preview" />
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphPage;
