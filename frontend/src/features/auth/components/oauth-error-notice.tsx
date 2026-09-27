"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { WarningCircle } from "@phosphor-icons/react";

const KNOWN = ["access_denied", "email_not_verified", "account_exists", "provider_error"];

export function OAuthErrorNotice() {
  const t = useTranslations("oauth.errors");
  const code = useSearchParams().get("oauth_error");
  if (!code) return null;

  return (
    <div
      role="alert"
      className="mb-5 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <WarningCircle size={20} weight="fill" className="mt-0.5 shrink-0" />
      <p>{t(KNOWN.includes(code) ? code : "unknown")}</p>
    </div>
  );
}
