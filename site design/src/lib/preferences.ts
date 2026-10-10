import { useSyncExternalStore } from "react";
import { governor } from "../motion";

export type ProcessSpeed = "fast" | "normal" | "slow";
export type BackgroundStrength = "off" | "soft" | "full";
export type BackgroundEngine = "warp" | "flow" | "stars" | "type";

export interface Preferences {
  reduceMotion: boolean;
  speed: ProcessSpeed;
  chunkSize: number;
  background: BackgroundStrength;
  backgroundEngine: BackgroundEngine;
  /** How light or dark the background shows, in percent: 30 (lighter) to 200 (darker), 100 = as designed. */
  backgroundLevel: number;
}

export const BACKGROUND_LEVEL_MIN = 30;
export const BACKGROUND_LEVEL_MAX = 200;
export const BACKGROUND_LEVEL_DEFAULT = 100;

const STORAGE_KEY = "vitagraph_preferences";
const DEFAULTS: Preferences = {
  reduceMotion: false,
  speed: "normal",
  chunkSize: 200,
  background: "soft",
  backgroundEngine: "warp",
  backgroundLevel: BACKGROUND_LEVEL_DEFAULT,
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
    const background =
      stored.background === "off" || stored.background === "soft" || stored.background === "full"
        ? (stored.background as BackgroundStrength)
        : DEFAULTS.background;
    const backgroundEngine =
      stored.backgroundEngine === "warp" ||
      stored.backgroundEngine === "flow" ||
      stored.backgroundEngine === "stars" ||
      stored.backgroundEngine === "type"
        ? (stored.backgroundEngine as BackgroundEngine)
        : DEFAULTS.backgroundEngine;
    const backgroundLevel =
      typeof stored.backgroundLevel === "number" &&
      stored.backgroundLevel >= BACKGROUND_LEVEL_MIN &&
      stored.backgroundLevel <= BACKGROUND_LEVEL_MAX
        ? stored.backgroundLevel
        : DEFAULTS.backgroundLevel;
    return {
      reduceMotion: typeof stored.reduceMotion === "boolean" ? stored.reduceMotion : DEFAULTS.reduceMotion,
      speed,
      chunkSize,
      background,
      backgroundEngine,
      backgroundLevel,
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
