import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { usePreferences, setPreference } from "../../lib/preferences";
import { subscribe as subscribeActivity } from "../../lib/appActivity";
import type {
  BackgroundEngineName,
  BackgroundForce,
  EngineContext,
  BackgroundEngineInstance,
  FreeAreaRect,
  BackgroundState,
} from "./types";
import { createWarpEngine } from "./warp";
import { createFlowEngine } from "./flow";
import { createStarsEngine } from "./stars";
import { createTypeEngine } from "./typeE";

declare global {
  interface Window {
    __livingBackground?: {
      engine: BackgroundEngineName;
      strength: string;
      fps: number;
      events: Array<Record<string, unknown>>;
    };
  }
}

export const LivingBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const location = useLocation();
  const prefs = usePreferences();

  const [playing, setPlaying] = useState(false);
  const [force, setForce] = useState<BackgroundForce>("attract");
  const [engineCount, setEngineCount] = useState<string>("");
  const [typeWord, setTypeWord] = useState<string>("VITAGRAPH");

  // Track animation frame and activity
  const animFrameIdRef = useRef<number | null>(null);
  const eventsLogRef = useRef<Array<Record<string, unknown>>>([]);
  const lastFinishedRef = useRef<number>(0);

  // Engine instance storage
  const enginesRef = useRef<Record<BackgroundEngineName, BackgroundEngineInstance | null>>({
    warp: null,
    flow: null,
    stars: null,
    type: null,
  });

  const bgStateRef = useRef<BackgroundState>({
    W: 0,
    H: 0,
    dpr: 1,
    engine: prefs.backgroundEngine,
    str: prefs.background,
    playing: false,
    force: "attract",
    lastDraw: 0,
    frames: 0,
    fpsT: 0,
    fps: 0,
    mouse: { x: -9999, y: -9999, on: false, down: false, vx: 0, vy: 0 },
  });

  const evStateRef = useRef({
    think: false,
    upload: null as { t0: number } | null,
    stage: -1,
  });

  // Keep bgStateRef in sync with preferences and play state
  useEffect(() => {
    bgStateRef.current.engine = prefs.backgroundEngine;
    bgStateRef.current.str = prefs.background;
    bgStateRef.current.playing = playing;
    bgStateRef.current.force = force;
  }, [prefs.backgroundEngine, prefs.background, playing, force]);

  const isGraphRoute = location.pathname === "/graph" || location.pathname === "/text-to-graph";

  const freeArea = useCallback((): FreeAreaRect => {
    const W = bgStateRef.current.W;
    const H = bgStateRef.current.H;
    if (bgStateRef.current.playing || W <= 960) {
      return { x0: 0, x1: W, y0: 0, y1: H };
    }
    const mainEl = document.getElementById("main-content");
    if (!mainEl) {
      return { x0: W * 0.45, x1: W, y0: 76, y1: H - 40 };
    }
    const contentChild = (mainEl.firstElementChild as HTMLElement) || mainEl;
    const rect = contentChild.getBoundingClientRect();
    const left = rect.right + 24;
    if (W - left >= 240) {
      return { x0: Math.min(left, W * 0.72), x1: W, y0: 76, y1: H - 40 };
    }
    return { x0: 244, x1: W, y0: 76, y1: H - 40 };
  }, []);

  const getColors = useCallback(() => {
    if (typeof document === "undefined") {
      return { ink: "rgb(32, 30, 29)", acc: "rgb(236, 48, 19)", bg: "rgb(243, 242, 242)", n7: "rgb(96, 93, 93)" };
    }
    const root = getComputedStyle(document.documentElement);
    return {
      ink: root.getPropertyValue("--color-text").trim() || "rgb(32, 30, 29)",
      acc: root.getPropertyValue("--color-accent").trim() || "rgb(236, 48, 19)",
      bg: root.getPropertyValue("--color-bg").trim() || "rgb(243, 242, 242)",
      n7: root.getPropertyValue("--color-neutral-700").trim() || "rgb(96, 93, 93)",
    };
  }, []);

  // The chosen level (30 to 200 %): above 100 % the engines draw stronger, below 100 % the canvas fades (see opacity below).
  const levelRef = useRef(prefs.backgroundLevel / 100);
  useEffect(() => {
    levelRef.current = prefs.backgroundLevel / 100;
  }, [prefs.backgroundLevel]);

  const strength = useCallback(() => {
    const boost = Math.max(1, levelRef.current);
    if (bgStateRef.current.playing) return 1.4 * boost;
    if (bgStateRef.current.str === "full") return 1.7 * boost;
    if (bgStateRef.current.str === "soft") return 0.75 * boost;
    return 0;
  }, []);

  const areaK = useCallback(() => {
    const area = bgStateRef.current.W * bgStateRef.current.H;
    return Math.min(1.5, Math.max(0.35, area / 1300000));
  }, []);

  // Update dev hook
  const updateDevHook = useCallback(() => {
    if (import.meta.env.DEV) {
      window.__livingBackground = {
        engine: bgStateRef.current.engine,
        strength: bgStateRef.current.str,
        fps: bgStateRef.current.fps,
        events: eventsLogRef.current,
      };
    }
  }, []);

  // Initialize or retrieve current engine
  const getCurrentEngine = useCallback((): BackgroundEngineInstance | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const engName = bgStateRef.current.engine;
    if (enginesRef.current[engName]) {
      return enginesRef.current[engName];
    }

    const engineContext: EngineContext = {
      canvas,
      ctx,
      bg: bgStateRef.current,
      ev: evStateRef.current,
      colors: getColors(),
      freeArea,
      strength,
      areaK,
    };

    let instance: BackgroundEngineInstance;
    switch (engName) {
      case "warp":
        instance = createWarpEngine(engineContext);
        break;
      case "flow":
        instance = createFlowEngine(engineContext);
        break;
      case "stars":
        instance = createStarsEngine(engineContext);
        break;
      case "type":
        instance = createTypeEngine(engineContext);
        break;
    }

    if (instance.init) instance.init();
    enginesRef.current[engName] = instance;
    return instance;
  }, [freeArea, getColors, strength, areaK]);

  // Enter and exit play mode
  const enterPlay = useCallback(() => {
    setPlaying(true);
    bgStateRef.current.playing = true;
    document.body.classList.add("playing");
    const eng = getCurrentEngine();
    if (eng?.setCount) eng.setCount();
    if (prefs.reduceMotion) {
      eng?.still();
    }
  }, [getCurrentEngine, prefs.reduceMotion]);

  const exitPlay = useCallback(() => {
    setPlaying(false);
    bgStateRef.current.playing = false;
    document.body.classList.remove("playing");
    const eng = getCurrentEngine();
    if (eng?.setCount) eng.setCount();
    if (prefs.reduceMotion) {
      eng?.still();
    }
  }, [getCurrentEngine, prefs.reduceMotion]);

  // Listen to custom enter-play event
  useEffect(() => {
    const handleEnterPlay = () => enterPlay();
    window.addEventListener("vitagraph:enter-play", handleEnterPlay);
    return () => {
      window.removeEventListener("vitagraph:enter-play", handleEnterPlay);
    };
  }, [enterPlay]);

  // Keyboard navigation for play mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && playing) {
        exitPlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [playing, exitPlay]);

  // Pointer move / down / up handlers
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const m = bgStateRef.current.mouse;
      m.vx = e.clientX - m.x;
      m.vy = e.clientY - m.y;
      m.x = e.clientX;
      m.y = e.clientY;
      m.on = true;
    };

    const handleMouseLeave = () => {
      bgStateRef.current.mouse.on = false;
    };

    const handlePointerDown = (e: PointerEvent) => {
      bgStateRef.current.mouse.down = true;
      if (bgStateRef.current.str === "off" && !bgStateRef.current.playing) return;
      if (isGraphRoute && !bgStateRef.current.playing) return;

      const target = e.target as Element | null;
      if (!bgStateRef.current.playing) {
        if (
          target?.closest?.(
            "button, a, input, select, label, textarea, summary, table, dialog, [role=dialog], .playbar, .box2, .panel, .stage, .head, .foot, .side"
          )
        ) {
          return;
        }
      } else {
        if (target?.closest?.(".playbar")) return;
      }

      const eng = getCurrentEngine();
      if (eng?.click) {
        eng.click(e.clientX, e.clientY);
      }
      if (prefs.reduceMotion) {
        eng?.still();
      }
    };

    const handlePointerUp = () => {
      bgStateRef.current.mouse.down = false;
    };

    window.addEventListener("pointermove", handlePointerMove);
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [getCurrentEngine, isGraphRoute, prefs.reduceMotion]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = window.innerWidth;
      const h = window.innerHeight;
      bgStateRef.current.dpr = dpr;
      bgStateRef.current.W = w;
      bgStateRef.current.H = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);

      Object.values(enginesRef.current).forEach((eng) => {
        if (eng?.resize) eng.resize();
      });

      const currentEng = getCurrentEngine();
      if (prefs.reduceMotion) {
        currentEng?.still();
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [getCurrentEngine, prefs.reduceMotion]);

  // Visibility change listener
  useEffect(() => {
    const handleVisibility = () => {
      bgStateRef.current.lastDraw = 0;
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Activity subscription: connect real events to living background
  useEffect(() => {
    const unsubscribe = subscribeActivity((activity) => {
      const eng = getCurrentEngine();

      // 1. Agent busy state
      if (activity.agentBusy !== evStateRef.current.think) {
        evStateRef.current.think = activity.agentBusy;
        eventsLogRef.current.push({
          type: "think",
          busy: activity.agentBusy,
          timestamp: Date.now(),
        });
        if (eng?.event) eng.event("think");
        if (prefs.reduceMotion) eng?.still();
      }

      // 2. Upload stage state
      if (activity.upload !== null) {
        if (!evStateRef.current.upload || evStateRef.current.stage !== activity.upload.stage) {
          if (!evStateRef.current.upload) {
            evStateRef.current.upload = { t0: performance.now() };
          }
          evStateRef.current.stage = activity.upload.stage;
          eventsLogRef.current.push({
            type: "stage",
            stage: activity.upload.stage,
            timestamp: Date.now(),
          });
          if (eng?.event) eng.event("stage");
          if (prefs.reduceMotion) eng?.still();
        }
      } else if (evStateRef.current.upload !== null) {
        // Upload cleared
        evStateRef.current.upload = null;
        evStateRef.current.stage = -1;
      }

      // 3. Scan finished counter
      if (activity.finished > lastFinishedRef.current) {
        lastFinishedRef.current = activity.finished;
        eventsLogRef.current.push({
          type: "done",
          count: activity.finished,
          timestamp: Date.now(),
        });
        if (eng?.event) eng.event("done");
        if (prefs.reduceMotion) eng?.still();
      }

      updateDevHook();
    });

    return () => {
      unsubscribe();
    };
  }, [getCurrentEngine, prefs.reduceMotion, updateDevHook]);

  // Main animation render loop
  useEffect(() => {
    const isOff = prefs.background === "off" && !playing;
    const shouldSkipDraw = isOff || isGraphRoute;

    const eng = getCurrentEngine();
    if (eng) {
      setEngineCount(eng.count());
    }

    if (prefs.reduceMotion) {
      if (!shouldSkipDraw && eng) {
        eng.still();
      }
      updateDevHook();
      return;
    }

    if (shouldSkipDraw) {
      updateDevHook();
      return;
    }

    let isRunning = true;

    const loop = (now: number) => {
      if (!isRunning) return;

      if (!document.hidden && !shouldSkipDraw) {
        const cap = bgStateRef.current.playing || bgStateRef.current.str === "full" ? 60 : 30;
        if (now - bgStateRef.current.lastDraw >= 1000 / cap - 2) {
          const dt = bgStateRef.current.lastDraw
            ? Math.min(50, now - bgStateRef.current.lastDraw)
            : 16.7;
          bgStateRef.current.lastDraw = now;

          const currentEng = getCurrentEngine();
          if (currentEng) {
            currentEng.frame(now, strength(), dt);
            bgStateRef.current.frames++;
            if (now - bgStateRef.current.fpsT > 1000) {
              bgStateRef.current.fps = bgStateRef.current.frames;
              bgStateRef.current.frames = 0;
              bgStateRef.current.fpsT = now;
              setEngineCount(currentEng.count());
              updateDevHook();
            }
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [
    prefs.background,
    prefs.backgroundEngine,
    prefs.backgroundLevel,
    prefs.reduceMotion,
    playing,
    isGraphRoute,
    getCurrentEngine,
    strength,
    updateDevHook,
  ]);

  const isHidden = (prefs.background === "off" && !playing) || isGraphRoute;

  return (
    <>
      <canvas
        id="field"
        ref={canvasRef}
        aria-hidden="true"
        style={{
          display: isHidden ? "none" : "block",
          opacity: playing ? 1 : Math.min(1, prefs.backgroundLevel / 100),
        }}
      />

      {/* Play Mode Title Overlay */}
      {playing && (
        <div className="playtitle" aria-label="Play mode active">
          Play mode
        </div>
      )}

      {/* Play Mode Floating Bottom Controls Bar */}
      {playing && (
        <div className="playbar" role="toolbar" aria-label="Play mode controls">
          {/* Pointer force toggle */}
          <button
            type="button"
            className="btn btn-small"
            aria-pressed={force === "attract"}
            onClick={() => setForce((prev) => (prev === "attract" ? "repel" : "attract"))}
          >
            {force === "attract" ? "Pull" : "Push"}
          </button>

          {/* Engine Selector segmented control */}
          <div className="seg" role="group" aria-label="Engine selector">
            <button
              type="button"
              aria-pressed={prefs.backgroundEngine === "warp"}
              onClick={() => setPreference("backgroundEngine", "warp")}
            >
              Warp
            </button>
            <button
              type="button"
              aria-pressed={prefs.backgroundEngine === "flow"}
              onClick={() => setPreference("backgroundEngine", "flow")}
            >
              Flow
            </button>
            <button
              type="button"
              aria-pressed={prefs.backgroundEngine === "stars"}
              onClick={() => setPreference("backgroundEngine", "stars")}
            >
              Stars
            </button>
            <button
              type="button"
              aria-pressed={prefs.backgroundEngine === "type"}
              onClick={() => setPreference("backgroundEngine", "type")}
            >
              Type
            </button>
          </div>

          {/* Per-engine specific tools */}
          {prefs.backgroundEngine === "warp" && (
            <span className="tools" data-tools="warp">
              <button
                type="button"
                className="btn btn-small"
                aria-pressed={enginesRef.current.warp?.pin || false}
                onClick={() => {
                  const w = enginesRef.current.warp;
                  if (w) w.pin = !w.pin;
                }}
              >
                Pin wells
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  const w = enginesRef.current.warp;
                  if (w) w.wells = [];
                }}
              >
                Clear wells
              </button>
            </span>
          )}

          {prefs.backgroundEngine === "flow" && (
            <span className="tools" data-tools="flow">
              <button
                type="button"
                className="btn btn-small"
                aria-pressed={enginesRef.current.flow?.storm || false}
                onClick={() => {
                  const fl = enginesRef.current.flow;
                  if (fl) fl.storm = !fl.storm;
                }}
              >
                Storm
              </button>
              <button
                type="button"
                className="btn btn-small"
                aria-pressed={enginesRef.current.flow?.paint || false}
                onClick={() => {
                  const fl = enginesRef.current.flow;
                  if (fl) fl.paint = !fl.paint;
                }}
              >
                Paint current
              </button>
              <button
                type="button"
                className="btn btn-small"
                aria-pressed={enginesRef.current.flow?.red || false}
                onClick={() => {
                  const fl = enginesRef.current.flow;
                  if (fl) fl.red = !fl.red;
                }}
              >
                Red ink
              </button>
            </span>
          )}

          {prefs.backgroundEngine === "stars" && (
            <span className="tools" data-tools="stars">
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  const st = enginesRef.current.stars;
                  if (st) st.form = "graph";
                }}
              >
                Tidy into graph
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  const st = enginesRef.current.stars;
                  if (st) st.form = "free";
                }}
              >
                Scatter
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  const st = enginesRef.current.stars;
                  if (st?.click) {
                    for (let i = 0; i < 10; i++) {
                      st.click(
                        window.innerWidth * (0.2 + Math.random() * 0.6),
                        window.innerHeight * (0.2 + Math.random() * 0.6)
                      );
                    }
                  }
                }}
              >
                Add 10 dots
              </button>
            </span>
          )}

          {prefs.backgroundEngine === "type" && (
            <span className="tools" data-tools="type">
              <input
                maxLength={12}
                aria-label="A word for the dots"
                placeholder="Type a word"
                value={typeWord}
                onChange={(e) => setTypeWord(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    enginesRef.current.type?.setWord?.(typeWord);
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-small"
                onClick={() => enginesRef.current.type?.setWord?.(typeWord)}
              >
                Form it
              </button>
            </span>
          )}

          {/* Dot/line count indicator */}
          <span className="count">{engineCount}</span>

          {/* Exit Play Mode button */}
          <button type="button" className="btn btn-primary btn-small" onClick={exitPlay}>
            Exit (Esc)
          </button>
        </div>
      )}
    </>
  );
};
