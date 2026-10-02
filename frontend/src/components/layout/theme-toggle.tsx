"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Moon, Sun } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useReducedMotionPreference } from "@/lib/preferences/motion";
import { useThemeSelection } from "./theme-switcher";

const OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
] as const;

const CONTAINER_TONE = {
  auth: "border-(--auth-control-border) bg-(--auth-control) shadow-[0_6px_18px_-10px_rgb(15_23_42/0.35)] backdrop-blur-md",
  app: "border-border bg-muted",
} as const;

const BUTTON_SIZE = { auth: "size-9", app: "size-7" } as const;

const THUMB_TONE = {
  auth: "bg-white shadow-[0_2px_8px_-2px_rgb(15_23_42/0.25)] dark:bg-white/10 dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]",
  // A neutral raised chip, so the coloured sun and moon read well on it in both themes.
  app: "bg-card shadow-sm ring-1 ring-border",
} as const;

/** The navbar's icons are filled and keep their own colour: a yellow sun and a PDA-blue moon. */
const APP_ICON_TONE = {
  light: "text-amber-500 dark:text-amber-400",
  dark: "text-[color-mix(in_oklab,var(--glow),black_25%)] dark:text-(--glow)",
} as const;

const ICON_TONE = {
  auth: { active: "text-(--auth-ink)", inactive: "text-(--auth-muted) hover:text-(--auth-ink)" },
  app: { active: "text-primary-foreground", inactive: "text-muted-foreground hover:text-foreground" },
} as const;

/**
 * Two-state light/dark pill. It shows the resolved theme (so a "system" user
 * still sees where they are) and an explicit click pins that choice, with the
 * shared `playThemeTransition` circle-reveal. The thumb slides between the
 * two halves and doubles as the "selected" indicator. `tone="auth"` (default)
 * keeps the original scene styling for the login/auth screens; `tone="app"`
 * switches to the titanium app-shell tokens for the navbar, with a solid
 * `bg-primary` thumb so the active side reads clearly against `bg-muted`.
 */
export function ThemeToggle({ className, tone = "auth" }: { className?: string; tone?: "auth" | "app" }) {
  const t = useTranslations("common.theme");
  const { resolvedTheme, selectTheme } = useThemeSelection();
  const reduce = useReducedMotionPreference();

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn("flex items-center gap-0.5 rounded-full border p-1", CONTAINER_TONE[tone], className)}
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
              BUTTON_SIZE[tone],
              active ? ICON_TONE[tone].active : ICON_TONE[tone].inactive,
            )}
          >
            {active && (
              <motion.span
                layoutId={`theme-toggle-thumb-${tone}`}
                transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.4, bounce: 0.15 }}
                className={cn("absolute inset-0 rounded-full", THUMB_TONE[tone])}
              />
            )}
            <Icon
              size={tone === "app" ? 15 : 18}
              weight={tone === "app" ? "fill" : active ? "bold" : "regular"}
              aria-hidden="true"
              className={cn(
                "relative",
                tone === "app" && [APP_ICON_TONE[value], !active && "opacity-60"],
                tone === "auth" && active && value === "dark" && "text-(--glow)",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
