# VitaGraph UI/UX design notes

Branch: `design/ui-ux-overhaul`. Scope: visual and UX only. No backend, route, endpoint,
SSE, hook-behaviour or data-flow changes. Every `data-testid` is unchanged.

## Design read

A health-record evidence workbench for patients and researchers, in a "steel bench and
paper" language. Dials: ENERGY 1 / RHYTHM 2 / MOTION 1. Direction comes from the README's
"Instrument & Paper" paradigm and the Titanium Lagoon palette in `CLAUDE.md`.

## Decisions and the one-line reason for each

| Decision | Reason |
|---|---|
| Value encodes role: paper `#F3F6F6` (lightest) for reading surfaces, canvas `#DFE3E6` for the bench, steel chrome `#CDD4D9` for machine UI | The product has two voices (Instrument and Paper); lightness now says which one you are looking at. Cards used to be darker than the canvas, so content sank. |
| Text tokens `#28323A` / `#4A5762` / `#566470`; state hues have a text-safe variant | Secondary text measured 4.17:1 and tertiary 3.0:1 on cards, jade text 3.5:1, bronze text 2.0:1. All pairs are now at least 4.5:1 on canvas and paper. |
| Primary action is deep petrol; jade only means verified | One accent per role. Jade on every button made "verified" and "click here" look the same. |
| Spectral for titles and answers, Plex Sans 14/22 for UI, Plex Mono only for machine output (hashes, ids, latencies, JSON) | The repo rule says mono is for machine output. Mono labels and mono stat figures were everywhere. |
| Cards are flat with a hairline border; shadow only on things that float (journey rail, ask bar, menus, toasts, modals) | Elevation should mean "above the page". Shadow on every card meant nothing. |
| Sidebar collapses to a 60px icon rail below 1024px | At 390px the 240px sidebar left a 100px content column. Navigation is unchanged. |
| Active nav item is a paper tab with a petrol edge | The lightest surface is the "you are here" surface. |
| Type classes moved into the `components` layer | They sat outside Tailwind's layers and silently beat utilities such as `text-on-primary`, so primary buttons rendered dark text on petrol. |
| Sentence case everywhere, no trailing arrows on buttons, no em dashes in UI text | Repo voice rules plus antislop R-02 and R-08. Meaningful arrows stay (value before to after, relation direction). |
| Graph labels placed by importance with collision skipping; value chips only for the focused neighbourhood or when zoomed in | 275 nodes drew every label and chip on top of each other. |
| Agent activity pane is chrome, not a dark terminal; reasoning is prose, stage rows are plain text | The pane is a reading surface for what the agent did. Mono is kept for ids, latencies and JSON. |
| Journey dots have a 24px hit area | WCAG 2.5.8; they were 10px. |
| Settings switches are named `role="switch"` controls with a visible off state | They had no accessible name and the off thumb was nearly invisible. |

## Removed, and why

- The handwritten "marginalia" tagline on every page and in the sidebar. Nine different
  slogans that contradicted each other and said nothing about the page.
- Sidebar "Recent sessions / questions / personas": hardcoded demo content, not user data.
- Status strip numbers that were typed in, not measured: documents, chunks, graph nodes,
  CPU, RAM, "graph updated 2 min ago", app and service versions. Latency, online state and
  motion tier are real and stay.
- A constant "Lab report" badge and a persona id repeated on every Library row.
- The pulsing dot inside the "Load demo cohort" button (decorative loop).
- "Encrypted in transit" (not true over local HTTP) and "Max 50 MB" (the backend limit is 25 MB).
- "Parsed by PyPDF/Surya-OCR" on Timeline cards (the pipeline uses PyMuPDF and RapidOCR/Tesseract).

## Verification (measured, not claimed)

- axe-core 4.10 (WCAG 2.0/2.1/2.2 A and AA), all 11 routes, desktop, reduced motion: 0 violations.
- Keyboard: visible focus indicator on every tab stop checked (Upload, Ask, Library, Settings).
- Reduced motion: no infinite animations running on Upload, Ask, Graph, Library.
- Horizontal overflow at 390px and 768px: checked on all 11 routes.
- `npm run build` passes. Backend pytest unchanged and green.

## Open items for the product owner (not changed: they need data wiring or a content decision)

1. **Timeline shows made-up lab values.** `TimelinePage.tsx` hardcodes Hemoglobin 13.8 to 14.1
   ("+0.3 improving"), eGFR 88 to 82, HbA1c 5.9 to 6.2 and Vitamin D 32, with their reference ranges,
   for every persona. In a health product these must come from `/api/reports/{uid}/trends`.
2. **Settings makes privacy claims that are not true for this build.** It says inference is
   "strictly local" and external APIs are "disabled by academic policy", while the app calls an
   external gateway when `allow_api` is on. Bind to `/api/ai/config` or reword.
3. **Datasets and Ontology show typed-in numbers** ("1,024 vectors", "1,536 dim" where the real
   embedding size is 384, "Last verified 2 min ago", relation edge counts).
4. **Dead controls:** Docs and Feedback links point to `#`, the theme toggle changes nothing
   (`data-theme` is never set).
5. **Breadcrumbs hardcode the persona name** ("Arjun R") on Timeline, Compare and Insights.
6. **False "backend offline" flash:** the health probe times out at 2s, which a busy backend can exceed.
7. `/gallery` (component gallery) still shows spec notes with old token values.
