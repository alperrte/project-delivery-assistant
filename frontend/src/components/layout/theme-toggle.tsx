"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

const subscribe = () => () => {};

export function ThemeToggle() {
  const t = useTranslations("common.theme");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("label")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="active:scale-[0.96]"
    >
      {isDark ? <Sun size={20} weight="duotone" /> : <Moon size={20} weight="duotone" />}
    </Button>
  );
}
