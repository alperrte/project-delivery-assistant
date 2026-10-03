"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { motion } from "motion/react";
import { Moon, Sun } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useReducedMotionPreference } from "@/lib/preferences/motion";
import { useThemeSelection } from "./theme-switcher";

const OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
] as const;

const ICON_TONE = {
  light: "text-amber-500 dark:text-amber-400",
  dark: "text-[color-mix(in_oklab,var(--glow),black_25%)] dark:text-(--glow)",
} as const;

/**
 * Two-state light/dark pill. It shows the resolved theme (so a "system" user
 * still sees where they are) and an explicit click pins that choice, with the
 * shared `playThemeTransition` circle-reveal. The thumb slides between the
 * two halves and doubles as the "selected" indicator. Every page uses the
 * same styling. Each instance owns its thumb animation, including inert demos.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("common.theme");
  const { resolvedTheme, selectTheme } = useThemeSelection();
  const reduce = useReducedMotionPreference();
  const id = useId();

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn("theme-toggle flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted p-1", className)}
    >
      {OPTIONS.map(({ value, icon: Icon }) => {
        const active = resolvedTheme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            aria-label={t(value)}
            title={t(value)}
            onClick={() => selectTheme(value)}
            className={cn(
              "relative grid place-items-center rounded-full outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-(--glow)",
              "size-7",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`theme-toggle-thumb-${id}`}
                transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.4, bounce: 0.15 }}
                className="absolute inset-0 rounded-full bg-card shadow-sm ring-1 ring-border"
              />
            )}
            <Icon
              size={15}
              weight="fill"
              aria-hidden="true"
              className={cn(
                "relative",
                ICON_TONE[value],
                !active && "opacity-60",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
