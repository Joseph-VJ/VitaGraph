export type BackgroundEngineName = "warp" | "flow" | "stars" | "type";
export type BackgroundStrength = "off" | "soft" | "full";
export type BackgroundForce = "attract" | "repel";

export interface FreeAreaRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface BackgroundColors {
  ink: string;
  acc: string;
  bg: string;
  n7: string;
}

export interface BackgroundState {
  W: number;
  H: number;
  dpr: number;
  engine: BackgroundEngineName;
  str: BackgroundStrength;
  playing: boolean;
  force: BackgroundForce;
  lastDraw: number;
  frames: number;
  fpsT: number;
  fps: number;
  mouse: {
    x: number;
    y: number;
    on: boolean;
    down: boolean;
    vx: number;
    vy: number;
  };
}

export interface BackgroundEvents {
  think: boolean;
  upload: { t0: number } | null;
  stage: number;
}

export interface EngineContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  bg: BackgroundState;
  ev: BackgroundEvents;
  colors: BackgroundColors;
  freeArea: () => FreeAreaRect;
  strength: () => number;
  areaK: () => number;
}

export interface BackgroundEngineInstance {
  text: string;
  play: string;
  init?: () => void;
  resize?: () => void;
  reset: () => void;
  setCount?: () => void;
  count: () => string;
  event?: (kind: "think" | "stage" | "done") => void;
  click?: (x: number, y: number, power?: number) => void;
  frame: (now: number, s: number, dt: number) => void;
  still: () => void;
  // Specific controls
  pin?: boolean;
  wells?: Array<{ x: number; y: number }>;
  storm?: boolean;
  paint?: boolean;
  red?: boolean;
  form?: "free" | "graph";
  setWord?: (word: string) => void;
}
