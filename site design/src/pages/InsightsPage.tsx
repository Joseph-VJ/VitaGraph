import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { graphApi, type GraphResponse } from "../api/graph";
import { useActiveUser } from "../context/UserContext";
import { transitionNavigate } from "../motion/navigation";

const KIND: Record<string, string> = {
  person: "Subject", report: "Report", category: "Panel", section: "Document section", test: "Biomarker",
  measurement: "Measurement", uncertainty: "Uncertainty", chunk: "Text fragment", date: "Date",
};
const kindName = (t: string): string => KIND[t] ?? t.charAt(0).toUpperCase() + t.slice(1);

const headStyle: React.CSSProperties = {
  fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-700)",
};

export const InsightsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useActiveUser();
  const userId = user?.id ?? null;
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setGraph(null);
    setError(null);
    graphApi
      .getGraph(userId)
      .then((g) => { if (!cancelled) setGraph(g); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [userId, tick]);

  const stats = useMemo(() => {
    if (!graph) return null;
    const typeById = new Map<string, string>();
    const byType: Record<string, number> = {};
    graph.nodes.forEach((n) => {
      typeById.set(n.id, n.type);
      byType[n.type] = (byType[n.type] ?? 0) + 1;
    });
    const sizeRows = [
      { k: "Nodes", v: graph.nodes.length },
      { k: "Edges", v: graph.edges.length },
      ...Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, c]) => ({ k: kindName(t), v: c })),
    ];
    const top = [...graph.nodes].sort((a, b) => (b.betweenness ?? 0) - (a.betweenness ?? 0)).slice(0, 8);
    const topMax = top.length > 0 ? (top[0].betweenness ?? 0) : 0;
    const pairCounts: Record<string, number> = {};
    graph.edges.forEach((e) => {
      const a = typeById.get(e.source);
      const b = typeById.get(e.target);
      if (!a || !b) return;
      const key = [kindName(a), kindName(b)].sort().join(" – ");
      pairCounts[key] = (pairCounts[key] ?? 0) + 1;
    });
    const edgeRows = Object.entries(pairCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ k, v }));
    return { sizeRows, top, topMax, edgeRows };
  }, [graph]);

  const pageStyle: React.CSSProperties = { maxWidth: 1280, margin: "0 auto", padding: "var(--space-8)" };
  const noteStyle: React.CSSProperties = { fontSize: "0.9375rem", fontWeight: 600 };

  if (!userId || (!graph && !error)) {
    return <div data-screen-label="Insights" style={pageStyle}><div style={noteStyle}>Loading the graph</div></div>;
  }
  if (error) {
    return (
      <div data-screen-label="Insights" style={{ ...pageStyle, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={noteStyle}>Could not load the graph. {error}</div>
        <div><button className="btn btn-secondary" onClick={() => setTick((t) => t + 1)}>Try again</button></div>
      </div>
    );
  }
  if (!graph || !stats || graph.nodes.length === 0) {
    return (
      <div data-screen-label="Insights" style={{ ...pageStyle, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={noteStyle}>There is no graph yet. Upload a report and one is built for this persona.</div>
        <div><button className="btn btn-primary" onClick={() => transitionNavigate(navigate, "/upload", { direction: "back" })}>Upload a report</button></div>
      </div>
    );
  }

  return (
    <div
      data-screen-label="Insights"
      style={{ ...pageStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: "var(--space-8)", alignItems: "start" }}
    >
      <div>
        <div style={{ paddingBottom: "var(--space-2)", borderBottom: "2px solid var(--color-divider)" }}><div style={headStyle}>Graph size</div></div>
        {stats.sizeRows.map((r) => (
          <div key={r.k} style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-divider)" }}>
            <span>{r.k}</span>
            <span style={{ fontSize: "1.25rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{r.v.toLocaleString("en-US")}</span>
          </div>
        ))}
      </div>

      <div>
        <div style={{ paddingBottom: "var(--space-2)", borderBottom: "2px solid var(--color-divider)" }}><div style={headStyle}>Betweenness centrality</div></div>
        {stats.top.map((n, i) => {
          const v = n.betweenness ?? 0;
          const pct = stats.topMax > 0 ? Math.round((v / stats.topMax) * 100) : 0;
          return (
            <div key={n.id} style={{ padding: "var(--space-2) 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", fontWeight: 800 }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={n.label}>{n.label}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{v.toFixed(2)}</span>
              </div>
              <div style={{ height: 8, background: "var(--color-neutral-200)", marginTop: 2 }}>
                <div style={{ height: 8, width: `${pct}%`, background: i === 0 ? "var(--color-accent)" : "var(--color-text)" }} />
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div style={{ paddingBottom: "var(--space-2)", borderBottom: "2px solid var(--color-divider)" }}><div style={headStyle}>Edge types</div></div>
        {stats.edgeRows.map((r) => (
          <div key={r.k} style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-divider)" }}>
            <span>{r.k}</span>
            <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{r.v.toLocaleString("en-US")}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
