import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  GraphStage,
  AskBar,
  ThinkingDetailsPanel,
  DocumentPanel,
  useToast,
  type TraceRowData,
} from "../components/gallery";
import { useActiveUser } from "../context/UserContext";
import { graphApi, type GraphResponse, type GraphNode } from "../api/graph";
import { questionsApi } from "../api/questions";
import { governor } from "../motion/quality";
import { isReducedMotion } from "../motion/features";
import { ticker } from "../motion/ticker";

export const KnowledgeGraphPage: React.FC = () => {
  const { user } = useActiveUser();
  const { addToast } = useToast();

  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeConcepts, setActiveConcepts] = useState<string[]>([]);
  const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);
  const [subgraphMetrics, setSubgraphMetrics] = useState<{ total_nodes: number; total_edges: number } | null>(null);
  const [showThinking, setShowThinking] = useState(false);
  const [thinkingTraces, setThinkingTraces] = useState<TraceRowData[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isReplayJob, setIsReplayJob] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const eventQueueRef = useRef<any[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);

  // Load graph data for current active persona
  const loadGraph = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await graphApi.getGraph(user.id);
      setGraphData(data);
      setActiveConcepts([]);
      setActiveNodeIds([]);
      setSubgraphMetrics(null);
      if (data.nodes && data.nodes.length > 0) {
        setSelectedNode(data.nodes[0]);
      }
    } catch (err) {
      console.warn("Could not load knowledge graph:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const [morphChip, setMorphChip] = useState<{
    rect: DOMRect;
    color: string;
    label: string;
  } | null>(null);

  // Node -> detail shared-element morph (§7.3, F0-A)
  const handleSelectNode = useCallback((node: GraphNode | null, screenRect?: DOMRect) => {
    const isT0 = isReducedMotion() || governor.getState().tier === "T0";
    const hasVT = typeof document !== "undefined" && "startViewTransition" in document;

    if (!node) {
      // Deselect (Escape or Close button)
      if (isT0 || !hasVT) {
        setSelectedNode(null);
        return;
      }
      (document as any).startViewTransition(() => {
        setSelectedNode(null);
      });
      return;
    }

    if (isT0 || !hasVT || !screenRect) {
      setSelectedNode(node);
      return;
    }

    // Motion-safe ViewTransition path: mount transient chip at node screen rect
    setMorphChip({
      rect: screenRect,
      color: node.color || "#79B8A6",
      label: node.label || node.id,
    });
    if (typeof window !== "undefined") {
      (window as any).__VG_MORPH_CHIP__ = true;
    }

    ticker.subscribe("L0", () => {
      try {
        const transition = (document as any).startViewTransition(() => {
          setMorphChip(null);
          setSelectedNode(node);
        });

        const cleanUp = () => {
          if (typeof window !== "undefined") {
            (window as any).__VG_MORPH_CHIP__ = false;
          }
          setMorphChip(null);
        };

        if (transition && transition.finished) {
          transition.finished.then(cleanUp).catch(cleanUp);
        } else {
          setTimeout(cleanUp, 320);
        }
      } catch {
        setSelectedNode(node);
        setMorphChip(null);
        if (typeof window !== "undefined") {
          (window as any).__VG_MORPH_CHIP__ = false;
        }
      }
      return false;
    });
  }, []);

  // Global Escape key listener to reverse morph / deselect (§7.3)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedNode) {
        handleSelectNode(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNode, handleSelectNode]);

  // Clean up SSE stream on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Expose test hook for question activation testing (§M8.3)
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__VG_TEST_ACTIVATE_QUESTION__ = (
        concepts: string[] = ["Hemoglobin", "Ferritin"],
        nodeIds: string[] = []
      ) => {
        if (concepts.length === 0) {
          setActiveConcepts([]);
          setActiveNodeIds([]);
          setSubgraphMetrics(null);
          return;
        }
        setActiveConcepts(concepts);
        if (nodeIds.length > 0) {
          setActiveNodeIds(nodeIds);
        } else if (graphData?.nodes && graphData.nodes.length > 0) {
          const matching = graphData.nodes
            .filter((n) =>
              concepts.some(
                (c) =>
                  (n.label && n.label.toLowerCase().includes(c.toLowerCase())) ||
                  (n.id && n.id.toLowerCase().includes(c.toLowerCase()))
              )
            )
            .map((n) => n.id);
          const finalIds = matching.length > 0 ? matching : [graphData.nodes[0].id];
          setActiveNodeIds(finalIds);
          setSubgraphMetrics({
            total_nodes: finalIds.length,
            total_edges: Math.min(finalIds.length * 2, 8),
          });
        }
      };
    }
  }, [graphData]);

  const handleApplyAnswer = async (answer: any, query: string = "") => {
    const chunkIds = (answer.evidence || []).map((e: any) => e.chunk_id);
    if (chunkIds.length > 0) {
      try {
        const sub = await graphApi.getSubgraph(user?.id || "VG-2026-001", chunkIds);
        if (sub.active_concepts) {
          setActiveConcepts(sub.active_concepts);
        }
        if (sub.nodes) {
          setActiveNodeIds(sub.nodes.map((n) => n.id));
          const testNode =
            sub.nodes.find((n) => n.type === "test") ||
            sub.nodes.find((n) => n.type === "measurement") ||
            sub.nodes[0];
          if (testNode) {
            setSelectedNode(testNode);
          }
        }
        if (sub.metrics) {
          setSubgraphMetrics({
            total_nodes: sub.metrics.total_nodes,
            total_edges: sub.metrics.total_edges,
          });
        }
      } catch (err) {
        console.warn("Could not load subgraph:", err);
      }
    }

    if (answer.status === "refused") {
      addToast("info", "Clinical Boundary Enforced", "Question refused per clinical policy.");
    } else {
      addToast("done", "Subgraph Highlighted", `Activated evidence concepts for: ${query}`);
    }
  };

  const handleAsk = async (query: string) => {
    if (!user?.id || !query.trim()) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    setActiveJobId(jobId);
    setThinkingTraces([]);
    setStreamError(null);
    setIsStreaming(true);
    setShowThinking(true);
    setIsReplayJob(false);

    // Subscribe to real SSE stream BEFORE POST per US-15
    const backendUrl = "http://127.0.0.1:8000";
    const es = new EventSource(`${backendUrl}/api/jobs/${jobId}/events`);
    eventSourceRef.current = es;
    eventQueueRef.current = [];
    isProcessingQueueRef.current = false;

    const processQueue = () => {
      if (eventQueueRef.current.length === 0) {
        isProcessingQueueRef.current = false;
        return;
      }
      isProcessingQueueRef.current = true;
      const evt = eventQueueRef.current.shift();

      if (evt && evt.stage) {
        if (evt.is_replay) {
          setIsReplayJob(true);
        }
        setThinkingTraces((prev) => {
          if (prev.some((item) => item.index === evt.index && item.stage === evt.stage)) {
            return prev;
          }
          return [...prev, evt];
        });

        if (evt.stage === "done") {
          setIsStreaming(false);
          es.close();

          const ans = evt.metadata?.answer;
          if (ans) {
            handleApplyAnswer(ans, query);
          } else {
            questionsApi.result(jobId).then((res) => {
              if (res.result) handleApplyAnswer(res.result, query);
            }).catch(() => {});
          }
          return;
        }
      }

      // presentation dwell (US-15) - at least 250ms per real event
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const dwellMs = prefersReducedMotion ? 0 : 280; // presentation dwell (US-15)

      setTimeout(() => {
        processQueue();
      }, dwellMs);
    };

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt && evt.stage) {
          eventQueueRef.current.push(evt);
          if (!isProcessingQueueRef.current) {
            processQueue();
          }
        }
      } catch {
        // Comment or non-JSON line
      }
    };

    es.onerror = () => {
      setStreamError("Backend stream disconnected (stopped backend detected). Stream failed.");
      addToast("failed", "Stream Interrupted", "Connection to backend stream was interrupted.");
      setIsStreaming(false);
      es.close();
    };

    try {
      await questionsApi.ask(user.id, query, jobId, true);
    } catch (err) {
      setStreamError(`Question request failed: ${(err as Error).message}`);
      addToast("failed", "Question Failed", (err as Error).message);
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
      {/* Main Column (1fr) */}
      <div className="flex-1 flex flex-col gap-6 min-w-0 w-full">
        {/* Real NetworkX Graph Stage (§7.16) */}
        <GraphStage
          graphData={graphData}
          activeConcepts={activeConcepts}
          activeNodeIds={activeNodeIds}
          subgraphMetrics={subgraphMetrics}
          selectedNode={selectedNode}
          onSelectNode={handleSelectNode}
        />

        {/* Ask Bar (§7.17) */}
        <AskBar onSend={handleAsk} defaultValue="" />

        {/* Thinking Details Panel (§7.18 & §12) */}
        {showThinking && (
          <ThinkingDetailsPanel
            traces={thinkingTraces}
            jobId={activeJobId}
            isStreaming={isStreaming}
            streamError={streamError}
            isReplay={isReplayJob}
            className="mt-1"
          />
        )}
      </div>

      {/* Right Panel (400px) */}
      <div className="w-full lg:w-[400px] flex-shrink-0">
        <DocumentPanel
          selectedNode={selectedNode}
          onClose={() => handleSelectNode(null)}
        />
      </div>

      {/* Transient Morph Chip for canvas node -> detail header transition (§7.3, F0-A) */}
      {morphChip && (
        <div
          data-testid="node-fly-chip"
          className="node-fly-chip fixed pointer-events-none z-50 rounded-[var(--r-6)] border border-[var(--line-strong)] bg-[var(--ink-800)] px-3 py-1.5 shadow-lg flex items-center gap-2"
          style={{
            left: `${morphChip.rect.left}px`,
            top: `${morphChip.rect.top}px`,
            width: `${Math.max(120, morphChip.rect.width)}px`,
            viewTransitionName: "node-detail-header",
          }}
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: morphChip.color }}
          />
          <span className="type-mono-sm text-xs text-[var(--bone)] truncate">
            {morphChip.label}
          </span>
        </div>
      )}
    </div>
  );
};
