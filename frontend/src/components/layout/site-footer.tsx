"use client";

import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { EnvelopeSimple, ArrowUpRight, Scales } from "@phosphor-icons/react";
import { GitHubIcon } from "@/components/common/brand-icons";
import { APP_VERSION, CONTACT_EMAIL, CONTACT_HREF, CONTRIBUTORS, INFO_LINKS, REPOSITORY_URL } from "@/features/public-info/site-info";
import { openConsentPreferences } from "@/features/consent/consent-store";
import { trackCta } from "@/features/analytics/cta";
import { cn } from "@/lib/utils";

const linkClass = "inline-flex min-h-11 max-w-full items-center gap-2 rounded-md py-2 text-left text-sm hyphens-auto [overflow-wrap:anywhere] underline-offset-4 outline-hidden hover:text-foreground hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

/** Same content and layout everywhere; `tone` only swaps the palette (auth pages sit on a photographic background). */
const tones = {
  default: { footer: "border-border bg-card text-foreground", divider: "border-border", muted: "text-muted-foreground" },
  auth: { footer: "border-(--auth-control-border) bg-(--auth-control) text-(--auth-ink) backdrop-blur-xl", divider: "border-(--auth-control-border)", muted: "text-(--auth-muted)" },
} as const;

export function SiteFooter({ tone = "default" }: { tone?: "default" | "auth" }) {
  const t = useTranslations("siteFooter");
  const palette = tones[tone];

  return (
    <footer className={cn("mt-auto shrink-0 border-t", palette.footer)}>
      <div className="mx-auto w-full max-w-[1560px] px-4 py-3 sm:px-8 sm:py-2">
        <nav aria-label={t("information")}>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-5 sm:gap-y-0 [&>li]:min-w-0">
            {INFO_LINKS.filter(({ key }) => key !== "license").map(({ key, href }) => (
              <li key={key}><Link href={href} className={linkClass}>{t(key)}</Link></li>
            ))}
            <li><button type="button" onClick={openConsentPreferences} className={cn(linkClass, "cursor-pointer")}>{t("manageCookies")}</button></li>
          </ul>
        </nav>
        <div className={cn("mt-2 flex min-w-0 flex-col items-center gap-x-6 border-t pt-2 sm:mt-0 sm:flex-row sm:flex-wrap sm:justify-center sm:pt-1", palette.divider)}>
          <p className={cn("order-last w-full py-1 text-center text-xs sm:order-0 sm:w-auto sm:py-2", palette.muted)}>{t("copyright", { year: new Date().getFullYear() })}<span aria-hidden="true"> · v{APP_VERSION}</span><span className="sr-only">, {t("version", { version: APP_VERSION })}</span></p>
          <ul className="flex w-full min-w-0 items-center justify-center gap-x-5 sm:w-auto sm:flex-wrap" aria-label={t("team")}>
            {CONTRIBUTORS.map(({ name, github }) => (
              <li key={github}>
                <a href={github} className={linkClass} aria-label={t("githubProfile", { name })}>
                  <GitHubIcon className="size-4 shrink-0" />{name}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex w-full min-w-0 items-center justify-center gap-x-3 sm:w-auto sm:gap-x-6">
            <Link href={CONTACT_HREF} className={cn(linkClass, "shrink-0")}>
              <EnvelopeSimple size={17} aria-hidden="true" className="shrink-0" />{t("contact")}
            </Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className={cn(linkClass, "min-w-0 break-all text-xs sm:text-sm")}>{CONTACT_EMAIL}</a>
          </div>
          <div className="flex w-full max-w-full flex-wrap items-center justify-center gap-x-5 sm:w-auto">
            <a href={REPOSITORY_URL} onClick={() => trackCta("github_repo")} className={linkClass}>
              <GitHubIcon className="size-4 shrink-0" />{t("source")}<ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <Link href="/license" className={linkClass}>
              <Scales size={17} aria-hidden="true" className="shrink-0" />{t("license")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
