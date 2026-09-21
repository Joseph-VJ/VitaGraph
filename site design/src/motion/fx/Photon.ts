/**
 * VitaGraph Motion Engine — Photon Particle Traveler Primitive (§M4.7, §M8.3, Gate 28)
 * Pooled particles that travel along curved bezier graph edges from evidence chunks
 * to activated concept nodes. Speed is proportional to 1/latency.
 */

import { governor } from "../quality";

export interface PhotonParticle {
  active: boolean;
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  cpx: number;
  cpy: number;
  progress: number;
  speed: number;
  color: string;
  alpha: number;
}

const MAX_PHOTONS = 24; // Gate 28 budget: <= 24 alive
const photonPool: PhotonParticle[] = Array.from({ length: MAX_PHOTONS }, () => ({
  active: false,
  x: 0,
  y: 0,
  sx: 0,
  sy: 0,
  tx: 0,
  ty: 0,
  cpx: 0,
  cpy: 0,
  progress: 0,
  speed: 0.02,
  color: "#79B8A6",
  alpha: 0.5,
}));

export class PhotonManager {
  public static spawn(
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    color: string = "#79B8A6",
    latencyMs: number = 400
  ): boolean {
    if (governor.getState().tier !== "T3") return false;

    const photon = photonPool.find((p) => !p.active);
    if (!photon) return false;

    // Calculate bezier curve control point with physical bow
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const bow = Math.min(dist * 0.2, 30);
    const cpx = mx - (dy / (dist || 1)) * bow;
    const cpy = my + (dx / (dist || 1)) * bow;

    // Speed proportional to 1 / latency (telemetry honesty)
    const baseSpeed = Math.min(0.04, Math.max(0.008, 600 / (latencyMs || 400) * 0.015));

    photon.active = true;
    photon.sx = sx;
    photon.sy = sy;
    photon.tx = tx;
    photon.ty = ty;
    photon.cpx = cpx;
    photon.cpy = cpy;
    photon.progress = 0;
    photon.speed = baseSpeed;
    photon.color = color;
    photon.alpha = 0.5;

    return true;
  }

  public static update(dt: number = 16.67): void {
    const step = dt / 16.67;
    for (let i = 0; i < MAX_PHOTONS; i++) {
      const p = photonPool[i];
      if (!p.active) continue;

      p.progress += p.speed * step;
      if (p.progress >= 1.0) {
        p.active = false;
        continue;
      }

      // Quadratic bezier formula
      const t = p.progress;
      const invT = 1 - t;
      p.x = invT * invT * p.sx + 2 * invT * t * p.cpx + t * t * p.tx;
      p.y = invT * invT * p.sy + 2 * invT * t * p.cpy + t * t * p.ty;

      // Vanish with a 120ms alpha fade on arrival
      if (t > 0.8) {
        p.alpha = 0.5 * ((1 - t) / 0.2);
      }
    }
  }

  public static render(ctx: CanvasRenderingContext2D): void {
    if (governor.getState().tier !== "T3") return;

    for (let i = 0; i < MAX_PHOTONS; i++) {
      const p = photonPool[i];
      if (!p.active) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  public static getActiveCount(): number {
    return photonPool.filter((p) => p.active).length;
  }

  public static reset(): void {
    for (let i = 0; i < MAX_PHOTONS; i++) {
      photonPool[i].active = false;
    }
  }
}
