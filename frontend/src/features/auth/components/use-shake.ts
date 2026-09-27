"use client";

import { useAnimate, useReducedMotion } from "motion/react";

/** Returns a ref for the element to shake and a trigger; no-op for reduced motion. */
export function useShake<T extends Element>() {
  const [scope, animate] = useAnimate<T>();
  const reduce = useReducedMotion();

  function shake() {
    if (reduce || !scope.current) return;
    animate(scope.current, { x: [0, -8, 8, -6, 6, 0] }, { duration: 0.4 });
  }

  return [scope, shake] as const;
}
