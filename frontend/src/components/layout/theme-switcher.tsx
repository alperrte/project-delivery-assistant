"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { useReducedMotionPreference, useThemeTransitionPreference } from "@/lib/preferences/motion";

import { playThemeTransition } from "./theme-transition";

const subscribe = () => () => {};

/**
 * Theme state that is safe to render: the stored value only shows after
 * mount, so server and client markup match. When the visible scheme actually
 * changes, `selectTheme` plays the sun/moon transition (theme-transition.tsx)
 * where view transitions are supported, and snaps otherwise or under reduced
 * motion.
 */
export function useThemeSelection() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const reduce = useReducedMotionPreference();
  const [transitionEnabled] = useThemeTransitionPreference();

  function selectTheme(next: string) {
    const from = resolvedTheme === "dark" ? "dark" : "light";
    const osScheme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const to = next === "system" ? osScheme : next;
    // Clicking the option that already matches the OS preference pins nothing
    // — it re-enables following the system setting instead, so an explicit
    // choice equal to "system" and an implicit one both read the same way.
    const applied = next !== "system" && next === osScheme ? "system" : next;
    const animated =
      transitionEnabled &&
      !reduce &&
      from !== to &&
      (to === "light" || to === "dark") &&
      "startViewTransition" in document &&
      playThemeTransition(from, to, () => flushSync(() => setTheme(applied)));
    if (!animated) setTheme(applied);
  }

  return {
    mounted,
    theme: mounted ? (theme ?? "system") : "system",
    resolvedTheme: mounted ? resolvedTheme : undefined,
    selectTheme,
  };
}
