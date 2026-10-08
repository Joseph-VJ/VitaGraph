import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { type GraphResponse, graphApi } from "../api/graph";
import { type ChunkDetail, reportsApi } from "../api/reports";
import {
  GraphCanvas,
  type GraphCanvasHandle,
} from "../components/graph/GraphCanvas";
import {
  processGraphData,
  type ProcessedGraph,
  type SelectedNodeDetail,
} from "../components/graph/graphData";
import { PageState, PersonaState } from "../components/ui";
import { useActiveUser } from "../context/UserContext";
import { usePreferences } from "../lib/preferences";
import type { Report } from "../types";
import { NodeSummary } from "../components/graph/NodeSummary";

interface SlipData {
  rep: string;
  page: number;
  start: number;
  end: number;
  pre: string;
  hit: string;
  post: string;
}

const LEGEND_ITEMS = [
  {
    label: "Subject",
    css: {
      width: 12,
      height: 12,
      background: "var(--color-text)",
      display: "inline-block",
      flexShrink: 0,
    },
  },
  {
    label: "Report",
    css: {
      width: 12,
      height: 12,
      borderRadius: "var(--r-circle, 50%)",
      border: "2.5px solid var(--color-text)",
      background: "var(--color-bg)",
      boxSizing: "border-box" as const,
      display: "inline-block",
      flexShrink: 0,
    },
  },
  {
    label: "Section",
    css: {
      width: 9,
      height: 9,
      border: "2px solid var(--color-text)",
      background: "var(--color-bg)",
      boxSizing: "border-box" as const,
      transform: "rotate(45deg)",
      display: "inline-block",
      margin: 2,
      flexShrink: 0,
    },
  },
  {
    label: "Biomarker",
    css: {
      width: 12,
      height: 12,
      borderRadius: "var(--r-circle, 50%)",
      background: "var(--color-text)",
      display: "inline-block",
      flexShrink: 0,
    },
  },
  {
    label: "Measurement",
    css: {
      width: 8,
      height: 8,
      borderRadius: "var(--r-circle, 50%)",
      background: "var(--color-neutral-700)",
      display: "inline-block",
      margin: 2,
      flexShrink: 0,
    },
  },
  {
    label: "Uncertainty",
    css: {
      width: 12,
      height: 12,
      borderRadius: "var(--r-circle, 50%)",
      border: "2px dashed var(--color-accent)",
      background: "var(--color-bg)",
      boxSizing: "border-box" as const,
      display: "inline-block",
      flexShrink: 0,
    },
  },
];

export const KnowledgeGraphPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: personaLoading, refreshUsers } = useActiveUser();
  const prefs = usePreferences();

  const canvasHandleRef = useRef<GraphCanvasHandle>(null);

  const [rawGraph, setRawGraph] = useState<GraphResponse | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFocus, setActiveFocus] = useState<string>("all");
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [replayToken, setReplayToken] = useState<number>(0);

  const [slip, setSlip] = useState<SlipData | null>(null);
  const [, setSlipLoading] = useState(false);

  // System and user reduced-motion
  const systemReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isReducedMotion = prefs.reduceMotion || systemReduced;

  // Load real graph data and reports
  useEffect(() => {
    if (!user?.id) {
      setRawGraph(null);
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
        setRawGraph(g);
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

  // Escape clears selection
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Process real graph
  const processed: ProcessedGraph | null = useMemo(() => {
    if (!rawGraph) return null;
    return processGraphData(rawGraph);
  }, [rawGraph]);

  // Selected node details
  const selectedNode: SelectedNodeDetail | null = useMemo(() => {
    if (!selectedId || !processed || !user) return null;
    return processed.getNodeDetail(selectedId, user.id, reports);
  }, [selectedId, processed, user, reports]);

  // Active focus IDs
  const activeFocusIds = useMemo(() => {
    if (!processed || activeFocus === "all") return null;
    const item = processed.focuses.find((f) => f.id === activeFocus);
    return item?.ids ?? null;
  }, [processed, activeFocus]);

  // Load chunk slip when node changes
  useEffect(() => {
    if (!selectedNode?.trace || !user?.id) {
      setSlip(null);
      setSlipLoading(false);
      return;
    }

    const { reportId, chunkId, page, searchStr } = selectedNode.trace;
    if (!reportId || !chunkId) {
      setSlip(null);
      setSlipLoading(false);
      return;
    }

    let cancelled = false;
    setSlipLoading(true);

    reportsApi
      .chunk(user.id, reportId, chunkId)
      .then((ch: ChunkDetail) => {
        if (cancelled) return;
        const rep = reports.find((r) => r.id === reportId);
        const repName = rep?.original_filename || "Report";
        const text = ch.text || "";
        const target = (searchStr || "").trim();

        if (target) {
          const idx = text.toLowerCase().indexOf(target.toLowerCase());
          if (idx !== -1) {
            const matchLen = target.length;
            const startIdx = Math.max(0, idx - 120);
            const endIdx = Math.min(text.length, idx + matchLen + 160);
            setSlip({
              rep: repName,
              page: ch.page_number ?? page ?? 1,
              start: ch.char_start,
              end: ch.char_end,
              pre: (startIdx > 0 ? "…" : "") + text.slice(startIdx, idx),
              hit: text.slice(idx, idx + matchLen),
              post:
                text.slice(idx + matchLen, endIdx) +
                (endIdx < text.length ? "…" : ""),
            });
            setSlipLoading(false);
            return;
          }
        }

        // Fallback: first 280 characters
        setSlip({
          rep: repName,
          page: ch.page_number ?? page ?? 1,
          start: ch.char_start,
          end: ch.char_end,
          pre: text.slice(0, 280) + (text.length > 280 ? "…" : ""),
          hit: "",
          post: "",
        });
        setSlipLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSlip(null);
        setSlipLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNode, user?.id, reports]);

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const handleReplay = () => {
    setReplayToken(performance.now());
    canvasHandleRef.current?.replay();
  };

  const toggleAuto = () => {
    setAutoRotate((prev) => !prev);
  };

  const handleFocusClick = (focusId: string) => {
    setActiveFocus(focusId);
  };

  // Node count string
  const countLabel = useMemo(() => {
    if (!processed) return "0 nodes · 0 edges";
    if (processed.totalCount > processed.shownCount) {
      return `${processed.shownCount} of ${processed.totalCount.toLocaleString("en-US")} nodes · ${processed.shownEdgesCount} edges`;
    }
    return `${processed.shownCount} nodes · ${processed.shownEdgesCount} edges`;
  }, [processed]);

  if (!user) {
    return (
      <div
        data-screen-label="Graph"
        style={{ height: "100%", display: "flex", flexWrap: "wrap" }}
      >
        <div style={{ flex: 1, padding: "var(--space-8)" }}>
          <PersonaState loading={personaLoading} onRetry={refreshUsers} />
        </div>
      </div>
    );
  }

  const isEmpty =
    !loading &&
    !loadError &&
    (!processed || processed.nodes.length === 0);

  return (
    <div
      data-screen-label="Graph"
      style={{
        height: "100%",
        maxHeight: "100%",
        overflow: "hidden",
        display: "flex",
        flexWrap: "wrap",
      }}
    >
      {/* Left Canvas Area */}
      <div
        style={{
          flex: "1 1 520px",
          minWidth: 0,
          minHeight: 520,
          position: "relative",
          overflow: "hidden",
          backgroundImage:
            "linear-gradient(color-mix(in srgb,var(--color-text) 7%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--color-text) 7%,transparent) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      >
        {loading ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PageState kind="loading" title="Loading the graph" />
          </div>
        ) : loadError ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--space-6)",
            }}
          >
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
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--space-6)",
            }}
          >
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
          processed && (
            <GraphCanvas
              ref={canvasHandleRef}
              nodes={processed.nodes}
              edges={processed.edges}
              focusIds={activeFocusIds}
              selectedId={selectedId}
              onSelect={handleSelect}
              autoRotate={autoRotate && !isReducedMotion}
              reducedMotion={isReducedMotion}
              replayToken={replayToken}
            />
          )
        )}

        {/* Counter Top Left */}
        <div
          style={{
            position: "absolute",
            top: "var(--space-4)",
            left: "var(--space-6)",
            pointerEvents: "none",
            fontSize: "0.9375rem",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {countLabel}
        </div>

        {/* Action Buttons Top Right */}
        <div
          style={{
            position: "absolute",
            top: "var(--space-4)",
            right: "var(--space-6)",
            display: "flex",
            gap: "var(--space-2)",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleReplay}
            style={{ background: "var(--color-bg)" }}
          >
            Replay build
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={toggleAuto}
            style={{ background: "var(--color-bg)" }}
          >
            {autoRotate ? "Pause rotation" : "Resume rotation"}
          </button>
        </div>

        {/* Interaction Hint Bottom Left */}
        <div
          style={{
            position: "absolute",
            left: "var(--space-6)",
            bottom: "var(--space-4)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--color-neutral-800)",
            pointerEvents: "none",
          }}
        >
          Drag to rotate · scroll to zoom · select a node
        </div>
      </div>

      {/* Right Panel */}
      <div
        style={{
          flex: "0 0 340px",
          maxWidth: "100%",
          height: "100%",
          maxHeight: "100%",
          boxSizing: "border-box",
          borderLeft: "2px solid var(--color-divider)",
          padding: "var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
          overflow: "auto",
        }}
      >
        {/* SUBGRAPH Block */}
        <div>
          <div
            style={{
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
              Subgraph
            </div>
          </div>
          {processed?.focuses.map((f) => {
            const isActive = activeFocus === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => handleFocusClick(f.id)}
                style={{
                  appearance: "none",
                  width: "100%",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-3)",
                  padding: "var(--space-2)",
                  border: 0,
                  borderBottom: "1px solid var(--color-divider)",
                  background: isActive ? "var(--color-text)" : "transparent",
                  color: isActive ? "var(--color-bg)" : "var(--color-text)",
                  fontSize: "0.9375rem",
                  fontWeight: isActive ? 800 : 600,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0,
                  }}
                >
                  {f.label}
                </span>
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    color: isActive
                      ? "var(--color-bg)"
                      : "var(--color-neutral-700)",
                    flexShrink: 0,
                  }}
                >
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Node Card */}
        {selectedNode && (
          <div
            style={{
              borderTop: "2px solid var(--color-text)",
              paddingTop: "var(--space-3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--color-accent-700)",
                }}
              >
                {selectedNode.kind}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelectedId(null)}
                style={{ fontSize: "0.8125rem" }}
              >
                Clear
              </button>
            </div>
            <h3
              style={{
                margin: "var(--space-1) 0 var(--space-2)",
                fontSize: "1.5rem",
              }}
            >
              {selectedNode.label}
            </h3>
            {user && <NodeSummary key={`${user.id}|${selectedNode.id}`} userId={user.id} nodeId={selectedNode.id} />}
            <p
              style={{
                margin: "0 0 var(--space-3)",
                fontSize: "0.9375rem",
              }}
            >
              {selectedNode.about}
            </p>
            {processed && selectedId ? (
              <p data-testid="graph-connections" style={{ margin: "0 0 var(--space-2)", fontSize: "0.8125rem", color: "var(--color-neutral-700)" }}>
                {(() => {
                  const n = processed.edges.filter((e) => e[0] === selectedId || e[1] === selectedId).length;
                  return n === 0
                    ? "Not connected to anything else."
                    : `Connected to ${n} node${n === 1 ? "" : "s"}${n > selectedNode.nbs.length ? ` (first ${selectedNode.nbs.length} shown)` : ""}. Its lines are drawn in red; the fainter lines go one step further.`;
                })()}
              </p>
            ) : null}
            {selectedNode.nbs.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-2)",
                }}
              >
                {selectedNode.nbs.map((nb) => (
                  <button
                    key={nb.id}
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedId(nb.id)}
                    style={{
                      padding: "var(--space-1) var(--space-2)",
                      fontSize: "0.8125rem",
                    }}
                  >
                    {nb.label}
                  </button>
                ))}
              </div>
            )}

            {/* Source Slip */}
            {slip && (
              <div
                style={{
                  marginTop: "var(--space-3)",
                  background: "var(--color-surface)",
                  borderTop: "2px solid var(--color-text)",
                  padding: "var(--space-3)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "var(--space-3)",
                    fontSize: "0.6875rem",
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--color-neutral-700)",
                  }}
                >
                  <span>{slip.rep}</span>
                  <span>Page {slip.page}</span>
                  <span>
                    Chars {slip.start}–{slip.end}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: "var(--space-2)",
                    whiteSpace: "pre-wrap",
                    fontSize: "0.875rem",
                    lineHeight: 1.7,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <span>{slip.pre}</span>
                  {slip.hit && (
                    <mark
                      style={{
                        background: "var(--color-accent-200)",
                        color: "var(--color-text)",
                        boxShadow: "inset 0 -2px 0 var(--color-accent)",
                        padding: "0 2px",
                      }}
                    >
                      {slip.hit}
                    </mark>
                  )}
                  <span>{slip.post}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: "auto" }}>
          <div
            style={{
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
              Legend
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,1fr)",
              gap: "var(--space-2) var(--space-3)",
              paddingTop: "var(--space-3)",
            }}
          >
            {LEGEND_ITEMS.map((g) => (
              <div
                key={g.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  fontSize: "0.8125rem",
                }}
              >
                <span style={g.css} />
                {g.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphPage;
