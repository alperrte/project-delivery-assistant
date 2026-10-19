"use client";
import { useEffect, useState } from "react";

export type ViewportFit = { height: number | null; top: number; keyboard: boolean };

/**
 * Tracks the part of the screen that is really visible. On phones the on-screen keyboard covers the bottom of a
 * fixed layout without resizing it (iOS Safari always, Android Chrome by default), which would hide the chat input.
 * `keyboard` is true while a text field has focus and the visible height has collapsed.
 */
export function useVisualViewport(enabled: boolean): ViewportFit {
  const [fit, setFit] = useState<ViewportFit>({ height: null, top: 0, keyboard: false });
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) return;
    const read = () => {
      const field = document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLInputElement;
      const keyboard = field && viewport.height < (window.screen.height || window.innerHeight) * 0.75;
      const height = Math.round(viewport.height), top = Math.round(viewport.offsetTop);
      setFit(previous => previous.height === height && previous.top === top && previous.keyboard === keyboard ? previous : { height, top, keyboard });
    };
    read();
    // On blur the previous field is still the active element for a moment.
    const later = () => { setTimeout(read, 60); };
    viewport.addEventListener("resize", read);
    viewport.addEventListener("scroll", read);
    document.addEventListener("focusin", read);
    document.addEventListener("focusout", later);
    return () => {
      viewport.removeEventListener("resize", read);
      viewport.removeEventListener("scroll", read);
      document.removeEventListener("focusin", read);
      document.removeEventListener("focusout", later);
    };
  }, [enabled]);
  return enabled ? fit : { height: null, top: 0, keyboard: false };
}
