/**
 * VitaGraph Motion Engine — Single Heartbeat Ticker (§M4.1)
 * App-wide single requestAnimationFrame loop with fixed-step accumulator,
 * L0/L1/L2 lanes, 500ms auto-idle detection, and rolling FPS telemetry.
 */

export type TickerLane = "L0" | "L1" | "L2";

/**
 * Ticker callback.
 * Return `false` to automatically unsubscribe when animation reaches rest/completion.
 */
export type TickerCallback = (dtMs: number, timeMs: number) => boolean | void;

export interface TickerMetrics {
  fps: number;
  mainThreadMs: number;
  isIdle: boolean;
  activeCount: number;
  totalFrames: number;
}

export class Ticker {
  private static instance: Ticker;

  private rafId: number | null = null;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private idleTimeMs: number = 0;
  private nextSubId: number = 1;

  // Lanes (§M4.1)
  private lanes: Record<TickerLane, Map<number, TickerCallback>> = {
    L0: new Map(), // interaction: input, camera, drag
    L1: new Map(), // focal: sequences, staged reveals
    L2: new Map(), // ambient: breathe, dust, loops
  };

  // FPS tracking (2-second sliding window for quality governor §M4.4)
  private frameTimestamps: number[] = [];
  private rollingFps: number = 60;
  private lastMainThreadMs: number = 0;
  private totalFrameCount: number = 0;

  // Ambient throttling (skip every other frame at T2)
  private l2FrameSkip: boolean = false;
  private ambientEnabled: boolean = true;
  private ambientHalfRate: boolean = false;

  private constructor() {
    if (typeof window !== "undefined") {
      // Expose to window for test harness & idle-rAF verification
      (window as any).__VT_TICKER__ = this;
    }
  }

  public static getInstance(): Ticker {
    if (!Ticker.instance) {
      Ticker.instance = new Ticker();
    }
    return Ticker.instance;
  }

  /**
   * Subscribe callback to a specific lane.
   * Automatically wakes ticker if idle.
   * Returns unsubscribe function.
   */
  public subscribe(lane: TickerLane, fn: TickerCallback): () => void {
    const id = this.nextSubId++;
    this.lanes[lane].set(id, fn);
    this.wake();

    return () => {
      this.lanes[lane].delete(id);
    };
  }

  /**
   * Configure ambient (L2) lane behavior based on tier (§M4.1)
   */
  public configureAmbient(enabled: boolean, halfRate: boolean): void {
    this.ambientEnabled = enabled;
    this.ambientHalfRate = halfRate;
  }

  /**
   * Wake the ticker if idle.
   */
  public wake(): void {
    this.idleTimeMs = 0;
    if (this.rafId === null && typeof window !== "undefined") {
      this.lastTime = performance.now();
      this.accumulator = 0;
      this.rafId = window.requestAnimationFrame(this.onFrame);
    }
  }

  public isIdle(): boolean {
    return this.rafId === null;
  }

  public getRollingFps(): number {
    return this.rollingFps;
  }

  public getMetrics(): TickerMetrics {
    const activeCount =
      this.lanes.L0.size + this.lanes.L1.size + this.lanes.L2.size;
    return {
      fps: this.rollingFps,
      mainThreadMs: this.lastMainThreadMs,
      isIdle: this.rafId === null,
      activeCount,
      totalFrames: this.totalFrameCount,
    };
  }

  private hasActiveSubscribers(): boolean {
    return (
      this.lanes.L0.size > 0 ||
      this.lanes.L1.size > 0 ||
      (this.ambientEnabled && this.lanes.L2.size > 0)
    );
  }

  private onFrame = (now: number): void => {
    const frameStart = performance.now();
    this.totalFrameCount++;

    if (this.lastTime === 0) {
      this.lastTime = now;
    }

    // Delta time clamped <= 50ms (§M4.1)
    let deltaMs = now - this.lastTime;
    this.lastTime = now;
    if (deltaMs > 50) {
      deltaMs = 50;
    }

    // Rolling FPS tracking over 2s sliding window
    this.frameTimestamps.push(now);
    const windowStart = now - 2000;
    while (this.frameTimestamps.length > 0 && this.frameTimestamps[0] < windowStart) {
      this.frameTimestamps.shift();
    }
    if (this.frameTimestamps.length > 1) {
      const windowDuration = (now - this.frameTimestamps[0]) / 1000;
      if (windowDuration > 0.5) {
        this.rollingFps = Math.round((this.frameTimestamps.length - 1) / windowDuration);
      }
    }

    // Fixed-step accumulation: 16.67ms per step, max 3 catch-up steps (§M4.1)
    const fixedStepMs = 16.67;
    this.accumulator += deltaMs;
    let steps = 0;
    const maxSteps = 3;

    while (this.accumulator >= fixedStepMs && steps < maxSteps) {
      this.stepLanes(fixedStepMs, now);
      this.accumulator -= fixedStepMs;
      steps++;
    }

    // If still accumulated too much, drop excess to prevent spiral of death
    if (this.accumulator > fixedStepMs) {
      this.accumulator = 0;
    }

    // Measure main thread execution time (§M10 <= 4ms)
    this.lastMainThreadMs = performance.now() - frameStart;

    // Idle detection (§M4.1):
    // When no lane has work for 500ms the rAF stops.
    if (!this.hasActiveSubscribers()) {
      this.idleTimeMs += deltaMs;
      if (this.idleTimeMs >= 500) {
        // Battery honesty: zero rAF cycles while idle (Gate 23 / Gate 29)
        if (this.rafId !== null) {
          window.cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        return;
      }
    } else {
      this.idleTimeMs = 0;
    }

    // Schedule next frame
    this.rafId = window.requestAnimationFrame(this.onFrame);
  };

  private stepLanes(dtMs: number, timeMs: number): void {
    // 1. L0 Interaction (never skipped)
    this.executeLane("L0", dtMs, timeMs);

    // 2. L1 Focal (staged sequences, event-gated timelines)
    this.executeLane("L1", dtMs, timeMs);

    // 3. L2 Ambient (skipped at T0/T1; frame-skipped to 30fps at T2; full at T3)
    if (this.ambientEnabled) {
      if (this.ambientHalfRate) {
        this.l2FrameSkip = !this.l2FrameSkip;
        if (this.l2FrameSkip) {
          this.executeLane("L2", dtMs * 2, timeMs);
        }
      } else {
        this.executeLane("L2", dtMs, timeMs);
      }
    }
  }

  private executeLane(lane: TickerLane, dtMs: number, timeMs: number): void {
    const laneMap = this.lanes[lane];
    if (laneMap.size === 0) return;

    const toRemove: number[] = [];
    laneMap.forEach((callback, id) => {
      try {
        const keepAlive = callback(dtMs, timeMs);
        if (keepAlive === false) {
          toRemove.push(id);
        }
      } catch (err) {
        console.error(`[Ticker] Error in ${lane} callback:`, err);
        toRemove.push(id);
      }
    });

    for (const id of toRemove) {
      laneMap.delete(id);
    }
  }
}

export const ticker = Ticker.getInstance();
