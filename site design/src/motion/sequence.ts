/**
 * VitaGraph Motion Engine — Choreography Scheduler (§M4.3)
 * Event-gated timeline tracks with token offsets, cancel-by-supersede,
 * and frozen-failed state on stream error.
 */

import { ticker } from "./ticker";

export type SequenceState =
  | "idle"
  | "running"
  | "waiting-gate"
  | "completed"
  | "frozen-failed"
  | "cancelled";

export type StepAction = () => void | Promise<void>;
export type GatePromise = Promise<unknown> | (() => Promise<unknown>);

interface SequenceItem {
  type: "action" | "delay" | "gate";
  action?: StepAction;
  durationMs?: number;
  gate?: GatePromise;
}

export class Sequence {
  private items: SequenceItem[] = [];
  private state: SequenceState = "idle";
  private currentIndex: number = 0;
  private currentDelayElapsed: number = 0;
  private unsubscribeTicker: (() => void) | null = null;
  private resolveCompletion: ((success: boolean) => void) | null = null;

  public getState(): SequenceState {
    return this.state;
  }

  /**
   * Add an action to run in the sequence
   */
  public addAction(action: StepAction, delayMs: number = 0): this {
    if (delayMs > 0) {
      this.items.push({ type: "delay", durationMs: delayMs });
    }
    this.items.push({ type: "action", action });
    return this;
  }

  /**
   * Add a delay step
   */
  public wait(ms: number): this {
    if (ms > 0) {
      this.items.push({ type: "delay", durationMs: ms });
    }
    return this;
  }

  /**
   * Add an event gate (§M4.3):
   * Sequence cannot advance past this point until the real event/promise resolves.
   */
  public waitFor(gate: GatePromise): this {
    this.items.push({ type: "gate", gate });
    return this;
  }

  /**
   * Start executing the sequence.
   * Runs actions on ticker L1 lane.
   */
  public play(): Promise<boolean> {
    if (this.state === "running" || this.state === "waiting-gate") {
      return Promise.resolve(false);
    }

    this.state = "running";
    this.currentIndex = 0;
    this.currentDelayElapsed = 0;

    return new Promise<boolean>((resolve) => {
      this.resolveCompletion = resolve;
      this.advance();
    });
  }

  /**
   * Halt immediately and mark as frozen-failed (§M4.3, §M7.10)
   * Used when SSE stream aborts or backend errors mid-choreography.
   */
  public fail(error?: unknown): void {
    if (this.state === "completed" || this.state === "cancelled") return;
    this.cleanupTicker();
    this.state = "frozen-failed";
    console.warn("[Sequence] Stream error: choreography frozen at stage", error);
    if (this.resolveCompletion) {
      this.resolveCompletion(false);
      this.resolveCompletion = null;
    }
  }

  /**
   * Cancel-by-supersede (§M3.13)
   */
  public cancel(): void {
    if (this.state === "completed" || this.state === "cancelled") return;
    this.cleanupTicker();
    this.state = "cancelled";
    if (this.resolveCompletion) {
      this.resolveCompletion(false);
      this.resolveCompletion = null;
    }
  }

  private cleanupTicker(): void {
    if (this.unsubscribeTicker) {
      this.unsubscribeTicker();
      this.unsubscribeTicker = null;
    }
  }

  private advance(): void {
    if (this.state !== "running") return;

    if (this.currentIndex >= this.items.length) {
      this.state = "completed";
      this.cleanupTicker();
      if (this.resolveCompletion) {
        this.resolveCompletion(true);
        this.resolveCompletion = null;
      }
      return;
    }

    const item = this.items[this.currentIndex];

    if (item.type === "action") {
      this.currentIndex++;
      try {
        const res = item.action?.();
        if (res instanceof Promise) {
          res
            .then(() => {
              if (this.state === "running") this.advance();
            })
            .catch((err) => this.fail(err));
        } else {
          this.advance();
        }
      } catch (err) {
        this.fail(err);
      }
      return;
    }

    if (item.type === "delay") {
      const targetDuration = item.durationMs || 0;
      this.currentDelayElapsed = 0;

      this.cleanupTicker();
      this.unsubscribeTicker = ticker.subscribe("L1", (dtMs) => {
        this.currentDelayElapsed += dtMs;
        if (this.currentDelayElapsed >= targetDuration) {
          this.cleanupTicker();
          this.currentIndex++;
          this.advance();
          return false;
        }
        return true;
      });
      return;
    }

    if (item.type === "gate") {
      this.state = "waiting-gate";
      this.cleanupTicker();

      const p = typeof item.gate === "function" ? item.gate() : item.gate;
      if (!p || typeof p.then !== "function") {
        this.state = "running";
        this.currentIndex++;
        this.advance();
        return;
      }

      p.then(() => {
        if (this.state === "waiting-gate") {
          this.state = "running";
          this.currentIndex++;
          this.advance();
        }
      }).catch((err) => {
        this.fail(err);
      });
    }
  }
}

// Registry for cancel-by-supersede per element (§M3.13, §M4.3)
const activeElementSequences = new Map<string, Sequence>();

/**
 * Schedule a sequence for an element, automatically superseding and cancelling
 * any sequence currently active on that element.
 */
export function scheduleFor(elementId: string, sequence: Sequence): Promise<boolean> {
  const existing = activeElementSequences.get(elementId);
  if (existing) {
    existing.cancel();
  }
  activeElementSequences.set(elementId, sequence);
  return sequence.play().finally(() => {
    if (activeElementSequences.get(elementId) === sequence) {
      activeElementSequences.delete(elementId);
    }
  });
}
