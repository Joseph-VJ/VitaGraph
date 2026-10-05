// 2D SVG graph view in the Modernist design with the same nodes, colours, and selection as 3D.
// All colours use CSS variable tokens directly. No hex colors anywhere.

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { GraphNode } from "../../api/graph";
import { type SelectedEdge, layout2d, nodeStyle } from "./graphModel";

export interface Graph2DProps {
  nodes: GraphNode[];
  edges: SelectedEdge[];
  selectedId?: string | null;
  activeIds?: Set<string>;
  onSelect: (nodeId: string | null) => void;
  fitSignal?: number;
  className?: string;
  autoRotate?: boolean;
}

export function Graph2D({
  nodes,
  edges,
  selectedId = null,
  activeIds,
  onSelect,
  fitSignal = 0,
  className = "",
}: Graph2DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const didDragRef = useRef(false);

  // Measure container frame
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute 2D layout for measured size
  const points = useMemo(() => {
    return layout2d(nodes, edges, size.width, size.height);
  }, [nodes, edges, size.width, size.height]);

  // Index map and neighbour lookup
  const nodeIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    nodes.forEach((n, i) => map.set(n.id, i));
    return map;
  }, [nodes]);

  const selectedIdx = selectedId ? (nodeIndexMap.get(selectedId) ?? -1) : -1;

  const neighbourIndices = useMemo(() => {
    const set = new Set<number>();
    if (selectedIdx === -1) return set;
    edges.forEach((e) => {
      if (e.source === selectedIdx) set.add(e.target);
      if (e.target === selectedIdx) set.add(e.source);
    });
    return set;
  }, [selectedIdx, edges]);

  // Fit to screen when fitSignal changes
  useEffect(() => {
    if (points.length === 0 || size.width <= 0 || size.height <= 0) {
      setPan({ x: 0, y: 0 });
      setZoom(1);
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const graphW = Math.max(1, maxX - minX);
    const graphH = Math.max(1, maxY - minY);
    const pad = 60;
    const targetW = size.width - pad * 2;
    const targetH = size.height - pad * 2;

    const scaleX = targetW / graphW;
    const scaleY = targetH / graphH;
    const fitScale = Math.max(0.4, Math.min(4.0, Math.min(scaleX, scaleY)));

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    setZoom(fitScale);
    setPan({
      x: size.width / 2 - midX * fitScale,
      y: size.height / 2 - midY * fitScale,
    });
  }, [fitSignal, points, size.width, size.height]);

  // Reduced motion preference
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Single path string for all edges
  const edgePathData = useMemo(() => {
    if (points.length === 0) return "";
    let d = "";
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const p1 = points[e.source];
      const p2 = points[e.target];
      if (p1 && p2) {
        d += `M${p1.x},${p1.y}L${p2.x},${p2.y}`;
      }
    }
    return d;
  }, [points, edges]);

  // Highlighted edges touching selected node
  const selectedEdgePathData = useMemo(() => {
    if (selectedIdx === -1 || points.length === 0) return "";
    let d = "";
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (e.source === selectedIdx || e.target === selectedIdx) {
        const p1 = points[e.source];
        const p2 = points[e.target];
        if (p1 && p2) {
          d += `M${p1.x},${p1.y}L${p2.x},${p2.y}`;
        }
      }
    }
    return d;
  }, [selectedIdx, points, edges]);

  // Pan interaction handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    didDragRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      didDragRef.current = true;
    }
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (!didDragRef.current) {
      onSelect(null);
    }
  };

  // Zoom interaction handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(0.4, Math.min(4.0, zoom * factor));

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const zoomBy = (factor: number) => {
    const newZoom = Math.max(0.4, Math.min(4.0, zoom * factor));
    const cx = size.width / 2;
    const cy = size.height / 2;
    const newPanX = cx - (cx - pan.x) * (newZoom / zoom);
    const newPanY = cy - (cy - pan.y) * (newZoom / zoom);
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const hoveredNode = hoveredId ? nodes.find((n) => n.id === hoveredId) : null;
  const hoveredPoint = hoveredNode && nodeIndexMap.has(hoveredNode.id)
    ? points[nodeIndexMap.get(hoveredNode.id)!]
    : null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full select-none overflow-hidden bg-[var(--color-bg)] ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      style={{ touchAction: "none", cursor: isDraggingRef.current ? "grabbing" : "grab" }}
    >
      <svg
        width={size.width}
        height={size.height}
        className="w-full h-full block"
      >
        <g
          transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
          style={{ transition: prefersReducedMotion ? "none" : undefined }}
        >
          {/* Edges: single path for all background segments */}
          {edgePathData && (
            <path
              d={edgePathData}
              stroke="var(--color-divider)"
              strokeWidth={1 / zoom}
              fill="none"
              pointerEvents="none"
            />
          )}

          {/* Highlighted edges touching selected node */}
          {selectedEdgePathData && (
            <path
              d={selectedEdgePathData}
              stroke="var(--color-text)"
              strokeWidth={1.5 / zoom}
              fill="none"
              pointerEvents="none"
            />
          )}

          {/* Nodes: at most 400 circles */}
          {nodes.map((node, i) => {
            const p = points[i];
            if (!p) return null;
            const isSelected = node.id === selectedId;
            const isActive = Boolean(activeIds?.has(node.id));
            const st = nodeStyle(node, { selected: isSelected, active: isActive });
            const r = st.size * 1.5;

            // Show text labels for selected node, its neighbours, and the 12 most central nodes
            const showLabel =
              isSelected ||
              neighbourIndices.has(i) ||
              (i < 12 && zoom >= 0.9);

            return (
              <g key={node.id} transform={`translate(${p.x}, ${p.y})`}>
                <circle
                  r={r}
                  fill={st.color}
                  stroke={isSelected ? "var(--color-text)" : "var(--color-bg)"}
                  strokeWidth={isSelected ? 2 : 1}
                  style={{ cursor: "pointer" }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(node.id);
                  }}
                  onPointerEnter={() => setHoveredId(node.id)}
                  onPointerLeave={() => setHoveredId(null)}
                />
                {showLabel && (
                  <text
                    x={r + 4}
                    y={3}
                    fontSize={11 / zoom}
                    fontFamily="Archivo, sans-serif"
                    fontWeight={isSelected ? 800 : 600}
                    fill="var(--color-text)"
                    pointerEvents="none"
                    style={{
                      paintOrder: "stroke",
                      stroke: "var(--color-bg)",
                      strokeWidth: 3 / zoom,
                      strokeLinejoin: "round",
                    }}
                  >
                    {node.label || node.id}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Hover tooltip in a small --color-bg box */}
      {hoveredNode && hoveredPoint && (
        <div
          className="absolute pointer-events-none z-10 px-2 py-1 text-[12px] font-semibold text-[var(--color-text)] bg-[var(--color-bg)] border border-[var(--color-divider)] shadow-sm"
          style={{
            left: pan.x + hoveredPoint.x * zoom + 12,
            top: pan.y + hoveredPoint.y * zoom - 14,
            whiteSpace: "nowrap",
          }}
        >
          {hoveredNode.label || hoveredNode.id}
        </div>
      )}

      {/* Floating zoom controls */}
      <div className="absolute bottom-4 right-4 flex gap-1 z-10">
        <button
          type="button"
          aria-label="Zoom in"
          className="btn btn-secondary w-8 h-8 p-0 flex items-center justify-center text-[16px] font-bold cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            zoomBy(1.25);
          }}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          className="btn btn-secondary w-8 h-8 p-0 flex items-center justify-center text-[16px] font-bold cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            zoomBy(0.8);
          }}
        >
          −
        </button>
      </div>
    </div>
  );
}

export default Graph2D;
