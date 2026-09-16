/**
 * VitaGraph Motion Engine — First-Last-Invert-Play (FLIP) Utility (§M4.6)
 * Measures first -> mutates -> measures last -> inverts via transform -> plays on weighted spring.
 * Compositor-only (Gate 19): single forced reflow at measure, zero layout reading mid-flight.
 */

import { springToLinear, SpringPresetName } from "./spring";
import { governor } from "./quality";

export interface FlipOptions {
  spring?: SpringPresetName;
  capMs?: number; // default 240ms (§M2.1 --m-base)
  onComplete?: () => void;
}

export function flip(
  el: HTMLElement,
  mutate: () => void,
  options: FlipOptions = {}
): Promise<void> {
  const { spring = "weighted", capMs = 240, onComplete } = options;

  // At tier T0, bypass animation and execute mutation instantly (§M4.4, §M11)
  if (governor.getState().tier === "T0") {
    mutate();
    onComplete?.();
    return Promise.resolve();
  }

  // 1. First (measure)
  const firstRect = el.getBoundingClientRect();

  // 2. Mutate DOM
  mutate();

  // 3. Last (single forced reflow, Gate 19)
  const lastRect = el.getBoundingClientRect();

  // 4. Invert
  const dx = firstRect.left - lastRect.left;
  const dy = firstRect.top - lastRect.top;
  const dw = lastRect.width > 0 ? firstRect.width / lastRect.width : 1;
  const dh = lastRect.height > 0 ? firstRect.height / lastRect.height : 1;

  // If negligible delta, exit cleanly without promoting layer
  if (
    Math.abs(dx) < 0.5 &&
    Math.abs(dy) < 0.5 &&
    Math.abs(dw - 1) < 0.01 &&
    Math.abs(dh - 1) < 0.01
  ) {
    onComplete?.();
    return Promise.resolve();
  }

  // 5. Play (compositor-only transform)
  const easing = springToLinear(spring);

  return new Promise<void>((resolve) => {
    const originalTransformOrigin = el.style.transformOrigin;
    el.style.transformOrigin = "top left";

    // WAAPI compositor animation
    const anim = el.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${dw}, ${dh})`,
        },
        {
          transform: "none",
        },
      ],
      {
        duration: capMs,
        easing,
        fill: "none",
      }
    );

    const cleanup = () => {
      el.style.transformOrigin = originalTransformOrigin;
      onComplete?.();
      resolve();
    };

    anim.onfinish = cleanup;
    anim.oncancel = cleanup;
  });
}
