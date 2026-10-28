"use client";

import type { ElementType, ReactNode, RefObject } from "react";
import { cn } from "@/lib/utils";
import { useScrollScene } from "./use-landing-motion";

export type RevealFrom = "left" | "right" | "up";

/** Marks a block that slides in from its side once, when it scrolls into view. The server render is the final state. */
export function Reveal({ from = "up", delay = 0, as: Tag = "div", className, children }: { from?: RevealFrom; delay?: number; as?: ElementType; className?: string; children: ReactNode }) {
  return <Tag data-reveal={from} data-reveal-delay={delay || undefined} className={cn(className)}>{children}</Tag>;
}

/** One scene for every `[data-reveal]` below `root`: short on phones (no sideways travel), wider on large screens. */
export function useRevealScene(root: RefObject<HTMLElement | null>) {
  useScrollScene(root, ({ gsap, ScrollTrigger, wide }, element) => {
    element.querySelectorAll<HTMLElement>("[data-reveal]").forEach(node => {
      const from = node.dataset.reveal as RevealFrom;
      const distance = wide ? 96 : 28;
      gsap.from(node, {
        autoAlpha: 0, x: from === "left" ? -distance : from === "right" ? distance : 0, y: from === "up" ? distance / 2 : wide ? 0 : 20,
        duration: wide ? 1 : .7, delay: Number(node.dataset.revealDelay ?? 0), ease: "power3.out", clearProps: "transform,opacity,visibility",
        scrollTrigger: { trigger: node, start: "top 88%", once: true },
      });
    });
    return () => ScrollTrigger.refresh();
  });
}
