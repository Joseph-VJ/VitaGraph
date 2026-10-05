<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task A4 — Shell: phone gutters, responsive search, and a sidebar bar that follows resizes

- **Goal:** Make the header, footer and sidebar usable at 360 px, and fix the red active bar that points at the wrong item after the sidebar changes width.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `site design/src/components/shell/Header.tsx`
  - `site design/src/components/shell/StatusStrip.tsx`
  - `site design/src/components/shell/Sidebar.tsx`
  - `site design/src/components/shell/AppShell.tsx`
  - `site design/src/motion/flip.ts`
- **Files to create or modify:**
  - modify `site design/src/components/shell/Header.tsx`
  - modify `site design/src/components/shell/StatusStrip.tsx`
  - modify `site design/src/components/shell/Sidebar.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`

**What to change**
1. **Header element:** `site design/src/components/shell/Header.tsx` lines 113–119 (anchor `padding: "var(--space-3) var(--space-8)"`).
   - Add the class `vg-header` in front of the existing classes.
   - Remove only the `padding` entry from the inline style. The class now supplies the padding, with 16 px on phones.
2. **Controls row:** `site design/src/components/shell/Header.tsx` line 133 (anchor `gap: "var(--space-3)", flexWrap: "wrap" }}>`). Add `minWidth: 0` and `maxWidth: "100%"` to its inline style so it can shrink.
3. **Search form:** `site design/src/components/shell/Header.tsx` lines 137–141 (anchor `data-boot-target="header-search"`). Its style `{ margin: 0 }` becomes flexible:
   - margin 0;
   - flex `1 1 200px`;
   - min width 0;
   - max width 300 px.
4. **Search input:** `site design/src/components/shell/Header.tsx` line 149 (anchor `style={{ width: 300 }}`). Change the width to `"100%"`.
5. **Footer:** `site design/src/components/shell/StatusStrip.tsx` lines 96–102 (anchor `className="flex-shrink-0 z-30 select-none"`).
   - Add the class `vg-footer`.
   - Remove `padding: "0 var(--space-8)"` from the inline style, keeping everything else.
6. **Sidebar import:** `site design/src/components/shell/Sidebar.tsx` line 1 (anchor `import React, { useEffect, useRef } from "react";`). Also import `useCallback`.
7. **Sidebar effect:** `site design/src/components/shell/Sidebar.tsx` lines 27–61 (anchor `}, [currentPath]);`). Restructure this effect into three parts.
   - **(a) `placeIndicator`.** Add a function `placeIndicator(animate: boolean)`, memoised with `useCallback` and empty dependencies. It holds the body of today's effect, with three differences:
     - The bar's top is computed as the link's top minus the nav's top, plus the nav's current `scrollTop`.
     - The bar's `display` is set to `block` before either branch.
     - When `animate` is false, it sets `top` and `height` directly and returns. When true, it runs the existing `flip(...)` call with the weighted spring and `capMs: 240`, unchanged.
   - **(b) Route effect.** It depends on `[currentPath, placeIndicator]`. It calls `placeIndicator(!isFirstRender.current)`, then sets `isFirstRender.current = false`.
   - **(c) Resize effect.** It depends on `[placeIndicator]`.
     - When `navRef.current` exists and `ResizeObserver` is defined, it observes the nav element and calls `placeIndicator(false)` on every resize.
     - Its cleanup disconnects the observer.
   - Add a two-line comment above `placeIndicator`: route changes animate the bar, and a resize or breakpoint change (244 px to 60 px sidebar) moves it at once, so it never points at the wrong item.
8. **Text colour token:** `site design/src/components/shell/AppShell.tsx` line 128 (anchor `text-[var(--bone)]`). Change the legacy token class to `text-[var(--color-text)]`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. In the browser at 1440 px on `/agent`, resize the window to 820 px. The red bar stays beside the dark AI Agent item at both widths. Save screenshots `gemini/shots/A4-sidebar-1440.png` and `gemini/shots/A4-sidebar-820.png`.
3. In the browser at 360 × 740 on `/library`, the header search box fits inside the screen. In the console, `document.documentElement.scrollWidth` equals `window.innerWidth`; paste both numbers.

**Acceptance criteria**
- [ ] All eight changes are made.
- [ ] At 820 px, the red bar's top equals the active item's top within 1 px. Paste the `getBoundingClientRect().top` of both elements, measured in the console.
- [ ] At 360 px there is no horizontal page scroll on `/library`.
- [ ] The build exits 0.
