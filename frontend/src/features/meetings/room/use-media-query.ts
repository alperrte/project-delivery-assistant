"use client";
import { useLayoutEffect, useSyncExternalStore, type RefObject } from "react";

/** Phone-sized call layouts (the `compact` variant of globals.css): narrow screens, and phones held sideways. */
export const COMPACT_QUERY = "(max-width: 767px), (orientation: landscape) and (max-height: 500px)";
/** Wide enough for the side panel next to the stage. */
export const WIDE_QUERY = "(min-width: 1024px) and (min-height: 501px)";

/** A media query as a boolean. False on the server, where no call is ever rendered. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    notify => { const list = window.matchMedia(query); list.addEventListener("change", notify); return () => list.removeEventListener("change", notify); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * On wide screens the call fills what is left of the window under whatever sits above it (the page's own breadcrumb and header),
 * so the stage, the side panel and the bar fit without scrolling the page. Elsewhere the height is the content's.
 */
export function useFitViewport(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const fit = () => {
      if (!window.matchMedia(WIDE_QUERY).matches) { element.style.height = ""; return; }
      const top = element.getBoundingClientRect().top + window.scrollY;
      element.style.height = `${Math.max(544, Math.floor(window.innerHeight - top - 24))}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => { window.removeEventListener("resize", fit); element.style.height = ""; };
  }, [ref, enabled]);
}
