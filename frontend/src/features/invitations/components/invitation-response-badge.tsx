"use client";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * "+N" unread invitation answers. It sits next to, and never replaces, the pending count: a success-toned outline
 * (the pending count is the solid primary pill), a "+" glyph and an exact spoken label so colour is never the only cue.
 */
export function InvitationResponseBadge({ count, compact = false, afterPending = false }: { count?: number; compact?: boolean; afterPending?: boolean }) {
  const t = useTranslations("invitations");
  if (count === undefined || count <= 0) return null;
  return <span data-invitation-response-count={count} aria-label={t("responseCount", { count })} title={t("responseCount", { count })}
    className={cn("shrink-0 rounded-full border border-success bg-background text-center text-[11px] font-semibold leading-none text-success",
      compact ? "absolute -bottom-2 -right-2 min-w-4 px-1 py-0.5" : cn("min-w-5 px-1.5 py-[3px]", afterPending ? "ml-1" : "ml-auto"))}>
    <span aria-hidden="true">+{count > 99 ? "99+" : count}</span>
  </span>;
}
