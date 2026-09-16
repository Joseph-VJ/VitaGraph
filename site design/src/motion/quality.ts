/**
 * VitaGraph Motion Engine — Quality Governor & Tier Machine (§M4.4)
 * Adaptive 4-tier engine (T3 showcase -> T2 balanced -> T1 safe -> T0 static)
 * with 2s sliding-window FPS hysteresis, prefers-reduced-motion live listener,
 * hardware capability heuristics, and localStorage manual override.
 */

import { useState, useEffect } from "react";
import { ticker } from "./ticker";
import { isReducedMotion } from "./features";

export type MotionTier = "T3" | "T2" | "T1" | "T0";
export type MotionMode = "auto" | "manual";

export interface GovernorState {
  tier: MotionTier;
  mode: MotionMode;
  fps: number;
  reducedMotion: boolean;
  dprCap: number;
  allowParticles: boolean;
  allowAmbient: boolean;
}

const STORAGE_KEY = "motion_tier";

class QualityGovernor {
  private static instance: QualityGovernor;

  private tier: MotionTier = "T3";
  private mode: MotionMode = "auto";
  private reducedMotion: boolean = false;
  private listeners: Set<(state: GovernorState) => void> = new Set();

  // Hysteresis state (§M4.4)
  private consecutiveLowFpsWindows: number = 0;
  private consecutiveHighFpsWindows: number = 0;
  private lastTierChangeTime: number = 0;

  private constructor() {
    if (typeof window !== "undefined") {
      this.init();
      // Expose to window for test scripts and telemetry
      (window as any).__VT_GOVERNOR__ = this;
    }
  }

  public static getInstance(): QualityGovernor {
    if (!QualityGovernor.instance) {
      QualityGovernor.instance = new QualityGovernor();
    }
    return QualityGovernor.instance;
  }

  private init(): void {
    // 1. Check reduced motion
    this.reducedMotion = isReducedMotion();

    // 2. Read saved manual override from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ["T3", "T2", "T1", "T0"].includes(saved)) {
      this.mode = "manual";
      this.tier = saved as MotionTier;
    } else {
      this.mode = "auto";
      this.tier = this.calculateInitialTier();
    }

    // Hard-lock T0 if prefers-reduced-motion is active (§M4.4, §M11)
    if (this.reducedMotion) {
      this.tier = "T0";
    }

    this.applyTierToEngine();

    // Live listener for prefers-reduced-motion (no page reload needed, §M4.4)
    if (typeof window.matchMedia === "function") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const handleMediaChange = (e: MediaQueryListEvent) => {
        this.reducedMotion = e.matches;
        if (this.reducedMotion) {
          this.setTier("T0", "auto");
        } else {
          // Restore auto or manual setting
          const override = localStorage.getItem(STORAGE_KEY);
          if (override && ["T3", "T2", "T1", "T0"].includes(override)) {
            this.setTier(override as MotionTier, "manual");
          } else {
            this.setTier(this.calculateInitialTier(), "auto");
          }
        }
      };

      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", handleMediaChange);
      } else if (typeof (mediaQuery as any).addListener === "function") {
        (mediaQuery as any).addListener(handleMediaChange);
      }
    }

    // Start 2s monitoring loop for FPS hysteresis (§M4.4)
    this.lastTierChangeTime = performance.now();
    window.setInterval(this.evaluateFpsWindow, 2000);
  }

  /**
   * Initial hardware capability heuristics (§M4.4)
   */
  private calculateInitialTier(): MotionTier {
    if (typeof navigator === "undefined") return "T3";

    // saveData -> T2
    if ((navigator as any).connection?.saveData) {
      return "T2";
    }

    // Low CPU core count (<= 4) or low memory (<= 4GB) -> T2
    const cores = navigator.hardwareConcurrency || 8;
    const memory = (navigator as any).deviceMemory || 8;
    if (cores <= 4 || memory <= 4) {
      return "T2";
    }

    return "T3";
  }

  /**
   * Hysteresis rules (§M4.4):
   * 3 consecutive 2s windows <50 fps => one tier down
   * 10s (>58 fps) => 5 consecutive 2s windows >58 fps => one tier up
   * >=30s cooldown between automatic tier adjustments
   * T0 never left automatically if entered via reduced motion.
   */
  private evaluateFpsWindow = (): void => {
    if (this.mode === "manual" || this.reducedMotion) {
      return;
    }

    const currentFps = ticker.getRollingFps();
    const now = performance.now();
    const timeSinceLastChange = (now - this.lastTierChangeTime) / 1000;

    if (currentFps < 50) {
      this.consecutiveLowFpsWindows++;
      this.consecutiveHighFpsWindows = 0;
    } else if (currentFps > 58) {
      this.consecutiveHighFpsWindows++;
      this.consecutiveLowFpsWindows = 0;
    } else {
      this.consecutiveLowFpsWindows = 0;
      this.consecutiveHighFpsWindows = 0;
    }

    // Cooldown check (>= 30 seconds)
    if (timeSinceLastChange < 30) {
      return;
    }

    // Drop tier
    if (this.consecutiveLowFpsWindows >= 3) {
      this.consecutiveLowFpsWindows = 0;
      if (this.tier === "T3") {
        this.setTier("T2", "auto");
      } else if (this.tier === "T2") {
        this.setTier("T1", "auto");
      }
    }

    // Raise tier
    if (this.consecutiveHighFpsWindows >= 5) {
      this.consecutiveHighFpsWindows = 0;
      if (this.tier === "T1") {
        this.setTier("T2", "auto");
      } else if (this.tier === "T2") {
        this.setTier("T3", "auto");
      }
    }
  };

  private applyTierToEngine(): void {
    // Configure ticker ambient lane (§M4.1)
    if (this.tier === "T3") {
      ticker.configureAmbient(true, false);
    } else if (this.tier === "T2") {
      ticker.configureAmbient(true, true); // frame-skipped to 30fps
    } else {
      ticker.configureAmbient(false, false); // T1 and T0: no ambient
    }
  }

  private setTier(newTier: MotionTier, mode: MotionMode): void {
    if (this.tier === newTier && this.mode === mode) return;

    const oldTier = this.tier;
    this.tier = newTier;
    this.mode = mode;
    this.lastTierChangeTime = performance.now();
    this.applyTierToEngine();

    // Telemetry log (§M4.4)
    console.info(
      `[MotionGovernor] Tier changed: ${oldTier} -> ${newTier} (mode: ${mode}, FPS: ${ticker.getRollingFps()})`
    );

    this.notifyListeners();
  }

  public setOverride(override: "auto" | MotionTier): void {
    if (override === "auto") {
      localStorage.removeItem(STORAGE_KEY);
      this.mode = "auto";
      if (this.reducedMotion) {
        this.setTier("T0", "auto");
      } else {
        this.setTier(this.calculateInitialTier(), "auto");
      }
    } else {
      localStorage.setItem(STORAGE_KEY, override);
      this.setTier(override, "manual");
    }
  }

  public getState(): GovernorState {
    const dprCap = this.tier === "T3" ? 2 : this.tier === "T2" ? 1.5 : 1;
    return {
      tier: this.tier,
      mode: this.mode,
      fps: ticker.getRollingFps(),
      reducedMotion: this.reducedMotion,
      dprCap,
      allowParticles: this.tier === "T3",
      allowAmbient: this.tier === "T3" || this.tier === "T2",
    };
  }

  public subscribe(listener: (state: GovernorState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }
}

export const governor = QualityGovernor.getInstance();

/**
 * React hook to reactively bind components to the motion quality governor
 */
export function useMotionGovernor(): GovernorState {
  const [state, setState] = useState<GovernorState>(() => governor.getState());

  useEffect(() => {
    return governor.subscribe((nextState) => {
      setState(nextState);
    });
  }, []);

  return state;
}
