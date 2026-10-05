<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task B7 — A "Graph view" preference

- **Goal:** Let a person choose Automatic, 3D or 2D in Settings. Automatic means 3D when WebGL2 works, otherwise 2D.
- **Tier:** Should
- **Size:** S
- **Review:** light
- **Depends on:** A8
- **Files to read first:**
  - `site design/src/lib/preferences.ts`
  - `site design/src/pages/SettingsPage.tsx`
- **Files to create or modify:**
  - modify `site design/src/lib/preferences.ts`
  - modify `site design/src/pages/SettingsPage.tsx`

**What to change**
1. **Preference:** `site design/src/lib/preferences.ts` lines 4–10 (anchor `export interface Preferences {`).
   - Add `graphView` with the values `"auto"`, `"3d"` or `"2d"`, default `"auto"`.
   - In `load()` (lines 12–26, anchor `function load(): Preferences {`), accept only those three strings and fall back to the default otherwise.
2. **Choice row:** in `site design/src/pages/SettingsPage.tsx`, reuse `ChoiceRow` when task C8 has already added it. Otherwise add it now, next to `OptionRow` and built like it (lines 44–73, anchor `const OptionRow: React.FC<OptionRowProps>`), but with one button per choice.
   - In the Display section, after "Reduce motion", add a `ChoiceRow` with `data-testid="setting-graph-view"`:
     - title "Graph view";
     - description "Automatic uses 3D when this browser supports it, and 2D otherwise.";
     - options Automatic, 3D and 2D, each calling `setPreference("graphView", …)`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser on `/settings`: choose 2D, reload, and the choice is kept.

**Acceptance criteria**
- [ ] `graphView` exists with exactly the three values, and an unknown stored value falls back to `auto`.
- [ ] `setting-graph-view` exists in Settings.
- [ ] The build exits 0.
