import type { ReactNode } from "react";
import Link from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/common/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const navLink = "inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("publicPages.common");
  const landing = await getTranslations("landing");
  const footer = await getTranslations("siteFooter");
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <a href="#public-main" className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">{t("skip")}</a>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <Link href="/" aria-label="PDA · Project Delivery Assistant" className="w-24 rounded-md outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><Logo variant="wordmark" compact plain size={96} /></Link>
          <nav aria-label={landing("navigation")} className="flex flex-wrap items-center justify-end gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
            <Link href="/about" className={navLink}>{footer("about")}</Link>
            <Link href="/login" className={navLink}>{landing("login")}</Link>
            <Link href="/register" className={cn(buttonVariants(), "auth-cta min-h-11 gap-2 rounded-full px-4 text-sm font-semibold hover:brightness-110")}>{landing("register")}<ArrowUpRight size={15} aria-hidden="true" className="max-sm:hidden" /></Link>
          </nav>
        </div>
      </header>
      <main id="public-main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-8 sm:py-16">{children}</main>
      <SiteFooter />
    </div>
  );
}
