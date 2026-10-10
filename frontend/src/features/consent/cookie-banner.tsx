"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import Link from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { openConsentPreferences, saveConsent, useConsent } from "./consent-store";

/**
 * Asked until a current decision exists. A non-blocking panel centred at the bottom: the page stays usable behind it, and
 * "reject" and "accept" have the same shape, size and weight so neither is pushed.
 */
export function CookieBanner() {
  const t = useTranslations("consent.banner");
  const consent = useConsent();
  const panel = useRef<HTMLElement>(null);
  const open = consent.ready && !consent.decided;

  // While the banner is up the page gets the same amount of room below its content (see `body` in globals.css), so
  // the last controls of any page can always be scrolled above the banner and never stay hidden under it. The room is
  // the banner, its distance from the bottom edge (12px, or the safe area when that is larger) and 12px of air.
  useEffect(() => {
    const node = panel.current;
    if (!open || !node) return;
    const root = document.documentElement;
    const update = () => {
      const gap = Number.parseFloat(getComputedStyle(node).bottom) || 0;
      root.style.setProperty("--cookie-banner-offset", `${Math.ceil(node.getBoundingClientRect().height + gap) + 12}px`);
    };
    root.dataset.cookieBannerOpen = "";
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--cookie-banner-offset");
      delete root.dataset.cookieBannerOpen;
    };
  }, [open]);

  if (!open) return null;

  return (
    <section
      ref={panel}
      role="region"
      aria-label={t("label")}
      data-cookie-banner
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-xl sm:max-w-lg sm:p-5"
    >
      <h2 className="text-base font-semibold">{t("title")}</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
        {t("description")}{" "}
        <Link href="/cookies" className="rounded-sm font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {t("policy")}
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11 flex-1 basis-36" onClick={() => saveConsent(false)}>{t("rejectAll")}</Button>
        <Button variant="outline" className="min-h-11 flex-1 basis-36" onClick={openConsentPreferences}>{t("manage")}</Button>
        <Button variant="outline" className="min-h-11 flex-1 basis-36" onClick={() => saveConsent(true)}>{t("acceptAll")}</Button>
      </div>
    </section>
  );
}
