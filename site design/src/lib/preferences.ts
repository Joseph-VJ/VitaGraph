import { useSyncExternalStore } from "react";
import { governor } from "../motion";

export type ProcessSpeed = "fast" | "normal" | "slow";

export interface Preferences {
  cinematic: boolean;
  reduceMotion: boolean;
  speed: ProcessSpeed;
  chunkSize: number;
}

const STORAGE_KEY = "vitagraph_preferences";
const DEFAULTS: Preferences = {
  cinematic: false, // the Upload page shows the process in its own panel; the full-screen show is opt-in
  reduceMotion: false,
  speed: "normal",
  chunkSize: 200,
};

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULTS;
    const stored = parsed as Record<string, unknown>;
    const speed =
      stored.speed === "fast" || stored.speed === "normal" || stored.speed === "slow"
        ? (stored.speed as ProcessSpeed)
        : DEFAULTS.speed;
    const chunkSize =
      typeof stored.chunkSize === "number" && stored.chunkSize >= 120 && stored.chunkSize <= 600
        ? stored.chunkSize
        : DEFAULTS.chunkSize;
    return {
      cinematic: typeof stored.cinematic === "boolean" ? stored.cinematic : DEFAULTS.cinematic,
      reduceMotion: typeof stored.reduceMotion === "boolean" ? stored.reduceMotion : DEFAULTS.reduceMotion,
      speed,
      chunkSize,
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
