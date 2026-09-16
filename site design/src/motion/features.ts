/**
 * VitaGraph Motion Engine — Capability Detection (§M4.5)
 * Detects browser capabilities once, cached.
 */

export interface MotionFeatures {
  viewTransitions: boolean;
  scrollTimeline: boolean;
  linearEasing: boolean;
  offscreen: boolean;
  reducedMotion: boolean;
}

const detectFeatures = (): MotionFeatures => {
  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

  const viewTransitions = isBrowser && "startViewTransition" in document;

  const scrollTimeline =
    isBrowser &&
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    (CSS.supports("animation-timeline", "view()") || CSS.supports("animation-timeline", "scroll()"));

  const linearEasing =
    isBrowser &&
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("animation-timing-function", "linear(0, 1)");

  const offscreen = typeof OffscreenCanvas !== "undefined";

  const reducedMotion =
    isBrowser &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return {
    viewTransitions,
    scrollTimeline,
    linearEasing,
    offscreen,
    reducedMotion,
  };
};

export const features: MotionFeatures = detectFeatures();

export const supportsViewTransitions = (): boolean => {
  if (typeof window !== "undefined" && (window as any).__VT_DISABLE_VIEW_TRANSITIONS__) {
    return false;
  }
  return features.viewTransitions;
};

export const isReducedMotion = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};
