import type { GraphNode, GraphResponse } from "../../api/graph";
import type { Report } from "../../types";
import { layout3D, type NodeKind } from "./layout3d";
import type { GEdge, GNode } from "./GraphCanvas";

export interface FocusItem {
  id: string;
  label: string;
  count: number;
  ids: string[] | null;
}

export interface NodeCardNeighbor {
  id: string;
  label: string;
}

export interface NodeTraceInfo {
  reportId?: string;
  chunkId?: string;
  page?: number;
  searchStr?: string;
}

export interface SelectedNodeDetail {
  id: string;
  kind: string;
  label: string;
  about: string;
  nbs: NodeCardNeighbor[];
  trace?: NodeTraceInfo;
}

export interface ProcessedGraph {
  nodes: GNode[];
  edges: GEdge[];
  rawNodesById: Map<string, GraphNode>;
  shownCount: number;
  totalCount: number;
  shownEdgesCount: number;
  focuses: FocusItem[];
  getNodeDetail: (
    id: string,
    userId: string,
    reports: Report[]
  ) => SelectedNodeDetail | null;
}

export function mapNodeKind(type: string): NodeKind {
  const t = type.toLowerCase();
  if (t === "person" || t === "user") return "person";
  if (t === "report") return "report";
  if (t === "category" || t === "section" || t === "date") return "section";
  if (t === "test" || t === "biomarker" || t === "bio") return "bio";
  if (t === "measurement" || t === "meas") return "meas";
  if (t === "uncertainty" || t === "unc") return "unc";
  return "section";
}

export function processGraphData(data: GraphResponse): ProcessedGraph {
  const allRawNodes = data.nodes || [];
  const allRawEdges = data.edges || [];

  const rawNodesById = new Map<string, GraphNode>();
  for (const n of allRawNodes) {
    rawNodesById.set(n.id, n);
  }

  // Raw adjacency for tracing chunks
  const rawNeighbors = new Map<string, string[]>();
  for (const e of allRawEdges) {
    const listA = rawNeighbors.get(e.source) || [];
    listA.push(e.target);
    rawNeighbors.set(e.source, listA);

    const listB = rawNeighbors.get(e.target) || [];
    listB.push(e.source);
    rawNeighbors.set(e.target, listB);
  }

  // Chunk nodes are not drawn
  const candidates = allRawNodes.filter(
    (n) => n.type.toLowerCase() !== "chunk"
  );
  const totalCount = candidates.length;

  // Sort by betweenness descending, keep top 120
  candidates.sort((a, b) => (b.betweenness ?? 0) - (a.betweenness ?? 0));
  const topRawNodes = candidates.slice(0, 120);
  const keptIds = new Set(topRawNodes.map((n) => n.id));

  // Edges between kept nodes
  const keptEdges: GEdge[] = allRawEdges
    .filter((e) => keptIds.has(e.source) && keptIds.has(e.target))
    .map((e) => [e.source, e.target] as GEdge);

  // Kept adjacency for neighbor navigation
  const keptNeighbors = new Map<string, string[]>();
  for (const [u, v] of keptEdges) {
    const lu = keptNeighbors.get(u) || [];
    lu.push(v);
    keptNeighbors.set(u, lu);

    const lv = keptNeighbors.get(v) || [];
    lv.push(u);
    keptNeighbors.set(v, lv);
  }

  // 3D Layout
  const layoutInput = topRawNodes.map((n) => ({
    id: n.id,
    k: mapNodeKind(n.type),
  }));
  const positions = layout3D(layoutInput, keptEdges);

  const gNodes: GNode[] = topRawNodes.map((n) => {
    const k = mapNodeKind(n.type);
    let label = n.label;
    if (k === "report") {
      if (n.date && n.date.toLowerCase() !== "unknown date" && n.date.trim() !== "") {
        label = n.date.trim();
      } else {
        const base = n.label
          .replace(/\.[a-zA-Z0-9]+(\s*\(.*\))?$/, "")
          .replace(/\s*\(.*\)$/, "")
          .trim();
        label = base || n.label;
      }
    }
    return {
      id: n.id,
      k,
      label,
      pos: positions[n.id] ?? [0, 0, 0],
    };
  });

  const gNodesById = new Map<string, GNode>();
  for (const gn of gNodes) {
    gNodesById.set(gn.id, gn);
  }

  // Communities / Subgraph Focuses
  const commMap = new Map<number | string, GraphNode[]>();
  for (const n of topRawNodes) {
    if (n.community != null) {
      const list = commMap.get(n.community) || [];
      list.push(n);
      commMap.set(n.community, list);
    }
  }

  const validComms: { commId: number | string; nodes: GraphNode[] }[] = [];
  for (const [commId, nodes] of commMap.entries()) {
    if (nodes.length >= 3) {
      validComms.push({ commId, nodes });
    }
  }

  validComms.sort((a, b) => b.nodes.length - a.nodes.length);
  const topComms = validComms.slice(0, 6);

  const focuses: FocusItem[] = [
    {
      id: "all",
      label: "All nodes",
      count: topRawNodes.length,
      ids: null,
    },
  ];

  for (const comm of topComms) {
    // Prefer test/biomarker or section/category/date nodes over report file names
    const testOrSection = comm.nodes.filter((n) => {
      const t = n.type.toLowerCase();
      return (
        t === "test" ||
        t === "biomarker" ||
        t === "bio" ||
        t === "section" ||
        t === "category" ||
        t === "date"
      );
    });

    let bestNode: GraphNode | undefined;
    if (testOrSection.length > 0) {
      testOrSection.sort((a, b) => (b.betweenness ?? 0) - (a.betweenness ?? 0));
      bestNode = testOrSection[0];
    } else {
      const sorted = comm.nodes.slice().sort((a, b) => (b.betweenness ?? 0) - (a.betweenness ?? 0));
      bestNode = sorted[0];
    }

    let name = bestNode?.label || `Community ${comm.commId}`;
    if (bestNode?.type?.toLowerCase() === "report") {
      if (bestNode.date && bestNode.date.toLowerCase() !== "unknown date" && bestNode.date.trim() !== "") {
        name = bestNode.date.trim();
      } else {
        name = (bestNode.label || "")
          .replace(/\.[a-zA-Z0-9]+(\s*\(.*\))?$/, "")
          .replace(/\s*\(.*\)$/, "")
          .trim() || `Report ${comm.commId}`;
      }
    }

    if (name.length > 28) {
      name = name.slice(0, 27) + "…";
    }

    focuses.push({
      id: String(comm.commId),
      label: name,
      count: comm.nodes.length,
      ids: comm.nodes.map((n) => n.id),
    });
  }

  const getNodeDetail = (
    id: string,
    userId: string,
    reports: Report[]
  ): SelectedNodeDetail | null => {
    const raw = rawNodesById.get(id);
    const gn = gNodesById.get(id);
    if (!raw && !gn) return null;

    const rawType = (raw?.type || "unknown").toLowerCase();
    let kind = "Section";
    if (rawType === "person" || rawType === "user") kind = "Subject";
    else if (rawType === "report") kind = "Report";
    else if (rawType === "date") kind = "Date";
    else if (rawType === "test" || rawType === "biomarker" || rawType === "bio")
      kind = "Biomarker";
    else if (rawType === "measurement" || rawType === "meas") kind = "Measurement";
    else if (rawType === "uncertainty" || rawType === "unc") kind = "Uncertainty";
    else if (rawType === "category") kind = "Category";

    const label = raw?.label || gn?.label || id;

    // About sentence
    let about = "";
    if (kind === "Subject") {
      about = `Subject. Every report and passage is scoped to ${userId}.`;
    } else if (kind === "Report") {
      const rep = reports.find(
        (r) => r.id === raw?.report_id || r.id === raw?.id || r.original_filename === raw?.label
      );
      if (rep?.page_count != null) {
        about = `${label}. ${rep.page_count} page${rep.page_count === 1 ? "" : "s"}.`;
      } else {
        about = `${label}.`;
      }
    } else if (kind === "Biomarker") {
      // Find connected measurements and reports
      const nbs = rawNeighbors.get(id) || [];
      const measNodes = nbs
        .map((nid) => rawNodesById.get(nid))
        .filter((n) => n && (n.type === "measurement" || n.type === "meas"));
      const measCount = measNodes.length || 1;
      const repIds = new Set<string>();
      for (const m of measNodes) {
        if (m?.report_id) repIds.add(m.report_id);
      }
      for (const nid of nbs) {
        const o = rawNodesById.get(nid);
        if (o?.report_id) repIds.add(o.report_id);
      }
      const repCount = repIds.size || 1;
      about = `${measCount} measurement${measCount === 1 ? "" : "s"} across ${repCount} report${repCount === 1 ? "" : "s"}.`;
    } else if (kind === "Measurement") {
      const valStr = raw?.value != null ? String(raw.value) : "";
      const unitStr = raw?.unit ? ` ${raw.unit}` : "";
      const flagStr = raw?.flag ? `flagged ${raw.flag}` : "flagged NORMAL";
      const dateStr = raw?.date || "Unknown date";
      about = `${valStr}${unitStr}, ${flagStr}, ${dateStr}.`.trim();
    } else if (kind === "Section" || kind === "Date" || kind === "Category") {
      const repIds = new Set<string>();
      const nbs = rawNeighbors.get(id) || [];
      for (const nid of nbs) {
        const o = rawNodesById.get(nid);
        if (o?.report_id) repIds.add(o.report_id);
        if (o?.type === "report") repIds.add(o.id);
      }
      const k = repIds.size || 1;
      about = `Appears in ${k} report${k === 1 ? "" : "s"}.`;
    } else if (kind === "Uncertainty") {
      about = label;
    } else {
      about = label;
    }

    // Neighbors (at most 8 from shown graph)
    const knbIds = keptNeighbors.get(id) || [];
    const nbs: NodeCardNeighbor[] = [];
    for (const nid of knbIds) {
      if (nbs.length >= 8) break;
      const on = gNodesById.get(nid);
      if (on) {
        nbs.push({ id: on.id, label: on.label });
      }
    }

    // Trace chunk & report info
    let trace: NodeTraceInfo | undefined;
    if (raw?.chunk_id && raw?.report_id) {
      trace = {
        chunkId: raw.chunk_id,
        reportId: raw.report_id,
        page: raw.page,
        searchStr: raw.value != null ? String(raw.value) : raw.label,
      };
    } else {
      // Look in raw neighbors for chunk
      const rNbs = rawNeighbors.get(id) || [];
      let foundChunk = rNbs
        .map((nid) => rawNodesById.get(nid))
        .find((n) => n && n.type === "chunk");

      // If measurement, check parent test node
      if (!foundChunk && (rawType === "measurement" || rawType === "meas")) {
        for (const nid of rNbs) {
          const testNode = rawNodesById.get(nid);
          if (testNode && (testNode.type === "test" || testNode.type === "bio")) {
            const testNbs = rawNeighbors.get(nid) || [];
            foundChunk = testNbs
              .map((tnid) => rawNodesById.get(tnid))
              .find((n) => n && n.type === "chunk");
            if (foundChunk) break;
          }
        }
      }

      // If report, find any child chunk
      if (!foundChunk && rawType === "report") {
        foundChunk = rNbs
          .map((nid) => rawNodesById.get(nid))
          .find((n) => n && n.type === "chunk");
      }

      if (foundChunk?.chunk_id && foundChunk?.report_id) {
        trace = {
          chunkId: foundChunk.chunk_id,
          reportId: foundChunk.report_id,
          page: foundChunk.page,
          searchStr: raw?.value != null ? String(raw.value) : raw?.label || "",
        };
      }
    }

    return {
      id,
      kind,
      label,
      about,
      nbs,
      trace,
    };
  };

  return {
    nodes: gNodes,
    edges: keptEdges,
    rawNodesById,
    shownCount: gNodes.length,
    totalCount,
    shownEdgesCount: keptEdges.length,
    focuses,
    getNodeDetail,
  };
}
