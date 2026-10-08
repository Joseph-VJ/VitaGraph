// Turns the AI's entities and relations into the same shape the Text to Graph canvas draws.
import type { AiGraph } from "../../api/tools";
import { layout3D, type NodeKind } from "./layout3d";
import type { Entity, EntityKind, TextGraph, TextGraphNode } from "./textGraph";

export interface AiTextGraph extends TextGraph {
  /** Relation words, keyed "source|target" (the order of the edge as drawn). */
  edgeLabels: Record<string, string>;
  relationCount: number;
}

const HUB = "d";

function nodeKind(type: string): NodeKind {
  if (type === "date") return "report"; // drawn as a date ring
  if (type === "measurement") return "meas"; // drawn as a small value dot
  return "bio";
}

function entityKind(type: string): EntityKind {
  if (type === "date") return "Date";
  if (type === "measurement") return "Value";
  if (type === "person" || type === "organization" || type === "place") return "Name";
  return "Term";
}

function mentions(text: string, label: string): number {
  const needle = label.toLowerCase();
  if (!needle) return 1;
  const hay = text.toLowerCase();
  let count = 0;
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) count++;
  return Math.max(1, count);
}

export function aiGraphToTextGraph(text: string, ai: AiGraph): AiTextGraph {
  const labelOf = new Map(ai.nodes.map((n) => [n.id, n.label]));
  const edges: [string, string][] = [];
  const edgeLabels: Record<string, string> = {};
  for (const e of ai.edges) {
    if (!labelOf.has(e.source) || !labelOf.has(e.target)) continue;
    const key = `${e.source}|${e.target}`;
    if (key in edgeLabels) continue;
    edges.push([e.source, e.target]);
    edgeLabels[key] = e.label;
  }
  const relationCount = edges.length;

  // Everything hangs off one hub so the graph is a single connected piece, as in pattern mode.
  const adjacent = new Map<string, string[]>(ai.nodes.map((n) => [n.id, []]));
  for (const [a, b] of edges) {
    adjacent.get(a)!.push(b);
    adjacent.get(b)!.push(a);
  }
  const seen = new Set<string>();
  for (const n of ai.nodes) {
    if (seen.has(n.id)) continue;
    const stack = [n.id];
    seen.add(n.id);
    while (stack.length) for (const nb of adjacent.get(stack.pop()!) ?? []) if (!seen.has(nb)) (seen.add(nb), stack.push(nb));
    edges.push([HUB, n.id]); // first node of each separate piece
  }

  const kinds = new Map<string, NodeKind>([[HUB, "person"], ...ai.nodes.map((n): [string, NodeKind] => [n.id, nodeKind(n.type)])]);
  const layoutNodes = [{ id: HUB, k: "person" as NodeKind }, ...ai.nodes.map((n) => ({ id: n.id, k: kinds.get(n.id)! }))];
  const pos = layout3D(layoutNodes, edges);

  const relationLines = (id: string): string =>
    ai.edges
      .filter((e) => (e.source === id || e.target === id) && labelOf.has(e.source) && labelOf.has(e.target))
      .slice(0, 6)
      .map((e) => `${labelOf.get(e.source)} ${e.label} ${labelOf.get(e.target)}`)
      .join("\n");

  const nodes: TextGraphNode[] = [
    { id: HUB, k: "person", label: ai.title || "Text", pos: pos[HUB], about: `The text as a whole. ${ai.nodes.length} entities and ${relationCount} relations found by the AI, each tied to exact words in the text.` },
    ...ai.nodes.map((n) => {
      const lines = relationLines(n.id);
      return {
        id: n.id,
        k: kinds.get(n.id)!,
        label: n.label,
        pos: pos[n.id],
        about: `${n.type[0].toUpperCase()}${n.type.slice(1)}. Found at characters ${n.start}–${n.end}: “${n.quote}”${lines ? `\n${lines}` : ""}`,
      };
    }),
  ];

  const entities: Entity[] = ai.nodes
    .map((n) => ({
      id: n.id,
      label: n.label,
      kind: entityKind(n.type),
      mentions: mentions(text, n.label),
      start: n.start,
      end: n.end,
      snippet: n.quote,
    }))
    .sort((x, y) => y.mentions - x.mentions || x.start - y.start);

  return { nodes, edges, entities, date: null, edgeLabels, relationCount };
}
