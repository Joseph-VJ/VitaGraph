import { useEffect, useMemo, useRef } from "react";
import { ForceGraph, type ForceGraphNodeInput, type ForceGraphEdgeInput } from "./ForceGraph";
import type { GraphResponse } from "../api/graph";

const COMMUNITY_HUES = [
  "#60A5FA", "#34D399", "#F59E0B", "#F472B6", "#A78BFA",
  "#22D3EE", "#F87171", "#A3E635", "#FB923C", "#2DD4BF",
];

const TYPE_FALLBACK: Record<string, string> = {
  report: "#3B82F6",
  test: "#10B981",
  measurement: "#F59E0B",
  category: "#06B6D4",
  chunk: "#8B5CF6",
};

function hueFor(community: number | undefined | null, type: string): string {
  if (community !== undefined && community !== null) {
    return COMMUNITY_HUES[((community % COMMUNITY_HUES.length) + COMMUNITY_HUES.length) % COMMUNITY_HUES.length];
  }
  return TYPE_FALLBACK[type] || "#64748B";
}

/**
 * KnowledgeGraphCanvas - InfraNodus-style force-directed renderer for the
 * real NetworkX graph. Same external props as the previous implementation.
 */
export function KnowledgeGraphCanvas({
  activeConcepts = [],
  graphData = null,
  onRebuildLog,
}: {
  activeConcepts?: string[];
  graphData?: GraphResponse | null;
  onRebuildLog?: () => void;
}) {
  const logRef = useRef(onRebuildLog);
  logRef.current = onRebuildLog;
  const loggedForRef = useRef<string>("");

  const { nodes, edges } = useMemo(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      // Fallback demo (backend offline) - keeps Stage 4 never blank
      const demo = [
        { id: "Hemoglobin", c: COMMUNITY_HUES[0], r: 15 },
        { id: "Vitamin D", c: COMMUNITY_HUES[1], r: 13 },
        { id: "Total Cholesterol", c: COMMUNITY_HUES[2], r: 13 },
        { id: "Fasting Glucose", c: COMMUNITY_HUES[3], r: 12 },
        { id: "Platelets", c: COMMUNITY_HUES[4], r: 12 },
        { id: "WBC", c: COMMUNITY_HUES[5], r: 12 },
      ];
      const fn: ForceGraphNodeInput[] = demo.map((d) => ({
        id: d.id,
        label: d.id,
        color: d.c,
        r: d.r,
        active: activeConcepts.some((c) => d.id.toLowerCase().includes(c.toLowerCase())),
        importance: d.r * 2,
      }));
      const fe: ForceGraphEdgeInput[] = [];
      for (let i = 0; i < fn.length; i++) {
        fe.push({ source: i, target: (i + 1) % fn.length, weight: 2 });
        if (i > 0 && i < 4) fe.push({ source: 0, target: i, weight: 1 });
      }
      return { nodes: fn, edges: fe };
    }

    const fn: ForceGraphNodeInput[] = graphData.nodes.map((n) => {
      const isLabeled =
        n.type === "report" || n.type === "test" || n.type === "measurement" || n.type === "category";
      const radius =
        n.betweenness !== undefined
          ? Math.max(8, Math.min(22, 10 + n.betweenness * 26))
          : n.r || 12;
      const isActive =
        Boolean(n.active) ||
        activeConcepts.some(
          (c) =>
            (n.label && n.label.toLowerCase().includes(c.toLowerCase())) ||
            (n.test_name && n.test_name.toLowerCase().includes(c.toLowerCase()))
        );
      return {
        id: n.id,
        label: isLabeled ? n.label : undefined,
        color: hueFor(n.community, n.type),
        r: radius,
        active: isActive,
        importance: (n.betweenness ?? 0) * 100 + radius,
      };
    });
    const indexById = new Map(fn.map((n, i) => [n.id, i]));
    const fe: ForceGraphEdgeInput[] = [];
    (graphData.edges || []).forEach((e) => {
      const s = indexById.get(e.source);
      const t = indexById.get(e.target);
      if (s !== undefined && t !== undefined) fe.push({ source: s, target: t, weight: 1.5 });
    });
    return { nodes: fn, edges: fe };
  }, [graphData, activeConcepts]);

  // One rebuild log per graph payload
  useEffect(() => {
    const key = graphData ? `${graphData.metrics.total_nodes}:${graphData.metrics.total_edges}` : "fallback";
    if (loggedForRef.current !== key) {
      loggedForRef.current = key;
      logRef.current?.();
    }
  }, [graphData]);

  return (
    <ForceGraph
      nodes={nodes}
      edges={edges}
      theme="light"
      className="rounded-2xl block"
    />
  );
}
