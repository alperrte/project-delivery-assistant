"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { EnvelopeSimple, ArrowUpRight } from "@phosphor-icons/react";
import { GitHubIcon } from "@/components/common/brand-icons";
import { CONTACT_EMAIL, CONTRIBUTORS, INFO_LINKS, REPOSITORY_URL } from "@/features/public-info/site-info";
import { cn } from "@/lib/utils";

const linkClass = "inline-flex min-h-11 items-center gap-2 rounded-md py-2 text-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

export function SiteFooter({ tone = "default" }: { tone?: "default" | "auth" | "landing" }) {
  const t = useTranslations("siteFooter");

  if (tone === "auth") {
    return (
      <footer className="mt-auto shrink-0 border-t border-(--auth-control-border) bg-(--auth-control) text-(--auth-ink) backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1560px] px-4 py-2 sm:px-8">
          <nav aria-label={t("information")}>
            <ul className="flex flex-wrap justify-center gap-x-5">
              {INFO_LINKS.map(({ key, href }) => (
                <li key={key}><Link href={href} className={linkClass}>{t(key)}</Link></li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col items-center gap-x-6 border-t border-(--auth-control-border) pt-1 sm:flex-row sm:flex-wrap sm:justify-center">
            <p className="py-2 text-center text-xs text-(--auth-muted)">{t("copyright", { year: new Date().getFullYear() })}</p>
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
              <GitHubIcon className="size-4 shrink-0" />{t("source")}<ArrowUpRight size={14} aria-hidden="true" /><span className="text-xs">Apache 2.0</span>
            </a>
          </div>
        </div>
      </footer>
    );
  }

  if (tone === "landing") {
    return (
      <footer className="border-t border-border bg-card text-foreground">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-10 md:grid-cols-3 sm:px-10">
          <div><p className="text-lg font-semibold" translate="no">PDA</p><p className="mt-2 text-sm text-muted-foreground" translate="no">Project Delivery Assistant</p><p className="mt-5 text-xs text-muted-foreground">{t("copyright", { year: new Date().getFullYear() })}</p></div>
          <nav aria-label={t("information")}><p className="mb-2 text-sm font-medium">{t("information")}</p><ul>{INFO_LINKS.map(({ key, href }) => <li key={key}><Link href={href} className={cn(linkClass, "text-muted-foreground")}>{t(key)}</Link></li>)}</ul></nav>
          <div className="flex flex-col items-start"><p className="mb-2 text-sm font-medium">{t("team")}</p><ul>{CONTRIBUTORS.map(({ name, github }) => <li key={github}><a href={github} className={cn(linkClass, "text-muted-foreground")} aria-label={t("githubProfile", { name })}><GitHubIcon className="size-4 shrink-0" />{name}</a></li>)}</ul><a href={"mailto:" + CONTACT_EMAIL} className={cn(linkClass, "max-w-full text-muted-foreground")}><EnvelopeSimple size={17} aria-hidden="true" /><span className="break-all">{CONTACT_EMAIL}</span></a><a href={REPOSITORY_URL} className={cn(linkClass, "text-muted-foreground")}><GitHubIcon className="size-4 shrink-0" />{t("source")}<span className="text-xs">Apache 2.0</span></a></div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-auto border-t border-border bg-card text-foreground">
      <div className="mx-auto flex w-full max-w-[1560px] flex-col items-center gap-x-6 px-4 py-3 sm:px-8 xl:flex-row xl:flex-wrap xl:justify-between">
        <p className="py-2 text-center text-xs text-muted-foreground">{t("copyright", { year: new Date().getFullYear() })}</p>
        <nav aria-label={t("information")}>
          <ul className="flex flex-wrap justify-center gap-x-5">
            {INFO_LINKS.map(({ key, href }) => (
              <li key={key}><Link href={href} className={linkClass}>{t(key)}</Link></li>
            ))}
          </ul>
        </nav>
        <a href={"mailto:" + CONTACT_EMAIL} className={cn(linkClass, "max-w-full")}><EnvelopeSimple size={17} aria-hidden="true" className="shrink-0" /><span className="break-all">{CONTACT_EMAIL}</span></a>
      </div>
    </footer>
  );
}
