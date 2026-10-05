// 3D knowledge graph component built on Three.js and @react-three/fiber.
// Follows performance rules: instanced mesh, demand frameloop, no per-frame allocation,
// WebGL context lost detection, auto-rotation with interaction pauses, HTML label projection.
// No hex colors anywhere.

import { Canvas, type ThreeEvent, invalidate, useFrame, useThree } from "@react-three/fiber";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { GraphNode } from "../../api/graph";
import { usePreferences } from "../../lib/preferences";
import {
  type SelectedEdge,
  layout3d,
  nodeStyle,
  readTokenColours,
} from "./graphModel";

export interface Graph3DProps {
  nodes: GraphNode[];
  edges: SelectedEdge[];
  selectedId?: string | null;
  activeIds?: Set<string>;
  onSelect: (nodeId: string | null) => void;
  onContextLost?: () => void;
  fitSignal?: number;
  autoRotate?: boolean;
  className?: string;
}

export function Graph3D(props: Graph3DProps) {
  const { onContextLost, onSelect, className = "" } = props;
  const tokenColours = useMemo(() => readTokenColours(), []);
  const containerRef = useRef<HTMLDivElement>(null);

  // Background hex / rgb check: readTokenColours returns rgb(...) or rgba(...) strings
  const bgColor = useMemo(() => new THREE.Color(tokenColours.bg), [tokenColours.bg]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <div aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
        <Canvas
          frameloop="demand"
          dpr={[1, 1.75]}
          gl={{
            antialias: typeof window !== "undefined" && window.devicePixelRatio < 2,
            powerPreference: "high-performance",
            alpha: false,
          }}
          camera={{ fov: 45, near: 0.1, far: 2000, position: [0, 0, 220] }}
          onCreated={({ gl, scene }) => {
            scene.background = bgColor;
            if (onContextLost) {
              gl.domElement.addEventListener("webglcontextlost", onContextLost);
            }
          }}
          onPointerMissed={() => onSelect(null)}
        >
          <Scene {...props} containerRef={containerRef} />
        </Canvas>
      </div>
    </div>
  );
}

export default Graph3D;

interface SceneProps extends Graph3DProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function Scene({
  nodes,
  edges,
  selectedId = null,
  activeIds,
  onSelect,
  fitSignal = 0,
  autoRotate = true,
  containerRef,
}: SceneProps) {
  const { camera, gl } = useThree();
  const preferences = usePreferences();
  const systemReduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isReducedMotion = preferences.reduceMotion || systemReduceMotion;

  const groupRef = useRef<THREE.Group>(null);
  const pausedRef = useRef(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hoveredNode = hoveredIdx !== null ? nodes[hoveredIdx] : null;

  const tokenColours = useMemo(() => readTokenColours(), []);

  // Compute 3D node positions once per data set (memoized)
  const positions = useMemo(() => {
    return layout3d(nodes, edges);
  }, [nodes, edges]);

  // Index map
  const nodeIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    nodes.forEach((n, i) => map.set(n.id, i));
    return map;
  }, [nodes]);

  const selectedIdx = selectedId ? (nodeIndexMap.get(selectedId) ?? -1) : -1;

  // Direct neighbours of selected node
  const neighbourIndices = useMemo(() => {
    const set = new Set<number>();
    if (selectedIdx === -1) return set;
    edges.forEach((e) => {
      if (e.source === selectedIdx) set.add(e.target);
      if (e.target === selectedIdx) set.add(e.source);
    });
    return set;
  }, [selectedIdx, edges]);

  // Compute colours array for all nodes
  const nodeColors = useMemo(() => {
    const arr: string[] = [];
    const hasActiveSet = Boolean(activeIds && activeIds.size > 0);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isSelected = node.id === selectedId;
      const isActive = Boolean(activeIds?.has(node.id));

      if (isSelected || isActive) {
        arr.push(tokenColours.accent);
      } else if (hasActiveSet) {
        arr.push(tokenColours.neutral400);
      } else {
        const st = nodeStyle(node);
        if (st.colorRole === "accent") {
          arr.push(tokenColours.accent);
        } else if (st.colorRole === "text") {
          arr.push(tokenColours.text);
        } else if (st.colorRole === "uncertain") {
          arr.push(tokenColours.ochre);
        } else if (st.colorRole === "neutral") {
          arr.push(tokenColours.neutral400);
        } else {
          arr.push(tokenColours.neutral600);
        }
      }
    }
    return arr;
  }, [nodes, selectedId, activeIds, tokenColours]);

  // Pause helper for auto-rotation
  const triggerPause = () => {
    pausedRef.current = true;
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  const scheduleResume = () => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
    }
    pauseTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
      invalidate();
    }, 3000);
  };

  // Pause when hovered or selected
  useEffect(() => {
    if (hoveredIdx !== null || selectedId !== null) {
      triggerPause();
    } else {
      scheduleResume();
    }
  }, [hoveredIdx, selectedId]);

  // Cleanup pause timer
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
      }
    };
  }, []);

  // Fit camera animation setup
  const fitAnimRef = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
  }>({
    active: false,
    startTime: 0,
    duration: 400,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
  });

  // Calculate layout bounding sphere
  const boundingSphere = useMemo(() => {
    if (nodes.length === 0) return { center: new THREE.Vector3(0, 0, 0), radius: 100 };
    let maxR = 0;
    for (let i = 0; i < nodes.length; i++) {
      const x = positions[i * 3 + 0];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const d = Math.sqrt(x * x + y * y + z * z);
      if (d > maxR) maxR = d;
    }
    return { center: new THREE.Vector3(0, 0, 0), radius: Math.max(maxR + 20, 40) };
  }, [nodes.length, positions]);

  // Fit on fitSignal
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    if (nodes.length === 0) return;
    const fovRad = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    const dist = boundingSphere.radius / Math.sin(fovRad / 2);
    const targetPos = new THREE.Vector3(0, 0, dist);
    const targetCenter = boundingSphere.center;

    if (isReducedMotion) {
      camera.position.copy(targetPos);
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetCenter);
        controlsRef.current.update();
      }
      invalidate();
    } else {
      const anim = fitAnimRef.current;
      anim.startPos.copy(camera.position);
      anim.endPos.copy(targetPos);
      anim.startTarget.copy(controlsRef.current ? controlsRef.current.target : targetCenter);
      anim.endTarget.copy(targetCenter);
      anim.startTime = performance.now();
      anim.duration = 400;
      anim.active = true;
      invalidate();
    }
  }, [fitSignal, boundingSphere, camera, isReducedMotion, nodes.length]);

  // Frame measurement & easing & auto-rotation
  useFrame((_, delta) => {
    // 1. Measure frames in dev
    if (import.meta.env.DEV) {
      const w = window as unknown as { __VG_GRAPH_FRAMES__?: number; __VG_GRAPH_ROTATION__?: number };
      w.__VG_GRAPH_FRAMES__ = (w.__VG_GRAPH_FRAMES__ || 0) + 1;
      if (groupRef.current) {
        w.__VG_GRAPH_ROTATION__ = groupRef.current.rotation.y;
      }
    }

    // 2. Camera fit easing
    const anim = fitAnimRef.current;
    if (anim.active) {
      const now = performance.now();
      const elapsed = now - anim.startTime;
      const progress = Math.min(1, elapsed / anim.duration);
      // Smooth ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      camera.position.lerpVectors(anim.startPos, anim.endPos, ease);
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(anim.startTarget, anim.endTarget, ease);
        controlsRef.current.update();
      }
      invalidate();

      if (progress >= 1) {
        anim.active = false;
      }
    }

    // 3. Auto-rotation (rule 12)
    const canRotate =
      autoRotate &&
      !isReducedMotion &&
      !pausedRef.current &&
      typeof document !== "undefined" &&
      document.visibilityState !== "hidden";

    if (canRotate && groupRef.current) {
      groupRef.current.rotation.y += 0.19 * delta;
      invalidate();
    }
  });

  // Track window resize / visibility change
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        invalidate();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <>
      <Controls
        camera={camera}
        domElement={gl.domElement}
        paused={pausedRef}
        isReducedMotion={isReducedMotion}
        onPause={triggerPause}
        onResume={scheduleResume}
        controlsRef={controlsRef}
      />

      <group ref={groupRef}>
        <Nodes
          nodes={nodes}
          positions={positions}
          colors={nodeColors}
          onHover={(idx) => {
            setHoveredIdx(idx);
            if (idx !== null) {
              gl.domElement.style.cursor = "pointer";
            } else {
              gl.domElement.style.cursor = "default";
            }
            invalidate();
          }}
          onSelect={onSelect}
        />

        <Edges
          edges={edges}
          positions={positions}
          selectedIdx={selectedIdx}
          tokenColours={tokenColours}
        />
      </group>

      <Labels
        nodes={nodes}
        positions={positions}
        selectedIdx={selectedIdx}
        neighbourIndices={neighbourIndices}
        groupRef={groupRef}
        camera={camera as THREE.PerspectiveCamera}
        containerRef={containerRef}
      />

      {hoveredNode && (
        <HoverTooltip
          node={hoveredNode}
          positions={positions}
          nodeIdx={hoveredIdx!}
          groupRef={groupRef}
          camera={camera as THREE.PerspectiveCamera}
          containerRef={containerRef}
        />
      )}
    </>
  );
}

// ----------------------------------------------------------------------
// Controls Component
// ----------------------------------------------------------------------
interface ControlsProps {
  camera: THREE.Camera;
  domElement: HTMLElement;
  paused: React.MutableRefObject<boolean>;
  isReducedMotion: boolean;
  onPause: () => void;
  onResume: () => void;
  controlsRef: React.MutableRefObject<OrbitControls | null>;
}

function Controls({
  camera,
  domElement,
  isReducedMotion,
  onPause,
  onResume,
  controlsRef,
}: ControlsProps) {
  useEffect(() => {
    const controls = new OrbitControls(camera, domElement);
    controlsRef.current = controls;
    controls.enableDamping = !isReducedMotion;
    controls.dampingFactor = 0.05;

    const onChange = () => invalidate();
    const onStart = () => {
      onPause();
    };
    const onEnd = () => {
      onResume();
    };

    controls.addEventListener("change", onChange);
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);

    return () => {
      controls.removeEventListener("change", onChange);
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, domElement, isReducedMotion, onPause, onResume, controlsRef]);

  return null;
}

// ----------------------------------------------------------------------
// Nodes Component (InstancedMesh)
// ----------------------------------------------------------------------
interface NodesProps {
  nodes: GraphNode[];
  positions: Float32Array;
  colors: string[];
  onHover: (instanceId: number | null) => void;
  onSelect: (nodeId: string) => void;
}

function Nodes({ nodes, positions, colors, onHover, onSelect }: NodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial(), []);

  // Update instance matrices and colors
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || nodes.length === 0) return;

    const m = new THREE.Matrix4();
    const c = new THREE.Color();

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const st = nodeStyle(n);
      const s = st.size;
      m.makeScale(s, s, s).setPosition(
        positions[i * 3 + 0],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      );
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(colors[i]));
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    invalidate();
  }, [nodes, positions, colors]);

  // Disposal of geometry and material on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  if (nodes.length === 0) return null;

  return (
    <instancedMesh
      key={nodes.length}
      ref={meshRef}
      args={[geometry, material, nodes.length]}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(e.instanceId ?? null);
      }}
      onPointerOut={() => {
        onHover(null);
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.instanceId !== undefined && e.instanceId >= 0 && e.instanceId < nodes.length) {
          onSelect(nodes[e.instanceId].id);
        }
      }}
    />
  );
}

// ----------------------------------------------------------------------
// Edges Component (LineSegments with BufferGeometry)
// ----------------------------------------------------------------------
interface EdgesProps {
  edges: SelectedEdge[];
  positions: Float32Array;
  selectedIdx: number;
  tokenColours: { divider: string; text: string };
}

function Edges({ edges, positions, selectedIdx, tokenColours }: EdgesProps) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const material = useMemo(
    () => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true }),
    []
  );

  // Build vertex positions buffer
  const posBuffer = useMemo(() => {
    const arr = new Float32Array(edges.length * 2 * 3);
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const s = e.source;
      const t = e.target;
      arr[i * 6 + 0] = positions[s * 3 + 0];
      arr[i * 6 + 1] = positions[s * 3 + 1];
      arr[i * 6 + 2] = positions[s * 3 + 2];
      arr[i * 6 + 3] = positions[t * 3 + 0];
      arr[i * 6 + 4] = positions[t * 3 + 1];
      arr[i * 6 + 5] = positions[t * 3 + 2];
    }
    return arr;
  }, [edges, positions]);

  // Build color buffer
  const colorBuffer = useMemo(() => {
    const arr = new Float32Array(edges.length * 2 * 3);
    const baseColor = new THREE.Color(tokenColours.divider);
    const selectedColor = new THREE.Color(tokenColours.text);

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const isTouching = selectedIdx !== -1 && (e.source === selectedIdx || e.target === selectedIdx);
      const c = isTouching ? selectedColor : baseColor;

      arr[i * 6 + 0] = c.r;
      arr[i * 6 + 1] = c.g;
      arr[i * 6 + 2] = c.b;
      arr[i * 6 + 3] = c.r;
      arr[i * 6 + 4] = c.g;
      arr[i * 6 + 5] = c.b;
    }
    return arr;
  }, [edges, selectedIdx, tokenColours]);

  // Set up geometry
  useLayoutEffect(() => {
    if (!geometryRef.current) {
      geometryRef.current = new THREE.BufferGeometry();
    }
    const geom = geometryRef.current;
    geom.setAttribute("position", new THREE.BufferAttribute(posBuffer, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colorBuffer, 3));
    invalidate();
  }, [posBuffer, colorBuffer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (geometryRef.current) {
        geometryRef.current.dispose();
      }
      material.dispose();
    };
  }, [material]);

  if (edges.length === 0) return null;

  return (
    <lineSegments
      ref={lineRef}
      geometry={geometryRef.current ?? undefined}
      material={material}
    />
  );
}

// ----------------------------------------------------------------------
// HTML Labels Overlay
// ----------------------------------------------------------------------
interface LabelsProps {
  nodes: GraphNode[];
  positions: Float32Array;
  selectedIdx: number;
  neighbourIndices: Set<number>;
  groupRef: React.RefObject<THREE.Group | null>;
  camera: THREE.PerspectiveCamera;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function Labels({
  nodes,
  positions,
  selectedIdx,
  neighbourIndices,
  groupRef,
  camera,
  containerRef,
}: LabelsProps) {
  const [projectedLabels, setProjectedLabels] = useState<
    Array<{ id: string; label: string; x: number; y: number; isSelected: boolean }>
  >([]);

  // Preallocated vector for zero-allocation projections
  const vecRef = useRef(new THREE.Vector3());

  useFrame(() => {
    const container = containerRef.current;
    if (!container || !groupRef.current || nodes.length === 0) {
      if (projectedLabels.length > 0) setProjectedLabels([]);
      return;
    }

    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w <= 0 || h <= 0) return;

    const groupMatrix = groupRef.current.matrixWorld;
    const vec = vecRef.current;
    const list: Array<{ id: string; label: string; x: number; y: number; isSelected: boolean }> = [];

    // Filter to selected node, direct neighbours, and top 12 most central nodes
    const labelIndices = new Set<number>();
    if (selectedIdx !== -1) {
      labelIndices.add(selectedIdx);
      neighbourIndices.forEach((idx) => labelIndices.add(idx));
    }
    const topCount = Math.min(12, nodes.length);
    for (let i = 0; i < topCount; i++) {
      labelIndices.add(i);
    }

    labelIndices.forEach((idx) => {
      const node = nodes[idx];
      if (!node) return;

      vec.set(
        positions[idx * 3 + 0],
        positions[idx * 3 + 1],
        positions[idx * 3 + 2]
      );
      vec.applyMatrix4(groupMatrix);
      vec.project(camera);

      // Only show if point is in front of camera
      if (vec.z < 1.0) {
        const sx = (vec.x * 0.5 + 0.5) * w;
        const sy = (-vec.y * 0.5 + 0.5) * h;
        list.push({
          id: node.id,
          label: node.label || node.id,
          x: sx,
          y: sy,
          isSelected: idx === selectedIdx,
        });
      }
    });

    setProjectedLabels(list);
  });

  if (projectedLabels.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {projectedLabels.map((lbl) => (
        <div
          key={lbl.id}
          className="absolute text-[11px] px-1.5 py-0.5 border leading-tight"
          style={{
            left: lbl.x + 8,
            top: lbl.y - 8,
            fontFamily: "Archivo, sans-serif",
            fontWeight: lbl.isSelected ? 800 : 600,
            color: "var(--color-text)",
            backgroundColor: "var(--color-bg)",
            borderColor: "var(--color-divider)",
            whiteSpace: "nowrap",
          }}
        >
          {lbl.label}
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------
// Hover Tooltip Overlay
// ----------------------------------------------------------------------
interface HoverTooltipProps {
  node: GraphNode;
  positions: Float32Array;
  nodeIdx: number;
  groupRef: React.RefObject<THREE.Group | null>;
  camera: THREE.PerspectiveCamera;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function HoverTooltip({
  node,
  positions,
  nodeIdx,
  groupRef,
  camera,
  containerRef,
}: HoverTooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const vecRef = useRef(new THREE.Vector3());

  useFrame(() => {
    const container = containerRef.current;
    if (!container || !groupRef.current) return;

    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w <= 0 || h <= 0) return;

    const vec = vecRef.current;
    vec.set(
      positions[nodeIdx * 3 + 0],
      positions[nodeIdx * 3 + 1],
      positions[nodeIdx * 3 + 2]
    );
    vec.applyMatrix4(groupRef.current.matrixWorld);
    vec.project(camera);

    if (vec.z < 1.0) {
      setPos({
        x: (vec.x * 0.5 + 0.5) * w,
        y: (-vec.y * 0.5 + 0.5) * h,
      });
    } else {
      setPos(null);
    }
  });

  if (!pos) return null;

  return (
    <div
      className="absolute pointer-events-none z-20 px-2 py-1 text-[12px] font-semibold text-[var(--color-text)] bg-[var(--color-bg)] border border-[var(--color-divider)] shadow-sm"
      style={{
        left: pos.x + 12,
        top: pos.y - 12,
        whiteSpace: "nowrap",
      }}
    >
      {node.label || node.id}
    </div>
  );
}
