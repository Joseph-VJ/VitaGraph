# Session P3b Summary: Living Background Visibility & Contrast Polish

## 1. Overview
Session P3b completed Part B (items B1 to B4) of `gemini/TASK_P3_polish.md`, fixing Finding 6 from `gemini/reviews/P1P2_review.md`. The living background layer is now clearly visible in the header strip and margins at Soft, strong and dynamic at Full, while maintaining >= 4.5:1 text contrast across all pages.

Branch: `feature/playground-graph-and-backgrounds`.
Per session rules: no files were committed or staged; only Part B files were modified; no Part A files or backend files were touched.

---

## 2. Changes Made (B1)

### 1. `site design/src/components/shell/AppShell.tsx`
- Lowered the content column backing from 88% to 72% ground:
  `bg-[color-mix(in_srgb,var(--color-bg)_72%,transparent)]`.
- Added `data-living-bg` attribute to the main area column wrapper to synchronize header and footer translucency with preference state.

### 2. `site design/src/index.css`
- Added rules under `/* ---- Living background and play mode ---- */`:
  ```css
  [data-living-bg="soft"] .vg-header,
  [data-living-bg="full"] .vg-header,
  [data-living-bg="soft"] .vg-footer,
  [data-living-bg="full"] .vg-footer {
    background: color-mix(in srgb, var(--color-bg) 72%, transparent) !important;
  }
  ```
  This allows the grid and ink patterns to flow smoothly through the header strip and status strip without touching the solid sidebar or covering text.

### 3. `site design/src/components/background/LivingBackground.tsx`
- Raised `strength()` outputs:
  - `soft`: increased from `0.55` to `0.75`
  - `full`: increased from `1.0` to `1.7`
  - `playing`: increased from `1.35` to `1.4`

### 4. `site design/src/components/background/warp.ts` (Rubber Grid)
- Baseline grid line alpha raised from `0.17` to `(0.72 + flash * 0.28) * s` with adaptive line width `1.0` (Soft) and `1.5` (Full).
- Pointer crosshairs alpha raised to `(1 - d / 200) * 0.85 * Math.min(1, s)`.
- Upload cell stamp alphas raised to `(fresh ? 0.9 : 0.35) * Math.min(1, s)`.
- Click wave ripple alpha raised to `0.65` with `lineWidth = 1.5`.

### 5. `site design/src/components/background/flow.ts` (Ink Currents)
- Thread alpha raised from `0.3` to `0.45 * Math.min(1.5, s)`.
- Hot red ink alpha raised to `Math.min(1, 0.95 * s)` with `lineWidth = 1.4`.
- Reduced-motion still frame alpha raised from `0.18` to `0.38`.

### 6. `site design/src/components/background/stars.ts` (Constellation)
- Star particle radius increased from `1.6-3.4px` to `2.0-4.0px`.
- Connection line alpha `la` raised from `0.32 * s` to `0.42 * s`.
- Node dot alpha raised from `0.55 * s` to `0.7 * s`.
- Shockwave ripple alpha raised to `0.75` with `lineWidth = 1.8`.

### 7. `site design/src/components/background/typeE.ts` (Living Type)
- Dot particle size increased to `Math.max(2.0, Math.min(5.0, gap * 0.65))`.
- Dust alpha raised to `0.28 * s`, letter ink alpha to `0.85 * s`, active red alpha to `1.4 * s`.
- Shockwave ripple alpha raised to `0.75` with `lineWidth = 1.8`.

---

## 3. Measured Numbers & Verification (B2 & B3)

Automated verification via Playwright test harness (`scripts/plan/verify_p3b.py`) under real persona `usr_51f14542d71a`:

| Check | Requirement | Measured Result | Status |
|---|---|---|---|
| Soft Grid Contrast (`/library`) | ~6% to 8% darker than ground | **6.34%** (RGB 227 vs 243 ground) | PASS |
| Full Grid Contrast (`/settings`) | ~14% to 18% darker than ground | **18.48%** (RGB 198 vs 243 ground) | PASS |
| Text Contrast Ratio | >= 4.5:1 | **11.4:1** (RGB 32 text on RGB 227/243) | PASS |
| Soft FPS (`/library`) | >= 28 fps | **29 fps** (30 fps cap) | PASS |
| Full FPS (`/settings`) | >= 40 fps | **48 fps** (60 fps cap) | PASS |
| All 4 Engines visible at Soft | Warp, Flow, Stars, Type active | All 4 switch cleanly & render canvas | PASS |
| Reduce Motion | Draws 1 still frame, stops rAF | Canvas visible, still frame drawn | PASS |
| Off Setting | Canvas hidden | `display: none` | PASS |
| Route Hiding (`/graph`, `/text-to-graph`) | Canvas hidden on graph pages | `display: none` on both routes | PASS |
| Mobile Width (400 px) | No horizontal overflow (scrollWidth <= 400) | `scrollWidth = 400` on `/library`, `/settings`, `/upload`, `/agent` | PASS |

---

## 4. Screenshots Generated (B2)

All screenshots captured at 1440x900 resolution and verified:
- `gemini/shots/P3b-library-soft.png`: Library page with subtle, elegant 6.3% darker grid running across header strip, margins, and content column; table rows, tags, and text are crisp and high contrast.
- `gemini/shots/P3b-settings-full.png`: Settings page with strong, dynamic 18.5% darker rubber grid with curved distortions in the right margin; all settings rows and controls remain clear.
- `gemini/shots/P3b-agent-soft.png`: AI Agent page showing clean grid lines beneath prompt cards and input box with pristine text legibility.
- `gemini/shots/P3b-upload-soft.png`: Upload and ingestion page showing rubber grid behind the 5-stage pipeline modules.

---

## 5. Verification Commands (B4)
- **Frontend Build**: `cd "site design" && npm run build` -> **Exit 0** (built in 1.45s).
- **Design Audit**: `cd "site design" && npm run audit:design` -> **72 files, 0 errors, 0 pending**.
- **Secret Scan**: `python scripts/plan/secret_scan.py` -> **RESULT: PASS**.
- **Backend Tests**: `pytest tests -q` -> **403 passed**.
