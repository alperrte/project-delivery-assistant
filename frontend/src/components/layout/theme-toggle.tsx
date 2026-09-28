"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { Moon, Sun } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useThemeSelection } from "./theme-switcher";

const OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
] as const;

/**
 * Two-state light/dark pill for the auth screens. It shows the resolved theme
 * (so a "system" user still sees where they are) and an explicit click pins
 * that choice. The thumb slides between the two halves.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("common.theme");
  const { resolvedTheme, selectTheme } = useThemeSelection();
  const reduce = useReducedMotion();

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn(
        "flex items-center gap-0.5 rounded-full border border-(--auth-control-border) bg-(--auth-control) p-1 shadow-[0_6px_18px_-10px_rgb(15_23_42/0.35)] backdrop-blur-md",
        className,
      )}
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
              "relative grid size-9 place-items-center rounded-full outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-(--glow)",
              active ? "text-(--auth-ink)" : "text-(--auth-muted) hover:text-(--auth-ink)",
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-toggle-thumb"
                transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.4, bounce: 0.15 }}
                className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_-2px_rgb(15_23_42/0.25)] dark:bg-white/10 dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]"
              />
            )}
            <Icon
              size={18}
              weight={active ? "bold" : "regular"}
              className={cn("relative", active && value === "dark" && "text-(--glow)")}
            />
          </button>
        );
      })}
    </div>
  );
}
