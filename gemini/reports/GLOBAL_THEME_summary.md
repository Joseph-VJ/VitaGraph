# Whole-app Light/Dark verification — 2026-10-13

Status: COMPLETE for the authorized theme story. No commit, merge or push. T4 connection reliability remains outside this change.

## Implementation

Settings → Display → Appearance offers Light/Dark with pressed state and keyboard access. Dark is the default for new or legacy preferences. Head initialization applies data-theme/color-scheme before React; the preference store updates immediately, synchronizes tabs, retains other supported and unknown saved fields, repairs malformed JSON and works in memory when storage is blocked. Safe storage wrappers also prevent persona/motion/bootstrap code from blanking the app in that case.

Global tokens replace the chat-only palette. Shared shell, all 14 pages, overlays, placeholders, status colours, button states and both graph stages follow them. Light keeps Modernist geometry and original neutral colours; Dark uses #201e1d/#2d2b2b/#f3f2f2. Red text and selected foregrounds were adjusted for contrast. Archivo, square corners, layout and effects are retained.

Graph shortcuts update the same preference. Canvas engines receive a palette mutation rather than replacement. Ink currents clears its colour trail cache, retaining particles. The four backgrounds retain their instances, play state, intensity and animation state. Reduced motion and manual T0 paint a static view with the current palette; the OS reduced-motion governor is also respected. Theme changes do not reset the governor.

The shared displayTheme helper creates SVG presentation copies, changing known colours only. Chart requests do not depend on theme, and chart downloads retain original SVGs. Generated report HTML gets one stable adaptive style copy, including charts. Its sandbox stays empty and its existing CSP is retained. Native iframe colour-scheme inheritance switches presentation without replacing the iframe body, scroll or selection. Original HTML/PDF/source images are untouched; Print opens the original PDF. [MDN documents embedded colour-scheme inheritance](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme).

## Command gates

- Full backend suite: **791 passed in 451.95s (0:07:31)** during this theme task. App/test Python SHA256 manifest comparison after implementation: unchanged since the theme baseline. Existing dirty backend changes from earlier stories are preserved.
- Final production build: exit 0, 402 modules, built in 1.16s. Design audit: **106 files, 0 errors, 0 pending**.
- Secret scan: **RESULT: PASS**. No real key printed or manually read/edited.
- git diff --check: **exit 0, clean** (existing LF/CRLF notices only). Generated tsconfig.tsbuildinfo remains unstaged.

## Browser evidence

Chromium, real primary app at 8000/5173:

- **84 cases**: 14 routes × Light/Dark × 1440×900, 820×1100, 400×900. No horizontal overflow, no axe colour-contrast violations, no app page errors in the final matrix. Representative live/empty views, not every possible backend-error state for every route.
- Default Dark; legacy preferences without theme; both switching directions; reload persistence; tab synchronization; blocked storage; malformed JSON recovery; extra legacy field retention. Fast speed, 300 passage size, flow engine, 130 intensity and reduced-motion preference retained.
- All four backgrounds switched while animated with the same instance and live FPS, then all four switched in static T0 with the same instance and correct light/dark palette. OS reduced motion remains T0.
- Knowledge Graph and built Text-to-Graph shortcut follow the global theme; engine identity retained. Text-to-Graph Orbits and lens stay selected. Existing graph camera/selection/state code does not reinitialize on theme.
- Keyboard Enter/Space select themes, with a visible solid focus outline. Conversation menu ArrowDown focuses a menu item; Delete confirmation follows both themes; Escape cancels without deleting any conversation. Offline/no-persona state checked in both themes using controlled request aborts. Interception removed afterwards.
- During a real upload, toggled themes while progress was active: selected file remained, job completed, exactly one report created. During a real model answer, toggled themes while active: draft/conversation/question retained, answer completed without cancellation and returned printed hemoglobin **13.8** with citations. Synthetic temporary persona deleted; baseline store restored.
- Generated chart geometry/labels unchanged. Report saved HTML unchanged, PDF bytes identical across theme switches, sandbox/CSP preserved. Stable adaptive report reader check: same iframe body and scrollTop **400** through Light and Dark. Test uses a native browser context with colorScheme:null; default automation-forced Light emulation is unsuitable for testing embedded native media inheritance.

## Visual review

Viewed the two 14-page contact sheets plus full-size live Agent and native report reader captures. Both themes retain the same layout, flat surfaces, red accent and living grid. Original source media remains original, as requested. No new imagery or content is needed.

Screenshots in gemini/shots: global-{light,dark}-{upload,library,data,agent,graph,timeline,compare,insights,image-to-text,pdf-to-text,text-to-graph,privacy,lab,settings}.png; global-{light,dark}-overview.png; global-dark-live-upload.png; global-dark-live-agent.png; global-{light,dark}-report-preview.png; global-{light,dark}-reader-native.png; global-dark-text-built.png; global-{light,dark}-dialog.png; global-{light,dark}-offline.png; global-{light,dark}-toggle-{1440,820,400}.png. Source-document brightness inside the upload theatre is intentional.

## Limits and scope

Firefox/Safari, screen-reader speech output and every possible error/dialog combination on every route were not exhaustively verified. Axe colour checks cover rendered DOM text, not all canvas pixels. Graph canvas interactions and generated previews were checked separately. The three T4 AI-connection faults remain pending; this theme change cannot establish an issue-free external API connection.
