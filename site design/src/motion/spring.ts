/**
 * VitaGraph Motion Engine — Spring Solver & CSS linear() Generator (§M2.3, §M4.2)
 * Semi-implicit Euler ODE solver + RDP-simplified linear(...) generator.
 */

import { features } from "./features";

export type SpringPresetName = "snappy" | "weighted" | "camera" | "paper";

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
  overshootMax?: number; // Gate 17: max 0.02 (2%)
}

export const SPRING_PRESETS: Record<SpringPresetName, SpringConfig> = {
  // snappy: stiffness 420, damping 42, mass 1 (zeta ~1.02)
  snappy: { stiffness: 420, damping: 42, mass: 1, overshootMax: 0.0 },
  // weighted: stiffness 170, damping 26, mass 1 (zeta ~1.00)
  weighted: { stiffness: 170, damping: 26, mass: 1, overshootMax: 0.0 },
  // camera: stiffness 90, damping 20, mass 1.2 (zeta ~1.03)
  camera: { stiffness: 90, damping: 20, mass: 1.2, overshootMax: 0.0 },
  // paper: stiffness 120, damping 21, mass 1.4 (zeta ~0.94, overshoot <= 1.8%)
  paper: { stiffness: 120, damping: 21, mass: 1.4, overshootMax: 0.018 },
};

export const SPRING_FALLBACK_EASING: Record<SpringPresetName, string> = {
  snappy: "cubic-bezier(0.30, 0.80, 0.20, 1)", // detent
  weighted: "cubic-bezier(0.40, 0, 0.20, 1)",  // glide
  camera: "cubic-bezier(0.32, 0, 0.24, 1)",   // servo
  paper: "cubic-bezier(0.16, 1, 0.30, 1)",    // paper
};

/**
 * Semi-implicit Euler step for 1D spring physics (§M2.3)
 * dt is in milliseconds, clamped to [1, 34] ms.
 */
export class Spring {
  public current: number;
  public target: number;
  public velocity: number;
  public config: SpringConfig;
  public isAtRest: boolean;

  constructor(initialValue: number = 0, config: SpringConfig | SpringPresetName = "snappy") {
    this.current = initialValue;
    this.target = initialValue;
    this.velocity = 0;
    this.config = typeof config === "string" ? SPRING_PRESETS[config] : config;
    this.isAtRest = true;
  }

  /**
   * Set target value preserving existing velocity (physical continuity, §M4.2)
   */
  public setTarget(newTarget: number): void {
    if (this.target !== newTarget) {
      this.target = newTarget;
      this.isAtRest = false;
    }
  }

  /**
   * Reset position and velocity instantly
   */
  public reset(value: number): void {
    this.current = value;
    this.target = value;
    this.velocity = 0;
    this.isAtRest = true;
  }

  /**
   * Advance simulation by dt milliseconds (clamped to [1, 34] ms)
   * Rest condition: |v| < 0.4 px/s and |x - target| < 0.2 px (§M2.3)
   */
  public step(dtMs: number): number {
    if (this.isAtRest) {
      return this.current;
    }

    // Clamped dt in seconds: [0.001, 0.034]
    const clampedDtMs = Math.max(1, Math.min(34, dtMs));
    const dt = clampedDtMs / 1000;

    const displacement = this.current - this.target;
    const springForce = -this.config.stiffness * displacement;
    const dampingForce = -this.config.damping * this.velocity;
    const acceleration = (springForce + dampingForce) / this.config.mass;

    // Semi-implicit Euler
    this.velocity += acceleration * dt;
    this.current += this.velocity * dt;

    // Rest check: velocity < 0.4 units/s, distance < 0.2 units
    if (Math.abs(this.velocity) < 0.4 && Math.abs(this.current - this.target) < 0.2) {
      this.current = this.target;
      this.velocity = 0;
      this.isAtRest = true;
    }

    return this.current;
  }
}

// Point for RDP simplification: [normalizedTime 0..1, normalizedValue]
type Point2D = [number, number];

/**
 * Perpendicular distance from point P to line segment AB
 */
function perpendicularDistance(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const magSq = dx * dx + dy * dy;

  if (magSq === 0) {
    const dpx = p[0] - a[0];
    const dpy = p[1] - a[1];
    return Math.sqrt(dpx * dpx + dpy * dpy);
  }

  const num = Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]);
  return num / Math.sqrt(magSq);
}

/**
 * Ramer–Douglas–Peucker algorithm for polyline simplification
 */
function ramerDouglasPeucker(points: Point2D[], epsilon: number): Point2D[] {
  if (points.length <= 2) {
    return points;
  }

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const recResults1 = ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
    const recResults2 = ramerDouglasPeucker(points.slice(index), epsilon);
    return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
  } else {
    return [points[0], points[end]];
  }
}

// In-memory cache for linear() strings
const linearCache = new Map<string, string>();

/**
 * Solves a spring from 0 to 1 step-by-step, validates overshoot,
 * runs RDP simplification to <= 28 points, and returns CSS linear() string (§M2.3).
 */
export function generateSpringLinear(preset: SpringPresetName | SpringConfig): string {
  const config = typeof preset === "string" ? SPRING_PRESETS[preset] : preset;
  const cacheKey =
    typeof preset === "string"
      ? preset
      : `${config.stiffness}-${config.damping}-${config.mass}`;

  if (linearCache.has(cacheKey)) {
    return linearCache.get(cacheKey)!;
  }

  // If linear easing is not supported in current environment, return named fallback
  if (!features.linearEasing && typeof preset === "string" && SPRING_FALLBACK_EASING[preset]) {
    return SPRING_FALLBACK_EASING[preset];
  }

  // 1. Simulate ODE with dt = 16ms (0.016s)
  const dt = 0.016; // 16ms sample rate (§M2.3)
  const dtMs = 16;
  const sim = new Spring(0, config);
  sim.setTarget(1.0);

  const rawPoints: Point2D[] = [[0, 0]];
  let maxVal = 0;
  let t = 0;
  const maxTime = 2.0; // 2 seconds safety cutoff

  while (!sim.isAtRest && t < maxTime) {
    t += dt;
    const val = sim.step(dtMs);
    if (val > maxVal) {
      maxVal = val;
    }
    rawPoints.push([t, val]);
  }

  // Final point lands exactly on target 1.0 (Gate 27, Gate 17)
  const totalDuration = t;
  rawPoints.push([totalDuration, 1.0]);

  // Validate overshoot constraint: Gate 17 (overshoot <= 2%)
  const overshoot = Math.max(0, maxVal - 1.0);
  if (overshoot > 0.02) {
    console.warn(`[Spring] Gate 17 violation: overshoot ${(overshoot * 100).toFixed(2)}% > 2% for preset`);
  }

  // 2. Normalize time to 0..1
  const normalizedPoints: Point2D[] = rawPoints.map(([ptTime, ptVal]) => [
    ptTime / totalDuration,
    ptVal,
  ]);

  // 3. RDP simplify to <= 28 points
  let epsilon = 0.002;
  let simplified = ramerDouglasPeucker(normalizedPoints, epsilon);
  while (simplified.length > 28) {
    epsilon *= 1.25;
    simplified = ramerDouglasPeucker(normalizedPoints, epsilon);
  }

  // 4. Format CSS linear() syntax: linear(val t%, ...)
  const segments: string[] = [];
  for (let i = 0; i < simplified.length; i++) {
    const [progress, val] = simplified[i];
    const valStr = val.toFixed(3).replace(/\.?0+$/, "");
    const pctStr = (progress * 100).toFixed(1).replace(/\.?0+$/, "") + "%";

    if (i === 0) {
      segments.push("0");
    } else if (i === simplified.length - 1) {
      segments.push("1");
    } else {
      segments.push(`${valStr} ${pctStr}`);
    }
  }

  const cssString = `linear(${segments.join(", ")})`;
  linearCache.set(cacheKey, cssString);
  return cssString;
}

/**
 * Public helper per §M2.3: springToLinear(preset)
 */
export function springToLinear(preset: SpringPresetName | SpringConfig): string {
  return generateSpringLinear(preset);
}
