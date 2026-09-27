"use client";

import { useTranslations } from "next-intl";
import { GitHubIcon, GoogleIcon } from "@/components/common/brand-icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { oauthStartUrl } from "../api";

/** Secondary sign-in routes. The backend starts the flow, so these are plain navigations. */
export function OAuthButtons() {
  const t = useTranslations("oauth");
  const cls = cn(
    buttonVariants({ variant: "outline" }),
    "h-11 w-full gap-2 rounded-lg bg-card text-sm font-medium transition-[background-color,transform] duration-200 active:scale-[0.99] dark:bg-input/30",
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("divider")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={oauthStartUrl("google")} className={cls}>
          <GoogleIcon className="size-[18px]" />
          {t("google")}
        </a>
        <a href={oauthStartUrl("github")} className={cls}>
          <GitHubIcon className="size-[18px]" />
          {t("github")}
        </a>
      </div>
    </div>
  );
}
