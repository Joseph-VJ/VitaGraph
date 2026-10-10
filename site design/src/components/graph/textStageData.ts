// textStageData.ts: Pure data adapter converting AI graph entities/relations
// and pattern-graph extractions into GraphStage nodes and edges.
// No React, no network.

import type { NodeKind, StageEdge, StageNode } from "./stage/GraphStageEngine";
import { extractGraph, type Entity } from "./textGraph";
import type { AiGraph, AiGraphEdge, AiGraphNode } from "../../api/tools";

export type { AiGraph, AiGraphEdge, AiGraphNode };

export const HUB_ID = "hub";

/**
 * Maps an entity type string to a GraphStage NodeKind:
 * - hub/title node and person -> person
 * - organization, place, event, concept -> section
 * - condition, medication, symptom, test -> bio
 * - measurement, date -> meas
 * - anything else -> section
 */
export function entityTypeToNodeKind(typeStr: string): NodeKind {
  const t = (typeStr || "").toLowerCase().trim();
  if (t === "person" || t === "hub" || t === "document" || t === "title") {
    return "person";
  }
  if (
    t === "organization" ||
    t === "place" ||
    t === "event" ||
    t === "concept" ||
    t === "sentence" ||
    t === "name" ||
    t === "term" ||
    t === "keyword"
  ) {
    return "section";
  }
  if (
    t === "condition" ||
    t === "medication" ||
    t === "symptom" ||
    t === "test" ||
    t === "disease" ||
    t === "drug"
  ) {
    return "bio";
  }
  if (t === "measurement" || t === "date" || t === "value") {
    return "meas";
  }
  return "section";
}

/**
 * Resolves the raw entity type name from either an AI entity or a pattern entity.
 */
function resolveRawType(entity: { type?: string; kind?: string }): string {
  if (entity.type && entity.type.trim()) {
    return entity.type.trim().toLowerCase();
  }
  if (entity.kind) {
    const k = entity.kind;
    if (k === "Value") return "measurement";
    if (k === "Date") return "date";
    if (k === "Name") return "person";
    if (k === "Term") return "concept";
    if (k === "Keyword") return "concept";
  }
  return "concept";
}

/**
 * Converts an AI entity or pattern entity into a StageNode.
 * The real type word is stored in `group` for the docked card badge.
 */
export function entityToStageNode(
  entity: {
    id: string;
    label: string;
    type?: string;
    kind?: string;
    start?: number;
    end?: number;
    quote?: string;
    snippet?: string;
  },
  index: number
): StageNode {
  const rawType = resolveRawType(entity);
  const k = entityTypeToNodeKind(rawType);
  const quote = entity.quote ?? entity.snippet ?? "";

  return {
    id: entity.id,
    idx: index,
    k,
    label: entity.label || "Entity",
    name: entity.label || "Entity",
    group: rawType,
    unit: "",
    val: null,
    latest: null,
    delta: null,
    flag: "in",
    firstFlag: "in",
    vals: [],
    range: [null, null],
    ri: 0,
    firstI: 0,
    lastI: 0,
    imp: 1,
    from: [0, 0, 0],
    to: [0, 0, 0],
    md: 0,
    t: 0,
    k2: 0,
    quote,
    start: entity.start,
    end: entity.end,
  };
}

/**
 * Converts an edge (AI relation or pattern tuple) to a StageEdge.
 * Keeps relation label; pattern edges remain unlabeled.
 */
export function edgeToStageEdge(
  edge:
    | {
        source?: string;
        target?: string;
        a?: string;
        b?: string;
        label?: string;
      }
    | [string, string],
  index: number
): StageEdge {
  let a: string;
  let b: string;
  let label: string | undefined;

  if (Array.isArray(edge)) {
    a = edge[0];
    b = edge[1];
    label = undefined;
  } else {
    a = edge.source || edge.a || "";
    b = edge.target || edge.b || "";
    label = edge.label ? edge.label.trim() : undefined;
  }

  return {
    a,
    b,
    h: (index * 0.17) % 1,
    dir: true,
    label: label || undefined,
  };
}

/**
 * Creates the Hub / Document root node (kind: person) to keep the graph connected.
 */
export function createHubNode(title?: string): StageNode {
  const lbl = title?.trim() || "Text";
  return {
    id: HUB_ID,
    idx: 0,
    k: "person",
    label: lbl,
    name: lbl,
    group: "document",
    unit: "",
    val: null,
    latest: null,
    delta: null,
    flag: "in",
    firstFlag: "in",
    vals: [],
    range: [null, null],
    ri: 0,
    firstI: 0,
    lastI: 0,
    imp: 1.5,
    from: [0, 0, 0],
    to: [0, 0, 0],
    md: 0,
    t: 0,
    k2: 0,
  };
}

/**
 * The representative of every connected component of the entity graph: the node with the most links inside its
 * component (ties go to the earlier node in `nodes`). `nodes` must be the entities only, without the hub.
 * Returned in `nodes` order, so the hub's links are drawn in the order the entities arrived.
 */
export function componentRepresentatives(nodes: StageNode[], edges: StageEdge[]): string[] {
  const parent = new Map<string, string>(nodes.map((n) => [n.id, n.id]));
  const root = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const degree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    if (!parent.has(e.a) || !parent.has(e.b) || e.a === e.b) continue;
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
    parent.set(root(e.a), root(e.b));
  }
  const best = new Map<string, string>();
  for (const n of nodes) {
    const r = root(n.id);
    const current = best.get(r);
    if (current === undefined || (degree.get(n.id) ?? 0) > (degree.get(current) ?? 0)) best.set(r, n.id);
  }
  return nodes.filter((n) => best.get(root(n.id)) === n.id).map((n) => n.id);
}

/**
 * One unlabelled link from the hub to each representative. `h` is spaced by position in the list.
 */
export function hubEdges(representatives: string[]): StageEdge[] {
  return representatives.map((rep, i) => ({
    a: HUB_ID,
    b: rep,
    h: (i * 0.17) % 1,
    dir: true,
    label: undefined,
  }));
}

/**
 * Ensures the graph is a single connected piece by attaching the first node of
 * every disconnected component to the Hub node. Used by the pattern graph.
 */
export function ensureConnected(
  hubId: string,
  nodes: StageNode[],
  edges: StageEdge[]
): StageEdge[] {
  const allEdges = [...edges];
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n.id, []));
  allEdges.forEach((e) => {
    adj.get(e.a)?.push(e.b);
    adj.get(e.b)?.push(e.a);
  });

  const seen = new Set<string>();

  // If hub exists, mark its component first
  if (adj.has(hubId)) {
    const stack = [hubId];
    seen.add(hubId);
    while (stack.length > 0) {
      const u = stack.pop()!;
      for (const v of adj.get(u) || []) {
        if (!seen.has(v)) {
          seen.add(v);
          stack.push(v);
        }
      }
    }
  }

  // Any nodes not reached by hub belong to separate components; attach them
  for (const n of nodes) {
    if (n.id === hubId || seen.has(n.id)) continue;
    // New component found
    const stack = [n.id];
    seen.add(n.id);
    while (stack.length > 0) {
      const u = stack.pop()!;
      for (const v of adj.get(u) || []) {
        if (!seen.has(v)) {
          seen.add(v);
          stack.push(v);
        }
      }
    }
    // Connect root of this component to hub
    allEdges.push({
      a: hubId,
      b: n.id,
      h: (allEdges.length * 0.17) % 1,
      dir: true,
      label: undefined,
    });
  }

  return allEdges;
}

/**
 * Computes degree centrality and assigns `imp` (0.3..1.0) to size the dots.
 */
export function computeDegreeCentrality(
  nodes: StageNode[],
  edges: StageEdge[]
): void {
  const deg = new Map<string, number>();
  nodes.forEach((n) => deg.set(n.id, 0));
  edges.forEach((e) => {
    deg.set(e.a, (deg.get(e.a) ?? 0) + 1);
    deg.set(e.b, (deg.get(e.b) ?? 0) + 1);
  });

  let maxDeg = 1;
  deg.forEach((d) => {
    if (d > maxDeg) maxDeg = d;
  });

  nodes.forEach((n) => {
    const d = deg.get(n.id) ?? 0;
    n.imp = 0.3 + 0.7 * (d / maxDeg);
  });
}

/**
 * Builds full StageNode and StageEdge arrays from an AI graph payload.
 */
export function buildStageFromAi(
  _text: string,
  ai: AiGraph
): { nodes: StageNode[]; edges: StageEdge[] } {
  const hub = createHubNode(ai.title);
  const nodes: StageNode[] = [hub];
  const nodeMap = new Map<string, StageNode>();
  nodeMap.set(hub.id, hub);

  ai.nodes.forEach((n, i) => {
    const sn = entityToStageNode(n, i + 1);
    nodes.push(sn);
    nodeMap.set(sn.id, sn);
  });

  const rawEdges: StageEdge[] = [];
  ai.edges.forEach((e, i) => {
    if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
      rawEdges.push(edgeToStageEdge(e, i));
    }
  });

  const connectedEdges = [...rawEdges, ...hubEdges(componentRepresentatives(nodes.slice(1), rawEdges))];
  computeDegreeCentrality(nodes, connectedEdges);

  return { nodes, edges: connectedEdges };
}

/**
 * Builds full StageNode and StageEdge arrays from the pattern extractor.
 */
export function buildStageFromPattern(rawText: string): {
  nodes: StageNode[];
  edges: StageEdge[];
  entities: Entity[];
  date: string | null;
} {
  const g = extractGraph(rawText);
  const hub = createHubNode("Text");
  const nodes: StageNode[] = [hub];
  const nodeMap = new Map<string, StageNode>();
  nodeMap.set(hub.id, hub);

  g.entities.forEach((ent, i) => {
    const sn = entityToStageNode(ent, i + 1);
    nodes.push(sn);
    nodeMap.set(sn.id, sn);
  });

  const rawEdges: StageEdge[] = [];
  g.edges.forEach((tuple, i) => {
    const a = tuple[0] === "d" ? hub.id : tuple[0];
    const b = tuple[1] === "d" ? hub.id : tuple[1];
    if (nodeMap.has(a) && nodeMap.has(b)) {
      rawEdges.push(edgeToStageEdge([a, b], i));
    }
  });

  const connectedEdges = ensureConnected(hub.id, nodes, rawEdges);
  computeDegreeCentrality(nodes, connectedEdges);

  return {
    nodes,
    edges: connectedEdges,
    entities: g.entities,
    date: g.date,
  };
}
