import React, { useMemo } from "react";
import type { GraphNode } from "../../api/graph";
import { CONCEPT_TYPES, STRUCTURAL_TYPES, communityColor } from "./graphTheme";

// Everything in this panel is derived from the real graph the canvas is drawing:
// betweenness for ranking, community for grouping, edge relations for the connections.

export interface ConceptItem {
  node: GraphNode;
  color: string;
}

export interface ConnectionItem {
  key: string;
  first: GraphNode;
  second: GraphNode;
  verb: string;
  firstColor: string;
  secondColor: string;
}

export interface GroupItem {
  community: number;
  name: string;
  color: string;
  size: number;
}

export interface GraphSummary {
  concepts: ConceptItem[];
  connections: ConnectionItem[];
  groups: GroupItem[];
  groupNames: Map<number, string>;
}

interface IndexedEdge {
  source: number;
  target: number;
  relation: string;
}

const lower = (t?: string) => (t || "").toLowerCase();
const between = (n: GraphNode) => n.betweenness ?? 0;
const colorOf = (n: GraphNode) => communityColor(n.community, "#9BA1B0");
const shorten = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

function describe(a: GraphNode, b: GraphNode, relation: string) {
  const ta = lower(a.type);
  if (relation === "BELONGS_TO") {
    // The category is the container, whichever way the edge happens to be stored.
    const [part, whole] = ta === "category" ? [b, a] : [a, b];
    return { first: part, second: whole, verb: "is part of" };
  }
  if (relation === "OBSERVED_ON") {
    const [what, when] = ta === "date" ? [b, a] : [a, b];
    return { first: what, second: when, verb: "observed on" };
  }
  if (relation === "HAS_MEASUREMENT") return { first: a, second: b, verb: "has value" };
  return { first: a, second: b, verb: "and" };
}

export function buildGraphSummary(nodes: GraphNode[], edges: IndexedEdge[]): GraphSummary {
  // Concepts: the tests, categories and conditions that matter most.
  let pool = nodes.filter((n) => CONCEPT_TYPES.has(lower(n.type)));
  if (pool.length < 3) {
    pool = nodes.filter((n) => !STRUCTURAL_TYPES.has(lower(n.type)) && lower(n.type) !== "person");
  }
  const seenLabels = new Set<string>();
  const concepts: ConceptItem[] = [...pool]
    .sort((a, b) => between(b) - between(a))
    .filter((n) => {
      const key = (n.label || n.id).toLowerCase();
      if (seenLabels.has(key)) return false;
      seenLabels.add(key);
      return true;
    })
    .slice(0, 10)
    .map((node) => ({ node, color: colorOf(node) }));

  // Connections: real edges between concepts (and dates), strongest endpoints first.
  const eligible = (n: GraphNode) => CONCEPT_TYPES.has(lower(n.type)) || lower(n.type) === "date";
  const seenPairs = new Set<string>();
  const connections: ConnectionItem[] = edges
    .map((e) => ({ a: nodes[e.source], b: nodes[e.target], relation: e.relation }))
    .filter((x) => x.a && x.b && eligible(x.a) && eligible(x.b))
    .sort((x, y) => between(y.a) + between(y.b) - (between(x.a) + between(x.b)))
    .filter((x) => {
      const key = [x.a.label || x.a.id, x.b.label || x.b.id].sort().join("|").toLowerCase();
      if (seenPairs.has(key)) return false;
      seenPairs.add(key);
      return true;
    })
    .slice(0, 8)
    .map((x, i) => {
      const d = describe(x.a, x.b, x.relation);
      return {
        key: `${d.first.id}-${d.second.id}-${i}`,
        first: d.first,
        second: d.second,
        verb: d.verb,
        firstColor: colorOf(d.first),
        secondColor: colorOf(d.second),
      };
    });

  // Groups: communities, named after their most central real concept.
  const byCommunity = new Map<number, GraphNode[]>();
  nodes.forEach((n) => {
    if (n.community === undefined || n.community < 0) return;
    const list = byCommunity.get(n.community);
    if (list) list.push(n);
    else byCommunity.set(n.community, [n]);
  });

  const usedNames = new Map<string, number>();
  const groups: GroupItem[] = [...byCommunity.entries()]
    .map(([community, members]) => {
      const ranked = [...members].sort((a, b) => between(b) - between(a));
      const named = ranked.find((n) => !STRUCTURAL_TYPES.has(lower(n.type)));
      let name: string;
      if (!named) name = "Report text";
      else if (lower(named.type) === "person") name = "Your records";
      else name = shorten(named.label || named.id, 26);
      return { community, name, size: members.length, score: ranked.reduce((acc, n) => acc + between(n), 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((g) => {
      const seen = usedNames.get(g.name) ?? 0;
      usedNames.set(g.name, seen + 1);
      return {
        community: g.community,
        name: seen === 0 ? g.name : `${g.name} (${seen + 1})`,
        color: communityColor(g.community, "#9BA1B0"),
        size: g.size,
      };
    });

  const groupNames = new Map<number, string>();
  groups.forEach((g) => groupNames.set(g.community, g.name));

  return { concepts, connections, groups, groupNames };
}

export type PanelTab = "concepts" | "connections" | "groups";

interface GraphConceptsPanelProps {
  /** Narrow frame: a slimmer panel, so the graph keeps room beside it. */
  compact?: boolean;
  open: boolean;
  onToggle: (open: boolean) => void;
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  summary: GraphSummary;
  selectedId?: string | null;
  onSelectNode: (node: GraphNode) => void;
  focusCommunity: number | null;
  onFocusCommunity: (community: number | null) => void;
}

const TABS: Array<{ id: PanelTab; label: string }> = [
  { id: "concepts", label: "Concepts" },
  { id: "connections", label: "Links" },
  { id: "groups", label: "Groups" },
];

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <span
    aria-hidden="true"
    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
    style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}66` }}
  />
);

const rowClass =
  "w-full text-left px-2.5 py-2 rounded-[var(--r-6)] text-[var(--bone)] cursor-pointer hover:bg-[var(--ink-700)] focus-visible:outline-2 focus-visible:outline-[var(--deep-petrol)] focus-visible:outline-offset-0 transition-colors duration-[120ms]";

export const GraphConceptsPanel: React.FC<GraphConceptsPanelProps> = ({
  compact = false,
  open,
  onToggle,
  tab,
  onTab,
  summary,
  selectedId,
  onSelectNode,
  focusCommunity,
  onFocusCommunity,
}) => {
  const empty = summary.concepts.length === 0 && summary.connections.length === 0 && summary.groups.length === 0;
  const maxCentrality = useMemo(
    () => Math.max(1e-6, ...summary.concepts.map((c) => c.node.betweenness ?? 0)),
    [summary.concepts]
  );
  const maxGroup = useMemo(() => Math.max(1, ...summary.groups.map((g) => g.size)), [summary.groups]);

  if (empty) return null;

  if (!open) {
    return (
      <button
        type="button"
        data-testid="graph-panel-open"
        aria-expanded={false}
        onClick={() => onToggle(true)}
        className="absolute bottom-3 right-14 z-20 h-9 pl-2.5 pr-3.5 inline-flex items-center gap-2 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-control)] text-[var(--bone)] type-body text-[13px] cursor-pointer hover:bg-[var(--ink-700)] shadow-[var(--shadow-float)]"
      >
        <svg className="w-3.5 h-3.5 text-[var(--deep-petrol)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="3.5" cy="6" r="1" fill="currentColor" />
          <circle cx="3.5" cy="12" r="1" fill="currentColor" />
          <circle cx="3.5" cy="18" r="1" fill="currentColor" />
        </svg>
        Concepts and links
      </button>
    );
  }

  return (
    <section
      data-testid="graph-concepts-panel"
      aria-label="Concepts and links"
      style={{ ["--panel-w" as string]: compact ? "272px" : "332px" }}
      className="absolute bottom-3 left-3 right-3 z-30 sm:left-auto sm:right-14 sm:z-20 sm:w-[var(--panel-w)] max-h-[min(46%,284px)] flex flex-col rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] shadow-[var(--shadow-float)]"
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-1.5 border-b border-[var(--line-strong)]">
        <div role="tablist" aria-label="Graph summary" className="flex items-center gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`graph-tab-${t.id}`}
              data-testid={`graph-panel-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="graph-panel-body"
              onClick={() => onTab(t.id)}
              className={`px-2.5 h-9 text-[13px] font-medium cursor-pointer border-b-2 -mb-px transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-[var(--deep-petrol)] ${
                tab === t.id
                  ? "text-[var(--bone)] border-[var(--deep-petrol)]"
                  : "text-[var(--dim)] border-transparent hover:text-[var(--bone)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Hide concepts panel"
          aria-expanded={true}
          onClick={() => onToggle(false)}
          className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--r-4)] text-[var(--dim)] hover:text-[var(--bone)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--deep-petrol)]"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div id="graph-panel-body" role="tabpanel" aria-labelledby={`graph-tab-${tab}`} className="overflow-y-auto p-1.5">
        {tab === "concepts" && (
          <ul className="m-0 p-0 list-none">
            {summary.concepts.length === 0 && <li className="px-2.5 py-2 type-meta">No concepts in view yet.</li>}
            {summary.concepts.map(({ node, color }) => {
              const width = Math.max(6, ((node.betweenness ?? 0) / maxCentrality) * 100);
              const selected = selectedId === node.id;
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    data-testid="graph-concept-chip"
                    aria-pressed={selected}
                    onClick={() => onSelectNode(node)}
                    className={`${rowClass} ${selected ? "bg-[var(--ink-700)]" : ""}`}
                  >
                    <span className="flex items-center gap-2 text-[13.5px] leading-[18px]">
                      <Dot color={color} />
                      <span className="truncate flex-1 font-medium">{node.label || node.id}</span>
                      <span className="type-meta flex-shrink-0 capitalize">{node.type}</span>
                    </span>
                    <span className="graph-bar mt-1.5 ml-[18px]" aria-hidden="true">
                      <span style={{ width: `${width}%`, backgroundColor: color, opacity: 0.85 }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "connections" && (
          <ul className="m-0 p-0 list-none">
            {summary.connections.length === 0 && <li className="px-2.5 py-2 type-meta">No links between concepts in view yet.</li>}
            {summary.connections.map((c) => (
              <li key={c.key}>
                <button type="button" data-testid="graph-connection-row" onClick={() => onSelectNode(c.first)} className={rowClass}>
                  <span className="flex items-center gap-2 text-[13.5px] leading-[18px]">
                    <Dot color={c.firstColor} />
                    <span className="truncate font-medium">{c.first.label || c.first.id}</span>
                  </span>
                  <span className="flex items-center gap-1.5 mt-0.5 ml-[18px] text-[12.5px] leading-[17px] text-[var(--dim)]">
                    <span className="flex-shrink-0">{c.verb}</span>
                    <Dot color={c.secondColor} />
                    <span className="truncate text-[var(--bone)]">{c.second.label || c.second.id}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {tab === "groups" && (
          <ul className="m-0 p-0 list-none">
            {summary.groups.map((g) => {
              const focused = focusCommunity === g.community;
              return (
                <li key={g.community}>
                  <button
                    type="button"
                    data-testid="graph-group-chip"
                    aria-pressed={focused}
                    onClick={() => onFocusCommunity(focused ? null : g.community)}
                    className={`${rowClass} ${focused ? "bg-[var(--ink-700)]" : ""}`}
                  >
                    <span className="flex items-center gap-2 text-[13.5px] leading-[18px]">
                      <Dot color={g.color} />
                      <span className="truncate flex-1 font-medium">{g.name}</span>
                      <span className="type-meta flex-shrink-0 tabular-nums">{g.size} nodes</span>
                    </span>
                    <span className="graph-bar mt-1.5 ml-[18px]" aria-hidden="true">
                      <span style={{ width: `${(g.size / maxGroup) * 100}%`, backgroundColor: g.color, opacity: 0.85 }} />
                    </span>
                  </button>
                </li>
              );
            })}
            {focusCommunity !== null && (
              <li className="px-2.5 pt-1.5 pb-1">
                <button
                  type="button"
                  onClick={() => onFocusCommunity(null)}
                  className="text-[13px] text-[var(--deep-petrol)] underline cursor-pointer min-h-[24px]"
                >
                  Show all groups
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
};
