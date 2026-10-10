import { useSyncExternalStore } from "react";
import { BASE_URL } from "../api/client";

/**
 * One shared check of the backend's /api/health for the whole app.
 *
 * The shell used to run three separate checks (the offline banner, the header's AI tag and the status strip's
 * latency), so every page change started up to three extra requests and the backend answered the same
 * question three times. Now there is one request every 8 seconds, none while the tab is hidden, and a fresh one
 * the moment the tab becomes visible again.
 */
export interface HealthSnapshot {
  online: boolean;
  /** Whether the backend lets retrieved passages go to the AI model (null until the first answer). */
  allowApi: boolean | null;
  /** Round trip of the last check, in milliseconds (null until measured). */
  latencyMs: number | null;
}

const INTERVAL_MS = 8000;

let snapshot: HealthSnapshot = { online: true, allowApi: null, latencyMs: null };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

function publish(next: HealthSnapshot): void {
  if (next.online === snapshot.online && next.allowApi === snapshot.allowApi && next.latencyMs === snapshot.latencyMs) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

export async function refreshHealth(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  const started = performance.now();
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(8000) });
    const latencyMs = Math.round(performance.now() - started);
    if (!res.ok) {
      publish({ ...snapshot, online: false, latencyMs: null });
      return;
    }
    const data: { allow_api?: unknown } = await res.json().catch(() => ({}));
    const allowApi = typeof data.allow_api === "boolean" ? data.allow_api : snapshot.allowApi;
    if (typeof allowApi === "boolean" && typeof sessionStorage !== "undefined") {
      try {
        sessionStorage.setItem("vg_allow_api", String(allowApi));
      } catch {
        /* storage may be blocked; the live value is still published */
      }
    }
    publish({ online: true, allowApi, latencyMs });
  } catch {
    publish({ ...snapshot, online: false, latencyMs: null });
  } finally {
    inFlight = false;
  }
}

function onVisibility(): void {
  if (!document.hidden) void refreshHealth();
}

function start(): void {
  if (timer !== null) return;
  void refreshHealth();
  timer = setInterval(() => {
    if (!document.hidden) void refreshHealth();
  }, INTERVAL_MS);
  document.addEventListener("visibilitychange", onVisibility);
}

function stop(): void {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
  document.removeEventListener("visibilitychange", onVisibility);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

export function getHealth(): HealthSnapshot {
  return snapshot;
}

export function useHealth(): HealthSnapshot {
  return useSyncExternalStore(subscribe, getHealth, getHealth);
}
