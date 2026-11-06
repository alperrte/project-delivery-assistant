"use client";

import { useEffect, useRef } from "react";
import type { AnimationPreset } from "../theme-animation";

/** Bounded particles, capped DPR and 30fps; no React updates in the render loop. */
export function ThemeScene({ preset, running, onLightning, preview = false }: {
  preset: AnimationPreset; running: boolean; onLightning?: () => void; preview?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!running) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let width = 1, height = 1, frame = 0, previous = 0, elapsed = 0, flash = 0;
    let lightningAt = 12 + Math.random() * 4;
    let particles: { x: number; y: number; speed: number; size: number; phase: number }[] = [];
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      const dpr = Math.min(window.devicePixelRatio || 1, width < 640 ? 1 : 1.5);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = Array.from({ length: preview ? 24 : width < 640 ? 32 : 72 }, () => ({
        x: Math.random() * width, y: Math.random() * height, speed: .5 + Math.random(),
        size: 1 + Math.random() * 2, phase: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (time - previous < 1000 / 30) return;
      const dt = Math.min((time - previous) / 1000, .05); previous = time; elapsed += dt;
      ctx.clearRect(0, 0, width, height);
      if (preset === "WATER") {
        for (let band = 0; band < 4; band++) {
          ctx.beginPath();
          for (let x = 0; x <= width + 12; x += 12) {
            const y = height * (.3 + band * .19) + Math.sin(x / 120 + elapsed * .4 + band) * (12 + band * 5);
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(54,150,183,${.12 + band * .025})`; ctx.lineWidth = 2; ctx.stroke();
        }
      } else {
        const snow = preset === "SNOW";
        ctx.strokeStyle = "rgba(91,143,185,.28)"; ctx.lineWidth = 1;
        for (const p of particles) {
          p.y += dt * p.speed * (snow ? 24 : 350);
          p.x += dt * (snow ? Math.sin(elapsed * .5 + p.phase) * 12 : -38);
          if (p.y > height + 30) { p.y = -30; p.x = Math.random() * width; }
          if (p.x < -30) p.x = width + 20;
          if (snow) {
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(148,175,196,.48)"; ctx.fill();
          } else { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 2, p.y - 9 * p.speed); ctx.stroke(); }
        }
      }
      if (preset === "THUNDERSTORM") {
        if (elapsed > lightningAt) { flash = .16; lightningAt = elapsed + 18 + Math.random() * 14; onLightning?.(); }
        if (flash > 0) {
          // Small, muted local bolt; never a full-screen strobe.
          ctx.strokeStyle = `rgba(132,160,196,${flash * 2})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(width * .82, 0); ctx.lineTo(width * .78, height * .12);
          ctx.lineTo(width * .81, height * .11); ctx.lineTo(width * .76, height * .25); ctx.stroke();
          flash -= dt;
        }
      }
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); ctx.clearRect(0, 0, width, height); };
  }, [preset, running, preview, onLightning]);
  return <div aria-hidden="true" className="theme-scene" data-preset={preset} data-running={running}>
    <canvas ref={ref} className="size-full" />
  </div>;
}
