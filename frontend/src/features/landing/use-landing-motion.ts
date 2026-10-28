"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useReducedMotionPreference } from "@/lib/preferences/motion";

type Gsap = typeof import("gsap")["gsap"];
type ScrollTriggerPlugin = typeof import("gsap/ScrollTrigger")["ScrollTrigger"];
/** `wide` = pin/scrub screens (>=1024x700); everything else gets normal flow with short in-view motion. */
export type SceneTools = { gsap: Gsap; ScrollTrigger: ScrollTriggerPlugin; wide: boolean };

/**
 * Runs `build` after mount, inside `gsap.matchMedia()`, so the server render and the no-JS page keep the final visible state.
 * Nothing runs when motion is reduced. Triggers are reverted on unmount and when the media query flips.
 */
export function useScrollScene(root: RefObject<HTMLElement | null>, build: (tools: SceneTools, root: HTMLElement) => void | (() => void)) {
  const reduce = useReducedMotionPreference();
  const latest = useRef(build);
  useEffect(() => { latest.current = build; });
  useEffect(() => {
    const element = root.current;
    if (!element || reduce) return;
    let disposed = false;
    let cleanup = () => {};
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      const media = gsap.matchMedia();
      media.add({ wide: "(min-width: 1024px) and (min-height: 700px)" }, context => latest.current({ gsap, ScrollTrigger, wide: !!context.conditions?.wide }, element), element);
      cleanup = () => media.revert();
      // Pins push later triggers down; one refresh after every scene registered keeps their start positions right.
      requestAnimationFrame(() => { if (!disposed) ScrollTrigger.refresh(); });
    }).catch(() => { /* The page stays fully readable without the animation chunk. */ });
    return () => { disposed = true; cleanup(); };
  }, [reduce, root]);
}
