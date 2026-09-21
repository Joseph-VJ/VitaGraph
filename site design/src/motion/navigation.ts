/**
 * VitaGraph Motion Engine — Directional Navigation & Journey Orchestration (MS-13)
 * Provides directional view transitions, history depth tracking,
 * and canonical journey flow state.
 */

import { NavigateFunction } from "react-router-dom";
import { supportsViewTransitions } from "./features";
import { governor } from "./quality";

export type NavDirection = "forward" | "back";

export interface JourneyStep {
  id: string;
  path: string;
  label: string;
  reason: string;
}

export const CANONICAL_JOURNEY: JourneyStep[] = [
  {
    id: "home",
    path: "/",
    label: "Overview",
    reason: "Upload a report to map its entities →",
  },
  {
    id: "upload",
    path: "/upload",
    label: "Ingest",
    reason: "Inspect patient knowledge graph →",
  },
  {
    id: "graph",
    path: "/graph",
    label: "Knowledge Graph",
    reason: "Query longitudinal evidence →",
  },
  {
    id: "ask",
    path: "/ask",
    label: "Ask Questions",
    reason: "Audit chronological timeline →",
  },
  {
    id: "timeline",
    path: "/timeline",
    label: "Timeline",
    reason: "Return to system overview →",
  },
];

export const ROUTE_INDEX: Record<string, number> = {
  "/": 0,
  "/upload": 1,
  "/graph": 2,
  "/ask": 3,
  "/timeline": 4,
  "/compare": 5,
  "/insights": 6,
  "/library": 7,
  "/datasets": 8,
  "/ontology": 9,
  "/notebooks": 10,
  "/gallery": 11,
  "/settings": 12,
};

let lastPath = typeof window !== "undefined" ? window.location.pathname : "/";
let historyDepth = 0;

if (typeof window !== "undefined") {
  // Listen for browser back/forward buttons with directional view transition
  window.addEventListener("popstate", () => {
    const currentPath = window.location.pathname;
    const dir: NavDirection =
      (ROUTE_INDEX[currentPath] ?? 0) < (ROUTE_INDEX[lastPath] ?? 0) ? "back" : "forward";
    setNavDirection(dir);
    lastPath = currentPath;
    historyDepth = Math.max(0, historyDepth - 1);

    const tier = governor.getState().tier;
    const vtAllowed = supportsViewTransitions() && tier !== "T0";
    if (vtAllowed && "startViewTransition" in document) {
      (document as any).startViewTransition(async () => {
        // Yield to allow React Router to render the incoming route DOM
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  });
}

/**
 * Compute the directional vector between two paths
 */
export function getNavDirection(fromPath: string, toPath: string): NavDirection {
  const fromIdx = ROUTE_INDEX[fromPath] ?? 0;
  const toIdx = ROUTE_INDEX[toPath] ?? 0;
  return toIdx >= fromIdx ? "forward" : "back";
}

/**
 * Set the data-nav-dir attribute on <html> for CSS view transition keyframe selection
 */
export function setNavDirection(dir: NavDirection): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.navDir = dir;
  }
}

/**
 * Get current navigation direction from <html>
 */
export function getCurrentNavDirection(): NavDirection {
  if (typeof document !== "undefined") {
    return (document.documentElement.dataset.navDir as NavDirection) || "forward";
  }
  return "forward";
}

/**
 * Execute navigation with real document.startViewTransition and directional attribution
 */
export function transitionNavigate(
  navigate: NavigateFunction,
  to: string,
  options?: { replace?: boolean; direction?: NavDirection }
): void {
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
  const dir = options?.direction || getNavDirection(currentPath, to);
  setNavDirection(dir);
  lastPath = to;
  historyDepth++;

  const tier = governor.getState().tier;
  const vtAllowed = supportsViewTransitions() && tier !== "T0";

  if (vtAllowed && typeof document !== "undefined" && "startViewTransition" in document) {
    (document as any).startViewTransition(() => {
      navigate(to, { replace: options?.replace });
    });
  } else {
    navigate(to, { replace: options?.replace });
  }
}
