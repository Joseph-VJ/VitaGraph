<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task B2 — Add three.js and react-three-fiber at pinned versions

- **Goal:** Install the 3D libraries at versions checked against this project's React 19.2 and TypeScript setup.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `site design/package.json`
- **Files to create or modify:**
  - modify `site design/package.json`
  - modify `site design/package-lock.json`

**Facts checked by the planner (from the published packages):**
- `@react-three/fiber` 9.8.1 declares the peer dependencies `react >=19 <19.4`, `react-dom >=19 <19.4` and `three >=0.156`. This project uses React 19.2.
- 9.8.1 exports `Canvas`, `useThree`, `useFrame`, `invalidate` and the type `ThreeEvent`. `Canvas` accepts `frameloop`, `dpr`, `gl`, `camera`, `onCreated` and `onPointerMissed`. Pointer events on an `InstancedMesh` carry `instanceId`.
- three 0.180.0 ships `OrbitControls` at `three/addons/controls/OrbitControls.js`, with `enableDamping`, `target`, `update()`, `dispose()` and the `change` event. `@types/three` 0.180.0 types that path.
- `@react-three/drei` is **not** used. It is not needed, and leaving it out keeps the bundle small.

**What to change**
1. In `site design`, run `npm install three@0.180.0 @react-three/fiber@9.8.1 --save-exact`.
2. Then run `npm install -D @types/three@0.180.0 --save-exact`.
3. These two commands must change only `site design/package.json` and `site design/package-lock.json`.

**How to verify**
1. `git diff --stat` lists only those two files.
2. `cd "site design"; npm ls three @react-three/fiber @types/three` shows exactly 0.180.0, 9.8.1 and 0.180.0, with no `UNMET PEER` line.
3. `npm run build` exits 0.

**Acceptance criteria**
- [ ] The three packages are at the exact versions, saved without `^`.
- [ ] No other package was added or upgraded (check the lock file diff).
- [ ] The build exits 0.
