"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { openConsentPreferences } from "./consent-store";

/** The policy page's way to reopen the preferences (the footer has the same action as a link-style button). */
export function ManageCookiePreferencesButton() {
  const t = useTranslations("siteFooter");
  return (
    <Button type="button" variant="outline" className="min-h-11" onClick={openConsentPreferences}>
      {t("manageCookies")}
    </Button>
  );
}
