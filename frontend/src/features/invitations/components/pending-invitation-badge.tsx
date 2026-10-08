"use client";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Unknown/failed totals have no badge; the accessible count remains exact above 99. */
export function PendingInvitationBadge({ count, compact = false }: { count?: number; compact?: boolean }) {
  const t = useTranslations("invitations");
  if (count === undefined || count <= 0) return null;
  return <span data-pending-invitation-count={count} aria-label={t("pendingCount", { count })}
    className={cn("shrink-0 rounded-full bg-primary text-center text-[11px] font-semibold leading-none text-primary-foreground",
      compact ? "absolute -right-2 -top-2 min-w-4 px-1 py-0.5" : "ml-auto min-w-5 px-1.5 py-1")}>
    <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
  </span>;
}
