"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import Link from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const linkClass = "rounded-sm font-medium text-primary underline underline-offset-4 outline-hidden hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

/** Opens in a new tab so a half-filled form is not lost; the screen reader hears that it does. */
function PageLink({ href, children }: { href: "/terms" | "/kvkk" | "/privacy"; children: ReactNode }) {
  const t = useTranslations("register");
  return (
    <Link href={href} target="_blank" rel="noopener" className={linkClass}>
      {children}<span className="sr-only"> {t("newTab")}</span>
    </Link>
  );
}

/**
 * The notice shown where an account is created. It is a notice, not a consent: no checkbox, nothing is recorded, and
 * the only consent PDA asks for (analytics) lives in the cookie layer.
 */
export function RegistrationNotice({ variant = "form", className }: { variant?: "form" | "oauth"; className?: string }) {
  const t = useTranslations("register");
  return (
    <p className={cn("text-xs leading-5 text-muted-foreground", className)}>
      {t.rich(variant === "oauth" ? "noticeOauth" : "notice", {
        terms: (chunks) => <PageLink href="/terms">{chunks}</PageLink>,
        kvkk: (chunks) => <PageLink href="/kvkk">{chunks}</PageLink>,
        privacy: (chunks) => <PageLink href="/privacy">{chunks}</PageLink>,
      })}
    </p>
  );
}
