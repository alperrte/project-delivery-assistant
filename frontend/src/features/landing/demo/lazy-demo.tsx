"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "../landing.module.css";

/**
 * A real PDA component shown as illustration. The surface is `inert` and `aria-hidden`; the caption is the text alternative.
 * Children (the dynamic chunk) mount only when the box is near the viewport; the empty box already has its final size (`className`).
 */
export function LazyDemo({ description, className, children }: { description: string; className?: string; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) { const frame = requestAnimationFrame(() => setNear(true)); return () => cancelAnimationFrame(frame); }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: "600px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <figure ref={root} className={cn(styles.demo, className)} data-demo>
    <div className={cn("workspace-preview", styles.demoSurface)} inert aria-hidden="true">{near && children}</div>
    <figcaption className="sr-only">{description}</figcaption>
  </figure>;
}
