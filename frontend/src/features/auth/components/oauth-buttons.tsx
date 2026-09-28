"use client";

import { useTranslations } from "next-intl";
import { GitHubIcon, GoogleIcon } from "@/components/common/brand-icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { oauthStartUrl } from "../api";

/**
 * Secondary sign-in routes. The backend starts the flow, so these are plain
 * navigations. The rule always sits between the buttons and the email form:
 * "or" above the buttons when they follow the form (login), "or with email"
 * below them when they come first (register).
 */
export function OAuthButtons({ divider = "orEmail" }: { divider?: "or" | "orEmail" }) {
  const t = useTranslations("oauth");
  const cls = cn(
    buttonVariants({ variant: "outline" }),
    "h-11 w-full gap-2 rounded-[0.7rem] border-(--auth-field-border) bg-(--auth-field) text-[0.85rem] font-semibold text-(--auth-ink) transition-[background-color,border-color,transform] duration-200 hover:border-(--auth-link)/50 hover:bg-(--auth-field) hover:text-(--auth-ink) active:scale-[0.99] dark:border-(--auth-field-border) dark:bg-(--auth-field) dark:hover:bg-white/[0.06]",
  );

  const rule = (
    <div className="flex items-center gap-3 text-xs text-(--auth-muted)">
      <span className="h-px flex-1 bg-(--auth-field-border)" />
      {t(divider === "or" ? "or" : "divider")}
      <span className="h-px flex-1 bg-(--auth-field-border)" />
    </div>
  );

  return (
    <div className="space-y-5">
      {divider === "or" && rule}
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
      {divider === "orEmail" && rule}
    </div>
  );
}
