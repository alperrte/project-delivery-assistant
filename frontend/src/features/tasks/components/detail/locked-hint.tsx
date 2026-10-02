"use client";

import type { ReactElement } from "react";
import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LockReason } from "../../permissions";

/**
 * A disabled control cannot take focus or hover, so it never shows a tooltip on its own. When the control is locked,
 * this wraps it in a focusable span that explains why, to the pointer and to the keyboard and screen reader alike.
 */
export function LockedHint({ locked, reason, children, className }: { locked: boolean; reason: LockReason; children: ReactElement; className?: string }) {
  const t = useTranslations("tasks.locked");
  if (!locked) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className={cn("inline-flex max-w-full cursor-not-allowed rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)} />}>
        {children}
        <span className="sr-only">{t(reason)}</span>
      </TooltipTrigger>
      <TooltipContent>{t(reason)}</TooltipContent>
    </Tooltip>
  );
}
