"use client";

import { useEffect, useRef } from "react";
import type { AnimationPreset } from "../theme-animation";
import { createWeatherScene } from "./weather-scene";

/** Bounded particles, capped DPR and 30fps; no React updates in the render loop. */
export function ThemeScene({ preset, running, onLightning }: {
  preset: AnimationPreset; running: boolean; onLightning?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!running) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let frame = 0, previous = 0;
    let scene: ReturnType<typeof createWeatherScene>;
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, width < 640 ? 1 : 1.5);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene = createWeatherScene(ctx, width, height, preset, onLightning);
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (time - previous < 1000 / 30) return;
      const dt = previous ? Math.min((time - previous) / 1000, .05) : 0;
      previous = time;
      scene.draw(dt);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  }, [preset, running, onLightning]);
  return <div aria-hidden="true" className="theme-scene" data-preset={preset} data-running={running}>
    <canvas ref={ref} className="size-full" />
  </div>;
}
