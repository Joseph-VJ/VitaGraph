import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  GraphStage,
  AskBar,
  ThinkingDetailsPanel,
  DocumentPanel,
  type TraceRowData,
} from "../components/gallery";
import { useActiveUser } from "../context/UserContext";
import { graphApi, type GraphResponse, type GraphNode } from "../api/graph";
import { questionsApi } from "../api/questions";

export const KnowledgeGraphPage: React.FC = () => {
  const { user } = useActiveUser();

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

  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch real NetworkX graph for current active user
  const fetchGraph = useCallback(async () => {
    if (!user?.id) {
      setGraphData(null);
      return;
    }
    try {
      const data = await graphApi.getGraph(user.id);
      setGraphData(data);
      if (data.nodes && data.nodes.length > 0) {
        setSelectedNode((prev) => {
          if (prev) return prev;
          return (
            data.nodes.find((n) => n.type === "test" || n.type === "measurement") ||
            data.nodes[0]
          );
        });
      }
    } catch {
      setGraphData(null);
    }
  }, [user?.id]);

  useEffect(() => {
    setSelectedNode(null);
    setActiveConcepts([]);
    setActiveNodeIds([]);
    setSubgraphMetrics(null);
    setShowThinking(false);
    setThinkingTraces([]);
    setStreamError(null);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    fetchGraph();
  }, [fetchGraph]);

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

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

    // Subscribe to real SSE stream (plan Section 12)
    const backendUrl = "http://127.0.0.1:8000";
    const es = new EventSource(`${backendUrl}/api/jobs/${jobId}/events`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt && evt.stage) {
          setThinkingTraces((prev) => {
            if (prev.some((item) => item.index === evt.index && item.stage === evt.stage)) {
              return prev;
            }
            return [...prev, evt];
          });
          if (evt.stage === "done") {
            setIsStreaming(false);
            es.close();
          }
        }
      } catch {
        // Comment or non-JSON line
      }
    };

    es.onerror = () => {
      setStreamError("Backend stream disconnected (stopped backend detected). Stream failed.");
      setIsStreaming(false);
      es.close();
    };

    try {
      const answer = await questionsApi.ask(user.id, query, jobId);
      const chunkIds = (answer.evidence || []).map((e) => e.chunk_id);

      if (chunkIds.length > 0) {
        const sub = await graphApi.getSubgraph(user.id, chunkIds);
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
      }
    } catch (err) {
      setStreamError(`Question request failed: ${(err as Error).message}`);
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
          onSelectNode={setSelectedNode}
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
            className="mt-1"
          />
        )}
      </div>

      {/* Right Panel (400px) */}
      <div className="w-full lg:w-[400px] flex-shrink-0">
        <DocumentPanel selectedNode={selectedNode} />
      </div>
    </div>
  );
};
