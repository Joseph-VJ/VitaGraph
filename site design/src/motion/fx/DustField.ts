/**
 * VitaGraph Motion Engine — Dust Field Particle Primitive (§M4.7, §M8.3, Gate 28)
 * Pooled particles spawned at activated graph nodes with damped outward drift.
 * Active strictly on Tier T3 (showcase), pooled with zero allocations per frame.
 */

import { governor } from "../quality";

export interface DustParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  alpha: number;
  maxAlpha: number;
  color: string;
  radius: number;
}

const MAX_DUST = 40; // Gate 28 budget: <= 40 alive
const dustPool: DustParticle[] = Array.from({ length: MAX_DUST }, () => ({
  active: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 0,
  maxLife: 1600,
  alpha: 0.2,
  maxAlpha: 0.25,
  color: "#79B8A6",
  radius: 1.5,
}));

export class DustManager {
  public static spawn(x: number, y: number, color: string = "#79B8A6", count: number = 4): void {
    if (governor.getState().tier !== "T3") return;

    let spawned = 0;
    for (let i = 0; i < MAX_DUST && spawned < count; i++) {
      const p = dustPool[i];
      if (p.active) continue;

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.2 + Math.random() * 0.4; // Damped outward drift

      p.active = true;
      p.x = x + (Math.random() - 0.5) * 6;
      p.y = y + (Math.random() - 0.5) * 6;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0;
      p.maxLife = 1000 + Math.random() * 600; // <= 1.6s lifetime
      p.maxAlpha = 0.15 + Math.random() * 0.10; // alpha <= 0.25
      p.alpha = 0;
      p.color = color;
      p.radius = 1.0 + Math.random() * 1.0;
      spawned++;
    }
  }

  public static update(dt: number = 16.67): void {
    if (governor.getState().tier !== "T3") {
      this.reset();
      return;
    }

    const step = dt / 16.67;
    for (let i = 0; i < MAX_DUST; i++) {
      const p = dustPool[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }

      // Damped physics: velocity decays slightly each frame
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.x += p.vx * step;
      p.y += p.vy * step;

      // Alpha envelope: fade in first 20%, fade out last 40%
      const progress = p.life / p.maxLife;
      if (progress < 0.2) {
        p.alpha = (progress / 0.2) * p.maxAlpha;
      } else if (progress > 0.6) {
        p.alpha = (1 - (progress - 0.6) / 0.4) * p.maxAlpha;
      } else {
        p.alpha = p.maxAlpha;
      }
    }
  }

  public static render(ctx: CanvasRenderingContext2D): void {
    if (governor.getState().tier !== "T3") return;

    for (let i = 0; i < MAX_DUST; i++) {
      const p = dustPool[i];
      if (!p.active || p.alpha <= 0.01) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  public static getActiveCount(): number {
    return dustPool.filter((p) => p.active).length;
  }

  public static reset(): void {
    for (let i = 0; i < MAX_DUST; i++) {
      dustPool[i].active = false;
    }
  }
}
