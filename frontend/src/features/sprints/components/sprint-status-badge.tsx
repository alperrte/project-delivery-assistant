"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { SprintStatus } from "../types";

const STATUS_CLASS: Record<SprintStatus, string> = {
  PLANNED: "border-border bg-muted text-muted-foreground",
  ACTIVE: "border-label-blue/25 bg-label-blue/10 text-label-blue",
  COMPLETED: "border-label-green/25 bg-label-green/10 text-label-green",
};

export function SprintStatusBadge({ status, className }: { status: SprintStatus; className?: string }) {
  const t = useTranslations("sprints.status");
  return (
    <span className={cn("inline-flex h-5 items-center rounded-md border px-1.5 text-xs font-medium whitespace-nowrap", STATUS_CLASS[status], className)}>
      {t(status)}
    </span>
  );
}
