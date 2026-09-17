/**
 * VitaGraph Motion Engine — Synthesized Audio Detents (§M9, Gate 31)
 * Zero-dependency WebAudio synthesizer:
 * - detent: 1200 Hz triangle, 15 ms exponential decay, gain 0.03
 * - chime:  660->990 Hz sine pair harmonic, 120 ms decay, gain 0.04
 * - thud:   220 Hz sine, 80 ms exponential decay, gain 0.03
 *
 * Rules:
 * - Zero audio assets (pure WebAudio synthesis)
 * - Default OFF, persisted toggle in localStorage ('vg_sound_enabled')
 * - Muted when tab is hidden (document.hidden / visibilitychange)
 * - Hard-disabled at T0 / reduced motion (governor tier T0 or reducedMotion)
 * - Never during boot sequence
 * - Never on ambient events
 * - Never the sole channel for state (Gate 31 multi-channel redundancy)
 */

import { governor } from "./quality";

export type AudioSoundType = "detent" | "chime" | "thud";

export interface AudioStats {
  detentsPlayed: number;
  chimesPlayed: number;
  thudsPlayed: number;
  blockedCalls: number;
}

const STORAGE_KEY = "vg_sound_enabled";

class AudioEngine {
  private static instance: AudioEngine;
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = false;
  private listeners: Set<(enabled: boolean) => void> = new Set();

  private stats: AudioStats = {
    detentsPlayed: 0,
    chimesPlayed: 0,
    thudsPlayed: 0,
    blockedCalls: 0,
  };

  private constructor() {
    if (typeof window !== "undefined") {
      this.init();
      (window as any).__VT_AUDIO__ = this;
    }
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  private init(): void {
    // Default is OFF per §M9
    try {
      this.isEnabled = localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      this.isEnabled = false;
    }

    // Live listen for storage changes across tabs
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) {
        this.isEnabled = e.newValue === "true";
        this.notifyListeners();
      }
    });

    // Muted when hidden - suspend/resume context when visibility changes
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.ctx && this.ctx.state === "running") {
        this.ctx.suspend().catch(() => {});
      }
    });
  }

  public isSoundEnabled(): boolean {
    return this.isEnabled;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // ignore storage errors
    }
    this.notifyListeners();
  }

  public subscribe(listener: (enabled: boolean) => void): () => void {
    this.listeners.add(listener);
    listener(this.isEnabled);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => fn(this.isEnabled));
  }

  /**
   * Evaluates if audio is currently permitted to produce acoustic output (§M9, Gate 31)
   */
  public canPlayAudio(): boolean {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return false;
    }

    // 1. Off by default, requires explicit user activation
    if (!this.isEnabled) {
      return false;
    }

    // 2. Muted when tab is hidden
    if (document.hidden) {
      return false;
    }

    // 3. Hard-disabled at T0 / reduced-motion
    const gov = governor.getState();
    if (gov.tier === "T0" || gov.reducedMotion) {
      return false;
    }

    // 4. Never during boot sequence
    try {
      if (sessionStorage.getItem("vg_booting") === "true") {
        return false;
      }
    } catch {
      // ignore
    }

    return true;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return null;
      try {
        this.ctx = new AudioCtxClass();
      } catch {
        return null;
      }
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  /**
   * Plays detent sound: 1200 Hz triangle, 15 ms exponential decay, gain 0.03
   * Used for stepper complete, chip pop, tab click.
   */
  public playDetent(): boolean {
    if (!this.canPlayAudio()) {
      this.stats.blockedCalls++;
      return false;
    }

    const ctx = this.getAudioContext();
    if (!ctx) return false;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(1200, t);

      gain.gain.setValueAtTime(0.03, t);
      // Exponential decay to near zero over 15ms
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.02);

      this.stats.detentsPlayed++;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Plays chime sound: 660->990 Hz sine pair harmonic chord, 120 ms, gain 0.04
   * Used for answer done / job completion.
   */
  public playChime(): boolean {
    if (!this.canPlayAudio()) {
      this.stats.blockedCalls++;
      return false;
    }

    const ctx = this.getAudioContext();
    if (!ctx) return false;

    try {
      const t = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      // Sine harmonic pair (perfect 5th 660 Hz and 990 Hz)
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(660, t);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(990, t);

      gain.gain.setValueAtTime(0.04, t);
      // Decay over 120ms
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.125);
      osc2.stop(t + 0.125);

      this.stats.chimesPlayed++;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Plays thud sound: 220 Hz sine, 80 ms exponential decay, gain 0.03
   * Used for refusal / quarantine / error.
   */
  public playThud(): boolean {
    if (!this.canPlayAudio()) {
      this.stats.blockedCalls++;
      return false;
    }

    const ctx = this.getAudioContext();
    if (!ctx) return false;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(220, t);

      gain.gain.setValueAtTime(0.03, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.085);

      this.stats.thudsPlayed++;
      return true;
    } catch {
      return false;
    }
  }

  public getStats(): AudioStats {
    return { ...this.stats };
  }
}

export const audioEngine = AudioEngine.getInstance();

export function playDetent(): boolean {
  return audioEngine.playDetent();
}

export function playChime(): boolean {
  return audioEngine.playChime();
}

export function playThud(): boolean {
  return audioEngine.playThud();
}

export function isAudioEnabled(): boolean {
  return audioEngine.isSoundEnabled();
}

export function setAudioEnabled(enabled: boolean): void {
  audioEngine.setSoundEnabled(enabled);
}

export function canPlayAudio(): boolean {
  return audioEngine.canPlayAudio();
}
