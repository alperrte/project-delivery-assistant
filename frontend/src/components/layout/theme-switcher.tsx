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

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

const subscribe = () => () => {};
const OPTIONS = ["system", "light", "dark"] as const;

/**
 * Theme state that is safe to render: the stored value only shows after
 * mount, so server and client markup match. `selectTheme` crossfades through
 * a view transition where supported instead of snapping.
 */
export function useThemeSelection() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const reduce = useReducedMotion();

  function selectTheme(next: string) {
    const doc = document as ViewTransitionDocument;
    if (reduce || typeof doc.startViewTransition !== "function") {
      setTheme(next);
      return;
    }
    doc.startViewTransition(() => flushSync(() => setTheme(next)));
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
