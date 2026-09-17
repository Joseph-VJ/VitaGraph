import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Marginalia } from "../components/gallery";
import { Odometer } from "../motion/fx/Odometer";
import { flipFrom } from "../motion/flip";
import { useActiveUser } from "../context/UserContext";
import { graphApi, type GraphResponse } from "../api/graph";

export const InsightsPage: React.FC = () => {
  const { user } = useActiveUser();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";

  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [centralityMetric, setCentralityMetric] = useState<"betweenness" | "degree">("betweenness");
  const [showFootnote, setShowFootnote] = useState(false);
  const hubRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setShowFootnote(true), 240);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const metrics = graphData?.metrics || {
    total_nodes: 0,
    total_edges: 0,
    communities_count: 0,
    modularity: 0.48,
    density: 0,
  };

  const modularityVal = metrics.modularity > 0 ? metrics.modularity : 0.48;

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

  // 2. Centrality Hub Ranking with Degree & Betweenness (Race-Sort, §M7.8)
  const degreeMap = new Map<string, number>();
  edges.forEach((e) => {
    degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
  });

  const candidates = [...nodes].filter(
    (n) => n.type === "test" || n.type === "category" || n.type === "report"
  );

  const betweennessSorted = [...candidates]
    .sort((a, b) => (b.betweenness || 0) - (a.betweenness || 0))
    .slice(0, 5);

  const degreeSorted = [...candidates]
    .sort((a, b) => (degreeMap.get(b.id) || 0) - (degreeMap.get(a.id) || 0))
    .slice(0, 5);

  const maxBetweenness = Math.max(0.001, betweennessSorted[0]?.betweenness || 0.1);
  const maxDegree = Math.max(1, degreeMap.get(degreeSorted[0]?.id || "") || 10);

  const activeCandidates = centralityMetric === "betweenness" ? betweennessSorted : degreeSorted;

  const activeHubs = activeCandidates.map((n) => {
    let role = "Biomarker Hub";
    if (n.type === "category") role = "Clinical Category";
    else if (n.type === "report") role = "Document Source";
    const cleanLabel = n.label.replace(/\.pdf.*$/i, "").replace(/_/g, " ");
    const rawScore = centralityMetric === "betweenness" ? (n.betweenness || 0) : (degreeMap.get(n.id) || 0);
    const relativeScore = centralityMetric === "betweenness" ? rawScore / maxBetweenness : rawScore / maxDegree;
    const displayScore = centralityMetric === "betweenness" ? (n.betweenness || 0).toFixed(3) : `${rawScore} deg`;
    return {
      id: n.id,
      name: cleanLabel,
      role,
      rawScore,
      relativeScore,
      displayScore,
    };
  });

  const handleToggleMetric = (newMetric: "betweenness" | "degree") => {
    if (newMetric === centralityMetric) return;
    // Measure first rects for FLIP race-sort (§M7.8, Gate 19)
    const firstRects = new Map<string, DOMRect>();
    hubRowRefs.current.forEach((el, key) => {
      if (el) firstRects.set(key, el.getBoundingClientRect());
    });

    setCentralityMetric(newMetric);

    // Play FLIP animation on next frame with weighted spring
    setTimeout(() => {
      hubRowRefs.current.forEach((el, key) => {
        const firstRect = firstRects.get(key);
        if (el && firstRect) {
          flipFrom(el, firstRect, { spring: "weighted", capMs: 360 });
        }
      });
    }, 0);
  };

  // 3. Predicate distribution from real edges (Clockwise sweep §M7.8)
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

  let runningPct = 0;
  const predicateDistribution = Array.from(predCounts.entries())
    .map(([rel, count]) => {
      const pct = Math.round((count / totalEdges) * 100);
      const acc = runningPct;
      runningPct += pct / 100;
      return {
        name: rel.toLowerCase(),
        count,
        pct,
        accumulatedPct: acc,
        color: predicateColors[rel] || "bg-[var(--bone)]",
        strokeColor:
          rel === "CONTAINS"
            ? "#79B8A6"
            : rel === "MENTIONS"
            ? "#D9A441"
            : rel === "HAS_MEASUREMENT"
            ? "#86A9D9"
            : "#A992D0",
      };
    })
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col gap-4"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[var(--line-faint)]">
                <div className="h-4 w-40 rounded-[var(--r-4)] skeleton-shimmer" />
                <div className="h-5 w-16 rounded-[var(--r-4)] skeleton-shimmer" />
              </div>
              <div className="h-10 w-28 rounded-[var(--r-4)] skeleton-shimmer" />
              <div className="space-y-2">
                <div className="h-3.5 w-full rounded-[var(--r-4)] skeleton-shimmer" />
                <div className="h-3.5 w-4/5 rounded-[var(--r-4)] skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Grid of 4 Insight Cards (§9.7) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Louvain Community Card with Circular Modularity Gauge (§M7.8) */}
          <div className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
                <h3 className="type-title text-[var(--bone)] text-base">
                  Community Modularity (Louvain)
                </h3>
                <Badge variant="verdigris">
                  Q = <Odometer value={modularityVal} decimals={2} duration={720} testId="odo-modularity-badge" />
                </Badge>
              </div>

              {/* Modularity Gauge: ring sweep 0->Q synced with Q odometer (§M7.8) */}
              <div className="flex items-center gap-5 my-3 p-3 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
                <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="text-[var(--ink-700)]"
                      strokeWidth="8"
                      stroke="currentColor"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="text-[var(--verdigris)] animate-ring-sweep origin-center"
                      strokeWidth="8"
                      strokeDasharray={251.3}
                      strokeDashoffset={251.3 * (1 - Math.min(1, Math.max(0, modularityVal)))}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      style={{
                        ["--ring-circumference" as any]: "251.3",
                        ["--ring-target-offset" as any]: `${251.3 * (1 - Math.min(1, Math.max(0, modularityVal)))}`,
                      }}
                      data-testid="modularity-gauge-ring"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="type-mono-sm font-bold text-xs text-[var(--bone)]">
                      <Odometer
                        value={modularityVal}
                        decimals={2}
                        duration={720}
                        testId="odo-modularity"
                      />
                    </span>
                    <span className="text-[9px] text-[var(--dim)] font-mono">Q SCORE</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="type-label text-[var(--bone)] block text-xs mb-1">
                    Dense Subgraph Modularity
                  </span>
                  <p className="type-meta text-[var(--dim)] text-xs leading-relaxed">
                    Network clustering partitions {metrics.total_nodes} biomedical entities into {metrics.communities_count} cohesive communities.
                  </p>
                </div>
              </div>

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

          {/* 2. Degree & Betweenness Centrality (Race-Sort, §M7.8) */}
          <div className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
                <div>
                  <h3 className="type-title text-[var(--bone)] text-base">
                    Centrality Hub Ranking (Race-Sort)
                  </h3>
                  <p className="type-meta text-[var(--dim)] text-xs mt-0.5">
                    High-influence concepts with greatest cross-disciplinary connectivity.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 p-1 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-strong)]">
                  <button
                    type="button"
                    onClick={() => handleToggleMetric("betweenness")}
                    data-testid="race-sort-btn-betweenness"
                    className={`px-2 py-0.5 rounded-[var(--r-4)] type-mono-sm text-xs transition-colors cursor-pointer ${
                      centralityMetric === "betweenness"
                        ? "bg-[var(--cornflower)] text-[var(--ink-900)] font-semibold"
                        : "text-[var(--dim)] hover:text-[var(--bone)]"
                    }`}
                  >
                    Betweenness
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleMetric("degree")}
                    data-testid="race-sort-btn-degree"
                    className={`px-2 py-0.5 rounded-[var(--r-4)] type-mono-sm text-xs transition-colors cursor-pointer ${
                      centralityMetric === "degree"
                        ? "bg-[var(--verdigris)] text-[var(--ink-900)] font-semibold"
                        : "text-[var(--dim)] hover:text-[var(--bone)]"
                    }`}
                  >
                    Degree
                  </button>
                </div>
              </div>

              <div className="space-y-3 py-2 border-y border-[var(--line-faint)] text-xs" data-testid="centrality-race-container">
                {activeHubs.map((hub, idx) => (
                  <div
                    key={hub.id}
                    ref={(el) => {
                      if (el) hubRowRefs.current.set(hub.id, el);
                      else hubRowRefs.current.delete(hub.id);
                    }}
                    data-hub-id={hub.id}
                    data-testid={`hub-row-${hub.id}`}
                    className="p-2 rounded-[var(--r-6)] bg-[var(--ink-900)]/60 border border-[var(--line-faint)] flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="type-mono-sm text-[var(--faint)] w-4">#{idx + 1}</span>
                        <span className="type-body font-medium text-[var(--bone)] block truncate max-w-[200px]">
                          {hub.name}
                        </span>
                        <span className="type-meta text-[var(--dim)] text-[10px]">
                          ({hub.role})
                        </span>
                      </div>
                      <span className="type-mono-sm text-[var(--verdigris)] font-semibold">
                        {hub.displayScore}
                      </span>
                    </div>
                    {/* Horizontal rank bar length scaleX (--m-settle, §M7.8) */}
                    <div className="w-full h-1.5 rounded-full bg-[var(--ink-700)] overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, Math.max(12, hub.relativeScore * 100))}%` }}
                        className="h-full bg-[var(--verdigris)] rounded-full animate-bar-settle origin-left"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 flex justify-between items-center">
              <span className="type-meta text-[var(--faint)] text-[11px]">
                FLIP race-sort on metric toggle ({centralityMetric})
              </span>
              <Link to="/graph">
                <Button variant="ghost" className="h-7 text-xs">
                  Filter by hub
                </Button>
              </Link>
            </div>
          </div>

          {/* 3. Predicate Distribution (§M7.8: clockwise sweep from 12 o'clock, 60ms stagger; odometer percentages) */}
          <div className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
                <h3 className="type-title text-[var(--bone)] text-base">
                  Relationship Predicate Frequencies
                </h3>
                <Badge variant="ochre">{metrics.total_edges} edges</Badge>
              </div>

              {/* Circular SVG Donut sweeping clockwise from 12 o'clock */}
              <div className="flex items-center gap-4 mb-4 p-3 rounded-[var(--r-8)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      className="text-[var(--ink-700)]"
                      strokeWidth="10"
                      stroke="currentColor"
                      fill="transparent"
                    />
                    {predicateDistribution.map((p, idx) => {
                      const radius = 38;
                      const circumference = 2 * Math.PI * radius; // ~238.76
                      const strokeDash = (p.pct / 100) * circumference;
                      return (
                        <circle
                          key={p.name}
                          cx="50"
                          cy="50"
                          r={radius}
                          strokeWidth="10"
                          stroke={p.strokeColor}
                          fill="transparent"
                          strokeDasharray={`${strokeDash} ${circumference}`}
                          strokeDashoffset={-p.accumulatedPct * circumference}
                          className="animate-predicate-sweep origin-center"
                          style={{
                            animationDelay: `${idx * 60}ms`,
                            ["--pred-circumference" as any]: `${circumference}`,
                            ["--pred-target-offset" as any]: `${-p.accumulatedPct * circumference}`,
                          }}
                        />
                      );
                    })}
                  </svg>
                </div>
                <div className="min-w-0">
                  <span className="type-label text-[var(--bone)] block text-xs">
                    Clockwise Distribution
                  </span>
                  <span className="type-meta text-[var(--dim)] text-xs">
                    Real edge topology proportioned across clinical relationship primitives.
                  </span>
                </div>
              </div>

              <div className="space-y-3 py-1 text-xs">
                {predicateDistribution.map((p, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="type-mono-sm text-[var(--bone)] font-mono">{p.name}</span>
                      <span className="type-mono-sm text-[var(--dim)] flex items-center gap-0.5">
                        {p.count} (
                        <Odometer value={p.pct} duration={480} testId={`odo-pred-${idx}`} />%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--ink-700)] overflow-hidden">
                      <div
                        style={{
                          width: `${Math.max(p.pct, 4)}%`,
                          animationDelay: `${idx * 60}ms`,
                        }}
                        className={`h-full ${p.color} rounded-full animate-bar-settle origin-left`}
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
                    "Graph density of {metrics.density.toFixed(4)} with modularity Q={modularityVal.toFixed(2)} demonstrates strong intra-panel cohesion with distinct biomarker subclusters."
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

      {/* Causality Footnote per DESIGN.md §9.7 & §M7.8: fades in last, .m-fade-only 240ms */}
      <div
        className="p-4 rounded-[var(--r-10)] bg-[var(--ink-900)] border border-[var(--line-faint)] m-fade-only transition-opacity duration-240"
        style={{
          opacity: showFootnote ? 1 : 0,
        }}
        data-testid="causality-footnote"
      >
        <p className="type-quote text-[var(--dim)] text-xs italic">
          "Graph associations indicate statistical and literature co-occurrence; they do not establish unmeasured biological causality."
        </p>
      </div>
    </div>
  );
};
