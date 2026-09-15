import React, { useState, useEffect, useCallback } from "react";
import {
  GraphStage,
  AskBar,
  ThinkingDetailsPanel,
  DocumentPanel,
} from "../components/gallery";
import { useActiveUser } from "../context/UserContext";
import { graphApi, type GraphResponse, type GraphNode } from "../api/graph";
import { questionsApi } from "../api/questions";

export const KnowledgeGraphPage: React.FC = () => {
  const { user } = useActiveUser();

  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeConcepts, setActiveConcepts] = useState<string[]>([]);
  const [showThinking, setShowThinking] = useState(false);

  // Fetch real NetworkX graph for current active user
  const fetchGraph = useCallback(async () => {
    if (!user?.id) {
      setGraphData(null);
      return;
    }
    try {
      const data = await graphApi.getGraph(user.id);
      setGraphData(data);
      if (data.nodes && data.nodes.length > 0 && !selectedNode) {
        // Auto-select first notable biomarker/node for provenance card preview
        const firstNotable =
          data.nodes.find((n) => n.type === "test" || n.type === "measurement") || data.nodes[0];
        setSelectedNode(firstNotable);
      }
    } catch {
      setGraphData(null);
    }
  }, [user?.id, selectedNode]);

  useEffect(() => {
    setSelectedNode(null);
    setActiveConcepts([]);
    fetchGraph();
  }, [fetchGraph]);

  const handleAsk = async (query: string) => {
    if (!user?.id || !query.trim()) return;
    setShowThinking(true);

    try {
      const answer = await questionsApi.ask(user.id, query);
      const chunkIds = (answer.evidence || []).map((e) => e.chunk_id);

      if (chunkIds.length > 0) {
        const sub = await graphApi.getSubgraph(user.id, chunkIds);
        setGraphData(sub);
        if (sub.active_concepts) {
          setActiveConcepts(sub.active_concepts);
        }
      }
    } catch {
      // Non-fatal
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
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
        />

        {/* Ask Bar (§7.17) */}
        <AskBar onSend={handleAsk} />

        {/* Thinking Details Panel (§7.18) */}
        {showThinking && (
          <ThinkingDetailsPanel className="mt-1" />
        )}
      </div>

      {/* Right Panel (400px) */}
      <div className="w-full lg:w-[400px] flex-shrink-0">
        <DocumentPanel selectedNode={selectedNode} />
      </div>
    </div>
  );
};
