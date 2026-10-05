import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { graphApi, type GraphResponse } from "../api/graph";
import { useActiveUser } from "../context/UserContext";
import { transitionNavigate } from "../motion/navigation";
import { PageFrame, PageState, PersonaState, SectionHead } from "../components/ui";

const KIND: Record<string, string> = {
  person: "Subject",
  report: "Report",
  category: "Panel",
  section: "Section",
  test: "Biomarker",
  bio: "Biomarker",
  measurement: "Measurement",
  meas: "Measurement",
  uncertainty: "Uncertainty",
  unc: "Uncertainty",
  chunk: "Text fragment",
  date: "Date",
};
const kindName = (t: string): string => KIND[t] ?? t.charAt(0).toUpperCase() + t.slice(1);

function nodeDisplayLabel(n: { label: string; type?: string; date?: string | null }): string {
  if (n.type?.toLowerCase() === "report") {
    if (n.date && n.date.toLowerCase() !== "unknown date" && n.date.trim() !== "") {
      return n.date.trim();
    }
    const clean = n.label.replace(/\.[a-zA-Z0-9]+(\s*\(.*\))?$/, "").replace(/\s*\(.*\)$/, "").trim();
    return clean || n.label;
  }
  return n.label;
}

export const InsightsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: personaLoading, refreshUsers } = useActiveUser();
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

  if (!userId) {
    return (
      <PageFrame label="Insights">
        <PersonaState loading={personaLoading} onRetry={refreshUsers} />
      </PageFrame>
    );
  }

  if (!graph && !error) {
    return (
      <PageFrame label="Insights">
        <PageState kind="loading" title="Loading the graph" />
      </PageFrame>
    );
  }

  if (error) {
    return (
      <PageFrame label="Insights">
        <PageState
          kind="error"
          title="Could not load the graph"
          detail={error}
          action={{ label: "Try again", onClick: () => setTick((t) => t + 1) }}
        />
      </PageFrame>
    );
  }

  if (!graph || !stats || graph.nodes.length === 0) {
    return (
      <PageFrame label="Insights">
        <PageState
          kind="empty"
          title="No graph yet"
          detail="Upload a report and a graph is built for this persona."
          action={{
            label: "Upload a report",
            onClick: () => transitionNavigate(navigate, "/upload", { direction: "back" }),
          }}
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame label="Insights">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(340px,100%),1fr))",
          gap: "var(--space-8)",
          alignItems: "start",
        }}
      >
        <section>
          <SectionHead title="Graph size" />
          {stats.sizeRows.map((r) => (
            <div
              key={r.k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "var(--space-3) 0",
                borderBottom: "1px solid var(--color-divider)",
              }}
            >
              <span>{r.k}</span>
              <span style={{ fontSize: "1.25rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {r.v.toLocaleString("en-US")}
              </span>
            </div>
          ))}
        </section>

        <section>
          <SectionHead title="Betweenness centrality" />
          {stats.top.map((n, i) => {
            const v = n.betweenness ?? 0;
            const pct = stats.topMax > 0 ? Math.round((v / stats.topMax) * 100) : 0;
            return (
              <div key={n.id} style={{ padding: "var(--space-2) 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", fontWeight: 800 }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={n.label}>
                    {nodeDisplayLabel(n)}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{v.toFixed(2)}</span>
                </div>
                <div style={{ height: 8, background: "var(--color-neutral-200)", marginTop: 2 }}>
                  <div style={{ height: 8, width: `${pct}%`, background: i === 0 ? "var(--color-accent)" : "var(--color-text)" }} />
                </div>
              </div>
            );
          })}
        </section>

        <section>
          <SectionHead title="Edge types" />
          {stats.edgeRows.map((r) => (
            <div
              key={r.k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "var(--space-3)",
                padding: "var(--space-2) 0",
                borderBottom: "1px solid var(--color-divider)",
              }}
            >
              <span>{r.k}</span>
              <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{r.v.toLocaleString("en-US")}</span>
            </div>
          ))}
        </section>
      </div>
    </PageFrame>
  );
};
