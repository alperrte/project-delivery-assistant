"use client";

import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useMyTaskCounts } from "../hooks";

function Figure({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="space-y-1">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn("text-xl font-semibold tabular-nums", danger && value > 0 ? "text-destructive" : value === 0 && "text-muted-foreground")}>{value}</dd>
    </div>
  );
}

/** Dashboard summary of the signed-in user's workload; the full list lives on /tasks. */
export function MyTasksCard() {
  const t = useTranslations("tasks.my");
  const counts = useMyTaskCounts();

  return (
    <section className="min-w-0">
      <h2 className="mb-4 text-[15px] font-semibold">{t("title")}</h2>
      <div className="rounded-lg border bg-card p-5">
        {counts.isPending && !counts.isError && (
          <div aria-hidden="true" className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        )}
        {counts.isError && (
          <div role="alert" className="space-y-3">
            <p className="text-xs text-muted-foreground">{t("card.error")}</p>
            <Button variant="outline" size="sm" onClick={() => void counts.refetch()}>
              {t("retry")}
            </Button>
          </div>
        )}
        {counts.data && (
          <>
            <dl aria-label={t("summary.label")} className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Figure label={t("summary.open")} value={counts.data.open} />
              <Figure label={t("summary.overdue")} value={counts.data.overdue} danger />
              <Figure label={t("summary.dueSoon")} value={counts.data.dueSoon} />
              <Figure label={t("summary.pool")} value={counts.data.poolAvailable} />
            </dl>
            <Link href="/tasks" className="mt-4 inline-flex items-center gap-1 border-t pt-3 text-[11px] font-medium text-primary hover:underline">
              {t("card.open")}
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
