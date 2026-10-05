import { useSyncExternalStore } from "react";
import { governor } from "../motion";

export interface Preferences {
  cinematic: boolean;
  reduceMotion: boolean;
  graphView: "auto" | "3d" | "2d";
}

const STORAGE_KEY = "vitagraph_preferences";
const DEFAULTS: Preferences = { cinematic: true, reduceMotion: false, graphView: "auto" };

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULTS;
    const stored = parsed as Record<string, unknown>;
    const graphView =
      stored.graphView === "3d" || stored.graphView === "2d" || stored.graphView === "auto"
        ? stored.graphView
        : DEFAULTS.graphView;
    return {
      cinematic: typeof stored.cinematic === "boolean" ? stored.cinematic : DEFAULTS.cinematic,
      reduceMotion: typeof stored.reduceMotion === "boolean" ? stored.reduceMotion : DEFAULTS.reduceMotion,
      graphView,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: Preferences = load();
const listeners = new Set<() => void>();

function apply(initial: boolean): void {
  document.documentElement.dataset.reduceMotion = String(current.reduceMotion);
  if (current.reduceMotion) {
    governor.setOverride("T0");
  } else if (!initial) {
    governor.setOverride("auto");
  }
}

/** Call once before the first render so the saved choices are in force from the first frame. */
export function applyPreferences(): void {
  apply(true);
}

export function getPreferences(): Preferences {
  return current;
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  current = { ...current, [key]: value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: the choice then lasts for this visit only */
  }
  apply(false);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getPreferences, getPreferences);
}
