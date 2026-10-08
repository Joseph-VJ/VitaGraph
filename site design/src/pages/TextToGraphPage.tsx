import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GraphCanvas,
  type GraphCanvasHandle,
  type GEdge,
} from "../components/graph/GraphCanvas";
import { extractGraph, type Entity, type TextGraphNode } from "../components/graph/textGraph";
import { aiGraphToTextGraph } from "../components/graph/aiGraph";
import { toolsApi } from "../api/tools";
import { usePreferences } from "../lib/preferences";

type T2GNode = TextGraphNode;

const LAB_SAMPLE =
  "Report date: 12 March 2026\nHemoglobin 13.8 g/dL\nFasting Glucose 96 mg/dL\nTSH 2.4 uIU/mL";
const FREE_SAMPLE =
  "Arjun visited Dr. Meera at Apollo Hospital in Chennai on 12 March 2026. He complained of fatigue and headache. Dr. Meera prescribed Metformin and advised a diet change. Apollo Hospital will follow up in April.";

const swatch = (extra: React.CSSProperties): React.CSSProperties => ({
  width: 12,
  height: 12,
  display: "inline-block",
  flexShrink: 0,
  ...extra,
});

const T2G_LEGEND_ITEMS = [
  { label: "Document", css: swatch({ background: "var(--color-text)" }) },
  {
    label: "Sentence",
    css: swatch({ background: "var(--color-text)", transform: "rotate(45deg) scale(0.8)" }),
  },
  {
    label: "Name or term",
    css: swatch({ borderRadius: "var(--r-circle, 50%)", background: "var(--color-text)" }),
  },
  {
    label: "Date",
    css: swatch({
      borderRadius: "var(--r-circle, 50%)",
      border: "2.5px solid var(--color-text)",
      background: "var(--color-bg)",
      boxSizing: "border-box",
    }),
  },
  {
    label: "Value",
    css: swatch({
      width: 8,
      height: 8,
      borderRadius: "var(--r-circle, 50%)",
      background: "var(--color-neutral-700)",
      margin: 2,
    }),
  },
];

export const TextToGraphPage: React.FC = () => {
  const prefs = usePreferences();
  const canvasHandleRef = useRef<GraphCanvasHandle>(null);

  const [text, setText] = useState<string>("");
  const [nodes, setNodes] = useState<T2GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [message, setMessage] = useState<string>("");
  const [dateStr, setDateStr] = useState<string | null>(null);
  // Relation words from the AI graph, keyed "source|target"; empty for the pattern graph.
  const [edgeLabels, setEdgeLabels] = useState<Record<string, string>>({});
  const [aiStartedAt, setAiStartedAt] = useState<number | null>(null);
  const [aiNow, setAiNow] = useState<number>(0);
  const aiBusy = aiStartedAt !== null;

  useEffect(() => {
    if (aiStartedAt === null) return;
    const timer = window.setInterval(() => setAiNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [aiStartedAt]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [replayToken, setReplayToken] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const systemReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isReducedMotion = prefs.reduceMotion || systemReduced;

  const buildGraphFromText = useCallback((rawText: string) => {
    if (!rawText.trim()) {
      setNodes([]);
      setEdges([]);
      setEntities([]);
      setDateStr(null);
      setSelectedId(null);
      setMessage("Type or paste some text first.");
      return;
    }
    const g = extractGraph(rawText);
    setEdgeLabels({});
    setMessage("");
    setNodes(g.nodes);
    setEdges(g.edges);
    setEntities(g.entities);
    setDateStr(g.date);
    setSelectedId(null);
    setReplayToken(performance.now());
  }, []);

  const buildWithAI = useCallback(
    async (rawText: string) => {
      if (!rawText.trim()) {
        setMessage("Type or paste some text first.");
        return;
      }
      setMessage("");
      setAiNow(Date.now());
      setAiStartedAt(Date.now());
      try {
        const ai = await toolsApi.graph(rawText);
        const g = aiGraphToTextGraph(rawText, ai);
        setNodes(g.nodes);
        setEdges(g.edges);
        setEntities(g.entities);
        setEdgeLabels(g.edgeLabels);
        setDateStr(null);
        setSelectedId(null);
        setReplayToken(performance.now());
        setMessage(`Built by the AI: ${ai.nodes.length} entities, ${g.relationCount} relations, each tied to exact words in your text.`);
      } catch (err) {
        // The pattern graph needs no AI, so the person always gets a graph.
        buildGraphFromText(rawText);
        const reason = err instanceof Error ? err.message : "The AI could not build the graph.";
        setMessage(`${reason} Showing the pattern graph instead.`);
      } finally {
        setAiStartedAt(null);
      }
    },
    [buildGraphFromText]
  );

  const loadExample = (sample: string) => {
    setText(sample);
    buildGraphFromText(sample);
  };

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      setText(content);
      buildGraphFromText(content);
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    if (nodes.length === 0) return;
    const payload = JSON.stringify(
      {
        nodes: nodes.map((q) => ({ id: q.id, type: q.k, label: q.label })),
        edges,
        ...(Object.keys(edgeLabels).length > 0
          ? { relations: edges.filter(([a, b]) => edgeLabels[`${a}|${b}`]).map(([a, b]) => ({ source: a, target: b, label: edgeLabels[`${a}|${b}`] })) }
          : {}),
        entities,
      },
      null,
      2
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "graph.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    const nd = nodes.find((n) => n.id === selectedId);
    if (!nd) return null;

    let kind = "Node";
    if (nd.k === "person") kind = "Document";
    else if (nd.k === "report") kind = "Date";
    else if (nd.k === "section") kind = "Sentence";
    else if (nd.k === "bio") kind = "Name or term";
    else if (nd.k === "meas") kind = "Value";

    const nbs = edges
      .filter((e) => e[0] === nd.id || e[1] === nd.id)
      .map((e) => {
        const otherId = e[0] === nd.id ? e[1] : e[0];
        const other = nodes.find((n) => n.id === otherId);
        const word = edgeLabels[`${e[0]}|${e[1]}`];
        return {
          id: otherId,
          label: word ? `${e[0] === nd.id ? "" : "← "}${word} · ${other?.label || otherId}` : other?.label || otherId,
        };
      })
      .slice(0, 8);

    return {
      kind,
      label: nd.label,
      about: nd.about,
      nbs,
    };
  }, [selectedId, nodes, edges, edgeLabels]);

  const summaryText = useMemo(() => {
    if (nodes.length === 0) return "";
    if (Object.keys(edgeLabels).length > 0) {
      return `${entities.length} entit${entities.length === 1 ? "y" : "ies"} · ${Object.keys(edgeLabels).length} relations · ${nodes.length} nodes, ${edges.length} edges`;
    }
    const sentences = nodes.filter((n) => n.k === "section").length;
    return `${entities.length} entit${entities.length === 1 ? "y" : "ies"} · ${sentences} sentence${sentences === 1 ? "" : "s"}${dateStr ? ` · ${dateStr}` : ""} · ${nodes.length} nodes, ${edges.length} edges`;
  }, [nodes, edges.length, entities.length, dateStr, edgeLabels]);

  const countLabel = useMemo(() => {
    if (nodes.length === 0) return "0 nodes · 0 edges";
    return `${nodes.length} nodes · ${edges.length} edges`;
  }, [nodes.length, edges.length]);

  return (
    <div
      data-screen-label="Graph"
      style={{
        height: "100%",
        maxHeight: "100%",
        overflow: "hidden",
        display: "flex",
        flexWrap: "wrap",
      }}
    >
      {/* Left Canvas Area */}
      <div
        style={{
          flex: "1 1 520px",
          minWidth: 0,
          minHeight: 520,
          position: "relative",
          overflow: "hidden",
          backgroundImage:
            "linear-gradient(color-mix(in srgb,var(--color-text) 7%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--color-text) 7%,transparent) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      >
        {nodes.length > 0 ? (
          <GraphCanvas
            ref={canvasHandleRef}
            nodes={nodes}
            edges={edges}
            focusIds={null}
            selectedId={selectedId}
            onSelect={setSelectedId}
            autoRotate={autoRotate && !isReducedMotion}
            reducedMotion={isReducedMotion}
            replayToken={replayToken}
            edgeLabels={edgeLabels}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-3)",
              color: "var(--color-neutral-700)",
              fontSize: "0.9375rem",
              padding: "var(--space-6)",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: "1.125rem", color: "var(--color-text)" }}>
              No graph built yet
            </div>
            <div>
              Paste or type any text on the right and click Build graph.
            </div>
          </div>
        )}

        {/* Counter Top Left */}
        <div
          style={{
            position: "absolute",
            top: "var(--space-4)",
            left: "var(--space-6)",
            pointerEvents: "none",
            fontSize: "0.9375rem",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {countLabel}
        </div>

        {/* Action Buttons Top Right */}
        <div
          style={{
            position: "absolute",
            top: "var(--space-4)",
            right: "var(--space-6)",
            display: "flex",
            gap: "var(--space-2)",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setReplayToken(performance.now());
              canvasHandleRef.current?.replay();
            }}
            style={{ background: "var(--color-bg)" }}
          >
            Replay build
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAutoRotate((prev) => !prev)}
            style={{ background: "var(--color-bg)" }}
          >
            {autoRotate ? "Pause rotation" : "Resume rotation"}
          </button>
        </div>

        {/* Interaction Hint Bottom Left */}
        <div
          style={{
            position: "absolute",
            left: "var(--space-6)",
            bottom: "var(--space-4)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--color-neutral-800)",
            pointerEvents: "none",
          }}
        >
          Drag to rotate · scroll to zoom · select a node
        </div>
      </div>

      {/* Right Panel: Text Tool */}
      <div
        style={{
          flex: "0 0 340px",
          maxWidth: "100%",
          height: "100%",
          maxHeight: "100%",
          boxSizing: "border-box",
          borderLeft: "2px solid var(--color-divider)",
          padding: "var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
          overflow: "auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div
            style={{
              paddingBottom: "var(--space-2)",
              borderBottom: "2px solid var(--color-divider)",
            }}
          >
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--color-neutral-700)",
              }}
            >
              Text
            </div>
          </div>

          {/* Upload Drop Bar */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-2)",
              padding: "var(--space-3) var(--space-4)",
              border: isDragOver
                ? "2px dashed var(--color-accent)"
                : "2px dashed var(--color-divider)",
              background: isDragOver
                ? "var(--color-accent-100)"
                : "var(--color-surface)",
            }}
          >
            <span style={{ fontSize: "0.9375rem", fontWeight: 800 }}>
              Upload a text file
            </span>
            <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
              Choose file
              <input
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={(e) => handleFile(e.target.files?.[0])}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {/* Textarea */}
          <textarea
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste or type any text, such as a report, a note or an email"
            style={{
              minHeight: 190,
              fontSize: "0.875rem",
              lineHeight: 1.6,
              fontVariantNumeric: "tabular-nums",
            }}
          />

          {/* Build Graph Button */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => buildGraphFromText(text)}
              style={{ gap: "var(--space-6)" }}
            >
              Build graph{" "}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                style={{
                  strokeWidth: 2,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }}
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={aiBusy}
              onClick={() => void buildWithAI(text)}
              title="The AI reads the text and names the connections. Needs AI switched on in Settings."
            >
              {aiBusy ? `Asking the AI… ${((Math.max(0, aiNow - (aiStartedAt ?? aiNow))) / 1000).toFixed(1)} s` : "Build with AI"}
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadExample(LAB_SAMPLE)}
              style={{ padding: "var(--space-1) var(--space-2)", fontSize: "0.8125rem" }}
            >
              Example: lab report
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadExample(FREE_SAMPLE)}
              style={{ padding: "var(--space-1) var(--space-2)", fontSize: "0.8125rem" }}
            >
              Example: free text
            </button>
          </div>

          {message && (
            <div role="status" style={{ fontSize: "0.8125rem", color: "var(--color-neutral-700)" }}>
              {message}
            </div>
          )}

          {/* Summary */}
          {summaryText && (
            <div style={{ fontSize: "0.8125rem", color: "var(--color-neutral-700)" }}>
              {summaryText}
            </div>
          )}

          {/* Entities Table */}
          {entities.length > 0 && (
            <>
              <table className="table" style={{ fontSize: "0.8125rem", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Name</th>
                    <th style={{ textAlign: "left" }}>Kind</th>
                    <th style={{ textAlign: "left" }}>Mentions</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.slice(0, 12).map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 800 }}>{r.label}</td>
                      <td>{r.kind}</td>
                      <td
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          color: "var(--color-neutral-700)",
                        }}
                      >
                        {r.mentions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {entities.length > 12 && (
                <div style={{ fontSize: "0.8125rem", color: "var(--color-neutral-700)" }}>
                  + {entities.length - 12} more
                </div>
              )}
            </>
          )}

          {/* Download JSON */}
          {nodes.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownload}
            >
              Download JSON
            </button>
          )}
        </div>

        {/* Selected Node Card */}
        {selectedNode && (
          <div
            style={{
              borderTop: "2px solid var(--color-text)",
              paddingTop: "var(--space-3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--color-accent-700)",
                }}
              >
                {selectedNode.kind}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelectedId(null)}
                style={{ fontSize: "0.8125rem" }}
              >
                Clear
              </button>
            </div>
            <h3
              style={{
                margin: "var(--space-1) 0 var(--space-2)",
                fontSize: "1.5rem",
              }}
            >
              {selectedNode.label}
            </h3>
            <p
              style={{
                margin: "0 0 var(--space-3)",
                fontSize: "0.9375rem",
                whiteSpace: "pre-line",
              }}
            >
              {selectedNode.about}
            </p>
            {selectedId ? (
              <p style={{ margin: "0 0 var(--space-2)", fontSize: "0.8125rem", color: "var(--color-neutral-700)" }}>
                {(() => {
                  const n = edges.filter((e) => e[0] === selectedId || e[1] === selectedId).length;
                  return n === 0 ? "Not connected to anything else." : `Connected to ${n} node${n === 1 ? "" : "s"}. Its lines are drawn in red.`;
                })()}
              </p>
            ) : null}
            {selectedNode.nbs.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-2)",
                }}
              >
                {selectedNode.nbs.map((nb) => (
                  <button
                    key={nb.id}
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedId(nb.id)}
                    style={{
                      padding: "var(--space-1) var(--space-2)",
                      fontSize: "0.8125rem",
                    }}
                  >
                    {nb.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: "auto" }}>
          <div
            style={{
              paddingBottom: "var(--space-2)",
              borderBottom: "2px solid var(--color-divider)",
            }}
          >
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--color-neutral-700)",
              }}
            >
              Legend
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,1fr)",
              gap: "var(--space-2) var(--space-3)",
              paddingTop: "var(--space-3)",
            }}
          >
            {T2G_LEGEND_ITEMS.map((g) => (
              <div
                key={g.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  fontSize: "0.8125rem",
                }}
              >
                <span style={g.css} />
                {g.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextToGraphPage;
