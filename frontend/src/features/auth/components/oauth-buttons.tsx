"use client";

import { useTranslations } from "next-intl";
import { GithubLogo, GoogleLogo } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { oauthStartUrl } from "../api";

export function OAuthButtons() {
  const t = useTranslations("oauth");
  const cls = cn(buttonVariants({ variant: "outline" }), "h-11 w-full gap-2.5 text-[0.95rem]");

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        <a href={oauthStartUrl("google")} className={cls}>
          <GoogleLogo size={20} weight="bold" />
          {t("google")}
        </a>
        <a href={oauthStartUrl("github")} className={cls}>
          <GithubLogo size={20} weight="bold" />
          {t("github")}
        </a>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("divider")}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
