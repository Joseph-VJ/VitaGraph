import { useSyncExternalStore } from "react";
import { governor } from "../motion";

export type ProcessSpeed = "fast" | "normal" | "slow";
export type BackgroundStrength = "off" | "soft" | "full";
export type BackgroundEngine = "warp" | "flow" | "stars" | "type";
export type Theme = "light" | "dark";

export interface Preferences {
  theme: Theme;
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
let storageAvailable = true;
const DEFAULTS: Preferences = {
  theme: "dark",
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
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return DEFAULTS; }
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
      theme: stored.theme === "light" || stored.theme === "dark" ? stored.theme : DEFAULTS.theme,
      reduceMotion: typeof stored.reduceMotion === "boolean" ? stored.reduceMotion : DEFAULTS.reduceMotion,
      speed,
      chunkSize,
      background,
      backgroundEngine,
      backgroundLevel,
    };
  } catch {
    storageAvailable = false;
    return DEFAULTS;
  }
}

let current: Preferences = load();
const listeners = new Set<() => void>();
let appliedReduceMotion: boolean | undefined;

function apply(initial: boolean): void {
  document.documentElement.dataset.theme = current.theme;
  document.documentElement.style.colorScheme = current.theme;
  document.documentElement.dataset.reduceMotion = String(current.reduceMotion);
  if (current.reduceMotion && (initial || appliedReduceMotion !== current.reduceMotion)) {
    governor.setOverride("T0");
  } else if (!initial && appliedReduceMotion === true && !current.reduceMotion) {
    governor.setOverride("auto");
  }
  appliedReduceMotion = current.reduceMotion;
}

/** Call once before the first render so the saved choices are in force from the first frame. */
export function applyPreferences(): void {
  apply(true);
}

export function getPreferences(): Preferences {
  return current;
}

export function canPersistPreferences(): boolean { return storageAvailable; }

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  current = { ...current, [key]: value };
  try {
    // Keep unrelated saved fields when adding a preference to an older browser.
    let previous: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        previous = parsed as Record<string, unknown>;
      }
    } catch { /* malformed preferences are repaired by the next successful write */ }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...previous, ...current }));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
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

const syncPreferences = (event: StorageEvent): void => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  current = load();
  apply(false);
  listeners.forEach((listener) => listener());
};
window.addEventListener("storage", syncPreferences);
if (import.meta.hot) {
  import.meta.hot.dispose(() => window.removeEventListener("storage", syncPreferences));
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getPreferences, getPreferences);
}
