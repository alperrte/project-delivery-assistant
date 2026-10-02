"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/common/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function ErrorFrame({ children }: { children: ReactNode }) {
  const t = useTranslations("errorPages.common");
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <a href="#error-main" className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">{t("skip")}</a>
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-10">
        <a href="/login" aria-label="PDA · Project Delivery Assistant" className="w-28 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><Logo variant="wordmark" compact plain size={112} /></a>
        <div className="flex items-center gap-3"><LocaleSwitcher /><ThemeToggle tone="auth" /></div>
      </header>
      <main id="error-main" tabIndex={-1} className="flex w-full flex-1 items-center px-6 pb-6 sm:px-10">{children}</main>
    </div>
  );
}
