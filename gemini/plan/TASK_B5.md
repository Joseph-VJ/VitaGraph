<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task B5 — The 3D view

- **Goal:** Add a 3D graph component that follows every performance rule above, shows selection and hover, and reports WebGL failures so the page can fall back to 2D.
- **Tier:** Must
- **Size:** L · hard
- **Review:** gate
- **Depends on:** B2, B3
- **Files to read first:**
  - `site design/src/components/graph3d/graphModel.ts`
  - `site design/src/components/graph3d/webgl.ts`
  - `site design/src/lib/preferences.ts`
- **Files to create or modify:**
  - create `site design/src/components/graph3d/Graph3D.tsx`

**What to change**
1. **Create `Graph3D.tsx`**, with a default export so it can be lazy-loaded, plus a named export `Graph3D`.
   - **Props:**
     - `nodes` and `edges` (the output of `selectNodes`);
     - `selectedId`;
     - `activeIds` (a set of highlighted node IDs);
     - `onSelect(nodeId | null)`;
     - `onContextLost()`;
     - `fitSignal`, a number that changes when "Fit" is pressed.
   - **Canvas:**
     - `frameloop="demand"`;
     - `dpr={[1, 1.75]}`;
     - `gl` with `antialias` only when the device pixel ratio is below 2, `powerPreference: "high-performance"` and `alpha: false`;
     - background colour from `readTokenColours().bg`;
     - a perspective camera with field of view 45, placed to frame the layout's bounding sphere.
     
     `onCreated` registers a `webglcontextlost` listener on the canvas that calls `onContextLost`.
   - **Nodes:**
     - One `InstancedMesh` of a low-poly sphere (an icosahedron with detail 1), holding all node instances.
     - Per-instance matrix from `layout3d` and the node size, and per-instance colour from `nodeStyle` and the token colours.
     - Selected and active nodes use the accent colour. Non-active nodes are dimmed to the neutral colour while a highlight set is present.
   - **Edges:** one `LineSegments` with one buffer geometry built from the edge index pairs, in the divider colour. Edges touching the selected node use the text colour (the colour buffer is updated, never rebuilt).
   - **Picking:**
     - `onPointerMove` on the instanced mesh reads `event.instanceId` for hover, sets the cursor to pointer and calls `invalidate()`.
     - `onClick` calls `onSelect(id)`.
     - `onPointerMissed` on the canvas calls `onSelect(null)`.
   - **Camera control:** `OrbitControls`, imported from `three/addons/controls/OrbitControls.js`, created imperatively from `useThree` (camera and `gl.domElement`):
     - `enableDamping` only while motion is allowed;
     - a `change` listener calls `invalidate()`;
     - `dispose()` and listener removal on unmount.
   - **Labels:** HTML labels (absolutely positioned `div`s, projected with the camera) only for the selected node, its neighbours and the 12 most central nodes. They use the Archivo font, the `--color-text` colour and a `--color-bg` backing for contrast.
   - **Fit:** when `fitSignal` changes, frame the bounding sphere. It is instant when motion is reduced, otherwise an ease of at most 400 ms driven by `useFrame` with preallocated vectors.
   - **Auto-rotation:** follow rule 12. A new prop, `autoRotate` (boolean), comes from the page's switch.
     - While it is true and not paused, a `useFrame` callback adds 0.19 × delta radians to the graph group's y rotation and calls `invalidate()` for the next frame. When it is false or paused, no frame is requested.
     - The pause state is set by the pointer handlers, hover, selection, and a 3-second idle timer that is cleared on unmount.
   - **Motion:** while Reduce motion is on (`usePreferences().reduceMotion`) or the system prefers reduced motion, there is no auto-rotation, no damping and no eased fit.
   - **Visibility:** while `document.visibilityState` is hidden, no eased animation runs.
   - **Cleanup:** dispose the sphere geometry, the line geometry and both materials on unmount.
   - **Accessibility:** the canvas wrapper has `aria-hidden="true"`. The page (B8) provides the keyboard path through a node list.
   - **Measuring frames:** when the app runs in development (`import.meta.env.DEV`), B10 needs two window values. Production builds do not include them.
     - `window.__VG_GRAPH_FRAMES__`, a number incremented in `useFrame`, measures rule 2.
     - `window.__VG_GRAPH_ROTATION__`, the group's current y rotation, measures rule 12.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. `Select-String -Path "site design\src\components\graph3d\Graph3D.tsx" -Pattern '#[0-9a-fA-F]{3,8}\b|drei|frameloop="always"'` prints nothing.

**Acceptance criteria**
- [ ] One instanced mesh for the nodes and one line segments object for the edges (rule 1).
- [ ] `frameloop="demand"` and `dpr={[1, 1.75]}` are used (rules 2 and 3).
- [ ] OrbitControls and all geometries and materials are disposed on unmount (rule 9).
- [ ] The build exits 0.


---

## Code skeleton for this task (Appendix A of the plan)

Only signatures and the one tricky part. If the skeleton and the task description disagree, the task description wins; report the difference.

### A.3 Task B5 — The 3D view: canvas, instanced nodes, controls, auto-rotation

```tsx
import { Canvas, useFrame, useThree, invalidate, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export default function Graph3D(props: Graph3DProps) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.75]}
        gl={{ antialias: window.devicePixelRatio < 2, powerPreference: "high-performance", alpha: false }}
        camera={{ fov: 45, near: 0.1, far: 2000, position: [0, 0, 220] }}
        onCreated={({ gl }) => gl.domElement.addEventListener("webglcontextlost", props.onContextLost)}
        onPointerMissed={() => props.onSelect(null)}
      >
        <Scene {...props} />
      </Canvas>
    </div>
  );
}

function Nodes({ nodes, positions, colors, onHover, onSelect }: NodesProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    nodes.forEach((n, i) => {
      const s = sizeOf(n);
      m.makeScale(s, s, s).setPosition(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(colors[i]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [nodes, positions, colors]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return (
    <instancedMesh
      key={nodes.length}                       // the instance count is fixed per mesh
      ref={ref}
      args={[geometry, material, nodes.length]}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => onHover(e.instanceId ?? null)}
      onClick={(e: ThreeEvent<MouseEvent>) => { if (e.instanceId !== undefined) onSelect(nodes[e.instanceId].id); }}
    />
  );
}

function Controls({ paused }: { paused: React.MutableRefObject<boolean> }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    const onChange = () => invalidate();
    const onStart = () => { paused.current = true; };       // a drag pauses auto-rotation (rule 12)
    controls.addEventListener("change", onChange);
    controls.addEventListener("start", onStart);
    return () => {
      controls.removeEventListener("change", onChange);
      controls.removeEventListener("start", onStart);
      controls.dispose();
    };
  }, [camera, gl, paused]);
  return null;
}

function AutoRotate({ group, enabled, paused }: AutoRotateProps) {
  useEffect(() => { if (enabled) invalidate(); }, [enabled]);   // kick the first frame; the resume timer also calls invalidate()
  useFrame((_, delta) => {
    if (!enabled || paused.current || !group.current) return;   // no request, so the loop stops (rule 2)
    group.current.rotation.y += 0.19 * delta;                   // time-based, rule 12
    if (import.meta.env.DEV) {
      (window as unknown as { __VG_GRAPH_ROTATION__?: number }).__VG_GRAPH_ROTATION__ = group.current.rotation.y;
    }
    invalidate();                                               // the next frame, only while rotating
  });
  return null;
}
```
