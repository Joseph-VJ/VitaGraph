<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task A2 — Shared page components (one component pattern)

- **Goal:** Add one page frame, one state block (loading, empty, error, offline), one status tag, one section head and one persona gate, plus the mobile CSS they rely on.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `site design/src/theme/tokens.css`
  - `site design/src/theme/modernist.css`
  - `site design/src/pages/LibraryPage.tsx` (for the inline patterns used today)
  - `site design/src/index.css` lines 1032–1043 (anchor `.agent-evidence-row:hover`)
- **Files to create or modify:**
  - create `site design/src/components/ui/PageFrame.tsx`
  - create `site design/src/components/ui/PageState.tsx`
  - create `site design/src/components/ui/Tag.tsx`
  - create `site design/src/components/ui/SectionHead.tsx`
  - create `site design/src/components/ui/PersonaState.tsx`
  - create `site design/src/components/ui/index.ts`
  - modify `site design/src/index.css`

**What to change**
1. **Create `PageFrame.tsx`.** It exports a type `PageWidth` (`"wide"`, `"narrow"` or `"full"`) and a component `PageFrame`.
   - **Props:**
     - `label` (string, required): written to `data-screen-label`, the page name that tests and screenshots use;
     - `width` (PageWidth, default `"wide"`);
     - `gap` (CSS length string, default `var(--space-8)`);
     - `testId` (optional, written to `data-testid`);
     - `children`.
   - **Renders** one `div` with class `vg-page` and inline styles: `maxWidth` 1280px for wide, 960px for narrow and `none` for full; vertical flex column; the given `gap`.
   - Gutters and centring come only from the `vg-page` class (step 7).
2. **Create `PageState.tsx`.** It exports a type `PageStateKind` (`"loading"`, `"empty"`, `"error"` or `"offline"`) and a component `PageState`.
   - **Props:**
     - `kind`;
     - `title` (string);
     - optional `detail` (string);
     - optional `action` and optional `secondaryAction`, each an object with a `label` string and an `onClick` function;
     - optional `testId`, which defaults to `page-state-<kind>`.
   - **Rendering:**
     - One block with `data-state` set to the kind.
     - `role="alert"` for error and offline, `role="status"` otherwise; `aria-live="polite"` only for loading.
     - Padding `var(--space-6)`; children in a column with gap `var(--space-3)`, aligned to the start.
     - A 2 px top rule: `--color-divider` for loading, `--color-text` for empty, `--color-accent` for error and offline.
     - Background `--color-accent-100` for error and offline, `--color-surface` otherwise.
     - The title is 1.25rem, weight 800, letter-spacing -0.01em, in `--color-accent-800` for error and offline and `--color-text` otherwise.
     - The detail is 0.9375rem in `--color-neutral-700`, at most 62ch wide, with long words allowed to break.
     - The actions are a wrapping row with gap `var(--space-2)`. The action is a `btn btn-primary` button and the secondary action a `btn btn-secondary` button, both `type="button"`.
3. **Create `Tag.tsx`.** It exports a type `TagTone` with the eight tones `done`, `running`, `waiting`, `failed`, `hot`, `accent`, `neutral` and `uncertain`, and a component `Tag`.
   - **Props:** `tone`, `children`, optional `testId`, optional `title`.
   - **Renders** a `span` with class `tag`, `data-tone` set to the tone and `white-space: nowrap`.
   - **Colours per tone:**
     - `done`: background `--color-text`, text `--color-bg`, weight 800.
     - `running` and `hot`: background `--color-accent`, text `--color-bg`, weight 800.
     - `failed` and `accent`: background `--color-accent-100`, text `--color-accent-800`, weight 800.
     - `waiting` and `neutral`: background `--color-neutral-200`, text `--color-neutral-800`.
     - `uncertain`: background `color-mix(in srgb, var(--ochre) 22%, var(--color-bg))`, text `--ochre-ink`, weight 800. Rule 4 says "Uncertain" is never shown in any other tone.
4. **Create `SectionHead.tsx`.** It exports a component `SectionHead`.
   - **Props:** `title` (string), optional `aside` (any React node), `accent` (boolean, default false), optional `testId`.
   - **Layout:** a wrapping flex row, space-between, centred, gap `var(--space-3)`, with `padding-bottom` `var(--space-2)` and a 2 px bottom rule in `--color-divider`.
   - **Title:** an `h2` at 0.6875rem, weight 800, letter-spacing 0.1em, uppercase. Colour is `--color-accent-700` when `accent` is set and `--color-neutral-700` otherwise.
   - **Aside:** at 0.8125rem in `--color-neutral-700`.
5. **Create `PersonaState.tsx`.** It exports a component `PersonaState` with props `loading` (boolean) and `onRetry` (function). It renders through `PageState`:
   - While `loading` is true: kind loading with the title "Loading your persona".
   - Otherwise: kind offline with the title "No persona available", the detail "The backend did not return a persona. Check that it is running, then try again." and the action "Try again", which calls `onRetry`.
6. **Create `index.ts`.** It re-exports `PageFrame` and the type `PageWidth`, `PageState` and the type `PageStateKind`, `Tag` and the type `TagTone`, `SectionHead`, and `PersonaState`.
7. **Append to the end of `site design/src/index.css`**, after the `.agent-evidence-row:hover` rule at `site design/src/index.css` lines 1041–1043 (anchor `.agent-evidence-row:hover`):
   - Add a comment saying these are the shared page frame and phone rules from plan task A2. Inline styles cannot hold media queries, which is why the gutters live in CSS.
   - Then add these classes:
     - `.vg-page`: border-box, full width, centred with auto side margins, padding `var(--space-8)`.
     - `.vg-pad`: border-box, padding `var(--space-8)`.
     - `.vg-gutter`: left and right padding `var(--space-8)`.
     - `.vg-header`: padding `var(--space-3) var(--space-8)`.
     - `.vg-footer`: padding `0 var(--space-8)`.
     - `.vg-scroll-x`: max-width 100%, horizontal overflow auto.
   - Add one `@media (max-width: 640px)` block that reduces every `var(--space-8)` above to `var(--space-4)` (16 px).

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0. The new components are not used yet, and unused exports are allowed.
2. `Select-String -Path "site design\src\components\ui\*.tsx" -Pattern 'rounded|#[0-9a-fA-F]{6}|Spectral|console\.'` prints nothing.

**Acceptance criteria**
- [ ] The six files exist in `site design/src/components/ui/`, with the exports, props and colours listed above.
- [ ] `index.css` ends with the `.vg-*` classes and the 640 px media block.
- [ ] The build exits 0.
