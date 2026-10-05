import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { type GraphResponse, graphApi } from "../api/graph";
import { reportsApi } from "../api/reports";
import { DocumentPanel } from "../components/gallery/DocumentPanel";
import { Graph2D } from "../components/graph3d/Graph2D";
import { GraphErrorBoundary } from "../components/graph3d/GraphErrorBoundary";
import { selectNodes } from "../components/graph3d/graphModel";
import { hasWebGL2 } from "../components/graph3d/webgl";
import { PageFrame, PageState, PersonaState, SectionHead } from "../components/ui";
import { useActiveUser } from "../context/UserContext";
import { readLastAnswer } from "../lib/lastAnswer";
import { usePreferences } from "../lib/preferences";
import type { Report } from "../types";

const Graph3D = lazy(() => import("../components/graph3d/Graph3D"));

type FallbackReason = null | "no-webgl" | "crashed";

export const KnowledgeGraphPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: personaLoading, refreshUsers } = useActiveUser();
  const prefs = usePreferences();

  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFragments, setShowFragments] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);

  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [evidenceQuestion, setEvidenceQuestion] = useState<string | null>(null);

  // Reduced motion preference
  const systemReduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isReducedMotion = prefs.reduceMotion || systemReduceMotion;

  // View switch logic
  const initialWanted: "3d" | "2d" =
    prefs.graphView === "2d"
      ? "2d"
      : prefs.graphView === "3d"
      ? "3d"
      : hasWebGL2()
      ? "3d"
      : "2d";

  const [view, setView] = useState<"3d" | "2d">(initialWanted);
  const [reason, setReason] = useState<FallbackReason>(
    initialWanted === "3d" && !hasWebGL2() ? "no-webgl" : null
  );

  const shown: "3d" | "2d" = reason ? "2d" : view;

  // Load graph and reports
  useEffect(() => {
    if (!user?.id) {
      setGraphData(null);
      setReports([]);
      setLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    Promise.all([graphApi.getGraph(user.id), reportsApi.list(user.id)])
      .then(([g, r]) => {
        if (cancelled) return;
        setGraphData(g);
        setReports(r);
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

  // Load last answer evidence when ?answer=1
  useEffect(() => {
    if (!user?.id || searchParams.get("answer") !== "1") {
      return;
    }
    const last = readLastAnswer(user.id);
    if (!last || last.chunkIds.length === 0) {
      return;
    }
    let cancelled = false;
    setEvidenceQuestion(last.question);

    graphApi
      .getSubgraph(user.id, last.chunkIds)
      .then((sub) => {
        if (!cancelled) {
          setActiveIds(new Set(sub.nodes.map((n) => n.id)));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveIds(new Set());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, searchParams]);

  // Clear evidence highlight
  const clearEvidence = () => {
    setActiveIds(new Set());
    setEvidenceQuestion(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("answer");
    setSearchParams(nextParams, { replace: true });
  };

  // Keyboard Escape clears selection
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Filtered nodes and edges based on fragment toggle
  const selectedResult = useMemo(() => {
    return selectNodes(graphData, { showFragments });
  }, [graphData, showFragments]);

  // Selected node object for inspector
  const selectedNode = useMemo(() => {
    if (!selectedId || !graphData?.nodes) return null;
    return graphData.nodes.find((n) => n.id === selectedId) || null;
  }, [selectedId, graphData]);

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const handleViewChange = (targetView: "3d" | "2d") => {
    setView(targetView);
    if (targetView === "3d") {
      if (!hasWebGL2()) {
        setReason("no-webgl");
      } else if (reason === "no-webgl") {
        setReason(null);
      }
    } else {
      if (reason === "crashed") {
        setReason(null);
      }
    }
  };

  // States
  if (!user) {
    return (
      <PageFrame label="Knowledge Graph" width="wide">
        <PersonaState loading={personaLoading} onRetry={refreshUsers} />
      </PageFrame>
    );
  }

  if (loading) {
    return (
      <PageFrame label="Knowledge Graph" width="wide">
        <PageState kind="loading" title="Loading the graph" />
      </PageFrame>
    );
  }

  if (loadError) {
    return (
      <PageFrame label="Knowledge Graph" width="wide">
        <PageState
          kind="error"
          title="Could not load the graph"
          detail={loadError}
          action={{ label: "Try again", onClick: () => setRetryTick((t) => t + 1) }}
        />
      </PageFrame>
    );
  }

  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <PageFrame label="Knowledge Graph" width="wide">
        <PageState
          kind="empty"
          title="No graph yet"
          action={{ label: "Upload a report", onClick: () => navigate("/upload") }}
        />
      </PageFrame>
    );
  }

  // Cap note text
  let capText = "";
  if (selectedResult.hiddenFragments) {
    capText = `Showing the ${selectedResult.nodes.length} most central of ${graphData.nodes.length} nodes. ${selectedResult.fragmentCount} text fragments are hidden.`;
  } else if (selectedResult.nodes.length < graphData.nodes.length) {
    capText = `Showing the ${selectedResult.nodes.length} most central of ${graphData.nodes.length} nodes.`;
  } else {
    capText = `Showing all ${selectedResult.nodes.length} nodes.`;
  }

  const commonProps = {
    nodes: selectedResult.nodes,
    edges: selectedResult.edges,
    selectedId,
    activeIds,
    onSelect: handleSelect,
    fitSignal,
    className: "w-full h-full",
    autoRotate: autoRotate && !isReducedMotion,
  };

  return (
    <PageFrame label="Knowledge Graph" width="wide">
      <SectionHead
        title="Knowledge Graph"
        aside={
          <button
            type="button"
            className="btn btn-secondary text-xs"
            onClick={() => navigate("/agent")}
          >
            Ask the AI Agent
          </button>
        }
      />

      {evidenceQuestion && (
        <div className="flex items-center justify-between gap-3 p-3 bg-[var(--color-surface)] border border-[var(--color-divider)] text-[13px]">
          <span className="font-semibold text-[var(--color-text)]">
            Highlighting the evidence of: {evidenceQuestion}
          </span>
          <button
            type="button"
            className="btn btn-secondary text-xs px-2 py-1"
            onClick={clearEvidence}
          >
            Clear
          </button>
        </div>
      )}

      {reason === "no-webgl" && (
        <div className="py-2 px-3 text-[13px] text-[var(--color-accent-700)] bg-[var(--color-accent-100)] border border-[var(--color-divider)]">
          3D is not available in this browser, so the 2D view is shown.
        </div>
      )}

      {reason === "crashed" && (
        <div className="py-2 px-3 text-[13px] text-[var(--color-accent-700)] bg-[var(--color-accent-100)] border border-[var(--color-divider)]">
          The 3D view stopped working, so the 2D view is shown.
        </div>
      )}

      {/* Toolbar above the frame */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-[var(--color-divider)]">
        <div className="flex flex-wrap items-center gap-2">
          {/* View switch */}
          <div className="seg" role="group" aria-label="View mode">
            <button
              type="button"
              className={`seg-opt ${shown === "3d" ? "bg-[var(--color-accent)] text-[var(--color-bg)]" : ""}`}
              aria-pressed={shown === "3d"}
              onClick={() => handleViewChange("3d")}
            >
              3D
            </button>
            <button
              type="button"
              className={`seg-opt ${shown === "2d" ? "bg-[var(--color-accent)] text-[var(--color-bg)]" : ""}`}
              aria-pressed={shown === "2d"}
              onClick={() => handleViewChange("2d")}
            >
              2D
            </button>
          </div>

          {/* Fragments toggle */}
          <button
            type="button"
            role="switch"
            data-testid="graph-fragments-toggle"
            aria-checked={showFragments}
            className={showFragments ? "btn btn-primary text-xs" : "btn btn-secondary text-xs"}
            onClick={() => setShowFragments((prev) => !prev)}
          >
            Show text fragments
          </button>

          {/* Fit button */}
          <button
            type="button"
            data-testid="graph-fit"
            className="btn btn-secondary text-xs"
            onClick={() => setFitSignal((s) => s + 1)}
          >
            Fit
          </button>

          {/* Auto-rotate toggle (3D only) */}
          {shown === "3d" && (
            <button
              type="button"
              role="switch"
              data-testid="graph-auto-rotate"
              aria-checked={isReducedMotion ? false : autoRotate}
              disabled={isReducedMotion}
              className={
                autoRotate && !isReducedMotion
                  ? "btn btn-primary text-xs"
                  : "btn btn-secondary text-xs"
              }
              onClick={() => setAutoRotate((prev) => !prev)}
            >
              Auto-rotate
            </button>
          )}
        </div>

        {/* Legend */}
        <div
          data-testid="graph-legend"
          className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--color-text)]"
        >
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 inline-block"
              style={{ backgroundColor: "var(--color-text)" }}
            />
            <span>Report</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 inline-block"
              style={{ backgroundColor: "var(--ochre)" }}
            />
            <span>Uncertain</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 inline-block"
              style={{ backgroundColor: "var(--color-accent)" }}
            />
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 inline-block"
              style={{ backgroundColor: "var(--color-neutral-400)" }}
            />
            <span>Structural</span>
          </div>
        </div>
      </div>

      {/* Cap note */}
      <div data-testid="graph-cap-note" className="text-[12px] text-[var(--color-neutral-700)]">
        {capText}
      </div>

      {/* Main two-column layout */}
      <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
        <div className="flex-1 w-full min-w-0">
          <div
            data-testid="graph-frame"
            className="relative w-full border-2 border-[var(--color-divider)] bg-[var(--color-bg)] overflow-hidden"
            style={{
              height: "min(70vh, 720px)",
              minHeight: "420px",
            }}
          >
            {shown === "3d" ? (
              <GraphErrorBoundary
                fallback={<Graph2D {...commonProps} />}
                onError={() => setReason("crashed")}
              >
                <Suspense
                  fallback={<PageState kind="loading" title="Loading the 3D view" />}
                >
                  <Graph3D
                    {...commonProps}
                    onContextLost={() => setReason("crashed")}
                  />
                </Suspense>
              </GraphErrorBoundary>
            ) : (
              <Graph2D {...commonProps} />
            )}
          </div>

          {/* Keyboard path: collapsed Nodes details */}
          <details className="mt-3 p-3 bg-[var(--color-surface)] border border-[var(--color-divider)] text-[13px]">
            <summary className="font-semibold cursor-pointer select-none text-[var(--color-text)]">
              Nodes ({selectedResult.nodes.length})
            </summary>
            <div className="mt-2 max-h-48 overflow-y-auto flex flex-wrap gap-1.5 pt-1">
              {selectedResult.nodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className={`px-2 py-1 text-xs border cursor-pointer ${
                    node.id === selectedId
                      ? "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg)] font-extrabold"
                      : "border-[var(--color-divider)] bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)]"
                  }`}
                  onClick={() => setSelectedId(node.id)}
                >
                  {node.label || node.id}
                </button>
              ))}
            </div>
          </details>
        </div>

        {/* Inspector panel */}
        <div className="w-full lg:w-[400px] flex-shrink-0">
          <DocumentPanel
            selectedNode={selectedNode}
            graph={graphData}
            reports={reports}
            userId={user.id}
            onClose={() => setSelectedId(null)}
          />
        </div>
      </div>
    </PageFrame>
  );
};

export default KnowledgeGraphPage;
