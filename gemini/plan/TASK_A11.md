<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task A11 — Toast restyled to the Modernist rules

- **Goal:** Restyle toasts to the Modernist design (no rounded corners, no old tokens) and place them above the 40 px status strip so they never cover it. Their behaviour does not change.
- **Tier:** Should
- **Size:** S
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `site design/src/components/gallery/Toast.tsx`
  - `site design/src/components/shell/StatusStrip.tsx` lines 96–102 (anchor `height: 40,`)
- **Files to create or modify:**
  - modify `site design/src/components/gallery/Toast.tsx`

**What to change**
1. **Keep all logic and exports unchanged:** `site design/src/components/gallery/Toast.tsx` lines 7–67 (anchor `export type ToastType = "done" | "failed" | "info";`). That covers the types, the context, `removeToast` with its exit and FLIP behaviour, `addToast` with its five-toast limit and 4-second dwell, and `useToast`.
2. **New colour map:** add a module-level map `RULE` from toast type to a top-rule colour: done `var(--color-text)`, failed `var(--color-accent)`, info `var(--color-neutral-500)`.
3. **Global hook:** `site design/src/components/gallery/Toast.tsx` lines 69–74 (anchor `(window as any).__VG_ADD_TOAST__ = addToast;`). Keep the window hook, but type it instead of using `any`: cast `window` to an object with an optional `__VG_ADD_TOAST__` whose type is `ToastContextValue["addToast"]`, in both the set and the delete.
4. **Container:** `site design/src/components/gallery/Toast.tsx` lines 80–84 (anchor `data-testid="toast-container"`).
   - Classes: `fixed z-50 flex flex-col gap-2 pointer-events-none`. Remove `bottom-6 right-6 max-w-sm`.
   - Inline style:
     - right `var(--space-4)`;
     - bottom `calc(40px + var(--space-4))`, above the status strip;
     - width `min(360px, calc(100vw - 2 * var(--space-4)))`.
   - Add the comment "Floating toasts sit above the 40 px status strip".
5. **Each toast:** `site design/src/components/gallery/Toast.tsx` lines 85–150 (anchor `const borderClass =`). Replace the markup:
   - **Attributes:**
     - `role="alert"` for failed toasts and `role="status"` otherwise;
     - keep `data-testid` as `toast-<id>`;
     - add `data-toast-type`;
     - keep the exit and enter animation classes `m-exit` and `animate-fade-in`.
   - **Box:** a flex row with gap `var(--space-3)` and padding `var(--space-3) var(--space-4)`, background `--color-bg`, a 2 px top rule in the type's `RULE` colour, and `box-shadow: var(--shadow-md)`. Toasts float, so a shadow is allowed. There is no radius and no left border.
   - **Title:** weight 800, 0.875rem, `--color-accent-700` for failed and `--color-text` otherwise, cut with an ellipsis. The timestamp sits on the right at 0.6875rem in `--color-neutral-700` with tabular numbers.
   - **Detail:** 0.8125rem in `--color-neutral-700`, with long words allowed to break.
   - **Dismiss button:** class `btn btn-ghost`, `aria-label="Dismiss notification"`, small padding, the same 14 px cross icon with `aria-hidden="true"`.
   - Delete the three coloured status icons, since the top rule now carries the meaning.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. `Select-String -Path "site design\src\components\gallery\Toast.tsx" -Pattern 'rounded|var\(--ink|var\(--bone|var\(--madder|as any'` prints nothing.
3. Browser: on `/upload`, upload a non-PDF file renamed to `.pdf`. The upload is rejected, and the toast appears above the status strip with a red top rule.

**Acceptance criteria**
- [ ] Toast behaviour is unchanged (same limit, dwell and dismiss).
- [ ] No old tokens and no rounding remain in the file.
- [ ] The toast does not cover the 40 px status strip.
- [ ] The build exits 0.
