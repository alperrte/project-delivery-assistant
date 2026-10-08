"use client";

import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CalendarCheck, Flag } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { PriorityBadge, StatusBadge } from "@/features/tasks/components/task-badges";
import { useTaskFormat } from "@/features/tasks/format";
import type { CalendarTaskEntry } from "../hooks/use-calendar-tasks";

/** The tasks assigned to the user that start or are due on the selected day; each row opens the task. */
export function TaskAgenda({ entries, slug, compact = false }: { entries: CalendarTaskEntry[]; slug: string; compact?: boolean }) {
  const t = useTranslations("calendarPage");
  const format = useTaskFormat();
  if (entries.length === 0) return null;

  return (
    <div className="space-y-1">
      <h3 className="px-2 pt-1 text-[11px] font-medium text-muted-foreground">{t("tasks.heading")}</h3>
      <ul className="space-y-1">
        {entries.map(({ task, kind }) => {
          const done = task.status === "DONE";
          const Icon = kind === "deadline" ? Flag : CalendarCheck;
          const tone = done || kind === "start" ? "bg-muted text-muted-foreground" : task.overdue ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning";
          return (
            <li key={`${task.id}-${kind}`} data-calendar-task={task.id} data-kind={kind} className="relative flex items-start gap-3 rounded-md p-2 hover:bg-muted/50">
              <span className={cn("mt-0.5 grid shrink-0 place-items-center rounded-md", compact ? "size-6" : "size-8", tone)}>
                <Icon size={compact ? 14 : 17} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <Link
                  href={`/projects/${slug}/tasks/${task.id}`}
                  className={cn("block rounded-sm text-sm leading-5 font-medium outline-none after:absolute after:inset-0 focus-visible:ring-3 focus-visible:ring-ring/50", done && "text-muted-foreground line-through")}
                >
                  <span className="mr-1.5 font-mono text-xs font-normal text-muted-foreground no-underline">{task.taskKey}</span>
                  {task.title}
                </Link>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {t(`tasks.${kind}`)}
                    {kind === "deadline" && task.deadlineAt && ` · ${format.dateTime(task.deadlineAt)}`}
                  </span>
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
