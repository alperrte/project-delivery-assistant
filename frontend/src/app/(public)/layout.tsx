import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/common/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("publicPages.common");
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <a href="#public-main" className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">{t("skip")}</a>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <Link href="/login" aria-label="PDA · Project Delivery Assistant" className="w-24 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><Logo variant="wordmark" compact plain size={96} /></Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{t("login")}</Link>
          </div>
        </div>
      </header>
      <main id="public-main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-8 sm:py-16">{children}</main>
      <SiteFooter />
    </div>
  );
}
