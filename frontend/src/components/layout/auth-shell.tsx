import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/common/logo";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { HeroLandingPanel } from "@/features/auth/components/hero-landing-panel";

export async function AuthShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("story");
  const tc = await getTranslations("common");
  return (
    <div className="grid min-h-[100dvh] bg-background lg:grid-cols-[58fr_42fr]">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        {t("skip")}
      </a>

      <div className="order-2 lg:order-1">
        <HeroLandingPanel />
      </div>

      <div className="order-1 flex min-h-[100dvh] flex-col px-6 py-5 sm:px-10 lg:order-2 lg:px-12">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Logo variant="emblem" size={32} priority className="size-8 drop-shadow-none" />
            <div className="leading-tight">
              <p className="font-heading text-[0.95rem] font-semibold">PDA</p>
              <p className="text-xs text-muted-foreground">{tc("appName")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeSwitcher />
          </div>
        </header>

        <main id="main" className="mx-auto flex w-full max-w-[27rem] flex-1 flex-col justify-center py-8">
          <div className="rounded-xl border bg-card p-6 sm:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
