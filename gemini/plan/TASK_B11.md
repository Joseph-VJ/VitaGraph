<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task B11 — End-of-B gate: strict audit and layout at every width

- **Goal:** Close workstream B. The design audit passes in strict mode, and every route, now including `/graph`, passes the layout check and the accessibility, keyboard-focus and reduced-motion checks.
- **Tier:** Must
- **Size:** S
- **Review:** gate
- **Depends on:** A13, C3, B8, B10
- **Files to read first:**
  - `site design/scripts/audit-design.mjs`
- **Files to create or modify:**
  - modify `site design/package.json`

**What to change**
1. In `site design/package.json`, change the `audit:design` script to `node scripts/audit-design.mjs --strict`. From now on, every reached file must be clean. PENDING has been empty since B8.

**How to verify**
1. `cd "site design"; npm run audit:design`. It must exit 0 and print `(strict)` and `0 error(s), 0 pending`.
2. `cd "site design"; npm run build`. It must exit 0.
3. `$env:PYTHONIOENCODING="utf-8"; python scripts\plan\check_layout.py usr_51f14542d71a`, with no route arguments so that all eight routes are checked. It ends with `RESULT: PASS`.
4. `python scripts\plan\check_a11y.py usr_51f14542d71a`, with no route arguments, so that `/graph` is now included. It ends with `RESULT: PASS`. The script is created in A13.

**Acceptance criteria**
- [ ] The strict audit exits 0.
- [ ] The layout check passes all eight routes at 360, 820 and 1440 px.
- [ ] `check_a11y.py` passes all eight routes: no serious or critical axe violations, a visible focus on every tab stop, and no running animation under reduced motion.
- [ ] The build exits 0.
