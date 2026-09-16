/**
 * VitaGraph Motion Engine — Boot Ignition Sequence (§M6.1)
 * Once per session, ≤1.6 s total, skippable by first input, skipped at T0/T1.
 *
 * Timeline:
 *   t=0    grain + vignette opacity 0→1      (--m-base ink)
 *   t=120  status-strip LED ignite + segments (--m-quick detent)
 *   t=200  sidebar brand leaf DrawPath        (--m-cinematic servo)
 *   t=260  nav items ×N enter, 40ms stagger   (--m-quick servo)
 *   t=320  header search + user chip enter    (--m-quick servo)
 *   t=400  screen content → its own sequence  (§M7.x)
 */

import { Sequence } from "./sequence";
import { governor } from "./quality";

const SESSION_KEY = "vg_booted";

export interface BootTargets {
  grain?: HTMLElement | null;
  statusLed?: HTMLElement | null;
  statusSegments?: NodeListOf<Element> | HTMLElement[] | null;
  sidebarLeaf?: HTMLElement | null;
  navItems?: NodeListOf<Element> | HTMLElement[] | null;
  headerSearch?: HTMLElement | null;
  headerUser?: HTMLElement | null;
  mainContent?: HTMLElement | null;
}

/**
 * Check if boot should be skipped entirely.
 */
function shouldSkipBoot(): boolean {
  // Already booted this session
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY)) {
    return true;
  }

  // Deep-link with query state (e.g. ?uid=...)
  if (typeof window !== "undefined" && window.location.search.length > 1) {
    return true;
  }

  // T0 or T1: skip entirely (§M6.1)
  const tier = governor.getState().tier;
  if (tier === "T0" || tier === "T1") {
    return true;
  }

  return false;
}

/**
 * Instantly show all boot targets at their final state.
 */
function showAllFinal(targets: BootTargets): void {
  const allEls = [
    targets.grain,
    targets.statusLed,
    targets.headerSearch,
    targets.headerUser,
    targets.sidebarLeaf,
    targets.mainContent,
  ].filter(Boolean) as HTMLElement[];

  // Show individual elements
  for (const el of allEls) {
    el.classList.remove("boot-hidden");
    el.classList.add("boot-ready");
    el.style.opacity = "";
    el.style.transform = "";
  }

  // Show status segments
  if (targets.statusSegments) {
    for (const el of Array.from(targets.statusSegments)) {
      (el as HTMLElement).classList.remove("boot-hidden");
      (el as HTMLElement).classList.add("boot-ready");
      (el as HTMLElement).style.opacity = "";
    }
  }

  // Show nav items
  if (targets.navItems) {
    for (const el of Array.from(targets.navItems)) {
      (el as HTMLElement).classList.remove("boot-hidden");
      (el as HTMLElement).classList.add("boot-ready");
      (el as HTMLElement).style.opacity = "";
      (el as HTMLElement).style.transform = "";
    }
  }

  // Mark booted
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(SESSION_KEY, "1");
  }
}

/**
 * Animate an element enter: opacity 0→1 + translateY 8→0
 */
function animateEnter(
  el: HTMLElement,
  durationMs: number,
  easing: string,
): Animation {
  el.classList.remove("boot-hidden");
  const anim = el.animate(
    [
      { opacity: 0, transform: "translateY(8px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: durationMs, easing, fill: "forwards" }
  );
  return anim;
}

/**
 * Animate LED ignite: scale .6→1 + opacity 0→1
 */
function animateLedIgnite(el: HTMLElement, durationMs: number, easing: string): Animation {
  el.classList.remove("boot-hidden");
  return el.animate(
    [
      { opacity: 0, transform: "scale(0.6)" },
      { opacity: 1, transform: "scale(1)" },
    ],
    { duration: durationMs, easing, fill: "forwards" }
  );
}

/**
 * Run the boot ignition sequence.
 * Returns a Promise that resolves when boot is complete or skipped.
 */
export function runBoot(targets: BootTargets): Promise<void> {
  // Skip checks
  if (shouldSkipBoot()) {
    showAllFinal(targets);
    return Promise.resolve();
  }

  // Hide all targets initially
  const allTargetEls = [
    targets.grain,
    targets.statusLed,
    targets.headerSearch,
    targets.headerUser,
    targets.sidebarLeaf,
    targets.mainContent,
  ].filter(Boolean) as HTMLElement[];

  for (const el of allTargetEls) {
    el.classList.add("boot-hidden");
  }
  if (targets.statusSegments) {
    for (const el of Array.from(targets.statusSegments)) {
      (el as HTMLElement).classList.add("boot-hidden");
    }
  }
  if (targets.navItems) {
    for (const el of Array.from(targets.navItems)) {
      (el as HTMLElement).classList.add("boot-hidden");
    }
  }

  // Collect all running animations for skip
  const runningAnimations: Animation[] = [];
  let skipped = false;
  let resolveBootPromise: (() => void) | null = null;

  // Input skip handler: any input skips to final state (§M6.1)
  const skipHandler = () => {
    if (skipped) return;
    skipped = true;
    // Cancel all running animations
    for (const a of runningAnimations) {
      try { a.cancel(); } catch { /* ignore */ }
    }
    seq.cancel();
    showAllFinal(targets);
    cleanup();
    resolveBootPromise?.();
  };

  const skipEvents = ["pointerdown", "keydown", "touchstart"] as const;
  for (const evt of skipEvents) {
    window.addEventListener(evt, skipHandler, { once: true, passive: true });
  }

  const cleanup = () => {
    for (const evt of skipEvents) {
      window.removeEventListener(evt, skipHandler);
    }
  };

  // CSS easing tokens
  const INK = "cubic-bezier(0, 0, 0.2, 1)";
  const DETENT = "cubic-bezier(0.30, 0.80, 0.20, 1)";
  const SERVO = "cubic-bezier(0.32, 0, 0.24, 1)";

  // Build sequence using ticker-driven delays (Gate 18: no setTimeout for state)
  const seq = new Sequence();

  // t=0: grain + vignette opacity 0→1 (--m-base=240ms, ink)
  seq.addAction(() => {
    if (skipped) return;
    if (targets.grain) {
      const a = targets.grain.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 240, easing: INK, fill: "forwards" }
      );
      runningAnimations.push(a);
      a.onfinish = () => {
        if (targets.grain) {
          targets.grain.classList.remove("boot-hidden");
          targets.grain.classList.add("boot-ready");
        }
      };
    }
  });

  // t=120ms: LED ignite + status segments
  seq.wait(120);
  seq.addAction(() => {
    if (skipped) return;
    // t=120ms: status-strip LED ignite + segments (--m-quick=180ms, detent)
    if (targets.statusLed) {
      const a = animateLedIgnite(targets.statusLed, 180, DETENT);
      runningAnimations.push(a);
      a.onfinish = () => {
        if (targets.statusLed) {
          targets.statusLed.classList.add("boot-ready");
        }
      };
    }
    // Status segments fade L→R with 40ms stagger
    if (targets.statusSegments) {
      const segs = Array.from(targets.statusSegments);
      segs.forEach((seg, i) => {
        const el = seg as HTMLElement;
        const a = el.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 180, easing: DETENT, fill: "forwards", delay: i * 40 }
        );
        runningAnimations.push(a);
        a.onfinish = () => {
          el.classList.remove("boot-hidden");
          el.classList.add("boot-ready");
        };
      });
    }
  });

  // t=200ms: sidebar brand leaf DrawPath stroke (--m-cinematic=720ms, servo)
  seq.wait(80);
  seq.addAction(() => {
    if (skipped) return;
    if (targets.sidebarLeaf) {
      const svgEl = targets.sidebarLeaf.querySelector("svg path, svg") as SVGElement | null;
      if (svgEl && svgEl instanceof SVGGeometryElement) {
        const len = svgEl.getTotalLength();
        svgEl.style.strokeDasharray = `${len}`;
        svgEl.style.strokeDashoffset = `${len}`;
        const a = svgEl.animate(
          [{ strokeDashoffset: `${len}` }, { strokeDashoffset: "0" }],
          { duration: 720, easing: SERVO, fill: "forwards" }
        );
        runningAnimations.push(a);
        a.onfinish = () => {
          svgEl.style.strokeDasharray = "";
          svgEl.style.strokeDashoffset = "";
        };
      }
      const a = targets.sidebarLeaf.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 240, easing: SERVO, fill: "forwards" }
      );
      runningAnimations.push(a);
      a.onfinish = () => {
        if (targets.sidebarLeaf) {
          targets.sidebarLeaf.classList.remove("boot-hidden");
          targets.sidebarLeaf.classList.add("boot-ready");
        }
      };
    }
  });

  // t=260ms: nav items enter §M5.1, 40ms stagger cap 480 (--m-quick=180ms, servo)
  seq.wait(60);
  seq.addAction(() => {
    if (skipped) return;
    if (targets.navItems) {
      const items = Array.from(targets.navItems);
      items.forEach((item, i) => {
        const el = item as HTMLElement;
        const a = animateEnter(el, 180, SERVO);
        if (i > 0) {
          a.cancel();
          const delayed = el.animate(
            [
              { opacity: 0, transform: "translateY(8px)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 180, easing: SERVO, fill: "forwards", delay: Math.min(i * 40, 480) }
          );
          runningAnimations.push(delayed);
          delayed.onfinish = () => {
            el.classList.add("boot-ready");
          };
        } else {
          runningAnimations.push(a);
          a.onfinish = () => {
            el.classList.add("boot-ready");
          };
        }
      });
    }
  });

  // t=320ms: header search + user chip enter (--m-quick=180ms, servo)
  seq.wait(60);
  seq.addAction(() => {
    if (skipped) return;
    if (targets.headerSearch) {
      const a = animateEnter(targets.headerSearch, 180, SERVO);
      runningAnimations.push(a);
      a.onfinish = () => {
        if (targets.headerSearch) {
          targets.headerSearch.classList.remove("boot-hidden");
          targets.headerSearch.classList.add("boot-ready");
        }
      };
    }
    if (targets.headerUser) {
      const a = animateEnter(targets.headerUser, 180, SERVO);
      runningAnimations.push(a);
      a.onfinish = () => {
        if (targets.headerUser) {
          targets.headerUser.classList.remove("boot-hidden");
          targets.headerUser.classList.add("boot-ready");
        }
      };
    }
  });

  // t=400ms: screen content — its own data-gated sequence (§M7.x, --m-quick=180ms, servo)
  seq.wait(80);
  seq.addAction(() => {
    if (skipped) return;
    if (targets.mainContent) {
      const a = animateEnter(targets.mainContent, 180, SERVO);
      runningAnimations.push(a);
      a.onfinish = () => {
        if (targets.mainContent) {
          targets.mainContent.classList.remove("boot-hidden");
          targets.mainContent.classList.add("boot-ready");
        }
      };
    }
  });

  // Wait for leaf cinematic stroke to complete (t=200ms + 720ms = 920ms; from t=400ms: 520ms)
  seq.wait(520);

  // Final: mark booted
  seq.addAction(() => {
    if (!skipped && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, "1");
    }
    cleanup();
  });

  return new Promise<void>((resolve) => {
    resolveBootPromise = resolve;
    seq.play().then(() => {
      Promise.all(runningAnimations.map((a) => a.finished.catch(() => {}))).then(() => {
        if (!skipped) {
          showAllFinal(targets);
          resolve();
        }
      });
    });
  });
}
