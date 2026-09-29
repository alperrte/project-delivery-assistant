"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "motion/react";
import { Moon, Sun } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { playThemeTransition } from "./theme-transition";

const subscribe = () => () => {};
const OPTIONS = ["system", "light", "dark"] as const;

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
  const reduce = useReducedMotion();

  function selectTheme(next: string) {
    const from = resolvedTheme === "dark" ? "dark" : "light";
    const osScheme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const to = next === "system" ? osScheme : next;
    // Clicking the option that already matches the OS preference pins nothing
    // — it re-enables following the system setting instead, so an explicit
    // choice equal to "system" and an implicit one both read the same way.
    const applied = next !== "system" && next === osScheme ? "system" : next;
    const animated =
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

/** System / Light / Dark menu for the app header. */
export function ThemeSwitcher() {
  const t = useTranslations("common.theme");
  const { theme, resolvedTheme, selectTheme } = useThemeSelection();
  const Icon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("label")}
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8")}
      >
        <Icon size={18} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup value={theme} onValueChange={selectTheme}>
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {t(option)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
