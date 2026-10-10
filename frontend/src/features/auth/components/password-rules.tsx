"use client";

import { useTranslations } from "next-intl";
import { Check, Circle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES } from "../schemas";

/** Live checklist under a "new password" field; mirrors the backend rule so the submit never surprises the user. */
export function PasswordRules({ value, className }: { value: string; className?: string }) {
  const t = useTranslations("passwordRules");
  return (
    <div className={cn("text-sm", className)}>
      <p className="mb-1.5 text-muted-foreground">{t("title")}</p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(value);
          return (
            <li key={rule.key} className={cn("flex items-center gap-2 transition-colors", met ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
              {met ? <Check aria-hidden size={14} weight="bold" /> : <Circle aria-hidden size={14} />}
              <span>{t(rule.key)}</span>
              <span className="sr-only">{t(met ? "met" : "unmet")}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
