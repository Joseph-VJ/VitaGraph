import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  GraphCanvas,
  type GraphCanvasHandle,
  type GEdge,
  type GNode,
} from "../components/graph/GraphCanvas";
import { usePreferences } from "../lib/preferences";

interface ExtractedRow {
  name: string;
  value: string;
  unit: string;
  span: string;
}

interface T2GNode extends GNode {
  about: string;
}

const T2G_LEGEND_ITEMS = [
  {
    label: "Document",
    css: {
      width: 12,
      height: 12,
      background: "var(--color-text)",
      display: "inline-block",
      flexShrink: 0,
    },
  },
  {
    label: "Date",
    css: {
      width: 12,
      height: 12,
      borderRadius: "var(--r-circle, 50%)",
      border: "2.5px solid var(--color-text)",
      background: "var(--color-bg)",
      boxSizing: "border-box" as const,
      display: "inline-block",
      flexShrink: 0,
    },
  },
  {
    label: "Biomarker",
    css: {
      width: 12,
      height: 12,
      borderRadius: "var(--r-circle, 50%)",
      background: "var(--color-text)",
      display: "inline-block",
      flexShrink: 0,
    },
  },
  {
    label: "Value",
    css: {
      width: 8,
      height: 8,
      borderRadius: "var(--r-circle, 50%)",
      background: "var(--color-neutral-700)",
      display: "inline-block",
      margin: 2,
      flexShrink: 0,
    },
  },
];

export const TextToGraphPage: React.FC = () => {
  const prefs = usePreferences();
  const canvasHandleRef = useRef<GraphCanvasHandle>(null);

  const [text, setText] = useState<string>("");
  const [nodes, setNodes] = useState<T2GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [dateStr, setDateStr] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [replayToken, setReplayToken] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const systemReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isReducedMotion = prefs.reduceMotion || systemReduced;

  const buildGraphFromText = useCallback((rawText: string) => {
    const re =
      /([A-Za-z][A-Za-z0-9 ()\-]{1,34}?)\s*[:=]?\s*(\d[\d,]*\.?\d*)\s*(g\/dL|mg\/dL|ng\/mL|pg\/mL|\/µL|\/uL|mmol\/L|U\/L|IU\/L|fL|pg|%)/g;
    const dm = rawText.match(
      /\b(\d{1,2}\s+[A-Z][a-z]{2,8}\s+\d{4}|[A-Z][a-z]{2,8}\s+\d{4})\b/
    );

    const extracted: ExtractedRow[] = [];
    let pos = 0;
    const lines = rawText.split("\n");
    for (const line of lines) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        const nm = m[1].replace(/^\s+|\s+$/g, "");
        if (/^(report|date|reference|ref|range)/i.test(nm)) continue;
        extracted.push({
          name: nm,
          value: m[2],
          unit: m[3],
          span: `${pos + m.index}–${pos + m.index + m[0].length - 1}`,
        });
      }
      pos += line.length + 1;
    }

    const nList: T2GNode[] = [
      {
        id: "d",
        k: "person",
        label: "Document",
        pos: [0, 0, 0],
        about: "The text you pasted.",
      },
    ];
    const eList: GEdge[] = [];

    const foundDate = dm ? dm[0] : null;
    if (foundDate) {
      nList.push({
        id: "dt",
        k: "report",
        label: foundDate,
        pos: [0.05, -0.45, 0.25],
        about: "Date found in the text.",
      });
      eList.push(["d", "dt"]);
    }

    const count = extracted.length;
    extracted.forEach((r, i) => {
      const y = count > 1 ? 1 - (2 * (i + 0.5)) / count : 0;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const th = i * 2.399963 + 0.4;
      const ux = Math.cos(th) * rad;
      const uz = Math.sin(th) * rad;

      nList.push({
        id: `b${i}`,
        k: "bio",
        label: r.name,
        pos: [ux * 0.52, y * 0.52, uz * 0.52],
        about: `${r.name} at characters ${r.span}.`,
      });
      nList.push({
        id: `v${i}`,
        k: "meas",
        label: `${r.value} ${r.unit}`,
        pos: [ux * 0.85, y * 0.85, uz * 0.85],
        about: `${r.name} = ${r.value} ${r.unit}.`,
      });

      eList.push(["d", `b${i}`]);
      eList.push([`b${i}`, `v${i}`]);
    });

    setNodes(nList);
    setEdges(eList);
    setRows(extracted);
    setDateStr(foundDate);
    setSelectedId(null);
    setReplayToken(performance.now());
  }, []);

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
        measurements: rows,
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
    else if (nd.k === "bio") kind = "Biomarker";
    else if (nd.k === "meas") kind = "Value";

    const nbs = edges
      .filter((e) => e[0] === nd.id || e[1] === nd.id)
      .map((e) => {
        const otherId = e[0] === nd.id ? e[1] : e[0];
        const other = nodes.find((n) => n.id === otherId);
        return {
          id: otherId,
          label: other?.label || otherId,
        };
      })
      .slice(0, 8);

    return {
      kind,
      label: nd.label,
      about: nd.about,
      nbs,
    };
  }, [selectedId, nodes, edges]);

  const summaryText = useMemo(() => {
    if (nodes.length === 0) return "";
    return `${rows.length} biomarker${rows.length === 1 ? "" : "s"}${dateStr ? ` · ${dateStr}` : ""} · ${nodes.length} nodes, ${edges.length} edges`;
  }, [nodes.length, edges.length, rows.length, dateStr]);

  const countLabel = useMemo(() => {
    if (nodes.length === 0) return "0 nodes · 0 edges";
    return `${nodes.length} nodes · ${edges.length} edges`;
  }, [nodes.length, edges.length]);

  return (
    <div
      data-screen-label="Graph"
      style={{ height: "100%", display: "flex", flexWrap: "wrap" }}
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
              Upload a text file or paste lab results on the right and click Build graph.
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
            placeholder="Paste report text here with values (e.g. Hemoglobin 14.0 g/dL)"
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
          </div>

          {/* Summary */}
          {summaryText && (
            <div style={{ fontSize: "0.8125rem", color: "var(--color-neutral-700)" }}>
              {summaryText}
            </div>
          )}

          {/* Rows Table */}
          {rows.length > 0 && (
            <table className="table" style={{ fontSize: "0.8125rem", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Biomarker</th>
                  <th style={{ textAlign: "left" }}>Value</th>
                  <th style={{ textAlign: "left" }}>Characters</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 800 }}>{r.name}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {r.value} {r.unit}
                    </td>
                    <td
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        color: "var(--color-neutral-700)",
                      }}
                    >
                      {r.span}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              }}
            >
              {selectedNode.about}
            </p>
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
