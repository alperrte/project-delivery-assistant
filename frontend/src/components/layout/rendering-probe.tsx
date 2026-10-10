"use client";

import { useEffect } from "react";
import { applyRenderer, detectSoftwareRendering, RENDERER_STORAGE_KEY } from "@/lib/rendering";

/**
 * Marks `<html data-renderer="software">` when the browser has no hardware acceleration, so the stylesheet can drop
 * effects that are only affordable on a GPU (see `lib/rendering.ts`). Renders nothing; runs once per tab: the verdict is
 * cached in sessionStorage and applied before paint by the boot script in the root layout.
 */
export function RenderingProbe() {
  useEffect(() => {
    let cached: string | null = null;
    try {
      cached = sessionStorage.getItem(RENDERER_STORAGE_KEY);
    } catch {
      // Storage unavailable: detect on every mount instead.
    }
    if (cached === "software" || cached === "hardware") {
      applyRenderer(cached === "software");
      return;
    }
    const software = detectSoftwareRendering();
    applyRenderer(software);
    try {
      sessionStorage.setItem(RENDERER_STORAGE_KEY, software ? "software" : "hardware");
    } catch {
      // Not cached; the next page detects again.
    }
  }, []);
  return null;
}
