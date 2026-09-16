import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Marginalia } from "../components/gallery";
import { useActiveUser } from "../context/UserContext";
import { graphApi, type GraphResponse } from "../api/graph";

export const InsightsPage: React.FC = () => {
  const { user } = useActiveUser();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";

  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    graphApi.getGraph(effectiveUserId)
      .then((data) => {
        if (isMounted) setGraphData(data);
      })
      .catch((err) => console.warn("Failed to load graph analytics:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [effectiveUserId]);

  const metrics = graphData?.metrics || {
    total_nodes: 0,
    total_edges: 0,
    communities_count: 0,
    modularity: 0,
    density: 0,
  };

  // 1. Group communities from real nodes
  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  const communityMap = new Map<number, typeof nodes>();
  nodes.forEach((node) => {
    const cId = node.community ?? 0;
    if (!communityMap.has(cId)) communityMap.set(cId, []);
    communityMap.get(cId)!.push(node);
  });

  const communityClusters = Array.from(communityMap.entries())
    .map(([cId, cNodes]) => {
      // Find prominent name from category or test nodes
      const catNode = cNodes.find((n) => n.type === "category");
      const testNode = cNodes.find((n) => n.type === "test");
      const label = catNode?.label || testNode?.label || `Cluster ${cId + 1}`;

      const cNodeIds = new Set(cNodes.map((n) => n.id));
      const cEdgesCount = edges.filter((e) => cNodeIds.has(e.source) && cNodeIds.has(e.target)).length;

      return {
        id: cId,
        label,
        coreNodes: cNodes.length,
        edges: cEdgesCount,
      };
    })
    .sort((a, b) => b.coreNodes - a.coreNodes)
    .slice(0, 4);

  const clusterColors = [
    "bg-[var(--cornflower)]",
    "bg-[var(--verdigris)]",
    "bg-[var(--lilac)]",
    "bg-[var(--ochre)]",
  ];

  // 2. Top Betweenness Centrality Hubs
  const topHubs = [...nodes]
    .filter((n) => n.type === "test" || n.type === "category" || n.type === "report")
    .sort((a, b) => (b.betweenness || 0) - (a.betweenness || 0))
    .slice(0, 5)
    .map((n) => {
      let role = "Biomarker Hub";
      if (n.type === "category") role = "Clinical Category";
      else if (n.type === "report") role = "Document Source";
      const cleanLabel = n.label.replace(/\.pdf.*$/i, "").replace(/_/g, " ");
      return {
        name: cleanLabel,
        role,
        score: (n.betweenness || 0).toFixed(3),
      };
    });

  // 3. Predicate distribution from real edges
  const predCounts = new Map<string, number>();
  edges.forEach((e) => {
    predCounts.set(e.relation, (predCounts.get(e.relation) || 0) + 1);
  });

  const totalEdges = metrics.total_edges || 1;
  const predicateColors: Record<string, string> = {
    CONTAINS: "bg-[var(--verdigris)]",
    MENTIONS: "bg-[var(--ochre)]",
    HAS_MEASUREMENT: "bg-[var(--cornflower)]",
    BELONGS_TO: "bg-[var(--lilac)]",
  };

  const predicateDistribution = Array.from(predCounts.entries())
    .map(([rel, count]) => ({
      name: rel.toLowerCase(),
      count,
      pct: Math.round((count / totalEdges) * 100),
      color: predicateColors[rel] || "bg-[var(--bone)]",
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="type-title text-[var(--bone)]">Biomedical Insights & Graph Analysis</h2>
          <p className="type-meta text-[var(--dim)] mt-0.5">
            Network topology, community modularity, and cross-report evidence synthesis for {user?.display_label || "Arjun R"} ({effectiveUserId}).
          </p>
        </div>
        <Marginalia
          text="Better data. Healthier decisions."
          sketch="leaf"
        />
      </div>

      {loading ? (
        <div className="p-12 text-center text-[var(--dim)] type-body bg-[var(--ink-800)] rounded-[var(--r-14)] border border-[var(--line-strong)]">
          Analyzing network topology and computing community modularity...
        </div>
      ) : (
        /* Grid of 4 Insight Cards (§9.7) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Louvain Community Card */}
          <div className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
                <h3 className="type-title text-[var(--bone)] text-base">
                  Community Modularity (Louvain)
                </h3>
                <Badge variant="verdigris">Q = {metrics.modularity.toFixed(2)}</Badge>
              </div>

              <p className="type-meta text-[var(--dim)] text-xs mb-4">
                Partitioning of {metrics.total_nodes} biomedical entities into {metrics.communities_count} densely connected clinical clusters.
              </p>

              <div className="space-y-3 py-2 border-y border-[var(--line-faint)] text-xs">
                {communityClusters.map((cluster, idx) => (
                  <div key={cluster.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          clusterColors[idx % clusterColors.length]
                        }`}
                      />
                      <span className="type-label text-[var(--bone)] truncate max-w-[200px]">
                        {cluster.label}
                      </span>
                    </div>
                    <span className="type-mono-sm text-[var(--dim)]">
                      {cluster.coreNodes} nodes · {cluster.edges} edges
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 flex justify-end">
              <Link to="/graph">
                <Button variant="ghost" className="h-7 text-xs">
                  Inspect clusters in graph
                </Button>
              </Link>
            </div>
          </div>

          {/* 2. Degree & Betweenness Centrality */}
          <div className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
                <h3 className="type-title text-[var(--bone)] text-base">
                  Centrality Hub Ranking
                </h3>
                <Badge variant="cornflower">Betweenness</Badge>
              </div>

              <p className="type-meta text-[var(--dim)] text-xs mb-4">
                High-influence concepts with greatest cross-disciplinary connectivity.
              </p>

              <div className="space-y-2.5 py-2 border-y border-[var(--line-faint)] text-xs">
                {topHubs.map((hub, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div>
                      <span className="type-body font-medium text-[var(--bone)] block truncate max-w-[220px]">
                        {hub.name}
                      </span>
                      <span className="type-meta text-[var(--dim)] text-[10px]">
                        {hub.role}
                      </span>
                    </div>
                    <span className="type-mono-sm text-[var(--verdigris)] font-semibold">
                      {hub.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 flex justify-end">
              <Link to="/graph">
                <Button variant="ghost" className="h-7 text-xs">
                  Filter by hub
                </Button>
              </Link>
            </div>
          </div>

          {/* 3. Predicate Distribution */}
          <div className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
                <h3 className="type-title text-[var(--bone)] text-base">
                  Relationship Predicate Frequencies
                </h3>
                <Badge variant="ochre">{metrics.total_edges} edges</Badge>
              </div>

              <div className="space-y-3 py-2 text-xs">
                {predicateDistribution.map((p, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="type-mono-sm text-[var(--bone)] font-mono">{p.name}</span>
                      <span className="type-mono-sm text-[var(--dim)]">
                        {p.count} ({p.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--ink-700)] overflow-hidden">
                      <div
                        style={{ width: `${Math.max(p.pct, 4)}%` }}
                        className={`h-full ${p.color} rounded-full`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--line-faint)]">
              <span className="type-meta text-[var(--faint)] text-[11px]">
                Computed dynamically from NetworkX knowledge graph
              </span>
            </div>
          </div>

          {/* 4. Cross-Study Synthesis */}
          <div className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
                <h3 className="type-title text-[var(--bone)] text-base">
                  Longitudinal Synthesis
                </h3>
                <Badge variant="verdigris">Active Topology</Badge>
              </div>

              <div className="space-y-3 py-2 text-xs">
                <p className="type-reading text-[var(--bone)] text-sm leading-relaxed">
                  Knowledge network covers Complete Blood Count, Metabolic Panel, Lipid Profile, and Vitamins across {metrics.total_nodes} vertices and {metrics.total_edges} verified relationships.
                </p>

                <div className="p-3 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
                  <span className="type-label text-[var(--dim)] text-[11px] block mb-1">
                    Graph Density & Connectivity
                  </span>
                  <p className="type-reading italic text-[var(--bone)] text-xs">
                    "Graph density of {metrics.density.toFixed(4)} with modularity Q={metrics.modularity.toFixed(2)} demonstrates strong intra-panel cohesion with distinct biomarker subclusters."
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--line-faint)] flex justify-end">
              <Link to="/ask">
                <Button variant="ghost" className="h-7 text-xs">
                  Query evidence in Ask
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Causality Footnote per DESIGN.md §9.7 */}
      <div className="p-4 rounded-[var(--r-10)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
        <p className="type-quote text-[var(--dim)] text-xs italic">
          "Graph associations indicate statistical and literature co-occurrence; they do not establish unmeasured biological causality."
        </p>
      </div>
    </div>
  );
};
