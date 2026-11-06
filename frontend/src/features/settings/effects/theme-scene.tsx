"use client";

import { useEffect, useRef } from "react";
import type { AnimationPreset } from "../theme-animation";
import { createWeatherScene } from "./weather-scene";

/** Bounded particles, capped DPR and 30fps; no React updates in the render loop. */
export function ThemeScene({ preset, running, onLightning }: {
  preset: AnimationPreset; running: boolean; onLightning?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const controller = useRef<{ setRunning: (value: boolean) => void } | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let frame = 0, previous = 0, active = false, width = 0, height = 0, dpr = 0;
    let scene: ReturnType<typeof createWeatherScene> | undefined;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(devicePixelRatio || 1, bounds.width < 640 ? 1 : 1.5);
      if (bounds.width <= 0 || bounds.height <= 0 || (bounds.width === width && bounds.height === height && ratio === dpr)) return;
      // Resizing clears a Canvas. Keep a paused frame visible at the new viewport size.
      const frozen = !active && scene ? document.createElement("canvas") : undefined;
      if (frozen) {
        frozen.width = canvas.width; frozen.height = canvas.height;
        frozen.getContext("2d")?.drawImage(canvas, 0, 0);
      }
      width = bounds.width; height = bounds.height; dpr = ratio;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene = createWeatherScene(ctx, width, height, preset, onLightning);
      if (frozen) ctx.drawImage(frozen, 0, 0, width, height);
      else scene.draw(0);
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    const draw = (time: number) => {
      if (!active) return;
      frame = requestAnimationFrame(draw);
      if (time - previous < 1000 / 30) return;
      const dt = previous ? Math.min((time - previous) / 1000, .05) : 0;
      previous = time;
      scene?.draw(dt);
    };
    const control = { setRunning(value: boolean) {
      if (active === value) return;
      active = value;
      cancelAnimationFrame(frame); previous = 0;
      if (active) frame = requestAnimationFrame(draw);
    } };
    controller.current = control;
    return () => {
      control.setRunning(false); observer.disconnect();
      if (controller.current === control) controller.current = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [preset, onLightning]);
  useEffect(() => { controller.current?.setRunning(running); }, [running, preset, onLightning]);
  return <div aria-hidden="true" className="theme-scene" data-preset={preset} data-running={running}>
    <canvas ref={ref} className="size-full" />
  </div>;
}
