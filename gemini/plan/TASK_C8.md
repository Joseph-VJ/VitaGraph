<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task C8 — Show speed setting (decision DEC-4)

- **Goal:** Let a person choose how long each stage of the ingestion show stays on screen (Fast, Normal or Slow), as the reference offers. The measured stage times stay exactly as they are.
- **Tier:** Could
- **Size:** S
- **Review:** light
- **Depends on:** C1, A8
- **Files to read first:**
  - `site design/src/hooks/useJobStream.ts` lines 219–234 (anchor `const dwellMs = prefersReducedMotion ? 0 : 280;`)
  - `design/reference/app-v3-source.html` line 1119 (anchor `showMult()`)
  - `site design/src/lib/preferences.ts`
  - `site design/src/pages/SettingsPage.tsx`
- **Files to create or modify:**
  - modify `site design/src/lib/preferences.ts`
  - modify `site design/src/hooks/useJobStream.ts`
  - modify `site design/src/pages/SettingsPage.tsx`

**What to change**
1. **Preference:** in `preferences.ts`, add `showSpeed` with the values `"fast"`, `"normal"` or `"slow"`, default `"normal"`, validated in `load()`.
2. **Dwell time:** `site design/src/hooks/useJobStream.ts` line 222 (anchor `const dwellMs = prefersReducedMotion ? 0 : 280;`). The dwell becomes 280 ms times the speed factor: 0.5 for fast, 1 for normal and 1.8 for slow, the reference's factors.
   - Read the factor with `getPreferences()` at that moment.
   - It stays 0 under reduced motion, and also when the Reduce motion preference is on.
   - Only the pause between displayed events changes. Event order, values and the reported latencies are untouched.
3. **Settings row:** in `SettingsPage.tsx`, add a component `ChoiceRow` next to `OptionRow`, built like it (`site design/src/pages/SettingsPage.tsx` lines 44–73, anchor `const OptionRow: React.FC<OptionRowProps>`) but with one button per choice.
   - Use it in the Ingestion section with `data-testid="setting-show-speed"`, the title "Show speed", the options Fast, Normal and Slow, and the description "How long each stage of the ingestion show stays on screen. The stage times shown are always the measured ones."
   - Task B7 reuses this `ChoiceRow` when it exists.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser: set Slow and upload a sample. The stages advance visibly more slowly than on Fast. The latencies shown equal those in `GET /api/jobs/<job_id>` in both runs.

**Acceptance criteria**
- [ ] Three speeds exist, and an unknown stored value falls back to normal.
- [ ] The dwell is 0 under either reduced-motion signal.
- [ ] The displayed latencies are unchanged by the setting.
- [ ] The build exits 0.
