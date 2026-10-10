import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphStage, type GraphStageHandle } from "../components/graph/stage/GraphStage";
import {
  type StageNode,
  type StageEdge,
  type NodeKind,
  type StageOptions,
} from "../components/graph/stage/GraphStageEngine";
import { TextNodeCard } from "../components/graph/TextNodeCard";
import {
  buildStageFromPattern,
  componentRepresentatives,
  createHubNode,
  entityToStageNode,
  edgeToStageEdge,
  hubEdges,
  HUB_ID,
} from "../components/graph/textStageData";
import { type Entity } from "../components/graph/textGraph";
import { toolsApi } from "../api/tools";
import { aiApi } from "../api/ai";
import { usePreferences } from "../lib/preferences";

const LAB_SAMPLE =
  "Report date: 12 March 2026\nHemoglobin 13.8 g/dL\nFasting Glucose 96 mg/dL\nTSH 2.4 uIU/mL";
const FREE_SAMPLE =
  "Arjun visited Dr. Meera at Apollo Hospital in Chennai on 12 March 2026. He complained of fatigue and headache. Dr. Meera prescribed Metformin and advised a diet change. Apollo Hospital will follow up in April.";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const countsPhrase = (entities: number, relations: number) =>
  `${plural(entities, "entity", "entities")}, ${plural(relations, "relation", "relations")}`;

const swatch = (extra: React.CSSProperties): React.CSSProperties => ({
  width: 12,
  height: 12,
  display: "inline-block",
  flexShrink: 0,
  ...extra,
});

const T2G_LEGEND_ITEMS = [
  {
    label: "Document",
    css: swatch({ background: "var(--color-text)", borderRadius: "var(--r-circle, 50%)" }),
  },
  {
    label: "Section or Concept",
    css: swatch({
      background: "var(--color-surface)",
      border: "2px solid var(--color-text)",
      boxSizing: "border-box",
    }),
  },
  {
    label: "Biomarker or Term",
    css: swatch({ borderRadius: "var(--r-circle, 50%)", background: "var(--color-neutral-700)" }),
  },
  {
    label: "Value or Date",
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
  const stageHandleRef = useRef<GraphStageHandle | null>(null);

  const [text, setText] = useState<string>("");
  const [stageNodes, setStageNodes] = useState<StageNode[]>([]);
  const [stageEdges, setStageEdges] = useState<StageEdge[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [message, setMessage] = useState<string>("");
  const [dateStr, setDateStr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Stage appearance and controls state
  const [activeLayout, setActiveLayout] = useState<string>("sphere");
  const [themeInk, setThemeInk] = useState<boolean>(true);
  const [lensOn, setLensOn] = useState<boolean>(false);
  const [stageOptions, setStageOptions] = useState<StageOptions>({
    size: true,
    breath: true,
    drop: false,
    hover: true,
    fly: true,
    clu: false,
    flow: false,
    lens: false,
    heat: false,
    ghost: false,
    hideTimeline: true,
  });

  const [kindFilters, setKindFilters] = useState<Record<NodeKind, boolean>>({
    person: true,
    report: true,
    section: true,
    bio: true,
    meas: true,
    unc: true,
  });

  const [pathFrom, setPathFrom] = useState<string>("");
  const [pathTo, setPathTo] = useState<string>("");
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Streaming and building state
  const [isGrowing, setIsGrowing] = useState<boolean>(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [aiStartedAt, setAiStartedAt] = useState<number | null>(null);
  const [, setAiNow] = useState<number>(0);
  const aiBusy = aiStartedAt !== null || isGrowing;

  const abortControllerRef = useRef<AbortController | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingNodesRef = useRef<StageNode[]>([]);
  const pendingEdgesRef = useRef<StageEdge[]>([]);
  // Entities and relations the AI has stated so far (the hub is not in these; its links are derived from them).
  const realNodesRef = useRef<StageNode[]>([]);
  const realEdgesRef = useRef<StageEdge[]>([]);
  const hubNodeRef = useRef<StageNode>(createHubNode("Text"));
  // Ids of the entities the hub is linked to right now: one per connected group.
  const hubRepsRef = useRef<Set<string>>(new Set());
  const nodeCountRef = useRef<number>(0);
  const edgeCountRef = useRef<number>(0);

  const systemReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isReducedMotion = prefs.reduceMotion || systemReduced;

  // Real-time timer update while AI stream is active
  useEffect(() => {
    if (aiStartedAt === null) return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      setAiNow(now);
      const elapsed = ((now - aiStartedAt) / 1000).toFixed(1);
      setLiveStatus((cur) => {
        if (!cur) return `Reading... ${elapsed} s`;
        if (cur.startsWith("Reading")) return `Reading... ${elapsed} s`;
        return cur;
      });
    }, 200);
    return () => window.clearInterval(timer);
  }, [aiStartedAt]);

  // Clean up streaming & RAF on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // Flush pending batched nodes/edges to stage and state. The hub is linked to one representative of every
  // connected group of entities; that is recomputed here. Only a merge that makes an old hub link stale needs
  // a full redraw of the stage; otherwise new hub links are appended with the new items.
  const flushBatch = useCallback(() => {
    const toAddNodes = [...pendingNodesRef.current];
    const toAddEdges = [...pendingEdgesRef.current];
    pendingNodesRef.current = [];
    pendingEdgesRef.current = [];

    if (toAddNodes.length > 0 || toAddEdges.length > 0) {
      realNodesRef.current = [...realNodesRef.current, ...toAddNodes];
      realEdgesRef.current = [...realEdgesRef.current, ...toAddEdges];
      const reps = componentRepresentatives(realNodesRef.current, realEdgesRef.current);
      const repSet = new Set(reps);
      const links = hubEdges(reps);
      const stale = [...hubRepsRef.current].some((rep) => !repSet.has(rep));
      const added = links.filter((e) => !hubRepsRef.current.has(e.b));
      const hub = hubNodeRef.current;

      if (stageHandleRef.current) {
        if (stale) {
          stageHandleRef.current.setData([hub, ...realNodesRef.current], [...realEdgesRef.current, ...links]);
        } else {
          stageHandleRef.current.appendData(toAddNodes, [...toAddEdges, ...added]);
        }
      }
      hubRepsRef.current = repSet;
      setStageNodes([hub, ...realNodesRef.current]);
      setStageEdges([...realEdgesRef.current, ...links]);
      setEntities((prev) => [
        ...prev,
        ...toAddNodes
          .filter((n) => n.id !== HUB_ID)
          .map((n) => ({
            id: n.id,
            label: n.label,
            kind: (n.group === "measurement" ? "Value" : n.group === "date" ? "Date" : n.group === "person" ? "Name" : "Term") as any,
            mentions: 1,
            start: n.start ?? 0,
            end: n.end ?? 0,
            snippet: n.quote ?? "",
          })),
      ]);
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      flushBatch();
    });
  }, [flushBatch]);

  // Instant Pattern Build
  const buildGraphFromText = useCallback((rawText: string) => {
    if (!rawText.trim()) {
      setStageNodes([]);
      setStageEdges([]);
      setEntities([]);
      setDateStr(null);
      setSelectedId(null);
      setMessage("Type or paste some text first.");
      return;
    }
    const g = buildStageFromPattern(rawText);
    // Push the pattern graph to the stage now. After a streamed build the stage skips its own data update when
    // growing stops, so a fallback from a failed AI build would otherwise keep the hub alone on the stage.
    stageHandleRef.current?.setData(g.nodes, g.edges);
    setMessage("");
    setLiveStatus(null);
    setStageNodes(g.nodes);
    setStageEdges(g.edges);
    setEntities(g.entities);
    setDateStr(g.date);
    setSelectedId(null);
    setIsGrowing(false);
    setAiStartedAt(null);
  }, []);

  // Live Streamed AI Build
  const buildWithAI = useCallback(
    async (rawText: string) => {
      if (!rawText.trim()) {
        setMessage("Type or paste some text first.");
        return;
      }

      // Check privacy switch: if AI disabled in Settings, never call backend!
      let allowApi = true;
      try {
        const cached = sessionStorage.getItem("vg_allow_api");
        if (cached !== null) {
          allowApi = cached === "true";
        } else {
          const cfg = await aiApi.getConfig();
          allowApi = cfg.allow_api;
          sessionStorage.setItem("vg_allow_api", String(cfg.allow_api));
        }
      } catch {
        /* proceed if check fails; backend gates anyway */
      }

      if (!allowApi) {
        buildGraphFromText(rawText);
        setMessage("The AI model is turned off in Settings. Showing the pattern graph instead.");
        return;
      }

      // Cancel previous stream if running
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const ac = new AbortController();
      abortControllerRef.current = ac;

      // Clear stage first and start fresh with hub
      setMessage("");
      setSelectedId(null);
      setIsGrowing(true);
      const startT = performance.now();
      setAiStartedAt(startT);
      setAiNow(startT);
      setLiveStatus("Reading... 0.0 s");

      pendingNodesRef.current = [];
      pendingEdgesRef.current = [];
      realNodesRef.current = [];
      realEdgesRef.current = [];
      hubRepsRef.current = new Set();

      const snippet = rawText.trim().slice(0, 30).split("\n")[0] || "Text";
      const hub = createHubNode(snippet);
      hubNodeRef.current = hub;
      nodeCountRef.current = 0;
      edgeCountRef.current = 0;

      if (stageHandleRef.current) {
        stageHandleRef.current.setData([hub], []);
      }
      setStageNodes([hub]);
      setStageEdges([]);
      setEntities([]);

      let terminalSeen = false;
      try {
        await toolsApi.graphStream(
          rawText,
          {
            onStatus: (phase) => {
              const elapsed = ((performance.now() - startT) / 1000).toFixed(1);
              if (phase === "reading") {
                setLiveStatus(`Reading... ${elapsed} s`);
              } else if (phase === "writing") {
                setLiveStatus(`Writing the graph...`);
              }
            },
            onTitle: (title) => {
              if (title) {
                hubNodeRef.current = { ...hubNodeRef.current, label: title, name: title };
                setStageNodes((prev) => prev.map((n) => (n.id === HUB_ID ? hubNodeRef.current : n)));
                if (typeof window !== "undefined" && (window as any).__graphStage) {
                  const hubNode = (window as any).__graphStage.byId?.get(HUB_ID);
                  if (hubNode) {
                    hubNode.label = title;
                    hubNode.name = title;
                  }
                }
              }
            },
            onNode: (node) => {
              const idx = nodeCountRef.current++;
              const sn = entityToStageNode(node, idx);
              pendingNodesRef.current.push(sn);
              scheduleFlush();
              const elapsed = ((performance.now() - startT) / 1000).toFixed(1);
              setLiveStatus(`Writing the graph... ${countsPhrase(nodeCountRef.current, edgeCountRef.current)} (${elapsed} s)`);
            },
            onEdge: (edge) => {
              const idx = edgeCountRef.current++;
              const se = edgeToStageEdge(edge, idx);
              pendingEdgesRef.current.push(se);
              scheduleFlush();
              const elapsed = ((performance.now() - startT) / 1000).toFixed(1);
              setLiveStatus(`Writing the graph... ${countsPhrase(nodeCountRef.current, edgeCountRef.current)} (${elapsed} s)`);
            },
            onCompleted: (meta) => {
              terminalSeen = true;
              flushBatch();
              setIsGrowing(false);
              setAiStartedAt(null);
              setLiveStatus(null);
              const elapsed = ((performance.now() - startT) / 1000).toFixed(1);
              const droppedMsg =
                meta.dropped > 0
                  ? `; ${meta.dropped} item${meta.dropped === 1 ? "" : "s"} dropped because the words were not in your text`
                  : "";
              setMessage(`Done in ${elapsed} s: ${countsPhrase(meta.nodes, meta.edges)}${droppedMsg}`);
            },
            onError: (err) => {
              terminalSeen = true;
              // A Stop aborts the request; that is not an error to report (Stop has already set its own message).
              if (ac.signal.aborted) return;
              flushBatch();
              setIsGrowing(false);
              setAiStartedAt(null);
              setLiveStatus(null);
              if (nodeCountRef.current === 0) {
                // If NOTHING was drawn, build the pattern graph instead
                buildGraphFromText(rawText);
                setMessage(`${err.message} Showing the pattern graph instead.`);
              } else {
                // Keep every node already drawn and show reason
                setMessage(err.message);
              }
            },
          },
          ac.signal
        );
        if (!terminalSeen && !ac.signal.aborted) {
          flushBatch();
          setIsGrowing(false);
          setAiStartedAt(null);
          setLiveStatus(null);
          const reason = "The AI stream ended before the graph was finished.";
          if (nodeCountRef.current === 0) {
            buildGraphFromText(rawText);
            setMessage(`${reason} Showing the pattern graph instead.`);
          } else {
            setMessage(reason);
          }
        }
      } catch (err) {
        if (ac.signal.aborted) return;
        flushBatch();
        setIsGrowing(false);
        setAiStartedAt(null);
        setLiveStatus(null);
        const reason = err instanceof Error ? err.message : "The AI could not build the graph.";
        if (nodeCountRef.current === 0) {
          buildGraphFromText(rawText);
          setMessage(`${reason} Showing the pattern graph instead.`);
        } else {
          setMessage(reason);
        }
      }
    },
    [buildGraphFromText, scheduleFlush, flushBatch]
  );

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    flushBatch();
    setIsGrowing(false);
    setAiStartedAt(null);
    setLiveStatus(null);
    setMessage(`Stopped. ${plural(realNodesRef.current.length, "node", "nodes")} kept.`);
  }, [flushBatch]);

  // Abort a running AI stream before a pattern build replaces the graph.
  const abortRunningStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    pendingNodesRef.current = [];
    pendingEdgesRef.current = [];
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsGrowing(false);
    setAiStartedAt(null);
    setLiveStatus(null);
  };

  const loadExample = (sampleText: string) => {
    abortRunningStream();
    setText(sampleText);
    buildGraphFromText(sampleText);
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      abortRunningStream();
      setText(content);
      buildGraphFromText(content);
    };
    reader.readAsText(file);
  };

  // Download JSON matching the stage graph counts
  const handleDownload = () => {
    if (stageNodes.length === 0) return;
    const payload = JSON.stringify(
      {
        title: stageNodes[0]?.label || "Text",
        nodes: stageNodes.map((q) => ({ id: q.id, type: q.group || q.k, label: q.label })),
        edges: stageEdges.map((e) => ({ source: e.a, target: e.b, label: e.label })),
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

  // Options toggles
  const handleOptionChange = (key: keyof StageOptions, val: boolean) => {
    const next = { ...stageOptions, [key]: val };
    setStageOptions(next);
    if (stageHandleRef.current) {
      stageHandleRef.current.setOptions({ [key]: val });
    }
  };

  const handleToggleKind = (k: NodeKind) => {
    const next = !kindFilters[k];
    setKindFilters((prev) => ({ ...prev, [k]: next }));
    if (stageHandleRef.current) {
      stageHandleRef.current.setKindVisibility(k, next);
    }
  };

  // Path finding
  const handleShowPath = () => {
    if (!pathFrom || !pathTo || !stageHandleRef.current) return;
    stageHandleRef.current.showPath(pathFrom, pathTo);
  };

  const handleClearPath = () => {
    if (!stageHandleRef.current) return;
    stageHandleRef.current.clearPath();
  };

  // Save image modal
  const handleSaveImage = () => {
    if (!stageHandleRef.current) return;
    const dataUrl = stageHandleRef.current.getSnapshotDataUrl();
    if (dataUrl) {
      setModalImage(dataUrl);
    }
  };

  const handleCloseModal = () => {
    setModalImage(null);
  };

  // Esc closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalImage) {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalImage]);

  // Real entities and the relations between them; the hub's own links are structure, not relations.
  const summaryText = useMemo(() => {
    if (stageNodes.length === 0) return "";
    const relations = stageEdges.filter((e) => e.a !== HUB_ID && e.b !== HUB_ID).length;
    return `${countsPhrase(entities.length, relations)}${dateStr ? ` · ${dateStr}` : ""}`;
  }, [stageNodes.length, stageEdges, entities.length, dateStr]);

  const presentKinds = useMemo(() => {
    const set = new Set<NodeKind>();
    stageNodes.forEach((n) => set.add(n.k));
    return set;
  }, [stageNodes]);

  const pathOptions = useMemo(() => {
    return stageNodes.map((n) => ({
      id: n.id,
      text: `${n.label} (${n.group || n.k})`,
    }));
  }, [stageNodes]);

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
      {/* Left Area: GraphStage Canvas or Empty State */}
      <div
        style={{
          flex: "1 1 520px",
          minWidth: 0,
          minHeight: 520,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {stageNodes.length > 0 ? (
          <GraphStage
            ref={stageHandleRef}
            userId="text-to-graph"
            personName={stageNodes[0]?.label || "Text"}
            customIntroTitle={stageNodes[0]?.label || "Text"}
            searchPlaceholder="Find an entity"
            nodes={stageNodes}
            edges={stageEdges}
            reports={[]}
            selectedId={selectedId}
            onSelectNode={setSelectedId}
            focusIds={null}
            activeLayout={activeLayout}
            onLayoutChange={setActiveLayout}
            lensOn={lensOn}
            onToggleLens={setLensOn}
            themeInk={themeInk}
            onToggleTheme={setThemeInk}
            stageOptions={stageOptions}
            barMessage={liveStatus ? <span>{liveStatus}</span> : message ? <span>{message}</span> : null}
            reduceMotion={isReducedMotion}
            hideTimeline={true}
            isGrowing={isGrowing}
            customCard={(cardProps) => (
              <TextNodeCard
                node={cardProps.node}
                allNodes={stageNodes}
                edges={stageEdges}
                fullText={text}
                onSelectNode={cardProps.onSelectNode}
                onClose={cardProps.onClose}
              />
            )}
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
              backgroundImage:
                "linear-gradient(color-mix(in srgb,var(--color-text) 7%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--color-text) 7%,transparent) 1px,transparent 1px)",
              backgroundSize: "48px 48px",
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
      </div>

      {/* Right Panel: Text Tool and Graph Options */}
      <aside
        className="panel"
        aria-label="Text to graph options"
        style={{
          flex: "0 0 340px",
          maxWidth: "100%",
          height: "100%",
          maxHeight: "100%",
          boxSizing: "border-box",
          padding: "var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
          overflowY: "auto",
        }}
      >
        {/* Section: Text input and build */}
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
              minHeight: 180,
              fontSize: "0.875rem",
              lineHeight: 1.6,
              fontVariantNumeric: "tabular-nums",
            }}
          />

          {/* Build Buttons & Stop */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={aiBusy}
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
              {aiBusy ? "Building with AI..." : "Build with AI"}
            </button>
            {aiBusy && (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={handleStop}
                style={{ color: "var(--color-accent)", fontWeight: 700 }}
              >
                Stop
              </button>
            )}
          </div>

          {/* Example Buttons */}
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

          {/* Messages */}
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
          {stageNodes.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={handleDownload}
            >
              Download JSON
            </button>
          )}
        </div>

        {/* Section: Modes */}
        {stageNodes.length > 0 && (
          <>
            <section>
              <h2 className="label">Modes</h2>
              <label className="sw">
                <input
                  type="checkbox"
                  id="m-flow"
                  checked={stageOptions.flow}
                  onChange={(e) => handleOptionChange("flow", e.target.checked)}
                />
                <span className="box"></span>
                <span>
                  <b>Data flow</b>
                  <small>Small dots travel along every line.</small>
                </span>
              </label>

              <label className="sw">
                <input
                  type="checkbox"
                  id="m-lens"
                  checked={lensOn}
                  onChange={(e) => setLensOn(e.target.checked)}
                />
                <span className="box"></span>
                <span>
                  <b>Lens</b>
                  <small>A magnifier follows the pointer and names everything under it. Key: L.</small>
                </span>
              </label>
            </section>

            {/* Section: Find a connection */}
            <section>
              <h2 className="label">Find a connection</h2>
              <label className="muted" htmlFor="pathFrom">
                From
              </label>
              <select
                className="select"
                id="pathFrom"
                value={pathFrom}
                onChange={(e) => setPathFrom(e.target.value)}
              >
                <option value="">Select node...</option>
                {pathOptions.map((opt) => (
                  <option key={`from-${opt.id}`} value={opt.id}>
                    {opt.text}
                  </option>
                ))}
              </select>

              <label className="muted" htmlFor="pathTo">
                To
              </label>
              <select
                className="select"
                id="pathTo"
                value={pathTo}
                onChange={(e) => setPathTo(e.target.value)}
              >
                <option value="">Select node...</option>
                {pathOptions.map((opt) => (
                  <option key={`to-${opt.id}`} value={opt.id}>
                    {opt.text}
                  </option>
                ))}
              </select>

              <div className="row" style={{ marginTop: "var(--space-2)" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  id="pathGo"
                  onClick={handleShowPath}
                >
                  Show the path
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  id="pathClear"
                  onClick={handleClearPath}
                >
                  Clear
                </button>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: "0.8125rem" }}>
                Or click one dot, then Shift-click another.
              </p>
            </section>

            {/* Section: Filter by kind & Save image */}
            <section>
              <h2 className="label">Filters & Snapshot</h2>
              <div
                className="row"
                id="chips"
                role="group"
                aria-label="Show or hide node types"
              >
                {presentKinds.has("person") && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    aria-pressed={kindFilters.person}
                    onClick={() => handleToggleKind("person")}
                  >
                    Subjects
                  </button>
                )}
                {presentKinds.has("section") && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    aria-pressed={kindFilters.section}
                    onClick={() => handleToggleKind("section")}
                  >
                    Sections
                  </button>
                )}
                {presentKinds.has("bio") && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    aria-pressed={kindFilters.bio}
                    onClick={() => handleToggleKind("bio")}
                  >
                    Biomarkers
                  </button>
                )}
                {presentKinds.has("meas") && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    aria-pressed={kindFilters.meas}
                    onClick={() => handleToggleKind("meas")}
                  >
                    Values
                  </button>
                )}
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-small"
                id="snap"
                data-testid="graph-save"
                onClick={handleSaveImage}
                style={{ marginTop: "var(--space-2)" }}
              >
                Save as image
              </button>
            </section>

            {/* Section: Legend */}
            <section style={{ marginTop: "auto" }}>
              <h2 className="label">Legend</h2>
              <div className="legend" id="legend">
                {T2G_LEGEND_ITEMS.map((item) => (
                  <span key={item.label}>
                    <i className="sym" style={item.css}></i>
                    {item.label}
                  </span>
                ))}
              </div>
            </section>
          </>
        )}
      </aside>

      {/* Snapshot Image Preview Modal */}
      {modalImage && (
        <div
          className="graph-modal"
          role="dialog"
          aria-label="Text to graph snapshot"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div className="sheet">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="label">Graph Snapshot</span>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <a
                  href={modalImage}
                  download="text-graph-snapshot.png"
                  className="btn btn-primary btn-small"
                >
                  Download PNG
                </a>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={handleCloseModal}
                >
                  Close
                </button>
              </div>
            </div>
            <img src={modalImage} alt="Text to graph snapshot preview" />
          </div>
        </div>
      )}
    </div>
  );
};

export default TextToGraphPage;
