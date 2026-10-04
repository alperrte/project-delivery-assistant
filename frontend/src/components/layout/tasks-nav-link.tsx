"use client";

import Link from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle } from "@phosphor-icons/react";
import { useMyTaskCounts } from "@/features/tasks/hooks";
import { cn } from "@/lib/utils";
import { navItemClass } from "./nav-item";

const HREF = "/tasks";

/** Sidebar entry for Görevlerim; the badge is the open count and turns red while something is overdue. */
export function TasksNavLink({ narrow, onNavigate }: { narrow: boolean; onNavigate: () => void }) {
  const tw = useTranslations("workspace");
  const t = useTranslations("tasks.my.nav");
  const pathname = usePathname();
  const { data: counts } = useMyTaskCounts();
  const active = pathname === HREF;
  const open = counts?.open ?? 0;
  const overdue = counts?.overdue ?? 0;
  const summary = open > 0 ? t("badge", { open, overdue }) : undefined;
  const badge = open > 99 ? "99+" : String(open);

  return (
    <Link
      href={HREF}
      onClick={onNavigate}
      title={narrow ? tw("tasks") : undefined}
      aria-label={narrow ? (summary ? `${tw("tasks")}, ${summary}` : tw("tasks")) : undefined}
      aria-current={active ? "page" : undefined}
      className={navItemClass(active, cn("flex items-center gap-3 rounded-md py-2.5 text-[13px] hover:bg-muted hover:text-foreground", narrow ? "justify-center px-0" : "px-3"))}
    >
      <span className="relative inline-flex">
        <CheckCircle size={19} weight={active ? "fill" : "regular"} aria-hidden="true" />
        {narrow && open > 0 && <span aria-hidden="true" className={cn("absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-background", overdue > 0 ? "bg-destructive" : "bg-primary")} />}
      </span>
      {!narrow && (
        <>
          <span>{tw("tasks")}</span>
          {open > 0 && (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "ml-auto min-w-5 rounded-full px-1.5 text-center text-[10px] font-semibold tabular-nums",
                  overdue > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                )}
              >
                {badge}
              </span>
              <span className="sr-only">{summary}</span>
            </>
          )}
        </>
      )}
    </Link>
  );
}
