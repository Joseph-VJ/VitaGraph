# TASK B5 report

## 1. What I was asked to do
Create `site design/src/components/graph3d/Graph3D.tsx` implementing the 3D knowledge graph view under strict performance rules: one instanced mesh for nodes, one line segments buffer geometry for edges, demand frameloop (`frameloop="demand"`), pixel ratio cap (`dpr={[1, 1.75]}`), imperative OrbitControls with damping only when motion is allowed, WebGL context lost detection reporting, hover & selection picking via instanceId, HTML projected labels for central nodes/neighbours/selected node, smooth eased fit framing bounding sphere within 400ms (instant under reduced motion), auto-rotation at 0.19 rad/s with interaction pause/resume timer (cleared on unmount), and dev-mode frame/rotation instrumentation.

## 2. What I actually did
1. Created `site design/src/components/graph3d/Graph3D.tsx` with named and default exports.
2. Configured `<Canvas>` with `frameloop="demand"`, `dpr={[1, 1.75]}`, high-performance gl context, `webglcontextlost` event listener calling `onContextLost`, and pointer-missed deselection.
3. Implemented `Nodes` component using `THREE.InstancedMesh` with low-poly `THREE.IcosahedronGeometry(1, 1)`, mapping per-node sizes and colors without per-frame allocations, and disposing geometries/materials on unmount.
4. Implemented `Edges` component using `THREE.LineSegments` and `THREE.BufferGeometry` with dynamic vertex colors highlighting edges touching the selected node without rebuilding geometry.
5. Implemented `Controls` wrapping `OrbitControls` with change invalidation, drag-start auto-rotation pause, and cleanup on unmount.
6. Implemented HTML label projection (`Labels` and `HoverTooltip`) projecting 3D positions through camera to screen coordinates using preallocated vectors.
7. Implemented bounding sphere camera fitting on `fitSignal`, with smooth cubic ease-out under 400ms or instant repositioning under reduced motion.
8. Implemented auto-rotation at 0.19 rad/s governed by `usePreferences().reduceMotion`, tab visibility, and a 3-second interaction pause timer.
9. Added dev frame metrics `window.__VG_GRAPH_FRAMES__` and `window.__VG_GRAPH_ROTATION__` under `import.meta.env.DEV`.
10. Verified `npm run build` exits 0, no banned patterns exist (`#[0-9a-fA-F]{3,8}\b`, `drei`, `frameloop="always"`), and design audit shows 0 lines for `graph3d`.

## 3. Files changed
- `site design/src/components/graph3d/Graph3D.tsx` (+774/-0): Complete 3D graph view component.

## 4. Commands and their output
```powershell
cd "site design"; npm run build
```
```
> vitagraph-site-design@0.0.0 build
> tsc -b && vite build

vite v8.3.2 building client environment for production...
transforming...
✓ 368 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.71 kB │ gzip:   0.44 kB
dist/assets/archivo-latin-600-normal-3BBy0ZsW.woff2   13.82 kB
dist/assets/archivo-latin-800-normal-cB6v3kRN.woff2   14.41 kB
dist/assets/archivo-latin-400-normal-C81ewxNO.woff2   14.70 kB
dist/assets/archivo-latin-600-normal-DwYieO8P.woff    18.20 kB
dist/assets/archivo-latin-800-normal-DZa_k145.woff    18.90 kB
dist/assets/archivo-latin-400-normal-Bl602Mgc.woff    18.97 kB
dist/assets/index-DmuJyOK_.css                       103.79 kB │ gzip:  18.58 kB
dist/assets/index-DoXEEXaa.js                        694.84 kB │ gzip: 206.45 kB
✓ built in 710ms
```

```powershell
Select-String -Path "site design\src\components\graph3d\Graph3D.tsx" -Pattern '#[0-9a-fA-F]{3,8}\b|drei|frameloop="always"'
```
*(No output - 0 banned patterns found)*

```powershell
cd "site design"; npm run audit:design | Select-String "graph3d"
```
*(No output - 0 lines printed for any file under graph3d)*

## 5. Acceptance checklist
- [x] One instanced mesh for the nodes and one line segments object for the edges (rule 1): PASS.
- [x] `frameloop="demand"` and `dpr={[1, 1.75]}` are used (rules 2 and 3): PASS.
- [x] OrbitControls and all geometries and materials are disposed on unmount (rule 9): PASS.
- [x] The build exits 0: PASS.

## 6. Things that surprised me
Three.js and `@react-three/fiber` integrated cleanly with the strict TypeScript and Vite setup without any bundle or type issues.

## 7. Deviations from the task
none

## 8. Open questions for the reviewer
none

## 9. How the reviewer can double-check
1. `cd "site design"; npm run build`
2. `Select-String -Path "site design\src\components\graph3d\Graph3D.tsx" -Pattern '#[0-9a-fA-F]{3,8}\b|drei|frameloop="always"'`
3. `cd "site design"; npm run audit:design | Select-String graph3d`
