# Whole-app theme review — 2026-10-13

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| MEDIUM | Global tokens and sidebar | Chat-only dark; selected sublabel lost contrast when global palette inverted | Global palette and readable inverted foreground | One consistent theme with readable navigation |
| MEDIUM | Storage/bootstrap | Blocked storage could prevent initial rendering; unknown preference fields lost on write | Guarded reads/writes and merged fields | Theme remains usable without browser persistence |
| MEDIUM | Report preview | Changing srcdoc for each theme would reset reading position | Stable adaptive presentation copy; native colour-scheme inheritance | Preserves iframe body, scroll and sandbox |
| MEDIUM | Living background | Palette snapshots/trails retained prior colours; static view needed refresh | Shared live palette, trail refresh, static repaint with existing engine | Preserves animation and reduced-motion behaviour |
| LOW | Buttons/chart text | Some red foreground states had insufficient contrast | Readable state-specific foregrounds and chart text | Maintains red accent and readable labels |

Checks: 84 page/theme/viewport cases, axe contrast, keyboard/menu/dialog/offline interactions, storage and tabs, all four animated/static backgrounds, graph shortcut/lens/layout, real active upload/answer, chart/report export invariants, native report scroll preservation, 791 backend tests, build, design audit, secret scan and diff check. See ../reports/GLOBAL_THEME_summary.md and SESSION_CONTEXT section 44 for exact outputs and limits.

Verdict: **Approve** for this theme story. T4 connection reliability is separate and still pending. No commit/push.
