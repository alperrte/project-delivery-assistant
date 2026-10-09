"use client";

import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { EnvelopeSimple, ArrowUpRight } from "@phosphor-icons/react";
import { GitHubIcon } from "@/components/common/brand-icons";
import { CONTACT_EMAIL, CONTRIBUTORS, INFO_LINKS, REPOSITORY_URL } from "@/features/public-info/site-info";
import { cn } from "@/lib/utils";

const linkClass = "inline-flex min-h-11 items-center gap-2 rounded-md py-2 text-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

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
      <div className="mx-auto w-full max-w-[1560px] px-4 py-2 sm:px-8">
        <nav aria-label={t("information")}>
          <ul className="flex flex-wrap justify-center gap-x-5">
            {INFO_LINKS.map(({ key, href }) => (
              <li key={key}><Link href={href} className={linkClass}>{t(key)}</Link></li>
            ))}
          </ul>
        </nav>
        <div className={cn("flex flex-col items-center gap-x-6 border-t pt-1 sm:flex-row sm:flex-wrap sm:justify-center", palette.divider)}>
          <p className={cn("py-2 text-center text-xs", palette.muted)}>{t("copyright", { year: new Date().getFullYear() })}</p>
          <ul className="flex flex-wrap justify-center gap-x-5" aria-label={t("team")}>
            {CONTRIBUTORS.map(({ name, github }) => (
              <li key={github}>
                <a href={github} className={linkClass} aria-label={t("githubProfile", { name })}>
                  <GitHubIcon className="size-4 shrink-0" />{name}
                </a>
              </li>
            ))}
          </ul>
          <a href={"mailto:" + CONTACT_EMAIL} className={cn(linkClass, "max-w-full")}>
            <EnvelopeSimple size={17} aria-hidden="true" className="shrink-0" /><span className="break-all">{CONTACT_EMAIL}</span>
          </a>
          <a href={REPOSITORY_URL} className={linkClass}>
            <GitHubIcon className="size-4 shrink-0" />{t("source")}<ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}
