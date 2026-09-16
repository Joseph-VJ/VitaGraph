# VitaGraph — MOTION & FX Master Prompt (v1.0)
## Game-grade animation layer for the "Instrument & Paper" design system — zero new dependencies, tier-adaptive, reduced-motion safe

**Purpose:** One self-contained file that (a) defines the frozen motion law **MOTION.md** (DESIGN.md §14 addendum), and (b) contains the exact **loop prompt (v3 — MOTION edition)** + story set **MS-01…MS-12** to implement it inside the existing VitaGraph loop (`site design/` React 19 + Vite frontend, backend untouched).
**Built on:** DESIGN.md v2.1 (frozen), AGENTS.md iron laws, GEMINI.md workspace rules, Master Plan §2.4 reality contract, §11/§12 graph & pipeline law, §20.1 mandatory checks — plus fresh 2025/26 research on game feel, compositor performance, View Transitions, CSS `linear()` springs, WCAG motion, and agentic prompt engineering (Part E).
**Release target:** `v1.1.0-motion` on top of tagged `v1.0.0`.

---

## 0. How to use this file (3 steps)

1. **Commit the spec first (Hallmark rule: the spec grows before the UI does).**
   Copy **PART C** verbatim into `site design/MOTION.md`. Add one line to `site design/Qwen_markdown_20260909_yutce0yzs.md` (DESIGN.md) under §8:
   `> §8 is extended and minimally amended by MOTION.md v1.0 (DESIGN §14). Ratified amendments are listed in MOTION.md §M0.`
2. **Install the loop prompt.** Copy **PART D** (the fenced block) into `PROMPT_MOTION.md` at repo root. Merge the MS-01…MS-12 stories from `tasks/motion-prd.json` (delivered alongside this file) into `tasks/prd.json` with `passes:false`.
3. **Run the loop exactly as before** (AutoClaw Goal mode / Antigravity Agent-Manager one task per story / headless Ralph). Same read order: `AGENTS.md → tasks/prd.json → tail progress.txt → MOTION.md (only when touching motion) → DESIGN.md (only when touching UI)`.
   Feed order for a fresh agent: chronicle MD → AGENTS.md → GEMINI.md → **this file** → progress.txt tail.

**What "game-grade" means here — and what it forbids.** Games feel alive for five reasons: (1) every input answers within one frame, (2) motion has physical continuity (springs, momentum, follow-through), (3) sequences are choreographed (anticipation → action → settle), (4) the world has quiet ambient life, (5) success moments are celebrated (particles, glow, sound). VitaGraph adopts all five **translated into instrument grammar**: detents instead of bounce, needle sweeps instead of elastic, evidence-dust instead of confetti, servo-precise ≤240 ms responses, and ambient life that never exceeds a 2 %-of-screen change. A examiner watching must say "this feels engineered," never "this feels like a slot machine."

---

# PART A — Mission & persona brief (for the executing agent)

You are the **motion director and graphics engineer** of a studio famous for making scientific instruments feel alive — the team that would animate a laboratory oscilloscope, a telescope mount, and a surgeon's display, and that has previously shipped game-grade feedback systems (60 fps under fire on integrated GPUs). The client — VitaGraph, a B.Tech final-year evidence-RAG system — has a **frozen visual law** (DESIGN.md v2.1 "Instrument & Paper") and a **reality contract** (Master Plan §2.4): every state the UI shows must come from the real backend. Your job is to add a motion & FX layer so polished that the app feels like a precision instrument with a heartbeat — without adding a single visual token, a single fake state, a single new dependency, or a single dropped frame.

**Design targets (DESIGN.md §1.2 personas), in priority order:**
- **P1 Vijay (researcher/operator):** motion must never slow him down. Every response ≤ 240 ms perceived; ⌘K paths stay instantaneous; ambient motion stays under his attention threshold.
- **P2 Arjun R (data subject):** paper-voice moments (slips dealing in, deltas rolling, timeline spine drawing) must feel calm and physical, like a real notebook — never flashy.
- **P3 Prof. Examiner (viva):** every animation must be *explainable and traceable*: the status strip shows the live motion tier (`motion T3`), the FPS governor can be demoed under 6× CPU throttle, node reveals are tied to real graph-build events, count-ups always land on the exact endpoint value. Motion is evidence of engineering depth, not decoration.
- **P4 QA/adversarial:** failure states stay fully legible with motion off (`prefers-reduced-motion: reduce` → tier T0), no flashing > 2 Hz, no animation that hides an error, no infinite loops that leak memory or battery.

**The one-sentence motion identity:**
> *The instrument moves like a servo — fast, damped, exact. The paper moves like paper — soft, slightly late, settling with a whisper of rotation. Nothing else moves.*

---

# PART B — Hard constraints (non-negotiable, checked at every gate)

**B1. Frozen law stays frozen.** All DESIGN.md tokens (colors, type, radii, borders, elevation, texture, copy) are immutable. MOTION.md *adds* motion tokens and ratifies exactly three amendments (§M0). No new colors, no new fonts, no new radii, no new copy strings except those specified in this document.

**B2. Reality contract extends to motion.**
- No animation may **invent, delay, reorder, or fake a state**. Reveals are gated on real data arrival (fetch resolution) or real SSE events (`/api/jobs/{id}/events`). A chunk row may animate *in* only after the `chunks_selected` event; a stepper node may complete only on its real `done` event.
- Cosmetic pacing of already-true values is allowed and must be labeled in code comments as `presentation pacing` (odometer count-ups, mask reveals of an arrived answer). The final frame must equal the real value exactly (gate 27).
- If a stream errors mid-sequence, the choreography **freezes at the failed stage with the designed error state** (DESIGN §8.2) — never continues, never loops.
- Backend is **untouched**: `pytest tests -q` must stay **43/43 green** at every checkpoint. All motion work lives in `site design/`.

**B3. Zero new npm/pip dependencies (AGENTS.md iron law).** The motion layer is hand-built: a ~600-line engine (single rAF ticker, spring solver, choreography scheduler, FPS governor) + Web Animations API + CSS keyframes + CSS `linear()` spring easings (≈90 % browser support; cubic-bezier fallback emitted automatically) + Canvas 2D inside the existing GraphStage. View Transitions API and scroll-driven animations are used **only behind feature detection** with WAAPI/FLIP/IntersectionObserver fallbacks (Firefox/Safari parity is a gate, not a hope). Optional future upgrade path (`motion` / GSAP) is documented in §M13 but forbidden in this release.

**B4. Performance is a feature.** Hard budgets in §M10 (60 fps at 1280×800 on integrated graphics, ≤4 ms main-thread per frame during animation, 0 layout-thrashing frames, ≤24 promoted layers, ≤8 concurrent `will-change`, ≤5 MB heap growth per 10 min idle, LCP unchanged ±5 %, motion-CLS = 0). A four-tier **quality governor** (T3 showcase → T0 static) auto-degrades with hysteresis and is surfaced honestly in the status strip.

**B5. Accessibility floor.** `prefers-reduced-motion: reduce` ⇒ tier T0 globally (instant state changes + ≤120 ms opacity cross-fades only); WCAG 2.3.3 (animation from interactions can be disabled — the tier override in Settings is that control); 2.3.1 (no flash ≥3 Hz; blink patterns ≤2 Hz); 2.2.2 (every ambient loop >5 s is pausable via tier/settings and stops when off-screen); keyboard/focus behavior from DESIGN §12 unchanged and visible during all motion; `aria-live` trace panel announcements batched, never per-frame.

**B6. Loop discipline unchanged.** One story per turn · no placeholders · no completion claim without fresh command output + browser artifact · never edit backend tests · DESIGN/MOTION tokens frozen once committed · circuit breaker: 3 consecutive verification failures ⇒ BLOCKED entry + `git checkout -- .` + end turn.

---

# PART C — MOTION.md (commit verbatim as `site design/MOTION.md`)

````markdown
# VitaGraph — MOTION.md
## Design law §14: motion, choreography & FX for "Instrument & Paper"
**Version:** 1.0 · **Status:** FROZEN on ratification · **Owner:** Role E (Frontend & UX) with Role D (graph/canvas)
**Applies to:** `site design/` (React 19 + Vite + TS + Tailwind 4). Backend untouched.
**Companion:** DESIGN.md v2.1 (visual law), Master Plan §2.4 (reality contract), §11/§12 (graph & pipeline law).

> **Rule 0 (inherits DESIGN.md Rule 0):** You do not invent durations, easings, spring constants,
> FX, or choreography. Everything you move exists in this document. If a needed motion is not
> here, extend this file first, then build. Run QA gates 17–32 (§M12) after every screen pass.

---

## M0. Ratified amendments to frozen law (exactly three)

| # | Frozen line | Amendment | Reason |
|---|---|---|---|
| A1 | DESIGN §8.1 "no scale, no bounce, no parallax" | Replaced by: "scale only inside the band **0.985–1.02**, never as a hover effect on static cards; no bounce/elastic easing (overshoot ≤2 %, paper voice only); no parallax on data (≤4 px on marginalia sketches only)" | Sub-2 % scale is physically imperceptible as "zoom" but removes the flatness of pure translate; needed for card/slip settles |
| A2 | DESIGN §4.6 "no drop shadows on static surfaces" | Clarified: canvas **glow sprites** (pre-rendered radial gradients behind active nodes) are a data-state ring per §4.6, not a shadow; allowed only on active/hovered graph nodes | Glow already ratified as "1 px ring + 6 px outer ring at 35 %" — sprites are the performant implementation |
| A3 | DESIGN §5.3 status strip middle segments | Adds one segment: `motion T3` (tier chip, mono-sm, dim) between existing telemetry keys | Telemetry honesty: the adaptive-quality system must be visible, per §10 data-binding contract |

Nothing else in DESIGN.md changes. All existing frozen motion stays: hover 120 ms (border/color only) · drawer/accordion 240 ms ease-out · tooltip 120 in/0 out · activation pulse ring 1200 ms once · inactive dim to 40 % · LED breathe 2 s · stepper glow once per event · reduced-motion = durations 0 + static trace table.

---

## M1. Motion principles (the six laws)

1. **Instrument or paper — never both, never neither.** Every motion answers DESIGN §1.1. Instrument motions: servo/detent/needle curves, ≤240 ms, zero overshoot, axis-locked, hairline-precise. Paper motions: 240–480 ms, expo-out settle, ≤2° rotational settle, slight late follow-through. A component contains motions of exactly one voice.
2. **Motion encodes state, like every other visual (DESIGN §1.3.1).** Direction = data flow (photons travel chunk→concept). Speed = system latency (connector fills are capped by, and honest about, real stage duration). Color = the frozen stage map (DESIGN §8.2). Amplitude = importance (2 px impulse for refusal, 8–12 px travel for enters). If a motion does not encode something true, cut it.
3. **One bold moment per screen (DESIGN §1.3.2), preserved.** Home = boot ignition. Upload = SSE-driven stepper. Graph = question activation (pulse + photons + dust). Ask = trace choreography + slip deal. Timeline = scroll-bound spine. Evidence viewer = shared-element zoom + bracket draw. Compare = converging diff. Insights = race-sort bars. Everything else stays at micro-feedback level.
4. **Answer within one frame, settle within 240 ms.** Press feedback starts on the same frame as input (detent press §M5.4). No interaction may feel delayed by choreography; sequences run *after* acknowledgment, never instead of it.
5. **Physics, not keyframes, for anything that can be interrupted.** Springs (§M2.3) for camera, dimming, drag release, FLIP morphs — anything a user can re-trigger mid-flight. WAAPI/CSS keyframes only for fire-and-forget choreography (draws, wipes, staggers).
6. **Fail visible, degrade honest (DESIGN §1.3.5).** The FPS governor (§M4.4) drops tiers in the open; the tier chip shows the result; reduced-motion users get T0 where every state change is still visible (instant + opacity). An animation that would hide an error is a bug.

---

## M2. Motion tokens

### M2.1 Duration scale (add to `theme/tokens.css` as custom properties)
| Token | Value | Use |
|---|---|---|
| `--m-instant` | 80 ms | press ack, LED state flips, focus ring |
| `--m-micro` | 120 ms | **frozen**: hover border/color, tooltip in |
| `--m-quick` | 180 ms | instrument enters, trace row in, underline draws |
| `--m-base` | 240 ms | **frozen**: drawer/accordion; card enters, FLIP morphs, wash sweeps |
| `--m-deliberate` | 360 ms | connector fills (cap), part reveals, checkmark draws |
| `--m-settle` | 480 ms | paper settles, odometer rolls, camera springs |
| `--m-cinematic` | 720 ms | boot leaf draw, sparkline draw, spine segment draw |
| `--m-ambient` | 6000–12000 ms | hull breathe 9000, dust drift 8000, LED breathe 2000 (frozen) |
| `--m-ring` | 1200 ms | **frozen**: activation pulse ring, once |

Rules: no duration outside this scale except the frozen 28 px spacing quirk's siblings — none. Exit durations = 60 % of the matching enter, rounded to the scale. `prefers-reduced-motion` ⇒ all tokens collapse to 0 except `--m-instant` used for opacity cross-fade (≤120 ms, class `.m-fade-only`).

### M2.2 Easing library (named curves — the only curves allowed)
| Name | cubic-bezier | Voice | Use |
|---|---|---|---|
| `servo` | `(0.32, 0, 0.24, 1)` | instrument | enters, connector fills, camera |
| `detent` | `(0.30, 0.80, 0.20, 1)` | instrument | fast-out firm-stop: press releases, chip pops |
| `glide` | `(0.40, 0, 0.20, 1)` | instrument | drawer, page transition, FLIP default |
| `needle` | `(0.70, 0, 0.30, 1)` | instrument | symmetric sweeps: gauges, odometer, spine scrub |
| `paper` | `(0.16, 1, 0.30, 1)` | paper (expo-out) | slips, cards, page sheets, margins settle |
| `ink` | `(0, 0, 0.2, 1)` | paper (decel) | washes, reveals, mask fades |

No `ease`, `ease-in-out`, `linear` (except inside `linear()` springs), `back`, `elastic`, `bounce` anywhere. CSS emits `linear(...)` spring strings (§M2.3) where physics is required; engines that lack `linear()` (feature-detected) receive the nearest curve above.

### M2.3 Spring presets (JS engine + generated `linear()` strings)
Semi-implicit Euler, dt clamped to [1, 34] ms, rest when |v| < 0.4 px/s and |x−target| < 0.2 px.
| Preset | stiffness | damping | mass | ζ (damping ratio) | Voice | Use |
|---|---|---|---|---|---|---|
| `snappy` | 420 | 42 | 1 | 1.02 | instrument | press release, focus, chip pop |
| `weighted` | 170 | 26 | 1 | 1.00 | instrument | FLIP morphs, drawer scrub, dim-to-40 % |
| `camera` | 90 | 20 | 1.2 | 1.03 | instrument | graph pan/zoom to subgraph centroid |
| `paper` | 120 | 21 | 1.4 | 0.94 (overshoot ≤1.8 %) | paper | slip settle, page sheet settle, marginalia sway |

`springToLinear(preset)` samples the ODE every 16 ms, simplifies to ≤28 points (Ramer–Douglas–Peucker), emits `linear(x0 y0, …)` cached per preset. Overshoot >2 % on any preset is a gate-17 failure.

### M2.4 Stagger & travel budgets
- Stagger step: **24 ms** dense data rows (trace lines, table rows, list items) · **40 ms** nav/cards · **60 ms** stat tiles · **90 ms** paper slips.
- Stagger total cap: **240 ms** rows · **480 ms** cards/tiles — beyond the cap, remaining items start together (never unbounded waterfalls).
- Order: reading order or real data order (chronological / rank / pipeline stage). **Never random, never reversed.**
- Travel distances: 4 px (inline chips, underlines) · 8 px (rows, trace lines) · 12 px (cards, slips) · 16 px (drawers, banners). Nothing travels further than 24 px on enter.
- Rotation: paper voice only, ≤2° (matches frozen marginalia −2°), settling to the element's designed rotation (slips: −0.6° rest if part of a stack; single slip: 0°).

---

## M3. Anti-slop motion contract (hard prohibitions — extends DESIGN §2.1)

1. No bounce/elastic/back easing; overshoot ≤2 % and only on `paper` preset.
2. No per-section fade-and-slide-up on scroll. Reveals happen once per data arrival or scroll-into-view (single fire, no replay on re-scroll), except the scroll-*bound* spine (§M7.5) which is progress-driven, not entrance-driven.
3. No parallax on data surfaces; ≤4 px on marginalia sketches only.
4. No screen shake. Impact feedback = **detent impulse**: ≤2 px translate on a critically damped spring, ≤240 ms, on the *affected card only*.
5. No animating layout properties (`width/height/top/left/margin/padding/border-width`). Bars fill via `transform: scaleX()` with `transform-origin`; reflows animate via FLIP; glows via pre-rendered sprite opacity.
6. No `box-shadow`/`filter` transitions on lists or tables; `filter: blur()` never animates (no glassmorphism — frozen).
7. No infinite animation above 1 Hz except the frozen 2 s LED breathe; ambient loops ≤0.15 Hz, T3 only, stopped off-screen (IntersectionObserver) and at T0–T2 per matrix §M11.
8. `will-change` on ≤8 elements at any instant, added on interaction intent (pointerenter/focus), removed on animation end. No permanent promotion except the canvas layer.
9. Particles: ≤40 alive total, alpha ≤0.30, category colors only, T3 only, physics = damped drift (no gravity gimmicks), pooled (zero per-frame allocation).
10. No sound unless the user enables it in Settings (§M9); never the only feedback channel.
11. No typewriter effect on text that has not arrived; no fake typing, no simulated latency, no `setTimeout` that gates a *state* (cosmetic scheduling must route through the engine's tokens and is inspectable in one file).
12. No gradient-text shimmer, no glow loops on static chrome, no "living background" video/canvas behind content. The grain stays static (frozen 3 %); the canvas dot-grid stays static; only the vignette may breathe ±2 % luminance at T3.
13. Concurrent animation budget: ≤3 focal sequences per screen; ≤2 ambient loops; the scheduler (§M4.1) enforces via lanes and cancels-by-supersede (a new trigger on the same element replaces the old animation, never queues).

---

## M4. Engine architecture (zero-dependency, `site design/src/motion/`)

### M4.1 `ticker.ts` — the single heartbeat
One `requestAnimationFrame` loop for the whole app (GraphStage joins it; no second rAF anywhere — gate 29 checks). Fixed-step accumulation (16.67 ms) with max 3 catch-up steps; frame delta clamped ≤50 ms. **Lanes**, run in order each frame:
- **L0 interaction** (springs bound to input: press, drag, camera) — never skipped.
- **L1 focal** (choreographed sequences, event-gated timelines).
- **L2 ambient** (loops) — skipped entirely at T0/T1; frame-skipped to 30 fps at T2; full at T3.
Idle detection: when no lane has work for 500 ms the rAF stops; any trigger restarts it. Battery honesty: zero rAF cycles while idle (gate 23 artifact).

### M4.2 `spring.ts` — solver + `springToLinear()` (§M2.3). Interruptible: `set(target)` mid-flight preserves velocity (physical continuity, principle 4/5).

### M4.3 `sequence.ts` — choreography scheduler
Tracks with absolute/relative offsets in motion tokens; **event gates**: `seq.waitFor(sseEventName | promise)` — a track cannot advance past a gate until the real event/promise resolves. If the bound stream errors, the sequence enters `frozen-failed` state and the error UI (§M7.10) takes over. Sequences are cancel-by-supersede per element.

### M4.4 `quality.ts` — the FPS governor & tier machine
Tiers: **T3 showcase** (full FX) · **T2 balanced** (no particles/dust, no hull-breathe, static vignette, DPR cap 1.5) · **T1 safe** (no ambient loops, no glow sprites — flat rings per frozen §4.6, transitions ≤240 ms, canvas simplified draw) · **T0 static** (reduced-motion or manual: instant state + ≤120 ms `.m-fade-only` cross-fades; canvas redraws on data/interaction only).
Inputs: rolling FPS mean over 2 s windows from the ticker; `navigator.hardwareConcurrency` ≤4 or `deviceMemory` ≤4 ⇒ start at T2; `matchMedia('(prefers-reduced-motion: reduce)')` ⇒ hard-lock T0 (live-listening, no reload needed); `navigator.connection?.saveData` ⇒ start ≤T2.
Hysteresis: 3 consecutive windows <50 fps ⇒ one tier down; 10 s >58 fps ⇒ one tier up; ≥30 s between any two changes; T0 never left automatically. Manual override (Settings ▸ Motion: `auto / T3 / T2 / T1 / T0`, persisted `localStorage`, announced in status strip chip `motion T2 · manual`). Tier changes emit a `history_events`-style console telemetry line only (backend untouched).

### M4.5 `features.ts` — capability detection (once, cached)
`viewTransitions`: `'startViewTransition' in document` · `scrollTimeline`: `CSS.supports('animation-timeline','view()')` · `linearEasing`: `CSS.supports('animation-timing-function','linear(0,1)')` · `offscreen`: `typeof OffscreenCanvas !== 'undefined'`. Every FX that needs one ships the fallback in the same file (`flip.ts` for shared elements, IO+WAAPI scrub for scroll-bound, curve table for `linear()`).

### M4.6 `flip.ts` — First-Last-Invert-Play utility
`flip(el, mutate, {spring:'weighted', cap:240})`: measure → mutate → invert via transform → play on the ticker. Used for: input→question-card morph, slip→evidence-sheet morph, insights bar race-sort, list reorders, delta chip position changes. Never reads layout mid-animation (single forced reflow at measure, gate 19).

### M4.7 `fx/` — reusable primitives (each ≤120 lines, gallery-specimen'd)
`Odometer` (digit-roll, tabular-nums, needle curve, exact-end assert) · `DrawPath` (stroke-dashoffset for SVG checks/leaf/spine/brackets) · `PulseRing` (frozen 1200 ms once, canvas) · `Photon` (canvas bezier traveler, §M8) · `DustField` (pooled canvas particles, §M8) · `Scanline` (single-pass ochre sweep for OCR rows) · `WashSweep` (overlay div, `scaleX` 0→1→0 at 8 % alpha, refusal/errors) · `DetentPress` (snappy spring, −1 px press / ±2 px impulse) · `UnderlineDraw` (evidence terms, `scaleX` origin-left).

---

## M5. FX grammar (the shared vocabulary)

### M5.1 Enter / exit (instrument voice, default for all data surfaces)
Enter: opacity 0→1 + translateY 8→0 px, `--m-quick` `servo`, stagger §M2.4.
Enter-card (paper-adjacent panels): + scale 0.985→1, `--m-base` `paper`.
Exit: opacity 1→0 + translateY 0→−4 px, 60 % duration, `ink`. Exits never block inputs (pointer-events off at exit start).

### M5.2 Morph (shared element)
FLIP `weighted` spring capped at `--m-base`; during morph the source hides (`visibility`), target shows; reduced-motion ⇒ source hides, target appears with `.m-fade-only`.

### M5.3 Draw (paths & fills)
SVG: `stroke-dashoffset` path-length→0, `--m-deliberate` `servo` (checks, leaf, brackets) or `--m-cinematic` `needle` (sparkline, spine). Bars/connectors: `transform: scaleX(0→1)` origin-left, duration = min(real stage latency, `--m-deliberate`); if the real stage outlasts the fill, a 4 px `verdigris` **work-dot** travels the connector (loop ≤1 Hz) until the real completion event — honest "still working," never a fake finish.

### M5.4 Press & impulse (micro-feedback, everything interactive)
Press: `snappy` spring to scale 0.985 / translateY 1 px on pointerdown; release returns with detent. Impulse (refusal, quarantine, failure): translateX ±2 px critically damped, 2 cycles, `--m-base`, on the affected card only + `WashSweep` in the state's color.

### M5.5 Count-up (odometer)
Triggers: (a) first real value arrival per screen visit, (b) value change (old→new). `--m-settle` `needle`; digits roll, tabular-nums; ends **exactly** on the endpoint (assert in dev). Reduced-motion/T0: instant set. Comment tag: `presentation pacing of a real value`.

### M5.6 Reveal-mask (arrived prose)
Answer parts & summary text: `clip-path: inset(0 0 100% 0)` → `inset(0)`, `--m-deliberate` `ink`, per part, gated on render of real content. Never applied to streaming text char-by-char.

---

## M6. Global sequences

### M6.1 Boot ignition (once per session — `sessionStorage.vg_booted`; skipped on any route deep-link with query state; **any input skips instantly to final state**)
| t (ms) | Element | Motion | Token |
|---|---|---|---|
| 0 | grain + vignette | opacity 0→1 | `--m-base` `ink` |
| 120 | status-strip LED | ignite (scale .6→1 + opacity) + strip segments fade L→R 40 ms stagger | `--m-quick` `detent` |
| 200 | sidebar brand leaf | `DrawPath` stroke | `--m-cinematic` `servo` |
| 260 | nav items ×10 | enter §M5.1, 40 ms stagger (cap 480) | `--m-quick` `servo` |
| 320 | header search + user chip | enter | `--m-quick` `servo` |
| 400 | screen content | its own data-gated sequence (§M7.x) | — |
Total ≤1.6 s. If backend is down at boot: sequence completes, then banner drop (§M7.10) — failure is never hidden by choreography. T0/T1: skip entirely (final state immediately).

### M6.2 Route transitions
`viewTransitions` supported ⇒ `document.startViewTransition` with 180 ms cross-document-style fade + 8 px rise on the outgoing/incoming screen pair (default pseudo-element styling overridden to tokens; **no** circular reveals, no wipes, no shared-background morphs). Fallback ⇒ incoming screen only: enter §M5.1 at `--m-quick` (outgoing unmounts instantly — SPAs must not double-paint). Sidebar active-rule (`2 px verdigris`) travels between items via FLIP (`weighted`) — the one shared element across routes. T0: instant swap.

---

## M7. Per-screen choreography (trigger → choreography → event dependency → fallback)

### M7.1 Home
- **Stat tiles:** on `/api/reports`, `/api/graph`, questions-count resolution — tiles enter 60 ms stagger (cap 480), values `Odometer` (M5.5). Refusals tile counts in `madder` — no celebration motion on refusals (it is not a success).
- **Sparkline:** `DrawPath` `--m-cinematic` `needle` on first data; new sample point appends with a 1.5 px verdigris dot fade (120 ms). p50/p95 footnote fades at draw end.
- **Activity feed:** new rows from `/api/timeline` poll/SSE: row enter §M5.1 + existing rows FLIP down (`weighted`). Left-rule color = frozen class map. Max 1 animated insert per tick (batch by supersede).
- **System health rail:** rows enter 24 ms stagger; each LED ignites 120 ms before its latency value odometers (instrument powers up in order: FastAPI → Chroma → SQLite → SSE). LLM row: ochre `disabled by policy` — static, never pulses.
- Bold moment: **boot ignition** (M6.1) landing into this screen.

### M7.2 Upload & Ingest
- **Drag lifecycle:** `dragenter` on window ⇒ dropzone border → verdigris + hand-drawn page SVG lifts −4 px (`paper` spring) + footnote fades to "Release to ingest." During drag: dashed border `stroke-dashoffset` march at 12 px/s (only while a real drag is active — a state, not a loop). `dragleave`/drop ⇒ settle back.
- **Drop:** file chip lands (scale .96→1 `detent`, `--m-instant`), real upload begins; progress = real bytes only.
- **Stepper (SSE-gated — the screen's bold moment):** on each real event (`received → extracting → indexing → graph → done`): connector fill M5.3 (honest work-dot if stage outlasts cap) → node ring pulse **once** (frozen 6 px glow, `--m-ring` scaled to 400 ms for stepper per DESIGN §7.12 "once per event, not looping") → checkmark `DrawPath` 200 ms `servo` → caption value odometer (e.g. `412 ms`, `24 chunks`) → card `DetentPress` impulse −1 px. No event, no motion — ever.
- **Page quality table:** rows enter 24 ms stagger on `GET /api/reports/{id}/pages` resolution; `ocr`-method rows get one `Scanline` pass (ochre, 600 ms, T3 only); quality bars `scaleX` fill `--m-deliberate` `servo`.
- **File manifest:** SHA-256 value reveals with a 4 px underline draw; copy success = icon swaps to check with `DrawPath` + `detent` (no toast).
- **Quarantine:** row enters with madder 2 px rule `scaleX` wipe + reason fade; `Retry` press = detent; repeated failure = impulse (M5.4) — max 2 per session on the same row (no nag loops).

### M7.3 Knowledge Graph screen (canvas detail in §M8)
- **Stats row** (nodes/edges/communities/modularity): odometers on `GET /api/graph/{uid}` resolution, 60 ms stagger.
- **Legend chips:** enter 24 ms stagger; hovered chip emphasizes matching nodes on canvas (alpha 1 vs 0.55 others, 120 ms) — a real filter preview, not decoration.
- **Ask bar send:** see M7.4 (shared choreography).
- **Thinking-details rows** under canvas: trace choreography M7.4.
- **Document panel:** tab switch = underline FLIP + content `.m-fade-only`; related-insight rows enter 24 ms stagger; "View all related nodes" = camera spring to subgraph (§M8.4).

### M7.4 Ask (the single orchestrated moment — DESIGN §8.2, extended)
| Real event | Choreography (all `--m-quick` unless noted) |
|---|---|
| Send (local) | input dims; question text **FLIP-morphs** into QuestionCard (M5.2); rewritten-query block reveals via mask M5.6; input resets |
| stream open | ThinkingDetailsPanel drawer: 240 ms `glide` (frozen); "live" LED ignites |
| `question_interpreted` | trace row 01 enter (8 px rise) + index odometer + bracket tag verdigris flash (opacity 1→.6→1, 240 ms) |
| `retrieval` / `chunks_selected` | row 02 enter; chunk cards in drawer deal in 24 ms stagger; similarity bars `scaleX` fill; **canvas: dim-to-40 % spring + pulse ring (frozen 1200 ms) + photons chunk→node (§M8.3)** |
| `reranking` | row 03 enter, lilac flash; rank chips FLIP-reorder (`weighted`) |
| `graph` | row 04 enter, ochre flash; graph-context chips pop (`detent`); "Show subgraph" ⇒ camera spring |
| `generation` | row 05 enter, madder flash; latency chip odometer |
| `citation` | row 06 enter, cornflower flash; answer-block underlined evidence terms `UnderlineDraw` 40 ms stagger |
| `safety` | safety badge pop (`detent`); if refused ⇒ RefusalCard impulse + madder `WashSweep` (M5.4) |
| `done` / `response_ready` | answer parts reveal-mask per part (M5.6, 90 ms stagger); **paper slips deal in**: from stack origin, translateY 12→0 + rotate −2°→rest, `paper` spring, 90 ms stagger, cap 4 animated (rest appear); fingerprint row fades last; trace status badge → `Completed in 4.8 s` (real) |
| stream error | sequence freezes at last completed row (frozen §8.2); failed row gets madder rule + static error text; banner if backend down |
- Follow-up input focus: ring `snappy` scale-in 80 ms. T0: everything instant; trace renders as full static table (frozen rule).

### M7.5 Patient Timeline
- **Spine:** scroll-**bound** (progress-driven, not entrance): `scrollTimeline` supported ⇒ `animation-timeline: view()` on spine segments, verdigris `scaleY` tracks scroll progress of the timeline container, `needle` feel via linear keyframes. Fallback ⇒ passive scroll listener + rAF-batched `scaleY` (same visual). T0: spine fully drawn, static.
- **Report blocks:** single-fire enter on 10 % visibility (never replays): card enter §M5.1; hash/chunk badges fade 120 ms after; "View report" arrow-glyph button = detent press only.
- **Observation rows & delta chips:** rows 24 ms stagger within block; chips pop (`detent`) + value odometer old→new (real deltas only); `new result` chip cornflower single flash (240 ms); dashed missing row: dash pattern `stroke-dashoffset` draws once on visibility.
- **New report insertion (no reload, US-09):** block enters at spine position, existing blocks FLIP down (`weighted`), spine segment draws to the new block (M5.3) — all gated on the real upload `done` event.
- **Delete persona cascade:** confirm dialog enter (card §M5.1); on confirm: rows collapse in dependency order (vectors → files → rows, 120 ms stagger, height via FLIP not `height` animation), then persona card `.m-fade-only` out. Destructive = **anticipation**: confirm button holds 400 ms armed state (madder border brightens) before accepting click — deliberate friction, no motion elsewhere.

### M7.6 Evidence Span Viewer
- **Open:** shared-element morph from the clicked PaperSlip/drawer chunk card to the PDF sheet (View Transitions `view-transition-name: ev-{chunkId}` when supported, else FLIP M4.6). Sheet settles with `paper` spring (rotate ≤0.4°→0).
- **Bounding box:** after sheet settle (event, +120 ms): 4 corner brackets `DrawPath` clockwise 60 ms stagger (verdigris, 280 ms each) → interior wash fades to verdigris 10 % and **holds** (it marks provenance — a state, not an effect). `char_start–char_end` values odometer `--m-quick`.
- **Close:** reverse morph 60 % duration; bracket strokes retract only at T3 (else instant).

### M7.7 Compare Reports
- **Selectors:** report chips FLIP-swap on change (`weighted`).
- **Diff table:** rows enter from **both sides to center** (baseline cols translateX −8→0, follow-up cols +8→0, 24 ms stagger, cap 240 — the convergence is the screen's identity) once data resolves; delta chips pop + arrow glyph nudges 2 px in trend direction once (improving ↑ verdigris, declining ↓ ochre/madder per frozen map).
- **Summary strip:** counts odometer; segment widths `scaleX` to real proportions `--m-deliberate` `servo`.

### M7.8 Insights
- **Modularity gauge:** ring `DrawPath` to real Q (0→Q sweep, `--m-cinematic` `needle`) + Q value odometer in sync (same curve).
- **Centrality hub ranking (race-sort):** bars enter at rank positions; when data refresh reorders ranks, rows **FLIP-reorder** (`weighted`, 24 ms stagger by distance moved) — the race-sort is the bold moment; bar lengths `scaleX` `--m-settle`.
- **Predicate frequencies:** donut/segments sweep clockwise from 12 o'clock in real proportion order, 60 ms stagger; percentages odometer.
- **Causality footnote:** fades in last, `.m-fade-only` 240 ms — it must never be outranked by decoration (frozen copy, verbatim).

### M7.9 Library / Datasets / Ontology / Notebooks / Settings (secondary screens)
- Library rows: 24 ms stagger enter on list resolution; SHA copy = check `DrawPath` (M7.2 pattern); row hover stays frozen 120 ms border/color.
- "Not in first release" empty states (DESIGN §7.24): sketch `DrawPath` once on mount (`--m-cinematic`), quote text `.m-fade-only`; **no loops** — ghosts stay dignified.
- Settings ▸ **Motion section (new UI, tokens only):** tier override select (`auto/T3/T2/T1/T0`) + optional sound toggle (§M9) + "replay boot sequence" ghost button (clears `sessionStorage.vg_booted`, re-runs M6.1 once).

### M7.10 Failure & honest states (viva-critical)
- **Backend-down banner:** drops from top edge (translateY −100 %→0, `--m-base` `servo`), static 45° madder hatch (CSS `repeating-linear-gradient`, frozen colors, **never animated**); fail-closed label verbatim.
- **LED fail pattern:** 2 blinks (120 ms on, 120 ms off) + 960 ms pause = 1.2 s cycle ≤2 Hz (WCAG 2.3.1), T1+; T0 = static madder.
- **Error cards (Chroma fail, stream error):** 2 px madder rule `scaleX` wipe in + `WashSweep` 8 % once + `DetentPress` impulse once. Retry = detent. No looping error animations.
- **REPLAY MODE badge:** pops (`detent`) when replay active; static while on — labeled, never disguised as live (frozen §2.4).
- **allow_api=false chip:** static ochre; never pulses (absence of a service is not an event).

---

## M8. Canvas GraphStage FX (the instrument's heart — all inside existing rAF, joined to ticker §M4.1)

### M8.1 Render budgets & caches
DPR cap: 2 at T3, 1.5 at T2, 1 at T1/T0. **Glow sprites:** one pre-rendered radial-gradient sprite per category color (5 total, 64×64 offscreen) — `drawImage` replaces per-frame gradient creation (frozen §4.6 ring look, A2 amendment). Node/label culling outside viewport +24 px margin. Zero allocations in the draw loop (typed arrays / pooled objects). Frozen cap ≤120 visible nodes stays; ≤200 edges.

### M8.2 Reveal choreography (event-ordered, plan §11 "one-by-one graph animation")
On first graph load or `graph` SSE stage: nodes appear in **ontology order** — Report → Category → Test → Measurement → Chunk — 24 ms stagger (cap 480 ms total; beyond cap, batch by type), each: scale .6→1 + alpha 0→1 (`snappy` spring); edges draw after both endpoints exist: bezier dash-progression 240 ms `servo`. The order comes from the **real node records** (type field), queued by the engine — never `Math.random()`, never timers simulating extraction. Re-fetch with unchanged data ⇒ no re-reveal (diff by node id set).

### M8.3 Question activation (frozen end-states, physical paths)
On `chunks_selected`/subgraph response: (1) inactive nodes/edges dim to exactly 40 % alpha via `weighted` spring (frozen end-state `ctx.globalAlpha = 0.40`, now arrived physically over 240 ms); (2) active nodes pulse **once** — frozen 1200 ms ring; (3) **photons** (T3): ≤24 pooled dots travel the beziers from evidence-chunk nodes to active concept nodes, category-colored, alpha ≤0.5, speed ∝ 1/real retrieval latency (faster system = faster light — telemetry as aesthetics), vanish on arrival with a 120 ms alpha fade; (4) **evidence dust** (T3): ≤40 particles, spawned at activated nodes, damped outward drift ≤12 px, alpha ≤0.25, lifetime ≤1.6 s, pooled. Camera (§M8.4) eases to fit the activated subgraph unless the user has panned within the last 4 s (user intent wins).

### M8.4 Camera
Spring-driven (`camera` preset) pan/zoom: fit-subgraph on activation, fit-all on "Reset view," focus-node on node click (node at 38 % viewport height). User drag/wheel interrupts and captures the camera (velocity hand-off — momentum preserved on release, damped). Zoom limits frozen by existing stage; no rotation, no 3D.

### M8.5 Hover & selection (P1 speed)
Hover node (≤1 frame latency, hit-test on existing spatial grid): scale 1→1.06 (120 ms), glow sprite alpha 0→0.35, label alpha →1, **incident edges** alpha 0.45→0.85 and non-incident dim to 0.30 (relationship emphasis — real graph data), neighbor labels alpha →0.8. All spring-interpolated, cancelled-on-leave. Click: node card pops (scale .97→1 `snappy`) anchored to node screen position; card enter 180 ms; "View source" triggers evidence viewer morph (M7.6).

### M8.6 Ambient life (T3 only, ≤2 % screen change, off-screen paused)
Community hulls: dashed outline opacity .05→.08 sine, 9 s, per-hull phase offset by hull index/7 (never synchronized — organic but deterministic). Vignette luminance breathe ±2 %, 12 s. Dust motes: ≤12, drifting ≤3 px/s inside canvas bounds, alpha ≤0.12. At T2: hulls static at .06; T1/T0: none.

### M8.7 Measurement chips & flag tags
Value chips (ochre mono + flag) attach to measurement nodes with a 12 px hairline that `DrawPath`s on node reveal; HIGH flag tags get a **single** 240 ms madder wash on first reveal (state emphasis, once — never looping).

---

## M9. Optional audio detents (MS-12, off by default, Settings toggle persisted)
WebAudio-synthesized, zero assets: `detent` = 1200 Hz triangle, 15 ms exponential decay, gain 0.03 (stepper complete, chip pop) · `chime` = 660→990 Hz sine pair, 120 ms, gain 0.04 (answer done) · `thud` = 220 Hz sine, 80 ms, gain 0.03 (refusal/quarantine). Never during boot, never on ambient events, muted when tab hidden, hard-disabled at T0. Audio is **never** the only channel for a state (gate 31).

---

## M10. Performance budgets (measured, artifacted — gate 23/29)

| Budget | Value | Method |
|---|---|---|
| Sustained frame rate | 60 fps @1280×800, integrated GPU class (Iris Xe / Vega 7), graph at 120 nodes | DevTools Performance trace, 10 s window |
| Long frames during Ask activation + graph reveal | 0 frames >33 ms | trace artifact `motion-ask-trace.json` |
| Main-thread JS per frame | ≤4 ms animating · ≤1.5 ms ambient T3 · 0 ms idle (ticker stopped) | trace + ticker self-measure (dev overlay `?motion=fps`) |
| Forced reflows per interaction | ≤1 (FLIP measure) | trace "Layout" events |
| Promoted layers / will-change | ≤24 / ≤8 concurrent | Layers panel screenshot |
| Canvas draw call budget | ≤120 nodes + ≤200 edges + ≤40 particles + ≤24 photons @60 fps | benchmark story MS-05 |
| Heap | ≤5 MB growth per 10 min idle T3; zero rAF/listener leaks on route churn ×20 | Memory snapshot diff |
| LCP / CLS / TBT | LCP within ±5 % of v1.0.0 · CLS +0.00 from motion · TBT +≤30 ms | Lighthouse before/after artifacts |
| Boot sequence | ≤1.6 s total, first input skips to final state | screen recording artifact |
| Governor response | tier-down ≤6 s after sustained <50 fps; no oscillation >1 tier/30 s | 6× CPU throttle recording |

---

## M11. Accessibility floor & reduced-motion matrix

WCAG mapping: 2.3.3 (tier override = the disable control; T0 = disabled) · 2.3.1 (no flash ≥3 Hz; blink ≤2 Hz) · 2.2.2 (ambient loops pause off-screen + stop at T0–T2 + Settings override) · 1.4.11 (focus ring, glyphs, brackets ≥3:1 unchanged) · 2.5.2 (press feedback on pointer-up, cancelable on pointer-leave).
**What survives at T0** (state must stay perceivable — reduced ≠ removed): instant end-states everywhere; `.m-fade-only` 120 ms opacity for entered content; static drawn spines/brackets/checks; LED static colors; trace renders as full table (frozen); odometers set instantly. Keyboard: focus never trapped mid-animation; `Esc` closes drawers immediately (cancels running exit); `aria-live=polite` trace announcements batched per event (already real SSE events — no change). Screen-reader order untouched by FLIP (visual-only transforms).

---

## M12. QA gates 17–32 (run with DESIGN §11's 1–16 before every commit)

17 No forbidden easing: grep for `bounce|elastic|back\(|overshoot>2%` ⇒ zero hits; spring ζ table matches §M2.3.
18 Event-gating audit: every reveal traces to a fetch/SSE gate in `sequence.ts` usage; zero `setTimeout` gating a *state*; cosmetic timers only via engine tokens.
19 Compositor-only: no transitions/animations on layout properties in any `.tsx/.css`; FLIP performs ≤1 forced reflow per interaction.
20 `will-change` inventory ≤8 concurrent, removed on animationend (code review + Layers panel).
21 Reduced-motion matrix: full screenshot set at `prefers-reduced-motion: reduce` for all 9 screens + refusal + error states; every state change still visible.
22 Tier-degradation proof: recording at T3 and at T1 (6× CPU throttle) of the same Ask flow; governor chip visible changing.
23 Trace artifacts committed: `design-board/motion/ask-trace.json`, `graph-trace.json`, idle-rAF-zero proof.
24 Flash audit: blink/pattern frequencies ≤2 Hz measured from keyframes.
25 Stagger caps: totals ≤240 ms rows / ≤480 ms cards (computed from token usage).
26 Motion-CLS: Lighthouse CLS delta 0.00 vs v1.0.0.
27 Odometer exactness: dev assert end value === API value; test hook `data-odo-final`.
28 Particle/photon budgets: runtime asserts ≤40/≤24, T3-gated constants.
29 Single-ticker proof: grep `requestAnimationFrame` ⇒ exactly one occurrence (ticker.ts) + feature-detected fallbacks documented; canvas 120-node benchmark ≥58 fps.
30 Boot: once per session, ≤1.6 s, skippable by first input, skipped at T0/T1.
31 No audio-only or motion-only state channel; aria-live batching verified with screen reader or axe.
32 Legacy law intact: DESIGN gates 1–16 pass · `pytest tests -q` 43/43 · `npm run build` exit 0 · frozen motions unchanged (hover 120, drawer 240, ring 1200, dim 40 %, LED 2 s).

---

## M13. Handoff workflow & future path
1 Build engine + tokens (MS-01) and gallery motion specimens before any screen pass (DESIGN §13 pattern). 2 Each screen pass = one story, ends with gates 17–32 subset + screenshots/recordings in `design-board/motion/`. 3 Extend MOTION.md first for anything new. 4 Optional future (documented, **not** this release): `motion` (prev. Framer Motion, ~18 kB) or GSAP (free since 2025) replacing `sequence.ts`/springs; WebGL/`regl` bloom pass for T3 graph; WebGPU compute layout — each requires a dependency-register amendment + supervisor note per plan §3.7.
````

---

# PART D — The loop prompt (copy into `PROMPT_MOTION.md` and run)

```text
MISSION: Add the game-grade motion & FX layer to VitaGraph's shipping frontend (`site design/`),
story-by-story, until every MS story in tasks/prd.json has passes:true.
Model routing: thinking_level MEDIUM for all stories; HIGH for MS-01 (engine), MS-05 + MS-06 (canvas).

LAW: MOTION.md (site design/MOTION.md) is frozen motion law; DESIGN.md v2.1 stays frozen except the
three ratified amendments in MOTION.md §M0. Reality contract (plan §2.4) binds motion: reveals are
gated on real fetch/SSE events; cosmetic pacing of already-real values must end on the exact value
and be commented `presentation pacing`. Backend untouched: pytest stays 43/43. Zero new npm/pip
dependencies. No fake timers, no invented states, no looping error animations.

EXECUTE THIS LOOP, ONE STORY PER TURN:
1. ORIENT: read AGENTS.md, tasks/prd.json, tail progress.txt, git log --oneline -5.
   Select the highest-priority MS story with passes:false. Never two.
2. SEARCH before code: rg for existing implementations (GraphStage rAF, tokens.css, existing
   transitions); reuse the motion engine; assume nothing is missing.
3. IMPLEMENT fully per MOTION.md sections named in the story's `spec` field. No placeholders.
   All motion goes through src/motion/* (single ticker; no rogue requestAnimationFrame;
   no transitions on layout properties; will-change ≤8 concurrent).
4. VERIFY (circuit breaker, 3 strikes => BLOCKED + git checkout -- . + end turn):
   a) npm run build exit 0   b) pytest tests -q 43/43 (unchanged backend)
   c) browser artifact of the touched screen: recording or screenshot pair (motion on / T0),
      saved to design-board/motion/ms-XX-*.{png,webm,json}
   d) story-specific checks from its `acceptance` field (fps trace, tier chip, stagger caps…)
   e) MOTION.md gates from its `gates` field, plus DESIGN gates 1-16 spot-check.
5. CHECKPOINT when green: git add -A && git commit -m "MS-xx: <title>"; set passes:true in
   prd.json; append progress.txt entry with command tails + artifact filenames + learnings.
6. REPORT: bullets only — changed files, build tail, pytest tail, artifacts, gate results,
   next story id. Never paste whole files.
7. CONTEXT HYGIENE: re-read only files the story touches; state lives in prd.json/progress.txt/git.
8. QUOTA: cost warning or turn end => write "RESUME: MS-xx step n" to progress.txt and stop.
STOP CONDITION: all MS passes:true AND gates 17-32 green AND artifacts committed AND
git tag v1.1.0-motion created => output exactly: <promise>MOTION-COMPLETE</promise>
```

## Story set (merge into `tasks/prd.json`; also delivered as `tasks/motion-prd.json`)

| ID | Title | Spec (MOTION.md) | Key acceptance | Gates | Artifacts |
|---|---|---|---|---|---|
| **MS-01** | Motion foundation: tokens, engine, governor | §M2, §M4 | `src/motion/{ticker,spring,sequence,quality,features,flip}.ts` live; `--m-*` + easings in tokens.css; `springToLinear()` emits cached `linear()` strings; tier chip `motion T3` in StatusStrip (A3); Settings override persisted; reduced-motion hard-locks T0 live; idle ⇒ zero rAF (proof) | 17,19,20,29 | tier-chip png, idle-rAF trace |
| **MS-02** | Global grammar: enter/exit/FLIP, route transitions, boot ignition, detent press | §M5.1–5.4, §M6 | Route change: ViewTransition path + fallback path both verified (feature-flag off test); sidebar active-rule FLIPs; boot ≤1.6 s once/session, skippable by first input, skipped at T0/T1; every button/input has press micro-feedback same-frame | 18,24,30,32 | boot.webm, skip-proof, route pair png |
| **MS-03** | Home motion pass | §M7.1 | Tiles odometer only after real fetch; sparkline draws once; activity insert FLIPs; health LEDs ignite in order; refusals tile has no celebration motion | 21,25,27 | home T3/T0 png pair, odometer assert |
| **MS-04** | Upload motion pass (SSE-gated stepper) | §M7.2 | Drag lifecycle states real-only; stepper advances **only** on SSE events; work-dot when stage > cap; checkmark draws; OCR scanline once (T3); quarantine impulse ≤2/session; copy = check draw, no toast | 18,21,24 | stepper.webm (live SSE), quarantine png |
| **MS-05** | GraphStage engine pass | §M8.1, M8.4, M8.5 | Glow sprite cache (5 sprites, no per-frame gradients); DPR caps per tier; hover ≤1-frame response w/ incident-edge emphasis; camera springs w/ user-interrupt + momentum hand-off; zero alloc in draw loop; single ticker (GraphStage rAF removed) | 19,28,29 | 120-node benchmark json, hover.webm |
| **MS-06** | Graph reveal & activation FX | §M8.2, M8.3, M8.6, M8.7 | Ontology-ordered reveal from real node records (Report→Category→Test→Measurement→Chunk), 24 ms stagger cap 480; edges draw after endpoints; dim-to-40 % spring lands exactly on 0.40; frozen 1200 ms pulse kept; photons ≤24 speed ∝ 1/latency; dust ≤40 pooled T3-only; hull breathe ≤2 % screen change, paused off-screen; no re-reveal on unchanged refetch | 18,21,22,28 | activation.webm, dim-0.40 assert, T1 throttle.webm |
| **MS-07** | Ask choreography (the orchestrated moment) | §M7.4 | Every trace row lands on its real SSE event; FLIP input→question card; rank chips FLIP-reorder; underlines draw at citation; answer mask-reveal per part; slips deal ≤4 animated; refusal impulse + wash once; stream error freezes at failed row with error state | 18,21,23,27 | ask-trace.json, refusal.webm, error-freeze png |
| **MS-08** | Timeline + Evidence viewer | §M7.5, §M7.6 | Spine scroll-bound (animation-timeline + IO/rAF fallback verified in Firefox); single-fire block enters; new-report insertion FLIP + spine draw on real done event; delete-cascade collapse order + 400 ms armed confirm; evidence viewer shared-element (VT + FLIP paths), brackets draw clockwise, wash holds, offsets odometer exact | 21,25,26,27 | spine-firefox.webm, viewer morph pair png |
| **MS-09** | Compare + Insights + Library + empty states | §M7.7–M7.9 | Converging diff rows; summary segments scaleX to real proportions; modularity ring sweep synced to Q odometer; centrality race-sort via FLIP on reorder; predicate sweep clockwise; footnote last; empty-state sketch draws once, no loops; Settings ▸ Motion section live | 21,25,27,32 | race-sort.webm, insights T0 png |
| **MS-10** | Failure & honest states | §M7.10 | Banner drop + static hatch; LED blink ≤2 Hz measured; error card single impulse+wash; REPLAY badge static-on; allow_api chip never pulses; all states legible at T0 (matrix screenshots) | 21,24 | blink-hz calc, failure matrix pngs |
| **MS-11** | Performance, QA audit & viva material | §M10–M12 | All budgets met with artifacts (traces, Lighthouse diff, memory diff, governor throttle recording); gates 17–32 all green; MOTION.md + demo-script motion appendix committed (talking points: tier chip, governor demo, event-gated reveals, exact-40 % dim, 1200 ms frozen ring); README motion row; tag `v1.1.0-motion` | all | full artifact set, lighthouse pair |
| **MS-12** *(optional)* | Audio detents + gallery motion specimens | §M9, DESIGN §13 | WebAudio synth (no assets), default off, persisted toggle, muted when hidden, disabled at T0, never sole channel; GalleryPage gains a "Motion specimens" section showing every §M5 primitive with its token | 31 | gallery png, audio-off proof |

**Model routing (Antigravity/AutoClaw):** MS-01/05/06 ⇒ Gemini Pro or Claude (thinking HIGH); MS-02…MS-04, MS-07…MS-10 ⇒ Flash MEDIUM; MS-11 ⇒ Pro/HIGH (audit-heavy); MS-12 ⇒ Flash.
**Circuit breaker & rescue:** unchanged from Master Loop v2 / RESCUE.md — 3 strikes ⇒ BLOCKED + `git checkout -- .`; crash ⇒ read `RESUME: MS-xx step n` from progress.txt.

---

# PART E — Prompt-engineering appendix (why this prompt is shaped this way)

This document was engineered from the current best public practice for agentic design/coding prompts; the executing agent inherits these properties, and future maintainers can see the reasoning:

1. **Studio-persona framing + subject grounding** — from Anthropic's `frontend-design` skill (github.com/anthropics/claude-code → plugins/frontend-design): open with a specific persona ("motion director for scientific instruments"), ground every choice in the product's own world. Generic "make it animated" prompts produce generic motion; persona-bound prompts produce *this* product's motion.
2. **Calibration by anti-pattern ("tells") list** — the same skill's core device: enumerate what failure looks like (§M3 prohibitions: bounce easing, scroll fade-ups, shake, layout-property animation, glow loops). Detectors beat adjectives: an agent can grep for `bounce`, it cannot grep for "tasteful." This mirrors `pbakaus/impeccable` (61 deterministic slop detectors) and `nutlope/hallmark` (gates + pre-emit self-critique) already adopted in DESIGN.md §2/§11.
3. **Tokens with exact values, never vibes** — motion-token discipline per Material 3 motion (stiffness/damping/mass semantics) and the MOTION.md design-system format: every duration, curve, spring, stagger, distance, and budget is a number an agent can implement and a reviewer can measure.
4. **Executable verification instead of adjectives** — Claude Code best practices: "without a check it can run, 'looks done' is the only signal." Hence 16 new deterministic gates (17–32), artifact requirements (traces, recordings, benchmarks), and exact end-state asserts (`globalAlpha === 0.40`, odometer === API value).
5. **Ralph-loop compatibility** — from `snarktank/ralph` / ghuntley.com and this project's own Master Loop v2: one story per turn, file-based memory (prd.json/progress.txt/git), circuit breaker, quota rule, stop token. MS stories are sized for a single fresh-context turn with the spec sections pre-linked.
6. **Spec-before-UI (Hallmark rule) + explicit law amendments** — the spec grows before the UI does; the three places where frozen DESIGN.md must bend are listed as *ratified amendments* (§M0) instead of being silently violated — the single biggest failure mode of "add animation" prompts against a frozen design system.
7. **Game-feel science, translated not transplanted** — Swink's game-feel model (real-time response, metaphor, polish) and Vlambeer's "juice" (impact feedback, particles, anticipation, follow-through) supply the five liveness levers in §0; each is re-voiced for the instrument persona (detent impulse instead of screenshake, evidence dust instead of confetti, armed-confirm instead of instant destructive action). Juice without persona is slop; persona without juice is dead.
8. **Platform reality 2025/26** — compositor-only animation & layer management (web.dev, Chrome Lighthouse "non-composited animations"); View Transitions in Chromium + Safari 18.2+ with Firefox in progress ⇒ mandatory feature detection + FLIP fallback (MDN, CSS-Tricks); CSS scroll-driven animations Chromium-only ⇒ IO+rAF fallback; CSS `linear()` springs ~88–90 % support (Josh Comeau, Oct 2025) ⇒ zero-dependency physics with curve fallback; WCAG 2.3.3/2.2.2/2.3.1 for the reduced-motion matrix (W3C, MDN, OpenReplay 2026).
9. **Adaptive quality as honesty, not just perf** — the FPS governor + visible `motion T3` chip turns optimization into *demonstrable telemetry* (a viva talking point and a QA tool), matching the project's "reproducibility as aesthetic" principle (DESIGN §1.3.6).
10. **Context-engineering hygiene** — per Anthropic's agent guidance: the prompt tells the agent exactly which spec sections each story touches (`spec` column), so it never re-reads the 25 k-line codebase; all persistent state stays in prd.json/progress.txt/git.

**Sources:** anthropics/claude-code frontend-design SKILL.md · code.claude.com/docs/en/best-practices · anthropic.com/engineering/effective-context-engineering-for-ai-agents · egmatic.com game-feel guide (Swink; Nijman/Vlambeer "Art of Screenshake") · web.dev compositor-only properties · developer.chrome.com Lighthouse non-composited animations · calendar.perfplanet.com 2025 compositor tale · developer.mozilla.org View Transition API · css-tricks.com cross-document view transitions (2026 status) · joshwcomeau.com linear() springs (Oct 2025) · developer.chrome.com css-linear-easing-function · w3.org WCAG 2.3.3 · blog.openreplay.com prefers-reduced-motion (2026) · m3.material.io motion · designmd.co MOTION.md format · motion.dev GSAP-vs-Motion · github.com/vasturiano/force-graph (canvas graph patterns) · snarktank/ralph + ghuntley.com/ralph · github/spec-kit · obra/superpowers · pbakaus/impeccable · nutlope/hallmark.
