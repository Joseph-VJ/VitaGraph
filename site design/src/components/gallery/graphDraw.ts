// Canvas drawing helpers for the knowledge graph: pre-rendered sprites and a text-measure cache.
// Everything here is cached by colour, so the per-frame cost is one drawImage per node.

import { darken, lighten, rgba } from "./graphTheme";

const orbCache = new Map<string, HTMLCanvasElement>();
const haloCache = new Map<string, HTMLCanvasElement>();
const mistCache = new Map<string, HTMLCanvasElement>();

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return [canvas, canvas.getContext("2d")];
}

/**
 * A lit sphere, not a flat disc: a soft specular highlight up and to the left,
 * the community colour through the middle, a deeper tone at the rim.
 */
export function getOrbSprite(color: string): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = color.toLowerCase();
  const hit = orbCache.get(key);
  if (hit) return hit;
  const S = 192;
  const [canvas, ctx] = makeCanvas(S);
  if (ctx) {
    const c = S / 2;
    const g = ctx.createRadialGradient(c * 0.76, c * 0.68, S * 0.015, c, c, c - 1);
    g.addColorStop(0, lighten(color, 0.85));
    g.addColorStop(0.2, lighten(color, 0.42));
    g.addColorStop(0.6, color);
    g.addColorStop(1, darken(color, 0.42));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c - 1, 0, Math.PI * 2);
    ctx.fill();
  }
  orbCache.set(key, canvas);
  return canvas;
}

/** Soft halo for hubs, hovered and selected nodes. */
export function getHaloSprite(color: string): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = color.toLowerCase();
  const hit = haloCache.get(key);
  if (hit) return hit;
  const S = 128;
  const [canvas, ctx] = makeCanvas(S);
  if (ctx) {
    const c = S / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, rgba(color, 0.85));
    g.addColorStop(0.28, rgba(color, 0.4));
    g.addColorStop(0.62, rgba(color, 0.1));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  haloCache.set(key, canvas);
  return canvas;
}

/** Community mist: a very soft wash, drawn additively, that makes clusters read as regions. */
export function getMistSprite(color: string): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = color.toLowerCase();
  const hit = mistCache.get(key);
  if (hit) return hit;
  const S = 128;
  const [canvas, ctx] = makeCanvas(S);
  if (ctx) {
    const c = S / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, rgba(color, 0.55));
    g.addColorStop(0.45, rgba(color, 0.2));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  mistCache.set(key, canvas);
  return canvas;
}

const widthCache = new Map<string, number>();

/** measureText is slow enough to matter at 120 labels per frame, so widths are cached. */
export function textWidth(ctx: CanvasRenderingContext2D, font: string, text: string): number {
  const key = `${font}|${text}`;
  const hit = widthCache.get(key);
  if (hit !== undefined) return hit;
  ctx.font = font;
  const w = ctx.measureText(text).width;
  if (widthCache.size > 2000) widthCache.clear();
  widthCache.set(key, w);
  return w;
}

/** Rounded-rectangle path that works in every canvas implementation. */
export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export const FONT_HUB = (px: number) => `600 ${px}px Spectral, Georgia, serif`;
export const FONT_LABEL = (px: number, weight = 500) => `${weight} ${px}px "IBM Plex Sans", sans-serif`;
export const FONT_CAPTION = (px: number) => `italic 500 ${px}px Spectral, Georgia, serif`;
export const FONT_VALUE = (px: number) => `500 ${px}px "IBM Plex Mono", monospace`;
